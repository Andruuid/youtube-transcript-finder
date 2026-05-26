import React from 'react';
import './AppNav.css';

export const APP_VIEWS = [
  { id: 'channels', label: 'Channel monitor' },
  { id: 'library', label: 'Transcript library' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'niches', label: 'Niches' },
  { id: 'search', label: 'Search' }
];

export function viewSubtitle(viewId) {
  switch (viewId) {
    case 'search':
      return 'Search for YouTube videos with available transcripts';
    case 'channels':
      return 'Persistent channel library with downloaded transcript tracking';
    case 'library':
      return 'Browse downloaded transcripts by channel';
    case 'ideas':
      return 'Saved video ideas with star ratings';
    case 'niches':
      return 'Explore health, wealth, and relationship markets and niches';
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
