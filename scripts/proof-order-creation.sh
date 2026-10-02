#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "Proof: Server-Authoritative Order Creation via curl"
echo "=================================================="

BASE_URL="http://127.0.0.1:3000"
COOKIE_JAR="proof_buyer_cookies.txt"
rm -f "$COOKIE_JAR"

echo ""
echo "--- Step 0: Authoritative Session Login as Buyer ---"
LOGIN_RES=$(curl.exe -s -i -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@ngebekasinyuk.id","password":"Password123!"}')

HTTP_CODE=$(echo "$LOGIN_RES" | grep -i "^HTTP" | tail -n 1 | awk '{print $2}')
echo "Login HTTP Status: $HTTP_CODE"

echo ""
echo "--- Step 1: Tampered itemPrice in Request Body ---"
TAMPER_RES=$(curl.exe -s -w "\nHTTP_STATUS:%{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: proof-idemp-tamper-price-001" \
  -d '{"listingId":"prod-sony-a7iii","shippingAddress":"Jl. Merdeka No. 10, Jakarta Pusat","courier":"J&T Express","paymentMethod":"BCA_VA","itemPrice":100}')

echo "$TAMPER_RES"

echo ""
echo "--- Step 2: Injected buyerId in Request Body ---"
INJECT_RES=$(curl.exe -s -w "\nHTTP_STATUS:%{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: proof-idemp-inject-buyer-002" \
  -d '{"listingId":"prod-sony-a7iii","shippingAddress":"Jl. Merdeka No. 10, Jakarta Pusat","courier":"J&T Express","paymentMethod":"BCA_VA","buyerId":"usr-admin-ngebekasin"}')

echo "$INJECT_RES"

echo ""
echo "--- Step 3: Inactive Listing Purchase Attempt (list-sony-wh1000xm4 is SOLD in seed) ---"
INACTIVE_RES=$(curl.exe -s -w "\nHTTP_STATUS:%{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: proof-idemp-inactive-listing-003" \
  -d '{"listingId":"list-sony-wh1000xm4","shippingAddress":"Jl. Merdeka No. 10, Jakarta Pusat","courier":"J&T Express","paymentMethod":"BCA_VA"}')

echo "$INACTIVE_RES"

echo ""
echo "--- Step 4: Valid Authoritative Order Creation (prod-sony-a7iii) ---"
VALID_RES=$(curl.exe -s -w "\nHTTP_STATUS:%{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: proof-idemp-valid-004" \
  -d '{"listingId":"prod-sony-a7iii","shippingAddress":"Jl. Merdeka No. 10, Jakarta Pusat","courier":"J&T Express","paymentMethod":"BCA_VA"}')

echo "$VALID_RES"

echo ""
echo "--- Step 5: Second Order on Same Listing Without DB Reset ---"
SECOND_RES=$(curl.exe -s -w "\nHTTP_STATUS:%{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: proof-idemp-second-attempt-005" \
  -d '{"listingId":"prod-sony-a7iii","shippingAddress":"Jl. Merdeka No. 10, Jakarta Pusat","courier":"J&T Express","paymentMethod":"BCA_VA"}')

echo "$SECOND_RES"

echo ""
echo "--- Step 6: Idempotent Replay with Same Key (proof-idemp-valid-004) ---"
REPLAY_RES=$(curl.exe -s -w "\nHTTP_STATUS:%{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: proof-idemp-valid-004" \
  -d '{"listingId":"prod-sony-a7iii","shippingAddress":"Jl. Merdeka No. 10, Jakarta Pusat","courier":"J&T Express","paymentMethod":"BCA_VA"}')

echo "$REPLAY_RES"

rm -f "$COOKIE_JAR"
echo ""
echo "=================================================="
echo "Proof Execution Complete"
echo "=================================================="
