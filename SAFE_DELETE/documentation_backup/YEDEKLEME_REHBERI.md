# POI Yönetim Sistemi - Yedekleme ve Geri Yükleme Rehberi

Bu rehber, POI yönetim sisteminizin tam yedeklemesini alma ve geri yükleme işlemlerini açıklar.

## 🎯 Özellikler

- **Tam Yedekleme**: Tüm program dosyaları + PostgreSQL veritabanı
- **Seçici Geri Yükleme**: Sadece dosyalar veya sadece veritabanı
- **Otomatik Güvenlik Yedeklemesi**: Geri yükleme öncesi mevcut durumu koruma
- **Eski Yedekleme Temizliği**: Disk alanı yönetimi
- **Detaylı Loglama**: Tüm işlemlerin kaydı

## 📋 Gereksinimler

### Python Bağımlılıkları
```bash
# Zaten mevcut Python paketleri kullanılıyor, ek kurulum gerekmez
```

### PostgreSQL Client Araçları
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# CentOS/RHEL
sudo yum install postgresql

# macOS
brew install postgresql
```

## 🚀 Hızlı Başlangıç

### 1. Yedekleme Alma
```bash
# Kolay yol (Shell script)
./backup_restore.sh backup

# Doğrudan Python ile
python3 backup_system.py backup
```

### 2. Yedeklemeleri Listeleme
```bash
# Mevcut yedeklemeleri görüntüle
./backup_restore.sh list
```

### 3. Geri Yükleme
```bash
# Tam geri yükleme
./backup_restore.sh restore poi_backup_full_20240122_143022

# Python ile
python3 backup_system.py restore --name poi_backup_full_20240122_143022
```

## 📁 Yedeklenen İçerik

### Program Dosyaları
- ✅ Tüm Python dosyaları (*.py)
- ✅ HTML dosyaları (*.html)
- ✅ Markdown dosyaları (*.md)
- ✅ JSON ve TXT dosyaları
- ✅ Shell script'leri (*.sh)
- ✅ GraphML dosyaları
- ✅ Yapılandırma dosyaları (.env.example, .gitignore)
- ✅ Medya klasörleri (poi_images/, poi_media/)

### Hariç Tutulanlar
- ❌ Python cache (__pycache__/)
- ❌ Virtual environment (poi_env/)
- ❌ Git klasörü (.git/)
- ❌ Mevcut yedeklemeler (backups/)
- ❌ Log dosyaları (*.log)

### Veritabanı
- ✅ Tüm tablolar ve veriler
- ✅ Şema yapısı
- ✅ İndeksler ve kısıtlamalar
- ✅ Temizleme komutları (--clean)

## 🔧 Detaylı Kullanım

### Yedekleme Sistemi Yapılandırması

Veritabanı bağlantı bilgileri `.env` dosyasından okunur:
```bash
# .env dosyası örneği
DB_HOST=localhost
DB_PORT=5432
DB_NAME=poi_database
DB_USER=poi_user
DB_PASSWORD=your_password
```

### Komut Satırı Seçenekleri

#### Python Script Kullanımı
```bash
# Tam yedekleme
python3 backup_system.py backup

# Geri yükleme
python3 backup_system.py restore --name <yedekleme_adı>

# Listeleme
python3 backup_system.py list

# Temizleme (son 5 adet koru)
python3 backup_system.py cleanup --keep 5
```

#### Shell Script Kullanımı
```bash
# Yedekleme
./backup_restore.sh backup

# Geri yükleme (onay ister)
./backup_restore.sh restore <yedekleme_adı>

# Listeleme
./backup_restore.sh list

# Temizleme (onay ister)
./backup_restore.sh cleanup [korunacak_sayı]

