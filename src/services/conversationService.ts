import { query } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export interface ConversationMessage {
    id: number;
    userId: number;
    sessionId: string;
    messageType: 'user' | 'assistant';
    content: string;
    audioUrl?: string;
    intent?: string;
    entities?: any;
    createdAt: Date;
}

export interface ConversationContext {
    recentMessages: ConversationMessage[];
    userPreferences: any;
    learnedPatterns: any;
}

export class ConversationService {
    /**
     * Store a conversation message
     */
    async storeMessage(
        userId: number,
        sessionId: string,
        messageType: 'user' | 'assistant',
        content: string,
        audioUrl?: string,
        intent?: string,
        entities?: any
    ): Promise<ConversationMessage> {
        try {
            const result = await query<ConversationMessage>(
                `INSERT INTO ai_conversations (user_id, session_id, message_type, content, audio_url, intent, entities)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [userId, sessionId, messageType, content, audioUrl || null, intent || null, entities ? JSON.stringify(entities) : null]
            );

            logger.info('Stored conversation message', { userId, sessionId, messageType });
            return result.rows[0];
        } catch (error) {
            logger.error('Error storing conversation message:', error);
            throw error;
        }
    }

    /**
     * Get conversation history for a session
     */
    async getSessionHistory(sessionId: string, limit: number = 50): Promise<ConversationMessage[]> {
        try {
            const result = await query<ConversationMessage>(
                `SELECT * FROM ai_conversations 
                 WHERE session_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [sessionId, limit]
            );

            return result.rows.reverse(); // Return in chronological order
        } catch (error) {
            logger.error('Error fetching session history:', error);
            throw error;
        }
    }

    /**
     * Get recent conversation history for a user (across all sessions)
     */
    async getUserHistory(userId: number, limit: number = 100): Promise<ConversationMessage[]> {
        try {
            const result = await query<ConversationMessage>(
                `SELECT * FROM ai_conversations 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [userId, limit]
            );

            return result.rows.reverse();
        } catch (error) {
            logger.error('Error fetching user history:', error);
            throw error;
        }
    }

    /**
     * Get conversation context (history + preferences + patterns)
     */
    async getContext(userId: number, sessionId: string): Promise<ConversationContext> {
        try {
            // Get recent messages
            const recentMessages = await this.getUserHistory(userId, 20);

            // Get user preferences and learned patterns
            const contextResult = await query<{ preferences: any; learned_patterns: any }>(
                `SELECT preferences, learned_patterns FROM ai_context WHERE user_id = $1`,
                [userId]
            );

            const userPreferences = contextResult.rows[0]?.preferences || {};
            const learnedPatterns = contextResult.rows[0]?.learned_patterns || {};

            return {
                recentMessages,
                userPreferences,
                learnedPatterns
            };
        } catch (error) {
            logger.error('Error fetching conversation context:', error);
            throw error;
        }
    }

    /**
     * Update user context (preferences/patterns)
     */
    async updateContext(userId: number, preferences?: any, learnedPatterns?: any): Promise<void> {
        try {
            await query(
                `INSERT INTO ai_context (user_id, preferences, learned_patterns, last_interaction)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (user_id) 
                 DO UPDATE SET 
                   preferences = COALESCE($2, ai_context.preferences),
                   learned_patterns = COALESCE($3, ai_context.learned_patterns),
                   last_interaction = NOW()`,
                [userId, preferences ? JSON.stringify(preferences) : null, learnedPatterns ? JSON.stringify(learnedPatterns) : null]
            );

            logger.info('Updated user context', { userId });
        } catch (error) {
            logger.error('Error updating user context:', error);
            throw error;
        }
    }

    /**
     * Create a new session ID
     */
    createSession(): string {
        return uuidv4();
    }

    /**
     * Build conversation history for Gemini (formatted)
     */
    formatHistoryForGemini(messages: ConversationMessage[]): any[] {
        return messages.map(msg => ({
            role: msg.messageType === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));
    }
}

export default new ConversationService();
