# 📚 API Reference

Complete API documentation for the Medical Research MCP Suite.

## Base URL

- **Local Development:** `http://localhost:3000`
- **Production:** `https://your-app.railway.app`

## Authentication

Currently, no authentication is required. API keys for enhanced rate limits can be configured via environment variables.

## Rate Limiting

- **ClinicalTrials.gov:** 100 requests/minute
- **PubMed:** 10 requests/second (with API key)
- **FDA:** Respectful usage guidelines

## Response Format

All endpoints return JSON in this format:

```json
{
  "success": true,
  "data": {...},
  "metadata": {...},
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error description",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Endpoints

### Health Check

#### `GET /`
Returns API information and available endpoints.

**Response:**
```json
{
  "message": "🏥 Medical Research Intelligence API",
  "version": "1.0.0",
  "endpoints": {
    "trials": "POST /api/trials/search",
    "drugs": "POST /api/fda/drugs",
    "analysis": "POST /api/analysis/comprehensive"
  }
}
```

#### `GET /api/status`
Returns API health status.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 123.456,
  "memory": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 87654321
  }
}
```

## Clinical Trials

### Search Clinical Trials

#### `POST /api/trials/search`

Search clinical trials from ClinicalTrials.gov.

**Request Body:**
```json
{
  "condition": "diabetes",
  "intervention": "metformin",
  "pageSize": 10,
  "phase": ["PHASE3"],
  "status": ["RECRUITING", "COMPLETED"]
}
```

**Parameters:**
- `condition` (string): Medical condition (e.g., "diabetes", "cancer")
- `intervention` (string): Drug or treatment name
- `pageSize` (number): Number of results (1-100, default: 10)
- `phase` (array): Study phases (PHASE1, PHASE2, PHASE3, PHASE4)
- `status` (array): Study status filters

**Response:**
```json
{
  "success": true,
  "data": {
    "studies": [...],
    "totalCount": 1234,
    "nextPageToken": "..."
  },
  "metadata": {
    "totalStudies": 10,
    "searchCriteria": {
      "condition": "diabetes",
      "intervention": "metformin"
    }
  }
}
```

### Get Specific Study

#### `GET /api/trials/{nctId}`

Get detailed information for a specific clinical trial.

**Parameters:**
- `nctId` (path): NCT identifier (e.g., NCT04373031)

**Response:**
```json
{
  "success": true,
  "data": {
    "protocolSection": {
      "identificationModule": {
        "nctId": "NCT04373031",
        "briefTitle": "Study Title",
        "officialTitle": "Official Study Title"
      },
      "statusModule": {
        "overallStatus": "COMPLETED"
      }
    }
  }
}
```

## Literature

### Search PubMed Literature

#### `POST /api/literature/search`

Search research papers from PubMed.

**Request Body:**
```json
{
  "query": "diabetes AND metformin",
  "maxResults": 20,
  "publicationTypes": ["Clinical Trial"],
  "dateRange": {
    "from": "2020-01-01",
    "to": "2024-12-31"
  }
}
```

**Parameters:**
- `query` (string, required): Search query
- `maxResults` (number): Maximum results (1-100, default: 20)
- `publicationTypes` (array): Filter by publication types
- `dateRange` (object): Date range filter

**Response:**
```json
{
  "success": true,
  "data": {
    "papers": [...],
    "totalCount": 23056,
    "query": "diabetes AND metformin"
  },
  "metadata": {
    "papersReturned": 20,
    "totalAvailable": 23056
  }
}
```

## FDA Database

### Search FDA Drug Database

#### `POST /api/fda/drugs`

Search FDA-approved drugs and products.

**Request Body:**
```json
{
  "drugName": "metformin",
  "activeIngredient": "metformin hydrochloride",
  "approvalStatus": "approved",
  "limit": 20
}
```

