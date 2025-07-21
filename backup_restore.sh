#!/bin/bash

# POI Yönetim Sistemi - Yedekleme ve Geri Yükleme Script'i
# Bu script Python yedekleme sistemini kolayca kullanmanızı sağlar

set -e  # Hata durumunda çık

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script dizini
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/backup_system.py"

# Python script'inin varlığını kontrol et
if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo -e "${RED}❌ Hata: backup_system.py bulunamadı!${NC}"
    exit 1
fi

# Python'un varlığını kontrol et
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Hata: Python3 bulunamadı!${NC}"
    exit 1
fi

# PostgreSQL araçlarının varlığını kontrol et
check_postgres_tools() {
    if ! command -v pg_dump &> /dev/null; then
        echo -e "${YELLOW}⚠️  Uyarı: pg_dump bulunamadı. PostgreSQL client araçları yüklü değil.${NC}"
        echo -e "${YELLOW}   Veritabanı yedekleme/geri yükleme çalışmayabilir.${NC}"
    fi
    
    if ! command -v psql &> /dev/null; then
        echo -e "${YELLOW}⚠️  Uyarı: psql bulunamadı. PostgreSQL client araçları yüklü değil.${NC}"
        echo -e "${YELLOW}   Veritabanı yedekleme/geri yükleme çalışmayabilir.${NC}"
    fi
}

# Yardım mesajı
show_help() {
    echo -e "${BLUE}POI Yönetim Sistemi - Yedekleme ve Geri Yükleme Aracı${NC}"
    echo ""
    echo "Kullanım:"
    echo "  $0 backup                    # Tam yedekleme oluştur"
    echo "  $0 restore <yedekleme_adı>   # Yedeklemeden geri yükle"
    echo "  $0 list                      # Mevcut yedeklemeleri listele"
    echo "  $0 cleanup [sayı]            # Eski yedeklemeleri temizle (varsayılan: 5 adet koru)"
    echo "  $0 help                      # Bu yardım mesajını göster"
    echo ""
    echo "Örnekler:"
    echo "  $0 backup"
    echo "  $0 restore poi_backup_full_20240122_143022"
    echo "  $0 list"
    echo "  $0 cleanup 3"
}

# Ana fonksiyon
main() {
    case "${1:-help}" in
        "backup")
            echo -e "${BLUE}🔄 Yedekleme başlatılıyor...${NC}"
            check_postgres_tools
            python3 "$PYTHON_SCRIPT" backup
            ;;
            
        "restore")
            if [ -z "$2" ]; then
                echo -e "${RED}❌ Hata: Geri yükleme için yedekleme adı gerekli!${NC}"
                echo ""
                echo -e "${YELLOW}Mevcut yedeklemeler:${NC}"
                python3 "$PYTHON_SCRIPT" list
                exit 1
            fi
            
            echo -e "${BLUE}🔄 Geri yükleme başlatılıyor: $2${NC}"
            echo -e "${YELLOW}⚠️  Bu işlem mevcut dosyaları ve veritabanını değiştirecek!${NC}"
            read -p "Devam etmek istiyor musunuz? (y/N): " -n 1 -r
            echo
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                check_postgres_tools
                python3 "$PYTHON_SCRIPT" restore --name "$2"
            else
                echo -e "${YELLOW}İşlem iptal edildi.${NC}"
            fi
            ;;
            
        "list")
            echo -e "${BLUE}📋 Mevcut yedeklemeler listeleniyor...${NC}"
            python3 "$PYTHON_SCRIPT" list
            ;;
            
        "cleanup")
            KEEP_COUNT=${2:-5}
            echo -e "${BLUE}🧹 Eski yedeklemeler temizleniyor (son $KEEP_COUNT adet korunacak)...${NC}"
            echo -e "${YELLOW}⚠️  Bu işlem eski yedekleme dosyalarını kalıcı olarak silecek!${NC}"
            read -p "Devam etmek istiyor musunuz? (y/N): " -n 1 -r
            echo
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                python3 "$PYTHON_SCRIPT" cleanup --keep "$KEEP_COUNT"
            else
                echo -e "${YELLOW}İşlem iptal edildi.${NC}"
            fi
            ;;
            
        "help"|"-h"|"--help")
            show_help
            ;;
            
        *)
            echo -e "${RED}❌ Hata: Geçersiz komut '$1'${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Script'i çalıştır
main "$@"