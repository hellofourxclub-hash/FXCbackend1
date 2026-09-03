const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Resend } = require('resend');
const Course = require('../models/Course');
const Purchase = require('../models/Purchase');
const { getEffectiveCoursePrice } = require('../models/CourseDiscountValidation');
const { customerKeyFor, provisionCourseEntitlement, provisionTradingFloorEntitlement } = require('../services/entitlements');

const router = express.Router();

const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
const resend = new Resend(process.env.RESEND_API_KEY);
const toPaise = (amount) => Math.round(Number(amount) * 100);
const safeEqualHex = (expectedHex, receivedHex) => {
  if (!/^[a-f0-9]{64}$/i.test(receivedHex || '')) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(receivedHex, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

router.post('/create-order', async (req, res) => {
  try {
    const { courseId } = req.body || {};
    if (!courseId || !/^[a-f\d]{24}$/i.test(String(courseId))) return res.status(400).json({ message: 'Valid courseId is required' });
    const course = await Course.findById(courseId).lean();
    if (!course || !course.isActive) return res.status(404).json({ message: 'Course not found or inactive' });
    const amount = getEffectiveCoursePrice(course);
    const amountPaise = toPaise(amount);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) return res.status(400).json({ message: 'Invalid course price' });
    const order = await razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt: `fxc_${String(course._id)}_${Date.now()}`, notes: { courseId: String(course._id), courseName: String(course.title).slice(0, 200) } });
    await Purchase.create({ razorpayOrderId: order.id, courseId: course._id, courseName: course.title, customerName: 'Pending', email: 'pending@fourxclub.invalid', amount, currency: 'INR', status: 'pending' });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, courseId: String(course._id) });
  } catch (err) {
    console.error('Razorpay create-order error:', err.message);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
});

router.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, name, email, phone } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !email) return res.status(400).json({ success: false, message: 'Missing required payment fields' });
  const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  if (!safeEqualHex(expectedSignature, razorpay_signature)) return res.status(400).json({ success: false, message: 'Payment verification failed' });

  try {
    const purchase = await Purchase.findOne({ razorpayOrderId: razorpay_order_id });
    if (!purchase) return res.status(404).json({ success: false, message: 'Payment order not recognized' });
    const [order, payment] = await Promise.all([razorpay.orders.fetch(razorpay_order_id), razorpay.payments.fetch(razorpay_payment_id)]);
    const expectedAmountPaise = toPaise(purchase.amount);
    const orderMatches = order.id === razorpay_order_id && order.currency === 'INR' && Number(order.amount) === expectedAmountPaise;
    const paymentMatches = payment.id === razorpay_payment_id && payment.order_id === razorpay_order_id && payment.currency === 'INR' && Number(payment.amount) === expectedAmountPaise && payment.status === 'captured';
    if (!orderMatches || !paymentMatches) {
      await Purchase.updateOne({ _id: purchase._id }, { $set: { status: 'failed' } });
      return res.status(400).json({ success: false, message: 'Payment details do not match the order' });
    }
    const customerKey = customerKeyFor('purchase', razorpay_payment_id);
    if (purchase.status === 'paid' && purchase.razorpayPaymentId === razorpay_payment_id) return res.json({ success: true, paymentId: razorpay_payment_id, customerKey, alreadyVerified: true });

    purchase.razorpayPaymentId = razorpay_payment_id;
    purchase.customerName = typeof name === 'string' ? name.trim().slice(0, 120) : 'Customer';
    purchase.email = String(email).trim().toLowerCase().slice(0, 254);
    purchase.phone = typeof phone === 'string' ? phone.trim().slice(0, 20) : undefined;
    purchase.status = 'paid';
    purchase.verifiedAt = new Date();
    await purchase.save();

    const course = await Course.findById(purchase.courseId).lean();
    if (!course) return res.status(500).json({ success: false, message: 'Purchased course no longer exists' });
    await provisionCourseEntitlement({ source: 'purchase', sourceId: purchase.razorpayPaymentId, course, email: purchase.email });
    await provisionTradingFloorEntitlement({ source: 'purchase', sourceId: purchase.razorpayPaymentId, course, email: purchase.email });
    try {
      await resend.emails.send({ from: 'FXC <noreply@fourxclub.in>', to: purchase.email, subject: 'Your FXC Payment Has Been Verified', html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#fff;padding:40px;border-radius:12px;border:1px solid rgba(136,4,4,.3)"><h2 style="color:#880404">FourXClub</h2><hr style="border-color:#ffffff20"><p>Hi ${purchase.customerName},</p><p>Your payment for <strong>${purchase.courseName}</strong> has been successfully verified.</p><p>Your access is now being prepared. You can connect Discord and access your course from FXC.</p><p style="color:#a1a1aa">If you experience any issues, please contact FXC support.</p><p>Thank you for choosing FXC.</p><p style="color:#880404;font-weight:bold">– Team FXC</p></div>` });
    } catch (emailErr) { console.error('Email send error:', emailErr.message); }
    res.json({ success: true, paymentId: razorpay_payment_id, customerKey });
  } catch (err) {
    console.error('Payment verification error:', err.message);
    res.status(500).json({ success: false, message: 'Payment verification could not be completed' });
  }
});

module.exports = router;
