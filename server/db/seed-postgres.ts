import "dotenv/config";
import { db } from "./index";
import { users, shops } from "@shared/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding Postgres database...");

  try {
    // 1. Create Super Admin if not exists
    const existingSuperAdmin = await db.select().from(users).where(eq(users.username, "superadmin")).limit(1);
    
    if (existingSuperAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash("password", 10);
      await db.insert(users).values({
        username: "superadmin",
        password: hashedPassword,
        role: "super_admin",
        name: "Super Admin",
        creditBalance: "0.00",
      });
      console.log("✅ Super Admin created: superadmin / password");
    } else {
      console.log("ℹ️ Super Admin already exists");
    }

    // 2. Create Demo Admin if not exists
    const existingDemoAdmin = await db.select().from(users).where(eq(users.username, "demoadmin")).limit(1);
    let adminId: number;

    if (existingDemoAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const [newAdmin] = await db.insert(users).values({
        username: "demoadmin",
        password: hashedPassword,
        role: "admin",
        name: "Demo Admin",
        creditBalance: "1000.00",
        accountNumber: "ACC123456",
      }).returning({ id: users.id });
      adminId = newAdmin.id;
      console.log("✅ Demo Admin created: demoadmin / admin123");
    } else {
      adminId = existingDemoAdmin[0].id;
      console.log("ℹ️ Demo Admin already exists");
    }

    // 3. Create Demo Shop if not exists
    const existingShop = await db.select().from(shops).where(eq(shops.name, "Demo Bingo Shop")).limit(1);
    let shopId: number;

    if (existingShop.length === 0) {
      const [newShop] = await db.insert(shops).values({
        name: "Demo Bingo Shop",
        adminId: adminId,
        profitMargin: "20.00",
        superAdminCommission: "25.00",
        referralCommission: "3.00",
        totalRevenue: "0.00",
      }).returning({ id: shops.id });
      shopId = newShop.id;
      
      // Update admin user with shopId
      await db.update(users).set({ shopId: shopId }).where(eq(users.id, adminId));
      console.log("✅ Demo Shop created: Demo Bingo Shop");
    } else {
      shopId = existingShop[0].id;
      console.log("ℹ️ Demo Shop already exists");
    }

    // 4. Create Demo Employee if not exists
    const existingEmployee = await db.select().from(users).where(eq(users.username, "demoemployee")).limit(1);
    
    if (existingEmployee.length === 0) {
      const hashedPassword = await bcrypt.hash("employee123", 10);
      await db.insert(users).values({
        username: "demoemployee",
        password: hashedPassword,
        role: "employee",
        name: "Demo Employee",
        shopId: shopId,
      });
      console.log("✅ Demo Employee created: demoemployee / employee123");
    } else {
      console.log("ℹ️ Demo Employee already exists");
    }

    console.log("✨ Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
