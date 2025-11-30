import cron from 'node-cron';
import gmailService from './gmailService';
import xMonitorService from './xMonitorService';
import messageClassifier from './messageClassifier';
import { pool } from '../config/database';
import logger from '../utils/logger';

export class MonitoringScheduler {
    private gmailJob: cron.ScheduledTask | null = null;
    private xJob: cron.ScheduledTask | null = null;

    /**
     * Start scheduled monitoring jobs
     */
    start() {
        // Gmail: Check every hour (at minute 0)
        this.gmailJob = cron.schedule('0 * * * *', async () => {
            logger.info('Running scheduled Gmail check...');
            await this.checkGmailForAllUsers();
        });

        // X (Twitter): Check every 2 hours (at minute 0 of even hours)
        this.xJob = cron.schedule('0 */2 * * *', async () => {
            logger.info('Running scheduled X check...');
            await this.checkXForAllUsers();
        });

        logger.info('Monitoring scheduler started', {
            gmail: 'Every hour',
            twitter: 'Every 2 hours'
        });
    }

    /**
     * Stop scheduled monitoring jobs
     */
    stop() {
        if (this.gmailJob) {
            this.gmailJob.stop();
            this.gmailJob = null;
        }
        if (this.xJob) {
            this.xJob.stop();
            this.xJob = null;
        }
        logger.info('Monitoring scheduler stopped');
    }

    /**
     * Check Gmail for all users with tokens
     */
    private async checkGmailForAllUsers() {
        const client = await pool.connect();
        try {
            // Get all users with Gmail tokens
            const result = await client.query(
                'SELECT DISTINCT user_id FROM gmail_tokens'
            );

            for (const row of result.rows) {
                try {
                    await this.checkGmailForUser(row.user_id);
                } catch (error: any) {
                    logger.error('Error checking Gmail for user', {
                        userId: row.user_id,
                        error: error.message
                    });
                }
            }
        } finally {
            client.release();
        }
    }

    /**
     * Check Gmail for a specific user
     */
    async checkGmailForUser(userId: number) {
        try {
            // Check if within wake/sleep time
            if (!await this.isWithinActiveHours(userId)) {
                logger.debug('Outside active hours, skipping Gmail check', { userId });
                return;
            }

            // Fetch recent unread emails
            const emails = await gmailService.fetchRecentUnreadEmails(userId, 20);

            logger.info('Fetched emails', { userId, count: emails.length });

            // Classify and store each email
            for (const email of emails) {
                try {
                    // Check if already stored
                    const existing = await this.isMessageStored(userId, 'gmail', email.id);
                    if (existing) {
                        continue;
                    }

                    // Classify importance
                    const classification = await messageClassifier.classify(userId, {
                        sender: email.from,
                        subject: email.subject,
                        content: email.body,
                        source: 'gmail'
                    });

                    // Store in database
                    await this.storeMessage(userId, {
                        source: 'gmail',
                        messageId: email.id,
                        sender: email.from,
                        subject: email.subject,
                        content: email.snippet,
                        importanceScore: classification.score,
                        classification: classification.category,
                        metadata: {
                            from: email.from,
                            labels: email.labels,
                            date: email.date.toISOString(),
                            reasoning: classification.reasoning
                        }
                    });

                    logger.info('Stored classified email', {
                        userId,
                        messageId: email.id,
                        classification: classification.category,
                        score: classification.score
                    });
                } catch (error: any) {
                    logger.error('Error processing email', {
                        userId,
                        emailId: email.id,
                        error: error.message
                    });
                }
            }

            // Update last sync time
            await this.updateLastSync(userId, 'gmail');
        } catch (error: any) {
            logger.error('Error in checkGmailForUser', { userId, error: error.message });
        }
    }

    /**
     * Check X (Twitter) for all users
     */
    private async checkXForAllUsers() {
        const client = await pool.connect();
        try {
            // For now, X monitoring is global (not per-user OAuth)
            // In production, you'd store X OAuth tokens per user
            const result = await client.query(
                'SELECT id FROM users WHERE id = 1 LIMIT 1' // Placeholder: monitor for first user
            );

            for (const row of result.rows) {
                try {
                    await this.checkXForUser(row.id);
                } catch (error: any) {
                    logger.error('Error checking X for user', {
                        userId: row.id,
                        error: error.message
                    });
                }
            }
        } finally {
            client.release();
        }
    }

