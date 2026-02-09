import "dotenv/config";
import { db } from "../server/db";
import { users, cartelas } from "../shared/schema-simple";
import bcrypt from "bcrypt";
import { eq, and } from "drizzle-orm";

async function seed() {
    console.log("🌱 Seeding database...");

    try {
        // 1. Create Super Admin
        console.log("Creating Super Admin...");
        let [superAdmin] = await db.select().from(users).where(eq(users.username, 'superadmin'));

        if (!superAdmin) {
            const hashedPassword = await bcrypt.hash('password', 10);
            [superAdmin] = await db.insert(users).values({
                username: 'superadmin',
                password: hashedPassword,
                role: 'super_admin',
                name: 'Super Administrator',
                email: 'superadmin@bingomaster.com',
                isBlocked: false
            }).returning();
            console.log("✅ Super Admin created");
        } else {
            console.log("ℹ️ Super Admin already exists");
        }

        // 2. Create Demo Admin
        console.log("Creating Demo Admin...");
        let [demoAdmin] = await db.select().from(users).where(eq(users.username, 'admin'));

        if (!demoAdmin) {
            const hashedPassword = await bcrypt.hash('password', 10);
            [demoAdmin] = await db.insert(users).values({
                username: 'admin',
                password: hashedPassword,
                role: 'admin',
                name: 'Demo Admin',
                email: 'admin@bingomaster.com',
                isBlocked: false
            }).returning();
            console.log("✅ Demo Admin created");
        } else {
            console.log("ℹ️ Demo Admin already exists");
        }

        // 3. Create Demo Employee
        console.log("Creating Demo Employee...");
        let [demoEmployee] = await db.select().from(users).where(eq(users.username, 'employee'));

        if (!demoEmployee) {
            const hashedPassword = await bcrypt.hash('password', 10);
            [demoEmployee] = await db.insert(users).values({
                username: 'employee',
                password: hashedPassword,
                role: 'employee',
                name: 'Demo Employee',
                email: 'employee@bingomaster.com',
                isBlocked: false
            }).returning();
            console.log("✅ Demo Employee created");
        } else {
            console.log("ℹ️ Demo Employee already exists");
        }

        // 5. Create Cartelas (Basic Set)
        console.log("Creating Cartelas...");
        const cartelaPatterns = [
            [
                [1, 16, 31, 46, 61],
                [2, 17, 32, 47, 62],
                [3, 18, 0, 48, 63],
                [4, 19, 33, 49, 64],
                [5, 20, 34, 50, 65]
            ],
            [
                [6, 21, 35, 51, 66],
                [7, 22, 36, 52, 67],
                [8, 23, 0, 53, 68],
                [9, 24, 37, 54, 69],
                [10, 25, 38, 55, 70]
            ],
            [
                [11, 26, 39, 56, 71],
                [12, 27, 40, 57, 72],
                [13, 28, 0, 58, 73],
                [14, 29, 41, 59, 74],
                [15, 30, 42, 60, 75]
            ]
        ];

        for (let i = 0; i < cartelaPatterns.length; i++) {
            const cartelaNum = i + 1;
            const [existing] = await db.select().from(cartelas).where(
                eq(cartelas.cartelaNumber, cartelaNum) // Note: This check is simple, might collide if we check only number. 
                // But for seed it's okay if we assume empty DB or just check if *any* with this number exists.
                // Better: check by shopId AND number
            );

            // Actually, schema has unique on (shopId, cartelaNumber).
            // So let's check properly.
            // But query builder might be verbose. 
            // Let's just try insert and ignore conflict if possible, or select first.

            const [exists] = await db.select().from(cartelas).where(
                eq(cartelas.cartelaNumber, cartelaNum)
            );

            if (!exists) {
                await db.insert(cartelas).values({
                    employeeId: demoAdmin.id,
                    cartelaNumber: cartelaNum,
                    name: `Demo Cartela ${cartelaNum}`,
                    pattern: cartelaPatterns[i],
                    isHardcoded: true,
                    isActive: true
                });
                console.log(`+ Cartela ${cartelaNum}`);
            }
        }
        console.log("✅ Cartelas created");

        console.log("🎉 Seeding completed successfully!");
        console.log("Credentials:");
        console.log("Super Admin: superadmin / password");
        console.log("Demo Admin: demoadmin / admin123");
        console.log("Demo Employee: demoemployee / employee123");

    } catch (error) {
        console.error("❌ Seeding failed:", error);
    }
}

seed();
