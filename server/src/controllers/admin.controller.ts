// @ts-nocheck
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import express, { Request, Response } from "express";
import * as crypto from "crypto";
import { storage } from "../../storage/storage";
import { resolveAdminUser } from "../middleware/auth.middleware";
import { emitEvent } from "../middleware/socket.middleware";
import { encryptData, signBalance } from "../lib/crypto";
import { emitBalanceUpdate, emitEvent } from "../services/socket.service";

// const { privateKey: SYSTEM_PRIVATE_KEY, publicKey: SYSTEM_PUBLIC_KEY } = generateKeyPair();

// ─── GENERATE RECHARGE FILE ────────────────────────────────────────
export async function generateRechargeFile(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        const user = await resolveAdminUser(userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { targetUserId, employeeAccountNumber, amount, machineId, privateKey } = req.body;
        
        console.log("Full request body:", req.body);
        console.log("Destructured values:", { targetUserId, employeeAccountNumber, amount, machineId, privateKey });
        
        // Support both parameter names for backward compatibility
        const finalTargetUserId = targetUserId || employeeAccountNumber;
        
        console.log("Generate recharge request:", { targetUserId, employeeAccountNumber, finalTargetUserId, amount, hasPrivateKey: !!privateKey });
        
        if (!finalTargetUserId || !amount || !privateKey) {
            return res.status(400).json({ 
                message: "Target user ID/account number, amount, and private key required",
                received: { targetUserId, employeeAccountNumber, amount, machineId, hasPrivateKey: !!privateKey }
            });
        }

        console.log("About to look up user. targetUserId:", targetUserId, "typeof:", typeof targetUserId);
        console.log("About to look up user. finalTargetUserId:", finalTargetUserId, "typeof:", typeof finalTargetUserId);

        // Get target user details - support both ID and account number
        let targetUser;
        
        // Check if targetUserId is a number or string
        if (!targetUserId) {
            // If it's not a number, treat as account number
            console.log("Looking up by account number:", finalTargetUserId);
            targetUser = await storage.getUserByAccountNumber(finalTargetUserId);
        } else {
            // If it's a number, treat as user ID
            console.log("Looking up by ID:", parseInt(finalTargetUserId));
            targetUser = await storage.getUser(parseInt(finalTargetUserId));
        }
        
        console.log("Found target user:", targetUser);
        
        if (!targetUser) {
            return res.status(404).json({ message: "Target user not found" });
        }

        // Create secure payload with all required fields
        console.log("Creating payload with machine ID:", machineId);
        const payload = {
            amount: parseFloat(amount),
            targetUserId: targetUser.id,
            targetUsername: targetUser.username,
            machineId: machineId,
            nonce: crypto.randomBytes(16).toString('hex'),
            timestamp: Date.now()
        };

        // Sign the payload with RSA private key (temporarily disabled for testing)
        const signature = "test-signature"; // signBalance(payload, privateKey);
        
        // Create the encrypted file content
        const fileContent = {
            payload,
            signature
        };

        const encryptedData = encryptData(fileContent);

        // Record recharge file in main database
        await storage.createRechargeFile({
            filename: `recharge_${amount}_${targetUser.username}_${new Date().getTime()}.enc`,
            fileData: encryptedData,
            signature,
            employeeId: targetUser.id,
            amount: parseFloat(amount),
            shopId: user.shopId
        });

        // Update tracking stats for the employee
        await storage.updateRechargeFileStats(targetUser.id, amount);

        res.json({
            success: true,
            filename: `recharge_${amount}_${targetUser.username}_${Date.now()}.enc`,
            encryptedData,
            payload: {
                amount: payload.amount,
                targetUsername: payload.targetUsername,
                machineId: payload.machineId,
                timestamp: payload.timestamp
            }
        });
    } catch (error) {
        console.error("Recharge file generation error:", error);
        res.status(500).json({ message: "Failed to generate recharge file" });
    }
}

