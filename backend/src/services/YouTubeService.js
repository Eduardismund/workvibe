import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import OpenAIService from './OpenAIService.js';

class YouTubeService {
  constructor() {
    this.apiKey = config.external.youtube.apiKey;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }
  
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
      logger.logError(error, { query, maxResults });
      throw error;
    }
  }

  async getVideoMetadata(videoId) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          part: 'snippet,statistics',
          id: videoId,
          key: this.apiKey
        }
      });


      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Video not found');
      }

      const video = response.data.items[0];
      return {
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        channelTitle: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt,
        viewCount: video.statistics.viewCount,
        likeCount: video.statistics.likeCount,
        commentCount: video.statistics.commentCount
      };
      
    } catch (error) {
      logger.logError(error, { videoId });
      throw error;
    }
  }



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
        return [];
      }
      
      logger.logError(error, { videoId, maxResults });
      throw error;
    }
  }

  async getRecommendedVideos(videoId, maxResults = 10) {
    try {
      const videoResponse = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          part: 'snippet,statistics',
          id: videoId,
          key: this.apiKey
        }
      });

      if (!videoResponse.data.items?.length) {
        throw new Error('Video not found');
      }

      const video = videoResponse.data.items[0];
      const channelId = video.snippet.channelId;
      const title = video.snippet.title;
      const tags = video.snippet.tags || [];
      
      const titleWords = title.split(' ').filter(word => 
        word.length > 3 && 
        !['video', 'watch', 'subscribe', 'like', 'share'].includes(word.toLowerCase())
      );

      const searchTerms = [...tags.slice(0, 3), ...titleWords.slice(0, 3)];
      const searchQuery = searchTerms.join(' ');

      const searchResponse = await axios.get(`${this.baseUrl}/search`, {
        params: {
          part: 'snippet',
          q: searchQuery,
          type: 'video',
          maxResults: maxResults + 5, // Get extra to filter out the original
          order: 'relevance',
          key: this.apiKey
        }
      });

      const relatedVideos = searchResponse.data.items
        .filter(item => item.id.videoId !== videoId)
        .slice(0, maxResults)
        .map(item => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          thumbnails: item.snippet.thumbnails,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));


      return relatedVideos;

    } catch (error) {
      logger.logError(error, { videoId, maxResults });
      throw error;
    }
  }

}

export default new YouTubeService();