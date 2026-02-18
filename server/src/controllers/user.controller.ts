// @ts-nocheck
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { storage } from "../../storage/storage";
import { emitBalanceUpdate, emitEvent } from "../services/socket.service";
import { decryptData, verifyBalance, generateKeyPair } from "../lib/crypto";
import { insertUserSchema, insertGamePlayerSchema, insertTransactionSchema } from "@shared/schema-simple";

const { publicKey: SYSTEM_PUBLIC_KEY } = generateKeyPair();

// ─── GET CREDIT BALANCE ─────────────────────────────────────────────
export async function getCreditBalance(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.role === 'admin') {
            const balance = await storage.getCreditBalance(userId);
            res.json({ balance });
        } else if (user.role === 'employee') {
            const adminUser = await storage.getUserByShopId(user.shopId!);
            if (!adminUser) {
                return res.status(404).json({ message: "Shop admin not found" });
            }
            res.json({ balance: adminUser.creditBalance || '0.00' });
        } else {
            return res.status(403).json({ message: "Admin or employee access required" });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to get credit balance" });
    }
}

// ─── CREATE COLLECTOR ───────────────────────────────────────────────
export async function createCollector(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const { username, password, name, email } = req.body;
        if (!username || !password || !name) {
            return res.status(400).json({ message: "Username, password, and name required" });
        }

        const collector = await storage.createUser({
            username,
            password: await bcrypt.hash(password, 12),
            name, email: email || null,
            role: 'collector',
            shopId: user.shopId!,
            supervisorId: user.id,
            isBlocked: false,
            creditBalance: "0.00",
            accountNumber: null,
            referredBy: null,
            commissionRate: "0.00"
        });

        res.json({
            success: true,
            collector: { id: collector.id, username: collector.username, name: collector.name, role: collector.role }
        });
    } catch (error) {
        console.error("Error creating collector:", error);
        if (error.message?.includes('duplicate key')) {
            res.status(400).json({ message: "Username already exists" });
        } else {
            res.status(500).json({ message: "Failed to create collector" });
        }
    }
}

// ─── GET COLLECTORS ─────────────────────────────────────────────────
export async function getCollectors(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const employeeId = parseInt(req.params.employeeId);
        const collectors = await storage.getCollectorsByEmployee(employeeId);
        res.json(collectors);
    } catch (error) {
        console.error("Error getting collectors:", error);
        res.status(500).json({ message: "Failed to get collectors" });
    }
}

// ─── GET USER BY ID ─────────────────────────────────────────────────
export async function getUserById(req: Request, res: Response) {
    try {
        const userId = parseInt(req.params.id);
        const user = await storage.getUser(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ message: "Failed to get user" });
    }
}

// ─── CREATE USER ────────────────────────────────────────────────────
export async function createUser(req: Request, res: Response) {
    try {
        const userData = insertUserSchema.parse(req.body);
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const user = await storage.createUser({ ...userData, password: hashedPassword });
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: "Invalid input", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create user" });
    }
}

// ─── GET USERS BY SHOP ──────────────────────────────────────────────
export async function getUsersByShop(req: Request, res: Response) {
    try {
        const shopId = parseInt(req.params.shopId);
        const users = await storage.getUsersByShop(shopId);
        const usersWithoutPasswords = users.map(({ password, ...user }) => user);
        res.json(usersWithoutPasswords);
    } catch (error) {
        res.status(500).json({ message: "Failed to get users" });
    }
}

// ─── UPDATE USER ────────────────────────────────────────────────────
export async function updateUser(req: Request, res: Response) {
    try {
        const id = parseInt(req.params.id);
        const updates = req.body;

        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        const user = await storage.updateUser(id, updates);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ message: "Failed to update user" });
    }
}

// ─── UPDATE USER PASSWORD ───────────────────────────────────────────
export async function updateUserPassword(req: Request, res: Response) {
    try {
        const id = parseInt(req.params.id || req.params.userId);
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ message: "Password is required" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await storage.updateUser(id, { password: hashedPassword });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to update password" });
    }
}

