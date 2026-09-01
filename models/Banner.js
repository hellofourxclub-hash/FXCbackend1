const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    default: '',
    trim: true,
    maxlength: 160,
  },
  ctaText: {
    type: String,
    default: '',
    trim: true,
    maxlength: 60,
  },
  ctaLink: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500,
  },
  message: {
    type: String,
    default: '',
    trim: true,
    maxlength: 180,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  order: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { _id: false });

const bannerSchema = new mongoose.Schema({
  // Kept for backward compatibility with the existing single-announcement data.
  text: { type: String, default: 'Limited Seats Available' },
  ctaText: { type: String, default: 'Enroll Now' },
  ctaLink: { type: String, default: '#pricing' },
  message: { type: String, default: 'Only a few spots left this batch' },
  isActive: { type: Boolean, default: true },

  // New dynamic announcement manager.
  announcements: {
    type: [announcementSchema],
    default: undefined,
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Banner', bannerSchema);
