const express = require('express');
const Banner = require('../models/Banner');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let banner = await Banner.findOne();
    if (!banner) {
      banner = new Banner();
      await banner.save();
    }
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    const { text, ctaText, ctaLink, message, isActive } = req.body;
    let banner = await Banner.findOne();
    if (!banner) banner = new Banner();
    if (text !== undefined) banner.text = text;
    if (ctaText !== undefined) banner.ctaText = ctaText;
    if (ctaLink !== undefined) banner.ctaLink = ctaLink;
    if (message !== undefined) banner.message = message;
    if (isActive !== undefined) banner.isActive = isActive;
    banner.updatedAt = Date.now();
    await banner.save();
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
