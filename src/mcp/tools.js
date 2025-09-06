import OpenAIService from '../services/OpenAIService.js';
import CurationService from '../services/CurationService.js';
import TeamsService from '../services/TeamsService.js';
import EmotionService from '../services/EmotionService.js';
import AgentSessionModel from '../models/AgentSession.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

class MCPTools {
  constructor() {
    this.tools = {
      ingest_document: this.ingestDocument.bind(this),
      vector_search: this.vectorSearch.bind(this),
      analyze_documents: this.analyzeDocuments.bind(this),
      log_action: this.logAction.bind(this),
      create_session: this.createSession.bind(this),
      update_session: this.updateSession.bind(this),
      get_session_status: this.getSessionStatus.bind(this),
      extract_insights: this.extractInsights.bind(this),
      search_web: this.searchWeb.bind(this),
      youtube_transcript: this.youtubeTranscript.bind(this),
      // YouTube Curation MCP Tools
      analyze_user_context: this.analyzeUserContext.bind(this),
      generate_content_preferences: this.generateContentPreferences.bind(this),
      search_youtube_shorts: this.searchYouTubeShorts.bind(this),
      store_video_embeddings: this.storeVideoEmbeddings.bind(this),
      find_similar_videos: this.findSimilarVideos.bind(this),
      curate_feed: this.curateFeed.bind(this),
      store_curation_history: this.storeCurationHistory.bind(this)
    };
  }
  
