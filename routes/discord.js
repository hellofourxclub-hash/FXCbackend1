const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const DISCORD_API = 'https://discord.com/api/v10';
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const getDiscordBotToken = () => process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_VERIFICATION_BOT_TOKEN;

const requireAdmin = (req, res, next) => req.admin?.role === 'admin'
  ? next()
  : res.status(403).json({ message: 'Admin access required' });

// GET /api/discord/roles
// Returns existing, manageable guild roles for the admin course editor.
router.get('/roles', authMiddleware, requireAdmin, async (_req, res) => {
  const botToken = getDiscordBotToken();
  if (!GUILD_ID || !botToken) {
    return res.status(503).json({ message: 'Discord bot is not configured on the backend' });
  }

  try {
    const headers = { Authorization: `Bot ${botToken}` };
    const [rolesResponse, botUserResponse] = await Promise.all([
      axios.get(`${DISCORD_API}/guilds/${encodeURIComponent(GUILD_ID)}/roles`, { headers, timeout: 10000 }),
      axios.get(`${DISCORD_API}/users/@me`, { headers, timeout: 10000 }),
    ]);

    const botUserId = String(botUserResponse.data?.id || '');
    let botTopPosition = Infinity;

    if (/^\d{1,30}$/.test(botUserId)) {
      const memberResponse = await axios.get(
        `${DISCORD_API}/guilds/${encodeURIComponent(GUILD_ID)}/members/${encodeURIComponent(botUserId)}`,
        { headers, timeout: 10000 }
      );
      const roleIds = new Set(
        Array.isArray(memberResponse.data?.roles)
          ? memberResponse.data.roles.map(String)
          : []
      );
      const guildRoles = Array.isArray(rolesResponse.data) ? rolesResponse.data : [];
      const botRoles = guildRoles.filter((role) => roleIds.has(String(role.id)));
      botTopPosition = botRoles.reduce(
        (max, role) => Math.max(max, Number(role.position || 0)),
        -Infinity
      );
    }

    const roles = (Array.isArray(rolesResponse.data) ? rolesResponse.data : [])
      .filter((role) =>
        !role.managed &&
        role.id !== GUILD_ID &&
        Number(role.position || 0) < botTopPosition
      )
      .sort((a, b) => Number(b.position || 0) - Number(a.position || 0))
      .map((role) => ({
        id: String(role.id),
        name: String(role.name),
        position: Number(role.position || 0),
        color: Number(role.color || 0),
      }));

    return res.json({ roles });
  } catch (error) {
    const status = Number(error.response?.status || 0);
    const discordMessage = error.response?.data?.message;
    console.error('Discord role list error:', {
      status,
      message: discordMessage || error.message,
    });

    if (status === 401) {
      return res.status(502).json({ message: 'Discord bot token is invalid or expired' });
    }
    if (status === 403) {
      return res.status(502).json({ message: 'Discord bot cannot access this server or its roles' });
    }
    if (status === 404) {
      return res.status(502).json({ message: 'Discord bot is not a member of the configured server' });
    }

    return res.status(502).json({ message: 'Unable to load Discord roles' });
  }
});

module.exports = router;
