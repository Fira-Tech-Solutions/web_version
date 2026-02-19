import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default('employee'), // 'admin' or 'employee'
  name: text("name").notNull(),
  email: text("email"),
  accountNumber: text("account_number").unique(),
  balance: real("balance").default(0),
  isBlocked: integer("is_blocked", { mode: "boolean" }).default(false),
  creditBalance: real("credit_balance").default(0),
  totalRevenue: real("total_revenue").default(0), // Employee's total revenue
  totalGames: integer("total_games").default(0), // Employee's total games
  totalPlayers: integer("total_players").default(0), // Employee's total players
  machineId: text("machine_id"), // Machine ID for employee identification
  createdAt: integer("created_at", { mode: "timestamp" }),
});

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // 'waiting', 'active', 'completed', 'paused'
  prizePool: real("prize_pool").default(0),
  entryFee: real("entry_fee").notNull(),
  calledNumbers: text("called_numbers").default("[]"),
  winnerId: integer("winner_id").references(() => gamePlayers.id, { onDelete: "set null" }),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  isPaused: integer("is_paused", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }),
});

export const gamePlayers = sqliteTable("game_players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  cartelaNumbers: text("cartela_numbers").notNull(),
  entryFee: real("entry_fee").notNull(),
  isWinner: integer("is_winner", { mode: "boolean" }).default(false),
  registeredAt: integer("registered_at", { mode: "timestamp" }),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  type: text("type").notNull(), // 'entry_fee', 'prize_payout', 'admin_profit', 'credit_load', 'game_fee'
  description: text("description"),
  createdAt: integer("createdAt", { mode: "timestamp" }),
});

export const gameHistory = sqliteTable("game_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("gameId").references(() => games.id, { onDelete: "cascade" }),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: integer("createdAt", { mode: "timestamp" }),
});

export const usedRecharges = sqliteTable("used_recharges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nonce: text("nonce").notNull().unique(),
  signature: text("signature").notNull(),
  amount: real("amount").notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  machineId: text("machine_id").notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }).default(new Date()),
});

export const cartelas = sqliteTable("cartelas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cartelaNumber: integer("cartela_number").notNull(),
  cardNo: integer("card_no").notNull(), // Sequential card number (1, 2, 3...)
  name: text("name").notNull(),
  pattern: text("pattern").notNull(),
  isHardcoded: integer("is_hardcoded", { mode: "boolean" }).default(false),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  isBooked: integer("is_booked", { mode: "boolean" }).default(false),
  bookedBy: integer("booked_by").references(() => users.id, { onDelete: "set null" }),
  gameId: integer("game_id").references(() => games.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
}, (table) => ({
  employeeCartelaUnique: unique().on(table.employeeId, table.cartelaNumber),
}));

export const dailyRevenueSummary = sqliteTable("daily_revenue_summary", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(), // YYYY-MM-DD format
  employeeId: integer("employee_id").references(() => users.id, { onDelete: "cascade" }),
  totalAdminRevenue: real("total_admin_revenue").default(0),
  totalGamesPlayed: integer("total_games_played").default(0),
  totalPlayersRegistered: integer("total_players_registered").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
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
  game: one(games, {
    fields: [transactions.gameId],
    references: [games.id],
  }),
  employee: one(users, {
    fields: [transactions.employeeId],
    references: [users.id],
  }),
}));

export const gameHistoryRelations = relations(gameHistory, ({ one }) => ({
  game: one(games, {
    fields: [gameHistory.gameId],
    references: [games.id],
  }),
  employee: one(users, {
    fields: [gameHistory.employeeId],
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
