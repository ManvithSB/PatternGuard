import React, { useState, useRef, useEffect } from 'react';
import './AuditUpload.css';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

export default function AuditUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [auditScope, setAuditScope] = useState('full-funnel');
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

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
    fileInputRef.current?.click();
  };

  const handleClearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setStatusMessage({ text: '', type: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRunScan = () => {
    if (!selectedFile) {
      setStatusMessage({
        text: 'Please choose or drag an interface screenshot first to initiate the audit.',
        type: 'error',
      });
      return;
    }

    setStatusMessage({
      text: `Screenshot "${selectedFile.name}" is staged. Note: Backend analysis has not been integrated yet. AI dark-pattern detection will be connected in Phase 2.`,
      type: 'info',
    });
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
                      title="Choose a different image"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      className="btn-remove-image"
                      onClick={handleClearFile}
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
                {statusMessage.type === 'error' ? (
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
                ) : (
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
              >
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
              </button>
              <span className="prototype-note">
                ⚡ Frontend Preview Mode — AI Pipeline Integration Pending
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
                <span className="framework-tag">FTC Act Sec. 5</span>
                <span className="framework-tag">CFPB Circular 2023-01</span>
                <span className="framework-tag">EU DSA Art. 25</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
