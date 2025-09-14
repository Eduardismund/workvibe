import { connect } from '@tidbcloud/serverless';
import config from './index.js';
import logger from '../utils/logger.js';

let connection = null;

export const getConnection = () => {
  if (!connection) {
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
    
    // await conn.execute(`
    //   CREATE TABLE IF NOT EXISTS teams_meetings (
    //     user_email VARCHAR(255) NOT NULL,
    //     subject VARCHAR(500),
    //     start_time DATETIME,
    //     end_time DATETIME,
    //     duration_minutes INT,
    //     body_preview TEXT,
    //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    //   )
    // `);
    //
    // await conn.execute(`
    //   CREATE TABLE IF NOT EXISTS youtube_videos (
    //     video_id VARCHAR(255) PRIMARY KEY,
    //     title VARCHAR(500),
    //     description TEXT,
    //     channel_title VARCHAR(255),
    //     url VARCHAR(500),
    //     search_tag VARCHAR(255),
    //     session_id VARCHAR(36),
    //     watched BOOLEAN DEFAULT FALSE,
    //     content_embedding VECTOR(1536),
    //     comments JSON,
    //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    //
    //     INDEX idx_session (session_id),
    //     INDEX idx_search_tag (search_tag),
    //     INDEX idx_watched (watched)
    //   )
    // `);
    //
    // await conn.execute(`
    //   CREATE TABLE IF NOT EXISTS meme_templates (
    //     id VARCHAR(255) PRIMARY KEY,
    //     name VARCHAR(500) NOT NULL,
    //     url VARCHAR(1000) NOT NULL,
    //     box_count INT,
    //     captions INT,
    //     use_cases TEXT,
    //     use_cases_embedding VECTOR(1536),
    //     box_guidelines TEXT,
    //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    //
    //     INDEX idx_name (name)
    //   )
    // `);
    //
    
    logger.info('Database schema initialization skipped - tables already exist');
    
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  await testConnection();
  await initializeDatabase();
  process.exit(0);
}

export default { getConnection, testConnection, initializeDatabase };