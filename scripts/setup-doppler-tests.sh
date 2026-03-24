#!/bin/bash
# Verify Doppler setup for integration tests

set -e

PROJECT="integrity-studio"
CONFIG="dev"

echo "Checking Doppler setup for $PROJECT/$CONFIG..."

# Verify project exists
if doppler projects get --project "$PROJECT" &>/dev/null; then
  echo "✓ Project '$PROJECT' exists"
else
  echo "✗ Project '$PROJECT' not found"
  exit 1
fi

# Verify config exists
if doppler configs --project "$PROJECT" | grep -q "$CONFIG"; then
  echo "✓ Config '$CONFIG' exists"
else
  echo "✗ Config '$CONFIG' not found"
  exit 1
fi

# List secrets
echo ""
echo "Current secrets in $PROJECT/$CONFIG:"
doppler secrets --project "$PROJECT" --config "$CONFIG" | grep -E "GOOGLE_OAUTH|CALENDAR|TEST_"

echo ""
echo "✓ Doppler setup verified!"
echo ""
echo "Run tests with:"
echo "   doppler run npm test"
echo "   doppler run npm run test:integration"
echo "   npm run test:doppler"
echo "   npm run test:integration:doppler"
