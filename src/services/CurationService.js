import OpenAI from 'openai';
import { connect } from '@tidbcloud/serverless';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import TeamsService from './TeamsService.js';
import EmotionService from './EmotionService.js';
import YouTubeService from './YouTubeService.js';

class CurationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    
    this.conn = connect({
      url: config.database.url
    });
  }

  /**
   * Initialize TiDB tables for vector storage
   */

  /**
   * Generate embeddings using OpenAI
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', error);
      throw error;
    }
  }
  /**
   * Search for similar videos using cosine similarity (manual calculation)
   */
  async findSimilarVideos(contextEmbedding, limit = 10) {
    try {
      // Since we're using JSON for embeddings, we need to fetch all and calculate similarity manually
      // This is less efficient but works without native vector support
      const query = `
        SELECT 
          video_id,
          title,
          description,
          tags,
          duration,
          metadata,
          embedding
        FROM video_embeddings
        WHERE duration <= 60 AND embedding IS NOT NULL
        LIMIT 100
      `;
      
      const results = await this.conn.execute(query);
      
      // Handle different result formats from TiDB serverless
      const rows = results.rows || results;
      
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        logger.info('No video embeddings found in TiDB - table may be empty', { 
          resultsType: typeof results, 
          rowCount: rows?.length || 0,
          resultsKeys: Object.keys(results || {}) 
        });
        return [];
      }
      
      // Calculate cosine similarity manually
      const videosWithSimilarity = rows.map(row => {
        try {
          const videoEmbedding = JSON.parse(row.embedding);
          const similarity = this.calculateCosineSimilarity(contextEmbedding, videoEmbedding);
          return {
            ...row,
            distance: 1 - similarity // Convert similarity to distance
          };
        } catch (e) {
          // Skip invalid embeddings
          return null;
        }
      }).filter(Boolean);
      
      // Sort by similarity (lowest distance = highest similarity)
      videosWithSimilarity.sort((a, b) => a.distance - b.distance);
      
      return videosWithSimilarity.slice(0, limit);
    } catch (error) {
      logger.error('Failed to find similar videos', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateCosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
  /**
   * Get content preferences based on context using AI analysis
   */
  async getContentPreferences(contextData) {
    const { emotions, energyLevel, meetings, environment = {}, description, timestamp } = contextData;
    
    // Let AI analyze the full context and decide preferences
    const contextPrompt = `Analyze this user's current state and generate YouTube content preferences:

USER CONTEXT:
- Emotion: ${emotions.dominant || emotions.dominantEmotion} (confidence: ${emotions.confidence}%)
- Energy Level: ${energyLevel}
- Stress Level: ${meetings.stressLevel}
- Meetings Today: ${meetings.count}
- Meeting Topics: ${meetings.topics?.join(', ') || 'none'}
- User Description: "${description}"
- Time: ${new Date(timestamp).toLocaleTimeString()}
- Environment: ${environment.location || 'unspecified'}

TASK:
Generate content preferences for YouTube Shorts that will:
1. Match their current emotional state
2. Support their energy level 
3. Consider their stress and workload
4. Align with their context and description

Return a JSON object with:
{
  "categories": ["category1", "category2"],
  "keywords": ["keyword1", "keyword2"], 
  "avoid": ["avoid1", "avoid2"],
  "reasoning": "Why these preferences fit the user's state"
}

Focus on YouTube content categories like: productivity, education, comedy, music, nature, lifestyle, cooking, tech, motivation, relaxation, etc.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: contextPrompt }],
        max_tokens: 300,
        temperature: 0.7
      });

      const aiResponse = response.choices[0].message.content;
      
      // Parse AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const preferences = JSON.parse(jsonMatch[0]);
        preferences.duration = 'short'; // Always shorts
        
        logger.info('AI-generated content preferences', { 
          emotion: emotions.dominant, 
          preferences: preferences.categories?.join(', '),
          reasoning: preferences.reasoning?.substring(0, 100) + '...'
        });
        
        return preferences;
      } else {
        throw new Error('AI response not in expected JSON format');
      }
      
    } catch (error) {
      logger.error('AI preference generation failed, using fallback', error);
      
      // Fallback to basic preferences
      return {
        categories: ['lifestyle', 'productivity', 'education'],
        keywords: ['tips', 'peaceful', 'focus'],
        avoid: ['drama', 'intense'],
        duration: 'short',
        reasoning: 'Fallback preferences due to AI analysis error'
      };
    }
  }

  /**
   * Search YouTube Shorts based on preferences
   */

  /**
   * Parse ISO 8601 duration to seconds
   */
  parseDuration(duration) {
    if (!duration) return 0;
    const match = duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const minutes = parseInt(match[1] || 0);
    const seconds = parseInt(match[2] || 0);
    return minutes * 60 + seconds;
  }

  /**
   * Store video embeddings in TiDB
   */
  async storeVideoEmbeddings(videos) {
    logger.info('Storing video embeddings', { videoCount: videos.length });
    
    for (const video of videos) {
      try {
        // Check if already exists
        const existing = await this.conn.execute(
          'SELECT id FROM video_embeddings WHERE video_id = ?',
          [video.videoId]
        );
        
        const existingRows = existing.rows || existing;
        if (existingRows && existingRows.length > 0) continue;

        // Generate embedding for video
        const videoText = `${video.title} ${video.description} ${video.tags?.join(' ') || ''}`;
        const embedding = await this.generateEmbedding(videoText);

        // Store in TiDB
        await this.conn.execute(
          `INSERT INTO video_embeddings 
           (video_id, title, description, tags, duration, embedding, metadata) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            video.videoId,
            video.title,
            video.description,
            JSON.stringify(video.tags || []),
            this.parseDuration(video.duration),
            JSON.stringify(embedding),
            JSON.stringify(video)
          ]
        );
      } catch (error) {
        logger.error(`Failed to store embedding for video ${video.videoId}`, error);
      }
    }
  }


  /**
   * Store curation history for learning
   */
  async storeCurationHistory(userId, contextEmbedding, recommendations) {
    try {
      await this.conn.execute(
        `INSERT INTO curation_history 
         (user_id, context_embedding, recommended_videos) 
         VALUES (?, ?, ?)`,
        [
          userId,
          JSON.stringify(contextEmbedding),
          JSON.stringify(recommendations.map(v => v.video_id))
        ]
      );
    } catch (error) {
      logger.error('Failed to store curation history', error);
    }
  }

}

export default new CurationService();