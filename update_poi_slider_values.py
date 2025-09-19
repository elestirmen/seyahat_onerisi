# -*- coding: utf-8 -*-
"""
Gelişmiş POI Slider Değerlerini Güncelleme Scripti

Bu script POI adlarını, açıklamalarını ve kategorilerini analiz ederek
her POI için uygun slider değerlerini akıllı bir şekilde hesaplar (0-100 arası)
"""


import os
import sys
from datetime import datetime
import argparse
import re
import json
from pathlib import Path
from collections import defaultdict

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / 'static' / 'config' / 'poi_slider_config.json'

KEYWORD_MAPPING = {}
CATEGORY_BASE_RATINGS = {}
CURRENT_CONFIG_PATH = DEFAULT_CONFIG_PATH


def load_slider_configuration(config_path=None):
    """Load slider configuration JSON file and return dictionaries."""
    path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    try:
        with path.open('r', encoding='utf-8') as handle:
            data = json.load(handle)
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Slider configuration file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Slider configuration contains invalid JSON: {path}") from exc

    keyword_mapping = data.get('keywordMapping') or {}
    category_base_ratings = data.get('categoryBaseRatings') or {}

    if not isinstance(keyword_mapping, dict) or not isinstance(category_base_ratings, dict):
        raise ValueError(f"Slider configuration has unexpected structure: {path}")

    return keyword_mapping, category_base_ratings, path


def apply_slider_configuration(config_path=None):
    """Apply configuration globally so helper functions can access it."""
    global KEYWORD_MAPPING, CATEGORY_BASE_RATINGS, CURRENT_CONFIG_PATH
    keyword_mapping, category_base_ratings, resolved_path = load_slider_configuration(config_path)
    KEYWORD_MAPPING = keyword_mapping
    CATEGORY_BASE_RATINGS = category_base_ratings
    CURRENT_CONFIG_PATH = resolved_path
    return resolved_path


# Load default configuration at import time
apply_slider_configuration()

SPECIAL_POI_VALUES = {
    "Ürgüp Müzesi": {
        "tarihi": 95,
        "sanat_kultur": 80,
        "doga": 30,
        "eglence": 40,
        "yemek": 20,
        "macera": 10,
        "rahatlatici": 50,
        "spor": 15,
        "alisveris": 25,
        "gece_hayati": 20
    },
    "Ziggy Cafe & Restaurant (Ürgüp)": {
        "yemek": 95,
        "eglence": 80,
        "gece_hayati": 70,
        "rahatlatici": 60,
        "sanat_kultur": 30,
        "alisveris": 40,
        "tarihi": 20,
        "doga": 15,
        "spor": 10,
        "macera": 10
    },
    "Temenni Tepesi (Ürgüp)": {
        "doga": 90,
        "macera": 75,
        "tarihi": 60,
        "rahatlatici": 70,
        "eglence": 45,
        "sanat_kultur": 40,
        "spor": 50,
        "yemek": 20,
        "alisveris": 15,
        "gece_hayati": 25
    },
    "Gorgoli Taş Köprü": {
        "tarihi": 90,
        "doga": 60,
        "sanat_kultur": 50,
        "rahatlatici": 55,
        "eglence": 30,
        "macera": 25,
        "spor": 35,
        "yemek": 15,
        "alisveris": 20,
        "gece_hayati": 15
    },
    "Misafir Manastırı": {
        "tarihi": 95,
        "sanat_kultur": 85,
        "doga": 70,
        "rahatlatici": 60,
        "macera": 40,
        "eglence": 35,
        "yemek": 20,
        "spor": 25,
        "alisveris": 15,
        "gece_hayati": 20
    },
    "Rum Hamamı (Ürgüp)": {
        "tarihi": 85,
        "rahatlatici": 90,
        "sanat_kultur": 60,
        "doga": 30,
        "eglence": 50,
        "yemek": 35,
        "gece_hayati": 40,
        "alisveris": 25,
        "macera": 15,
        "spor": 20
    }
}

