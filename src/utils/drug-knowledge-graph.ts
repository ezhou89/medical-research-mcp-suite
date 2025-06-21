// src/utils/drug-knowledge-graph.ts

export interface DrugEntity {
  genericName: string;
  brandNames: string[];
  synonyms: string[];
  mechanismOfAction: string;
  therapeuticAreas: string[];
  competitors: string[];
  drugClass?: 'monoclonal antibody' | 'small molecule' | 'gene therapy' | 'antisense oligonucleotide' | 'enzyme replacement' | 'fusion protein' | 'other';
  modalityType?: 'biologic' | 'small molecule' | 'gene therapy' | 'oligonucleotide' | 'other';
  companyInfo: {
    developer: string;
    marketer?: string;
  };
}

export interface IndicationEntity {
  name: string;
  synonyms: string[];
  meshTerms: string[];
  icd10Codes?: string[];
  therapeuticArea: string;
  relatedConditions: string[];
}

export interface CompetitiveMapping {
  drug: string;
  indication: string;
  directCompetitors: string[];
  mechanismCompetitors: string[];
  therapeuticAreaCompetitors: string[];
}

// Curated knowledge graph for pharmaceutical intelligence
export class DrugKnowledgeGraph {
  private drugs: Map<string, DrugEntity> = new Map();
  private indications: Map<string, IndicationEntity> = new Map();
  private competitiveMappings: Map<string, CompetitiveMapping[]> = new Map();

  constructor() {
    this.initializeKnowledgeGraph();
  }

