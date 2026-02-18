// @ts-nocheck
import type { Request, Response } from "express";
import { storage } from "../../storage/storage";

// ─── GET SHOP ANALYTICS ─────────────────────────────────────────────
export async function getShopAnalytics(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const shopId = parseInt(req.params.shopId);
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const shopStats = await storage.getShopStats(shopId, start, end);
        const gameHistory = await storage.getGameHistory(shopId, start, end);

        const totalRevenue = gameHistory.reduce((sum, game) => sum + parseFloat(game.totalCollected || "0"), 0);
        const totalPrizes = gameHistory.reduce((sum, game) => sum + parseFloat(game.prizeAmount || "0"), 0);
        const adminProfit = gameHistory.reduce((sum, game) => sum + parseFloat(game.adminProfit || "0"), 0);
        const superAdminCommission = gameHistory.reduce((sum, game) => sum + parseFloat(game.superAdminCommission || "0"), 0);

        const employees = await storage.getUsersByShop(shopId);
        const employeeStats = await Promise.all(
            employees.filter(emp => emp.role === 'employee').map(async (emp) => {
                const empStats = await storage.getEmployeeStats(emp.id, start, end);
                const empHistory = await storage.getEmployeeGameHistory(emp.id, start, end);
                return {
                    employee: emp, stats: empStats,
                    games: empHistory.length,
                    totalCollected: empHistory.reduce((sum, game) => sum + parseFloat(game.totalCollected || "0"), 0)
                };
            })
        );

        const profitMargin = totalRevenue > 0 ? ((adminProfit / totalRevenue) * 100) : 0;
        const prizePercentage = totalRevenue > 0 ? ((totalPrizes / totalRevenue) * 100) : 0;

        res.json({
            basicStats: shopStats,
            profitBreakdown: {
                totalRevenue: totalRevenue.toFixed(2), totalPrizes: totalPrizes.toFixed(2),
                adminProfit: adminProfit.toFixed(2), superAdminCommission: superAdminCommission.toFixed(2),
                profitMargin: profitMargin.toFixed(2), prizePercentage: prizePercentage.toFixed(2)
            },
            employeePerformance: employeeStats,
            gameHistory: gameHistory.slice(0, 20),
            totalGames: gameHistory.length
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to get shop analytics" });
    }
}

// ─── GET PROFIT DISTRIBUTION ────────────────────────────────────────
export async function getProfitDistribution(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ message: "Super admin access required" });
        }

        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const shops = await storage.getShops();

        const shopAnalytics = await Promise.all(
            shops.map(async (shop) => {
                const gameHistory = await storage.getGameHistory(shop.id, start, end);
                const totalRevenue = gameHistory.reduce((sum, game) => sum + parseFloat(game.totalCollected || "0"), 0);
                const adminProfit = gameHistory.reduce((sum, game) => sum + parseFloat(game.adminProfit || "0"), 0);
                const superAdminCommission = gameHistory.reduce((sum, game) => sum + parseFloat(game.superAdminCommission || "0"), 0);

                return {
                    shop,
                    totalRevenue: totalRevenue.toFixed(2),
                    adminProfit: adminProfit.toFixed(2),
                    superAdminCommission: superAdminCommission.toFixed(2),
                    gameCount: gameHistory.length
                };
            })
        );

        const totalSystemRevenue = shopAnalytics.reduce((sum, shop) => sum + parseFloat(shop.totalRevenue), 0);
        const totalAdminProfits = shopAnalytics.reduce((sum, shop) => sum + parseFloat(shop.adminProfit), 0);
        const totalSuperAdminCommissions = shopAnalytics.reduce((sum, shop) => sum + parseFloat(shop.superAdminCommission), 0);

        res.json({
            shopAnalytics,
            systemTotals: {
                totalRevenue: totalSystemRevenue.toFixed(2),
                totalAdminProfits: totalAdminProfits.toFixed(2),
                totalSuperAdminCommissions: totalSuperAdminCommissions.toFixed(2),
                totalGames: shopAnalytics.reduce((sum, shop) => sum + shop.gameCount, 0)
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to get profit distribution analytics" });
    }
}

// ─── GET FINANCIAL TRENDS ───────────────────────────────────────────
export async function getFinancialTrends(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { shopId, period = 'week' } = req.query;

        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
            case 'week': startDate.setDate(endDate.getDate() - 7); break;
            case 'month': startDate.setMonth(endDate.getMonth() - 1); break;
            case 'quarter': startDate.setMonth(endDate.getMonth() - 3); break;
            case 'year': startDate.setFullYear(endDate.getFullYear() - 1); break;
        }

        let gameHistory;
        if (user.role === 'admin' && !shopId) {
            const shops = await storage.getShops();
            gameHistory = [];
            for (const shop of shops) {
                const shopGames = await storage.getGameHistory(shop.id, startDate, endDate);
                gameHistory.push(...shopGames);
            }
        } else {
            const targetShopId = shopId ? parseInt(shopId as string) : user.shopId!;
            gameHistory = await storage.getGameHistory(targetShopId, startDate, endDate);
        }

        const dailyData = new Map();
        gameHistory.forEach(game => {
            const date = new Date(game.completedAt).toISOString().split('T')[0];
            if (!dailyData.has(date)) {
                dailyData.set(date, { date, revenue: 0, games: 0, prizes: 0, profit: 0 });
            }
            const day = dailyData.get(date);
            day.revenue += parseFloat(game.totalCollected || "0");
            day.games += 1;
            day.prizes += parseFloat(game.prizeAmount || "0");
            day.profit += parseFloat(game.adminProfit || "0");
        });

        const trends = Array.from(dailyData.values()).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        res.json({
            trends,
            summary: {
                totalRevenue: trends.reduce((sum, day) => sum + day.revenue, 0).toFixed(2),
                totalGames: trends.reduce((sum, day) => sum + day.games, 0),
                totalPrizes: trends.reduce((sum, day) => sum + day.prizes, 0).toFixed(2),
                totalProfit: trends.reduce((sum, day) => sum + day.profit, 0).toFixed(2),
                averageDailyRevenue: trends.length > 0
                    ? (trends.reduce((sum, day) => sum + day.revenue, 0) / trends.length).toFixed(2)
                    : "0.00"
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to get financial trends" });
    }
}

// ─── GET EMPLOYEE PERFORMANCE ───────────────────────────────────────
export async function getEmployeePerformance(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { shopId, startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        let employees;
        if (user.role === 'admin' && !shopId) {
            const allUsers = await storage.getUsers();
            employees = allUsers.filter(u => u.role === 'employee');
        } else {
            const targetShopId = shopId ? parseInt(shopId as string) : user.shopId!;
            employees = await storage.getUsersByShop(targetShopId);
            employees = employees.filter(emp => emp.role === 'employee');
        }

        const performanceData = await Promise.all(
            employees.map(async (emp) => {
                const empStats = await storage.getEmployeeStats(emp.id, start, end);
                const empHistory = await storage.getEmployeeGameHistory(emp.id, start, end);

                const totalRevenue = empHistory.reduce((sum, game) => sum + parseFloat(game.totalCollected || "0"), 0);
                const totalPrizes = empHistory.reduce((sum, game) => sum + parseFloat(game.prizeAmount || "0"), 0);
                const avgGameValue = empHistory.length > 0 ? totalRevenue / empHistory.length : 0;

                return {
                    employee: { id: emp.id, name: emp.name, username: emp.username, shopId: emp.shopId },
                    stats: empStats,
                    performance: {
                        totalGames: empHistory.length,
                        totalRevenue: totalRevenue.toFixed(2),
                        totalPrizes: totalPrizes.toFixed(2),
                        averageGameValue: avgGameValue.toFixed(2),
                        efficiency: empHistory.length > 0 ? ((totalRevenue - totalPrizes) / totalRevenue * 100).toFixed(2) : "0.00"
                    }
                };
            })
        );

        performanceData.sort((a, b) => parseFloat(b.performance.totalRevenue) - parseFloat(a.performance.totalRevenue));
        res.json(performanceData);
    } catch (error) {
        res.status(500).json({ message: "Failed to get employee performance analytics" });
    }
}

// ─── EXPORT ANALYTICS DATA ─────────────────────────────────────────
export async function exportAnalytics(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { shopId, startDate, endDate, type = 'games' } = req.query;
        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        let data;
        if (type === 'games') {
            if (user.role === 'admin' && !shopId) {
                const shops = await storage.getShops();
                data = [];
                for (const shop of shops) {
                    const shopGames = await storage.getGameHistory(shop.id, start, end);
                    data.push(...shopGames.map(game => ({ ...game, shopName: shop.name })));
                }
            } else {
                const targetShopId = shopId ? parseInt(shopId as string) : user.shopId!;
                data = await storage.getGameHistory(targetShopId, start, end);
            }
        }

        res.json({
            data,
            exportedAt: new Date().toISOString(),
            filters: { shopId, startDate, endDate, type }
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to export analytics data" });
    }
}
