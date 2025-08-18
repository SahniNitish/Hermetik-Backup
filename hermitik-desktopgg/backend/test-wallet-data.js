const express = require('express');
const mongoose = require('mongoose');
const walletRoutes = require('./routes/wallet');

async function testWalletData() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    // Create a mock Express app
    const app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use('/wallet', (req, res, next) => {
      // Set the test user ID
      req.user = { id: '689e6ebb3be5843c1f7dcfc3' };
      next();
    });

    // Use the wallet routes
    app.use('/wallet', walletRoutes);

    // Start the server
    const server = app.listen(3002, () => {
      console.log('Test server running on port 3002');
      
      // Test the wallet API endpoint
      setTimeout(async () => {
        try {
          console.log('🔍 Testing wallet API endpoint...');
          const response = await fetch('http://localhost:3002/wallet/wallets', {
            headers: {
              'Authorization': 'Bearer dummy-token'
            }
          });
          
          console.log('Response status:', response.status);
          console.log('Response headers:', [...response.headers.entries()]);
          
          const text = await response.text();
          console.log('Raw response:', text.substring(0, 500));
          
          let data;
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            console.log('❌ JSON parse error:', parseError.message);
            server.close();
            await mongoose.disconnect();
            return;
          }
          
          console.log('✅ Wallet API Response Structure:');
          if (data && data.length > 0) {
            const firstWallet = data[0];
            console.log('First wallet:', {
              address: firstWallet.address,
              protocolCount: firstWallet.protocols?.length || 0
            });
            
            if (firstWallet.protocols && firstWallet.protocols.length > 0) {
              const firstProtocol = firstWallet.protocols[0];
              console.log('First protocol:', {
                name: firstProtocol.name,
                chain: firstProtocol.chain,
                positionCount: firstProtocol.positions?.length || 0
              });
              
              if (firstProtocol.positions && firstProtocol.positions.length > 0) {
                const firstPosition = firstProtocol.positions[0];
                console.log('First position structure:', {
                  position_name: firstPosition.position_name,
                  position_id: firstPosition.position_id, // <-- This is the key field
                  chain: firstPosition.chain,
                  hasTokens: !!firstPosition.tokens,
                  hasRewards: !!firstPosition.rewards,
                  tokenCount: firstPosition.tokens?.length || 0,
                  rewardCount: firstPosition.rewards?.length || 0
                });
              }
            }
          }
          
          server.close();
          await mongoose.disconnect();
        } catch (error) {
          console.error('❌ Wallet API Test Error:', error);
          server.close();
          await mongoose.disconnect();
        }
      }, 1000);
    });

  } catch (error) {
    console.error('Error testing wallet data:', error);
  }
}

testWalletData();