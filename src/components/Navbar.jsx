import React, { useState, useEffect } from 'react';
import './Navbar.css';

export default function Navbar({ onStartAudit }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themePref, setThemePref] = useState(() => {
    return localStorage.getItem('patternguard_theme') || 'system';
  });

  useEffect(() => {
    const applyTheme = (pref) => {
      let activeTheme = pref;
      if (pref === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', activeTheme);
      document.documentElement.setAttribute('data-theme-preference', pref);
      localStorage.setItem('patternguard_theme', pref);
    };

    applyTheme(themePref);

    // Listen to system changes if preference is system
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (themePref === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [themePref]);

  const handleThemeChange = (newPref) => {
    setThemePref(newPref);
  };

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

        {/* Action Button, Theme Switcher & Mobile Hamburger */}
        <div className="navbar-actions">
          {/* Theme Selector Pill */}
          <div className="theme-switcher-group" aria-label="Theme selector">
            <button
              type="button"
              className={`theme-btn ${themePref === 'light' ? 'active' : ''}`}
              title="Light Mode"
              aria-label="Light theme"
              onClick={() => handleThemeChange('light')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
            <button
              type="button"
              className={`theme-btn ${themePref === 'dark' ? 'active' : ''}`}
              title="Dark Mode"
              aria-label="Dark theme"
              onClick={() => handleThemeChange('dark')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
            <button
              type="button"
              className={`theme-btn ${themePref === 'system' ? 'active' : ''}`}
              title="System Theme"
              aria-label="System theme"
              onClick={() => handleThemeChange('system')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </button>
          </div>

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
