import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import session from 'express-session';
import path from 'path';
import fs from 'fs';

import config from './config/index.js';
import { testConnection, initializeDatabase } from './config/database.js';
import logger from './utils/logger.js';
import routes from './routes/index.js';
import { 
  globalErrorHandler, 
  notFoundHandler 
} from './middleware/errorHandler.js';

class Application {
  constructor() {
    this.app = express();
    this.setupDirectories();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }
  
  setupDirectories() {
    // Ensure required directories exist
    const dirs = ['uploads', 'logs', 'public'];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    });
  }
  
  setupMiddleware() {
    // Session middleware for OAuth2
    this.app.use(session({
      secret: config.external.microsoft.clientSecret || 'your-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.env === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));
    
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS configuration
    this.app.use(cors({
      origin: config.env === 'development' ? true : [
        'http://localhost:3000',
        'http://localhost:3002',
        'http://localhost:5173'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: {
        status: 'error',
        message: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api', limiter);
    
    // Request logging
    const morganFormat = config.env === 'development' ? 'dev' : 'combined';
    this.app.use(morgan(morganFormat, {
      stream: {
        write: (message) => logger.info(message.trim(), { source: 'http' })
      }
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Compression
    this.app.use(compression());
    
    // Static files
    this.app.use(express.static('public'));
    
    // Request metadata
    this.app.use((req, res, next) => {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.startTime = Date.now();
      
      res.setHeader('X-Request-ID', req.requestId);
      
      logger.info(`${req.method} ${req.path}`, {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      next();
    });
  }
  
  setupRoutes() {
    // API routes
    this.app.use('/api', routes);
    
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        status: 'success',
        message: 'TiDB AgentX MindFlow API',
        version: '1.0.0',
        documentation: '/api/docs',
        health: '/api/health',
        timestamp: new Date().toISOString()
      });
    });
    
    // Serve frontend (if available)
    this.app.get('/app', (req, res) => {
      const indexPath = path.join(process.cwd(), 'public', 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({
          status: 'error',
          message: 'Frontend not available'
        });
      }
    });
  }
  
  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(globalErrorHandler);
    
    // Response time logging
    this.app.use((req, res, next) => {
      const responseTime = Date.now() - req.startTime;
      
      logger.info(`Response ${res.statusCode}`, {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`
      });
      
      next();
    });
  }
  
  async initialize() {
    try {
      logger.info('Initializing TiDB AgentX MindFlow application...', {
        nodeEnv: config.env,
        port: config.port
      });
      
      // Test database connection
      await testConnection();
      logger.info('Database connection successful');
      
      // Initialize database schema
      await initializeDatabase();
      logger.info('Database schema initialized');
      
      logger.info('Application initialization completed successfully');
      
    } catch (error) {
      logger.logError(error, { context: 'APP_INITIALIZATION' });
      throw error;
    }
  }
  
  async start() {
    try {
      await this.initialize();
      
      const server = this.app.listen(config.port, () => {
        logger.info(`Server running on port ${config.port}`, {
          env: config.env,
          port: config.port,
          processId: process.pid
        });
        
        // Log available endpoints
        logger.info('Available endpoints:', {
          api: `http://localhost:${config.port}/api`,
          docs: `http://localhost:${config.port}/api/docs`,
          health: `http://localhost:${config.port}/api/health`,
          frontend: `http://localhost:${config.port}/app`
        });
      });
      
      // Graceful shutdown
      const gracefulShutdown = async (signal) => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        
        server.close(async () => {
          logger.info('HTTP server closed');
          
          try {
            // Cleanup resources here if needed
            logger.info('Cleanup completed');
            process.exit(0);
          } catch (error) {
            logger.logError(error, { context: 'GRACEFUL_SHUTDOWN' });
            process.exit(1);
          }
        });
      };
      
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      
      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        logger.logError(error, { context: 'UNCAUGHT_EXCEPTION' });
        process.exit(1);
      });
      
      process.on('unhandledRejection', (reason, promise) => {
        logger.logError(new Error(reason), { 
          context: 'UNHANDLED_REJECTION',
          promise: promise.toString()
        });
        process.exit(1);
      });
      
      return server;
      
    } catch (error) {
      logger.logError(error, { context: 'APP_START' });
      process.exit(1);
    }
  }
}

// Create and start application
const app = new Application();

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app.start();
}

export default app;