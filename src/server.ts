import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Import routes
import chatRoutes from './routes/chat.routes';
import voiceRoutes from './routes/voice.routes';

// Import middleware
import authMiddleware from './middleware/auth.middleware';

// Import config
import pool from './config/database';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Create uploads directory
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// Serve uploads directory for TTS audio files
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'AI Assistant API Server',
        version: '1.0.0',
        endpoints: {
            chat: '/api/ai/chat',
            health: '/health'
        }
    });
});

// API Routes (protected)
app.use('/api/ai/chat', authMiddleware, chatRoutes);
app.use('/api/ai/voice', authMiddleware, voiceRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Error:', err);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info(`
╔════════════════════════════════════════════╗
║                                            ║
║     AI Assistant API Server                ║
║                                            ║
║     Server: http://localhost:${PORT}       ║
║     Environment: ${process.env.NODE_ENV || 'development'}        ║
║                                            ║
╚════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
const gracefulShutdown = () => {
    logger.info('Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        pool.end(() => {
            logger.info('Database pool closed');
            process.exit(0);
        });
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;