# Yardım
./backup_restore.sh help
```

## 📊 Yedekleme Dosya Yapısı

Her yedekleme 3 dosyadan oluşur:
```
backups/
├── poi_backup_full_20240122_143022_files.zip     # Program dosyaları
├── poi_backup_full_20240122_143022_database.sql  # Veritabanı dump'ı
└── poi_backup_full_20240122_143022_info.json     # Yedekleme bilgileri
```

### Bilgi Dosyası İçeriği
```json
{
  "backup_name": "poi_backup_full_20240122_143022",
  "timestamp": "2024-01-22T14:30:22.123456",
  "files_backup": "poi_backup_full_20240122_143022_files.zip",
  "database_backup": "poi_backup_full_20240122_143022_database.sql",
  "db_config": {
    "host": "localhost",
    "port": "5432",
    "database": "poi_database",
    "username": "poi_user"
  },
  "project_root": "/opt/rehber/seyahat_onerisi"
}
```

## 🔒 Güvenlik Özellikleri

### Güvenlik Yedeklemesi
Geri yükleme işlemi öncesi otomatik olarak mevcut durum yedeklenir:
```
poi_backup_safety_20240122_144500_files.zip
```

### Şifre Güvenliği
- Veritabanı şifresi environment variable olarak geçirilir
- Komut satırında şifre görünmez
- Log dosyalarında şifre kayıtlı değil

## 📝 Log Dosyaları

Tüm işlemler `backup_system.log` dosyasına kaydedilir:
```
2024-01-22 14:30:22,123 - INFO - Tam yedekleme başlatılıyor...
2024-01-22 14:30:23,456 - INFO - Program dosyaları yedekleniyor...
2024-01-22 14:30:25,789 - INFO - Veritabanı yedekleniyor...
2024-01-22 14:30:28,012 - INFO - Tam yedekleme tamamlandı: poi_backup_full_20240122_143022
```

## 🚨 Sorun Giderme

### PostgreSQL Bağlantı Sorunları
```bash
# Bağlantıyı test et
psql -h localhost -U poi_user -d poi_database -c "SELECT version();"

# pg_dump test et
pg_dump --host=localhost --username=poi_user --version
```

### Dosya İzin Sorunları
```bash
# Script'lere çalıştırma izni ver
chmod +x backup_restore.sh
chmod +x backup_system.py

# Yedekleme klasörü izinleri
chmod 755 backups/
```

### Disk Alanı Kontrolü
```bash
# Mevcut alan kontrolü
df -h .

# Yedekleme klasörü boyutu
du -sh backups/
```

## 🔄 Otomatik Yedekleme

### Cron Job Kurulumu
```bash
# Crontab düzenle
crontab -e

# Her gün saat 02:00'da yedekleme al
0 2 * * * cd /opt/rehber/seyahat_onerisi && ./backup_restore.sh backup

# Her hafta eski yedeklemeleri temizle
0 3 * * 0 cd /opt/rehber/seyahat_onerisi && ./backup_restore.sh cleanup 10
```

### Systemd Timer (Alternatif)
```bash
# Timer dosyası oluştur
sudo nano /etc/systemd/system/poi-backup.timer

# Service dosyası oluştur
sudo nano /etc/systemd/system/poi-backup.service

# Aktifleştir
sudo systemctl enable poi-backup.timer
sudo systemctl start poi-backup.timer
```

## 📞 Destek

Sorun yaşadığınızda:
1. `backup_system.log` dosyasını kontrol edin
2. PostgreSQL bağlantısını test edin
3. Disk alanını kontrol edin
4. İzinleri kontrol edin

## 🎉 Başarı Örnekleri

### Başarılı Yedekleme
```
✅ Yedekleme tamamlandı: poi_backup_full_20240122_143022
📁 Dosyalar: poi_backup_full_20240122_143022_files.zip (2.3 MB)
🗄️  Veritabanı: poi_backup_full_20240122_143022_database.sql (1.8 MB)
```

### Başarılı Geri Yükleme
```
✅ Geri yükleme tamamlandı: poi_backup_full_20240122_143022
🔒 Güvenlik yedeklemesi: poi_backup_safety_20240122_144500
```