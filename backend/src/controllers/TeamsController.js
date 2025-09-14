import TeamsService from '../services/TeamsService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

class TeamsController {
  getTodaysMeetings = asyncHandler(async (req, res) => {
    if (!req.session?.accessToken) {
      return res.status(401).json({
        message: 'Not authenticated. Go to /api/auth/login'
      });
    }
    
    try {
      const userEmail = req.session.userEmail || req.session.userPrincipalName;
      const events = await TeamsService.getCachedMeetings(userEmail);

      res.json({
        count: events.length,
        events: events,
        meetings: events.map(event => ({
          subject: event.subject,
          start: event.start,
          end: event.end,
          duration: event.duration,
        }))
      });
      
    } catch (error) {
      if (error.message.includes('401')) {
        return res.status(401).json({ message: 'Login expired. Go to /api/auth/login' });
      }
      
      res.status(500).json({ message: 'Failed to get meetings' });
    }
  });



}

export default new TeamsController();