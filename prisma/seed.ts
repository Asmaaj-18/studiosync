import { PrismaClient, Prisma, UserRole, EquipmentType, EquipmentStatus, BookingStatus, PaymentStatus, ReservationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

console.log('🌱 Seed en cours...');

// Fonction utilitaire pour convertir "HH:MM" en Date (aujourd'hui)
function timeToDate(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

async function main() {
  // Créer les utilisateurs
  const password = await bcrypt.hash('password123', 10);

  const admin = await prisma.users.create({
    data: {
      email: 'admin@studiony.com',
      password,
      first_name: 'Admin',
      last_name: 'Studio',
      role: UserRole.ADMIN
    }
  });

  const owner = await prisma.users.create({
    data: {
      email: 'owner@studio.com',
      password,
      first_name: 'Jean',
      last_name: 'Dupont',
      role: UserRole.STUDIO_OWNER
    }
  });

  const artist = await prisma.users.create({
    data: {
      email: 'artist@music.com',
      password,
      first_name: 'Marie',
      last_name: 'Martin',
      role: UserRole.ARTIST
    }
  });

  // Créer un studio
  const studio = await prisma.studios.create({
    data: {
      name: 'Studio Harmony',
      address: '123 Rue de la Musique',
      city: 'Paris',
      postal_code: '75001',
      country: 'France',
      capacity: 10,
      hourly_rate: new Prisma.Decimal(50),
      owner_id: owner.id
    }
  });

  // Disponibilités du studio
  await prisma.studio_availabilities.createMany({
    data: Array.from({ length: 7 }, (_, i) => ({
      studio_id: studio.id,
      day_of_week: i,
      opening_time: timeToDate('09:00'),
      closing_time: timeToDate('22:00'),
      is_available: true
    }))
  });

  // Équipement
  const mic = await prisma.equipment.create({
    data: {
      name: 'Neumann U87',
      type: EquipmentType.MICROPHONE,
      status: EquipmentStatus.AVAILABLE,
      hourly_rate: new Prisma.Decimal(10),
      studio_id: studio.id
    }
  });

  // Réservation
  const reservation = await prisma.reservations.create({
    data: {
      title: 'Session démo',
      start_time: new Date(),
      end_time: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3h plus tard
      total_price: new Prisma.Decimal(200),
      status: ReservationStatus.CONFIRMED,
      studio_id: studio.id,
      created_by: artist.id
    }
  });

  // Paiement
  await prisma.payments.create({
    data: {
      reservation_id: reservation.id,
      amount: new Prisma.Decimal(200),
      status: PaymentStatus.SUCCEEDED
    }
  });

  console.log('✅ Seed terminé avec succès');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