  getToolDefinitions() {
    return [
      {
        name: 'ingest_document',
        description: 'Process and ingest a document with vector embeddings into TiDB',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Document title' },
            content: { type: 'string', description: 'Document content' },
            sourceType: { 
              type: 'string', 
              enum: ['upload', 'web', 'youtube', 'notion'],
              default: 'upload',
              description: 'Source type of the document'
            },
            sourceUrl: { type: 'string', description: 'Original source URL (optional)' },
            metadata: { 
              type: 'object', 
              description: 'Additional metadata (optional)' 
            }
          },
          required: ['title', 'content']
        }
      },
      {
        name: 'vector_search',
        description: 'Search documents using vector similarity with TiDB',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            searchType: {
              type: 'string',
              enum: ['vector', 'fulltext', 'hybrid'],
              default: 'vector',
              description: 'Type of search to perform'
            },
            limit: { 
              type: 'number', 
              default: 5, 
              description: 'Maximum number of results' 
            },
            similarityThreshold: { 
              type: 'number', 
              default: 0.7, 
              description: 'Minimum similarity threshold (0-1)' 
            },
            includeContent: {
              type: 'boolean',
              default: true,
              description: 'Include full content in results'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'analyze_documents',
        description: 'Use LLM to analyze and summarize document search results',
        inputSchema: {
          type: 'object',
          properties: {
            documents: { 
              type: 'array', 
              description: 'Array of documents to analyze' 
            },
            query: { 
              type: 'string', 
              description: 'Analysis context/question' 
            },
            analysisType: {
              type: 'string',
              enum: ['general', 'technical', 'research', 'educational', 'creative'],
              default: 'general',
              description: 'Type of analysis to perform'
            }
          },
          required: ['documents', 'query']
        }
      },
      {
        name: 'log_action',
        description: 'Log agent actions for audit trail and workflow tracking',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Agent session ID' },
            stepNumber: { type: 'number', description: 'Step number in workflow' },
            actionType: { type: 'string', description: 'Type of action performed' },
            toolName: { type: 'string', description: 'Name of tool used' },
            inputData: { type: 'object', description: 'Input data for the action' },
            outputData: { type: 'object', description: 'Output data from the action' },
            executionTimeMs: { type: 'number', description: 'Execution time in milliseconds' },
            status: { 
              type: 'string', 
              enum: ['success', 'error'], 
              default: 'success',
              description: 'Action status' 
            },
            errorMessage: { type: 'string', description: 'Error message if failed' }
          },
          required: ['sessionId', 'actionType']
        }
      },
      {
        name: 'create_session',
        description: 'Create a new agent session for workflow tracking',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Session name' },
            workflowType: {
              type: 'string',
              enum: ['document_analysis', 'content_research', 'knowledge_synthesis'],
              default: 'document_analysis',
              description: 'Type of workflow'
            },
            userContext: { 
              type: 'object', 
              description: 'User context and preferences' 
            }
          },
          required: ['name']
        }
      },
      {
        name: 'update_session',
        description: 'Update session progress and status',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
            totalSteps: { type: 'number', description: 'Total workflow steps' },
            completedSteps: { type: 'number', description: 'Completed steps' },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'failed'],
              description: 'Session status'
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'get_session_status',
        description: 'Get current session status and progress',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'extract_insights',
        description: 'Extract key insights and patterns from documents using AI',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Content to analyze' },
            insightType: {
              type: 'string',
              enum: ['summary', 'patterns', 'recommendations', 'key_points'],
              default: 'summary',
              description: 'Type of insights to extract'
            }
          },
          required: ['content']
        }
      },
      {
        name: 'search_web',
        description: 'Search web content using Google Search API (external tool integration)',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            numResults: { 
              type: 'number', 
              default: 10, 
              description: 'Number of results to return' 
            },
            dateRange: {
              type: 'string',
              enum: ['day', 'week', 'month', 'year', 'all'],
              default: 'all',
              description: 'Date range for results'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'youtube_transcript',
        description: 'Extract transcript from YouTube video (external API integration)',
        inputSchema: {
          type: 'object',
          properties: {
            videoUrl: { type: 'string', description: 'YouTube video URL' },
            language: { 
              type: 'string', 
              default: 'en',
              description: 'Preferred transcript language' 
            }
          },
          required: ['videoUrl']
        }
      },
      // YouTube Curation MCP Tool Definitions
      {
        name: 'analyze_user_context',
        description: 'Analyze user context from Teams calendar, selfie emotions, and text description',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User identifier' },
            userToken: { type: 'string', description: 'Teams authentication token' },
            emotionData: { type: 'object', description: 'Emotion analysis results' },
            description: { type: 'string', description: 'Short text description provided by user' }
          },
          required: ['userId', 'userToken', 'emotionData', 'description']
        }
      },
      {
        name: 'generate_content_preferences',
        description: 'Generate content preferences based on user context using AI reasoning',
        inputSchema: {
          type: 'object',
          properties: {
            contextData: { type: 'object', description: 'User context data' }
          },
          required: ['contextData']
        }
      },
      {
        name: 'search_youtube_shorts',
        description: 'Search for YouTube Shorts based on content preferences',
        inputSchema: {
          type: 'object',
          properties: {
            preferences: { type: 'object', description: 'Content preferences object' },
            maxResults: { type: 'number', default: 20, description: 'Maximum videos to return' }
          },
          required: ['preferences']
        }
      },
      {
        name: 'store_video_embeddings',
        description: 'Store video content embeddings in TiDB vector database',
        inputSchema: {
          type: 'object',
          properties: {
            videos: { type: 'array', description: 'Array of video objects to embed' }
          },
          required: ['videos']
        }
      },
      {
        name: 'find_similar_videos',
        description: 'Find similar videos using vector cosine similarity search in TiDB',
        inputSchema: {
          type: 'object',
          properties: {
            contextEmbedding: { type: 'array', description: 'Context embedding vector' },
            limit: { type: 'number', default: 10, description: 'Number of similar videos to return' }
          },
          required: ['contextEmbedding']
        }
      },
      {
        name: 'curate_feed',
        description: 'Apply AI-powered contextual filters to curate final video recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            videos: { type: 'array', description: 'Videos to filter' },
            contextData: { type: 'object', description: 'User context for filtering' }
          },
          required: ['videos', 'contextData']
        }
      },
      {
        name: 'store_curation_history',
        description: 'Store curation history for learning and improvement',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User identifier' },
            contextEmbedding: { type: 'array', description: 'Context embedding' },
            recommendations: { type: 'array', description: 'Final recommendations' }
          },
          required: ['userId', 'contextEmbedding', 'recommendations']
        }
      }
    ];
  }
  
  async executeTool(toolName, args) {
    const startTime = Date.now();
    
    if (!this.tools[toolName]) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    try {
      logger.info(`Executing MCP tool: ${toolName}`, { args: Object.keys(args) });
      
      const result = await this.tools[toolName](args);
      const executionTime = Date.now() - startTime;
      
      logger.info(`Tool execution completed: ${toolName}`, { executionTime });
      
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }
        ],
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.logError(error, { toolName, executionTime });
      
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }
  
  async ingestDocument(args) {
    const { title, content, sourceType = 'upload', sourceUrl, metadata = {} } = args;
    
    const document = await DocumentService.processDocument(
      null, // No file path for MCP calls
      title,
      sourceType,
      sourceUrl,
      metadata
    );
    
    return {
      success: true,
      documentId: document.id,
      title: document.title,
      status: document.status,
      message: 'Document ingested successfully'
    };
  }
  
  async vectorSearch(args) {
    const { 
      query, 
      searchType = 'vector', 
      limit = 5, 
      similarityThreshold = 0.7,
      includeContent = true 
    } = args;
    
    const results = await DocumentService.searchDocuments(query, searchType, {
      limit,
      similarityThreshold,
      includeContent
    });
    
    return results;
  }
  
  async analyzeDocuments(args) {
    const { documents, query, analysisType = 'general' } = args;
    
    const analysis = await DocumentService.analyzeDocuments(
      documents,
      query,
      analysisType
    );
    
    return analysis;
  }
  
  async logAction(args) {
    const { 
      sessionId, 
      stepNumber, 
      actionType, 
      toolName, 
      inputData = {},
      outputData = {},
      executionTimeMs,
      status = 'success',
      errorMessage 
    } = args;
    
    const actionId = await AgentSessionModel.logAction(
      sessionId,
      stepNumber,
      actionType,
      toolName,
      inputData,
      outputData,
      executionTimeMs,
      status,
      errorMessage
    );
    
    return {
      success: true,
      actionId,
      message: 'Action logged successfully'
    };
  }
  
  async createSession(args) {
    const { name, workflowType = 'document_analysis', userContext = {} } = args;
    
    const sessionId = await AgentSessionModel.create({
      name,
      workflowType,
      userContext
    });
    
    return {
      success: true,
      sessionId,
      name,
      workflowType,
      status: 'active',
      message: 'Session created successfully'
    };
  }
  
  async updateSession(args) {
    const { sessionId, totalSteps, completedSteps, status } = args;
    
    if (totalSteps !== undefined) {
      await AgentSessionModel.updateProgress(sessionId, totalSteps, completedSteps);
    }
    
    if (status) {
      await AgentSessionModel.updateStatus(sessionId, status);
    }
    
    return {
      success: true,
      sessionId,
      message: 'Session updated successfully'
    };
  }
  
  async getSessionStatus(args) {
    const { sessionId } = args;
    
    const session = await AgentSessionModel.getSessionSummary(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    return session;
  }
  
  async extractInsights(args) {
    const { content, insightType = 'summary' } = args;
    
    let analysisType = 'general';
    switch (insightType) {
      case 'patterns':
        analysisType = 'research';
        break;
      case 'recommendations':
        analysisType = 'technical';
        break;
      case 'key_points':
        analysisType = 'educational';
        break;
    }
    
    const insights = await OpenAIService.analyzeContent(content, analysisType);
    
    return {
      insightType,
      content: insights.content,
      extractedAt: new Date().toISOString(),
      usage: insights.usage
    };
  }
  
  async searchWeb(args) {
    const { query, numResults = 10, dateRange = 'all' } = args;
    
    // Placeholder for Google Search API integration
    // This would use the Google Custom Search API with your credentials
    
    logger.info('Web search requested', { query, numResults, dateRange });
    
    return {
      query,
      results: [
        {
          title: 'Sample Web Result',
          url: 'https://example.com',
          snippet: 'This is a placeholder for web search results. Integration with Google Search API would happen here.',
          displayUrl: 'example.com'
        }
      ],
      totalResults: 1,
      searchTime: Date.now(),
      message: 'Web search integration not yet implemented'
    };
  }
  
  async youtubeTranscript(args) {
    const { videoUrl, language = 'en' } = args;
    
    // Placeholder for YouTube transcript extraction
    // This would use the YouTube Data API with your credentials
    
    logger.info('YouTube transcript requested', { videoUrl, language });
    
    return {
      videoUrl,
      transcript: 'This is a placeholder for YouTube transcript. Integration with YouTube Data API would happen here.',
      language,
      extractedAt: new Date().toISOString(),
      message: 'YouTube transcript integration not yet implemented'
    };
  }


  async generateContentPreferences(args) {
    const { contextData } = args;
    
    logger.info('MCP: Generating content preferences');
    
    try {
      const preferences = await CurationService.getContentPreferences(contextData);
      
      // Add AI reasoning through OpenAI
      const reasoning = await OpenAIService.generateCompletion([{
        role: 'user',
        content: `Context: User is feeling ${contextData.emotions.dominant} with ${contextData.energyLevel} energy and ${contextData.meetings.stressLevel} stress level.
        
Explain why these content preferences were chosen: ${JSON.stringify(preferences)}
Provide psychological reasoning for this curation strategy.`
      }], {
        model: 'gpt-4o-mini',
        max_tokens: 200
      });

      return {
        success: true,
        preferences,
        reasoning,
        contextSummary: {
          emotion: contextData.emotions.dominant,
          energy: contextData.energyLevel,
          stress: contextData.meetings.stressLevel
        }
      };
    } catch (error) {
      logger.error('MCP: Preference generation failed', error);
      throw error;
    }
  }

  async searchYouTubeShorts(args) {
    const { preferences, maxResults = 20 } = args;
    
    logger.info('MCP: Using pre-ingested YouTube videos from TiDB', { preferences: preferences.categories });
    
    try {
      // Get all ingested videos from TiDB instead of searching YouTube API
      const query = `
        SELECT 
          video_id as videoId,
          title,
          description,
          tags,
          duration,
          metadata
        FROM video_embeddings
        WHERE duration <= 300 AND duration > 0
        ORDER BY created_at DESC
        LIMIT ?
      `;
      
      const results = await CurationService.conn.execute(query, [Math.min(maxResults * 2, 100)]);
      const rows = results.rows || results;
      
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        logger.warn('No ingested videos found in TiDB - may need to run ingestion first');
        return {
          success: true,
          videosFound: 0,
          videos: [],
          message: 'No pre-ingested videos available. Run /api/ingest/youtube first.'
        };
      }
      
      // Convert TiDB rows to video format and filter by preferences
      const availableVideos = rows.map(row => {
        // Handle metadata - could be object or JSON string
        let metadata = {};
        try {
          metadata = typeof row.metadata === 'string' 
            ? JSON.parse(row.metadata || '{}') 
            : (row.metadata || {});
        } catch (e) {
          logger.warn('Invalid metadata JSON, using empty object', { videoId: row.videoId });
          metadata = {};
        }
        
        // Handle tags - could be array or JSON string  
        let tags = [];
        try {
          tags = typeof row.tags === 'string'
            ? JSON.parse(row.tags || '[]')
            : (row.tags || []);
        } catch (e) {
          logger.warn('Invalid tags JSON, using empty array', { videoId: row.videoId, tags: row.tags });
          tags = [];
        }
        
        return {
          videoId: row.videoId,
          title: row.title,
          description: row.description || '',
          tags: tags,
          duration: `PT${Math.floor(row.duration / 60)}M${row.duration % 60}S`,
          ...metadata
        };
      });
      
      // Filter videos based on preferences (simple keyword matching)
      const relevantVideos = availableVideos.filter(video => {
        const videoText = `${video.title} ${video.description} ${video.tags.join(' ')}`.toLowerCase();
        
        // Check if any preference keywords or categories match
        const keywordMatch = preferences.keywords.some(keyword => 
          videoText.includes(keyword.toLowerCase())
        );
        const categoryMatch = preferences.categories.some(category => 
          videoText.includes(category.toLowerCase())
        );
        
        // Avoid unwanted content
        const hasAvoidContent = preferences.avoid && preferences.avoid.some(avoid => 
          videoText.includes(avoid.toLowerCase())
        );
        
        return (keywordMatch || categoryMatch) && !hasAvoidContent;
      });
      
      // If no matches, return a sample of available videos
      const finalVideos = relevantVideos.length > 0 
        ? relevantVideos.slice(0, maxResults)
        : availableVideos.slice(0, maxResults);

      logger.info('Retrieved ingested videos', { 
        total: rows.length, 
        relevant: relevantVideos.length, 
        final: finalVideos.length 
      });

      return {
        success: true,
        videosFound: finalVideos.length,
        videos: finalVideos,
        source: 'tidb_ingested',
        totalAvailable: rows.length,
        relevantMatches: relevantVideos.length
      };
    } catch (error) {
      logger.error('MCP: YouTube search failed', error);
      throw error;
    }
  }

  async storeVideoEmbeddings(args) {
    const { videos } = args;
    
    logger.info('MCP: Storing video embeddings', { count: videos.length });
    
    try {
      await CurationService.storeVideoEmbeddings(videos);
      
      return {
        success: true,
        videosProcessed: videos.length,
        message: 'Video embeddings stored in TiDB vector database'
      };
    } catch (error) {
      logger.error('MCP: Video embedding storage failed', error);
      throw error;
    }
  }

  async findSimilarVideos(args) {
    const { contextEmbedding, limit = 10 } = args;
    
    logger.info('MCP: Finding similar videos using vector search');
    
    try {
      const similarVideos = await CurationService.findSimilarVideos(contextEmbedding, limit);
      
      return {
        success: true,
        similarVideosFound: similarVideos.length,
        videos: similarVideos,
        searchType: 'vector_cosine_similarity',
        embeddingDimension: contextEmbedding.length
      };
    } catch (error) {
      logger.error('MCP: Vector similarity search failed', error);
      throw error;
    }
  }

  async curateFeed(args) {
    const { videos, contextData } = args;
    
    logger.info('MCP: Curating final feed', { videosToFilter: videos.length });
    
    try {
      const curatedVideos = CurationService.applyContextFilters(videos, contextData);
      
      // Add AI reasoning for curation decisions
      const curationReasoning = await OpenAIService.generateCompletion([{
        role: 'user',
        content: `User context: Emotion=${contextData.emotions.dominant}, Energy=${contextData.energyLevel}, Stress=${contextData.meetings.stressLevel}

Selected ${curatedVideos.length} videos from ${videos.length} candidates. Explain why this selection matches their psychological state and what benefit these videos should provide.`
      }], {
        model: 'gpt-4o-mini',
        max_tokens: 150
      });

      return {
        success: true,
        originalCount: videos.length,
        finalCount: curatedVideos.length,
        curatedVideos: curatedVideos.map(video => ({
          videoId: video.video_id,
          title: video.title,
          relevanceScore: video.distance ? (100 - video.distance * 100).toFixed(1) : 'N/A'
        })),
        aiReasoning: curationReasoning,
        curationStrategy: this.getCurationStrategy(contextData)
      };
    } catch (error) {
      logger.error('MCP: Feed curation failed', error);
      throw error;
    }
  }

  async storeCurationHistory(args) {
    const { userId, contextEmbedding, recommendations } = args;
    
    logger.info('MCP: Storing curation history for learning', { userId });
    
    try {
      await CurationService.storeCurationHistory(userId, contextEmbedding, recommendations);
      
      return {
        success: true,
        userId,
        recommendationsStored: recommendations.length,
        message: 'Curation history stored for machine learning improvement'
      };
    } catch (error) {
      logger.error('MCP: Curation history storage failed', error);
      throw error;
    }
  }

  getCurationStrategy(contextData) {
    const { emotions, energyLevel, meetings } = contextData;
    
    if (emotions.dominant === 'sad' && energyLevel === 'low') {
      return 'mood_boost_strategy';
    } else if (meetings.stressLevel === 'high') {
      return 'stress_relief_strategy';
    } else if (energyLevel === 'high' && emotions.dominant === 'happy') {
      return 'energy_matching_strategy';
    } else {
      return 'balanced_discovery_strategy';
    }
  }
}

export default new MCPTools();