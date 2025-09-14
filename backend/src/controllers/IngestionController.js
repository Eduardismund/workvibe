import YouTubeService from '../services/YouTubeService.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';

class IngestionController {

  resetWatched = asyncHandler(async (req, res) => {
    const { videoIds } = req.body;
    

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
      
      const conn = getConnection();
      const result = await conn.execute(query, params);
      affectedRows = result.affectedRows || result.rowsAffected || result.changedRows || 0;
      
    } else {
      query = `
        UPDATE youtube_videos 
        SET watched = 0 
        WHERE watched = 1
      `;
      
      const conn = getConnection();
      const result = await conn.execute(query);
      affectedRows = result.affectedRows || result.rowsAffected || result.changedRows || 0;
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

  getContentStats = asyncHandler(async (req, res) => {

    // Get videos count
    const conn = getConnection();
    const videosResult = await conn.execute(
      'SELECT COUNT(*) as total FROM youtube_videos'
    );
    const videosRows = videosResult.rows || videosResult;
    const totalVideos = videosRows[0]?.total || 0;

    const memesResult = await conn.execute(
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