const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  text: { type: String, default: 'Limited Seats Available' },
  ctaText: { type: String, default: 'Enroll Now' },
  ctaLink: { type: String, default: '#pricing' },
  message: { type: String, default: 'Only a few spots left this batch' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Banner', bannerSchema);
