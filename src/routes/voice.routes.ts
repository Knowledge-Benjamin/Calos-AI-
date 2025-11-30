import express, { Request, Response } from 'express';
import Joi from 'joi';
import aiService from '../services/aiService';
import voiceService from '../services/voiceService';
import logger from '../utils/logger';

const router = express.Router();

// Validation schema
const voiceMessageSchema = Joi.object({
    message: Joi.string().min(1).max(5000).required(),
    sessionId: Joi.string().uuid().optional(),
    generateAudio: Joi.boolean().default(true)
});

/**
 * POST /api/ai/voice/chat
 * Process a voice message (already transcribed by client)
 * Returns text response + optional audio URL
 */
router.post('/chat', async (req: Request, res: Response) => {
    try {
        const { error, value } = voiceMessageSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { message, sessionId, generateAudio } = value;
        const userId = (req as any).user.id;

        // Process chat message
        const chatResponse = await aiService.chat(userId, message, sessionId);

        // Generate TTS audio if requested
        let audioUrl;
        if (generateAudio) {
            audioUrl = await voiceService.textToSpeech({
                text: chatResponse.response
            });
        }

        res.json({
            success: true,
            data: {
                response: chatResponse.response,
                audioUrl,
                sessionId: chatResponse.sessionId
            }
        });
    } catch (error) {
        logger.error('Voice chat error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing voice message'
        });
    }
});

/**
 * POST /api/ai/voice/synthesize
 * Generate audio from text (standalone TTS)
 */
router.post('/synthesize', async (req: Request, res: Response) => {
    try {
        const { text } = req.body;

        if (!text || text.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Text is required'
            });
        }

        if (text.length > 5000) {
            return res.status(400).json({
                success: false,
                message: 'Text too long (max 5000 characters)'
            });
        }

        const audioUrl = await voiceService.textToSpeech({ text });

        res.json({
            success: true,
            data: { audioUrl }
        });
    } catch (error) {
        logger.error('TTS synthesis error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating audio'
        });
    }
});

export default router;
