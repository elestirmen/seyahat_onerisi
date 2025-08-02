# -*- coding: utf-8 -*-
"""
Yeni POI Kategorilerini Veritabanına Ekleme Scripti
"""

import os
import sys
from poi_database_adapter import POIDatabaseFactory

# Yeni kategoriler ve özellikleri
NEW_CATEGORIES = {
    "dini": {
        "display_name": "🕌 Dini Yapılar",
        "color": "#8B4513",
        "icon": "mosque",
        "description": "Camiler, kiliseler, manastırlar ve diğer dini yapılar"
    },
    "tarihi": {
        "display_name": "🏛️ Tarihi Yapılar", 
        "color": "#CD853F",
        "icon": "landmark",
        "description": "Tümülüsler, nekropol alanları ve antik kalıntılar"
    },
    "mimari": {
        "display_name": "🏗️ Mimari Yapılar",
        "color": "#4682B4", 
        "icon": "building",
        "description": "Çeşmeler, değirmenler, köprüler ve geleneksel yapılar"
    },
    "mezarlik": {
        "display_name": "⚰️ Mezarlık Alanları",
        "color": "#696969",
        "icon": "cross",
        "description": "Tarihi ve modern mezarlık alanları"
    },
    "saray_kale": {
        "display_name": "🏰 Saray ve Kaleler",
        "color": "#B8860B",
        "icon": "chess-rook", 
        "description": "Hanlar, bezirhaneler, kaleler ve savunma yapıları"
    },
    "diger": {
        "display_name": "📍 Diğer",
        "color": "#708090",
        "icon": "map-pin",
        "description": "Peribacaları, tepeler, tüneller ve diğer ilgi çekici noktalar"
    }
}

def add_categories():
    """Yeni kategorileri veritabanına ekle"""
    try:
        # Veritabanı bağlantısı
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        connection_string = os.environ.get('POI_DB_CONNECTION', 'postgresql://poi_user:poi_password@localhost/poi_db')
        database_name = os.environ.get('POI_DB_NAME', 'poi_db')
        
        print(f"🔗 Veritabanına bağlanılıyor: {db_type}")
        
        db = POIDatabaseFactory.create_database(
            db_type,
            connection_string=connection_string,
            database_name=database_name
        )
        db.connect()
        
        print("✅ Veritabanı bağlantısı başarılı")
        
        # Mevcut kategorileri kontrol et
        with db.conn.cursor() as cur:
            cur.execute("SELECT name FROM categories")
            existing_categories = {row[0] for row in cur.fetchall()}
        
        print(f"📋 Mevcut kategoriler: {', '.join(existing_categories)}")
        
        # Yeni kategorileri ekle
        added_count = 0
        skipped_count = 0
        
        for cat_name, cat_info in NEW_CATEGORIES.items():
            if cat_name in existing_categories:
                print(f"⚠️  Zaten mevcut: {cat_name}")
                skipped_count += 1
                continue
            
            try:
                with db.conn.cursor() as cur:
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
                
                print(f"✅ Eklendi: {cat_name} - {cat_info['display_name']}")
                added_count += 1
                
            except Exception as e:
                print(f"❌ Hata ({cat_name}): {e}")
        
        print(f"\n📊 Kategori Ekleme Özeti:")
        print(f"   ✅ Eklenen: {added_count}")
        print(f"   ⚠️  Atlanan: {skipped_count}")
        print(f"   📍 Toplam: {len(NEW_CATEGORIES)}")
        
        # Güncel kategori listesini göster
        with db.conn.cursor() as cur:
            cur.execute("SELECT name, display_name FROM categories ORDER BY name")
            all_categories = cur.fetchall()
        
        print(f"\n📋 Güncel Kategori Listesi:")
        for cat_name, display_name in all_categories:
            print(f"   • {cat_name}: {display_name}")
        
        db.disconnect()
        return True
        
    except Exception as e:
        print(f"❌ Veritabanı hatası: {e}")
        return False

def main():
    print("🚀 Yeni POI Kategorilerini Ekleme Başlıyor...")
    print(f"📍 {len(NEW_CATEGORIES)} yeni kategori eklenecek")
    
    print("\n📋 Eklenecek Kategoriler:")
    for cat_name, cat_info in NEW_CATEGORIES.items():
        print(f"   • {cat_name}: {cat_info['display_name']}")
    
    print("\n" + "="*50)
    
    success = add_categories()
    
    if success:
        print("\n🎉 Kategori ekleme işlemi başarıyla tamamlandı!")
        print("\n💡 Artık POI Manager'da tüm kategorileri görebilirsiniz.")
    else:
        print("\n❌ Kategori ekleme işlemi başarısız oldu.")
        sys.exit(1)

if __name__ == "__main__":
    main()