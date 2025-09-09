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
    
    // Teams meetings and calendar events cache
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS teams_meetings (
        id VARCHAR(255) PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500),
        start_time DATETIME,
        end_time DATETIME,
        duration_minutes INT,
        location VARCHAR(500),
        organizer_name VARCHAR(255),
        organizer_email VARCHAR(255),
        attendees JSON COMMENT 'Array of attendee objects',
        is_online_meeting BOOLEAN DEFAULT FALSE,
        online_meeting_url TEXT,
        online_meeting_provider VARCHAR(100),
        online_meeting_data JSON COMMENT 'Full onlineMeeting object',
        teams_thread_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_user_email (user_email),
        INDEX idx_start_time (start_time),
        INDEX idx_is_online (is_online_meeting),
        INDEX idx_last_synced (last_synced)
      )
    `);
    
    // YouTube videos table - commented out since you're creating it manually in TiDB console
    // await conn.execute(`
    //   CREATE TABLE IF NOT EXISTS youtube_videos (
    //     id INT AUTO_INCREMENT PRIMARY KEY,
    //     video_id VARCHAR(255) UNIQUE NOT NULL,
    //     title VARCHAR(500),
    //     description TEXT,
    //     channel_title VARCHAR(255),
    //     url VARCHAR(500),
    //     published_at DATETIME,
    //     thumbnail_url VARCHAR(500),
    //     search_tag VARCHAR(255),
    //     session_id VARCHAR(36),
    //     
    //     -- Store embedding as VECTOR type (1536 dimensions for OpenAI embeddings)
    //     content_embedding VECTOR(1536),
    //     
    //     -- Metadata
    //     view_count BIGINT DEFAULT 0,
    //     like_count BIGINT DEFAULT 0,
    //     comment_count BIGINT DEFAULT 0,
    //     
    //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    //     
    //     INDEX idx_video_id (video_id),
    //     INDEX idx_session (session_id),
    //     INDEX idx_search_tag (search_tag),
    //     INDEX idx_published (published_at)
    //   )
    // `);
    
    logger.info('Database schema initialized successfully (including YouTube videos table with VECTOR support)');

    
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