// ─── DELETE USER ────────────────────────────────────────────────────
export async function deleteUser(req: Request, res: Response) {
    try {
        const id = parseInt(req.params.id);
        const currentUser = req.session.user;

        if (!currentUser) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const userToDelete = await storage.getUser(id);
        if (!userToDelete) {
            return res.status(404).json({ message: "User not found" });
        }

        if (currentUser.role === 'admin') {
            if (userToDelete.role !== 'employee' || userToDelete.shopId !== currentUser.shopId) {
                return res.status(403).json({ message: "Cannot delete this user" });
            }
        } else if (currentUser.role !== 'admin') {
            return res.status(403).json({ message: "Insufficient permissions" });
        }

        const success = await storage.deleteUser(id);
        if (!success) {
            return res.status(500).json({ message: "Failed to delete user" });
        }

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete user" });
    }
}

// ─── EMPLOYEE RECHARGE REDEEM ───────────────────────────────────────
export async function rechargeRedeem(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const { fileData } = req.body;
        if (!fileData) {
            return res.status(400).json({ message: "Recharge file data required" });
        }

        const { payload, signature } = decryptData(fileData);
        const isValid = verifyBalance(payload, signature, SYSTEM_PUBLIC_KEY);
        if (!isValid) {
            return res.status(400).json({ message: "Invalid signature" });
        }

        if (payload.employeeAccountNumber !== user.accountNumber) {
            return res.status(400).json({ message: "This file is for another account" });
        }

        const currentBalance = parseFloat(user.balance || "0");
        const newBalance = (currentBalance + parseFloat(payload.amount)).toFixed(2);
        await storage.updateUserBalance(user.id, newBalance);

        await storage.createTransaction({
            userId: user.id, amount: payload.amount,
            type: 'credit_load',
            description: `File recharge: ${payload.amount}`,
            shopId: user.shopId
        });

        res.json({ message: "Recharge successful", balance: newBalance });
    } catch (error) {
        console.error("Redeem error:", error);
        res.status(500).json({ message: "Failed to redeem recharge file" });
    }
}

// ─── RECHARGE TOPUP ─────────────────────────────────────────────────
export async function rechargeTopup(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const { encryptedData } = req.body;
        if (!encryptedData) {
            return res.status(400).json({ message: "Recharge file data required" });
        }

        let payload;
        try {
            payload = decryptData(encryptedData);
        } catch (error) {
            try {
                const colonIndex = encryptedData.indexOf(':');
                if (colonIndex === -1) throw new Error("No colon found in encrypted data");
                const dataPart = encryptedData.substring(0, colonIndex);
                payload = decryptData(dataPart);
            } catch (error2) {
                return res.status(400).json({ message: "Invalid file format" });
            }
        }

        if (!payload.employeeAccountNumber || !payload.amount) {
            return res.status(400).json({ message: "Invalid file format" });
        }

        if (payload.employeeAccountNumber !== user.accountNumber) {
            return res.status(400).json({ message: "This file is for another account" });
        }

        const currentBalance = parseFloat(user.balance || "0");
        const rechargeAmount = parseFloat(payload.amount);
        const newBalance = currentBalance + rechargeAmount;

        await storage.updateUserBalance(user.id, newBalance.toString());
        await storage.createTransaction({
            gameId: null, employeeId: user.id,
            amount: rechargeAmount, type: 'credit_load',
            description: `Recharge file: ${payload.filename || 'topup.enc'}`
        });

        res.json({ message: "Recharge successful", balance: newBalance });
    } catch (error) {
        console.error("Top-up error:", error);
        res.status(500).json({ message: "Failed to process recharge" });
    }
}

// ─── GET EMPLOYEE STATS ─────────────────────────────────────────────
export async function getEmployeeStats(req: Request, res: Response) {
    try {
        const id = parseInt(req.params.id);
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const stats = await storage.getEmployeeStats(id, start, end);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: "Failed to get employee stats" });
    }
}

// ─── GET TRANSACTIONS BY EMPLOYEE ───────────────────────────────────
export async function getTransactionsByEmployee(req: Request, res: Response) {
    try {
        const employeeId = parseInt(req.params.employeeId);
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const transactions = await storage.getTransactionsByEmployee(employeeId, start, end);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: "Failed to get transactions" });
    }
}

