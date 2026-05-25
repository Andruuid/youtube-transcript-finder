import React from 'react';
import { normalizeStructuredSummary } from '../utils/structuredSummaryUtils';
import './StructuredSummaryViewer.css';

function TagList({ items, className = '' }) {
  if (!items?.length) return null;
  return (
    <ul className={`structured-summary-tags ${className}`.trim()}>
      {items.map((item) => (
        <li key={item} className="structured-summary-tag">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children, className = '' }) {
  if (!children) return null;
  return (
    <section className={`structured-summary-section ${className}`.trim()}>
      <h3 className="structured-summary-section-title">{title}</h3>
      <div className="structured-summary-section-body">{children}</div>
    </section>
  );
}

function TextBlock({ text }) {
  if (!text) return null;
  return <p className="structured-summary-text">{text}</p>;
}

export default function StructuredSummaryViewer({ summary, importedAt }) {
  const data = normalizeStructuredSummary(summary);
  if (!data) {
    return (
      <p className="structured-summary-empty">
        Structured summary data could not be parsed for this video.
      </p>
    );
  }

  const hasProductDetails =
    data.productDescription.whatItIs ||
    data.productDescription.howItWorks ||
    data.productDescription.businessModel ||
    data.productDescription.techStack.length > 0;

  const hasOrigin =
    data.originStory.inspiration ||
    data.originStory.validation ||
    data.originStory.timeline;

  const hasMarketing =
    data.marketing.channels.length > 0 ||
    data.marketing.strategies.length > 0 ||
    data.marketing.keyTactics ||
    data.marketing.growthType;

  return (
    <div className="structured-summary-viewer">
      <div className="structured-summary-hero">
        <div className="structured-summary-hero-main">
          {data.productName && (
            <p className="structured-summary-product-name">{data.productName}</p>
          )}
          {data.videoTitle && data.videoTitle !== data.productName && (
            <p className="structured-summary-video-title">{data.videoTitle}</p>
          )}
        </div>
        <div className="structured-summary-hero-badges">
          {data.revenueHighlight && (
            <span className="structured-summary-badge structured-summary-badge-revenue">
              {data.revenueHighlight}
            </span>
          )}
          {data.marketing.growthType && (
            <span className="structured-summary-badge structured-summary-badge-niche">
              {data.marketing.growthType}
            </span>
          )}
        </div>
        {importedAt && (
          <p className="structured-summary-imported-at">
            Imported {new Date(importedAt).toLocaleString()}
          </p>
        )}
      </div>

      {data.problemSolved && (
        <div className="structured-summary-callout structured-summary-problem">
          <h3 className="structured-summary-callout-title">Problem solved</h3>
          <p className="structured-summary-text">{data.problemSolved}</p>
        </div>
      )}

      {hasProductDetails && (
        <Section title="Product" className="structured-summary-card">
          <TextBlock text={data.productDescription.whatItIs} />
          {data.productDescription.howItWorks && (
            <>
              <h4 className="structured-summary-subtitle">How it works</h4>
              <TextBlock text={data.productDescription.howItWorks} />
            </>
          )}
          {data.productDescription.businessModel && (
            <>
              <h4 className="structured-summary-subtitle">Business model</h4>
              <TextBlock text={data.productDescription.businessModel} />
            </>
          )}
          {data.productDescription.techStack.length > 0 && (
            <>
              <h4 className="structured-summary-subtitle">Tech stack</h4>
              <TagList items={data.productDescription.techStack} />
            </>
          )}
        </Section>
      )}

      {hasOrigin && (
        <Section title="Origin story" className="structured-summary-card">
          {data.originStory.inspiration && (
            <>
              <h4 className="structured-summary-subtitle">Inspiration</h4>
              <TextBlock text={data.originStory.inspiration} />
            </>
          )}
          {data.originStory.validation && (
            <>
              <h4 className="structured-summary-subtitle">Validation</h4>
              <TextBlock text={data.originStory.validation} />
            </>
          )}
          {data.originStory.timeline && (
            <>
              <h4 className="structured-summary-subtitle">Timeline</h4>
              <TextBlock text={data.originStory.timeline} />
            </>
          )}
        </Section>
      )}

      {hasMarketing && (
        <Section title="Marketing" className="structured-summary-card">
          {data.marketing.growthType && (
            <p className="structured-summary-meta-line">
              <span className="structured-summary-meta-label">Growth type</span>
              {data.marketing.growthType}
            </p>
          )}
          {data.marketing.channels.length > 0 && (
            <>
              <h4 className="structured-summary-subtitle">Channels</h4>
              <TagList items={data.marketing.channels} className="structured-summary-tags-soft" />
            </>
          )}
          {data.marketing.strategies.length > 0 && (
            <>
              <h4 className="structured-summary-subtitle">Strategies</h4>
              <TagList items={data.marketing.strategies} className="structured-summary-tags-soft" />
            </>
          )}
          {data.marketing.keyTactics && (
            <>
              <h4 className="structured-summary-subtitle">Key tactics</h4>
              <TextBlock text={data.marketing.keyTactics} />
            </>
          )}
        </Section>
      )}

      {data.founderLessons && (
        <blockquote className="structured-summary-quote">
          <h3 className="structured-summary-quote-title">Founder lessons</h3>
          <p className="structured-summary-text">{data.founderLessons}</p>
        </blockquote>
      )}
    </div>
  );
}
