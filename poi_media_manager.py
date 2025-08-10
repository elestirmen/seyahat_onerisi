#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
POI Medya Yönetim Sistemi
Görseller, videolar, ses dosyaları ve 3D modelleri yükler, işler ve veritabanında saklar
"""

import os
import shutil
from PIL import Image
import hashlib
from typing import List, Dict, Optional, Tuple, Union
import uuid
from pathlib import Path
import mimetypes

class POIMediaManager:
    # Desteklenen medya formatları
    SUPPORTED_FORMATS = {
        'image': {
            'extensions': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
            'mime_types': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'],
            'max_size': 15 * 1024 * 1024,  # 15MB
            'folder': 'images'
        },
        'video': {
            'extensions': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'],
            'mime_types': ['video/mp4', 'video/avi', 'video/quicktime', 'video/webm'],
            'max_size': 100 * 1024 * 1024,  # 100MB
            'folder': 'videos'
        },
        'audio': {
            'extensions': ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
            'mime_types': ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac'],
            'max_size': 50 * 1024 * 1024,  # 50MB
            'folder': 'audio'
        },
        'model_3d': {
            'extensions': ['.glb', '.gltf', '.obj', '.fbx', '.dae', '.ply', '.stl'],
            'mime_types': ['model/gltf-binary', 'model/gltf+json', 'model/obj'],
            'max_size': 50 * 1024 * 1024,  # 50MB
            'folder': '3d_models'
        }
    }

    def __init__(self, base_path: str = "poi_media"):
        self.base_path = Path(base_path)
        self.thumbnails_path = self.base_path / "thumbnails"
        self.previews_path = self.base_path / "previews"
        self.ensure_directories()
    
    def ensure_directories(self):
        """Gerekli klasörleri oluştur - Sadece POI ID bazlı yapı"""
        self.base_path.mkdir(exist_ok=True)
        self.thumbnails_path.mkdir(exist_ok=True)
        self.previews_path.mkdir(exist_ok=True)
        
        # POI ID bazlı klasörleri oluştur (tek kullanılan yapı)
        (self.base_path / "by_poi_id").mkdir(exist_ok=True)
        (self.thumbnails_path / "by_poi_id").mkdir(exist_ok=True)
        (self.previews_path / "by_poi_id").mkdir(exist_ok=True)
    
    def cleanup_unused_directories(self):
        """Kullanılmayan eski medya türü klasörlerini temizle"""
        unused_folders = []
        
        for media_type, config in self.SUPPORTED_FORMATS.items():
            folder_name = config['folder']
            
            # Ana klasörler
            main_folder = self.base_path / folder_name
            thumb_folder = self.thumbnails_path / folder_name  
            preview_folder = self.previews_path / folder_name
            
            for folder in [main_folder, thumb_folder, preview_folder]:
                if folder.exists():
                    # Klasör boş mu kontrol et
                    try:
                        files = list(folder.iterdir())
                        if len(files) == 0:
                            folder.rmdir()
                            unused_folders.append(str(folder))
                            print(f"✅ Boş klasör silindi: {folder}")
                        else:
                            print(f"⚠️ Klasör boş değil, silinmedi: {folder} ({len(files)} dosya)")
                    except Exception as e:
                        print(f"❌ Klasör silinirken hata: {folder} - {e}")
        
        return unused_folders
    
    def detect_media_type(self, file_path: str) -> Optional[str]:
        """Dosya uzantısından medya türünü tespit et"""
        extension = Path(file_path).suffix.lower()
        
        for media_type, config in self.SUPPORTED_FORMATS.items():
            if extension in config['extensions']:
                return media_type
        
        return None
    
    def validate_file(self, file_path: str, media_type: str = None) -> Tuple[bool, str, str]:
        """Dosyayı doğrula ve medya türünü belirle"""
        if not os.path.exists(file_path):
            return False, "Dosya bulunamadı", ""
        
        # Dosya boyutu kontrolü
        file_size = os.path.getsize(file_path)
        
        # Medya türünü otomatik tespit et
        if not media_type:
            media_type = self.detect_media_type(file_path)
        
        if not media_type:
            return False, "Desteklenmeyen dosya formatı", ""
        
        # Format kontrolü
        config = self.SUPPORTED_FORMATS[media_type]
        extension = Path(file_path).suffix.lower()
        
        if extension not in config['extensions']:
            return False, f"Bu uzantı {media_type} için desteklenmiyor: {extension}", ""
        
        # Boyut kontrolü
        if file_size > config['max_size']:
            max_mb = config['max_size'] / (1024 * 1024)
            current_mb = file_size / (1024 * 1024)
            return False, f"Dosya boyutu çok büyük: {current_mb:.1f}MB (Max: {max_mb:.0f}MB)", ""
        
        return True, "Geçerli dosya", media_type
    
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
    
    def create_image_thumbnail(self, image_path: Path, thumbnail_path: Path, size: Tuple[int, int] = (300, 200)) -> bool:
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
                    if img.mode == 'LA':
                        img = img.convert('RGBA')
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # WebP formatında kaydet
                img.save(thumbnail_path, 'WebP', quality=85, optimize=True)
                return True
        except Exception as e:
            print(f"Thumbnail oluşturma hatası: {e}")
            return False

    def create_video_thumbnail(self, video_path: Path, thumbnail_path: Path, time: str = "00:00:01") -> bool:
        """Video için thumbnail oluştur (FFmpeg gerektirir)"""
        try:
            import subprocess
            
            # FFmpeg ile video'dan frame çıkar
            cmd = [
                'ffmpeg', '-i', str(video_path),
                '-ss', time, '-vframes', '1',
                '-f', 'image2', '-vf', 'scale=300:200',
                '-y', str(thumbnail_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and thumbnail_path.exists():
                print(f"✅ Video thumbnail oluşturuldu: {thumbnail_path}")
                return True
            else:
                print(f"❌ Video thumbnail oluşturulamadı: {result.stderr}")
                return False
                
        except ImportError:
            print("❌ FFmpeg bulunamadı, video thumbnail oluşturulamadı")
            return False
        except subprocess.TimeoutExpired:
            print("❌ Video thumbnail oluşturma zaman aşımına uğradı")
            return False
        except Exception as e:
            print(f"❌ Video thumbnail hatası: {e}")
            return False

    def create_audio_waveform(self, audio_path: Path, waveform_path: Path) -> bool:
        """Ses dosyası için dalga formu görüntüsü oluştur"""
        try:
            import librosa
            import matplotlib.pyplot as plt
            import numpy as np
            
            # Ses dosyasını yükle
            y, sr = librosa.load(str(audio_path), duration=30)  # İlk 30 saniye
            
            # Waveform oluştur
            plt.figure(figsize=(10, 3))
            plt.plot(np.linspace(0, len(y)/sr, len(y)), y, alpha=0.8)
            plt.xlabel('Zaman (saniye)')
            plt.ylabel('Genlik')
            plt.title('Ses Dalga Formu')
            plt.tight_layout()
            
            # PNG olarak kaydet
            plt.savefig(waveform_path, dpi=72, bbox_inches='tight')
            plt.close()
            
            print(f"✅ Ses dalga formu oluşturuldu: {waveform_path}")
            return True
            
        except ImportError:
            print("❌ librosa veya matplotlib bulunamadı, ses dalga formu oluşturulamadı")
            # Basit placeholder görsel oluştur
            return self.create_placeholder_thumbnail(waveform_path, "🎵 Ses Dosyası")
        except Exception as e:
            print(f"❌ Ses dalga formu hatası: {e}")
            return self.create_placeholder_thumbnail(waveform_path, "🎵 Ses Dosyası")

    def create_3d_preview(self, model_path: Path, preview_path: Path) -> bool:
        """3D model için önizleme görüntüsü oluştur"""
        try:
            # Basit placeholder - gelecekte 3D rendering eklenebilir
            return self.create_placeholder_thumbnail(preview_path, "🧊 3D Model")
            
        except Exception as e:
            print(f"❌ 3D model önizleme hatası: {e}")
            return self.create_placeholder_thumbnail(preview_path, "🧊 3D Model")

    def create_placeholder_thumbnail(self, thumbnail_path: Path, text: str) -> bool:
        """Placeholder thumbnail oluştur"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # 300x200 boyutunda resim oluştur
            img = Image.new('RGB', (300, 200), color='#f0f0f0')
            draw = ImageDraw.Draw(img)
            
            # Metin ekle
            try:
                font = ImageFont.truetype("arial.ttf", 20)
            except:
                font = ImageFont.load_default()
            
            # Metni ortala
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            x = (300 - text_width) // 2
            y = (200 - text_height) // 2
            
            draw.text((x, y), text, fill='#666666', font=font)
            
            # PNG olarak kaydet
            img.save(thumbnail_path, 'PNG')
            return True
            
        except Exception as e:
            print(f"❌ Placeholder oluşturma hatası: {e}")
            return False

    def convert_to_webp(self, input_path: Path, output_path: Path, quality: int = 90) -> bool:
        """Görseli WebP formatına dönüştür"""
        try:
            with Image.open(input_path) as img:
                # EXIF verilerini koru ve döndür
                if hasattr(img, '_getexif'):
                    exif = img._getexif()
                    if exif is not None:
                        orientation = exif.get(274)
                        if orientation == 3:
                            img = img.rotate(180, expand=True)
                        elif orientation == 6:
                            img = img.rotate(270, expand=True)
                        elif orientation == 8:
                            img = img.rotate(90, expand=True)
                
                # Çok büyük görselleri yeniden boyutlandır
                max_size = 2048
                if img.width > max_size or img.height > max_size:
                    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                
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
                return True
                
        except Exception as e:
            print(f"❌ WebP dönüşüm hatası: {e}")
            return False

    def add_poi_media(self, poi_id: str, poi_name: str, category: str, media_file_path: str,
                     media_type: str = None, caption: str = '', is_primary: bool = False) -> Optional[Dict]:
        """POI'ye medya dosyası ekle"""
        try:
            # Dosya doğrulama
            is_valid, message, detected_type = self.validate_file(media_file_path, media_type)
            if not is_valid:
                raise ValueError(message)
            
            media_type = detected_type
            original_size = os.path.getsize(media_file_path)
            
            # POI ID bazlı klasör yapısı
            poi_id_folder = f"poi_{poi_id}"
            media_folder = self.SUPPORTED_FORMATS[media_type]['folder']
            
            poi_dir = self.base_path / "by_poi_id" / poi_id_folder / media_folder
            poi_dir.mkdir(parents=True, exist_ok=True)
            
            # Preview/thumbnail klasörü
            preview_dir = self.previews_path / "by_poi_id" / poi_id_folder / media_folder
            preview_dir.mkdir(parents=True, exist_ok=True)
            
            # Dosya bilgileri
            original_name = Path(media_file_path).name
            file_extension = Path(media_file_path).suffix.lower()
            
            # Benzersiz dosya adı oluştur
            unique_id = str(uuid.uuid4())[:8]
            
            if media_type == 'image':
                # Görseller için WebP dönüşümü
                new_filename = f"{unique_id}.webp"
                target_path = poi_dir / new_filename
                
                # WebP'ye dönüştür
                webp_success = self.convert_to_webp(Path(media_file_path), target_path, quality=90)
                if not webp_success:
                    # WebP dönüşümü başarısızsa, orijinal dosyayı kopyala
                    new_filename = f"{unique_id}{file_extension}"
                    target_path = poi_dir / new_filename
                    shutil.copy2(media_file_path, target_path)
                
                # Thumbnail oluştur
                preview_path = preview_dir / f"thumb_{unique_id}.webp"
                preview_created = self.create_image_thumbnail(target_path, preview_path)
                
            else:
                # Diğer medya türleri için orijinal dosyayı kopyala
                new_filename = f"{unique_id}{file_extension}"
                target_path = poi_dir / new_filename
                shutil.copy2(media_file_path, target_path)
                
                # Medya türüne göre önizleme oluştur
                preview_path = preview_dir / f"preview_{unique_id}.png"
                
                if media_type == 'video':
                    preview_created = self.create_video_thumbnail(target_path, preview_path)
                elif media_type == 'audio':
                    preview_created = self.create_audio_waveform(target_path, preview_path)
                elif media_type == 'model_3d':
                    preview_created = self.create_3d_preview(target_path, preview_path)
                else:
                    preview_created = self.create_placeholder_thumbnail(preview_path, f"📄 {media_type.upper()}")
            
            # Final dosya boyutu
            final_size = os.path.getsize(target_path)
            size_reduction = ((original_size - final_size) / original_size * 100) if original_size > 0 else 0
            
            # Medya bilgilerini döndür
            media_info = {
                'poi_id': poi_id,
                'poi_name': poi_name,
                'category': category,
                'media_type': media_type,
                'path': str(target_path.relative_to(self.base_path.parent)),
                'preview_path': str(preview_path.relative_to(self.base_path.parent)) if preview_created else None,
                'caption': caption,
                'is_primary': is_primary,
                'file_size': final_size,
                'original_size': original_size,
                'original_name': original_name,
                'filename': new_filename,
                'format': Path(new_filename).suffix[1:] if Path(new_filename).suffix else 'unknown',
                'compression_ratio': f"{size_reduction:.1f}%" if size_reduction > 0 else "0%"
            }
            
            print(f"✅ {media_type.upper()} medya eklendi: {poi_name} - {new_filename} ({original_size/1024:.1f}KB → {final_size/1024:.1f}KB)")
            return media_info
            
        except Exception as e:
            print(f"❌ Medya ekleme hatası: {e}")
            return None

    def get_poi_media_by_id(self, poi_id: str, media_type: str = None) -> List[Dict]:
        """POI ID bazlı medya listeleme"""
        poi_id_folder = f"poi_{poi_id}"
        base_poi_dir = self.base_path / "by_poi_id" / poi_id_folder
        base_preview_dir = self.previews_path / "by_poi_id" / poi_id_folder
        
        media_files = []
        
        # Hangi medya türlerini kontrol edeceğini belirle
        types_to_check = [media_type] if media_type else self.SUPPORTED_FORMATS.keys()
        
        for mtype in types_to_check:
            folder_name = self.SUPPORTED_FORMATS[mtype]['folder']
            poi_dir = base_poi_dir / folder_name
            preview_dir = base_preview_dir / folder_name
            
            if poi_dir.exists():
                for media_file in poi_dir.glob('*'):
                    if media_file.is_file():
                        # Preview/thumbnail yolu
                        file_stem = media_file.stem
                        if mtype == 'image':
                            preview_name = f"thumb_{file_stem}.webp"
                        else:
                            preview_name = f"preview_{file_stem}.png"
                        
                        preview_path = preview_dir / preview_name
                        
                        media_files.append({
                            'media_type': mtype,
                            'path': str(media_file.relative_to(self.base_path.parent)),
                            'preview_path': str(preview_path.relative_to(self.base_path.parent)) if preview_path.exists() else None,
                            'filename': media_file.name,
                            'size': os.path.getsize(media_file),
                            'format': media_file.suffix[1:] if media_file.suffix else 'unknown'
                        })
        
        return media_files

    def delete_poi_media_by_id(self, poi_id: str, filename: str) -> bool:
        """POI ID bazlı medya silme"""
        try:
            poi_id_folder = f"poi_{poi_id}"
            base_poi_dir = self.base_path / "by_poi_id" / poi_id_folder
            base_preview_dir = self.previews_path / "by_poi_id" / poi_id_folder
            
            deleted_something = False
            
            # Tüm medya türü klasörlerinde dosyayı ara
            for media_type, config in self.SUPPORTED_FORMATS.items():
                folder_name = config['folder']
                
                # Ana dosya yolu
                media_path = base_poi_dir / folder_name / filename
                
                # Preview yolu
                file_stem = Path(filename).stem
                if media_type == 'image':
                    preview_name = f"thumb_{file_stem}.webp"
                else:
                    preview_name = f"preview_{file_stem}.png"
                
                preview_path = base_preview_dir / folder_name / preview_name
                
                # Ana dosyayı sil
                if media_path.exists() and media_path.is_file():
                    media_path.unlink()
                    print(f"✅ Medya silindi: {media_path}")
                    deleted_something = True
                
                # Preview dosyasını sil
                if preview_path.exists() and preview_path.is_file():
                    preview_path.unlink()
                    print(f"✅ Preview silindi: {preview_path}")
                    deleted_something = True
            
            if not deleted_something:
                print(f"⚠️ Silinecek medya dosyası bulunamadı: {filename}")
                
            return deleted_something
            
        except Exception as e:
            print(f"❌ Medya silme hatası: {e}")
            return False

    def get_media_info(self, file_path: str) -> Dict:
        """Dosya hakkında detaylı bilgi getir"""
        if not os.path.exists(file_path):
            return {'error': 'Dosya bulunamadı'}
        
        file_path = Path(file_path)
        media_type = self.detect_media_type(str(file_path))
        
        info = {
            'filename': file_path.name,
            'size': os.path.getsize(file_path),
            'media_type': media_type,
            'extension': file_path.suffix.lower(),
            'mime_type': mimetypes.guess_type(str(file_path))[0]
        }
        
        # Medya türüne özel bilgiler
        if media_type == 'image':
            try:
                with Image.open(file_path) as img:
                    info.update({
                        'width': img.width,
                        'height': img.height,
                        'mode': img.mode,
                        'format': img.format
                    })
            except Exception as e:
                info['image_error'] = str(e)
        
        return info


