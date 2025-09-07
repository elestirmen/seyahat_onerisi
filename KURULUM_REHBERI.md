# 🔧 Ürgüp Seyahat Öneri Sistemi - Detaylı Kurulum Rehberi

Bu rehber, Ürgüp Seyahat Öneri Sistemini farklı ortamlarda kurmanız için detaylı adımları içerir.

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
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib postgis postgresql-postgis

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
PORT=5505

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

## 🚚 Yeni Sunucuya Taşıma Rehberi

Bu bölüm, mevcut sistemi yeni bir sunucuya taşımak için gereken adımları detaylı olarak açıklamaktadır.

### Ön Hazırlık

#### 1. Mevcut Sistemi Yedekle
```bash
# Yedekleme dizini oluştur
mkdir -p /backup/$(date +%Y%m%d)
BACKUP_DIR="/backup/$(date +%Y%m%d)"

# Veritabanı yedeklemesi
echo "Veritabanı yedekleniyor..."
pg_dump -U poi_user -h localhost poi_db > $BACKUP_DIR/poi_db_backup.sql

# Kod ve yapılandırma yedeklemesi
echo "Kod yedekleniyor..."
tar -czf $BACKUP_DIR/code_backup.tar.gz /opt/urgup-seyahat-onerisi \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc'

# Medya dosyaları yedeklemesi
echo "Medya dosyaları yedekleniyor..."
tar -czf $BACKUP_DIR/media_backup.tar.gz /opt/urgup-seyahat-onerisi/poi_media/

# Yapılandırma dosyaları yedeklemesi
echo "Yapılandırma dosyaları yedekleniyor..."
cp /opt/urgup-seyahat-onerisi/.env $BACKUP_DIR/.env.backup

# Yedekleme özeti
echo "Yedekleme tamamlandı:"
ls -lh $BACKUP_DIR/
```

#### 2. Yeni Sunucuyu Hazırla
```bash
# Sistem güncellemeleri
sudo apt update && sudo apt upgrade -y

# Gerekli paketleri kur
sudo apt install -y python3 python3-pip python3-dev python3-venv
sudo apt install -y postgresql postgresql-contrib postgis postgresql-postgis
sudo apt install -y nginx certbot python3-certbot-nginx
sudo apt install -y build-essential libgeos-dev libproj-dev libgdal-dev
sudo apt install -y git curl wget htop

# Güvenlik duvarı kurulumu
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 5505
sudo ufw status
```

### Kurulum ve Yapılandırma

#### 3. Kodu Yeni Sunucuya Aktar
```bash
# Kodu klonla veya yedekten aktar
cd /opt
git clone <repository-url> urgup-seyahat-onerisi
cd urgup-seyahat-onerisi

# Alternatif: Yedekten aktar
# tar -xzf /path/to/backup/code_backup.tar.gz -C /opt/
# mv /opt/opt/urgup-seyahat-onerisi /opt/urgup-seyahat-onerisi
```

#### 4. Python Ortamı ve Bağımlılıkları
```bash
# Sanal ortam oluştur
python3 -m venv venv
source venv/bin/activate

# pip'i güncelle
pip install --upgrade pip

# Bağımlılıkları kur
pip install -r requirements.txt

# Geliştirme bağımlılıkları (opsiyonel)
pip install pytest pytest-cov black flake8
```

#### 5. Veritabanı Kurulumu ve Veri Aktarımı
```bash
# PostgreSQL servisini başlat
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Veritabanı ve kullanıcı oluştur
sudo -u postgres psql << EOF
CREATE DATABASE poi_db;
CREATE USER poi_user WITH PASSWORD 'güçlü_şifre_buraya';
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;
ALTER DATABASE poi_db OWNER TO poi_user;
\c poi_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
EOF

# Veritabanını geri yükle
psql -U poi_user -h localhost poi_db < /path/to/backup/poi_db_backup.sql

# Veritabanı bağlantısını test et
python3 -c "
import psycopg2
conn = psycopg2.connect('postgresql://poi_user:güçlü_şifre_buraya@localhost/poi_db')
conn.close()
print('✅ Veritabanı bağlantısı başarılı')
"
```

#### 6. Yapılandırma Dosyalarını Güncelle
```bash
# .env dosyasını oluştur/güncelle
cp .env.example .env
nano .env

# .env içeriği örneği:
cat > .env << EOF
# Veritabanı Yapılandırması
POI_DB_TYPE=postgresql
POI_DB_HOST=localhost
POI_DB_PORT=5432
POI_DB_NAME=poi_db
POI_DB_USER=poi_user
POI_DB_PASSWORD=güçlü_şifre_buraya

# Flask Yapılandırması
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Sunucu Yapılandırması
HOST=127.0.0.1
PORT=5505

# Güvenlik
SESSION_TIMEOUT=3600
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
EOF
```

