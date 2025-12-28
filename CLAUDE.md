# CLAUDE.md - AI Assistant Guide for Medical Research MCP Suite

## Project Overview

This is a **Model Context Protocol (MCP) server** that provides AI-enhanced access to medical research databases. It unifies three major data sources:

- **ClinicalTrials.gov** - 400,000+ clinical studies
- **PubMed** - 35M+ research papers
- **FDA Database** - 80,000+ drug products and safety data

The server enables AI assistants (like Claude Desktop) to search, analyze, and correlate data across these databases.

## Quick Reference

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run MCP server (for Claude Desktop integration)
npm run dev

# Run web API server
npm run web

# Run tests
npm test

# Lint code
npm run lint
```

## Architecture

```
src/
├── index.ts                    # Main MCP server entry point
├── web-server.ts               # Express web server (alternative to MCP)
├── apis/                       # External API clients
│   ├── clinicalTrials.ts       # ClinicalTrials.gov API client
│   ├── pubmed.ts               # PubMed/NCBI eUtils client
│   ├── fda.ts                  # openFDA API client
│   └── index.ts                # API exports
├── services/                   # Cross-database analysis services
│   ├── researchAnalyzer.ts     # Comprehensive drug/condition analysis
│   ├── drugSafety.ts           # Drug safety profile generation
│   ├── searchRefinementService.ts # Query refinement helpers
│   └── configurable-services.ts
├── types/                      # TypeScript type definitions
│   ├── index.ts                # Type exports
│   ├── common.ts               # Shared types
│   └── refinementTypes.ts      # Refinement-related types
├── config/                     # Configuration
│   ├── index.ts
│   └── public-interfaces.ts
└── utils/                      # Utility modules
    ├── cache.ts                # In-memory caching
    ├── logger.ts               # Winston logging
    ├── validators.ts           # Input validation
    ├── responseSizeMonitor.ts  # Response size limits for MCP
    ├── progressiveLoader.ts    # Paginated data loading
    ├── query-enhancer.ts       # Medical query enhancement
    └── drug-knowledge-graph.ts # Drug relationship mapping

tests/
└── clinicalTrials.test.ts      # Jest integration tests
```

## Key Patterns

### MCP Tool Naming Convention
Tools follow a prefix-based naming pattern:
- `ct_*` - ClinicalTrials.gov tools (e.g., `ct_search_trials`, `ct_get_study`)
- `pm_*` - PubMed tools (e.g., `pm_search_papers`)
- `fda_*` - FDA tools (e.g., `fda_search_drugs`, `fda_adverse_events`)
- `research_*` - Cross-database analysis tools (e.g., `research_comprehensive_analysis`)

### Response Size Monitoring
The MCP protocol has response size limits. The `ResponseSizeMonitor` utility tracks response sizes and provides refinement suggestions when limits are exceeded. Always be aware of this when handling large result sets.

### Caching Strategy
- **ClinicalTrials**: 1-hour cache (`cacheTimeout = 3600000`)
- **PubMed**: 1-hour cache
- **FDA**: 1-hour cache
- Cache keys are based on JSON-serialized query parameters

### Error Handling Pattern
```typescript
try {
  const result = await apiClient.someMethod(params);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
} catch (error: any) {
  return {
    content: [{ type: "text", text: `Error: ${error.message}` }],
    isError: true,
  };
}
```

## Development Workflow

### Building
```bash
npm run build     # Compile TypeScript to dist/
npm run clean     # Remove dist/ directory
```

### Testing
```bash
npm test                    # Run all tests
npm run test:coverage       # Run with coverage report
npm run test:clinical-trials # Test ClinicalTrials client only
npm run test:pubmed         # Test PubMed client only
npm run test:fda            # Test FDA client only
```

Tests are Jest-based with 30-second timeout for API calls. Test files use `.test.ts` extension.

### Linting
```bash
npm run lint        # Check for linting issues
npm run lint:fix    # Auto-fix linting issues
```

## TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext with Node.js resolution
- **Strict mode**: Enabled
- **Source maps**: Enabled
- **Declaration files**: Generated

Important: The project uses ES modules (`"type": "module"` in package.json). Import statements must include `.js` extensions even for TypeScript files:

```typescript
// Correct
import { ClinicalTrialsClient } from './apis/clinicalTrials.js';

// Incorrect (will fail at runtime)
import { ClinicalTrialsClient } from './apis/clinicalTrials';
```

## API Client Details

### ClinicalTrials.gov (`src/apis/clinicalTrials.ts`)
- Base URL: `https://clinicaltrials.gov/api/v2`
- No API key required
- Supports: condition, intervention, phase, status filters
- Returns: Study objects with `protocolSection` containing trial metadata

