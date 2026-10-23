import time
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from ocr import (
    OCRError,
    extract_text_from_image,
    extract_text_details_from_image,
    assess_ocr_quality,
)
from rules import detect_dark_patterns
from ai_analyzer import analyze_screenshot_with_ai

app = FastAPI(
    title="PatternGuard API",
    description="Evidence-grounded OCR, rule-based checks, and local vision-AI review",
    version="0.3.0",
)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
]

# Permit local loopback and private LAN addresses (RFC 1918) for phone testing
LOCAL_LAN_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=LOCAL_LAN_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_CONTENT_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/webp"
}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024


@app.get("/")
def read_root():
    return {"message": "PatternGuard API is running", "docs_url": "/docs"}


@app.get("/health")
def check_health():
    return {"status": "healthy"}


def make_ai_finding(item: dict, index: int) -> dict:
    """Helper to convert an AI indicator dictionary to standard finding format."""
    extra_context = (
        " More context is needed to confirm this indicator."
        if item.get("needs_more_context", True)
        else ""
    )
    return {
        "rule_id": f"AI-DETECT-{index:02d}",
        "pattern_name": item.get("pattern", "Potential Indicator"),
        "matched_evidence": item.get("evidence", ""),
        "ccpa_guideline_reference": (
            f"CCPA Guidelines 2023 ({item.get('pattern', 'Deceptive Practice')})"
        ),
        "severity": item.get("severity", "Medium"),
        "status": "potential_indicator",
        "confidence": item.get("confidence", "Medium"),
        "source": "local_ai",
        "evidence_type": item.get("evidence_type", "verbatim_text"),
        "explanation": item.get("reason", "") + extra_context,
        "limitations": item.get(
            "limitations",
            "Single screenshot cannot verify full transactional state or merchant intent."
        ),
        "recommendation": (
            "Review the full user journey, relevant terms, and checkout or "
            "cancellation steps. Use clear, accurate disclosures and balanced "
            "choices where appropriate."
        ),
        "disclaimer": (
            "AI-generated potential indicator. Verify the evidence manually; "
            "this is not a legal determination."
        ),
    }


