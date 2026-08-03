"""Receipt / ticket OCR helper for the Smart Expense Manager (Phase 6).

The frontend pre-processes the receipt image (tesseract.js via CDN — see
README) and ships the recognized text back; this module parses the text
into structured receipt fields (merchant, line items, total, date) using
deterministic regex + heuristics so it works without external API keys.

On the backend we also expose a tiny pure-text endpoint that lets a
desktop test run OCR receipts without the browser. The Tesseract binary is
NOT required — if unavailable, the analyst can still POST parsed text to
/api/expenses/ocr for categorization + amount extraction.

Production upgrade path: swap _extract_with_tesseract() for a Google Vision
or AWS Textract call. The exposed schema is identical.
"""
from __future__ import annotations

import io
import re
from datetime import datetime
from typing import Any

CATEGORY_KEYWORDS = {
    "hotel":    ["hotel", "inn", "resort", "lodge", "guest house", "suite", "room", "stay"],
    "flight":   ["airlines", "airline", "flight", "boarding", "pnr", "departure", "indigo", "spicejet", "air india", "vistara"],
    "food":     ["restaurant", "cafe", "coffee", "biryani", "dosa", "pizza", "burger", "dominos", "mcdonalds", "kitchen", "dhaba", "thali"],
    "transport":["taxi", "uber", "ola", "rapido", "metro", "bus", "train", "irctc", "auto", "rickshaw", "parking"],
    "shopping": ["mall", "market", "shop", "store", "bazaar", "levis", "zara", "h&m", "walmart"],
    "emergency":["pharmacy", "apollo", "medplus", "hospital", "clinic", "medical", "chemist"],
}


def _amounts_from_text(text: str) -> list[float]:
    """Pick up currency-style amounts in the receipt, prefer the LARGEST
    value (most receipts print the grand total as the largest line)."""
    candidates: list[float] = []
    for match in re.finditer(r"(?:rs\.?|inr|₹|\$|€|£)\s?([0-9][0-9,]*\.?[0-9]*)", text, flags=re.I):
        raw = match.group(1).replace(",", "")
        try:
            candidates.append(float(raw))
        except ValueError:
            continue
    for match in re.finditer(r"\btotal\b[^\n]{0,40}?([0-9][0-9,]*\.?[0-9]*)", text, flags=re.I):
        raw = match.group(1).replace(",", "")
        try:
            candidates.append(float(raw))
        except ValueError:
            continue
    return candidates


def _merchant_from_text(text: str) -> str | None:
    head = " ".join(text.strip().split()[:6])
    if not head:
        return None
    if len(head) > 60:
        head = head[:60]
    return head


def _date_from_text(text: str) -> str | None:
    patterns = [
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
        r"\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, flags=re.I)
        if m:
            try:
                if "/" in m.group(1) or "-" in m.group(1):
                    parts = re.split(r"[/-]", m.group(1))
                    if len(parts) == 3 and len(parts[2]) == 2:
                        parts[2] = "20" + parts[2]
                    dt = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                else:
                    dt = datetime.strptime(m.group(1)[:11], "%d %b %Y")
                return dt.strftime("%Y-%m-%d")
            except Exception:
                return m.group(1)
    return None


def categorize(text: str) -> str:
    """Rule-based expense category from receipt text. Falls back to 'other'."""
    lower = text.lower()
    for category, words in CATEGORY_KEYWORDS.items():
        if any(word in lower for word in words):
            return category
    return "other"


def parse_receipt(text: str) -> dict[str, Any]:
    """Parse OCR'd receipt text into structured expense input for the
    /api/expenses/ocr endpoint."""
    amounts = _amounts_from_text(text)
    total = max(amounts) if amounts else None
    merchant = _merchant_from_text(text)
    date = _date_from_text(text)
    category = categorize(text)
    line_items = []
    for line in text.splitlines():
        if line.strip() and re.search(r"[0-9]", line) and re.search(r"[a-zA-Z]", line):
            m = re.search(r"([0-9][0-9,]*\.?[0-9]*)\s*$", line)
            if m:
                try:
                    amt = float(m.group(1).replace(",", ""))
                    if amt > 0 and amt != total:
                        line_items.append({"text": line.strip(), "amount": amt})
                except ValueError:
                    pass
    return {
        "merchant": merchant,
        "amount": total,
        "currency": "INR",
        "category": category,
        "date": date,
        "line_items": line_items[:10],
        "raw_text_length": len(text),
        "confidence": "heuristic" if total else "low",
    }


def _extract_with_tesseract(image_bytes: bytes, mime_type: str) -> str | None:
    """Optional backend OCR via pytesseract if installed. Returns None when
    the binary isn't present — the frontend pre-OCR result still works."""
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
        image = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(image)
    except Exception:
        return None


def ocr_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict[str, Any]:
    """Public entry: if the server can OCR, do that; otherwise instruct the
    client to upload the pre-OCR text via /api/expenses/ocr (with text body)."""
    text = _extract_with_tesseract(image_bytes, mime_type)
    if text is None:
        return {
            "ocr_done": False,
            "message": "Server-side OCR not available. Pre-process with browser OCR and POST parsed text to /api/expenses/ocr.",
            "parsed": None,
        }
    return {"ocr_done": True, "message": "OCR completed on server.", "parsed": parse_receipt(text)}
