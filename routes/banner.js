const express = require('express');
const crypto = require('crypto');
const Banner = require('../models/Banner');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const normalizeAnnouncement = (item, index) => ({
  id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 100) : crypto.randomUUID(),
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

const normalizeLink = (value) => {
  const link = String(value || '').trim();
  if (!link) return '';
  if (/^(javascript|data|vbscript):/i.test(link)) return '';
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(link)) return link.slice(0, 500);
  return '';
};

router.get('/', async (_req, res) => {
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

    response.announcements = response.announcements
      .map((item, index) => normalizeAnnouncement(item, index))
      .sort((a, b) => a.order - b.order);
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

    if (Array.isArray(announcements)) {
      if (announcements.length > 50) return res.status(400).json({ message: 'Maximum 50 announcements allowed' });
      const normalized = announcements
        .map(normalizeAnnouncement)
        .map(item => ({ ...item, ctaLink: normalizeLink(item.ctaLink) }))
        .filter(item => item.text || item.ctaText || item.ctaLink || item.message)
        .map((item, index) => ({ ...item, order: index }));

      const seen = new Set();
      normalized.forEach((item) => {
        if (seen.has(item.id)) item.id = crypto.randomUUID();
        seen.add(item.id);
      });
      banner.announcements = normalized;

      const first = normalized[0];
      if (first) {
        banner.text = first.text;
        banner.ctaText = first.ctaText;
        banner.ctaLink = first.ctaLink;
        banner.message = first.message;
        banner.isActive = first.isActive;
      }
    } else {
      if (text !== undefined) banner.text = String(text).slice(0, 160);
      if (ctaText !== undefined) banner.ctaText = String(ctaText).slice(0, 60);
      if (ctaLink !== undefined) banner.ctaLink = normalizeLink(ctaLink);
      if (message !== undefined) banner.message = String(message).slice(0, 180);
      if (isActive !== undefined) banner.isActive = Boolean(isActive);
    }

    banner.updatedAt = Date.now();
    await banner.save();

    const response = banner.toObject();
    if (!Array.isArray(response.announcements) || response.announcements.length === 0) {
      response.announcements = getLegacyAnnouncements(response);
    }
    response.announcements = response.announcements.map((item, index) => normalizeAnnouncement(item, index)).sort((a, b) => a.order - b.order);
    res.json(response);
  } catch (error) {
    console.error('Banner PUT error:', error.message);
    res.status(500).json({ message: 'Failed to save announcement bar' });
  }
});

module.exports = router;
