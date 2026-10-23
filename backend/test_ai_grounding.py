"""
PatternGuard AI Grounding, Evidence Validation, and Hybrid Synthesis Test Suite
Covers:
- Hallucinated quote rejection
- Placeholder rejection
- Verbatim text vs visual element validation
- Hybrid finding merging vs rule preservation
- Malformed AI responses & Ollama offline fallback
- Cross-domain novel wording generalization
"""

from unittest.mock import patch
import io
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from ai_analyzer import (
    validate_and_ground_evidence,
    map_pattern_to_canonical,
    analyze_screenshot_with_ai,
    build_analysis_prompt,
)
from main import app

client = TestClient(app)


def make_test_img(text: str = "") -> bytes:
    img = Image.new("RGB", (500, 150), color=(255, 255, 255))
    if text:
        draw = ImageDraw.Draw(img)
        draw.text((20, 50), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Test 1: Grounding Validator Rejects Hallucinations
# ---------------------------------------------------------------------------
def test_grounding_rejects_hallucinations():
    ocr_text = "Flight Booking to Mumbai. Total Fare: Rs 4,500. [Confirm Ticket]"

    # Quote that doesn't exist in OCR text
    hallucinated = "Non-refundable baggage fee of $50 added"
    res = validate_and_ground_evidence(hallucinated, ocr_text)
    assert res is None, f"Expected None for hallucinated quote, got {res}"

    # Quote that does exist
    real = "Total Fare: Rs 4,500"
    res = validate_and_ground_evidence(real, ocr_text)
    assert res is not None, "Expected valid grounding for genuine quote"
    assert res[0] == "verbatim_text"
    assert "Total Fare: Rs 4,500" in res[1]

    print("[PASS] Grounding Test 1: Hallucinated quote rejected while real quote accepted")


# ---------------------------------------------------------------------------
# Test 2: Placeholder Echoes are Rejected
# ---------------------------------------------------------------------------
def test_grounding_rejects_placeholder_echoes():
    ocr_text = "Shopping Cart. Total: $100. Category name. Free shipping."

    placeholders = [
        "Category name",
        "Short category",
        "Exact quote",
        "Why this may concern",
        "Why it might be deceptive",
        "Short summary",
    ]
    for ph in placeholders:
        res = validate_and_ground_evidence(ph, ocr_text)
        assert res is None, f"Failed to reject placeholder echo: '{ph}' -> {res}"

    print("[PASS] Grounding Test 2: Prompt placeholder echoes correctly rejected")


# ---------------------------------------------------------------------------
# Test 3: Visual Elements Identified Separately from Verbatim Text
# ---------------------------------------------------------------------------
def test_grounding_distinguishes_visual_evidence():
    ocr_text = "Device Protection Rs 299. Subtotal Rs 1,499."

    visual_claim = "Extended warranty checkbox is pre-checked by default"
    res = validate_and_ground_evidence(visual_claim, ocr_text)
    assert res is not None, "Visual UI element should be accepted"
    assert res[0] == "visual_layout", f"Expected 'visual_layout', got {res[0]}"

    text_claim = "Device Protection Rs 299"
    res2 = validate_and_ground_evidence(text_claim, ocr_text)
    assert res2 is not None
    assert res2[0] == "verbatim_text"

    print("[PASS] Grounding Test 3: Visual UI elements accurately categorized as visual_layout")


# ---------------------------------------------------------------------------
# Test 4: Canonical Category Mapping
# ---------------------------------------------------------------------------
def test_canonical_pattern_mapping():
    assert map_pattern_to_canonical("true scarcity") == "False Scarcity"
    assert map_pattern_to_canonical("hidden fees") == "Drip Pricing"
    assert map_pattern_to_canonical("forced continuity") == "Subscription Trap"
    assert map_pattern_to_canonical("guilt tripping") == "Confirmshaming"
    assert map_pattern_to_canonical("auto-renewal") == "Subscription Trap"
    assert map_pattern_to_canonical("bundled consent") == "Suspicious Consent"
    assert map_pattern_to_canonical("pre-selected add-on") == "Basket Sneaking"
    print("[PASS] Grounding Test 4: Model pattern variations normalized to canonical CCPA categories")


# ---------------------------------------------------------------------------
# Test 5: Malformed AI JSON Handled Gracefully
# ---------------------------------------------------------------------------
def test_malformed_ai_json_handling():
    malformed_responses = [
        b'{"response": "Not a json object"}',
        b'{"response": "{\\"possible_indicators\\": \\"not a list\\"}"}',
        b'{"response": ""}',
    ]

    for resp_body in malformed_responses:
        with patch("urllib.request.urlopen") as mock_url:
            mock_url.return_value.__enter__.return_value.read.return_value = resp_body
            res = analyze_screenshot_with_ai(
                make_test_img("Sample text"), "Sample text"
            )
            assert res["status"] in ("available", "error")
            assert isinstance(res["possible_indicators"], list)

    print("[PASS] Grounding Test 5: Malformed AI JSON handled safely without crashing")


# ---------------------------------------------------------------------------
# Test 6: Hybrid Findings Merging in /analyze
# ---------------------------------------------------------------------------
def test_analyze_hybrid_synthesis():
    """When rule engine and AI both detect an indicator, synthesize into source='hybrid'."""
    ocr_sample = "Special Offer! Deal expires in 10 minutes. Claim now."
    test_bytes = make_test_img(ocr_sample)

    mock_rule_findings = [
        {
            "rule_id": "CCPA-FU-01",
            "pattern_name": "False Urgency",
            "matched_evidence": "expires in 10 minutes",
            "ccpa_guideline_reference": "CCPA Guidelines 2023, Annexure 1, Clause 1",
            "severity": "Medium",
            "status": "potential_indicator",
            "explanation": "Creates a false sense of pressure with countdown phrasing.",
            "recommendation": "State true deadlines without artificial pressure.",
        }
    ]

    mock_ai = {
        "status": "available",
        "summary": "Urgency banner",
        "possible_indicators": [
            {
                "pattern": "False Urgency",
                "evidence": "expires in 10 minutes",
                "evidence_type": "verbatim_text",
                "reason": "Artificially constrains decision window with short countdown",
                "severity": "Medium",
                "confidence": "High",
                "limitations": "Single screenshot cannot verify if offer truly closes in 10 minutes",
                "needs_more_context": True,
            }
        ],
        "limitations": "Static screenshot inspection.",
    }

    with patch("main.detect_dark_patterns", return_value=mock_rule_findings), \
         patch("main.analyze_screenshot_with_ai", return_value=mock_ai):
        files = {"file": ("urgency.png", io.BytesIO(test_bytes), "image/png")}
        resp = client.post("/analyze?enable_ai=true", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["findings_count"] >= 1
        hybrid_findings = [f for f in data["findings"] if f.get("source") == "hybrid"]
        assert len(hybrid_findings) >= 1, f"Expected hybrid finding, got: {data['findings']}"
        hf = hybrid_findings[0]
        assert hf["pattern_name"] == "False Urgency"
        assert "AI Context Assessment" in hf["explanation"]
        assert hf["confidence"] == "High"
        assert data["hybrid_findings_count"] >= 1

    print("[PASS] Grounding Test 6: Rule engine and AI detection synthesized into hybrid finding")


# ---------------------------------------------------------------------------
# Test 7: Rule Finding Never Discarded When AI Disagrees
# ---------------------------------------------------------------------------
def test_rule_finding_preserved_when_ai_disagrees():
    """If AI returns 0 indicators or disagrees, deterministic rule finding must be retained."""
    ocr_sample = "Processing fee is non-refundable and applied at checkout: $4.99"
    test_bytes = make_test_img(ocr_sample)

    mock_rule_findings = [
        {
            "rule_id": "CCPA-DP-01",
            "pattern_name": "Drip Pricing",
            "matched_evidence": "applied at checkout",
            "ccpa_guideline_reference": "CCPA Guidelines 2023, Annexure 1, Clause 5",
            "severity": "High",
            "status": "potential_indicator",
            "explanation": "Fee disclosed late in transaction flow.",
            "recommendation": "Display all mandatory fees upfront.",
        }
    ]

    mock_ai_empty = {
        "status": "available",
        "summary": "Looks like an ordinary checkout",
        "possible_indicators": [],
        "limitations": "No indicators found by AI.",
    }

    with patch("main.detect_dark_patterns", return_value=mock_rule_findings), \
         patch("main.analyze_screenshot_with_ai", return_value=mock_ai_empty):
        files = {"file": ("drip.png", io.BytesIO(test_bytes), "image/png")}
        resp = client.post("/analyze?enable_ai=true", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["findings_count"] >= 1, "Rule finding was incorrectly discarded!"
        dp = [f for f in data["findings"] if f["pattern_name"] == "Drip Pricing"]
        assert len(dp) >= 1
        assert dp[0]["source"] == "rules_engine"

    print("[PASS] Grounding Test 7: Deterministic rule finding preserved when AI returns empty")


# ---------------------------------------------------------------------------
# Test 8: Novel Wording Identified by AI is Included if Grounded
# ---------------------------------------------------------------------------
def test_novel_wording_ai_finding_included_if_grounded():
    """Unfamiliar wording that regex rules don't match, but AI flags with grounded quote, is included."""
    # Novel phrasing not in regex: "Lock in your rate before seats fill"
    ocr_sample = "Flight to Goa. Lock in your rate before seats fill. Price: Rs 5,200."
    test_bytes = make_test_img(ocr_sample)

    mock_ai_novel = {
        "status": "available",
        "summary": "Flight booking screen",
        "possible_indicators": [
            {
                "pattern": "False Urgency",
                "evidence": "Lock in your rate before seats fill",
                "evidence_type": "verbatim_text",
                "reason": "Implies imminent price surge to pressure immediate checkout",
                "severity": "Medium",
                "confidence": "High",
                "limitations": "Cannot verify actual seat fill rate",
                "needs_more_context": True,
            }
        ],
        "limitations": "Single screenshot.",
    }

    with patch("main.analyze_screenshot_with_ai", return_value=mock_ai_novel):
        files = {"file": ("novel.png", io.BytesIO(test_bytes), "image/png")}
        resp = client.post("/analyze?enable_ai=true", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["findings_count"] >= 1
        novel = [f for f in data["findings"] if f.get("source") == "local_ai"]
        assert len(novel) >= 1, f"Expected local_ai finding, got {data['findings']}"
        assert novel[0]["matched_evidence"] == "Lock in your rate before seats fill"

    print("[PASS] Grounding Test 8: Grounded novel phrasing identified by AI successfully incorporated")


# ---------------------------------------------------------------------------
# Test 9: Transparent Disclosure Does Not Trigger False Positives
# ---------------------------------------------------------------------------
def test_transparent_disclosure_negative_case():
    ocr_sample = (
        "Account Summary. Total payable: Rs 1,500. "
        "All taxes and fees included. One-time payment."
    )
    test_bytes = make_test_img(ocr_sample)

    files = {"file": ("transparent.png", io.BytesIO(test_bytes), "image/png")}
    resp = client.post("/analyze", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["findings_count"] == 0, f"False positive on transparent payment: {data['findings']}"
    assert "no dark pattern" in data["message"].lower()

    print("[PASS] Grounding Test 9: Transparent pricing disclosure produces zero false positives")


if __name__ == "__main__":
    print("=================================================================")
    print("Running PatternGuard AI Grounding & Hybrid Synthesis Tests...")
    print("=================================================================")
    test_grounding_rejects_hallucinations()
    test_grounding_rejects_placeholder_echoes()
    test_grounding_distinguishes_visual_evidence()
    test_canonical_pattern_mapping()
    test_malformed_ai_json_handling()
    test_analyze_hybrid_synthesis()
    test_rule_finding_preserved_when_ai_disagrees()
    test_novel_wording_ai_finding_included_if_grounded()
    test_transparent_disclosure_negative_case()
    print("=================================================================")
    print("All 9 AI Grounding and Hybrid Synthesis tests passed successfully!")
    print("=================================================================")
