# 🚀 Deployment Guide

This guide covers various deployment options for the Medical Research MCP Suite.

## Quick Deployment Options

### 🥇 Railway (Recommended - Easiest)

Railway offers the simplest deployment with automatic GitHub integration:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy (automatic builds from your GitHub repo)
railway up
```

**Benefits:**
- ✅ Automatic deploys from GitHub
- ✅ Custom domain support
- ✅ Environment variable management
- ✅ Free tier available
- ✅ PostgreSQL database option

**Your API will be live at:** `https://your-app.railway.app`

### 🥈 Render

Great for Node.js applications with good free tier:

1. Connect your GitHub repository to Render
2. Choose "Web Service"
3. Configure:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm run start:web`
   - **Node Version:** 18+

### 🥉 DigitalOcean App Platform

Professional hosting with good scaling options:

1. Connect GitHub repository
2. Configure app settings:
   - **Runtime:** Node.js
   - **Build:** `npm run build`
   - **Run:** `npm run start:web`
   - **Port:** 3000

## Environment Variables

For all platforms, set these environment variables:

```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Optional API keys (for better rate limits)
PUBMED_API_KEY=your_pubmed_key
FDA_API_KEY=your_fda_key
```

## Local Development

```bash
# Clone repository
git clone https://github.com/eugenezhou/medical-research-mcp-suite.git
cd medical-research-mcp-suite

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Build project
npm run build

# Run MCP server (for Claude Desktop)
npm run dev

# OR run web server (for API access)
npm run web
```

## Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/
COPY src/ ./src/

# Expose port
EXPOSE 3000

# Start web server
CMD ["npm", "run", "start:web"]
```

Deploy with:
```bash
docker build -t medical-research-api .
docker run -p 3000:3000 -e NODE_ENV=production medical-research-api
```

## Advanced Deployment

### AWS ECS/Fargate

For enterprise-scale deployment:

1. Create ECR repository
2. Build and push Docker image
3. Create ECS task definition
4. Deploy to Fargate cluster

### Google Cloud Run

Serverless container deployment:

```bash
# Build and deploy
gcloud run deploy medical-research-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Kubernetes

For large-scale deployments:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: medical-research-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: medical-research-api
  template:
    metadata:
      labels:
        app: medical-research-api
    spec:
      containers:
      - name: api
        image: medical-research-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
```

## Performance Considerations

### Caching
- Clinical trials: 1 hour cache
- PubMed literature: 6 hour cache  
- FDA data: 24 hour cache

### Rate Limiting
- Respects API quotas
- Built-in retry logic
- Graceful degradation

### Monitoring
- Health check endpoint: `/api/status`
- Comprehensive logging with Winston
- Memory and uptime metrics

## Security

### Environment Variables
Never commit sensitive data:
- API keys
- Database credentials
- Authentication tokens

### CORS Configuration
The web server includes CORS headers for cross-origin requests.

### Rate Limiting
Built-in rate limiting prevents abuse and protects API quotas.

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
lsof -ti:3000 | xargs kill -9
```

**Memory Issues:**
Increase Node.js memory limit:
```bash
node --max-old-space-size=4096 dist/web-server.js
```

**API Rate Limits:**
Get API keys from:
- [PubMed API Keys](https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities/)
- [FDA API Keys](https://open.fda.gov/apis/authentication/)

### Health Monitoring

Monitor your deployment:
```bash
curl https://your-app.railway.app/api/status
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 123.456,
  "memory": {...},
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Support

- 📖 [Documentation](https://github.com/eugenezhou/medical-research-mcp-suite)
- 🐛 [Issues](https://github.com/eugenezhou/medical-research-mcp-suite/issues)
- 💬 [Discussions](https://github.com/eugenezhou/medical-research-mcp-suite/discussions)
