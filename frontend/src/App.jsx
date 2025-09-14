import { useState, useEffect } from 'react';
import TeamsAuth from './components/TeamsAuth';
import TeamsMeetings from './components/DatabaseMeetings';
import LikedVideos from './components/LikedVideos';
import ContextAnalyzer from './components/ContextAnalyzer';
import VideoResults from './components/VideoResults';
import MemeDisplay from './components/MemeDisplay';
import RefreshFeed from './components/RefreshFeed';
import api, { getContentStats } from './utils/api';
import './App.css';

function App() {
  const [authToken, setAuthToken] = useState(null);
  const [filteredVideos, setFilteredVideos] = useState(null);
  const [ingestionResult, setIngestionResult] = useState(null);
  const [likedVideos, setLikedVideos] = useState([]);
  const [selfieFile, setSelfieFile] = useState(null);
  const [description, setDescription] = useState('');
  const [generatedMeme, setGeneratedMeme] = useState(null);
  const [isGeneratingMeme, setIsGeneratingMeme] = useState(false);
  const [memeError, setMemeError] = useState(null);
  const [currentView, setCurrentView] = useState('setup'); // 'setup' or 'results'
  const [lastFilterHash, setLastFilterHash] = useState(null);
  const [lastIngestionHash, setLastIngestionHash] = useState(null);
  const [contentStats, setContentStats] = useState({ videos: 0, memes: 0 });
  const [showRefreshFeed, setShowRefreshFeed] = useState(false);
  const [teamsMeetings, setTeamsMeetings] = useState([]);
  const [hasIngestedRecommendations, setHasIngestedRecommendations] = useState(false);
  const [hasRefreshedFeed, setHasRefreshedFeed] = useState(false);

  const fetchContentStats = async () => {
    try {
      const response = await getContentStats();
      if (response.status === 'success') {
        setContentStats(response.data);
      }
    } catch (error) {
    }
  };

  useEffect(() => {
    fetchContentStats();
  }, []);

  const handleResetWatchHistory = async () => {
    if (!window.confirm('Are you sure you want to reset all watch history? This will mark all videos as unwatched.')) {
      return;
    }

    try {
      const response = await api.post('/ingest/reset-watched', {});
      if (response.data.status === 'success') {
        alert(`Successfully reset watch history for ${response.data.data.videosReset} videos`);
      }
    } catch (error) {
      alert('Failed to reset watch history. Please try again.');
    }
  };

  const handleRefreshFeed = async () => {
    if (!selfieFile || !description) {
      alert('Unable to refresh feed. Selfie and description are required.');
      return;
    }

    const videoIds = filteredVideos?.filteredVideos?.slice(0, 20).map(v => v.video_id || v.videoId) || [];
    
    if (videoIds.length === 0) {
      alert('No videos to refresh');
      return;
    }

    try {
      const resetResponse = await api.post('/ingest/reset-watched', { videoIds });
      const formData = new FormData();
      formData.append('selfie', selfieFile);
      formData.append('description', description);
      
      const filterResponse = await api.post('/agent/filter', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (filterResponse.data.data) {
        setFilteredVideos(filterResponse.data.data);
        setShowRefreshFeed(false);
        setHasRefreshedFeed(true);
        return true;
      }
    } catch (error) {
      alert('Failed to refresh feed. Please try again.');
      return false;
    }
  };

  const handleFilterVideos = (videos) => {
    setFilteredVideos(videos);
    setCurrentView('results');
  };

  const handleBackToSetup = () => {
    setCurrentView('setup');
    setGeneratedMeme(null);
    setMemeError(null);
  };

  return (
    <div className="App">
      <div className={`container ${currentView === 'setup' ? 'setup-view' : 'results-view'}`}>
        {currentView === 'setup' && (
          <div className="setup-container-new-layout">
            <div className="logo-column">
              <div className="logo-section-compact">
                <img src="/workvibe.png" alt="WorkVibe" className="main-logo-compact"/>
                <div className="flow-explanation-compact">
                  <h3>AI-Powered Video Curation</h3>
                  <p className="logo-description">
                    WorkVibe analyzes your mood and meeting context to recommend the perfect videos that match your
                    current energy and enhance your work experience.
                  </p>
                  <div className="content-stats">
                    <p className="stats-header">The Database stores:</p>
                    <div className="stat-item">
                      <i className="fas fa-video"></i>
                      <span className="stat-number">{contentStats.videos.toLocaleString()}</span>
                      <span className="stat-label">Videos</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item">
                      <i className="fas fa-images"></i>
                      <span className="stat-number">{contentStats.memes.toLocaleString()}</span>
                      <span className="stat-label">Memes</span>
                    </div>
                  </div>
                  <button className="reset-watch-button" onClick={handleResetWatchHistory}>
                    <i className="fas fa-history"></i>
                    <span>Reset Watch History</span>
                  </button>
                  
                  <div className="teams-connection-section">
                    <h3><i className="fab fa-microsoft"></i> Teams Connection</h3>
                    <TeamsAuth onAuthSuccess={setAuthToken}/>
                  </div>
                </div>
              </div>
            </div>

            <div className="right-section">
              <div className="journey-section">
                <div className="workflow-section-right">
                  <div className="flow-steps-simple">
                    <div className="flow-step-simple">
                      <i className="fas fa-portrait"></i>
                      <span>Upload Selfie</span>
                    </div>
                    <div className="flow-arrow-simple"><i className="fas fa-arrow-right"></i></div>
                    <div className="flow-step-simple">
                      <i className="fas fa-edit"></i>
                      <span>Describe Mood</span>
                    </div>
                    <div className="flow-arrow-simple"><i className="fas fa-arrow-right"></i></div>
                    <div className="flow-step-simple">
                      <i className="fab fa-microsoft"></i>
                      <span>Connect Teams</span>
                    </div>
                    <div className="flow-arrow-simple"><i className="fas fa-arrow-right"></i></div>
                    <div className="flow-step-simple">
                      <i className="fas fa-video"></i>
                      <span>Filter Videos</span>
                    </div>
                    <div className="flow-arrow-simple"><i className="fas fa-arrow-right"></i></div>
                    <div className="flow-step-simple">
                      <i className="fas fa-magic"></i>
                      <span>Generate Meme</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="content-sections">
                <div className="analysis-column">
                  <div className="section analysis-section">
                    <h2>
                      <i className="fas fa-chart-line"></i> Mood Analysis
                      {(filteredVideos || ingestionResult) && (
                          <span className="cache-indicator cached">Cached Data Available</span>
                      )}
                    </h2>
                    <ContextAnalyzer
                        onFilteredVideos={handleFilterVideos}
                        onIngestionResult={setIngestionResult}
                        likedVideos={likedVideos}
                        onLikedVideosChange={setLikedVideos}
                        onSelfieChange={setSelfieFile}
                        onDescriptionChange={setDescription}
                        showResults={false}
                        filteredVideos={filteredVideos}
                        ingestionResult={ingestionResult}
                        selfieFile={selfieFile}
                        description={description}
                        lastFilterHash={lastFilterHash}
                        onFilterHashChange={setLastFilterHash}
                        lastIngestionHash={lastIngestionHash}
                        onIngestionHashChange={setLastIngestionHash}
                        onStatsRefresh={fetchContentStats}
                    />
                  </div>
                </div>

                <div className="teams-column">
                  <div className="section teams-section">
                    <h2><i className="fas fa-calendar-day"></i> Today's Meetings</h2>
                    <TeamsMeetings 
                      authToken={authToken}
                      meetings={teamsMeetings}
                      onMeetingsChange={setTeamsMeetings}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'results' && (
          <div className="results-container-new-layout">
            <div className="results-logo-column">
              <div className="logo-only-section">
                <img src="/workvibe.png" alt="WorkVibe" className="results-logo-only"/>
                <button
                    onClick={handleBackToSetup}
                    className="back-button-compact"
                >
                  <i className="fas fa-arrow-left"></i> Back
                </button>
              </div>
              
              <div className="section liked-videos-section">
                <h2><i className="fas fa-heart"></i> Liked Videos</h2>
                <LikedVideos
                    likedVideos={likedVideos}
                    onLikedVideosChange={setLikedVideos}
                    onLikedVideosIngested={(result) => {
                      setShowRefreshFeed(true);
                      setHasIngestedRecommendations(true);
                      setHasRefreshedFeed(false);
                      fetchContentStats();
                    }}
                />
              </div>
              
              <div className="section refresh-feed-section">
                <h2><i className="fas fa-sync-alt"></i> Feed Management</h2>
                <RefreshFeed 
                  hasIngestedRecommendations={hasIngestedRecommendations && !hasRefreshedFeed}
                  onRefreshFeed={handleRefreshFeed}
                />
              </div>
            </div>

            <div className="results-content-sections">
              <div className="videos-column">
                <div className="section results-section">
                  <h2><i className="fas fa-video"></i> Recommended Videos</h2>
                  <VideoResults
                      filteredVideos={filteredVideos}
                      ingestionResult={ingestionResult}
                      likedVideos={likedVideos}
                      onLikedVideosChange={setLikedVideos}
                      selfieFile={selfieFile}
                      description={description}
                      onMemeGenerated={setGeneratedMeme}
                      onMemeGenerating={setIsGeneratingMeme}
                      onMemeError={setMemeError}
                  />
                </div>
              </div>
              
              <div className="meme-column">
                <div className="section meme-section">
                  <h2><i className="fas fa-magic"></i> Generated Meme</h2>
                  <MemeDisplay 
                    generatedMeme={generatedMeme}
                    isGenerating={isGeneratingMeme}
                    memeError={memeError}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App
