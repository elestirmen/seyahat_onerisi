.PHONY: help install test run clean docker-build docker-run docker-stop

help: ## Bu yardım mesajını göster
	@echo "Ürgüp POI Öneri Sistemi - Kullanılabilir Komutlar:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Gerekli paketleri yükle
	pip install -r requirements.txt

install-dev: ## Geliştirme paketlerini yükle
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

test: ## Testleri çalıştır
	python -m pytest tests/ -v

test-coverage: ## Coverage ile testleri çalıştır
	python -m pytest tests/ --cov=app --cov-report=html

run: ## Geliştirme sunucusunu başlat
	python poi_api.py

run-prod: ## Production sunucusunu başlat
	python wsgi.py

clean: ## Geçici dosyaları temizle
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type f -name "*.log" -delete
	rm -rf logs/*.log
	rm -rf temp_uploads/*
	rm -rf .pytest_cache/
	rm -rf htmlcov/

docker-build: ## Docker image'ı build et
	docker build -t poi-api .

docker-run: ## Docker container'ı çalıştır
	docker run -p 5000:5000 --env-file .env poi-api

docker-compose-up: ## Docker Compose ile tüm servisleri başlat
	docker-compose up -d

docker-compose-down: ## Docker Compose servislerini durdur
	docker-compose down

docker-logs: ## Docker loglarını takip et
	docker-compose logs -f poi-api

setup-db: ## Veritabanını kur
	python setup_database.py

import-data: ## POI verilerini import et
	python import_poi_data.py

setup: install setup-db import-data ## Tam kurulum yap

format: ## Kodu formatla
	black app/ tests/
	isort app/ tests/

lint: ## Kodu lint et
	flake8 app/ tests/
	mypy app/

check: format lint test ## Format, lint ve test yap

logs: ## Log dosyalarını takip et
	tail -f logs/api.log

health: ## Health check endpoint'ini test et
	curl -s http://localhost:5000/api/health/ | jq .

health-detailed: ## Detaylı health check
	curl -s http://localhost:5000/api/health/detailed | jq .

health-ready: ## Readiness check
	curl -s http://localhost:5000/api/health/ready | jq .
