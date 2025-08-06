const mongoose = require('mongoose');

const NAVSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  feeSettings: {
    annualExpense: {
      type: Number,
      default: 600
    },
    monthlyExpense: {
      type: Number,
      default: 50
    },
    performanceFeeRate: {
      type: Number,
      default: 0.25
    },
    accruedPerformanceFeeRate: {
      type: Number,
      default: 0.25
    },
    hurdleRate: {
      type: Number,
      default: 0
    },
    highWaterMark: {
      type: Number,
      default: 0
    }
  },
  navCalculations: {
    investments: {
      type: Number,
      default: 0
    },
    dividendsReceivable: {
      type: Number,
      default: 0
    },
    totalAssets: {
      type: Number,
      default: 0
    },
    accruedExpenses: {
      type: Number,
      default: 0
    },
    totalLiabilities: {
      type: Number,
      default: 0
    },
    preFeeNav: {
      type: Number,
      default: 0
    },
    performance: {
      type: Number,
      default: 0
    },
    performanceFee: {
      type: Number,
      default: 0
    },
    accruedPerformanceFees: {
      type: Number,
      default: 0
    },
    netAssets: {
      type: Number,
      default: 0
    },
    netFlows: {
      type: Number,
      default: 0
    }
  },
  portfolioData: {
    totalTokensValue: {
      type: Number,
      default: 0
    },
    totalPositionsValue: {
      type: Number,
      default: 0
    },
    totalRewards: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for unique user/month/year combination
NAVSettingsSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

// Update the updatedAt field on save
NAVSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for month name
NAVSettingsSchema.virtual('monthName').get(function() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[this.month - 1];
});

// Method to get prior month's NAV
NAVSettingsSchema.methods.getPriorMonthNav = async function() {
  const priorMonth = this.month === 1 ? 12 : this.month - 1;
  const priorYear = this.month === 1 ? this.year - 1 : this.year;
  
  const priorSettings = await this.constructor.findOne({
    userId: this.userId,
    year: priorYear,
    month: priorMonth
  });
  
  return priorSettings ? priorSettings.navCalculations.preFeeNav : 0;
};

// Static method to get available months for a user
NAVSettingsSchema.statics.getAvailableMonths = async function(userId) {
  const settings = await this.find({ userId })
    .select('year month createdAt')
    .sort({ year: -1, month: -1 })
    .lean();
  
  return settings.map(setting => ({
    year: setting.year,
    month: setting.month,
    monthName: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ][setting.month - 1],
    createdAt: setting.createdAt
  }));
};

module.exports = mongoose.model('NAVSettings', NAVSettingsSchema);