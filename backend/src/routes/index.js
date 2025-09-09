import express from 'express';
import multer from 'multer';
import path from 'path';
import AgentController from '../controllers/AgentController.js';
import YouTubeController from '../controllers/YouTubeController.js';
import TeamsController from '../controllers/TeamsController.js';
import AuthController from '../controllers/AuthController.js';
import EmotionController from '../controllers/EmotionController.js';
import IngestionController from '../controllers/IngestionController.js';
import {
  sanitizeInput
} from '../middleware/validation.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/json',
      'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: TXT, MD, PDF, JSON, CSV'));
    }
  }
});

// Separate upload config for images
const imageUpload = multer({
  storage: multer.memoryStorage(), // Store in memory for emotion analysis
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
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

// Apply sanitization to all routes
router.use(sanitizeInput);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      service: 'TiDB AgentX MindFlow',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

// Document routes removed - using TiDB storage directly

// Agent workflow routes

// YouTube routes
router.get('/youtube/shorts',
  YouTubeController.searchShorts
);

router.get('/youtube/comments',
  YouTubeController.getVideoComments
);

// Get recommended videos for a video ID
router.get('/youtube/recommended',
  YouTubeController.getRecommendedVideos
);

// Test endpoint for YouTube to TiDB storage
router.post('/test/youtube-tidb',
  YouTubeController.testYouTubeTiDBStorage
);

// Test similarity between sentence and all YouTube videos in DB
router.post('/youtube/test-similarity',
  YouTubeController.testSimilarity
);

// Teams Integration - Only what you need
router.get('/teams/today', 
  TeamsController.getTodaysMeetings
);


// List user's chats (for debugging)
router.get('/teams/chats',
  TeamsController.listUserChats
);

// Send message to Teams meeting by meeting ID
router.post('/teams/meetings/:meetingId/message',
  TeamsController.sendMeetingMessage
);


// Send message to Teams meeting by calendar event ID
router.post('/teams/events/:eventId/message',
  TeamsController.sendEventMessage
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

// Emotion Detection from Selfies
router.post('/emotion/analyze',
  imageUpload.single('image'),
  EmotionController.analyzeSelfie
);



// Video Ingestion Workflow - Analyze and store videos
router.post('/agent/ingest',
  imageUpload.single('selfie'),
  AgentController.ingestVideos
);

// Video Filtering Workflow - Get filtered videos based on context
router.post('/agent/filter',
  imageUpload.single('selfie'),
  AgentController.filterVideos
);

// Ingestion routes
router.post('/ingest/curate',
  IngestionController.getCuratedFeed
);

router.get('/ingest/stats',
  IngestionController.getStats
);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      title: 'TiDB AgentX API',
      version: '1.0.0',
      description: 'YouTube video recommendation system with emotion analysis',
      endpoints: {
        agent: {
          'POST /api/agent/ingest': 'Analyze context and store videos in database (multipart: selfie + description)',
          'POST /api/agent/filter': 'Filter videos based on context analysis (multipart: selfie + description)'
        },
        youtube: {
          'GET /api/youtube/metadata': 'Get video metadata (query: videoUrl)',
          'GET /api/youtube/transcript': 'Get video transcript (query: videoUrl)',
          'GET /api/youtube/search': 'Search videos (query: query, maxResults)',
          'GET /api/youtube/shorts': 'Search YouTube Shorts videos (query: query, maxResults)',
          'GET /api/youtube/related': 'Get related videos (query: videoUrl, maxResults)',
          'GET /api/youtube/channel': 'Get channel info (query: channelId)',
          'POST /api/youtube/process': 'Process video and store as document',
          'POST /api/youtube/analyze': 'Analyze video with AI',
          'POST /api/youtube/research': 'Research topic across YouTube',
          'POST /api/youtube/workflow/analyze': 'Execute YouTube analysis workflow',
          'POST /api/youtube/workflow/research': 'Execute YouTube research workflow',
          'POST /api/youtube/demo': 'Run YouTube demo (body: scenario)'
        },
        teams: {
          'GET /api/teams/today': 'Get today\'s meetings for authenticated user (includes attendees)',
          'POST /api/teams/meetings/:meetingId/message': 'Send message to Teams meeting chat (body: {message})',
          'POST /api/teams/events/:eventId/message': 'Send message to calendar event\'s Teams meeting (body: {message})',
          'GET /api/auth/login': 'Login with Microsoft account',
          'GET /api/auth/callback': 'OAuth callback (automatic)',
          'GET /api/auth/logout': 'Logout and clear session'
        },
        emotion: {
          'POST /api/emotion/analyze': 'Analyze emotions from uploaded selfie (multipart/form-data)',
          'GET /api/emotion/status': 'Check available emotion detection services'
        },
        curation: {
          'POST /api/agent/curate/feed': 'AI-orchestrated YouTube curation with full workflow tracking (multipart: selfie + photo) [RECOMMENDED]',
          'POST /api/curate/feed': 'Legacy: Direct curation service (multipart: selfie + photo)',
          'POST /api/curate/analyze': 'Analyze context only without generating feed (multipart: selfie + photo)',
          'POST /api/curate/quick': 'Quick curation using manual inputs (body: {emotion, stress, energy})',
          'POST /api/curate/feedback': 'Provide feedback on recommendations (body: {historyId, videoId, action, watchTime})',
          'POST /api/curate/init': 'Initialize TiDB vector tables (admin only)'
        },
        general: {
          'GET /api/health': 'Service health check',
          'GET /api/docs': 'API documentation'
        }
      },
      workflows: {
        context_analysis: {
          description: 'Analyze user context combining emotion, calendar, and description',
          steps: [
            'Analyze selfie emotions using AWS Rekognition',
            'Fetch today\'s calendar events from Teams',
            'Combine context with user description',
            'AI analysis to extract tags and insights',
            'Generate comprehensive context report'
          ]
        },
        content_research: {
          description: 'Research content from multiple sources',
          steps: [
            'Search document database',
            'Search web (if enabled)',
            'Aggregate results',
            'Synthesize findings',
            'Generate research report'
          ]
        },
        youtube_analysis: {
          description: 'Analyze YouTube video with AI and store insights',
          steps: [
            'Extract video metadata',
            'Process and store video as document',
            'Find related content',
            'AI video analysis',
            'Generate comprehensive report'
          ]
        },
        youtube_research: {
          description: 'Research topic across multiple YouTube videos',
          steps: [
            'Search videos on topic',
            'Process each video',
            'Extract insights',
            'Generate research summary',
            'Store as document'
          ]
        }
      }
    }
  });
});

export default router;