const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

async function testWorkingUser() {
  try {
    console.log('🔍 Testing with user12@hermetik.com (has working wallet)...\n');
    
    // Test login
    console.log('1. Testing login...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'user12@hermetik.com',
      password: 'password123'
    });
    
    console.log('✅ Login successful');
    const token = loginResponse.data.data.token;
    console.log(`Token: ${token.substring(0, 20)}...`);
    
    // Test wallet fetching
    console.log('\n2. Testing wallet fetching...');
    const walletResponse = await axios.get(`${API_BASE_URL}/wallet/wallets`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Wallet fetch successful');
    console.log('Response structure:', {
      success: walletResponse.data.success,
      portfolios: walletResponse.data.data?.portfolios?.length || 0,
      overall_summary: walletResponse.data.data?.overall_summary
    });
    
    if (walletResponse.data.data?.portfolios) {
      console.log('\n📊 Portfolio details:');
      walletResponse.data.data.portfolios.forEach((portfolio, index) => {
        console.log(`\nPortfolio ${index + 1}: ${portfolio.address}`);
        console.log(`  Tokens: ${portfolio.tokens?.length || 0}`);
        console.log(`  Protocols: ${portfolio.protocols?.length || 0}`);
        console.log(`  Total Value: $${portfolio.summary?.total_usd_value?.toFixed(2) || 0}`);
        
        if (portfolio.tokens && portfolio.tokens.length > 0) {
          console.log('  Token details:');
          portfolio.tokens.forEach(token => {
            console.log(`    - ${token.symbol}: ${token.amount} ($${token.usd_value})`);
          });
        }
        
        if (portfolio.protocols && portfolio.protocols.length > 0) {
          console.log('  Protocol details:');
          portfolio.protocols.forEach(protocol => {
            console.log(`    - ${protocol.name}: $${protocol.net_usd_value}`);
          });
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testWorkingUser();
