# -*- coding: utf-8 -*-
"""
Mevcut POI'ler için Rating Ekleme Scripti
Bilgi birikimi kullanarak her POI için uygun puanlar verir
"""

import os
import sys
from poi_database_adapter import POIDatabaseFactory

def get_poi_ratings(poi_name, category):
    """POI adı ve kategorisine göre uygun rating'leri hesapla"""
    
    # Temel rating kategorileri
    ratings = {
        'tarihi': 0,
        'sanat_kultur': 0,
        'doga': 0,
        'eglence': 0,
        'alisveris': 0,
        'spor': 0,
        'macera': 0,
        'rahatlatici': 0,
        'yemek': 0,
        'gece_hayati': 0
    }
    
    name_lower = poi_name.lower()
    
    # Kategori bazlı temel puanlar
    if category == 'dini':
        ratings['tarihi'] = 85
        ratings['sanat_kultur'] = 75
        ratings['rahatlatici'] = 80
        
        # Özel durumlar
        if 'manastır' in name_lower or 'keşlik' in name_lower:
            ratings['tarihi'] = 95
            ratings['sanat_kultur'] = 90
        elif 'kilise' in name_lower:
            ratings['tarihi'] = 90
            ratings['sanat_kultur'] = 85
        elif 'cami' in name_lower:
            ratings['tarihi'] = 80
            ratings['sanat_kultur'] = 70
        elif 'türbe' in name_lower:
            ratings['tarihi'] = 85
            ratings['rahatlatici'] = 90
            
    elif category == 'tarihi':
        ratings['tarihi'] = 95
        ratings['sanat_kultur'] = 80
        
        if 'tümülüs' in name_lower:
            ratings['tarihi'] = 95
            ratings['macera'] = 60
        elif 'nekropol' in name_lower:
            ratings['tarihi'] = 90
            ratings['sanat_kultur'] = 85
        elif 'antik' in name_lower or 'roma' in name_lower:
            ratings['tarihi'] = 95
            ratings['sanat_kultur'] = 90
        elif 'harabe' in name_lower:
            ratings['tarihi'] = 85
            ratings['macera'] = 70
            
    elif category == 'mimari':
        ratings['tarihi'] = 70
        ratings['sanat_kultur'] = 65
        
        if 'çeşme' in name_lower:
            ratings['tarihi'] = 75
            ratings['sanat_kultur'] = 60
            ratings['rahatlatici'] = 70
        elif 'değirmen' in name_lower:
            ratings['tarihi'] = 80
            ratings['sanat_kultur'] = 70
        elif 'köprü' in name_lower:
            ratings['tarihi'] = 85
            ratings['sanat_kultur'] = 75
            ratings['macera'] = 50
        elif 'çamaşırhane' in name_lower:
            ratings['tarihi'] = 65
            ratings['sanat_kultur'] = 55
            
    elif category == 'kulturel':
        ratings['sanat_kultur'] = 85
        
        if 'okul' in name_lower or 'ilkokul' in name_lower:
            ratings['tarihi'] = 70
            ratings['sanat_kultur'] = 80
        elif 'kütüphane' in name_lower:
            ratings['sanat_kultur'] = 90
            ratings['rahatlatici'] = 75
        elif 'müze' in name_lower:
            ratings['tarihi'] = 90
            ratings['sanat_kultur'] = 95
            
    elif category == 'mezarlik':
        ratings['tarihi'] = 80
        ratings['rahatlatici'] = 85
        
        if 'tarihi' in name_lower:
            ratings['tarihi'] = 90
            
    elif category == 'saray_kale':
        ratings['tarihi'] = 90
        ratings['sanat_kultur'] = 85
        ratings['macera'] = 70
        
        if 'han' in name_lower:
            ratings['tarihi'] = 95
            ratings['sanat_kultur'] = 90
        elif 'saray' in name_lower:
            ratings['tarihi'] = 95
            ratings['sanat_kultur'] = 95
            ratings['macera'] = 60
        elif 'kale' in name_lower:
            ratings['tarihi'] = 90
            ratings['macera'] = 80
        elif 'bezirhane' in name_lower:
            ratings['tarihi'] = 85
            ratings['sanat_kultur'] = 80
            
    elif category == 'diger':
        if 'peribacası' in name_lower or 'peribaca' in name_lower:
            ratings['doga'] = 95
            ratings['macera'] = 80
            ratings['sanat_kultur'] = 85
        elif 'tepe' in name_lower or 'dağ' in name_lower:
            ratings['doga'] = 90
            ratings['macera'] = 85
            ratings['spor'] = 70
        elif 'tünel' in name_lower:
            ratings['tarihi'] = 80
            ratings['macera'] = 90
        elif 'yer altı' in name_lower:
            ratings['tarihi'] = 95
            ratings['macera'] = 95
            ratings['sanat_kultur'] = 85
        elif 'fosil' in name_lower:
            ratings['tarihi'] = 90
            ratings['sanat_kultur'] = 85
            ratings['macera'] = 70
        elif 'sağlık ocağı' in name_lower:
            ratings['tarihi'] = 60
            ratings['sanat_kultur'] = 50
        elif 'muhtarlık' in name_lower or 'köy konağı' in name_lower:
            ratings['tarihi'] = 65
            ratings['sanat_kultur'] = 60
        elif 'güvercinlik' in name_lower:
            ratings['tarihi'] = 75
            ratings['sanat_kultur'] = 70
            ratings['macera'] = 60
        elif 'höyük' in name_lower:
            ratings['tarihi'] = 90
            ratings['macera'] = 70
        elif 'vadisi' in name_lower:
            ratings['doga'] = 95
            ratings['macera'] = 85
            ratings['rahatlatici'] = 80
        elif 'kral yolu' in name_lower:
            ratings['tarihi'] = 95
            ratings['macera'] = 80
            ratings['sanat_kultur'] = 85
            
    # Özel lokasyon bazlı ayarlamalar
    if 'cemil' in name_lower or 'keşlik' in name_lower:
        # Cemil Köyü özel bir tarihi alan
        ratings['tarihi'] = min(95, ratings['tarihi'] + 10)
        ratings['sanat_kultur'] = min(95, ratings['sanat_kultur'] + 10)
        
    if 'şahinefendi' in name_lower:
        # Şahinefendi Köyü Sobesos antik kenti yakınında
        ratings['tarihi'] = min(95, ratings['tarihi'] + 5)
        
    if 'mustafapaşa' in name_lower:
        # Mustafapaşa tarihi köy
        ratings['tarihi'] = min(95, ratings['tarihi'] + 5)
        ratings['sanat_kultur'] = min(95, ratings['sanat_kultur'] + 5)
        
    # Sıfır olan değerleri temizle (sadece anlamlı puanları göster)
    return {k: v for k, v in ratings.items() if v > 0}

