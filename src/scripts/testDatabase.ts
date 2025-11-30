import { Pool } from 'pg';

const connectionString = 'postgresql://day_tracker_user:LEHonc3cOsHnF23gSWa261psEzXcioUO@dpg-d4kh9ejuibrs73fgapk0-a.oregon-postgres.render.com/day_tracker';

async function testConnection() {
    console.log('🔌 Testing PostgreSQL connection...\n');

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        max: 1
    });

    try {
        console.log('Attempting to connect...');
        const start = Date.now();

        const client = await pool.connect();
        const duration = Date.now() - start;

        console.log(`✅ Connected successfully in ${duration}ms\n`);

        // Test query
        console.log('Running test query...');
        const result = await client.query('SELECT COUNT(*) as count FROM users');
        console.log(`✅ Query successful: ${result.rows[0].count} users found\n`);

        // Test ai_conversations table
        console.log('Checking AI tables...');
        const aiResult = await client.query('SELECT COUNT(*) as count FROM ai_conversations');
        console.log(`✅ ai_conversations table exists: ${aiResult.rows[0].count} conversations\n`);

        client.release();
        await pool.end();

        console.log('✨ Database connection test PASSED!');
        process.exit(0);

    } catch (error: any) {
        console.error('❌ Connection test FAILED:', error.message);
        console.error('\nError details:', {
            code: error.code,
            errno: error.errno,
            syscall: error.syscall
        });
        process.exit(1);
    }
}

testConnection();
