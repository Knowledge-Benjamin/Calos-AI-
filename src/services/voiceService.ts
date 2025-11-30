import * as textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export interface TTSOptions {
    text: string;
    languageCode?: string;
    voiceName?: string;
    speakingRate?: number;
}

export class VoiceService {
    private client: textToSpeech.TextToSpeechClient;
    private uploadDir: string;

    constructor() {
        // Initialize Google Cloud TTS client
        // Prioritize API Key if Service Account is not set
        const options: any = {};

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        } else if (process.env.GOOGLE_CLOUD_API_KEY) {
            // Use API Key (fallback)
            options.apiKey = process.env.GOOGLE_CLOUD_API_KEY;
        }

        this.client = new textToSpeech.TextToSpeechClient(options);

        this.uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }

        logger.info('VoiceService initialized', {
            usingServiceAccount: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
            usingApiKey: !!process.env.GOOGLE_CLOUD_API_KEY
        });
    }

    /**
     * Convert text to speech using Google Cloud TTS
     * Returns path to generated audio file
     */
    async textToSpeech(options: TTSOptions): Promise<string> {
        try {
            const {
                text,
                languageCode = 'en-US',
                voiceName = 'en-US-Neural2-C', // Female voice
                speakingRate = 1.0
            } = options;

            // Clean text for speech (remove markdown)
            const cleanText = this.cleanTextForSpeech(text);

            // Construct the request
            const request: textToSpeech.protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
                input: { text: cleanText },
                voice: {
                    languageCode,
                    name: voiceName,
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate,
                    pitch: 0,
                },
            };

            // Generate speech
            const [response] = await this.client.synthesizeSpeech(request);

            // Generate unique filename
            const filename = `tts-${uuidv4()}.mp3`;
            const filePath = path.join(this.uploadDir, filename);

            // Write audio content to file
            if (response.audioContent) {
                fs.writeFileSync(filePath, response.audioContent, 'binary');
                logger.info('TTS audio generated', { filename, textLength: text.length });

                // Return relative path that can be served via /uploads endpoint
                return `/uploads/${filename}`;
            } else {
                throw new Error('No audio content returned from TTS service');
            }
        } catch (error: any) {
            logger.error('Error generating TTS audio:', {
                message: error.message,
                code: error.code,
                details: error.details
            });
            throw error;
        }
    }

    /**
     * Clean up old audio files (older than 1 hour)
     */
    async cleanupOldAudio(): Promise<void> {
        try {
            const files = fs.readdirSync(this.uploadDir);
            const oneHourAgo = Date.now() - (60 * 60 * 1000);

            let deletedCount = 0;
            for (const file of files) {
                if (file.startsWith('tts-')) {
                    const filePath = path.join(this.uploadDir, file);
                    const stats = fs.statSync(filePath);

                    if (stats.mtimeMs < oneHourAgo) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            }

            if (deletedCount > 0) {
                logger.info(`Cleaned up ${deletedCount} old TTS audio files`);
            }
        } catch (error) {
            logger.error('Error cleaning up audio files:', error);
        }
    }

    /**
     * Clean text for speech synthesis by removing markdown and special characters
     */
    private cleanTextForSpeech(text: string): string {
        return text
            .replace(/\*\*/g, '')       // Remove bold **
            .replace(/\*/g, '')         // Remove italic/bullet *
            .replace(/__/g, '')         // Remove bold __
            .replace(/`/g, '')          // Remove code `
            .replace(/#{1,6}\s/g, '')   // Remove headers #
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
            .trim();
    }
}

export default new VoiceService();
