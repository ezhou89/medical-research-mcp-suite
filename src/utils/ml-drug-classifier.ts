// src/utils/ml-drug-classifier.ts

export interface DrugFeatures {
  name: string;
  nameLength: number;
  hasSuffix: string[];
  hasPrefix: string[];
  molecularWeight?: number;
  proteinSequence?: string;
  clinicalTrialCount: number;
  sponsorType: 'big_pharma' | 'biotech' | 'academic' | 'unknown';
  therapeuticAreas: string[];
  textFeatures: number[]; // Embedding vector
}

export interface PredictionResult {
  drugClass: string;
  modalityType: string;
  confidence: number;
  therapeuticArea: string;
  competitorPredictions: string[];
}

export class MLDrugClassifier {
  private namingPatterns: Map<string, RegExp[]> = new Map();
  private therapeuticAreaEmbeddings: Map<string, number[]> = new Map();
  private competitorClusters: Map<string, string[]> = new Map();

  constructor() {
    this.initializePatterns();
    this.loadPretrainedModels();
  }

  private initializePatterns() {
    // Monoclonal antibody patterns
    this.namingPatterns.set('monoclonal_antibody', [
      /.*mab$/i,           // -mab suffix
      /.*zumab$/i,         // -zumab (humanized)
      /.*ximab$/i,         // -ximab (chimeric)
      /.*mumab$/i,         // -mumab (mouse)
      /.*tumab$/i,         // -tumab (human)
      /.*cizumab$/i,       // -cizumab
      /.*lizumab$/i        // -lizumab
    ]);

    // Small molecule patterns
    this.namingPatterns.set('small_molecule', [
      /.*nib$/i,           // Kinase inhibitors
      /.*pril$/i,          // ACE inhibitors
      /.*sartan$/i,        // ARBs
      /.*statin$/i,        // Statins
      /.*cycline$/i,       // Antibiotics
      /.*flozin$/i         // SGLT2 inhibitors
    ]);

    // Gene therapy patterns
    this.namingPatterns.set('gene_therapy', [
      /.*gene.*vec$/i,     // Gene vectors
      /.*abeparvovec$/i,   // AAV vectors
      /.*adeno.*vec$/i,    // Adenoviral vectors
      /.*lenti.*vec$/i     // Lentiviral vectors
    ]);

    // Antisense oligonucleotide patterns
    this.namingPatterns.set('antisense', [
      /.*sen$/i,           // -sen suffix
      /.*nersen$/i,        // -nersen suffix
      /.*morph.*$/i        // Morpholino oligos
    ]);

    // Fusion protein patterns
    this.namingPatterns.set('fusion_protein', [
      /.*cept$/i,          // Receptor fusion proteins
      /.*ceptor$/i         // Receptor proteins
    ]);
  }

  private async loadPretrainedModels() {
    // In a real implementation, load:
    // - Word embeddings trained on biomedical text
    // - Pre-trained classification models
    // - Therapeutic area clustering models
    
    // Simplified therapeutic area embeddings
    this.therapeuticAreaEmbeddings.set('oncology', [0.8, 0.1, 0.0, 0.1]);
    this.therapeuticAreaEmbeddings.set('immunology', [0.1, 0.8, 0.1, 0.0]);
    this.therapeuticAreaEmbeddings.set('neurology', [0.0, 0.1, 0.8, 0.1]);
    this.therapeuticAreaEmbeddings.set('cardiology', [0.1, 0.0, 0.1, 0.8]);
  }

