"""10-chat smoke test.

Posts c01-c10 to the extract API and prints per-field counts and latency.
c11 is not included. This does not read .env, call Meta, or edit the prompt.
"""
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from convert_labels import convert_label, load_chats, normalise, required_missing_only

EXTRACT_URL = "https://sijil-us.onrender.com/api/extract"
TIMEOUT_SECONDS = 180
FIELD_NAMES = (
    "customer_name",
    "items.name",
    "items.qty",
    "items.unit_price",
    "currency",
    "delivery_city",
    "delivery_district",
    "delivery_address",
    "delivery_date",
    "notes",
    "payment_method",
    "language",
)
PRINT_NAMES = {
    "customer_name": "customerName",
    "items.name": "items.name",
    "items.qty": "items.quantity",
    "items.unit_price": "items.unitPrice",
    "currency": "currency",
    "delivery_city": "delivery.city",
    "delivery_district": "delivery.district",
    "delivery_address": "delivery.address",
    "delivery_date": "deliveryDate",
    "notes": "notes",
    "payment_method": "paymentMethod",
    "language": "language",
}
CRITICAL_FIELDS = {
    "items.name",
    "items.qty",
    "items.unit_price",
    "delivery_city",
    "delivery_address",
    "payment_method",
}
ORDER_KEYS = {
    "customer_name",
    "items",
    "currency",
    "delivery_city",
    "delivery_district",
    "delivery_address",
    "delivery_date",
    "payment_method",
    "notes",
    "missing_fields",
    "language",
    "confidence",
}
ITEM_KEYS = {"name", "qty", "variant", "unit_price"}
VARIANT_KEYS = {"size", "colour", "text"}
_PUNCT = re.compile(r"[^\w\s]+", re.UNICODE)


def _folded(groups):
    folded = {}
    for canon, words in groups.items():
        key = normalise(canon)
        for word in words:
            folded[normalise(word)] = key
    return folded


# Variant words the labels treat as the same token (c04 accepts black or aswad).
# Numbers and measure-units are not folded here.
_WORD_FOLDS = _folded(
    {
        "black": ["black", "aswad", "اسود", "سوداء", "سودا"],
        "white": ["white", "ابيض", "أبيض"],
        "red": ["red", "hamra", "احمر", "حمراء"],
        "beige": ["beige", "بيج"],
        "blue": ["blue", "ازرق", "أزرق"],
        "green": ["green", "اخضر", "أخضر"],
        "grey": ["grey", "gray", "رمادي"],
        "brown": ["brown", "بني"],
        "pink": ["pink", "وردي"],
        "large": ["large", "l", "كبير", "كبيرة"],
        "small": ["small", "s", "صغير", "صغيرة"],
        "medium": ["medium", "m", "وسط"],
        "size": ["size", "مقاس"],
    }
)

# Canonical measure token, then family. Same family with two forms conflicts
# (علبة is not علبتين). A family present on only one side does not.
_UNIT_CANON = _folded(
    {
        "علبة": ["علبة", "علبه"],
        "علبتين": ["علبتين"],
        "علب": ["علب"],
        "حبة": ["حبة", "حبه"],
        "حبتين": ["حبتين"],
        "حبات": ["حبات"],
        "جرام": ["جرام", "غرام", "جم", "g", "gram", "grams"],
        "كيلو": ["كيلو", "كيلوغرام", "كجم", "كغ", "kg"],
        "قطعة": ["قطعة", "قطعه"],
        "قطعتين": ["قطعتين"],
        "دزينة": ["دزينة", "درزن", "dozen"],
        "مل": ["مل", "ملل", "ml"],
        "لتر": ["لتر"],
    }
)
_UNIT_FAMILY = {
    "علبه": "box",
    "علبتين": "box",
    "علب": "box",
    "حبه": "piece",
    "حبتين": "piece",
    "حبات": "piece",
    "جرام": "gram",
    "كيلو": "kilo",
    "قطعه": "piece-count",
    "قطعتين": "piece-count",
    "دزينه": "dozen",
    "مل": "ml",
    "لتر": "litre",
}


def transcript(chat):
    return "\n".join(f"{message['from']}: {message['text']}" for message in chat["messages"])


