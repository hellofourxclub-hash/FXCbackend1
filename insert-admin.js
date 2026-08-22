const mongoose = require('mongoose');
require('dotenv').config();

async function insertAdmin() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
    });

    console.log('✅ Connected');

    // Get the Admin model
    const Admin = require('./models/Admin');

    // The admin key from environment or use a default
    const adminKey = process.env.ADMIN_KEY || 'admin-key-fxc-2026';

    // Create or update admin
    const admin = await Admin.findOneAndUpdate(
      {},
      { key: adminKey, createdAt: new Date() },
      { upsert: true, new: true }
    );

    console.log('✅ Admin key saved:');
    console.log(`   Key: ${admin.key}`);
    console.log(`   Created: ${admin.createdAt}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Done! You can now login with this key.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

insertAdmin();
