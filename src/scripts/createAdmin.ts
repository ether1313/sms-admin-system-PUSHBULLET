import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createAdmin() {
  try {
    console.log('Creating SuperAdmin account...\n');

    const username = await question('Username: ');
    if (!username.trim()) {
      console.error('Username cannot be empty');
      process.exit(1);
    }

    // Check if admin already exists
    const existing = await prisma.admin.findUnique({
      where: { username },
    });

    if (existing) {
      console.error(`Admin with username "${username}" already exists`);
      process.exit(1);
    }

    const password = await question('Password: ');
    if (!password.trim()) {
      console.error('Password cannot be empty');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    console.log(`\n✅ Admin created successfully!`);
    console.log(`   ID: ${admin.id}`);
    console.log(`   Username: ${admin.username}`);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createAdmin();
