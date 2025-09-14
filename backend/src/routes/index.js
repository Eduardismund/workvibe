import express from 'express';
import multer from 'multer';
import path from 'path';
import AgentController from '../controllers/AgentController.js';
import TeamsController from '../controllers/TeamsController.js';
import AuthController from '../controllers/AuthController.js';
import IngestionController from '../controllers/IngestionController.js';
import MemeController from '../controllers/MemeController.js';
import {
  sanitizeInput
} from '../middleware/validation.js';

const router = express.Router();



const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Allowed: JPG, PNG, GIF, WEBP'));
    }
  }
});

router.use(sanitizeInput);

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      service: 'WorkVibe API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

router.get('/teams/today', 
  TeamsController.getTodaysMeetings
);

router.post('/agent/ingest',
  imageUpload.single('selfie'),
  AgentController.ingestVideos
);

router.post('/agent/filter',
  imageUpload.single('selfie'),
  AgentController.filterVideos
);

router.post('/agent/ingest-liked-videos',
  AgentController.ingestLikedVideos
);

router.get('/auth/login',
  AuthController.login
);

router.get('/auth/callback',
  AuthController.callback
);

router.get('/auth/logout',
  AuthController.logout
);


router.get('/ingest/content-stats',
  IngestionController.getContentStats
);

router.post('/ingest/reset-watched',
  IngestionController.resetWatched
);

router.post('/memes/ingest',
  MemeController.ingestMemes
);

router.post('/memes/create',
  imageUpload.single('selfie'),
  MemeController.createMemeFromUserData
);

router.get('/docs', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      title: 'WorkVibe API',
      version: '1.0.0',
      description: 'AI-powered workplace engagement platform',
      endpoints: {
        agent: {
          'POST /api/agent/ingest': 'Main video ingestion workflow (multipart: selfie + description)',
          'POST /api/agent/filter': 'Filter videos based on context analysis (multipart: selfie + description)',
          'POST /api/agent/ingest-liked-videos': 'Ingest videos based on user likes'
        },
        teams: {
          'GET /api/teams/today': 'Get today\'s meetings for authenticated user',
          'GET /api/auth/login': 'Login with Microsoft account',
          'GET /api/auth/callback': 'OAuth callback (automatic)',
          'GET /api/auth/logout': 'Logout and clear session'
        },
        content: {
          'GET /api/ingest/content-stats': 'Get database statistics (videos/memes count)',
          'POST /api/ingest/reset-watched': 'Reset watch history for refresh functionality'
        },
        memes: {
          'POST /api/memes/ingest': 'Ingest meme templates into database',
          'POST /api/memes/create': 'Create personalized meme from user context'
        },
        general: {
          'GET /api/health': 'Service health check',
          'GET /api/docs': 'API documentation'
        }
      }
    }
  });
});

export default router;