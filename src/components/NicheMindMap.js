import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Tree from 'react-d3-tree';
import { toD3TreeData } from '../data/nicheMarkets';
import './NicheMindMap.css';

function getNodeWidth(nodeDatum) {
  const w = nodeDatum?.attributes?.nodeWidth;
  return typeof w === 'number' ? w : 140;
}

/** Curved links from parent right edge to child left edge (horizontal tree). */
function nicheLinkPath(link, orientation) {
  if (orientation !== 'horizontal') {
    const { source, target } = link;
    return `M${source.x},${source.y}L${target.x},${target.y}`;
  }

  const sourceWidth = getNodeWidth(link.source.data);
  const sx = link.source.y + sourceWidth;
  const sy = link.source.x;
  const tx = link.target.y;
  const ty = link.target.x;
  const mid = sx + (tx - sx) * 0.55;

  return `M${sx},${sy} C${mid},${sy} ${mid},${ty} ${tx},${ty}`;
}

function CustomNicheNode({ nodeDatum, toggleNode, accentColor, onCopy, copiedId }) {
  const depth = nodeDatum.__rd3t?.depth ?? 0;
  const hasChildren = Boolean(nodeDatum.children?.length);
  const collapsed = nodeDatum.__rd3t?.collapsed;
  const nodeId = nodeDatum.attributes?.id || nodeDatum.name;
  const label = nodeDatum.name;
  const width = getNodeWidth(nodeDatum);
  const height = 34;
  const isCopied = copiedId === nodeId;
  const isRoot = depth === 0;
  const isBranch = depth === 1;

  const handleLabelClick = (e) => {
    e.stopPropagation();
    if (hasChildren) toggleNode();
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(label);
      onCopy(nodeId);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (hasChildren) toggleNode();
    }
  };

  return (
    <g className="niche-tree-node">
      <foreignObject
        width={width}
        height={height}
        x={0}
        y={-height / 2}
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className={[
            'niche-tree-pill',
            `niche-tree-pill-depth-${Math.min(depth, 4)}`,
            isRoot ? 'niche-tree-pill-root' : '',
            isBranch ? 'niche-tree-pill-branch' : '',
            hasChildren && collapsed ? 'niche-tree-pill-collapsed' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ '--node-accent': accentColor, width: `${width}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="niche-tree-pill-chevron"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand branch' : 'Collapse branch'}
              onClick={(e) => {
                e.stopPropagation();
                toggleNode();
              }}
            >
              {collapsed ? '▸' : '▾'}
            </button>
          ) : null}
          <button
            type="button"
            className="niche-tree-pill-label"
            aria-expanded={hasChildren ? !collapsed : undefined}
            onClick={handleLabelClick}
            onKeyDown={hasChildren ? handleKeyDown : undefined}
          >
            {label}
          </button>
          <button
            type="button"
            className="niche-tree-pill-copy"
            title="Copy niche label"
            aria-label={`Copy "${label}"`}
            onClick={handleCopy}
          >
            {isCopied ? '✓' : '⎘'}
          </button>
        </div>
      </foreignObject>
    </g>
  );
}

const EXPANSION_DEPTH = {
  default: 2,
  collapsed: 0,
  expanded: 100
};

export default function NicheMindMap({ root, accentColor }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [translate, setTranslate] = useState({ x: 80, y: 200 });
  const [copiedId, setCopiedId] = useState(null);
  const [expansion, setExpansion] = useState('default');

  const treeData = useMemo(() => toD3TreeData(root), [root]);
  const initialDepth = EXPANSION_DEPTH[expansion] ?? 2;
  const isFullyCollapsed = expansion === 'collapsed';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const updateSize = () => {
      const { width, height } = el.getBoundingClientRect();
      setDimensions({ width, height });
      setTranslate({ x: 88, y: height / 2 });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!copiedId) return undefined;
    const t = window.setTimeout(() => setCopiedId(null), 2000);
    return () => window.clearTimeout(t);
  }, [copiedId]);

  const pathClassFunc = useCallback((link) => {
    const d = link.target.depth ?? 0;
    return `niche-tree-link niche-tree-link-d${Math.min(d, 5)}`;
  }, []);

  const renderCustomNodeElement = useCallback(
    (rd3tProps) => (
      <CustomNicheNode
        {...rd3tProps}
        accentColor={accentColor}
        onCopy={setCopiedId}
        copiedId={copiedId}
      />
    ),
    [accentColor, copiedId]
  );

  const handleExpandAll = () => setExpansion('expanded');
  const handleCollapseAll = () => setExpansion('collapsed');
  const handleResetExpansion = () => setExpansion('default');

  const ready = dimensions.width > 0 && dimensions.height > 0;

  return (
    <div
      ref={containerRef}
      className="niche-mindmap-canvas"
      style={{ '--niche-accent': accentColor }}
    >
      <div className="niche-mindmap-toolbar">
        <button
          type="button"
          className="niche-mindmap-toolbar-btn"
          onClick={handleExpandAll}
          disabled={expansion === 'expanded'}
        >
          Expand all
        </button>
        <button
          type="button"
          className="niche-mindmap-toolbar-btn"
          onClick={handleCollapseAll}
          disabled={isFullyCollapsed}
        >
          Collapse all
        </button>
        {expansion !== 'default' ? (
          <button
            type="button"
            className="niche-mindmap-toolbar-btn niche-mindmap-toolbar-btn-muted"
            onClick={handleResetExpansion}
          >
            Reset view
          </button>
        ) : null}
      </div>

      {ready ? (
        <Tree
          key={expansion}
          data={treeData}
          dataKey={expansion}
          orientation="horizontal"
          translate={translate}
          dimensions={dimensions}
          collapsible
          initialDepth={initialDepth}
          zoomable
          draggable
          hasInteractiveNodes
          pathFunc={nicheLinkPath}
          pathClassFunc={pathClassFunc}
          separation={{ siblings: 1.15, nonSiblings: 1.4 }}
          nodeSize={{ x: 340, y: 44 }}
          scaleExtent={{ min: 0.2, max: 2 }}
          renderCustomNodeElement={renderCustomNodeElement}
          svgClassName="niche-tree-svg"
        />
      ) : null}
    </div>
  );
}
