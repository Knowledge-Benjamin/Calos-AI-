import { pool } from '../config/database';
import dayTrackerAPI from './dayTrackerAPI';
import logger from '../utils/logger';

/**
 * Generate morning briefing for user
 */
export async function generateBriefing(userId: number, jwtToken: string): Promise<string> {
    try {
        const briefingParts: string[] = [];
        const now = new Date();
        const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

        briefingParts.push(`${greeting}, Knowledge!\n`);

        // 1. Email Summary
        const client = await pool.connect();
        try {
            const emailResult = await client.query(
                `SELECT COUNT(*) FILTER (WHERE classification = 'high') as high_count,
                        COUNT(*) FILTER (WHERE classification = 'medium') as medium_count,
                        COUNT(*) as total_count
                 FROM monitored_messages
                 WHERE user_id = $1 AND source = 'gmail' AND is_read = FALSE`,
                [userId]
            );

            if (emailResult.rows[0].total_count > 0) {
                const { high_count, medium_count, total_count } = emailResult.rows[0];
                briefingParts.push(`\n📧 **Email Update:**`);
                briefingParts.push(`- ${total_count} unread email${total_count > 1 ? 's' : ''}`);
                if (high_count > 0) {
                    briefingParts.push(`  - ${high_count} high priority (action needed)`);
                }
                if (medium_count > 0) {
                    briefingParts.push(`  - ${medium_count} medium priority`);
                }
            }

            // 2. X Mentions Summary
            const xResult = await client.query(
                `SELECT COUNT(*) as count FROM monitored_messages
                 WHERE user_id = $1 AND source = 'twitter' AND is_read = FALSE`,
                [userId]
            );

            if (xResult.rows[0].count > 0) {
                briefingParts.push(`\n🐦 **X (Twitter) Update:**`);
                briefingParts.push(`- ${xResult.rows[0].count} new mention${xResult.rows[0].count > 1 ? 's' : ''}`);
            }

            // 3. Goals Summary
            dayTrackerAPI.setAuthToken(jwtToken);
            const goals = await dayTrackerAPI.getGoals();
            const activeGoals = goals.filter(g => g.isActive);

            if (activeGoals.length > 0) {
                briefingParts.push(`\n🎯 **Active Goals:**`);
                activeGoals.forEach(goal => {
                    const daysLeft = goal.daysRemaining;
                    briefingParts.push(`- **${goal.title}**: ${goal.progress.toFixed(0)}% complete (${daysLeft} days left)`);
                });
            }

            // Return empty state message if no updates
            if (briefingParts.length === 1) {
                return `${greeting}, Knowledge! Everything's quiet — no urgent emails, mentions, or tasks for now. Ready to start your day fresh! 🌟`;
            }

            return briefingParts.join('\n');
        } finally {
            client.release();
        }
    } catch (error: any) {
        logger.error('Error generating briefing', { userId, error: error.message });
        return "I had trouble generating your briefing. Everything okay on my end, but I couldn't fetch all the details right now.";
    }
}
