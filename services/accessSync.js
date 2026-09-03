const axios = require('axios');
const Entitlement = require('../models/Entitlement');
const { grantViewerAccess, revokeAccess } = require('./googleDrive');

const DISCORD_API = 'https://discord.com/api/v10';

const getDiscordBotToken = () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('Discord bot is not configured');
  return token;
};

const discordHeaders = () => ({
  Authorization: `Bot ${getDiscordBotToken()}`,
  'Content-Type': 'application/json',
});

async function addDiscordRole(discordUserId, roleId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !discordUserId || !roleId) return false;
  await axios.put(`${DISCORD_API}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}/roles/${encodeURIComponent(roleId)}`, null, {
    headers: discordHeaders(),
    timeout: 10000,
  });
  return true;
}

async function removeDiscordRole(discordUserId, roleId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || !discordUserId || !roleId) return false;
  try {
    await axios.delete(`${DISCORD_API}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordUserId)}/roles/${encodeURIComponent(roleId)}`, {
      headers: discordHeaders(),
      timeout: 10000,
    });
    return true;
  } catch (error) {
    if (error?.response?.status === 404) return false;
    throw error;
  }
}

async function syncDiscordRoleForEntitlement(entitlement) {
  if (!entitlement?.discordUserId || !entitlement?.discordRoleId) return { synced: false, reason: 'discord-not-linked' };
  if (entitlement.status !== 'active') return { synced: false, reason: 'entitlement-not-active' };
  await addDiscordRole(entitlement.discordUserId, entitlement.discordRoleId);
  return { synced: true };
}

async function removeDiscordRoleIfNoActiveEntitlement({ discordUserId, type, roleId }) {
  if (!discordUserId || !roleId) return false;
  const now = new Date();
  const active = await Entitlement.exists({
    discordUserId,
    type,
    discordRoleId: roleId,
    status: 'active',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });
  if (active) return false;
  return removeDiscordRole(discordUserId, roleId);
}

async function syncDriveForEntitlement(entitlement) {
  if (!entitlement?.email || !entitlement?.driveFolderId) return { synced: false, reason: 'drive-not-configured' };
  if (entitlement.status !== 'active') return { synced: false, reason: 'entitlement-not-active' };
  const result = await grantViewerAccess({ folderId: entitlement.driveFolderId, email: entitlement.email });
  await Entitlement.updateOne({ _id: entitlement._id }, {
    $set: {
      drivePermissionId: result.permissionId,
      drivePermissionManaged: Boolean(result.managed),
    },
  });
  return { synced: true, permissionId: result.permissionId, managed: Boolean(result.managed) };
}

async function revokeDriveForEntitlement(entitlement) {
  if (!entitlement?.driveFolderId || !entitlement?.drivePermissionId || !entitlement.drivePermissionManaged) return false;
  const stillActive = await Entitlement.exists({
    _id: { $ne: entitlement._id },
    email: entitlement.email,
    driveFolderId: entitlement.driveFolderId,
    status: 'active',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
  if (stillActive) return false;
  await revokeAccess({ folderId: entitlement.driveFolderId, permissionId: entitlement.drivePermissionId });
  await Entitlement.updateOne({ _id: entitlement._id }, { $set: { drivePermissionId: null, drivePermissionManaged: false } });
  return true;
}

module.exports = {
  addDiscordRole,
  removeDiscordRole,
  syncDiscordRoleForEntitlement,
  removeDiscordRoleIfNoActiveEntitlement,
  syncDriveForEntitlement,
  revokeDriveForEntitlement,
};