@app.post("/analyze")
async def analyze_screenshot(
    file: UploadFile = File(...),
    enable_ai: Optional[bool] = Query(None),
    enable_ai_form: Optional[str] = Form(None, alias="enable_ai"),
):
    request_start = time.perf_counter()
    timings = {}

    if enable_ai is not None:
        ai_requested = bool(enable_ai)
    elif enable_ai_form is not None:
        ai_requested = str(enable_ai_form).strip().lower() in ("true", "1", "yes")
    else:
        ai_requested = False

    filename = file.filename or ""
    file_ext = Path(filename).suffix.lower()

    if (
        file_ext not in ALLOWED_EXTENSIONS
        or file.content_type not in ALLOWED_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PNG, JPG, JPEG, and WEBP images are supported.",
        )

    contents = await file.read()
    file_size = len(contents)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="File is too large. Maximum allowed size is 15 MB.",
        )

    # 1. OCR text extraction with reading order and quality evaluation
    extracted_text = ""
    ocr_error = None
    ocr_quality_meta = {
        "quality": "empty",
        "average_confidence": 0.0,
        "warning": None,
        "total_tokens": 0,
        "total_characters": 0,
    }
    started = time.perf_counter()

    try:
        details = extract_text_details_from_image(contents)
        extracted_text = "\n".join(item["text"] for item in details)
        ocr_quality_meta = assess_ocr_quality(details)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unreadable or corrupted image file: {exc}",
        )
    except OCRError as exc:
        ocr_error = str(exc)
    finally:
        timings["ocr_seconds"] = round(time.perf_counter() - started, 2)

    # 2. Rule-based detection timing
    started = time.perf_counter()
    rule_findings = (
        detect_dark_patterns(extracted_text)
        if extracted_text.strip()
        else []
    )
    timings["rules_seconds"] = round(time.perf_counter() - started, 2)

    for finding in rule_findings:
        finding.setdefault("source", "rules_engine")
        finding.setdefault("evidence_type", "ocr_text")
        finding.setdefault("confidence", "High")
        finding.setdefault(
            "limitations",
            "Text matches known deceptive design phrasing under CCPA 2023. Static inspection cannot verify merchant backend logic or full user journey."
        )

    # 3. AI timing (optional, skipped by default for fast scan)
    if ai_requested:
        started = time.perf_counter()
        ai_result = await run_in_threadpool(
            analyze_screenshot_with_ai,
            contents,
            extracted_text,
            rule_findings,
        )
        timings["ai_seconds"] = round(time.perf_counter() - started, 2)
    else:
        ai_result = {
            "status": "skipped",
            "summary": "",
            "possible_indicators": [],
            "limitations": "AI analysis was skipped by request.",
        }
        timings["ai_seconds"] = 0.0

    # 4. Intelligent Hybrid Synthesis & Deduplication
    combined_findings: List[Dict[str, Any]] = []
    hybrid_count = 0
    ai_only_count = 0
    rule_only_count = 0

    ai_indicators = ai_result.get("possible_indicators", [])
    used_ai_indices = set()

    for rf in rule_findings:
        rf_copy = dict(rf)
        rf_pattern = str(rf_copy.get("pattern_name", "")).casefold().strip()
        rf_ev = str(rf_copy.get("matched_evidence", "")).casefold().strip()

        # Look for matching AI indicator (same category or overlapping text)
        matched_ai = None
        for a_idx, ai_item in enumerate(ai_indicators):
            if a_idx in used_ai_indices:
                continue
            ai_pat = str(ai_item.get("pattern", "")).casefold().strip()
            ai_ev = str(ai_item.get("evidence", "")).casefold().strip()

            category_matches = (
                ai_pat == rf_pattern or rf_pattern in ai_pat or ai_pat in rf_pattern
            )
            text_overlaps = (
                ai_ev in rf_ev
                or rf_ev in ai_ev
                or any(w in rf_ev for w in ai_ev.split() if len(w) > 4)
            )

            if category_matches and text_overlaps:
                matched_ai = ai_item
                used_ai_indices.add(a_idx)
                break

        if matched_ai:
            rf_copy["source"] = "hybrid"
            rf_copy["confidence"] = "High"
            rf_copy["evidence_type"] = matched_ai.get("evidence_type", "composite")
            rf_copy["explanation"] = (
                f"{rf_copy.get('explanation', '')} "
                f"[AI Context Assessment: {matched_ai.get('reason', '')}]"
            )
            rf_copy["limitations"] = matched_ai.get(
                "limitations", rf_copy.get("limitations", "")
            )
            hybrid_count += 1
        else:
            rule_only_count += 1

        combined_findings.append(rf_copy)

    # Add remaining grounded AI indicators that rule engine didn't catch
    for a_idx, ai_item in enumerate(ai_indicators):
        if a_idx in used_ai_indices:
            continue
        ai_only_count += 1
        candidate = make_ai_finding(ai_item, ai_only_count)
        combined_findings.append(candidate)

    findings_count = len(combined_findings)

    scan_status = (
        "completed"
        if extracted_text.strip() or ai_result.get("status") == "available"
        else "no_text_detected"
    )

    ai_status = ai_result.get("status", "unknown")
    ai_warning = None
    if ai_requested and ai_status in ("unavailable", "error"):
        ai_warning = (
            "Local Ollama vision model was unreachable on http://127.0.0.1:11434. "
            "Scan completed using RapidOCR and rule engine only. "
            f"Detail: {ai_result.get('limitations', '')}"
        )

    ocr_warning = ocr_quality_meta.get("warning")
    if ocr_error:
        ocr_warning = f"OCR engine error: {ocr_error}"

    if findings_count:
        source_desc = (
            "text rules and local AI"
            if (ai_only_count > 0 or hybrid_count > 0) and rule_only_count > 0
            else ("local AI" if ai_only_count > 0 else "text rules")
        )
        message = (
            f"Analysis complete. Found {findings_count} potential indicator(s) "
            f"from {source_desc}. Review evidence manually."
        )
    elif scan_status == "no_text_detected":
        message = (
            "No readable text was detected and local AI analysis was unavailable. "
            "This is not a clean bill of health."
        )
    elif ai_requested and ai_status in ("unavailable", "error"):
        message = (
            "No dark pattern indicators were returned by text rules. "
            "Note: Deep Vision AI was unavailable (Ollama offline). "
            "This does not prove the interface is free of dark patterns."
        )
    else:
        message = (
            "No dark pattern indicators were returned by the enabled checks. "
            "This does not prove the interface is free of dark patterns."
        )

    timings["total_seconds"] = round(time.perf_counter() - request_start, 2)
    print(f"[TIMING] {timings}")
    print(f"[DEBUG] findings_count={findings_count}, rule_findings={len(rule_findings)}, ai_indicators={len(ai_indicators)}")
    print(f"[DEBUG] extracted_text_preview={repr(extracted_text[:300])}")
    if rule_findings:
        for rf in rule_findings:
            print(f"[DEBUG] rule_finding: {rf.get('rule_id')} => {rf.get('matched_evidence', '')[:80]}")

    response = {
        "filename": filename,
        "content_type": file.content_type,
        "file_size": file_size,
        "scan_status": scan_status,
        "extracted_text": extracted_text,
        "findings_count": findings_count,
        "findings": combined_findings,
        "message": message,
        "disclaimer": (
            "Potential indicators only. AI can make mistakes; absence of findings "
            "does not prove an interface is safe, and findings are not definitive "
            "legal determinations."
        ),
        "ai_status": ai_status,
        "ai_summary": ai_result.get("summary", ""),
        "ai_limitations": ai_result.get("limitations", ""),
        "rule_findings_count": len(rule_findings),
        "ai_findings_count": ai_only_count,
        "hybrid_findings_count": hybrid_count,
        "ocr_quality": ocr_quality_meta.get("quality", "adequate"),
        "ocr_confidence": ocr_quality_meta.get("average_confidence", 0.0),
        "timings": timings,
    }

    if ai_warning:
        response["ai_warning"] = ai_warning

    if ocr_warning:
        response["ocr_warning"] = ocr_warning

    return response