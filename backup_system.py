#!/usr/bin/env python3
"""
POI Yönetim Sistemi - Yedekleme ve Geri Yükleme Sistemi
Bu script hem program dosyalarını hem de PostgreSQL veritabanını yedekler/geri yükler.
"""

import os
import sys
import json
import shutil
import subprocess
import datetime
from pathlib import Path
import argparse
import zipfile
import logging

# Logging ayarları
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backup_system.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class POIBackupSystem:
    def __init__(self):
        self.project_root = Path.cwd()
        self.backup_dir = self.project_root / "backups"
        self.backup_dir.mkdir(exist_ok=True)
        
        # Veritabanı bağlantı bilgileri (.env dosyasından okunacak)
        self.load_db_config()
        
        # Yedeklenecek dosya ve klasörler
        self.backup_items = [
            "*.py",
            "*.html", 
            "*.md",
            "*.json",
            "*.txt",
            "*.sh",
            "*.graphml",
            ".env.example",
            ".gitignore",
            "poi_images/",
            "poi_media/"
        ]
        
        # Hariç tutulacak öğeler
        self.exclude_items = [
            "__pycache__/",
            "poi_env/",
            ".git/",
            "backups/",
            "*.pyc",
            "*.log"
        ]

    def load_db_config(self):
        """Veritabanı yapılandırmasını yükle"""
        try:
            # .env dosyası varsa oku
            env_file = self.project_root / ".env"
            if env_file.exists():
                with open(env_file, 'r') as f:
                    for line in f:
                        if line.strip() and not line.startswith('#'):
                            key, value = line.strip().split('=', 1)
                            os.environ[key] = value
            
            # Varsayılan değerler
            self.db_config = {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': os.getenv('DB_PORT', '5432'),
                'database': os.getenv('DB_NAME', 'poi_database'),
                'username': os.getenv('DB_USER', 'poi_user'),
                'password': os.getenv('DB_PASSWORD', '')
            }
            
        except Exception as e:
            logger.warning(f"Veritabanı yapılandırması yüklenemedi: {e}")
            # Varsayılan değerler
            self.db_config = {
                'host': 'localhost',
                'port': '5432', 
                'database': 'poi_database',
                'username': 'poi_user',
                'password': ''
            }

    def create_backup_name(self, backup_type="full"):
        """Yedekleme dosyası adı oluştur"""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"poi_backup_{backup_type}_{timestamp}"

    def backup_files(self, backup_name):
        """Program dosyalarını yedekle"""
        logger.info("Program dosyaları yedekleniyor...")
        
        files_backup_path = self.backup_dir / f"{backup_name}_files.zip"
        
        with zipfile.ZipFile(files_backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for item in self.backup_items:
                if item.endswith('/'):
                    # Klasör
                    folder_path = self.project_root / item.rstrip('/')
                    if folder_path.exists():
                        for file_path in folder_path.rglob('*'):
                            if file_path.is_file():
                                # Hariç tutulacak dosyaları kontrol et
                                relative_path = file_path.relative_to(self.project_root)
                                if not any(exclude in str(relative_path) for exclude in self.exclude_items):
                                    zipf.write(file_path, relative_path)
                else:
                    # Dosya pattern'i
                    for file_path in self.project_root.glob(item):
                        if file_path.is_file():
                            relative_path = file_path.relative_to(self.project_root)
                            if not any(exclude in str(relative_path) for exclude in self.exclude_items):
                                zipf.write(file_path, relative_path)
        
        logger.info(f"Program dosyaları yedeklendi: {files_backup_path}")
        return files_backup_path

    def backup_database(self, backup_name):
        """PostgreSQL veritabanını yedekle"""
        logger.info("Veritabanı yedekleniyor...")
        
        db_backup_path = self.backup_dir / f"{backup_name}_database.sql"
        
        # pg_dump komutu
        cmd = [
            'pg_dump',
            f"--host={self.db_config['host']}",
            f"--port={self.db_config['port']}",
            f"--username={self.db_config['username']}",
            '--no-password',
            '--verbose',
            '--clean',
            '--no-acl',
            '--no-owner',
            self.db_config['database']
        ]
        
        try:
            # PGPASSWORD environment variable ayarla
            env = os.environ.copy()
            if self.db_config['password']:
                env['PGPASSWORD'] = self.db_config['password']
            
            with open(db_backup_path, 'w') as f:
                result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, 
                                      env=env, text=True, check=True)
            
            logger.info(f"Veritabanı yedeklendi: {db_backup_path}")
            return db_backup_path
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Veritabanı yedekleme hatası: {e}")
            logger.error(f"Hata detayı: {e.stderr}")
            return None
        except FileNotFoundError:
            logger.error("pg_dump komutu bulunamadı. PostgreSQL client araçları yüklü olmalı.")
            return None

    def create_backup_info(self, backup_name, files_path, db_path):
        """Yedekleme bilgi dosyası oluştur"""
        info = {
            'backup_name': backup_name,
            'timestamp': datetime.datetime.now().isoformat(),
            'files_backup': str(files_path.name) if files_path else None,
            'database_backup': str(db_path.name) if db_path else None,
            'db_config': {
                'host': self.db_config['host'],
                'port': self.db_config['port'],
                'database': self.db_config['database'],
                'username': self.db_config['username']
            },
            'project_root': str(self.project_root)
        }
        
        info_path = self.backup_dir / f"{backup_name}_info.json"
        with open(info_path, 'w', encoding='utf-8') as f:
            json.dump(info, f, indent=2, ensure_ascii=False)
        
        return info_path

    def full_backup(self):
        """Tam yedekleme (dosyalar + veritabanı)"""
        logger.info("Tam yedekleme başlatılıyor...")
        
        backup_name = self.create_backup_name("full")
        
        # Dosyaları yedekle
        files_path = self.backup_files(backup_name)
        
        # Veritabanını yedekle
        db_path = self.backup_database(backup_name)
        
        # Bilgi dosyası oluştur
        info_path = self.create_backup_info(backup_name, files_path, db_path)
        
        logger.info(f"Tam yedekleme tamamlandı: {backup_name}")
        return backup_name

    def list_backups(self):
        """Mevcut yedeklemeleri listele"""
        logger.info("Mevcut yedeklemeler:")
        
        info_files = list(self.backup_dir.glob("*_info.json"))
        if not info_files:
            logger.info("Hiç yedekleme bulunamadı.")
            return []
        
        backups = []
        for info_file in sorted(info_files):
            try:
                with open(info_file, 'r', encoding='utf-8') as f:
                    info = json.load(f)
                backups.append(info)
                
                print(f"\n📦 {info['backup_name']}")
                print(f"   📅 Tarih: {info['timestamp']}")
                print(f"   📁 Dosyalar: {'✅' if info['files_backup'] else '❌'}")
                print(f"   🗄️  Veritabanı: {'✅' if info['database_backup'] else '❌'}")
                
            except Exception as e:
                logger.warning(f"Yedekleme bilgisi okunamadı {info_file}: {e}")
        
        return backups 
   def restore_files(self, backup_name):
        """Program dosyalarını geri yükle"""
        logger.info(f"Program dosyaları geri yükleniyor: {backup_name}")
        
        files_backup_path = self.backup_dir / f"{backup_name}_files.zip"
        
        if not files_backup_path.exists():
            logger.error(f"Dosya yedeklemesi bulunamadı: {files_backup_path}")
            return False
        
        try:
            # Mevcut dosyaları yedekle (güvenlik için)
            safety_backup = self.create_backup_name("safety")
            logger.info(f"Güvenlik yedeklemesi oluşturuluyor: {safety_backup}")
            self.backup_files(safety_backup)
            
            # Zip dosyasını aç
            with zipfile.ZipFile(files_backup_path, 'r') as zipf:
                zipf.extractall(self.project_root)
            
            logger.info("Program dosyaları başarıyla geri yüklendi")
            return True
            
        except Exception as e:
            logger.error(f"Dosya geri yükleme hatası: {e}")
            return False

    def restore_database(self, backup_name):
        """Veritabanını geri yükle"""
        logger.info(f"Veritabanı geri yükleniyor: {backup_name}")
        
        db_backup_path = self.backup_dir / f"{backup_name}_database.sql"
        
        if not db_backup_path.exists():
            logger.error(f"Veritabanı yedeklemesi bulunamadı: {db_backup_path}")
            return False
        
        try:
            # Veritabanını geri yükle
            cmd = [
                'psql',
                f"--host={self.db_config['host']}",
                f"--port={self.db_config['port']}",
                f"--username={self.db_config['username']}",
                '--no-password',
                '--quiet',
                self.db_config['database']
            ]
            
            # PGPASSWORD environment variable ayarla
            env = os.environ.copy()
            if self.db_config['password']:
                env['PGPASSWORD'] = self.db_config['password']
            
            with open(db_backup_path, 'r') as f:
                result = subprocess.run(cmd, stdin=f, stderr=subprocess.PIPE,
                                      env=env, text=True, check=True)
            
            logger.info("Veritabanı başarıyla geri yüklendi")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Veritabanı geri yükleme hatası: {e}")
            logger.error(f"Hata detayı: {e.stderr}")
            return False
        except FileNotFoundError:
            logger.error("psql komutu bulunamadı. PostgreSQL client araçları yüklü olmalı.")
            return False

    def full_restore(self, backup_name):
        """Tam geri yükleme (dosyalar + veritabanı)"""
        logger.info(f"Tam geri yükleme başlatılıyor: {backup_name}")
        
        # Bilgi dosyasını kontrol et
        info_path = self.backup_dir / f"{backup_name}_info.json"
        if not info_path.exists():
            logger.error(f"Yedekleme bilgi dosyası bulunamadı: {info_path}")
            return False
        
        try:
            with open(info_path, 'r', encoding='utf-8') as f:
                info = json.load(f)
        except Exception as e:
            logger.error(f"Yedekleme bilgisi okunamadı: {e}")
            return False
        
        success = True
        
        # Dosyaları geri yükle
        if info.get('files_backup'):
            if not self.restore_files(backup_name):
                success = False
        
        # Veritabanını geri yükle
        if info.get('database_backup'):
            if not self.restore_database(backup_name):
                success = False
        
        if success:
            logger.info(f"Tam geri yükleme tamamlandı: {backup_name}")
        else:
            logger.error(f"Geri yükleme sırasında hatalar oluştu: {backup_name}")
        
        return success

    def cleanup_old_backups(self, keep_count=5):
        """Eski yedeklemeleri temizle"""
        logger.info(f"Eski yedeklemeler temizleniyor (son {keep_count} adet korunacak)...")
        
        info_files = sorted(self.backup_dir.glob("*_info.json"))
        
        if len(info_files) <= keep_count:
            logger.info("Temizlenecek eski yedekleme yok.")
            return
        
        files_to_remove = info_files[:-keep_count]
        
        for info_file in files_to_remove:
            try:
                # Bilgi dosyasını oku
                with open(info_file, 'r', encoding='utf-8') as f:
                    info = json.load(f)
                
                backup_name = info['backup_name']
                
                # İlgili dosyaları sil
                files_to_delete = [
                    self.backup_dir / f"{backup_name}_info.json",
                    self.backup_dir / f"{backup_name}_files.zip",
                    self.backup_dir / f"{backup_name}_database.sql"
                ]
                
                for file_path in files_to_delete:
                    if file_path.exists():
                        file_path.unlink()
                        logger.info(f"Silindi: {file_path.name}")
                
            except Exception as e:
                logger.warning(f"Yedekleme temizleme hatası {info_file}: {e}")

