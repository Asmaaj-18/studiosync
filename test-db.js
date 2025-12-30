const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Connexion DB réussie!');
  } catch (error) {
    console.log('❌ Erreur DB:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();