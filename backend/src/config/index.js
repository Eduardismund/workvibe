import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3002),
  
  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(4000),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(true),
  
  // OpenAI
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: Joi.string().default('text-embedding-ada-002'),
  
  // External APIs
  YOUTUBE_API_KEY: Joi.string().optional(),
  GOOGLE_SEARCH_API_KEY: Joi.string().optional(),
  GOOGLE_SEARCH_ENGINE_ID: Joi.string().optional(),
  
  // Microsoft Teams/Graph
  MICROSOFT_CLIENT_ID: Joi.string().optional(),
  MICROSOFT_CLIENT_SECRET: Joi.string().optional(),
  MICROSOFT_TENANT_ID: Joi.string().optional(),
  
  // Notion
  NOTION_TOKEN: Joi.string().optional(),
  NOTION_ROOT_PAGE_ID: Joi.string().optional(),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE: Joi.string().default('logs/app.log'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: Joi.number().default(15),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  
  // Analysis
  MAX_TRANSCRIPT_LENGTH: Joi.number().default(50000),
  MAX_RELATED_VIDEOS: Joi.number().default(5),
  SIMILARITY_THRESHOLD: Joi.number().default(0.7)
}).unknown();

const { error, value: envVars } = configSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  database: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    database: envVars.DB_NAME,
    ssl: envVars.DB_SSL ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : false,
    url: `mysql://${envVars.DB_USER}:${envVars.DB_PASSWORD}@${envVars.DB_HOST}:${envVars.DB_PORT}/${envVars.DB_NAME}?ssl={"rejectUnauthorized":true}`
  },
  
  openai: {
    apiKey: envVars.OPENAI_API_KEY,
    model: envVars.OPENAI_MODEL,
    embeddingModel: envVars.OPENAI_EMBEDDING_MODEL
  },
  
  external: {
    youtube: {
      apiKey: envVars.YOUTUBE_API_KEY
    },
    google: {
      searchApiKey: envVars.GOOGLE_SEARCH_API_KEY,
      searchEngineId: envVars.GOOGLE_SEARCH_ENGINE_ID
    },
    notion: {
      token: envVars.NOTION_TOKEN,
      rootPageId: envVars.NOTION_ROOT_PAGE_ID
    },
    microsoft: {
      clientId: envVars.MICROSOFT_CLIENT_ID,
      clientSecret: envVars.MICROSOFT_CLIENT_SECRET,
      tenantId: envVars.MICROSOFT_TENANT_ID,
      redirectUri: envVars.MICROSOFT_REDIRECT_URI || 'http://localhost:3002/api/auth/callback'
    }
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
    file: envVars.LOG_FILE
  },
  
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW * 60 * 1000,
    max: envVars.RATE_LIMIT_MAX_REQUESTS
  },
  
  analysis: {
    maxTranscriptLength: envVars.MAX_TRANSCRIPT_LENGTH,
    maxRelatedVideos: envVars.MAX_RELATED_VIDEOS,
    similarityThreshold: envVars.SIMILARITY_THRESHOLD
  }
};

export default config;