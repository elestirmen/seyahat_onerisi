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
from datetime import datetime

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
        """Gerekli klasörleri oluştur - POI ID ve Route ID bazlı yapı"""
        self.base_path.mkdir(exist_ok=True)
        self.thumbnails_path.mkdir(exist_ok=True)
        self.previews_path.mkdir(exist_ok=True)
        
        # POI ID bazlı klasörleri oluştur
        (self.base_path / "by_poi_id").mkdir(exist_ok=True)
        (self.thumbnails_path / "by_poi_id").mkdir(exist_ok=True)
        (self.previews_path / "by_poi_id").mkdir(exist_ok=True)
        
        # Route ID bazlı klasörleri oluştur
        (self.base_path / "by_route_id").mkdir(exist_ok=True)
        (self.thumbnails_path / "by_route_id").mkdir(exist_ok=True)
        (self.previews_path / "by_route_id").mkdir(exist_ok=True)
    
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

    # --- Route Media Management Methods ---
    
    def add_route_media(self, route_id: int, route_name: str, media_file_path: str, 
                        caption: str = '', is_primary: bool = False, lat: float = None, lng: float = None) -> Optional[Dict]:
        """
        Rota için medya dosyası ekle
        
        Args:
            route_id: Rota ID'si
            route_name: Rota adı (klasör oluşturmak için)
            media_file_path: Medya dosyasının yolu
            caption: Medya açıklaması
            is_primary: Ana medya mı?
            lat: Enlem (opsiyonel)
            lng: Boylam (opsiyonel)
            
        Returns:
            Başarılı olursa medya bilgileri, başarısız olursa None
        """
        try:
            if not os.path.exists(media_file_path):
                print(f"❌ Medya dosyası bulunamadı: {media_file_path}")
                return None
            
            # Medya türünü tespit et
            media_type = self.detect_media_type(media_file_path)
            if not media_type:
                print(f"❌ Desteklenmeyen medya formatı: {media_file_path}")
                return None
            
            # Dosya boyutunu kontrol et
            file_size = os.path.getsize(media_file_path)
            max_size = self.SUPPORTED_FORMATS[media_type]['max_size']
            if file_size > max_size:
                print(f"❌ Dosya boyutu çok büyük: {file_size/1024/1024:.1f}MB > {max_size/1024/1024:.0f}MB")
                return None
            
            # Rota klasörlerini oluştur
            route_folder = f"route_{route_id}_{route_name.replace(' ', '_')}"
            base_route_dir = self.base_path / "by_route_id" / route_folder
            base_thumb_dir = self.thumbnails_path / "by_route_id" / route_folder
            base_preview_dir = self.previews_path / "by_route_id" / route_folder
            
            base_route_dir.mkdir(parents=True, exist_ok=True)
            base_thumb_dir.mkdir(parents=True, exist_ok=True)
            base_preview_dir.mkdir(parents=True, exist_ok=True)
            
            # Medya türü klasörünü oluştur
            media_type_folder = self.SUPPORTED_FORMATS[media_type]['folder']
            media_dir = base_route_dir / media_type_folder
            thumb_dir = base_thumb_dir / media_type_folder
            preview_dir = base_preview_dir / media_type_folder
            
            media_dir.mkdir(exist_ok=True)
            thumb_dir.mkdir(exist_ok=True)
            preview_dir.mkdir(exist_ok=True)
            
            # Dosyayı kopyala ve gerekirse WebP'ye dönüştür
            filename = Path(media_file_path).name
            original_extension = Path(filename).suffix.lower()
            
            if media_type == 'image':
                # Görseller için WebP dönüşümü
                unique_id = str(uuid.uuid4())[:8]
                safe_filename = f"{unique_id}.webp"
                destination_path = media_dir / safe_filename
                
                # WebP'ye dönüştür
                webp_success = self.convert_to_webp(Path(media_file_path), destination_path, quality=90)
                if not webp_success:
                    # WebP dönüşümü başarısızsa, orijinal dosyayı kopyala
                    safe_filename = self._generate_safe_filename(filename, media_dir)
                    destination_path = media_dir / safe_filename
                    shutil.copy2(media_file_path, destination_path)
                    print(f"✅ Medya dosyası kopyalandı (WebP dönüşümü başarısız): {destination_path}")
                else:
                    print(f"✅ Medya dosyası WebP'ye dönüştürüldü: {destination_path}")
            else:
                # Diğer medya türleri için orijinal dosyayı kopyala
                safe_filename = self._generate_safe_filename(filename, media_dir)
                destination_path = media_dir / safe_filename
                shutil.copy2(media_file_path, destination_path)
                print(f"✅ Medya dosyası kopyalandı: {destination_path}")
            
            # Thumbnail ve preview oluştur
            thumbnail_path = None
            preview_path = None
            
            if media_type == 'image':
                thumbnail_path = self._create_image_thumbnail(destination_path, thumb_dir)
                preview_path = self._create_image_preview(destination_path, preview_dir)
            elif media_type == 'video':
                thumbnail_path = self._create_video_thumbnail(destination_path, thumb_dir)
                preview_path = self._create_video_preview(destination_path, preview_dir)
            elif media_type == 'audio':
                thumbnail_path = self._create_audio_thumbnail(destination_path, thumb_dir)
                preview_path = self._create_audio_preview(destination_path, preview_dir)
            elif media_type == 'model_3d':
                thumbnail_path = self._create_3d_model_thumbnail(destination_path, thumb_dir)
                preview_path = self._create_3d_model_preview(destination_path, preview_dir)
            
            # Medya bilgilerini döndür
            media_info = {
                'id': str(uuid.uuid4()),
                'route_id': route_id,
                'file_path': str(destination_path),
                'thumbnail_path': str(thumbnail_path) if thumbnail_path else None,
                'preview_path': str(preview_path) if preview_path else None,
                'filename': safe_filename,
                'original_filename': filename,
                'media_type': media_type,
                'file_size': file_size,
                'caption': caption,
                'is_primary': is_primary,
                'lat': lat,
                'lng': lng,
                'uploaded_at': datetime.now().isoformat(),
                'compression_ratio': self._calculate_compression_ratio(media_file_path, destination_path) if media_type == 'image' else "0%"
            }
            
            print(f"✅ Rota medyası başarıyla eklendi: {media_info['filename']}")
            return media_info
            
        except Exception as e:
            print(f"❌ Rota medyası ekleme hatası: {e}")
            return None
    
    def get_route_media(self, route_id: int) -> List[Dict]:
        """
        Rota için tüm medya dosyalarını getir (database'den)
        
        Args:
            route_id: Rota ID'si
            
        Returns:
            Medya dosyalarının listesi
        """
        try:
            # Try to get from database first
            try:
                import psycopg2
                from psycopg2.extras import RealDictCursor
                import os
                
                # Get database connection
                conn_str = os.getenv("POI_DB_CONNECTION")
                if conn_str:
                    conn = psycopg2.connect(conn_str)
                else:
                    conn = psycopg2.connect(
                        host=os.getenv("POI_DB_HOST", "127.0.0.1"),
                        port=int(os.getenv("POI_DB_PORT", "5432")),
                        dbname=os.getenv("POI_DB_NAME", "poi_db"),
                        user=os.getenv("POI_DB_USER", "poi_user"),
                        password=os.getenv("POI_DB_PASSWORD", "poi_password"),
                    )
                
                try:
                    cur = conn.cursor(cursor_factory=RealDictCursor)
                    
                    # Get media from database
                    cur.execute("""
                        SELECT id, route_id, file_path, thumbnail_path, 
                               COALESCE(preview_path, thumbnail_path) as preview_path,
                               lat, lng, caption, is_primary, media_type, uploaded_at
                        FROM route_media 
                        WHERE route_id = %s
                        ORDER BY uploaded_at DESC
                    """, (route_id,))
                    
                    db_media = cur.fetchall()
                    
                    if db_media:
                        route_media = []
                        for row in db_media:
                            # Check if file still exists
                            file_path = Path(row['file_path'])
                            if file_path.exists():
                                # Get file size
                                try:
                                    file_size = file_path.stat().st_size
                                except:
                                    file_size = 0
                                
                                media_info = {
                                    'id': str(row['id']),
                                    'route_id': row['route_id'],
                                    'file_path': row['file_path'],
                                    'thumbnail_path': row['thumbnail_path'],
                                    'preview_path': row['preview_path'],  # Get from database
                                    'filename': file_path.name,
                                    'media_type': 'image' if row['media_type'] == 'photo' else row['media_type'] or 'image',
                                    'file_size': file_size,
                                    'caption': row['caption'] or '',
                                    'is_primary': row['is_primary'] or False,
                                    'lat': row['lat'],
                                    'lng': row['lng'],
                                    'latitude': row['lat'],  # For compatibility
                                    'longitude': row['lng'],  # For compatibility
                                    'uploaded_at': row['uploaded_at'].isoformat() if row['uploaded_at'] else None
                                }
                                route_media.append(media_info)
                        
                        return route_media
                
                finally:
                    if cur:
                        cur.close()
                    if conn:
                        conn.close()
                        
            except Exception as e:
                print(f"⚠️ Database'den medya getirilemedi, dosya sisteminden getiriliyor: {e}")
            
            # Fallback to file system if database fails
            route_media = []
            
            # Rota klasörünü bul
            base_route_dir = self.base_path / "by_route_id"
            if not base_route_dir.exists():
                return []
            
            # Rota ID'si ile başlayan klasörleri ara
            for route_folder in base_route_dir.iterdir():
                if route_folder.name.startswith(f"route_{route_id}_"):
                    # Her medya türü klasöründe dosyaları ara
                    for media_type, config in self.SUPPORTED_FORMATS.items():
                        media_dir = route_folder / config['folder']
                        if media_dir.exists():
                            for media_file in media_dir.iterdir():
                                if media_file.is_file():
                                    # Thumbnail ve preview yollarını bul
                                    file_stem = media_file.stem
                                    thumb_dir = self.thumbnails_path / "by_route_id" / route_folder.name / config['folder']
                                    preview_dir = self.previews_path / "by_route_id" / route_folder.name / config['folder']
                                    
                                    thumbnail_path = None
                                    preview_path = None
                                    
                                    if media_type == 'image':
                                        thumb_file = thumb_dir / f"thumb_{file_stem}.webp"
                                        if thumb_file.exists():
                                            thumbnail_path = str(thumb_file)
                                        preview_file = preview_dir / f"preview_{file_stem}.webp"
                                        if preview_file.exists():
                                            preview_path = str(preview_file)
                                    else:
                                        thumb_file = thumb_dir / f"thumb_{file_stem}.png"
                                        if thumb_file.exists():
                                            thumbnail_path = str(thumb_file)
                                        preview_file = preview_dir / f"preview_{file_stem}.png"
                                        if preview_file.exists():
                                            preview_path = str(preview_file)
                                    
                                    media_info = {
                                        'id': str(uuid.uuid4()),  # Generate new ID for each request
                                        'route_id': route_id,
                                        'file_path': str(media_file),
                                        'thumbnail_path': thumbnail_path,
                                        'preview_path': preview_path,
                                        'filename': media_file.name,
                                        'media_type': media_type,
                                        'file_size': media_file.stat().st_size,
                                        'caption': '',  # Route media doesn't store captions in filename
                                        'is_primary': False,  # Route media doesn't have primary flag
                                        'lat': None,  # Route media doesn't store coordinates
                                        'lng': None,
                                        'uploaded_at': datetime.fromtimestamp(media_file.stat().st_mtime).isoformat()
                                    }
                                    route_media.append(media_info)
            
            return route_media
            
        except Exception as e:
            print(f"❌ Rota medyası getirme hatası: {e}")
            return []
    
    def delete_route_media(self, route_id: int, filename: str) -> bool:
        """
        Rota medyasını sil
        
        Args:
            route_id: Rota ID'si
            filename: Silinecek dosya adı
            
        Returns:
            Başarılı olursa True, başarısız olursa False
        """
        try:
            # Rota klasörünü bul
            base_route_dir = self.base_path / "by_route_id"
            if not base_route_dir.exists():
                return False
            
            # Rota ID'si ile başlayan klasörleri ara
            for route_folder in base_route_dir.iterdir():
                if route_folder.name.startswith(f"route_{route_id}_"):
                    # Her medya türü klasöründe dosyayı ara
                    for media_type, config in self.SUPPORTED_FORMATS.items():
                        media_dir = route_folder / config['folder']
                        media_path = media_dir / filename
                        
                        if media_path.exists():
                            # Dosyayı sil
                            media_path.unlink()
                            print(f"✅ Medya dosyası silindi: {media_path}")
                            
                            # Thumbnail ve preview dosyalarını da sil
                            thumb_dir = self.thumbnails_path / "by_route_id" / route_folder.name / config['folder']
                            preview_dir = self.previews_path / "by_route_id" / route_folder.name / config['folder']
                            
                            thumb_path = thumb_dir / f"thumb_{media_path.stem}.{'webp' if media_type == 'image' else 'png'}"
                            preview_path = preview_dir / f"preview_{media_path.stem}.{'webp' if media_type == 'image' else 'png'}"
                            
                            if thumb_path.exists():
                                thumb_path.unlink()
                                print(f"✅ Thumbnail silindi: {thumb_path}")
                            
                            if preview_path.exists():
                                preview_path.unlink()
                                print(f"✅ Preview silindi: {preview_path}")
                            
                            return True
            
            print(f"❌ Medya dosyası bulunamadı: route_id={route_id}, filename={filename}")
            return False
            
        except Exception as e:
            print(f"❌ Rota medyası silme hatası: {e}")
            return False

    def update_route_media_location(self, route_id: int, filename: str, lat: float, lng: float) -> bool:
        """
        Rota medyasının konum bilgisini güncelle
        
        Args:
            route_id: Rota ID'si
            filename: Güncellenecek dosya adı
            lat: Yeni enlem
            lng: Yeni boylam
            
        Returns:
            Başarılı olursa True, başarısız olursa False
        """
        try:
            # Database connection
            import psycopg2
            from psycopg2.extras import RealDictCursor
            import os
            
            # Get database connection
            conn_str = os.getenv("POI_DB_CONNECTION")
            if conn_str:
                conn = psycopg2.connect(conn_str)
            else:
                conn = psycopg2.connect(
                    host=os.getenv("POI_DB_HOST", "127.0.0.1"),
                    port=int(os.getenv("POI_DB_PORT", "5432")),
                    dbname=os.getenv("POI_DB_NAME", "poi_db"),
                    user=os.getenv("POI_DB_USER", "poi_user"),
                    password=os.getenv("POI_DB_PASSWORD"),
                )
            
            try:
                cur = conn.cursor(cursor_factory=RealDictCursor)
                
                # Check if route exists
                cur.execute("SELECT id FROM public.routes WHERE id=%s", (route_id,))
                if not cur.fetchone():
                    print(f"❌ Rota bulunamadı: {route_id}")
                    return False
                
                # Update the route_media table
                cur.execute("""
                    UPDATE route_media 
                    SET lat = %s, lng = %s 
                    WHERE route_id = %s AND file_path LIKE %s
                """, (lat, lng, route_id, f"%{filename}"))
                
                if cur.rowcount == 0:
                    print(f"❌ Medya kaydı bulunamadı: route_id={route_id}, filename={filename}")
                    return False
                
                # Commit the changes
                conn.commit()
                print(f"✅ Medya konumu güncellendi: route_id={route_id}, filename={filename}, lat={lat}, lng={lng}")
                return True
                
            finally:
                if cur:
                    cur.close()
                if conn:
                    conn.close()
                    
        except Exception as e:
            print(f"❌ Rota medya konumu güncelleme hatası: {e}")
            return False

    def update_route_media_metadata(self, route_id: int, filename: str, **kwargs) -> bool:
        """
        Rota medyasının metadata bilgilerini güncelle
        
        Args:
            route_id: Rota ID'si
            filename: Güncellenecek dosya adı
            **kwargs: Güncellenecek alanlar (lat, lng, caption, is_primary, etc.)
            
        Returns:
            Başarılı olursa True, başarısız olursa False
        """
        try:
            # Database connection
            import psycopg2
            from psycopg2.extras import RealDictCursor
            import os
            
            # Get database connection
            conn_str = os.getenv("POI_DB_CONNECTION")
            if conn_str:
                conn = psycopg2.connect(conn_str)
            else:
                conn = psycopg2.connect(
                    host=os.getenv("POI_DB_HOST", "127.0.0.1"),
                    port=int(os.getenv("POI_DB_PORT", "5432")),
                    dbname=os.getenv("POI_DB_NAME", "poi_db"),
                    user=os.getenv("POI_DB_USER", "poi_user"),
                    password=os.getenv("POI_DB_PASSWORD"),
                )
            
            try:
                cur = conn.cursor(cursor_factory=RealDictCursor)
                
                # Check if route exists
                cur.execute("SELECT id FROM public.routes WHERE id=%s", (route_id,))
                if not cur.fetchone():
                    print(f"❌ Rota bulunamadı: {route_id}")
                    return False
                
                # Build update query dynamically
                update_fields = []
                update_values = []
                
                if 'lat' in kwargs and kwargs['lat'] is not None:
                    update_fields.append("lat = %s")
                    update_values.append(kwargs['lat'])
                
                if 'lng' in kwargs and kwargs['lng'] is not None:
                    update_fields.append("lng = %s")
                    update_values.append(kwargs['lng'])
                
                if 'caption' in kwargs:
                    update_fields.append("caption = %s")
                    update_values.append(kwargs['caption'])
                
                if 'is_primary' in kwargs:
                    update_fields.append("is_primary = %s")
                    update_values.append(kwargs['is_primary'])
                
                if not update_fields:
                    print("❌ Güncellenecek alan bulunamadı")
                    return False
                
                # Add route_id and filename to values
                update_values.extend([route_id, f"%{filename}"])
                
                # Execute update
                query = f"""
                    UPDATE route_media 
                    SET {', '.join(update_fields)}
                    WHERE route_id = %s AND file_path LIKE %s
                """
                
                cur.execute(query, update_values)
                
                if cur.rowcount == 0:
                    print(f"❌ Medya kaydı bulunamadı: route_id={route_id}, filename={filename}")
                    return False
                
                # Commit the changes
                conn.commit()
                print(f"✅ Medya metadata güncellendi: route_id={route_id}, filename={filename}")
                return True
                
            finally:
                if cur:
                    cur.close()
                if conn:
                    conn.close()
                    
        except Exception as e:
            print(f"❌ Rota medya metadata güncelleme hatası: {e}")
            return False

    def _generate_safe_filename(self, filename: str, directory: Path) -> str:
        """Güvenli dosya adı oluştur (çakışma olmaması için)"""
        base_name = Path(filename).stem
        extension = Path(filename).suffix
        counter = 1
        
        new_filename = filename
        while (directory / new_filename).exists():
            new_filename = f"{base_name}_{counter}{extension}"
            counter += 1
        
        return new_filename

    def _create_image_thumbnail(self, image_path: Path, thumb_dir: Path) -> Optional[Path]:
        """Görsel için thumbnail oluştur"""
        try:
            with Image.open(image_path) as img:
                # Thumbnail boyutunu ayarla
                img.thumbnail((200, 200), Image.Resampling.LANCZOS)
                
                # Thumbnail dosya adını oluştur
                thumb_filename = f"thumb_{image_path.stem}.webp"
                thumb_path = thumb_dir / thumb_filename
                
                # WebP formatında kaydet
                img.save(thumb_path, 'WEBP', quality=85, optimize=True)
                print(f"✅ Thumbnail oluşturuldu: {thumb_path}")
                return thumb_path
        except Exception as e:
            print(f"❌ Thumbnail oluşturma hatası: {e}")
            return None

    def _create_image_preview(self, image_path: Path, preview_dir: Path) -> Optional[Path]:
        """Görsel için preview oluştur"""
        try:
            with Image.open(image_path) as img:
                # Preview boyutunu ayarla
                img.thumbnail((800, 600), Image.Resampling.LANCZOS)
                
                # Preview dosya adını oluştur
                preview_filename = f"preview_{image_path.stem}.webp"
                preview_path = preview_dir / preview_filename
                
                # WebP formatında kaydet
                img.save(preview_path, 'WEBP', quality=90, optimize=True)
                print(f"✅ Preview oluşturuldu: {preview_path}")
                return preview_path
        except Exception as e:
            print(f"❌ Preview oluşturma hatası: {e}")
            return None

    def _create_video_thumbnail(self, video_path: Path, thumb_dir: Path) -> Optional[Path]:
        """Video için thumbnail oluştur (basit placeholder)"""
        try:
            # Video thumbnail için basit bir placeholder oluştur
            thumb_filename = f"thumb_{video_path.stem}.png"
            thumb_path = thumb_dir / thumb_filename
            
            # Basit bir placeholder görsel oluştur
            img = Image.new('RGB', (200, 200), color='#2563eb')
            img.save(thumb_path, 'PNG')
            print(f"✅ Video thumbnail oluşturuldu: {thumb_path}")
            return thumb_path
        except Exception as e:
            print(f"❌ Video thumbnail oluşturma hatası: {e}")
            return None

    def _create_video_preview(self, video_path: Path, preview_dir: Path) -> Optional[Path]:
        """Video için preview oluştur (basit placeholder)"""
        try:
            # Video preview için basit bir placeholder oluştur
            preview_filename = f"preview_{video_path.stem}.png"
            preview_path = preview_dir / preview_filename
            
            # Basit bir placeholder görsel oluştur
            img = Image.new('RGB', (800, 600), color='#2563eb')
            img.save(preview_path, 'PNG')
            print(f"✅ Video preview oluşturuldu: {preview_path}")
            return preview_path
        except Exception as e:
            print(f"❌ Video preview oluşturma hatası: {e}")
            return None

    def _create_audio_thumbnail(self, audio_path: Path, thumb_dir: Path) -> Optional[Path]:
        """Ses dosyası için thumbnail oluştur (basit placeholder)"""
        try:
            # Ses dosyası thumbnail için basit bir placeholder oluştur
            thumb_filename = f"thumb_{audio_path.stem}.png"
            thumb_path = thumb_dir / thumb_filename
            
            # Basit bir placeholder görsel oluştur
            img = Image.new('RGB', (200, 200), color='#059669')
            img.save(thumb_path, 'PNG')
            print(f"✅ Ses dosyası thumbnail oluşturuldu: {thumb_path}")
            return thumb_path
        except Exception as e:
            print(f"❌ Ses dosyası thumbnail oluşturma hatası: {e}")
            return None

    def _create_audio_preview(self, audio_path: Path, preview_dir: Path) -> Optional[Path]:
        """Ses dosyası için preview oluştur (basit placeholder)"""
        try:
            # Ses dosyası preview için basit bir placeholder oluştur
            preview_filename = f"preview_{audio_path.stem}.png"
            preview_path = preview_dir / preview_filename
            
            # Basit bir placeholder görsel oluştur
            img = Image.new('RGB', (800, 600), color='#059669')
            img.save(preview_path, 'PNG')
            print(f"✅ Ses dosyası preview oluşturuldu: {preview_path}")
            return preview_path
        except Exception as e:
            print(f"❌ Ses dosyası preview oluşturma hatası: {e}")
            return None

    def _create_3d_model_thumbnail(self, model_path: Path, thumb_dir: Path) -> Optional[Path]:
        """3D model için thumbnail oluştur (basit placeholder)"""
        try:
            # 3D model thumbnail için basit bir placeholder oluştur
            thumb_filename = f"thumb_{model_path.stem}.png"
            thumb_path = thumb_dir / thumb_filename
            
            # Basit bir placeholder görsel oluştur
            img = Image.new('RGB', (200, 200), color='#dc2626')
            img.save(thumb_path, 'PNG')
            print(f"✅ 3D model thumbnail oluşturuldu: {thumb_path}")
            return thumb_path
        except Exception as e:
            print(f"❌ 3D model thumbnail oluşturma hatası: {e}")
            return None

    def _create_3d_model_preview(self, model_path: Path, preview_dir: Path) -> Optional[Path]:
        """3D model için preview oluştur (basit placeholder)"""
        try:
            # 3D model preview için basit bir placeholder oluştur
            preview_filename = f"preview_{model_path.stem}.png"
            preview_path = preview_dir / preview_filename
            
            # Basit bir placeholder görsel oluştur
            img = Image.new('RGB', (800, 600), color='#dc2626')
            img.save(preview_path, 'PNG')
            print(f"✅ 3D model preview oluşturuldu: {preview_path}")
            return preview_path
        except Exception as e:
            print(f"❌ 3D model preview oluşturma hatası: {e}")
            return None

    def _calculate_compression_ratio(self, original_path: Path, converted_path: Path) -> str:
        """Orijinal ve dönüştürülmüş dosya arasındaki sıkıştırma oranını hesapla"""
        try:
            original_size = os.path.getsize(original_path)
            converted_size = os.path.getsize(converted_path)
            
            if original_size > 0:
                reduction = ((original_size - converted_size) / original_size) * 100
                return f"{reduction:.1f}%"
            else:
                return "0%"
        except Exception as e:
            print(f"❌ Sıkıştırma oranı hesaplama hatası: {e}")
            return "0%"


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