#### 7. Medya Dosyalarını Geri Yükle
```bash
# Medya dizinlerini oluştur
mkdir -p poi_media poi_images temp_uploads

# Medya dosyalarını geri yükle
tar -xzf /path/to/backup/media_backup.tar.gz -C /

# İzinleri ayarla
chown -R www-data:www-data poi_media/ poi_images/ temp_uploads/
chmod -R 755 poi_media/ poi_images/
chmod -R 777 temp_uploads/
```

### Production Deployment

#### 8. Gunicorn Kurulumu ve Yapılandırması
```bash
# Gunicorn'u kur
pip install gunicorn

# Gunicorn yapılandırma dosyası oluştur
cat > gunicorn.conf.py << EOF
bind = "127.0.0.1:5505"
workers = 4
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2
max_requests = 1000
max_requests_jitter = 50
user = "www-data"
group = "www-data"
tmp_upload_dir = None
EOF

# Gunicorn'u test et
gunicorn --config gunicorn.conf.py --log-level debug wsgi:application
```

#### 9. Systemd Servisi Kurulumu
```bash
# Systemd servis dosyası oluştur
sudo tee /etc/systemd/system/urgup-seyahat-onerisi.service > /dev/null << EOF
[Unit]
Description=Urgup Seyahat Oneri Sistemi
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=exec
User=www-data
Group=www-data
WorkingDirectory=/opt/urgup-seyahat-onerisi
Environment="PATH=/opt/urgup-seyahat-onerisi/venv/bin"
ExecStart=/opt/urgup-seyahat-onerisi/venv/bin/gunicorn --config gunicorn.conf.py wsgi:application
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=urgup-seyahat

[Install]
WantedBy=multi-user.target
EOF

# Servisi etkinleştir ve başlat
sudo systemctl daemon-reload
sudo systemctl enable urgup-seyahat-onerisi
sudo systemctl start urgup-seyahat-onerisi
sudo systemctl status urgup-seyahat-onerisi
```

#### 10. Nginx Reverse Proxy Kurulumu
```bash
# Nginx yapılandırma dosyası oluştur
sudo tee /etc/nginx/sites-available/urgup-seyahat > /dev/null << EOF
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static files
    location /static/ {
        alias /opt/urgup-seyahat-onerisi/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /opt/urgup-seyahat-onerisi/poi_media/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Main application
    location / {
        proxy_pass http://127.0.0.1:5505;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeout settings
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Yapılandırma dosyasını etkinleştir
sudo ln -sf /etc/nginx/sites-available/urgup-seyahat /etc/nginx/sites-enabled/

# Varsayılan nginx sitesini devre dışı bırak
sudo rm -f /etc/nginx/sites-enabled/default

# Nginx yapılandırmasını test et ve yeniden başlat
sudo nginx -t
sudo systemctl reload nginx
```

#### 11. SSL Sertifikası Kurulumu (Let's Encrypt)
```bash
# SSL sertifikası al
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Otomatik yenilemeyi test et
sudo certbot renew --dry-run

# Cron job ekle (otomatik yenileme için)
sudo crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -
```

### Test ve Doğrulama

#### 12. Sistem Testleri
```bash
# Uygulama durumunu kontrol et
sudo systemctl status urgup-seyahat-onerisi
sudo systemctl status nginx

# Logları kontrol et
sudo journalctl -u urgup-seyahat-onerisi -f
sudo tail -f /var/log/nginx/error.log

# API'yi test et
curl http://localhost:5505/api/pois
curl http://localhost:5505/health

# Web arayüzünü test et
curl -I https://yourdomain.com/poi_recommendation_system.html
curl -I https://yourdomain.com/

# Veritabanı bağlantısını test et
python3 -c "
from poi_database_adapter import POIDatabaseFactory
db = POIDatabaseFactory.create_database('postgresql', connection_string='postgresql://poi_user:şifre@localhost/poi_db')
print('✅ Veritabanı bağlantısı başarılı')
"
```

#### 13. Load Testing
```bash
# Basit load test
pip install locust

# Locust test dosyası oluştur
cat > load_test.py << EOF
from locust import HttpUser, task

class POITestUser(HttpUser):
    @task
    def get_pois(self):
        self.client.get("/api/pois")

    @task
    def get_routes(self):
        self.client.get("/api/routes")
EOF

# Load test çalıştır
locust -f load_test.py --host=https://yourdomain.com
```

