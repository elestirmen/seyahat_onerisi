# -*- coding: utf-8 -*-
"""
Kategori Optimizasyon ve Yeniden Yapılandırma Scripti
Dünya standartlarına uygun kategori sistemi önerisi
"""

import os
import sys
from poi_database_adapter import POIDatabaseFactory

# Önerilen yeni kategori sistemi
OPTIMIZED_CATEGORIES = {
    "kulturel_miras": {
        "display_name": "🏛️ Kültürel Miras",
        "color": "#8B4513",
        "icon": "landmark",
        "description": "Tarihi yapılar, dini mekanlar, geleneksel mimari ve arkeolojik alanlar",
        "merge_from": ["dini", "tarihi", "mimari", "saray_kale", "mezarlik"]
    },
    "dogal_miras": {
        "display_name": "🌿 Doğal Miras", 
        "color": "#228B22",
        "icon": "mountain",
        "description": "Peribacaları, vadiler, jeolojik oluşumlar ve doğal güzellikler",
        "merge_from": ["diger"]  # Sadece doğal olanlar
    },
    "yasayan_kultur": {
        "display_name": "🎨 Yaşayan Kültür",
        "color": "#9932CC",
        "icon": "palette",
        "description": "Müzeler, galeriler, el sanatları ve kültürel etkinlik alanları",
        "merge_from": ["kulturel", "sanatsal"]
    },
    "gastronomi": {
        "display_name": "🍽️ Gastronomi",
        "color": "#DC143C",
        "icon": "utensils",
        "description": "Restoranlar, kafeler, yerel lezzetler ve mutfak kültürü",
        "merge_from": ["gastronomik"]
    },
    "konaklama_hizmet": {
        "display_name": "🏨 Konaklama & Hizmetler",
        "color": "#4169E1",
        "icon": "bed",
        "description": "Oteller, pansiyonlar ve turist hizmetleri",
        "merge_from": ["konaklama"]
    },
    "macera_spor": {
        "display_name": "🏃 Macera & Spor",
        "color": "#FF6347",
        "icon": "hiking",
        "description": "Aktif turizm, macera sporları ve outdoor aktiviteler",
        "merge_from": ["doga_macera"]
    }
}

# Doğal miras için özel filtreleme
NATURAL_KEYWORDS = [
    'peribacası', 'peribaca', 'vadisi', 'tepe', 'dağ', 'tünel', 'yer altı', 
    'fosil', 'höyük', 'ignimbirit', 'jeoloji'
]

def analyze_current_categories():
    """Mevcut kategori dağılımını analiz et"""
    try:
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        connection_string = os.environ.get('POI_DB_CONNECTION', 'postgresql://poi_user:poi_password@localhost/poi_db')
        database_name = os.environ.get('POI_DB_NAME', 'poi_db')
        
        db = POIDatabaseFactory.create_database(
            db_type,
            connection_string=connection_string,
            database_name=database_name
        )
        db.connect()
        
        with db.conn.cursor() as cur:
            cur.execute("""
                SELECT category, COUNT(*) as count, 
                       array_agg(name) as poi_names
                FROM pois 
                WHERE is_active = true 
                GROUP BY category 
                ORDER BY count DESC
            """)
            categories = cur.fetchall()
        
        print("📊 Mevcut Kategori Analizi:")
        print("="*60)
        
        total_pois = 0
        for category, count, poi_names in categories:
            total_pois += count
            print(f"\n🏷️  {category}: {count} POI")
            
            # İlk 3 POI örneği göster
            examples = poi_names[:3] if poi_names else []
            for example in examples:
                print(f"   • {example}")
            if len(poi_names) > 3:
                print(f"   ... ve {len(poi_names)-3} tane daha")
        
        print(f"\n📍 TOPLAM: {total_pois} POI")
        
        db.disconnect()
        return categories
        
    except Exception as e:
        print(f"❌ Analiz hatası: {e}")
        return []

def suggest_optimization():
    """Kategori optimizasyon önerisi sun"""
    print("\n" + "="*60)
    print("🎯 ÖNERİLEN KATEGORİ OPTİMİZASYONU")
    print("="*60)
    
    print("\n📋 Yeni Kategori Sistemi (Dünya Standartları):")
    
    for new_cat, info in OPTIMIZED_CATEGORIES.items():
        print(f"\n{info['display_name']}")
        print(f"   📝 Açıklama: {info['description']}")
        print(f"   🎨 Renk: {info['color']}")
        print(f"   📂 Birleştirilecek: {', '.join(info['merge_from'])}")
    
    print(f"\n✨ Avantajlar:")
    print("   • UNESCO ve UNWTO standartlarına uygun")
    print("   • Daha az ama daha anlamlı kategoriler")
    print("   • Uluslararası turizm platformlarıyla uyumlu")
    print("   • Kullanıcı dostu ve anlaşılır")
    print("   • Arama ve filtreleme için optimize")
    
    print(f"\n📊 Kategori Sayısı:")
    print(f"   • Mevcut: 11 kategori")
    print(f"   • Önerilen: 6 kategori")
    print(f"   • Azalma: %45 daha basit sistem")

def create_migration_plan():
    """Kategori geçiş planı oluştur"""
    print("\n" + "="*60)
    print("🔄 KATEGORİ GEÇİŞ PLANI")
    print("="*60)
    
    print("\n1️⃣ Hazırlık Aşaması:")
    print("   • Mevcut POI'lerin yedeklerini al")
    print("   • Yeni kategorileri veritabanına ekle")
    print("   • Geçiş mapping'ini test et")
    
    print("\n2️⃣ Geçiş Aşaması:")
    print("   • POI'leri yeni kategorilere taşı")
    print("   • Özel durumları manuel kontrol et")
    print("   • Test ve doğrulama yap")
    
    print("\n3️⃣ Temizlik Aşaması:")
    print("   • Eski kategorileri sil")
    print("   • UI'ları güncelle")
    print("   • Dokümantasyonu güncelle")
    
    print("\n⚠️  Dikkat Edilecek Noktalar:")
    print("   • 'diger' kategorisindeki POI'ler manuel kontrol edilmeli")
    print("   • Doğal vs kültürel ayrımı dikkatli yapılmalı")
    print("   • Kullanıcı alışkanlıkları göz önünde bulundurulmalı")

def main():
    print("🔍 POI Kategori Optimizasyon Analizi")
    print("Dünya standartlarına uygun kategori sistemi önerisi")
    
    # Mevcut durumu analiz et
    current_categories = analyze_current_categories()
    
    # Optimizasyon önerisi sun
    suggest_optimization()
    
    # Geçiş planı oluştur
    create_migration_plan()
    
    print(f"\n💡 Sonuç:")
    print("Mevcut sisteminiz işlevsel ancak dünya standartlarına uygun")
    print("bir optimizasyon yapılması kullanıcı deneyimini artıracaktır.")
    print("\nBu optimizasyonu uygulamak ister misiniz? (Opsiyonel)")

if __name__ == "__main__":
    main()