// src/apis/pubmed.ts

import axios, { AxiosInstance } from 'axios';
import { parseStringPromise } from 'xml2js';

export interface PubMedSearchParams {
  query: string;
  maxResults?: number;
  publicationTypes?: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
  sort?: 'relevance' | 'date' | 'author' | 'journal';
}

export interface PubMedPaper {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  publicationDate: string;
  abstract?: string;
  doi?: string;
  publicationType: string[];
  keywords?: string[];
}

export interface PubMedSearchResponse {
  papers: PubMedPaper[];
  totalCount: number;
  query: string;
}

export class PubMedClient {
  private axios: AxiosInstance;
  private readonly baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 3600000; // 1 hour
  private readonly apiKey?: string;

  constructor() {
    this.apiKey = process.env.PUBMED_API_KEY;
    
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': 'Medical-Research-MCP-Suite/1.0.0',
        'Accept': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('PubMed API Error:', error.response?.data || error.message);
        throw new Error(`PubMed API Error: ${error.response?.status || 'Unknown'}`);
      }
    );
  }

  private getCacheKey(params: any): string {
    return `pubmed_${JSON.stringify(params)}`;
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  private buildSearchParams(params: PubMedSearchParams): URLSearchParams {
    const searchParams = new URLSearchParams();
    
    // Build the search term
    let searchTerm = params.query;
    
    // Add publication type filters
    if (params.publicationTypes && params.publicationTypes.length > 0) {
      const pubTypeFilter = params.publicationTypes
        .map(type => `"${type}"[Publication Type]`)
        .join(' OR ');
      searchTerm += ` AND (${pubTypeFilter})`;
    }
    
    // Add date range
    if (params.dateRange) {
      if (params.dateRange.from && params.dateRange.to) {
        searchTerm += ` AND "${params.dateRange.from}"[Date - Publication] : "${params.dateRange.to}"[Date - Publication]`;
      } else if (params.dateRange.from) {
        searchTerm += ` AND "${params.dateRange.from}"[Date - Publication] : "3000"[Date - Publication]`;
      } else if (params.dateRange.to) {
        searchTerm += ` AND "1800"[Date - Publication] : "${params.dateRange.to}"[Date - Publication]`;
      }
    }
    
    searchParams.append('term', searchTerm);
    searchParams.append('db', 'pubmed');
    searchParams.append('retmode', 'json');
    searchParams.append('retmax', (params.maxResults || 20).toString());
    
    // Add API key if available
    if (this.apiKey) {
      searchParams.append('api_key', this.apiKey);
    }
    
    // Add sort parameter
    if (params.sort) {
      const sortMap = {
        relevance: 'relevance',
        date: 'pub_date',
        author: 'first_author',
        journal: 'journal'
      };
      searchParams.append('sort', sortMap[params.sort] || 'relevance');
    }
    
    return searchParams;
  }

  async searchPapers(params: PubMedSearchParams): Promise<PubMedSearchResponse> {
    const cacheKey = this.getCacheKey(params);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCache(cached.timestamp)) {
      return cached.data;
    }

    try {
      // Step 1: Search for PMIDs
      const searchParams = this.buildSearchParams(params);
      const searchResponse = await this.axios.get('/esearch.fcgi', {
        params: searchParams,
      });

      const pmids = searchResponse.data.esearchresult?.idlist || [];
      const totalCount = parseInt(searchResponse.data.esearchresult?.count || '0');

      if (pmids.length === 0) {
        return {
          papers: [],
          totalCount: 0,
          query: params.query,
        };
      }

      // Step 2: Fetch detailed information for each PMID
      const papers = await this.fetchPaperDetails(pmids);

      const result = {
        papers,
        totalCount,
        query: params.query,
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to search PubMed: ${error}`);
    }
  }

  private async fetchPaperDetails(pmids: string[]): Promise<PubMedPaper[]> {
    if (pmids.length === 0) return [];

    const fetchParams = new URLSearchParams();
    fetchParams.append('db', 'pubmed');
    fetchParams.append('id', pmids.join(','));
    fetchParams.append('rettype', 'abstract');
    // Note: efetch returns XML by default, JSON mode not supported for detailed data
    
    if (this.apiKey) {
      fetchParams.append('api_key', this.apiKey);
    }

    try {
      const response = await this.axios.get('/efetch.fcgi', {
        params: fetchParams,
      });

      // Parse XML response
      const xmlData = response.data;
      if (typeof xmlData !== 'string') {
        console.error('Expected XML string, got:', typeof xmlData);
        return [];
      }

      // Convert XML to JSON
      const jsonData = await parseStringPromise(xmlData, {
        explicitArray: false,
        mergeAttrs: true,
        explicitRoot: false
      });

      // Handle different XML structures
      let articles = [];
      console.log('DEBUG: JSON data keys:', Object.keys(jsonData));
      
      if (jsonData.PubmedArticleSet?.PubmedArticle) {
        // Standard structure with PubmedArticleSet wrapper
        articles = Array.isArray(jsonData.PubmedArticleSet.PubmedArticle) 
          ? jsonData.PubmedArticleSet.PubmedArticle 
          : [jsonData.PubmedArticleSet.PubmedArticle];
        console.log('DEBUG: Found PubmedArticleSet structure, articles:', articles.length);
      } else if (jsonData.PubmedArticle) {
        // Direct PubmedArticle array or single article
        articles = Array.isArray(jsonData.PubmedArticle) 
          ? jsonData.PubmedArticle 
          : [jsonData.PubmedArticle];
        console.log('DEBUG: Found direct PubmedArticle structure, articles:', articles.length);
      } else {
        console.log('DEBUG: Unexpected XML structure:', Object.keys(jsonData));
      }
      
      const transformedArticles = articles.map((article: any) => {
        try {
          const result = this.transformArticle(article);
          console.log('DEBUG: Successfully transformed article with PMID:', result.pmid);
          return result;
        } catch (error) {
          console.error('DEBUG: Error transforming article:', error);
          return null;
        }
      }).filter((article: any) => article !== null);
      
      console.log('DEBUG: Transformed articles count:', transformedArticles.length);
      return transformedArticles;
    } catch (error) {
      console.error('Error fetching paper details:', error);
      return [];
    }
  }

  private transformArticle(article: any): PubMedPaper {
    console.log('DEBUG: Transforming article:', !!article);
    console.log('DEBUG: Article keys:', Object.keys(article || {}));
    
    const medlineCitation = article.MedlineCitation;
    const pubmedData = article.PubmedData;
    
    console.log('DEBUG: Has MedlineCitation:', !!medlineCitation);
    console.log('DEBUG: Has PubmedData:', !!pubmedData);
    
    // Handle PMID which might be an object with attributes or a simple value
    const pmid = medlineCitation?.PMID?._ || medlineCitation?.PMID || 'Unknown';
    console.log('DEBUG: Extracted PMID:', pmid);
    
    // Extract title
    const title = medlineCitation.Article?.ArticleTitle || 'No title available';
    
    // Extract authors
    const authorList = medlineCitation.Article?.AuthorList?.Author || [];
    const authors = Array.isArray(authorList) ? authorList.map((author: any) => {
      if (author.LastName && author.ForeName) {
        return `${author.LastName}, ${author.ForeName}`;
      } else if (author.CollectiveName) {
        return author.CollectiveName;
      }
      return 'Unknown Author';
    }) : [];
    
    // Extract journal
    const journal = medlineCitation.Article?.Journal?.Title || 'Unknown Journal';
    
    // Extract publication date
    const pubDate = medlineCitation.Article?.Journal?.JournalIssue?.PubDate;
    let publicationDate = 'Unknown Date';
    if (pubDate) {
      const year = pubDate.Year || '';
      const month = pubDate.Month || '';
      const day = pubDate.Day || '';
      publicationDate = [year, month, day].filter(Boolean).join('-');
    }
    
    // Extract abstract
    const abstractTexts = medlineCitation?.Article?.Abstract?.AbstractText;
    let abstract = '';
    
    if (abstractTexts) {
      if (Array.isArray(abstractTexts)) {
        abstract = abstractTexts.map((text: any) => {
          if (typeof text === 'string') return text;
          if (text?._ && text?.Label) return `${text.Label}: ${text._}`;
          return text?._ || text || '';
        }).join(' ');
      } else if (typeof abstractTexts === 'string') {
        abstract = abstractTexts;
      } else if (abstractTexts._) {
        abstract = abstractTexts._;
      } else {
        abstract = abstractTexts.toString();
      }
    }
    
    // Extract DOI
    const articleIds = pubmedData?.ArticleIdList?.ArticleId || [];
    let doi = '';
    for (const id of articleIds) {
      if (id.IdType === 'doi') {
        doi = id._;
        break;
      }
    }
    
    // Extract publication types
    const publicationTypeList = medlineCitation.Article?.PublicationTypeList?.PublicationType || [];
    const publicationTypes = Array.isArray(publicationTypeList) 
      ? publicationTypeList 
      : [publicationTypeList];
    const publicationType = publicationTypes.map((type: any) => type._ || type);
    
    // Extract keywords
    const keywordList = medlineCitation.KeywordList?.[0]?.Keyword || [];
    const keywords = keywordList.map((keyword: any) => keyword._ || keyword);

    return {
      pmid,
      title,
      authors,
      journal,
      publicationDate,
      abstract,
      doi,
      publicationType,
      keywords,
    };
  }

  async getPaperByPMID(pmid: string): Promise<PubMedPaper | null> {
    const cacheKey = `paper_${pmid}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCache(cached.timestamp)) {
      return cached.data;
    }

    try {
      const papers = await this.fetchPaperDetails([pmid]);
      const paper = papers[0] || null;
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: paper,
        timestamp: Date.now(),
      });

      return paper;
    } catch (error) {
      throw new Error(`Failed to get paper ${pmid}: ${error}`);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
