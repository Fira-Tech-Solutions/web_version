import {
  users, shops, games, gamePlayers, transactions, gameHistory,
  dailyRevenueSummary, employeeProfitMargins,
  cartelas, customCartelas,
  type User, type InsertUser, type Shop, type InsertShop,
  type Game, type InsertGame, type GamePlayer, type InsertGamePlayer,
  type Transaction, type InsertTransaction,
  type GameHistory, type InsertGameHistory,
  type DailyRevenueSummary, type InsertDailyRevenueSummary,
  type EmployeeProfitMargin, type InsertEmployeeProfitMargin,
  type CustomCartela, type InsertCustomCartela
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, gte, lte, sum, count } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByShopId(shopId: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  updateUserBalance(id: number, balance: string): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsersByShop(shopId: number): Promise<User[]>;

  // Shop methods
  getShop(id: number): Promise<Shop | undefined>;
  getShops(): Promise<Shop[]>;
  createShop(shop: InsertShop): Promise<Shop>;
  updateShop(id: number, updates: Partial<InsertShop>): Promise<Shop | undefined>;
  getShopsByAdmin(adminId: number): Promise<Shop[]>;

  // Game methods
  getGame(id: number): Promise<Game | undefined>;
  getGamesByShop(shopId: number): Promise<Game[]>;
  getActiveGameByEmployee(employeeId: number): Promise<Game | undefined>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: number, updates: Partial<InsertGame>): Promise<Game | undefined>;
  updateGameStatus(gameId: number, status: string): Promise<Game>;
  updateGameNumbers(gameId: number, calledNumbers: string[]): Promise<Game>;
  updateGamePrizePool(gameId: number, additionalAmount: number): Promise<Game>;
  completeGame(gameId: number, winnerId: number, prizeAmount: string): Promise<Game>;

  // Game Player methods
  getGamePlayers(gameId: number): Promise<GamePlayer[]>;
  getGamePlayerCount(gameId: number): Promise<number>;
  createGamePlayer(player: InsertGamePlayer): Promise<GamePlayer>;
  addGamePlayer(player: InsertGamePlayer): Promise<GamePlayer>;
  updateGamePlayer(id: number, updates: Partial<InsertGamePlayer>): Promise<GamePlayer | undefined>;
  removeGamePlayer(id: number): Promise<boolean>;

  // Transaction methods
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByShop(shopId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]>;
  getTransactionsByEmployee(employeeId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]>;



  // Game History methods
  createGameHistory(history: InsertGameHistory): Promise<GameHistory>;
  recordGameHistory(history: InsertGameHistory): Promise<GameHistory>;
  getGameHistory(shopId: number, startDate?: Date, endDate?: Date): Promise<GameHistory[]>;
  getEmployeeGameHistory(employeeId: number, startDate?: Date, endDate?: Date): Promise<GameHistory[]>;

  // Analytics methods
  getShopStats(shopId: number, startDate?: Date, endDate?: Date): Promise<{
    totalRevenue: string;
    totalGames: number;
    totalPlayers: number;
  }>;
  getEmployeeStats(employeeId: number, startDate?: Date, endDate?: Date): Promise<{
    totalCollections: string;
    gamesCompleted: number;
    playersRegistered: number;
  }>;

  // Profit sharing
  calculateProfitSharing(gameAmount: string, shopId: number): Promise<{
    adminProfit: string;
    prizeAmount: string;
  }>;
  processGameProfits(gameId: number, totalCollected: string): Promise<void>;
  generateAccountNumber(): Promise<string>;

  // Daily revenue summary methods
  createOrUpdateDailyRevenueSummary(summary: InsertDailyRevenueSummary): Promise<DailyRevenueSummary>;
  getDailyRevenueSummary(date: string): Promise<DailyRevenueSummary | undefined>;
  getDailyRevenueSummaries(dateFrom?: string, dateTo?: string): Promise<DailyRevenueSummary[]>;

  // Employee profit margin methods
  setEmployeeProfitMargin(margin: InsertEmployeeProfitMargin): Promise<EmployeeProfitMargin>;
  getEmployeeProfitMarginsByAdmin(adminId: number): Promise<any[]>;
  updateEmployeeProfitMargin(marginId: number, profitMargin: string, adminId: number): Promise<EmployeeProfitMargin>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;

  // Employee cartela marking methods
  markCartelaByEmployee(cartelaId: number, employeeId: number): Promise<void>;
  unmarkCartelaByEmployee(cartelaId: number, employeeId: number): Promise<void>;

  // Game reset methods
  resetCartelasForShop(shopId: number): Promise<void>;

  // EAT time zone utility methods
  getCurrentEATDate(): string;
  performDailyReset(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      console.log("Database user found:", user ? `${user.username} (id: ${user.id})` : "none");
      return user || undefined;
    } catch (error) {
      console.error("Database error in getUserByUsername:", error);
      throw error;
    }
  }

  async getUserByAccountNumber(accountNumber: string): Promise<User | undefined> {
    try {
      console.log("Looking up user by account number:", accountNumber);
      const [user] = await db.select().from(users).where(eq(users.accountNumber, accountNumber));
      console.log("Found user:", user ? `${user.username} (id: ${user.id})` : "none");
      return user || undefined;
    } catch (error) {
      console.error("Database error in getUserByAccountNumber:", error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount > 0;
  }

  async getUsersByShop(shopId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.shopId, shopId));
  }

  async getUserByShopId(shopId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.shopId, shopId), eq(users.role, 'admin')));
    return user || undefined;
  }

  async updateUserBalance(id: number, balance: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ balance }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getShop(id: number): Promise<Shop | undefined> {
    const [shop] = await db.select().from(shops).where(eq(shops.id, id));
    return shop || undefined;
  }

  async getShops(): Promise<Shop[]> {
    return await db.select().from(shops).orderBy(desc(shops.createdAt));
  }

  async createShop(insertShop: InsertShop): Promise<Shop> {
    const [shop] = await db.insert(shops).values(insertShop).returning();
    return shop;
  }

  async updateShop(id: number, updates: Partial<InsertShop>): Promise<Shop | undefined> {
    const [shop] = await db.update(shops).set(updates).where(eq(shops.id, id)).returning();
    return shop || undefined;
  }

  async getShopsByAdmin(adminId: number): Promise<Shop[]> {
    return await db.select().from(shops).where(eq(shops.adminId, adminId));
  }

  async getGame(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game || undefined;
  }

  async getGamesByShop(shopId: number): Promise<Game[]> {
    return await db.select().from(games)
      .where(eq(games.shopId, shopId))
      .orderBy(desc(games.createdAt));
  }

  async getActiveGameByEmployee(employeeId: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games)
      .where(and(
        eq(games.employeeId, employeeId),
        or(
          eq(games.status, 'waiting'),
          eq(games.status, 'pending'),
          eq(games.status, 'active')
        )
      ))
      .orderBy(desc(games.id));
    return game || undefined;
  }

  async getActiveGameByShop(shopId: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games)
      .where(and(
        eq(games.shopId, shopId),
        or(
          eq(games.status, 'waiting'),
          eq(games.status, 'pending'),
          eq(games.status, 'active'),
          eq(games.status, 'paused')
        )
      ))
      .orderBy(desc(games.id));
    return game || undefined;
  }

  async getRecentGamesByShop(shopId: number, hoursBack: number = 1): Promise<Game[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    const recentGames = await db.select().from(games)
      .where(and(
        eq(games.shopId, shopId),
        gte(games.createdAt, cutoffTime)
      ))
      .orderBy(desc(games.id));
    return recentGames;
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const [game] = await db.insert(games).values(insertGame).returning();
    return game;
  }

  async updateGame(id: number, updates: Partial<InsertGame>): Promise<Game | undefined> {
    const [game] = await db.update(games).set(updates).where(eq(games.id, id)).returning();
    return game || undefined;
  }

  async updateGameStatus(gameId: number, status: string): Promise<Game> {
    const [game] = await db.update(games)
      .set({ status, startedAt: status === 'active' ? new Date() : undefined })
      .where(eq(games.id, gameId))
      .returning();
    return game;
  }

  async updateGameNumbers(gameId: number, calledNumbers: string[]): Promise<Game> {
    // Get current game to check if it's paused
    const currentGame = await this.getGame(gameId);
    if (currentGame && currentGame.status === 'paused' && calledNumbers.length > 0) {
      // Only block if trying to ADD numbers to a paused game
      // Allow clearing numbers (reset operation) even for paused games
      throw new Error('Cannot add numbers to paused game');
    }

    const [game] = await db.update(games)
      .set({ calledNumbers })
      .where(eq(games.id, gameId))
      .returning();
    return game;
  }

  async updateGamePrizePool(gameId: number, additionalAmount: number): Promise<Game> {
    const currentGame = await this.getGame(gameId);
    if (!currentGame) throw new Error('Game not found');

    const newPrizePool = (parseFloat(currentGame.prizePool) + additionalAmount).toString();
    const [game] = await db.update(games)
      .set({ prizePool: newPrizePool })
      .where(eq(games.id, gameId))
      .returning();
    return game;
  }

  async completeGame(gameId: number, winnerId: number, prizeAmount: string): Promise<Game> {
    const [game] = await db.update(games)
      .set({
        status: 'completed',
        winnerId,
        completedAt: new Date()
      })
      .where(eq(games.id, gameId))
      .returning();
    return game;
  }

  async getGamePlayers(gameId: number): Promise<GamePlayer[]> {
    return await db.select().from(gamePlayers)
      .where(eq(gamePlayers.gameId, gameId))
      .orderBy(desc(gamePlayers.registeredAt));
  }

  async createGamePlayer(insertPlayer: InsertGamePlayer): Promise<GamePlayer> {
    const [player] = await db.insert(gamePlayers).values(insertPlayer).returning();
    return player;
  }

  async addGamePlayer(insertPlayer: InsertGamePlayer): Promise<GamePlayer> {
    return this.createGamePlayer(insertPlayer);
  }

  async getGamePlayerCount(gameId: number): Promise<number> {
    const result = await db.select({ count: count() })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, gameId));
    return result[0]?.count || 0;
  }

  async updateGamePlayer(id: number, updates: Partial<InsertGamePlayer>): Promise<GamePlayer | undefined> {
    const [player] = await db.update(gamePlayers).set(updates).where(eq(gamePlayers.id, id)).returning();
    return player || undefined;
  }

  async removeGamePlayer(id: number): Promise<boolean> {
    const result = await db.delete(gamePlayers).where(eq(gamePlayers.id, id));
    return result.rowCount > 0;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }

  async getTransactionsByShop(shopId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (startDate && endDate) {
      return await db.select().from(transactions).where(and(
        eq(transactions.shopId, shopId),
        gte(transactions.createdAt, startDate),
        lte(transactions.createdAt, endDate)
      )).orderBy(desc(transactions.createdAt));
    }

    return await db.select().from(transactions)
      .where(eq(transactions.shopId, shopId))
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByEmployee(employeeId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (startDate && endDate) {
      return await db.select().from(transactions).where(and(
        eq(transactions.employeeId, employeeId),
        gte(transactions.createdAt, startDate),
        lte(transactions.createdAt, endDate)
      )).orderBy(desc(transactions.createdAt));
    }

    return await db.select().from(transactions)
      .where(eq(transactions.employeeId, employeeId))
      .orderBy(desc(transactions.createdAt));
  }



  async createGameHistory(insertHistory: InsertGameHistory): Promise<GameHistory> {
    const [history] = await db.insert(gameHistory).values(insertHistory).returning();
    return history;
  }

  async recordGameHistory(insertHistory: InsertGameHistory): Promise<GameHistory> {
    return this.createGameHistory(insertHistory);
  }

  async getGameHistory(shopId: number, startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = db.select({
      id: gameHistory.id,
      gameId: gameHistory.gameId,
      shopId: gameHistory.shopId,
      employeeId: gameHistory.employeeId,
      totalCollected: gameHistory.totalCollected,
      prizeAmount: gameHistory.prizeAmount,
      adminProfit: gameHistory.adminProfit,

      playerCount: gameHistory.playerCount,
      winnerName: gamePlayers.playerName,
      completedAt: gameHistory.completedAt,
      winnerId: games.winnerId,
      winningCartela: gameHistory.winningCartela
    })
      .from(gameHistory)
      .leftJoin(games, eq(gameHistory.gameId, games.id))
      .leftJoin(gamePlayers, eq(games.winnerId, gamePlayers.id))
      .where(eq(gameHistory.shopId, shopId));

    if (startDate && endDate) {
      query = query.where(and(
        eq(gameHistory.shopId, shopId),
        gte(gameHistory.completedAt, startDate),
        lte(gameHistory.completedAt, endDate)
      ));
    }

    return await query.orderBy(desc(gameHistory.completedAt));
  }

  async getEmployeeGameHistory(employeeId: number, startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = db.select({
      id: gameHistory.id,
      gameId: gameHistory.gameId,
      shopId: gameHistory.shopId,
      employeeId: gameHistory.employeeId,
      totalCollected: gameHistory.totalCollected,
      prizeAmount: gameHistory.prizeAmount,
      adminProfit: gameHistory.adminProfit,

      playerCount: gameHistory.playerCount,
      winnerName: gamePlayers.playerName,
      completedAt: gameHistory.completedAt,
      winnerId: games.winnerId,
      winningCartela: gameHistory.winningCartela
    })
      .from(gameHistory)
      .leftJoin(games, eq(gameHistory.gameId, games.id))
      .leftJoin(gamePlayers, eq(games.winnerId, gamePlayers.id))
      .where(eq(gameHistory.employeeId, employeeId));

    if (startDate && endDate) {
      query = query.where(and(
        eq(gameHistory.employeeId, employeeId),
        gte(gameHistory.completedAt, startDate),
        lte(gameHistory.completedAt, endDate)
      ));
    }

    return await query.orderBy(desc(gameHistory.completedAt));
  }

  async getShopStats(shopId: number, startDate?: Date, endDate?: Date): Promise<{
    totalRevenue: string;
    totalGames: number;
    totalPlayers: number;
  }> {
    // Use game history for revenue calculation to avoid duplicates
    let revenueQuery = db.select({
      total: sum(gameHistory.totalCollected).as('total')
    }).from(gameHistory).where(eq(gameHistory.shopId, shopId));

    let gameQuery = db.select({
      count: count().as('count')
    }).from(games).where(eq(games.shopId, shopId));

    let playerQuery = db.select({
      count: count().as('count')
    }).from(gamePlayers)
      .leftJoin(games, eq(gamePlayers.gameId, games.id))
      .where(eq(games.shopId, shopId));

    if (startDate && endDate) {
      revenueQuery = revenueQuery.where(and(
        eq(gameHistory.shopId, shopId),
        gte(gameHistory.completedAt, startDate),
        lte(gameHistory.completedAt, endDate)
      ));

      gameQuery = gameQuery.where(and(
        eq(games.shopId, shopId),
        gte(games.createdAt, startDate),
        lte(games.createdAt, endDate)
      ));

      playerQuery = playerQuery.where(and(
        eq(games.shopId, shopId),
        gte(gamePlayers.registeredAt, startDate),
        lte(gamePlayers.registeredAt, endDate)
      ));
    }

    const [revenueResult] = await revenueQuery;
    const [gamesResult] = await gameQuery;
    const [playersResult] = await playerQuery;

    return {
      totalRevenue: revenueResult.total || "0",
      totalGames: gamesResult.count || 0,
      totalPlayers: playersResult.count || 0,
    };
  }

  async getEmployeeStats(employeeId: number, startDate?: Date, endDate?: Date): Promise<{
    totalCollections: string;
    gamesCompleted: number;
    playersRegistered: number;
  }> {
    let transactionQuery = db.select({
      total: sum(transactions.amount).as('total')
    }).from(transactions)
      .where(and(
        eq(transactions.employeeId, employeeId),
        eq(transactions.type, 'entry_fee')
      ));

    let gameQuery = db.select({
      count: count().as('count')
    }).from(games)
      .where(and(
        eq(games.employeeId, employeeId),
        eq(games.status, 'completed')
      ));

    let playerQuery = db.select({
      count: count().as('count')
    }).from(gamePlayers)
      .leftJoin(games, eq(gamePlayers.gameId, games.id))
      .where(eq(games.employeeId, employeeId));

    if (startDate && endDate) {
      transactionQuery = transactionQuery.where(and(
        eq(transactions.employeeId, employeeId),
        eq(transactions.type, 'entry_fee'),
        gte(transactions.createdAt, startDate),
        lte(transactions.createdAt, endDate)
      ));

      gameQuery = gameQuery.where(and(
        eq(games.employeeId, employeeId),
        eq(games.status, 'completed'),
        gte(games.createdAt, startDate),
        lte(games.createdAt, endDate)
      ));

      playerQuery = playerQuery.where(and(
        eq(games.employeeId, employeeId),
        gte(gamePlayers.registeredAt, startDate),
        lte(gamePlayers.registeredAt, endDate)
      ));
    }

    const [collectionsResult] = await transactionQuery;
    const [gamesResult] = await gameQuery;
    const [playersResult] = await playerQuery;

    return {
      totalCollections: collectionsResult.total || "0",
      gamesCompleted: gamesResult.count || 0,
      playersRegistered: playersResult.count || 0,
    };
  }











  async generateAccountNumber(): Promise<string> {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BGO${timestamp}${random}`;
  }

  // Daily revenue summary methods
  async createOrUpdateDailyRevenueSummary(summary: InsertDailyRevenueSummary): Promise<DailyRevenueSummary> {
    const existing = await this.getDailyRevenueSummary(summary.date);

    if (existing) {
      const [updated] = await db
        .update(dailyRevenueSummary)
        .set({
          ...summary,
          updatedAt: new Date(),
        })
        .where(eq(dailyRevenueSummary.date, summary.date))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(dailyRevenueSummary)
        .values(summary)
        .returning();
      return created;
    }
  }

  async getDailyRevenueSummary(date: string): Promise<DailyRevenueSummary | undefined> {
    const [summary] = await db
      .select()
      .from(dailyRevenueSummary)
      .where(eq(dailyRevenueSummary.date, date));
    return summary || undefined;
  }

  async getDailyRevenueSummaries(dateFrom?: string, dateTo?: string): Promise<DailyRevenueSummary[]> {
    let query = db.select().from(dailyRevenueSummary);

    if (dateFrom && dateTo) {
      query = query.where(
        and(
          gte(dailyRevenueSummary.date, dateFrom),
          lte(dailyRevenueSummary.date, dateTo)
        )
      );
    } else if (dateFrom) {
      query = query.where(gte(dailyRevenueSummary.date, dateFrom));
    } else if (dateTo) {
      query = query.where(lte(dailyRevenueSummary.date, dateTo));
    }

    return await query.orderBy(desc(dailyRevenueSummary.date));
  }

  // EAT time zone utility methods
  getCurrentEATDate(): string {
    const now = new Date();
    const eatTime = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // UTC+3
    return eatTime.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  async performDailyReset(): Promise<void> {
    const today = this.getCurrentEATDate();

    // Get annual stats instead of super admin revenue
    const shopsList = await this.getShops();
    let totalGames = 0;

    // Create or update daily summary with simplified stats
    await this.createOrUpdateDailyRevenueSummary({
      date: today,
      totalSuperAdminRevenue: "0.00",
      totalAdminRevenue: "0.00",
      totalGamesPlayed: 0,
      totalPlayersRegistered: 0,
    });
  }


  // Employee profit margin methods
  async setEmployeeProfitMargin(margin: InsertEmployeeProfitMargin): Promise<EmployeeProfitMargin> {
    const [result] = await db
      .insert(employeeProfitMargins)
      .values(margin)
      .onConflictDoUpdate({
        target: [employeeProfitMargins.employeeId, employeeProfitMargins.shopId],
        set: { profitMargin: margin.profitMargin }
      })
      .returning();
    return result;
  }

  async getEmployeeProfitMarginsByAdmin(adminId: number): Promise<any[]> {
    const result = await db
      .select({
        id: employeeProfitMargins.id,
        employeeId: employeeProfitMargins.employeeId,
        shopId: employeeProfitMargins.shopId,
        profitMargin: employeeProfitMargins.profitMargin,
        employeeName: users.name,
        employeeUsername: users.username,
        shopName: shops.name
      })
      .from(employeeProfitMargins)
      .leftJoin(users, eq(employeeProfitMargins.employeeId, users.id))
      .leftJoin(shops, eq(employeeProfitMargins.shopId, shops.id))
      .where(eq(shops.adminId, adminId));
    return result;
  }

  async updateEmployeeProfitMargin(marginId: number, profitMargin: string, adminId: number): Promise<EmployeeProfitMargin> {
    // Verify ownership through shop admin
    const [result] = await db
      .update(employeeProfitMargins)
      .set({ profitMargin })
      .from(shops)
      .where(
        and(
          eq(employeeProfitMargins.id, marginId),
          eq(employeeProfitMargins.shopId, shops.id),
          eq(shops.adminId, adminId)
        )
      )
      .returning();
    return result;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  // Admin management methods for Super Admin
  async getAdminUsers(): Promise<Array<User & { shopName?: string }>> {
    const adminUsers = await db.select({
      id: users.id,
      username: users.username,
      password: users.password,
      role: users.role,
      name: users.name,
      email: users.email,
      isBlocked: users.isBlocked,
      shopId: users.shopId,
      creditBalance: users.creditBalance,
      accountNumber: users.accountNumber,
      referredBy: users.referredBy,
      createdAt: users.createdAt,
      shopName: shops.name,
    })
      .from(users)
      .leftJoin(shops, eq(users.shopId, shops.id))
      .where(eq(users.role, 'admin'))
      .orderBy(desc(users.createdAt));

    return adminUsers;
  }

  async createAdminUser(adminData: any): Promise<User> {
    const accountNumber = await this.generateAccountNumber();

    // Create shop first with auto-generated ID
    const [newShop] = await db.insert(shops).values({
      name: adminData.shopName,
      profitMargin: "20.00",
      superAdminCommission: adminData.commissionRate || "15.00",
      referralCommission: "0.00",
      isBlocked: false,
      totalRevenue: "0.00"
    }).returning();

    // Create admin and link to shop
    const [newAdmin] = await db.insert(users).values({
      username: adminData.username,
      password: adminData.password, // Should be hashed in real implementation
      role: 'admin',
      name: adminData.name,
      email: adminData.email || `${adminData.username}@shop.local`,
      shopId: newShop.id,
      balance: adminData.initialCredit || "0.00",
      accountNumber,
      isBlocked: false,
    }).returning();

    // Update shop to link back to admin
    await db.update(shops)
      .set({ adminId: newAdmin.id })
      .where(eq(shops.id, newShop.id));

    return { ...newAdmin, shopName: newShop.name };
  }

  // Block/unblock employees based on admin status
  async blockEmployeesByAdmin(adminId: number): Promise<void> {
    // Get the admin's shop first
    const admin = await this.getUser(adminId);
    if (!admin || !admin.shopId) return;

    // Block all employees in this shop
    await db.update(users)
      .set({ isBlocked: true })
      .where(and(
        eq(users.shopId, admin.shopId),
        eq(users.role, 'employee')
      ));
  }

  async unblockEmployeesByAdmin(adminId: number): Promise<void> {
    // Get the admin's shop first
    const admin = await this.getUser(adminId);
    if (!admin || !admin.shopId) return;

    // Unblock all employees in this shop
    await db.update(users)
      .set({ isBlocked: false })
      .where(and(
        eq(users.shopId, admin.shopId),
        eq(users.role, 'employee')
      ));
  }

  // Custom cartela methods implementation
  async getCustomCartelas(shopId: number): Promise<CustomCartela[]> {
    return await db.select().from(customCartelas)
      .where(eq(customCartelas.shopId, shopId))
      .orderBy(customCartelas.cartelaNumber);
  }

  async getCustomCartela(id: number): Promise<CustomCartela | undefined> {
    const [cartela] = await db.select().from(customCartelas).where(eq(customCartelas.id, id));
    return cartela;
  }

  async getCartelaByNumber(shopId: number, cartelaNumber: number): Promise<any | null> {
    // First check cartelas table (where new cartelas are added)
    const cartelasResults = await db.select().from(cartelas).where(
      and(eq(cartelas.shopId, shopId), eq(cartelas.cartelaNumber, cartelaNumber))
    ).limit(1);

    if (cartelasResults.length > 0) {
      const cartela = cartelasResults[0];
      const parsedPattern = typeof cartela.pattern === 'string' ? JSON.parse(cartela.pattern) : cartela.pattern;
      return {
        ...cartela,
        pattern: parsedPattern,
        numbers: Array.isArray(parsedPattern) ? parsedPattern.flat() : [],
      };
    }

    // Then check customCartelas table as fallback
    const customResults = await db.select().from(customCartelas).where(
      and(eq(customCartelas.shopId, shopId), eq(customCartelas.cartelaNumber, cartelaNumber))
    ).limit(1);

    if (customResults.length === 0) return null;

    const cartela = customResults[0];
    return {
      ...cartela,
      pattern: typeof cartela.pattern === 'string' ? JSON.parse(cartela.pattern) : cartela.pattern,
      numbers: cartela.pattern.flat(),
    };
  }

  async createCustomCartela(cartela: InsertCustomCartela): Promise<CustomCartela> {
    const [newCartela] = await db.insert(customCartelas).values(cartela).returning();
    return newCartela;
  }

  async updateCustomCartela(id: number, updates: Partial<InsertCustomCartela>): Promise<CustomCartela | undefined> {
    const [updatedCartela] = await db.update(customCartelas)
      .set(updates)
      .where(eq(customCartelas.id, id))
      .returning();
    return updatedCartela;
  }

  async deleteCustomCartela(id: number): Promise<boolean> {
    const result = await db.delete(customCartelas).where(eq(customCartelas.id, id));
    return result.rowCount > 0;
  }



  async resetShopCartelas(shopId: number): Promise<void> {
    await db.update(cartelas)
      .set({
        isBooked: false,
        bookedBy: null,
        gameId: null,
        updatedAt: new Date()
      })
      .where(eq(cartelas.shopId, shopId));
  }

  async markCartelaByEmployee(cartelaId: number, employeeId: number): Promise<void> {
    // Check if cartela is already marked (isBooked)
    const [existingCartela] = await db.select().from(cartelas).where(eq(cartelas.id, cartelaId));

    if (existingCartela && existingCartela.isBooked) {
      throw new Error('Cartela is already marked');
    }

    await db.update(cartelas)
      .set({
        bookedBy: employeeId,
        isBooked: true,
        updatedAt: new Date()
      })
      .where(eq(cartelas.id, cartelaId));
  }

  async unmarkCartelaByEmployee(cartelaId: number, employeeId: number): Promise<void> {
    await db.update(cartelas)
      .set({
        bookedBy: null,
        isBooked: false,
        updatedAt: new Date()
      })
      .where(and(
        eq(cartelas.id, cartelaId),
        eq(cartelas.bookedBy, employeeId)
      ));
  }

  async resetCartelasForShop(shopId: number): Promise<void> {
    console.log(`🔄 RESET: Clearing all cartela selections for shop ${shopId}`);

    // Clear all cartela bookings and selections for this shop
    await db.update(cartelas)
      .set({
        isBooked: false,
        bookedBy: null,
        collectorId: null,
        updatedAt: new Date()
      })
      .where(eq(cartelas.shopId, shopId));

    console.log(`✅ RESET: All cartela selections cleared for shop ${shopId}`);
  }
}

export const storage = new DatabaseStorage();
