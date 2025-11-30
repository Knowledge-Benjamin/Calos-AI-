import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../config/database';
import logger from '../utils/logger';

export interface GmailMessage {
    id: string;
    from: string;
    subject: string;
    snippet: string;
    body: string;
    date: Date;
    labels: string[];
}

export class GmailService {
    private oauth2Client: OAuth2Client;
    private gmail: any;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI || 'http://localhost:3002/api/ai/gmail/callback'
        );
    }

    /**
     * Get authorization URL for OAuth flow
     */
    getAuthUrl(): string {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.modify'
            ],
            prompt: 'consent' // Force to get refresh token
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async getTokensFromCode(code: string) {
        const { tokens } = await this.oauth2Client.getToken(code);
        return tokens;
    }

    /**
     * Save tokens to database for a user
     */
    async saveTokens(userId: number, tokens: any) {
        const client = await pool.connect();
        try {
            await client.query(
                `INSERT INTO gmail_tokens (user_id, access_token, refresh_token, token_type, expiry_date, updated_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (user_id) 
                 DO UPDATE SET 
                    access_token = $2, 
                    refresh_token = $3,
                    token_type = $4,
                    expiry_date = $5,
                    updated_at = NOW()`,
                [userId, tokens.access_token, tokens.refresh_token, tokens.token_type, tokens.expiry_date]
            );
            logger.info('Gmail tokens saved', { userId });
        } finally {
            client.release();
        }
    }

    /**
     * Load tokens from database for a user
     */
    async loadTokens(userId: number) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                'SELECT access_token, refresh_token, token_type, expiry_date FROM gmail_tokens WHERE user_id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            return {
                access_token: result.rows[0].access_token,
                refresh_token: result.rows[0].refresh_token,
                token_type: result.rows[0].token_type,
                expiry_date: result.rows[0].expiry_date
            };
        } finally {
            client.release();
        }
    }

    /**
     * Initialize Gmail API client for a user
     */
    async initializeForUser(userId: number) {
        const tokens = await this.loadTokens(userId);
        if (!tokens) {
            throw new Error('No Gmail tokens found for user. Please authorize first.');
        }

        this.oauth2Client.setCredentials(tokens);

        // Auto-refresh tokens
        this.oauth2Client.on('tokens', async (refreshedTokens) => {
            logger.info('Gmail tokens auto-refreshed', { userId });
            await this.saveTokens(userId, { ...tokens, ...refreshedTokens });
        });

        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    /**
     * Fetch unread emails from last 24 hours
     */
    async fetchRecentUnreadEmails(userId: number, maxResults: number = 10): Promise<GmailMessage[]> {
        await this.initializeForUser(userId);

        try {
            // Calculate timestamp for 24 hours ago
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const afterTimestamp = Math.floor(yesterday.getTime() / 1000);

            // Search for unread messages from last 24 hours
            const response = await this.gmail.users.messages.list({
                userId: 'me',
                q: `is:unread after:${afterTimestamp}`,
                maxResults
            });

            const messages = response.data.messages || [];
            const emailDetails: GmailMessage[] = [];

            // Fetch full details for each message
            for (const message of messages) {
                try {
                    const detail = await this.gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                        format: 'full'
                    });

                    const headers = detail.data.payload.headers;
                    const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
                    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No Subject)';
                    const date = headers.find((h: any) => h.name === 'Date')?.value || new Date();

                    // Extract body
                    let body = detail.data.snippet || '';
                    if (detail.data.payload.body?.data) {
                        body = Buffer.from(detail.data.payload.body.data, 'base64').toString('utf-8');
                    } else if (detail.data.payload.parts) {
                        // Multi-part message, get text/plain part
                        const textPart = detail.data.payload.parts.find((p: any) => p.mimeType === 'text/plain');
                        if (textPart?.body?.data) {
                            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                        }
                    }

                    emailDetails.push({
                        id: message.id,
                        from,
                        subject,
                        snippet: detail.data.snippet || '',
                        body: body.substring(0, 5000), // Limit to 5000 chars
                        date: new Date(date),
                        labels: detail.data.labelIds || []
                    });
                } catch (error) {
                    logger.error('Error fetching email detail', { messageId: message.id, error });
                }
            }

            logger.info('Fetched Gmail messages', { userId, count: emailDetails.length });
            return emailDetails;
        } catch (error: any) {
            logger.error('Error fetching Gmail messages', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Mark email as read
     */
    async markAsRead(userId: number, messageId: string) {
        await this.initializeForUser(userId);

        try {
            await this.gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    removeLabelIds: ['UNREAD']
                }
            });
            logger.info('Marked email as read', { userId, messageId });
        } catch (error: any) {
            logger.error('Error marking email as read', { userId, messageId, error: error.message });
        }
    }
}

export default new GmailService();
