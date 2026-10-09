import React from 'react';
import './HowItWorks.css';

const STEPS = [
  {
    step: '01',
    badge: 'Step 1: Input',
    title: 'Upload Financial UI Screens',
    description:
      'Provide screenshots of your fintech workflow—such as checkout screens, subscription signups, loan disclosures, or cancellation flows.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    examples: ['Checkout Funnels', 'Credit Terms', 'Cancellation Modals'],
  },
  {
    step: '02',
    badge: 'Step 2: Analysis',
    title: 'Detect Deceptive Dark Patterns',
    description:
      'Our auditing engine identifies manipulative design tactics like pre-selected add-ons, countdown pressure, sneaky drip pricing, and disguised buttons.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <path d="m8 11 2 2 4-4" />
      </svg>
    ),
    examples: ['Pre-ticked Checkboxes', 'Confirmshaming', 'Hidden Drip Fees'],
  },
  {
    step: '03',
    badge: 'Step 3: Remediation',
    title: 'Generate Compliance Audit Report',
    description:
      'Receive a comprehensive risk assessment mapped to FTC, CFPB, and EU regulatory standards with actionable recommendations for ethical redesigns.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    examples: ['Severity Rating', 'Regulatory Citations', 'Ethical UI Fixes'],
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="how-it-works-section">
      <div className="pg-container">
        {/* Section Header */}
        <div className="section-header">
          <span className="section-eyebrow">Audit Workflow</span>
          <h2 className="section-title">How PatternGuard Audits Your Interface</h2>
          <p className="section-subtitle">
            A structured, 3-step audit methodology built to safeguard consumer trust and ensure compliance in digital finance.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="steps-grid">
          {STEPS.map((item) => (
            <div key={item.step} className="step-card">
              <div className="step-card-header">
                <div className="step-icon-wrapper">{item.icon}</div>
                <span className="step-number">{item.step}</span>
              </div>

              <span className="step-badge">{item.badge}</span>
              <h3 className="step-title">{item.title}</h3>
              <p className="step-description">{item.description}</p>

              <div className="step-tags-wrapper">
                {item.examples.map((example) => (
                  <span key={example} className="step-tag">
                    {example}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
