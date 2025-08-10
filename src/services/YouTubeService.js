import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import DocumentModel from '../models/Document.js';
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
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    throw new Error('Invalid YouTube URL or video ID');
  }
  
  /**
   * Get video metadata from YouTube API
   */
  async getVideoMetadata(videoId) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoId,
          key: this.apiKey
        }
      });
      
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'videos', duration, 200);
      
      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Video not found');
      }
      
      const video = response.data.items[0];
      
      return {
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        channelTitle: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        publishedAt: video.snippet.publishedAt,
        duration: this.parseDuration(video.contentDetails.duration),
        viewCount: parseInt(video.statistics.viewCount || 0),
        likeCount: parseInt(video.statistics.likeCount || 0),
        commentCount: parseInt(video.statistics.commentCount || 0),
        tags: video.snippet.tags || [],
        thumbnails: video.snippet.thumbnails,
        url: `https://www.youtube.com/watch?v=${videoId}`
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'videos', duration, error.response?.status || 500);
      logger.logError(error, { videoId });
      throw error;
    }
  }
  
  /**
   * Get video transcript/captions
   */
  async getTranscript(videoId) {
    const startTime = Date.now();
    
    try {
      // First, get available captions
      const captionsResponse = await axios.get(`${this.baseUrl}/captions`, {
        params: {
          part: 'snippet',
          videoId: videoId,
          key: this.apiKey
        }
      });
      
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'captions', duration, 200);
      
      if (!captionsResponse.data.items || captionsResponse.data.items.length === 0) {
        logger.info('No captions available for video', { videoId });
        return null;
      }
      
      // Find English captions (or first available)
      const caption = captionsResponse.data.items.find(item => 
        item.snippet.language === 'en'
      ) || captionsResponse.data.items[0];
      
      // Note: Actually downloading captions requires OAuth or web scraping
      // For now, return caption metadata
      return {
        available: true,
        language: caption.snippet.language,
        trackKind: caption.snippet.trackKind,
        message: 'Full transcript extraction requires additional setup (OAuth or web scraping)'
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'captions', duration, error.response?.status || 500);
      logger.logError(error, { videoId });
      
      // Return null if captions not available
      return null;
    }
  }
  
  /**
   * Search for videos
   */
  async searchVideos(query, maxResults = 10) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: maxResults,
          key: this.apiKey,
          order: 'relevance'
        }
      });
      
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'search', duration, 200);
      
      return response.data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnails: item.snippet.thumbnails,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
      }));
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'search', duration, error.response?.status || 500);
      logger.logError(error, { query, maxResults });
      throw error;
    }
  }
  
  /**
   * Get related videos
   */
  async getRelatedVideos(videoId, maxResults = 5) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          part: 'snippet',
          relatedToVideoId: videoId,
          type: 'video',
          maxResults: maxResults,
          key: this.apiKey
        }
      });
      
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'search/related', duration, 200);
      
      return response.data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
      }));
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'search/related', duration, error.response?.status || 500);
      
      // Fallback to regular search if relatedToVideoId not supported
      if (error.response?.status === 400) {
        logger.info('Related videos not supported, falling back to search');
        const video = await this.getVideoMetadata(videoId);
        return this.searchVideos(video.title, maxResults);
      }
      
      throw error;
    }
  }
  
  /**
   * Get channel information
   */
  async getChannelInfo(channelId) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${this.baseUrl}/channels`, {
        params: {
          part: 'snippet,statistics,contentDetails',
          id: channelId,
          key: this.apiKey
        }
      });
      
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'channels', duration, 200);
      
      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Channel not found');
      }
      
      const channel = response.data.items[0];
      
      return {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl,
        publishedAt: channel.snippet.publishedAt,
        thumbnails: channel.snippet.thumbnails,
        subscriberCount: parseInt(channel.statistics.subscriberCount || 0),
        videoCount: parseInt(channel.statistics.videoCount || 0),
        viewCount: parseInt(channel.statistics.viewCount || 0),
        playlistId: channel.contentDetails.relatedPlaylists.uploads
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('YouTube', 'channels', duration, error.response?.status || 500);
      logger.logError(error, { channelId });
      throw error;
    }
  }
  
  /**
   * Process and store YouTube video as document
   */
  async processVideo(videoUrl, options = {}) {
    const videoId = this.extractVideoId(videoUrl);
    
    logger.info('Processing YouTube video', { videoId, url: videoUrl });
    
    try {
      // Get video metadata
      const metadata = await this.getVideoMetadata(videoId);
      
      // Get transcript if available
      const transcript = await this.getTranscript(videoId);
      
      // Create content from available data
      const content = this.buildVideoContent(metadata, transcript);
      
      // Generate AI tags and insights
      const [tags, keyPhrases] = await Promise.all([
        OpenAIService.generateTags(content, 10),
        OpenAIService.extractKeyPhrases(content, 12)
      ]);
      
      // Store as document
      const documentId = await DocumentModel.create({
        title: metadata.title,
        content: content,
        sourceType: 'youtube',
        sourceUrl: metadata.url,
        metadata: {
          videoId: metadata.id,
          channelTitle: metadata.channelTitle,
          channelId: metadata.channelId,
          publishedAt: metadata.publishedAt,
          duration: metadata.duration,
          viewCount: metadata.viewCount,
          likeCount: metadata.likeCount,
          tags: [...(metadata.tags || []), ...tags],
          keyPhrases,
          thumbnails: metadata.thumbnails,
          hasTranscript: transcript?.available || false,
          ...options.additionalMetadata
        }
      });
      
      // Generate and store embedding
      const embedding = await OpenAIService.generateEmbedding(
        content.substring(0, 8000)
      );
      await DocumentModel.updateEmbedding(documentId, embedding);
      
      return {
        documentId,
        video: metadata,
        transcript: transcript,
        tags,
        keyPhrases
      };
      
    } catch (error) {
      logger.logError(error, { videoId, videoUrl });
      throw error;
    }
  }
  
  /**
   * Analyze video content with AI
   */
  async analyzeVideo(videoUrl, analysisType = 'general') {
    const videoId = this.extractVideoId(videoUrl);
    
    try {
      // Get video data
      const metadata = await this.getVideoMetadata(videoId);
      const transcript = await this.getTranscript(videoId);
      const content = this.buildVideoContent(metadata, transcript);
      
      // Perform AI analysis
      const analysis = await OpenAIService.analyzeContent(content, analysisType);
      
      // Get related videos for context
      const relatedVideos = await this.getRelatedVideos(videoId, 3);
      
      return {
        video: metadata,
        analysis: analysis.content,
        relatedVideos,
        insights: {
          engagement: this.calculateEngagementScore(metadata),
          topics: await OpenAIService.extractKeyPhrases(content, 10),
          sentiment: this.analyzeSentiment(metadata)
        }
      };
      
    } catch (error) {
      logger.logError(error, { videoId, analysisType });
      throw error;
    }
  }
  
  /**
   * Research topic across YouTube
   */
  async researchTopic(topic, maxVideos = 10) {
    try {
      // Search for videos on the topic
      const videos = await this.searchVideos(topic, maxVideos);
      
      // Process each video
      const processedVideos = [];
      for (const video of videos) {
        try {
          const metadata = await this.getVideoMetadata(video.videoId);
          const analysis = await OpenAIService.analyzeContent(
            this.buildVideoContent(metadata, null),
            'research'
          );
          
          processedVideos.push({
            ...metadata,
            analysis: analysis.content
          });
          
        } catch (error) {
          logger.error('Failed to process video in research', { 
            videoId: video.videoId,
            error: error.message 
          });
        }
      }
      
      // Generate research summary
      const summary = await OpenAIService.summarizeDocuments(
        processedVideos.map(v => ({
          title: v.title,
          content: v.analysis,
          source_type: 'youtube',
          source_url: v.url
        })),
        `Research summary for topic: ${topic}`,
        { temperature: 0.3 }
      );
      
      return {
        topic,
        videosAnalyzed: processedVideos.length,
        videos: processedVideos,
        summary: summary.content,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.logError(error, { topic, maxVideos });
      throw error;
    }
  }
  
  /**
   * Helper: Build content string from video data
   */
  buildVideoContent(metadata, transcript) {
    let content = `Title: ${metadata.title}\n\n`;
    content += `Channel: ${metadata.channelTitle}\n`;
    content += `Published: ${metadata.publishedAt}\n`;
    content += `Duration: ${metadata.duration}\n`;
    content += `Views: ${metadata.viewCount.toLocaleString()}\n`;
    content += `Likes: ${metadata.likeCount.toLocaleString()}\n\n`;
    content += `Description:\n${metadata.description}\n\n`;
    
    if (metadata.tags && metadata.tags.length > 0) {
      content += `Tags: ${metadata.tags.join(', ')}\n\n`;
    }
    
    if (transcript && transcript.text) {
      content += `Transcript:\n${transcript.text}\n`;
    } else if (transcript && transcript.available) {
      content += `Note: Transcript available in ${transcript.language}\n`;
    }
    
    return content;
  }
  
  /**
   * Helper: Parse ISO 8601 duration
   */
  parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    
    const hours = (match[1] || '').replace('H', '') || '0';
    const minutes = (match[2] || '').replace('M', '') || '0';
    const seconds = (match[3] || '').replace('S', '') || '0';
    
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  }
  
  /**
   * Helper: Calculate engagement score
   */
  calculateEngagementScore(metadata) {
    if (metadata.viewCount === 0) return 0;
    
    const likeRatio = metadata.likeCount / metadata.viewCount;
    const commentRatio = metadata.commentCount / metadata.viewCount;
    
    // Weighted engagement score
    const score = (likeRatio * 0.7 + commentRatio * 0.3) * 100;
    
    return {
      score: Math.min(score, 100).toFixed(2),
      likeRatio: (likeRatio * 100).toFixed(2),
      commentRatio: (commentRatio * 100).toFixed(2),
      rating: score > 5 ? 'High' : score > 2 ? 'Medium' : 'Low'
    };
  }
  
  /**
   * Helper: Basic sentiment analysis
   */
  analyzeSentiment(metadata) {
    const likeRatio = metadata.likeCount / (metadata.likeCount + 1); // Avoid division by zero
    
    return {
      positive: likeRatio > 0.95,
      ratio: likeRatio.toFixed(3),
      sentiment: likeRatio > 0.95 ? 'Very Positive' : 
                 likeRatio > 0.85 ? 'Positive' :
                 likeRatio > 0.75 ? 'Mixed' : 'Negative'
    };
  }
}

export default new YouTubeService();