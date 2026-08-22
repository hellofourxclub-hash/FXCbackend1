const mongoose = require('mongoose');

const socialSchema = new mongoose.Schema({
  platform: { type: String, default: '' },
  url: { type: String, default: '' },
}, { _id: false });

const footerSchema = new mongoose.Schema({
  companyName: { type: String, default: 'FXC' },
  tagline: { type: String, default: 'Live trading • Real discussions • No signals • No hype' },
  email: { type: String, default: 'contact@fxc.com' },
  socials: {
    type: [socialSchema],
    default: [
      { platform: 'Instagram', url: '#' },
      { platform: 'Discord', url: 'https://discord.gg/vrHwGxE3VA' },
      { platform: 'X', url: '#' },
      { platform: 'YouTube', url: '#' },
    ],
  },
  copyrightText: { type: String, default: '© 2026 FXC. All rights reserved.' },
  disclaimerText: {
    type: String,
    default: 'Trading futures, currency & options involves substantial risk of loss. Only risk capital you can afford to lose.',
  },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Footer', footerSchema);
