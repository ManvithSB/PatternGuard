import React from 'react';
import './Footer.css';

const CURRENT_YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="footer-wrapper">
      <div className="pg-container footer-container">
        {/* Brand Column */}
        <div className="footer-brand-col">
          <div className="footer-brand-header">
            <div className="footer-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <span className="footer-brand-title">PatternGuard</span>
          </div>
          <p className="footer-brand-desc">
            A research & practical compliance tool dedicated to exposing deceptive dark patterns in financial user experiences. Developed for the FT-04 Project.
          </p>
          <div className="footer-status-pill">
            <span className="status-dot"></span>
            <span>Frontend Foundation Active • Phase 1</span>
          </div>
        </div>

        {/* Regulatory & Project Info */}
        <div className="footer-links-grid">
          <div className="footer-link-group">
            <h4 className="footer-group-title">Auditing Standards</h4>
            <ul className="footer-links-list">
              <li><span>FTC Deceptive Practices (Sec. 5)</span></li>
              <li><span>CFPB Circular 2023-01 (Negative Option)</span></li>
              <li><span>EU Digital Markets Act (DMA)</span></li>
              <li><span>Consumer Financial Protection Guidelines</span></li>
            </ul>
          </div>

          <div className="footer-link-group">
            <h4 className="footer-group-title">Pattern Types</h4>
            <ul className="footer-links-list">
              <li><span>Pre-checked Opt-in Checkboxes</span></li>
              <li><span>Hidden Drip Pricing & Fees</span></li>
              <li><span>Forced Continuity & Roach Motel</span></li>
              <li><span>Confirmshaming & Obstruction</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="pg-container footer-bottom">
        <p className="copyright-text">
          © {CURRENT_YEAR} PatternGuard (FT-04). Built for ethical fintech interface design & compliance auditing.
        </p>
        <p className="version-text">Vite + React (JavaScript) • Light Theme</p>
      </div>
    </footer>
  );
}
