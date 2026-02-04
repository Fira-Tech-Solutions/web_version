import {
  users, shops, games, gamePlayers, transactions, gameHistory,
  dailyRevenueSummary, cartelas,
  type User, type Shop, type Game, type GamePlayer,
  type Transaction, type GameHistory, type DailyRevenueSummary, type Cartela
} from "@shared/schema-simple";
import { db } from "./db";
import { eq, and, or, desc, gte, lte, sum, count } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByShopId(shopId: number): Promise<User | undefined>;
  createUser(user: any): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserBalance(id: number, balance: string): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsersByShop(shopId: number): Promise<User[]>;

  // Shop methods
  getShop(id: number): Promise<Shop | undefined>;
  getShops(): Promise<Shop[]>;
  createShop(shop: any): Promise<Shop>;
  updateShop(id: number, updates: Partial<Shop>): Promise<Shop | undefined>;
  getShopsByAdmin(adminId: number): Promise<Shop[]>;

  // Game methods
  getGame(id: number): Promise<Game | undefined>;
  getGamesByShop(shopId: number): Promise<Game[]>;
  getActiveGameByEmployee(employeeId: number): Promise<Game | undefined>;
  createGame(game: any): Promise<Game>;
  updateGame(id: number, updates: Partial<Game>): Promise<Game | undefined>;
  updateGameStatus(gameId: number, status: string): Promise<Game>;
  updateGameNumbers(gameId: number, calledNumbers: string[]): Promise<Game>;
  updateGamePrizePool(gameId: number, additionalAmount: number): Promise<Game>;
  completeGame(gameId: number, winnerId: number, prizeAmount: string): Promise<Game>;

  // Game Player methods
  getGamePlayers(gameId: number): Promise<GamePlayer[]>;
  getGamePlayerCount(gameId: number): Promise<number>;
  createGamePlayer(player: any): Promise<GamePlayer>;
  addGamePlayer(player: any): Promise<GamePlayer>;
  updateGamePlayer(id: number, updates: Partial<GamePlayer>): Promise<GamePlayer | undefined>;
  removeGamePlayer(id: number): Promise<boolean>;

  // Transaction methods
  createTransaction(transaction: any): Promise<Transaction>;
  getTransactionsByShop(shopId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]>;
  getTransactionsByEmployee(employeeId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]>;

  // Game History methods
  createGameHistory(history: any): Promise<GameHistory>;
  recordGameHistory(history: any): Promise<GameHistory>;
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
  createOrUpdateDailyRevenueSummary(summary: any): Promise<DailyRevenueSummary>;
  getDailyRevenueSummary(date: string): Promise<DailyRevenueSummary | undefined>;
  getDailyRevenueSummaries(dateFrom?: string, dateTo?: string): Promise<DailyRevenueSummary[]>;

  // Cartela methods
  getCartelaByNumber(shopId: number, cartelaNumber: number): Promise<any | null>;
  resetCartelasForShop(shopId: number): Promise<void>;

  // Master Float methods
  getMasterFloat(shopId?: number): Promise<string>;
  getAllUserBalances(): Promise<{ userId: number; username: string; balance: string; role: string }[]>;

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

  async createUser(user: any): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.changes > 0;
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

  async createShop(shop: any): Promise<Shop> {
    const [newShop] = await db.insert(shops).values(shop).returning();
    return newShop;
  }

  async updateShop(id: number, updates: Partial<Shop>): Promise<Shop | undefined> {
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

  async createGame(game: any): Promise<Game> {
    const [newGame] = await db.insert(games).values(game).returning();
    return newGame;
  }

  async updateGame(id: number, updates: Partial<Game>): Promise<Game | undefined> {
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

  async createGamePlayer(player: any): Promise<GamePlayer> {
    const [newPlayer] = await db.insert(gamePlayers).values(player).returning();
    return newPlayer;
  }

  async addGamePlayer(player: any): Promise<GamePlayer> {
    return this.createGamePlayer(player);
  }

  async getGamePlayerCount(gameId: number): Promise<number> {
    const result = await db.select({ count: count() })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, gameId));
    return result[0]?.count || 0;
  }

  async updateGamePlayer(id: number, updates: Partial<GamePlayer>): Promise<GamePlayer | undefined> {
    const [player] = await db.update(gamePlayers).set(updates).where(eq(gamePlayers.id, id)).returning();
    return player || undefined;
  }

  async removeGamePlayer(id: number): Promise<boolean> {
    const result = await db.delete(gamePlayers).where(eq(gamePlayers.id, id));
    return result.changes > 0;
  }

  async createTransaction(transaction: any): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
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

  async createGameHistory(history: any): Promise<GameHistory> {
    const [newHistory] = await db.insert(gameHistory).values(history).returning();
    return newHistory;
  }

  async recordGameHistory(history: any): Promise<GameHistory> {
    return this.createGameHistory(history);
  }

  async getGameHistory(shopId: number, startDate?: Date, endDate?: Date): Promise<GameHistory[]> {
    let query = db.select().from(gameHistory).where(eq(gameHistory.shopId, shopId));

    if (startDate && endDate) {
      query = query.where(and(
        eq(gameHistory.shopId, shopId),
        gte(gameHistory.completedAt, startDate),
        lte(gameHistory.completedAt, endDate)
      ));
    }

    return await query.orderBy(desc(gameHistory.completedAt));
  }

  async getEmployeeGameHistory(employeeId: number, startDate?: Date, endDate?: Date): Promise<GameHistory[]> {
    let query = db.select().from(gameHistory).where(eq(gameHistory.employeeId, employeeId));

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

  async calculateProfitSharing(gameAmount: string, shopId: number): Promise<{
    adminProfit: string;
    prizeAmount: string;
  }> {
    const shop = await this.getShop(shopId);
    if (!shop) throw new Error('Shop not found');

    const profitMargin = parseFloat(shop.profitMargin);
    const adminProfit = (parseFloat(gameAmount) * (profitMargin / 100)).toString();
    const prizeAmount = (parseFloat(gameAmount) - parseFloat(adminProfit)).toString();

    return {
      adminProfit,
      prizeAmount
    };
  }

  async processGameProfits(gameId: number, totalCollected: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');

    const { adminProfit, prizeAmount } = await this.calculateProfitSharing(totalCollected, game.shopId);

    // Update shop balance
    const shop = await this.getShop(game.shopId);
    if (shop) {
      const newShopBalance = (parseFloat(shop.balance) + parseFloat(adminProfit)).toString();
      await this.updateShop(shop.id, { balance: newShopBalance });
    }

    // Create transaction records
    await this.createTransaction({
      gameId,
      shopId: game.shopId,
      employeeId: game.employeeId,
      amount: adminProfit,
      type: 'admin_profit',
      description: 'Admin profit from game'
    });

    await this.createTransaction({
      gameId,
      shopId: game.shopId,
      employeeId: game.employeeId,
      amount: prizeAmount,
      type: 'prize_payout',
      description: 'Prize payout for game'
    });
  }

  async generateAccountNumber(): Promise<string> {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BGO${timestamp}${random}`;
  }

  // Daily revenue summary methods
  async createOrUpdateDailyRevenueSummary(summary: any): Promise<DailyRevenueSummary> {
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

    // Create or update daily summary with simplified stats
    await this.createOrUpdateDailyRevenueSummary({
      date: today,
      totalAdminRevenue: "0.00",
      totalGamesPlayed: 0,
      totalPlayersRegistered: 0,
    });
  }

  async getCartelaByNumber(shopId: number, cartelaNumber: number): Promise<any | null> {
    const [cartela] = await db.select().from(cartelas).where(
      and(eq(cartelas.shopId, shopId), eq(cartelas.cartelaNumber, cartelaNumber))
    ).limit(1);

    if (!cartela) return null;

    const parsedPattern = typeof cartela.pattern === 'string' ? JSON.parse(cartela.pattern) : cartela.pattern;
    return {
      ...cartela,
      pattern: parsedPattern,
      numbers: Array.isArray(parsedPattern) ? parsedPattern.flat() : [],
    };
  }

  async resetCartelasForShop(shopId: number): Promise<void> {
    await db.update(cartelas)
      .set({
        isBooked: false,
        bookedBy: null,
        gameId: null,
        updatedAt: new Date()
      })
      .where(eq(cartelas.shopId, shopId));
  }

  async getMasterFloat(shopId?: number): Promise<string> {
    let query = db.select({
      total: sum(users.balance).as('total')
    }).from(users);

    if (shopId) {
      query = query.where(eq(users.shopId, shopId));
    }

    const [result] = await query;
    return result.total || "0";
  }

  async getAllUserBalances(): Promise<{ userId: number; username: string; balance: string; role: string }[]> {
    return await db.select({
      userId: users.id,
      username: users.username,
      balance: users.balance,
      role: users.role
    }).from(users);
  }
}

export const storage = new DatabaseStorage();