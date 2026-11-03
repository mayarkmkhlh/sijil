10-chat smoke test for c01-c10: python apps/data/smoke_test.py

10-chat smoke test against https://sijil-us.onrender.com/api/extract. Token counts are not in the response.

json valid 10 of 10
noOrder false positives 0, false negatives 0 (c10)
critical 9 of 10
c07: a buyer name was filled in, one quantity was empty, and an extra item was added
missingFields recall 6 of 7, precision 6 of 8, exact 8 of 9
missingFields equals required nulls 9 of 9

customerName 8 of 8, wrong 0, missed 0, invented 1
items.name 14 of 14, wrong 0, missed 0, invented 1
items.quantity 13 of 14, wrong 0, missed 1, invented 0
items.unitPrice 13 of 13, wrong 0, missed 0, invented 0
currency 8 of 8, wrong 0, missed 0, invented 0
delivery.city 8 of 8, wrong 0, missed 0, invented 0
delivery.district 8 of 8, wrong 0, missed 0, invented 0
delivery.address 5 of 5, wrong 0, missed 0, invented 0
deliveryDate 1 of 1, wrong 0, missed 0, invented 0
notes 1 of 5, wrong 1, missed 3, invented 0
paymentMethod 8 of 8, wrong 0, missed 0, invented 0
language 9 of 9, wrong 0, missed 0, invented 0

latency seconds: c01 88.6 (includes the free server waking up), c02 18.0, c03 11.8, c04 10.5, c05 12.7, c06 15.6, c07 20.2, c08 14.2, c09 23.1, c10 5.5
