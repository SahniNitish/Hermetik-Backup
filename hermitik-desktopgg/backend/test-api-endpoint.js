const express = require('express');
const mongoose = require('mongoose');
const analyticsRoutes = require('./routes/analytics');

async function testAPIEndpoint() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hermetik');
    console.log('Connected to MongoDB');

    // Create a mock Express app
    const app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use('/analytics', (req, res, next) => {
      // Set the test user ID
      req.user = { id: '689e6ebb3be5843c1f7dcfc3' };
      next();
    });

    // Use the analytics routes
    app.use('/analytics', analyticsRoutes);

    // Start the server
    const server = app.listen(3001, () => {
      console.log('Test server running on port 3001');
      
      // Test the API endpoint
      setTimeout(async () => {
        try {
          const response = await fetch('http://localhost:3001/analytics/positions/apy');
          const data = await response.json();
          
          console.log('✅ API Response:');
          console.log(JSON.stringify(data, null, 2));
          
          server.close();
          await mongoose.disconnect();
        } catch (error) {
          console.error('❌ API Test Error:', error);
          server.close();
          await mongoose.disconnect();
        }
      }, 1000);
    });

  } catch (error) {
    console.error('Error testing API endpoint:', error);
  }
}

testAPIEndpoint();