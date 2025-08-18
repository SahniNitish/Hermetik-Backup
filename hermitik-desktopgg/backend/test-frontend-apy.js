const mongoose = require('mongoose');
const APYCalculationService = require('./services/apyCalculationService');
const PositionHistory = require('./models/PositionHistory');

async function testFrontendAPY() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    const userId = '689e6ebb3be5843c1f7dcfc3';

    // Test the exact flow that the frontend follows
    console.log('🔍 Testing frontend APY flow...');

    // Step 1: Get position history (simulates what the frontend should see)
    const positions = await PositionHistory.find({ 
      userId, 
      isActive: true 
    }).sort({ date: -1 });

    console.log(`📊 Found ${positions.length} active positions for user`);

    // Step 2: Structure like wallet data that frontend expects
    const mockWalletData = [];
    const walletGroups = {};

    // Group by wallet address
    positions.forEach(position => {
      if (!walletGroups[position.walletAddress]) {
        walletGroups[position.walletAddress] = {
          address: position.walletAddress,
          protocols: {}
        };
      }

      if (!walletGroups[position.walletAddress].protocols[position.protocolName]) {
        walletGroups[position.walletAddress].protocols[position.protocolName] = {
          name: position.protocolName,
          chain: 'ethereum',
          net_usd_value: 0,
          positions: []
        };
      }

      const protocol = walletGroups[position.walletAddress].protocols[position.protocolName];
      protocol.positions.push({
        position_name: position.positionName,
        position_id: position.debankPositionId, // This is the key!
        chain: 'ethereum',
        tokens: position.tokens || [],
        rewards: position.rewards || []
      });
      protocol.net_usd_value += position.totalValue;
    });

    // Convert to array format
    Object.values(walletGroups).forEach(wallet => {
      wallet.protocols = Object.values(wallet.protocols);
      mockWalletData.push(wallet);
    });

    console.log('📱 Mock wallet data structure:');
    mockWalletData.forEach(wallet => {
      console.log(`  Wallet: ${wallet.address}`);
      wallet.protocols.forEach(protocol => {
        console.log(`    Protocol: ${protocol.name} (${protocol.positions.length} positions)`);
        protocol.positions.forEach(position => {
          console.log(`      Position: ${position.position_name} (ID: ${position.position_id})`);
        });
      });
    });

    // Step 3: Test APY calculation for each position (simulates frontend APY fetch)
    console.log('\n🧮 Testing APY calculations for each position...');
    
    const allAPYs = await APYCalculationService.calculateAllPositionAPYs(userId);
    console.log(`📈 Calculated APYs for ${Object.keys(allAPYs).length} positions`);

    // Step 4: Show the format that frontend APY display would receive
    const formattedAPYs = {};
    Object.entries(allAPYs).forEach(([positionId, apyData]) => {
      formattedAPYs[positionId] = APYCalculationService.formatAPYForDisplay(apyData);
    });

    console.log('\n📊 Formatted APY data for frontend:');
    Object.entries(formattedAPYs).forEach(([positionId, displayData]) => {
      console.log(`  Position ID: ${positionId}`);
      console.log(`    Raw data structure:`, JSON.stringify(displayData, null, 4));
    });

    // Step 5: Test the position ID matching logic (what frontend does)
    console.log('\n🔗 Testing position ID matching logic...');
    
    mockWalletData.forEach(wallet => {
      wallet.protocols.forEach(protocol => {
        protocol.positions.forEach(position => {
          const generatePositionId = (protocolName, positionName, walletAddress, debankPositionId) => {
            return debankPositionId || `${protocolName}_${positionName}_${walletAddress}`.toLowerCase().replace(/\\s+/g, '_');
          };

          const frontendGeneratedId = generatePositionId(
            protocol.name, 
            position.position_name, 
            wallet.address, 
            position.position_id
          );

          const apyData = formattedAPYs[frontendGeneratedId];
          
          console.log(`    ${protocol.name} > ${position.position_name}:`);
          console.log(`      Backend Position ID: ${position.position_id}`);
          console.log(`      Frontend Generated ID: ${frontendGeneratedId}`);
          console.log(`      APY Found: ${apyData ? 'YES' : 'NO'}`);
          if (apyData && apyData.bestPeriod) {
            console.log(`      APY Value: ${apyData.bestPeriod.apy}% (${apyData.bestPeriod.confidence})`);
          }
        });
      });
    });

    console.log('\n✅ Frontend APY test completed!');
    console.log('\n📋 Summary:');
    console.log(`  - ${positions.length} positions in database`);
    console.log(`  - ${Object.keys(allAPYs).length} APY calculations completed`);
    console.log(`  - ${mockWalletData.length} wallets with protocols`);
    console.log(`  - Position ID matching: ${Object.keys(formattedAPYs).length > 0 ? 'WORKING' : 'BROKEN'}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error testing frontend APY:', error);
    await mongoose.disconnect();
  }
}

testFrontendAPY();