const express = require('express');
const { expireDueEntitlements } = require('../services/entitlements');

const router = express.Router();

const isAuthorized = (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authorization = String(req.headers.authorization || '');
  return authorization === `Bearer ${secret}`;
};

router.get('/entitlements', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const result = await expireDueEntitlements();
    res.json({ success: true, matchedCount: result.matchedCount || 0, modifiedCount: result.modifiedCount || 0 });
  } catch (error) {
    console.error('Entitlement maintenance error:', error.message);
    res.status(500).json({ success: false, message: 'Entitlement maintenance failed' });
  }
});

module.exports = router;
