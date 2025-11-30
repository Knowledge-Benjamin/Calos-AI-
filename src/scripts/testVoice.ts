import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DAY_TRACKER_URL = 'https://day-tracker-93ly.onrender.com/api';
const AI_ASSISTANT_URL = 'http://localhost:3002';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

async function testVoice() {
    console.log('🎤 Testing Voice Integration...\n');

    try {
        // Step 1: Get JWT token
        console.log('1️⃣ Getting JWT token...');
        const loginResp = await axios.post(`${DAY_TRACKER_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        const token = loginResp.data.data.accessToken;
        console.log('✅ Logged in');

        // Decode token to check payload
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
        console.log('🔍 Token Payload:', payload);
        console.log('');

        // Step 2: Test TTS synthesis
        console.log('2️⃣ Testing Text-to-Speech...');
        const ttsResp = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/voice/synthesize`,
            { text: "Hello! This is a test of the text to speech system." },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const audioUrl = ttsResp.data.data.audioUrl;
        console.log('✅ Audio generated:', audioUrl);

        // Download and verify audio file
        const audioFileResp = await axios.get(`${AI_ASSISTANT_URL}${audioUrl}`, {
            responseType: 'arraybuffer'
        });
        console.log(`✅ Audio file downloaded (${audioFileResp.data.byteLength} bytes)\n`);

        // Step 3: Test voice chat (with TTS)
        console.log('3️⃣ Testing voice chat...');
        const voiceChatResp = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/voice/chat`,
            {
                message: "Hello AI! Can you tell me a motivational quote?",
                generateAudio: true
            },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log('✅ Voice chat response:');
        console.log('  Text:', voiceChatResp.data.data.response);
        console.log('  Audio URL:', voiceChatResp.data.data.audioUrl);
        console.log('  Session ID:', voiceChatResp.data.data.sessionId);
        console.log('');

        // Step 4: Test voice chat without audio
        console.log('4️⃣ Testing voice chat (text only)...');
        const textOnlyResp = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/voice/chat`,
            {
                message: "What can you help me with?",
                generateAudio: false,
                sessionId: voiceChatResp.data.data.sessionId
            },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log('✅ Text-only response:');
        console.log('  Text:', textOnlyResp.data.data.response);
        console.log('  Audio URL:', textOnlyResp.data.data.audioUrl || 'None (text-only mode)');
        console.log('');

        console.log('🎉 All voice tests passed!\n');
        console.log('📝 Summary:');
        console.log('  - TTS working ✅');
        console.log('  - Voice chat with audio ✅');
        console.log('  - Voice chat text-only ✅');
        console.log('  - Audio file serving ✅');
        console.log('');

    } catch (error: any) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response?.status === 500) {
            console.log('\n💡 Check if Google Cloud TTS is configured correctly:');
            console.log('   - GOOGLE_CLOUD_API_KEY or GOOGLE_APPLICATION_CREDENTIALS set?');
            console.log('   - Text-to-Speech API enabled in Google Cloud Console?');
        }
        process.exit(1);
    }
}

testVoice();