  private initializeKnowledgeGraph() {
    // IMMUNOLOGY - TNF Inhibitors
    this.addDrug({
      genericName: 'adalimumab',
      brandNames: ['Humira'],
      synonyms: ['adalimumab-atto', 'adalimumab-adbm', 'adalimumab-adaz', 'D2E7'],
      mechanismOfAction: 'TNF-alpha inhibitor',
      therapeuticAreas: ['immunology', 'rheumatology', 'gastroenterology', 'dermatology'],
      competitors: ['infliximab', 'etanercept', 'golimumab', 'certolizumab pegol'],
      drugClass: 'monoclonal antibody',
      modalityType: 'biologic',
      companyInfo: {
        developer: 'AbbVie',
        marketer: 'AbbVie'
      }
    });

    this.addDrug({
      genericName: 'infliximab',
      brandNames: ['Remicade', 'Inflectra', 'Renflexis'],
      synonyms: ['infliximab-dyyb', 'infliximab-abda', 'cA2'],
      mechanismOfAction: 'TNF-alpha inhibitor',
      therapeuticAreas: ['immunology', 'rheumatology', 'gastroenterology'],
      competitors: ['adalimumab', 'etanercept', 'golimumab', 'certolizumab pegol'],
      companyInfo: {
        developer: 'Janssen',
        marketer: 'Johnson & Johnson'
      }
    });

    this.addDrug({
      genericName: 'etanercept',
      brandNames: ['Enbrel'],
      synonyms: ['etanercept-szzs', 'TNFR:Fc'],
      mechanismOfAction: 'TNF receptor fusion protein',
      therapeuticAreas: ['immunology', 'rheumatology'],
      competitors: ['adalimumab', 'infliximab', 'golimumab', 'certolizumab pegol'],
      companyInfo: {
        developer: 'Amgen',
        marketer: 'Amgen/Pfizer'
      }
    });

    // IMMUNOLOGY - IL-17 Inhibitors
    this.addDrug({
      genericName: 'secukinumab',
      brandNames: ['Cosentyx'],
      synonyms: ['AIN457'],
      mechanismOfAction: 'IL-17A inhibitor',
      therapeuticAreas: ['immunology', 'dermatology', 'rheumatology'],
      competitors: ['ixekizumab', 'brodalumab', 'adalimumab', 'ustekinumab'],
      companyInfo: {
        developer: 'Novartis',
        marketer: 'Novartis'
      }
    });

    this.addDrug({
      genericName: 'ixekizumab',
      brandNames: ['Taltz'],
      synonyms: ['LY2439821'],
      mechanismOfAction: 'IL-17A inhibitor',
      therapeuticAreas: ['immunology', 'dermatology', 'rheumatology'],
      competitors: ['secukinumab', 'brodalumab', 'adalimumab', 'ustekinumab'],
      companyInfo: {
        developer: 'Eli Lilly',
        marketer: 'Eli Lilly'
      }
    });

    // IMMUNOLOGY - JAK Inhibitors
    this.addDrug({
      genericName: 'tofacitinib',
      brandNames: ['Xeljanz'],
      synonyms: ['CP-690550'],
      mechanismOfAction: 'JAK1/JAK3 inhibitor',
      therapeuticAreas: ['immunology', 'rheumatology'],
      competitors: ['baricitinib', 'upadacitinib', 'filgotinib'],
      companyInfo: {
        developer: 'Pfizer',
        marketer: 'Pfizer'
      }
    });

    this.addDrug({
      genericName: 'baricitinib',
      brandNames: ['Olumiant'],
      synonyms: ['LY3009104'],
      mechanismOfAction: 'JAK1/JAK2 inhibitor',
      therapeuticAreas: ['immunology', 'rheumatology'],
      competitors: ['tofacitinib', 'upadacitinib', 'filgotinib'],
      companyInfo: {
        developer: 'Eli Lilly',
        marketer: 'Eli Lilly'
      }
    });

    // RARE DISEASES - Gene Therapies
    this.addDrug({
      genericName: 'onasemnogene abeparvovec',
      brandNames: ['Zolgensma'],
      synonyms: ['AVXS-101', 'onasemnogene abeparvovec-xioi'],
      mechanismOfAction: 'Gene therapy (AAV9-SMN1)',
      therapeuticAreas: ['rare diseases', 'neurology'],
      competitors: ['nusinersen', 'risdiplam'],
      companyInfo: {
        developer: 'Novartis Gene Therapies',
        marketer: 'Novartis'
      }
    });

    this.addDrug({
      genericName: 'eteplirsen',
      brandNames: ['Exondys 51'],
      synonyms: ['AVI-4658'],
      mechanismOfAction: 'Antisense oligonucleotide',
      therapeuticAreas: ['rare diseases', 'neurology'],
      competitors: ['golodirsen', 'casimersen', 'viltolarsen'],
      companyInfo: {
        developer: 'Sarepta Therapeutics',
        marketer: 'Sarepta Therapeutics'
      }
    });

    // RARE DISEASES - Enzyme Replacement Therapies
    this.addDrug({
      genericName: 'alglucosidase alfa',
      brandNames: ['Myozyme', 'Lumizyme'],
      synonyms: ['rhGAA'],
      mechanismOfAction: 'Enzyme replacement therapy',
      therapeuticAreas: ['rare diseases', 'metabolic disorders'],
      competitors: ['avalglucosidase alfa'],
      companyInfo: {
        developer: 'Genzyme',
        marketer: 'Sanofi'
      }
    });

    // CARDIOLOGY - SGLT2 Inhibitors
    this.addDrug({
      genericName: 'empagliflozin',
      brandNames: ['Jardiance'],
      synonyms: ['BI 10773'],
      mechanismOfAction: 'SGLT2 inhibitor',
      therapeuticAreas: ['cardiology', 'endocrinology'],
      competitors: ['canagliflozin', 'dapagliflozin', 'ertugliflozin'],
      companyInfo: {
        developer: 'Boehringer Ingelheim',
        marketer: 'Boehringer Ingelheim/Eli Lilly'
      }
    });

    this.addDrug({
      genericName: 'dapagliflozin',
      brandNames: ['Farxiga', 'Forxiga'],
      synonyms: ['BMS-512148'],
      mechanismOfAction: 'SGLT2 inhibitor',
      therapeuticAreas: ['cardiology', 'endocrinology'],
      competitors: ['empagliflozin', 'canagliflozin', 'ertugliflozin'],
      companyInfo: {
        developer: 'AstraZeneca',
        marketer: 'AstraZeneca'
      }
    });

    // CARDIOLOGY - PCSK9 Inhibitors
    this.addDrug({
      genericName: 'evolocumab',
      brandNames: ['Repatha'],
      synonyms: ['AMG 145'],
      mechanismOfAction: 'PCSK9 inhibitor',
      therapeuticAreas: ['cardiology'],
      competitors: ['alirocumab', 'inclisiran'],
      companyInfo: {
        developer: 'Amgen',
        marketer: 'Amgen'
      }
    });

    this.addDrug({
      genericName: 'alirocumab',
      brandNames: ['Praluent'],
      synonyms: ['REGN727', 'SAR236553'],
      mechanismOfAction: 'PCSK9 inhibitor',
      therapeuticAreas: ['cardiology'],
      competitors: ['evolocumab', 'inclisiran'],
      companyInfo: {
        developer: 'Regeneron/Sanofi',
        marketer: 'Regeneron/Sanofi'
      }
    });

    // ONCOLOGY - PD-1/PD-L1 Inhibitors
    this.addDrug({
      genericName: 'pembrolizumab',
      brandNames: ['Keytruda'],
      synonyms: ['MK-3475', 'lambrolizumab'],
      mechanismOfAction: 'PD-1 inhibitor',
      therapeuticAreas: ['oncology', 'immunooncology'],
      competitors: ['nivolumab', 'atezolizumab', 'durvalumab', 'cemiplimab'],
      companyInfo: {
        developer: 'Merck',
        marketer: 'Merck'
      }
    });

    this.addDrug({
      genericName: 'nivolumab',
      brandNames: ['Opdivo'],
      synonyms: ['BMS-936558', 'MDX-1106'],
      mechanismOfAction: 'PD-1 inhibitor',
      therapeuticAreas: ['oncology', 'immunooncology'],
      competitors: ['pembrolizumab', 'atezolizumab', 'durvalumab', 'cemiplimab'],
      companyInfo: {
        developer: 'Bristol Myers Squibb',
        marketer: 'Bristol Myers Squibb'
      }
    });

    this.addDrug({
      genericName: 'atezolizumab',
      brandNames: ['Tecentriq'],
      synonyms: ['MPDL3280A', 'RG7446'],
      mechanismOfAction: 'PD-L1 inhibitor',
      therapeuticAreas: ['oncology', 'immunooncology'],
      competitors: ['pembrolizumab', 'nivolumab', 'durvalumab', 'cemiplimab'],
      companyInfo: {
        developer: 'Genentech',
        marketer: 'Roche/Genentech'
      }
    });

    // ONCOLOGY - CDK4/6 Inhibitors
    this.addDrug({
      genericName: 'palbociclib',
      brandNames: ['Ibrance'],
      synonyms: ['PD-0332991'],
      mechanismOfAction: 'CDK4/6 inhibitor',
      therapeuticAreas: ['oncology', 'breast cancer'],
      competitors: ['ribociclib', 'abemaciclib'],
      companyInfo: {
        developer: 'Pfizer',
        marketer: 'Pfizer'
      }
    });

    this.addDrug({
      genericName: 'ribociclib',
      brandNames: ['Kisqali'],
      synonyms: ['LEE011'],
      mechanismOfAction: 'CDK4/6 inhibitor',
      therapeuticAreas: ['oncology', 'breast cancer'],
      competitors: ['palbociclib', 'abemaciclib'],
      companyInfo: {
        developer: 'Novartis',
        marketer: 'Novartis'
      }
    });

    // NEUROLOGY - CGRP Inhibitors
    this.addDrug({
      genericName: 'erenumab',
      brandNames: ['Aimovig'],
      synonyms: ['AMG 334'],
      mechanismOfAction: 'CGRP receptor antagonist',
      therapeuticAreas: ['neurology', 'migraine'],
      competitors: ['fremanezumab', 'galcanezumab', 'eptinezumab'],
      companyInfo: {
        developer: 'Amgen/Novartis',
        marketer: 'Amgen/Novartis'
      }
    });

    this.addDrug({
      genericName: 'fremanezumab',
      brandNames: ['Ajovy'],
      synonyms: ['TEV-48125'],
      mechanismOfAction: 'CGRP ligand inhibitor',
      therapeuticAreas: ['neurology', 'migraine'],
      competitors: ['erenumab', 'galcanezumab', 'eptinezumab'],
      companyInfo: {
        developer: 'Teva',
        marketer: 'Teva'
      }
    });

    // NEUROLOGY - Alzheimer's Disease
    this.addDrug({
      genericName: 'aducanumab',
      brandNames: ['Aduhelm'],
      synonyms: ['BIIB037'],
      mechanismOfAction: 'Anti-amyloid monoclonal antibody',
      therapeuticAreas: ['neurology', 'alzheimers'],
      competitors: ['lecanemab', 'donanemab', 'gantenerumab'],
      companyInfo: {
        developer: 'Biogen',
        marketer: 'Biogen'
      }
    });

    this.addDrug({
      genericName: 'lecanemab',
      brandNames: ['Leqembi'],
      synonyms: ['BAN2401'],
      mechanismOfAction: 'Anti-amyloid monoclonal antibody',
      therapeuticAreas: ['neurology', 'alzheimers'],
      competitors: ['aducanumab', 'donanemab', 'gantenerumab'],
      companyInfo: {
        developer: 'Eisai/Biogen',
        marketer: 'Eisai/Biogen'
      }
    });

    // Anti-VEGF drugs for retinal diseases
    this.addDrug({
      genericName: 'ranibizumab',
      brandNames: ['Lucentis'],
      synonyms: ['rhuFab V2', 'ranibizumab-nuna'],
      mechanismOfAction: 'VEGF-A inhibitor',
      therapeuticAreas: ['ophthalmology', 'retinal diseases'],
      competitors: ['aflibercept', 'bevacizumab', 'faricimab', 'brolucizumab'],
      companyInfo: {
        developer: 'Genentech',
        marketer: 'Roche/Novartis'
      }
    });

    this.addDrug({
      genericName: 'aflibercept',
      brandNames: ['Eylea', 'Zaltrap'],
      synonyms: ['VEGF Trap-Eye', 'aflibercept-mwak'],
      mechanismOfAction: 'VEGF-A/VEGF-B/PlGF inhibitor',
      therapeuticAreas: ['ophthalmology', 'retinal diseases', 'oncology'],
      competitors: ['ranibizumab', 'bevacizumab', 'faricimab', 'brolucizumab'],
      companyInfo: {
        developer: 'Regeneron',
        marketer: 'Regeneron/Bayer'
      }
    });

    this.addDrug({
      genericName: 'bevacizumab',
      brandNames: ['Avastin'],
      synonyms: ['rhuMAb VEGF', 'bevacizumab-awwb', 'bevacizumab-bvzr'],
      mechanismOfAction: 'VEGF-A inhibitor',
      therapeuticAreas: ['oncology', 'ophthalmology'],
      competitors: ['ranibizumab', 'aflibercept', 'faricimab'],
      companyInfo: {
        developer: 'Genentech',
        marketer: 'Roche/Genentech'
      }
    });

    this.addDrug({
      genericName: 'faricimab',
      brandNames: ['Vabysmo'],
      synonyms: ['RO6867461', 'faricimab-svoa'],
      mechanismOfAction: 'VEGF-A/Angiopoietin-2 dual inhibitor',
      therapeuticAreas: ['ophthalmology', 'retinal diseases'],
      competitors: ['ranibizumab', 'aflibercept', 'brolucizumab'],
      companyInfo: {
        developer: 'Genentech',
        marketer: 'Roche/Genentech'
      }
    });

    this.addDrug({
      genericName: 'brolucizumab',
      brandNames: ['Beovu'],
      synonyms: ['RTH258', 'brolucizumab-dbll'],
      mechanismOfAction: 'VEGF-A inhibitor',
      therapeuticAreas: ['ophthalmology', 'retinal diseases'],
      competitors: ['ranibizumab', 'aflibercept', 'faricimab'],
      companyInfo: {
        developer: 'Novartis',
        marketer: 'Novartis'
      }
    });

    // IMMUNOLOGY Indications
    this.addIndication({
      name: 'rheumatoid arthritis',
      synonyms: ['RA', 'rheumatoid disease', 'inflammatory arthritis'],
      meshTerms: ['Arthritis, Rheumatoid'],
      therapeuticArea: 'immunology',
      relatedConditions: ['psoriatic arthritis', 'ankylosing spondylitis', 'juvenile idiopathic arthritis']
    });

    this.addIndication({
      name: 'psoriasis',
      synonyms: ['plaque psoriasis', 'psoriatic disease'],
      meshTerms: ['Psoriasis'],
      therapeuticArea: 'immunology',
      relatedConditions: ['psoriatic arthritis', 'atopic dermatitis', 'hidradenitis suppurativa']
    });

    this.addIndication({
      name: 'inflammatory bowel disease',
      synonyms: ['IBD', 'Crohns disease', 'ulcerative colitis', 'UC', 'CD'],
      meshTerms: ['Inflammatory Bowel Diseases', 'Crohn Disease', 'Colitis, Ulcerative'],
      therapeuticArea: 'immunology',
      relatedConditions: ['irritable bowel syndrome', 'celiac disease']
    });

    this.addIndication({
      name: 'ankylosing spondylitis',
      synonyms: ['AS', 'axial spondyloarthritis', 'axSpA'],
      meshTerms: ['Spondylitis, Ankylosing'],
      therapeuticArea: 'immunology',
      relatedConditions: ['psoriatic arthritis', 'rheumatoid arthritis']
    });

    // RARE DISEASES Indications
    this.addIndication({
      name: 'spinal muscular atrophy',
      synonyms: ['SMA', 'Werdnig-Hoffmann disease', 'Kugelberg-Welander disease'],
      meshTerms: ['Muscular Atrophy, Spinal'],
      therapeuticArea: 'rare diseases',
      relatedConditions: ['duchenne muscular dystrophy', 'amyotrophic lateral sclerosis']
    });

    this.addIndication({
      name: 'duchenne muscular dystrophy',
      synonyms: ['DMD', 'Duchenne dystrophy'],
      meshTerms: ['Muscular Dystrophy, Duchenne'],
      therapeuticArea: 'rare diseases',
      relatedConditions: ['spinal muscular atrophy', 'becker muscular dystrophy']
    });

    this.addIndication({
      name: 'pompe disease',
      synonyms: ['glycogen storage disease type II', 'GSD II', 'acid maltase deficiency'],
      meshTerms: ['Glycogen Storage Disease Type II'],
      therapeuticArea: 'rare diseases',
      relatedConditions: ['other glycogen storage diseases', 'lysosomal storage disorders']
    });

    // CARDIOLOGY Indications
    this.addIndication({
      name: 'heart failure',
      synonyms: ['HF', 'congestive heart failure', 'CHF', 'cardiac failure'],
      meshTerms: ['Heart Failure'],
      therapeuticArea: 'cardiology',
      relatedConditions: ['myocardial infarction', 'cardiomyopathy', 'atrial fibrillation']
    });

    this.addIndication({
      name: 'type 2 diabetes',
      synonyms: ['T2DM', 'diabetes mellitus type 2', 'adult-onset diabetes'],
      meshTerms: ['Diabetes Mellitus, Type 2'],
      therapeuticArea: 'cardiology',
      relatedConditions: ['heart failure', 'chronic kidney disease', 'obesity']
    });

    this.addIndication({
      name: 'hypercholesterolemia',
      synonyms: ['high cholesterol', 'familial hypercholesterolemia', 'FH', 'dyslipidemia'],
      meshTerms: ['Hypercholesterolemia', 'Hyperlipoproteinemia Type II'],
      therapeuticArea: 'cardiology',
      relatedConditions: ['coronary artery disease', 'atherosclerosis', 'myocardial infarction']
    });

    // ONCOLOGY Indications
    this.addIndication({
      name: 'non-small cell lung cancer',
      synonyms: ['NSCLC', 'lung adenocarcinoma', 'lung squamous cell carcinoma'],
      meshTerms: ['Carcinoma, Non-Small-Cell Lung'],
      therapeuticArea: 'oncology',
      relatedConditions: ['small cell lung cancer', 'mesothelioma', 'lung cancer']
    });

    this.addIndication({
      name: 'melanoma',
      synonyms: ['malignant melanoma', 'cutaneous melanoma', 'metastatic melanoma'],
      meshTerms: ['Melanoma'],
      therapeuticArea: 'oncology',
      relatedConditions: ['basal cell carcinoma', 'squamous cell carcinoma', 'merkel cell carcinoma']
    });

    this.addIndication({
      name: 'breast cancer',
      synonyms: ['mammary carcinoma', 'ductal carcinoma', 'lobular carcinoma', 'HER2-positive breast cancer', 'triple-negative breast cancer'],
      meshTerms: ['Breast Neoplasms'],
      therapeuticArea: 'oncology',
      relatedConditions: ['ovarian cancer', 'endometrial cancer', 'cervical cancer']
    });

    // NEUROLOGY Indications
    this.addIndication({
      name: 'migraine',
      synonyms: ['chronic migraine', 'episodic migraine', 'migraine headache'],
      meshTerms: ['Migraine Disorders'],
      therapeuticArea: 'neurology',
      relatedConditions: ['tension headache', 'cluster headache', 'chronic daily headache']
    });

    this.addIndication({
      name: 'alzheimers disease',
      synonyms: ['AD', 'Alzheimer disease', 'dementia of Alzheimer type', 'DAT'],
      meshTerms: ['Alzheimer Disease'],
      therapeuticArea: 'neurology',
      relatedConditions: ['mild cognitive impairment', 'vascular dementia', 'frontotemporal dementia']
    });

    // Indications
    this.addIndication({
      name: 'age-related macular degeneration',
      synonyms: ['AMD', 'wet AMD', 'neovascular AMD', 'exudative AMD', 'choroidal neovascularization'],
      meshTerms: ['Macular Degeneration', 'Wet Macular Degeneration', 'Choroidal Neovascularization'],
      therapeuticArea: 'ophthalmology',
      relatedConditions: ['diabetic macular edema', 'retinal vein occlusion', 'myopic choroidal neovascularization']
    });

    this.addIndication({
      name: 'diabetic macular edema',
      synonyms: ['DME', 'diabetic macular oedema', 'diabetic retinopathy with macular edema'],
      meshTerms: ['Diabetic Retinopathy', 'Macular Edema'],
      therapeuticArea: 'ophthalmology',
      relatedConditions: ['age-related macular degeneration', 'retinal vein occlusion']
    });

    this.addIndication({
      name: 'retinal vein occlusion',
      synonyms: ['RVO', 'branch retinal vein occlusion', 'BRVO', 'central retinal vein occlusion', 'CRVO'],
      meshTerms: ['Retinal Vein Occlusion'],
      therapeuticArea: 'ophthalmology',
      relatedConditions: ['diabetic macular edema', 'age-related macular degeneration']
    });

    // IMMUNOLOGY Competitive mappings
    this.addCompetitiveMapping({
      drug: 'adalimumab',
      indication: 'rheumatoid arthritis',
      directCompetitors: ['etanercept', 'infliximab'],
      mechanismCompetitors: ['golimumab', 'certolizumab pegol'],
      therapeuticAreaCompetitors: ['tofacitinib', 'baricitinib', 'rituximab']
    });

    this.addCompetitiveMapping({
      drug: 'secukinumab',
      indication: 'psoriasis',
      directCompetitors: ['ixekizumab', 'brodalumab'],
      mechanismCompetitors: ['guselkumab', 'risankizumab'],
      therapeuticAreaCompetitors: ['adalimumab', 'ustekinumab']
    });

    this.addCompetitiveMapping({
      drug: 'tofacitinib',
      indication: 'rheumatoid arthritis',
      directCompetitors: ['baricitinib', 'upadacitinib'],
      mechanismCompetitors: ['filgotinib'],
      therapeuticAreaCompetitors: ['adalimumab', 'etanercept', 'rituximab']
    });

    // ONCOLOGY Competitive mappings
    this.addCompetitiveMapping({
      drug: 'pembrolizumab',
      indication: 'non-small cell lung cancer',
      directCompetitors: ['nivolumab'],
      mechanismCompetitors: ['atezolizumab', 'durvalumab'],
      therapeuticAreaCompetitors: ['chemotherapy', 'targeted therapy']
    });

    this.addCompetitiveMapping({
      drug: 'palbociclib',
      indication: 'breast cancer',
      directCompetitors: ['ribociclib', 'abemaciclib'],
      mechanismCompetitors: ['trilaciclib'],
      therapeuticAreaCompetitors: ['trastuzumab', 'pertuzumab', 'chemotherapy']
    });

    // CARDIOLOGY Competitive mappings
    this.addCompetitiveMapping({
      drug: 'empagliflozin',
      indication: 'heart failure',
      directCompetitors: ['dapagliflozin'],
      mechanismCompetitors: ['canagliflozin', 'ertugliflozin'],
      therapeuticAreaCompetitors: ['ACE inhibitors', 'ARBs', 'beta blockers']
    });

    this.addCompetitiveMapping({
      drug: 'evolocumab',
      indication: 'hypercholesterolemia',
      directCompetitors: ['alirocumab'],
      mechanismCompetitors: ['inclisiran'],
      therapeuticAreaCompetitors: ['statins', 'ezetimibe', 'bempedoic acid']
    });

    // NEUROLOGY Competitive mappings
    this.addCompetitiveMapping({
      drug: 'erenumab',
      indication: 'migraine',
      directCompetitors: ['fremanezumab', 'galcanezumab'],
      mechanismCompetitors: ['eptinezumab', 'rimegepant'],
      therapeuticAreaCompetitors: ['topiramate', 'propranolol', 'botulinum toxin']
    });

    this.addCompetitiveMapping({
      drug: 'lecanemab',
      indication: 'alzheimers disease',
      directCompetitors: ['aducanumab', 'donanemab'],
      mechanismCompetitors: ['gantenerumab', 'solanezumab'],
      therapeuticAreaCompetitors: ['donepezil', 'memantine', 'aricept']
    });

    // RARE DISEASES Competitive mappings
    this.addCompetitiveMapping({
      drug: 'onasemnogene abeparvovec',
      indication: 'spinal muscular atrophy',
      directCompetitors: ['nusinersen'],
      mechanismCompetitors: ['risdiplam'],
      therapeuticAreaCompetitors: ['supportive care', 'physical therapy']
    });

    // Competitive mappings
    this.addCompetitiveMapping({
      drug: 'ranibizumab',
      indication: 'age-related macular degeneration',
      directCompetitors: ['aflibercept', 'brolucizumab'],
      mechanismCompetitors: ['bevacizumab'],
      therapeuticAreaCompetitors: ['faricimab']
    });
  }

