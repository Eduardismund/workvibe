import AgentOrchestrator from '../services/AgentOrchestrator.js';
import AgentSessionModel from '../models/AgentSession.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

class AgentController {


  // Ingestion workflow - Analyze and store videos
  ingestVideos = asyncHandler(async (req, res) => {
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
      
      logger.info('Video ingestion workflow request', { 
        hasDescription: !!req.body.description,
        hasUserEmail: !!userEmail,
        hasUserToken: !!userToken
      });
      
      // Use the standard ingestion workflow
      const result = await AgentOrchestrator.executeIngestionWorkflowWithUserInfo(input);
      
      res.status(200).json({
        status: 'success',
        data: {
          sessionId: result.sessionId,
          analysis: {
            tags: result.analysis.tags || [],
            emotions: result.analysis.emotions?.emotions || [],
            calendar: {
              eventCount: result.analysis.calendar?.eventCount || 0,
              hasEvents: (result.analysis.calendar?.eventCount || 0) > 0
            },
            totalVideosStored: result.analysis.totalVideosStored,
            basedOnLikedVideos: result.analysis.basedOnLikedVideos || 0
          }
        }
      });
      
    } catch (error) {
      logger.error('Ingestion workflow failed', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to ingest videos'
      });
    }
  });

  filterVideos = asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Please upload a selfie image'
      });
    }
    
    if (!req.body.description) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a description for filtering'
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
      
      logger.info('Video filtering workflow request', { 
        hasDescription: !!req.body.description,
        hasUserEmail: !!userEmail,
        hasUserToken: !!userToken
      });
      
      const result = await AgentOrchestrator.executeFilteringWorkflow(input);
      
      res.status(200).json({
        status: 'success',
        data: {
          filteredVideos: result.data.filteredVideos,
          totalVideos: result.data.totalVideos
        }
      });
      
    } catch (error) {
      logger.error('Filtering workflow failed', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to filter videos'
      });
    }
  });

  // Ingest videos based on liked videos only
  ingestLikedVideos = asyncHandler(async (req, res) => {
    const { likedVideoIds } = req.body;
    
    if (!likedVideoIds || !Array.isArray(likedVideoIds) || likedVideoIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide liked video IDs'
      });
    }
    
    try {
      const userEmail = req.body.userEmail || req.session?.userPrincipalName || req.body.email || null;
      const userToken = req.session?.accessToken || null;
      
      logger.info('Liked videos ingestion request', { 
        likedVideoCount: likedVideoIds.length,
        hasUserEmail: !!userEmail,
        hasUserToken: !!userToken
      });
      
      // Execute ingestion based on liked videos
      const result = await AgentOrchestrator.executeLikedVideosIngestion({
        likedVideoIds,
        userEmail,
        userToken
      });
      
      res.status(200).json({
        status: 'success',
        success: true,
        data: {
          totalVideosStored: result.data.totalVideosStored,
          videosAnalyzed: result.data.videosAnalyzed,
          message: `Successfully ingested ${result.data.totalVideosStored} similar videos based on ${likedVideoIds.length} liked videos`
        }
      });
      
    } catch (error) {
      logger.error('Liked videos ingestion failed', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to ingest videos based on liked videos'
      });
    }
  });
  
}

export default new AgentController();