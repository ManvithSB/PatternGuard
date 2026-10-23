import io
from pathlib import Path
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from main import MAX_FILE_SIZE_BYTES, app

client = TestClient(app)


def make_test_image(text: str = "") -> bytes:
    """Helper to create an in-memory PNG image with or without text."""
    img = Image.new("RGB", (450, 120), color=(255, 255, 255))
    if text:
        draw = ImageDraw.Draw(img)
        draw.text((20, 45), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_root():
    response = client.get("/")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    assert response.json() == {
        "message": "PatternGuard API is running",
        "docs_url": "/docs",
    }
    print("[PASS] Test 1: GET / returned 200 OK and expected body")


def test_health():
    response = client.get("/health")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    assert response.json() == {"status": "healthy"}
    print("[PASS] Test 2: GET /health returned 200 OK and status healthy")


def test_cors():
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    allowed_origin = response.headers.get("access-control-allow-origin")
    assert allowed_origin == "http://localhost:5173", (
        f"Expected http://localhost:5173, got {allowed_origin}"
    )
    print("[PASS] Test 3: CORS header 'Access-Control-Allow-Origin' matches http://localhost:5173")


def test_analyze_clean_screenshot():
    clean_bytes = make_test_image("UPI Payment to Merchant. Processing fee: 0.")
    files = {"file": ("clean_payment.png", io.BytesIO(clean_bytes), "image/png")}
    response = client.post("/analyze", files=files)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data["filename"] == "clean_payment.png"
    assert data["content_type"] == "image/png"
    assert data["scan_status"] == "completed"
    assert data["findings_count"] == 0
    assert len(data["findings"]) == 0
    assert "no dark pattern" in data["message"].lower()
    print("[PASS] Test 4: Clean screenshot scanned with completed status and 0 findings")


def test_analyze_screenshot_with_detectable_pattern():
    pattern_bytes = make_test_image("Hurry! Loan offer expires in 2 mins. Claim now.")
    files = {"file": ("loan_offer.png", io.BytesIO(pattern_bytes), "image/png")}
    response = client.post("/analyze", files=files)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data["filename"] == "loan_offer.png"
    assert data["scan_status"] == "completed"
    assert data["findings_count"] > 0
    assert len(data["findings"]) > 0
    finding = data["findings"][0]
    assert finding["pattern_name"] == "False Urgency"
    assert "CCPA Guidelines 2023" in finding["ccpa_guideline_reference"]
    assert "disclaimer" in data
    print("[PASS] Test 5: Screenshot with False Urgency detected and reported with CCPA guidance")


def test_analyze_blank_screenshot_no_text():
    blank_bytes = make_test_image("")  # solid blank image
    files = {"file": ("blank_canvas.png", io.BytesIO(blank_bytes), "image/png")}
    response = client.post("/analyze", files=files)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data["scan_status"] == "no_text_detected"
    assert data["findings_count"] == 0
    assert data["extracted_text"] == ""
    assert "no readable text" in data["message"].lower()
    print("[PASS] Test 6: Blank screenshot returned 'no_text_detected' status gracefully")


def test_analyze_unreadable_corrupted_image():
    corrupted_bytes = b"Corrupted non-image byte content"
    files = {"file": ("corrupted.png", io.BytesIO(corrupted_bytes), "image/png")}
    response = client.post("/analyze", files=files)
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    assert "unreadable or corrupted" in response.json()["detail"].lower()
    print("[PASS] Test 7: Corrupted image bytes rejected with HTTP 400 Bad Request")


def test_analyze_invalid_file_type():
    fake_txt_bytes = b"Contract terms in plain text."
    files = {"file": ("document.txt", io.BytesIO(fake_txt_bytes), "text/plain")}
    response = client.post("/analyze", files=files)
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    assert "invalid file type" in response.json()["detail"].lower()
    print("[PASS] Test 8: Invalid file type rejected with HTTP 400 Bad Request")


def test_analyze_oversized_upload():
    oversized_bytes = b"0" * (MAX_FILE_SIZE_BYTES + 1)
    files = {"file": ("huge_screenshot.png", io.BytesIO(oversized_bytes), "image/png")}
    response = client.post("/analyze", files=files)
    assert response.status_code == 413, f"Expected 413, got {response.status_code}"
    assert "too large" in response.json()["detail"].lower()
    print("[PASS] Test 9: Oversized upload (>15MB) rejected with HTTP 413 Content Too Large")


def test_analyze_fast_scan_defaults_to_ai_skipped():
    clean_bytes = make_test_image("UPI Payment to Merchant.")
    files = {"file": ("fast_scan.png", io.BytesIO(clean_bytes), "image/png")}
    response = client.post("/analyze", files=files)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data["ai_status"] == "skipped"
    assert data["ai_findings_count"] == 0
    assert data["timings"]["ai_seconds"] == 0.0
    print("[PASS] Test 10: Fast scan defaulted with ai_status=skipped and ai_seconds=0.0")


def test_analyze_with_ai_enabled_mocked():
    from unittest.mock import patch

    mock_ai_response = {
        "status": "available",
        "summary": "Mocked test summary",
        "possible_indicators": [
            {
                "pattern": "Visual Hierarchy",
                "evidence": "Tiny terms below button",
                "reason": "Text is less visible than button",
                "severity": "Medium",
                "needs_more_context": True,
            }
        ],
        "limitations": "Mocked limitations",
    }

    with patch("main.analyze_screenshot_with_ai", return_value=mock_ai_response):
        clean_bytes = make_test_image("UPI Payment to Merchant.")
        files = {"file": ("ai_scan.png", io.BytesIO(clean_bytes), "image/png")}
        response = client.post("/analyze?enable_ai=true", files=files)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["ai_status"] == "available"
        assert data["ai_findings_count"] == 1
        assert any(f["pattern_name"] == "Visual Hierarchy" for f in data["findings"])
        print("[PASS] Test 11: AI-enabled scan incorporated mocked AI finding")


def test_analyze_hidden_fee_test_image():
    """Validates that POST /analyze detects Drip Pricing on the actual hidden-fee-test.png."""
    img_path = Path("hidden-fee-test.png")
    if not img_path.exists():
        img_path = Path(__file__).resolve().parent.parent / "hidden-fee-test.png"

    with open(img_path, "rb") as f:
        img_bytes = f.read()

    files = {"file": ("hidden-fee-test.png", io.BytesIO(img_bytes), "image/png")}
    response = client.post("/analyze", files=files)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data["scan_status"] == "completed"
    assert data["findings_count"] >= 1, f"Expected >= 1 finding on hidden-fee-test.png, got: {data}"
    dp_findings = [f for f in data["findings"] if f["pattern_name"] == "Drip Pricing"]
    assert len(dp_findings) >= 1, f"Expected Drip Pricing finding on hidden-fee-test.png, got: {data['findings']}"
    assert "applied at checkout" in dp_findings[0]["matched_evidence"].lower()
    print("[PASS] Test 12: POST /analyze detected Drip Pricing on actual hidden-fee-test.png")


def test_analyze_with_ai_unavailable_reports_warning():
    """When Ollama is offline or unavailable, API must return ai_status=unavailable and ai_warning."""
    from unittest.mock import patch

    mock_unavailable = {
        "status": "unavailable",
        "summary": "",
        "possible_indicators": [],
        "limitations": "Could not reach local Ollama: Connection refused",
    }

    with patch("main.analyze_screenshot_with_ai", return_value=mock_unavailable):
        clean_bytes = make_test_image("UPI Payment to Merchant.")
        files = {"file": ("ai_offline.png", io.BytesIO(clean_bytes), "image/png")}
        response = client.post("/analyze?enable_ai=true", files=files)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["ai_status"] == "unavailable"
        assert "ai_warning" in data
        assert "Ollama" in data["ai_warning"]
        print("[PASS] Test 13: When AI is unavailable, API reports ai_status=unavailable and helpful ai_warning")


def test_analyze_subscription_paywall_endpoint():
    """Validates that POST /analyze detects Subscription Trap indicators on the paywall screen."""
    from unittest.mock import patch

    sub_text = (
        "Start your 14-day free trial.\n"
        "In 14 Days — You'll be charged on Jan 28, 2026, unless you cancel anytime before.\n"
        "Annual — 14 days free, then $149.99/yr ($12.50/month)\n"
        "No Payment Due Now\n"
        "Try it free\n"
        "Subscribe with Apple\n"
        "Terms of Service | Privacy Policy"
    )

    mock_details = [
        {"text": line.strip(), "ocr_confidence": 0.95, "bounding_box": None}
        for line in sub_text.splitlines()
        if line.strip()
    ]

    with patch("main.extract_text_details_from_image", return_value=mock_details):
        dummy_img = make_test_image("paywall")
        files = {"file": ("paywall.png", io.BytesIO(dummy_img), "image/png")}
        response = client.post("/analyze", files=files)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["findings_count"] == 3, f"Expected three subscription findings, got: {data}"
        assert data["scan_status"] == "completed"
        assert data["ai_status"] == "skipped"
        assert data["extracted_text"] == sub_text
        st_findings = [f for f in data["findings"] if f["pattern_name"] == "Subscription Traps"]
        expected_ids = {"CCPA-ST-01", "CCPA-ST-02", "CCPA-ST-03"}
        assert {finding["rule_id"] for finding in st_findings} == expected_ids
        evidence_by_id = {
            finding["rule_id"]: finding["matched_evidence"]
            for finding in st_findings
        }
        assert "unless you cancel" in evidence_by_id["CCPA-ST-02"]
        assert "$149.99/yr ($12.50/month" in evidence_by_id["CCPA-ST-01"]
        assert evidence_by_id["CCPA-ST-03"] == "$149.99/yr ($12.50/month)"
        assert all(f["status"] == "potential_indicator" for f in st_findings)
        print("[PASS] Test 14: POST /analyze returned all three expected findings and exact extracted text")


if __name__ == "__main__":
    print("Running integrated endpoint tests...")
    test_root()
    test_health()
    test_cors()
    test_analyze_clean_screenshot()
    test_analyze_screenshot_with_detectable_pattern()
    test_analyze_blank_screenshot_no_text()
    test_analyze_unreadable_corrupted_image()
    test_analyze_invalid_file_type()
    test_analyze_oversized_upload()
    test_analyze_fast_scan_defaults_to_ai_skipped()
    test_analyze_with_ai_enabled_mocked()
    test_analyze_hidden_fee_test_image()
    test_analyze_with_ai_unavailable_reports_warning()
    test_analyze_subscription_paywall_endpoint()
    print("All integrated endpoint tests passed successfully!")