// ─── GENERATE ACCOUNT FILE ─────────────────────────────────────────
export async function generateAccountFile(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { fullName, username, password, initialBalance, privateKey } = req.body;
        if (!fullName || !username || !password) {
            return res.status(400).json({ message: "Full name, username, and password required" });
        }

        const signingKey = privateKey || "test-key"; // Use test key for now
        const accountNumber = await storage.generateAccountNumber();

        // Check if user already exists
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ message: "Username already exists" });
        }

        // Create proper encrypted account file
        const payload = {
            fullName,
            username,
            password,
            accountNumber,
            initialBalance: initialBalance || "0",
            shopId: user.shopId,
            timestamp: new Date().getTime(),
            nonce: Math.random().toString(36).substring(7)
        };

        // Sign the payload with RSA private key
        const signature = signBalance(payload, privateKey);
        
        // Create the encrypted file content
        const fileContent = {
            payload,
            signature
        };

        const encryptedData = encryptData(fileContent);

        // Create user in main database with admin tracking fields
        const newUser = await storage.createUser({
            username,
            password,
            role: 'employee',
            name: fullName,
            shopId: user.shopId,
            accountNumber,
            balance: parseFloat(initialBalance || "0"),
            adminGeneratedBalance: (parseFloat(initialBalance || "0") * 10).toString(),
            employeePaidAmount: initialBalance || "0",
            totalRechargeFiles: 0,
            totalRechargeAmount: "0",
            isBlocked: false
        });

        console.log('Admin user created successfully');

        emitEvent('adminUserCreated', {
            type: 'user_created',
            user: {
                username, name: fullName, accountNumber,
                adminGeneratedBalance: (parseFloat(initialBalance || "0") * 10).toString(),
                employeePaidAmount: initialBalance || "0",
                shopId: user.shopId, isBlocked: false, role: 'employee',
                createdAt: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        });
        console.log('📡 Real-time update sent to admin dashboard');

        res.json({ encryptedData, filename: `account_${username}.enc` });
    } catch (error) {
        console.error("Account file generation error:", error);
        res.status(500).json({ message: "Failed to generate account file" });
    }
}

// ─── GET TRACKING DATA ─────────────────────────────────────────────
export async function getTrackingData(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const adminUsers = await storage.getAllEmployees();
        const rechargeFiles = await storage.getAllRechargeFiles();

        console.log('Admin users from tracking:', adminUsers);
        console.log('Recharge files from tracking:', rechargeFiles);

        const mappedUsers = adminUsers.map(user => ({
            ...user,
            machineId: user.machine_id,
            isBlocked: Boolean(user.isBlocked)
        }));

        const allEmployees = mappedUsers.filter(user => user.role === 'employee');
        const totalAdminBalance = allEmployees.reduce((sum, employee) => {
            return sum + parseFloat(employee.adminGeneratedBalance || '0');
        }, 0).toString();

        const totalEmployeePaid = await storage.getTotalEmployeePaid();
        const totalRechargeAmount = await storage.getTotalRechargeAmount();
        const userCount = mappedUsers.filter(user => user.role === 'employee').length;
        const rechargeFileCount = await storage.getRechargeFileCount();

        console.log('Financial metrics:', { totalAdminBalance, totalEmployeePaid, totalRechargeAmount, userCount, rechargeFileCount });

        res.json({
            users: mappedUsers,
            rechargeFiles,
            financials: {
                totalAdminBalance,
                totalEmployeePaid,
                totalRechargeAmount,
                userCount,
                rechargeFileCount
            }
        });
    } catch (error) {
        console.error("Error fetching admin tracking data:", error);
        res.status(500).json({ message: "Failed to get tracking data" });
    }
}

// ─── GET ADMIN EMPLOYEES ───────────────────────────────────────────
export async function getAdminEmployees(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        let employees;
        if (user.role === 'admin') {
            // Get employees from admin tracking database
            const adminUsers = await storage.getAllEmployees();
            employees = adminUsers.filter(u => u.role === 'employee');
        } else {
            // For non-admin users, return empty for now - shop functionality can be added later
            employees = [];
        }

        res.json(employees);
    } catch (error) {
        console.error("Error fetching employees:", error);
        res.status(500).json({ message: "Failed to get employees" });
    }
}

// ─── DELETE ADMIN EMPLOYEE ─────────────────────────────────────────
export async function deleteAdminEmployee(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const employeeId = parseInt(req.params.id);
        if (isNaN(employeeId)) {
            return res.status(400).json({ message: "Invalid employee ID" });
        }

        const deleted = await storage.deleteUser(employeeId);
        if (deleted) {
            res.json({ message: "Employee deleted from admin tracking successfully" });
        } else {
            res.status(404).json({ message: "Employee not found in admin tracking" });
        }
    } catch (error) {
        console.error("Error deleting admin employee:", error);
        res.status(500).json({ message: "Failed to delete employee" });
    }
}

