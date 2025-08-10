import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import MCPTools from './tools.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import { testConnection } from '../config/database.js';

class MCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'tidb-agentx-mindflow',
        version: '1.0.0',
        description: 'Advanced Multi-step AI Agent with TiDB and MCP'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );
    
    this.setupHandlers();
    this.mcpTools = MCPTools;
  }
  
  setupHandlers() {
    // Initialize handler - using different syntax for current MCP SDK
    this.server.setRequestHandler('initialize', async (request) => {
      logger.info('MCP Server initializing', { 
        capabilities: request.params.capabilities,
        clientInfo: request.params.clientInfo 
      });
      
      // Test database connection
      try {
        await testConnection();
        logger.info('Database connection verified for MCP server');
      } catch (error) {
        logger.logError(error, { context: 'MCP_INIT_DB_TEST' });
        throw new Error('Database connection failed during MCP initialization');
      }
      
      return {
        capabilities: {
          tools: {
            listChanged: true
          },
          resources: {
            subscribe: false,
            listChanged: false
          },
          prompts: {
            listChanged: false
          }
        },
        serverInfo: {
          name: 'TiDB AgentX MindFlow Server',
          version: '1.0.0'
        }
      };
    });
    
    // Tools list handler
    this.server.setRequestHandler('tools/list', async () => {
      const tools = this.mcpTools.getToolDefinitions();
      
      logger.info('Tools list requested', { toolCount: tools.length });
      
      return { tools };
    });
    
    // Tool call handler
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      logger.info('Tool call received', { 
        toolName: name, 
        argsKeys: Object.keys(args || {}) 
      });
      
      try {
        const result = await this.mcpTools.executeTool(name, args || {});
        
        // Log successful tool execution
        if (args?.sessionId) {
          await this.mcpTools.logAction({
            sessionId: args.sessionId,
            stepNumber: args.stepNumber || 0,
            actionType: 'TOOL_CALL',
            toolName: name,
            inputData: args,
            outputData: { success: true },
            executionTimeMs: result.executionTime,
            status: 'success'
          }).catch(err => {
            logger.logError(err, { context: 'TOOL_LOGGING', toolName: name });
          });
        }
        
        return result;
        
      } catch (error) {
        logger.logError(error, { 
          toolName: name, 
          args: args ? Object.keys(args) : [] 
        });
        
        // Log failed tool execution
        if (args?.sessionId) {
          await this.mcpTools.logAction({
            sessionId: args.sessionId,
            stepNumber: args.stepNumber || 0,
            actionType: 'TOOL_CALL',
            toolName: name,
            inputData: args,
            outputData: { error: error.message },
            executionTimeMs: 0,
            status: 'error',
            errorMessage: error.message
          }).catch(err => {
            logger.logError(err, { context: 'ERROR_LOGGING', toolName: name });
          });
        }
        
        throw error;
      }
    });
    
    // Resources handler (for future expansion)
    this.server.setRequestHandler('resources/list', async () => {
      return { resources: [] };
    });
    
    // Prompts handler (for future expansion)
    this.server.setRequestHandler('prompts/list', async () => {
      return { prompts: [] };
    });
    
    // Notification handlers
    this.server.setNotificationHandler('notifications/initialized', async () => {
      logger.info('MCP Server initialized successfully');
    });
    
    this.server.setNotificationHandler('notifications/cancelled', async (notification) => {
      logger.info('Request cancelled', { requestId: notification.params.requestId });
    });
  }
  
  async start() {
    try {
      logger.info('Starting MCP Server...', {
        nodeEnv: config.env,
        logLevel: config.logging.level
      });
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('MCP Server connected and ready');
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down MCP server gracefully');
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down MCP server gracefully');
        process.exit(0);
      });
      
      process.on('uncaughtException', (error) => {
        logger.logError(error, { context: 'UNCAUGHT_EXCEPTION' });
        process.exit(1);
      });
      
      process.on('unhandledRejection', (reason, promise) => {
        logger.logError(new Error(reason), { 
          context: 'UNHANDLED_REJECTION',
          promise: promise.toString()
        });
        process.exit(1);
      });
      
    } catch (error) {
      logger.logError(error, { context: 'MCP_SERVER_START' });
      throw error;
    }
  }
  
  async stop() {
    try {
      // Cleanup logic here
      logger.info('MCP Server stopping');
    } catch (error) {
      logger.logError(error, { context: 'MCP_SERVER_STOP' });
    }
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPServer();
  await server.start();
}

export default MCPServer;