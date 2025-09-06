import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import OpenAIService from './OpenAIService.js';

class YouTubeService {
  constructor() {
    this.apiKey = config.external.youtube.apiKey;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }
  
  /**
   * Extract video ID from various YouTube URL formats
   */
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    throw new Error('Invalid YouTube URL or video ID');
  }

  
  /**
   * Search for YouTube Shorts videos - simplified version
   */
  async searchShorts(query, maxResults = 20) {
    const startTime = Date.now();
    
    try {
      const searchResponse = await axios.get(`${this.baseUrl}/search`, {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          videoDuration: 'short',
          maxResults: maxResults,
          key: this.apiKey,
          order: 'relevance',
          regionCode: 'US',
          relevanceLanguage: 'en'
        }
      });

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        return [];
      }

      return searchResponse.data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        url: `https://www.youtube.com/shorts/${item.id.videoId}`,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt
      }));
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'search/shorts', duration, error.response?.status || 500);
      logger.logError(error, { query, maxResults });
      throw error;
    }
  }

  /**
   * Get top comments from a video
   */
  async getVideoComments(videoId, maxResults = 5) {
    try {
      const response = await axios.get(`${this.baseUrl}/commentThreads`, {
        params: {
          part: 'snippet',
          videoId: videoId,
          order: 'relevance',
          maxResults: maxResults,
          key: this.apiKey
        }
      });

      if (!response.data.items || response.data.items.length === 0) {
        return [];
      }
      
      return response.data.items.map(item => ({
        commentId: item.id,
        text: item.snippet.topLevelComment.snippet.textDisplay,
        likeCount: item.snippet.topLevelComment.snippet.likeCount
      }));
      
    } catch (error) {
      if (error.response?.status === 403 && error.response?.data?.error?.errors?.[0]?.reason === 'commentsDisabled') {
        logger.info('Comments are disabled for this video', { videoId });
        return [];
      }
      
      logger.logError(error, { videoId, maxResults });
      throw error;
    }
  }

}

export default new YouTubeService();