    /**
     * Check X for a specific user
     */
    async checkXForUser(userId: number) {
        try {
            // Check if within wake/sleep time
            if (!await this.isWithinActiveHours(userId)) {
                logger.debug('Outside active hours, skipping X check', { userId });
                return;
            }

            // Fetch recent mentions
            const mentions = await xMonitorService.fetchRecentMentions(20);

            logger.info('Fetched X mentions', { userId, count: mentions.length });

            // Classify and store each mention
            for (const mention of mentions) {
                try {
                    // Check if already stored
                    const existing = await this.isMessageStored(userId, 'twitter', mention.id);
                    if (existing) {
                        continue;
                    }

                    // Classify importance
                    const classification = await messageClassifier.classify(userId, {
                        sender: `@${mention.author}`,
                        content: mention.text,
                        source: 'twitter'
                    });

                    // Store in database
                    await this.storeMessage(userId, {
                        source: 'twitter',
                        messageId: mention.id,
                        sender: `@${mention.author}`,
                        subject: null,
                        content: mention.text,
                        importanceScore: classification.score,
                        classification: classification.category,
                        metadata: {
                            authorId: mention.authorId,
                            url: mention.url,
                            likes: mention.likeCount,
                            replies: mention.replyCount,
                            retweets: mention.retweetCount,
                            reasoning: classification.reasoning
                        }
                    });

                    logger.info('Stored classified mention', {
                        userId,
                        messageId: mention.id,
                        classification: classification.category,
                        score: classification.score
                    });
                } catch (error: any) {
                    logger.error('Error processing mention', {
                        userId,
                        mentionId: mention.id,
                        error: error.message
                    });
                }
            }

            // Update last sync time
            await this.updateLastSync(userId, 'twitter');
        } catch (error: any) {
            logger.error('Error in checkXForUser', { userId, error: error.message });
        }
    }

    /**
     * Check if current time is within user's active hours
     */
    private async isWithinActiveHours(userId: number): Promise<boolean> {
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT wake_time, sleep_time FROM ai_preferences WHERE user_id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                return true; // Default to always active if no preferences
            }

            const { wake_time, sleep_time } = result.rows[0];
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            return currentTime >= wake_time && currentTime <= sleep_time;
        } finally {
            client.release();
        }
    }

    /**
     * Check if message is already stored
     */
    private async isMessageStored(userId: number, source: string, messageId: string): Promise<boolean> {
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT id FROM monitored_messages WHERE user_id = $1 AND source = $2 AND message_id = $3',
                [userId, source, messageId]
            );
            return result.rows.length > 0;
        } finally {
            client.release();
        }
    }

    /**
     * Store monitored message
     */
    private async storeMessage(userId: number, data: any) {
        const client = await pool.connect();
        try {
            await client.query(
                `INSERT INTO monitored_messages 
                 (user_id, source, message_id, sender, subject, content, importance_score, classification, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    userId,
                    data.source,
                    data.messageId,
                    data.sender,
                    data.subject,
                    data.content,
                    data.importanceScore,
                    data.classification,
                    JSON.stringify(data.metadata)
                ]
            );
        } finally {
            client.release();
        }
    }

    /**
     * Update last sync timestamp
     */
    private async updateLastSync(userId: number, source: 'gmail' | 'twitter') {
        const client = await pool.connect();
        try {
            const field = source === 'gmail' ? 'gmail_last_sync' : 'twitter_last_sync';
            await client.query(
                `INSERT INTO ai_preferences (user_id, ${field}, updated_at)
                 VALUES ($1, NOW(), NOW())
                 ON CONFLICT (user_id) DO UPDATE SET ${field} = NOW(), updated_at = NOW()`,
                [userId]
            );
        } finally {
            client.release();
        }
    }
}

export default new MonitoringScheduler();
