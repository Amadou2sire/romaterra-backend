require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const logger = require('./utils/logger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Routes
const routes = require('./routes');

const app = express();

// Behind a reverse proxy (nginx on OVH), trust the first hop so req.ip and the
// rate limiter see the real client IP. Override with TRUST_PROXY (number of hops).
const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : '0');
app.set('trust proxy', Number(trustProxy));

const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const localDevelopmentOrigins = process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
    ];
const allowedOrigins = new Set([...configuredOrigins, ...localDevelopmentOrigins]);

// Middleware
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
    },
}));
app.use(helmet());
app.use(pinoHttp({ logger }));
app.use(express.json({ limit: '100kb' }));
// Note: Multer handles multipart/form-data parsing, so urlencoded is not needed for file uploads

// MongoDB connection
const { MONGODB_URI, PORT, JWT_SECRET, JWT_REFRESH_SECRET } = process.env;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set in environment variables (.env)');
    process.exit(1);
}
if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set in environment variables (.env)');
    process.exit(1);
}
if (!JWT_REFRESH_SECRET) {
    console.error('JWT_REFRESH_SECRET is not set in environment variables (.env)');
    process.exit(1);
}

mongoose
    .connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// Register routes
app.use('/', routes);
app.use(notFoundHandler);
app.use(errorHandler);

const port = PORT || 3000;

app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`);
});


