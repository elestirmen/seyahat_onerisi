# -*- coding: utf-8 -*-
"""
Harita katmanları sorununu tamamen çözmek için
sadece OpenStreetMap kullanan basit bir düzeltme
"""

import os

def fix_poi_manager():
    """POI Manager'daki harita katmanlarını basitleştir"""
    
    # POI Manager HTML dosyasını oku
    with open('poi_manager_ui.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Harita başlatma kodunu bul ve değiştir
    old_map_init = '''            // Sadece çalışan OpenStreetMap katmanı (basit çözüm)
            const baseLayers = {
                "🗺️ OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19,
                    subdomains: ['a', 'b', 'c']
                })
            };

            // Basit harita katmanı ekleme (sadece OpenStreetMap)
            const defaultLayer = baseLayers["🗺️ OpenStreetMap"];
            
            // Error handling
            defaultLayer.on('tileerror', function(error) {
                console.error(`❌ Harita yükleme hatası:`, error);
                showToast(`Harita yükleme hatası`, 'error');
            });
            
            defaultLayer.on('load', function() {
                console.log(`✅ Harita yüklendi`);
            });

            // Haritaya ekle
            defaultLayer.addTo(map);'''
    
    new_map_init = '''            // Basit OpenStreetMap katmanı (sorun çözümü)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19
            }).addTo(map);'''
    
    if old_map_init in content:
        content = content.replace(old_map_init, new_map_init)
        print("✅ POI Manager harita katmanları basitleştirildi")
    else:
        print("⚠️ POI Manager'da değiştirilecek kod bulunamadı")
    
    # Dosyayı kaydet
    with open('poi_manager_ui.html', 'w', encoding='utf-8') as f:
        f.write(content)

def fix_poi_recommendation():
    """POI Recommendation System'deki harita katmanlarını basitleştir"""
    
    # POI Recommendation JS dosyasını oku
    with open('static/js/poi_recommendation_system.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Harita başlatma kodunu bul ve değiştir
    old_map_init = '''    // Only use OpenStreetMap (simple solution)
    const baseLayers = {
        "🗺️ OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            subdomains: ['a', 'b', 'c']
        })
    };

    // Add default layer (simple)
    baseLayers["🗺️ OpenStreetMap"].addTo(map);'''
    
    new_map_init = '''    // Simple OpenStreetMap layer (problem fix)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);'''
    
    if old_map_init in content:
        content = content.replace(old_map_init, new_map_init)
        print("✅ POI Recommendation System harita katmanları basitleştirildi")
    else:
        print("⚠️ POI Recommendation System'de değiştirilecek kod bulunamadı")
    
    # Dosyayı kaydet
    with open('static/js/poi_recommendation_system.js', 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    print("🔧 Harita katmanları sorunu düzeltiliyor...")
    print("Sadece OpenStreetMap kullanılacak, diğer katmanlar kaldırılacak")
    
    fix_poi_manager()
    fix_poi_recommendation()
    
    print("\n✅ Düzeltme tamamlandı!")
    print("🚀 API sunucusunu yeniden başlatın ve test edin")
    print("📍 Test sayfası: http://localhost:5505/basic_map_test.html")

if __name__ == "__main__":
    main()