### Monitoring ve Bakım

#### 14. Log Yönetimi
```bash
# Logrotate yapılandırması
sudo tee /etc/logrotate.d/urgup-seyahat > /dev/null << EOF
/opt/urgup-seyahat-onerisi/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload urgup-seyahat-onerisi
    endscript
}
EOF

# Log dizini oluştur
sudo mkdir -p /opt/urgup-seyahat-onerisi/logs
sudo chown www-data:www-data /opt/urgup-seyahat-onerisi/logs
```

#### 15. Otomatik Yedekleme
```bash
# Yedekleme scripti oluştur
sudo tee /usr/local/bin/urgup_backup.sh > /dev/null << EOF
#!/bin/bash
BACKUP_DIR="/backup/\$(date +%Y%m%d_%H%M%S)"
mkdir -p \$BACKUP_DIR

# Veritabanı yedekle
pg_dump -U poi_user poi_db > \$BACKUP_DIR/poi_db.sql

# Eski yedekleri temizle (7 günden eski)
find /backup -name "*.sql" -mtime +7 -delete

echo "Yedekleme tamamlandı: \$BACKUP_DIR"
EOF

# Scripti çalıştırılabilir yap
sudo chmod +x /usr/local/bin/urgup_backup.sh

# Cron job ekle (her gün 02:00'da)
sudo crontab -l | { cat; echo "0 2 * * * /usr/local/bin/urgup_backup.sh"; } | sudo crontab -
```

#### 16. Sistem İzleme
```bash
# htop kurulumu
sudo apt install -y htop

# Sistem kaynaklarını izle
htop

# Disk kullanımını kontrol et
df -h

# Bellek kullanımını kontrol et
free -h

# Ağ bağlantılarını izle
netstat -tlnp | grep :5505
```

### Sorun Giderme (Taşıma)

#### Yaygın Taşıma Sorunları

##### 1. Veritabanı Bağlantı Hatası
```bash
# PostgreSQL loglarını kontrol et
sudo tail -f /var/log/postgresql/postgresql-*.log

# Bağlantı parametrelerini test et
psql -U poi_user -h localhost -d poi_db -c "SELECT version();"

# pg_hba.conf dosyasını kontrol et
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

##### 2. İzin Problemleri
```bash
# Dosya izinlerini düzelt
sudo chown -R www-data:www-data /opt/urgup-seyahat-onerisi/
sudo chmod -R 755 /opt/urgup-seyahat-onerisi/
sudo chmod 600 /opt/urgup-seyahat-onerisi/.env

# SELinux sorunları (CentOS/RHEL)
sudo setsebool -P httpd_can_network_connect 1
```

##### 3. Nginx Yapılandırma Sorunları
```bash
# Yapılandırmayı test et
sudo nginx -t

# Hata loglarını kontrol et
sudo tail -f /var/log/nginx/error.log

# Firewall'u kontrol et
sudo ufw status
```

##### 4. SSL Sertifikası Sorunları
```bash
# Sertifika durumunu kontrol et
sudo certbot certificates

# Manuel yenileme
sudo certbot renew

# Sertifika dosyalarını kontrol et
sudo ls -la /etc/letsencrypt/live/yourdomain.com/
```

### Final Kontrol Listesi

- [ ] Veritabanı bağlantısı çalışıyor
- [ ] Uygulama servisi aktif
- [ ] Nginx çalışıyor ve SSL aktif
- [ ] DNS kayıtları güncellendi
- [ ] Firewall kuralları doğru
- [ ] Yedekleme sistemi aktif
- [ ] Log yönetimi çalışıyor
- [ ] Temel API endpoint'leri yanıt veriyor
- [ ] Web arayüzü erişilebilir

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
- **GitHub Issues**: [Proje Issues](https://github.com/username/urgup-seyahat-onerisi/issues)
- **Discussions**: [GitHub Discussions](https://github.com/username/urgup-seyahat-onerisi/discussions)
- **Wiki**: [Proje Wiki](https://github.com/username/urgup-seyahat-onerisi/wiki)

### İletişim
- **E-posta**: support@urgup-seyahat.com
- **Telegram**: [Destek Grubu](https://t.me/urgup_seyahat_support)

---

**Not**: Bu kurulum rehberi kapsamlı bilgi içerir. Hızlı başlangıç için `HIZLI_BASLATMA.md` dosyasını kullanın.