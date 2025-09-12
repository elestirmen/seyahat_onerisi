#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
POI Medya Yönetim Sistemi
Görseller, videolar, ses dosyaları ve 3D modelleri yükler, işler ve veritabanında saklar
"""

import os
import shutil
import json
from PIL import Image, ExifTags
import piexif
import hashlib
from typing import List, Dict, Optional, Tuple, Union
import uuid
from pathlib import Path
import mimetypes
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

class POIMediaManager:
    # Desteklenen medya formatları
    SUPPORTED_FORMATS = {
        'image': {
            'extensions': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
            'mime_types': ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'],
            'max_size': 50 * 1024 * 1024,  # 50MB (panorama için yükseltildi)
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

        # Bağımsız panoramalar için klasörler
        pano_base = self.base_path / "by_panorama"
        pano_imgs = pano_base / "images"
        pano_meta = pano_base / "meta"
        pano_prev = self.previews_path / "by_panorama" / "images"
        pano_base.mkdir(exist_ok=True)
        pano_imgs.mkdir(parents=True, exist_ok=True)
        pano_meta.mkdir(parents=True, exist_ok=True)
        pano_prev.mkdir(parents=True, exist_ok=True)
    
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

    def _get_exif_location(self, image_path: str) -> Tuple[Optional[float], Optional[float]]:
        """Görselden EXIF konum bilgisi çıkar"""
        try:
            with Image.open(image_path) as img:
                exif = img.getexif()
                gps_info = None

                if exif:
                    gps_info = exif.get_ifd(ExifTags.IFD.GPSInfo)

                if not gps_info:
                    exif_bytes = img.info.get("exif")
                    if exif_bytes:
                        try:
                            exif_dict = piexif.load(exif_bytes)
                            gps_info = exif_dict.get("GPS")
                        except Exception as ex:
                            print(f"⚠️ piexif EXIF okuma hatası: {ex}")

                if not gps_info:
                    return None, None

                # Map GPS tag ids to names for broader compatibility
                gps_tags = {
                    ExifTags.GPSTAGS.get(k, k): v for k, v in gps_info.items()
                }

                gps_latitude = gps_tags.get('GPSLatitude')
                gps_lat_ref = gps_tags.get('GPSLatitudeRef')
                gps_longitude = gps_tags.get('GPSLongitude')
                gps_long_ref = gps_tags.get('GPSLongitudeRef')

                if not (gps_latitude and gps_lat_ref and gps_longitude and gps_long_ref):
                    return None, None

                def _to_float(ratio):
                    if isinstance(ratio, tuple):
                        return float(ratio[0]) / float(ratio[1])
                    return float(ratio)


                def _to_degrees(value):
                    d = _to_float(value[0])
                    m = _to_float(value[1])
                    s = _to_float(value[2])
                    return d + (m / 60.0) + (s / 3600.0)

                if isinstance(gps_lat_ref, bytes):
                    gps_lat_ref = gps_lat_ref.decode().upper()
                if isinstance(gps_long_ref, bytes):
                    gps_long_ref = gps_long_ref.decode().upper()

                lat = _to_degrees(gps_latitude)
                if gps_lat_ref in ['S']:
                    lat = -lat

                lng = _to_degrees(gps_longitude)
                if gps_long_ref in ['W']:

                    lng = -lng

                return lat, lng
        except Exception as e:
            print(f"⚠️ EXIF konum bilgisi okunamadı: {e}")
        return None, None
    
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
                exif = img.getexif()
                if exif:
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

    def convert_to_webp(self, input_path: Path, output_path: Path, quality: int = 90,
                        gps_data: Optional[Tuple[float, float]] = None) -> bool:
        """Görseli WebP formatına dönüştür ve mümkünse EXIF'i koru.

        EXIF verisi WebP'e yazılamazsa, GPS bilgisi aynı klasörde JSON olarak saklanır.
        """
        try:
            with Image.open(input_path) as img:
                # EXIF verilerini koru ve döndür
                exif = img.getexif()
                exif_bytes = img.info.get("exif")
                if exif:
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

                # WebP formatında kaydet, EXIF'i eklemeye çalış
                save_kwargs = {'quality': quality, 'optimize': True, 'lossless': False}
                if exif_bytes:
                    save_kwargs['exif'] = exif_bytes
                img.save(output_path, 'WebP', **save_kwargs)

                # Eğer EXIF'te GPS yoksa bilgiyi JSON olarak sakla
                if gps_data:
                    try:
                        with Image.open(output_path) as out_img:
                            out_exif = out_img.getexif()
                            gps_ifd = out_exif.get_ifd(ExifTags.IFD.GPSInfo) if out_exif else None
                            has_gps = bool(gps_ifd)
                    except Exception:
                        has_gps = False
                    if not has_gps:
                        sidecar_path = output_path.with_suffix('.json')
                        with open(sidecar_path, 'w', encoding='utf-8') as f:
                            json.dump({'lat': gps_data[0], 'lng': gps_data[1]}, f)

                return True

        except Exception as e:
            print(f"❌ WebP dönüşüm hatası: {e}")
            return False

    def add_poi_media(self, poi_id: str, poi_name: str, category: str, media_file_path: str,
                      media_type: str = None, caption: str = '', is_primary: bool = False,
                      lat: float = None, lng: float = None) -> Optional[Dict]:
        """POI'ye medya dosyası ekle"""
        try:
            # Dosya doğrulama
            is_valid, message, detected_type = self.validate_file(media_file_path, media_type)
            if not is_valid:
                raise ValueError(message)
            
            media_type = detected_type
            original_size = os.path.getsize(media_file_path)

            # EXIF'ten konum bilgisi çıkar
            if media_type == 'image' and (lat is None or lng is None):
                exif_lat, exif_lng = self._get_exif_location(media_file_path)
                if exif_lat is not None and exif_lng is not None:
                    lat, lng = exif_lat, exif_lng
            
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
                gps = (lat, lng) if lat is not None and lng is not None else None
                webp_success = self.convert_to_webp(Path(media_file_path), target_path, quality=90, gps_data=gps)
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
                'lat': lat,
                'lng': lng,
                'compression_ratio': f"{size_reduction:.1f}%" if size_reduction > 0 else "0%"
            }
            
            print(f"✅ {media_type.upper()} medya eklendi: {poi_name} - {new_filename} ({original_size/1024:.1f}KB → {final_size/1024:.1f}KB)")
            return media_info
            
        except Exception as e:
            print(f"❌ Medya ekleme hatası: {e}")
            return None

    def add_panorama_image(self, image_file_path: str, caption: str = '') -> Optional[Dict]:
        """POI'den bağımsız 360° panorama görselini ekle (EXIF'ten konumu alır)."""
        try:
            # Dosya doğrulama (sadece image kabul)
            is_valid, message, detected_type = self.validate_file(image_file_path, 'image')
            if not is_valid:
                raise ValueError(message)
            if detected_type != 'image':
                raise ValueError("Sadece görsel dosyalar kabul edilir")

            original_size = os.path.getsize(image_file_path)

            # EXIF'ten konum
            lat, lng = self._get_exif_location(image_file_path)

            # Klasörler
            pano_imgs = self.base_path / "by_panorama" / "images"
            pano_prev = self.previews_path / "by_panorama" / "images"
            pano_meta = self.base_path / "by_panorama" / "meta"
            pano_imgs.mkdir(parents=True, exist_ok=True)
            pano_prev.mkdir(parents=True, exist_ok=True)
            pano_meta.mkdir(parents=True, exist_ok=True)

            # Benzersiz id ve dosya adı
            unique_id = str(uuid.uuid4())[:8]
            file_extension = Path(image_file_path).suffix.lower()
            target_path = pano_imgs / f"{unique_id}.webp"

            # WebP'ye dönüştür (EXIF konumu yazar)
            gps = (lat, lng) if lat is not None and lng is not None else None
            webp_success = self.convert_to_webp(Path(image_file_path), target_path, quality=90, gps_data=gps)
            if not webp_success:
                # Orijinal uzantı ile kopyala
                target_path = pano_imgs / f"{unique_id}{file_extension}"
                shutil.copy2(image_file_path, target_path)

            # Thumbnail/preview oluştur
            preview_path = pano_prev / f"thumb_{unique_id}.webp"
            preview_created = self.create_image_thumbnail(target_path, preview_path)

            final_size = os.path.getsize(target_path)
            size_reduction = ((original_size - final_size) / original_size * 100) if original_size > 0 else 0

            # Meta oluştur ve kaydet
            meta = {
                'id': unique_id,
                'media_type': 'image',
                'path': str(target_path.relative_to(self.base_path.parent)),
                'preview_path': str(preview_path.relative_to(self.base_path.parent)) if preview_created else None,
                'filename': target_path.name,
                'format': Path(target_path.name).suffix[1:] if Path(target_path.name).suffix else 'unknown',
                'size': final_size,
                'original_size': original_size,
                'caption': caption,
                'lat': lat,
                'lng': lng,
                'compression_ratio': f"{size_reduction:.1f}%" if size_reduction > 0 else "0%",
                'created_at': datetime.utcnow().isoformat() + 'Z'
            }

            meta_path = pano_meta / f"{unique_id}.json"
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)

            print(f"✅ Panorama eklendi: {target_path} (lat={lat}, lng={lng})")
            return meta
        except Exception as e:
            print(f"❌ Panorama ekleme hatası: {e}")
            return None

    def get_all_panoramas(self) -> List[Dict]:
        """Tüm bağımsız panoramaları meta klasöründen oku."""
        results: List[Dict] = []
        try:
            pano_meta = self.base_path / "by_panorama" / "meta"
            pano_meta.mkdir(parents=True, exist_ok=True)
            for meta_file in pano_meta.glob('*.json'):
                try:
                    with open(meta_file, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                    # Dosyalar mevcut mu kontrol et (opsiyonel)
                    path_rel = meta.get('path')
                    prev_rel = meta.get('preview_path')
                    if path_rel and not (self.base_path.parent / Path(path_rel)).exists():
                        continue
                    if prev_rel and not (self.base_path.parent / Path(prev_rel)).exists():
                        meta['preview_path'] = None
                    results.append(meta)
                except Exception as e:
                    print(f"⚠️ Panorama meta okunamadı: {meta_file} - {e}")
            # Tarihe göre sırala (yeniden eskiye)
            results.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        except Exception as e:
            print(f"❌ Panorama listeleme hatası: {e}")
        return results

    def delete_panorama_by_id(self, pano_id: str) -> bool:
        """Panoramayı id ile sil (dosya, preview ve meta)."""
        try:
            pano_imgs = self.base_path / "by_panorama" / "images"
            pano_prev = self.previews_path / "by_panorama" / "images"
            pano_meta = self.base_path / "by_panorama" / "meta"

            deleted = False
            # Olası uzantılar
            candidates = list(pano_imgs.glob(f"{pano_id}.*"))
            for file in candidates:
                file.unlink(missing_ok=True)
                deleted = True
            # WebP default
            (pano_imgs / f"{pano_id}.webp").unlink(missing_ok=True)
            # Preview
            (pano_prev / f"thumb_{pano_id}.webp").unlink(missing_ok=True)
            # Meta
            (pano_meta / f"{pano_id}.json").unlink(missing_ok=True)
            return deleted
        except Exception as e:
            print(f"❌ Panorama silme hatası: {e}")
            return False

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
                        caption: str = '', is_primary: bool = False,
                        lat: float = None, lng: float = None,
                        requested_media_type: Optional[str] = None) -> Optional[Dict]:
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

            # EXIF verisinden konum bilgisi çıkar
            if media_type == 'image' and (lat is None or lng is None):
                exif_lat, exif_lng = self._get_exif_location(media_file_path)
                if exif_lat is not None and exif_lng is not None:
                    lat, lng = exif_lat, exif_lng
            
            # Rota klasörlerini oluştur (güvenli klasör adı)
            safe_name = (
                route_name
                .replace(' ', '_')
                .replace(':', '_')
                .replace('/', '_')
                .replace('\\', '_')
            )
            # Normalize non-ascii chars conservatively by stripping problematic ones
            safe_name = ''.join(ch if ch.isalnum() or ch in ['_', '-'] else '_' for ch in safe_name)
            route_folder = f"route_{route_id}_{safe_name}"
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
                gps = (lat, lng) if lat is not None and lng is not None else None
                webp_success = self.convert_to_webp(Path(media_file_path), destination_path, quality=90, gps_data=gps)
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
            # Panorama (360°) tespiti: en-boy oranı ≈ 2:1 ve yeterli genişlik
            is_pano = False
            try:
                if media_type == 'image' and destination_path.exists():
                    with Image.open(destination_path) as im:
                        w, h = im.size
                        if h not in (0, None):
                            ratio = float(w) / float(h)
                            if 1.90 <= ratio <= 2.10 and w >= 1000:
                                is_pano = True
            except Exception:
                pass

            # Son medya türü: İstemci panorama seçmişse veya otomatik panorama tespit edildiyse 'panorama'
            final_media_type = media_type
            if (requested_media_type or '').lower() in ('panorama', '360', 'image_360'):
                final_media_type = 'panorama'
            elif media_type == 'image' and is_pano:
                final_media_type = 'panorama'

            media_info = {
                'id': str(uuid.uuid4()),
                'route_id': route_id,
                'file_path': str(destination_path),
                'thumbnail_path': str(thumbnail_path) if thumbnail_path else None,
                'preview_path': str(preview_path) if preview_path else None,
                'filename': safe_filename,
                'original_filename': filename,
                'media_type': final_media_type,
                'file_size': file_size,
                'caption': caption,
                'is_primary': is_primary,
                'lat': lat,
                'lng': lng,
                'uploaded_at': datetime.now().isoformat(),
                'compression_ratio': self._calculate_compression_ratio(media_file_path, destination_path) if media_type == 'image' else "0%",
                'is_pano': is_pano
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
        print(f"🚀 get_route_media called for route_id: {route_id}")
        
        try:
            # Try to get from database first
            try:
                print(f"🔍 Attempting database lookup...")
                
                # Get database connection
                conn_str = os.getenv("POI_DB_CONNECTION")
                if conn_str:
                    print(f"📡 Using connection string: {conn_str[:50]}...")
                    conn = psycopg2.connect(conn_str)
                else:
                    print(f"📡 Using individual environment variables")
                    conn = psycopg2.connect(
                        host=os.getenv("POI_DB_HOST", "127.0.0.1"),
                        port=int(os.getenv("POI_DB_PORT", "5432")),
                        dbname=os.getenv("POI_DB_NAME", "poi_db"),
                        user=os.getenv("POI_DB_USER", "poi_user"),
                        password=os.getenv("POI_DB_PASSWORD", "poi_password"),
                    )
                
                print(f"✅ Database connection established")
                
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
                    print(f"📊 Database query returned {len(db_media)} records")
                    
                    if db_media:
                        print(f"✅ Found media in database, processing...")
                        route_media = []
                        for row in db_media:
                            print(f"  📋 Processing database record: {row}")
                            
                            # Try to find the actual WebP files first
                            original_file_path = Path(row['file_path'])
                            filename = original_file_path.name
                            file_stem = original_file_path.stem
                            
                            print(f"    📁 Original file path: {original_file_path}")
                            print(f"    📁 Filename: {filename}")
                            print(f"    📁 File stem: {file_stem}")
                            
                            # Look for WebP versions in previews and thumbnails
                            route_folder_name = None
                            if "by_route_id" in str(original_file_path):
                                # Extract route folder name from the path
                                path_parts = str(original_file_path).split("by_route_id/")
                                if len(path_parts) > 1:
                                    route_folder_name = path_parts[1].split("/")[0]
                                    print(f"    📁 Route folder name: {route_folder_name}")
                            
                            thumbnail_path = None
                            preview_path = None
                            actual_file_path = None
                            file_size = 0
                            
                            if route_folder_name:
                                # Check for WebP thumbnail
                                thumb_file = self.thumbnails_path / "by_route_id" / route_folder_name / "images" / f"thumb_{file_stem}.webp"
                                print(f"    🔍 Looking for thumbnail: {thumb_file}")
                                if thumb_file.exists():
                                    thumbnail_path = str(thumb_file)
                                    file_size = thumb_file.stat().st_size
                                    print(f"    ✅ Thumbnail found: {thumb_file}")
                                else:
                                    print(f"    ❌ Thumbnail not found: {thumb_file}")
                                
                                # Check for WebP preview
                                preview_file = self.previews_path / "by_route_id" / route_folder_name / "images" / f"preview_{file_stem}.webp"
                                print(f"    🔍 Looking for preview: {preview_file}")
                                if preview_file.exists():
                                    preview_path = str(preview_file)
                                    if not file_size:  # Use preview file size if thumbnail doesn't exist
                                        file_size = preview_file.stat().st_size
                                    print(f"    ✅ Preview found: {preview_file}")
                                else:
                                    print(f"    ❌ Preview not found: {preview_file}")
                                
                                # If we found WebP versions, use them
                                if thumbnail_path or preview_path:
                                    actual_file_path = preview_path or thumbnail_path
                                    print(f"    ✅ Using WebP file: {actual_file_path}")
                                else:
                                    # Fallback to original file path
                                    print(f"    🔍 Checking original file path: {original_file_path}")
                                    if original_file_path.exists():
                                        actual_file_path = str(original_file_path)
                                        file_size = original_file_path.stat().st_size
                                        print(f"    ✅ Original file exists: {actual_file_path}")
                                    else:
                                        print(f"    ❌ Original file not found: {original_file_path}")
                            else:
                                # Fallback to original file path
                                print(f"    🔍 No route folder name, checking original file: {original_file_path}")
                                if original_file_path.exists():
                                    actual_file_path = str(original_file_path)
                                    file_size = original_file_path.stat().st_size
                                    print(f"    ✅ Original file exists: {actual_file_path}")
                                else:
                                    print(f"    ❌ Original file not found: {original_file_path}")
                            
                            # Only add media if we found a valid file
                            if actual_file_path:
                                print(f"    ✅ Adding media with file: {actual_file_path}")
                                # Panorama (360°) tespiti: en-boy oranı ≈ 2:1 ve yeterli genişlik
                                is_pano = False
                                try:
                                    if Path(actual_file_path).exists() and (row['media_type'] == 'photo' or row['media_type'] == 'image' or row['media_type'] is None):
                                        with Image.open(actual_file_path) as im:
                                            w, h = im.size
                                            if h not in (0, None):
                                                ratio = float(w) / float(h)
                                                if 1.90 <= ratio <= 2.10 and w >= 1000:
                                                    is_pano = True
                                except Exception:
                                    pass
                                media_info = {
                                    'id': str(row['id']),
                                    'route_id': row['route_id'],
                                    'file_path': actual_file_path,  # Use the actual found file path
                                    'thumbnail_path': thumbnail_path,
                                    'preview_path': preview_path,
                                    'filename': filename,
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
                                media_info['is_pano'] = is_pano
                                route_media.append(media_info)
                            else:
                                print(f"    ❌ No valid file found for this record")
                        
                        print(f"✅ Returning {len(route_media)} media items from database")
                        
                        # If we found some media from database, but some might be missing files
                        # Let's also check if there are additional WebP files not in the database
                        print(f"🔍 Checking for additional WebP files not in database...")
                        
                        # Get the route folder name from the first record
                        if db_media and len(db_media) > 0:
                            first_record = db_media[0]
                            original_file_path = Path(first_record['file_path'])
                            if "by_route_id" in str(original_file_path):
                                path_parts = str(original_file_path).split("by_route_id/")
                                if len(path_parts) > 1:
                                    route_folder_name = path_parts[1].split("/")[0]
                                    print(f"📁 Checking for additional files in route folder: {route_folder_name}")
                                    
                                    # Look for WebP files in previews and thumbnails that might not be in database
                                    preview_dir = self.previews_path / "by_route_id" / route_folder_name / "images"
                                    thumb_dir = self.thumbnails_path / "by_route_id" / route_folder_name / "images"
                                    
                                    if preview_dir.exists():
                                        for webp_file in preview_dir.glob("*.webp"):
                                            if webp_file.is_file():
                                                # Extract the base filename without 'preview_' prefix
                                                base_filename = webp_file.stem
                                                if base_filename.startswith('preview_'):
                                                    base_filename = base_filename[8:]  # Remove 'preview_' prefix
                                                
                                                # Check if we already have this file in our results
                                                existing_filenames = [m['filename'] for m in route_media]
                                                if f"{base_filename}.webp" not in existing_filenames:
                                                    print(f"    📄 Found additional WebP file: {webp_file.name}")
                                                    
                                                    # Look for corresponding thumbnail
                                                    thumb_file = thumb_dir / f"thumb_{base_filename}.webp"
                                                    thumbnail_path = str(thumb_file) if thumb_file.exists() else None
                                                    
                                                    # Look for corresponding original file
                                                    original_file = self.base_path / "by_route_id" / route_folder_name / "images" / f"{base_filename}.webp"
                                                    original_path = str(original_file) if original_file.exists() else None
                                                    
                                                    media_info = {
                                                        'id': str(uuid.uuid4()),
                                                        'route_id': route_id,
                                                        'file_path': original_path or str(webp_file),
                                                        'thumbnail_path': thumbnail_path,
                                                        'preview_path': str(webp_file),
                                                        'filename': f"{base_filename}.webp",
                                                        'media_type': 'image',
                                                        'file_size': webp_file.stat().st_size,
                                                        'caption': '',
                                                        'is_primary': False,
                                                        'lat': None,  # No GPS data for files not in database
                                                        'lng': None,
                                                        'latitude': None,
                                                        'longitude': None,
                                                        'uploaded_at': datetime.fromtimestamp(webp_file.stat().st_mtime).isoformat()
                                                    }
                                                    route_media.append(media_info)
                                                    print(f"      ✅ Added additional WebP media: {base_filename}.webp")
                        
                        return route_media
                    else:
                        print(f"⚠️ No media found in database, falling back to filesystem...")
                
                finally:
                    if cur:
                        cur.close()
                    if conn:
                        conn.close()
                        
            except Exception as e:
                print(f"⚠️ Database lookup failed: {e}")
                # Fallback to file system if database fails
                pass
            
            # Fallback to file system if database fails or returns no results
            route_media = []
            
            print(f"🔍 Database returned no results, falling back to filesystem...")
            
            # Rota klasörünü bul
            base_route_dir = self.base_path / "by_route_id"
            if not base_route_dir.exists():
                print(f"❌ Base route directory not found: {base_route_dir}")
                return []
            
            print(f"✅ Base route directory found: {base_route_dir}")
            
            # Rota ID'si ile başlayan klasörleri ara
            for route_folder in base_route_dir.iterdir():
                if route_folder.name.startswith(f"route_{route_id}_"):
                    print(f"📂 Found route folder: {route_folder}")
                    
                    # Her medya türü klasöründe dosyaları ara
                    for media_type, config in self.SUPPORTED_FORMATS.items():
                        media_dir = route_folder / config['folder']
                        if media_dir.exists():
                            print(f"📁 Checking {media_type} directory: {media_dir}")
                            for media_file in media_dir.iterdir():
                                if media_file.is_file():
                                    print(f"  📄 Found file: {media_file.name}")
                                    # Thumbnail ve preview yollarını bul
                                    file_stem = media_file.stem
                                    thumb_dir = self.thumbnails_path / "by_route_id" / route_folder.name / config['folder']
                                    preview_dir = self.previews_path / "by_route_id" / route_folder.name / config['folder']
                                    
                                    thumbnail_path = None
                                    preview_path = None
                                    
                                    if media_type == 'image':
                                        # For images, check for WebP thumbnails and previews
                                        thumb_file = thumb_dir / f"thumb_{file_stem}.webp"
                                        if thumb_file.exists():
                                            thumbnail_path = str(thumb_file)
                                            print(f"    ✅ Thumbnail found: {thumb_file}")
                                        preview_file = preview_dir / f"preview_{file_stem}.webp"
                                        if preview_file.exists():
                                            preview_path = str(preview_file)
                                            print(f"    ✅ Preview found: {preview_file}")
                                    else:
                                        # For videos, check for PNG thumbnails and previews
                                        thumb_file = thumb_dir / f"thumb_{file_stem}.png"
                                        if thumb_file.exists():
                                            thumbnail_path = str(thumb_file)
                                            print(f"    ✅ Thumbnail found: {thumb_file}")
                                        preview_file = preview_dir / f"preview_{file_stem}.png"
                                        if preview_file.exists():
                                            preview_path = str(preview_file)
                                            print(f"    ✅ Preview found: {preview_file}")
                                    
                                    # Only add the main media file, not the thumbnail/preview separately
                                    # This prevents duplicates
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
                                        'latitude': None,
                                        'longitude': None,
                                        'uploaded_at': datetime.fromtimestamp(media_file.stat().st_mtime).isoformat()
                                    }
                                    route_media.append(media_info)
                                    print(f"    ✅ Added media: {media_file.name}")
            
            print(f"📊 Total media files found in filesystem: {len(route_media)}")
            
            # If no media found in filesystem, try to find any WebP files in the route's directories
            if not route_media:
                print(f"🔍 No media found in main directories, checking WebP files...")
                for route_folder in base_route_dir.iterdir():
                    if route_folder.name.startswith(f"route_{route_id}_"):
                        print(f"📂 Checking WebP files in route folder: {route_folder}")
                        # Look for WebP files in previews and thumbnails directories
                        preview_dir = self.previews_path / "by_route_id" / route_folder.name / "images"
                        thumb_dir = self.thumbnails_path / "by_route_id" / route_folder.name / "images"
                        
                        print(f"  📁 Preview dir: {preview_dir} (exists: {preview_dir.exists()})")
                        print(f"  📁 Thumbnail dir: {thumb_dir} (exists: {thumb_dir.exists()})")
                        
                        # Only add preview files (not thumbnails) to avoid duplicates
                        if preview_dir.exists():
                            for webp_file in preview_dir.glob("*.webp"):
                                if webp_file.is_file():
                                    print(f"    📄 Found WebP preview: {webp_file.name}")
                                    # Extract the base filename without 'preview_' prefix
                                    base_filename = webp_file.stem
                                    if base_filename.startswith('preview_'):
                                        base_filename = base_filename[8:]  # Remove 'preview_' prefix
                                    
                                    # Look for corresponding thumbnail
                                    thumb_file = thumb_dir / f"thumb_{base_filename}.webp"
                                    thumbnail_path = str(thumb_file) if thumb_file.exists() else None
                                    
                                    if thumbnail_path:
                                        print(f"      ✅ Corresponding thumbnail: {thumb_file}")
                                    
                                    # Panorama (360°) tespiti: en-boy oranı ≈ 2:1 ve yeterli genişlik
                                    is_pano2 = False
                                    try:
                                        if webp_file.exists():
                                            with Image.open(webp_file) as im:
                                                w, h = im.size
                                                if h not in (0, None):
                                                    ratio = float(w) / float(h)
                                                    if 1.90 <= ratio <= 2.10 and w >= 1000:
                                                        is_pano2 = True
                                    except Exception:
                                        pass

                                    media_info = {
                                        'id': str(uuid.uuid4()),
                                        'route_id': route_id,
                                        'file_path': str(webp_file),
                                        'thumbnail_path': thumbnail_path,
                                        'preview_path': str(webp_file),
                                        'filename': f"{base_filename}.webp",  # Use base filename without prefix
                                        'media_type': 'image',
                                        'file_size': webp_file.stat().st_size,
                                        'caption': '',
                                        'is_primary': False,
                                        'lat': None,
                                        'lng': None,
                                        'latitude': None,
                                        'longitude': None,
                                        'uploaded_at': datetime.fromtimestamp(webp_file.stat().st_mtime).isoformat(),
                                        'is_pano': is_pano2
                                    }
                                    route_media.append(media_info)
                                    print(f"      ✅ Added WebP media: {base_filename}.webp")
            
            print(f"📊 Final total media files: {len(route_media)}")
            return route_media
            
        except Exception as e:
            print(f"❌ Error in get_route_media: {e}")
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
            print(f"🔍 Deleting media: route_id={route_id}, filename={filename}")
            
            # Extract the file stem (base name without extension) from the filename
            file_stem = Path(filename).stem
            file_extension = Path(filename).suffix.lower()
            
            print(f"🔍 File stem: {file_stem}, extension: {file_extension}")
            
            # Remove common prefixes to get the actual file identifier
            original_stem = file_stem
            if file_stem.startswith('preview_'):
                file_stem = file_stem[8:]  # Remove 'preview_' prefix
            elif file_stem.startswith('thumb_'):
                file_stem = file_stem[6:]   # Remove 'thumb_' prefix
            
            print(f"🔍 Looking for files with stem: {file_stem} (original: {original_stem})")
            
            # Rota klasörünü bul
            base_route_dir = self.base_path / "by_route_id"
            if not base_route_dir.exists():
                print(f"❌ Base route directory not found: {base_route_dir}")
                return False
            
            # Rota ID'si ile başlayan klasörleri ara
            route_folders = [f for f in base_route_dir.iterdir() if f.name.startswith(f"route_{route_id}_")]
            if not route_folders:
                print(f"❌ No route folders found for route_id={route_id}")
                return False
            
            print(f"📂 Found {len(route_folders)} route folder(s)")
            
            deleted_any = False
            
            for route_folder in route_folders:
                print(f"📂 Processing route folder: {route_folder}")
                
                # Define the paths for all three locations
                preview_dir = self.previews_path / "by_route_id" / route_folder.name / "images"
                thumb_dir = self.thumbnails_path / "by_route_id" / route_folder.name / "images"
                original_dir = route_folder / "images"
                
                # 1. Delete preview file
                if preview_dir.exists():
                    preview_path = preview_dir / f"preview_{file_stem}.webp"
                    if preview_path.exists():
                        preview_path.unlink()
                        print(f"✅ Preview file deleted: {preview_path}")
                        deleted_any = True
                    else:
                        print(f"⚠️ Preview file not found: {preview_path}")
                
                # 2. Delete thumbnail file
                if thumb_dir.exists():
                    thumb_path = thumb_dir / f"thumb_{file_stem}.webp"
                    if thumb_path.exists():
                        thumb_path.unlink()
                        print(f"✅ Thumbnail file deleted: {thumb_path}")
                        deleted_any = True
                    else:
                        print(f"⚠️ Thumbnail file not found: {thumb_path}")
                
                # 3. Delete original file (could be in various formats)
                if original_dir.exists():
                    print(f"🔍 Searching in original directory: {original_dir}")
                    # Look for original files with the same stem
                    for original_file in original_dir.iterdir():
                        if original_file.is_file():
                            original_stem = original_file.stem
                            print(f"🔍 Checking file: {original_file.name} (stem: {original_stem})")
                            
                            # Check if this original file matches our target
                            if (original_stem == file_stem or 
                                original_stem.endswith(file_stem) or
                                file_stem.endswith(original_stem) or
                                (len(original_stem) > 10 and len(file_stem) > 10 and 
                                 (original_stem[-10:] in file_stem or file_stem[-10:] in original_stem)) or
                                # For UUID-based filenames, try to match the core identifier
                                (len(original_stem) > 20 and len(file_stem) > 20 and 
                                 any(part in original_stem for part in file_stem.split('-') if len(part) > 8))):
                                
                                original_file.unlink()
                                print(f"✅ Original file deleted: {original_file}")
                                deleted_any = True
                                break
                
                # 4. Also try to delete from videos folder if it exists
                video_preview_dir = self.previews_path / "by_route_id" / route_folder.name / "videos"
                video_thumb_dir = self.thumbnails_path / "by_route_id" / route_folder.name / "videos"
                video_original_dir = route_folder / "videos"
                
                if video_preview_dir.exists():
                    video_preview_path = video_preview_dir / f"preview_{file_stem}.png"
                    if video_preview_path.exists():
                        video_preview_path.unlink()
                        print(f"✅ Video preview file deleted: {video_preview_path}")
                        deleted_any = True
                
                if video_thumb_dir.exists():
                    video_thumb_path = video_thumb_dir / f"thumb_{file_stem}.png"
                    if video_thumb_path.exists():
                        video_thumb_path.unlink()
                        print(f"✅ Video thumbnail file deleted: {video_thumb_path}")
                        deleted_any = True
                
                if video_original_dir.exists():
                    for video_file in video_original_dir.iterdir():
                        if video_file.is_file():
                            video_stem = video_file.stem
                            if (video_stem == file_stem or 
                                video_stem.endswith(file_stem) or
                                file_stem.endswith(video_stem)):
                                video_file.unlink()
                                print(f"✅ Video original file deleted: {video_file}")
                                deleted_any = True
                                break
                
                # 5. Try to delete from database
                if deleted_any:
                    try:
                        self._delete_from_database(route_id, filename)
                    except Exception as e:
                        print(f"⚠️ Database deletion failed: {e}")
                    
                    return True
            
            print(f"❌ No files found to delete for route_id={route_id}, filename={filename}")
            return False
            
        except Exception as e:
            print(f"❌ Route media deletion error: {e}")
            return False
    
    def _delete_from_database(self, route_id: int, filename: str):
        """Helper method to delete media record from database"""
        try:
            
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
                cur = conn.cursor()
                
                # Delete the media record
                cur.execute("""
                    DELETE FROM route_media 
                    WHERE route_id = %s AND file_path LIKE %s
                """, (route_id, f"%{filename}%"))
                
                conn.commit()
                print(f"✅ Database record deleted for route {route_id}, filename {filename}")
                
            finally:
                if cur:
                    cur.close()
                if conn:
                    conn.close()
                    
        except Exception as e:
            print(f"⚠️ Database deletion error: {e}")
            # Don't raise the exception, just log it

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
            print(f"🔍 Updating location for route_id={route_id}, filename={filename}, lat={lat}, lng={lng}")
            
            # Database connection
            
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
                
                # Check if route exists
                cur.execute("SELECT id FROM public.routes WHERE id=%s", (route_id,))
                if not cur.fetchone():
                    print(f"❌ Route not found: {route_id}")
                    return False
                
                # First, try to find the media record in the database using file_path
                cur.execute("""
                    SELECT id FROM route_media 
                    WHERE route_id = %s AND file_path LIKE %s
                """, (route_id, f"%{filename}"))
                
                existing_record = cur.fetchone()
                
                if existing_record:
                    print(f"✅ Found existing media record, updating location...")
                    # Update the existing record
                    cur.execute("""
                        UPDATE route_media 
                        SET lat = %s, lng = %s 
                        WHERE id = %s
                    """, (lat, lng, existing_record['id']))
                else:
                    print(f"⚠️ Media record not found in database, creating new record...")
                    
                    # Find the actual file path in the filesystem
                    file_path = self._find_media_file_path(route_id, filename)
                    if not file_path:
                        print(f"❌ Media file not found in filesystem: {filename}")
                        return False
                    
                    # Create a new database record (without filename column)
                    cur.execute("""
                        INSERT INTO route_media (route_id, file_path, lat, lng, 
                                               media_type, uploaded_at, caption, is_primary)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        route_id,
                        file_path,
                        lat,
                        lng,
                        'photo',  # Default to photo for images
                        datetime.now(),
                        '',  # Empty caption
                        False  # Not primary
                    ))
                    
                    print(f"✅ Created new media record for {filename}")
                
                # Commit the changes
                conn.commit()
                print(f"✅ Media location updated successfully: route_id={route_id}, filename={filename}, lat={lat}, lng={lng}")
                return True
                
            finally:
                if cur:
                    cur.close()
                if conn:
                    conn.close()

        except Exception as e:
            print(f"❌ Route media location update error: {e}")
            return False

    def auto_set_route_media_location(self, route_id: int, filename: str) -> Optional[Tuple[float, float]]:
        """Extract location from image EXIF and update media record.

        Returns latitude and longitude if successful, otherwise None.
        """
        try:
            file_path = self._find_media_file_path(route_id, filename)
            if not file_path:
                return None

            lat, lng = self._get_exif_location(file_path)
            if lat is None or lng is None:
                return None

            if self.update_route_media_location(route_id, filename, lat, lng):
                return lat, lng
        except Exception as e:
            print(f"⚠️ EXIF konum bilgisi güncellenemedi: {e}")
        return None
    
    def remove_route_media_location(self, route_id: int, filename: str) -> bool:
        """
        Remove location information from route media (set lat/lng to NULL)
        
        Args:
            route_id: Route ID
            filename: Filename to remove location from
            
        Returns:
            True if successful, False otherwise
        """
        try:
            print(f"🔍 Removing location for route_id={route_id}, filename={filename}")
            
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
                
                # Check if route exists
                cur.execute("SELECT id FROM public.routes WHERE id=%s", (route_id,))
                if not cur.fetchone():
                    print(f"❌ Route not found: {route_id}")
                    return False
                
                # Find the media record in the database using file_path
                cur.execute("""
                    SELECT id, media_type FROM route_media 
                    WHERE route_id = %s AND file_path LIKE %s
                """, (route_id, f"%{filename}"))
                
                existing_record = cur.fetchone()
                
                if existing_record:
                    print(f"✅ Found existing media record, removing location...")
                    
                    # Check if this is a photo that requires coordinates
                    if existing_record['media_type'] == 'photo':
                        print(f"⚠️ Photo type requires coordinates, changing to 'promotional' type...")
                        # Update the record to set lat/lng to NULL and change media_type to 'promotional'
                        cur.execute("""
                            UPDATE route_media 
                            SET lat = NULL, lng = NULL, media_type = 'promotional'
                            WHERE id = %s
                        """, (existing_record['id'],))
                    else:
                        # For non-photo types, just set lat/lng to NULL
                        cur.execute("""
                            UPDATE route_media 
                            SET lat = NULL, lng = NULL 
                            WHERE id = %s
                        """, (existing_record['id'],))
                    
                    # Commit the changes
                    conn.commit()
                    print(f"✅ Media location removed successfully: route_id={route_id}, filename={filename}")
                    return True
                else:
                    print(f"❌ Media record not found in database: {filename}")
                    return False
                
            finally:
                if cur:
                    cur.close()
                if conn:
                    conn.close()
                    
        except Exception as e:
            print(f"❌ Route media location removal error: {e}")
            return False
    
    def _find_media_file_path(self, route_id: int, filename: str) -> str:
        """Helper method to find the actual file path in the filesystem"""
        try:
            # Extract the file stem (base name without extension)
            file_stem = Path(filename).stem
            
            # Remove common prefixes to get the actual file identifier
            original_stem = file_stem
            if file_stem.startswith('preview_'):
                original_stem = file_stem[8:]  # Remove 'preview_' prefix
            elif file_stem.startswith('thumb_'):
                original_stem = file_stem[6:]   # Remove 'thumb_' prefix
            
            print(f"🔍 Looking for file: {filename}")
            print(f"  Original stem: {original_stem}")
            print(f"  File stem: {file_stem}")
            
            # Look for the file in the route directory
            base_route_dir = self.base_path / "by_route_id"
            route_dir = None
            
            if base_route_dir.exists():
                # First, try to find the exact route directory
                for route_folder in base_route_dir.iterdir():
                    if route_folder.name.startswith(f"route_{route_id}_"):
                        route_dir = route_folder
                        print(f"✅ Found route folder: {route_folder.name}")
                        break
            
            # Check images directory for original files (if route directory exists)
            if route_dir:
                images_dir = route_dir / "images"
                if images_dir.exists():
                    print(f"🔍 Checking images directory: {images_dir}")
                    # Look for the file with the same stem
                    for media_file in images_dir.iterdir():
                        if media_file.is_file():
                            if original_stem in media_file.stem or media_file.stem in original_stem:
                                print(f"✅ Found original file: {media_file}")
                                return str(media_file)
            
            # Check previews directory (even if main route directory doesn't exist)
            previews_base = self.previews_path / "by_route_id"
            if previews_base.exists():
                print(f"🔍 Checking previews base directory: {previews_base}")
                for preview_route_dir in previews_base.iterdir():
                    if preview_route_dir.name.startswith(f"route_{route_id}_"):
                        print(f"✅ Found preview route folder: {preview_route_dir.name}")
                        preview_dir = preview_route_dir / "images"
                        if preview_dir.exists():
                            print(f"🔍 Checking previews directory: {preview_dir}")
                            # Look for exact preview file match
                            preview_file = preview_dir / f"preview_{original_stem}.webp"
                            if preview_file.exists():
                                print(f"✅ Found preview file: {preview_file}")
                                return str(preview_file)
                            
                            # Also check if the filename itself is a preview
                            preview_file = preview_dir / filename
                            if preview_file.exists():
                                print(f"✅ Found exact preview file: {preview_file}")
                                return str(preview_file)
                            
                            # Check all files in preview directory for partial matches
                            for preview_file in preview_dir.iterdir():
                                if preview_file.is_file() and filename in preview_file.name:
                                    print(f"✅ Found matching preview file: {preview_file}")
                                    return str(preview_file)
                        break
            
            # Check thumbnails directory (even if main route directory doesn't exist)
            thumbs_base = self.thumbnails_path / "by_route_id"
            if thumbs_base.exists():
                print(f"🔍 Checking thumbnails base directory: {thumbs_base}")
                for thumb_route_dir in thumbs_base.iterdir():
                    if thumb_route_dir.name.startswith(f"route_{route_id}_"):
                        print(f"✅ Found thumbnail route folder: {thumb_route_dir.name}")
                        thumb_dir = thumb_route_dir / "images"
                        if thumb_dir.exists():
                            print(f"🔍 Checking thumbnails directory: {thumb_dir}")
                            # Look for exact thumbnail file match
                            thumb_file = thumb_dir / f"thumb_{original_stem}.webp"
                            if thumb_file.exists():
                                print(f"✅ Found thumbnail file: {thumb_file}")
                                return str(thumb_file)
                            
                            # Also check if the filename itself is a thumbnail
                            thumb_file = thumb_dir / filename
                            if thumb_file.exists():
                                print(f"✅ Found exact thumbnail file: {thumb_file}")
                                return str(thumb_file)
                            
                            # Check all files in thumbnail directory for partial matches
                            for thumb_file in thumb_dir.iterdir():
                                if thumb_file.is_file() and filename in thumb_file.name:
                                    print(f"✅ Found matching thumbnail file: {thumb_file}")
                                    return str(thumb_file)
                        break
            
            print(f"❌ No file found for {filename} in route {route_id}")
            return None
            
        except Exception as e:
            print(f"❌ Error finding media file path: {e}")
            return None

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
                           image_type: str = 'photo', caption: str = '', is_primary: bool = False,
                           lat: float = None, lng: float = None) -> Optional[Dict]:
        """Eski API ile uyumluluk için wrapper"""
        return self.add_poi_media(poi_id, poi_name, category, image_file_path, 'image', caption, is_primary, lat, lng)
    
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
