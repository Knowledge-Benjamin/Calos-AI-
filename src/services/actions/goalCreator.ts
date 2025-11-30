import dayTrackerAPI from '../dayTrackerAPI';
import logger from '../../utils/logger';

export interface CreateGoalResult {
    success: boolean;
    goal?: any;
    message: string;
}

export interface CreateGoalParams {
    title: string;
    description?: string;
    durationDays: number;
    startDate?: string;
    color?: string;
    jwtToken: string;
}

// Predefined color palette for new goals
const GOAL_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B195', '#C06C84'
];

/**
 * Service for creating goals from natural language
 */
export class GoalCreator {
    /**
     * Create a new goal
     */
    async createGoal(params: CreateGoalParams): Promise<CreateGoalResult> {
        const {
            title,
            description,
            durationDays,
            startDate = new Date().toISOString().split('T')[0],
            color,
            jwtToken
        } = params;

        try {
            // Set auth token
            dayTrackerAPI.setAuthToken(jwtToken);

            // Validate duration
            if (durationDays <= 0 || durationDays > 3650) {
                return {
                    success: false,
                    message: "Goal duration must be between 1 and 3650 days (10 years)."
                };
            }

            // Auto-select color if not provided
            const goalColor = color || this.getRandomColor();

            // Create goal via API
            const goalData = {
                title,
                description,
                startDate,
                durationDays,
                color: goalColor
            };

            const goal = await dayTrackerAPI.createGoal(goalData);

            logger.info('Goal created successfully', {
                goalId: goal.id,
                title: goal.title,
                durationDays
            });

            return {
                success: true,
                goal,
                message: `Created "${title}" goal for ${durationDays} days!`
            };
        } catch (error: any) {
            logger.error('Failed to create goal', error);

            return {
                success: false,
                message: `Failed to create goal: ${error.message}`
            };
        }
    }

    /**
     * Get a random color from the palette
     */
    private getRandomColor(): string {
        return GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)];
    }
}

export default new GoalCreator();
