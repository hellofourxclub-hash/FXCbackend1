const mongoose = require('mongoose');
const { getPublicIP } = require('./utils/getIP');
require('dotenv').config();

const connectMongoDB = async () => {
  try {
    console.log('🔍 Detecting your public IP for MongoDB Atlas...');
    
    const publicIP = await getPublicIP();
    
    if (publicIP) {
      console.log(`\n✅ Your public IP: ${publicIP}`);
      console.log('\n📝 MongoDB Atlas Setup Instructions:');
      console.log('─'.repeat(60));
      console.log('1. Go to https://www.mongodb.com/cloud/atlas');
      console.log('2. Login to your account');
      console.log('3. Go to: Network Access → IP Whitelist');
      console.log(`4. Click "Add IP Address" and add: ${publicIP}`);
      console.log('5. Or use 0.0.0.0/0 to allow all IPs (NOT RECOMMENDED for production)');
      console.log('─'.repeat(60));
    } else {
      console.log('⚠️  Could not detect public IP automatically');
      console.log('Please manually whitelist your IP in MongoDB Atlas');
    }

    console.log('\n🔗 Connecting to MongoDB Atlas...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ MongoDB Connected Successfully!');
    console.log(`📊 Database: ${mongoose.connection.db.getName()}`);
    console.log(`🖥️  Host: ${mongoose.connection.host}`);
    console.log('\n✨ Backend is ready to use!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ MongoDB Connection Failed!');
    console.error(`Error: ${error.message}`);
    
    if (error.message.includes('connect ECONNREFUSED')) {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Check your internet connection');
      console.log('2. Verify MongoDB Atlas URI in .env');
      console.log('3. Whitelist your IP in MongoDB Atlas');
      console.log('4. Check if MongoDB Atlas cluster is running');
    }
    
    process.exit(1);
  }
};

connectMongoDB();
