// src/apis/index.ts - Central API registry

import { ClinicalTrialsClient } from './clinicalTrials';
import { PubMedClient } from './pubmed';
import { FDAClient } from './fda';

export { ClinicalTrialsClient, StudySearchParams, Study, SearchResponse } from './clinicalTrials';
export { PubMedClient, PubMedSearchParams, PubMedPaper, PubMedSearchResponse } from './pubmed';
export { FDAClient, FDADrugSearchParams, FDAAdverseEventParams, FDADrug, FDAAdverseEvent } from './fda';

export interface APIClient {
  name: string;
  version: string;
  clearCache(): void;
}

export const API_REGISTRY = {
  'clinical-trials': ClinicalTrialsClient,
  'pubmed': PubMedClient,
  'fda': FDAClient,
} as const;

export type APIClientType = keyof typeof API_REGISTRY;
