#!/usr/bin/env node

// Test with XML parsing since JSON is not supported for efetch

import axios from 'axios';

async function debugPubMedXML() {
  console.log('🔍 Testing PubMed with XML parsing...');
  
  const baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  
  try {
    // Step 1: Get PMIDs
    console.log('\n📡 Getting PMIDs...');
    const searchParams = new URLSearchParams();
    searchParams.append('term', 'diabetes');
    searchParams.append('db', 'pubmed');
    searchParams.append('retmode', 'json');
    searchParams.append('retmax', '2');
    
    const searchResponse = await axios.get(`${baseURL}/esearch.fcgi`, {
      params: searchParams,
    });
    
    const pmids = searchResponse.data.esearchresult.idlist;
    console.log('PMIDs:', pmids);
    
    // Step 2: Get XML data (default retmode for efetch)
    console.log('\n📚 Fetching XML data...');
    const fetchParams = new URLSearchParams();
    fetchParams.append('db', 'pubmed');
    fetchParams.append('id', pmids.join(','));
    fetchParams.append('rettype', 'abstract');
    // Don't specify retmode - let it default to XML
    
    const fetchResponse = await axios.get(`${baseURL}/efetch.fcgi`, {
      params: fetchParams,
    });
    
    console.log('Response type:', typeof fetchResponse.data);
    console.log('Sample XML (first 500 chars):');
    console.log(fetchResponse.data.substring(0, 500));
    
    // Check for key XML elements
    const hasArticleTitle = fetchResponse.data.includes('<ArticleTitle>');
    const hasAbstract = fetchResponse.data.includes('<AbstractText>');
    const hasPMID = fetchResponse.data.includes('<PMID');
    
    console.log('\n🔍 XML Structure Check:');
    console.log('Has ArticleTitle:', hasArticleTitle);
    console.log('Has AbstractText:', hasAbstract);
    console.log('Has PMID:', hasPMID);
    
    // Try to extract one title as a test
    const titleMatch = fetchResponse.data.match(/<ArticleTitle>(.*?)<\/ArticleTitle>/);
    if (titleMatch) {
      console.log('\n📄 Sample title:', titleMatch[1]);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugPubMedXML().catch(console.error);