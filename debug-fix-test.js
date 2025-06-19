#!/usr/bin/env node

// Test the fixed XML parsing directly

import axios from 'axios';
import { parseStringPromise } from 'xml2js';

async function testXMLParsing() {
  console.log('🔧 Testing XML parsing fix...');
  
  const baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  
  try {
    // Get PMIDs
    const searchParams = new URLSearchParams();
    searchParams.append('term', 'diabetes');
    searchParams.append('db', 'pubmed');
    searchParams.append('retmode', 'json');
    searchParams.append('retmax', '2');
    
    const searchResponse = await axios.get(`${baseURL}/esearch.fcgi`, {
      params: searchParams,
    });
    
    const pmids = searchResponse.data.esearchresult.idlist;
    console.log('✅ PMIDs:', pmids);
    
    // Fetch XML
    const fetchParams = new URLSearchParams();
    fetchParams.append('db', 'pubmed');
    fetchParams.append('id', pmids.join(','));
    fetchParams.append('rettype', 'abstract');
    
    const fetchResponse = await axios.get(`${baseURL}/efetch.fcgi`, {
      params: fetchParams,
    });
    
    // Parse XML
    const jsonData = await parseStringPromise(fetchResponse.data, {
      explicitArray: false,
      mergeAttrs: true,
      explicitRoot: false
    });
    
    console.log('✅ XML parsed successfully');
    console.log('Top-level keys:', Object.keys(jsonData));
    
    // Handle different structures
    let articles = [];
    if (jsonData.PubmedArticleSet?.PubmedArticle) {
      console.log('PubmedArticleSet structure found');
      articles = Array.isArray(jsonData.PubmedArticleSet.PubmedArticle) 
        ? jsonData.PubmedArticleSet.PubmedArticle 
        : [jsonData.PubmedArticleSet.PubmedArticle];
    } else if (jsonData.PubmedArticle) {
      console.log('Direct PubmedArticle structure found');
      articles = Array.isArray(jsonData.PubmedArticle) 
        ? jsonData.PubmedArticle 
        : [jsonData.PubmedArticle];
    } else {
      console.log('❌ Unexpected structure');
      console.log('Available keys:', Object.keys(jsonData));
    }
    
    console.log('Articles count:', articles.length);
    
    if (articles.length > 0) {
      const firstArticle = articles[0];
      console.log('\n📄 First article structure:');
      console.log('- Has MedlineCitation:', !!firstArticle.MedlineCitation);
      console.log('- Has PMID:', !!firstArticle.MedlineCitation?.PMID);
      console.log('- PMID value:', firstArticle.MedlineCitation?.PMID);
      console.log('- Has ArticleTitle:', !!firstArticle.MedlineCitation?.Article?.ArticleTitle);
      console.log('- Title:', firstArticle.MedlineCitation?.Article?.ArticleTitle);
      
      // Test transformation
      const pmid = firstArticle.MedlineCitation?.PMID?._ || firstArticle.MedlineCitation?.PMID || 'Unknown';
      const title = firstArticle.MedlineCitation?.Article?.ArticleTitle || 'No title available';
      
      console.log('\n✅ Transformation test:');
      console.log('- Extracted PMID:', pmid);
      console.log('- Extracted title:', title);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
  }
}

testXMLParsing().catch(console.error);