import io
from PIL import Image, ImageDraw
from ocr import extract_text_from_image


def create_test_image_with_text(text: str, img_format: str = "PNG") -> bytes:
    """Helper to generate an in-memory image with text."""
    # Create white canvas
    img = Image.new("RGB", (400, 100), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Draw simple text
    draw.text((30, 35), text, fill=(0, 0, 0))

    buf = io.BytesIO()
    img.save(buf, format=img_format)
    return buf.getvalue()


def create_blank_image(img_format: str = "PNG") -> bytes:
    """Helper to generate an in-memory image without any text."""
    img = Image.new("RGB", (200, 200), color=(240, 240, 240))
    buf = io.BytesIO()
    img.save(buf, format=img_format)
    return buf.getvalue()


def test_valid_image_with_text_png():
    img_bytes = create_test_image_with_text("INSTANT LOAN ₹5000", "PNG")
    text = extract_text_from_image(img_bytes)
    assert len(text) > 0, "Expected OCR to extract text from valid PNG"
    assert "LOAN" in text.upper(), f"Expected 'LOAN' in extracted text, got '{text}'"
    print(f"[PASS] Test 1: Valid PNG image text extracted successfully -> '{text}'")


def test_valid_image_with_text_jpeg():
    img_bytes = create_test_image_with_text("UPI PAYMENT", "JPEG")
    text = extract_text_from_image(img_bytes)
    assert len(text) > 0, "Expected OCR to extract text from valid JPEG"
    assert "PAYMENT" in text.upper() or "UPI" in text.upper(), (
        f"Expected 'PAYMENT' or 'UPI' in text, got '{text}'"
    )
    print(f"[PASS] Test 2: Valid JPEG image text extracted successfully -> '{text}'")


def test_valid_image_with_text_webp():
    img_bytes = create_test_image_with_text("CHECKOUT TOTAL", "WEBP")
    text = extract_text_from_image(img_bytes)
    assert len(text) > 0, "Expected OCR to extract text from valid WEBP"
    assert "CHECKOUT" in text.upper() or "TOTAL" in text.upper(), (
        f"Expected 'CHECKOUT' or 'TOTAL' in text, got '{text}'"
    )
    print(f"[PASS] Test 3: Valid WEBP image text extracted successfully -> '{text}'")


def test_blank_image_returns_empty_string():
    blank_bytes = create_blank_image("PNG")
    text = extract_text_from_image(blank_bytes)
    assert text == "", f"Expected empty string for blank image, got '{text}'"
    print("[PASS] Test 4: Blank image without text correctly returned empty string")


def test_invalid_image_bytes_raises_error():
    corrupted_bytes = b"This is plain text and not a valid image format."
    try:
        extract_text_from_image(corrupted_bytes)
        assert False, "Should have raised ValueError on invalid image bytes"
    except ValueError as err:
        assert "unreadable or unsupported" in str(err).lower() or "decode" in str(err).lower()
        print("[PASS] Test 5: Invalid image bytes correctly raised descriptive ValueError")


def test_empty_bytes_raises_error():
    try:
        extract_text_from_image(b"")
        assert False, "Should have raised ValueError on empty bytes"
    except ValueError as err:
        assert "empty" in str(err).lower()
        print("[PASS] Test 6: Empty bytes correctly raised ValueError")


if __name__ == "__main__":
    print("Running OCR unit tests...")
    test_valid_image_with_text_png()
    test_valid_image_with_text_jpeg()
    test_valid_image_with_text_webp()
    test_blank_image_returns_empty_string()
    test_invalid_image_bytes_raises_error()
    test_empty_bytes_raises_error()
    print("All OCR unit tests passed successfully!")
