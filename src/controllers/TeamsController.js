import TeamsService from '../services/TeamsService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

class TeamsController {
  getTodaysMeetings = asyncHandler(async (req, res) => {
    // Check auth
    if (!req.session?.accessToken) {
      return res.status(401).json({
        message: 'Not authenticated. Go to /api/auth/login'
      });
    }
    
    try {
      // Today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Get events
      const events = await TeamsService.getUserCalendarEvents('me', {
        startTime: today.toISOString(),
        endTime: tomorrow.toISOString(),
        userToken: req.session.accessToken
      });
      
      // Simple response
      res.json({
        date: today.toDateString(),
        count: events.length,
        meetings: events.map(event => ({
          subject: event.subject,
          start: event.start,
          duration: event.duration,
          isOnline: event.isOnlineMeeting,
          organizer: event.organizer?.name
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