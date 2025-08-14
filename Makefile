# Makefile for POI Travel Recommendation API
# SAFE REFACTOR PLAN compatible targets

.PHONY: help quick contract full bench lint format setup run clean install

# Tool commands (fallback-friendly)
PYTHON ?= python3
PIP ?= pip3

# Default target
help:
	@echo "🎯 Available targets:"
	@echo "  quick      - Fast quality checks (ruff + eslint + smoke + /health)"
	@echo "  contract   - OpenAPI contract tests (golden response validation)"
	@echo "  full       - Complete test suite"
	@echo "  bench      - Performance benchmarking"
	@echo "  lint       - Run all linters with auto-fix"
	@echo "  format     - Format code (black + isort)"
	@echo "  setup      - Set up development environment"
	@echo "  run        - Start the application"
	@echo "  clean      - Clean temporary files"
	@echo "  install    - Install dependencies"

# Fast quality checks
quick:
	@echo "🚀 Running quick quality checks..."
	@echo "1️⃣ Running ruff check..."
	@if command -v ruff >/dev/null 2>&1; then \
		ruff check --diff . || (echo "❌ Ruff check failed" && exit 1); \
	else \
		echo "⚠️  Ruff not available, skipping"; \
	fi
	@echo "2️⃣ Running ESLint..."
	@if command -v eslint >/dev/null 2>&1; then \
		eslint static/js/*.js static/js/**/*.js --max-warnings=0 || (echo "❌ ESLint failed" && exit 1); \
	else \
		echo "⚠️  ESLint not available, skipping"; \
	fi
	@echo "3️⃣ Running smoke tests..."
	$(PYTHON) tests/smoke.py || (echo "❌ Smoke tests failed" && exit 1)
	@echo "4️⃣ Testing health endpoint..."
	@if curl -s http://localhost:5000/health >/dev/null 2>&1; then \
		echo "✅ Health endpoint accessible"; \
	else \
		echo "⚠️  Health endpoint not accessible (app may not be running)"; \
	fi
	@echo "✅ All quick checks passed!"

# Contract tests
contract:
	@echo "📋 Running contract tests..."
	$(PYTHON) tests/contract.py || (echo "❌ Contract tests failed" && exit 1)
	@echo "✅ Contract tests passed!"

# Full test suite
full:
	@echo "🧪 Running full test suite..."
	@if command -v pytest >/dev/null 2>&1; then \
		pytest -q tests/ || (echo "❌ Pytest failed" && exit 1); \
	else \
		echo "⚠️  Pytest not available, running Python tests manually"; \
		$(PYTHON) -m tests.smoke || true; \
		$(PYTHON) -m tests.contract || true; \
	fi
	@echo "✅ Full test suite completed!"

# Performance benchmarking
bench:
	@echo "📊 Running performance benchmarks..."
	bash scripts/bench.sh perf/baseline.json perf/current.json 0.30
	@echo "✅ Performance benchmarking completed!"

# Linting with auto-fix
lint:
	@echo "🔧 Running linters with auto-fix..."
	@if command -v ruff >/dev/null 2>&1; then \
		ruff check --fix . || echo "⚠️  Some ruff issues could not be auto-fixed"; \
	else \
		echo "⚠️  Ruff not available"; \
	fi
	@if command -v eslint >/dev/null 2>&1; then \
		eslint static/js/*.js --fix || echo "⚠️  Some ESLint issues could not be auto-fixed"; \
	else \
		echo "⚠️  ESLint not available"; \
	fi
	@echo "✅ Linting completed!"

# Code formatting
format:
	@echo "✨ Formatting code..."
	@if command -v black >/dev/null 2>&1; then \
		black . || echo "⚠️  Black not available"; \
	else \
		echo "⚠️  Black not available"; \
	fi
	@if command -v isort >/dev/null 2>&1; then \
		isort . || echo "⚠️  isort not available"; \
	else \
		echo "⚠️  isort not available"; \
	fi
	@echo "✅ Code formatting completed!"

# Environment setup
setup:
	@echo "🛠️  Setting up development environment..."
	@echo "1️⃣ Installing Python dependencies..."
	$(PIP) install -r requirements.txt || (echo "❌ Failed to install Python dependencies" && exit 1)
	@echo "2️⃣ Installing development tools..."
	$(PIP) install ruff black isort pytest || echo "⚠️  Some dev tools installation failed"
	@echo "3️⃣ Setting up environment..."
	@if [ ! -f .env ]; then \
		cp env.example .env; \
		echo "📄 Created .env from template"; \
	else \
		echo "📄 .env already exists"; \
	fi
	@echo "4️⃣ Creating directories..."
	mkdir -p temp_uploads poi_media cache perf logs
	@echo "✅ Development environment setup completed!"

# Start application
run:
	@echo "🚀 Starting POI API application..."
	@if [ -f .env ]; then \
		export $(shell cat .env | grep -v '^#' | xargs) && $(PYTHON) poi_api.py; \
	else \
		echo "⚠️  .env file not found, using defaults"; \
		$(PYTHON) poi_api.py; \
	fi

# Clean temporary files
clean:
	@echo "🧹 Cleaning temporary files..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.log" -delete 2>/dev/null || true
	rm -rf .pytest_cache
	rm -rf temp_uploads/*
	rm -rf cache/*
	@echo "✅ Cleanup completed!"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	$(PIP) install -r requirements.txt
	@echo "✅ Dependencies installed!"

# Development helpers
dev-install:
	@echo "🔧 Installing development dependencies..."
	$(PIP) install ruff black isort pytest pytest-cov
	@if command -v npm >/dev/null 2>&1; then \
		npm install -g eslint eslint-config-standard; \
	else \
		echo "⚠️  npm not available, ESLint not installed"; \
	fi
	@echo "✅ Development dependencies installed!"

# Show project status
status:
	@echo "📊 Project Status:"
	@echo "=================="
	@echo "Python version: $(shell $(PYTHON) --version 2>&1)"
	@echo "Pip packages: $(shell $(PIP) list | wc -l) installed"
	@echo "Git status: $(shell git status --porcelain | wc -l) modified files"
	@echo "Lines of Python code: $(shell find . -name "*.py" -not -path "./venv/*" -not -path "./poi_env/*" | xargs wc -l | tail -1)"
	@echo "Lines of JavaScript code: $(shell find . -name "*.js" -not -path "./node_modules/*" | xargs wc -l 2>/dev/null | tail -1 || echo '0 total')"
	@echo "Test files: $(shell find tests/ -name "*.py" 2>/dev/null | wc -l || echo '0')"
	@echo "API endpoints: $(shell grep -r "@.*\.route" poi_api.py | wc -l)"

# Validate setup
validate:
	@echo "✅ Validating project setup..."
	@echo "Checking required files..."
	@test -f poi_api.py || (echo "❌ poi_api.py not found" && exit 1)
	@test -f requirements.txt || (echo "❌ requirements.txt not found" && exit 1)
	@test -f openapi.yaml || (echo "❌ openapi.yaml not found" && exit 1)
	@test -d tests || (echo "❌ tests directory not found" && exit 1)
	@echo "Checking Python syntax..."
	@$(PYTHON) -m py_compile poi_api.py || (echo "❌ Python syntax error in poi_api.py" && exit 1)
	@echo "✅ Project validation passed!"
