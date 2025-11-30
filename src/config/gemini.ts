import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required');
}

// Initialize Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configuration
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-09-2025';

export const getModel = () => {
    return genAI.getGenerativeModel({ model: modelName });
};

// Generation configuration
export const generationConfig = {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
};

// Conversational generation config (more creative)
export const conversationalConfig = {
    temperature: 0.9,
    topP: 0.95,
    topK: 50,
    maxOutputTokens: 2048,
};

// Action extraction config (more precise)
export const actionExtractionConfig = {
    temperature: 0.3,
    topP: 0.9,
    topK: 20,
    maxOutputTokens: 1024,
};

// Helper function with exponential backoff
export const generateContentWithRetry = async (model: any, prompt: string | any): Promise<any> => {
    const maxRetries = 3;
    const baseDelay = 2000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            return result;
        } catch (error: any) {
            if (attempt === maxRetries) throw error;

            if (error.status === 429 || error.status === 503) {
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
                console.log(`⚠️ Gemini API rate limit. Retrying in ${Math.round(delay)}ms (${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            throw error;
        }
    }
};

console.log(`🤖 Gemini AI initialized with model: ${modelName}`);

export default genAI;
