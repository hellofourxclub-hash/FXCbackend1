const mongoose = require('mongoose');

const testimonialItemSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  role: { type: String, default: '' },
  text: { type: String, default: '' },
  rating: { type: Number, default: 5 },
}, { _id: false });

const testimonialSchema = new mongoose.Schema({
  introText: {
    type: String,
    default: 'Real results from real traders in the FXC ecosystem.',
  },
  items: {
    type: [testimonialItemSchema],
    default: [],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Testimonials', testimonialSchema);
