const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    let community = await Community.findOne();
    if (!community) {
      community = await Community.create({
        title: 'Join the FXC Trading Community',
        description: 'A private, well-moderated trading community for serious traders.',
        discordLink: 'https://discord.gg/vrHwGxE3VA',
        referralCode: 'REF-V4B5JI',
        perks: [
          'Weekly live discussions and Q&A',
          'Beginner-friendly environment',
          'Direct access to experienced traders',
          'Network with serious traders',
          'No signals, no spam, no hype',
        ],
      });
    }
    res.json(community);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const { title, description, discordLink, perks } = req.body;
    let community = await Community.findOne();
    if (!community) {
      community = new Community({ title, description, discordLink, perks });
    } else {
      if (title !== undefined) community.title = title;
      if (description !== undefined) community.description = description;
      if (discordLink !== undefined) community.discordLink = discordLink;
      if (perks !== undefined) community.perks = perks;
      community.updatedAt = Date.now();
    }
    await community.save();
    res.json(community);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
