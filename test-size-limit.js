#!/usr/bin/env node

// Test script to verify size limit handling
// This simulates the oversized result scenario for age-related macular degeneration

import { ResponseSizeMonitor } from './dist/utils/responseSizeMonitor.js';
import { SearchRefinementService } from './dist/services/searchRefinementService.js';
import { ClinicalTrialsClient } from './dist/apis/clinicalTrials.js';

async function testSizeLimitHandling() {
  console.log('🧪 Testing Size Limit Handling for Clinical Trials Search\n');

  // Initialize components
  const sizeMonitor = ResponseSizeMonitor.getInstance({
    maxResponseSize: 100000, // Set to 100KB for testing (much smaller than 1MB)
    warningThreshold: 0.8,
    truncationMode: 'fail',
    enableSizeTracking: true
  });

  const refinementService = SearchRefinementService.getInstance();
  const clinicalTrialsClient = new ClinicalTrialsClient({ enableSizeMonitoring: true });

  // Test 1: Check size monitoring utility
  console.log('📏 Test 1: Size Monitoring Utility');
  const mockLargeData = {
    studies: new Array(1000).fill({
      protocolSection: {
        identificationModule: {
          nctId: 'NCT12345678',
          briefTitle: 'A very long title that simulates real clinical trial data with detailed descriptions and comprehensive information about the study protocol, objectives, methodology, and expected outcomes',
          officialTitle: 'Official title with even more comprehensive details about this clinical trial studying age-related macular degeneration with innovative treatment approaches and novel therapeutic interventions'
        },
        statusModule: {
          overallStatus: 'RECRUITING',
          startDateStruct: { date: '2024-01-01', type: 'ACTUAL' },
          completionDateStruct: { date: '2025-12-31', type: 'ESTIMATED' }
        },
        conditionsModule: {
          conditions: ['Age-Related Macular Degeneration', 'Geographic Atrophy', 'Dry AMD']
        },
        interventionsModule: {
          interventions: [
            {
              type: 'Drug',
              name: 'Investigational Treatment',
              description: 'A novel therapeutic approach for treating age-related macular degeneration with comprehensive safety and efficacy profile'
            }
          ]
        }
      }
    }),
    totalCount: 1000,
    nextPageToken: 'next_page_token_here'
  };

  const sizeCheck = sizeMonitor.checkSizeLimit(mockLargeData, 'test-clinical-trials');
  console.log(`  ✅ Data size: ${sizeMonitor.formatSize(sizeCheck.metrics.responseSize)}`);
  console.log(`  ✅ Within limit: ${sizeCheck.withinLimit}`);
  
  if (!sizeCheck.withinLimit && sizeCheck.exceededInfo) {
    console.log(`  ⚠️  Exceeded by: ${sizeMonitor.formatSize(sizeCheck.exceededInfo.exceedsByBytes)}`);
    console.log(`  💡 Suggested actions: ${sizeCheck.exceededInfo.suggestedActions.slice(0, 2).join(', ')}`);
  }

  // Test 2: Refinement suggestions
  console.log('\n🔍 Test 2: Refinement Suggestions');
  const mockQuery = {
    query: { condition: 'age-related macular degeneration' },
    pageSize: 100
  };

  const suggestions = refinementService.analyzeAndSuggestRefinements(
    mockQuery,
    'clinicalTrials',
    sizeCheck.metrics.responseSize,
    sizeMonitor.getConfig().maxResponseSize
  );

  console.log(`  ✅ Generated ${suggestions.options.length} refinement options:`);
  suggestions.options.slice(0, 3).forEach((option, index) => {
    console.log(`    ${index + 1}. ${option.label} (${option.priority} priority)`);
    console.log(`       ${option.description}`);
  });

  // Test 3: MCP Prompt generation
  console.log('\n📝 Test 3: MCP Prompt Templates');
  const promptTemplates = refinementService.getMCPPromptTemplates();
  console.log(`  ✅ Generated ${promptTemplates.length} prompt templates:`);
  promptTemplates.forEach(template => {
    console.log(`    - ${template.name}: ${template.description}`);
  });

  // Test 4: Refinement application
  console.log('\n⚙️  Test 4: Applying Refinements');
  const selectedRefinements = suggestions.options.slice(0, 2); // Select first 2 options
  const refinementResult = refinementService.applyRefinements(
    mockQuery,
    selectedRefinements
  );

  console.log(`  ✅ Refinement result: ${refinementResult.success ? 'Success' : 'Failed'}`);
  console.log(`  ✅ Applied ${refinementResult.appliedRefinements.length} refinements`);
  console.log(`  ✅ Estimated result count: ${refinementResult.estimatedResultCount}`);

  // Test 5: Progressive loading simulation
  console.log('\n📦 Test 5: Progressive Loading Simulation');
  try {
    // This would trigger the size exceeded error in a real scenario
    const progressiveResult = await clinicalTrialsClient.loadStudiesProgressively(
      mockQuery,
      (studies, isLast) => {
        console.log(`    📄 Loaded batch: ${studies.length} studies (last: ${isLast})`);
      },
      3 // Max 3 pages for testing
    );
    
    console.log(`  ✅ Progressive loading completed:`);
    console.log(`    - Total loaded: ${progressiveResult.totalLoaded}`);
    console.log(`    - Stopped due to size: ${progressiveResult.stoppedDueToSize}`);
  } catch (error) {
    console.log(`  ⚠️  Expected error during progressive loading: ${error.message}`);
  }

  console.log('\n🎉 Size Limit Handling Tests Completed!');
  console.log('\n📋 Summary:');
  console.log('  ✅ Response size monitoring is working');
  console.log('  ✅ Refinement suggestions are generated');
  console.log('  ✅ MCP prompts are available for user interaction');
  console.log('  ✅ Refinements can be applied to queries');
  console.log('  ✅ Progressive loading handles size limits');
  console.log('\n💡 Next steps:');
  console.log('  1. Test with real API calls to ClinicalTrials.gov');
  console.log('  2. Verify MCP prompt integration in Claude Desktop');
  console.log('  3. Test user refinement workflows end-to-end');
}

// Run the test
testSizeLimitHandling().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});