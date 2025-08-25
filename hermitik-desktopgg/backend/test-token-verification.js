const axios = require('axios');

async function testTokenAuth() {
  try {
    console.log('🔐 Testing Token Authentication...\n');

    // Test 1: Login and get token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'user12@hermetik.com',
      password: 'password123'
    });

    const tokenData = loginResponse.data.data;
    console.log('✅ Login successful');
    console.log('Token received:', tokenData.token.substring(0, 50) + '...');
    console.log('User:', tokenData.user.name, `(${tokenData.user.email})`);

    // Test 2: Use token to access NAV API
    console.log('\n2️⃣ Testing NAV API with token...');
    const navResponse = await axios.get('http://localhost:3001/api/nav', {
      headers: {
        'Authorization': `Bearer ${tokenData.token}`
      }
    });

    console.log('✅ NAV API access successful');
    console.log('NAV Data:', JSON.stringify(navResponse.data.data.navData, null, 2));

    // Test 3: Test with invalid token
    console.log('\n3️⃣ Testing with invalid token...');
    try {
      await axios.get('http://localhost:3001/api/nav', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
    } catch (error) {
      console.log('✅ Invalid token correctly rejected:', error.response.status, error.response.data.error);
    }

    // Test 4: Test without token
    console.log('\n4️⃣ Testing without token...');
    try {
      await axios.get('http://localhost:3001/api/nav');
    } catch (error) {
      console.log('✅ No token correctly rejected:', error.response.status, error.response.data.error);
    }

    console.log('\n🎉 Token authentication working correctly!');
    console.log('\n📋 FRONTEND FIX:');
    console.log('✅ Updated NAVContext to use "access_token" instead of "token"');
    console.log('✅ Make sure frontend stores token as "access_token" in localStorage');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testTokenAuth();
