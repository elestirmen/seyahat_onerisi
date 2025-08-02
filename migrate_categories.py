# -*- coding: utf-8 -*-
"""
Kategori Optimizasyon ve Geçiş Scripti
Mevcut kategorileri dünya standartlarına uygun yeni sisteme geçirir
"""

import os
import sys
from poi_database_adapter import POIDatabaseFactory
import json
from datetime import datetime

# Yeni optimize edilmiş kategori sistemi
NEW_CATEGORIES = {
    "kulturel_miras": {
        "display_name": "🏛️ Kültürel Miras",
        "color": "#8B4513",
        "icon": "landmark",
        "description": "Tarihi yapılar, dini mekanlar, geleneksel mimari ve arkeolojik alanlar"
    },
    "dogal_miras": {
        "display_name": "🌿 Doğal Miras", 
        "color": "#228B22",
        "icon": "mountain",
        "description": "Peribacaları, vadiler, jeolojik oluşumlar ve doğal güzellikler"
    },
    "yasayan_kultur": {
        "display_name": "🎨 Yaşayan Kültür",
        "color": "#9932CC",
        "icon": "palette",
        "description": "Müzeler, galeriler, el sanatları ve kültürel etkinlik alanları"
    },
    "gastronomi": {
        "display_name": "🍽️ Gastronomi",
        "color": "#DC143C",
        "icon": "utensils",
        "description": "Restoranlar, kafeler, yerel lezzetler ve mutfak kültürü"
    },
    "konaklama_hizmet": {
        "display_name": "🏨 Konaklama & Hizmetler",
        "color": "#4169E1",
        "icon": "bed",
        "description": "Oteller, pansiyonlar ve turist hizmetleri"
    },
    "macera_spor": {
        "display_name": "🏃 Macera & Spor",
        "color": "#FF6347",
        "icon": "hiking",
        "description": "Aktif turizm, macera sporları ve outdoor aktiviteler"
    }
}

# Kategori geçiş mapping'i
CATEGORY_MAPPING = {
    # Kültürel Miras'a geçecekler
    "dini": "kulturel_miras",
    "tarihi": "kulturel_miras", 
    "mimari": "kulturel_miras",
    "saray_kale": "kulturel_miras",
    "mezarlik": "kulturel_miras",
    
    # Yaşayan Kültür'e geçecekler
    "kulturel": "yasayan_kultur",
    "sanatsal": "yasayan_kultur",
    
    # Aynı kalacaklar (isim değişikliği ile)
    "gastronomik": "gastronomi",
    "konaklama": "konaklama_hizmet",
    "doga_macera": "macera_spor",
    
    # Özel işlem gerekecek
    "diger": "MANUAL_REVIEW"  # Manuel kontrol gerekiyor
}

# Doğal miras için anahtar kelimeler
NATURAL_KEYWORDS = [
    'peribacası', 'peribaca', 'vadisi', 'tepe', 'dağ', 'tünel', 'yer altı', 
    'fosil', 'höyük', 'ignimbirit', 'jeoloji', 'mağara', 'kayalar'
]

def backup_current_data():
    """Mevcut verilerin yedeğini al"""
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
        
        print("💾 Mevcut verilerin yedeği alınıyor...")
        
        # POI'leri yedekle
        with db.conn.cursor() as cur:
            cur.execute("SELECT * FROM pois ORDER BY id")
            pois = cur.fetchall()
            
            cur.execute("SELECT * FROM categories ORDER BY name")
            categories = cur.fetchall()
        
        # Yedek dosyasına kaydet
        backup_data = {
            "timestamp": datetime.now().isoformat(),
            "pois": [dict(zip([desc[0] for desc in cur.description], poi)) for poi in pois],
            "categories": [dict(zip([desc[0] for desc in cur.description], cat)) for cat in categories]
        }
        
        backup_filename = f"category_migration_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(backup_filename, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2, default=str)
        
        print(f"✅ Yedek alındı: {backup_filename}")
        
        db.disconnect()
        return backup_filename
        
    except Exception as e:
        print(f"❌ Yedek alma hatası: {e}")
        return None

