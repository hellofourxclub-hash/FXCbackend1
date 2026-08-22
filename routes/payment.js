const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Resend } = require('resend');

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const resend = new Resend(process.env.RESEND_API_KEY);

// Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, courseId, courseName } = req.body;
    if (!amount || !courseId || !courseName) {
      return res.status(400).json({ message: 'amount, courseId and courseName are required' });
    }
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `fxc_${courseId}_${Date.now()}`,
      notes: { courseId, courseName },
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error('Razorpay create-order error:', err.message);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
});

// Verify payment + send email
router.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, name, email, phone, courseName } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing payment fields' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  // Send email
  try {
    await resend.emails.send({
      from: 'FXC <noreply@fourxclub.in>',
      to: email,
      subject: 'Your FXC Access Has Been Approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid rgba(136,4,4,0.3);">
          <h2 style="color: #880404; margin-bottom: 8px;">FourXClub</h2>
          <hr style="border-color: #ffffff20; margin-bottom: 24px;" />
          <p>Hi ${name},</p>
          <p>Your payment for <strong>${courseName}</strong> has been successfully received.</p>
          <p>To get your course access, please follow these steps:</p>
          <ol style="line-height: 2; color: #d4d4d4;">
            <li>Join our Discord server: <a href="${process.env.DISCORD_INVITE}" style="color: #880404;">${process.env.DISCORD_INVITE}</a></li>
            <li>Navigate to the <strong>Support &amp; Verification</strong> category.</li>
            <li>Open a <strong>Verification Ticket</strong>.</li>
            <li>Provide your Name, Email, Mobile Number and attach your payment screenshot.</li>
            <li>Once our team verifies your payment, you will be granted access to the channels included with your purchase.</li>
          </ol>
          <p style="color: #a1a1aa;">If you experience any issues, please open a ticket in the Support &amp; Verification channel. Our team will be happy to assist.</p>
          <p>Thank you for choosing FXC.</p>
          <p style="color: #880404; font-weight: bold;">– Team FXC</p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error('Email send error:', emailErr.message);
    // Don't fail the response if email fails — payment is already verified
  }

  res.json({ success: true, paymentId: razorpay_payment_id });
});

module.exports = router;