def add_ratings_to_pois():
    """Tüm POI'lere rating ekle"""
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
        
        # Tüm POI'leri getir
        with db.conn.cursor() as cur:
            cur.execute("SELECT id, name, category FROM pois WHERE is_active = true ORDER BY id")
            pois = cur.fetchall()
        
        print(f"📍 {len(pois)} POI için rating hesaplanacak")
        
        updated_count = 0
        skipped_count = 0
        
        for poi_id, poi_name, category in pois:
            try:
                # Mevcut rating'leri kontrol et
                existing_ratings = db.get_poi_ratings(poi_id)
                if existing_ratings and any(v > 0 for v in existing_ratings.values()):
                    print(f"⚠️  Zaten rating var: {poi_name}")
                    skipped_count += 1
                    continue
                
                # Yeni rating'leri hesapla
                new_ratings = get_poi_ratings(poi_name, category)
                
                if new_ratings:
                    # Rating'leri kaydet
                    db.update_poi_ratings(poi_id, new_ratings)
                    
                    # Rating özetini göster
                    rating_summary = ', '.join([f"{k}:{v}" for k, v in new_ratings.items()])
                    print(f"✅ {poi_name} ({category}): {rating_summary}")
                    updated_count += 1
                else:
                    print(f"⚠️  Rating hesaplanamadı: {poi_name}")
                    
            except Exception as e:
                print(f"❌ Hata ({poi_name}): {e}")
        
        print(f"\n📊 Rating Ekleme Özeti:")
        print(f"   ✅ Güncellenen: {updated_count}")
        print(f"   ⚠️  Atlanan: {skipped_count}")
        print(f"   📍 Toplam: {len(pois)}")
        
        db.disconnect()
        return True
        
    except Exception as e:
        print(f"❌ Veritabanı hatası: {e}")
        return False

def main():
    print("🚀 POI Rating Ekleme İşlemi Başlıyor...")
    print("📊 Her POI için bilgi birikimi kullanarak uygun puanlar hesaplanacak")
    
    print("\n📋 Rating Kategorileri:")
    print("   • tarihi: Tarihi önem ve değer")
    print("   • sanat_kultur: Sanatsal ve kültürel değer") 
    print("   • doga: Doğal güzellik ve çevre")
    print("   • eglence: Eğlence ve aktivite değeri")
    print("   • alisveris: Alışveriş olanakları")
    print("   • spor: Spor aktiviteleri")
    print("   • macera: Macera ve heyecan")
    print("   • rahatlatici: Huzur ve dinlendirici")
    print("   • yemek: Gastronomi ve lezzet")
    print("   • gece_hayati: Gece eğlencesi")
    
    print("\n" + "="*60)
    
    success = add_ratings_to_pois()
    
    if success:
        print("\n🎉 POI rating ekleme işlemi başarıyla tamamlandı!")
        print("\n💡 Artık POI Manager'da her POI'nin detaylarında puanları görebilirsiniz.")
    else:
        print("\n❌ POI rating ekleme işlemi başarısız oldu.")
        sys.exit(1)

if __name__ == "__main__":
    main()