const express = require('express');
const router = express.Router();
const Ecosystem = require('../models/Ecosystem');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    let ecosystem = await Ecosystem.findOne();
    if (!ecosystem) {
      ecosystem = await Ecosystem.create({});
    }
    res.json(ecosystem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const { title, subtitle, cards } = req.body;
    let ecosystem = await Ecosystem.findOne();
    if (!ecosystem) {
      ecosystem = new Ecosystem({ title, subtitle, cards });
    } else {
      if (title !== undefined) ecosystem.title = title;
      if (subtitle !== undefined) ecosystem.subtitle = subtitle;
      if (cards !== undefined) ecosystem.cards = cards;
      ecosystem.updatedAt = Date.now();
    }
    await ecosystem.save();
    res.json(ecosystem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
