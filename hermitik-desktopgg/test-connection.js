// Test script to verify frontend-backend connection
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testConnection() {
  console.log('🧪 Testing Frontend-Backend Connection...\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check:', health.data.status);
    
    // Test 2: Login test
    console.log('\n2. Testing login endpoint...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'password123'
    });
    console.log('✅ Login successful:', loginResponse.data.data.user.name);
    
    const token = loginResponse.data.data.token;
    
    // Test 3: Protected endpoint
    console.log('\n3. Testing protected endpoint...');
    const profileResponse = await axios.get(`${API_BASE}/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Profile endpoint accessible');
    
    // Test 4: Wallet data
    console.log('\n4. Testing wallet data endpoint...');
    const walletResponse = await axios.get(`${API_BASE}/wallet/wallets`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Wallet data accessible, portfolios found:', walletResponse.data.portfolios?.length || 0);
    
    console.log('\n🎉 All tests passed! Frontend-backend connection is working.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testConnection();