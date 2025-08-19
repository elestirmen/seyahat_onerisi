# 🔧 Kapadokya POI Sistemi - Detaylı Kurulum Rehberi

Bu rehber, Kapadokya POI Sistemini farklı ortamlarda kurmanız için detaylı adımları içerir.

## 📋 Sistem Gereksinimleri

### Minimum Gereksinimler
- **İşletim Sistemi**: Linux (Ubuntu 18.04+), macOS (10.14+), Windows 10+
- **Python**: 3.7 veya üzeri
- **RAM**: 4GB (önerilen 8GB+)
- **Disk**: 2GB boş alan
- **İnternet**: Kurulum sırasında gerekli

### Önerilen Gereksinimler
- **İşletim Sistemi**: Ubuntu 20.04 LTS, macOS 11+, Windows 11
- **Python**: 3.9 veya üzeri
- **RAM**: 16GB+
- **Disk**: SSD, 10GB+ boş alan
- **CPU**: 4+ çekirdek

## 🚀 Kurulum Yöntemleri

### 1. Otomatik Kurulum (Önerilen)

#### Linux/macOS
```bash
# Projeyi klonlayın
git clone <repository-url>
cd kapadokya-poi-sistemi

# Kurulum scriptini çalıştırılabilir yapın
chmod +x install.sh

# Kurulumu başlatın
./install.sh
```

#### Windows (WSL)
```bash
# WSL'de Ubuntu kurun
wsl --install Ubuntu

# Ubuntu terminal'de
git clone <repository-url>
cd kapadokya-poi-sistemi
chmod +x install.sh
./install.sh
```

### 2. Manuel Kurulum

#### Adım 1: Sistem Bağımlılıkları

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-dev python3-venv
sudo apt-get install -y libgeos-dev libproj-dev libgdal-dev
sudo apt-get install -y build-essential libssl-dev libffi-dev
sudo apt-get install -y libspatialindex-dev postgresql postgresql-contrib postgis
```

**CentOS/RHEL:**
```bash
sudo yum install -y python3-pip python3-devel
sudo yum install -y geos-devel proj-devel gdal-devel
sudo yum install -y gcc openssl-devel libffi-devel
sudo yum install -y postgresql-server postgresql-contrib postgis
```

**macOS:**
```bash
# Homebrew kurun
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Gerekli paketleri kurun
brew install python3 geos proj gdal spatialindex
brew install postgresql postgis
```

**Windows:**
```bash
# Chocolatey kurun
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Gerekli paketleri kurun
choco install python postgresql postgis
```

#### Adım 2: Python Sanal Ortamı
```bash
# Sanal ortam oluşturun
python3 -m venv venv

# Sanal ortamı aktifleştirin
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# pip'i güncelleyin
pip install --upgrade pip
```

#### Adım 3: Python Bağımlılıkları
```bash
# Ana bağımlılıkları kurun
pip install -r requirements.txt

# Geliştirme bağımlılıkları (opsiyonel)
pip install pytest pytest-cov black flake8
```

## 🗄️ Veritabanı Kurulumu

### Seçenek 1: JSON Dosyası (Hızlı Başlangıç)

**Avantajlar:**
- Kurulum gerektirmez
- Hızlı başlangıç
- Taşınabilir

**Dezavantajlar:**
- Sınırlı performans
- Eşzamanlı erişim yok
- Büyük veri setleri için uygun değil

**Kurulum:**
```bash
python setup_poi_database.py json
```

### Seçenek 2: MongoDB

**Avantajlar:**
- Esnek şema
- JSON benzeri veri yapısı
- Yatay ölçeklenebilirlik

**Dezavantajlar:**
- Coğrafi sorgular için ek kurulum
- ACID garantileri sınırlı

**Kurulum:**

**Ubuntu/Debian:**
```bash
# MongoDB GPG anahtarını ekleyin
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# MongoDB deposunu ekleyin
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# MongoDB'yi kurun
sudo apt-get update
sudo apt-get install -y mongodb-org

# Servisi başlatın
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Veritabanını hazırlayın:**
```bash
python setup_poi_database.py mongodb "mongodb://localhost:27017/"
```

### Seçenek 3: PostgreSQL + PostGIS (Önerilen)

**Avantajlar:**
- Güçlü coğrafi sorgular
- ACID uyumluluğu
- SQL standardı
- PostGIS uzantısı

**Dezavantajlar:**
- Kurulum karmaşıklığı
- Daha fazla sistem kaynağı

**Kurulum:**

**Ubuntu/Debian:**
```bash
# PostgreSQL ve PostGIS kurun
sudo apt-get install -y postgresql postgresql-contrib postgis postgresql-14-postgis-3

# Servisi başlatın
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql postgis
brew services start postgresql
```

**Veritabanını yapılandırın:**
```bash
# PostgreSQL'e bağlanın
sudo -u postgres psql

# Veritabanı ve kullanıcı oluşturun
CREATE DATABASE poi_db;
CREATE USER poi_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;
ALTER DATABASE poi_db OWNER TO poi_user;

# PostGIS uzantısını ekleyin
\c poi_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

# Çıkın
\q
```

**Veritabanını hazırlayın:**
```bash
python setup_poi_database.py postgresql "postgresql://poi_user:your_secure_password@localhost/poi_db"
```

## ⚙️ Yapılandırma

### Çevre Değişkenleri

`.env` dosyası oluşturun:

