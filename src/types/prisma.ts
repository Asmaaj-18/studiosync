// ========================================
// TYPES PRISMA - STUDIOSYNC
// Basé sur le schéma Prisma 
// ========================================

import { 
  UserRole, 
  EquipmentType, 
  EquipmentStatus, 
  BookingStatus,
  FileType,
  NotificationType,
  ParticipantRole,
  PaymentStatus,
  ProjectStatus,
  ReservationStatus 
} from '@prisma/client';

// ========================================
// TYPES DE BASE
// ========================================

export interface BaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// MODÈLES PRINCIPAUX - INTERFACES
// ========================================

export interface User extends BaseModel {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
}

export interface Studio extends BaseModel {
  name: string;
  description?: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  capacity: number;
  hourlyRate: number;
  currency: string;
  isActive: boolean;
  ownerId: string;
}

export interface Equipment extends BaseModel {
  name: string;
  description?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  type: EquipmentType;
  status: EquipmentStatus;
  dailyRate?: number;
  hourlyRate?: number;
  studioId: string;
}

export interface Reservation extends BaseModel {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  totalPrice: number;
  currency: string;
  studioId: string;
  createdBy: string;
}

// ========================================
// TYPES POUR LES RÉPONSES API
// ========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ========================================
// TYPES POUR LES FORMULAIRES
// ========================================

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm extends LoginForm {
  firstName: string;
  lastName: string;
  phone?: string;
}