// src/web-server.ts - Add this file for web deployment
import express from 'express';
import cors from 'cors';
import { ClinicalTrialsClient } from './apis/clinicalTrials.js';
import { FDAClient } from './apis/fda.js';
import { PubMedClient } from './apis/pubmed.js';
import { ResearchAnalyzer } from './services/researchAnalyzer.js';
import { DrugSafetyService } from './services/drugSafety.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Initialize clients
const clinicalTrialsClient = new ClinicalTrialsClient();
const fdaClient = new FDAClient();
const pubmedClient = new PubMedClient();

const researchAnalyzer = new ResearchAnalyzer({
  clinicalTrials: clinicalTrialsClient,
  pubmed: pubmedClient,
  fda: fdaClient,
});

const drugSafetyService = new DrugSafetyService({
  clinicalTrials: clinicalTrialsClient,
  fda: fdaClient,
});

// Health check / API info
app.get('/api', (req, res) => {
  res.json({
    message: '🏥 Medical Research Intelligence API',
    version: '1.0.0',
    description: 'AI-Enhanced Medical Research API unifying ClinicalTrials.gov, PubMed, and FDA databases',
    endpoints: {
      trials: 'POST /api/trials/search',
      drugs: 'POST /api/fda/drugs',
      analysis: 'POST /api/analysis/comprehensive',
      safety: 'POST /api/analysis/safety'
    },
    documentation: 'https://github.com/eugenezhou/medical-research-mcp-suite',
    demo: '/index.html',
    timestamp: new Date().toISOString()
  });
});

