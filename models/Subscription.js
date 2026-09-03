const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  razorpaySubscriptionId: { type: String, required: true, unique: true, index: true },
  razorpayCustomerId: { type: String, index: true },
  razorpayPlanId: { type: String, required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  courseName: { type: String, required: true, maxlength: 200 },
  customerName: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 20 },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true, default: 'INR', enum: ['INR'] },
  interval: { type: Number, required: true, min: 1 },
  period: { type: String, required: true, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
  totalCount: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['created', 'authenticated', 'active', 'pending', 'halted', 'paused', 'cancelled', 'completed', 'expired'],
    default: 'created',
    index: true,
  },
  currentStart: Date,
  currentEnd: Date,
  chargeAt: Date,
  endedAt: Date,
  lastPaymentId: { type: String, index: true },
  lastChargedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