### PubMed (`src/apis/pubmed.ts`)
- Base URL: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`
- Optional API key via `PUBMED_API_KEY` env var
- Two-step process: esearch.fcgi (get PMIDs) -> efetch.fcgi (get details)
- Returns XML that is parsed to JSON using xml2js

### FDA (`src/apis/fda.ts`)
- Base URL: `https://api.fda.gov`
- Optional API key via `FDA_API_KEY` env var
- Endpoints: `/drug/label.json`, `/drug/event.json`

## MCP Server (`src/index.ts`)

The `MedicalResearchMCPServer` class:
1. Initializes all API clients
2. Initializes cross-API services (ResearchAnalyzer, DrugSafetyService)
3. Sets up MCP request handlers for tool listing and execution
4. Routes tool calls based on prefix

### Adding a New Tool

1. Add tool definition to the appropriate `get*Tools()` method
2. Add handler in the corresponding `handle*Call()` method
3. Export types from `src/types/index.ts` if needed

Example:
```typescript
// In getClinicalTrialsTools()
{
  name: "ct_new_tool",
  description: "Description of the tool",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string", description: "Parameter description" }
    },
    required: ["param1"],
  },
}

// In handleClinicalTrialsCall()
case 'new_tool':
  const result = await this.clinicalTrialsClient.newMethod(args.param1);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
```

## Environment Variables

```bash
# API Keys (optional but recommended for higher rate limits)
PUBMED_API_KEY=your_key
FDA_API_KEY=your_key

# Caching
CACHE_TTL=3600000           # Cache time-to-live in ms
CACHE_MAX_KEYS=10000        # Maximum cached entries

# Logging
LOG_LEVEL=info              # debug, info, warn, error
LOG_FILE=logs/medical-research-mcp.log

# Performance
MAX_CONCURRENT_REQUESTS=10
DEFAULT_TIMEOUT=30000

# Runtime
NODE_ENV=development        # development, production
```

## Common Tasks for AI Assistants

### When modifying API clients:
1. Maintain the caching pattern with `getCacheKey()` and `isValidCache()`
2. Preserve the axios interceptor error handling
3. Keep response size monitoring integration
4. Update type definitions in the corresponding interface

### When adding cross-API features:
1. Add to `ResearchAnalyzer` or `DrugSafetyService`
2. Create a new `research_*` tool in `getCrossAPITools()`
3. Add handler in `handleCrossAPICall()`

### When debugging:
- Check `logs/` directory for Winston logs
- Use `LOG_LEVEL=debug` for verbose output
- MCP server writes to stderr to avoid protocol interference
- Never use `console.log` in MCP mode (breaks protocol)

### When handling large responses:
1. Use pagination (`pageSize`, `pageToken` parameters)
2. Check `ResponseSizeMonitor` limits
3. Consider progressive loading via `loadStudiesProgressively()`
4. Use the refinement service to suggest query narrowing

## Testing Considerations

- Tests make real API calls (no mocking by default)
- Tests have 30-second timeout for slow API responses
- Always run `npm test` before committing
- Integration tests are separate: `npm run test:integration`

## Files to Never Commit

- `.env` files (use `.env.example` as template)
- `private/` directory (proprietary modules)
- `node_modules/`
- `dist/` build output
- `logs/` directory

## Dependencies Overview

**Core:**
- `@modelcontextprotocol/sdk` - MCP server implementation
- `axios` - HTTP client for API calls
- `xml2js` - XML parsing for PubMed responses

**Web Server:**
- `express` - Web framework
- `cors` - CORS middleware

**Utilities:**
- `winston` - Logging
- `node-cache` - In-memory caching
- `dotenv` - Environment variable loading

**Development:**
- `typescript` - Type checking and compilation
- `jest` + `ts-jest` - Testing
- `tsx` - TypeScript execution for development
- `eslint` - Code linting

## Claude Desktop Integration

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "medical-research": {
      "command": "node",
      "args": ["/absolute/path/to/medical-research-mcp-suite/dist/index.js"],
      "env": {
        "PUBMED_API_KEY": "your_key_here",
        "FDA_API_KEY": "your_key_here"
      }
    }
  }
}
```

## Code Style Conventions

1. **TypeScript strict mode** - All types must be explicit
2. **ES modules** - Use `import/export`, include `.js` extensions
3. **Async/await** - Prefer over raw Promises
4. **Error wrapping** - Catch and re-throw with context
5. **Interface-first** - Define interfaces before implementations
6. **Singleton services** - Use `getInstance()` pattern for utilities
