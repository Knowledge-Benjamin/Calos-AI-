import * as textToSpeech from '@google-cloud/text-to-speech';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

async function debugTTS() {
    console.log('🔍 Debugging Google Cloud TTS...\n');

    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    console.log('API Key present:', !!apiKey);
    if (apiKey) {
        console.log('API Key length:', apiKey.length);
        console.log('API Key start:', apiKey.substring(0, 5) + '...');
    }

    try {
        const client = new textToSpeech.TextToSpeechClient({
            apiKey: apiKey
        });

        console.log('✅ Client initialized');

        const request = {
            input: { text: 'Hello, this is a test.' },
            voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' as const },
            audioConfig: { audioEncoding: 'MP3' as const },
        };

        console.log('📡 Sending request to Google Cloud...');
        const [response] = await client.synthesizeSpeech(request);
        console.log('✅ Response received');

        if (response.audioContent) {
            console.log('✅ Audio content received');
            const outFile = path.join(__dirname, 'debug-output.mp3');
            fs.writeFileSync(outFile, response.audioContent, 'binary');
            console.log(`✅ Audio saved to ${outFile}`);
        } else {
            console.error('❌ No audio content in response');
        }

    } catch (error: any) {
        console.error('\n❌ TTS Error:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('Details:', error.details);

        if (error.message.includes('API has not been used')) {
            console.log('\n💡 TIP: Enable Cloud Text-to-Speech API in Google Cloud Console');
            console.log('   https://console.cloud.google.com/apis/library/texttospeech.googleapis.com');
        }
    }
}

debugTTS();