```bash
# Veritabanı Yapılandırması
POI_DB_TYPE=postgresql
POI_DB_HOST=localhost
POI_DB_PORT=5432
POI_DB_NAME=poi_db
POI_DB_USER=poi_user
POI_DB_PASSWORD=your_secure_password
POI_DB_CONNECTION=postgresql://poi_user:your_secure_password@localhost/poi_db

# Flask Yapılandırması
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your_very_long_random_secret_key_here

# Sunucu Yapılandırması
HOST=0.0.0.0
PORT=5000

# Cache Yapılandırması
CACHE_TYPE=simple
CACHE_DEFAULT_TIMEOUT=300

# Medya Yapılandırması
MAX_CONTENT_LENGTH=16777216
UPLOAD_FOLDER=poi_media
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,mp4,mov,avi
```

### Güvenlik Ayarları

**Güçlü şifre oluşturma:**
```bash
# Python ile güçlü şifre oluşturun
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# OpenSSL ile güçlü şifre oluşturun
openssl rand -base64 32
```

**Dosya izinleri:**
```bash
# Hassas dosyaları koruyun
chmod 600 .env
chmod 600 config.py

# Medya klasörlerini yapılandırın
chmod 755 poi_media/
chmod 755 poi_images/
```

## 🧪 Kurulum Testi

### Sistem Testi
```bash
# Python versiyonunu kontrol edin
python3 --version

# Sanal ortamı kontrol edin
which python
which pip

# Bağımlılıkları kontrol edin
pip list
```

### Veritabanı Testi
```bash
# Bağlantıyı test edin
python -c "from poi_database_adapter import test_connection; test_connection()"

# Veritabanı şemasını kontrol edin
python check_db_schema.py
```

### Uygulama Testi
```bash
# Basit rota testi
python category_route_planner.py gastronomik --no-elevation --radius 2

# API testi
python -c "from poi_api import app; print('✅ API modülü yüklenebiliyor')"

# Test suite'i çalıştırın
python run_all_tests.py
```

## 🚀 Sistemi Başlatma

### Geliştirme Ortamı
```bash
# Sanal ortamı aktifleştirin
source venv/bin/activate

# Rota planlayıcıyı başlatın
python category_route_planner.py

# POI API'yi başlatın
python poi_api.py

# WSGI sunucuyu başlatın
python wsgi.py
```

### Üretim Ortamı
```bash
# Gunicorn ile
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 wsgi:application

# Systemd servisi olarak
sudo cp systemd/kapadokya-poi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kapadokya-poi
sudo systemctl start kapadokya-poi
```

### Docker ile
```bash
# Docker image oluşturun
docker build -t kapadokya-poi .

# Container'ı çalıştırın
docker run -d -p 5000:5000 --name kapadokya-poi kapadokya-poi

# Docker Compose ile
docker-compose up -d
```

## 🔍 Sorun Giderme

### Yaygın Kurulum Sorunları

#### 1. Python Bağımlılık Hataları
```bash
# Sanal ortamı yeniden oluşturun
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Sistem bağımlılıklarını kontrol edin
sudo apt-get install -y python3-dev build-essential
```

#### 2. Veritabanı Bağlantı Hataları
```bash
# PostgreSQL servisini kontrol edin
sudo systemctl status postgresql

# Bağlantı bilgilerini test edin
psql -h localhost -U poi_user -d poi_db

# Firewall ayarlarını kontrol edin
sudo ufw status
sudo ufw allow 5432
```

#### 3. Port Çakışması
```bash
# Kullanılan portları kontrol edin
netstat -tulpn | grep :5000
lsof -i :5000

# Farklı port kullanın
python poi_api.py --port 5001
```

#### 4. İzin Hataları
```bash
# Dosya izinlerini düzeltin
sudo chown -R $USER:$USER .
chmod +x install.sh
chmod 755 poi_media/
```

### Log Analizi
```bash
# Uygulama logları
tail -f logs/app.log

# Hata logları
tail -f logs/error.log

# Sistem logları
sudo journalctl -u kapadokya-poi -f
```

## 📚 Sonraki Adımlar

### 1. Veri İçe Aktarma
```bash
# POI verilerini içe aktarın
python import_poi_data.py

# Kategorileri optimize edin
python optimize_categories.py

# Rota verilerini içe aktarın
python import_route_data.py
```

### 2. Performans Optimizasyonu
```bash
# Veritabanı indekslerini oluşturun
psql -U poi_user -d poi_db -f recommended_indexes.sql

# Cache yapılandırmasını optimize edin
python performance_optimizations.py
```

### 3. Monitoring ve Logging
```bash
# Log rotasyonu yapılandırın
sudo cp config/logrotate.conf /etc/logrotate.d/kapadokya-poi

# Monitoring araçlarını kurun
pip install prometheus_client
```

## 🆘 Yardım ve Destek

### Dokümantasyon
- **Ana README**: `README.md`
- **Hızlı Başlangıç**: `HIZLI_BASLATMA.md`
- **API Dokümantasyonu**: `openapi.yaml`

### Topluluk
- **GitHub Issues**: [Proje Issues](https://github.com/username/kapadokya-poi-sistemi/issues)
- **Discussions**: [GitHub Discussions](https://github.com/username/kapadokya-poi-sistemi/discussions)
- **Wiki**: [Proje Wiki](https://github.com/username/kapadokya-poi-sistemi/wiki)

### İletişim
- **E-posta**: support@kapadokya-poi.com
- **Telegram**: [Destek Grubu](https://t.me/kapadokya_poi_support)

---

**Not**: Bu kurulum rehberi kapsamlı bilgi içerir. Hızlı başlangıç için `HIZLI_BASLATMA.md` dosyasını kullanın.