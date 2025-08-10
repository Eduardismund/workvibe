import OpenAI from 'openai';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }
  
  async generateEmbedding(text, model = null) {
    const startTime = Date.now();
    
    try {
      const response = await this.client.embeddings.create({
        model: model || config.openai.embeddingModel,
        input: text,
        encoding_format: 'float'
      });
      
      const duration = Date.now() - startTime;
      logger.logApiCall('OpenAI', 'embeddings', duration, 200);
      
      return response.data[0].embedding;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('OpenAI', 'embeddings', duration, error.status || 500);
      logger.logError(error, { text: text.substring(0, 100) });
      throw error;
    }
  }
  
  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    const defaultOptions = {
      model: config.openai.model,
      temperature: 0.7,
      max_tokens: 2000,
      ...options
    };
    
    try {
      const response = await this.client.chat.completions.create({
        messages,
        ...defaultOptions
      });
      
      const duration = Date.now() - startTime;
      logger.logApiCall('OpenAI', 'chat/completions', duration, 200);
      
      return {
        content: response.choices[0].message.content,
        usage: response.usage,
        model: response.model,
        finishReason: response.choices[0].finish_reason
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('OpenAI', 'chat/completions', duration, error.status || 500);
      logger.logError(error, { messageCount: messages.length });
      throw error;
    }
  }
  
  async summarizeDocuments(documents, query, options = {}) {
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant specialized in analyzing and summarizing documents. 
                Your task is to provide comprehensive summaries that are accurate, relevant, and well-structured.
                Focus on key insights, relationships between documents, and actionable information.`
    };
    
    const userMessage = {
      role: 'user',
      content: `Based on the following documents, please provide a comprehensive analysis for this query: "${query}"
      
Documents:
${documents.map((doc, idx) => `
${idx + 1}. Title: ${doc.title}
   Source: ${doc.source_type}${doc.source_url ? ` (${doc.source_url})` : ''}
   Similarity: ${doc.similarity ? (doc.similarity * 100).toFixed(1) + '%' : 'N/A'}
   Content: ${doc.content ? doc.content.substring(0, 1000) : 'No content available'}...
`).join('\n')}

Please structure your response with:
1. **Executive Summary** - Key findings in 2-3 sentences
2. **Detailed Analysis** - Main insights from the documents
3. **Document Relationships** - How the documents relate to each other
4. **Recommendations** - Actionable next steps or suggestions
5. **Source Summary** - Brief description of each document's contribution`
    };
    
    return await this.chat([systemMessage, userMessage], {
      temperature: 0.3,
      max_tokens: 3000,
      ...options
    });
  }
  
  async analyzeContent(content, analysisType = 'general', options = {}) {
    const analysisPrompts = {
      general: 'Analyze this content and provide key insights, themes, and important information.',
      technical: 'Perform a technical analysis focusing on implementation details, architecture, and best practices.',
      research: 'Conduct a research-oriented analysis highlighting key findings, methodologies, and conclusions.',
      educational: 'Create an educational summary that breaks down complex concepts into understandable parts.',
      creative: 'Provide a creative analysis focusing on innovative ideas, unique approaches, and potential applications.'
    };
    
    const systemMessage = {
      role: 'system',
      content: `You are an expert content analyst. Your role is to provide thorough, 
                insightful analysis that extracts maximum value from the given content.
                Be objective, comprehensive, and actionable in your analysis.`
    };
    
    const userMessage = {
      role: 'user',
      content: `${analysisPrompts[analysisType] || analysisPrompts.general}
      
Content to analyze:
${content}

Please provide:
1. **Key Themes** - Main topics and concepts
2. **Important Details** - Critical information and data points  
3. **Insights** - Deeper understanding and implications
4. **Context** - Background and relevance
5. **Applications** - Practical uses and next steps`
    };
    
    return await this.chat([systemMessage, userMessage], {
      temperature: 0.4,
      max_tokens: 2500,
      ...options
    });
  }
  
  async generateTags(content, maxTags = 10) {
    const systemMessage = {
      role: 'system',
      content: 'Generate relevant tags for content classification. Return only a JSON array of strings.'
    };
    
    const userMessage = {
      role: 'user',
      content: `Generate ${maxTags} relevant tags for this content:

${content.substring(0, 2000)}

Return format: ["tag1", "tag2", "tag3", ...]`
    };
    
    try {
      const response = await this.chat([systemMessage, userMessage], {
        temperature: 0.3,
        max_tokens: 200
      });
      
      return JSON.parse(response.content);
    } catch (error) {
      logger.logError(error, { content: content.substring(0, 100) });
      return [];
    }
  }
  
  async extractKeyPhrases(content, maxPhrases = 15) {
    const systemMessage = {
      role: 'system',
      content: 'Extract key phrases and concepts from content. Return only a JSON array of strings.'
    };
    
    const userMessage = {
      role: 'user',
      content: `Extract ${maxPhrases} key phrases from this content:

${content.substring(0, 2000)}

Return format: ["phrase1", "phrase2", "phrase3", ...]`
    };
    
    try {
      const response = await this.chat([systemMessage, userMessage], {
        temperature: 0.2,
        max_tokens: 300
      });
      
      return JSON.parse(response.content);
    } catch (error) {
      logger.logError(error, { content: content.substring(0, 100) });
      return [];
    }
  }
}

export default new OpenAIService();