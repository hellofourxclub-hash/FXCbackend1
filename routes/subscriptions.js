const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Course = require('../models/Course');
const Subscription = require('../models/Subscription');
const WebhookEvent = require('../models/WebhookEvent');
const authMiddleware = require('../middleware/auth');
const { provisionCourseEntitlement, provisionTradingFloorEntitlement } = require('../services/entitlements');

const router = express.Router();
const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
const PERIOD_MAP = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' };
const MAX_SUBSCRIPTION_YEARS = 100;

const effectivePrice = (course) => {
  const discounted = Number(course.discountPrice);
  const original = Number(course.price);
  return Number.isFinite(discounted) && discounted > 0 && discounted < original ? discounted : original;
};

const validBilling = (course) => {
  const period = PERIOD_MAP[course.billingPeriod];
  const interval = Number(course.billingInterval);
  if (!period || !Number.isInteger(interval) || interval < 1 || interval > 12) return false;
  if (period === 'daily' && interval < 7) return false;
  return true;
};

const getMaxSubscriptionCycles = (period, interval) => {
  const safeInterval = Number(interval);
  switch (period) {
    case 'daily': return Math.floor((MAX_SUBSCRIPTION_YEARS * 365.25) / safeInterval);
    case 'weekly': return Math.floor((MAX_SUBSCRIPTION_YEARS * 365.25) / (7 * safeInterval));
    case 'monthly': return Math.floor((MAX_SUBSCRIPTION_YEARS * 12) / safeInterval);
    case 'yearly': return Math.floor(MAX_SUBSCRIPTION_YEARS / safeInterval);
    default: return 0;
  }
};

router.post('/courses/:courseId/plan', authMiddleware, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    if (!course.billingEnabled) return res.status(400).json({ message: 'Recurring billing is disabled for this course' });
    const amount = effectivePrice(course);
    if (!Number.isFinite(amount) || amount <= 0 || !validBilling(course)) return res.status(400).json({ message: 'Invalid course billing configuration' });
    const period = PERIOD_MAP[course.billingPeriod];
    const interval = Number(course.billingInterval);
    const amountPaise = Math.round(amount * 100);
    const samePlan = course.razorpayPlanId && Number(course.razorpayPlanAmount) === amountPaise && course.razorpayPlanPeriod === period && Number(course.razorpayPlanInterval) === interval;
    if (samePlan) return res.json({ planId: course.razorpayPlanId, courseId: String(course._id), amount, currency: 'INR', period, interval, reused: true });

    const plan = await razorpay.plans.create({ period, interval, item: { name: course.title, amount: amountPaise, currency: 'INR', description: `${course.title} recurring subscription` }, notes: { courseId: String(course._id), billingPeriod: course.billingPeriod, billingInterval: String(interval) } });
    course.razorpayPlanId = plan.id;
    course.razorpayPlanAmount = amountPaise;
    course.razorpayPlanPeriod = period;
    course.razorpayPlanInterval = interval;
    course.updatedAt = Date.now();
    await course.save();
    res.json({ planId: plan.id, courseId: String(course._id), amount, currency: 'INR', period, interval, reused: false });
  } catch (error) {
    console.error('Razorpay plan creation error:', error.message);
    res.status(500).json({ message: 'Failed to create subscription plan' });
  }
});

