import { useState } from 'react';
import TeamsAuth from './components/TeamsAuth';
import DatabaseMeetings from './components/DatabaseMeetings';
import LikedVideos from './components/LikedVideos';
import ContextAnalyzer from './components/ContextAnalyzer';
import VideoResults from './components/VideoResults';
import './App.css';

function App() {
  const [authToken, setAuthToken] = useState(null);
  const [filteredVideos, setFilteredVideos] = useState(null);
  const [ingestionResult, setIngestionResult] = useState(null);
  const [likedVideos, setLikedVideos] = useState([]);

  return (
    <div className="App">
      <div className="container">
        <div className="teams-container">
          <div className="section">
            <h2>Teams</h2>
            <TeamsAuth onAuthSuccess={setAuthToken} />
            <DatabaseMeetings authToken={authToken} />
          </div>
          
          <div className="section">
            <h2>❤️ Liked Videos</h2>
            <LikedVideos 
              likedVideos={likedVideos}
              onLikedVideosChange={setLikedVideos}
            />
          </div>
        </div>

        <div className="section">
          <h2>Analysis</h2>
          <ContextAnalyzer 
            onFilteredVideos={setFilteredVideos}
            onIngestionResult={setIngestionResult}
            likedVideos={likedVideos}
            onLikedVideosChange={setLikedVideos}
            showResults={false}
          />
        </div>

        <div className="section results-section">
          <h2>Results</h2>
          <VideoResults 
            filteredVideos={filteredVideos}
            ingestionResult={ingestionResult}
            likedVideos={likedVideos}
            onLikedVideosChange={setLikedVideos}
          />
        </div>
      </div>
    </div>
  );
}

export default App
