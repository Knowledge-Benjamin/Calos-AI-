import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

async function applyMonitoringMigration() {
    const client = await pool.connect();

    try {
        const sql = fs.readFileSync(
            path.join(__dirname, '../../database/monitoring-schema.sql'),
            'utf8'
        );

        console.log('🔄 Applying Phase 4 monitoring schema migration...\n');

        await client.query(sql);

        console.log('✅ Monitoring schema migration applied successfully!\n');
        console.log('📊 Created tables:');
        console.log('  - monitored_messages');
        console.log('  - message_feedback');
        console.log('  - ai_preferences');
        console.log('  - gmail_tokens\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

applyMonitoringMigration();
