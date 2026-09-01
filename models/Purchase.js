const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  courseName: { type: String, required: true, maxlength: 200 },
  customerName: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 20 },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true, default: 'INR', enum: ['INR'] },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  },
  verifiedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