def main():
    parser = argparse.ArgumentParser(description='POI Yönetim Sistemi Yedekleme Aracı')
    parser.add_argument('action', choices=['backup', 'restore', 'list', 'cleanup'],
                       help='Yapılacak işlem')
    parser.add_argument('--name', help='Geri yükleme için yedekleme adı')
    parser.add_argument('--keep', type=int, default=5, 
                       help='Temizleme sırasında korunacak yedekleme sayısı')
    
    args = parser.parse_args()
    
    backup_system = POIBackupSystem()
    
    try:
        if args.action == 'backup':
            backup_name = backup_system.full_backup()
            print(f"\n✅ Yedekleme tamamlandı: {backup_name}")
            
        elif args.action == 'restore':
            if not args.name:
                print("❌ Geri yükleme için --name parametresi gerekli")
                backup_system.list_backups()
                sys.exit(1)
            
            if backup_system.full_restore(args.name):
                print(f"\n✅ Geri yükleme tamamlandı: {args.name}")
            else:
                print(f"\n❌ Geri yükleme başarısız: {args.name}")
                sys.exit(1)
                
        elif args.action == 'list':
            backup_system.list_backups()
            
        elif args.action == 'cleanup':
            backup_system.cleanup_old_backups(args.keep)
            print(f"\n✅ Temizleme tamamlandı (son {args.keep} yedekleme korundu)")
            
    except KeyboardInterrupt:
        print("\n\n⚠️ İşlem kullanıcı tarafından iptal edildi")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Beklenmeyen hata: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()