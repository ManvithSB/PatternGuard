
"""
PatternGuard OCR Module
Extracts text, OCR confidence, and bounding boxes from screenshots.

Supports PNG, JPG, JPEG, and WEBP.
The original extract_text_from_image() API remains backward compatible.
"""

import io
from typing import Any, Dict, List, Optional

import numpy as np
from PIL import Image, UnidentifiedImageError
from rapidocr_onnxruntime import RapidOCR


class OCRError(Exception):
    """Raised when the OCR engine fails."""
    pass


_engine: Optional[RapidOCR] = None


def get_ocr_engine():
    global _engine

    if _engine is None:
        _engine = RapidOCR(
            det_limit_side_len=736,
            det_limit_type="max",
        )

    return _engine


# Safe upper bound for high-resolution screenshots to prevent ONNX CPU compute bloat.
# High-quality Lanczos downsampling maintains sharp text edges.
MAX_IMAGE_SIDE_OCR = 1600


def extract_text_details_from_image(
    image_bytes: bytes,
    max_side: int = MAX_IMAGE_SIDE_OCR,
) -> List[Dict[str, Any]]:
    """
    Return recognized text with OCR confidence and bounding boxes.

    Confidence is the OCR model's text-recognition score,
    not the probability that a dark pattern exists.
    Oversized screenshots are safely downsampled with LANCZOS to avoid
    multi-megapixel OCR slowdowns, and bounding boxes are mapped back to
    original dimensions.
    """
    if not isinstance(image_bytes, bytes) or not image_bytes:
        raise ValueError("Image bytes must be non-empty bytes.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            orig_w, orig_h = pil_img.size
            scale = 1.0

            if max(orig_w, orig_h) > max_side and max_side > 0:
                scale = max_side / float(max(orig_w, orig_h))
                new_w = max(1, int(round(orig_w * scale)))
                new_h = max(1, int(round(orig_h * scale)))
                resized_img = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                image_array = np.array(resized_img.convert("RGB"))
            else:
                image_array = np.array(pil_img.convert("RGB"))
    except (UnidentifiedImageError, OSError, ValueError) as err:
        raise ValueError(
            f"Unreadable or unsupported image file. "
            f"Failed to decode image: {err}"
        ) from err
    except Exception as err:
        raise ValueError(
            f"Failed to process image data: {err}"
        ) from err

    engine = get_ocr_engine()

    try:
        result, _ = engine(image_array)
    except Exception as err:
        raise OCRError(
            f"OCR engine execution failed: {err}"
        ) from err

    details: List[Dict[str, Any]] = []

    if not result:
        return details

    for item in result:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue

        text = str(item[1]).strip()
        if not text:
            continue

        raw_confidence = item[2] if len(item) >= 3 else None

        try:
            confidence = (
                float(raw_confidence)
                if raw_confidence is not None
                else None
            )
        except (TypeError, ValueError):
            confidence = None

        raw_box = item[0]
        try:
            if raw_box is not None:
                box_arr = np.asarray(raw_box, dtype=float)
                if scale != 1.0:
                    box_arr = box_arr / scale
                bounding_box = box_arr.tolist()
            else:
                bounding_box = None
        except (TypeError, ValueError):
            bounding_box = None

        details.append({
            "text": text,
            "ocr_confidence": confidence,
            "bounding_box": bounding_box,
        })

    # Sort details into natural reading order (top-to-bottom, left-to-right)
    details = sort_ocr_details_reading_order(details)
    return details


def sort_ocr_details_reading_order(
    details: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Sort OCR text detections into natural top-to-bottom, left-to-right reading order
    based on bounding box coordinates.
    """
    if len(details) <= 1:
        return details

    def get_coords(item: Dict[str, Any]):
        box = item.get("bounding_box")
        if box and len(box) >= 4:
            try:
                top = min(pt[1] for pt in box)
                left = min(pt[0] for pt in box)
                bottom = max(pt[1] for pt in box)
                height = max(1.0, bottom - top)
                return (top, left, height)
            except (TypeError, IndexError):
                pass
        return (0.0, 0.0, 1.0)

    # First pass: sort primarily by top-y coordinate
    indexed = []
    for idx, item in enumerate(details):
        top, left, height = get_coords(item)
        indexed.append((top, left, height, idx, item))

    indexed.sort(key=lambda x: (x[0], x[1]))

    # Second pass: group items on the same horizontal line (within 50% line height)
    # and sort left-to-right
    lines: List[List[Any]] = []
    for entry in indexed:
        top, left, height, idx, item = entry
        placed = False
        for line in lines:
            line_top = line[0][0]
            line_h = max(line[0][2], height)
            if abs(top - line_top) <= (line_h * 0.5):
                line.append(entry)
                placed = True
                break
        if not placed:
            lines.append([entry])

    result: List[Dict[str, Any]] = []
    for line in lines:
        line.sort(key=lambda x: x[1])  # sort by left coordinate
        for entry in line:
            result.append(entry[4])

    return result


def assess_ocr_quality(details: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluates OCR text confidence and density to flag low-quality scans.
    """
    if not details:
        return {
            "quality": "empty",
            "average_confidence": 0.0,
            "total_tokens": 0,
            "total_characters": 0,
            "warning": None,
        }

    confidences = [
        d["ocr_confidence"]
        for d in details
        if isinstance(d.get("ocr_confidence"), (int, float))
    ]
    avg_conf = (
        round(sum(confidences) / len(confidences), 3)
        if confidences
        else 0.0
    )
    total_chars = sum(len(d.get("text", "")) for d in details)
    total_tokens = len(details)

    warning = None
    if avg_conf < 0.55 and total_tokens > 0:
        warning = (
            f"Low OCR text confidence ({avg_conf:.1%}). "
            "Some interface copy may be degraded, blurred, or partially recognized."
        )

    quality = "low" if avg_conf < 0.55 else "adequate"

    return {
        "quality": quality,
        "average_confidence": avg_conf,
        "total_tokens": total_tokens,
        "total_characters": total_chars,
        "warning": warning,
    }


def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Backward-compatible function returning recognized text
    as newline-separated lines.
    """
    details = extract_text_details_from_image(image_bytes)
    return "\n".join(item["text"] for item in details)