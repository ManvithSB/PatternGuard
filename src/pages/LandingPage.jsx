import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import HowItWorks from '../components/HowItWorks';
import AuditUpload from '../components/AuditUpload';
import Footer from '../components/Footer';
import './LandingPage.css';

export default function LandingPage() {
  const scrollToAuditSection = () => {
    const section = document.getElementById('audit-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page-root">
      {/* Navigation Header */}
      <Navbar onStartAudit={scrollToAuditSection} />

      {/* Main Content Area */}
      <main className="landing-main-content">
        <Hero onStartAudit={scrollToAuditSection} />
        <HowItWorks />
        <AuditUpload />
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
