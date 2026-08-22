const express = require('express');
const Curriculum = require('../models/Curriculum');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const defaultModules = [
  {
    number: '01',
    title: 'Auction Market Theory — How Price Really Moves',
    duration: '7 lessons',
    topics: [
      'The auction process: why markets move up and down to find accepted value',
      'Value Area (VA), Point of Control (POC) — where institutions have done the most business',
      'Single prints, poor highs/lows, and what they mean for future price revisits',
      'Balance vs. imbalance days — how to identify when the market is in range vs. trending',
      'Initial Balance (IB) and the 3 types of range extension',
      'Profile shapes: P-profile, b-profile, D-profile and what each signals',
      'Composite profiles — reading multi-day and multi-week structure for higher timeframe bias',
    ],
  },
  {
    number: '02',
    title: 'Volume Profile — Reading Where the Money Is',
    duration: '6 lessons',
    topics: [
      'Fixed Range vs. Session vs. Visible Range profiles — when to use each',
      'High Volume Nodes (HVN) as support/resistance — price slows here, not bounces',
      'Low Volume Nodes (LVN) as fast-move zones — price accelerates through these',
      'Volume gaps: identifying areas with no prior business that price will revisit',
      'Developing vs. developed profiles — how to read an unfinished auction',
      'Aligning volume profile levels with orderflow for high-probability entries',
    ],
  },
  {
    number: '03',
    title: 'Orderflow — Reading the Tape in Real Time',
    duration: '9 lessons',
    topics: [
      'Market orders vs. limit orders — who is aggressive and who is passive',
      'Bid/ask footprint: reading actual buying and selling at every price level',
      'Delta: the difference between buying and selling pressure at each candle',
      'Cumulative Delta (CVD) divergence — price makes new high but CVD doesn\'t (hidden weakness)',
      'Volume imbalances in the footprint: 3x rule for identifying absorption',
      'Stacked imbalances — multiple consecutive imbalances signaling directional intent',
      'Absorption: large limit orders absorbing aggressive flow — the real reversal signal',
      'Iceberg orders: detecting hidden institutional size at key levels',
      'Building a live orderflow read: combining delta, footprint, and CVD into one decision',
    ],
  },
  {
    number: '04',
    title: 'Optionflow & Gamma — The Invisible Hand',
    duration: '7 lessons',
    topics: [
      'How market makers delta-hedge options — why this creates predictable spot price movement',
      'Gamma exposure (GEX): positive gamma zones where MM buying dips/selling rips (range)',
      'Negative gamma zones: MM amplifies moves — trending, volatile conditions',
      'Key gamma strike levels: the price levels where the most options OI sits',
      'Put/Call ratio and what extreme readings signal about institutional positioning',
      'Unusual options activity (UOA): identifying large directional bets before they move spot',
      'Combining GEX levels with volume profile POC for high-confluence trade setups',
    ],
  },
  {
    number: '05',
    title: 'Trade Execution — Entry, Stop & Target Logic',
    duration: '6 lessons',
    topics: [
      'The 3-step confirmation model: structure + orderflow + trigger',
      'Entry at value: fading into HVN/POC with orderflow confirmation, not blindly',
      'Entry on breakout: waiting for retest of LVN with delta confirmation before entering',
      'Stop placement: always behind a structural level (VAH/VAL/POC), never arbitrary pips',
      'Target logic: first target at opposing HVN, second at profile edge, third at prior session extreme',
      'Scaling out vs. full exit — when to hold and when orderflow tells you to get out',
    ],
  },
  {
    number: '06',
    title: 'Risk, Prop Firms & Consistent Execution',
    duration: '5 lessons',
    topics: [
      'Position sizing for prop firm challenges: max daily loss math and how to stay within rules',
      'The consistency rule: why one big win followed by losses fails prop firm evaluations',
      'Pre-market preparation: building your levels, bias, and scenarios before the open',
      'Trade journaling with orderflow context — what to log beyond just entry/exit',
      'Post-session review: identifying if you followed process or traded on emotion',
    ],
  },
];

// GET — return curriculum
router.get('/', async (req, res) => {
  try {
    let curriculum = await Curriculum.findOne();
    if (!curriculum) {
      curriculum = await Curriculum.create({ modules: defaultModules });
    }
    res.json(curriculum);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT — update curriculum (protected)
router.put('/', authMiddleware, async (req, res) => {
  try {
    const { modules } = req.body;
    let curriculum = await Curriculum.findOne();
    if (!curriculum) {
      curriculum = new Curriculum({ modules: modules || defaultModules });
    } else {
      if (modules !== undefined) curriculum.modules = modules;
      curriculum.updatedAt = Date.now();
    }
    await curriculum.save();
    res.json({ message: 'Curriculum updated', curriculum });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