// ─── GET MASTER FLOAT ──────────────────────────────────────────────
export async function getMasterFloat(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        const user = await resolveAdminUser(userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const masterFloat = await storage.getMasterFloat(user.shopId);
        const allBalances = await storage.getAllUserBalances();

        res.json({
            masterFloat,
            shopId: user.shopId,
            allBalances: allBalances.filter(b => b.role === 'employee' && (!user.shopId || b.userId === user.shopId))
        });
    } catch (error) {
        console.error("Error getting master float:", error);
        res.status(500).json({ message: "Failed to get master float" });
    }
}

// ─── LOAD CREDIT ───────────────────────────────────────────────────
export async function loadCredit(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        const user = await resolveAdminUser(userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { amount } = req.body;
        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }

        const currentBalance = parseFloat(user.balance || "0");
        const newBalance = currentBalance + parseFloat(amount);

        await storage.updateUserBalance(userId, newBalance.toString());

        await storage.createTransaction({
            adminId: userId,
            shopId: user.shopId,
            amount: amount,
            type: 'credit_load',
            description: 'System credit loaded by admin'
        });

        emitBalanceUpdate(storage, user.shopId);

        res.json({
            success: true,
            newBalance: newBalance.toString(),
            message: `ETB ${amount} loaded successfully`
        });
    } catch (error) {
        console.error("Error loading credit:", error);
        res.status(500).json({ message: "Failed to load credit" });
    }
}

// ─── UPDATE EMPLOYEE MACHINE ID ────────────────────────────────────
export async function updateEmployeeMachineId(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        const user = await resolveAdminUser(userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const employeeId = parseInt(req.params.id);
        const { machineId } = req.body;

        if (!machineId) {
            return res.status(400).json({ message: "Machine ID is required" });
        }

        const employee = await storage.getUser(employeeId);
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        await storage.updateUser(employeeId, { machineId });

        try {
            const employeeUser = await storage.getUser(employeeId);
            if (employeeUser) {
                await storage.updateUser(employeeId, { machineId });
            }
        } catch (error) {
            console.warn('Employee not found in employee database:', error);
        }

        res.json({ message: "Machine ID updated successfully", machineId });
    } catch (error) {
        console.error('Error updating machine ID:', error);
        res.status(500).json({ message: "Failed to update machine ID" });
    }
}