  private addDrug(drug: DrugEntity) {
    // Add primary entry
    this.drugs.set(drug.genericName.toLowerCase(), drug);
    
    // Add brand name entries
    drug.brandNames.forEach(brand => {
      this.drugs.set(brand.toLowerCase(), drug);
    });
    
    // Add synonym entries
    drug.synonyms.forEach(synonym => {
      this.drugs.set(synonym.toLowerCase(), drug);
    });
  }

  private addIndication(indication: IndicationEntity) {
    // Add primary entry
    this.indications.set(indication.name.toLowerCase(), indication);
    
    // Add synonym entries
    indication.synonyms.forEach(synonym => {
      this.indications.set(synonym.toLowerCase(), indication);
    });
  }

  private addCompetitiveMapping(mapping: CompetitiveMapping) {
    const key = `${mapping.drug}:${mapping.indication}`;
    const existing = this.competitiveMappings.get(key) || [];
    existing.push(mapping);
    this.competitiveMappings.set(key, existing);
  }

  // Public query methods
  public getDrugInfo(drugName: string): DrugEntity | null {
    return this.drugs.get(drugName.toLowerCase()) || null;
  }

  public getIndicationInfo(indication: string): IndicationEntity | null {
    return this.indications.get(indication.toLowerCase()) || null;
  }

