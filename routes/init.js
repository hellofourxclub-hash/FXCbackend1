const express = require('express');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const router = express.Router();

// Initialize admin key (run once)
router.post('/setup', async (req, res) => {
  try {
    console.log('📝 Setup request received');
    console.log('🔌 MongoDB Connection State:', mongoose.connection.readyState);
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ MongoDB not connected');
      return res.status(503).json({ message: 'MongoDB not connected. Please try again.' });
    }

    // Check if admin key already exists
    console.log('🔍 Checking for existing admin key...');
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      console.log('⚠️ Admin key already exists');
      return res.status(400).json({ message: 'Admin key already set up' });
    }

    const { secretKey } = req.body;
    if (!secretKey) {
      console.error('❌ No secret key provided');
      return res.status(400).json({ message: 'Secret key required' });
    }

    if (secretKey.length < 20) {
      console.error('❌ Secret key too short');
      return res.status(400).json({ message: 'Secret key must be at least 20 characters' });
    }

    console.log('✏️ Creating admin document...');
    const admin = new Admin({
      secretKey,
      isActive: true,
      description: 'Primary admin key',
    });

    console.log('💾 Saving admin to MongoDB...');
    const savedAdmin = await admin.save();
    console.log('✅ Admin saved successfully:', savedAdmin._id);
    
    res.json({ 
      message: 'Admin key set up successfully',
      adminId: savedAdmin._id 
    });
  } catch (error) {
    console.error('🔥 Setup Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      message: 'Setup failed: ' + error.message,
      details: error.message 
    });
  }
});

module.exports = router;