// ─── TODAY'S STATS ──────────────────────────────────────────────────
export async function getTodayStats(req: Request, res: Response) {
    try {
        const shopId = parseInt(req.params.shopId);
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const todayTransactions = await storage.getTransactionsByShop(shopId, startOfDay, endOfDay);

        const todayRevenue = todayTransactions.filter(t => t.type === 'entry_fee')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const todayPrizes = todayTransactions.filter(t => t.type === 'prize_payout')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const todayProfit = todayTransactions.filter(t => t.type === 'admin_profit')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        res.json({ revenue: todayRevenue, prizes: todayPrizes, profit: todayProfit, netIncome: todayProfit });
    } catch (error) {
        res.status(500).json({ message: "Failed to get today's stats" });
    }
}

// ─── REFERRAL COMMISSION ROUTES ─────────────────────────────────────
export async function getReferralCommissions(req: Request, res: Response) {
    try {
        const referrerId = parseInt(req.params.referrerId);
        const commissions = await storage.getReferralCommissions(referrerId);
        res.json(commissions);
    } catch (error) {
        console.error("Error fetching referral commissions:", error);
        res.status(500).json({ message: "Failed to fetch referral commissions" });
    }
}

export async function withdrawReferralCommission(req: Request, res: Response) {
    try {
        const { adminId, amount, bankAccount } = req.body;
        if (!adminId || !amount || !bankAccount) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const result = await storage.createWithdrawalRequest({
            adminId, amount: amount.toString(), bankAccount,
            type: 'referral_commission', status: 'pending'
        });

        res.json(result);
    } catch (error) {
        console.error("Failed to create withdrawal request:", error);
        res.status(500).json({ message: "Failed to submit withdrawal request" });
    }
}

export async function convertCommissionToCredit(req: Request, res: Response) {
    try {
        const { adminId, amount } = req.body;
        if (!adminId || !amount) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const result = await storage.convertCommissionToCredit(adminId, amount);
        res.json(result);
    } catch (error) {
        console.error("Failed to convert commission to credit:", error);
        res.status(500).json({ message: "Failed to convert commission to credit" });
    }
}

export async function processReferralCommission(req: Request, res: Response) {
    try {
        const commissionId = parseInt(req.params.id);
        const action = req.params.action as 'withdraw' | 'convert_to_credit';

        if (!['withdraw', 'convert_to_credit'].includes(action)) {
            return res.status(400).json({ message: "Invalid action" });
        }

        const commission = await storage.processReferralCommission(commissionId, action);
        res.json(commission);
    } catch (error) {
        console.error("Error processing referral commission:", error);
        res.status(500).json({ message: "Failed to process referral commission" });
    }
}

// ─── WITHDRAWAL REQUESTS ────────────────────────────────────────────
export async function getWithdrawalRequests(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });

        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.role === "admin") {
            const requests = await storage.getAllWithdrawalRequests();
            res.json(requests);
        } else {
            return res.status(403).json({ message: "Access denied" });
        }
    } catch (error) {
        console.error("Error fetching withdrawal requests:", error);
        res.status(500).json({ message: "Failed to fetch withdrawal requests" });
    }
}

