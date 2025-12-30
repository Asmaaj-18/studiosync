import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

// Routes TypeScript
import authRoutes from './routes/auth.routes';
import studioRoutes from './routes/studio.routes';
import bookingRoutes from './routes/booking.routes';
import equipmentRoutes from './routes/equipment.routes';

// Types personnalisés
import { ApiResponse } from './types/prisma';

// Charger les variables d'environnement
dotenv.config();

// Configuration
const PORT: number = parseInt(process.env.PORT || '5000', 10);
const NODE_ENV: string = process.env.NODE_ENV || 'development';
const CLIENT_URL: string = process.env.CLIENT_URL || 'http://localhost:3000';
const API_VERSION: string = process.env.API_VERSION || 'v1';

// Initialiser Express
const app: Application = express();
const prisma = new PrismaClient();

// Types pour les erreurs
interface AppError extends Error {
  status?: number;
  code?: string;
}

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: NODE_ENV === 'development' 
    ? [CLIENT_URL, 'http://localhost:3000', 'http://localhost:3001']
    : [CLIENT_URL],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Pagination-Total', 'X-Pagination-Page'],
  maxAge: 86400, // 24 heures
};

app.use(cors(corsOptions));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'development' ? 1000 : 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  } as ApiResponse<null>,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: ipKeyGenerator,
  skip: (req: Request) => {
    return req.path.includes('/health') || req.path.includes('/test');
  }
});

