import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import YouTubeVideoModel from '../models/YouTubeVideo.js';
import logger from '../utils/logger.js';

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

  async executeIngestionWorkflowWithUserInfo(input) {
    const { selfieBuffer, description, userEmail, userToken } = input;
    const sessionId = `context-${Date.now()}`;
    this.currentSession = sessionId;

    try {
      logger.info('Starting ingestion workflow', { sessionId });

      // Analyze selfie emotions
      const EmotionService = (await import('./EmotionService.js')).default;
      const emotionData = await EmotionService.analyzeEmotion(selfieBuffer, 'aws');

      // Fetch Teams calendar
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

      // Analyze context with AI
      const OpenAIService = (await import('./OpenAIService.js')).default;
      const analysisResult = await OpenAIService.generateContextTags({
        emotionData,
        calendarEvents,
        description
      });

      // Search YouTube Shorts for each tag and store with embeddings
      logger.info('Searching and storing YouTube Shorts', { tagCount: analysisResult.tags?.length || 0 });

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

      logger.info('Ingestion completed successfully', {
        totalVideosStored,
        sessionId
      });

      return {
        success: true,
        sessionId: this.currentSession,
        analysis: {
          emotions: emotionData,
          calendar: {
            eventCount: calendarEvents.length,
            events: calendarEvents
          },
          tags: analysisResult.tags || [],
          contextDescription: analysisResult.contextDescription || '',
          youtubeShorts: shortsResults,
          totalVideosStored: totalVideosStored
        }
      };

    } catch (error) {
      logger.logError(error, {
        context: 'INGESTION_WORKFLOW',
        sessionId: this.currentSession
      });

      throw error;
    }
  }


  async executeFilteringWorkflow(input) {
    const { selfieBuffer, description, userEmail, userToken } = input;
    const sessionId = `filter-${Date.now()}`;
    
    try {
      logger.info('Starting filtering workflow', { sessionId });

      const EmotionService = (await import('./EmotionService.js')).default;
      const emotionData = await EmotionService.analyzeEmotion(selfieBuffer, 'aws');

      const TeamsService = (await import('./TeamsService.js')).default;
      let calendarEvents = [];
      
      if (userEmail) {
        try {
          calendarEvents = await TeamsService.getCachedMeetings(userEmail) || [];
        } catch (error) {
          logger.warn('Could not fetch calendar events', { error: error.message });
        }
      }

      const OpenAIService = (await import('./OpenAIService.js')).default;

      const analysisResult = await OpenAIService.generateContextTags({
        emotionData,
        calendarEvents,
        description
      });



      // Step 4: Generate embedding and search
      const contextEmbedding = await OpenAIService.generateEmbedding(analysisResult.contextDescription);

      const YouTubeVideoModel = (await import('../models/YouTubeVideo.js')).default;
      const filteredVideos = await YouTubeVideoModel.findSimilar(contextEmbedding, 20, 0.1);

      // Mark filtered videos as watched before returning
      if (filteredVideos.length > 0) {
        try {
          const videoIds = filteredVideos.map(v => v.video_id).filter(Boolean);
          if (videoIds.length > 0) {
            await YouTubeVideoModel.markAsWatched(videoIds);
            logger.info('Marked filtered videos as watched', { count: videoIds.length });
          }
        } catch (watchError) {
          logger.warn('Failed to mark videos as watched', { 
            error: watchError.message,
            videoCount: filteredVideos.length 
          });
        }
      }

      logger.info('Filtering completed', {
        contextLength: analysisResult.contextDescription?.length || 0,
        videosFound: filteredVideos.length
      });

      return {
        success: true,
        sessionId,
        data: {
          filteredVideos,
          totalVideos: filteredVideos.length
        }
      };

    } catch (error) {
      logger.logError(error, { context: 'FILTERING_WORKFLOW', sessionId });
      throw error;
    }
  }

  async executeLikedVideosIngestion(input) {
    const { likedVideoIds } = input;
    const sessionId = `liked-ingest-${Date.now()}`;
    this.currentSession = sessionId;

    try {
      logger.info('Starting liked videos ingestion workflow', { 
        sessionId,
        likedCount: likedVideoIds.length 
      });

      const YouTubeService = (await import('./YouTubeService.js')).default;
      const OpenAIServiceEmbed = (await import('./OpenAIService.js')).default;
      const recommendedVideos = {};
      let totalVideosStored = 0;

      // Get recommended videos for each liked video
      for (const videoId of likedVideoIds) {
        try {
          logger.info('Getting recommendations for video', { videoId });
          const videos = await YouTubeService.getRecommendedVideos(videoId, 10);
          recommendedVideos[videoId] = videos;

          for (const video of videos) {
            try {
              let comments = [];
              try {
                comments = await YouTubeService.getVideoComments(video.videoId, 5);
              } catch (commentError) {
                logger.info('Could not fetch comments', { videoId: video.videoId });
              }

              let embedding = null;
              try {
                embedding = await OpenAIServiceEmbed.generateVideoEmbedding(video, comments);
              } catch (embedError) {
                logger.warn('Failed to generate embedding for video', {
                  videoId: video.videoId,
                  error: embedError.message
                });
              }

              await YouTubeVideoModel.upsert({
                videoId: video.videoId,
                title: video.title,
                description: video.description,
                channelTitle: video.channelTitle,
                url: video.url,
                searchTag: `recommended_from_${videoId}`,
                sessionId: sessionId,
                embedding: embedding,
                comments: comments
              });

              totalVideosStored++;

            } catch (storeError) {
              logger.warn('Failed to store video', {
                videoId: video.videoId,
                error: storeError.message
              });
            }
          }

        } catch (error) {
          logger.warn('Failed to get recommendations for video', { 
            videoId, 
            error: error.message 
          });
        }
      }

      logger.info('Liked videos ingestion completed successfully', {
        totalVideosStored,
        sessionId,
        basedOnVideos: likedVideoIds.length
      });

      return {
        success: true,
        sessionId: this.currentSession,
        data: {
          recommendedVideos: recommendedVideos,
          totalVideosStored: totalVideosStored,
          videosAnalyzed: Object.values(recommendedVideos).flat().length,
          basedOnLikedVideos: likedVideoIds.length
        }
      };

    } catch (error) {
      logger.logError(error, {
        context: 'LIKED_VIDEOS_INGESTION_WORKFLOW',
        sessionId: this.currentSession
      });

      throw error;
    }
  }

}

export default new AgentOrchestrator();