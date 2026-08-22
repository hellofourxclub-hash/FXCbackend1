const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
  activeLearnersValue: {
    type: Number,
    default: 500,
  },
  completionRate: {
    type: Number,
    default: 98,
  },
  avgROI: {
    type: Number,
    default: 14,
  },
  averageRating: {
    type: String,
    default: '4.9',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Stats', statsSchema);
