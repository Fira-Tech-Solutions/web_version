// @ts-nocheck
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { storage } from "../../storage/storage";

// ─── GET SUPER ADMIN's ADMINS ───────────────────────────────────────
export async function getAdmins(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const admins = await storage.getAdminUsers();

        const enrichedAdmins = await Promise.all(
            admins.map(async (admin: any) => {
                if (admin.shopId) {
                    const shop = await storage.getShop(admin.shopId);
                    return { ...admin, commissionRate: shop?.superAdminCommission || '15' };
                }
                return { ...admin, commissionRate: '15' };
            })
        );

        res.json(enrichedAdmins);
    } catch (error) {
        res.status(500).json({ message: "Failed to get admin users" });
    }
}

// ─── CREATE ADMIN ───────────────────────────────────────────────────
export async function createAdminSA(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const { name, username, password, shopName, commissionRate } = req.body;
        if (!name || !username || !password || !shopName) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = await storage.createAdminUser({
            name, username, password: hashedPassword,
            shopName, commissionRate: commissionRate || "15"
        });

        res.json(newAdmin);
    } catch (error) {
        console.error("Admin creation error:", error);
        res.status(500).json({ message: "Failed to create admin user" });
    }
}

// ─── UPDATE ADMIN ───────────────────────────────────────────────────
export async function updateAdmin(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const adminId = parseInt(req.params.id);
        const updates = req.body;

        const adminUser = await storage.getUser(adminId);

        if (updates.commissionRate !== undefined && adminUser?.shopId) {
            await storage.updateShop(adminUser.shopId, { superAdminCommission: updates.commissionRate.toString() });
            delete updates.commissionRate;
        }

        let updatedAdmin = null;
        if (Object.keys(updates).length > 0) {
            const cleanedUpdates = { ...updates };
            if (cleanedUpdates.password === '') delete cleanedUpdates.password;
            if (cleanedUpdates.shopName !== undefined) delete cleanedUpdates.shopName;

            if (Object.keys(cleanedUpdates).length > 0) {
                updatedAdmin = await storage.updateUser(adminId, cleanedUpdates);
            } else {
                updatedAdmin = await storage.getUser(adminId);
            }
        } else {
            updatedAdmin = await storage.getUser(adminId);
        }

        res.json(updatedAdmin);
    } catch (error) {
        console.error("Admin update error:", error);
        res.status(500).json({ message: "Failed to update admin user", error: error.message });
    }
}

// ─── BLOCK/UNBLOCK ADMIN ────────────────────────────────────────────
export async function toggleBlockAdmin(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const adminId = parseInt(req.params.id);
        const action = req.params.action;

        if (action === 'block') {
            await storage.updateUser(adminId, { isBlocked: true });
            await storage.blockEmployeesByAdmin(adminId);
        } else if (action === 'unblock') {
            await storage.updateUser(adminId, { isBlocked: false });
            await storage.unblockEmployeesByAdmin(adminId);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: `Failed to ${req.params.action} admin user` });
    }
}

// ─── REFERRAL COMMISSIONS ───────────────────────────────────────────
export async function getReferralCommissions(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(403).json({ message: "Super admin access required" });

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const commissions = await storage.getAllReferralCommissions();
        res.json(commissions);
    } catch (error) {
        res.status(500).json({ message: "Failed to get referral commissions" });
    }
}

// ─── REFERRAL SETTINGS ──────────────────────────────────────────────
export async function getReferralSettings(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(403).json({ message: "Super admin access required" });

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const settings = await storage.getReferralSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: "Failed to get referral settings" });
    }
}

export async function updateReferralSettings(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) return res.status(403).json({ message: "Super admin access required" });

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const settings = req.body;
        await storage.updateReferralSettings(settings);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Failed to update referral settings" });
    }
}
