#!/usr/bin/env bash
# Which of gcp-oauth.keys.json's redirect_uris does Google actually accept?
#
# The local keys file is only a downloaded copy — it can list URIs that were never
# saved in the Cloud Console, and the mismatch surfaces only as a browser-side
# "Access blocked: This app's request is invalid" (Error 400: redirect_uri_mismatch).
# src/auth/server.ts scans PORT_RANGE 3500-3505 for a FREE port, so whichever port
# is free decides whether auth works — a running MCP server on 3500 is enough to
# push the flow onto an unregistered port.
#
# Usage: bash scripts/check-redirect-uris.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYS="${GOOGLE_OAUTH_CREDENTIALS:-$ROOT/gcp-oauth.keys.json}"
# Any single valid scope is enough; Google validates redirect_uri before consent.
PROBE_SCOPE="https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar"
AUTH_ENDPOINT="https://accounts.google.com/o/oauth2/v2/auth"

read -r CLIENT_ID < <(python3 -c "
import json
d = json.load(open('$KEYS'))
c = d.get('installed') or d.get('web') or d
print(c['client_id'])
")

echo "client: ${CLIENT_ID%%-*}-…"
echo

python3 -c "
import json
d = json.load(open('$KEYS'))
c = d.get('installed') or d.get('web') or d
print('\n'.join(c.get('redirect_uris', [])))
" | while read -r uri; do
  [ -z "$uri" ] && continue
  encoded="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$uri")"
  if curl -sL "$AUTH_ENDPOINT?access_type=offline&scope=$PROBE_SCOPE&response_type=code&client_id=$CLIENT_ID&redirect_uri=$encoded" \
       | grep -q redirect_uri_mismatch; then
    printf '  %-52s NOT REGISTERED\n' "$uri"
  else
    printf '  %-52s ok\n' "$uri"
  fi
done

echo
echo "Ports currently occupied in 3500-3505 (a busy port pushes auth to the next one):"
lsof -nP -iTCP:3500-3505 -sTCP:LISTEN 2>/dev/null \
  | awk 'NR>1 {print "  " $9 "  <- pid " $2 " (" $1 ")"}' \
  || echo "  (none)"
