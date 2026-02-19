import {
  users, games, gamePlayers, transactions, gameHistory,
  dailyRevenueSummary, cartelas, usedRecharges,
  type User, type Game, type GamePlayer,
  type Transaction, type GameHistory, type DailyRevenueSummary, type Cartela, type UsedRecharge
} from "@shared/schema-simple";
import { employeeDb } from "../../scripts/employee-db";
import { eq, and, or, desc, gte, lte, sum, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

// Initialize Drizzle ORM with the employee database
export const db = drizzle(employeeDb);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByAccountNumber(accountNumber: string): Promise<User | undefined>;
  createUser(user: any): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserBalance(id: number, balance: string): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsers(): Promise<User[]>;
  generateAccountNumber(): Promise<string>;

  // Game methods
  getGame(id: number): Promise<Game | undefined>;
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
  updateGamePlayer(id: number, updates: Partial<GamePlayer>): Promise<GamePlayer | undefined>;
  removeGamePlayer(id: number): Promise<boolean>;
  addGamePlayer(player: any): Promise<GamePlayer>;

  // Transaction methods
  createTransaction(transaction: any): Promise<Transaction>;
  getTransactionsByEmployee(employeeId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]>;

  // Game History methods
  createGameHistory(history: any): Promise<GameHistory>;
  recordGameHistory(history: any): Promise<GameHistory>;
  getEmployeeGameHistory(employeeId: number, startDate?: Date, endDate?: Date): Promise<GameHistory[]>;

  // Analytics methods
  getEmployeeStats(employeeId: number, startDate?: Date, endDate?: Date): Promise<{
    totalCollections: string;
    gamesCompleted: number;
    playersRegistered: number;
  }>;
  
  // Financial methods
  processGameProfits(gameId: number, totalCollected: string): Promise<void>;
  
  // Cartela shop methods
  getCartelasByShop(shopId: number): Promise<Cartela[]>;
  resetCartelasForShop(shopId: number): Promise<void>;
  getShop(shopId: number): Promise<any>;
  getUserByShopId(shopId: number): Promise<any>;
  createOrUpdateDailyRevenueSummary(summary: any): Promise<DailyRevenueSummary>;
  getDailyRevenueSummary(date: string): Promise<DailyRevenueSummary | undefined>;
  getDailyRevenueSummaries(dateFrom?: string, dateTo?: string): Promise<DailyRevenueSummary[]>;

  // Cartela methods
  getCartelaByNumber(employeeId: number, cartelaNumber: number): Promise<any | null>;
  resetCartelasForEmployee(employeeId: number): Promise<void>;

  // Master Float methods
  getMasterFloat(employeeId?: number): Promise<string>;
  getAllUserBalances(): Promise<{ userId: number; username: string; balance: string; role: string }[]>;

  // Used Recharges methods (for replay protection)
  createUsedRecharge(recharge: any): Promise<UsedRecharge>;
  isNonceUsed(nonce: string): Promise<boolean>;
  isSignatureUsed(signature: string): Promise<boolean>;

  // EAT time zone utility methods
  getCurrentEATDate(): string;
  performDailyReset(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const stmt = employeeDb.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id) as any;
    
    if (user) {
      // Map database fields to frontend format
      return {
        ...user,
        machineId: user.machine_id, // Convert machine_id to machineId
        isBlocked: Boolean(user.is_blocked) // Convert is_blocked to isBlocked
      } as User;
    }
    
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const stmt = employeeDb.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username) as any;
    
    if (user) {
      // Map database fields to frontend format
      return {
        ...user,
        machineId: user.machine_id, // Convert machine_id to machineId
        isBlocked: Boolean(user.is_blocked) // Convert is_blocked to isBlocked
      } as User;
    }
    
    return undefined;
  }

  async getUserByAccountNumber(accountNumber: string): Promise<User | undefined> {
    const stmt = employeeDb.prepare('SELECT * FROM users WHERE account_number = ?');
    const user = stmt.get(accountNumber) as any;
    
    if (user) {
      // Map database fields to frontend format
      return {
        ...user,
        machineId: user.machine_id, // Convert machine_id to machineId
        isBlocked: Boolean(user.is_blocked) // Convert is_blocked to isBlocked
      } as User;
    }
    
    return undefined;
  }

  async createUser(user: any): Promise<User> {
    const stmt = employeeDb.prepare(`
      INSERT INTO users (username, password, role, name, account_number, balance, is_blocked)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      user.username,
      user.password,
      user.role || 'employee',
      user.name,
      user.accountNumber,
      user.balance || '0.00',
      (user.isBlocked || false) ? 1 : 0 // Convert boolean to integer for SQLite
    );

    return this.getUser(result.lastInsertRowid as number)!;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const stmt = employeeDb.prepare(`
      UPDATE users
      SET username = COALESCE(?, username),
          password = COALESCE(?, password),
          role = COALESCE(?, role),
          name = COALESCE(?, name),
          account_number = COALESCE(?, account_number),
          balance = COALESCE(?, balance),
          is_blocked = COALESCE(?, is_blocked)
      WHERE id = ?
    `);

    stmt.run(
      updates.username,
      updates.password,
      updates.role,
      updates.name,
      updates.accountNumber,
      updates.balance,
      updates.isBlocked !== undefined ? (updates.isBlocked ? 1 : 0) : undefined, // Convert boolean to integer for SQLite
      id
    );

    return this.getUser(id);
  }

  async updateUserBalance(id: number, balance: string): Promise<User | undefined> {
    const stmt = employeeDb.prepare('UPDATE users SET balance = ? WHERE id = ?');
    stmt.run(balance, id);
    return this.getUser(id);
  }

  async deleteUser(id: number): Promise<boolean> {
    const stmt = employeeDb.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async getUsers(): Promise<User[]> {
    const stmt = employeeDb.prepare('SELECT * FROM users');
    return stmt.all() as User[];
  }

  async getAllTransactions(): Promise<any[]> {
    const stmt = employeeDb.prepare('SELECT * FROM transactions');
    return stmt.all() as any[];
  }

  async generateAccountNumber(): Promise<string> {
    // Generate a unique 10-digit account number
    let accountNumber: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      // Generate random 10-digit number
      accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      
      // Check if it's unique using raw SQLite
      const stmt = employeeDb.prepare('SELECT COUNT(*) as count FROM users WHERE account_number = ?');
      const result = stmt.get(accountNumber) as { count: number };
      isUnique = result.count === 0;
      attempts++;
    } while (!isUnique && attempts < maxAttempts);

    if (!isUnique) {
      throw new Error("Failed to generate unique account number after multiple attempts");
    }

    return accountNumber;
  }

  // Game methods
  async getGame(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game || undefined;
  }

  async getActiveGameByEmployee(employeeId: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games)
      .where(and(
        eq(games.employeeId, employeeId),
        eq(games.status, 'active')
      ))
      .orderBy(desc(games.id));
    return game || undefined;
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
      throw new Error('Cannot add numbers to paused game');
    }
    const [game] = await db.update(games)
      .set({ calledNumbers })
      .where(eq(games.id, gameId))
      .returning();
    return game;
  }

  async updateGamePrizePool(gameId: number, additionalAmount: number): Promise<Game> {
    const [game] = await db.update(games)
      .set({ prizePool: game.prizePool + additionalAmount })
      .where(eq(games.id, gameId))
      .returning();
    return game;
  }

  async completeGame(gameId: number, winnerId: number, prizeAmount: string): Promise<Game> {
    const [game] = await db.update(games)
      .set({ 
        status: 'completed',
        completedAt: new Date(),
        winnerId,
        prizeAmount
      })
      .where(eq(games.id, gameId))
      .returning();
    return game;
  }

  // Game Player methods
  async getGamePlayers(gameId: number): Promise<GamePlayer[]> {
    return await db.select().from(gamePlayers)
      .where(eq(gamePlayers.gameId, gameId))
      .orderBy(desc(gamePlayers.registeredAt));
  }

  async getGamePlayerCount(gameId: number): Promise<number> {
    const result = await db.select({ count: count() }).from(gamePlayers)
      .where(eq(gamePlayers.gameId, gameId));
    return result[0]?.count || 0;
  }

  async createGamePlayer(player: any): Promise<GamePlayer> {
    const [newGamePlayer] = await db.insert(gamePlayers).values(player).returning();
    return newGamePlayer;
  }

  async updateGamePlayer(id: number, updates: Partial<GamePlayer>): Promise<GamePlayer | undefined> {
    const [gamePlayer] = await db.update(gamePlayers).set(updates).where(eq(gamePlayers.id, id)).returning();
    return gamePlayer || undefined;
  }

  async removeGamePlayer(id: number): Promise<boolean> {
    const result = await db.delete(gamePlayers).where(eq(gamePlayers.id, id));
    return result.changes > 0;
  }

  async addGamePlayer(player: any): Promise<GamePlayer> {
    const [newGamePlayer] = await db.insert(gamePlayers).values(player).returning();
    return newGamePlayer;
  }

  // Transaction methods
  async createTransaction(transaction: any): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  async getTransactionsByEmployee(employeeId: number, startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    let query = db.select().from(transactions).where(eq(transactions.userId, employeeId));
    
    if (startDate) {
      query = query.where(and(
        eq(transactions.userId, employeeId),
        gte(transactions.createdAt, startDate)
      ));
    }
    
    if (endDate) {
      query = query.where(and(
        eq(transactions.userId, employeeId),
        lte(transactions.createdAt, endDate)
      ));
    }

    return await query.orderBy(desc(transactions.createdAt));
  }

  // Game History methods
  async createGameHistory(history: any): Promise<GameHistory> {
    const [newHistory] = await db.insert(gameHistory).values(history).returning();
    return newHistory;
  }

  async recordGameHistory(history: any): Promise<GameHistory> {
    const [newHistory] = await db.update(gameHistory)
      .set({ completedAt: new Date() })
      .where(eq(gameHistory.gameId, history.id))
      .returning();
    return newHistory;
  }

  async getEmployeeGameHistory(employeeId: number, startDate?: Date, endDate?: Date): Promise<GameHistory[]> {
    let query = db.select().from(gameHistory).where(eq(gameHistory.userId, employeeId));
    
    if (startDate) {
      query = query.where(and(
        eq(gameHistory.userId, employeeId),
        gte(gameHistory.createdAt, startDate)
      ));
    }
    
    if (endDate) {
      query = query.where(and(
        eq(gameHistory.userId, employeeId),
        lte(gameHistory.createdAt, endDate)
      ));
    }

    return await query.orderBy(desc(gameHistory.createdAt));
  }

  // Analytics methods
  async getEmployeeStats(employeeId: number, startDate?: Date, endDate?: Date): Promise<{
    totalCollections: string;
    gamesCompleted: number;
    playersRegistered: number;
  }> {
    // Since gameHistory table has different structure, we'll get basic stats
    let gameQuery = db.select({
      gamesCompleted: count()
    }).from(gameHistory).where(eq(gameHistory.userId, employeeId));

    let playerQuery = db.select({
      playersRegistered: count()
    }).from(gamePlayers).where(eq(gamePlayers.employeeId, employeeId));

    if (startDate && endDate) {
      gameQuery = gameQuery.where(and(
        eq(gameHistory.userId, employeeId),
        gte(gameHistory.createdAt, startDate),
        lte(gameHistory.createdAt, endDate)
      ));

      playerQuery = playerQuery.where(and(
        eq(gamePlayers.employeeId, employeeId),
        gte(gamePlayers.registeredAt, startDate),
        lte(gamePlayers.registeredAt, endDate)
      ));
    }

    const gameStats = await gameQuery;
    const playerStats = await playerQuery;

    return {
      totalCollections: "0.00", // Not available in current table structure
      gamesCompleted: gameStats[0]?.gamesCompleted || 0,
      playersRegistered: playerStats[0]?.playersRegistered || 0
    };
  }

  // Financial methods - Implement 15% System Cut
  async processGameProfits(gameId: number, totalCollected: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    const employee = await this.getUser(game.employeeId);
    if (!employee) {
      throw new Error(`Employee ${game.employeeId} not found`);
    }

    const totalCollectedNum = parseFloat(totalCollected);
    if (totalCollectedNum <= 0) {
      console.log(`No revenue to process for game ${gameId}`);
      return;
    }

    // Calculate 15% system cut
    const systemCut = totalCollectedNum * 0.15;
    const remainingAmount = totalCollectedNum - systemCut;

    console.log(`💰 Processing game profits for game ${gameId}:`, {
      totalCollected: totalCollectedNum,
      systemCut: systemCut,
      remainingAmount: remainingAmount,
      employeeBalance: parseFloat(employee.balance || "0")
    });

    // Check if employee has sufficient balance to cover the system cut
    const currentBalance = parseFloat(employee.balance || "0");
    if (currentBalance < systemCut) {
      throw new Error(`Insufficient balance to cover 15% system cut. Required: ${systemCut.toFixed(2)} ETB, Available: ${currentBalance.toFixed(2)} ETB. Please recharge to continue.`);
    }

    // Deduct system cut from employee balance
    const newBalance = currentBalance - systemCut;
    await this.updateUserBalance(employee.id, newBalance.toString());

    // Create transaction record for system cut
    await this.createTransaction({
      userId: employee.id,
      amount: systemCut.toString(),
      type: 'system_cut',
      description: `15% system cut from game revenue (${systemCut.toFixed(2)} ETB)`,
    });

    // Create transaction record for remaining revenue (goes to shop)
    await this.createTransaction({
      userId: employee.id,
      amount: remainingAmount.toString(),
      type: 'game_revenue',
      description: `Game revenue after system cut (${remainingAmount.toFixed(2)} ETB)`,
    });

    console.log(`✅ Processed game profits for game ${gameId}: System cut ${systemCut.toFixed(2)} ETB deducted, remaining ${remainingAmount.toFixed(2)} ETB recorded as revenue`);
  }

  // Cartela shop methods
  async getCartelasByShop(shopId: number): Promise<Cartela[]> {
    return await db.select().from(cartelas)
      .where(eq(cartelas.shopId, shopId))
      .orderBy(cartelas.cartelaNumber);
  }

  async resetCartelasForShop(shopId: number): Promise<void> {
    await db.update(cartelas)
      .set({ bookedBy: null, bookedAt: null })
      .where(eq(cartelas.shopId, shopId));
  }

  async getShop(shopId: number): Promise<any> {
    // This would need to be implemented based on your shop schema
    // For now, return a basic shop structure
    return { id: shopId, name: `Shop ${shopId}`, profitMargin: '20' };
  }

  async getUserByShopId(shopId: number): Promise<any> {
    const [user] = await db.select().from(users)
      .where(and(eq(users.shopId, shopId), eq(users.role, 'admin')));
    return user || null;
  }

  async createOrUpdateDailyRevenueSummary(summary: any): Promise<DailyRevenueSummary> {
    const existingSummary = await db.select().from(dailyRevenueSummary)
      .where(eq(dailyRevenueSummary.date, summary.date));
    
    if (existingSummary.length > 0) {
      // Update existing summary
      await db.update(dailyRevenueSummary)
        .set({
          totalAdminRevenue: (parseFloat(existingSummary[0].totalAdminRevenue) + parseFloat(summary.totalAdminRevenue)).toString(),
          totalGamesPlayed: existingSummary[0].totalGamesPlayed + summary.totalGamesPlayed,
          totalPlayersRegistered: existingSummary[0].totalPlayersRegistered + summary.totalPlayersRegistered
        })
        .where(eq(dailyRevenueSummary.id, existingSummary[0].id));
    } else {
      // Create new summary
      await db.insert(dailyRevenueSummary).values({
        date: summary.date,
        employeeId: summary.employeeId,
        totalAdminRevenue: summary.totalAdminRevenue,
        totalGamesPlayed: summary.totalGamesPlayed,
        totalPlayersRegistered: summary.totalPlayersRegistered
      });
    }
    
    const result = await db.select().from(dailyRevenueSummary)
      .where(eq(dailyRevenueSummary.date, summary.date));
    return result[0] || undefined;
  }

  async getDailyRevenueSummary(date: string): Promise<DailyRevenueSummary | undefined> {
    const result = await db.select().from(dailyRevenueSummary)
      .where(eq(dailyRevenueSummary.date, date));
    return result[0] || undefined;
  }

  async getDailyRevenueSummaries(dateFrom?: string, dateTo?: string): Promise<DailyRevenueSummary[]> {
    let query = db.select().from(dailyRevenueSummary);
    
    if (dateFrom && dateTo) {
      query = query.where(and(
        gte(dailyRevenueSummary.date, dateFrom),
        lte(dailyRevenueSummary.date, dateTo)
      ));
    }

    return await query.orderBy(desc(dailyRevenueSummary.date));
  }

  // Cartela methods
  async getCartelaByNumber(employeeId: number, cartelaNumber: number): Promise<any | null> {
    const [cartela] = await db.select().from(cartelas)
      .where(and(
        eq(cartelas.employeeId, employeeId),
        eq(cartelas.cartelaNumber, cartelaNumber)
      ));
    return cartela || null;
  }

  async resetCartelasForEmployee(employeeId: number): Promise<void> {
    await db.delete(cartelas)
      .where(eq(cartelas.employeeId, employeeId));
  }

  // Master Float methods
  async getMasterFloat(employeeId?: number): Promise<string> {
    if (employeeId) {
      const employee = await this.getUser(employeeId);
      if (!employee) throw new Error('Employee not found');
      
      const totalEmployeeBalance = await db.select({
        balance: sum(users.balance)
      }).where(eq(users.id, employeeId));
      
      return totalEmployeeBalance[0]?.balance?.toString() || "0.00";
    }
    
    return "0.00";
  }

  async getAllUserBalances(): Promise<{ userId: number; username: string; balance: string; role: string }[]> {
    const usersResult = await db.select({
      id: users.id,
      username: users.username,
      balance: users.balance,
      role: users.role
    }).from(users).orderBy(users.id);
    
    return usersResult.map(user => ({
      userId: user.id,
      username: user.username,
      balance: user.balance,
      role: user.role
    }));
  }

  // EAT time zone utility methods
  getCurrentEATDate(): string {
    const now = new Date();
    // EAT is UTC+3, so add 3 hours
    const eatTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    return eatTime.toISOString().slice(0, 19).replace('T', ' ');
  }

  async performDailyReset(): Promise<void> {
    // This would reset daily summaries at midnight EAT time
    const today = this.getCurrentEATDate().slice(0, 10); // YYYY-MM-DD
    
    await db.delete(dailyRevenueSummary)
      .where(and(
        lt(dailyRevenueSummary.date, today)
      ));
  }

  // Used Recharges methods (for replay protection)
  async createUsedRecharge(recharge: any): Promise<UsedRecharge> {
    const [newUsedRecharge] = await db.insert(usedRecharges).values(recharge).returning();
    return newUsedRecharge;
  }

  async isNonceUsed(nonce: string): Promise<boolean> {
    const [existing] = await db.select().from(usedRecharges).where(eq(usedRecharges.nonce, nonce));
    return !!existing;
  }

  async isSignatureUsed(signature: string): Promise<boolean> {
    const [existing] = await db.select().from(usedRecharges).where(eq(usedRecharges.signature, signature));
    return !!existing;
  }
}

export const storage = new DatabaseStorage();
