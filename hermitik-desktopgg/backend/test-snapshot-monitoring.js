const axios = require('axios');

async function testSnapshotMonitoring() {
  try {
    console.log('🔐 Logging in as admin...');
    
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Check snapshots before wallet fetch
    console.log('\n📊 Checking snapshots BEFORE wallet fetch...');
    try {
      const beforeResponse = await axios.get('http://localhost:3001/api/wallet/debug/snapshots', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`Found ${beforeResponse.data.snapshotCount} existing snapshots`);
    } catch (err) {
      console.log('No existing snapshots or error:', err.response?.data?.error);
    }
    
    // Try to fetch wallets for a user with known data (from our database check)
    console.log('\n📱 Fetching wallets to trigger snapshot creation...');
    console.log('⏱️ Watch the server logs for 📸 emoji...');
    
    const userId = '687664412338e69e008eb5e2'; // User we know has position data
    const walletResponse = await axios.get(`http://localhost:3001/api/wallet/wallets?userId=${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Wallet fetch successful!');
    console.log(`Portfolios returned: ${walletResponse.data.portfolios?.length || 0}`);
    
    // Wait a moment for snapshots to be created
    console.log('\n⏱️ Waiting 3 seconds for snapshot creation...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check snapshots after wallet fetch
    console.log('📊 Checking snapshots AFTER wallet fetch...');
    const afterResponse = await axios.get(`http://localhost:3001/api/wallet/debug/snapshots?userId=${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`✅ Found ${afterResponse.data.snapshotCount} snapshots for user ${userId}:`);
    afterResponse.data.snapshots.forEach((s, idx) => {
      console.log(`  ${idx + 1}. ${new Date(s.date).toLocaleString()} - $${s.totalNavUsd.toFixed(2)} - ${s.positionCount} positions`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testSnapshotMonitoring();