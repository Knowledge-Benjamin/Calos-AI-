import { generateContentWithRetry, getModel } from '../config/gemini';
import { pool } from '../config/database';
import logger from '../utils/logger';

export interface ClassificationResult {
    score: number; // 1-10
    category: 'high' | 'medium' | 'low';
    reasoning: string;
}

export interface MessageContext {
    sender: string;
    subject?: string;
    content: string;
    source: 'gmail' | 'twitter';
}

/**
 * Service for classifying messages by importance using Gemini AI
 * Learns from user feedback to improve classification over time
 */
export class MessageClassifier {
    /**
     * Classify a message's importance
     */
    async classify(userId: number, message: MessageContext): Promise<ClassificationResult> {
        try {
            // Get user's learning context (past feedback)
            const learningContext = await this.getLearningContext(userId, message.sender);

            // Build classification prompt
            const prompt = this.buildClassificationPrompt(message, learningContext);

            const model = getModel();
            const result = await generateContentWithRetry(
                model,
                {
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2, // Low temp for consistent classification
                        maxOutputTokens: 200
                    }
                }
            );

            const response = result.response.text();
            const parsed = this.parseClassificationResponse(response);

            logger.info('Message classified', {
                userId,
                sender: message.sender,
                score: parsed.score,
                category: parsed.category
            });

            return parsed;
        } catch (error: any) {
            logger.error('Classification failed', { userId, error: error.message });

            // Default to medium importance on failure
            return {
                score: 5,
                category: 'medium',
                reasoning: 'Classification error, defaulting to medium importance'
            };
        }
    }

    /**
     * Build Gemini prompt for classification
     */
    private buildClassificationPrompt(message: MessageContext, learningContext: string): string {
        const { sender, subject, content, source } = message;

        return `You are an intelligent message classifier for Knowledge's personal AI assistant, Calos.

Analyze this ${source === 'gmail' ? 'email' : 'social media message'} and score its importance (1-10).

**Message:**
From: ${sender}
${subject ? `Subject: ${subject}` : ''}
Content: "${content.substring(0, 1000)}"

${learningContext ? `\n**Learning from past feedback:**\n${learningContext}\n` : ''}

**Scoring Guidelines:**
- **High (8-10):** Urgent, requires immediate action, from important contacts, time-sensitive
- **Medium (5-7):** Important but not urgent, informational, from known contacts
- **Low (1-4):** Newsletters, promotions, automated messages, casual mentions

**Consider:**
- Urgency indicators (deadline, ASAP, urgent, tonight, tomorrow)
- Sender importance (known contact, boss, client vs unknown/automated)
- Content type (action required vs informational vs promotional)
- Personal relevance (directly addressed to user vs mass message)

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "score": 1-10,
  "category": "high|medium|low",
  "reasoning": "brief explanation (one sentence)"
}`;
    }

    /**
     * Parse Gemini's classification response
     */
    private parseClassificationResponse(response: string): ClassificationResult {
        try {
            let cleaned = response.trim();
            if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/```\n?/g, '');
            }

            const parsed = JSON.parse(cleaned);

            // Validate score
            const score = Math.max(1, Math.min(10, parsed.score));

            // Determine category based on score if not provided
            let category = parsed.category;
            if (!category || !['high', 'medium', 'low'].includes(category)) {
                category = score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low';
            }

            return {
                score,
                category,
                reasoning: parsed.reasoning || 'No reasoning provided'
            };
        } catch (error) {
            logger.error('Failed to parse classification response', { error, response });

            // Fallback to medium
            return {
                score: 5,
                category: 'medium',
                reasoning: 'Failed to parse response'
            };
        }
    }

    /**
     * Get learning context from past feedback for similar messages
     */
    private async getLearningContext(userId: number, sender: string): Promise<string> {
        const client = await pool.connect();
        try {
            // Get recent feedback for this sender
            const result = await client.query(
                `SELECT mf.original_score, mf.corrected_score, mf.feedback_text, mm.sender
                 FROM message_feedback mf
                 JOIN monitored_messages mm ON mf.message_id = mm.id
                 WHERE mf.user_id = $1 AND mm.sender ILIKE $2
                 ORDER BY mf.created_at DESC
                 LIMIT 3`,
                [userId, `%${sender}%`]
            );

            if (result.rows.length === 0) {
                return '';
            }

            // Build learning context
            const patterns = result.rows.map((row) => {
                const change = row.corrected_score > row.original_score ? 'increased' : 'decreased';
                return `- Messages from "${row.sender}" were ${change} from ${row.original_score} to ${row.corrected_score}${row.feedback_text ? `: "${row.feedback_text}"` : ''}`;
            });

            return patterns.join('\n');
        } catch (error) {
            logger.error('Error getting learning context', { userId, error });
            return '';
        } finally {
            client.release();
        }
    }

    /**
     * Store user feedback on classification
     */
    async storeFeedback(
        messageId: number,
        userId: number,
        originalScore: number,
        correctedScore: number,
        feedbackText?: string
    ) {
        const client = await pool.connect();
        try {
            await client.query(
                `INSERT INTO message_feedback (message_id, user_id, original_score, corrected_score, feedback_text)
                 VALUES ($1, $2, $3, $4, $5)`,
                [messageId, userId, originalScore, correctedScore, feedbackText]
            );

            logger.info('Feedback stored', { messageId, userId, originalScore, correctedScore });
        } catch (error) {
            logger.error('Error storing feedback', { messageId, userId, error });
            throw error;
        } finally {
            client.release();
        }
    }
}

export default new MessageClassifier();
