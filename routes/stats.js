const express = require('express');
const router = express.Router();
const Stats = require('../models/Stats');
const auth = require('../middleware/auth');

// Get stats data
router.get('/', async (req, res) => {
  try {
    let stats = await Stats.findOne();
    if (!stats) {
      stats = await Stats.create({
        activeLearnersValue: 500,
        completionRate: 98,
        avgROI: 14,
        averageRating: '4.9',
      });
    }
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update stats data
router.put('/', auth, async (req, res) => {
  try {
    const { activeLearnersValue, completionRate, avgROI, averageRating } = req.body;
    let stats = await Stats.findOne();
    if (!stats) {
      stats = new Stats({ activeLearnersValue, completionRate, avgROI, averageRating });
    } else {
      if (activeLearnersValue !== undefined) stats.activeLearnersValue = activeLearnersValue;
      if (completionRate !== undefined) stats.completionRate = completionRate;
      if (avgROI !== undefined) stats.avgROI = avgROI;
      if (averageRating !== undefined) stats.averageRating = averageRating;
      stats.updatedAt = Date.now();
    }
    await stats.save();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
