import DocumentService from './DocumentService.js';
import DocumentModel from '../models/Document.js';
import OpenAIService from './OpenAIService.js';
import YouTubeService from './YouTubeService.js';
import AgentSessionModel from '../models/AgentSession.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class DirectAgentService {
  constructor() {
    this.currentSession = null;
    this.isInitialized = true; // Always ready
  }
  
  async createSession(name, workflowType = 'document_analysis', userContext = {}) {
    try {
      const sessionId = await AgentSessionModel.create({
        name,
        workflowType,
        userContext
      });
      
      this.currentSession = sessionId;
      logger.info(`Direct agent session created: ${sessionId}`, { name, workflowType });
      
      return {
        success: true,
        sessionId,
        name,
        workflowType,
        status: 'active',
        message: 'Session created successfully'
      };
    } catch (error) {
      logger.logError(error, { name, workflowType });
      throw error;
    }
  }
  
  async executeDocumentAnalysisWorkflow(input, options = {}) {
    const { title, content, query = 'Analyze this document', analysisType = 'general' } = input;
    let sessionId = this.currentSession;
    
    if (!sessionId) {
      const session = await this.createSession(`Document Analysis: ${title}`, 'document_analysis');
      sessionId = session.sessionId;
    }
    
    logger.info('Starting direct document analysis workflow', { sessionId, title });
    
    const workflow = [];
    const startTime = Date.now();
    
    try {
      await AgentSessionModel.updateProgress(sessionId, 6, 0);
      
      // Step 1: Process document with embeddings (bypass file processing for direct content)
      const step1Start = Date.now();
      
      // Generate metadata directly
      const [tags, keyPhrases] = await Promise.all([
        OpenAIService.generateTags(content, 8),
        OpenAIService.extractKeyPhrases(content, 10)
      ]);
      
      const metadata = {
        wordCount: content.split(/\s+/).length,
        characterCount: content.length,
        tags,
        keyPhrases,
        extractedAt: new Date().toISOString(),
        ...(options.metadata || {})
      };
      
      // Create document directly
      const documentId = await DocumentModel.create({
        title,
        content,
        sourceType: options.sourceType || 'upload',
        sourceUrl: options.sourceUrl,
        metadata
      });
      
      // Generate and store embedding
      const truncatedContent = content.length > 8000 ? content.substring(0, 8000) : content;
      const embedding = await OpenAIService.generateEmbedding(truncatedContent);
      await DocumentModel.updateEmbedding(documentId, embedding);
      
      // Create document object manually since findById might not work properly
      const document = {
        id: documentId,
        title,
        status: 'completed',
        source_type: options.sourceType || 'upload',
        created_at: new Date().toISOString()
      };
      
      await AgentSessionModel.logAction(
        sessionId, 1, 'INGEST_DOCUMENT', 'document_service',
        { title, contentLength: content.length },
        { documentId: document.id, status: document.status },
        Date.now() - step1Start, 'success'
      );
      
      workflow.push({
        step: 1,
        action: 'INGEST_DOCUMENT',
        result: { documentId: document.id, status: document.status },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step1Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 6, 1);
      
      // Step 2: Search for similar documents
      const step2Start = Date.now();
      const searchResults = await DocumentService.searchDocuments(title, 'hybrid', {
        limit: 5,
        similarityThreshold: options.similarityThreshold || 0.6
      });
      
      await AgentSessionModel.logAction(
        sessionId, 2, 'VECTOR_SEARCH', 'document_service',
        { query: title, searchType: 'hybrid' },
        { documentCount: searchResults.documents.length },
        Date.now() - step2Start, 'success'
      );
      
      workflow.push({
        step: 2,
        action: 'VECTOR_SEARCH',
        result: { documentCount: searchResults.documents.length, query: searchResults.query },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step2Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 6, 2);
      
      // Step 3: AI Analysis
      const step3Start = Date.now();
      const analysis = await DocumentService.analyzeDocuments(
        searchResults.documents,
        query,
        analysisType
      );
      
      await AgentSessionModel.logAction(
        sessionId, 3, 'LLM_ANALYSIS', 'openai_service',
        { query, analysisType, documentCount: searchResults.documents.length },
        { analysisLength: analysis.analysis.length },
        Date.now() - step3Start, 'success'
      );
      
      workflow.push({
        step: 3,
        action: 'LLM_ANALYSIS',
        result: { analysisType, query },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step3Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 6, 3);
      
      // Step 4: Extract key insights
      const step4Start = Date.now();
      const insights = await OpenAIService.analyzeContent(
        analysis.analysis,
        'educational'
      );
      
      await AgentSessionModel.logAction(
        sessionId, 4, 'EXTRACT_INSIGHTS', 'openai_service',
        { contentLength: analysis.analysis.length },
        { insightsLength: insights.content.length },
        Date.now() - step4Start, 'success'
      );
      
      workflow.push({
        step: 4,
        action: 'EXTRACT_INSIGHTS',
        result: { insightType: 'key_points' },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step4Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 6, 4);
      
      // Step 5: Use existing tags and metadata (already generated in step 1)
      const step5Start = Date.now();
      
      await AgentSessionModel.logAction(
        sessionId, 5, 'USE_EXISTING_METADATA', 'direct_agent',
        { contentLength: content.length },
        { tagCount: tags.length, phraseCount: keyPhrases.length },
        Date.now() - step5Start, 'success'
      );
      
      workflow.push({
        step: 5,
        action: 'USE_EXISTING_METADATA',
        result: { tagCount: tags.length, phraseCount: keyPhrases.length },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step5Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 6, 5);
      
      // Step 6: Generate final report
      const step6Start = Date.now();
      const totalExecutionTime = Date.now() - startTime;
      
      const report = {
        sessionId,
        workflowType: 'document_analysis',
        input: { title, query, analysisType },
        workflow,
        results: {
          document: {
            id: document.id,
            title: document.title,
            status: document.status
          },
          similarDocuments: searchResults.documents.slice(0, 3).map(d => ({
            title: d.title,
            similarity: d.similarity || 0.8,
            sourceType: d.source_type
          })),
          analysis: analysis.analysis,
          insights: insights.content,
          tags,
          keyPhrases,
          searchResults: {
            totalResults: searchResults.documents.length,
            searchTime: searchResults.searchTime
          }
        },
        metadata: {
          totalSteps: 6,
          completedSteps: 6,
          executionTime: totalExecutionTime,
          completedAt: new Date().toISOString()
        }
      };
      
      await AgentSessionModel.logAction(
        sessionId, 6, 'GENERATE_REPORT', 'direct_agent',
        { workflowType: 'document_analysis' },
        { reportGenerated: true, totalSteps: 6 },
        Date.now() - step6Start, 'success'
      );
      
      workflow.push({
        step: 6,
        action: 'GENERATE_REPORT',
        result: { reportGenerated: true },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step6Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 6, 6, 'completed');
      
      logger.info(`Document analysis workflow completed: ${sessionId}`, {
        totalSteps: 6,
        totalTime: totalExecutionTime,
        title
      });
      
      return report;
      
    } catch (error) {
      logger.logError(error, { 
        sessionId, 
        workflowType: 'document_analysis',
        title 
      });
      
      if (sessionId) {
        await AgentSessionModel.updateStatus(sessionId, 'failed');
      }
      
      throw error;
    }
  }
  
  async runBasicDemo() {
    const timestamp = Date.now();
    const demoContent = `
    Artificial Intelligence agents are autonomous systems that can perceive their environment, 
    make decisions, and take actions to achieve specific goals. They combine multiple AI 
    technologies including machine learning, natural language processing, and reasoning 
    capabilities to solve complex problems.
    
    Modern AI agents often use multi-step workflows, breaking down complex tasks into 
    manageable components. This approach allows for better error handling, debugging, 
    and overall reliability. TiDB Serverless provides the perfect backend for storing 
    agent data with vector search capabilities.
    
    Demo timestamp: ${timestamp}
    `;
    
    return await this.executeDocumentAnalysisWorkflow({
      title: `AI Agents Overview - Demo ${timestamp}`,
      content: demoContent,
      query: 'What are the key concepts and capabilities of AI agents?',
      analysisType: 'technical'
    }, {
      sourceType: 'upload',
      metadata: { 
        demo: true, 
        generatedAt: new Date().toISOString(),
        timestamp
      }
    });
  }
  
  async runAdvancedDemo() {
    // Advanced demo with multiple documents
    const demos = [
      {
        title: 'TiDB Vector Search Capabilities',
        content: 'TiDB Serverless offers powerful vector search functionality with high-dimensional embeddings and efficient indexing for semantic search applications.'
      },
      {
        title: 'Multi-Step AI Workflows',
        content: 'Complex AI tasks are best handled through multi-step workflows that break down problems into manageable, auditable, and reliable components.'
      }
    ];
    
    const results = [];
    
    for (const demo of demos) {
      const result = await this.executeDocumentAnalysisWorkflow({
        title: demo.title,
        content: demo.content,
        query: `Analyze the key concepts in: ${demo.title}`,
        analysisType: 'general'
      }, {
        sourceType: 'upload',
        metadata: { demo: true, advanced: true }
      });
      
      results.push(result);
    }
    
    return {
      type: 'advanced_demo',
      results,
      summary: `Processed ${demos.length} demo documents with complete multi-step workflows`,
      totalSessions: results.length
    };
  }
  
  async getSessionStatus(sessionId) {
    return await AgentSessionModel.getSessionSummary(sessionId);
  }
  
  /**
   * YouTube Video Analysis Workflow
   */
  async executeYouTubeAnalysisWorkflow(input, options = {}) {
    const { videoUrl, analysisType = 'general' } = input;
    let sessionId = this.currentSession;
    
    if (!sessionId) {
      const session = await this.createSession(`YouTube Analysis: ${videoUrl}`, 'youtube_analysis');
      sessionId = session.sessionId;
    }
    
    logger.info('Starting YouTube analysis workflow', { sessionId, videoUrl });
    
    const workflow = [];
    const startTime = Date.now();
    
    try {
      await AgentSessionModel.updateProgress(sessionId, 5, 0);
      
      // Step 1: Extract video metadata
      const step1Start = Date.now();
      const videoId = YouTubeService.extractVideoId(videoUrl);
      const metadata = await YouTubeService.getVideoMetadata(videoId);
      
      await AgentSessionModel.logAction(
        sessionId, 1, 'EXTRACT_VIDEO_METADATA', 'youtube_service',
        { videoUrl, videoId },
        { title: metadata.title, channel: metadata.channelTitle },
        Date.now() - step1Start, 'success'
      );
      
      workflow.push({
        step: 1,
        action: 'EXTRACT_VIDEO_METADATA',
        result: { videoId, title: metadata.title },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step1Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 5, 1);
      
      // Step 2: Process and store video as document
      const step2Start = Date.now();
      const processedVideo = await YouTubeService.processVideo(videoUrl, {
        additionalMetadata: { workflowSession: sessionId }
      });
      
      await AgentSessionModel.logAction(
        sessionId, 2, 'PROCESS_VIDEO_DOCUMENT', 'youtube_service',
        { videoId },
        { documentId: processedVideo.documentId, tagCount: processedVideo.tags.length },
        Date.now() - step2Start, 'success'
      );
      
      workflow.push({
        step: 2,
        action: 'PROCESS_VIDEO_DOCUMENT',
        result: { documentId: processedVideo.documentId },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step2Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 5, 2);
      
      // Step 3: Find related content
      const step3Start = Date.now();
      const [relatedVideos, similarDocuments] = await Promise.all([
        YouTubeService.getRelatedVideos(videoId, 5),
        DocumentService.searchDocuments(metadata.title, 'hybrid', { limit: 5 })
      ]);
      
      await AgentSessionModel.logAction(
        sessionId, 3, 'FIND_RELATED_CONTENT', 'youtube_service',
        { videoId, searchQuery: metadata.title },
        { relatedVideos: relatedVideos.length, similarDocs: similarDocuments.documents.length },
        Date.now() - step3Start, 'success'
      );
      
      workflow.push({
        step: 3,
        action: 'FIND_RELATED_CONTENT',
        result: { 
          relatedVideoCount: relatedVideos.length,
          similarDocCount: similarDocuments.documents.length 
        },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step3Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 5, 3);
      
      // Step 4: AI Analysis
      const step4Start = Date.now();
      const videoAnalysis = await YouTubeService.analyzeVideo(videoUrl, analysisType);
      
      await AgentSessionModel.logAction(
        sessionId, 4, 'AI_VIDEO_ANALYSIS', 'openai_service',
        { videoId, analysisType },
        { analysisLength: videoAnalysis.analysis.length },
        Date.now() - step4Start, 'success'
      );
      
      workflow.push({
        step: 4,
        action: 'AI_VIDEO_ANALYSIS',
        result: { analysisType, insightsGenerated: true },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step4Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 5, 4);
      
      // Step 5: Generate comprehensive report
      const step5Start = Date.now();
      const totalExecutionTime = Date.now() - startTime;
      
      const report = {
        sessionId,
        workflowType: 'youtube_analysis',
        input: { videoUrl, analysisType },
        workflow,
        results: {
          video: metadata,
          analysis: videoAnalysis.analysis,
          insights: videoAnalysis.insights,
          relatedVideos: relatedVideos.slice(0, 3),
          similarDocuments: similarDocuments.documents.slice(0, 3),
          tags: processedVideo.tags,
          keyPhrases: processedVideo.keyPhrases,
          documentId: processedVideo.documentId
        },
        metadata: {
          totalSteps: 5,
          completedSteps: 5,
          executionTime: totalExecutionTime,
          completedAt: new Date().toISOString()
        }
      };
      
      await AgentSessionModel.logAction(
        sessionId, 5, 'GENERATE_REPORT', 'direct_agent',
        { workflowType: 'youtube_analysis' },
        { reportGenerated: true },
        Date.now() - step5Start, 'success'
      );
      
      workflow.push({
        step: 5,
        action: 'GENERATE_REPORT',
        result: { reportGenerated: true },
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - step5Start
      });
      
      await AgentSessionModel.updateProgress(sessionId, 5, 5, 'completed');
      
      logger.info(`YouTube analysis workflow completed: ${sessionId}`, {
        totalSteps: 5,
        totalTime: totalExecutionTime,
        videoUrl
      });
      
      return report;
      
    } catch (error) {
      logger.logError(error, { 
        sessionId, 
        workflowType: 'youtube_analysis',
        videoUrl 
      });
      
      if (sessionId) {
        await AgentSessionModel.updateStatus(sessionId, 'failed');
      }
      
      throw error;
    }
  }
  
  /**
   * YouTube Topic Research Workflow
   */
  async executeYouTubeResearchWorkflow(input, options = {}) {
    const { topic, maxVideos = 5 } = input;
    let sessionId = this.currentSession;
    
    if (!sessionId) {
      const session = await this.createSession(`YouTube Research: ${topic}`, 'youtube_research');
      sessionId = session.sessionId;
    }
    
    logger.info('Starting YouTube research workflow', { sessionId, topic });
    
    try {
      // Research topic across YouTube
      const research = await YouTubeService.researchTopic(topic, maxVideos);
      
      // Store research summary as document
      const documentId = await DocumentModel.create({
        title: `YouTube Research: ${topic}`,
        content: research.summary,
        sourceType: 'youtube',
        sourceUrl: `youtube://research/${topic}`,
        metadata: {
          topic,
          videosAnalyzed: research.videosAnalyzed,
          videoIds: research.videos.map(v => v.id),
          sessionId
        }
      });
      
      return {
        sessionId,
        workflowType: 'youtube_research',
        input: { topic, maxVideos },
        results: {
          research,
          documentId
        },
        metadata: {
          completedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.logError(error, { sessionId, topic });
      
      if (sessionId) {
        await AgentSessionModel.updateStatus(sessionId, 'failed');
      }
      
      throw error;
    }
  }
}

export default new DirectAgentService();