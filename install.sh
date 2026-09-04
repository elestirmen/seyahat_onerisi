#!/bin/bash

# Kapadokya POI Sistemi - Otomatik Kurulum Scripti
# Bu script sistemi otomatik olarak kurar ve yapılandırır

set -e  # Hata durumunda scripti durdur

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logo ve başlık
echo -e "${BLUE}"
cat << "EOF"
 _____ _   _ _____ _        ___  
|  ___| | | |  ___| |      / _ \ 
| |__ | |_| | |__ | |     / /_\ \
|  __| \   / |  __| |     |  _  |
| |___  | |  | |  | |____ | | | |
\____/  \_/  \_/  \_____/ \_| |_/

Kapadokya POI Sistemi - Otomatik Kurulum
==========================================
EOF
echo -e "${NC}"

# Sistem bilgilerini tespit et
detect_system() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get >/dev/null; then
            DISTRO="ubuntu"
        elif command -v yum >/dev/null; then
            DISTRO="centos"
        else
            DISTRO="linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        DISTRO="macos"
    else
        DISTRO="unknown"
    fi
    echo -e "${GREEN}✅ Sistem tespit edildi: $DISTRO${NC}"
}

# Python versiyonunu kontrol et
check_python() {
    if command -v python3 >/dev/null; then
        PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
        echo -e "${GREEN}✅ Python $PYTHON_VERSION bulundu${NC}"
        
        # Python 3.7+ kontrolü
        if python3 -c 'import sys; exit(0 if sys.version_info >= (3, 7) else 1)'; then
            echo -e "${GREEN}✅ Python versiyonu uygun${NC}"
        else
            echo -e "${RED}❌ Python 3.7+ gerekli. Lütfen Python'u güncelleyin.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Python3 bulunamadı. Lütfen Python'u kurun.${NC}"
        exit 1
    fi
}

# Sistem bağımlılıklarını kur
install_system_deps() {
    echo -e "${YELLOW}📦 Sistem bağımlılıkları kuruluyor...${NC}"
    
    case $DISTRO in
        "ubuntu")
            sudo apt-get update
            sudo apt-get install -y python3-pip python3-dev python3-venv
            sudo apt-get install -y libgeos-dev libproj-dev libgdal-dev
            sudo apt-get install -y build-essential libssl-dev libffi-dev
            sudo apt-get install -y libspatialindex-dev
            ;;
        "centos")
            sudo yum install -y python3-pip python3-devel
            sudo yum install -y geos-devel proj-devel gdal-devel
            sudo yum install -y gcc openssl-devel libffi-devel
            ;;
        "macos")
            if command -v brew >/dev/null; then
                brew install python3 geos proj gdal spatialindex
            else
                echo -e "${RED}❌ Homebrew bulunamadı. Lütfen Homebrew'u kurun.${NC}"
                exit 1
            fi
            ;;
        *)
            echo -e "${YELLOW}⚠️  Bilinmeyen sistem. Manuel kurulum gerekebilir.${NC}"
            ;;
    esac
    
    echo -e "${GREEN}✅ Sistem bağımlılıkları kuruldu${NC}"
}

# Python sanal ortamı oluştur
create_venv() {
    echo -e "${YELLOW}🐍 Python sanal ortamı oluşturuluyor...${NC}"
    
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        echo -e "${GREEN}✅ Sanal ortam oluşturuldu${NC}"
    else
        echo -e "${GREEN}✅ Sanal ortam zaten mevcut${NC}"
    fi
    
    # Sanal ortamı aktifleştir
    source venv/bin/activate
    
    # pip'i güncelle
    pip install --upgrade pip
    echo -e "${GREEN}✅ pip güncellendi${NC}"
}

# Python bağımlılıklarını kur
install_python_deps() {
    echo -e "${YELLOW}📦 Python bağımlılıkları kuruluyor...${NC}"
    
    # Ana bağımlılıkları kur
    pip install -r requirements.txt
    
    echo -e "${GREEN}✅ Python bağımlılıkları kuruldu${NC}"
}

