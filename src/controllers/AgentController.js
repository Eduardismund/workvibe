import DirectAgentService from '../services/DirectAgentService.js';
import AgentSessionModel from '../models/AgentSession.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

class AgentController {
  // Create a new agent session
  createSession = asyncHandler(async (req, res) => {
    const { name, workflowType = 'document_analysis', userContext = {} } = req.body;
    
    logger.info('Creating agent session', { name, workflowType });
    
    const session = await DirectAgentService.createSession(name, workflowType, userContext);
    
    res.status(201).json({
      status: 'success',
      data: { session }
    });
  });
  
  // Execute a workflow
  executeWorkflow = asyncHandler(async (req, res) => {
    const { workflowType, input, options = {} } = req.body;
    
    logger.info('Executing workflow', { workflowType });
    
    // Create session if none exists
    if (!DirectAgentService.currentSession) {
      await DirectAgentService.createSession(
        `${workflowType}: ${Date.now()}`,
        workflowType
      );
    }
    
    let result;
    if (workflowType === 'document_analysis') {
      result = await DirectAgentService.executeDocumentAnalysisWorkflow(input, options);
    } else {
      throw new Error(`Workflow type ${workflowType} not yet implemented in DirectAgentService`);
    }
    
    res.status(200).json({
      status: 'success',
      data: { result }
    });
  });
  
  getSessionStatus = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    const status = await DirectAgentService.getSessionStatus(sessionId);
    
    res.status(200).json({
      status: 'success',
      data: { session: status }
    });
  });
  
  listSessions = asyncHandler(async (req, res) => {
    const { 
      status, 
      workflowType, 
      limit = 20, 
      offset = 0,
      page
    } = req.query;
    
    const actualOffset = page ? (parseInt(page) - 1) * parseInt(limit) : parseInt(offset);
    
    const sessions = await AgentSessionModel.list({
      status,
      workflowType,
      limit: parseInt(limit),
      offset: actualOffset
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        sessions,
        pagination: {
          limit: parseInt(limit),
          offset: actualOffset,
          page: page ? parseInt(page) : Math.floor(actualOffset / parseInt(limit)) + 1
        }
      }
    });
  });
  
  // Get session actions/logs
  getSessionActions = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;
    
    const actions = await AgentSessionModel.getActions(sessionId, parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      data: { actions }
    });
  });
  
  // Get session summary with detailed information
  getSessionSummary = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    const summary = await AgentSessionModel.getSessionSummary(sessionId);
    
    if (!summary) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { summary }
    });
  });
  
  // Execute document analysis workflow (specific endpoint)
  analyzeDocument = asyncHandler(async (req, res) => {
    const { title, content, query, analysisType = 'general' } = req.body;
    
    logger.info('Document analysis workflow request', { title, analysisType });
    
    const result = await DirectAgentService.executeDocumentAnalysisWorkflow({
      title,
      content,
      query: query || `Analyze this document: ${title}`,
      analysisType
    });
    
    res.status(200).json({
      status: 'success',
      data: { analysis: result }
    });
  });
  
  // Execute content research workflow (specific endpoint)
  researchContent = asyncHandler(async (req, res) => {
    const { 
      query, 
      sources = ['documents'], 
      maxResults = 10,
      includeWeb = false 
    } = req.body;
    
    logger.info('Content research workflow request', { query, sources });
    
    await AgentOrchestrator.initialize();
    
    const actualSources = includeWeb ? [...sources, 'web'] : sources;
    
    const result = await AgentOrchestrator.executeWorkflow('content_research', {
      query,
      sources: actualSources,
      maxResults
    });
    
    res.status(200).json({
      status: 'success',
      data: { research: result }
    });
  });
  
  // Get agent statistics
  getAgentStats = asyncHandler(async (req, res) => {
    const stats = await AgentSessionModel.getStats();
    
    // Add current agent service status
    const agentServiceStats = {
      isInitialized: DirectAgentService.isInitialized,
      currentSession: DirectAgentService.currentSession,
      supportedWorkflows: [
        'document_analysis'
      ]
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        sessions: stats,
        agentService: agentServiceStats
      }
    });
  });
  
  // Health check for agent system
  healthCheck = asyncHandler(async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        agentService: {
          initialized: DirectAgentService.isInitialized,
          currentSession: DirectAgentService.currentSession
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json({
        status: 'success',
        data: { health }
      });
      
    } catch (error) {
      logger.logError(error, { context: 'AGENT_HEALTH_CHECK' });
      
      res.status(503).json({
        status: 'error',
        message: 'Agent system unhealthy',
        error: error.message
      });
    }
  });
  
  // Demo workflow for hackathon presentation
  runDemo = asyncHandler(async (req, res) => {
    const { scenario = 'basic' } = req.body;
    
    logger.info('Running demo workflow', { scenario });
    
    let demoResult;
    
    switch (scenario) {
      case 'basic':
        demoResult = await DirectAgentService.runBasicDemo();
        break;
      case 'advanced':
        demoResult = await DirectAgentService.runAdvancedDemo();
        break;
      default:
        demoResult = await DirectAgentService.runBasicDemo();
    }
    
    res.status(200).json({
      status: 'success',
      data: { 
        demo: demoResult,
        scenario 
      }
    });
  });
  
}

export default new AgentController();