# Geriye uyumluluk için POIImageManager takma adı
class POIImageManager(POIMediaManager):
    """Geriye uyumluluk için POIImageManager alias'ı"""
    
    def add_poi_image_by_id(self, poi_id: str, poi_name: str, category: str, image_file_path: str,
                           image_type: str = 'photo', caption: str = '', is_primary: bool = False) -> Optional[Dict]:
        """Eski API ile uyumluluk için wrapper"""
        return self.add_poi_media(poi_id, poi_name, category, image_file_path, 'image', caption, is_primary)
    
    def get_poi_images_by_id(self, poi_id: str) -> List[Dict]:
        """Eski API ile uyumluluk için wrapper"""
        return self.get_poi_media_by_id(poi_id, 'image')
    
    def delete_poi_image_by_id(self, poi_id: str, filename: str) -> bool:
        """Eski API ile uyumluluk için wrapper"""
        return self.delete_poi_media_by_id(poi_id, filename)


# Örnek kullanım
if __name__ == "__main__":
    manager = POIMediaManager()
    
    # Desteklenen formatları yazdır
    print("🎬 Desteklenen Medya Formatları:")
    for media_type, config in manager.SUPPORTED_FORMATS.items():
        print(f"  {media_type.upper()}: {', '.join(config['extensions'])} (Max: {config['max_size']/1024/1024:.0f}MB)") 