  public expandDrugQuery(drugName: string): string[] {
    const drug = this.getDrugInfo(drugName);
    if (!drug) return [drugName];
    
    return [
      drug.genericName,
      ...drug.brandNames,
      ...drug.synonyms
    ].filter((name, index, array) => array.indexOf(name) === index); // dedupe
  }

  public expandIndicationQuery(indication: string): string[] {
    const indicationInfo = this.getIndicationInfo(indication);
    if (!indicationInfo) return [indication];
    
    return [
      indicationInfo.name,
      ...indicationInfo.synonyms,
      ...indicationInfo.meshTerms
    ].filter((name, index, array) => array.indexOf(name) === index); // dedupe
  }

  public getCompetitors(drugName: string, indication?: string): string[] {
    const drug = this.getDrugInfo(drugName);
    if (!drug) return [];
    
    if (indication) {
      const key = `${drug.genericName}:${indication.toLowerCase()}`;
      const mappings = this.competitiveMappings.get(key) || [];
      const allCompetitors = mappings.flatMap(m => [
        ...m.directCompetitors,
        ...m.mechanismCompetitors,
        ...m.therapeuticAreaCompetitors
      ]);
      return [...new Set(allCompetitors)]; // dedupe
    }
    
    return drug.competitors;
  }

  public getTherapeuticArea(drugName: string): string[] {
    const drug = this.getDrugInfo(drugName);
    return drug?.therapeuticAreas || [];
  }

