const express = require('express');
const router = express.Router();
const Testimonials = require('../models/Testimonials');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    let testimonials = await Testimonials.findOne();
    if (!testimonials) {
      testimonials = await Testimonials.create({
        introText: 'Real results from real traders in the FXC ecosystem.',
        items: [],
      });
    }
    res.json(testimonials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const { introText, items } = req.body;
    let testimonials = await Testimonials.findOne();
    if (!testimonials) {
      testimonials = new Testimonials({ introText, items });
    } else {
      if (introText !== undefined) testimonials.introText = introText;
      if (items !== undefined) testimonials.items = items;
      testimonials.updatedAt = Date.now();
    }
    await testimonials.save();
    res.json(testimonials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
