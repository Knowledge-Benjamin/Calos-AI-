import { generateContentWithRetry, getModel } from '../config/gemini';
import logger from '../utils/logger';

export enum Intent {
  CREATE_DAILY_LOG = 'create_log',
  CREATE_GOAL = 'create_goal',
  UPDATE_GOAL = 'update_goal',
  CREATE_REMINDER = 'create_reminder',
  GET_GOAL_STATUS = 'get_status',
  GET_TODAY_SUMMARY = 'get_summary',
  CHAT_ONLY = 'chat'
}

export interface IntentAnalysisResult {
  intent: Intent;
  entities: Record<string, any>;
  confidence: number;
  rawMessage: string;
}

/**
 * Service for analyzing user messages and detecting actionable intents
 * Uses Gemini AI to extract structured data from natural language
 */
export class IntentService {
  /**
   * Analyze a user message to determine intent and extract entities
   */
  async analyzeIntent(message: string, currentDate: Date = new Date()): Promise<IntentAnalysisResult> {
    const prompt = this.buildIntentPrompt(message, currentDate);

    try {
      const model = getModel();

      // Use generateContentWithRetry correctly: model first, then prompt/config
      const result = await generateContentWithRetry(
        model,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,  // Low temperature for consistent parsing
            maxOutputTokens: 500
          }
        }
      );

      const response = result.response.text();
      const parsed = this.parseIntentResponse(response);

      logger.info('Intent analyzed', {
        message: message.substring(0, 50),
        intent: parsed.intent,
        confidence: parsed.confidence
      });

      return parsed;
    } catch (error) {
      logger.error('Intent analysis failed', error);

      // Default to chat if analysis fails
      return {
        intent: Intent.CHAT_ONLY,
        entities: {},
        confidence: 1.0,
        rawMessage: message
      };
    }
  }

  /**
   * Build Gemini prompt for intent recognition
   */
  private buildIntentPrompt(message: string, currentDate: Date): string {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

    return `You are Calos, a personal AI assistant for Knowledge. You analyze messages to detect actionable commands for Day Tracker (a goal tracking app).

Today is ${dayOfWeek}, ${dateStr}.

User message: "${message}"

Determine the user's intent and extract entities. Respond ONLY with valid JSON (no markdown, no explanation).

Possible intents:
- create_log: User talking about something they DID (past/present tense). Keywords: "I did", "I worked", "I practiced", "today I"
- create_goal: User wants to START a NEW goal/challenge. Keywords: "create goal", "start", "begin", "new goal"
- create_reminder: User wants to be REMINDED of something. Keywords: "remind me", "set reminder", "don't forget"
- get_status: User asking about their PROGRESS. Keywords: "how am I doing", "progress", "status"
- get_summary: User asking for TODAY'S summary. Keywords: "what did I do", "today's summary"
- chat: General conversation, NO action needed

Output JSON format:
{
  "intent": "create_log|create_goal|create_reminder|get_status|get_summary|chat",
  "entities": {
    "goalKeyword": "inferred goal name (if applicable)",
    "activity": "what user did (for create_log)",
    "goodThing": "positive thing (for create_log)",
    "logDate": "YYYY-MM-DD (for create_log, default to today)",
    "title": "goal/reminder title (for create_goal/create_reminder)",
    "description": "description (for create_goal)",
    "durationDays": number (for create_goal),
    "startDate": "YYYY-MM-DD (for create_goal, default to today)",
    "plannedDate": "YYYY-MM-DDTHH:mm:ssZ (for create_reminder)"
  },
  "confidence": 0.0-1.0
}

Examples:

Message: "I practiced guitar for 30 minutes today"
{
  "intent": "create_log",
  "entities": {
    "goalKeyword": "guitar",
    "activity": "practiced guitar for 30 minutes",
    "logDate": "${dateStr}"
  },
  "confidence": 0.95
}

Message: "Start a 90-day challenge to learn Python"
{
  "intent": "create_goal",
  "entities": {
    "title": "Learn Python",
    "description": "90-day learning challenge",
    "durationDays": 90,
    "startDate": "${dateStr}"
  },
  "confidence": 0.9
}

Message: "Remind me to call the dentist next Tuesday at 2pm"
{
  "intent": "create_reminder",
  "entities": {
    "title": "Call the dentist",
    "plannedDate": "2025-12-05T14:00:00Z"
  },
  "confidence": 0.92
}

Message: "How's my progress on the AI project?"
{
  "intent": "get_status",
  "entities": {
    "goalKeyword": "AI project"
  },
  "confidence": 0.88
}

Message: "What did I accomplish today?"
{
  "intent": "get_summary",
  "entities": {
    "logDate": "${dateStr}"
  },
  "confidence": 0.93
}

Message: "Hello! How are you?"
{
  "intent": "chat",
  "entities": {},
  "confidence": 1.0
}

Now analyze: "${message}"

Respond with ONLY the JSON object, no other text.`;
  }

  /**
   * Parse Gemini's response into structured intent data
   */
  private parseIntentResponse(response: string): IntentAnalysisResult {
    try {
      // Remove markdown code blocks if present
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(cleaned);

      // Validate intent
      if (!Object.values(Intent).includes(parsed.intent)) {
        logger.warn('Invalid intent detected, defaulting to chat', { intent: parsed.intent });
        return {
          intent: Intent.CHAT_ONLY,
          entities: {},
          confidence: 1.0,
          rawMessage: response
        };
      }

      return {
        intent: parsed.intent as Intent,
        entities: parsed.entities || {},
        confidence: parsed.confidence || 0.5,
        rawMessage: response
      };
    } catch (error) {
      logger.error('Failed to parse intent response', { error, response });

      // Fallback to chat
      return {
        intent: Intent.CHAT_ONLY,
        entities: {},
        confidence: 1.0,
        rawMessage: response
      };
    }
  }

  /**
   * Check if an intent should be automatically executed without confirmation
   */
  shouldAutoExecute(result: IntentAnalysisResult): boolean {
    const threshold = parseFloat(process.env.AUTO_EXECUTE_THRESHOLD || '0.9');
    return result.confidence >= threshold;
  }

  /**
   * Check if an intent requires user confirmation
   */
  needsConfirmation(result: IntentAnalysisResult): boolean {
    const minThreshold = parseFloat(process.env.INTENT_CONFIDENCE_THRESHOLD || '0.7');
    return result.confidence < minThreshold && result.confidence >= 0.5;
  }
}

export default new IntentService();
