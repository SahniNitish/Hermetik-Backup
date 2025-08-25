const axios = require('axios');

async function debugFrontendAuth() {
  console.log('🔍 DEBUGGING FRONTEND AUTHENTICATION ISSUE\n');

  // Step 1: Check if our backend auth is working
  console.log('1️⃣ Testing backend auth directly...');
  try {
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'user12@hermetik.com', 
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Backend login works');
    console.log('Token format:', token.substring(0, 20) + '...');
    
    // Test NAV API with this token
    const navResponse = await axios.get('http://localhost:3001/api/nav', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Backend NAV API works with proper token');
    console.log('Current NAV data:', navResponse.data.data.navData);
    
  } catch (error) {
    console.log('❌ Backend issue:', error.response?.data || error.message);
    return;
  }

  console.log('\n2️⃣ Frontend debugging steps:');
  console.log('📋 Check these in your browser console:');
  console.log('');
  console.log('   localStorage.getItem("access_token")');
  console.log('   // This should show a JWT token, not null');
  console.log('');
  console.log('   localStorage.getItem("token")'); 
  console.log('   // This might be null (we fixed this)');
  console.log('');
  console.log('3️⃣ If access_token is null, you need to log in again');
  console.log('');
  console.log('4️⃣ If access_token exists but still getting 401:');
  console.log('   - Hard refresh your browser (Cmd+Shift+R)');
  console.log('   - Check Network tab to see actual headers sent');
  console.log('   - Look for "Authorization: Bearer ..." header');
  console.log('');
  console.log('5️⃣ Common issues:');
  console.log('   - Frontend not reloaded after NAVContext fix');
  console.log('   - Token expired (need to login again)');
  console.log('   - Browser cache issues');

  console.log('\n🔧 QUICK FIXES TO TRY:');
  console.log('1. Logout and login again');
  console.log('2. Hard refresh browser (Cmd+Shift+R)');
  console.log('3. Check browser console for localStorage.getItem("access_token")');
  console.log('4. Open Network tab and watch the request headers');
}

debugFrontendAuth();