  // Predict drug properties from name and context
  async predictDrugProperties(drugName: string, context?: {
    trialData?: any[];
    publications?: any[];
    sponsorInfo?: any;
  }): Promise<PredictionResult> {
    
    const features = await this.extractFeatures(drugName, context);
    
    // Drug class prediction
    const drugClass = this.predictDrugClass(features);
    
    // Modality type prediction
    const modalityType = this.predictModalityType(features);
    
    // Therapeutic area prediction
    const therapeuticArea = this.predictTherapeuticArea(features);
    
    // Competitor prediction
    const competitors = await this.predictCompetitors(features, therapeuticArea);
    
    // Calculate overall confidence
    const confidence = this.calculatePredictionConfidence(features);

    return {
      drugClass: drugClass.prediction,
      modalityType: modalityType.prediction,
      confidence,
      therapeuticArea,
      competitorPredictions: competitors
    };
  }

  private async extractFeatures(drugName: string, context?: any): Promise<DrugFeatures> {
    const features: DrugFeatures = {
      name: drugName,
      nameLength: drugName.length,
      hasSuffix: this.extractSuffixes(drugName),
      hasPrefix: this.extractPrefixes(drugName),
      clinicalTrialCount: 0,
      sponsorType: 'unknown',
      therapeuticAreas: [],
      textFeatures: []
    };

    if (context?.trialData) {
      features.clinicalTrialCount = context.trialData.length;
      features.therapeuticAreas = this.extractTherapeuticAreas(context.trialData);
      features.sponsorType = this.classifySponsorType(context.sponsorInfo);
    }

    // Generate text embeddings (simplified)
    features.textFeatures = this.generateTextEmbedding(drugName);

    return features;
  }

  private predictDrugClass(features: DrugFeatures): { prediction: string, confidence: number } {
    let maxScore = 0;
    let bestClass = 'other';
    
    for (const [className, patterns] of this.namingPatterns) {
      let score = 0;
      
      // Pattern matching score
      for (const pattern of patterns) {
        if (pattern.test(features.name)) {
          score += 0.8;
          break;
        }
      }
      
      // Context-based scoring
      if (features.clinicalTrialCount > 10) score += 0.1;
      if (features.sponsorType === 'big_pharma') score += 0.1;
      
      if (score > maxScore) {
        maxScore = score;
        bestClass = className;
      }
    }

    return { prediction: bestClass, confidence: maxScore };
  }

  private predictModalityType(features: DrugFeatures): { prediction: string, confidence: number } {
    // Map drug classes to modality types
    const classToModality: Record<string, string> = {
      'monoclonal_antibody': 'biologic',
      'fusion_protein': 'biologic',
      'gene_therapy': 'gene_therapy',
      'antisense': 'oligonucleotide',
      'small_molecule': 'small_molecule'
    };

    const drugClassPrediction = this.predictDrugClass(features);
    const modality = classToModality[drugClassPrediction.prediction] || 'other';
    
    return { prediction: modality, confidence: drugClassPrediction.confidence };
  }

  private predictTherapeuticArea(features: DrugFeatures): string {
    if (features.therapeuticAreas.length > 0) {
      return features.therapeuticAreas[0]; // Return most common
    }

    // Use name patterns for therapeutic area prediction
    const oncologyPatterns = ['mab', 'nib', 'cancer', 'tumor'];
    const immunologyPatterns = ['immune', 'arthritis', 'inflamm'];
    const neurologyPatterns = ['neuro', 'brain', 'alzheimer', 'migraine'];
    
    const name = features.name.toLowerCase();
    
    if (oncologyPatterns.some(p => name.includes(p))) return 'oncology';
    if (immunologyPatterns.some(p => name.includes(p))) return 'immunology';
    if (neurologyPatterns.some(p => name.includes(p))) return 'neurology';
    
    return 'unknown';
  }

  private async predictCompetitors(features: DrugFeatures, therapeuticArea: string): Promise<string[]> {
    // Clustering-based competitor prediction
    const embedding = features.textFeatures;
    const candidates = this.competitorClusters.get(therapeuticArea) || [];
    
    // Calculate similarity scores (simplified cosine similarity)
    const similarities = candidates.map(candidate => ({
      drug: candidate,
      similarity: this.cosineSimilarity(embedding, this.generateTextEmbedding(candidate))
    }));
    
    return similarities
      .filter(s => s.similarity > 0.7)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(s => s.drug);
  }

