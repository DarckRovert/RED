#!/bin/bash
# Script to validate version consistency across all files

set -e

echo "🔍 Validating version consistency..."

# Get root version from Cargo.toml
ROOT_VERSION=$(grep '^version' Cargo.toml | head -1 | sed 's/.*= "\([^"]*\)".*/\1/')
echo "Root workspace version: $ROOT_VERSION"

# Check workspace crates
echo ""
echo "Checking workspace crates..."
for crate in core blockchain node red_mobile; do
  if [ -f "$crate/Cargo.toml" ]; then
    CRATE_VERSION=$(grep '^version' "$crate/Cargo.toml" | head -1 | sed 's/.*= "\([^"]*\)".*/\1/')
    if [ "$CRATE_VERSION" != "$ROOT_VERSION" ]; then
      echo "❌ $crate version mismatch: $CRATE_VERSION vs $ROOT_VERSION"
      exit 1
    fi
    echo "✅ $crate: $CRATE_VERSION"
  fi
done

# Check client/app package.json
echo ""
echo "Checking client/app package.json..."
if [ -f "client/app/package.json" ]; then
  PKG_VERSION=$(grep '"version"' client/app/package.json | head -1 | sed 's/.*: "\([^"]*\)".*/\1/')
  if [ "$PKG_VERSION" != "$ROOT_VERSION" ]; then
    echo "❌ package.json version mismatch: $PKG_VERSION vs $ROOT_VERSION"
    exit 1
  fi
  echo "✅ client/app: $PKG_VERSION"
fi

# Check README.md mentions version
echo ""
echo "Checking README.md mentions..."
README_MENTIONS=$(grep -o "v$ROOT_VERSION\|version $ROOT_VERSION" README.md | wc -l)
if [ $README_MENTIONS -lt 2 ]; then
  echo "⚠️  WARNING: README.md mentions version $README_MENTIONS times (expected >= 2)"
else
  echo "✅ README.md: $README_MENTIONS mentions of v$ROOT_VERSION"
fi

echo ""
echo "✅ All version checks passed!"
