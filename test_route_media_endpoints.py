#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test Route Media Endpoints
Rota medya yönetimi endpoint'lerini test etmek için
"""

import requests
import json
import os
from pathlib import Path

# Test configuration
BASE_URL = "http://localhost:5560"
API_BASE = f"{BASE_URL}/api"

def test_route_media_endpoints():
    """Rota medya endpoint'lerini test et"""
    print("🧪 Rota Medya Endpoint Testleri Başlatılıyor...")
    print(f"📍 Test URL: {BASE_URL}")
    print("=" * 60)
    
    # Test 1: Route media upload endpoint
    print("\n1️⃣ Route Media Upload Endpoint Testi")
    print("-" * 40)
    
    test_route_id = "153"  # Test için kullanılan rota ID
    
    # Test dosyası oluştur
    test_image_path = create_test_image()
    
    if test_image_path:
        try:
            # Upload test
            files = {
                'media': ('test_image.jpg', open(test_image_path, 'rb'), 'image/jpeg')
            }
            
            data = {
                'caption': 'Test route media',
                'is_primary': 'false',
                'lat': '38.7312',
                'lng': '34.4547'
            }
            
            response = requests.post(
                f"{API_BASE}/admin/routes/{test_route_id}/media",
                files=files,
                data=data
            )
            
            print(f"📤 Upload Response Status: {response.status_code}")
            print(f"📤 Upload Response: {response.text[:200]}...")
            
            if response.status_code == 201:
                print("✅ Upload endpoint çalışıyor!")
            elif response.status_code == 404:
                print("⚠️ Upload endpoint henüz aktif değil (404)")
            else:
                print(f"❌ Upload endpoint hatası: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Upload test hatası: {e}")
        finally:
            # Test dosyasını temizle
            if os.path.exists(test_image_path):
                os.remove(test_image_path)
    
    # Test 2: Route media get endpoint
    print("\n2️⃣ Route Media Get Endpoint Testi")
    print("-" * 40)
    
    try:
        response = requests.get(f"{API_BASE}/admin/routes/{test_route_id}/media")
        
        print(f"📥 Get Response Status: {response.status_code}")
        print(f"📥 Get Response: {response.text[:200]}...")
        
        if response.status_code == 200:
            print("✅ Get endpoint çalışıyor!")
        elif response.status_code == 404:
            print("⚠️ Get endpoint henüz aktif değil (404)")
        else:
            print(f"❌ Get endpoint hatası: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Get test hatası: {e}")
    
    # Test 3: Route media delete endpoint
    print("\n3️⃣ Route Media Delete Endpoint Testi")
    print("-" * 40)
    
    test_media_id = "test123"
    
    try:
        response = requests.delete(f"{API_BASE}/admin/routes/{test_route_id}/media/{test_media_id}")
        
        print(f"🗑️ Delete Response Status: {response.status_code}")
        print(f"🗑️ Delete Response: {response.text[:200]}...")
        
        if response.status_code == 200:
            print("✅ Delete endpoint çalışıyor!")
        elif response.status_code == 404:
            print("⚠️ Delete endpoint henüz aktif değil (404)")
        else:
            print(f"❌ Delete endpoint hatası: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Delete test hatası: {e}")
    
    print("\n" + "=" * 60)
    print("🏁 Test tamamlandı!")

def create_test_image():
    """Test için basit bir JPEG dosyası oluştur"""
    try:
        from PIL import Image
        
        # 100x100 boyutunda basit bir test görseli oluştur
        img = Image.new('RGB', (100, 100), color='red')
        
        # Test dosyası yolu
        test_path = "test_route_image.jpg"
        
        # JPEG olarak kaydet
        img.save(test_path, 'JPEG', quality=85)
        
        print(f"📸 Test görseli oluşturuldu: {test_path}")
        return test_path
        
    except ImportError:
        print("⚠️ PIL kütüphanesi bulunamadı, test görseli oluşturulamadı")
        return None
    except Exception as e:
        print(f"❌ Test görseli oluşturma hatası: {e}")
        return None

def test_media_manager():
    """Media manager'ın rota medya fonksiyonlarını test et"""
    print("\n🔧 Media Manager Rota Fonksiyonları Testi")
    print("-" * 50)
    
    try:
        from poi_media_manager import POIMediaManager
        
        # Media manager instance'ı oluştur
        manager = POIMediaManager()
        
        # Klasör yapısını kontrol et
        print("📁 Klasör yapısı kontrol ediliyor...")
        
        base_path = Path(manager.base_path)
        route_media_dir = base_path / "by_route_id"
        
        if route_media_dir.exists():
            print(f"✅ Route media klasörü mevcut: {route_media_dir}")
        else:
            print(f"❌ Route media klasörü bulunamadı: {route_media_dir}")
        
        # Test rota ID'si için klasör oluştur
        test_route_dir = route_media_dir / "test123"
        test_route_dir.mkdir(parents=True, exist_ok=True)
        
        if test_route_dir.exists():
            print(f"✅ Test rota klasörü oluşturuldu: {test_route_dir}")
        else:
            print(f"❌ Test rota klasörü oluşturulamadı")
        
        # Test klasörünü temizle
        import shutil
        if test_route_dir.exists():
            shutil.rmtree(test_route_dir)
            print(f"🧹 Test klasörü temizlendi")
        
        print("✅ Media manager rota fonksiyonları test edildi")
        
    except ImportError as e:
        print(f"❌ Media manager import hatası: {e}")
    except Exception as e:
        print(f"❌ Media manager test hatası: {e}")

if __name__ == "__main__":
    print("🚀 Rota Medya Endpoint Testleri")
    print("=" * 60)
    
    # Media manager testi
    test_media_manager()
    
    # Endpoint testleri
    test_route_media_endpoints()
    
    print("\n📋 Test Sonuçları:")
    print("✅ 200: Endpoint çalışıyor")
    print("⚠️ 404: Endpoint henüz aktif değil")
    print("❌ Diğer: Endpoint hatası")
    print("\n💡 404 hatası alıyorsanız, backend'i yeniden başlatın")
