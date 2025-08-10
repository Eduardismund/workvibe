import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import AgentSessionModel from '../models/AgentSession.js';
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
  
  async createSession(name, workflowType = 'document_analysis', userContext = {}) {
    await this.ensureInitialized();
    
    try {
      const result = await this.client.request({
        method: 'tools/call',
        params: {
          name: 'create_session',
          arguments: {
            name,
            workflowType,
            userContext
          }
        }
      });
      
      const sessionData = JSON.parse(result.content[0].text);
      this.currentSession = sessionData.sessionId;
      
      logger.info(`Created agent session: ${this.currentSession}`, { name, workflowType });
      
      return sessionData;
      
    } catch (error) {
      logger.logError(error, { name, workflowType });
      throw error;
    }
  }
  
  async executeWorkflow(workflowType, input, options = {}) {
    await this.ensureInitialized();
    
    switch (workflowType) {
      case 'document_analysis':
        return await this.executeDocumentAnalysisWorkflow(input, options);
      case 'content_research':
        return await this.executeContentResearchWorkflow(input, options);
      case 'knowledge_synthesis':
        return await this.executeKnowledgeSynthesisWorkflow(input, options);
      default:
        throw new Error(`Unknown workflow type: ${workflowType}`);
    }
  }
  
  async executeDocumentAnalysisWorkflow(input, options = {}) {
    const { title, content, query = 'Analyze this document', analysisType = 'general' } = input;
    const sessionId = this.currentSession;
    
    logger.info('Starting document analysis workflow', { sessionId, title });
    
    const workflow = [];
    let stepNumber = 0;
    
    try {
      // Step 1: Create session if not exists
      if (!sessionId) {
        await this.createSession(`Document Analysis: ${title}`, 'document_analysis');
      }
      
      await this.updateSessionProgress(6, 0);
      
      // Step 2: Ingest document
      stepNumber++;
      const ingestResult = await this.callTool('ingest_document', {
        sessionId: this.currentSession,
        stepNumber,
        title,
        content,
        sourceType: options.sourceType || 'upload',
        sourceUrl: options.sourceUrl,
        metadata: options.metadata || {}
      });
      
      workflow.push({
        step: stepNumber,
        action: 'INGEST_DOCUMENT',
        result: JSON.parse(ingestResult.content[0].text),
        timestamp: new Date().toISOString()
      });
      
      await this.updateSessionProgress(6, stepNumber);
      
      // Step 3: Vector search for similar documents
      stepNumber++;
      const searchResult = await this.callTool('vector_search', {
        sessionId: this.currentSession,
        stepNumber,
        query: title,
        searchType: 'vector',
        limit: 5,
        similarityThreshold: options.similarityThreshold || 0.6
      });
      
      const searchData = JSON.parse(searchResult.content[0].text);
      workflow.push({
        step: stepNumber,
        action: 'VECTOR_SEARCH',
        result: { documentCount: searchData.documents.length, query: searchData.query },
        timestamp: new Date().toISOString()
      });
      
      await this.updateSessionProgress(6, stepNumber);
      
      // Step 4: Analyze documents with LLM
      stepNumber++;
      const analysisResult = await this.callTool('analyze_documents', {
        sessionId: this.currentSession,
        stepNumber,
        documents: searchData.documents,
        query,
        analysisType
      });
      
      const analysisData = JSON.parse(analysisResult.content[0].text);
      workflow.push({
        step: stepNumber,
        action: 'LLM_ANALYSIS',
        result: { analysisType, query },
        timestamp: new Date().toISOString()
      });
      
      await this.updateSessionProgress(6, stepNumber);
      
      // Step 5: Extract key insights
      stepNumber++;
      const insightsResult = await this.callTool('extract_insights', {
        sessionId: this.currentSession,
        stepNumber,
        content: analysisData.analysis,
        insightType: 'key_points'
      });
      
      const insightsData = JSON.parse(insightsResult.content[0].text);
      workflow.push({
        step: stepNumber,
        action: 'EXTRACT_INSIGHTS',
        result: { insightType: insightsData.insightType },
        timestamp: new Date().toISOString()
      });
      
      await this.updateSessionProgress(6, stepNumber);
      
      // Step 6: Generate final report
      stepNumber++;
      const report = {
        sessionId: this.currentSession,
        workflowType: 'document_analysis',
        input: { title, query, analysisType },
        workflow,
        results: {
          document: workflow[0].result,
          similarDocuments: searchData.documents.slice(0, 3).map(d => ({
            title: d.title,
            similarity: d.similarity || (1 - d.distance),
            sourceType: d.source_type
          })),
          analysis: analysisData.analysis,
          insights: insightsData.content,
          keyPhrases: insightsData.keyPhrases || []
        },
        metadata: {
          totalSteps: stepNumber,
          completedSteps: stepNumber,
          executionTime: Date.now() - workflow[0].timestamp,
          completedAt: new Date().toISOString()
        }
      };
      
      // Log final step
      await this.callTool('log_action', {
        sessionId: this.currentSession,
        stepNumber,
        actionType: 'GENERATE_REPORT',
        toolName: 'agent_orchestrator',
        inputData: { workflowType: 'document_analysis' },
        outputData: { success: true, reportGenerated: true },
        status: 'success'
      });
      
      workflow.push({
        step: stepNumber,
        action: 'GENERATE_REPORT',
        result: { reportGenerated: true },
        timestamp: new Date().toISOString()
      });
      
      // Mark session as completed
      await this.updateSessionProgress(6, stepNumber, 'completed');
      
      logger.info(`Document analysis workflow completed: ${this.currentSession}`, {
        totalSteps: stepNumber,
        title
      });
      
      return report;
      
    } catch (error) {
      logger.logError(error, { 
        sessionId: this.currentSession, 
        stepNumber, 
        workflowType: 'document_analysis' 
      });
      
      // Mark session as failed
      if (this.currentSession) {
        await this.updateSessionProgress(6, stepNumber, 'failed');
      }
      
      throw error;
    }
  }
  
  async executeContentResearchWorkflow(input, options = {}) {
    const { query, sources = ['web', 'documents'], maxResults = 10 } = input;
    const sessionId = this.currentSession;
    
    logger.info('Starting content research workflow', { sessionId, query });
    
    const workflow = [];
    let stepNumber = 0;
    
    try {
      if (!sessionId) {
        await this.createSession(`Content Research: ${query}`, 'content_research');
      }
      
      await this.updateSessionProgress(5, 0);
      
      // Step 1: Search documents
      if (sources.includes('documents')) {
        stepNumber++;
        const docSearchResult = await this.callTool('vector_search', {
          sessionId: this.currentSession,
          stepNumber,
          query,
          searchType: 'hybrid',
          limit: Math.ceil(maxResults / 2)
        });
        
        workflow.push({
          step: stepNumber,
          action: 'SEARCH_DOCUMENTS',
          result: JSON.parse(docSearchResult.content[0].text),
          timestamp: new Date().toISOString()
        });
      }
      
      // Step 2: Search web (placeholder)
      if (sources.includes('web')) {
        stepNumber++;
        const webSearchResult = await this.callTool('search_web', {
          sessionId: this.currentSession,
          stepNumber,
          query,
          numResults: Math.ceil(maxResults / 2)
        });
        
        workflow.push({
          step: stepNumber,
          action: 'SEARCH_WEB',
          result: JSON.parse(webSearchResult.content[0].text),
          timestamp: new Date().toISOString()
        });
      }
      
      // Continue with analysis and synthesis steps...
      
      const report = {
        sessionId: this.currentSession,
        workflowType: 'content_research',
        input: { query, sources, maxResults },
        workflow,
        results: {
          // Compile results from all steps
        },
        metadata: {
          totalSteps: stepNumber,
          completedSteps: stepNumber,
          completedAt: new Date().toISOString()
        }
      };
      
      await this.updateSessionProgress(stepNumber, stepNumber, 'completed');
      
      return report;
      
    } catch (error) {
      logger.logError(error, { sessionId: this.currentSession });
      if (this.currentSession) {
        await this.updateSessionProgress(stepNumber, stepNumber, 'failed');
      }
      throw error;
    }
  }
  
  async executeKnowledgeSynthesisWorkflow(input, options = {}) {
    // Implementation for knowledge synthesis workflow
    // This would combine multiple documents and sources into coherent knowledge
    throw new Error('Knowledge synthesis workflow not yet implemented');
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
  
  async updateSessionProgress(totalSteps, completedSteps, status = null) {
    if (!this.currentSession) return;
    
    try {
      await this.callTool('update_session', {
        sessionId: this.currentSession,
        totalSteps,
        completedSteps,
        status
      });
    } catch (error) {
      logger.logError(error, { context: 'UPDATE_SESSION_PROGRESS' });
    }
  }
  
  async getSessionStatus(sessionId = null) {
    const targetSession = sessionId || this.currentSession;
    if (!targetSession) {
      throw new Error('No session ID provided');
    }
    
    const result = await this.callTool('get_session_status', {
      sessionId: targetSession
    });
    
    return JSON.parse(result.content[0].text);
  }
  
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
  
  async cleanup() {
    try {
      if (this.client) {
        // Close client connection if possible
        this.client = null;
      }
      
      this.isInitialized = false;
      this.currentSession = null;
      
      logger.info('Agent Orchestrator cleaned up');
      
    } catch (error) {
      logger.logError(error, { context: 'AGENT_ORCHESTRATOR_CLEANUP' });
    }
  }
}

export default new AgentOrchestrator();