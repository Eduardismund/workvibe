import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

class YouTubeVideoModel {
  static async createTable() {
    const conn = getConnection();
    
    try {
      // Create table with VECTOR column for embeddings (TiDB Serverless compatible)
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS youtube_videos (
          video_id VARCHAR(255) PRIMARY KEY,
          title VARCHAR(500),
          description TEXT,
          channel_title VARCHAR(255),
          url VARCHAR(500),
          search_tag VARCHAR(255),
          session_id VARCHAR(36),
          
          -- Store embedding as TEXT (proven to work with TiDB vector functions)
          content_embedding TEXT,
          
          -- Store comments as JSON
          comments JSON,
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_session (session_id),
          INDEX idx_search_tag (search_tag)
        )
      `);
      
      logger.info('YouTube videos table created/verified with VECTOR support');
      return true;
    } catch (error) {
      logger.logError(error, { context: 'CREATE_YOUTUBE_TABLE' });
      throw error;
    }
  }
  
  static async upsert(videoData) {
    const conn = getConnection();
    
    try {
      const {
        videoId,
        title,
        description,
        channelTitle,
        url,
        searchTag,
        sessionId,
        embedding,
        comments
      } = videoData;
      
      const embeddingVector = embedding ? `[${embedding.join(',')}]` : null;
      
      await conn.execute(`
        INSERT INTO youtube_videos (
          video_id, title, description, channel_title, url, 
          search_tag, session_id, content_embedding, comments
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          channel_title = VALUES(channel_title),
          url = VALUES(url),
          search_tag = COALESCE(VALUES(search_tag), search_tag),
          session_id = COALESCE(VALUES(session_id), session_id),
          content_embedding = COALESCE(VALUES(content_embedding), content_embedding),
          comments = COALESCE(VALUES(comments), comments),
          updated_at = CURRENT_TIMESTAMP
      `, [
        videoId,
        title,
        description,
        channelTitle,
        url,
        searchTag,
        sessionId,
        embeddingVector,
        comments ? JSON.stringify(comments) : null
      ]);
      
      logger.info('YouTube video upserted', { videoId, title: title?.substring(0, 50) });
      return true;
    } catch (error) {
      logger.logError(error, { videoData: { videoId: videoData.videoId } });
      throw error;
    }
  }
  
  static async bulkUpsert(videos) {
    const results = [];
    
    for (const video of videos) {
      try {
        await this.upsert(video);
        results.push({ videoId: video.videoId, success: true });
      } catch (error) {
        logger.warn('Failed to upsert video', { videoId: video.videoId, error: error.message });
        results.push({ videoId: video.videoId, success: false, error: error.message });
      }
    }
    
    return results;
  }
  
  static async findSimilar(embedding, limit = 10, threshold = 0.8) {
    const conn = getConnection();
    
    try {
      // Convert embedding array to vector string format [x,y,z,...]
      const vectorString = `[${embedding.join(',')}]`;
      
      // Use TiDB's native vector similarity search with proper CAST syntax
      const result = await conn.execute(`
        SELECT 
          video_id,
          title,
          description,
          channel_title,
          url,
          search_tag,
          comments,
          (1 - VEC_COSINE_DISTANCE(content_embedding, ?)) as similarity
        FROM youtube_videos
        WHERE content_embedding IS NOT NULL
        HAVING similarity >= ?
        ORDER BY similarity DESC
        LIMIT ?
      `, [vectorString, threshold, limit]);
      
      logger.info('Similarity search result', { 
        rowCount: Array.isArray(result) ? result.length : result?.rows?.length || 0,
        hasRows: Array.isArray(result) ? result.length > 0 : !!result?.rows 
      });
      
      // Handle both array and object with rows property
      return Array.isArray(result) ? result : (result?.rows || []);
    } catch (error) {
      logger.logError(error, { context: 'FIND_SIMILAR_VIDEOS' });
      throw error;
    }
  }
  
  static async findByVideoId(videoId) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT * FROM youtube_videos WHERE video_id = ?
      `, [videoId]);
      
      return result.rows[0] || null;
    } catch (error) {
      logger.logError(error, { videoId });
      throw error;
    }
  }
  
  static async findBySessionId(sessionId, limit = 50) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT * FROM youtube_videos 
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `, [sessionId, limit]);
      
      return result.rows;
    } catch (error) {
      logger.logError(error, { sessionId });
      throw error;
    }
  }
  
  static async findBySearchTag(searchTag, limit = 20) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT * FROM youtube_videos 
        WHERE search_tag = ?
        ORDER BY view_count DESC, like_count DESC
        LIMIT ?
      `, [searchTag, limit]);
      
      return result.rows;
    } catch (error) {
      logger.logError(error, { searchTag });
      throw error;
    }
  }
  
  static async getPopularVideos(limit = 20, daysBack = 7) {
    const conn = getConnection();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      
      const result = await conn.execute(`
        SELECT * FROM youtube_videos 
        WHERE created_at >= ?
        ORDER BY view_count DESC, like_count DESC
        LIMIT ?
      `, [cutoffDate, limit]);
      
      return result.rows;
    } catch (error) {
      logger.logError(error, { limit, daysBack });
      throw error;
    }
  }
  
  static async updateEmbedding(videoId, embedding) {
    const conn = getConnection();
    
    try {
      const embeddingVector = `[${embedding.join(',')}]`;
      
      await conn.execute(`
        UPDATE youtube_videos 
        SET content_embedding = ?, updated_at = CURRENT_TIMESTAMP
        WHERE video_id = ?
      `, [embeddingVector, videoId]);
      
      logger.info('Video embedding updated', { videoId });
      return true;
    } catch (error) {
      logger.logError(error, { videoId });
      throw error;
    }
  }
}

export default YouTubeVideoModel;