def normalize_text(text):
    """Türkçe metni normalize eder"""
    if not text:
        return ""

    # Küçük harfe çevir
    text = text.lower()

    # Türkçe karakter dönüşümleri
    replacements = {
        'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g',
        'ı': 'i', 'I': 'i', 'İ': 'i', 'i': 'i',
        'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's',
        'ü': 'u', 'Ü': 'u'
    }

    for turkish, english in replacements.items():
        text = text.replace(turkish, english)

    return text

def calculate_keyword_score(text, keywords):
    """Metindeki anahtar kelime yoğunluğunu hesaplar"""
    if not text:
        return 0.0

    normalized_text = normalize_text(text)
    words = normalized_text.split()
    total_words = len(words)

    if total_words == 0:
        return 0.0

    # Anahtar kelime eşleşmelerini say
    matches = 0
    for keyword in keywords:
        normalized_keyword = normalize_text(keyword)
        # Tam kelime eşleşmesi
        if normalized_keyword in words:
            matches += 1
        # Kısmi eşleşme (içeren kelimeler)
        elif any(normalized_keyword in word for word in words):
            matches += 0.5

    # Yoğunluk hesapla (0-1 arası)
    density = min(matches / max(total_words * 0.1, 1), 1.0)

    return density

def get_intelligent_ratings(poi_name, category, description="", attributes=None):
    """
    POI için akıllı puanlama algoritması

    Args:
        poi_name (str): POI adı
        category (str): POI kategorisi
        description (str): POI açıklaması

    Returns:
        dict: Slider kategorileri ve hesaplanan değerler
    """

    # Özel POI'ler için özel değerler
    if poi_name in SPECIAL_POI_VALUES:
        return SPECIAL_POI_VALUES[poi_name]

    # Temel kategoriye göre başlangıç değerleri (DB kategorileri için alias desteği)
    CATEGORY_ALIAS = {
        "gastronomik": "gastronomi",
        "kulturel": "kulturel_miras",
        "sanatsal": "yasayan_kultur",
        "doga_macera": "dogal_miras",
        "konaklama": "konaklama_hizmet",
    }

    effective_category = CATEGORY_ALIAS.get(category, category)

    if effective_category in CATEGORY_BASE_RATINGS:
        base_ratings = CATEGORY_BASE_RATINGS[effective_category].copy()
    else:
        # Bilinmeyen kategori için varsayılan değerler
        base_ratings = {
            "doga": 25,
            "yemek": 25,
            "tarihi": 25,
            "eglence": 25,
            "sanat_kultur": 25,
            "macera": 25,
            "rahatlatici": 25,
            "spor": 25,
            "alisveris": 25,
            "gece_hayati": 25
        }

    # Anahtar kelime analizi ile değerleri ayarla
    combined_text = f"{poi_name} {description}"

    for rating_category, config in KEYWORD_MAPPING.items():
        keywords = config["keywords"]
        weight = config["weight"]

        # Anahtar kelime yoğunluğunu hesapla
        keyword_score = calculate_keyword_score(combined_text, keywords)

        # Temel değeri anahtar kelime skoru ile güncelle
        base_value = base_ratings.get(rating_category, 25)

        if keyword_score > 0:
            # Anahtar kelime varsa değeri artır
            new_value = min(100, base_value + (keyword_score * 40))
            base_ratings[rating_category] = int(new_value)
        elif keyword_score == 0 and base_value > 30:
            # Anahtar kelime yoksa yüksek değerleri düşür
            base_ratings[rating_category] = max(10, base_value - 20)

    # Kategoriye özel ek ayarlamalar
    if "müze" in normalize_text(poi_name):
        base_ratings["tarihi"] = min(100, base_ratings["tarihi"] + 20)
        base_ratings["sanat_kultur"] = min(100, base_ratings["sanat_kultur"] + 15)

    if "restoran" in normalize_text(poi_name) or "kafe" in normalize_text(poi_name):
        base_ratings["yemek"] = min(100, base_ratings["yemek"] + 25)
        base_ratings["eglence"] = min(100, base_ratings["eglence"] + 15)

    if "otel" in normalize_text(poi_name) or "pansiyon" in normalize_text(poi_name):
        base_ratings["rahatlatici"] = min(100, base_ratings["rahatlatici"] + 20)
        base_ratings["gece_hayati"] = min(100, base_ratings["gece_hayati"] + 10)

    if "dağ" in normalize_text(poi_name) or "tepe" in normalize_text(poi_name):
        base_ratings["doga"] = min(100, base_ratings["doga"] + 25)
        base_ratings["macera"] = min(100, base_ratings["macera"] + 15)

    # Attribute tabanlı popülerlik ayarı (varsa)
    try:
        attr = attributes or {}
        rating_val = None
        review_count = 0
        if isinstance(attr, dict):
            rating_val = attr.get('rating') or attr.get('score') or None
            review_count = attr.get('review_count') or attr.get('reviews') or 0

        popularity_bonus = 0
        if isinstance(rating_val, (int, float)) and rating_val >= 4.0:
            popularity_bonus += max(0, min(10, (rating_val - 4.0) * 10))
        try:
            import math
            if isinstance(review_count, (int, float)) and review_count > 0:
                popularity_bonus += min(10, math.log10(review_count + 1) * 5)
        except Exception:
            pass

        if popularity_bonus > 0:
            if category == 'gastronomik':
                base_ratings['yemek'] = min(100, int(base_ratings['yemek'] + popularity_bonus))
                base_ratings['eglence'] = min(100, int(base_ratings['eglence'] + popularity_bonus/2))
                base_ratings['gece_hayati'] = min(100, int(base_ratings['gece_hayati'] + popularity_bonus/2))
            elif category == 'kulturel':
                base_ratings['tarihi'] = min(100, int(base_ratings['tarihi'] + popularity_bonus))
                base_ratings['sanat_kultur'] = min(100, int(base_ratings['sanat_kultur'] + popularity_bonus/2))
            elif category == 'doga_macera':
                base_ratings['doga'] = min(100, int(base_ratings['doga'] + popularity_bonus))
                base_ratings['macera'] = min(100, int(base_ratings['macera'] + popularity_bonus/2))
                base_ratings['spor'] = min(100, int(base_ratings['spor'] + popularity_bonus/2))
            elif category == 'sanatsal':
                base_ratings['sanat_kultur'] = min(100, int(base_ratings['sanat_kultur'] + popularity_bonus))
            elif category == 'konaklama':
                base_ratings['rahatlatici'] = min(100, int(base_ratings['rahatlatici'] + popularity_bonus))
                base_ratings['gece_hayati'] = min(100, int(base_ratings['gece_hayati'] + popularity_bonus/2))
                base_ratings['yemek'] = min(100, int(base_ratings['yemek'] + popularity_bonus/3))
    except Exception:
        pass

    # Minimum değer kontrolü (her kategori için en az 5 puan)
    for key in base_ratings:
        base_ratings[key] = max(5, base_ratings[key])

    # Kategori anahtarlarını normalize et (ASCII)
    normalized = {}
    for k, v in base_ratings.items():
        k_norm = k.replace('ı', 'i').replace('İ', 'I')
        normalized[k_norm] = int(v)

    return normalized

