#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
POI Medya Klasörleri Temizleme Scripti
Kullanılmayan eski medya türü klasörlerini temizler
"""

from poi_media_manager import POIMediaManager
import os

def main():
    print("🧹 POI Medya Klasörleri Temizleme Scripti")
    print("=" * 50)
    
    # Media manager'ı başlat
    media_manager = POIMediaManager()
    
    print(f"📁 Medya klasörü: {media_manager.base_path}")
    print(f"🔍 Kontrol ediliyor...")
    
    # Mevcut klasör yapısını kontrol et
    unused_folders = []
    folders_with_files = []
    
    for media_type, config in media_manager.SUPPORTED_FORMATS.items():
        folder_name = config['folder']
        
        # Ana klasörler
        main_folder = media_manager.base_path / folder_name
        thumb_folder = media_manager.thumbnails_path / folder_name  
        preview_folder = media_manager.previews_path / folder_name
        
        for folder in [main_folder, thumb_folder, preview_folder]:
            if folder.exists():
                try:
                    files = list(folder.iterdir())
                    if len(files) == 0:
                        unused_folders.append(folder)
                    else:
                        folders_with_files.append((folder, len(files)))
                except Exception as e:
                    print(f"❌ Klasör kontrol hatası: {folder} - {e}")
    
    # Sonuçları göster
    print(f"\n📊 Sonuçlar:")
    print(f"  🗑️ Silinebilir boş klasör: {len(unused_folders)} adet")
    print(f"  📄 Dosya içeren klasör: {len(folders_with_files)} adet")
    
    if unused_folders:
        print(f"\n🗑️ Silinebilir boş klasörler:")
        for folder in unused_folders:
            print(f"   • {folder}")
    
    if folders_with_files:
        print(f"\n📄 Dosya içeren klasörler (silinmeyecek):")
        for folder, file_count in folders_with_files:
            print(f"   • {folder} ({file_count} dosya)")
    
    # Kullanıcıdan onay al
    if unused_folders:
        print(f"\n⚠️ {len(unused_folders)} adet boş klasör silinecek.")
        choice = input("Devam etmek istiyor musunuz? (e/h): ").lower().strip()
        
        if choice in ['e', 'evet', 'y', 'yes']:
            print("\n🧹 Temizlik başlatılıyor...")
            cleaned = media_manager.cleanup_unused_directories()
            print(f"✅ Temizlik tamamlandı! {len(cleaned)} klasör silindi.")
        else:
            print("❌ İşlem iptal edildi.")
    else:
        print("\n✅ Silinecek boş klasör bulunamadı. Sistem temiz!")
    
    # Aktif POI ID'lerini göster
    by_poi_dir = media_manager.base_path / "by_poi_id"
    if by_poi_dir.exists():
        poi_dirs = [d for d in by_poi_dir.iterdir() if d.is_dir()]
        print(f"\n📈 Aktif POI sayısı: {len(poi_dirs)}")
        if poi_dirs:
            print("🗂️ Aktif POI'ler:")
            for poi_dir in sorted(poi_dirs):
                # POI klasöründeki medya türlerini say
                media_types = []
                for media_type, config in media_manager.SUPPORTED_FORMATS.items():
                    folder_name = config['folder']
                    media_folder = poi_dir / folder_name
                    if media_folder.exists():
                        file_count = len([f for f in media_folder.iterdir() if f.is_file()])
                        if file_count > 0:
                            media_types.append(f"{folder_name}({file_count})")
                
                if media_types:
                    print(f"   • {poi_dir.name}: {', '.join(media_types)}")
                else:
                    print(f"   • {poi_dir.name}: boş")
    else:
        print("\n📈 Henüz POI medyası yüklenmemiş.")

if __name__ == "__main__":
    main() 