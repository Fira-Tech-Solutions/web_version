import { pgTable, text, integer, real, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('employee'), // 'admin' or 'employee'
  name: text("name").notNull(),
  email: text("email"),
  accountNumber: text("account_number").unique(),
  balance: real("balance").default(0),
  isBlocked: boolean("is_blocked").default(false),
  creditBalance: real("credit_balance").default(0),
  totalRevenue: real("total_revenue").default(0), // Employee's total revenue
  totalGames: integer("total_games").default(0), // Employee's total games
  totalPlayers: integer("total_players").default(0), // Employee's total players
  machineId: text("machine_id"), // Machine ID for employee identification
  createdAt: timestamp("created_at").defaultNow(),
  adminGeneratedBalance: text("admin_generated_balance").default("0"),
  employeePaidAmount: text("employee_paid_amount").default("0"),
  totalRechargeFiles: integer("total_recharge_files").default(0),
  totalRechargeAmount: text("total_recharge_amount").default("0"),
  shopId: text("shop_id"),
});

export const games = pgTable("games", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // 'waiting', 'active', 'completed', 'paused'
  prizePool: real("prize_pool").default(0),
  entryFee: real("entry_fee").notNull(),
  calledNumbers: text("called_numbers").default("[]"),
  winnerId: integer("winner_id").references(() => gamePlayers.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  isPaused: boolean("is_paused").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gamePlayers = pgTable("game_players", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  cartelaNumbers: text("cartela_numbers").notNull(),
  entryFee: real("entry_fee").notNull(),
  isWinner: boolean("is_winner").default(false),
  registeredAt: timestamp("registered_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  type: text("type").notNull(), // 'entry_fee', 'prize_payout', 'admin_profit', 'credit_load', 'game_fee'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gameHistory = pgTable("game_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  gameId: integer("game_id").references(() => games.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usedRecharges = pgTable("used_recharges", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fileData: text("file_data").notNull(),
  signature: text("signature").notNull(),
  usedAt: timestamp("used_at").defaultNow(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
});

export const rechargeFiles = pgTable("recharge_files", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  filename: text("filename").notNull(),
  fileData: text("file_data").notNull(),
  signature: text("signature").notNull(),
  employeeId: integer("employee_id").references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
  shopId: text("shop_id"),
});

export const cartelas = pgTable("cartelas", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cartelaNumber: integer("cartela_number").notNull(),
  cardNo: integer("card_no").notNull(), // Sequential card number (1, 2, 3...)
  name: text("name").notNull(),
  pattern: text("pattern").notNull(),
  isHardcoded: boolean("is_hardcoded").default(false),
  isActive: boolean("is_active").default(true),
  isBooked: boolean("is_booked").default(false),
  bookedBy: integer("booked_by").references(() => users.id, { onDelete: "set null" }),
  gameId: integer("game_id").references(() => games.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeCartelaUnique: unique().on(table.employeeId, table.cartelaNumber),
}));

export const dailyRevenueSummary = pgTable("daily_revenue_summary", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  date: text("date").notNull().unique(), // YYYY-MM-DD format
  employeeId: integer("employee_id").references(() => users.id, { onDelete: "cascade" }),
  totalAdminRevenue: real("total_admin_revenue").default(0),
  totalGamesPlayed: integer("total_games_played").default(0),
  totalPlayersRegistered: integer("total_players_registered").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin tracking tables
// Remove old admin tables - unified into main tables

// License tracking tables
export const activation = pgTable("activation", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  machineId: text("machine_id").notNull().unique(),
  activatedAt: text("activated_at").notNull(),
});

export const usedTokens = pgTable("used_tokens", {
  transactionId: text("transaction_id").primaryKey(),
  amount: real("amount").notNull(),
  employeeId: integer("employee_id"),
  redeemedAt: text("redeemed_at").notNull(),
});

export const rechargeLog = pgTable("recharge_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  transactionId: text("transaction_id").notNull(),
  amount: real("amount").notNull(),
  employeeId: integer("employee_id"),
  redeemedAt: text("redeemed_at").notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  games: many(games),
  transactions: many(transactions),
  gameHistory: many(gameHistory),
  cartelas: many(cartelas),
  dailyRevenueSummaries: many(dailyRevenueSummary),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  employee: one(users, {
    fields: [games.employeeId],
    references: [users.id],
  }),
  players: many(gamePlayers),
  winner: one(gamePlayers, {
    fields: [games.winnerId],
    references: [gamePlayers.id],
  }),
  transactions: many(transactions),
  gameHistory: many(gameHistory),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, {
    fields: [gamePlayers.gameId],
    references: [games.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const gameHistoryRelations = relations(gameHistory, ({ one }) => ({
  game: one(games, {
    fields: [gameHistory.gameId],
    references: [games.id],
  }),
  user: one(users, {
    fields: [gameHistory.userId],
    references: [users.id],
  }),
}));

export const cartelasRelations = relations(cartelas, ({ one }) => ({
  employee: one(users, {
    fields: [cartelas.employeeId],
    references: [users.id],
  }),
  bookedBy: one(users, {
    fields: [cartelas.bookedBy],
    references: [users.id],
  }),
  game: one(games, {
    fields: [cartelas.gameId],
    references: [games.id],
  }),
}));

export const dailyRevenueSummaryRelations = relations(dailyRevenueSummary, ({ one }) => ({
  employee: one(users, {
    fields: [dailyRevenueSummary.employeeId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertGamePlayerSchema = createInsertSchema(gamePlayers).omit({
  id: true,
  registeredAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions, {
  amount: z.number(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertGameHistorySchema = createInsertSchema(gameHistory).omit({
  id: true,
});

export const insertCartelaSchema = createInsertSchema(cartelas).omit({
  id: true,
});

export const insertRechargeFileSchema = createInsertSchema(rechargeFiles).omit({
  id: true,
});

export const insertCustomCartelaSchema = createInsertSchema(cartelas).omit({
  id: true,
});

export const insertDailyRevenueSummarySchema = createInsertSchema(dailyRevenueSummary, {
  totalAdminRevenue: z.number(),
  totalGamesPlayed: z.number(),
  totalPlayersRegistered: z.number(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type InsertGamePlayer = z.infer<typeof insertGamePlayerSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type GameHistory = typeof gameHistory.$inferSelect;
export type InsertGameHistory = z.infer<typeof insertGameHistorySchema>;
export type Cartela = typeof cartelas.$inferSelect;
export type InsertCartela = z.infer<typeof insertCartelaSchema>;
export type CustomCartela = typeof cartelas.$inferSelect;
export type InsertCustomCartela = z.infer<typeof insertCustomCartelaSchema>;
export type DailyRevenueSummary = typeof dailyRevenueSummary.$inferSelect;
export type InsertDailyRevenueSummary = z.infer<typeof insertDailyRevenueSummarySchema>;
export type RechargeFile = typeof rechargeFiles.$inferSelect;
export type InsertRechargeFile = z.infer<typeof insertRechargeFileSchema>;
export type Activation = typeof activation.$inferSelect;
export type UsedToken = typeof usedTokens.$inferSelect;
export type RechargeLog = typeof rechargeLog.$inferSelect;
