import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DAY_TRACKER_URL = 'https://day-tracker-93ly.onrender.com/api';
const AI_ASSISTANT_URL = 'http://localhost:3002';

// Add your Day Tracker credentials here
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

async function getJWTToken() {
    console.log('🔑 Getting JWT token from Day Tracker...\n');

    try {
        const response = await axios.post(`${DAY_TRACKER_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        const token = response.data.data.accessToken;
        console.log('✅ Successfully logged in to Day Tracker');
        console.log('Token:', token.substring(0, 20) + '...\n');
        return token;
    } catch (error: any) {
        console.error('❌ Failed to login to Day Tracker');
        console.error('Error:', error.response?.data || error.message);
        console.log('\n💡 Make sure TEST_USER_EMAIL and TEST_USER_PASSWORD are set in .env');
        console.log('Or create a test user first.\n');
        throw error;
    }
}

async function testChatWithAI(token: string) {
    console.log('🧪 Testing AI Assistant Chat...\n');

    try {
        // Test 1: Health Check
        console.log('1️⃣ Health check...');
        const health = await axios.get(`${AI_ASSISTANT_URL}/health`);
        console.log('✅', health.data.status, '\n');

        // Test 2: Create new session
        console.log('2️⃣ Creating chat session...');
        const sessionResp = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/chat/session`,
            {},
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const sessionId = sessionResp.data.data.sessionId;
        console.log('✅ Session ID:', sessionId, '\n');

        // Test 3: Send first message
        console.log('3️⃣ Sending first message...');
        const msg1 = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/chat/message`,
            {
                message: "Hello! I'm testing the AI assistant. Please introduce yourself and tell me what you can help me with.",
                sessionId
            },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log('✅ AI Response:');
        console.log(msg1.data.data.response);
        console.log('');

        // Test 4: Follow-up message
        console.log('4️⃣ Sending follow-up message...');
        const msg2 = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/chat/message`,
            {
                message: "What are my current active goals?",
                sessionId
            },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log('✅ AI Response:');
        console.log(msg2.data.data.response);
        console.log('');

        // Test 5: Get history
        console.log('5️⃣ Getting conversation history...');
        const history = await axios.get(
            `${AI_ASSISTANT_URL}/api/ai/chat/history?limit=10`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log('✅ Conversation History:');
        console.log(`Total messages: ${history.data.data.length}`);
        history.data.data.slice(-4).forEach((msg: any) => {
            const preview = msg.content.substring(0, 60);
            console.log(`  [${msg.message_type}]: ${preview}...`);
        });

        console.log('\n🎉 All tests passed! AI Assistant is working perfectly!\n');
    } catch (error: any) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        throw error;
    }
}

async function main() {
    try {
        const token = await getJWTToken();
        await testChatWithAI(token);
    } catch (error) {
        process.exit(1);
    }
}

main();
