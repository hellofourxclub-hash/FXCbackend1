const mongoose = require('mongoose');

const heroSchema = new mongoose.Schema({
  headline: {
    type: String,
    default: 'Trade What The',
  },
  highlightedText: {
    type: String,
    default: 'Market Shows.',
  },
  subheadline: {
    type: String,
    default: 'FXC teaches institutional-grade orderflow, auction market theory, and optionflow — the same tools professional traders use to read real market structure and execute with edge.',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Hero', heroSchema);
