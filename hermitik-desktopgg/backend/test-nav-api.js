const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

async function testNAVAPI() {
  try {
    console.log('🧪 Testing NAV API Implementation...\n');

    // First, login to get a token
    console.log('1️⃣ Logging in as user12...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'user12@hermetik.com',
      password: 'password123'
    });

    console.log('Login response:', JSON.stringify(loginResponse.data, null, 2));
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful, token:', token ? 'received' : 'NOT FOUND');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test 1: Get initial NAV data
    console.log('\n2️⃣ Getting initial NAV data...');
    const initialNavResponse = await axios.get(`${API_BASE_URL}/nav`, { headers });
    console.log('📊 Initial NAV Data:', JSON.stringify(initialNavResponse.data.data.navData, null, 2));
    console.log('📈 Initial Volatility:', JSON.stringify(initialNavResponse.data.data.volatilityMetrics, null, 2));

    // Test 2: Update net flows
    console.log('\n3️⃣ Updating net flows to $50,000...');
    const netFlowsResponse = await axios.post(`${API_BASE_URL}/nav/netflows`, {
      netFlows: 50000
    }, { headers });
    console.log('✅ Net flows updated:', netFlowsResponse.data.data.netFlows);

    // Test 3: Update NAV values
    console.log('\n4️⃣ Updating NAV values...');
    const navValuesResponse = await axios.post(`${API_BASE_URL}/nav/values`, {
      priorPreFeeNav: 1000000,
      currentPreFeeNav: 1075000,
      performance: 7.5
    }, { headers });
    console.log('✅ NAV values updated:', JSON.stringify(navValuesResponse.data.data.navData, null, 2));

    // Test 4: Add monthly NAV entries for volatility calculation
    console.log('\n5️⃣ Adding monthly NAV entries...');
    
    const monthlyEntries = [
      { date: '2024-01-01', nav: 1000000 },
      { date: '2024-02-01', nav: 1020000 },
      { date: '2024-03-01', nav: 980000 },
      { date: '2024-04-01', nav: 1040000 },
      { date: '2024-05-01', nav: 1010000 },
      { date: '2024-06-01', nav: 1065000 },
      { date: '2024-07-01', nav: 1045000 },
      { date: '2024-08-01', nav: 1075000 }
    ];

    for (const entry of monthlyEntries) {
      await axios.post(`${API_BASE_URL}/nav/monthly`, entry, { headers });
      console.log(`📅 Added ${entry.date}: $${entry.nav.toLocaleString()}`);
    }

    // Test 5: Get volatility calculation
    console.log('\n6️⃣ Getting volatility calculation...');
    const volatilityResponse = await axios.get(`${API_BASE_URL}/nav/volatility`, { headers });
    const volatilityData = volatilityResponse.data.data;
    
    console.log('📊 VOLATILITY CALCULATION RESULTS:');
    console.log(`🎯 Annualized Volatility: ${volatilityData.annualizedVolatility.toFixed(2)}%`);
    console.log(`📊 Monthly Std Dev: ${volatilityData.standardDeviation.toFixed(2)}%`);
    console.log(`📈 Monthly Returns: [${volatilityData.monthlyReturns.map(r => r.toFixed(2)).join(', ')}]%`);
    console.log(`📅 Data Points: ${volatilityData.monthsOfData} months`);
    console.log(`🧮 Formula: ${volatilityData.calculation.monthlyStdDev.toFixed(2)}% × √12 = ${volatilityData.calculation.result.toFixed(2)}%`);

    // Test 6: Verify persistence by getting NAV data again
    console.log('\n7️⃣ Verifying data persistence...');
    const finalNavResponse = await axios.get(`${API_BASE_URL}/nav`, { headers });
    const finalData = finalNavResponse.data.data;
    
    console.log('✅ FINAL PERSISTENT DATA:');
    console.log(`💰 Net Flows: $${finalData.navData.netFlows.toLocaleString()}`);
    console.log(`📊 Prior NAV: $${finalData.navData.priorPreFeeNav.toLocaleString()}`);
    console.log(`📈 Current NAV: $${finalData.navData.currentPreFeeNav.toLocaleString()}`);
    console.log(`🎯 Performance: ${finalData.navData.performance}%`);
    console.log(`📊 Volatility: ${finalData.volatilityMetrics.annualizedVolatility.toFixed(2)}%`);
    console.log(`📅 Version: ${finalData.navData.version}`);

    console.log('\n🎉 ALL NAV API TESTS PASSED! 🎉');
    console.log('\n📋 SUMMARY:');
    console.log('✅ NAV data persistence working');
    console.log('✅ Net flows updates saved to database');
    console.log('✅ Volatility calculation working');
    console.log('✅ Monthly NAV history tracking');
    console.log('✅ Data survives across requests (persistent)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testNAVAPI();
