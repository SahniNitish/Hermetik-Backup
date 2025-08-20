const axios = require('axios');

async function testWalletFetch() {
  try {
    console.log('🔐 Logging in to get access token...');
    
    // Try to login as the test user who has wallets
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, got token');
    
    // Fetch test user's own wallets (they have 1 wallet)
    console.log('📱 Fetching test user wallets to trigger snapshot creation...');
    
    const walletResponse = await axios.get('http://localhost:3001/api/wallet/wallets', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Wallet fetch successful');
    console.log('Response summary:', {
      portfolios: walletResponse.data.portfolios?.length || 0,
      totalValue: walletResponse.data.overall_summary?.total_usd_value || 0
    });
    
    // Wait a moment for snapshots to be created
    console.log('⏱️ Waiting for snapshots to be created...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Now test APY endpoint
    console.log('📊 Testing APY calculation...');
    
    const apyResponse = await axios.get('http://localhost:3001/api/analytics/positions/apy', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ APY fetch successful');
    console.log('APY Results:', {
      success: apyResponse.data.success,
      positionCount: apyResponse.data.positionCount,
      positions: Object.keys(apyResponse.data.positions || {})
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testWalletFetch();