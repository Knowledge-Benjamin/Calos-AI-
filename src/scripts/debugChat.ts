import aiService from '../services/aiService';
import conversationService from '../services/conversationService';
import { query } from '../config/database';

async function debugChat() {
    console.log('🔍 Debugging AI Chat Service...\n');

    try {
        // Step 1: Test database connection
        console.log('1️⃣ Testing database...');
        const dbTest = await query('SELECT COUNT(*) FROM users');
        console.log('✅ Database connected, users count:', dbTest.rows[0].count);
        console.log('');

        // Step 2: Test conversation service
        console.log('2️⃣ Testing conversation service...');
        const sessionId = conversationService.createSession();
        console.log('✅ Session created:', sessionId);
        console.log('');

        // Step 3: Test AI service with a real user
        console.log('3️⃣ Testing AI service...');
        console.log('Getting first user from database...');
        const userResult = await query('SELECT id, email FROM users LIMIT 1');

        if (userResult.rows.length === 0) {
            console.log('❌ No users found in database. Please create a user first.');
            process.exit(1);
        }

        const userId = userResult.rows[0].id;
        console.log(`Using user ID: ${userId} (${userResult.rows[0].email})`);
        console.log('');

        console.log('4️⃣ Sending test message to AI...');
        const response = await aiService.chat(
            userId,
            "Hello! Please introduce yourself.",
            sessionId
        );

        console.log('✅ AI Response received!');
        console.log('Response:', response.response);
        console.log('Session ID:', response.sessionId);
        console.log('');

        console.log('5️⃣ Checking database for stored messages...');
        const messages = await conversationService.getSessionHistory(sessionId, 10);
        console.log(`✅ Found ${messages.length} messages in database`);
        messages.forEach((msg, i) => {
            console.log(`  ${i + 1}. [${msg.messageType}]: ${msg.content.substring(0, 50)}...`);
        });

        console.log('\n🎉 All debug tests passed!\n');
        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Debug test failed:');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

debugChat();
