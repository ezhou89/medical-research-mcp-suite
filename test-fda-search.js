#!/usr/bin/env node

// Test script to verify FDA search functionality with ranibizumab and other AMD drugs

import { FDAClient } from './dist/apis/fda.js';

async function testFDASearch() {
  console.log('🧪 Testing FDA Search Functionality\n');

  const fdaClient = new FDAClient();

  // Test drugs related to AMD (Age-related Macular Degeneration)
  const testDrugs = [
    { name: 'ranibizumab', type: 'activeIngredient', description: 'Lucentis - Anti-VEGF injection' },
    { name: 'bevacizumab', type: 'activeIngredient', description: 'Avastin - Off-label use for AMD' },
    { name: 'aflibercept', type: 'activeIngredient', description: 'Eylea - Anti-VEGF injection' },
    { name: 'Lucentis', type: 'drugName', description: 'Brand name for ranibizumab' },
    { name: 'Eylea', type: 'drugName', description: 'Brand name for aflibercept' },
  ];

  for (const drug of testDrugs) {
    console.log(`\n🔍 Testing ${drug.type} search: "${drug.name}" (${drug.description})`);
    
    try {
      const searchParams = drug.type === 'activeIngredient' ? 
        { activeIngredient: drug.name } : 
        { drugName: drug.name };

      const startTime = Date.now();
      const results = await fdaClient.searchDrugs(searchParams);
      const endTime = Date.now();

      console.log(`  ✅ Search completed in ${endTime - startTime}ms`);
      console.log(`  📊 Results: ${results.totalCount} total, ${results.drugs.length} returned`);

      if (results.drugs.length > 0) {
        const firstDrug = results.drugs[0];
        console.log(`  📋 First result:`);
        console.log(`    - Application Number: ${firstDrug.applicationNumber}`);
        console.log(`    - Sponsor: ${firstDrug.sponsorName}`);
        console.log(`    - Brand Name: ${firstDrug.brandName || 'N/A'}`);
        console.log(`    - Generic Name: ${firstDrug.genericName || 'N/A'}`);
        console.log(`    - Approval Date: ${firstDrug.approvalDate}`);
        console.log(`    - Active Ingredients: ${firstDrug.activeIngredients.map(ai => `${ai.name} (${ai.strength})`).join(', ')}`);
      } else {
        console.log(`  ⚠️  No results found for ${drug.name}`);
      }
    } catch (error) {
      console.log(`  ❌ Error searching for ${drug.name}: ${error.message}`);
    }
  }

  // Test error handling with nonsensical search
  console.log(`\n🧪 Testing Error Handling with nonsensical drug name`);
  try {
    const results = await fdaClient.searchDrugs({ drugName: 'xyzzyfakedrugname123' });
    console.log(`  ✅ Error handling successful - returned ${results.drugs.length} results`);
  } catch (error) {
    console.log(`  ❌ Unexpected error: ${error.message}`);
  }

  // Test adverse events for a known drug
  console.log(`\n🔍 Testing Adverse Events for ranibizumab`);
  try {
    const startTime = Date.now();
    const adverseEvents = await fdaClient.getAdverseEvents({ 
      drugName: 'ranibizumab',
      limit: 10
    });
    const endTime = Date.now();

    console.log(`  ✅ Adverse events search completed in ${endTime - startTime}ms`);
    console.log(`  📊 Results: ${adverseEvents.totalCount} total events`);
    console.log(`  📈 Summary:`);
    console.log(`    - Total: ${adverseEvents.summary.total}`);
    console.log(`    - Serious: ${adverseEvents.summary.serious}`);
    console.log(`    - Hospitalizations: ${adverseEvents.summary.hospitalizations}`);
    console.log(`    - Deaths: ${adverseEvents.summary.deaths}`);
    
    if (adverseEvents.summary.topEvents.length > 0) {
      console.log(`    - Top Events:`);
      adverseEvents.summary.topEvents.slice(0, 3).forEach((event, index) => {
        console.log(`      ${index + 1}. ${event.event} (${event.count} reports)`);
      });
    }
  } catch (error) {
    console.log(`  ❌ Error searching adverse events: ${error.message}`);
  }

  console.log('\n🎉 FDA Search Tests Completed!');
}

// Run the test
testFDASearch().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});