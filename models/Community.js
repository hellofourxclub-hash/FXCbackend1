const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
  title: { type: String, default: 'Join the FXC Trading Community' },
  description: { type: String, default: 'A private, well-moderated trading community for serious traders.' },
  discordLink: { type: String, default: 'https://discord.gg/vrHwGxE3VA' },
  perks: {
    type: [String],
    default: [
      'Weekly live discussions and Q&A',
      'Beginner-friendly environment',
      'Direct access to experienced traders',
      'Network with serious traders',
      'No signals, no spam, no hype',
    ],
  },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Community', communitySchema);
