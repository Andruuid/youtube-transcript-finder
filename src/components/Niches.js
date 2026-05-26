import React, { useState } from 'react';
import { NICHE_MARKETS } from '../data/nicheMarkets';
import NicheMindMap from './NicheMindMap';
import './Niches.css';

export default function Niches() {
  const [activeMarketId, setActiveMarketId] = useState('health');
  const activeMarket =
    NICHE_MARKETS.find((m) => m.id === activeMarketId) ?? NICHE_MARKETS[0];

  return (
    <div className="niches-view">
      <div className="niches-toolbar">
        <div>
          <h2 className="niches-heading">Niches</h2>
          <p className="niches-subheading">
            Explore markets, niches, sub-niches, and micro-niches. Click labels
            to expand or collapse branches.
          </p>
        </div>
      </div>

      <div className="niches-market-pills" role="tablist" aria-label="Markets">
        {NICHE_MARKETS.map((market) => (
          <button
            key={market.id}
            type="button"
            role="tab"
            aria-selected={activeMarketId === market.id}
            className={
              activeMarketId === market.id
                ? 'niches-market-pill niches-market-pill-active'
                : 'niches-market-pill'
            }
            style={
              activeMarketId === market.id
                ? {
                    '--pill-accent': market.accentColor,
                    '--pill-accent-light': market.accentColorLight
                  }
                : { '--pill-accent': market.accentColor }
            }
            onClick={() => setActiveMarketId(market.id)}
          >
            {market.label}
          </button>
        ))}
      </div>

      <p className="niches-hint">
        Drag to pan, scroll to zoom, click pills to expand or collapse. Use Expand
        all / Collapse all on the map, or the copy icon to copy a niche name.
      </p>

      {activeMarket.root ? (
        <div className="niches-tree-card">
          <NicheMindMap
            key={activeMarket.id}
            root={activeMarket.root}
            accentColor={activeMarket.accentColor}
          />
        </div>
      ) : (
        <div
          className="niches-placeholder-card"
          style={{ '--placeholder-accent': activeMarket.accentColor }}
        >
          <span
            className="niches-placeholder-swatch"
            aria-hidden
          />
          <h3 className="niches-placeholder-title">{activeMarket.label}</h3>
          <p className="niches-placeholder-text">Tree coming soon</p>
          <p className="niches-placeholder-sub">
            The {activeMarket.label.toLowerCase()} niche map will be added in a
            future update.
          </p>
        </div>
      )}
    </div>
  );
}
