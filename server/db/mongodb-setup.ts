import bcrypt from "bcrypt";
import { User, Shop, Cartela } from "@shared/mongodb-schema";
import { connectMongoDB } from "./mongodb";

export async function initializeMongoDBData() {
  try {
    await connectMongoDB();

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ username: 'superadmin' });
    if (existingSuperAdmin) {
      console.log('🍃 MongoDB: Super admin already exists');
      return;
    }

    console.log('🍃 MongoDB: Creating initial data...');

    // Create super admin
    const hashedPassword = await bcrypt.hash('password', 10);
    const superAdmin = new User({
      username: 'superadmin',
      password: hashedPassword,
      role: 'super_admin',
      name: 'Super Administrator',
      email: 'superadmin@bingomaster.com',
      accountNumber: 'BGO000000001',
      commissionRate: 0
    });
    await superAdmin.save();

    // Create demo shop
    const demoShop = new Shop({
      name: 'Demo Bingo Hall',
      adminId: superAdmin._id,
      profitMargin: 20,
      superAdminCommission: 25,
      referralCommission: 3
    });
    await demoShop.save();

    // Create demo admin
    const demoAdminPassword = await bcrypt.hash('admin123', 10);
    const demoAdmin = new User({
      username: 'demoadmin',
      password: demoAdminPassword,
      role: 'admin',
      name: 'Demo Admin',
      email: 'admin@bingomaster.com',
      shopId: demoShop._id,
      accountNumber: 'BGO000000002',
      commissionRate: 25,
      creditBalance: 1000
    });
    await demoAdmin.save();

    // Update shop admin reference
    demoShop.adminId = demoAdmin._id;
    await demoShop.save();

    // Create demo employee
    const demoEmployeePassword = await bcrypt.hash('employee123', 10);
    const demoEmployee = new User({
      username: 'demoemployee',
      password: demoEmployeePassword,
      role: 'employee',
      name: 'Demo Employee',
      shopId: demoShop._id,
      supervisorId: demoAdmin._id,
      accountNumber: 'BGO000000003',
      commissionRate: 15,
      creditBalance: 500
    });
    await demoEmployee.save();

    // Create sample cartelas
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
      const cartela = new Cartela({
        shopId: demoShop._id,
        adminId: demoAdmin._id,
        cartelaNumber: i + 1,
        name: `Demo Cartela ${i + 1}`,
        pattern: cartelaPatterns[i],
        isHardcoded: true,
        isActive: true
      });
      await cartela.save();
    }

    console.log('🍃 MongoDB: Initial data created successfully');
    console.log('🍃 MongoDB: Login credentials:');
    console.log('   Super Admin: superadmin / password');
    console.log('   Demo Admin: demoadmin / admin123');
    console.log('   Demo Employee: demoemployee / employee123');

  } catch (error) {
    console.error('❌ MongoDB initialization error:', error);
    throw error;
  }
}