  public suggestRelatedSearches(drugName: string, indication?: string): string[] {
    const drug = this.getDrugInfo(drugName);
    if (!drug) return [];
    
    const suggestions: string[] = [];
    
    // Add competitor searches
    const competitors = this.getCompetitors(drugName, indication);
    competitors.forEach(competitor => {
      if (indication) {
        suggestions.push(`${competitor} ${indication}`);
      } else {
        suggestions.push(competitor);
      }
    });
    
    // Add mechanism-based searches
    suggestions.push(drug.mechanismOfAction);
    
    // Add therapeutic area searches
    drug.therapeuticAreas.forEach(area => {
      suggestions.push(`${area} trials`);
    });
    
    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }

  // Drug classification methods
  public getDrugsByClass(drugClass: NonNullable<DrugEntity['drugClass']>): DrugEntity[] {
    return Array.from(this.drugs.values())
      .filter(drug => drug.drugClass === drugClass)
      .filter((drug, index, array) => 
        array.findIndex(d => d.genericName === drug.genericName) === index
      ); // dedupe
  }

  public getDrugsByModality(modalityType: NonNullable<DrugEntity['modalityType']>): DrugEntity[] {
    return Array.from(this.drugs.values())
      .filter(drug => drug.modalityType === modalityType)
      .filter((drug, index, array) => 
        array.findIndex(d => d.genericName === drug.genericName) === index
      ); // dedupe
  }

