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

const durationMonths = (duration) => {
  const value = String(duration || '').toLowerCase();
  const match = value.match(/^(1|3|6|12)\s*month/);
  return match ? Number(match[1]) : null;
};

async function provisionCourseEntitlement({ source, sourceId, course, email, discordUserId }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !course?._id) throw new Error('Course entitlement requires course and email');

  const customerKey = customerKeyFor(source, sourceId);
  const entitlement = await Entitlement.findOneAndUpdate(
    { source, sourceId, type: 'course' },
    {
      $set: {
        customerKey,
        email: normalizedEmail,
        discordUserId: discordUserId || undefined,
        courseId: course._id,
        discordRoleId: course.discordRoleId || null,
        driveFolderId: course.driveEnabled ? course.driveFolderId : null,
        startsAt: new Date(),
        expiresAt: null,
        status: 'active',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return entitlement;
}

async function provisionTradingFloorEntitlement({ source, sourceId, course, email, discordUserId }) {
  if (!course?.tradingFloorEnabled || !course.tradingFloorRoleId) return null;
  const months = durationMonths(course.tradingFloorDuration);
  if (!months) throw new Error('Invalid Trading Floor duration configuration');

  const startsAt = new Date();
  const expiresAt = addMonths(startsAt, months);
  const normalizedEmail = normalizeEmail(email);
  const customerKey = customerKeyFor(source, sourceId);

  return Entitlement.findOneAndUpdate(
    { source, sourceId, type: 'trading_floor' },
    {
      $set: {
        customerKey,
        email: normalizedEmail,
        discordUserId: discordUserId || undefined,
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
