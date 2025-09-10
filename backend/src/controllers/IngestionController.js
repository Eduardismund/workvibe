import YouTubeService from '../services/YouTubeService.js';
import CurationService from '../services/CurationService.js';
import logger from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';

class IngestionController {
  /**
   * Get curated feed using vector similarity
   */
  getCuratedFeed = asyncHandler(async (req, res) => {
    const { description, emotion, energy = 'medium', stress = 'medium' } = req.body;
    
    // Create context string for embedding
    const contextText = `
      User mood: ${emotion}
      Energy level: ${energy}
      Stress level: ${stress}
      Context: ${description}
    `;
    
    logger.info('Generating curated feed via vector similarity', { emotion, description });
    
    // Generate context embedding
    const contextEmbedding = await CurationService.generateEmbedding(contextText);
    
    // Find similar videos using vector search
    const similarVideos = await CurationService.findSimilarVideos(contextEmbedding, 20);
    
    res.status(200).json({
      status: 'success',
      data: {
        context: { emotion, energy, stress, description },
        recommendations: similarVideos,
        count: similarVideos.length,
        method: 'vector_similarity'
      }
    });
  });
  
  /**
   * Get database statistics
   */
  getStats = asyncHandler(async (req, res) => {
    const result = await CurationService.conn.execute(
      'SELECT COUNT(*) as total FROM video_embeddings'
    );
    
    const rows = result.rows || result;
    const total = rows[0]?.total || 0;
    
    res.status(200).json({
      status: 'success',
      data: {
        totalVideos: total,
        hasEmbeddings: true,
        ready: total > 0
      }
    });
  });

  /**
   * Reset watch history for all videos or specific video IDs
   */
  resetWatched = asyncHandler(async (req, res) => {
    const { videoIds } = req.body;
    
    logger.info('Resetting watched status', { 
      hasVideoIds: !!videoIds, 
      count: videoIds?.length 
    });

    let query;
    let params = [];
    let affectedRows;

    if (videoIds && videoIds.length > 0) {
      const placeholders = videoIds.map(() => '?').join(',');
      query = `
        UPDATE youtube_videos 
        SET watched = 0 
        WHERE video_id IN (${placeholders}) AND watched = 1
      `;
      params = videoIds;
      
      const result = await CurationService.conn.execute(query, params);
      // TiDB returns affectedRows in different ways depending on the driver
      affectedRows = result.affectedRows || result.rowsAffected || result.changedRows || 0;
      
      logger.info('Update result structure:', { 
        hasAffectedRows: 'affectedRows' in result,
        hasRowsAffected: 'rowsAffected' in result,
        hasChangedRows: 'changedRows' in result,
        resultKeys: Object.keys(result)
      });
      
      logger.info(`Reset watched status for specific videos`, { 
        requestedCount: videoIds.length,
        affectedRows 
      });
    } else {
      // First, count how many videos are currently watched
      const countQuery = `SELECT COUNT(*) as total FROM youtube_videos WHERE watched = 1`;
      const countResult = await CurationService.conn.execute(countQuery);
      const countRows = countResult.rows || countResult;
      const watchedCount = countRows[0]?.total || 0;
      
      logger.info(`Found ${watchedCount} watched videos to reset`);
      
      // Reset all watched videos
      query = `
        UPDATE youtube_videos 
        SET watched = 0 
        WHERE watched = 1
      `;
      
      const result = await CurationService.conn.execute(query);
      // TiDB returns affectedRows in different ways depending on the driver
      affectedRows = result.affectedRows || result.rowsAffected || result.changedRows || watchedCount || 0;
      
      logger.info('Update result structure (reset all):', { 
        hasAffectedRows: 'affectedRows' in result,
        hasRowsAffected: 'rowsAffected' in result,
        hasChangedRows: 'changedRows' in result,
        resultKeys: Object.keys(result),
        watchedCountBefore: watchedCount,
        reportedAffectedRows: affectedRows
      });
      
      logger.info(`Reset watched status for all videos`, { 
        watchedCountBefore: watchedCount,
        affectedRows 
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        videosReset: affectedRows,
        videoIds: videoIds || null,
        resetAll: !videoIds || videoIds.length === 0
      }
    });
  });

  /**
   * Get content statistics - videos and memes count
   */
  getContentStats = asyncHandler(async (req, res) => {
    logger.info('Fetching content statistics');

    // Get videos count
    const videosResult = await CurationService.conn.execute(
      'SELECT COUNT(*) as total FROM youtube_videos'
    );
    const videosRows = videosResult.rows || videosResult;
    const totalVideos = videosRows[0]?.total || 0;

    // Get memes count
    const memesResult = await CurationService.conn.execute(
      'SELECT COUNT(*) as total FROM meme_templates'
    );
    const memesRows = memesResult.rows || memesResult;
    const totalMemes = memesRows[0]?.total || 0;
    
    res.status(200).json({
      status: 'success',
      data: {
        videos: totalVideos,
        memes: totalMemes
      }
    });
  });
}

export default new IngestionController();