/**
 * Test the export endpoint directly
 */

const axios = require('axios');

async function testExport() {
  try {
    console.log('🧪 Testing NAV export endpoint...');

    // First, try to login to get a valid token
    console.log('🔐 Attempting login...');
    
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data?.token || loginResponse.data.token;
    console.log('✅ Login successful, got token');
    
    // Now test the export endpoint
    console.log('📊 Testing export endpoint...');
    
    const exportResponse = await axios.get('http://localhost:3001/api/analytics/export/monthly-nav', {
      params: {
        userId: '68a1f123f09a6ebb3a9d9c0b',
        month: 7, // August (0-based)
        year: 2025
      },
      headers: {
        'Authorization': `Bearer ${token}`
      },
      responseType: 'blob'
    });
    
    console.log('✅ Export successful!');
    console.log('📊 Response details:');
    console.log('- Status:', exportResponse.status);
    console.log('- Content-Type:', exportResponse.headers['content-type']);
    console.log('- Content-Length:', exportResponse.headers['content-length']);
    console.log('- Blob size:', exportResponse.data.size);
    
    // Check if we got Excel data or an error
    if (exportResponse.headers['content-type'].includes('spreadsheet')) {
      console.log('✅ Received Excel file successfully!');
      
      // Save the file to test
      const fs = require('fs');
      fs.writeFileSync('test-export.xlsx', exportResponse.data);
      console.log('📁 Saved test file as test-export.xlsx');
      
    } else {
      console.log('❌ Did not receive Excel file');
      console.log('Content type:', exportResponse.headers['content-type']);
      
      // If it's text, read it
      if (exportResponse.headers['content-type'].includes('text')) {
        const text = await exportResponse.data.text();
        console.log('Response text:', text);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing export:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }
  }
}

testExport().catch(console.error);
