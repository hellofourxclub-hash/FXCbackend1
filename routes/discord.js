const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const Entitlement = require('../models/Entitlement');
const authMiddleware = require('../middleware/auth');
const { syncDiscordRoleForEntitlement } = require('../services/accessSync');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_OAUTH_REDIRECT_URI;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const STATE_SECRET = process.env.DISCORD_OAUTH_STATE_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://fourxclub.in';
const required = { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, GUILD_ID, STATE_SECRET };

const signState = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', STATE_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};

const verifyState = (state) => {
  const [encoded, signature] = String(state || '').split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(encoded).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

const configReady = () => Object.values(required).every(Boolean);

router.get('/oauth/start', async (req, res) => {
  if (!configReady()) return res.status(503).json({ message: 'Discord integration is not configured' });
  const { customerKey } = req.query;
  if (!customerKey || typeof customerKey !== 'string' || !/^[a-f0-9]{64}$/.test(customerKey)) {
    return res.status(400).json({ message: 'Invalid customer key' });
  }
  const entitlement = await Entitlement.findOne({ customerKey, status: 'active' }).lean();
  if (!entitlement) return res.status(404).json({ message: 'Active FXC entitlement not found' });

  const state = signState({
    customerKey,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + 10 * 60 * 1000,
  });
  const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: 'identify', state });
  res.json({ url: `https://discord.com/oauth2/authorize?${params.toString()}` });
});

router.get('/oauth/callback', async (req, res) => {
  if (!configReady()) return res.status(503).send('Discord integration is not configured');
  const { code, state } = req.query;
  const payload = verifyState(state);
  if (!code || typeof code !== 'string' || code.length > 1000 || !payload) {
    return res.status(400).send('Invalid or expired Discord authorization. Please restart the connection flow.');
  }

  try {
    const tokenResponse = await axios.post(`${DISCORD_API}/oauth2/token`, new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) return res.status(502).send('Discord authorization did not return an access token.');
    const userResponse = await axios.get(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 });
    const discordUserId = String(userResponse.data.id);

    const entitlements = await Entitlement.find({ customerKey: payload.customerKey, status: 'active' });
    if (!entitlements.length) return res.status(403).send('No active FXC entitlement was found for this connection.');

    await Entitlement.updateMany({ customerKey: payload.customerKey, status: 'active' }, { $set: { discordUserId } });
    const refreshed = await Entitlement.find({ customerKey: payload.customerKey, status: 'active' });
    const syncResults = [];
    for (const entitlement of refreshed) {
      try {
        syncResults.push(await syncDiscordRoleForEntitlement(entitlement));
      } catch (syncError) {
        console.error('Discord role sync error:', syncError.response?.data || syncError.message);
        syncResults.push({ synced: false, reason: 'role-sync-failed' });
      }
    }

    res.redirect(`${FRONTEND_URL}?discord=connected&roles=${syncResults.filter((r) => r.synced).length}`);
  } catch (error) {
    console.error('Discord OAuth callback error:', error.response?.data || error.message);
    res.status(502).send('Unable to connect Discord right now. Please try again.');
  }
});

router.get('/config', authMiddleware, (_req, res) => {
  res.json({ configured: configReady(), guildId: GUILD_ID });
});

module.exports = router;
