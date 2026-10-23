"""
PatternGuard AI-Assisted Contextual Analyzer
Integrates local Ollama models (e.g. moondream:latest) to review screenshots
and OCR text for potential dark patterns with strict evidence grounding.
"""

import base64
import io
import json
import re
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

OLLAMA_GENERATE_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_TAGS_URL = "http://127.0.0.1:11434/api/tags"
DEFAULT_MODEL_NAME = "moondream:latest"

KEEP_ALIVE = "5m"
MAX_IMAGE_SIDE = 896
JPEG_QUALITY = 85
DEFAULT_AI_TIMEOUT = 45  # Practical timeout in seconds for local inference

CANONICAL_CATEGORIES: Dict[str, str] = {
    "false urgency": "False Urgency",
    "urgency": "False Urgency",
    "countdown": "False Urgency",
    "timer": "False Urgency",
    "false scarcity": "False Scarcity",
    "scarcity": "False Scarcity",
    "true scarcity": "False Scarcity",
    "low stock": "False Scarcity",
    "confirmshaming": "Confirmshaming",
    "shaming": "Confirmshaming",
    "guilt": "Confirmshaming",
    "drip pricing": "Drip Pricing",
    "hidden fee": "Drip Pricing",
    "hidden fees": "Drip Pricing",
    "hidden costs": "Drip Pricing",
    "convenience fee": "Drip Pricing",
    "processing fee": "Drip Pricing",
    "misleading discounts": "Misleading Discounts",
    "misleading discount": "Misleading Discounts",
    "discount": "Misleading Discounts",
    "fake discount": "Misleading Discounts",
    "subscription trap": "Subscription Trap",
    "subscription traps": "Subscription Trap",
    "forced continuity": "Subscription Trap",
    "auto-renewal": "Subscription Trap",
    "recurring charge": "Subscription Trap",
    "obstructive choice design": "Obstructive Choice Design",
    "obstructive choice": "Obstructive Choice Design",
    "cancellation obstacle": "Obstructive Choice Design",
    "hard to cancel": "Obstructive Choice Design",
    "roach motel": "Obstructive Choice Design",
    "basket sneaking": "Basket Sneaking",
    "sneaking": "Basket Sneaking",
    "pre-selected": "Basket Sneaking",
    "auto-added": "Basket Sneaking",
    "suspicious consent": "Suspicious Consent",
    "bundled consent": "Suspicious Consent",
    "deceptive consent": "Suspicious Consent",
}

PLACEHOLDER_SUBSTRINGS = {
    "category name",
    "short category",
    "short summary",
    "exact quote",
    "why this may concern",
    "why it might be deceptive",
    "reason here",
    "evidence here",
    "text from screen",
    "short factual description",
}


def prepare_image(image_bytes: bytes) -> bytes:
    """Resize large screenshots and encode them as JPEG for AI inference."""
    with Image.open(io.BytesIO(image_bytes)) as original:
        image = original.convert("RGB")
        image.thumbnail(
            (MAX_IMAGE_SIDE, MAX_IMAGE_SIDE),
            Image.Resampling.LANCZOS,
        )

        output = io.BytesIO()
        image.save(
            output,
            format="JPEG",
            quality=JPEG_QUALITY,
            optimize=True,
        )
        return output.getvalue()


def normalize_string_for_matching(text: str) -> str:
    """Strip punctuation and collapse whitespace for resilient matching."""
    lowered = text.lower()
    cleaned = re.sub(r"[^\w\s₹$€£%]", " ", lowered)
    return " ".join(cleaned.split())


