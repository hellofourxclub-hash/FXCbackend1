const mongoose = require('mongoose');

const entitlementSchema = new mongoose.Schema({
  customerKey: { type: String, required: true, index: true, maxlength: 128 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  discordUserId: { type: String, trim: true, maxlength: 30, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  type: {
    type: String,
    enum: ['course', 'trading_floor'],
    required: true,
    index: true,
  },
  discordRoleId: { type: String, trim: true, maxlength: 30, default: null },
  driveFolderId: { type: String, trim: true, maxlength: 128, default: null },
  drivePermissionId: { type: String, trim: true, maxlength: 128, default: null },
  startsAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, default: null, index: true },
  source: {
    type: String,
    enum: ['purchase', 'subscription', 'manual'],
    required: true,
  },
  sourceId: { type: String, required: true, maxlength: 150, index: true },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active',
    index: true,
  },
}, { timestamps: true });

entitlementSchema.index({ discordUserId: 1, type: 1, status: 1, expiresAt: 1 });
entitlementSchema.index({ source: 1, sourceId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Entitlement', entitlementSchema);