  private calculatePredictionConfidence(features: DrugFeatures): number {
    let confidence = 0.5;
    
    // Increase confidence based on available data
    if (features.clinicalTrialCount > 0) confidence += 0.2;
    if (features.therapeuticAreas.length > 0) confidence += 0.2;
    if (features.sponsorType !== 'unknown') confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private extractSuffixes(drugName: string): string[] {
    const suffixes: string[] = [];
    const name = drugName.toLowerCase();
    
    const commonSuffixes = ['mab', 'nib', 'pril', 'sartan', 'statin', 'cept', 'sen'];
    
    for (const suffix of commonSuffixes) {
      if (name.endsWith(suffix)) {
        suffixes.push(suffix);
      }
    }
    
    return suffixes;
  }

  private extractPrefixes(drugName: string): string[] {
    const prefixes: string[] = [];
    const name = drugName.toLowerCase();
    
    const commonPrefixes = ['anti', 'mono', 'poly', 'inter'];
    
    for (const prefix of commonPrefixes) {
      if (name.startsWith(prefix)) {
        prefixes.push(prefix);
      }
    }
    
    return prefixes;
  }

  private extractTherapeuticAreas(trialData: any[]): string[] {
    // Extract therapeutic areas from trial conditions
    const areas = new Set<string>();
    
    for (const trial of trialData) {
      const conditions = trial.conditions || [];
      for (const condition of conditions) {
        const area = this.mapConditionToTherapeuticArea(condition);
        if (area) areas.add(area);
      }
    }
    
    return Array.from(areas);
  }

  private mapConditionToTherapeuticArea(condition: string): string | null {
    const conditionLower = condition.toLowerCase();
    
    if (conditionLower.includes('cancer') || conditionLower.includes('tumor') || 
        conditionLower.includes('carcinoma') || conditionLower.includes('lymphoma')) {
      return 'oncology';
    }
    
    if (conditionLower.includes('arthritis') || conditionLower.includes('psoriasis') || 
        conditionLower.includes('inflammatory')) {
      return 'immunology';
    }
    
    if (conditionLower.includes('heart') || conditionLower.includes('cardiac') || 
        conditionLower.includes('diabetes')) {
      return 'cardiology';
    }
    
    if (conditionLower.includes('alzheimer') || conditionLower.includes('migraine') || 
        conditionLower.includes('neurolog')) {
      return 'neurology';
    }
    
    return null;
  }

  private classifySponsorType(sponsorInfo: any): 'big_pharma' | 'biotech' | 'academic' | 'unknown' {
    if (!sponsorInfo?.name) return 'unknown';
    
    const name = sponsorInfo.name.toLowerCase();
    
    const bigPharma = ['pfizer', 'roche', 'novartis', 'merck', 'abbvie', 'johnson', 'bristol', 'amgen'];
    const academic = ['university', 'hospital', 'medical center', 'institute'];
    
    if (bigPharma.some(company => name.includes(company))) return 'big_pharma';
    if (academic.some(inst => name.includes(inst))) return 'academic';
    
    return 'biotech'; // Default for non-academic, non-big pharma
  }

  private generateTextEmbedding(text: string): number[] {
    // Simplified text embedding (in reality, use pre-trained models)
    const features = new Array(100).fill(0);
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      features[charCode % 100] += 1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(features.reduce((sum, val) => sum + val * val, 0));
    return features.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return magnitudeA > 0 && magnitudeB > 0 ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }

  // Continuous learning from new data
  async updateModel(newTrainingData: any[]): Promise<void> {
    // Update patterns based on new drug discoveries
    // Retrain embeddings with new therapeutic area mappings
    // Update competitor clusters
    console.log('Updating ML models with new training data...');
  }
}

export const mlDrugClassifier = new MLDrugClassifier();