# Veritabanı seçimi
choose_database() {
    echo -e "${BLUE}💾 Veritabanı seçimi:${NC}"
    echo "1) JSON dosyası (Hızlı başlangıç)"
    echo "2) MongoDB"
    echo "3) PostgreSQL + PostGIS"
    echo "4) Sadece Python paketleri (Manuel veritabanı kurulumu)"
    
    read -p "Seçiminizi yapın (1-4): " DB_CHOICE
    
    case $DB_CHOICE in
        1)
            DB_TYPE="json"
            echo -e "${GREEN}✅ JSON dosyası seçildi${NC}"
            ;;
        2)
            DB_TYPE="mongodb"
            install_mongodb
            ;;
        3)
            DB_TYPE="postgresql"
            install_postgresql
            ;;
        4)
            DB_TYPE="manual"
            echo -e "${YELLOW}⚠️  Manuel veritabanı kurulumu seçildi${NC}"
            ;;
        *)
            echo -e "${RED}❌ Geçersiz seçim. JSON dosyası kullanılacak.${NC}"
            DB_TYPE="json"
            ;;
    esac
}

# MongoDB kurulumu
install_mongodb() {
    echo -e "${YELLOW}🍃 MongoDB kuruluyor...${NC}"
    
    case $DISTRO in
        "ubuntu")
            # MongoDB GPG anahtarını ekle
            curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
            
            # MongoDB deposunu ekle
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
            
            # Güncelle ve kur
            sudo apt-get update
            sudo apt-get install -y mongodb-org
            
            # Servisi başlat ve aktifleştir
            sudo systemctl start mongod
            sudo systemctl enable mongod
            ;;
        "centos")
            # MongoDB repo dosyası oluştur
            sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF
            
            sudo yum install -y mongodb-org
            sudo systemctl start mongod
            sudo systemctl enable mongod
            ;;
        "macos")
            brew tap mongodb/brew
            brew install mongodb-community
            brew services start mongodb-community
            ;;
    esac
    
    # MongoDB bağlantısını test et
    if command -v mongosh >/dev/null; then
        if mongosh --eval "print('MongoDB bağlantısı başarılı')" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ MongoDB kuruldu ve çalışıyor${NC}"
        else
            echo -e "${RED}❌ MongoDB bağlantı hatası${NC}"
        fi
    fi
    
    # Çevre değişkenlerini ayarla
    export POI_DB_TYPE=mongodb
    export POI_DB_CONNECTION=mongodb://localhost:27017/
    export POI_DB_NAME=poi_cappadocia
}

# PostgreSQL kurulumu
install_postgresql() {
    echo -e "${YELLOW}🐘 PostgreSQL + PostGIS kuruluyor...${NC}"
    
    case $DISTRO in
        "ubuntu")
            sudo apt-get install -y postgresql postgresql-contrib postgis postgresql-14-postgis-3
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
        "centos")
            sudo yum install -y postgresql-server postgresql-contrib postgis
            sudo postgresql-setup initdb
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
        "macos")
            brew install postgresql postgis
            brew services start postgresql
            ;;
    esac
    
    # Veritabanı ve kullanıcı oluştur
    echo -e "${YELLOW}🔧 PostgreSQL yapılandırılıyor...${NC}"
    
    # Rastgele şifre oluştur
    DB_PASSWORD=$(openssl rand -base64 12)
    
    sudo -u postgres psql << EOF
CREATE DATABASE poi_db;
CREATE USER poi_user WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE poi_db TO poi_user;
ALTER DATABASE poi_db OWNER TO poi_user;
\q
EOF
    
    # PostGIS uzantısını ekle
    sudo -u postgres psql -d poi_db << 'EOF'
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
\q
EOF
    
    echo -e "${GREEN}✅ PostgreSQL kuruldu ve yapılandırıldı${NC}"
    echo -e "${YELLOW}📝 Veritabanı bilgileri:${NC}"
    echo "   Kullanıcı: poi_user"
    echo "   Şifre: $DB_PASSWORD"
    echo "   Veritabanı: poi_db"
    
    # Çevre değişkenlerini ayarla
    export POI_DB_TYPE=postgresql
    export POI_DB_CONNECTION="postgresql://poi_user:$DB_PASSWORD@localhost/poi_db"
    
    # .env dosyası oluştur
    cat > .env << EOF
POI_DB_TYPE=postgresql
POI_DB_CONNECTION=postgresql://poi_user:$DB_PASSWORD@localhost/poi_db
EOF
    
    echo -e "${GREEN}✅ Çevre değişkenleri .env dosyasına kaydedildi${NC}"
}

