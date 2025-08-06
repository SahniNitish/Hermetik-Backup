const mongoose = require('mongoose');

const PositionDataSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  walletAddress: String,
  protocol: String,
  chain: String,
  positionName: String,
  positionType: String,
  tokens: [{
    symbol: String,
    amount: Number
  }],
  fetchedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PositionData', PositionDataSchema);
