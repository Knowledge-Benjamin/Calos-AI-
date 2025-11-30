import express, { Request, Response } from 'express';
import Joi from 'joi';
import { pool } from '../config/database';
import messageClassifier from '../services/messageClassifier';
import logger from '../utils/logger';

const router = express.Router();

// Validation schemas
const feedbackSchema = Joi.object({
    correctedScore: Joi.number().min(1).max(10).required(),
    feedbackText: Joi.string().max(500).optional()
});

/**
 * GET /api/ai/monitoring/messages
 * Get recent monitored messages with filtering
 */
router.get('/messages', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { classification, unreadOnly, limit = 50 } = req.query;

        let query = `
            SELECT id, source, sender, subject, content, importance_score, classification, 
                   is_read, metadata, created_at
            FROM monitored_messages
            WHERE user_id = $1
        `;
        const params: any[] = [userId];

        if (classification && ['high', 'medium', 'low'].includes(classification as string)) {
            params.push(classification);
            query += ` AND classification = $${params.length}`;
        }

        if (unreadOnly === 'true') {
            query += ' AND is_read = FALSE';
        }

        query += ` ORDER BY created_at DESC LIMIT ${Math.min(Number(limit), 100)}`;

        const client = await pool.connect();
        try {
            const result = await client.query(query, params);

            res.json({
                success: true,
                data: {
                    messages: result.rows,
                    count: result.rows.length
                }
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Error fetching monitored messages', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching messages'
        });
    }
});

/**
 * POST /api/ai/monitoring/feedback/:id
 * Submit feedback on message classification
 */
router.post('/feedback/:id', async (req: Request, res: Response) => {
    try {
        const { error, value } = feedbackSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const userId = (req as any).user.id;
        const messageId = parseInt(req.params.id);
        const { correctedScore, feedbackText } = value;

        // Get original message
        const client = await pool.connect();
        try {
            const msgResult = await client.query(
                'SELECT importance_score, user_id FROM monitored_messages WHERE id = $1',
                [messageId]
            );

            if (msgResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Message not found'
                });
            }

            const message = msgResult.rows[0];

            // Verify ownership
            if (message.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized'
                });
            }

            // Store feedback
            await messageClassifier.storeFeedback(
                messageId,
                userId,
                message.importance_score,
                correctedScore,
                feedbackText
            );

            // Update message classification
            const newCategory = correctedScore >= 8 ? 'high' : correctedScore >= 5 ? 'medium' : 'low';
            await client.query(
                'UPDATE monitored_messages SET importance_score = $1, classification = $2 WHERE id = $3',
                [correctedScore, newCategory, messageId]
            );

            logger.info('Feedback submitted', { userId, messageId, correctedScore });

            res.json({
                success: true,
                data: {
                    message: 'Feedback recorded successfully',
                    updatedScore: correctedScore,
                    updatedCategory: newCategory
                }
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Error submitting feedback', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting feedback'
        });
    }
});

/**
 * GET /api/ai/monitoring/summary
 * Get summary of unread important messages
 */
router.get('/summary', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const client = await pool.connect();
        try {
            // Get unread high priority messages
            const highResult = await client.query(
                `SELECT COUNT(*) as count, source FROM monitored_messages 
                 WHERE user_id = $1 AND is_read = FALSE AND classification = 'high'
                 GROUP BY source`,
                [userId]
            );

            // Get unread medium priority messages
            const mediumResult = await client.query(
                `SELECT COUNT(*) as count FROM monitored_messages 
                 WHERE user_id = $1 AND is_read = FALSE AND classification = 'medium'`,
                [userId]
            );

            // Get recent high priority messages
            const recentResult = await client.query(
                `SELECT source, sender, subject, content, importance_score, created_at 
                 FROM monitored_messages 
                 WHERE user_id = $1 AND is_read = FALSE AND classification = 'high'
                 ORDER BY created_at DESC LIMIT 5`,
                [userId]
            );

            const summary = {
                highPriority: {
                    total: highResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
                    bySource: highResult.rows.reduce((acc: any, row) => {
                        acc[row.source] = parseInt(row.count);
                        return acc;
                    }, {})
                },
                mediumPriority: parseInt(mediumResult.rows[0]?.count || 0),
                recentHighPriority: recentResult.rows
            };

            res.json({
                success: true,
                data: summary
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Error fetching summary', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching summary'
        });
    }
});

/**
 * DELETE /api/ai/monitoring/messages/:id
 * Mark message as read/dismiss
 */
router.delete('/messages/:id', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const messageId = parseInt(req.params.id);

        const client = await pool.connect();
        try {
            const result = await client.query(
                'UPDATE monitored_messages SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
                [messageId, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Message not found'
                });
            }

            res.json({
                success: true,
                data: { message: 'Message marked as read' }
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Error marking message as read', error);
        res.status(500).json({
            success: false,
            message: 'Error marking message as read'
        });
    }
});

export default router;