  public getBiosimilars(referenceProduct: string): string[] {
    const drug = this.getDrugInfo(referenceProduct);
    if (!drug || drug.modalityType !== 'biologic') return [];
    
    // Look for biosimilar suffixes in synonyms
    const biosimilars: string[] = [];
    this.drugs.forEach((drugEntity, key) => {
      if (drugEntity.genericName.includes(drug.genericName) && 
          drugEntity.genericName !== drug.genericName) {
        biosimilars.push(drugEntity.genericName);
      }
    });
    
    return biosimilars;
  }

  // Dynamic update methods
  async addDrugDynamically(drug: DrugEntity, source: string, confidence: number): Promise<boolean> {
    // Validate drug data quality
    if (!this.validateDrugData(drug)) {
      console.warn(`Invalid drug data for ${drug.genericName}`);
      return false;
    }

    // Check for duplicates
    if (this.getDrugInfo(drug.genericName)) {
      console.log(`Drug ${drug.genericName} already exists, updating...`);
      return await this.updateDrugDynamically(drug, source, confidence);
    }

    // Add drug with metadata
    this.addDrug(drug);
    this.recordUpdate(drug.genericName, 'added', source, confidence);
    
    console.log(`Added new drug: ${drug.genericName} from ${source}`);
    return true;
  }

