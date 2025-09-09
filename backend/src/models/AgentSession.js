import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class AgentSessionModel {
  static async create({ name, userContext = {}, workflowType = 'document_analysis' }) {
    const conn = getConnection();
    const sessionId = uuidv4();
    
    try {
      await conn.execute(`
        INSERT INTO agent_sessions (id, name, user_context, workflow_type, status)
        VALUES (?, ?, ?, ?, 'active')
      `, [sessionId, name, JSON.stringify(userContext), workflowType]);
      
      logger.info(`Agent session created: ${sessionId}`, { name, workflowType });
      return sessionId;
    } catch (error) {
      logger.logError(error, { name, workflowType });
      throw error;
    }
  }
  
  static async findById(sessionId) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT * FROM agent_sessions WHERE id = ?
      `, [sessionId]);
      
      const session = result.rows[0];
      if (session && session.user_context) {
        session.user_context = typeof session.user_context === 'string' 
          ? JSON.parse(session.user_context) 
          : session.user_context;
      }
      
      return session || null;
    } catch (error) {
      logger.logError(error, { sessionId });
      throw error;
    }
  }
  
  static async updateProgress(sessionId, totalSteps, completedSteps = null) {
    const conn = getConnection();
    
    try {
      let sql = `
        UPDATE agent_sessions 
        SET total_steps = ?, updated_at = CURRENT_TIMESTAMP
      `;
      const params = [totalSteps];
      
      if (completedSteps !== null) {
        sql += ', completed_steps = ?';
        params.push(completedSteps);
      }
      
      sql += ' WHERE id = ?';
      params.push(sessionId);
      
      await conn.execute(sql, params);
      
      logger.logAgentAction(sessionId, completedSteps || 0, 'PROGRESS_UPDATE', {
        totalSteps,
        completedSteps
      });
      
      return true;
    } catch (error) {
      logger.logError(error, { sessionId, totalSteps, completedSteps });
      throw error;
    }
  }
  
  static async updateStatus(sessionId, status) {
    const conn = getConnection();
    
    try {
      await conn.execute(`
        UPDATE agent_sessions 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, sessionId]);
      
      logger.info(`Session status updated: ${sessionId} -> ${status}`);
      return true;
    } catch (error) {
      logger.logError(error, { sessionId, status });
      throw error;
    }
  }
  
  static async logAction(sessionId, stepNumber, actionType, toolName = null, inputData = {}, outputData = {}, executionTimeMs = null, status = 'success', errorMessage = null) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        INSERT INTO agent_actions 
        (session_id, step_number, action_type, tool_name, input_data, output_data, execution_time_ms, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sessionId,
        stepNumber,
        actionType,
        toolName,
        JSON.stringify(inputData),
        JSON.stringify(outputData),
        executionTimeMs,
        status,
        errorMessage
      ]);
      
      // Update session progress
      await conn.execute(`
        UPDATE agent_sessions 
        SET completed_steps = (
          SELECT COUNT(*) FROM agent_actions 
          WHERE session_id = ? AND status = 'success'
        )
        WHERE id = ?
      `, [sessionId, sessionId]);
      
      logger.logAgentAction(sessionId, stepNumber, actionType, {
        toolName,
        status,
        executionTimeMs
      });
      
      return result.insertId;
    } catch (error) {
      logger.logError(error, { sessionId, stepNumber, actionType });
      throw error;
    }
  }
  
  static async getActions(sessionId, limit = 50) {
    const conn = getConnection();
    
    try {
      const result = await conn.execute(`
        SELECT * FROM agent_actions
        WHERE session_id = ?
        ORDER BY step_number ASC, timestamp ASC
        LIMIT ?
      `, [sessionId, limit]);
      
      return result.rows.map(row => ({
        ...row,
        input_data: typeof row.input_data === 'string' ? JSON.parse(row.input_data) : row.input_data,
        output_data: typeof row.output_data === 'string' ? JSON.parse(row.output_data) : row.output_data
      }));
    } catch (error) {
      logger.logError(error, { sessionId });
      throw error;
    }
  }
  
  static async getSessionSummary(sessionId) {
    const conn = getConnection();
    
    try {
      const sessionResult = await conn.execute(`
        SELECT s.*, 
               COUNT(a.id) as total_actions,
               SUM(CASE WHEN a.status = 'success' THEN 1 ELSE 0 END) as successful_actions,
               SUM(CASE WHEN a.status = 'error' THEN 1 ELSE 0 END) as failed_actions,
               AVG(a.execution_time_ms) as avg_execution_time
        FROM agent_sessions s
        LEFT JOIN agent_actions a ON s.id = a.session_id
        WHERE s.id = ?
        GROUP BY s.id
      `, [sessionId]);
      
      const session = sessionResult.rows[0];
      if (!session) return null;
      
      // Parse JSON fields
      session.user_context = typeof session.user_context === 'string' 
        ? JSON.parse(session.user_context) 
        : session.user_context;
      
      // Get recent actions
      session.recent_actions = await this.getActions(sessionId, 10);
      
      return session;
    } catch (error) {
      logger.logError(error, { sessionId });
      throw error;
    }
  }
  
  static async list({ status = null, workflowType = null, limit = 20, offset = 0 } = {}) {
    const conn = getConnection();
    
    try {
      let sql = `
        SELECT s.*, 
               COUNT(a.id) as total_actions,
               SUM(CASE WHEN a.status = 'success' THEN 1 ELSE 0 END) as successful_actions
        FROM agent_sessions s
        LEFT JOIN agent_actions a ON s.id = a.session_id
        WHERE 1=1
      `;
      const params = [];
      
      if (status) {
        sql += ' AND s.status = ?';
        params.push(status);
      }
      
      if (workflowType) {
        sql += ' AND s.workflow_type = ?';
        params.push(workflowType);
      }
      
      sql += `
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
      
      const result = await conn.execute(sql, params);
      
      return result.rows.map(row => ({
        ...row,
        user_context: typeof row.user_context === 'string' ? JSON.parse(row.user_context) : row.user_context
      }));
    } catch (error) {
      logger.logError(error, { status, workflowType });
      throw error;
    }
  }
  
  static async getStats() {
    const conn = getConnection();
    
    try {
      // First check if table exists, if not create it
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS agent_sessions (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255),
          workflow_type VARCHAR(255),
          status ENUM('active', 'completed', 'failed') DEFAULT 'active',
          user_context JSON,
          completed_steps INT DEFAULT 0,
          total_steps INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_workflow (workflow_type),
          INDEX idx_created (created_at)
        )
      `);

      const result = await conn.execute(`
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_sessions,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_sessions,
          AVG(completed_steps) as avg_steps_completed,
          COUNT(DISTINCT workflow_type) as workflow_types
        FROM agent_sessions
      `);
      
      return result.rows?.[0] || {
        total_sessions: 0,
        active_sessions: 0,
        completed_sessions: 0,
        failed_sessions: 0,
        avg_steps_completed: 0,
        workflow_types: 0
      };
    } catch (error) {
      logger.logError(error);
      // Return default stats if there's any error
      return {
        total_sessions: 0,
        active_sessions: 0,
        completed_sessions: 0,
        failed_sessions: 0,
        avg_steps_completed: 0,
        workflow_types: 0
      };
    }
  }
}

export default AgentSessionModel;