router.post('/create', async (req, res) => {
  try {
    const { courseId, name, email, phone } = req.body || {};
    if (!courseId || !name || !email) return res.status(400).json({ message: 'courseId, name and email are required' });
    if (!/^[a-f\d]{24}$/i.test(String(courseId))) return res.status(400).json({ message: 'Valid courseId is required' });
    if (String(name).trim().length > 120 || String(email).trim().length > 254) return res.status(400).json({ message: 'Customer details are too long' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) return res.status(400).json({ message: 'Valid email is required' });
    const normalizedPhone = phone ? String(phone).trim() : undefined;
    if (normalizedPhone && !/^[6-9]\d{9}$/.test(normalizedPhone)) return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });

    const course = await Course.findById(courseId).lean();
    if (!course || !course.isActive) return res.status(404).json({ message: 'Course not found or inactive' });
    if (!course.billingEnabled || !course.razorpayPlanId) return res.status(400).json({ message: 'Recurring billing is not configured for this course' });
    if (!validBilling(course)) return res.status(400).json({ message: 'Invalid course billing configuration' });
    const amount = effectivePrice(course);
    const expectedPlanAmount = Math.round(amount * 100);
    const period = PERIOD_MAP[course.billingPeriod];
    const interval = Number(course.billingInterval);
    if (Number(course.razorpayPlanAmount) !== expectedPlanAmount || course.razorpayPlanPeriod !== period || Number(course.razorpayPlanInterval) !== interval) return res.status(409).json({ message: 'Subscription plan is out of date. Please refresh and try again.' });

    const totalCount = getMaxSubscriptionCycles(period, interval);
    if (!Number.isInteger(totalCount) || totalCount < 1) return res.status(400).json({ message: 'Invalid subscription duration configuration' });
    const subscription = await razorpay.subscriptions.create({ plan_id: course.razorpayPlanId, total_count: totalCount, customer_notify: 1, notes: { courseId: String(course._id), customerEmail: normalizedEmail } });

    await Subscription.create({ razorpaySubscriptionId: subscription.id, razorpayPlanId: course.razorpayPlanId, razorpayCustomerId: subscription.customer_id, courseId: course._id, courseName: course.title, customerName: String(name).trim().slice(0, 120), email: normalizedEmail, phone: normalizedPhone, amount, currency: 'INR', interval: course.billingInterval, period, totalCount, status: subscription.status || 'created', currentStart: subscription.current_start ? new Date(subscription.current_start * 1000) : undefined, currentEnd: subscription.current_end ? new Date(subscription.current_end * 1000) : undefined, chargeAt: subscription.charge_at ? new Date(subscription.charge_at * 1000) : undefined });
    res.status(201).json({ subscriptionId: subscription.id, planId: course.razorpayPlanId, amount: expectedPlanAmount, currency: 'INR', status: subscription.status });
  } catch (error) {
    console.error('Razorpay subscription creation error:', error.message);
    res.status(500).json({ message: 'Failed to create subscription' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body || {};
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) return res.status(400).json({ success: false, message: 'Missing subscription verification fields' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest('hex');
    const received = String(razorpay_signature);
    if (!/^[a-f0-9]{64}$/i.test(received) || !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))) return res.status(400).json({ success: false, message: 'Subscription verification failed' });
    const existing = await Subscription.findOne({ razorpaySubscriptionId: razorpay_subscription_id });
    if (!existing) return res.status(404).json({ success: false, message: 'Subscription record not found' });

    existing.lastPaymentId = razorpay_payment_id;
    existing.status = 'authenticated';
    existing.lastChargedAt = new Date();
    await existing.save();

    const course = await Course.findById(existing.courseId).lean();
    if (!course) return res.status(500).json({ success: false, message: 'Subscribed course no longer exists' });
    await provisionCourseEntitlement({ source: 'subscription', sourceId: existing.razorpaySubscriptionId, course, email: existing.email });
    await provisionTradingFloorEntitlement({ source: 'subscription', sourceId: existing.razorpaySubscriptionId, course, email: existing.email });

    res.json({ success: true, subscriptionId: razorpay_subscription_id });
  } catch (error) {
    console.error('Subscription verification error:', error.message);
    res.status(500).json({ success: false, message: 'Unable to verify subscription' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!signature || !secret || !Buffer.isBuffer(req.rawBody)) return res.status(400).json({ message: 'Invalid webhook request' });
    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const received = Buffer.from(String(signature), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (expectedBuffer.length !== received.length || !crypto.timingSafeEqual(expectedBuffer, received)) return res.status(401).json({ message: 'Invalid webhook signature' });
    const payload = req.body;
    const eventId = req.headers['x-razorpay-event-id'];
    if (!eventId) return res.status(400).json({ message: 'Missing webhook event id' });
    try {
      await WebhookEvent.create({ eventId: String(eventId), event: payload.event || 'unknown' });
    } catch (error) {
      if (error?.code === 11000) return res.status(200).json({ received: true, duplicate: true });
      throw error;
    }

    const entity = payload.payload?.subscription?.entity;
    const payment = payload.payload?.payment?.entity;
    const subscriptionId = entity?.id || payment?.subscription_id;
    if (subscriptionId) {
      const update = {};
      if (entity?.status) update.status = entity.status;
      if (entity?.current_start) update.currentStart = new Date(entity.current_start * 1000);
      if (entity?.current_end) update.currentEnd = new Date(entity.current_end * 1000);
      if (entity?.charge_at) update.chargeAt = new Date(entity.charge_at * 1000);
      if (payment?.id) { update.lastPaymentId = payment.id; update.lastChargedAt = new Date(); }
      if (entity?.ended_at) update.endedAt = new Date(entity.ended_at * 1000);
      if (Object.keys(update).length) await Subscription.updateOne({ razorpaySubscriptionId: subscriptionId }, { $set: update });
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error.message);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
});

module.exports = router;
