import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

interface JWTPayload {
    id: number;
    email: string;
}

/**
 * Middleware to verify JWT token from Day Tracker
 * This allows the AI Assistant to use the same authentication as Day Tracker
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        // Attach user to request (normalize id/userId)
        (req as any).user = {
            id: decoded.id || decoded.userId,
            email: decoded.email
        };

        next();
    } catch (error: any) {
        logger.error('Auth middleware error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

export default authMiddleware;
