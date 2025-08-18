const mongoose = require('mongoose');
const PositionHistory = require('./models/PositionHistory');

// Define WalletData schema to match what the frontend expects
const WalletDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    type: String,
    required: true
  },
  balance: Number,
  protocols: [{
    protocol_id: String,
    name: String,
    net_usd_value: Number,
    chain: String,
    positions: [{
      position_name: String,
      position_id: String, // This maps to debankPositionId
      chain: String,
      tokens: [{
        symbol: String,
        amount: Number,
        usd_value: Number
      }],
      rewards: [{
        symbol: String,
        amount: Number,
        usd_value: Number
      }]
    }]
  }]
}, { timestamps: true });

const WalletData = mongoose.model('WalletData', WalletDataSchema);

async function syncWalletFromPositions() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hermetik');
    console.log('✅ Connected to MongoDB');

    // Get all unique combinations of userId and walletAddress from PositionHistory
    const walletCombinations = await PositionHistory.aggregate([
      { $match: { isActive: true } },
      { 
        $group: { 
          _id: { userId: '$userId', walletAddress: '$walletAddress' },
          protocols: { 
            $addToSet: { 
              protocolName: '$protocolName',
              positions: {
                positionName: '$positionName',
                debankPositionId: '$debankPositionId',
                totalValue: '$totalValue',
                tokens: '$tokens',
                rewards: '$rewards'
              }
            }
          }
        }
      }
    ]);

    console.log(`🔍 Found ${walletCombinations.length} wallet combinations to sync`);

    for (const walletCombo of walletCombinations) {
      const { userId, walletAddress } = walletCombo._id;
      
      console.log(`📝 Processing wallet ${walletAddress} for user ${userId}`);

      // Get all positions for this wallet
      const positions = await PositionHistory.find({
        userId,
        walletAddress,
        isActive: true
      }).sort({ date: -1 });

      // Group positions by protocol
      const protocolMap = new Map();
      
      for (const position of positions) {
        if (!protocolMap.has(position.protocolName)) {
          protocolMap.set(position.protocolName, {
            protocol_id: position.protocolName.toLowerCase().replace(/\\s+/g, '_'),
            name: position.protocolName,
            net_usd_value: 0,
            chain: 'ethereum', // Default chain
            positions: []
          });
        }

        const protocol = protocolMap.get(position.protocolName);
        
        // Add position to protocol
        const protocolPosition = {
          position_name: position.positionName,
          position_id: position.debankPositionId, // This is the key mapping!
          chain: 'ethereum',
          tokens: position.tokens || [],
          rewards: position.rewards || []
        };

        protocol.positions.push(protocolPosition);
        protocol.net_usd_value += position.totalValue;
      }

      // Create or update wallet data
      const walletData = {
        userId,
        address: walletAddress,
        balance: 0,
        protocols: Array.from(protocolMap.values())
      };

      await WalletData.findOneAndUpdate(
        { userId, address: walletAddress },
        walletData,
        { upsert: true, new: true }
      );

      console.log(`✅ Synced wallet ${walletAddress} with ${walletData.protocols.length} protocols`);
    }

    console.log('🎉 Wallet sync completed successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error syncing wallets from positions:', error);
    await mongoose.disconnect();
  }
}

syncWalletFromPositions();