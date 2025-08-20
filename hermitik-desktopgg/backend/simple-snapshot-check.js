const axios = require('axios');

async function simpleSnapshotCheck() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@example.com', 
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Logged in');
    
    // Check admin's own snapshots
    console.log('\n📊 Checking admin snapshots...');
    const response = await axios.get('http://localhost:3001/api/wallet/debug/snapshots', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`Found ${response.data.snapshotCount} snapshots:`);
    response.data.snapshots.forEach((s, idx) => {
      const date = new Date(s.date).toLocaleString();
      console.log(`  ${idx + 1}. ${date} - Wallet: ${s.walletAddress} - $${s.totalNavUsd} - ${s.positionCount} positions`);
    });
    
    // Try fetching admin's own wallets (might trigger new snapshot)
    console.log('\n📱 Trying to fetch admin wallets...');
    try {
      const walletResponse = await axios.get('http://localhost:3001/api/wallet/wallets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`✅ Wallet fetch result: ${walletResponse.data.portfolios?.length || 0} portfolios`);
    } catch (walletError) {
      console.log(`Wallet fetch result: ${walletError.response?.data?.error || walletError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

simpleSnapshotCheck();