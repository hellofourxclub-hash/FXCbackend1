const crypto = require('crypto');
const Entitlement = require('../models/Entitlement');
const {
  removeDiscordRoleIfNoActiveEntitlement,
  revokeDriveForEntitlement,
} = require('./accessSync');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const customerKeyFor = (source, sourceId) => crypto.createHash('sha256').update(`${source}:${sourceId}`).digest('hex').slice(0, 64);

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

async function provisionCourseEntitlement({ source, sourceId, course, email, discordUserId }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !course?._id) throw new Error('Course entitlement requires course and email');
  const customerKey = customerKeyFor(source, sourceId);
  return Entitlement.findOneAndUpdate(
    { source, sourceId, type: 'course' },
    { $set: {
      customerKey, email: normalizedEmail,
      ...(discordUserId ? { discordUserId } : {}),
      courseId: course._id,
      discordRoleId: course.discordEnabled ? course.discordRoleId : null,
      driveFolderId: course.driveEnabled ? course.driveFolderId : null,
      startsAt: new Date(), expiresAt: null, status: 'active',
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function provisionTradingFloorEntitlement({ source, sourceId, course, email, discordUserId, startsAt = new Date() }) {
  if (!course?.tradingFloorEnabled || !course.tradingFloorRoleId) return null;
  const months = Number(course.tradingFloorDurationMonths);
  if (!Number.isInteger(months) || months < 1 || months > 120) throw new Error('Invalid Trading Floor duration configuration');
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Trading Floor entitlement requires email');
  const customerKey = customerKeyFor(source, sourceId);
  const effectiveStart = new Date(startsAt);
  return Entitlement.findOneAndUpdate(
    { source, sourceId, type: 'trading_floor' },
    { $set: {
      customerKey, email: normalizedEmail,
      ...(discordUserId ? { discordUserId } : {}),
      courseId: course._id, discordRoleId: course.tradingFloorRoleId,
      driveFolderId: null, startsAt: effectiveStart,
      expiresAt: addMonths(effectiveStart, months), status: 'active',
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function expireDueEntitlements() {
  const now = new Date();
  const due = await Entitlement.find({
    status: 'active',
    expiresAt: { $ne: null, $lte: now },
  }).lean();

  if (!due.length) return { matchedCount: 0, modifiedCount: 0 };

  const ids = due.map((entitlement) => entitlement._id);
  const result = await Entitlement.updateMany(
    { _id: { $in: ids }, status: 'active', expiresAt: { $ne: null, $lte: now } },
    { $set: { status: 'expired' } }
  );

  for (const entitlement of due) {
    try {
      await removeDiscordRoleIfNoActiveEntitlement({
        discordUserId: entitlement.discordUserId,
        type: entitlement.type,
        roleId: entitlement.discordRoleId,
      });
    } catch (error) {
      console.error('Failed to remove Discord role for expired entitlement', {
        entitlementId: String(entitlement._id),
        error: error?.message || error,
      });
    }

    try {
      await revokeDriveForEntitlement(entitlement);
    } catch (error) {
      console.error('Failed to revoke Drive access for expired entitlement', {
        entitlementId: String(entitlement._id),
        error: error?.message || error,
      });
    }
  }

  return result;
}

async function revokeEntitlementsBySource(source, sourceId) {
  const active = await Entitlement.find({ source, sourceId, status: 'active' }).lean();
  if (!active.length) return { matchedCount: 0, modifiedCount: 0 };

  const now = new Date();
  const result = await Entitlement.updateMany(
    { _id: { $in: active.map((entitlement) => entitlement._id) }, status: 'active' },
    { $set: { status: 'revoked', expiresAt: now } }
  );

  for (const entitlement of active) {
    try {
      await removeDiscordRoleIfNoActiveEntitlement({
        discordUserId: entitlement.discordUserId,
        type: entitlement.type,
        roleId: entitlement.discordRoleId,
      });
    } catch (error) {
      console.error('Failed to remove Discord role for revoked entitlement', {
        entitlementId: String(entitlement._id),
        error: error?.message || error,
      });
    }

    try {
      await revokeDriveForEntitlement(entitlement);
    } catch (error) {
      console.error('Failed to revoke Drive access for revoked entitlement', {
        entitlementId: String(entitlement._id),
        error: error?.message || error,
      });
    }
  }

  return result;
}

module.exports = { customerKeyFor, provisionCourseEntitlement, provisionTradingFloorEntitlement, expireDueEntitlements, revokeEntitlementsBySource };
