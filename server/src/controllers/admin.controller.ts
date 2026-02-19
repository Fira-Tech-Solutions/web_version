// @ts-nocheck
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "../../storage/storage";
import { adminStorage } from "../../storage/admin-storage";
import { adminDb } from "../../../scripts/admin-db";
import { employeeDb } from "../../../scripts/employee-db";
import { resolveAdminUser } from "../middleware/auth.middleware";
import { encryptData, decryptData, signBalance, verifyBalance, generateKeyPair } from "../lib/crypto";
import { emitBalanceUpdate, emitEvent } from "../services/socket.service";

const { privateKey: SYSTEM_PRIVATE_KEY, publicKey: SYSTEM_PUBLIC_KEY } = generateKeyPair();

// ─── GENERATE RECHARGE FILE ────────────────────────────────────────
export async function generateRechargeFile(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        const user = await resolveAdminUser(userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { targetUserId, employeeAccountNumber, amount, machineId, privateKey } = req.body;
        
        // Support both parameter names for backward compatibility
        const finalTargetUserId = targetUserId || employeeAccountNumber;
        
        console.log("Generate recharge request:", { targetUserId, employeeAccountNumber, finalTargetUserId, amount, hasPrivateKey: !!privateKey });
        
        if (!finalTargetUserId || !amount || !privateKey) {
            return res.status(400).json({ 
                message: "Target user ID/account number, amount, and private key required",
                received: { targetUserId, employeeAccountNumber, amount, hasPrivateKey: !!privateKey }
            });
        }

        // Get target user details - support both ID and account number
        let targetUser;
        if (!targetUserId) {
            // If it's not a number, treat as account number
            targetUser = await storage.getUserByAccountNumber(finalTargetUserId);
        } else {
            // If it's a number, treat as user ID
            targetUser = await storage.getUser(parseInt(finalTargetUserId));
        }
        
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

        // Sign the payload with RSA private key
        const signature = signBalance(payload, privateKey);
        
        // Create the encrypted file content
        const fileContent = {
            payload,
            signature
        };

        const encryptedData = encryptData(fileContent);

        // Record the recharge file in admin database
        await adminStorage.createRechargeFileRecord({
            filename: `recharge_${amount}_${targetUser.username}_${Date.now()}.enc`,
            fileData: encryptedData,
            signature: signature,
            employeeId: targetUser.id.toString(),
            amount,
            shopId: user.shopId
        });

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

        const signingKey = privateKey || SYSTEM_PRIVATE_KEY;
        const accountNumber = await storage.generateAccountNumber();

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

        const signature = signBalance(payload, signingKey);
        const encryptedData = encryptData(payload);

        console.log('Creating admin user with data:', {
            username, password, name: fullName, accountNumber,
            adminGeneratedBalance: (parseFloat(initialBalance || "0") * 10).toString(),
            employeePaidAmount: initialBalance || "0",
            shopId: user.shopId, isBlocked: false, role: 'employee'
        });

        await adminStorage.createAdminUser({
            username,
            password,
            name: fullName,
            accountNumber,
            adminGeneratedBalance: (parseFloat(initialBalance || "0") * 10).toString(),
            employeePaidAmount: initialBalance || "0",
            shopId: user.shopId,
            isBlocked: false,
            role: 'employee'
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

        const adminUsers = adminStorage.getAllAdminUsers();
        const rechargeFiles = adminStorage.getAllRechargeFiles();

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

        const totalEmployeePaid = adminStorage.getTotalEmployeePaid();
        const totalRechargeAmount = adminStorage.getTotalRechargeAmount();
        const userCount = mappedUsers.filter(user => user.role === 'employee').length;
        const rechargeFileCount = adminStorage.getRechargeFileCount();

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
            const allUsers = await storage.getUsers();
            employees = allUsers.filter(u => u.role === 'employee');
        } else {
            if (!user.shopId) {
                return res.status(400).json({ message: "Admin not assigned to a shop" });
            }
            const shopUsers = await storage.getUsersByShop(user.shopId);
            employees = shopUsers.filter(u => u.role === 'employee');
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

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const employeeId = parseInt(req.params.id);
        if (isNaN(employeeId)) {
            return res.status(400).json({ message: "Invalid employee ID" });
        }

        const deleted = await adminStorage.deleteAdminUser(employeeId);
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
        const user = await storage.getUser(userId);

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

        const employee = adminStorage.getAdminUserById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const stmt = adminDb.prepare(`UPDATE admin_users SET machine_id = ? WHERE id = ?`);
        stmt.run(machineId, employeeId);

        try {
            const employeeUser = await storage.getUser(employeeId);
            if (employeeUser) {
                const updateStmt = employeeDb.prepare(`UPDATE users SET machine_id = ? WHERE id = ?`);
                updateStmt.run(machineId, employeeId);
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

        const user = await storage.getUser(userId);
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

        const user = await storage.getUser(userId);
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

        const user = await storage.getUser(userId);
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
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Admin access required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { name, username, password, email } = req.body;

        if (!name || !username || !password) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const existingUser = await storage.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ message: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const employee = await storage.createUser({
            name, username, password: hashedPassword,
            email: email || null, role: 'employee', shopId: user.shopId!,
        });

        res.json({ employee: { ...employee, password: undefined } });
    } catch (error) {
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

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        if (user.role === 'admin') {
            const allShops = await storage.getShops();
            const totalRevenue = allShops.reduce((sum, shop) => sum + parseFloat(shop.totalRevenue || "0"), 0);
            const totalGames = allShops.reduce((sum, shop) => sum + (shop.totalGames || 0), 0);
            const totalPlayers = allShops.reduce((sum, shop) => sum + (shop.totalPlayers || 0), 0);

            res.json({ totalRevenue: totalRevenue.toFixed(2), totalGames, totalPlayers });
        } else {
            if (!user.shopId) {
                return res.status(400).json({ message: "Admin not assigned to a shop" });
            }
            const shopStats = await storage.getShopStats(user.shopId);
            res.json(shopStats);
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to get shop statistics" });
    }
}

// ─── GET ADMIN SHOPS ───────────────────────────────────────────────
export async function getAdminShops(req: Request, res: Response) {
    try {
        const user = req.session.user;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const shops = await storage.getShopsByAdmin(user.id);
        res.json(shops);
    } catch (error) {
        console.error("Failed to get admin shops:", error);
        res.status(500).json({ message: "Failed to get shops" });
    }
}

// ─── EMPLOYEE PROFIT MARGINS ───────────────────────────────────────
export async function getEmployeeProfitMargins(req: Request, res: Response) {
    try {
        const user = req.session.user;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const margins = await storage.getEmployeeProfitMarginsByAdmin(user.id);
        res.json(margins);
    } catch (error) {
        console.error("Failed to get employee profit margins:", error);
        res.status(500).json({ message: "Failed to get profit margins" });
    }
}

export async function setEmployeeProfitMargin(req: Request, res: Response) {
    try {
        const user = req.session.user;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const marginData = req.body; // insertEmployeeProfitMarginSchema.parse(req.body);

        const shop = await storage.getShop(marginData.shopId);
        if (!shop || shop.adminId !== user.id) {
            return res.status(404).json({ message: "Shop not found or not owned by you" });
        }

        const employee = await storage.getUser(marginData.employeeId);
        if (!employee || employee.role !== 'employee') {
            return res.status(404).json({ message: "Employee not found" });
        }

        const margin = await storage.setEmployeeProfitMargin(marginData);
        res.json(margin);
    } catch (error) {
        console.error("Failed to set employee profit margin:", error);
        res.status(500).json({ message: "Failed to set profit margin" });
    }
}

export async function updateEmployeeProfitMargin(req: Request, res: Response) {
    try {
        const user = req.session.user;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const marginId = parseInt(req.params.id);
        const { profitMargin } = req.body;

        if (!profitMargin || parseFloat(profitMargin) < 0 || parseFloat(profitMargin) > 100) {
            return res.status(400).json({ message: "Invalid profit margin" });
        }

        const updatedMargin = await storage.updateEmployeeProfitMargin(marginId, profitMargin, user.id);
        res.json(updatedMargin);
    } catch (error) {
        console.error("Failed to update employee profit margin:", error);
        res.status(500).json({ message: "Failed to update profit margin" });
    }
}

// ─── ADMIN SHOP STATS (with commission rate) ───────────────────────
export async function getShopStatsWithCommission(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || (user.role !== 'admin' && user.role !== 'employee')) {
            return res.status(403).json({ message: "Access denied" });
        }

        const shop = user.shopId ? await storage.getShop(user.shopId) : null;
        const commissionRate = shop?.superAdminCommission || "30";

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