# Veritabanını hazırla
setup_database() {
    if [ "$DB_TYPE" != "json" ] && [ "$DB_TYPE" != "manual" ]; then
        echo -e "${YELLOW}🗃️  Veritabanı hazırlanıyor...${NC}"
        
        if [ "$DB_TYPE" = "mongodb" ]; then
            echo -e "${RED}❌ MongoDB adaptörü bu sürümde desteklenmiyor. PostgreSQL seçin.${NC}"
            return 1
        elif [ "$DB_TYPE" = "postgresql" ]; then
            python setup_poi_database.py "$POI_DB_CONNECTION"
        fi
        
        echo -e "${GREEN}✅ Veritabanı hazırlandı${NC}"
    fi
}

# Cache klasörünü oluştur
create_cache() {
    if [ ! -d "cache" ]; then
        mkdir cache
        echo -e "${GREEN}✅ Cache klasörü oluşturuldu${NC}"
    fi
}

# Test çalıştır
run_tests() {
    echo -e "${YELLOW}🧪 Kurulum testi yapılıyor...${NC}"
    
    # Basit rota testi
    if python category_route_planner.py gastronomik --no-elevation --radius 2 -o test_kurulum.html >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Rota planlayıcı testi başarılı${NC}"
        rm -f test_kurulum.html
    else
        echo -e "${RED}❌ Rota planlayıcı testi başarısız${NC}"
    fi
    
    # API testi (eğer veritabanı varsa)
    if [ "$DB_TYPE" != "json" ] && [ "$DB_TYPE" != "manual" ]; then
        if python -c "from poi_api import app; print('✅ API modülü yüklenebiliyor')" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ API testi başarılı${NC}"
        else
            echo -e "${RED}❌ API testi başarısız${NC}"
        fi
    fi
}

# Kullanım talimatları
show_usage() {
    echo -e "${BLUE}"
    echo "🎉 Kurulum tamamlandı!"
    echo "==================="
    echo -e "${NC}"
    
    echo -e "${GREEN}Sanal ortamı aktifleştirmek için:${NC}"
    echo "source venv/bin/activate"
    echo ""
    
    echo -e "${GREEN}Rota planlayıcıyı çalıştırmak için:${NC}"
    echo "python category_route_planner.py"
    echo "python category_route_planner.py gastronomik"
    echo "python category_route_planner.py kulturel --start 'Ürgüp Müzesi'"
    echo ""
    
    if [ "$DB_TYPE" != "json" ] && [ "$DB_TYPE" != "manual" ]; then
        echo -e "${GREEN}POI yönetim API'sini başlatmak için:${NC}"
        echo "python poi_api.py"
        echo "Sonra tarayıcıda: http://localhost:5505/poi_manager_ui.html"
        echo ""
    fi
    
    echo -e "${GREEN}Yardım için:${NC}"
    echo "python category_route_planner.py --help"
    echo "cat README.md"
    echo "cat HIZLI_BASLATMA.md"
    echo ""
    
    if [ "$DB_TYPE" = "postgresql" ]; then
        echo -e "${YELLOW}📝 Veritabanı bilgileriniz .env dosyasında saklandı${NC}"
    fi
}

# Ana kurulum fonksiyonu
main() {
    echo -e "${BLUE}🚀 Kurulum başlatılıyor...${NC}"
    
    detect_system
    check_python
    install_system_deps
    create_venv
    install_python_deps
    choose_database
    setup_database
    create_cache
    run_tests
    show_usage
    
    echo -e "${GREEN}✅ Kurulum başarıyla tamamlandı!${NC}"
}

# Hata durumunda temizlik
cleanup() {
    echo -e "${RED}❌ Kurulum sırasında hata oluştu${NC}"
    echo -e "${YELLOW}Manuel kurulum için README.md dosyasını inceleyin${NC}"
    exit 1
}

# Hata yakalayıcı
trap cleanup ERR

# Kullanıcıdan onay al
echo -e "${YELLOW}Bu script sisteminize yazılım kuracak ve yapılandırma değişiklikleri yapacak.${NC}"
read -p "Devam etmek istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Kurulum iptal edildi.${NC}"
    exit 0
fi

# Ana kurulumu başlat
main