**Parameters:**
- `drugName` (string): Drug name to search
- `activeIngredient` (string): Active ingredient name
- `approvalStatus` (string): Approval status filter
- `limit` (number): Result limit (1-100, default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "drugs": [...],
    "totalCount": 82
  },
  "metadata": {
    "productsFound": 20,
    "totalAvailable": 82
  }
}
```

### Get FDA Adverse Events

#### `POST /api/fda/adverse-events`

Get adverse event reports for a specific drug.

**Request Body:**
```json
{
  "drugName": "metformin",
  "dateRange": {
    "from": "2020-01-01",
    "to": "2024-12-31"
  },
  "limit": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [...],
    "totalCount": 1234,
    "summary": {
      "total": 1234,
      "serious": 123,
      "hospitalizations": 45,
      "deaths": 12
    }
  }
}
```

## Analysis (AI-Enhanced)

### Comprehensive Analysis

#### `POST /api/analysis/comprehensive` 🔥

**The Magic!** Cross-database analysis combining clinical trials, literature, and FDA data.

**Request Body:**
```json
{
  "drugName": "pembrolizumab",
  "condition": "lung cancer",
  "analysisDepth": "comprehensive"
}
```

**Parameters:**
- `drugName` (string, required): Drug name to analyze
- `condition` (string, required): Medical condition
- `analysisDepth` (string): "basic", "detailed", or "comprehensive" (default: "detailed")

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": "Analysis of pembrolizumab for lung cancer...",
    "clinicalTrials": {
      "total": 45,
      "byPhase": {
        "PHASE1": 8,
        "PHASE2": 12,
        "PHASE3": 15
      },
      "recruitment": {
        "COMPLETED": 32,
        "RECRUITING": 8
      }
    },
    "literature": {
      "total": 1250,
      "keyFindings": [...],
      "publicationTrends": {...}
    },
    "fdaStatus": {
      "approvalStatus": "Approved - 2014-09-04",
      "adverseEvents": {...}
    },
    "insights": [...],
    "riskAssessment": {
      "level": "Low",
      "factors": [...]
    },
    "marketOpportunity": {
      "competitivePosition": "Advanced development stage",
      "keyCompetitors": [...]
    },
    "nextSteps": [...]
  },
  "metadata": {
    "trialsAnalyzed": 45,
    "papersAnalyzed": 1250,
    "fdaProductsFound": 5,
    "analysisDepth": "comprehensive"
  }
}
```

### Drug Safety Profile

#### `POST /api/analysis/safety`

Generate comprehensive drug safety analysis.

**Request Body:**
```json
{
  "drugName": "metformin",
  "includeTrials": true,
  "includeFDA": true,
  "timeframe": "5years"
}
```

**Parameters:**
- `drugName` (string, required): Drug name to analyze
- `includeTrials` (boolean): Include clinical trial safety data (default: true)
- `includeFDA` (boolean): Include FDA adverse event data (default: true)
- `timeframe` (string): "1year", "2years", "5years", or "all" (default: "5years")

**Response:**
```json
{
  "success": true,
  "data": {
    "drugName": "metformin",
    "overallRiskLevel": "Low",
    "clinicalTrialSafety": {
      "totalStudies": 100,
      "completedStudies": 72,
      "commonSideEffects": [...],
      "seriousAdverseEvents": [...],
      "discontinuationRate": 15
    },
    "fdaSafetyData": {
      "totalReports": 5432,
      "seriousReports": 543,
      "mostCommonEvents": [...]
    },
    "recommendations": {
      "monitoringRecommendations": [...],
      "contraindicationAlerts": [...],
      "doseAdjustmentConsiderations": [...]
    }
  }
}
```

## Error Codes

- **400 Bad Request**: Invalid parameters or missing required fields
- **404 Not Found**: Resource not found (e.g., invalid NCT ID)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error or external API failure

## Examples

### JavaScript/Node.js

```javascript
const response = await fetch('https://your-api.com/api/analysis/comprehensive', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    drugName: 'metformin',
    condition: 'diabetes',
    analysisDepth: 'detailed'
  })
});

const data = await response.json();
console.log(data);
```

### Python

```python
import requests

response = requests.post(
    'https://your-api.com/api/analysis/comprehensive',
    json={
        'drugName': 'metformin',
        'condition': 'diabetes',
        'analysisDepth': 'detailed'
    }
)

data = response.json()
print(data)
```

### cURL

```bash
curl -X POST https://your-api.com/api/analysis/comprehensive \
  -H "Content-Type: application/json" \
  -d '{
    "drugName": "metformin",
    "condition": "diabetes",
    "analysisDepth": "detailed"
  }'
```

## SDKs

Coming soon:
- JavaScript/TypeScript SDK
- Python SDK
- R Package

## Support

- 📖 [Documentation](https://github.com/eugenezhou/medical-research-mcp-suite)
- 🐛 [Report Issues](https://github.com/eugenezhou/medical-research-mcp-suite/issues)
- 💬 [Discussions](https://github.com/eugenezhou/medical-research-mcp-suite/discussions)