# Eski fonksiyon adı için geriye uyumluluk
def get_slider_values_for_poi(poi_name, category, description=""):
    """Eski fonksiyon adı için geriye uyumluluk"""
    return get_intelligent_ratings(poi_name, category, description)

def update_poi_ratings(connection_string, dry_run=False):
    """
    POI rating tablosunu akıllı algoritma ile güncelle

    Args:
        connection_string (str): Veritabanı bağlantı string'i
    """
    try:
        import psycopg2
        from psycopg2.extras import Json
    except ImportError:
        print("❌ psycopg2 kurulu değil. 'pip install psycopg2-binary' komutunu çalıştırın.")
        return False

    try:
        # Veritabanına bağlan
        conn = psycopg2.connect(connection_string)
        cur = conn.cursor()

        print("📊 Veritabanına bağlanıldı")

        # Rating kategorilerini normalize et (ör. 'rahatlatıcı' → 'rahatlatici')
        if not dry_run:
            try:
                cur.execute("""
                    INSERT INTO poi_ratings (poi_id, category, rating)
                    SELECT poi_id, 'rahatlatici', rating
                    FROM poi_ratings
                    WHERE category IN ('rahatlatıcı', 'rahatlat\u0131c\u0131')
                    ON CONFLICT (poi_id, category)
                    DO UPDATE SET rating = EXCLUDED.rating;
                """)
                cur.execute("DELETE FROM poi_ratings WHERE category IN ('rahatlatıcı', 'rahatlat\u0131c\u0131');")
                conn.commit()
                print("🔤 Kategori anahtarları normalize edildi (rahatlatıcı → rahatlatici)")
            except Exception as _e:
                print("⚠️ Kategori normalizasyonu atlandı:", _e)

        # Tüm aktif POI'leri al (ad, kategori ve açıklama ile birlikte)
        cur.execute("""
            SELECT id, name, category,
                   COALESCE(description, '') as description,
                   COALESCE(short_description, '') as short_description,
                   COALESCE(attributes, '{}'::jsonb) as attributes
            FROM pois
            WHERE is_active = true
            ORDER BY name;
        """)
        pois = cur.fetchall()

        print(f"📋 {len(pois)} POI bulundu")

        # Mevcut rating sayılarını kontrol et
        cur.execute("SELECT COUNT(*) FROM poi_ratings;")
        existing_ratings = cur.fetchone()[0]
        print(f"📊 Mevcut {existing_ratings} rating kaydı var")

        updated_count = 0
        improved_ratings = 0

        for poi_id, poi_name, category, description, short_description, attributes in pois:
            # POI için akıllı slider değerlerini hesapla
            combined_description = f"{description} {short_description}".strip()
            slider_values = get_intelligent_ratings(poi_name, category, combined_description, attributes)

            # Her slider kategorisi için rating ekle/güncelle
            for slider_category, value in slider_values.items():
                # Önce mevcut değeri kontrol et
                cur.execute("""
                    SELECT rating FROM poi_ratings
                    WHERE poi_id = %s AND category = %s;
                """, (poi_id, slider_category))

                existing_rating = cur.fetchone()

                if existing_rating:
                    old_value = existing_rating[0]
                    if abs(old_value - value) >= 10:  # 10+ puan fark varsa
                        improved_ratings += 1
                else:
                    improved_ratings += 1

                # Yeni değeri kaydet
                if not dry_run:
                    cur.execute("""
                        INSERT INTO poi_ratings (poi_id, category, rating)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (poi_id, category)
                        DO UPDATE SET rating = EXCLUDED.rating;
                    """, (poi_id, slider_category, value))

            updated_count += 1

            if updated_count % 25 == 0:
                print(f"✅ {updated_count}/{len(pois)} POI güncellendi")

        if not dry_run:
            conn.commit()

        if not dry_run:
            print(f"\n✨ Toplam {updated_count} POI'nin slider değerleri başarıyla güncellendi!")
        else:
            print(f"\n🧪 Dry-run: {updated_count} POI için hesaplama tamamlandı (veritabanı değiştirilmedi)")
        print(f"🔧 {improved_ratings} rating değeri geliştirildi")

        # Güncellenen değerleri göster (örnek olarak 5 POI)
        cur.execute("""
            SELECT p.name, p.category,
                   STRING_AGG(pr.category || ':' || pr.rating, ', ') as ratings
            FROM pois p
            JOIN poi_ratings pr ON p.id = pr.poi_id
            WHERE p.is_active = true
            GROUP BY p.id, p.name, p.category
            ORDER BY p.name
            LIMIT 5;
        """)

        sample_results = cur.fetchall()

        print("\n📊 Güncellenen POI'lerden örnekler:")
        print("=" * 60)
        for poi_name, category, ratings in sample_results:
            print(f"🏛️ {poi_name} ({category})")
            if ratings:
                rating_list = ratings.split(', ')
                for rating in rating_list:
                    if ':' in rating:
                        cat, val = rating.split(':')
                        print(f"   {cat}: {val}/100")
            print()

        # İyileştirme istatistikleri
        print("📈 İyileştirme İstatistikleri:")
        print("-" * 30)

        # En yüksek puan alan POI'ler
        cur.execute("""
            SELECT p.name, AVG(pr.rating) as avg_rating, COUNT(*) as rating_count
            FROM pois p
            JOIN poi_ratings pr ON p.id = pr.poi_id
            WHERE p.is_active = true
            GROUP BY p.id, p.name
            ORDER BY avg_rating DESC
            LIMIT 3;
        """)

        top_pois = cur.fetchall()
        print("🏆 En Yüksek Ortalama Puan Alan POI'ler:")
        for name, avg_rating, count in top_pois:
            print(f"   {name}: {avg_rating:.1f}/100 ({count} kategori)")

        # Kategori dağılımı
        cur.execute("""
            SELECT pr.category, COUNT(*), AVG(pr.rating), MIN(pr.rating), MAX(pr.rating)
            FROM poi_ratings pr
            GROUP BY pr.category
            ORDER BY COUNT(*) DESC;
        """)

        category_stats = cur.fetchall()
        print("\n📊 Kategori Bazlı İstatistikler:")
        for cat, count, avg, min_val, max_val in category_stats:
            print(f"   {cat}: {count} kayıt, Ort: {avg:.1f}, Min: {min_val}, Max: {max_val}")

        cur.close()
        conn.close()

        return True

    except Exception as e:
        print(f"❌ Güncelleme hatası: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Akıllı POI Slider Değerlerini Güncelleme Aracı",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog="""
Örnek kullanım:
  python update_poi_slider_values.py "postgresql://poi_user:poi_password@localhost/poi_db"

Bu script POI'leri analiz ederek:
- POI adlarını ve açıklamalarını inceleyerek anahtar kelime yoğunluklarını hesaplar
- Kategori bazlı temel puanları akıllı algoritmalarla optimize eder
- Özel POI'ler için manuel ayarlamalar yapar
- 10 farklı kategoride (tarihi, sanat_kultur, doga, yemek, eglence, spor, macera, rahatlatici, alisveris, gece_hayati) puanlama yapar

Yeni algoritma özellikleri:
✅ Anahtar kelime analizi (Türkçe karakter desteği ile)
✅ Kategori bazlı akıllı puanlama
✅ Özel POI'ler için manuel optimizasyon
✅ Açıklama metinlerinden anlam çıkarma
✅ Otomatik minimum/maksimum değer kontrolü
        """
    )

    parser.add_argument(
        "connection_string",
        help="Veritabanı bağlantı string'i\nPostgreSQL örnek: postgresql://user:password@localhost/poi_db"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Test modu: Veritabanını değiştirmez, sadece hesaplanan değerleri gösterir"
    )

    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help="Slider konfigürasyon JSON dosyası (varsayılan: %(default)s)"
    )

    args = parser.parse_args()

    try:
        resolved_config = apply_slider_configuration(args.config)
    except (FileNotFoundError, ValueError) as config_error:
        print(f"❌ Konfigürasyon yüklenemedi: {config_error}")
        sys.exit(1)

    print("🚀 Akıllı POI slider değerleri güncelleniyor...")
    print("📊 Algoritma: Anahtar kelime analizi + Kategori optimizasyonu")
    print(f"📁 Kullanılan konfigürasyon: {resolved_config}")
    print("=" * 60)

    success = update_poi_ratings(args.connection_string, dry_run=args.dry_run)

    if success:
        print("\n✅ POI slider değerleri başarıyla güncellendi!")
        print("\n📝 POI'ler artık akıllı puanlama sistemi ile optimize edildi.")
        print("🔍 Öneri sistemi bu yeni değerleri kullanarak daha doğru öneriler verecek.")
    else:
        print("\n❌ Güncelleme başarısız oldu.")
        sys.exit(1)

if __name__ == "__main__":
    main()
