#!/bin/bash
# Pre-commit validation hook
# Install: cp scripts/pre-commit.sh .husky/pre-commit && chmod +x .husky/pre-commit

set -e

echo "🔍 Running pre-commit checks..."

# 1. Validate structure
echo ""
echo "→ Validating project structure..."
bash scripts/validate-structure.sh || exit 1

# 2. Validate versions
echo ""
echo "→ Validating version consistency..."
bash scripts/validate-version.sh || exit 1

# 3. Rust formatting
echo ""
echo "→ Checking Rust formatting..."
cargo fmt --all -- --check || {
  echo "❌ Rust formatting issues found. Run: cargo fmt --all"
  exit 1
}

# 4. Rust clippy
echo ""
echo "→ Running Clippy..."
cargo clippy --all-targets --all-features -- -D warnings || {
  echo "❌ Clippy warnings found"
  exit 1
}

# 5. TypeScript linting
echo ""
echo "→ Linting TypeScript/JavaScript..."
cd client/app
npm run lint || {
  echo "❌ ESLint errors found. Run: npm run lint -- --fix"
  exit 1
}
cd ../..

# 6. Markdown validation
echo ""
echo "→ Validating Markdown..."
if command -v markdownlint &> /dev/null; then
  markdownlint '**/*.md' --ignore node_modules --ignore target || true
else
  echo "⚠️  markdownlint not installed. Skipping."
fi

echo ""
echo "✅ All pre-commit checks passed!"
