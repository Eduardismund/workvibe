import YouTubeService from '../services/YouTubeService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

class YouTubeController {
  
  // Search YouTube Shorts
  searchShorts = asyncHandler(async (req, res) => {
    const { query, maxResults = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        status: 'error',
        message: 'query parameter is required'
      });
    }
    
    logger.info('Searching YouTube Shorts', { query, maxResults });
    
    const shorts = await YouTubeService.searchShorts(query, parseInt(maxResults));
    
    res.status(200).json({
      status: 'success',
      data: { 
        shorts,
        count: shorts.length,
        query,
        type: 'shorts'
      }
    });
  });
  
  // Get video comments
  getVideoComments = asyncHandler(async (req, res) => {
    const { videoUrl, maxResults = 5 } = req.query;
    
    if (!videoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'videoUrl parameter is required'
      });
    }
    
    logger.info('Fetching video comments', { videoUrl, maxResults });
    
    const videoId = YouTubeService.extractVideoId(videoUrl);
    const comments = await YouTubeService.getVideoComments(videoId, parseInt(maxResults));
    
    res.status(200).json({
      status: 'success',
      data: { 
        comments,
        count: comments.length,
        videoId
      }
    });
  });

  // Test similarity between a sentence and all YouTube videos in DB using TiDB vector functions
  testSimilarity = asyncHandler(async (req, res) => {
    const { sentence, limit = 10, threshold = 0.5 } = req.body;
    
    if (!sentence) {
      return res.status(400).json({
        status: 'error',
        message: 'sentence parameter is required'
      });
    }
    
    logger.info('Testing similarity for sentence using TiDB vector search', { sentence, limit, threshold });
    
    try {
      // Import required services
      const YouTubeVideoModel = (await import('../models/YouTubeVideo.js')).default;
      const OpenAIService = (await import('../services/OpenAIService.js')).default;
      
      // Check TiDB version first
      const conn = (await import('../config/database.js')).getConnection();
      const versionResult = await conn.execute('SELECT VERSION() as version');
      logger.info('TiDB Version', { version: versionResult?.rows?.[0] || versionResult });
      
      // Step 1: Generate embedding for the input sentence
      const sentenceEmbedding = await OpenAIService.generateEmbedding(sentence);
      logger.info('Generated embedding for input sentence');
      
      // Step 2: Use TiDB's vector similarity search
      const similarVideos = await YouTubeVideoModel.findSimilar(sentenceEmbedding, limit, threshold);
      
      logger.info('Found similar videos', { count: similarVideos?.length || 0 });
      
      // Step 3: Format results with detailed information
      const formattedResults = (similarVideos || []).map(video => ({
        videoId: video.video_id,
        title: video.title,
        description: video.description?.substring(0, 200) + (video.description?.length > 200 ? '...' : ''),
        channelTitle: video.channel_title,
        url: video.url,
        searchTag: video.search_tag,
        similarity: video.similarity
      }));
      
      // Step 4: Get total count of videos with embeddings for statistics
      const dbConn = (await import('../config/database.js')).getConnection();
      const countResult = await dbConn.execute(`
        SELECT COUNT(*) as total FROM youtube_videos WHERE content_embedding IS NOT NULL
      `);
      
      // Handle both array and object result formats
      const countData = Array.isArray(countResult) ? countResult : countResult?.rows;
      
      logger.info('Count query result', { 
        isArray: Array.isArray(countResult),
        hasData: !!countData,
        dataLength: countData?.length,
        firstRow: countData?.[0]
      });
      
      const totalVideos = countData?.[0]?.total || 0;
      
      // Step 5: Return comprehensive results
      res.json({
        status: 'success',
        data: {
          sentence,
          totalVideosInDatabase: totalVideos,
          videosAboveThreshold: formattedResults.length,
          topResults: formattedResults,
          statistics: {
            highestSimilarity: formattedResults[0]?.similarity || 0,
            lowestSimilarity: formattedResults[formattedResults.length - 1]?.similarity || 0,
            averageSimilarity: formattedResults.length > 0 
              ? formattedResults.reduce((sum, r) => sum + r.similarity, 0) / formattedResults.length 
              : 0
          },
          parameters: {
            limit,
            threshold,
            embeddingModel: 'text-embedding-ada-002'
          },
          tidbVectorFunction: 'VEC_Cosine_Distance'
        }
      });
      
    } catch (error) {
      logger.error('Failed to test similarity', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Failed to test similarity',
        error: error.message
      });
    }
  });

  // Test YouTube to TiDB storage
  testYouTubeTiDBStorage = asyncHandler(async (req, res) => {
    const { searchQuery = 'programming tutorial' } = req.body;
    
    logger.info('Testing YouTube to TiDB storage', { searchQuery });
    
    // Step 1: Table already exists (created manually in TiDB console with VECTOR support)
    const YouTubeVideoModel = (await import('../models/YouTubeVideo.js')).default;
    // await YouTubeVideoModel.createTable(); // Commented out - table created manually
    logger.info('Using existing YouTube table with VECTOR support');
    
    // Step 2: Search for a few YouTube shorts
    const shorts = await YouTubeService.searchShorts(searchQuery, 3);
    logger.info('Found YouTube shorts', { count: shorts.length });
    
    // Step 3: Generate embeddings and store each video
    const OpenAIService = (await import('../services/OpenAIService.js')).default;
    const results = [];
    
    for (const short of shorts) {
      try {
        const comments = await YouTubeService.getVideoComments(short.videoId, 3);
        
        // Generate embedding using the new method
        const embedding = await OpenAIService.generateVideoEmbedding(short, comments);
        
        // Store in TiDB
        await YouTubeVideoModel.upsert({
          videoId: short.videoId,
          title: short.title,
          description: short.description,
          channelTitle: short.channelTitle,
          url: short.url,
          searchTag: searchQuery,
          sessionId: `test-${Date.now()}`,
          embedding: embedding,
          comments: comments
        });
        
        results.push({
          videoId: short.videoId,
          title: short.title,
          stored: true,
          hasEmbedding: !!embedding
        });
        
      } catch (error) {
        logger.error('Failed to store video', { videoId: short.videoId, error: error.message });
        results.push({
          videoId: short.videoId,
          title: short.title,
          stored: false,
          error: error.message
        });
      }
    }
    
    // Step 4: Verify storage by reading back
    const storedCount = results.filter(r => r.stored).length;
    
    res.json({
      status: 'success',
      data: {
        searchQuery,
        videosFound: shorts.length,
        videosStored: storedCount,
        results,
        message: `Successfully stored ${storedCount} out of ${shorts.length} videos in TiDB`
      }
    });
  });

  // Get recommended videos based on a video ID
  getRecommendedVideos = asyncHandler(async (req, res) => {
    const { videoId, maxResults = 10 } = req.query;
    
    if (!videoId) {
      return res.status(400).json({
        status: 'error',
        message: 'videoId parameter is required'
      });
    }
    
    logger.info('Getting recommended videos', { videoId, maxResults });
    
    const recommendedVideos = await YouTubeService.getRecommendedVideos(videoId, parseInt(maxResults));
    
    res.status(200).json({
      status: 'success',
      data: { 
        recommendedVideos,
        count: recommendedVideos.length,
        baseVideoId: videoId
      }
    });
  });
}

export default new YouTubeController();