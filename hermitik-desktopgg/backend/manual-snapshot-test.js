const axios = require('axios');

async function manualSnapshotTest() {
  try {
    console.log('🔐 Logging in...');
    
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Try to fetch wallets for the user from your frontend logs
    const userId = '689bcacf9fe4bbc83dc79fd1'; // User with wallet 0x7e73dA415Af2BBCC11f45aeEf7F2cA60222EC736
    console.log(`📱 Fetching wallets for user ${userId} (same as frontend)...`);
    console.log('🔍 WATCH THE SERVER TERMINAL FOR 📸 MESSAGES...');
    
    const response = await axios.get(`http://localhost:3001/api/wallet/wallets?userId=${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ API call successful!');
    console.log(`Portfolios: ${response.data.portfolios?.length || 0}`);
    console.log(`Total Value: $${response.data.overall_summary?.total_usd_value?.toFixed(2) || 0}`);
    
    console.log('\n📸 Now check if a new snapshot was created for today...');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

manualSnapshotTest();