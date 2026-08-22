const express = require('express');
const Footer = require('../models/Footer');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let footer = await Footer.findOne();
    if (!footer) {
      footer = new Footer();
      await footer.save();
    }
    res.json(footer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const { companyName, tagline, email, socials, copyrightText, disclaimerText } = req.body;
    let footer = await Footer.findOne();
    if (!footer) footer = new Footer();
    if (companyName !== undefined) footer.companyName = companyName;
    if (tagline !== undefined) footer.tagline = tagline;
    if (email !== undefined) footer.email = email;
    if (socials !== undefined) footer.socials = socials;
    if (copyrightText !== undefined) footer.copyrightText = copyrightText;
    if (disclaimerText !== undefined) footer.disclaimerText = disclaimerText;
    footer.updatedAt = Date.now();
    await footer.save();
    res.json(footer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
