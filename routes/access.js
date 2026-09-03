const express = require('express');
const Entitlement = require('../models/Entitlement');
const { expireDueEntitlements } = require('../services/entitlements');
const { syncDriveForEntitlement } = require('../services/accessSync');

const router = express.Router();

const isValidCustomerKey = (value) => /^[a-f0-9]{64}$/i.test(String(value || ''));
const activeFilter = () => ({
  status: 'active',
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

router.get('/status', async (req, res) => {
  try {
    const customerKey = String(req.query.customerKey || '');
    if (!isValidCustomerKey(customerKey)) return res.status(400).json({ message: 'Valid customerKey is required' });

    await expireDueEntitlements();
    const entitlements = await Entitlement.find({ customerKey, ...activeFilter() })
      .select('courseId type email discordUserId discordRoleId driveFolderId drivePermissionId drivePermissionManaged startsAt expiresAt status')
      .populate('courseId', 'title')
      .lean();

    if (!entitlements.length) return res.status(404).json({ message: 'No active access found' });

    res.json({
      customerKey,
      access: entitlements.map((item) => ({
        courseId: item.courseId?._id ? String(item.courseId._id) : null,
        courseName: item.courseId?.title || null,
        type: item.type,
        email: item.email,
        discord: {
          linked: Boolean(item.discordUserId),
          roleConfigured: Boolean(item.discordRoleId),
          synced: Boolean(item.discordUserId && item.discordRoleId),
        },
        drive: {
          configured: Boolean(item.driveFolderId),
          granted: Boolean(item.drivePermissionId),
          managed: Boolean(item.drivePermissionManaged),
        },
        startsAt: item.startsAt,
        expiresAt: item.expiresAt,
      })),
    });
  } catch (error) {
    console.error('Access status error:', error.message);
    res.status(500).json({ message: 'Unable to load access status' });
  }
});

router.post('/drive', async (req, res) => {
  try {
    const customerKey = String(req.body?.customerKey || '');
    if (!isValidCustomerKey(customerKey)) return res.status(400).json({ message: 'Valid customerKey is required' });

    await expireDueEntitlements();
    const entitlements = await Entitlement.find({ customerKey, type: 'course', ...activeFilter() });
    if (!entitlements.length) return res.status(404).json({ message: 'No active course access found' });

    const eligible = entitlements.filter((item) => item.driveFolderId);
    if (!eligible.length) return res.status(409).json({ message: 'Google Drive access is not configured for this course' });

    const results = [];
    for (const entitlement of eligible) {
      const result = await syncDriveForEntitlement(entitlement);
      results.push({
        courseId: String(entitlement.courseId),
        synced: Boolean(result.synced),
        permissionId: result.permissionId || null,
        managed: Boolean(result.managed),
      });
    }

    res.json({ success: true, access: results });
  } catch (error) {
    console.error('Drive access provisioning error:', error.message);
    res.status(500).json({ success: false, message: 'Unable to provision Google Drive access' });
  }
});

module.exports = router;
