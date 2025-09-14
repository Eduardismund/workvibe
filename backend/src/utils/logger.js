import winston from 'winston';
import config from '../config/index.js';
import fs from 'fs';
import path from 'path';

const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length) {
      log += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
    }
    
    if (stack) {
      log += `\nStack: ${stack}`;
    }
    
    return log;
  })
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'tidb-agentx' },
  transports: [
    new winston.transports.File({ 
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: config.logging.file.replace('.log', '.error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 3
    })
  ]
});

if (config.env === 'development') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${level}: ${message}`;
        
        if (Object.keys(meta).length && meta.service !== 'tidb-agentx') {
          log += ` ${JSON.stringify(meta)}`;
        }
        
        if (stack) {
          log += `\n${stack}`;
        }
        
        return log;
      })
    )
  }));
}


logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context
  });
};

export default logger;