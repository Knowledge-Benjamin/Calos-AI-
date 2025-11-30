import express, { Request, Response } from 'express';
import Joi from 'joi';
import aiService from '../services/aiService';
import conversationService from '../services/conversationService';
import logger from '../utils/logger';

const router = express.Router();

// Validation schemas
const chatMessageSchema = Joi.object({
    message: Joi.string().min(1).max(5000).required(),
    sessionId: Joi.string().uuid().optional()
});

/**
 * POST /api/ai/chat/message
 * Send a chat message to the AI
 */
router.post('/message', async (req: Request, res: Response) => {
    try {
        // Validate request
        const { error, value } = chatMessageSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { message, sessionId } = value;
        const userId = (req as any).user.id; // From auth middleware

        // Extract JWT token for Day Tracker API calls
        const authHeader = req.headers.authorization;
        const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

        // Process chat with task automation
        const response = await aiService.chat(userId, message, sessionId, jwtToken);

        res.json({
            success: true,
            data: response
        });
    } catch (error) {
        logger.error('Chat message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing chat message'
        });
    }
});

/**
 * GET /api/ai/chat/history
 * Get conversation history
 */
router.get('/history', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const sessionId = req.query.sessionId as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        let history;
        if (sessionId) {
            history = await conversationService.getSessionHistory(sessionId, limit);
        } else {
            history = await conversationService.getUserHistory(userId, limit);
        }

        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        logger.error('Get history error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching conversation history'
        });
    }
});

/**
 * POST /api/ai/chat/session
 * Create a new chat session
 */
router.post('/session', async (req: Request, res: Response) => {
    try {
        const sessionId = conversationService.createSession();

        res.json({
            success: true,
            data: { sessionId }
        });
    } catch (error) {
        logger.error('Create session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating session'
        });
    }
});

export default router;
