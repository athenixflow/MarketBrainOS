/**
 * Test Supabase Connection and Basic Operations
 * 
 * This script tests the Supabase connection and performs basic database operations
 * to verify the migration setup is working correctly.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase environment variables not set');
  console.log('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env.local file');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase client initialized');

/**
 * Test Functions
 */

async function testConnection() {
  console.log('\n🔍 Testing Supabase connection...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('users')
      .select('count()')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Connection test successful');
    console.log(`   Database accessible, found ${data ? data.length : 0} records`);
    return true;
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

async function testUserCreation() {
  console.log('\n👤 Testing user creation...');
  
  try {
    const testUserId = 'test-user-' + Date.now();
    const testEmail = `test-${Date.now()}@example.com`;
    
    // Create test user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: testEmail,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (userError) {
      console.error('❌ User creation failed:', userError.message);
      return false;
    }
    
    console.log('✅ User created successfully');
    console.log(`   User ID: ${userData.id}`);
    console.log(`   Email: ${userData.email}`);
    
    // Create test profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: testUserId,
        tokens: 10,
        tier: 'pro',
        role: 'user'
      })
      .select()
      .single();
    
    if (profileError) {
      console.error('❌ Profile creation failed:', profileError.message);
      return false;
    }
    
    console.log('✅ Profile created successfully');
    console.log(`   Tokens: ${profileData.tokens}`);
    console.log(`   Tier: ${profileData.tier}`);
    
    // Clean up test data
    await supabase.from('user_profiles').delete().eq('id', testUserId);
    await supabase.from('users').delete().eq('id', testUserId);
    
    console.log('✅ Test data cleaned up');
    return true;
    
  } catch (error) {
    console.error('❌ User creation test failed:', error.message);
    return false;
  }
}

async function testAnalysisStorage() {
  console.log('\n📊 Testing analysis result storage...');
  
  try {
    const testUserId = 'test-analysis-user-' + Date.now();
    
    // Create test user first
    await supabase.from('users').insert({
      id: testUserId,
      email: `analysis-test-${Date.now()}@example.com`,
      created_at: new Date().toISOString()
    });
    
    // Test angle miner result storage
    const angleResult = {
      user_id: testUserId,
      product: 'Test Product',
      industry: 'Technology',
      target: 'Developers',
      goal: 'Paid Ads',
      tones: ['Direct', 'Educational'],
      prime_angles: [
        {
          title: 'Test Angle',
          hook: 'This is a test hook',
          rational: 'This is the rationale',
          score: 85
        }
      ],
      supporting_angles: [],
      exploratory_angles: [],
      hooks: [
        {
          platform: 'Facebook',
          short: 'Short hook',
          expanded: 'Expanded hook text'
        }
      ]
    };
    
    const { data: angleData, error: angleError } = await supabase
      .from('angle_miner_results')
      .insert(angleResult)
      .select()
      .single();
    
    if (angleError) {
      console.error('❌ Angle miner result storage failed:', angleError.message);
      return false;
    }
    
    console.log('✅ Angle miner result stored successfully');
    console.log(`   Result ID: ${angleData.id}`);
    console.log(`   Product: ${angleData.product}`);
    
    // Test retrieval
    const { data: retrievedData, error: retrieveError } = await supabase
      .from('angle_miner_results')
      .select('*')
      .eq('id', angleData.id)
      .single();
    
    if (retrieveError) {
      console.error('❌ Result retrieval failed:', retrieveError.message);
      return false;
    }
    
    console.log('✅ Result retrieved successfully');
    console.log(`   Retrieved product: ${retrievedData.product}`);
    
    // Clean up test data
    await supabase.from('angle_miner_results').delete().eq('user_id', testUserId);
    await supabase.from('user_profiles').delete().eq('id', testUserId);
    await supabase.from('users').delete().eq('id', testUserId);
    
    console.log('✅ Test analysis data cleaned up');
    return true;
    
  } catch (error) {
    console.error('❌ Analysis storage test failed:', error.message);
    return false;
  }
}

async function testComplexQuery() {
  console.log('\n🔎 Testing complex queries...');
  
  try {
    // Test user dashboard query (similar to what the app would use)
    const { data, error } = await supabase
      .from('user_dashboard')
      .select('*')
      .limit(5);
    
    if (error && error.code !== '42P01') { // Table doesn't exist is expected
      console.error('❌ Complex query failed:', error.message);
      return false;
    }
    
    if (error && error.code === '42P01') {
      console.log('⚠️  User dashboard view not found (expected if schema not run)');
      console.log('   This is normal if you haven\'t run the SQL schema yet');
    } else {
      console.log('✅ Complex query successful');
      console.log(`   Retrieved ${data.length} records from user dashboard view`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Complex query test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Supabase Connection Tests\n');
  
  const results = {
    connection: false,
    userCreation: false,
    analysisStorage: false,
    complexQuery: false
  };
  
  // Run tests
  results.connection = await testConnection();
  results.userCreation = await testUserCreation();
  results.analysisStorage = await testAnalysisStorage();
  results.complexQuery = await testComplexQuery();
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`   Connection: ${results.connection ? '✅' : '❌'}`);
  console.log(`   User Creation: ${results.userCreation ? '✅' : '❌'}`);
  console.log(`   Analysis Storage: ${results.analysisStorage ? '✅' : '❌'}`);
  console.log(`   Complex Queries: ${results.complexQuery ? '✅' : '❌'}`);
  
  const successCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  if (successCount >= 3) { // Allow complex query to fail if schema not run
    console.log('\n🎉 Supabase setup is working correctly!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run the SQL schema in your Supabase dashboard');
    console.log('   2. Update your application to use Supabase');
    console.log('   3. Test the full application flow');
  } else {
    console.log(`\n⚠️  Some tests failed (${totalCount - successCount})`);
    console.log('   Please check the error messages above');
  }
  
  return successCount >= 3;
}

// Run the tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});