// ─── UPDATE EMPLOYEE PASSWORD ──────────────────────────────────────
export async function updateEmployeePassword(req: Request, res: Response) {
    try {
        const user = req.session.user;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const employeeId = parseInt(req.params.id);
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const employee = await storage.getUser(employeeId);
        if (!employee || employee.role !== 'employee' || employee.shopId !== user.shopId) {
            return res.status(404).json({ message: "Employee not found in your shop" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await storage.updateUserPassword(employeeId, hashedPassword);

        res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("Failed to update employee password:", error);
        res.status(500).json({ message: "Failed to update password" });
    }
}

// ─── GET ADMIN TRANSACTIONS ────────────────────────────────────────
export async function getAdminTransactions(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const transactions = await storage.getAllTransactions();
        res.json(transactions);
    } catch (error) {
        console.error("Error fetching admin transactions:", error);
        res.status(500).json({ message: "Failed to get transactions" });
    }
}

// ─── GET / POST SYSTEM SETTINGS ────────────────────────────────────
export async function getSystemSettings(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        let settings: any = {
            commissionRate: "15",
            adminProfitMargin: "15",
            prizePoolPercentage: "85"
        };

        if (user.shopId) {
            const shop = await storage.getShop(user.shopId);
            if (shop) {
                if (shop.profitMargin) settings.adminProfitMargin = shop.profitMargin;
                if (shop.superAdminCommission) settings.commissionRate = shop.superAdminCommission;
                if (shop.referralCommission) settings.referralCommissionRate = shop.referralCommission;
            }
        }

        res.json(settings);
    } catch (error) {
        console.error("Failed to get system settings:", error);
        res.status(500).json({ message: "Failed to get system settings" });
    }
}

export async function updateSystemSettings(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { commissionRate, adminProfitMargin, prizePoolPercentage } = req.body;

        if (user.shopId && adminProfitMargin !== undefined) {
            await storage.updateShop(user.shopId, {
                profitMargin: adminProfitMargin.toString()
            });
        }

        res.json({
            message: "Settings updated successfully",
            settings: { commissionRate, adminProfitMargin, prizePoolPercentage }
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to update system settings" });
    }
}

// ─── GET ADMIN GAME HISTORY ────────────────────────────────────────
export async function getAdminGameHistory(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const allUsers = await storage.getUsers();
        const allHistory = [];

        for (const employee of allUsers) {
            if (employee.role === 'employee') {
                const history = await storage.getEmployeeGameHistory(employee.id, start, end);
                allHistory.push(...history);
            }
        }

        res.json(allHistory);
    } catch (error) {
        res.status(500).json({ message: "Failed to get game history" });
    }
}

// ─── CREATE ADMIN ──────────────────────────────────────────────────
export async function createAdmin(req: Request, res: Response) {
    try {
        const user = req.session.user;
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const { name, username, password, email, shopName, referredBy } = req.body;

        if (!name || !username || !password || !shopName) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const accountNumber = await storage.generateAccountNumber();

        const admin = await storage.createUser({
            name, username, password: hashedPassword, email,
            role: 'admin', accountNumber,
            referredBy: referredBy && typeof referredBy === 'number' ? referredBy : undefined,
        });

        const shop = await storage.createShop({ name: shopName, adminId: admin.id });
        await storage.updateUser(admin.id, { shopId: shop.id });

        res.json({ admin: { ...admin, password: undefined }, shop, accountNumber });
    } catch (error) {
        res.status(500).json({ message: "Failed to create admin" });
    }
}

// ─── CREATE EMPLOYEE ───────────────────────────────────────────────
export async function createEmployee(req: Request, res: Response) {
    console.log('=== CREATE EMPLOYEE START ===');
    try {
        const session = req.session as any;
        
        const userId = (req.session as any)?.userId;
        if (!userId) {
            const user = await resolveAdminUser(userId);
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { name, username, password, email, initialBalance } = req.body;
        if (!name || !username || !password) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ message: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const accountNumber = await storage.generateAccountNumber();

        try {
            const employee = await storage.createUser({
                name, username, password: hashedPassword,
                email: email || null, 
                role: 'employee', 
                shopId: user.shopId || null,
                balance: 0,
                adminGeneratedBalance: (parseFloat(initialBalance || "0") * 10).toString(),
                employeePaidAmount: initialBalance || "0",
                totalRechargeFiles: 0,
                totalRechargeAmount: "0",
                isBlocked: false
            });

            console.log('Employee created successfully:', employee);
            res.json({ employee: { ...employee, password: undefined } });
        } catch (error) {
            console.error("Failed to create employee:", error);
            res.status(500).json({ message: "Failed to create employee" });
        }
    } catch (error) {
        console.error("Failed to create employee:", error);
        res.status(500).json({ message: "Failed to create employee" });
    }
}

// ─── GET ADMIN SHOP STATS ──────────────────────────────────────────
export async function getShopStats(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        if (user.role === 'admin') {
            // Return basic stats for admin - can be enhanced later
            const allUsers = await storage.getUsers();
            const totalRevenue = "0"; // Calculate from transactions if needed
            const totalGames = 0; // Calculate from games if needed
            const totalPlayers = allUsers.filter(u => u.role === 'employee').length;

            res.json({ totalRevenue: totalRevenue.toFixed(2), totalGames, totalPlayers });
        } else {
            // Return basic response for non-admin users
            res.json({ totalRevenue: "0.00", totalGames: 0, totalPlayers: 0 });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to get shop statistics" });
    }
}

// ─── GET ADMIN SHOPS ───────────────────────────────────────────────
export async function getAdminShops(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await resolveAdminUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        // Return empty shops array for now - can be enhanced later
        res.json([]);
    } catch (error) {
        console.error("Failed to get admin shops:", error);
        res.status(500).json({ message: "Failed to get admin shops" });
    }
}

// ─── ADMIN SHOP STATS (with commission rate) ───────────────────────
export async function getShopStatsWithCommission(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await resolveAdminUser(userId);
        if (!user || (user.role !== 'admin' && user.role !== 'employee')) {
            return res.status(403).json({ message: "Access denied" });
        }

        const shop = { name: "Default Shop" }; // Simplified for now
        const commissionRate = "30"; // Default commission rate

        res.json({
            commissionRate,
            shopId: user.shopId,
            shopName: shop?.name || "Unknown Shop",
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching shop stats:', error);
        res.status(500).json({ message: "Internal server error" });
    }
}
