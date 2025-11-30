import pool, { query } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

async function applyMigration() {
    try {
        logger.info('Starting database migration...');

        // Read schema file
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        // Execute migration
        await query(schema);

        logger.info('✅ Database migration completed successfully');

        // Close pool
        await pool.end();
        process.exit(0);
    } catch (error) {
        logger.error('❌ Migration failed:', error);
        await pool.end();
        process.exit(1);
    }
}

applyMigration();
