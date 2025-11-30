import axios from 'axios';
import logger from '../utils/logger';

export interface XMention {
    id: string;
    author: string;
    authorId: string;
    text: string;
    createdAt: Date;
    likeCount: number;
    replyCount: number;
    retweetCount: number;
    url: string;
}

export interface XDM {
    id: string;
    senderId: string;
    senderUsername: string;
    text: string;
    createdAt: Date;
}

export class XMonitorService {
    private bearerToken: string;
    private baseUrl = 'https://api.twitter.com/2';

    constructor() {
        this.bearerToken = process.env.TWITTER_BEARER_TOKEN || '';
        if (!this.bearerToken) {
            logger.warn('TWITTER_BEARER_TOKEN not configured');
        }
    }

    /**
     * Get authenticated user's ID and username
     */
    async getAuthenticatedUser() {
        try {
            const response = await axios.get(`${this.baseUrl}/users/me`, {
                headers: { 'Authorization': `Bearer ${this.bearerToken}` }
            });
            return {
                id: response.data.data.id,
                username: response.data.data.username
            };
        } catch (error: any) {
            logger.error('Error fetching authenticated user', { error: error.message });
            throw error;
        }
    }

    /**
     * Fetch recent mentions (last 24 hours)
     */
    async fetchRecentMentions(maxResults: number = 10): Promise<XMention[]> {
        try {
            const user = await this.getAuthenticatedUser();

            // Calculate timestamp for 24 hours ago
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const startTime = yesterday.toISOString();

            const response = await axios.get(`${this.baseUrl}/users/${user.id}/mentions`, {
                headers: { 'Authorization': `Bearer ${this.bearerToken}` },
                params: {
                    'tweet.fields': 'created_at,public_metrics,author_id',
                    'expansions': 'author_id',
                    'user.fields': 'username',
                    'max_results': Math.min(maxResults, 100),
                    'start_time': startTime
                }
            });

            const tweets = response.data.data || [];
            const users = response.data.includes?.users || [];

            const mentions: XMention[] = tweets.map((tweet: any) => {
                const author = users.find((u: any) => u.id === tweet.author_id);
                return {
                    id: tweet.id,
                    author: author?.username || 'unknown',
                    authorId: tweet.author_id,
                    text: tweet.text,
                    createdAt: new Date(tweet.created_at),
                    likeCount: tweet.public_metrics.like_count,
                    replyCount: tweet.public_metrics.reply_count,
                    retweetCount: tweet.public_metrics.retweet_count,
                    url: `https://twitter.com/${author?.username}/status/${tweet.id}`
                };
            });

            logger.info('Fetched X mentions', { count: mentions.length });
            return mentions;
        } catch (error: any) {
            logger.error('Error fetching X mentions', { error: error.message });
            throw error;
        }
    }

    /**
     * Fetch recent DMs (last 24 hours)
     * Note: Requires DM scope which may not be available in Basic tier
     */
    async fetchRecentDMs(maxResults: number = 10): Promise<XDM[]> {
        try {
            // Calculate timestamp for 24 hours ago
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const startTime = yesterday.toISOString();

            const response = await axios.get(`${this.baseUrl}/dm_events`, {
                headers: { 'Authorization': `Bearer ${this.bearerToken}` },
                params: {
                    'dm_event.fields': 'created_at,sender_id,text',
                    'expansions': 'sender_id',
                    'user.fields': 'username',
                    'max_results': Math.min(maxResults, 100),
                    'start_time': startTime
                }
            });

            const events = response.data.data || [];
            const users = response.data.includes?.users || [];

            const dms: XDM[] = events.map((event: any) => {
                const sender = users.find((u: any) => u.id === event.sender_id);
                return {
                    id: event.id,
                    senderId: event.sender_id,
                    senderUsername: sender?.username || 'unknown',
                    text: event.text,
                    createdAt: new Date(event.created_at)
                };
            });

            logger.info('Fetched X DMs', { count: dms.length });
            return dms;
        } catch (error: any) {
            // DM access might not be available in Basic tier
            if (error.response?.status === 403) {
                logger.warn('X DM access not available (requires elevated access)');
                return [];
            }
            logger.error('Error fetching X DMs', { error: error.message });
            throw error;
        }
    }
}

export default new XMonitorService();
