// Helper pour accéder aux énumérations Prisma
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Accéder aux énumérations via le client
export type UserRole = 'ADMIN' | 'STUDIO_OWNER' | 'ARTIST' | 'TECHNICIAN' | 'USER';
export type EquipmentType = 'MICROPHONE' | 'MIXING_CONSOLE' | 'AUDIO_INTERFACE' | 'INSTRUMENT' | 'AMPLIFIER' | 'SPEAKER' | 'HEADPHONES' | 'SOFTWARE' | 'ACCESSORY' | 'OTHER';
export type EquipmentStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_ORDER';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'PAID';

// Ou utiliser les valeurs depuis le schéma
export const UserRoleValues = ['ADMIN', 'STUDIO_OWNER', 'ARTIST', 'TECHNICIAN', 'USER'] as const;
export const EquipmentTypeValues = ['MICROPHONE', 'MIXING_CONSOLE', 'AUDIO_INTERFACE', 'INSTRUMENT', 'AMPLIFIER', 'SPEAKER', 'HEADPHONES', 'SOFTWARE', 'ACCESSORY', 'OTHER'] as const;
export const EquipmentStatusValues = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER'] as const;
export const BookingStatusValues = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'PAID'] as const;
