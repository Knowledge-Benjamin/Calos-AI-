import dayTrackerAPI from '../dayTrackerAPI';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';

export interface CreateLogResult {
    success: boolean;
    log?: any;
    goalTitle?: string;
    message: string;
    needsGoalSelection?: boolean;
    availableGoals?: any[];
}

export interface CreateLogParams {
    goalKeyword?: string;
    activity?: string;
    goodThing?: string;
    note?: string;
    logDate?: string;
    jwtToken: string;
}

/**
 * Service for creating daily logs from natural language
 * Handles goal matching and log creation via Day Tracker API
 */
export class DailyLogCreator {
    /**
     * Create a daily log from extracted entities
     */
    async createLog(params: CreateLogParams): Promise<CreateLogResult> {
        const {
            goalKeyword,
            activity,
            goodThing,
            note,
            logDate = new Date().toISOString().split('T')[0],
            jwtToken
        } = params;

        try {
            // Set auth token
            dayTrackerAPI.setAuthToken(jwtToken);

            // Find goal if keyword provided
            let goal = null;
            if (goalKeyword) {
                goal = await dayTrackerAPI.findGoalByKeyword(goalKeyword);

                if (!goal) {
                    // Goal not found - list available goals
                    const allGoals = await dayTrackerAPI.getGoals();
                    const activeGoals = allGoals.filter(g => g.isActive);

                    if (activeGoals.length === 0) {
                        return {
                            success: false,
                            message: "You don't have any active goals yet. Would you like to create one first?",
                        };
                    }

                    return {
                        success: false,
                        message: `I couldn't find a goal matching "${goalKeyword}". Which goal did you mean?`,
                        needsGoalSelection: true,
                        availableGoals: activeGoals.map(g => ({
                            id: g.id,
                            title: g.title,
                            progress: g.progress
                        }))
                    };
                }
            } else {
                // No goal keyword - use first active goal or ask user
                const allGoals = await dayTrackerAPI.getGoals();
                const activeGoals = allGoals.filter(g => g.isActive);

                if (activeGoals.length === 0) {
                    return {
                        success: false,
                        message: "You don't have any active goals yet. Would you like to create one first?",
                    };
                } else if (activeGoals.length === 1) {
                    goal = activeGoals[0];
                } else {
                    return {
                        success: false,
                        message: "Which goal should I log this for?",
                        needsGoalSelection: true,
                        availableGoals: activeGoals.map(g => ({
                            id: g.id,
                            title: g.title,
                            progress: g.progress
                        }))
                    };
                }
            }

            // Build activities array
            const activities: string[] = [];
            if (activity) {
                activities.push(activity);
            }

            // Build good things array
            const goodThings: string[] = [];
            if (goodThing) {
                goodThings.push(goodThing);
            }

            // Create the daily log
            const logData = {
                goalId: goal.id,
                logDate,
                notes: note,
                activities: activities.length > 0 ? activities : undefined,
                goodThings: goodThings.length > 0 ? goodThings : undefined,
                clientId: uuidv4()
            };

            const log = await dayTrackerAPI.createDailyLog(logData);

            logger.info('Daily log created successfully', {
                goalId: goal.id,
                logDate,
                activitiesCount: activities.length
            });

            return {
                success: true,
                log,
                goalTitle: goal.title,
                message: `Logged successfully for "${goal.title}"!`
            };
        } catch (error: any) {
            logger.error('Failed to create daily log', error);

            return {
                success: false,
                message: `Failed to create log: ${error.message}`
            };
        }
    }

    /**
     * Create a daily log with a specific goal ID (when goal is already known)
     */
    async createLogForGoal(
        goalId: number,
        data: {
            activity?: string;
            goodThing?: string;
            note?: string;
            logDate?: string;
        },
        jwtToken: string
    ): Promise<CreateLogResult> {
        try {
            dayTrackerAPI.setAuthToken(jwtToken);

            const {
                activity,
                goodThing,
                note,
                logDate = new Date().toISOString().split('T')[0]
            } = data;

            // Build arrays
            const activities: string[] = [];
            if (activity) activities.push(activity);

            const goodThings: string[] = [];
            if (goodThing) goodThings.push(goodThing);

            // Create log
            const logData = {
                goalId,
                logDate,
                notes: note,
                activities: activities.length > 0 ? activities : undefined,
                goodThings: goodThings.length > 0 ? goodThings : undefined,
                clientId: uuidv4()
            };

            const log = await dayTrackerAPI.createDailyLog(logData);

            // Get goal details
            const goals = await dayTrackerAPI.getGoals();
            const goal = goals.find(g => g.id === goalId);

            return {
                success: true,
                log,
                goalTitle: goal?.title,
                message: `Logged successfully${goal ? ` for "${goal.title}"` : ''}!`
            };
        } catch (error: any) {
            logger.error('Failed to create daily log for specific goal', error);

            return {
                success: false,
                message: `Failed to create log: ${error.message}`
            };
        }
    }
}

export default new DailyLogCreator();
