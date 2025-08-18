const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Set environment variable for JWT
process.env.JWT_SECRET = 'test-secret-key-for-development';

async function testCompleteFlow() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    console.log('Connected to MongoDB');

    // Test user ID from our sample data
    const testUserId = '689e6ebb3be5843c1f7dcfc3';

    // Generate a JWT token for this user
    const token = jwt.sign(
      { id: testUserId, email: 'test@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('✅ Generated JWT token for test user');
    console.log('Token:', token);

    // Test the API endpoint with the token
    const express = require('express');
    const analyticsRoutes = require('./routes/analytics');
    const auth = require('./middleware/auth');

    const app = express();
    app.use(express.json());
    app.use('/analytics', auth, analyticsRoutes);

    const server = app.listen(3002, () => {
      console.log('🚀 Test server running on port 3002');
      
      setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:3002/analytics/positions/apy', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            console.log('❌ Response not OK:', response.status, response.statusText);
            const text = await response.text();
            console.log('Response body:', text);
          } else {
            const data = await response.json();
            console.log('✅ API Response Success!');
            console.log('Response data:');
            console.log(JSON.stringify(data, null, 2));
          }
          
          server.close();
          await mongoose.disconnect();
          console.log('✅ Test completed successfully');
        } catch (error) {
          console.error('❌ API Test Error:', error);
          server.close();
          await mongoose.disconnect();
        }
      }, 1000);
    });

  } catch (error) {
    console.error('Error in complete flow test:', error);
  }
}

testCompleteFlow();