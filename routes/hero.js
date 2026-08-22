const express = require('express');
const router = express.Router();
const Hero = require('../models/Hero');
const auth = require('../middleware/auth');

// Get hero data
router.get('/', async (req, res) => {
  try {
    let hero = await Hero.findOne();
    if (!hero) {
      hero = await Hero.create({
        headline: 'Trade What The',
        highlightedText: 'Market Shows.',
        subheadline: 'FXC teaches institutional-grade orderflow, auction market theory, and optionflow — the same tools professional traders use to read real market structure and execute with edge.',
      });
    }
    res.json(hero);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update hero data
router.put('/', auth, async (req, res) => {
  try {
    const { headline, highlightedText, subheadline } = req.body;
    let hero = await Hero.findOne();
    if (!hero) {
      hero = new Hero({ headline, highlightedText, subheadline });
    } else {
      if (headline !== undefined) hero.headline = headline;
      if (highlightedText !== undefined) hero.highlightedText = highlightedText;
      if (subheadline !== undefined) hero.subheadline = subheadline;
      hero.updatedAt = Date.now();
    }
    await hero.save();
    res.json(hero);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
