#!/usr/bin/env node

// Debug script to test PubMed API calls directly

import axios from 'axios';

async function debugPubMed() {
  console.log('🔍 Debugging PubMed API...');
  
  const baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  
  try {
    // Step 1: Test search (esearch)
    console.log('\n📡 Step 1: Testing esearch...');
    const searchParams = new URLSearchParams();
    searchParams.append('term', 'diabetes');
    searchParams.append('db', 'pubmed');
    searchParams.append('retmode', 'json');
    searchParams.append('retmax', '3');
    
    const searchResponse = await axios.get(`${baseURL}/esearch.fcgi`, {
      params: searchParams,
    });
    
    console.log('Search response status:', searchResponse.status);
    console.log('Search data keys:', Object.keys(searchResponse.data));
    
    if (searchResponse.data.esearchresult) {
      const result = searchResponse.data.esearchresult;
      console.log('Total count:', result.count);
      console.log('PMIDs found:', result.idlist?.length || 0);
      console.log('Sample PMIDs:', result.idlist?.slice(0, 3));
      
      if (result.idlist && result.idlist.length > 0) {
        // Step 2: Test fetch (efetch)
        console.log('\n📚 Step 2: Testing efetch...');
        const pmids = result.idlist.slice(0, 2); // Test with first 2 PMIDs
        
        const fetchParams = new URLSearchParams();
        fetchParams.append('db', 'pubmed');
        fetchParams.append('id', pmids.join(','));
        fetchParams.append('retmode', 'json');
        fetchParams.append('rettype', 'abstract');
        
        const fetchResponse = await axios.get(`${baseURL}/efetch.fcgi`, {
          params: fetchParams,
        });
        
        console.log('Fetch response status:', fetchResponse.status);
        console.log('Fetch data keys:', Object.keys(fetchResponse.data));
        console.log('Response data type:', typeof fetchResponse.data);
        
        // Check if it's XML instead of JSON
        if (typeof fetchResponse.data === 'string') {
          console.log('❌ Response is XML string, not JSON!');
          console.log('Sample XML:', fetchResponse.data.substring(0, 200) + '...');
        } else {
          console.log('✅ Response is JSON');
          if (fetchResponse.data.PubmedArticleSet) {
            console.log('PubmedArticleSet found');
            console.log('Articles count:', fetchResponse.data.PubmedArticleSet.PubmedArticle?.length || 0);
          } else {
            console.log('❌ No PubmedArticleSet found');
            console.log('Available keys:', Object.keys(fetchResponse.data));
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data preview:', 
        typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 200) + '...'
          : error.response.data
      );
    }
  }
}

debugPubMed().catch(console.error);