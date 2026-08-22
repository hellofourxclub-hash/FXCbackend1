const express = require('express');
const Course = require('../models/Course');
const authMiddleware = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let isAdmin = false;
    if (token) {
      try { jwt.verify(token, process.env.JWT_SECRET); isAdmin = true; } catch {}
    }
    const filter = isAdmin ? {} : { isActive: true };
    const courses = await Course.find(filter);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, price, label, accent, highlights, cta, paymentType } = req.body;
    const course = new Course({ title, description, price, label, accent, highlights, cta, paymentType });
    await course.save();
    res.status(201).json({ message: 'Course created', course });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, price, label, accent, highlights, cta, paymentType, isActive } = req.body;

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (title !== undefined) course.title = title;
    if (description !== undefined) course.description = description;
    if (price !== undefined) course.price = price;
    if (label !== undefined) course.label = label;
    if (accent !== undefined) course.accent = accent;
    if (highlights !== undefined) course.highlights = highlights;
    if (cta !== undefined) course.cta = cta;
    if (paymentType !== undefined) course.paymentType = paymentType;
    if (isActive !== undefined) course.isActive = isActive;
    course.updatedAt = Date.now();

    await course.save();
    res.json({ message: 'Course updated', course });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json({ message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
