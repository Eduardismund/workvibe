import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

class YouTubeVideoModel {
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
  
  static async findSimilar(embedding, limit = 10, threshold = 0.8) {
    const conn = getConnection();
    
    try {
      const vectorString = `[${embedding.join(',')}]`;
      
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
          AND watched = FALSE
        HAVING similarity >= ?
        ORDER BY similarity DESC
        LIMIT ?
      `, [vectorString, threshold, limit]);
      
      logger.info('Similarity search result', { 
        rowCount: Array.isArray(result) ? result.length : result?.rows?.length || 0,
        hasRows: Array.isArray(result) ? result.length > 0 : !!result?.rows 
      });
      
      return Array.isArray(result) ? result : (result?.rows || []);
    } catch (error) {
      logger.logError(error, { context: 'FIND_SIMILAR_VIDEOS' });
      throw error;
    }
  }
  

  static async markAsWatched(videoIds) {
    const conn = getConnection();
    
    try {
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return false;
      }

      const placeholders = videoIds.map(() => '?').join(',');
      
      await conn.execute(`
        UPDATE youtube_videos 
        SET watched = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE video_id IN (${placeholders})
      `, videoIds);
      
      logger.info('Videos marked as watched', { 
        videoIds, 
        count: videoIds.length 
      });
      
      return true;
    } catch (error) {
      logger.logError(error, { videoIds });
      throw error;
    }
  }

}

export default YouTubeVideoModel;