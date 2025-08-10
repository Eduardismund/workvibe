import express from 'express';
import multer from 'multer';
import path from 'path';
import DocumentController from '../controllers/DocumentController.js';
import AgentController from '../controllers/AgentController.js';
import YouTubeController from '../controllers/YouTubeController.js';
import { 
  validateDocumentUpload,
  validateSearch,
  validateDocumentId,
  validateSessionId,
  validateAnalysis,
  validatePagination,
  validateWorkflowType,
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

// Document routes
router.post('/documents/upload', 
  upload.single('document'),
  validateDocumentUpload,
  DocumentController.uploadDocument
);

router.post('/documents/process',
  upload.single('document'),
  DocumentController.processWithAgent
);

router.get('/documents/search',
  validateSearch,
  DocumentController.searchDocuments
);

router.post('/documents/analyze',
  validateAnalysis,
  DocumentController.analyzeDocuments
);

router.get('/documents',
  validatePagination,
  DocumentController.listDocuments
);

router.get('/documents/stats',
  DocumentController.getStats
);

router.get('/documents/:id',
  validateDocumentId,
  DocumentController.getDocument
);

router.delete('/documents/:id',
  validateDocumentId,
  DocumentController.deleteDocument
);

// Agent workflow routes
router.post('/agent/session',
  validateWorkflowType,
  AgentController.createSession
);

router.post('/agent/workflow',
  AgentController.executeWorkflow
);

router.post('/agent/analyze',
  AgentController.analyzeDocument
);

router.post('/agent/research',
  AgentController.researchContent
);

router.post('/agent/demo',
  AgentController.runDemo
);

router.get('/agent/health',
  AgentController.healthCheck
);

router.get('/agent/stats',
  AgentController.getAgentStats
);

router.get('/agent/sessions',
  validatePagination,
  AgentController.listSessions
);

router.get('/agent/sessions/:sessionId',
  validateSessionId,
  AgentController.getSessionStatus
);

router.get('/agent/sessions/:sessionId/summary',
  validateSessionId,
  AgentController.getSessionSummary
);

router.get('/agent/sessions/:sessionId/actions',
  validateSessionId,
  AgentController.getSessionActions
);

// YouTube routes
router.get('/youtube/metadata',
  YouTubeController.getVideoMetadata
);

router.get('/youtube/transcript',
  YouTubeController.getVideoTranscript
);

router.get('/youtube/search',
  YouTubeController.searchVideos
);

router.get('/youtube/related',
  YouTubeController.getRelatedVideos
);

router.get('/youtube/channel',
  YouTubeController.getChannelInfo
);

router.post('/youtube/process',
  YouTubeController.processVideo
);

router.post('/youtube/analyze',
  YouTubeController.analyzeVideo
);

router.post('/youtube/research',
  YouTubeController.researchTopic
);

router.post('/youtube/workflow/analyze',
  YouTubeController.executeYouTubeAnalysisWorkflow
);

router.post('/youtube/workflow/research',
  YouTubeController.executeYouTubeResearchWorkflow
);

router.post('/youtube/demo',
  YouTubeController.runYouTubeDemo
);


// API documentation endpoint
router.get('/docs', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      title: 'TiDB AgentX MindFlow API',
      version: '1.0.0',
      description: 'Advanced Multi-step AI Agent with TiDB and MCP',
      endpoints: {
        documents: {
          'POST /api/documents/upload': 'Upload and process document',
          'POST /api/documents/process': 'Process document with AI agent',
          'GET /api/documents/search': 'Search documents with vector/text search',
          'POST /api/documents/analyze': 'Analyze documents with AI',
          'GET /api/documents': 'List documents with pagination',
          'GET /api/documents/stats': 'Get document statistics',
          'GET /api/documents/:id': 'Get document by ID',
          'DELETE /api/documents/:id': 'Delete document'
        },
        agent: {
          'POST /api/agent/session': 'Create new agent session',
          'POST /api/agent/workflow': 'Execute workflow',
          'POST /api/agent/analyze': 'Document analysis workflow',
          'POST /api/agent/research': 'Content research workflow',
          'POST /api/agent/demo': 'Run demo workflow',
          'GET /api/agent/health': 'Agent system health check',
          'GET /api/agent/stats': 'Agent statistics',
          'GET /api/agent/sessions': 'List sessions',
          'GET /api/agent/sessions/:id': 'Get session status',
          'GET /api/agent/sessions/:id/summary': 'Get session summary',
          'GET /api/agent/sessions/:id/actions': 'Get session actions'
        },
        youtube: {
          'GET /api/youtube/metadata': 'Get video metadata (query: videoUrl)',
          'GET /api/youtube/transcript': 'Get video transcript (query: videoUrl)',
          'GET /api/youtube/search': 'Search videos (query: query, maxResults)',
          'GET /api/youtube/related': 'Get related videos (query: videoUrl, maxResults)',
          'GET /api/youtube/channel': 'Get channel info (query: channelId)',
          'POST /api/youtube/process': 'Process video and store as document',
          'POST /api/youtube/analyze': 'Analyze video with AI',
          'POST /api/youtube/research': 'Research topic across YouTube',
          'POST /api/youtube/workflow/analyze': 'Execute YouTube analysis workflow',
          'POST /api/youtube/workflow/research': 'Execute YouTube research workflow',
          'POST /api/youtube/demo': 'Run YouTube demo (body: scenario)'
        },
        general: {
          'GET /api/health': 'Service health check',
          'GET /api/docs': 'API documentation'
        }
      },
      workflows: {
        document_analysis: {
          description: 'Multi-step document ingestion, search, and AI analysis',
          steps: [
            'Ingest document with vector embeddings',
            'Search for similar documents',
            'Analyze with LLM',
            'Extract key insights',
            'Generate comprehensive report'
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