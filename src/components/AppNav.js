import React from 'react';
import './AppNav.css';

export const APP_VIEWS = [
  { id: 'channels', label: 'Channel monitor' },
  { id: 'search', label: 'Search' },
  { id: 'audio', label: 'Audio download' }
];

export function viewSubtitle(viewId) {
  switch (viewId) {
    case 'search':
      return 'Search for YouTube videos with available transcripts';
    case 'channels':
      return 'Persistent channel library with downloaded transcript tracking';
    case 'audio':
      return 'Download a YouTube video as MP3 audio (server uses yt-dlp)';
    default:
      return '';
  }
}

export default function AppNav({ activeId, onChange }) {
  return (
    <nav className="app-nav" aria-label="Main views">
      <div className="app-nav-inner">
        {APP_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={
              activeId === v.id ? 'app-tab app-tab-active' : 'app-tab'
            }
            onClick={() => onChange(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
