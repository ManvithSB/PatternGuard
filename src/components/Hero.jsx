import React from 'react';
import './Hero.css';

export default function Hero({ onStartAudit }) {
  const handleScrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="hero" className="hero-section">
      <div className="pg-container hero-container">
        {/* Pill Badge */}
        <div className="hero-badge">
          <span className="badge-dot"></span>
          <span>FT-04 Project • Fintech Compliance & UX Ethics</span>
        </div>

        {/* Main Headline */}
        <h1 className="hero-headline">
          Audit & Eliminate <span className="highlight-text">Dark Patterns</span> in Fintech Interfaces
        </h1>

        {/* Description */}
        <p className="hero-description">
          PatternGuard inspects digital financial workflows—from checkout screens and credit disclosures to subscription cancellation funnels—identifying manipulative UI patterns that mislead consumers and violate consumer protection regulations.
        </p>

        {/* CTA Group */}
        <div className="hero-cta-group">
          <button
            type="button"
            className="btn-primary-large"
            onClick={onStartAudit}
          >
            <span>Start an Audit</span>
            <svg
              className="btn-arrow-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          <button
            type="button"
            className="btn-secondary-large"
            onClick={handleScrollToHowItWorks}
          >
            <span>Learn How It Works</span>
          </button>
        </div>

        {/* Trust & Key Metrics Bar */}
        <div className="hero-metrics-bar">
          <div className="metric-item">
            <span className="metric-number">30+</span>
            <span className="metric-label">Fintech Dark Patterns</span>
          </div>
          <div className="metric-divider"></div>
          <div className="metric-item">
            <span className="metric-number">100%</span>
            <span className="metric-label">Client-Side Scanned</span>
          </div>
          <div className="metric-divider"></div>
          <div className="metric-item">
            <span className="metric-number">FTC & CFPB</span>
            <span className="metric-label">Compliance Taxonomy</span>
          </div>
        </div>
      </div>
    </section>
  );
}