def validate_and_ground_evidence(
    evidence: str,
    extracted_text: str,
) -> Optional[Tuple[str, str]]:
    """
    Verifies that the cited evidence is grounded in the OCR text or describes
    a clear visual element.
    Returns (evidence_type, clean_evidence) or None if ungrounded/hallucinated.
    """
    if not evidence or not isinstance(evidence, str):
        return None

    cleaned_ev = evidence.strip()
    if len(cleaned_ev) < 3:
        return None

    lowered_ev = cleaned_ev.lower()

    # Reject known placeholder echoes
    if lowered_ev in PLACEHOLDER_SUBSTRINGS:
        return None
    for ph in PLACEHOLDER_SUBSTRINGS:
        if ph in lowered_ev and len(lowered_ev) < len(ph) + 10:
            return None

    # Check 1: Direct substring containment
    if cleaned_ev.lower() in extracted_text.lower():
        return ("verbatim_text", cleaned_ev)

    # Check 2: Normalized word-sequence match (handles OCR spacing/punctuation differences)
    norm_ev = normalize_string_for_matching(cleaned_ev)
    norm_ocr = normalize_string_for_matching(extracted_text)

    if norm_ev and norm_ev in norm_ocr:
        return ("verbatim_text", cleaned_ev)

    # Check 3: Multi-word phrase overlap (at least 3 significant words matching in order)
    words = [w for w in norm_ev.split() if len(w) >= 3]
    if len(words) >= 3:
        matches = 0
        for i in range(len(words) - 2):
            trigram = f"{words[i]} {words[i+1]} {words[i+2]}"
            if trigram in norm_ocr:
                matches += 1
        if matches >= 1:
            return ("verbatim_text", cleaned_ev)

    # Check 4: Clearly identified visual/layout element
    visual_keywords = [
        "checkbox", "pre-checked", "pre-selected", "checked by default",
        "ticked", "button contrast", "low contrast", "banner", "popup",
        "modal", "faded", "grayed out", "font size", "timer display",
        "red color", "highlighted button", "subdued link",
    ]
    if any(kw in lowered_ev for kw in visual_keywords):
        return ("visual_layout", cleaned_ev)

    # Ungrounded hallucination: text does not exist in screenshot OCR
    return None


def map_pattern_to_canonical(pattern: str) -> str:
    """Maps arbitrary model pattern strings to standard CCPA category names."""
    cleaned = pattern.strip().lower()
    for key, canonical in CANONICAL_CATEGORIES.items():
        if key in cleaned:
            return canonical
    return pattern.strip()[:60].title()


