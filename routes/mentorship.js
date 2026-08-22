const express = require('express');
const router = express.Router();
const Mentorship = require('../models/Mentorship');
const auth = require('../middleware/auth');

// Get mentorship data
router.get('/', async (req, res) => {
  try {
    let mentorship = await Mentorship.findOne();
    if (!mentorship) {
      mentorship = await Mentorship.create({
        title: 'Pro Mentorship',
        price: '₹14,999',
        description: 'For serious traders aiming for consistency through mathematical execution and auction theory.',
      });
    }
    res.json(mentorship);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update mentorship data
router.put('/', auth, async (req, res) => {
  try {
    const { title, price, description } = req.body;
    let mentorship = await Mentorship.findOne();
    if (!mentorship) {
      mentorship = new Mentorship({ title, price, description });
    } else {
      if (title !== undefined) mentorship.title = title;
      if (price !== undefined) mentorship.price = price;
      if (description !== undefined) mentorship.description = description;
      mentorship.updatedAt = Date.now();
    }
    await mentorship.save();
    res.json(mentorship);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
