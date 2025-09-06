import AgentOrchestrator from '../services/AgentOrchestrator.js';
import AgentSessionModel from '../models/AgentSession.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

class AgentController {

  analyzeContext = asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Please upload a selfie image'
      });
    }
    
    if (!req.body.description) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a description'
      });
    }
    
    try {
      const userEmail = req.body.userEmail || req.session?.userPrincipalName || req.body.email || null;
      const userToken = req.session?.accessToken || null;
      
      const input = {
        selfieBuffer: req.file.buffer,
        description: req.body.description.trim(),
        userEmail,
        userToken
      };
      
      logger.info('Context analysis workflow request', { 
        hasDescription: !!req.body.description,
        hasUserEmail: !!userEmail,
        hasUserToken: !!userToken
      });
      
      // Skip MCP initialization for context analysis to avoid MCP server issues
      // await AgentOrchestrator.initialize();
      
      const result = await AgentOrchestrator.executeContextAnalysisWorkflow(input);
      
      res.status(200).json({
        status: 'success',
        data: {
          sessionId: result.sessionId,
          analysis: {
            tags: result.analysis.tags,
            emotions: {
              all: result.analysis.emotions.emotions
            },
            calendar: {
              eventCount: result.analysis.calendar.eventCount,
              hasEvents: result.analysis.calendar.eventCount > 0
            },
            youtubeShorts: result.analysis.youtubeShorts
          },
          workflow: {
            steps: result.workflow.length,
            success: result.success
          }
        }
      });
      
    } catch (error) {
      logger.error('Context analysis workflow failed', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to analyze context'
      });
    }
  });
  
}

export default new AgentController();