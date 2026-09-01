const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Course = require('../models/Course');
const Subscription = require('../models/Subscription');
const WebhookEvent = require('../models/WebhookEvent');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
const PERIOD_MAP = { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' };

router.post('/courses/:courseId/plan', authMiddleware, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    if (!course.billingEnabled) return res.status(400).json({ message: 'Recurring billing is disabled for this course' });
    const amount = Number(course.discountPrice && course.discountPrice < course.price ? course.discountPrice : course.price);
    const period = PERIOD_MAP[course.billingPeriod];
    if (!Number.isFinite(amount) || amount <= 0 || !period) return res.status(400).json({ message: 'Invalid course billing configuration' });
    const plan = await razorpay.plans.create({
      period,
      interval: course.billingInterval,
      item: { name: course.title, amount: Math.round(amount * 100), currency: 'INR', description: `${course.title} recurring subscription` },
      notes: { courseId: String(course._id) },
    });
    course.razorpayPlanId = plan.id;
    course.updatedAt = Date.now();
    await course.save();
    res.json({ planId: plan.id, courseId: String(course._id), amount, currency: 'INR', period, interval: course.billingInterval });
  } catch (error) {
    console.error('Razorpay plan creation error:', error.message);
    res.status(500).json({ message: 'Failed to create subscription plan' });
  }
});

router.post('/create', async (req, res) => {
  try {
    const { courseId, name, email, phone } = req.body || {};
    if (!courseId || !name || !email) return res.status(400).json({ message: 'courseId, name and email are required' });
    const course = await Course.findById(courseId).lean();
    if (!course || !course.isActive) return res.status(404).json({ message: 'Course not found or inactive' });
    if (!course.billingEnabled || !course.razorpayPlanId) return res.status(400).json({ message: 'Recurring billing is not configured for this course' });
    const subscription = await razorpay.subscriptions.create({ plan_id: course.razorpayPlanId, total_count: 120, customer_notify: 1, notes: { courseId: String(course._id), customerEmail: String(email).slice(0, 254) } });
    const amount = Number(course.discountPrice && course.discountPrice < course.price ? course.discountPrice : course.price);
    await Subscription.create({
      razorpaySubscriptionId: subscription.id,
      razorpayPlanId: course.razorpayPlanId,
      courseId: course._id,
      courseName: course.title,
      customerName: String(name).slice(0, 120),
      email: String(email).trim().toLowerCase().slice(0, 254),
      phone: phone ? String(phone).slice(0, 20) : undefined,
      amount,
      currency: 'INR',
      interval: course.billingInterval,
      period: PERIOD_MAP[course.billingPeriod],
      status: subscription.status || 'created',
      currentStart: subscription.current_start ? new Date(subscription.current_start * 1000) : undefined,
      currentEnd: subscription.current_end ? new Date(subscription.current_end * 1000) : undefined,
      chargeAt: subscription.charge_at ? new Date(subscription.charge_at * 1000) : undefined,
    });
    res.status(201).json({ subscriptionId: subscription.id, planId: course.razorpayPlanId, amount: Math.round(amount * 100), currency: 'INR', status: subscription.status });
  } catch (error) {
    console.error('Razorpay subscription creation error:', error.message);
    res.status(500).json({ message: 'Failed to create subscription' });
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
      if (Object.keys(update).length) await Subscription.updateOne({ razorpaySubscriptionId: subscriptionId }, { $set: update });
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook error:', error.message);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
});

module.exports = router;
