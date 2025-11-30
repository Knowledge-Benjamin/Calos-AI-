import express, { Request, Response } from 'express';
import Joi from 'joi';
import { pool } from '../config/database';
import gmailService from '../services/gmailService';
import logger from '../utils/logger';

const router = express.Router();

// Validation schema for Gmail OAuth routes
const preferencesSchema = Joi.object({
    wakeTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    sleepTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    importantContacts: Joi.array().items(Joi.string().email()).optional()
});

/**
 * GET /api/ai/gmail/authorize
 * Start Gmail OAuth flow
 */
router.get('/gmail/authorize', async (req: Request, res: Response) => {
    try {
        const authUrl = gmailService.getAuthUrl();
        res.redirect(authUrl);
    } catch (error: any) {
        logger.error('Error starting Gmail authorization', error);
        res.status(500).json({
            success: false,
            message: 'Error starting authorization'
        });
    }
});

/**
 * GET /api/ai/gmail/callback
 * Handle Gmail OAuth callback
 */
router.get('/gmail/callback', async (req: Request, res: Response) => {
    try {
        const { code } = req.query;
        if (!code || typeof code !== 'string') {
            return res.status(400).send('No authorization code provided');
        }

        // Get user ID (you might extract this from state parameter in production)
        const userId = (req as any).user?.id || 1; // Placeholder

        // Exchange code for tokens
        const tokens = await gmailService.getTokensFromCode(code);

        // Save tokens
        await gmailService.saveTokens(userId, tokens);

        logger.info('Gmail authorized successfully', { userId });

        res.send(`
            <html>
                <body>
                    <h2>✅ Gmail Successfully Connected!</h2>
                    <p>Calos can now monitor your emails.</p>
                    <button onclick="window.close()">Close</button>
                </body>
            </html>
        `);
    } catch (error: any) {
        logger.error('Error in Gmail callback', error);
        res.status(500).send('Authorization failed. Please try again.');
    }
});

/**
 * GET /api/ai/preferences
 * Get user AI preferences
 */
router.get('/preferences', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT wake_time, sleep_time, important_contacts, ignore_keywords, 
                        gmail_last_sync, twitter_last_sync
                 FROM ai_preferences WHERE user_id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                // Create default preferences
                await client.query(
                    `INSERT INTO ai_preferences (user_id) VALUES ($1)`,
                    [userId]
                );

                return res.json({
                    success: true,
                    data: {
                        wakeTime: '08:00',
                        sleepTime: '21:00',
                        importantContacts: [],
                        ignoreKeywords: [],
                        gmailLastSync: null,
                        twitterLastSync: null
                    }
                });
            }

            const prefs = result.rows[0];
            res.json({
                success: true,
                data: {
                    wakeTime: prefs.wake_time,
                    sleepTime: prefs.sleep_time,
                    importantContacts: prefs.important_contacts || [],
                    ignoreKeywords: prefs.ignore_keywords || [],
                    gmailLastSync: prefs.gmail_last_sync,
                    twitterLastSync: prefs.twitter_last_sync
                }
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Error fetching preferences', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching preferences'
        });
    }
});

/**
 * PUT /api/ai/preferences
 * Update user AI preferences
 */
router.put('/preferences', async (req: Request, res: Response) => {
    try {
        const { error, value } = preferencesSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const userId = (req as any).user.id;
        const { wakeTime, sleepTime, importantContacts } = value;

        const client = await pool.connect();
        try {
            const updates: string[] = [];
            const params: any[] = [userId];
            let paramIndex = 2;

            if (wakeTime) {
                updates.push(`wake_time = $${paramIndex++}`);
                params.push(wakeTime);
            }
            if (sleepTime) {
                updates.push(`sleep_time = $${paramIndex++}`);
                params.push(sleepTime);
            }
            if (importantContacts) {
                updates.push(`important_contacts = $${paramIndex++}`);
                params.push(JSON.stringify(importantContacts));
            }

            if (updates.length > 0) {
                updates.push('updated_at = NOW()');
                await client.query(
                    `UPDATE ai_preferences SET ${updates.join(', ')} WHERE user_id = $1`,
                    params
                );
            }

            logger.info('Preferences updated', { userId });

            res.json({
                success: true,
                data: { message: 'Preferences updated successfully' }
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Error updating preferences', error);
        res.status(500).json({
            success: false,
            message: 'Error updating preferences'
        });
    }
});

/**
 * POST /api/ai/preferences/contacts
 * Add important contact
 */
router.post('/preferences/contacts', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { email } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Valid email required'
            });
        }

        const client = await pool.connect();
        try {
            await client.query(
                `UPDATE ai_preferences 
                 SET important_contacts = 
                     CASE 
                         WHEN important_contacts IS NULL THEN jsonb_build_array($2)
                         ELSE important_contacts || jsonb_build_array($2)
                     END,
                     updated_at = NOW()
                 WHERE user_id = $1`,
                [userId, email]
            );

            res.json({
                success: true,
                data: { message: 'Contact added successfully' }
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Error adding contact', error);
        res.status(500).json({
            success: false,
            message: 'Error adding contact'
        });
    }
});

/**
 * DELETE /api/ai/preferences/contacts/:email
 * Remove important contact
 */
router.delete('/preferences/contacts/:email', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const email = req.params.email;

        const client = await pool.connect();
        try {
            await client.query(
                `UPDATE ai_preferences 
                 SET important_contacts = (
                     SELECT jsonb_agg(elem)
                     FROM jsonb_array_elements(important_contacts) AS elem
                     WHERE elem::text != $2::jsonb::text
                 ),
                 updated_at = NOW()
                 WHERE user_id = $1`,
                [userId, JSON.stringify(email)]
            );

            res.json({
                success: true,
                data: { message: 'Contact removed successfully' }
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Error removing contact', error);
        res.status(500).json({
            success: false,
            message: 'Error removing contact'
        });
    }
});

export default router;
