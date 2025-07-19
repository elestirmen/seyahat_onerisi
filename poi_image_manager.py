#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
POI Görsel Yönetim Sistemi
Görselleri yükler, boyutlandırır ve veritabanında saklar
"""

import os
import shutil
from PIL import Image
import hashlib
from typing import List, Dict, Optional, Tuple
import uuid
from pathlib import Path

class POIImageManager:
    def __init__(self, base_path: str = "poi_images"):
        self.base_path = Path(base_path)
        self.thumbnails_path = self.base_path / "thumbnails"
        self.ensure_directories()
    
    def ensure_directories(self):
        """Gerekli klasörleri oluştur"""
        self.base_path.mkdir(exist_ok=True)
        self.thumbnails_path.mkdir(exist_ok=True)
        
        # Kategori klasörlerini oluştur
        categories = ['gastronomik', 'kulturel', 'sanatsal', 'doga_macera', 'konaklama']
        for category in categories:
            (self.base_path / category).mkdir(exist_ok=True)
            (self.thumbnails_path / category).mkdir(exist_ok=True)
    
    def sanitize_poi_name(self, poi_name: str) -> str:
        """POI adını dosya adı için temizle"""
        # Türkçe karakterleri değiştir
        replacements = {
            'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
            'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
        }
        
        clean_name = poi_name.lower()
        for tr_char, en_char in replacements.items():
            clean_name = clean_name.replace(tr_char, en_char)
        
        # Özel karakterleri kaldır
        clean_name = ''.join(c if c.isalnum() or c in '-_' else '_' for c in clean_name)
        clean_name = clean_name.strip('_').replace('__', '_')
        
        return clean_name[:50]  # Maksimum 50 karakter
    
    def create_thumbnail(self, image_path: Path, thumbnail_path: Path, size: Tuple[int, int] = (300, 200)) -> bool:
        """Görsel için thumbnail oluştur"""
        try:
            with Image.open(image_path) as img:
                # EXIF verilerini koru ve döndür
                if hasattr(img, '_getexif'):
                    exif = img._getexif()
                    if exif is not None:
                        orientation = exif.get(274)  # Orientation tag
                        if orientation == 3:
                            img = img.rotate(180, expand=True)
                        elif orientation == 6:
                            img = img.rotate(270, expand=True)
                        elif orientation == 8:
                            img = img.rotate(90, expand=True)
                
                # Thumbnail oluştur
                img.thumbnail(size, Image.Resampling.LANCZOS)
                
                # RGB'ye çevir (WebP için)
                if img.mode in ('RGBA', 'LA', 'P'):
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    # WebP RGBA'yı destekler, bu yüzden background gereksiz
                    if img.mode == 'LA':
                        img = img.convert('RGBA')
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # WebP formatında kaydet - %85 kalite ile mükemmel boyut/kalite dengesi
                img.save(thumbnail_path, 'WebP', quality=85, optimize=True)
                return True
        except Exception as e:
            print(f"Thumbnail oluşturma hatası: {e}")
            return False

    def convert_to_webp(self, input_path: Path, output_path: Path, quality: int = 90) -> bool:
        """Görseli WebP formatına dönüştür"""
        try:
            with Image.open(input_path) as img:
                # EXIF verilerini koru ve döndür
                if hasattr(img, '_getexif'):
                    exif = img._getexif()
                    if exif is not None:
                        orientation = exif.get(274)  # Orientation tag
                        if orientation == 3:
                            img = img.rotate(180, expand=True)
                        elif orientation == 6:
                            img = img.rotate(270, expand=True)
                        elif orientation == 8:
                            img = img.rotate(90, expand=True)
                
                # Çok büyük görselleri yeniden boyutlandır (max 2048px)
                max_size = 2048
                if img.width > max_size or img.height > max_size:
                    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                    print(f"📏 Görsel yeniden boyutlandırıldı: {img.size}")
                
                # RGB/RGBA moduna çevir
                if img.mode in ('LA', 'P'):
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    elif img.mode == 'LA':
                        img = img.convert('RGBA')
                elif img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')
                
                # WebP formatında kaydet
                img.save(output_path, 'WebP', quality=quality, optimize=True, lossless=False)
                
                # Dosya boyutu karşılaştırması
                original_size = os.path.getsize(input_path) if os.path.exists(input_path) else 0
                new_size = os.path.getsize(output_path)
                compression_ratio = ((original_size - new_size) / original_size * 100) if original_size > 0 else 0
                
                print(f"📦 WebP dönüşümü: {original_size/1024:.1f}KB → {new_size/1024:.1f}KB (%{compression_ratio:.1f} azalma)")
                return True
                
        except Exception as e:
            print(f"❌ WebP dönüşüm hatası: {e}")
            return False
    
    def add_poi_image(self, poi_name: str, category: str, image_file_path: str, 
                     image_type: str = 'photo', caption: str = '', is_primary: bool = False) -> Optional[Dict]:
        """POI'ye görsel ekle"""
        try:
            # Dosya kontrolü
            if not os.path.exists(image_file_path):
                raise FileNotFoundError(f"Görsel dosyası bulunamadı: {image_file_path}")
            
            # POI klasörü oluştur
            poi_folder_name = self.sanitize_poi_name(poi_name)
            poi_dir = self.base_path / category / poi_folder_name
            poi_dir.mkdir(exist_ok=True)
            
            # Thumbnail klasörü
            thumbnail_dir = self.thumbnails_path / category / poi_folder_name
            thumbnail_dir.mkdir(exist_ok=True)
            
            # Dosya adı ve uzantısı
            original_name = Path(image_file_path).name
            file_extension = Path(image_file_path).suffix.lower()
            
            # Benzersiz dosya adı oluştur
            unique_id = str(uuid.uuid4())[:8]
            new_filename = f"{image_type}_{unique_id}{file_extension}"
            
            # Hedef yollar
            target_path = poi_dir / new_filename
            thumbnail_path = thumbnail_dir / f"thumb_{new_filename.replace(file_extension, '.jpg')}"
            
            # Dosyayı kopyala
            shutil.copy2(image_file_path, target_path)
            
            # Thumbnail oluştur
            thumbnail_created = self.create_thumbnail(target_path, thumbnail_path)
            
            # Görsel bilgilerini döndür
            image_info = {
                'poi_name': poi_name,
                'category': category,
                'image_path': str(target_path.relative_to(self.base_path.parent)),
                'thumbnail_path': str(thumbnail_path.relative_to(self.base_path.parent)) if thumbnail_created else None,
                'image_type': image_type,
                'caption': caption,
                'is_primary': is_primary,
                'file_size': os.path.getsize(target_path),
                'original_name': original_name
            }
            
            print(f"✅ Görsel eklendi: {poi_name} - {new_filename}")
            return image_info
            
        except Exception as e:
            print(f"❌ Görsel ekleme hatası: {e}")
            return None
    
    def add_poi_image_by_id(self, poi_id: str, poi_name: str, category: str, image_file_path: str, 
                           image_type: str = 'photo', caption: str = '', is_primary: bool = False) -> Optional[Dict]:
        """POI ID bazlı görsel ekleme - çoklu kategori desteği"""
        try:
            # Dosya kontrolü
            if not os.path.exists(image_file_path):
                raise FileNotFoundError(f"Görsel dosyası bulunamadı: {image_file_path}")
            
            # POI ID bazlı klasör yapısı
            poi_id_folder = f"poi_{poi_id}"
            poi_dir = self.base_path / "by_poi_id" / poi_id_folder
            poi_dir.mkdir(parents=True, exist_ok=True)
            
            # Thumbnail klasörü
            thumbnail_dir = self.thumbnails_path / "by_poi_id" / poi_id_folder
            thumbnail_dir.mkdir(parents=True, exist_ok=True)
            
            # Dosya adı ve uzantısı
            original_name = Path(image_file_path).name
            original_size = os.path.getsize(image_file_path)
            
            # Benzersiz dosya adı oluştur - her zaman .webp uzantısı
            unique_id = str(uuid.uuid4())[:8]
            new_filename = f"{image_type}_{unique_id}.webp"
            
            # Hedef yollar
            target_path = poi_dir / new_filename
            thumbnail_path = thumbnail_dir / f"thumb_{new_filename}"
            
            # Dosyayı WebP formatına dönüştür ve kaydet
            webp_success = self.convert_to_webp(Path(image_file_path), target_path, quality=90)
            if not webp_success:
                # WebP dönüşümü başarısızsa, orijinal dosyayı kopyala
                print("⚠️ WebP dönüşümü başarısız, orijinal dosya kopyalanıyor...")
                shutil.copy2(image_file_path, target_path)
            
            # Thumbnail oluştur (WebP formatında)
            thumbnail_created = self.create_thumbnail(target_path, thumbnail_path)
            
            # Final dosya boyutu
            final_size = os.path.getsize(target_path)
            size_reduction = ((original_size - final_size) / original_size * 100) if original_size > 0 else 0
            
            # Görsel bilgilerini döndür
            image_info = {
                'poi_id': poi_id,
                'poi_name': poi_name,
                'category': category,
                'path': str(target_path.relative_to(self.base_path.parent)),
                'thumbnail_path': str(thumbnail_path.relative_to(self.base_path.parent)) if thumbnail_created else None,
                'image_type': image_type,
                'caption': caption,
                'is_primary': is_primary,
                'file_size': final_size,
                'original_name': original_name,
                'filename': new_filename,
                'format': 'webp',
                'compression_ratio': f"{size_reduction:.1f}%"
            }
            
            print(f"✅ WebP görsel eklendi: {poi_name} - {new_filename} ({original_size/1024:.1f}KB → {final_size/1024:.1f}KB)")
            return image_info
            
        except Exception as e:
            print(f"❌ Görsel ekleme hatası: {e}")
            return None

    def get_poi_images(self, poi_name: str, category: str) -> List[Dict]:
        """POI'nin görsellerini listele (eski kategori bazlı sistem)"""
        poi_folder_name = self.sanitize_poi_name(poi_name)
        poi_dir = self.base_path / category / poi_folder_name
        thumbnail_dir = self.thumbnails_path / category / poi_folder_name
        
        images = []
        if poi_dir.exists():
            for image_file in poi_dir.glob('*'):
                if image_file.is_file() and image_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
                    # Thumbnail yolu
                    thumb_name = f"thumb_{image_file.stem}.jpg"
                    thumbnail_path = thumbnail_dir / thumb_name
                    
                    images.append({
                        'path': str(image_file.relative_to(self.base_path.parent)),
                        'thumbnail_path': str(thumbnail_path.relative_to(self.base_path.parent)) if thumbnail_path.exists() else None,
                        'filename': image_file.name,
                        'size': os.path.getsize(image_file)
                    })
        
        return images

    def get_poi_images_by_id(self, poi_id: str) -> List[Dict]:
        """POI ID bazlı görsel listeleme"""
        poi_id_folder = f"poi_{poi_id}"
        poi_dir = self.base_path / "by_poi_id" / poi_id_folder
        thumbnail_dir = self.thumbnails_path / "by_poi_id" / poi_id_folder
        
        images = []
        if poi_dir.exists():
            for image_file in poi_dir.glob('*'):
                if image_file.is_file() and image_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
                    # Thumbnail yolu
                    thumb_name = f"thumb_{image_file.stem}.jpg"
                    thumbnail_path = thumbnail_dir / thumb_name
                    
                    images.append({
                        'path': str(image_file.relative_to(self.base_path.parent)),
                        'thumbnail_path': str(thumbnail_path.relative_to(self.base_path.parent)) if thumbnail_path.exists() else None,
                        'filename': image_file.name,
                        'size': os.path.getsize(image_file)
                    })
        
        return images
    
    def bulk_import_images(self, import_config: Dict) -> List[Dict]:
        """Toplu görsel içe aktarma"""
        results = []
        
        for poi_config in import_config.get('pois', []):
            poi_name = poi_config['name']
            category = poi_config['category']
            
            for image_config in poi_config.get('images', []):
                result = self.add_poi_image(
                    poi_name=poi_name,
                    category=category,
                    image_file_path=image_config['path'],
                    image_type=image_config.get('type', 'photo'),
                    caption=image_config.get('caption', ''),
                    is_primary=image_config.get('is_primary', False)
                )
                if result:
                    results.append(result)
        
        return results

    def delete_poi_image_by_id(self, poi_id: str, filename: str) -> bool:
        """POI ID bazlı görsel silme"""
        try:
            poi_id_folder = f"poi_{poi_id}"
            
            # Ana görsel yolu
            image_path = self.base_path / "by_poi_id" / poi_id_folder / filename
            
            # Thumbnail yolu - WebP için
            # Dosya uzantısı ne olursa olsun thumbnail'in .webp olacağını varsayıyoruz
            thumb_name = f"thumb_{Path(filename).stem}.webp"
            thumbnail_path = self.thumbnails_path / "by_poi_id" / poi_id_folder / thumb_name

            deleted_something = False
            if image_path.exists() and image_path.is_file():
                image_path.unlink()
                print(f"✅ Görsel silindi: {image_path}")
                deleted_something = True
            else:
                print(f"⚠️ Silinecek görsel bulunamadı: {image_path}")

            if thumbnail_path.exists() and thumbnail_path.is_file():
                thumbnail_path.unlink()
                print(f"✅ Thumbnail silindi: {thumbnail_path}")
                deleted_something = True
            else:
                print(f"⚠️ Silinecek thumbnail bulunamadı: {thumbnail_path}")
                
            return deleted_something

        except Exception as e:
            print(f"❌ Görsel silme hatası: {e}")
            return False

# Örnek kullanım
if __name__ == "__main__":
    manager = POIImageManager()
    
    # Örnek görsel ekleme
    example_config = {
        'pois': [
            {
                'name': 'Ziggy Cafe & Restaurant (Ürgüp)',
                'category': 'gastronomik',
                'images': [
                    {
                        'path': '/path/to/ziggy_exterior.jpg',
                        'type': 'exterior',
                        'caption': 'Dış görünüm',
                        'is_primary': True
                    },
                    {
                        'path': '/path/to/ziggy_interior.jpg',
                        'type': 'interior',
                        'caption': 'İç mekan'
                    }
                ]
            }
        ]
    }
    
    # results = manager.bulk_import_images(example_config)
    # print(f"İçe aktarılan görsel sayısı: {len(results)}")