  async updateDrugDynamically(drug: Partial<DrugEntity> & { genericName: string }, source: string, confidence: number): Promise<boolean> {
    const existing = this.getDrugInfo(drug.genericName);
    if (!existing) return false;

    // Merge updates with existing data
    const updated = this.mergeDrugData(existing, drug, confidence);
    
    // Replace in maps
    this.drugs.set(drug.genericName.toLowerCase(), updated);
    
    // Update all synonym entries
    updated.brandNames.forEach(brand => {
      this.drugs.set(brand.toLowerCase(), updated);
    });
    updated.synonyms.forEach(synonym => {
      this.drugs.set(synonym.toLowerCase(), updated);
    });

    this.recordUpdate(drug.genericName, 'updated', source, confidence);
    return true;
  }

  async addCompetitiveMappingDynamically(mapping: CompetitiveMapping, source: string, confidence: number): Promise<void> {
    // Validate mapping
    if (confidence < 0.6) {
      console.warn(`Low confidence competitive mapping rejected: ${mapping.drug} -> ${mapping.indication}`);
      return;
    }

    this.addCompetitiveMapping(mapping);
    this.recordUpdate(`${mapping.drug}:${mapping.indication}`, 'competitive_mapping_added', source, confidence);
    
    console.log(`Added competitive mapping: ${mapping.drug} for ${mapping.indication}`);
  }

  async updateFromExternalSource(sourceName: string, updates: any[]): Promise<void> {
    console.log(`Processing ${updates.length} updates from ${sourceName}`);
    
    for (const update of updates) {
      try {
        await this.processExternalUpdate(update, sourceName);
      } catch (error) {
        console.error(`Error processing update from ${sourceName}:`, error);
      }
    }
  }

  private async processExternalUpdate(update: any, source: string): Promise<void> {
    switch (update.type) {
      case 'new_drug':
        await this.addDrugDynamically(update.data, source, update.confidence);
        break;
      case 'drug_update':
        await this.updateDrugDynamically(update.data, source, update.confidence);
        break;
      case 'competitive_mapping':
        await this.addCompetitiveMappingDynamically(update.data, source, update.confidence);
        break;
      case 'indication_update':
        await this.updateIndicationDynamically(update.data, source, update.confidence);
        break;
    }
  }

