import React, { useState } from 'react';
import './Navbar.css';

export default function Navbar({ onStartAudit }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (sectionId) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="navbar-wrapper">
      <div className="pg-container navbar-container">
        {/* Brand Logo */}
        <a href="#hero" className="navbar-brand" onClick={(e) => { e.preventDefault(); handleNavClick('hero'); }}>
          <div className="brand-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <span className="brand-title">PatternGuard</span>
          <span className="brand-tag">FT-04</span>
        </a>

        {/* Desktop Navigation */}
        <nav className={`navbar-nav ${mobileMenuOpen ? 'nav-open' : ''}`}>
          <a
            href="#overview"
            className="nav-link"
            onClick={(e) => { e.preventDefault(); handleNavClick('overview'); }}
          >
            Overview
          </a>
          <a
            href="#how-it-works"
            className="nav-link"
            onClick={(e) => { e.preventDefault(); handleNavClick('how-it-works'); }}
          >
            How It Works
          </a>
          <a
            href="#audit-section"
            className="nav-link"
            onClick={(e) => { e.preventDefault(); handleNavClick('audit-section'); }}
          >
            Audit Workspace
          </a>
          <button
            type="button"
            className="nav-btn-primary mobile-only-btn"
            onClick={() => { setMobileMenuOpen(false); onStartAudit(); }}
          >
            Start an Audit
          </button>
        </nav>

        {/* Action Button & Mobile Hamburger */}
        <div className="navbar-actions">
          <button
            type="button"
            className="nav-btn-primary desktop-only-btn"
            onClick={onStartAudit}
          >
            Start an Audit
          </button>

          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className={`hamburger-bar ${mobileMenuOpen ? 'bar-top' : ''}`}></span>
            <span className={`hamburger-bar ${mobileMenuOpen ? 'bar-mid' : ''}`}></span>
            <span className={`hamburger-bar ${mobileMenuOpen ? 'bar-bot' : ''}`}></span>
          </button>
        </div>
      </div>
    </header>
  );
}
