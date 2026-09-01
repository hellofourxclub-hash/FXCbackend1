const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0, default: null },
  label: String,
  accent: { type: Boolean, default: false },
  highlights: [String],
  cta: String,
  paymentType: { type: String, default: 'one-time payment' },
  billingEnabled: { type: Boolean, default: false },
  billingPeriod: {
    type: String,
    enum: ['day', 'week', 'month', 'year'],
    default: 'month',
  },
  billingInterval: { type: Number, min: 1, max: 12, default: 1 },
  razorpayPlanId: { type: String, trim: true, maxlength: 100, default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

courseSchema.pre('validate', function(next) {
  if (this.discountPrice != null && this.discountPrice >= this.price) {
    return next(new Error('Discounted price must be lower than the original price.'));
  }
  if (!this.billingEnabled) {
    this.razorpayPlanId = null;
  }
  next();
});

module.exports = mongoose.model('Course', courseSchema);
