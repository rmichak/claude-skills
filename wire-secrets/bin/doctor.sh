#!/usr/bin/env bash
# doctor.sh — probe each stored secret against its vendor API and cache the result.
# Invoked by `secret doctor`. Writes STATUS_CACHE as: name<TAB>state<TAB>detail<TAB>iso8601
#   state: live | dead | scoped | skip
set -uo pipefail

SECRET_BIN="${SECRET_BIN:?}"
REGISTRY="${REGISTRY:?}"
STATUS_CACHE="${STATUS_CACHE:?}"
get() { "$SECRET_BIN" get "$1" 2>/dev/null; }
names() { "$SECRET_BIN" list 2>/dev/null | awk 'NR>2 && $2!="MISSING"{print $1}'; }
reg_check() { awk -v w="$1" '/^\[/{s=($0=="["w"]")} s&&/^[[:space:]]*check[[:space:]]*=/{sub("^[^=]*=[[:space:]]*","");gsub(/"/,"");print;exit}' "$REGISTRY"; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

tmp="$(mktemp)"
record() { printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$(now)" >> "$tmp"; }

http() { curl -s -m 25 -o /dev/null -w '%{http_code}' "$@"; }

probe() {
  local name="$1" check="$2" key detail code
  key="$(get "$name")"; [ -z "$key" ] && { record "$name" skip "no value"; return; }
  case "$check" in
    openrouter)
      local body; body="$(curl -s -m 25 -H "Authorization: Bearer $key" https://openrouter.ai/api/v1/key)"
      if grep -q '"usage"' <<<"$body"; then
        local u l; u=$(sed -n 's/.*"usage":\([0-9.]*\).*/\1/p'<<<"$body"); l=$(sed -n 's/.*"limit_remaining":\([0-9.]*\).*/\1/p'<<<"$body")
        record "$name" live "\$${l:-?} left (used \$${u:-?})"
      else record "$name" dead "401/invalid"; fi ;;
    elevenlabs)
      code="$(http -H "xi-api-key: $key" https://api.elevenlabs.io/v1/voices)"
      [ "$code" = 200 ] && record "$name" live "voices reachable" || record "$name" dead "HTTP $code" ;;
    resend)
      code="$(http -H "Authorization: Bearer $key" https://api.resend.com/domains)"
      [ "$code" = 200 ] && record "$name" live "domains reachable" || record "$name" dead "HTTP $code" ;;
    firecrawl)
      local body; body="$(curl -s -m 25 -H "Authorization: Bearer $key" https://api.firecrawl.dev/v1/team/credit-usage)"
      if grep -q remaining_credits <<<"$body"; then
        record "$name" live "$(sed -n 's/.*"remaining_credits":\([0-9]*\).*/\1 credits/p'<<<"$body")"
      else record "$name" dead "auth failed"; fi ;;
    perplexity)
      code="$(curl -s -m 25 -o /dev/null -w '%{http_code}' -X POST https://api.perplexity.ai/chat/completions \
        -H "Authorization: Bearer $key" -H 'Content-Type: application/json' \
        -d '{"model":"sonar","messages":[{"role":"user","content":"hi"}],"max_tokens":16}')"
      [ "$code" = 200 ] && record "$name" live "chat ok" || record "$name" dead "HTTP $code" ;;
    vercel)
      code="$(http -H "Authorization: Bearer $key" https://api.vercel.com/v2/user)"
      [ "$code" = 200 ] && record "$name" live "user ok" || record "$name" dead "HTTP $code" ;;
    telegram)
      grep -q '"ok":true' <<<"$(curl -s -m 25 https://api.telegram.org/bot"$key"/getMe)" \
        && record "$name" live "getMe ok" || record "$name" dead "invalid token" ;;
    google_pagespeed)
      code="$(curl -s -m 70 -o /dev/null -w '%{http_code}' "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=$key")"
      [ "$code" = 200 ] && record "$name" live "quota ok" || record "$name" dead "HTTP $code" ;;
    google_places)
      code="$(curl -s -m 25 -o /dev/null -w '%{http_code}' -X POST "https://places.googleapis.com/v1/places:searchText?key=$key" \
        -H 'Content-Type: application/json' -H 'X-Goog-FieldMask: places.id' -d '{"textQuery":"coffee"}')"
      [ "$code" = 200 ] && record "$name" live "search ok" || record "$name" dead "HTTP $code" ;;
    aws)
      local id sk; id="${key%%:*}"; sk="${key#*:}"
      if AWS_ACCESS_KEY_ID="$id" AWS_SECRET_ACCESS_KEY="$sk" AWS_DEFAULT_REGION=us-east-1 \
         aws sts get-caller-identity >/dev/null 2>&1; then
        record "$name" live "sts ok"
      else record "$name" dead "InvalidClientTokenId"; fi ;;
    *) record "$name" skip "no probe" ;;
  esac
}

echo "probing stored secrets…" >&2
while IFS= read -r name; do
  [ -z "$name" ] && continue
  probe "$name" "$(reg_check "$name")" &
done < <(names)
wait

sort "$tmp" -o "$tmp"
mv "$tmp" "$STATUS_CACHE"
echo "done -> $STATUS_CACHE" >&2
column -t -s$'\t' "$STATUS_CACHE" >&2