  private validateDrugData(drug: DrugEntity): boolean {
    // Basic validation
    if (!drug.genericName || drug.genericName.length < 2) return false;
    if (!drug.mechanismOfAction || drug.mechanismOfAction.length < 5) return false;
    if (!drug.therapeuticAreas || drug.therapeuticAreas.length === 0) return false;
    if (!drug.companyInfo?.developer) return false;
    
    return true;
  }

  private mergeDrugData(existing: DrugEntity, update: Partial<DrugEntity>, confidence: number): DrugEntity {
    const merged = { ...existing };
    
    // Only update fields with high confidence
    if (confidence > 0.8) {
      if (update.brandNames) merged.brandNames = [...new Set([...merged.brandNames, ...update.brandNames])];
      if (update.synonyms) merged.synonyms = [...new Set([...merged.synonyms, ...update.synonyms])];
      if (update.competitors) merged.competitors = [...new Set([...merged.competitors, ...update.competitors])];
      if (update.therapeuticAreas) merged.therapeuticAreas = [...new Set([...merged.therapeuticAreas, ...update.therapeuticAreas])];
    }
    
    // Always update if new mechanism is more specific
    if (update.mechanismOfAction && update.mechanismOfAction.length > merged.mechanismOfAction.length) {
      merged.mechanismOfAction = update.mechanismOfAction;
    }
    
    // Update company info if more complete
    if (update.companyInfo) {
      merged.companyInfo = { ...merged.companyInfo, ...update.companyInfo };
    }

    return merged;
  }

  private async updateIndicationDynamically(indication: IndicationEntity, source: string, confidence: number): Promise<void> {
    const existing = this.getIndicationInfo(indication.name);
    
    if (existing) {
      // Merge with existing
      const merged = {
        ...existing,
        synonyms: [...new Set([...existing.synonyms, ...indication.synonyms])],
        meshTerms: [...new Set([...existing.meshTerms, ...indication.meshTerms])],
        relatedConditions: [...new Set([...existing.relatedConditions, ...indication.relatedConditions])]
      };
      
      this.indications.set(indication.name.toLowerCase(), merged);
    } else {
      this.addIndication(indication);
    }
    
    this.recordUpdate(indication.name, 'indication_updated', source, confidence);
  }

  private recordUpdate(entity: string, action: string, source: string, confidence: number): void {
    // In a real implementation, log to audit trail/database
    console.log(`Knowledge Graph Update: ${action} ${entity} from ${source} (confidence: ${confidence})`);
  }

  // Real-time monitoring hooks
  onDrugAdded(callback: (drug: DrugEntity) => void): void {
    // Register callback for new drug additions
    this.eventCallbacks.set('drug_added', callback);
  }

  onCompetitorAdded(callback: (drug: string, competitor: string) => void): void {
    // Register callback for new competitor relationships
    this.eventCallbacks.set('competitor_added', callback);
  }

  private eventCallbacks: Map<string, Function> = new Map();

  private triggerEvent(event: string, ...args: any[]): void {
    const callback = this.eventCallbacks.get(event);
    if (callback) {
      callback(...args);
    }
  }

  // Analytics and insights
  getKnowledgeGraphStats(): {
    totalDrugs: number;
    totalIndications: number;
    totalCompetitiveMappings: number;
    coverageByTherapeuticArea: Record<string, number>;
    drugsByModality: Record<string, number>;
    lastUpdateSources: string[];
  } {
    const uniqueDrugs = new Set(Array.from(this.drugs.values()).map(d => d.genericName));
    const uniqueIndications = new Set(Array.from(this.indications.values()).map(i => i.name));
    
    const therapeuticAreaCoverage: Record<string, number> = {};
    const modalityCoverage: Record<string, number> = {};
    
    Array.from(this.drugs.values()).forEach(drug => {
      // Count unique drugs only
      if (drug.genericName === Array.from(this.drugs.entries()).find(([key, val]) => val === drug)?.[0]) {
        drug.therapeuticAreas.forEach(area => {
          therapeuticAreaCoverage[area] = (therapeuticAreaCoverage[area] || 0) + 1;
        });
        
        if (drug.modalityType) {
          modalityCoverage[drug.modalityType] = (modalityCoverage[drug.modalityType] || 0) + 1;
        }
      }
    });

    return {
      totalDrugs: uniqueDrugs.size,
      totalIndications: uniqueIndications.size,
      totalCompetitiveMappings: this.competitiveMappings.size,
      coverageByTherapeuticArea: therapeuticAreaCoverage,
      drugsByModality: modalityCoverage,
      lastUpdateSources: [] // Would track recent update sources
    };
  }
}

// Singleton instance
export const drugKnowledgeGraph = new DrugKnowledgeGraph();