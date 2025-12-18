// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed...');

  // 1. Crée un admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@studiony.com' },
    update: {},
    create: {
      email: 'admin@studiony.com',
      password: '$2b$10$YourHashedPasswordHere', // En prod, hash le mot de passe
      firstName: 'Admin',
      lastName: 'Studio',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin créé:', admin.email);

  // 2. Crée un propriétaire de studio
  const owner = await prisma.user.upsert({
    where: { email: 'owner@studio.com' },
    update: {},
    create: {
      email: 'owner@studio.com',
      password: '$2b$10$YourHashedPasswordHere',
      firstName: 'Jean',
      lastName: 'Dupont',
      role: 'STUDIO_OWNER',
    },
  });
  console.log('✅ Propriétaire créé:', owner.email);

  // 3. Crée un studio
  const studio = await prisma.studio.create({
    data: {
      name: 'Studio Harmony',
      description: 'Studio professionnel avec équipement haut de gamme',
      address: '123 Rue de la Musique',
      city: 'Paris',
      postalCode: '75001',
      country: 'France',
      capacity: 10,
      hourlyRate: 50.00,
      ownerId: owner.id,
    },
  });
  console.log('✅ Studio créé:', studio.name);

  // 4. Crée des équipements
  const equipment = await prisma.equipment.create({
    data: {
      name: 'Microphone Neumann U87',
      brand: 'Neumann',
      model: 'U87',
      type: 'MICROPHONE',
      status: 'AVAILABLE',
      hourlyRate: 10.00,
      studioId: studio.id,
    },
  });
  console.log('✅ Équipement créé:', equipment.name);

  console.log('\n🎉 Seed terminé avec succès!');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });