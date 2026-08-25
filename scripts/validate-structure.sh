#!/bin/bash
# Script to validate project structure and prevent common mistakes

set -e

echo "🏗️  Validating project structure..."

# Check for binary files in root
echo ""
echo "1. Checking for binaries in root..."
if find . -maxdepth 1 -type f \( -name "*.exe" -o -name "*.dll" -o -name "*.apk" -o -name "*.so" \) 2>/dev/null | grep -q .; then
  echo "❌ ERROR: Binary files found in root. Must use Git LFS or release-assets/"
  find . -maxdepth 1 -type f \( -name "*.exe" -o -name "*.dll" -o -name "*.apk" -o -name "*.so" \)
  exit 1
else
  echo "✅ No binary files in root"
fi

# Check for console.log in production code
echo ""
echo "2. Checking for console.log in TypeScript..."
if grep -r "console\.log(" client/app/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "console\.log" | grep -q . 2>/dev/null; then
  echo "⚠️  WARNING: Found console.log() in production code. Only console.error/warn allowed."
  grep -r "console\.log(" client/app/src --include="*.ts" --include="*.tsx" || true
else
  echo "✅ No console.log in production code"
fi

# Check for unsafe in Rust code
echo ""
echo "3. Checking for unsafe Rust blocks..."
for crate in core blockchain node red_mobile; do
  if [ -d "$crate/src" ]; then
    UNSAFE_COUNT=$(grep -r "unsafe" "$crate/src" --include="*.rs" | wc -l)
    if [ $UNSAFE_COUNT -gt 0 ]; then
      echo "⚠️  $crate: Found $UNSAFE_COUNT unsafe blocks. Verify they are documented."
      grep -r "unsafe" "$crate/src" --include="*.rs" | head -5
    fi
  fi
done
echo "✅ Unsafe block check complete"

# Check Cargo.lock
echo ""
echo "4. Checking for Cargo.lock..."
if [ ! -f "Cargo.lock" ]; then
  echo "⚠️  WARNING: Cargo.lock not found. Run 'cargo generate-lockfile'"
else
  echo "✅ Cargo.lock exists"
fi

# Check package-lock.json
echo ""
echo "5. Checking for package-lock.json..."
if [ ! -f "client/app/package-lock.json" ]; then
  echo "⚠️  WARNING: client/app/package-lock.json not found"
else
  echo "✅ client/app/package-lock.json exists"
fi

# Check required documentation
echo ""
echo "6. Checking required documentation..."
DOC_FILES=("README.md" "ARCHITECTURE.md" "CHANGELOG.md" "CONTRIBUTING.md" "SECURITY.md")
for doc in "${DOC_FILES[@]}"; do
  if [ ! -f "$doc" ]; then
    echo "❌ Missing required file: $doc"
    exit 1
  else
    echo "✅ $doc exists"
  fi
done

echo ""
echo "✅ All structure checks passed!"
