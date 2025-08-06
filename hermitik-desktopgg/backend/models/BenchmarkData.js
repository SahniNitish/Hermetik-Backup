// models/BenchmarkData.js
const mongoose = require('mongoose');

const BenchmarkDataSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  aaveUsdcRate: { type: Number }, // USDC lending rate on Aave v3
  ethPrice: Number,
  btcPrice: Number,
  createdAt: { type: Date, default: Date.now }
});

BenchmarkDataSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('BenchmarkData', BenchmarkDataSchema);