// Root route - serve demo page or API info based on Accept header
app.get('/', (req, res) => {
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
  
  if (acceptsHtml) {
    // Browser request - serve demo page
    res.sendFile('index.html', { root: 'public' });
  } else {
    // API request - return JSON
    res.json({
      message: '🏥 Medical Research Intelligence API',
      version: '1.0.0',
      demo: '/index.html',
      apiInfo: '/api',
      documentation: 'https://github.com/eugenezhou/medical-research-mcp-suite'
    });
  }
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Clinical trials endpoint
app.post('/api/trials/search', async (req, res) => {
  try {
    const { condition, intervention, pageSize = 10, phase, status } = req.body;
    
    if (!condition && !intervention) {
      return res.status(400).json({
        success: false,
        error: 'At least one of condition or intervention is required'
      });
    }
    
    const result = await clinicalTrialsClient.searchStudies({
      query: { condition, intervention },
      filter: { phase, overallStatus: status },
      pageSize: Math.min(pageSize, 100) // Cap at 100
    });
    
    res.json({
      success: true,
      data: result,
      metadata: {
        totalStudies: result.studies.length,
        searchCriteria: { condition, intervention, pageSize }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Clinical trials search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search clinical trials'
    });
  }
});

// Get specific study
app.get('/api/trials/:nctId', async (req, res) => {
  try {
    const { nctId } = req.params;
    
    if (!/^NCT\d{8}$/.test(nctId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid NCT ID format. Must be NCT followed by 8 digits.'
      });
    }
    
    const study = await clinicalTrialsClient.getStudyById(nctId);
    
    if (!study) {
      return res.status(404).json({
        success: false,
        error: 'Study not found'
      });
    }
    
    res.json({
      success: true,
      data: study,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Get study error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get study details'
    });
  }
});

// PubMed literature search
app.post('/api/literature/search', async (req, res) => {
  try {
    const { query, maxResults = 20, publicationTypes, dateRange } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    const result = await pubmedClient.searchPapers({
      query,
      maxResults: Math.min(maxResults, 100), // Cap at 100
      publicationTypes,
      dateRange
    });
    
    res.json({
      success: true,
      data: result,
      metadata: {
        papersReturned: result.papers.length,
        totalAvailable: result.totalCount,
        searchQuery: query
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Literature search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search literature'
    });
  }
});

// FDA drugs endpoint
app.post('/api/fda/drugs', async (req, res) => {
  try {
    const { drugName, activeIngredient, approvalStatus, limit = 20 } = req.body;
    
    if (!drugName && !activeIngredient) {
      return res.status(400).json({
        success: false,
        error: 'Either drugName or activeIngredient is required'
      });
    }
    
    const result = await fdaClient.searchDrugs({
      drugName,
      activeIngredient,
      approvalStatus,
      limit: Math.min(limit, 100) // Cap at 100
    });
    
    res.json({
      success: true,
      data: result,
      metadata: {
        productsFound: result.drugs.length,
        totalAvailable: result.totalCount,
        searchCriteria: { drugName, activeIngredient, approvalStatus }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('FDA drugs search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search FDA drugs'
    });
  }
});

// FDA adverse events endpoint
app.post('/api/fda/adverse-events', async (req, res) => {
  try {
    const { drugName, dateRange, limit = 100 } = req.body;
    
    if (!drugName) {
      return res.status(400).json({
        success: false,
        error: 'drugName parameter is required'
      });
    }
    
    const result = await fdaClient.getAdverseEvents({
      drugName,
      dateRange,
      limit: Math.min(limit, 1000) // Cap at 1000
    });
    
    res.json({
      success: true,
      data: result,
      metadata: {
        eventsReturned: result.events.length,
        totalAvailable: result.totalCount,
        drugName
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('FDA adverse events error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get adverse events'
    });
  }
});

// Comprehensive analysis endpoint - THE MAGIC!
app.post('/api/analysis/comprehensive', async (req, res) => {
  try {
    const { drugName, condition, analysisDepth = 'detailed' } = req.body;
    
    if (!drugName || !condition) {
      return res.status(400).json({
        success: false,
        error: 'Both drugName and condition are required'
      });
    }
    
    console.log(`Starting comprehensive analysis for ${drugName} + ${condition}`);
    
    // Get data from all sources
    const [trials, literature, fdaData] = await Promise.allSettled([
      clinicalTrialsClient.searchStudies({
        query: { intervention: drugName, condition },
        pageSize: 50
      }),
      pubmedClient.searchPapers({
        query: `${drugName} AND ${condition}`,
        maxResults: 30
      }),
      fdaClient.searchDrugs({
        drugName
      })
    ]);
    
    // Extract successful results
    const trialsData = trials.status === 'fulfilled' ? trials.value : { studies: [], totalCount: 0 };
    const literatureData = literature.status === 'fulfilled' ? literature.value : { papers: [], totalCount: 0 };
    const fdaDataResult = fdaData.status === 'fulfilled' ? fdaData.value : { drugs: [], totalCount: 0 };
    
    // Cross-analyze
    const analysis = await researchAnalyzer.comprehensiveAnalysis({
      drugName,
      condition,
      trials: trialsData.studies,
      literature: literatureData.papers,
      fdaData: fdaDataResult.drugs,
      depth: analysisDepth
    });
    
    res.json({
      success: true,
      data: analysis,
      metadata: {
        trialsAnalyzed: trialsData.studies.length,
        papersAnalyzed: literatureData.papers.length,
        fdaProductsFound: fdaDataResult.drugs.length,
        analysisDepth,
        searchCriteria: { drugName, condition }
      },
      dataSourceStatus: {
        clinicalTrials: trials.status,
        literature: literature.status,
        fda: fdaData.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Comprehensive analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to perform comprehensive analysis'
    });
  }
});

// Drug safety profile endpoint
app.post('/api/analysis/safety', async (req, res) => {
  try {
    const { drugName, includeTrials = true, includeFDA = true, timeframe = '5years' } = req.body;
    
    if (!drugName) {
      return res.status(400).json({
        success: false,
        error: 'drugName parameter is required'
      });
    }
    
    const safetyProfile = await drugSafetyService.generateSafetyProfile({
      drugName,
      includeTrials,
      includeFDA,
      timeframe
    });
    
    res.json({
      success: true,
      data: safetyProfile,
      metadata: {
        drugName,
        analysisParameters: { includeTrials, includeFDA, timeframe }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Safety analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate safety profile'
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/status',
      'POST /api/trials/search',
      'GET /api/trials/:nctId',
      'POST /api/literature/search',
      'POST /api/fda/drugs',
      'POST /api/fda/adverse-events',
      'POST /api/analysis/comprehensive',
      'POST /api/analysis/safety'
    ],
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🏥 Medical Research API running on port ${port}`);
  console.log(`🚀 Ready to serve medical research insights!`);
  console.log(`📚 Documentation: https://github.com/eugenezhou/medical-research-mcp-suite`);
  console.log(`🔗 Base URL: http://localhost:${port}`);
});

export default app;
