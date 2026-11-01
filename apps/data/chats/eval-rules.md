# Sijil eval: labelling and scoring rules (draft v1, 1 Nov 2026)

Status: checked by a 4-member AI council (Gulf-Arabic linguist, senior engineer, market realist, devil's advocate). Not yet reviewed by the author.

## Split
- Dev set: c01-c06. Use these to build and tune prompts.
- Hold-out: c07-c10. Do not tune prompts on them. Run them last, once per model.

## Labelling rules (used for every chat)
- Keys: customerName, items[{name, variant, quantity, unitPrice}], currency, delivery{city, district, address}, deliveryDate, notes, paymentMethod, missingFields[], language.
- Label only what the chat states. Never guess. Anything required but not stated is null and listed in missingFields.
- Required: customerName, items with quantity, delivery.city, delivery.address (street or building level), paymentMethod. Prices are not required.
- Currency is SAR whenever the seller quotes a bare price. If no price is quoted, unitPrice and currency are null.
- Singular item with no stated number = quantity 1.
- City plus district without a street or building = missing delivery.address.
- Gift order: customerName is the person ordering; the recipient and card text go in notes.
- Group prices (per dozen): unitPrice is the exact per-unit price if it divides exactly (دزينة = 12, نص دزينة = 6). Discounts and totals go in notes.
- If the customer corrects a detail, label the final state only.
- Relative dates resolve against chatDate. "Before Thursday" goes in notes, not deliveryDate.
- A chat that is not a new order has expected output {"noOrder": true, "reason": "..."}.

## Scoring rules
1. Normalise both label and prediction the same way: NFKC, Arabic-Indic digits to ASCII, strip diacritics and tatweel, unify alef/ya/ta-marbuta, drop the standalone token "حي", drop a leading "ال".
2. Items: match one-to-one (name plus variant together, fuzzy on words). Numbers and units must match exactly (500 is not 250, علبة is not علبتين). Then compare quantity and unitPrice exactly. Unmatched label items count as missed; unmatched predicted items as invented.
3. Closed enums for paymentMethod and language. Keep cash and cash_on_delivery separate and report a confusion matrix. c06 ("بدفع كاش") is ambiguous: accept either cash or cash_on_delivery for that chat only.
4. missingFields: score as a set (precision and recall; two empty sets = 1.0). Separately check that missingFields equals the set of required fields that are null. Report the two checks separately.
5. Report three error types separately for every field: wrong value, missed (null where the label has a value), invented (a value where the label is null). Average only recall over non-null label fields, so an empty skeleton does not score.
6. Critical fields: items (name, quantity, price), delivery.city, delivery.address, paymentMethod. Report the share of chats where all critical fields are correct. An invented critical field (for example customerName = the gift recipient in c07) is a hard fail for that chat.
7. noOrder: the model must return the noOrder object; an empty order does not count. Count false positives and false negatives. There is only one non-order chat, so do not quote a rate.
8. Also report JSON validity (including extra keys) and latency and token usage per chat.
9. Report raw counts (k of n), not percentages. At n=10 one chat moves the score by 10 points; do not claim differences smaller than about 15 points. Run each model more than once if time allows. Call it a "10-chat smoke test", not a benchmark.

## Still to add (optional, strongest remaining gap)
- c11: customer sends a location pin or maps link and says "same as last time", with no item, city or address typed. Label: items empty, delivery.city and delivery.address null and in missingFields, notes mention the pin. Tests whether the model invents an order or an address from a link.
