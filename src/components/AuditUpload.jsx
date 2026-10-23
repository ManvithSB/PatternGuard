import React, { useState, useRef, useEffect } from 'react';
import './AuditUpload.css';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const DEFAULT_API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function AuditUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [auditScope, setAuditScope] = useState('full-funnel');
  const [scanMode, setScanMode] = useState('fast'); // 'fast' | 'deep_ai'
  const [apiBaseUrl, setApiBaseUrl] = useState(() => {
    return localStorage.getItem('patternguard_api_base') || DEFAULT_API_BASE;
  });
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverInput, setServerInput] = useState(() => {
    return localStorage.getItem('patternguard_api_base') || DEFAULT_API_BASE;
  });
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const fileInputRef = useRef(null);

  const handleSaveServer = (e) => {
    e.preventDefault();
    const cleanUrl = serverInput.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      localStorage.removeItem('patternguard_api_base');
      setApiBaseUrl(DEFAULT_API_BASE);
      setServerInput(DEFAULT_API_BASE);
    } else {
      localStorage.setItem('patternguard_api_base', cleanUrl);
      setApiBaseUrl(cleanUrl);
    }
    setShowServerSettings(false);
  };

  // Clean up Object URL when component unmounts or previewUrl changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '0 B';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const validateFile = (file) => {
    if (!file) {
      return { isValid: false, error: 'No file was selected.' };
    }

    const fileName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type);

    if (!hasValidExt && !hasValidMime) {
      return {
        isValid: false,
        error: `Unsupported file type "${file.name}". Please upload a PNG, JPG, or WEBP image.`,
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2);
      return {
        isValid: false,
        error: `File is too large (${sizeFormatted} MB). Maximum allowed size is 15 MB.`,
      };
    }

    return { isValid: true, error: null };
  };

  const processFile = (file) => {
    const validation = validateFile(file);

    if (!validation.isValid) {
      setStatusMessage({ text: validation.error, type: 'error' });
      return;
    }

    // Revoke previous URL if any
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setAuditResult(null);
    setStatusMessage({ text: '', type: '' });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleTriggerUpload = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleClearFile = () => {
    if (isUploading) return;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setAuditResult(null);
    setStatusMessage({ text: '', type: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRunScan = async () => {
    if (isUploading) return;

    if (!selectedFile) {
      setStatusMessage({
        text: 'Please choose or drag an interface screenshot first to initiate the audit.',
        type: 'error',
      });
      return;
    }

    const isAiEnabled = scanMode === 'deep_ai';
    setIsUploading(true);
    setAuditResult(null);
    setStatusMessage({
      text: isAiEnabled
        ? 'Running Deep Vision AI Scan (Ollama Moondream + OCR + CCPA rules)... This may take 60–90 seconds.'
        : 'Running Fast Scan (RapidOCR + CCPA rules)...',
      type: 'info',
    });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('enable_ai', isAiEnabled ? 'true' : 'false');

      const cleanBase = apiBaseUrl.trim().replace(/\/+$/, '');
      const url = `${cleanBase}/analyze?enable_ai=${isAiEnabled ? 'true' : 'false'}`;
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        let errorMsg = 'Failed to inspect screenshot.';
        if (response.status === 413) {
          errorMsg = (data && data.detail) || 'File is too large. Maximum allowed size is 15 MB.';
        } else if (response.status === 400) {
          errorMsg = (data && data.detail) || 'Invalid file type or unreadable image format.';
        } else if (data && data.detail) {
          errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        } else {
          errorMsg = `Server error (HTTP ${response.status}).`;
        }
        setAuditResult(null);
        setStatusMessage({ text: errorMsg, type: 'error' });
        return;
      }

      setAuditResult(data);

      if (data.findings_count > 0) {
        setStatusMessage({
          text: `Audit Complete: ${data.findings_count} potential dark-pattern indicator(s) identified. Review details below.`,
          type: 'warning',
        });
      } else if (data.scan_status === 'no_text_detected') {
        setStatusMessage({
          text: 'Audit Complete: No readable text detected in the uploaded screenshot.',
          type: 'info',
        });
      } else {
        setStatusMessage({
          text: 'Audit Complete: No deceptive dark-pattern indicators identified in the extracted text.',
          type: 'success',
        });
      }

      // Smooth scroll to audit results
      setTimeout(() => {
        const resultsEl = document.getElementById('audit-results-section');
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    } catch (err) {
      setAuditResult(null);
      setStatusMessage({
        text: `Cannot connect to backend server at ${apiBaseUrl}. Ensure FastAPI backend is running. If testing on an Android phone, set your PC's local Wi-Fi IP (e.g., http://192.168.1.X:8000) using the Server Settings below.`,
        type: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section id="audit-section" className="audit-upload-section">
      <div className="pg-container">
        {/* Section Title */}
        <div className="section-header">
          <span className="section-eyebrow">Audit Workspace</span>
          <h2 className="section-title">Upload Interface for Inspection</h2>
          <p className="section-subtitle">
            Upload single screens or entire checkout flows to test compliance against deceptive UX regulations.
          </p>
        </div>

        {/* Main Card Container */}
        <div className="audit-card-grid">
          {/* Upload Area Column */}
          <div className="upload-main-card">
            {/* Server Connection Bar for Android & Local Wi-Fi */}
            <div className="server-config-bar">
              <div className="server-status-pill">
                <span className="server-dot" />
                <span className="server-label">API Server:</span>
                <code className="server-url-text">{apiBaseUrl}</code>
              </div>
              <button
                type="button"
                className="btn-configure-server"
                onClick={() => setShowServerSettings(!showServerSettings)}
                title="Configure Backend Server Address for Android / Local Wi-Fi testing"
              >
                ⚙️ {showServerSettings ? 'Close' : 'Server Settings'}
              </button>
            </div>

            {showServerSettings && (
              <form className="server-settings-box" onSubmit={handleSaveServer}>
                <div className="server-input-group">
                  <label htmlFor="server-input" className="server-field-label">
                    Backend Base URL (enter PC's Wi-Fi IP for phone testing):
                  </label>
                  <div className="server-input-row">
                    <input
                      id="server-input"
                      type="text"
                      value={serverInput}
                      onChange={(e) => setServerInput(e.target.value)}
                      placeholder="http://192.168.1.X:8000"
                      className="server-text-input"
                    />
                    <button type="submit" className="btn-save-server">Save</button>
                    <button
                      type="button"
                      className="btn-reset-server"
                      onClick={() => {
                        setServerInput(DEFAULT_API_BASE);
                        localStorage.removeItem('patternguard_api_base');
                        setApiBaseUrl(DEFAULT_API_BASE);
                        setShowServerSettings(false);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <span className="server-help-text">
                    📱 Android phones cannot reach 127.0.0.1 on your computer. Enter your PC's Wi-Fi IP (e.g. http://192.168.1.50:8000).
                  </span>
                </div>
              </form>
            )}

            {/* Scope Selection */}
            <div className="scope-selection-wrapper">
              <label className="scope-label">Select Audit Scope:</label>
              <div className="scope-pills">
                <button
                  type="button"
                  className={`scope-pill ${auditScope === 'full-funnel' ? 'active' : ''}`}
                  onClick={() => setAuditScope('full-funnel')}
                >
                  Full Checkout Funnel
                </button>
                <button
                  type="button"
                  className={`scope-pill ${auditScope === 'subscription' ? 'active' : ''}`}
                  onClick={() => setAuditScope('subscription')}
                >
                  Subscription & Cancellation
                </button>
                <button
                  type="button"
                  className={`scope-pill ${auditScope === 'credit-terms' ? 'active' : ''}`}
                  onClick={() => setAuditScope('credit-terms')}
                >
                  Loan / APR Disclosures
                </button>
              </div>
            </div>

            {/* Scan Engine Mode Selector */}
            <div className="scope-selection-wrapper">
              <label className="scope-label">Inspection Engine Mode:</label>
              <div className="scope-pills">
                <button
                  type="button"
                  className={`scope-pill ${scanMode === 'fast' ? 'active' : ''}`}
                  onClick={() => setScanMode('fast')}
                  disabled={isUploading}
                >
                  ⚡ Fast Scan (OCR & Rules — Recommended)
                </button>
                <button
                  type="button"
                  className={`scope-pill ${scanMode === 'deep_ai' ? 'active' : ''}`}
                  onClick={() => setScanMode('deep_ai')}
                  disabled={isUploading}
                >
                  🧠 Deep Vision AI (Ollama Moondream)
                </button>
              </div>
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden-file-input"
              onChange={handleFileChange}
            />

            {/* Drag & Drop / Preview Zone */}
            {!selectedFile ? (
              <div
                className={`dropzone-container ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleTriggerUpload}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTriggerUpload();
                  }
                }}
                aria-label="Upload interface screenshot"
              >
                <div className="dropzone-empty-state">
                  <div className="dropzone-icon-circle">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <h4 className="dropzone-prompt">Drag & Drop fintech screenshot here</h4>
                  <p className="dropzone-subprompt">
                    or <span className="browse-link">browse from your computer</span>
                  </p>
                  <div className="dropzone-file-specs">
                    <span>Supports PNG, JPG, or WEBP</span>
                    <span>•</span>
                    <span>Max 15MB</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="preview-container">
                {/* Visual Image Preview */}
                <div className="preview-image-wrapper">
                  <img
                    src={previewUrl}
                    alt={selectedFile.name}
                    className="preview-image"
                  />
                  <span className="preview-type-badge">
                    {selectedFile.type ? selectedFile.type.split('/')[1]?.toUpperCase() : 'IMAGE'}
                  </span>
                </div>

                {/* File Details & Action Controls */}
                <div className="preview-meta-row">
                  <div className="preview-file-info">
                    <div className="file-info-icon">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                    </div>
                    <div className="preview-text-col">
                      <span className="preview-filename" title={selectedFile.name}>
                        {selectedFile.name}
                      </span>
                      <span className="preview-filesize">
                        {formatFileSize(selectedFile.size)} • Ready for audit
                      </span>
                    </div>
                  </div>

                  <div className="preview-btn-group">
                    <button
                      type="button"
                      className="btn-change-image"
                      onClick={handleTriggerUpload}
                      disabled={isUploading}
                      title="Choose a different image"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      className="btn-remove-image"
                      onClick={handleClearFile}
                      disabled={isUploading}
                      title="Remove image"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notification / Status Message */}
            {statusMessage.text && (
              <div className={`audit-status-banner ${statusMessage.type}`}>
                {statusMessage.type === 'error' && (
                  <svg
                    className="status-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                {statusMessage.type === 'warning' && (
                  <svg
                    className="status-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                {statusMessage.type === 'success' && (
                  <svg
                    className="status-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                )}
                {statusMessage.type === 'info' && (
                  <svg
                    className="status-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="upload-action-bar">
              <button
                type="button"
                className="btn-run-scan"
                onClick={handleRunScan}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>Scanning Interface...</span>
                  </>
                ) : (
                  <>
                    <span>Run Dark-Pattern Scan</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </>
                )}
              </button>
              <span className="prototype-note">
                {scanMode === 'fast'
                  ? '⚡ Fast Mode — RapidOCR Text Extraction & CCPA 2023 Inspection Engine (~3–5s)'
                  : '🧠 Deep Vision AI Mode — Ollama Moondream + RapidOCR & CCPA Inspection (~60–90s)'}
              </span>
            </div>
          </div>

          {/* Guidelines / Checklist Side Card */}
          <div className="audit-info-sidebar">
            <h3 className="sidebar-title">What PatternGuard Inspects</h3>
            <p className="sidebar-desc">
              Fintech interfaces are audited against the FTC and CFPB Deceptive Patterns Catalog:
            </p>

            <ul className="patterns-checklist">
              <li className="pattern-item">
                <div className="check-icon">✓</div>
                <div>
                  <strong>Sneaky Opt-ins & Pre-checked Boxes</strong>
                  <p>Pre-selected insurance, tip amounts, or recurring service subscriptions.</p>
                </div>
              </li>
              <li className="pattern-item">
                <div className="check-icon">✓</div>
                <div>
                  <strong>Hidden Costs & Drip Pricing</strong>
                  <p>Mandatory convenience fees undisclosed until the final payment step.</p>
                </div>
              </li>
              <li className="pattern-item">
                <div className="check-icon">✓</div>
                <div>
                  <strong>Roach Motel & Forced Continuity</strong>
                  <p>Funnels that are easy to enter but deliberately difficult to cancel or downgrade.</p>
                </div>
              </li>
              <li className="pattern-item">
                <div className="check-icon">✓</div>
                <div>
                  <strong>Confirmshaming & Asymmetric Choice</strong>
                  <p>Low-contrast decline buttons paired with emotionally manipulative rejection copy.</p>
                </div>
              </li>
            </ul>

            <div className="compliance-badge-box">
              <span className="badge-title">Regulatory Frameworks</span>
              <div className="framework-tags">
                <span className="framework-tag">India CCPA 2023</span>
                <span className="framework-tag">FTC Act Sec. 5</span>
                <span className="framework-tag">CFPB Circular 2023-01</span>
                <span className="framework-tag">EU DSA Art. 25</span>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Results Section */}
        {auditResult && (
          <div id="audit-results-section" className="audit-results-container">
            {/* Results Header */}
            <div className="results-header-row">
              <div className="results-title-group">
                <span className="results-eyebrow">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  CCPA 2023 Inspection Report
                </span>
                <h3 className="results-main-title">
                  {auditResult.findings_count > 0
                    ? 'Potential Dark-Pattern Indicators Detected'
                    : auditResult.scan_status === 'no_text_detected'
                    ? 'No Readable Interface Text Detected'
                    : 'Clean Interface — Zero Indicators Detected'}
                </h3>
                <p className="results-summary-subtitle">
                  File: <strong>{auditResult.filename}</strong> ({formatFileSize(auditResult.file_size)}) • Scanned against India CCPA Guidelines, 2023
                </p>
                {auditResult.timings && (
                  <div className="results-timings-bar">
                    <span className="timing-chip total">
                      ⏱️ Total: <strong>{auditResult.timings.total_seconds}s</strong>
                    </span>
                    <span className="timing-chip">
                      OCR: <strong>{auditResult.timings.ocr_seconds}s</strong>
                    </span>
                    <span className="timing-chip">
                      Rules: <strong>{auditResult.timings.rules_seconds}s</strong>
                    </span>
                    <span className="timing-chip">
                      Vision AI:{' '}
                      <strong>
                        {auditResult.ai_status === 'skipped'
                          ? 'Skipped (Fast Mode)'
                          : auditResult.ai_status === 'unavailable'
                          ? 'Unavailable (Ollama Offline)'
                          : `${auditResult.timings.ai_seconds}s`}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="results-badge-wrapper">
                {auditResult.findings_count > 0 ? (
                  <span className="status-pill risk">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {auditResult.findings_count} {auditResult.findings_count === 1 ? 'Indicator' : 'Indicators'} Flagged
                  </span>
                ) : auditResult.scan_status === 'no_text_detected' ? (
                  <span className="status-pill no-text">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    No Text Found
                  </span>
                ) : (
                  <span className="status-pill clean">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Clean Interface (0 Flagged)
                  </span>
                )}
              </div>
            </div>

            {/* AI Warning or OCR Warning banner */}
            {auditResult.ai_warning && (
              <div className="audit-status-banner info" style={{ marginBottom: '1.25rem' }}>
                <svg
                  className="status-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  <strong>Vision AI Offline Notice:</strong> {auditResult.ai_warning}
                </span>
              </div>
            )}
            {auditResult.ocr_warning && (
              <div className="audit-status-banner warning" style={{ marginBottom: '1.25rem' }}>
                <svg
                  className="status-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>
                  <strong>OCR Warning:</strong> {auditResult.ocr_warning}
                </span>
              </div>
            )}

            {/* OCR Extracted Text Drawer */}
            <div className="ocr-text-collapsible">
              <button
                type="button"
                className="ocr-toggle-btn"
                onClick={() => setShowExtractedText(!showExtractedText)}
                aria-expanded={showExtractedText}
              >
                <div className="ocr-toggle-title">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line x1="9" y1="20" x2="15" y2="20" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                  </svg>
                  <span>
                    OCR Extracted Text{' '}
                    {auditResult.extracted_text
                      ? `(${auditResult.extracted_text.split('\n').filter(Boolean).length} lines)`
                      : '(0 lines)'}
                  </span>
                </div>
                <svg
                  className={`ocr-toggle-icon ${showExtractedText ? 'open' : ''}`}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showExtractedText && (
                <div className="ocr-content-wrapper">
                  {auditResult.extracted_text ? (
                    <pre className="ocr-pre-text">{auditResult.extracted_text}</pre>
                  ) : (
                    <p className="ocr-pre-text" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      No machine-readable text was detected in this screenshot.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Outcome 1: Potential Indicators Found */}
            {auditResult.findings_count > 0 && (
              <div className="findings-container">
                <h4 className="findings-list-heading">
                  <span>Detected Dark-Pattern Findings</span>
                  <span className="findings-count-badge">{auditResult.findings_count}</span>
                </h4>

                {auditResult.findings.map((finding, idx) => (
                  <div
                    key={finding.rule_id || idx}
                    className={`finding-card severity-${finding.severity ? finding.severity.toLowerCase() : 'medium'}`}
                  >
                    <div className="finding-card-header">
                      <span className="finding-pattern-name">{finding.pattern_name}</span>
                      <div className="finding-badge-group">
                        <span
                          className={`severity-tag ${finding.severity ? finding.severity.toLowerCase() : 'medium'}`}
                        >
                          {finding.severity || 'Medium'} Severity
                        </span>
                        {finding.confidence && (
                          <span className="ccpa-ref-tag" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--navy-primary)' }}>
                            {finding.confidence} Confidence
                          </span>
                        )}
                        <span className="ccpa-ref-tag">
                          {finding.source === 'hybrid'
                            ? '⚡ Hybrid (Rules + AI)'
                            : finding.source === 'local_ai'
                            ? '🧠 Local Vision AI'
                            : '📜 Rules Engine'}
                        </span>
                        <span className="ccpa-ref-tag">{finding.ccpa_guideline_reference}</span>
                      </div>
                    </div>

                    {/* Matched Evidence */}
                    {finding.matched_evidence && (
                      <div className="finding-evidence-block">
                        <span className="evidence-label">
                          {finding.evidence_type === 'visual_layout'
                            ? 'Visible Interface Element / Layout Evidence:'
                            : 'Matched Screenshot Text:'}
                        </span>
                        <div className="evidence-quote">“{finding.matched_evidence}”</div>
                      </div>
                    )}

                    {/* Detail Grid: Explanation, Limitations & Recommendation */}
                    <div className="finding-details-grid">
                      <div className="finding-detail-item">
                        <div className="finding-detail-title">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                          <span>Deceptive Pattern Context</span>
                        </div>
                        <p className="finding-detail-body">{finding.explanation}</p>
                      </div>

                      <div className="finding-detail-item recommendation-item">
                        <div className="finding-detail-title">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                          <span>Compliant UI Alternative</span>
                        </div>
                        <p className="finding-detail-body">{finding.recommendation}</p>
                      </div>

                      {finding.limitations && (
                        <div className="finding-detail-item" style={{ gridColumn: '1 / -1', borderTop: '1px dashed var(--border-light)', paddingTop: '10px' }}>
                          <div className="finding-detail-title" style={{ color: 'var(--text-muted)' }}>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>Verification Limitations</span>
                          </div>
                          <p className="finding-detail-body" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {finding.limitations}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Outcome 2: Zero Indicators Detected */}
            {auditResult.scan_status === 'completed' && auditResult.findings_count === 0 && (
              <div className="clean-audit-state">
                <div className="clean-icon-circle">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>
                <h4 className="clean-state-title">No Deceptive Dark Patterns Identified</h4>
                <p className="clean-state-desc">
                  The analyzed interface copy does not exhibit indicators of False Urgency, False Scarcity,
                  Confirmshaming, Hidden Costs / Drip Pricing, Misleading Discounts, Subscription Traps,
                  Obstructive Choice Design, Basket Sneaking, or Suspicious Consent under CCPA 2023 Guidelines.
                </p>
              </div>
            )}

            {/* Outcome 3: No Text Detected */}
            {auditResult.scan_status === 'no_text_detected' && (
              <div className="no-text-audit-state">
                <div className="no-text-icon-circle">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <h4 className="no-text-title">No Machine-Readable Text Detected</h4>
                <p className="no-text-desc">
                  RapidOCR scanned the image but could not locate readable interface copy. Ensure the screenshot contains
                  high-contrast typography, is not blurry, and clearly displays payment or checkout text.
                </p>
              </div>
            )}

            {/* Regulatory Disclaimer Banner */}
            <div className="audit-disclaimer-box">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                <strong>Audit Notice:</strong>{' '}
                {auditResult.disclaimer ||
                  'Potential indicators requiring human review; not a definitive legal determination.'}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
