const express = require('express');
const Banner = require('../models/Banner');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const normalizeAnnouncement = (item, index) => ({
  id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : `announcement-${index + 1}`,
  text: typeof item?.text === 'string' ? item.text.trim().slice(0, 160) : '',
  ctaText: typeof item?.ctaText === 'string' ? item.ctaText.trim().slice(0, 60) : '',
  ctaLink: typeof item?.ctaLink === 'string' ? item.ctaLink.trim().slice(0, 500) : '',
  message: typeof item?.message === 'string' ? item.message.trim().slice(0, 180) : '',
  isActive: item?.isActive !== false,
  order: Number.isFinite(Number(item?.order)) ? Math.max(0, Number(item.order)) : index,
});

const getLegacyAnnouncements = (banner) => [{
  id: 'legacy-announcement',
  text: banner.text || '',
  ctaText: banner.ctaText || '',
  ctaLink: banner.ctaLink || '',
  message: banner.message || '',
  isActive: banner.isActive !== false,
  order: 0,
}];

router.get('/', async (req, res) => {
  try {
    let banner = await Banner.findOne();
    if (!banner) {
      banner = new Banner();
      await banner.save();
    }

    const response = banner.toObject();
    if (!Array.isArray(response.announcements) || response.announcements.length === 0) {
      response.announcements = getLegacyAnnouncements(response);
    }

    response.announcements.sort((a, b) => a.order - b.order);
    res.json(response);
  } catch (error) {
    console.error('Banner GET error:', error.message);
    res.status(500).json({ message: 'Failed to load announcement bar' });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    const { announcements, text, ctaText, ctaLink, message, isActive } = req.body || {};
    let banner = await Banner.findOne();
    if (!banner) banner = new Banner();

    // New announcement-manager payload.
    if (Array.isArray(announcements)) {
      if (announcements.length > 50) {
        return res.status(400).json({ message: 'Maximum 50 announcements allowed' });
      }
      const normalized = announcements
        .map(normalizeAnnouncement)
        .filter(item => item.text || item.ctaText || item.ctaLink || item.message)
        .map((item, index) => ({ ...item, order: index }));

      // Ensure IDs remain unique so updates/removals are deterministic.
      const seen = new Set();
      for (const item of normalized) {
        if (seen.has(item.id)) item.id = `${item.id}-${Math.random().toString(36).slice(2, 8)}`;
        seen.add(item.id);
      }
      banner.announcements = normalized;

      // Keep legacy fields synchronized with the first entry for older clients.
      const first = normalized[0];
      if (first) {
        banner.text = first.text;
        banner.ctaText = first.ctaText;
        banner.ctaLink = first.ctaLink;
        banner.message = first.message;
      }
    } else {
      // Backward-compatible single-announcement update.
      if (text !== undefined) banner.text = text;
      if (ctaText !== undefined) banner.ctaText = ctaText;
      if (ctaLink !== undefined) banner.ctaLink = ctaLink;
      if (message !== undefined) banner.message = message;
    }

    if (isActive !== undefined) {
      banner.isActive = Boolean(isActive);
    }

    banner.updatedAt = Date.now();
    await banner.save();

    const response = banner.toObject();
    if (!Array.isArray(response.announcements) || response.announcements.length === 0) {
      response.announcements = getLegacyAnnouncements(response);
    }
    response.announcements.sort((a, b) => a.order - b.order);

    res.json(response);
  } catch (error) {
    console.error('Banner PUT error:', error.message);
    res.status(500).json({ message: 'Failed to save announcement bar' });
  }
});

module.exports = router;
