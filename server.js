const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');
require('dotenv').config();

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_SECRET_KEY'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

const app = express();
dns.setServers(['8.8.8.8', '8.8.4.4']);

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173',
  'https://fxc.vercel.app', 'https://fxcc.vercel.app',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(u => u.trim()) : []),
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    const allowed = [/\.vercel\.app$/, /localhost/, /127\.0\.0\.1/];
    if (allowed.some(r => r.test(origin))) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature', 'X-Razorpay-Event-Id'],
  optionsSuccessStatus: 200,
}));

// Capture exact webhook bytes while still letting Express parse normal JSON requests.
app.use(express.json({
  limit: '256kb',
  verify: (req, _res, buf) => {
    if (req.path === '/webhook' && req.baseUrl === '/api/subscriptions') req.rawBody = Buffer.from(buf);
  },
}));

let connectPromise = null;
const connectMongoDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(true);
  if (connectPromise) return connectPromise;
  connectPromise = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: process.env.NODE_ENV === 'production' ? 1 : 10,
    retryWrites: true,
  }).then(() => { console.log('✅ MongoDB Connected'); connectPromise = null; return true; })
    .catch((err) => { console.error('❌ MongoDB Connection Error:', err.message); connectPromise = null; return false; });
  return connectPromise;
};

mongoose.connection.on('disconnected', () => console.warn('🟡 Mongoose disconnected — will reconnect on next request'));
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  const connected = await connectMongoDB();
  if (!connected) return res.status(503).json({ message: 'Database unavailable. Please try again.' });
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/init', require('./routes/init'));
app.use('/api/banner', require('./routes/banner'));
app.use('/api/footer', require('./routes/footer'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/curriculum', require('./routes/curriculum'));
app.use('/api/hero', require('./routes/hero'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/ecosystem', require('./routes/ecosystem'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/community', require('./routes/community'));
app.use('/api/mentorship', require('./routes/mentorship'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/subscriptions', require('./routes/subscriptions'));

app.get('/api', (_req, res) => res.json({ message: 'FXC Backend API', status: 'running', timestamp: new Date().toISOString() }));
app.get('/api/health', (_req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(isConnected ? 200 : 503).json({ status: 'Server running', timestamp: new Date().toISOString(), mongodb: isConnected ? '✅ Connected' : '❌ Disconnected', environment: process.env.NODE_ENV || 'development' });
});

app.use((err, _req, res, _next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, async () => { console.log(`\n🚀 FXC Backend on port ${PORT}`); console.log(`📍 http://localhost:${PORT}/api\n`); await connectMongoDB(); });
  process.on('SIGINT', async () => { await mongoose.disconnect(); server.close(() => process.exit(0)); });
}

module.exports = app;
