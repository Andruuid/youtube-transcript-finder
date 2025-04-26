import React, { useState } from 'react';
import './App.css';
import { searchVideos, getVideoDetails, getChannelInfo, getVideoTranscript } from './services/youtubeService';
import { processTranscript } from './services/geminiService';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [minFollowers, setMinFollowers] = useState(100000);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTranscript, setActiveTranscript] = useState(null);
  const [processedTranscript, setProcessedTranscript] = useState(null);

  const handleSearch = async () => {
    if (!searchTerm) {
      setError('Please enter a search term');
      return;
    }

    setLoading(true);
    setError('');
    setVideos([]);
    setActiveTranscript(null);
    setProcessedTranscript(null);
    
    try {
      // First, search for videos with the search term in the title
      const searchData = await searchVideos(searchTerm);
      if (!searchData.items || searchData.items.length === 0) {
        setError('No videos found matching your search term');
        setLoading(false);
        return;
      }
      
      const videoIds = searchData.items.map(item => item.id.videoId).join(',');
      
      // Then, get detailed information about these videos
      const videosData = await getVideoDetails(videoIds);
      
      // Filter videos by subscriber count and has captions
      const filteredVideos = videosData.items.filter(video => {
        // Check if the video has captions
        const hasCaptions = video.contentDetails.caption === 'true';
        return hasCaptions;
      });
      
      // For each video, check if the channel has enough subscribers
      const videoPromises = filteredVideos.map(async (video) => {
        const channelId = video.snippet.channelId;
        try {
          const channelData = await getChannelInfo(channelId);
          const subscriberCount = parseInt(channelData.items[0].statistics.subscriberCount);
          
          if (subscriberCount >= minFollowers) {
            return {
              ...video,
              channelSubscribers: subscriberCount
            };
          }
        } catch (err) {
          console.error(`Error fetching channel data for ${channelId}:`, err);
        }
        
        return null;
      });
      
      const resolvedVideos = await Promise.all(videoPromises);
      const validVideos = resolvedVideos.filter(video => video !== null);
      
      setVideos(validVideos);
      
      if (validVideos.length === 0) {
        setError('No videos found with available transcripts and minimum follower count');
      }
    } catch (err) {
      setError('Error fetching videos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscript = async (videoId) => {
    try {
      setActiveTranscript({ videoId, loading: true });
      setProcessedTranscript(null);
      
      const transcript = await getVideoTranscript(videoId);
      
      setActiveTranscript({ 
        videoId, 
        loading: false, 
        text: transcript 
      });
    } catch (err) {
      setActiveTranscript({ 
        videoId, 
        loading: false, 
        error: 'Failed to load transcript' 
      });
    }
  };

  const handleProcessTranscript = async (videoId, transcript) => {
    try {
      setProcessedTranscript({ loading: true });
      
      const processed = await processTranscript(transcript);
      
      setProcessedTranscript({
        loading: false,
        text: processed
      });
    } catch (err) {
      setProcessedTranscript({
        loading: false,
        error: 'Failed to process transcript'
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>YouTube Transcript Finder</h1>
        <p>Search for YouTube videos with available transcripts</p>
      </header>
      
      <main className="App-main">
        <div className="search-container">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter search term..."
            className="search-input"
          />
          
          <div className="followers-filter">
            <label htmlFor="minFollowers">Minimum followers:</label>
            <input
              type="number"
              id="minFollowers"
              value={minFollowers}
              onChange={(e) => setMinFollowers(Number(e.target.value))}
              min="0"
              step="1000"
              className="followers-input"
            />
          </div>
          
          <button 
            onClick={handleSearch} 
            className="search-button"
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="results-container">
          {videos.length > 0 ? (
            <div className="video-grid">
              {videos.map((video) => (
                <div key={video.id} className="video-card">
                  <img 
                    src={video.snippet.thumbnails.medium.url} 
                    alt={video.snippet.title}
                    className="video-thumbnail" 
                  />
                  <div className="video-info">
                    <h3 className="video-title">{video.snippet.title}</h3>
                    <p className="channel-name">{video.snippet.channelTitle}</p>
                    <p className="subscriber-count">
                      {video.channelSubscribers.toLocaleString()} subscribers
                    </p>
                    <div className="video-actions">
                      <a 
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="watch-button"
                      >
                        Watch Video
                      </a>
                      <button 
                        onClick={() => fetchTranscript(video.id)}
                        className="transcript-button"
                      >
                        View Transcript
                      </button>
                    </div>
                    
                    {activeTranscript && activeTranscript.videoId === video.id && (
                      <div className="transcript-container">
                        {activeTranscript.loading ? (
                          <p>Loading transcript...</p>
                        ) : activeTranscript.error ? (
                          <p className="error-message">{activeTranscript.error}</p>
                        ) : (
                          <div className="transcript-text">
                            <h4>Transcript</h4>
                            <pre>{activeTranscript.text}</pre>
                            
                            <div className="transcript-actions">
                              <button 
                                onClick={() => handleProcessTranscript(video.id, activeTranscript.text)}
                                className="process-button"
                              >
                                Process with Gemini
                              </button>
                            </div>
                            
                            {processedTranscript && (
                              <div className="processed-transcript">
                                {processedTranscript.loading ? (
                                  <p>Processing transcript...</p>
                                ) : processedTranscript.error ? (
                                  <p className="error-message">{processedTranscript.error}</p>
                                ) : (
                                  <div>
                                    <h4>Processed Transcript</h4>
                                    <pre>{processedTranscript.text}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !loading && (
            <p className="no-results">
              {searchTerm ? 'No videos found. Try a different search term or lower the follower threshold.' : 'Enter a search term to find videos.'}
            </p>
          )}
        </div>
      </main>
      
      <footer className="App-footer">
        <p>YouTube Transcript Finder &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