def build_analysis_prompt(
    extracted_text: str,
    candidate_hints: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Builds a grounded, conservative prompt tailored for compact local models."""
    hints_text = ""
    if candidate_hints:
        hint_lines = [
            f"- {h.get('pattern_name')}: \"{h.get('matched_evidence')}\""
            for h in candidate_hints[:5]
            if h.get("pattern_name") and h.get("matched_evidence")
        ]
        if hint_lines:
            hints_text = (
                "\nInitial text rules noted these candidate phrases:\n"
                + "\n".join(hint_lines)
                + "\n"
            )

    prompt = f"""You are a cautious consumer-interface auditor reviewing a user interface screenshot.
Visible text from screen:
\"\"\"
{extracted_text[:4000]}
\"\"\"{hints_text}

Analyze if any potential dark patterns are supported by visible text:
- False Urgency (e.g. artificial countdown timers, expires soon claims)
- False Scarcity (e.g. only X items left, low stock claims)
- Confirmshaming (e.g. guilt-tripping reject buttons)
- Drip Pricing (e.g. mandatory processing/convenience fees added late)
- Misleading Discounts (e.g. inflated reference prices)
- Subscription Trap (e.g. auto-renewal with hidden cancellation)
- Obstructive Choice Design (e.g. call-to-cancel only, asymmetrical buttons)
- Basket Sneaking (e.g. pre-selected warranty or insurance add-ons)
- Suspicious Consent (e.g. bundled marketing calls in terms)

CRITICAL RULES:
1. Every evidence MUST be an exact quote from the text above or a visible UI element. Do NOT invent quotes, prices, or numbers.
2. If legitimate or transparent (e.g. normal hours, transparent included fees, one-time payment), do NOT flag it.
3. If no pattern exists, return empty possible_indicators: [].

Respond STRICTLY in valid JSON:
{{
  "summary": "Factual description of this interface",
  "possible_indicators": [
    {{
      "pattern": "Category name",
      "evidence": "Exact quote from text",
      "reason": "Why this may influence consumer choice unfairly",
      "severity": "Low, Medium, or High",
      "limitations": "What cannot be verified from a single screen"
    }}
  ],
  "limitations": "Overall limitations of analyzing this single static screen"
}}"""
    return prompt


def analyze_screenshot_with_ai(
    image_bytes: bytes,
    extracted_text: str = "",
    candidate_hints: Optional[List[Dict[str, Any]]] = None,
    timeout: int = DEFAULT_AI_TIMEOUT,
) -> dict:
    """
    Reviews a screenshot using local Ollama model with evidence grounding.
    Guarantees every output finding is grounded in text or visible element.
    """
    try:
        ai_image_bytes = prepare_image(image_bytes)
    except Exception as exc:
        return {
            "status": "error",
            "summary": "",
            "possible_indicators": [],
            "limitations": f"Could not prepare the screenshot for AI: {exc}",
        }

    prompt = build_analysis_prompt(extracted_text, candidate_hints)

    payload = {
        "model": DEFAULT_MODEL_NAME,
        "prompt": prompt,
        "images": [
            base64.b64encode(ai_image_bytes).decode("ascii")
        ],
        "stream": False,
        "format": "json",
        "keep_alive": KEEP_ALIVE,
        "options": {
            "temperature": 0,
        },
    }

    request = urllib.request.Request(
        OLLAMA_GENERATE_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        ai_start = time.perf_counter()

        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))

        ai_elapsed = time.perf_counter() - ai_start
        print(f"[AI TIMING] Ollama request took {ai_elapsed:.2f} seconds")

        parsed = json.loads(body.get("response", "{}"))

        if not isinstance(parsed, dict):
            raise ValueError("The model response was not a JSON object.")

        raw_indicators = parsed.get("possible_indicators", [])
        if not isinstance(raw_indicators, list):
            raw_indicators = []

        grounded_indicators: List[Dict[str, Any]] = []

        for item in raw_indicators:
            if not isinstance(item, dict):
                continue

            raw_pattern = item.get("pattern", "")
            raw_evidence = item.get("evidence", "")
            raw_reason = item.get("reason", "")
            raw_limitations = item.get("limitations", "")

            if not all(
                isinstance(v, str) and v.strip()
                for v in (raw_pattern, raw_evidence, raw_reason)
            ):
                continue

            # Grounding check: verify quote against OCR text or clear visual element
            grounding = validate_and_ground_evidence(raw_evidence, extracted_text)
            if not grounding:
                print(f"[AI GROUNDING] Discarded ungrounded hallucination: \"{raw_evidence[:60]}\"")
                continue

            evidence_type, clean_evidence = grounding
            canonical_pattern = map_pattern_to_canonical(raw_pattern)

            # Determine severity
            severity = item.get("severity", "Medium")
            if severity not in ("Low", "Medium", "High"):
                severity = "Medium"

            # Determine confidence based on grounding quality
            confidence = "Medium"
            if evidence_type == "verbatim_text" and len(clean_evidence) > 15:
                confidence = "High"
            elif evidence_type == "visual_layout":
                confidence = "Tentative"

            grounded_indicators.append({
                "pattern": canonical_pattern,
                "evidence": clean_evidence,
                "evidence_type": evidence_type,
                "reason": raw_reason.strip()[:1000],
                "severity": severity,
                "confidence": confidence,
                "limitations": (
                    raw_limitations.strip()[:500]
                    or "Single screenshot cannot verify external merchant systems or prior step disclosures."
                ),
                "needs_more_context": True,
            })

        return {
            "status": "available",
            "summary": str(parsed.get("summary", ""))[:2000],
            "possible_indicators": grounded_indicators,
            "limitations": str(
                parsed.get("limitations", "")
            )[:1000] or "Static screenshot analysis cannot confirm merchant intent or prior disclosures.",
        }

    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return {
            "status": "unavailable",
            "summary": "",
            "possible_indicators": [],
            "limitations": (
                f"Could not reach local Ollama or analysis timed out: {exc}"
            ),
        }

    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        return {
            "status": "error",
            "summary": "",
            "possible_indicators": [],
            "limitations": (
                f"The local model returned an unreadable response: {exc}"
            ),
        }