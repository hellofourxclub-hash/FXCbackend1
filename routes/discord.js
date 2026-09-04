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
const getDiscordBotToken = () => process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_VERIFICATION_BOT_TOKEN;
const required = { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, GUILD_ID, STATE_SECRET };

const isValidCustomerKey = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const requireAdmin = (req, res, next) => req.admin?.role === 'admin'
  ? next()
  : res.status(403).json({ message: 'Admin access required' });

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
    if (!payload.exp || payload.exp < Date.now() || !isValidCustomerKey(payload.customerKey)) return null;
    return payload;
  } catch {
    return null;
  }
};

const configReady = () => Object.values(required).every(Boolean);

router.get('/oauth/start', async (req, res) => {
  if (!configReady()) return res.status(503).json({ message: 'Discord integration is not configured' });
  const { customerKey } = req.query;
  if (!isValidCustomerKey(customerKey)) return res.status(400).json({ message: 'Invalid customer key' });

  const entitlement = await Entitlement.findOne({
    customerKey,
    status: 'active',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).lean();
  if (!entitlement) return res.status(404).json({ message: 'Active FXC entitlement not found' });

  const state = signState({ customerKey, nonce: crypto.randomBytes(16).toString('hex'), exp: Date.now() + 10 * 60 * 1000 });
  const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: 'identify', state });
  res.json({ url: `https://discord.com/oauth2/authorize?${params.toString()}` });
});

router.get('/oauth/callback', async (req, res) => {
  if (!configReady()) return res.status(503).send('Discord integration is not configured');
  const { code, state } = req.query;
  const payload = verifyState(state);
  if (!code || typeof code !== 'string' || code.length > 1000 || !payload) return res.status(400).send('Invalid or expired Discord authorization. Please restart the connection flow.');

  try {
    const tokenResponse = await axios.post(`${DISCORD_API}/oauth2/token`, new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) return res.status(502).send('Discord authorization did not return an access token.');

    const userResponse = await axios.get(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 });
    const discordUserId = String(userResponse.data.id || '');
    if (!/^\d{1,30}$/.test(discordUserId)) return res.status(502).send('Discord returned an invalid account identifier.');

    const now = new Date();
    const entitlements = await Entitlement.find({ customerKey: payload.customerKey, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] });
    if (!entitlements.length) return res.status(403).send('No active FXC entitlement was found for this connection.');

    const conflictingLink = await Entitlement.exists({
      discordUserId, status: 'active', customerKey: { $ne: payload.customerKey },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
    if (conflictingLink) return res.status(409).send('This Discord account is already connected to another active FXC access session.');

    const existingDifferentLink = entitlements.find((entitlement) => entitlement.discordUserId && entitlement.discordUserId !== discordUserId);
    if (existingDifferentLink) return res.status(409).send('Your FXC access is already connected to a different Discord account.');

    await Entitlement.updateMany(
      { customerKey: payload.customerKey, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $set: { discordUserId } }
    );

    const refreshed = await Entitlement.find({ customerKey: payload.customerKey, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] });
    const syncResults = [];
    for (const entitlement of refreshed) {
      try { syncResults.push(await syncDiscordRoleForEntitlement(entitlement)); }
      catch (syncError) {
        console.error('Discord role sync error:', syncError.response?.data || syncError.message);
        syncResults.push({ synced: false, reason: 'role-sync-failed' });
      }
    }

    const redirect = new URL('/access', FRONTEND_URL);
    redirect.searchParams.set('discord', 'connected');
    redirect.searchParams.set('roles', String(syncResults.filter((r) => r.synced).length));
    res.redirect(redirect.toString());
  } catch (error) {
    console.error('Discord OAuth callback error:', error.response?.data || error.message);
    res.status(502).send('Unable to connect Discord right now. Please try again.');
  }
});

router.get('/config', authMiddleware, requireAdmin, (_req, res) => {
  const botToken = getDiscordBotToken();
  res.json({ configured: configReady(), guildId: GUILD_ID, botConfigured: Boolean(botToken) });
});

router.get('/roles', authMiddleware, requireAdmin, async (_req, res) => {
  const botToken = getDiscordBotToken();
  if (!GUILD_ID || !botToken) return res.status(503).json({ message: 'Discord bot is not configured on the backend' });
  try {
    const headers = { Authorization: `Bot ${botToken}` };
    const [rolesResponse, botUserResponse] = await Promise.all([
      axios.get(`${DISCORD_API}/guilds/${encodeURIComponent(GUILD_ID)}/roles`, { headers, timeout: 10000 }),
      axios.get(`${DISCORD_API}/users/@me`, { headers, timeout: 10000 }),
    ]);
    const botUserId = String(botUserResponse.data?.id || '');
    let botTopPosition = Infinity;
    if (/^\d{1,30}$/.test(botUserId)) {
      const memberResponse = await axios.get(`${DISCORD_API}/guilds/${encodeURIComponent(GUILD_ID)}/members/${encodeURIComponent(botUserId)}`, { headers, timeout: 10000 });
      const roleIds = new Set(Array.isArray(memberResponse.data?.roles) ? memberResponse.data.roles.map(String) : []);
      const guildRoles = Array.isArray(rolesResponse.data) ? rolesResponse.data : [];
      const botRoles = guildRoles.filter((role) => roleIds.has(String(role.id)));
      botTopPosition = botRoles.reduce((max, role) => Math.max(max, Number(role.position || 0)), -Infinity);
    }
    const roles = (Array.isArray(rolesResponse.data) ? rolesResponse.data : [])
      .filter((role) => !role.managed && role.id !== GUILD_ID && Number(role.position || 0) < botTopPosition)
      .sort((a, b) => Number(b.position) - Number(a.position))
      .map((role) => ({ id: String(role.id), name: String(role.name), position: Number(role.position || 0), color: Number(role.color || 0) }));
    res.json({ roles });
  } catch (error) {
    const status = Number(error.response?.status || 0);
    const discordMessage = error.response?.data?.message;
    console.error('Discord role list error:', { status, message: discordMessage || error.message });
    if (status === 401) return res.status(502).json({ message: 'Discord bot token is invalid or expired' });
    if (status === 403) return res.status(502).json({ message: 'Discord bot cannot access this server or its roles' });
    if (status === 404) return res.status(502).json({ message: 'Discord bot is not a member of the configured server' });
    res.status(502).json({ message: 'Unable to load Discord roles' });
  }
});

module.exports = router;
