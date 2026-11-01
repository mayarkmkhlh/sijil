"""Convert hand-written test-chat labels to the OrderSchema shape (draft, 2 Nov 2026).

Edit the CONSTANTS block to match your final zod schema (t066). Nothing here
calls a model. From the repo root:

    python apps/data/convert_labels.py
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
# c06 is already labelled cash_on_delivery, so the chat id carries the same rule.
PAYMENT_MAP = {"cash": "cash_on_delivery"}
CASH_EITHER = {"c06"}
# Schema paths. A missing quantity is items.0.qty, and an empty items array is "items".
REQUIRED_MISSING = re.compile(
    r"^(customer_name|delivery_city|delivery_address|payment_method|items|items\.\d+\.qty)$"
)
# label path -> schema path (used for missing fields)
MISSING_MAP = {
    "customerName": "customer_name",
    "delivery.city": "delivery_city",
    "delivery.address": "delivery_address",
    "paymentMethod": "payment_method",
    "items": "items",
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


def convert_label(label, chat_id=None):
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
    if payment == "cash" or chat_id in CASH_EITHER:
        # Scorer hint only. OrderSchema does not have this key.
        out["accepted_payment"] = ["cash", "cash_on_delivery"]
    return out


def required_missing_only(predicted):
    """Keep name, item quantity, city, street address, and payment. Drop optional gaps."""
    return sorted(m for m in predicted if REQUIRED_MISSING.fullmatch(m))


def spot_check(chat, converted):
    """Fail the run if the two tricky labels, the cash rule, or c11 drift."""
    chat_id = chat["id"]
    if chat_id == "c07":
        # The buyer never names herself. ريما is the sister who receives the gift.
        if converted["customer_name"] is not None:
            raise AssertionError("c07 customer_name must stay null; ريما is the recipient")
        if "ريما" not in converted["notes"]:
            raise AssertionError("c07 notes must keep the recipient ريما")
        item = converted["items"][0]
        if item["qty"] != 1 or item["unit_price"] is not None or item["variant"] is not None:
            raise AssertionError("c07 is one unnamed-price gift box")
        if converted["currency"] is not None:
            raise AssertionError("c07 quotes no price, so currency stays null")
        if converted["payment_method"] != "card":
            raise AssertionError("c07 payment is card")
        if converted["missing_fields"] != ["customer_name"]:
            raise AssertionError("c07 asks back for the buyer name only")
        if converted["delivery_address"] != "عمارة ٥ شقة ٣":
            raise AssertionError("c07 building and apartment is a complete address")
        if converted["language"] != "gulf_ar":
            raise AssertionError("c07 language gulf maps to gulf_ar")
    if chat_id == "c09":
        quantities = [item["qty"] for item in converted["items"]]
        prices = [item["unit_price"] for item in converted["items"]]
        if quantities != [12, 6]:
            raise AssertionError("c09 dozen is 12 and half-dozen is 6, not 1 and 1")
        if prices != [30, 30]:
            raise AssertionError("c09 unit price is 360/12 and 180/6, not the group price")
        if converted["currency"] != "SAR" or converted["payment_method"] != "mada":
            raise AssertionError("c09 bare prices are SAR and مدى is mada")
        if converted["missing_fields"] != []:
            raise AssertionError("c09 states every required field")
        if "486" not in converted["notes"] or "خصم" not in converted["notes"]:
            raise AssertionError("c09 discount and total stay in notes, off the unit price")
        if converted["customer_name"] != "ام سعود" or converted["language"] != "gulf_ar":
            raise AssertionError("c09 keeps the kunya and maps gulf to gulf_ar")
    if chat_id == "c06":
        if converted["payment_method"] != "cash_on_delivery":
            raise AssertionError("c06 label value is cash_on_delivery")
        if converted.get("accepted_payment") != ["cash", "cash_on_delivery"]:
            raise AssertionError("c06 accepts a prediction of cash or cash_on_delivery")
    if chat_id == "c11":
        if "noOrder" in converted:
            raise AssertionError("c11 is an incomplete order, not a complaint")
        if converted["items"] != []:
            raise AssertionError("c11 must not invent items from 'same as last time'")
        if converted["delivery_city"] is not None or converted["delivery_address"] is not None:
            raise AssertionError("c11 must not turn the pin link into a city or address")
        if set(converted["missing_fields"]) != {
            "customer_name",
            "items",
            "delivery_city",
            "delivery_address",
            "payment_method",
        }:
            raise AssertionError("c11 missing_fields are the five required gaps, including empty items")
        if "لوكيشن" not in converted["notes"]:
            raise AssertionError("c11 notes must mention the pin")


def load_chats(folder):
    for path in sorted(Path(folder).glob("c*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if not data.get("fictional"):
            raise ValueError(f"{path.name}: missing 'fictional': true")
        yield data


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    folder = sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent / "chats"
    seen = set()
    for chat in load_chats(folder):
        expected = convert_label(chat["expected"], chat["id"])
        spot_check(chat, expected)
        seen.add(chat["id"])
        print(chat["id"], chat.get("split", "dev"), json.dumps(expected, ensure_ascii=False)[:150])
    required = {"c06", "c07", "c09", "c11"}
    if not required <= seen:
        raise SystemExit(f"spot-check did not see {sorted(required - seen)}")
    sample = ["customer_name", "items.0.qty", "items.0.variant.text", "delivery_date", "currency"]
    if required_missing_only(sample) != ["customer_name", "items.0.qty"]:
        raise SystemExit("required_missing_only dropped a quantity or kept an optional gap")
    print("spot-check c06 c07 c09 c11 ok")
