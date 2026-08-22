const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  tag: { type: String, default: '' },
  title: { type: String, default: '' },
  body: { type: String, default: '' },
}, { _id: false });

const ecosystemSchema = new mongoose.Schema({
  title: { type: String, default: 'Not Another Trading Course' },
  subtitle: {
    type: String,
    default: 'Most courses teach patterns and indicators. We teach you to read the actual mechanics of price — the way institutions do.',
  },
  cards: {
    type: [cardSchema],
    default: [
      {
        tag: 'Core Method',
        title: 'Orderflow + Auction Theory',
        body: 'You learn to read the actual buying and selling happening at every price — footprint charts, delta, cumulative volume — not lagging indicators. Combined with Auction Market Theory, you understand why price is at a level, not just that it is.',
      },
      {
        tag: 'Structure',
        title: 'Skill-First, No Shortcuts',
        body: 'No signals. No copy-trading. Every concept is taught with the logic behind it so you can apply it independently in any market condition.',
      },
      {
        tag: 'Community',
        title: 'Live Trading Floor',
        body: 'Learn while markets are open. Watch real orderflow being read in real time, ask questions, and build the habit of process-driven execution.',
      },
      {
        tag: 'Outcome',
        title: 'Built for Prop Firm Traders',
        body: 'The entire framework — entries, stops, sizing, consistency — is designed around passing prop firm evaluations and trading funded accounts with discipline.',
      },
    ],
  },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Ecosystem', ecosystemSchema);