def smoke_chats(folder):
    wanted = [f"c{number:02d}" for number in range(1, 11)]
    chats = [chat for chat in load_chats(folder) if chat["id"] in wanted]
    ids = [chat["id"] for chat in chats]
    if ids != wanted:
        raise SystemExit(f"expected c01-c10, found {ids}")
    return chats


def post_extract(chat_text, chat_date):
    payload = json.dumps({"chat": chat_text, "chatDate": chat_date}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        EXTRACT_URL,
        data=payload,
        headers={"content-type": "application/json; charset=utf-8", "accept": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as error:
        raw = error.read()
        status = error.code
    except (urllib.error.URLError, TimeoutError):
        return None, None, time.perf_counter() - started
    try:
        body = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        body = None
    return status, body, time.perf_counter() - started


def _items_well_formed(items):
    if not isinstance(items, list):
        return False
    for item in items:
        if not isinstance(item, dict) or set(item) - ITEM_KEYS:
            return False
        variant = item.get("variant")
        if variant is not None and (not isinstance(variant, dict) or set(variant) - VARIANT_KEYS):
            return False
    return True


def interpret(status, body):
    outcome = {"json_ok": False, "no_order": False, "order": None, "status": status}
    if not isinstance(status, int) or not 200 <= status < 300 or not isinstance(body, dict):
        return outcome
    if body.get("kind") == "noOrder":
        reason = body.get("reason")
        is_object = isinstance(reason, str) and bool(reason.strip())
        outcome["no_order"] = is_object
        outcome["json_ok"] = is_object and set(body) <= {"kind", "reason", "attempts"}
        return outcome
    order = body.get("order")
    if body.get("kind") != "order" or not isinstance(order, dict):
        return outcome
    order = dict(order)
    if "missing_fields" not in order and isinstance(body.get("missing_fields"), list):
        order["missing_fields"] = body["missing_fields"]
    outcome["order"] = order
    extra_response = set(body) - {"kind", "order", "missing_fields", "attempts"}
    outcome["json_ok"] = (
        not extra_response and set(order) <= ORDER_KEYS and _items_well_formed(order.get("items"))
    )
    return outcome


def _tokens(text):
    numbers, units, words = [], [], []
    if text is None:
        return numbers, units, words
    cleaned = _PUNCT.sub(" ", normalise(text))
    for token in cleaned.split():
        if re.fullmatch(r"\d+(?:\.\d+)?", token):
            numbers.append(float(token))
            continue
        unit = _UNIT_CANON.get(token)
        if unit in _UNIT_FAMILY:
            units.append(unit)
            continue
        words.append(_WORD_FOLDS.get(token, token))
    return numbers, units, words


def _variant_text(variant):
    if variant is None:
        return None
    if isinstance(variant, str):
        return variant
    if not isinstance(variant, dict):
        return None
    parts = [variant.get("size"), variant.get("colour"), variant.get("text")]
    text = " ".join(str(part) for part in parts if part)
    return text or None


def _item_parts(item):
    name_numbers, name_units, name_words = _tokens(item.get("name"))
    variant_numbers, variant_units, variant_words = _tokens(_variant_text(item.get("variant")))
    return {
        "numbers": name_numbers + variant_numbers,
        "units": name_units + variant_units,
        "words": name_words + variant_words,
    }


def _units_compatible(left, right):
    def grouped(units):
        groups = {}
        for unit in units:
            groups.setdefault(_UNIT_FAMILY[unit], set()).add(unit)
        return groups

    left_groups, right_groups = grouped(left), grouped(right)
    for family in set(left_groups) & set(right_groups):
        if left_groups[family] != right_groups[family]:
            return False
    return True


def _items_compatible(left, right):
    if sorted(left["numbers"]) != sorted(right["numbers"]):
        return False
    if not _units_compatible(left["units"], right["units"]):
        return False
    left_words, right_words = set(left["words"]), set(right["words"])
    if not left_words or not right_words:
        return False
    return left_words <= right_words or right_words <= left_words


def _numbers_equal(left, right):
    if left is None or right is None:
        return left is None and right is None
    try:
        return float(left) == float(right)
    except (TypeError, ValueError):
        return False


def match_items(label_items, pred_items):
    """One-to-one item match: fuzzy words, exact numbers, conflicting units rejected."""
    candidates = []
    parts = {}
    for index, item in enumerate(label_items):
        parts[("l", index)] = _item_parts(item)
    for index, item in enumerate(pred_items):
        parts[("p", index)] = _item_parts(item)
    for i, label_item in enumerate(label_items):
        for j, pred_item in enumerate(pred_items):
            left, right = parts[("l", i)], parts[("p", j)]
            if not _items_compatible(left, right):
                continue
            shared = len(set(left["words"]) & set(right["words"]))
            smaller = min(len(set(left["words"])), len(set(right["words"])))
            candidates.append(
                (
                    _numbers_equal(label_item.get("qty"), pred_item.get("qty")),
                    _numbers_equal(label_item.get("unit_price"), pred_item.get("unit_price")),
                    shared / smaller,
                    i,
                    j,
                )
            )
    candidates.sort(reverse=True)
    used_label, used_pred, pairs = set(), set(), []
    for _qty, _price, _score, i, j in candidates:
        if i in used_label or j in used_pred:
            continue
        used_label.add(i)
        used_pred.add(j)
        pairs.append((label_items[i], pred_items[j]))
    missed = [item for i, item in enumerate(label_items) if i not in used_label]
    invented = [item for j, item in enumerate(pred_items) if j not in used_pred]
    return pairs, missed, invented


def _blank_fields():
    return {name: {"correct": 0, "wrong": 0, "missed": 0, "invented": 0} for name in FIELD_NAMES}


def _kind(label_value, pred_value, matches):
    if label_value is None and pred_value is None:
        return None
    if label_value is None:
        return "invented"
    if pred_value is None:
        return "missed"
    return "correct" if matches else "wrong"


def _text_kind(label_value, pred_value):
    matches = label_value is not None and pred_value is not None and normalise(label_value) == normalise(pred_value)
    return _kind(label_value, pred_value, matches)


def _notes_kind(label_value, pred_value):
    if label_value is None and pred_value is None:
        return None
    if label_value is None:
        return "invented"
    if pred_value is None:
        return "missed"
    label_text, pred_text = normalise(label_value), normalise(pred_value)
    if label_text == pred_text:
        return "correct"
    label_tokens = _PUNCT.sub(" ", label_text).split()
    pred_tokens = set(_PUNCT.sub(" ", pred_text).split())
    # c08 notes are scored by presence of the labelled wording, not one exact sentence.
    return "correct" if label_tokens and all(token in pred_tokens for token in label_tokens) else "wrong"


def _payment_kind(label, pred_value):
    gold = label.get("payment_method")
    if gold is None and pred_value is None:
        return None
    if gold is None:
        return "invented"
    if pred_value is None:
        return "missed"
    accepted = label.get("accepted_payment") or []
    return "correct" if pred_value == gold or pred_value in accepted else "wrong"


def _required_nulls(order):
    missing = []
    for key in ("customer_name", "delivery_city", "delivery_address", "payment_method"):
        if order.get(key) is None:
            missing.append(key)
    items = order.get("items")
    if not isinstance(items, list) or not items:
        missing.append("items")
    else:
        for index, item in enumerate(items):
            if isinstance(item, dict) and item.get("qty") is None:
                missing.append(f"items.{index}.qty")
    return sorted(missing)


def _remember(fields, critical, name, kind):
    if not kind:
        return critical
    fields[name][kind] += 1
    if name in CRITICAL_FIELDS and kind in {"wrong", "missed", "invented"}:
        return False
    if name == "customer_name" and kind == "invented":
        return False
    return critical


def _score_items(fields, critical, label_items, pred_items):
    pairs, missed, invented = match_items(label_items, pred_items)
    for label_item, pred_item in pairs:
        critical = _remember(fields, critical, "items.name", "correct")
        critical = _remember(
            fields,
            critical,
            "items.qty",
            _kind(label_item.get("qty"), pred_item.get("qty"), _numbers_equal(label_item.get("qty"), pred_item.get("qty"))),
        )
        critical = _remember(
            fields,
            critical,
            "items.unit_price",
            _kind(
                label_item.get("unit_price"),
                pred_item.get("unit_price"),
                _numbers_equal(label_item.get("unit_price"), pred_item.get("unit_price")),
            ),
        )
    for label_item in missed:
        critical = _remember(fields, critical, "items.name", "missed")
        critical = _remember(fields, critical, "items.qty", _kind(label_item.get("qty"), None, False))
        critical = _remember(fields, critical, "items.unit_price", _kind(label_item.get("unit_price"), None, False))
    for pred_item in invented:
        critical = _remember(fields, critical, "items.name", "invented")
        critical = _remember(fields, critical, "items.qty", _kind(None, pred_item.get("qty"), False))
        critical = _remember(fields, critical, "items.unit_price", _kind(None, pred_item.get("unit_price"), False))
    return critical


def score_chat(label, outcome):
    fields = _blank_fields()
    result = {
        "fields": fields,
        "missing_hit": 0,
        "missing_label_n": 0,
        "missing_pred_n": 0,
        "missing_exact": None,
        "missing_consistent": None,
        "critical": False,
        "fp": 0,
        "fn": 0,
    }
    if label.get("noOrder"):
        result["critical"] = bool(outcome["no_order"])
        result["fp"] = 0 if outcome["no_order"] else 1
        return result

    pred = None if outcome["no_order"] else outcome["order"]
    if outcome["no_order"]:
        result["fn"] = 1
    critical = pred is not None
    scalars = (
        ("customer_name", "customer_name", _text_kind),
        ("currency", "currency", _text_kind),
        ("delivery_city", "delivery_city", _text_kind),
        ("delivery_district", "delivery_district", _text_kind),
        ("delivery_address", "delivery_address", _text_kind),
        ("delivery_date", "delivery_date", _text_kind),
        ("notes", "notes", _notes_kind),
        ("language", "language", _text_kind),
    )
    for field, key, scorer in scalars:
        pred_value = None if pred is None else pred.get(key)
        critical = _remember(fields, critical, field, scorer(label.get(key), pred_value))
    pred_payment = None if pred is None else pred.get("payment_method")
    critical = _remember(fields, critical, "payment_method", _payment_kind(label, pred_payment))
    pred_items = []
    if pred is not None and isinstance(pred.get("items"), list):
        pred_items = [item for item in pred["items"] if isinstance(item, dict)]
    critical = _score_items(fields, critical, label.get("items") or [], pred_items)

    label_missing = set(label.get("missing_fields") or [])
    pred_missing = [] if pred is None else required_missing_only(str(item) for item in pred.get("missing_fields") or [])
    pred_set = set(pred_missing)
    result["missing_hit"] = len(label_missing & pred_set)
    result["missing_label_n"] = len(label_missing)
    result["missing_pred_n"] = len(pred_set)
    result["missing_exact"] = pred is not None and label_missing == pred_set
    if pred is not None:
        result["missing_consistent"] = pred_set == set(_required_nulls(pred))
    result["critical"] = critical
    return result


def _add_fields(total, fields):
    for name in FIELD_NAMES:
        for kind in ("correct", "wrong", "missed", "invented"):
            total[name][kind] += fields[name][kind]


def run_smoke(folder):
    rows = []
    totals = _blank_fields()
    missing = {"hit": 0, "label_n": 0, "pred_n": 0, "exact": 0, "exact_n": 0, "consistent": 0, "consistent_n": 0}
    critical_hits = fp = fn = json_hits = 0
    print("10-chat smoke test", flush=True)
    for chat in smoke_chats(folder):
        status, body, seconds = post_extract(transcript(chat), chat["chatDate"])
        outcome = interpret(status, body)
        scored = score_chat(convert_label(chat["expected"], chat["id"]), outcome)
        _add_fields(totals, scored["fields"])
        missing["hit"] += scored["missing_hit"]
        missing["label_n"] += scored["missing_label_n"]
        missing["pred_n"] += scored["missing_pred_n"]
        if scored["missing_exact"] is not None:
            missing["exact_n"] += 1
            missing["exact"] += int(scored["missing_exact"])
        if scored["missing_consistent"] is not None:
            missing["consistent_n"] += 1
            missing["consistent"] += int(scored["missing_consistent"])
        critical_hits += int(scored["critical"])
        fp += scored["fp"]
        fn += scored["fn"]
        json_hits += int(outcome["json_ok"])
        row = {
            "id": chat["id"],
            "seconds": seconds,
            "status": status,
            "json_ok": outcome["json_ok"],
        }
        rows.append(row)
        status_text = "" if status == 200 else f"  http {status if status is not None else 'unreachable'}"
        validity = "json ok" if outcome["json_ok"] else "json invalid"
        print(
            f"{chat['id']}  latency {seconds:.1f}s  tokens unavailable{status_text}  {validity}",
            flush=True,
        )
    for name in FIELD_NAMES:
        tally = totals[name]
        scored_n = tally["correct"] + tally["wrong"] + tally["missed"]
        print(
            f"{PRINT_NAMES[name]}  {tally['correct']} of {scored_n}"
            f"  wrong {tally['wrong']}  missed {tally['missed']}  invented {tally['invented']}"
        )
    print(f"missingFields recall  {missing['hit']} of {missing['label_n']}")
    print(f"missingFields precision  {missing['hit']} of {missing['pred_n']}")
    print(f"missingFields exact  {missing['exact']} of {missing['exact_n']}")
    print(f"missingFields equals required nulls  {missing['consistent']} of {missing['consistent_n']}")
    print(f"critical  {critical_hits} of {len(rows)}")
    print(f"noOrder false_positives {fp}")
    print(f"noOrder false_negatives {fn}")
    print(f"json_valid  {json_hits} of {len(rows)}")


def _api_missing(order, required):
    extra = list(required)
    for key in ("currency", "delivery_district", "delivery_date"):
        if order.get(key) is None:
            extra.append(key)
    for index, item in enumerate(order.get("items") or []):
        if item.get("unit_price") is None:
            extra.append(f"items.{index}.unit_price")
        if item.get("variant") is None:
            extra.append(f"items.{index}.variant")
        else:
            for part in ("size", "colour", "text"):
                if item["variant"].get(part) is None:
                    extra.append(f"items.{index}.variant.{part}")
    return extra


def _gold_outcome(chat):
    converted = convert_label(chat["expected"], chat["id"])
    if converted.get("noOrder"):
        body = {"kind": "noOrder", "reason": converted["reason"], "attempts": 1}
        return converted, interpret(200, body)
    order = {key: value for key, value in converted.items() if key != "accepted_payment"}
    order["confidence"] = 0.5
    order["missing_fields"] = _api_missing(order, order["missing_fields"])
    body = {"kind": "order", "order": order, "missing_fields": order["missing_fields"], "attempts": 1}
    return converted, interpret(200, body)


def self_check():
    folder = Path(__file__).resolve().parent / "chats"
    chats = smoke_chats(folder)
    assert [chat["id"] for chat in chats] == [f"c{number:02d}" for number in range(1, 11)]
    assert "c11" not in {chat["id"] for chat in chats}
    assert normalise("حي النرجس") == normalise("النرجس")
    assert normalise("شارع ٢٢") == normalise("شارع 22")

    totals = _blank_fields()
    missing = {"hit": 0, "label_n": 0, "pred_n": 0, "exact": 0, "exact_n": 0, "consistent": 0, "consistent_n": 0}
    critical_hits = fp = fn = json_hits = 0
    by_id = {}
    for chat in chats:
        label, outcome = _gold_outcome(chat)
        assert outcome["json_ok"], chat["id"]
        scored = score_chat(label, outcome)
        by_id[chat["id"]] = (label, outcome, scored)
        _add_fields(totals, scored["fields"])
        missing["hit"] += scored["missing_hit"]
        missing["label_n"] += scored["missing_label_n"]
        missing["pred_n"] += scored["missing_pred_n"]
        if scored["missing_exact"] is not None:
            missing["exact_n"] += 1
            missing["exact"] += int(scored["missing_exact"])
        if scored["missing_consistent"] is not None:
            missing["consistent_n"] += 1
            missing["consistent"] += int(scored["missing_consistent"])
        critical_hits += int(scored["critical"])
        fp += scored["fp"]
        fn += scored["fn"]
        json_hits += int(outcome["json_ok"])

    for name in FIELD_NAMES:
        tally = totals[name]
        assert tally["wrong"] == 0 and tally["missed"] == 0 and tally["invented"] == 0, name
        scored_n = tally["correct"] + tally["wrong"] + tally["missed"]
        assert tally["correct"] == scored_n, name
    assert missing == {
        "hit": 7,
        "label_n": 7,
        "pred_n": 7,
        "exact": 9,
        "exact_n": 9,
        "consistent": 9,
        "consistent_n": 9,
    }, missing
    assert critical_hits == 10 and fp == 0 and fn == 0 and json_hits == 10

    dirty = dict(by_id["c01"][1])
    dirty_body_order = dict(dirty["order"])
    dirty_body_order["delivery_district"] = "حي النرجس"
    dirty["order"] = dirty_body_order
    district = score_chat(by_id["c01"][0], dirty)
    assert district["fields"]["delivery_district"]["correct"] == 1
    assert district["critical"]

    c06_label, c06_outcome, _c06 = by_id["c06"]
    cash = dict(c06_outcome["order"])
    cash["payment_method"] = "cash"
    cash_score = score_chat(c06_label, {**c06_outcome, "order": cash})
    assert cash_score["fields"]["payment_method"]["correct"] == 1
    c02_label, c02_outcome, _c02 = by_id["c02"]
    c02_cash = dict(c02_outcome["order"])
    c02_cash["payment_method"] = "cash"
    c02_score = score_chat(c02_label, {**c02_outcome, "order": c02_cash})
    assert c02_score["fields"]["payment_method"]["wrong"] == 1
    assert not c02_score["critical"]

    c07_label, c07_outcome, c07_score = by_id["c07"]
    assert c07_score["critical"]
    gifted = dict(c07_outcome["order"])
    gifted["customer_name"] = "ريما"
    gifted_score = score_chat(c07_label, {**c07_outcome, "order": gifted})
    assert gifted_score["fields"]["customer_name"]["invented"] == 1
    assert not gifted_score["critical"]

    cookie, other_cookie = by_id["c01"][1]["order"]["items"]
    merged = {"name": "علبة كوكيز ١٢ حبة", "qty": 1, "unit_price": 45, "variant": None}
    pairs, missed, invented = match_items([other_cookie], [merged])
    assert pairs and not missed and not invented
    conflict = {"name": "كوكيز", "qty": 1, "unit_price": 45, "variant": {"size": None, "colour": None, "text": "علبتين ١٢ حبة"}}
    pairs, missed, invented = match_items([other_cookie], [conflict])
    assert not pairs and missed and invented
    half = {"name": "تمر سكري", "qty": 2, "unit_price": 150, "variant": {"size": None, "colour": None, "text": "٢٥٠ جرام"}}
    full = by_id["c08"][1]["order"]["items"][0]
    pairs, missed, invented = match_items([full], [half])
    assert not pairs and missed and invented
    oud, oil = by_id["c05"][1]["order"]["items"]
    pairs, missed, invented = match_items([oud], [oil])
    assert not pairs
    sanadel = by_id["c04"][1]["order"]["items"][0]
    aswad = {"name": "sanadel", "qty": 2, "unit_price": 180, "variant": {"size": "38", "colour": "aswad", "text": None}}
    pairs, missed, invented = match_items([sanadel], [aswad])
    assert pairs and not missed
    red = {"name": "sanadel", "qty": 2, "unit_price": 180, "variant": {"size": "38", "colour": "red", "text": None}}
    pairs, missed, invented = match_items([sanadel], [red])
    assert not pairs

    no_order = interpret(200, {"kind": "noOrder", "reason": "late", "attempts": 1})
    fn_score = score_chat(by_id["c01"][0], no_order)
    assert fn_score["fn"] == 1 and not fn_score["critical"]
    empty = {
        "customer_name": None,
        "items": [],
        "currency": None,
        "delivery_city": None,
        "delivery_district": None,
        "delivery_address": None,
        "delivery_date": None,
        "payment_method": None,
        "notes": None,
        "missing_fields": ["customer_name", "items", "delivery_city", "delivery_address", "payment_method"],
        "language": "gulf_ar",
        "confidence": 0.1,
    }
    empty_score = score_chat(by_id["c10"][0], interpret(200, {"kind": "order", "order": empty, "attempts": 1}))
    assert empty_score["fp"] == 1 and not empty_score["critical"]
    extra = interpret(200, {"kind": "noOrder", "reason": "late", "attempts": 1, "model": "other"})
    assert extra["no_order"] and not extra["json_ok"]
    failed = score_chat(by_id["c01"][0], interpret(502, {"error": "model request failed"}))
    assert failed["fn"] == 0 and not failed["critical"]
    assert failed["fields"]["customer_name"]["missed"] == 1
    print("check ok")


def main(argv):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if argv == ["--check"]:
        self_check()
        return
    if argv:
        raise SystemExit("usage: python apps/data/smoke_test.py")
    run_smoke(Path(__file__).resolve().parent / "chats")


if __name__ == "__main__":
    main(sys.argv[1:])
