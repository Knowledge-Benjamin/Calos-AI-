import { getModel, conversationalConfig, generateContentWithRetry } from '../config/gemini';
import conversationService from './conversationService';
import intentService, { Intent } from './intentService';
import dailyLogCreator from './actions/dailyLogCreator';
import goalCreator from './actions/goalCreator';
import reminderCreator from './actions/reminderCreator';
import logger from '../utils/logger';

export interface ChatResponse {
    response: string;
    intent?: string;
    entities?: any;
    actionResult?: any;
    sessionId: string;
}

export class AIService {
    /**
     * Process a chat message from user with task automation
     */
    async chat(
        userId: number,
        message: string,
        sessionId?: string,
        jwtToken?: string
    ): Promise<ChatResponse> {
        try {
            // Create or use existing session
            const currentSessionId = sessionId || conversationService.createSession();

            // Get conversation context
            const context = await conversationService.getContext(userId, currentSessionId);

            // Analyze intent if JWT token provided (enables task automation)
            let intentResult;
            let actionResult;

            if (jwtToken) {
                intentResult = await intentService.analyzeIntent(message);

                // Execute action if actionable intent detected
                if (intentResult.intent !== Intent.CHAT_ONLY && intentResult.confidence > 0.6) {
                    actionResult = await this.executeAction(intentResult, jwtToken);
                }
            }

            // Build system prompt with context and action result
            const systemPrompt = this.buildSystemPrompt(context, actionResult);

            // Build conversation history
            const history = conversationService.formatHistoryForGemini(context.recentMessages);

            // Get Gemini model
            const model = getModel();

            // Start chat with history
            const chat = model.startChat({
                generationConfig: conversationalConfig,
                history: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    { role: 'model', parts: [{ text: 'Understood! Ready to assist you, Knowledge.' }] },
                    ...history
                ]
            });

            // Send user message
            const result = await generateContentWithRetry(
                { generateContent: (prompt: any) => chat.sendMessage(prompt) },
                message
            );

            const responseText = result.response.text();

            // Store messages
            await conversationService.storeMessage(userId, currentSessionId, 'user', message);
            await conversationService.storeMessage(userId, currentSessionId, 'assistant', responseText);
            await conversationService.updateContext(userId);

            logger.info('Chat processed successfully', {
                userId,
                sessionId: currentSessionId,
                intent: intentResult?.intent,
                actionExecuted: !!actionResult
            });

            return {
                response: responseText,
                intent: intentResult?.intent,
                entities: intentResult?.entities,
                actionResult,
                sessionId: currentSessionId
            };
        } catch (error) {
            logger.error('Error processing chat:', error);
            throw error;
        }
    }

    /**
     * Execute action based on detected intent
     */
    private async executeAction(intentResult: any, jwtToken: string): Promise<any> {
        const { intent, entities } = intentResult;

        try {
            switch (intent) {
                case Intent.CREATE_DAILY_LOG:
                    return await dailyLogCreator.createLog({
                        goalKeyword: entities.goalKeyword,
                        activity: entities.activity,
                        goodThing: entities.goodThing,
                        logDate: entities.logDate,
                        jwtToken
                    });

                case Intent.CREATE_GOAL:
                    return await goalCreator.createGoal({
                        title: entities.title,
                        description: entities.description,
                        durationDays: entities.durationDays,
                        startDate: entities.startDate,
                        jwtToken
                    });

                case Intent.CREATE_REMINDER:
                    return await reminderCreator.createReminder({
                        title: entities.title,
                        description: entities.description,
                        plannedDate: entities.plannedDate,
                        goalKeyword: entities.goalKeyword,
                        jwtToken
                    });

                default:
                    return null;
            }
        } catch (error) {
            logger.error('Action execution failed', { intent, error });
            return {
                success: false,
                message: 'Failed to execute action'
            };
        }
    }

    /**
     * Build system prompt with user context and action results
     */
    private buildSystemPrompt(context: any, actionResult?: any): string {
        const { userPreferences, learnedPatterns } = context;

        let prompt = `You are Calos, Knowledge's personal AI assistant integrated with Day Tracker.

Your personality:
- You are Knowledge's dedicated personal assistant
- You're friendly, proactive, and conversational
- You remember everything and learn from every interaction
- You celebrate progress and offer genuine encouragement
- You're efficient but warm in communication

Your capabilities:
1. Track daily activities and progress through natural conversation
2. Create goals, logs, and reminders automatically
3. Provide insights and motivation based on patterns
4. Monitor emails, social media, and calendar (future)
5. Draft documents and emails when requested (future)

User Context:
- Preferences: ${JSON.stringify(userPreferences)}
- Learned Patterns: ${JSON.stringify(learnedPatterns)}

Guidelines:
- Keep responses concise but warm
- Use contractions and natural language
- Celebrate wins, no matter how small
- Be proactive with suggestions
- Reference past conversations when relevant
- Confirm actions clearly when tasks are automated`;

        if (actionResult) {
            prompt += `\n\nACTION RESULT: ${JSON.stringify(actionResult)}
Acknowledge this action naturally in your response. If it succeeded, confirm what was done. If it failed, explain the issue helpfully.`;
        }

        return prompt;
    }
}

export default new AIService();
