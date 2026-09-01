const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  event: { type: String, required: true, maxlength: 100 },
  receivedAt: { type: Date, default: Date.now },
}, { timestamps: false });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
