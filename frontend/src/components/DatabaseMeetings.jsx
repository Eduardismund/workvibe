import { useState } from 'react';
import api from '../utils/api';

function DatabaseMeetings({ authToken }) {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const fetchMeetingsFromDB = async () => {
    setIsLoading(true);
    setStatus(null);

    try {
      const response = await api.get('/teams/today');
      
      if (response.data.events && response.data.events.length > 0) {
        setMeetings(response.data.events);
        setStatus(`Successfully loaded ${response.data.events.length} meetings from database`);
      } else if (response.data.events) {
        setMeetings([]);
        setStatus('No meetings found in database for today');
      } else {
        setStatus('Unable to retrieve meetings data');
      }
    } catch (error) {
      console.error('Error fetching meetings from DB:', error);
      if (error.response && error.response.status === 401) {
        setStatus('Please authenticate first to access meetings');
      } else {
        setStatus('Failed to fetch meetings from database');
      }
      setMeetings([]);
    }

    setIsLoading(false);
  };

  return (
    <div className="database-meetings">
      <div className="db-controls">
        <button 
          onClick={fetchMeetingsFromDB}
          disabled={isLoading}
          className="db-fetch-button"
        >
          {isLoading ? 'Loading Meetings...' : 'Get Meetings from Database'}
        </button>
      </div>

      {status && (
        <p className={
          status.includes('Successfully') ? 'success' : 
          status.includes('No meetings') ? 'warning' : 
          'error'
        }>
          {status}
        </p>
      )}

      {meetings.length > 0 && (
        <div className="db-meetings-section">
          <h3>📅 Meetings from Database ({meetings.length})</h3>
          <div className="meetings-grid">
            {meetings.map((meeting, index) => (
              <div key={meeting.id || index} className="db-meeting-card">
                <div className="meeting-header">
                  <h4>{meeting.subject || 'No Subject'}</h4>
                  {meeting.duration && (
                    <span className="duration-badge">{meeting.duration} min</span>
                  )}
                </div>
                
                <div className="meeting-times">
                  <div className="time-item">
                    <span className="time-label">Start:</span>
                    <span className="time-value">
                      {new Date(meeting.start).toLocaleString()}
                    </span>
                  </div>
                  <div className="time-item">
                    <span className="time-label">End:</span>
                    <span className="time-value">
                      {new Date(meeting.end).toLocaleString()}
                    </span>
                  </div>
                </div>

                {meeting.description && (
                  <div className="meeting-description">
                    <span className="description-label">Description:</span>
                    <p>{meeting.description}</p>
                  </div>
                )}

                {meeting.meetingId && (
                  <div className="meeting-id">
                    <span className="id-label">Meeting ID:</span>
                    <code>{meeting.meetingId}</code>
                  </div>
                )}

                {meeting.organizer && (
                  <div className="meeting-organizer">
                    <span className="organizer-label">Organizer:</span>
                    <span>{meeting.organizer}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatabaseMeetings;