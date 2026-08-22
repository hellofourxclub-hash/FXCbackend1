const mongoose = require('mongoose');

const mentorshipSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Pro Mentorship',
  },
  price: {
    type: String,
    default: '₹14,999',
  },
  description: {
    type: String,
    default: 'For serious traders aiming for consistency through mathematical execution and auction theory.',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Mentorship', mentorshipSchema);