def analyze_diger_category():
    """'Diğer' kategorisindeki POI'leri analiz et"""
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
        
        print("\n🔍 'Diğer' kategorisi analiz ediliyor...")
        
        with db.conn.cursor() as cur:
            cur.execute("SELECT id, name, description FROM pois WHERE category = 'diger' AND is_active = true")
            diger_pois = cur.fetchall()
        
        natural_pois = []
        cultural_pois = []
        service_pois = []
        
        for poi_id, name, description in diger_pois:
            name_lower = name.lower()
            desc_lower = (description or '').lower()
            
            # Doğal miras kontrolü
            is_natural = any(keyword in name_lower or keyword in desc_lower for keyword in NATURAL_KEYWORDS)
            
            if is_natural:
                natural_pois.append((poi_id, name))
            elif any(word in name_lower for word in ['sağlık', 'muhtarlık', 'köy konağı', 'okul']):
                service_pois.append((poi_id, name))
            else:
                cultural_pois.append((poi_id, name))
        
        print(f"\n📊 'Diğer' Kategori Analizi:")
        print(f"   🌿 Doğal Miras'a geçecek: {len(natural_pois)} POI")
        for poi_id, name in natural_pois[:5]:  # İlk 5'ini göster
            print(f"      • {name}")
        if len(natural_pois) > 5:
            print(f"      ... ve {len(natural_pois)-5} tane daha")
            
        print(f"   🏛️ Kültürel Miras'a geçecek: {len(cultural_pois)} POI")
        for poi_id, name in cultural_pois[:5]:
            print(f"      • {name}")
        if len(cultural_pois) > 5:
            print(f"      ... ve {len(cultural_pois)-5} tane daha")
            
        print(f"   🏨 Hizmetler'e geçecek: {len(service_pois)} POI")
        for poi_id, name in service_pois:
            print(f"      • {name}")
        
        db.disconnect()
        return {
            'natural': natural_pois,
            'cultural': cultural_pois,
            'service': service_pois
        }
        
    except Exception as e:
        print(f"❌ Analiz hatası: {e}")
        return None

