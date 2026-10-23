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
      <div className="pg-container hero-grid">
        {/* Left Content Column */}
        <div className="hero-content">
          {/* Pill Badge */}
          <div className="hero-badge">
            <span className="badge-dot"></span>
            <span>FT-04 • Fintech UI Integrity Guard</span>
          </div>

          {/* Main Headline */}
          <h1 className="hero-headline">
            Spot Dark Patterns <span className="highlight-text">Before They Influence</span> Decisions.
          </h1>

          {/* Description */}
          <p className="hero-description">
            PatternGuard inspects digital financial interfaces—from loan checkouts to subscription cancellations—detecting manipulative UI patterns, hidden fee drips, and deceptive disclosures under India's CCPA Guidelines 2023.
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
              <span>How It Works</span>
            </button>
          </div>

          {/* Framework Badges Bar */}
          <div className="hero-framework-bar">
            <span className="framework-bar-title">Detection Engine Rules:</span>
            <div className="framework-pills">
              <span className="framework-pill">False Urgency</span>
              <span className="framework-pill">Basket Sneaking</span>
              <span className="framework-pill">Drip Pricing</span>
              <span className="framework-pill">Confirmshaming</span>
            </div>
          </div>
        </div>

        {/* Right Cybersecurity Interface Inspection Visual */}
        <div className="hero-visual-col">
          <div className="inspection-card-frame">
            {/* Top Bar of Graphic Window */}
            <div className="frame-header-bar">
              <div className="window-dots">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
              </div>
              <div className="window-title">PatternGuard Scanner v2.4</div>
              <div className="live-status-chip">
                <span className="pulse-dot"></span>
                Active
              </div>
            </div>

            {/* Inner Content of Graphic Window */}
            <div className="frame-body">
              {/* Scan Beam Effect */}
              <div className="scan-laser-beam"></div>

              {/* Graphic Shield Icon Header */}
              <div className="graphic-shield-badge">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>

              <div className="inspection-target-box">
                <div className="target-line headline-skeleton"></div>
                <div className="target-line sub-skeleton"></div>
                
                {/* Simulated Risk Flag Box */}
                <div className="simulated-alert-box">
                  <div className="alert-header-row">
                    <span className="alert-type-badge">Potential Dark Pattern</span>
                    <span className="alert-severity-badge">High Severity</span>
                  </div>
                  <p className="alert-sample-text">
                    "Garantia Extendida agregada • ProcessingFee added at checkout"
                  </p>
                </div>
              </div>

              {/* Inspection Footer Metric */}
              <div className="frame-footer-stats">
                <div className="stat-node">
                  <span className="stat-val">RapidOCR</span>
                  <span className="stat-lbl">OCR Engine</span>
                </div>
                <div className="stat-node">
                  <span className="stat-val">CCPA 2023</span>
                  <span className="stat-lbl">Annexure 1</span>
                </div>
                <div className="stat-node">
                  <span className="stat-val">Client-Side</span>
                  <span className="stat-lbl">Privacy First</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
