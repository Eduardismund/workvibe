import YouTubeService from '../services/YouTubeService.js';
import DirectAgentService from '../services/DirectAgentService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

class YouTubeController {
  // Get video metadata
  getVideoMetadata = asyncHandler(async (req, res) => {
    const { videoUrl } = req.query;
    
    if (!videoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'videoUrl parameter is required'
      });
    }
    
    logger.info('Fetching video metadata', { videoUrl });
    
    const videoId = YouTubeService.extractVideoId(videoUrl);
    const metadata = await YouTubeService.getVideoMetadata(videoId);
    
    res.status(200).json({
      status: 'success',
      data: { metadata }
    });
  });
  
  // Get video transcript
  getVideoTranscript = asyncHandler(async (req, res) => {
    const { videoUrl } = req.query;
    
    if (!videoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'videoUrl parameter is required'
      });
    }
    
    logger.info('Fetching video transcript', { videoUrl });
    
    const videoId = YouTubeService.extractVideoId(videoUrl);
    const transcript = await YouTubeService.getTranscript(videoId);
    
    res.status(200).json({
      status: 'success',
      data: { transcript }
    });
  });
  
  // Search videos
  searchVideos = asyncHandler(async (req, res) => {
    const { query, maxResults = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        status: 'error',
        message: 'query parameter is required'
      });
    }
    
    logger.info('Searching YouTube videos', { query, maxResults });
    
    const videos = await YouTubeService.searchVideos(query, parseInt(maxResults));
    
    res.status(200).json({
      status: 'success',
      data: { 
        videos,
        count: videos.length,
        query
      }
    });
  });
  
  // Get related videos
  getRelatedVideos = asyncHandler(async (req, res) => {
    const { videoUrl, maxResults = 5 } = req.query;
    
    if (!videoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'videoUrl parameter is required'
      });
    }
    
    logger.info('Fetching related videos', { videoUrl, maxResults });
    
    const videoId = YouTubeService.extractVideoId(videoUrl);
    const relatedVideos = await YouTubeService.getRelatedVideos(videoId, parseInt(maxResults));
    
    res.status(200).json({
      status: 'success',
      data: { 
        relatedVideos,
        count: relatedVideos.length,
        sourceVideoId: videoId
      }
    });
  });
  
  // Get channel information
  getChannelInfo = asyncHandler(async (req, res) => {
    const { channelId } = req.query;
    
    if (!channelId) {
      return res.status(400).json({
        status: 'error',
        message: 'channelId parameter is required'
      });
    }
    
    logger.info('Fetching channel info', { channelId });
    
    const channel = await YouTubeService.getChannelInfo(channelId);
    
    res.status(200).json({
      status: 'success',
      data: { channel }
    });
  });
  
  // Process video and store as document
  processVideo = asyncHandler(async (req, res) => {
    const { videoUrl, additionalMetadata = {} } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'videoUrl is required in request body'
      });
    }
    
    logger.info('Processing YouTube video', { videoUrl });
    
    const result = await YouTubeService.processVideo(videoUrl, {
      additionalMetadata
    });
    
    res.status(201).json({
      status: 'success',
      data: result
    });
  });
  
  // Analyze video with AI
  analyzeVideo = asyncHandler(async (req, res) => {
    const { videoUrl, analysisType = 'general' } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'videoUrl is required in request body'
      });
    }
    
    logger.info('Analyzing YouTube video', { videoUrl, analysisType });
    
    const analysis = await YouTubeService.analyzeVideo(videoUrl, analysisType);
    
    res.status(200).json({
      status: 'success',
      data: analysis
    });
  });
  
  // Research topic across YouTube
  researchTopic = asyncHandler(async (req, res) => {
    const { topic, maxVideos = 5 } = req.body;
    
    if (!topic) {
      return res.status(400).json({
        status: 'error',
        message: 'topic is required in request body'
      });
    }
    
    logger.info('Researching YouTube topic', { topic, maxVideos });
    
    const research = await YouTubeService.researchTopic(topic, parseInt(maxVideos));
    
    res.status(200).json({
      status: 'success',
      data: research
    });
  });
  
  // Execute YouTube analysis workflow
  executeYouTubeAnalysisWorkflow = asyncHandler(async (req, res) => {
    const { videoUrl, analysisType = 'general' } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'videoUrl is required in request body'
      });
    }
    
    logger.info('Executing YouTube analysis workflow', { videoUrl, analysisType });
    
    const result = await DirectAgentService.executeYouTubeAnalysisWorkflow({
      videoUrl,
      analysisType
    });
    
    res.status(200).json({
      status: 'success',
      data: { workflow: result }
    });
  });
  
  // Execute YouTube research workflow
  executeYouTubeResearchWorkflow = asyncHandler(async (req, res) => {
    const { topic, maxVideos = 5 } = req.body;
    
    if (!topic) {
      return res.status(400).json({
        status: 'error',
        message: 'topic is required in request body'
      });
    }
    
    logger.info('Executing YouTube research workflow', { topic, maxVideos });
    
    const result = await DirectAgentService.executeYouTubeResearchWorkflow({
      topic,
      maxVideos: parseInt(maxVideos)
    });
    
    res.status(200).json({
      status: 'success',
      data: { workflow: result }
    });
  });
  
  // Demo: Process a sample YouTube video
  runYouTubeDemo = asyncHandler(async (req, res) => {
    const { scenario = 'basic' } = req.body;
    
    logger.info('Running YouTube demo', { scenario });
    
    let demoVideoUrl;
    let demoTopic;
    
    switch (scenario) {
      case 'basic':
        // Demo with a sample video URL (you can replace with any valid YouTube URL)
        demoVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        
        const basicResult = await DirectAgentService.executeYouTubeAnalysisWorkflow({
          videoUrl: demoVideoUrl,
          analysisType: 'technical'
        });
        
        res.status(200).json({
          status: 'success',
          data: {
            demo: basicResult,
            scenario,
            message: 'YouTube video analysis workflow completed'
          }
        });
        break;
        
      case 'research':
        // Demo with topic research
        demoTopic = 'artificial intelligence';
        
        const researchResult = await DirectAgentService.executeYouTubeResearchWorkflow({
          topic: demoTopic,
          maxVideos: 3
        });
        
        res.status(200).json({
          status: 'success',
          data: {
            demo: researchResult,
            scenario,
            message: 'YouTube research workflow completed'
          }
        });
        break;
        
      case 'metadata':
        // Simple metadata extraction demo
        demoVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        const videoId = YouTubeService.extractVideoId(demoVideoUrl);
        const metadata = await YouTubeService.getVideoMetadata(videoId);
        
        res.status(200).json({
          status: 'success',
          data: {
            demo: metadata,
            scenario,
            message: 'YouTube metadata extraction completed'
          }
        });
        break;
        
      default:
        res.status(400).json({
          status: 'error',
          message: 'Invalid scenario. Choose: basic, research, or metadata'
        });
    }
  });
}

export default new YouTubeController();