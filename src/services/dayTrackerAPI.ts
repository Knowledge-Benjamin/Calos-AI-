import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

// Day Tracker API configuration
const DAY_TRACKER_API_URL = process.env.DAY_TRACKER_API_URL || 'https://day-tracker-93ly.onrender.com/api';

interface Goal {
    id: number;
    title: string;
    description?: string;
    startDate: string;
    durationDays: number;
    endDate: string;
    color: string;
    isActive: boolean;
    loggedDays: number;
    progress: number;
    daysRemaining: number;
}

interface DailyLog {
    id: number;
    goalId: number;
    logDate: string;
    notes?: string;
    activities?: string[];
    goodThings?: string[];
    futurePlans?: FuturePlan[];
}

interface FuturePlan {
    title: string;
    description?: string;
    plannedDate: string;
}

interface CreateDailyLogData {
    goalId: number;
    logDate: string;
    notes?: string;
    activities?: string[];
    goodThings?: string[];
    futurePlans?: FuturePlan[];
    clientId: string;
}

interface CreateGoalData {
    title: string;
    description?: string;
    startDate: string;
    durationDays: number;
    color?: string;
    isActive?: boolean;
}

/**
 * Service for interacting with Day Tracker API
 * Uses existing REST endpoints instead of direct database access
 */
export class DayTrackerAPIService {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: DAY_TRACKER_API_URL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Request interceptor for logging
        this.client.interceptors.request.use(
            (config) => {
                logger.info('Day Tracker API Request', {
                    method: config.method,
                    url: config.url
                });
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                logger.error('Day Tracker API Error', {
                    status: error.response?.status,
                    message: error.response?.data?.message || error.message
                });
                return Promise.reject(error);
            }
        );
    }

    /**
     * Set JWT token for authenticated requests
     */
    setAuthToken(token: string) {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    /**
     * Get all goals for a user
     */
    async getGoals(): Promise<Goal[]> {
        try {
            const response = await this.client.get('/goals');
            return response.data.data || response.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to fetch goals';
            logger.error('Error fetching goals', { message });
            throw new Error(message);
        }
    }

    /**
     * Create a new goal
     */
    async createGoal(data: CreateGoalData): Promise<Goal> {
        try {
            const response = await this.client.post('/goals', data);
            logger.info('Goal created successfully', { goalId: response.data.data?.id });
            return response.data.data || response.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to create goal';
            logger.error('Error creating goal', { message });
            throw new Error(message);
        }
    }

    /**
     * Update an existing goal
     */
    async updateGoal(goalId: number, data: Partial<CreateGoalData>): Promise<Goal> {
        try {
            const response = await this.client.put(`/goals/${goalId}`, data);
            logger.info('Goal updated successfully', { goalId });
            return response.data.data || response.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to update goal';
            logger.error('Error updating goal', { message });
            throw new Error(message);
        }
    }

    /**
     * Toggle goal active status
     */
    async toggleGoal(goalId: number): Promise<Goal> {
        try {
            const response = await this.client.patch(`/goals/${goalId}/toggle`);
            logger.info('Goal toggled successfully', { goalId });
            return response.data.data || response.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to toggle goal';
            logger.error('Error toggling goal', { message });
            throw new Error(message);
        }
    }

    /**
     * Create or update a daily log
     */
    async createDailyLog(data: CreateDailyLogData): Promise<DailyLog> {
        try {
            const response = await this.client.post('/daily-logs', data);
            logger.info('Daily log created successfully', {
                goalId: data.goalId,
                logDate: data.logDate
            });
            return response.data.data || response.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to create daily log';
            logger.error('Error creating daily log', { message });
            throw new Error(message);
        }
    }

    /**
     * Get all logs for a specific goal
     */
    async getGoalLogs(goalId: number): Promise<DailyLog[]> {
        try {
            const response = await this.client.get(`/daily-logs/goal/${goalId}`);
            return response.data.data || response.data;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Failed to fetch goal logs';
            logger.error('Error fetching goal logs', { message });
            throw new Error(message);
        }
    }

    /**
     * Find a goal by keyword (fuzzy matching)
     * Returns best match or null if no suitable match found
     */
    async findGoalByKeyword(keyword: string): Promise<Goal | null> {
        const goals = await this.getGoals();

        if (goals.length === 0) {
            return null;
        }

        const lowerKeyword = keyword.toLowerCase().trim();

        // Try exact match first
        const exactMatch = goals.find(g =>
            g.title.toLowerCase().includes(lowerKeyword) ||
            lowerKeyword.includes(g.title.toLowerCase())
        );

        if (exactMatch) {
            logger.info('Goal found by exact match', { keyword, goalTitle: exactMatch.title });
            return exactMatch;
        }

        // Fuzzy matching using simple similarity
        const matches = goals.map(goal => ({
            goal,
            similarity: this.calculateSimilarity(lowerKeyword, goal.title.toLowerCase())
        }));

        // Sort by similarity
        matches.sort((a, b) => b.similarity - a.similarity);

        // Return best match if similarity > 0.5
        if (matches[0].similarity > 0.5) {
            logger.info('Goal found by fuzzy match', {
                keyword,
                goalTitle: matches[0].goal.title,
                similarity: matches[0].similarity
            });
            return matches[0].goal;
        }

        logger.info('No matching goal found', { keyword });
        return null;
    }

    /**
     * Calculate similarity between two strings (0-1)
     * Simple implementation using Jaccard similarity
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.split(' '));
        const words2 = new Set(str2.split(' '));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }
}

export default new DayTrackerAPIService();
