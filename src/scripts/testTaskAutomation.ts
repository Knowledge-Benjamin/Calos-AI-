import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DAY_TRACKER_URL = 'https://day-tracker-93ly.onrender.com/api';
const AI_ASSISTANT_URL = 'http://localhost:3002';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

async function testTaskAutomation() {
    console.log('🤖 Testing Task Automation - Calos in action!\n');

    try {
        // Step 1: Login to Day Tracker
        console.log('1️⃣ Logging in...');
        const loginResp = await axios.post(`${DAY_TRACKER_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        const token = loginResp.data.data.accessToken;
        console.log('✅ Logged in\n');

        // Test 1: Create a daily log
        console.log('═══════════════════════════════════════');
        console.log('TEST 1: Create Daily Log');
        console.log('═══════════════════════════════════════');
        const logMessage = "I worked on the AI assistant for 3 hours and made great progress!";
        console.log(`📝 User: "${logMessage}"`);

        const logResp = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/chat/message`,
            { message: logMessage },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log(`\n🤖 Calos: ${logResp.data.data.response}`);
        console.log(`\n📊 Intent: ${logResp.data.data.intent}`);
        console.log(`📦 Action Result:`, JSON.stringify(logResp.data.data.actionResult, null, 2));
        console.log('');

        // Test 2: Create a goal
        console.log('\n═══════════════════════════════════════');
        console.log('TEST 2: Create New Goal');
        console.log('═══════════════════════════════════════');
        const goalMessage = "Start a 30-day challenge to learn TypeScript";
        console.log(`📝 User: "${goalMessage}"`);

        const goalResp = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/chat/message`,
            { message: goalMessage },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log(`\n🤖 Calos: ${goalResp.data.data.response}`);
        console.log(`\n📊 Intent: ${goalResp.data.data.intent}`);
        console.log(`📦 Action Result:`, JSON.stringify(goalResp.data.data.actionResult, null, 2));
        console.log('');

        // Test 3: Set a reminder
        console.log('\n═══════════════════════════════════════');
        console.log('TEST 3: Create Reminder');
        console.log('═══════════════════════════════════════');
        const reminderMessage = "Remind me to review code tomorrow at 10am";
        console.log(`📝 User: "${reminderMessage}"`);

        const reminderResp = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/chat/message`,
            { message: reminderMessage },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log(`\n🤖 Calos: ${reminderResp.data.data.response}`);
        console.log(`\n📊 Intent: ${reminderResp.data.data.intent}`);
        console.log(`📦 Action Result:`, JSON.stringify(reminderResp.data.data.actionResult, null, 2));
        console.log('');

        // Test 4: Regular chat (no action)
        console.log('\n═══════════════════════════════════════');
        console.log('TEST 4: Regular Conversation');
        console.log('═══════════════════════════════════════');
        const chatMessage = "Hey Calos! How are you doing?";
        console.log(`📝 User: "${chatMessage}"`);

        const chatResp = await axios.post(
            `${AI_ASSISTANT_URL}/api/ai/chat/message`,
            { message: chatMessage },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        console.log(`\n🤖 Calos: ${chatResp.data.data.response}`);
        console.log(`\n📊 Intent: ${chatResp.data.data.intent}`);
        console.log('');

        console.log('\n✨ All tests completed successfully!');
        console.log('\n📝 Summary:');
        console.log('  ✅ Daily log creation');
        console.log('  ✅ Goal creation');
        console.log('  ✅ Reminder setting');
        console.log('  ✅ Regular conversation');
        console.log('');

    } catch (error: any) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
        if (error.response?.status === 500) {
            console.log('\n💡 Check server logs for details');
        }
        process.exit(1);
    }
}

testTaskAutomation();
