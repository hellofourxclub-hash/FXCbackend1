const crypto = require('crypto');
const Entitlement = require('../models/Entitlement');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const customerKeyFor = (source, sourceId) =>
  crypto.createHash('sha256').update(`${source}:${sourceId}`).digest('hex').slice(0, 64);

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
    {
      $set: {
        customerKey,
        email: normalizedEmail,
        ...(discordUserId ? { discordUserId } : {}),
        courseId: course._id,
        discordRoleId: course.discordEnabled ? course.discordRoleId : null,
        driveFolderId: course.driveEnabled ? course.driveFolderId : null,
        startsAt: new Date(),
        expiresAt: null,
        status: 'active',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function provisionTradingFloorEntitlement({ source, sourceId, course, email, discordUserId }) {
  if (!course?.tradingFloorEnabled || !course.tradingFloorRoleId) return null;
  const months = Number(course.tradingFloorDurationMonths);
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error('Invalid Trading Floor duration configuration');
  }

  const startsAt = new Date();
  const expiresAt = addMonths(startsAt, months);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Trading Floor entitlement requires email');
  const customerKey = customerKeyFor(source, sourceId);

  return Entitlement.findOneAndUpdate(
    { source, sourceId, type: 'trading_floor' },
    {
      $set: {
        customerKey,
        email: normalizedEmail,
        ...(discordUserId ? { discordUserId } : {}),
        courseId: course._id,
        discordRoleId: course.tradingFloorRoleId,
        driveFolderId: null,
        startsAt,
        expiresAt,
        status: 'active',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = { customerKeyFor, provisionCourseEntitlement, provisionTradingFloorEntitlement };
