import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import AgentSessionModel from '../models/AgentSession.js';
import YouTubeVideoModel from '../models/YouTubeVideo.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

class AgentOrchestrator {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.currentSession = null;
  }
  
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      logger.info('Initializing Agent Orchestrator...');
      
      // Spawn MCP server process
      const transport = new StdioClientTransport({
        command: 'node',
        args: ['src/mcp/server.js'],
        cwd: process.cwd()
      });
      
      // Create MCP client
      this.client = new Client(
        {
          name: 'agent-orchestrator',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );
      
      await this.client.connect(transport);
      this.isInitialized = true;
      
      logger.info('Agent Orchestrator initialized successfully');
      
    } catch (error) {
      logger.logError(error, { context: 'AGENT_ORCHESTRATOR_INIT' });
      throw error;
    }
  }

  async callTool(toolName, args) {
    await this.ensureInitialized();
    
    try {
      return await this.client.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });
    } catch (error) {
      logger.logError(error, { toolName, args: Object.keys(args) });
      throw error;
    }
  }


  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
  
  async executeContextAnalysisWorkflow(input, options = {}) {
    const { selfieBuffer, description, userEmail, userToken } = input;
    const sessionId = `context-${Date.now()}`;
    this.currentSession = sessionId;
    
    logger.info('Starting context analysis workflow (direct services)', { sessionId, hasDescription: !!description });
    
    const workflow = [];
    let stepNumber = 0;

    try {
      
      logger.info('Created session for context analysis', { sessionId });
      
      // Step 2: Analyze selfie emotions
      stepNumber++;
      logger.info('Analyzing selfie emotions', { stepNumber });
      
      const EmotionService = (await import('./EmotionService.js')).default;
      const emotionData = await EmotionService.analyzeEmotion(selfieBuffer, 'aws');
      
      workflow.push({
        step: stepNumber,
        action: 'emotion_analysis',
        result: emotionData
      });
      
      stepNumber++;
      logger.info('Fetching Teams calendar', { stepNumber, hasUserToken: !!userToken, hasUserEmail: !!userEmail });
      
      const TeamsService = (await import('./TeamsService.js')).default;
      let calendarEvents = [];
      
      try {
        if (userEmail) {
          const cached = await TeamsService.getCachedMeetings(userEmail);
          if (cached && cached.length > 0) {
            calendarEvents = cached;
            logger.info('Fetched calendar from cache', { userEmail, eventCount: calendarEvents.length });
          }
        }
        
      } catch (calendarError) {
        logger.warn('Could not fetch calendar events', { error: calendarError.message });
        calendarEvents = [];
      }

      workflow.push({
        step: stepNumber,
        action: 'calendar_fetch',
        result: {
          eventCount: calendarEvents.length,
          events: calendarEvents
        }
      });
      
      // Step 4: Analyze context with AI
      stepNumber++;
      logger.info('Analyzing combined context with AI', { stepNumber });
      
      const OpenAIService = (await import('./OpenAIService.js')).default;
      
      // Use the new generateContextTags method from OpenAIService
      const analysisResult = await OpenAIService.generateContextTags({
        emotionData,
        calendarEvents,
        description
      });
      
      workflow.push({
        step: stepNumber,
        action: 'ai_context_analysis',
        result: analysisResult
      });
      
      // Step 5: Search YouTube Shorts for each tag and store with embeddings
      stepNumber++;
      logger.info('Searching YouTube Shorts for extracted tags', { stepNumber, tagCount: analysisResult.tags?.length || 0 });
      
      const YouTubeService = (await import('./YouTubeService.js')).default;
      const OpenAIServiceEmbed = (await import('./OpenAIService.js')).default;
      const shortsResults = {};
      let totalVideosStored = 0;

      if (analysisResult.tags && analysisResult.tags.length > 0) {
        for (const tag of analysisResult.tags) {
          try {
            const shorts = await YouTubeService.searchShorts(tag, 10);
            shortsResults[tag] = shorts;
            
            for (const short of shorts) {
              try {
                let comments = [];
                try {
                  comments = await YouTubeService.getVideoComments(short.videoId, 3);
                } catch (commentError) {
                  logger.info('Could not fetch comments', { videoId: short.videoId });
                }
                
                // Generate embedding with comments using the new method
                let embedding = null;
                try {
                  embedding = await OpenAIServiceEmbed.generateVideoEmbedding(short, comments);
                } catch (embedError) {
                  logger.warn('Failed to generate embedding for video', { 
                    videoId: short.videoId, 
                    error: embedError.message 
                  });
                }
                
                await YouTubeVideoModel.upsert({
                  videoId: short.videoId,
                  title: short.title,
                  description: short.description,
                  channelTitle: short.channelTitle,
                  url: short.url,
                  searchTag: tag,
                  sessionId: sessionId,
                  embedding: embedding,
                  comments: comments
                });
                
                totalVideosStored++;
                
              } catch (storeError) {
                logger.warn('Failed to store video', { 
                  videoId: short.videoId, 
                  error: storeError.message 
                });
              }
            }
            
          } catch (error) {
            logger.warn('Failed to search shorts for tag', { tag, error: error.message });
          }
        }
      }
      
      logger.info('Videos stored with embeddings', { 
        totalVideosStored, 
        sessionId 
      });
      
      workflow.push({
        step: stepNumber,
        action: 'youtube_shorts_search_and_store',
        result: {
          tagsSearched: analysisResult.tags?.length || 0,
          shortsFound: Object.values(shortsResults).reduce((sum, shorts) => sum + shorts.length, 0),
          videosStoredInDB: totalVideosStored,
          shortsByTag: shortsResults
        }
      });
      
      // Step 6: Filter videos using similarity matching if we have a context description
      let filteredVideos = [];
      if (analysisResult.contextDescription && totalVideosStored > 0) {
        stepNumber++;
        logger.info('Filtering videos using similarity matching', { stepNumber });
        
        try {
          const YouTubeVideoModel = (await import('../models/YouTubeVideo.js')).default;
          
          // Generate embedding for the context description
          const contextEmbedding = await OpenAIServiceEmbed.generateEmbedding(analysisResult.contextDescription);
          
          // Find similar videos using the context embedding
          filteredVideos = await YouTubeVideoModel.findSimilar(contextEmbedding, 10, 0.1);
          
          logger.info('Found similar videos', { 
            totalFiltered: filteredVideos.length,
            contextLength: analysisResult.contextDescription.length 
          });
          
          workflow.push({
            step: stepNumber,
            action: 'similarity_filtering',
            result: {
              contextDescription: analysisResult.contextDescription,
              totalVideosConsidered: totalVideosStored,
              filteredVideoCount: filteredVideos.length,
              similarityThreshold: 0.1
            }
          });
          
        } catch (filterError) {
          logger.warn('Failed to filter videos by similarity', { 
            error: filterError.message 
          });
        }
      }
      
      // Step 7: Log and finalize
      stepNumber++;
      logger.info('Context analysis workflow completed successfully', {
        calendarEventCount: calendarEvents.length,
        tagsGenerated: analysisResult.tags?.length || 0,
        totalShortsFound: Object.values(shortsResults).reduce((sum, shorts) => sum + shorts.length, 0),
        filteredVideosCount: filteredVideos.length,
        workflowSteps: workflow.length
      });
      
      workflow.push({
        step: stepNumber,
        action: 'workflow_completed',
        result: 'Success'
      });
      
      return {
        success: true,
        sessionId: this.currentSession,
        workflow,
        analysis: {
          emotions: emotionData,
          calendar: {
            eventCount: calendarEvents.length,
            events: calendarEvents
          },
          tags: analysisResult.tags || [],
          contextDescription: analysisResult.contextDescription || '',
          youtubeShorts: shortsResults,
          filteredVideos: filteredVideos,
          totalVideosStored: totalVideosStored
        }
      };
      
    } catch (error) {
      logger.logError(error, { 
        context: 'CONTEXT_ANALYSIS_WORKFLOW',
        sessionId: this.currentSession,
        step: stepNumber
      });
      
      
      throw error;
    }
  }
}

export default new AgentOrchestrator();