// Compression
app.use(compression());

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsers
app.use(express.json({
  limit: '10mb',
  verify: (req: Request & { rawBody?: string }, res: Response, buf: Buffer) => {
    req.rawBody = buf.toString();
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Middleware pour ajouter des en-têtes personnalisés
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Powered-By', 'StudioSync API');
  res.setHeader('X-API-Version', API_VERSION);
  res.setHeader('X-Environment', NODE_ENV);
  next();
});

// Route de santé
app.get('/api/health', (req: Request, res: Response<ApiResponse<any>>) => {
  const healthCheck = {
    status: 'OK',
    message: 'StudioSync API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: API_VERSION,
    database: 'connected',
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version
  };

  res.status(200).json({
    success: true,
    message: 'Health check successful',
    data: healthCheck
  });
});

// Route de test de la base de données
app.get('/api/health/db', async (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    
    const [userCount, studioCount, reservationCount, equipmentCount] = await Promise.all([
      prisma.user.count(),
      prisma.studio.count({ where: { isActive: true } }),
      prisma.booking.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.equipment.count({ where: { status: 'AVAILABLE' } })
    ]);

    res.status(200).json({
      success: true,
      message: 'Database health check successful',
      data: {
        status: 'connected',
        timestamp: new Date().toISOString(),
        statistics: {
          totalUsers: userCount,
          activeStudios: studioCount,
          recentReservations: reservationCount,
          availableEquipment: equipmentCount
        }
      }
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Documentation de l'API
app.get('/api', (req: Request, res: Response<ApiResponse<any>>) => {
  const apiDocumentation = {
    name: 'StudioSync API',
    version: API_VERSION,
    environment: NODE_ENV,
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      auth: {
        base: '/api/auth',
        endpoints: [
          { path: '/register', method: 'POST', description: 'Register new user' },
          { path: '/login', method: 'POST', description: 'User login' },
          { path: '/refresh', method: 'POST', description: 'Refresh access token' },
          { path: '/profile', method: 'GET', description: 'Get user profile' },
          { path: '/logout', method: 'POST', description: 'User logout' }
        ]
      },
      studios: {
        base: '/api/studios',
        endpoints: [
          { path: '/', method: 'GET', description: 'List all studios' },
          { path: '/:id', method: 'GET', description: 'Get studio details' },
          { path: '/', method: 'POST', description: 'Create new studio' },
          { path: '/:id', method: 'PUT', description: 'Update studio' }
        ]
      },
      bookings: {
        base: '/api/bookings',
        endpoints: [
          { path: '/', method: 'GET', description: 'List bookings' },
          { path: '/:id', method: 'GET', description: 'Get booking details' },
          { path: '/', method: 'POST', description: 'Create booking' },
          { path: '/:id', method: 'PUT', description: 'Update booking' }
        ]
      },
      equipment: {
        base: '/api/equipment',
        endpoints: [
          { path: '/', method: 'GET', description: 'List equipment' },
          { path: '/:id', method: 'GET', description: 'Get equipment details' },
          { path: '/', method: 'POST', description: 'Add equipment' },
          { path: '/:id', method: 'PUT', description: 'Update equipment' }
        ]
      }
    },
    authentication: 'Bearer token required for protected routes',
    rateLimiting: '100 requests per 15 minutes per IP',
    contact: {
      email: 'support@studiosync.com',
      documentation: 'https://docs.studiosync.com/api'
    }
  };

  res.status(200).json({
    success: true,
    message: 'StudioSync API Documentation',
    data: apiDocumentation
  });
});

// Versioning des routes
const apiRouter = express.Router();

// Appliquer le rate limiting aux routes API
apiRouter.use(apiLimiter);

// Routes API versionnées
apiRouter.use('/auth', authRoutes);
apiRouter.use('/studios', studioRoutes);
apiRouter.use('/bookings', bookingRoutes);
apiRouter.use('/equipment', equipmentRoutes);

// Monter les routes versionnées
app.use(`/api/${API_VERSION}`, apiRouter);

// Routes non versionnées (rétrocompatibilité)
app.use('/api/auth', authRoutes);
app.use('/api/studios', studioRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/equipment', equipmentRoutes);

// CORRECTION CRITIQUE : Route 404 avec la bonne syntaxe
// En Express, pour une route catch-all, il faut soit :
// 1. Utiliser '*' sans slash (mais ça peut causer des problèmes)
// 2. Utiliser un regex
// 3. Mettre la route 404 à la fin SANS spécifier de chemin

// Option recommandée : Route 404 à la fin de toutes les routes
// (on laisse Express gérer les routes non trouvées)

// Middleware de gestion des erreurs globales
app.use((err: AppError, req: Request, res: Response<ApiResponse<null>>, next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id || 'anonymous'
  });

  const status = err.status || 500;
  
  let errorMessage = 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';

  if (err.name === 'ValidationError') {
    errorMessage = 'Validation error';
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    errorMessage = 'Authentication required';
    errorCode = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    errorMessage = 'Insufficient permissions';
    errorCode = 'FORBIDDEN';
  } else if (err.code === 'P2002') {
    errorMessage = 'Duplicate entry';
    errorCode = 'DUPLICATE_ENTRY';
  } else if (err.code === 'P2025') {
    errorMessage = 'Record not found';
    errorCode = 'NOT_FOUND';
  }

  res.status(status).json({
    success: false,
    message: errorMessage,
    error: errorCode,
    ...(NODE_ENV === 'development' && {
      details: err.message,
      stack: err.stack
    })
  });
});

// Route 404 - DOIT ÊTRE APRÈS TOUTES LES AUTRES ROUTES
// CORRECTION : Utiliser une fonction middleware sans chemin spécifique
app.use((req: Request, res: Response<ApiResponse<null>>, next: NextFunction) => {
  // Si aucune route n'a matché jusqu'ici, c'est une 404
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`,
      error: 'NOT_FOUND'
    });
  } else {
    next();
  }
});

// Gestion de la fermeture propre
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  
  try {
    await prisma.$disconnect();
    console.log('Prisma client disconnected');
    
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  
  try {
    await prisma.$disconnect();
    console.log('Prisma client disconnected');
    
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Gestion des exceptions non capturées
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Démarrer le serveur
const server = app.listen(PORT, () => {
  console.log(`
  🚀 StudioSync API Server
  ========================
  📍 Port: ${PORT}
  🌍 Environment: ${NODE_ENV}
  🗺️ CORS Origin: ${CLIENT_URL}
  📚 API Version: ${API_VERSION}
  🕐 Started: ${new Date().toISOString()}
  
  📡 Endpoints:
  - Health: http://localhost:${PORT}/api/health
  - API Docs: http://localhost:${PORT}/api
  - Auth: http://localhost:${PORT}/api/auth
  - Studios: http://localhost:${PORT}/api/studios
  - Bookings: http://localhost:${PORT}/api/bookings
  - Equipment: http://localhost:${PORT}/api/equipment
  `);
});

// Export pour les tests
export { app, prisma, server };