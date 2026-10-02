#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3000"

echo "=== 1. POST /api/wallet/pin WITHOUT SESSION (EXPECT 401 UNAUTHORIZED) ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST "$BASE_URL/api/wallet/pin" \
  -H "Content-Type: application/json" \
  -d '{"password":"Password123!","pin":"741852"}'

echo ""
echo "=== REGISTER NEW SELLER (HAS NULL PIN PER TASK 4.6) ==="
COOKIE_JAR=$(mktemp)
TS=$(date +%s)
REG_EMAIL="seller-curl-${TS}@ngebekasinyuk.id"
REG_RESP=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Seller Curl ${TS}\",\"email\":\"${REG_EMAIL}\",\"password\":\"Password123!\",\"phone\":\"+6281234567890\",\"role\":\"SELLER\"}")
echo "Seller registered."

echo ""
echo "=== 2. POST /api/wallet/pin WITH WRONG PASSWORD (EXPECT 401 INVALID_CREDENTIALS) ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/wallet/pin" \
  -H "Content-Type: application/json" \
  -d '{"password":"WrongPassword999!","pin":"741852"}'

echo ""
echo "=== 3. POST /api/wallet/pin WITH TRIVIALLY WEAK PIN (EXPECT 422 PIN_TOO_WEAK) ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/wallet/pin" \
  -H "Content-Type: application/json" \
  -d '{"password":"Password123!","pin":"123456"}'

echo ""
echo "=== 4. POST /api/wallet/pin SUCCESS (EXPECT 200 OK) ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/wallet/pin" \
  -H "Content-Type: application/json" \
  -d '{"password":"Password123!","pin":"741852"}'

echo ""
echo "=== 5. POST /api/wallet/pin SECOND CALL (EXPECT 409 PIN_ALREADY_SET) ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -b "$COOKIE_JAR" -X POST "$BASE_URL/api/wallet/pin" \
  -H "Content-Type: application/json" \
  -d '{"password":"Password123!","pin":"963852"}'

rm -f "$COOKIE_JAR"
echo ""
echo "=== WALLET PIN PROOF COMPLETE ==="
