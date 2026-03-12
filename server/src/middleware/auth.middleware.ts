// @ts-nocheck
import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage/storage";

/**
 * Middleware to require authentication.
 * Attaches `req.currentUser` if authenticated.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const isAdmin = (req.session as any)?.isAdmin;
        let user;

        // If admin flag is set, check admin database first
        if (isAdmin) {
            const adminUser = await adminStorage.getAdminUserById(userId);
            if (adminUser) {
                user = {
                    id: adminUser.id,
                    username: adminUser.username,
                    password: adminUser.password,
                    role: adminUser.role || 'admin',
                    name: adminUser.name,
                    shopId: adminUser.shopId,
                    accountNumber: adminUser.accountNumber,
                    balance: adminUser.adminGeneratedBalance,
                    isBlocked: Boolean(adminUser.isBlocked),
                    machineId: adminUser.machineId,
                    createdAt: adminUser.createdAt
                } as any;
            }
        }

        // If not found in admin db, check employee database
        if (!user) {
            user = await storage.getUser(userId);
        }

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        (req as any).currentUser = user;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(500).json({ message: "Authentication failed" });
    }
}

/**
 * Middleware to require a specific role.
 * Must be used AFTER requireAuth.
 */
export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).currentUser;
        if (!user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        if (!roles.includes(user.role)) {
            return res.status(403).json({ message: `${roles.join(' or ')} access required` });
        }
        next();
    };
}

/**
 * Resolve admin user from session — checks both databases.
 * Used in admin-related controllers.
 */
export async function resolveAdminUser(userId: number): Promise<any | null> {
    console.log(`resolveAdminUser called with userId: ${userId}`);
    
    // Check main database for user
    const user = await storage.getUser(userId);
    console.log(`User from main database:`, user ? { id: user.id, role: user.role, username: user.username } : null);
    
    if (user && (user.role === 'admin' || user.role === 'employee')) {
        const result = {
            id: user.id,
            username: user.username,
            password: user.password,
            role: user.role || 'admin',
            name: user.name,
            shopId: user.shopId,
            accountNumber: user.accountNumber,
            balance: user.balance,
            isBlocked: user.isBlocked,
            machineId: user.machineId,
            createdAt: user.createdAt,
            // Admin tracking fields
            adminGeneratedBalance: user.adminGeneratedBalance,
            employeePaidAmount: user.employeePaidAmount,
            totalRechargeFiles: user.totalRechargeFiles,
            totalRechargeAmount: user.totalRechargeAmount
        } as any;
        console.log(`Returning user:`, { id: result.id, role: result.role, username: result.username });
        return result;
    }
    
    console.log(`User not found in main database`);
    return null;
}
