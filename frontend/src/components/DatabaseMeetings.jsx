import { useState, useEffect } from 'react';
import api from '../utils/api';

function TeamsMeetings({ authToken, meetings: propMeetings, onMeetingsChange }) {
  const [meetings, setMeetings] = useState(propMeetings || []);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null);

  // Update local state when prop changes
  useEffect(() => {
    if (propMeetings) {
      setMeetings(propMeetings);
    }
  }, [propMeetings]);

  const fetchMeetings = async () => {
    setIsLoading(true);
    setStatus(null);

    try {
      const response = await api.get('/teams/today');
      
      if (response.data.events && response.data.events.length > 0) {
        console.log('Meeting data received:', response.data.events);
        setMeetings(response.data.events);
        if (onMeetingsChange) {
          onMeetingsChange(response.data.events);
        }
        setStatus(`Successfully loaded ${response.data.events.length} meetings`);
      } else if (response.data.events) {
        setMeetings([]);
        if (onMeetingsChange) {
          onMeetingsChange([]);
        }
        setStatus('No meetings found for today');
      } else {
        setStatus('Unable to retrieve meetings data');
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      if (error.response && error.response.status === 401) {
        setStatus('Please authenticate first to access meetings');
      } else {
        setStatus('Failed to fetch meetings');
      }
      setMeetings([]);
    }

    setIsLoading(false);
  };

  return (
    <div className="teams-meetings">
      {meetings.length === 0 && (
        <div className="meeting-controls">
          <button 
            onClick={fetchMeetings}
            disabled={isLoading}
            className="fetch-button"
          >
            {isLoading ? 'Loading Meetings...' : 'Get Today\'s Meetings'}
          </button>
        </div>
      )}

      {meetings.length > 0 ? (
        <div className="meetings-section">
          <div className="meetings-grid">
            {meetings.map((meeting, index) => (
              <div key={meeting.id || index} className="meeting-card">
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
                      {(() => {
                        // Try to parse the date, checking for different possible fields
                        const startTime = meeting.start || meeting.startTime || meeting.start_time;
                        if (startTime) {
                          const date = new Date(startTime);
                          if (!isNaN(date.getTime())) {
                            return date.toLocaleString();
                          }
                        }
                        return 'Time not available';
                      })()}
                    </span>
                  </div>
                  <div className="time-item">
                    <span className="time-label">End:</span>
                    <span className="time-value">
                      {(() => {
                        // Try to parse the date, checking for different possible fields
                        const endTime = meeting.end || meeting.endTime || meeting.end_time;
                        if (endTime) {
                          const date = new Date(endTime);
                          if (!isNaN(date.getTime())) {
                            return date.toLocaleString();
                          }
                        }
                        return 'Time not available';
                      })()}
                    </span>
                  </div>
                </div>


              </div>
            ))}
          </div>
        </div>
      ) : (
        status && status.includes('No meetings') && (
          <p className="warning">{status}</p>
        )
      )}
    </div>
  );
}

export default TeamsMeetings;