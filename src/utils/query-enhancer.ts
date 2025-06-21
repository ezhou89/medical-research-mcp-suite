// src/utils/query-enhancer.ts

import logger from './logger.js';

export interface QueryEnhancementOptions {
  expandSynonyms?: boolean;
  includeRelatedTerms?: boolean;
  addSearchOperators?: boolean;
  targetDatabase?: 'pubmed' | 'clinicaltrials' | 'fda' | 'all';
  maxExpansionTerms?: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface EnhancedQuery {
  originalQuery: string;
  enhancedQuery: string;
  expansionTerms: string[];
  searchStrategy: string;
  estimatedRelevance: number;
  appliedEnhancements: string[];
}

export interface MedicalSynonym {
  term: string;
  synonyms: string[];
  category: 'drug' | 'condition' | 'procedure' | 'anatomy' | 'general';
  confidence: number;
}

export class QueryEnhancer {
  private medicalSynonyms: Map<string, MedicalSynonym>;
  private drugAliases: Map<string, string[]>;
  private conditionAliases: Map<string, string[]>;
  private searchOperators: Map<string, string>;

  constructor() {
    this.medicalSynonyms = new Map();
    this.drugAliases = new Map();
    this.conditionAliases = new Map();
    this.searchOperators = new Map();
    
    this.initializeMedicalTerms();
    this.initializeSearchOperators();
  }

  /**
   * Enhance a search query with synonyms, related terms, and search operators
   */
  public async enhanceQuery(
    query: string, 
    options: QueryEnhancementOptions = {}
  ): Promise<EnhancedQuery> {
    const startTime = Date.now();
    
    try {
      const {
        expandSynonyms = true,
        includeRelatedTerms = true,
        addSearchOperators = true,
        targetDatabase = 'all',
        maxExpansionTerms = 10,
        confidence = 'medium'
      } = options;

      const originalQuery = query.trim();
      let enhancedQuery = originalQuery;
      const expansionTerms: string[] = [];
      const appliedEnhancements: string[] = [];

      // Step 1: Extract key terms from the query
      const keyTerms = this.extractMedicalTerms(originalQuery);

      // Step 2: Expand with synonyms if requested
      if (expandSynonyms) {
        const synonymExpansion = this.expandWithSynonyms(keyTerms, confidence);
        enhancedQuery = this.combineWithSynonyms(enhancedQuery, synonymExpansion);
        expansionTerms.push(...synonymExpansion);
        appliedEnhancements.push('synonym_expansion');
      }

      // Step 3: Add related terms if requested
      if (includeRelatedTerms) {
        const relatedTerms = this.findRelatedTerms(keyTerms, maxExpansionTerms);
        enhancedQuery = this.addRelatedTerms(enhancedQuery, relatedTerms);
        expansionTerms.push(...relatedTerms);
        appliedEnhancements.push('related_terms');
      }

      // Step 4: Add database-specific search operators
      if (addSearchOperators) {
        enhancedQuery = this.addSearchOperators(enhancedQuery, targetDatabase);
        appliedEnhancements.push('search_operators');
      }

      // Step 5: Optimize query structure
      enhancedQuery = this.optimizeQueryStructure(enhancedQuery, targetDatabase);
      appliedEnhancements.push('structure_optimization');

      // Step 6: Calculate estimated relevance
      const estimatedRelevance = this.calculateRelevanceScore(
        originalQuery, 
        enhancedQuery, 
        expansionTerms
      );

      const searchStrategy = this.determineSearchStrategy(targetDatabase, appliedEnhancements);

      logger.info('Query enhancement completed', {
        originalQuery,
        enhancedQuery,
        expansionTermsCount: expansionTerms.length,
        processingTime: Date.now() - startTime,
        estimatedRelevance
      });

      return {
        originalQuery,
        enhancedQuery,
        expansionTerms: [...new Set(expansionTerms)], // Remove duplicates
        searchStrategy,
        estimatedRelevance,
        appliedEnhancements
      };

    } catch (error) {
      logger.error('Query enhancement failed', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return original query if enhancement fails
      return {
        originalQuery: query,
        enhancedQuery: query,
        expansionTerms: [],
        searchStrategy: 'basic',
        estimatedRelevance: 0.5,
        appliedEnhancements: []
      };
    }
  }

  /**
   * Generate multiple query variations for comprehensive search
   */
  public async generateQueryVariations(
    query: string,
    count: number = 3
  ): Promise<EnhancedQuery[]> {
    const variations: EnhancedQuery[] = [];
    
    // Base enhanced query
    const baseEnhanced = await this.enhanceQuery(query, {
      confidence: 'high',
      maxExpansionTerms: 5
    });
    variations.push(baseEnhanced);

    // Broad search variation
    if (count > 1) {
      const broadEnhanced = await this.enhanceQuery(query, {
        confidence: 'low',
        maxExpansionTerms: 15,
        includeRelatedTerms: true
      });
      variations.push(broadEnhanced);
    }

    // Conservative variation
    if (count > 2) {
      const conservativeEnhanced = await this.enhanceQuery(query, {
        expandSynonyms: false,
        includeRelatedTerms: false,
        addSearchOperators: true
      });
      variations.push(conservativeEnhanced);
    }

    return variations.slice(0, count);
  }

  /**
   * Extract medical terms from a query string
   */
  private extractMedicalTerms(query: string): string[] {
    const terms: string[] = [];
    
    // Simple tokenization - can be enhanced with NLP
    const words = query.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Look for compound medical terms
    for (let i = 0; i < words.length; i++) {
      const singleTerm = words[i];
      if (this.isMedicalTerm(singleTerm)) {
        terms.push(singleTerm);
      }

      // Check two-word combinations
      if (i < words.length - 1) {
        const twoWordTerm = `${words[i]} ${words[i + 1]}`;
        if (this.isMedicalTerm(twoWordTerm)) {
          terms.push(twoWordTerm);
        }
      }

      // Check three-word combinations
      if (i < words.length - 2) {
        const threeWordTerm = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        if (this.isMedicalTerm(threeWordTerm)) {
          terms.push(threeWordTerm);
        }
      }
    }

    return [...new Set(terms)];
  }

  /**
   * Check if a term is a medical term
   */
  private isMedicalTerm(term: string): boolean {
    return this.medicalSynonyms.has(term.toLowerCase()) ||
           this.drugAliases.has(term.toLowerCase()) ||
           this.conditionAliases.has(term.toLowerCase()) ||
           this.isCommonMedicalTerm(term);
  }

  /**
   * Check if term matches common medical patterns
   */
  private isCommonMedicalTerm(term: string): boolean {
    const medicalPatterns = [
      /.*itis$/,     // inflammation conditions
      /.*oma$/,      // tumors
      /.*pathy$/,    // diseases
      /.*osis$/,     // conditions
      /.*emia$/,     // blood conditions
      /.*uria$/,     // urine conditions
      /.*therapy$/,  // treatments
      /.*mycin$/,    // antibiotics
      /.*cillin$/,   // penicillins
      /.*ide$/,      // compounds
      /.*ine$/,      // compounds
    ];

    return medicalPatterns.some(pattern => pattern.test(term.toLowerCase()));
  }

  /**
   * Expand terms with synonyms
   */
  private expandWithSynonyms(terms: string[], confidence: 'high' | 'medium' | 'low'): string[] {
    const synonyms: string[] = [];
    const confidenceThreshold = confidence === 'high' ? 0.8 : confidence === 'medium' ? 0.6 : 0.4;

    for (const term of terms) {
      const synonym = this.medicalSynonyms.get(term.toLowerCase());
      if (synonym && synonym.confidence >= confidenceThreshold) {
        synonyms.push(...synonym.synonyms);
      }

      // Check drug aliases
      const drugSynonyms = this.drugAliases.get(term.toLowerCase());
      if (drugSynonyms) {
        synonyms.push(...drugSynonyms);
      }

      // Check condition aliases
      const conditionSynonyms = this.conditionAliases.get(term.toLowerCase());
      if (conditionSynonyms) {
        synonyms.push(...conditionSynonyms);
      }
    }

    return [...new Set(synonyms)];
  }

  /**
   * Find related terms based on medical knowledge
   */
  private findRelatedTerms(terms: string[], maxTerms: number): string[] {
    const relatedTerms: string[] = [];

    for (const term of terms) {
      // Add related terms based on medical relationships
      const related = this.getRelatedMedicalTerms(term);
      relatedTerms.push(...related);
    }

    return [...new Set(relatedTerms)].slice(0, maxTerms);
  }

  /**
   * Get related medical terms based on domain knowledge
   */
  private getRelatedMedicalTerms(term: string): string[] {
    const related: string[] = [];
    const lowerTerm = term.toLowerCase();

    // Drug-related terms
    if (this.drugAliases.has(lowerTerm)) {
      related.push('adverse effects', 'side effects', 'dosage', 'administration');
    }

    // Condition-related terms
    if (this.conditionAliases.has(lowerTerm)) {
      related.push('symptoms', 'diagnosis', 'treatment', 'prognosis');
    }

    // Add mechanism of action terms for drugs
    if (lowerTerm.includes('inhibitor')) {
      related.push('mechanism of action', 'pharmacology');
    }

    return related;
  }

  /**
   * Combine original query with synonyms using OR operators
   */
  private combineWithSynonyms(query: string, synonyms: string[]): string {
    if (synonyms.length === 0) return query;

    const synonymGroups = this.groupSynonymsByOriginalTerm(query, synonyms);
    let enhancedQuery = query;

    for (const [originalTerm, termSynonyms] of synonymGroups.entries()) {
      if (termSynonyms.length > 0) {
        const synonymString = termSynonyms.join(' OR ');
        const replacement = `(${originalTerm} OR ${synonymString})`;
        enhancedQuery = enhancedQuery.replace(new RegExp(`\\b${originalTerm}\\b`, 'gi'), replacement);
      }
    }

    return enhancedQuery;
  }

  /**
   * Group synonyms by their original terms
   */
  private groupSynonymsByOriginalTerm(query: string, synonyms: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    const queryTerms = this.extractMedicalTerms(query);

    for (const term of queryTerms) {
      const termSynonyms = synonyms.filter(synonym => 
        this.isRelatedTerm(term, synonym)
      );
      if (termSynonyms.length > 0) {
        groups.set(term, termSynonyms);
      }
    }

    return groups;
  }

  /**
   * Check if two terms are related
   */
  private isRelatedTerm(term1: string, term2: string): boolean {
    const synonym1 = this.medicalSynonyms.get(term1.toLowerCase());
    return synonym1?.synonyms.includes(term2.toLowerCase()) || false;
  }

  /**
   * Add related terms to the query
   */
  private addRelatedTerms(query: string, relatedTerms: string[]): string {
    if (relatedTerms.length === 0) return query;

    const relatedString = relatedTerms.join(' OR ');
    return `${query} AND (${relatedString})`;
  }

  /**
   * Add database-specific search operators
   */
  private addSearchOperators(query: string, targetDatabase: string): string {
    switch (targetDatabase) {
      case 'pubmed':
        return this.addPubMedOperators(query);
      case 'clinicaltrials':
        return this.addClinicalTrialsOperators(query);
      case 'fda':
        return this.addFDAOperators(query);
      default:
        return query;
    }
  }

  /**
   * Add PubMed-specific search operators
   */
  private addPubMedOperators(query: string): string {
    // Add MeSH terms and field tags
    let enhanced = query;
    
    // Add publication type filters for clinical relevance
    if (!enhanced.includes('[pt]')) {
      enhanced += ' AND (clinical trial[pt] OR randomized controlled trial[pt] OR review[pt])';
    }

    return enhanced;
  }

  /**
   * Add ClinicalTrials.gov-specific operators
   */
  private addClinicalTrialsOperators(query: string): string {
    // ClinicalTrials.gov uses different search syntax
    return query; // Basic implementation
  }

  /**
   * Add FDA-specific operators
   */
  private addFDAOperators(query: string): string {
    // FDA databases have specific field structures
    return query; // Basic implementation
  }

  /**
   * Optimize query structure for better performance
   */
  private optimizeQueryStructure(query: string, targetDatabase: string): string {
    let optimized = query;

    // Remove excessive parentheses
    optimized = optimized.replace(/\(\s*\)/g, '');
    
    // Optimize OR chains
    optimized = optimized.replace(/\s+OR\s+/g, ' OR ');
    optimized = optimized.replace(/\s+AND\s+/g, ' AND ');
    
    // Remove redundant spaces
    optimized = optimized.replace(/\s+/g, ' ').trim();

    return optimized;
  }

  /**
   * Calculate relevance score for the enhanced query
   */
  private calculateRelevanceScore(
    originalQuery: string, 
    enhancedQuery: string, 
    expansionTerms: string[]
  ): number {
    let score = 0.5; // Base score

    // Factor in query length enhancement
    const lengthRatio = enhancedQuery.length / originalQuery.length;
    if (lengthRatio > 1 && lengthRatio < 3) {
      score += 0.2; // Reasonable enhancement
    } else if (lengthRatio >= 3) {
      score -= 0.1; // Too much enhancement might reduce precision
    }

    // Factor in number of expansion terms
    if (expansionTerms.length > 0 && expansionTerms.length <= 10) {
      score += Math.min(expansionTerms.length * 0.05, 0.3);
    }

    // Factor in medical term coverage
    const medicalTerms = this.extractMedicalTerms(originalQuery);
    if (medicalTerms.length > 0) {
      score += 0.1;
    }

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Determine the search strategy based on enhancements
   */
  private determineSearchStrategy(targetDatabase: string, enhancements: string[]): string {
    const strategies = [];

    if (enhancements.includes('synonym_expansion')) {
      strategies.push('synonym-enhanced');
    }
    if (enhancements.includes('related_terms')) {
      strategies.push('concept-expanded');
    }
    if (enhancements.includes('search_operators')) {
      strategies.push('operator-optimized');
    }

    return strategies.length > 0 ? strategies.join('-') : 'basic';
  }

  /**
   * Initialize medical terms and synonyms
   */
  private initializeMedicalTerms(): void {
    // Common drug synonyms
    this.drugAliases.set('aspirin', ['acetylsalicylic acid', 'asa']);
    this.drugAliases.set('acetaminophen', ['paracetamol', 'tylenol']);
    this.drugAliases.set('ibuprofen', ['advil', 'motrin']);
    this.drugAliases.set('metformin', ['glucophage']);
    this.drugAliases.set('atorvastatin', ['lipitor']);
    this.drugAliases.set('lisinopril', ['prinivil', 'zestril']);

    // Common condition synonyms
    this.conditionAliases.set('diabetes', ['diabetes mellitus', 'dm']);
    this.conditionAliases.set('hypertension', ['high blood pressure', 'htn']);
    this.conditionAliases.set('myocardial infarction', ['heart attack', 'mi']);
    this.conditionAliases.set('stroke', ['cerebrovascular accident', 'cva']);
    this.conditionAliases.set('pneumonia', ['lung infection']);

    // Medical synonyms with confidence scores
    this.medicalSynonyms.set('cancer', {
      term: 'cancer',
      synonyms: ['neoplasm', 'tumor', 'malignancy', 'carcinoma'],
      category: 'condition',
      confidence: 0.9
    });

    this.medicalSynonyms.set('infection', {
      term: 'infection',
      synonyms: ['sepsis', 'infectious disease', 'pathogen'],
      category: 'condition',
      confidence: 0.8
    });
  }

  /**
   * Initialize search operators
   */
  private initializeSearchOperators(): void {
    this.searchOperators.set('AND', 'AND');
    this.searchOperators.set('OR', 'OR');
    this.searchOperators.set('NOT', 'NOT');
    this.searchOperators.set('NEAR', 'NEAR');
  }
}

// Export singleton instance
export const queryEnhancer = new QueryEnhancer();