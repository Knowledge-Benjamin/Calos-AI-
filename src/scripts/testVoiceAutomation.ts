import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DAY_TRACKER_URL = 'https://day-tracker-93ly.onrender.com/api';
const AI_ASSISTANT_URL = 'http://localhost:3002';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

async function testVoiceAutomation() {
    console.log('🎙️ Testing Voice Automation - Calos Speaking!\n');

    try {
        // Step 1: Login
        console.log('1️⃣ Logging in...');
        const loginResp = await axios.post(`${DAY_TRACKER_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        const token = loginResp.data.data.accessToken;
        console.log('✅ Logged in\n');

        // Step 2: Send command to Voice Chat endpoint
        console.log('2️⃣ Sending command to Voice Chat...');
        const message = "What is the status of my TypeScript goal?";
        console.log(`🗣️ User: "${message}"`);

        const voiceResp = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/voice/chat`,
            {
                message,
                generateAudio: true
            },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const data = voiceResp.data.data;
        console.log(`\n🤖 Calos (Text): ${data.response}`);
        console.log(`🔊 Audio URL: ${data.audioUrl}`);

        if (data.audioUrl) {
            // Verify file exists locally (since server is local)
            const filename = path.basename(data.audioUrl);
            const localPath = path.join(__dirname, '../../uploads', filename);

            if (fs.existsSync(localPath)) {
                const stats = fs.statSync(localPath);
                console.log(`✅ Audio file exists: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
            } else {
                console.log(`❌ Audio file not found at: ${localPath}`);
            }
        } else {
            console.log('❌ No audio URL returned');
        }

        console.log('\n✨ Voice automation test completed!');

    } catch (error: any) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

testVoiceAutomation();
