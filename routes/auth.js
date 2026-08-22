const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const router = express.Router();

const signToken = () =>
  jwt.sign({ role: 'admin', type: 'owner' }, process.env.JWT_SECRET, { expiresIn: '30d' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { secretKey } = req.body;

    if (!secretKey || typeof secretKey !== 'string' || !secretKey.trim()) {
      return res.status(400).json({ message: 'Secret key is required.' });
    }

    const key = secretKey.trim();

    // 1. Check env var first (fastest path, no DB needed)
    if (process.env.ADMIN_SECRET_KEY && key === process.env.ADMIN_SECRET_KEY) {
      return res.json({ token: signToken(), message: 'Login successful' });
    }

    // 2. Check DB (bcrypt hashed keys)
    const admins = await Admin.find({ isActive: true }).lean(false);
    for (const admin of admins) {
      const isValid = await admin.compareKey(key);
      if (isValid) {
        return res.json({ token: signToken(), message: 'Login successful' });
      }
    }

    // 3. No match
    return res.status(401).json({ message: 'Invalid secret key.' });

  } catch (err) {
    const isConnErr = /timeout|ECONNREFUSED|ENOTFOUND|buffering/i.test(err.message || '');
    return res.status(isConnErr ? 503 : 500).json({
      message: isConnErr
        ? 'Service temporarily unavailable. Please try again.'
        : 'Login failed. Please try again.',
    });
  }
});

// GET /api/auth/verify
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ valid: false });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, role: decoded.role });
  } catch {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;
