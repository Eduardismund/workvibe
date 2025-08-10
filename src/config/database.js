import { connect } from '@tidbcloud/serverless';
import config from './index.js';
import logger from '../utils/logger.js';

let connection = null;

export const getConnection = () => {
  if (!connection) {
    // TiDB Serverless connection configuration (working config)
    const connectionConfig = {
      host: config.database.host,
      port: config.database.port,
      username: config.database.user,
      password: config.database.password,
      database: config.database.database,
      ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    };
    
    logger.info('Connecting to TiDB Serverless...', {
      host: connectionConfig.host,
      port: connectionConfig.port,
      database: connectionConfig.database
    });
    
    connection = connect(connectionConfig);
  }
  return connection;
};

export const testConnection = async () => {
  try {
    const conn = getConnection();
    const result = await conn.execute('SELECT 1 as test');
    logger.info('Database connection successful', { 
      resultCount: result.rows ? result.rows.length : 0 
    });
    return result;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    throw error;
  }
};

export const initializeDatabase = async () => {
  const conn = getConnection();
  
  try {
    logger.info('Initializing database schema...');
    
    // Documents table (we'll add vector support after checking TiDB version)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        content LONGTEXT,
        source_type ENUM('upload', 'youtube', 'web', 'notion') DEFAULT 'upload',
        source_url VARCHAR(500),
        metadata JSON,
        embedding JSON COMMENT 'OpenAI embedding as JSON array',
        content_hash VARCHAR(64) UNIQUE,
        status ENUM('processing', 'completed', 'failed') DEFAULT 'processing',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_source_type (source_type),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_content_hash (content_hash)
      )
    `);
    
    // Agent sessions and workflow tracking
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255),
        user_context JSON,
        workflow_type ENUM('document_analysis', 'content_research', 'knowledge_synthesis', 'youtube_analysis', 'youtube_research') DEFAULT 'document_analysis',
        status ENUM('active', 'completed', 'failed') DEFAULT 'active',
        total_steps INT DEFAULT 0,
        completed_steps INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_status (status),
        INDEX idx_workflow_type (workflow_type)
      )
    `);
    
    // Detailed action logs for each step
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agent_actions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        session_id VARCHAR(36) NOT NULL,
        step_number INT NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        tool_name VARCHAR(100),
        input_data JSON,
        output_data JSON,
        execution_time_ms INT,
        status ENUM('success', 'error') DEFAULT 'success',
        error_message TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
        INDEX idx_session_step (session_id, step_number),
        INDEX idx_action_type (action_type),
        INDEX idx_status (status)
      )
    `);
    
    // Search results and caching
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS search_results (
        id INT PRIMARY KEY AUTO_INCREMENT,
        session_id VARCHAR(36),
        query_text TEXT NOT NULL,
        query_embedding JSON COMMENT 'Query embedding as JSON array',
        results JSON,
        result_count INT DEFAULT 0,
        search_type ENUM('vector', 'fulltext', 'hybrid') DEFAULT 'vector',
        similarity_threshold DECIMAL(3,2) DEFAULT 0.70,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE SET NULL,
        INDEX idx_session (session_id),
        INDEX idx_search_type (search_type)
      )
    `);
    
    // Knowledge synthesis and insights
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_insights (
        id INT PRIMARY KEY AUTO_INCREMENT,
        session_id VARCHAR(36) NOT NULL,
        insight_type ENUM('summary', 'analysis', 'recommendation', 'synthesis') NOT NULL,
        title VARCHAR(255),
        content TEXT,
        confidence_score DECIMAL(3,2),
        source_documents JSON,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
        INDEX idx_session_type (session_id, insight_type)
      )
    `);
    
    // External API integrations tracking
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS api_integrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        session_id VARCHAR(36),
        api_name VARCHAR(100) NOT NULL,
        endpoint VARCHAR(255),
        request_data JSON,
        response_data JSON,
        status_code INT,
        response_time_ms INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE SET NULL,
        INDEX idx_api_name (api_name),
        INDEX idx_status_code (status_code)
      )
    `);
    
    logger.info('Database schema initialized successfully');
    
    // Insert sample data for demonstration
    await insertSampleData(conn);
    
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

const insertSampleData = async (conn) => {
  try {
    // Check if sample data already exists
    const existing = await conn.execute('SELECT COUNT(*) as count FROM documents');
    // TiDB returns results as array directly, not wrapped in rows
    const count = existing && existing[0] ? parseInt(existing[0].count) : 0;
    
    if (count > 0) {
      logger.info('Sample data already exists, skipping insertion', { existingCount: count });
      return;
    }
    
    logger.info('Inserting sample documents...');
    
    const sampleDocs = [
      {
        title: 'AI Agent Architecture Patterns',
        content: 'Modern AI agents utilize multi-step workflows to break down complex tasks into manageable components. Key patterns include tool-calling agents, chain-of-thought reasoning, and hierarchical task decomposition.',
        source_type: 'upload',
        metadata: { category: 'ai', tags: ['architecture', 'patterns'] }
      },
      {
        title: 'TiDB Vector Search Capabilities',
        content: 'TiDB Serverless provides native vector search functionality with cosine similarity, enabling semantic search over large document collections. It supports high-dimensional embeddings and efficient indexing.',
        source_type: 'upload',
        metadata: { category: 'database', tags: ['tidb', 'vector-search'] }
      },
      {
        title: 'Model Context Protocol (MCP) Guide',
        content: 'MCP enables AI agents to interact with external tools and services through a standardized protocol. It supports tool discovery, parameter validation, and result handling.',
        source_type: 'upload',
        metadata: { category: 'protocol', tags: ['mcp', 'tools'] }
      }
    ];
    
    for (const doc of sampleDocs) {
      await conn.execute(`
        INSERT INTO documents (title, content, source_type, metadata, content_hash, status)
        VALUES (?, ?, ?, ?, MD5(CONCAT(?, ?)), 'completed')
      `, [
        doc.title,
        doc.content,
        doc.source_type,
        JSON.stringify(doc.metadata),
        doc.title,
        doc.content
      ]);
    }
    
    logger.info('Sample data inserted successfully');
    
  } catch (error) {
    logger.error('Failed to insert sample data:', error);
  }
};

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await testConnection();
  await initializeDatabase();
  process.exit(0);
}

export default { getConnection, testConnection, initializeDatabase };