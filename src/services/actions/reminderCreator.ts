import dayTrackerAPI from '../dayTrackerAPI';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';

export interface CreateReminderResult {
    success: boolean;
    reminder?: any;
    message: string;
}

export interface CreateReminderParams {
    title: string;
    description?: string;
    plannedDate: string;  // ISO date string
    goalKeyword?: string;
    jwtToken: string;
}

/**
 * Service for creating reminders (future plans) from natural language
 */
export class ReminderCreator {
    /**
     * Create a reminder/future plan
     */
    async createReminder(params: CreateReminderParams): Promise<CreateReminderResult> {
        const {
            title,
            description,
            plannedDate,
            goalKeyword,
            jwtToken
        } = params;

        try {
            // Set auth token
            dayTrackerAPI.setAuthToken(jwtToken);

            // Find goal (or use first active goal)
            let goal = null;
            if (goalKeyword) {
                goal = await dayTrackerAPI.findGoalByKeyword(goalKeyword);
            }

            if (!goal) {
                // Use first active goal as default
                const allGoals = await dayTrackerAPI.getGoals();
                const activeGoals = allGoals.filter(g => g.isActive);

                if (activeGoals.length === 0) {
                    return {
                        success: false,
                        message: "You don't have any active goals. Create a goal first to add reminders to."
                    };
                }

                // Use first active goal
                goal = activeGoals[0];
            }

            // Create daily log for today (if doesn't exist) with the future plan
            const today = new Date().toISOString().split('T')[0];

            const logData = {
                goalId: goal.id,
                logDate: today,
                futurePlans: [{
                    title,
                    description,
                    plannedDate
                }],
                clientId: uuidv4()
            };

            const log = await dayTrackerAPI.createDailyLog(logData);

            logger.info('Reminder created successfully', {
                goalId: goal.id,
                title,
                plannedDate
            });

            // Parse planned date for user-friendly message
            const plannedDateTime = new Date(plannedDate);
            const dateStr = plannedDateTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const timeStr = plannedDateTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
            });

            return {
                success: true,
                reminder: log,
                message: `Reminder set for "${title}" on ${dateStr} at ${timeStr}!`
            };
        } catch (error: any) {
            logger.error('Failed to create reminder', error);

            return {
                success: false,
                message: `Failed to create reminder: ${error.message}`
            };
        }
    }
}

export default new ReminderCreator();
