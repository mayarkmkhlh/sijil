"""Convert hand-written test-chat labels to the OrderSchema shape (draft, 2 Nov 2026).

Edit the CONSTANTS block to match your final zod schema (t066). Nothing here
calls a model. Run:  python convert_labels.py ../apps/data/chats
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

# ---- CONSTANTS: change these to match your schema -------------------------
LANGUAGE_MAP = {"gulf": "gulf_ar", "msa": "msa", "en": "en", "arabizi": "mixed", "mixed": "mixed"}
# 'cash' in a label is ambiguous: it is converted to cash_on_delivery and the
# original is kept in "accepted_payment" so the scorer can accept either.
PAYMENT_MAP = {"cash": "cash_on_delivery"}
REQUIRED_MISSING = {"customer_name", "items.quantity", "delivery_city", "delivery_address", "payment_method"}
# label path -> schema path (used for missing fields)
MISSING_MAP = {
    "customerName": "customer_name",
    "delivery.city": "delivery_city",
    "delivery.address": "delivery_address",
    "paymentMethod": "payment_method",
}
# ---------------------------------------------------------------------------

_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_DIACRITICS = re.compile("[ً-ٰٟـ]")  # harakat + tatweel


def normalise(text):
    """Same normalisation for label and prediction (scoring rule 1)."""
    if text is None:
        return None
    t = unicodedata.normalize("NFKC", str(text)).translate(_ARABIC_DIGITS)
    t = _DIACRITICS.sub("", t)
    t = re.sub("[إأآ]", "ا", t).replace("ى", "ي").replace("ة", "ه")
    tokens = [w for w in t.split() if w != "حي"]
    tokens = [w[2:] if w.startswith("ال") and len(w) > 3 else w for w in tokens]
    return " ".join(tokens).strip().lower()


def convert_label(label):
    """Label (camelCase, nested) -> schema-shaped dict. Returns None-safe output."""
    if label.get("noOrder"):
        return {"noOrder": True, "reason": label.get("reason")}
    d = label.get("delivery") or {}
    payment = label.get("paymentMethod")
    out = {
        "customer_name": label.get("customerName"),
        "items": [
            {
                "name": it.get("name"),
                "qty": it.get("quantity"),
                "unit_price": it.get("unitPrice"),
                # the label variant is one free string; it is NOT split into
                # size/colour here (that would be a guess). It goes in "text";
                # compare it as fuzzy text. Null when the chat named no variant.
                "variant": (
                    {"size": None, "colour": None, "text": it["variant"]}
                    if it.get("variant")
                    else None
                ),
            }
            for it in label.get("items", [])
        ],
        "currency": label.get("currency"),
        "delivery_city": d.get("city"),
        "delivery_district": d.get("district"),
        "delivery_address": d.get("address"),
        "delivery_date": label.get("deliveryDate"),
        "notes": label.get("notes"),
        "payment_method": PAYMENT_MAP.get(payment, payment),
        "language": LANGUAGE_MAP.get(label.get("language"), label.get("language")),
        "missing_fields": sorted(MISSING_MAP.get(m, m) for m in label.get("missingFields", [])),
    }
    if payment == "cash":
        out["accepted_payment"] = ["cash", "cash_on_delivery"]
    return out


def required_missing_only(predicted):
    """Keep only the five required fields, so extra optional gaps do not count (scoring rule 4)."""
    return sorted(m for m in predicted if m in REQUIRED_MISSING)


def load_chats(folder):
    for path in sorted(Path(folder).glob("c*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if not data.get("fictional"):
            raise ValueError(f"{path.name}: missing 'fictional': true")
        yield data


if __name__ == "__main__":
    folder = sys.argv[1] if len(sys.argv) > 1 else "../apps/data/chats"
    for chat in load_chats(folder):
        expected = convert_label(chat["expected"])
        print(chat["id"], chat.get("split", "dev"), json.dumps(expected, ensure_ascii=False)[:150])