export async function createWithdrawalRequest(req: Request, res: Response) {
    try {
        const { amount, bankAccount, type } = req.body;
        const userId = req.session?.userId;

        if (!userId) return res.status(401).json({ message: "Not authenticated" });

        const user = await storage.getUser(userId);
        if (!user || user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const requestAmount = parseFloat(amount);
        if (isNaN(requestAmount) || requestAmount <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }

        if (type === "credit_balance") {
            const currentBalance = parseFloat(user.creditBalance);
            if (requestAmount > currentBalance) {
                return res.status(400).json({ message: "Insufficient credit balance" });
            }
        } else if (type === "referral_commission") {
            const commissions = await storage.getReferralCommissions(userId);
            const availableCommissions = commissions
                .filter(c => c.status === 'pending')
                .reduce((sum, c) => sum + parseFloat(c.commissionAmount), 0);
            if (requestAmount > availableCommissions) {
                return res.status(400).json({ message: "Insufficient commission balance" });
            }
        } else {
            return res.status(400).json({ message: "Invalid withdrawal type" });
        }

        const request = await storage.createWithdrawalRequest({ adminId: userId, amount: amount.toString(), bankAccount, type });
        res.json(request);
    } catch (error) {
        console.error("Error creating withdrawal request:", error);
        res.status(500).json({ message: "Failed to create withdrawal request" });
    }
}

export async function processWithdrawalRequest(req: Request, res: Response) {
    try {
        const { id, action } = req.params;
        const { rejectionReason } = req.body;
        const userId = req.session?.userId;

        if (!userId) return res.status(401).json({ message: "Not authenticated" });

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        if (action === "approve") {
            await storage.approveWithdrawalRequest(parseInt(id), userId);
        } else if (action === "reject") {
            if (!rejectionReason) return res.status(400).json({ message: "Rejection reason required" });
            await storage.rejectWithdrawalRequest(parseInt(id), userId, rejectionReason);
        } else {
            return res.status(400).json({ message: "Invalid action" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error processing withdrawal request:", error);
        res.status(500).json({ message: "Failed to process withdrawal request" });
    }
}

// ─── SHOP UPDATE ────────────────────────────────────────────────────
export async function updateShop(req: Request, res: Response) {
    try {
        const shopId = parseInt(req.params.shopId);
        const user = req.session?.user;
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const { profitMargin } = req.body;
        const updateData: any = {};
        if (profitMargin !== undefined) {
            updateData.profitMargin = profitMargin.toString();
        }

        const updatedShop = await storage.updateShop(shopId, updateData);
        if (!updatedShop) return res.status(404).json({ message: "Shop not found" });
        res.json(updatedShop);
    } catch (error) {
        res.status(500).json({ message: "Failed to update shop" });
    }
}

// ─── CALCULATE PROFITS ─────────────────────────────────────────────
export async function calculateProfits(req: Request, res: Response) {
    try {
        const user = req.session.user;
        if (!user) return res.status(401).json({ message: "Authentication required" });

        const { gameAmount, shopId } = req.body;
        if (!gameAmount || !shopId) {
            return res.status(400).json({ message: "Missing required data" });
        }

        const profits = await storage.calculateProfitSharing(gameAmount, shopId);
        res.json(profits);
    } catch (error) {
        res.status(500).json({ message: "Failed to calculate profits" });
    }
}

// ─── GET REFERRAL EARNINGS ──────────────────────────────────────────
export async function getReferralEarnings(req: Request, res: Response) {
    try {
        const user = req.session.user;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const referredAdmins = await storage.getAdminsByReferrer(user.id);
        const transactions = await storage.getTransactionsByEmployee(user.id);
        const referralBonuses = transactions.filter(t => t.type === 'referral_bonus');
        const totalEarnings = referralBonuses.reduce((sum, t) => sum + parseFloat(t.amount), 0);

        res.json({
            referredAdmins: referredAdmins.length,
            totalEarnings: totalEarnings.toFixed(2),
            recentBonuses: referralBonuses.slice(0, 10)
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to get referral earnings" });
    }
}

// ─── GET ALL ADMINS (for super admin) ───────────────────────────────
export async function getAllAdmins(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(401).json({ message: "Not authenticated" });

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const admins = await storage.getUsers();
        const adminUsers = admins.filter(u => u.role === 'admin');
        const safeAdmins = adminUsers.map(admin => ({ ...admin, password: undefined }));
        res.json(safeAdmins);
    } catch (error) {
        res.status(500).json({ message: "Failed to get admins" });
    }
}

// ─── GET GAME HISTORY BY EMPLOYEE ───────────────────────────────────
export async function getGameHistoryByEmployee(req: Request, res: Response) {
    try {
        const employeeId = req.params.employeeId === 'undefined' ? undefined : parseInt(req.params.employeeId);
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        if (!employeeId) return res.json([]);

        const history = await storage.getEmployeeGameHistory(employeeId, start, end);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: "Failed to get game history" });
    }
}

// ─── GET SHOP GAMES ─────────────────────────────────────────────────
export async function getShopGames(req: Request, res: Response) {
    try {
        const games = await storage.getGamesByShop(1);
        res.json(games);
    } catch (error) {
        res.status(500).json({ message: "Failed to get games" });
    }
}

// ─── GET SHOP USERS ─────────────────────────────────────────────────
export async function getShopUsers(req: Request, res: Response) {
    try {
        const users = await storage.getUsersByShop(1);
        const usersWithoutPasswords = users.map(({ password, ...user }) => user);
        res.json(usersWithoutPasswords);
    } catch (error) {
        res.status(500).json({ message: "Failed to get shop users" });
    }
}
