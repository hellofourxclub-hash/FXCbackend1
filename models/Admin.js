const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  secretKey: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  description: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

adminSchema.pre('save', async function() {
  if (!this.isModified('secretKey')) return;
  this.secretKey = await bcrypt.hash(this.secretKey, 10);
});

adminSchema.methods.compareKey = async function(secretKey) {
  return await bcrypt.compare(secretKey, this.secretKey);
};

module.exports = mongoose.model('Admin', adminSchema);