def add_new_categories():
    """Yeni kategorileri veritabanına ekle"""
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
        
        print("\n➕ Yeni kategoriler ekleniyor...")
        
        added_count = 0
        for cat_name, cat_info in NEW_CATEGORIES.items():
            try:
                with db.conn.cursor() as cur:
                    # Kategori zaten var mı kontrol et
                    cur.execute("SELECT COUNT(*) FROM categories WHERE name = %s", (cat_name,))
                    if cur.fetchone()[0] > 0:
                        print(f"⚠️  Zaten mevcut: {cat_name}")
                        continue
                    
                    # Yeni kategoriyi ekle
                    cur.execute("""
                        INSERT INTO categories (name, display_name, color, icon, description)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (
                        cat_name,
                        cat_info['display_name'],
                        cat_info['color'],
                        cat_info['icon'],
                        cat_info['description']
                    ))
                    db.conn.commit()
                
                print(f"✅ Eklendi: {cat_info['display_name']}")
                added_count += 1
                
            except Exception as e:
                print(f"❌ Hata ({cat_name}): {e}")
        
        print(f"\n📊 {added_count} yeni kategori eklendi")
        
        db.disconnect()
        return True
        
    except Exception as e:
        print(f"❌ Kategori ekleme hatası: {e}")
        return False

def migrate_pois(diger_analysis):
    """POI'leri yeni kategorilere geçir"""
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
        
        print("\n🔄 POI'ler yeni kategorilere geçiriliyor...")
        
        migration_stats = {}
        
        # Normal kategori geçişleri
        for old_cat, new_cat in CATEGORY_MAPPING.items():
            if new_cat == "MANUAL_REVIEW":
                continue  # Diğer kategorisini ayrı işleyeceğiz
                
            with db.conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM pois WHERE category = %s AND is_active = true", (old_cat,))
                count = cur.fetchone()[0]
                
                if count > 0:
                    cur.execute("UPDATE pois SET category = %s WHERE category = %s", (new_cat, old_cat))
                    db.conn.commit()
                    
                    migration_stats[f"{old_cat} → {new_cat}"] = count
                    print(f"✅ {old_cat} → {new_cat}: {count} POI")
        
        # 'Diğer' kategorisini özel işle
        if diger_analysis:
            with db.conn.cursor() as cur:
                # Doğal miras
                for poi_id, name in diger_analysis['natural']:
                    cur.execute("UPDATE pois SET category = %s WHERE id = %s", ("dogal_miras", poi_id))
                
                # Kültürel miras
                for poi_id, name in diger_analysis['cultural']:
                    cur.execute("UPDATE pois SET category = %s WHERE id = %s", ("kulturel_miras", poi_id))
                
                # Hizmetler
                for poi_id, name in diger_analysis['service']:
                    cur.execute("UPDATE pois SET category = %s WHERE id = %s", ("konaklama_hizmet", poi_id))
                
                db.conn.commit()
            
            migration_stats["diger → dogal_miras"] = len(diger_analysis['natural'])
            migration_stats["diger → kulturel_miras"] = len(diger_analysis['cultural'])
            migration_stats["diger → konaklama_hizmet"] = len(diger_analysis['service'])
            
            print(f"✅ diger → dogal_miras: {len(diger_analysis['natural'])} POI")
            print(f"✅ diger → kulturel_miras: {len(diger_analysis['cultural'])} POI")
            print(f"✅ diger → konaklama_hizmet: {len(diger_analysis['service'])} POI")
        
        print(f"\n📊 Geçiş Özeti:")
        total_migrated = sum(migration_stats.values())
        print(f"   📍 Toplam geçirilen POI: {total_migrated}")
        
        db.disconnect()
        return migration_stats
        
    except Exception as e:
        print(f"❌ POI geçiş hatası: {e}")
        return None

def cleanup_old_categories():
    """Eski kategorileri temizle"""
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
        
        print("\n🧹 Eski kategoriler temizleniyor...")
        
        old_categories = list(CATEGORY_MAPPING.keys())
        removed_count = 0
        
        for old_cat in old_categories:
            try:
                with db.conn.cursor() as cur:
                    # Bu kategoride POI var mı kontrol et
                    cur.execute("SELECT COUNT(*) FROM pois WHERE category = %s", (old_cat,))
                    poi_count = cur.fetchone()[0]
                    
                    if poi_count == 0:
                        # Kategoriyi sil
                        cur.execute("DELETE FROM categories WHERE name = %s", (old_cat,))
                        db.conn.commit()
                        
                        print(f"✅ Silindi: {old_cat}")
                        removed_count += 1
                    else:
                        print(f"⚠️  Korundu: {old_cat} ({poi_count} POI hala kullanıyor)")
                        
            except Exception as e:
                print(f"❌ Hata ({old_cat}): {e}")
        
        print(f"\n📊 {removed_count} eski kategori silindi")
        
        db.disconnect()
        return True
        
    except Exception as e:
        print(f"❌ Temizlik hatası: {e}")
        return False

def verify_migration():
    """Geçiş sonucunu doğrula"""
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
        
        print("\n✅ Geçiş sonucu doğrulanıyor...")
        
        with db.conn.cursor() as cur:
            # Yeni kategori dağılımı
            cur.execute("""
                SELECT c.display_name, COUNT(p.id) as poi_count
                FROM categories c
                LEFT JOIN pois p ON c.name = p.category AND p.is_active = true
                GROUP BY c.name, c.display_name
                ORDER BY poi_count DESC
            """)
            new_distribution = cur.fetchall()
            
            # Toplam POI sayısı
            cur.execute("SELECT COUNT(*) FROM pois WHERE is_active = true")
            total_pois = cur.fetchone()[0]
        
        print(f"\n📊 Yeni Kategori Dağılımı:")
        for display_name, count in new_distribution:
            percentage = (count / total_pois * 100) if total_pois > 0 else 0
            print(f"   {display_name}: {count} POI ({percentage:.1f}%)")
        
        print(f"\n📍 Toplam POI: {total_pois}")
        
        db.disconnect()
        return True
        
    except Exception as e:
        print(f"❌ Doğrulama hatası: {e}")
        return False

def main():
    print("🚀 Kategori Optimizasyon Geçişi Başlıyor")
    print("="*50)
    
    # 1. Yedek al
    backup_file = backup_current_data()
    if not backup_file:
        print("❌ Yedek alınamadı, işlem durduruluyor!")
        return False
    
    # 2. 'Diğer' kategorisini analiz et
    diger_analysis = analyze_diger_category()
    if not diger_analysis:
        print("❌ 'Diğer' kategori analizi başarısız!")
        return False
    
    # 3. Yeni kategorileri ekle
    if not add_new_categories():
        print("❌ Yeni kategoriler eklenemedi!")
        return False
    
    # 4. POI'leri geçir
    migration_stats = migrate_pois(diger_analysis)
    if not migration_stats:
        print("❌ POI geçişi başarısız!")
        return False
    
    # 5. Eski kategorileri temizle
    if not cleanup_old_categories():
        print("⚠️  Eski kategori temizliği tamamlanamadı")
    
    # 6. Sonucu doğrula
    if not verify_migration():
        print("⚠️  Doğrulama tamamlanamadı")
    
    print("\n🎉 Kategori optimizasyonu başarıyla tamamlandı!")
    print(f"💾 Yedek dosyası: {backup_file}")
    print("\n💡 Sonraki adımlar:")
    print("   • POI Manager ve Recommendation System'i test edin")
    print("   • Kullanıcı geri bildirimlerini toplayın")
    print("   • Gerekirse ince ayarlar yapın")
    
    return True

if __name__ == "__main__":
    main()