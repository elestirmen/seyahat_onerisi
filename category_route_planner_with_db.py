# -*- coding: utf-8 -*-
import os
import argparse
import folium
from folium import plugins
import osmnx as ox
import networkx as nx
import requests 
import json
import numpy as np
from math import atan2, cos, radians, sin, sqrt
from typing import List, Tuple, Dict, Optional, Any
import traceback 

# POI veritabanı adaptörü
from poi_database_adapter import POIDatabaseFactory, load_poi_data_from_database

# --- Sabitler ve Konfigürasyon ---
URGUP_CENTER_LOCATION = (38.6310, 34.9130)
DEFAULT_ZOOM_URGUP = 13
DEFAULT_GRAPH_FILE_URGUP = "urgup_merkez_walking.graphml"
EARTH_RADIUS_KM = 6371.0
DEFAULT_GRAPH_RADIUS_KM = 10.0

# --- Harita Altlıkları (Tile Layers) ---
TILE_LAYERS = [
    {'name': 'Varsayılan (OpenStreetMap)', 'tiles': 'OpenStreetMap', 'attr': '© OpenStreetMap contributors'},
    {'name': 'Topoğrafik (OpenTopoMap)', 'tiles': 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 'attr': '© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors'},
    {'name': 'Çok Renkli (CartoDB Voyager)', 'tiles': 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager_labels_under/{z}/{x}/{y}.png', 'attr': '© CartoDB © OpenStreetMap contributors'},
    {'name': 'Uydu Görüntüsü (Esri)', 'tiles': 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'attr': '© Esri & Community'},
    {'name': 'Sade Beyaz (CartoDB Positron)', 'tiles': 'CartoDB positron', 'attr': '© CartoDB © OpenStreetMap contributors'},
    {'name': 'Karanlık Mod (CartoDB Dark Matter)', 'tiles': 'CartoDB dark_matter', 'attr': '© CartoDB © OpenStreetMap contributors'}
]

# --- Kategori ve POI Verileri ---
CATEGORY_STYLES = {
    "gastronomik": {"color": "#e74c3c", "gradient": "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)", "icon": "utensils", "icon_prefix": "fa", "display_name": "🍽️ Gastronomik", "description": "Restoranlar, kafeler ve lezzet noktaları", "emoji": "🍽️", "shadow_color": "rgba(231, 76, 60, 0.3)"},
    "kulturel": {"color": "#3498db", "gradient": "linear-gradient(135deg, #3498db 0%, #2980b9 100%)", "icon": "landmark", "icon_prefix": "fa", "display_name": "🏛️ Kültürel", "description": "Müzeler, tarihi yerler ve kültürel mekanlar", "emoji": "🏛️", "shadow_color": "rgba(52, 152, 219, 0.3)"},
    "sanatsal": {"color": "#2ecc71", "gradient": "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)", "icon": "palette", "icon_prefix": "fa", "display_name": "🎨 Sanatsal", "description": "Sanat galerileri, atölyeler ve yaratıcı mekanlar", "emoji": "🎨", "shadow_color": "rgba(46, 204, 113, 0.3)"},
    "doga_macera": {"color": "#f39c12", "gradient": "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)", "icon": "hiking", "icon_prefix": "fa", "display_name": "🌿 Doğa & Macera", "description": "Doğal güzellikler ve macera aktiviteleri", "emoji": "🌿", "shadow_color": "rgba(243, 156, 18, 0.3)"},
    "konaklama": {"color": "#9b59b6", "gradient": "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)", "icon": "bed", "icon_prefix": "fa", "display_name": "🏨 Konaklama", "description": "Oteller, pansiyonlar ve konaklama tesisleri", "emoji": "🏨", "shadow_color": "rgba(155, 89, 182, 0.3)"},
    "default": {"color": "#95a5a6", "gradient": "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)", "icon": "info-circle", "icon_prefix": "fa", "display_name": "ℹ️ Diğer", "description": "Diğer ilgi çekici noktalar", "emoji": "ℹ️", "shadow_color": "rgba(149, 165, 166, 0.3)"}
}

# Varsayılan POI verileri (veritabanı yoksa kullanılacak)
DEFAULT_POI_DATA: Dict[str, Dict[str, Tuple[float, float]]] = {
    "gastronomik": {"Ziggy Cafe & Restaurant (Ürgüp)": (38.633115, 34.907022), "Ehlikeyf Restaurant (Ürgüp)": (38.630610, 34.911284), "Sofra Restaurant (Ürgüp)": (38.63099, 34.91382), "Lagarto Restaurant (Kayakapı Premium Caves - Ürgüp)": (38.631862, 34.907135), "Fırın Express Pide & Kebap (Ürgüp)": (38.63161, 34.91537), "Mahzen Şarap Evi (Ürgüp)": (38.63411, 34.91035), "Apetino Restaurant (Ürgüp)": (38.63231, 34.91345), "Kolcuoğlu Ürgüp (Ürgüp)": (38.63145, 34.91183), "Han Çırağan Restaurant (Ürgüp)": (38.63309, 34.91522), "Ürgüp Pide Salonu (Ürgüp)": (38.63102, 34.91251)},
    "kulturel": {"Ürgüp Müzesi": (38.63222, 34.91148), "Temenni Tepesi (Ürgüp)": (38.63194, 34.91054), "Cappadocia Ebru Art House (Ürgüp)": (38.63161, 34.91537), "Ürgüp Erhan Ayata At Müzesi ve Güzel Atlar Sergisi (Ürgüp)": (38.62985, 34.90882), "Temenni Anıt Mezarı (Ürgüp)": (38.63194, 34.91054), "Rum Hamamı (Ürgüp)": (38.63273, 34.90841)},
    "sanatsal": {"El Sanatları Çarşısı (Ürgüp Cumhuriyet Meydanı)": (38.63145, 34.91183), "Kapadokya Sanat ve El Sanatları Merkezi (Ürgüp)": (38.63102, 34.91251), "Kilim Art Gallery (Ürgüp)": (38.63231, 34.91345)},
    "doga_macera": {"Temenni Hill (Ürgüp)": (38.63194, 34.91054), "Ürgüp ATV Turu Başlangıç Noktası (Ürgüp)": (38.63851, 34.91352), "Üç Güzeller Peribacaları (Ürgüp)": (38.635366, 34.890657), "Vefa Küçük Parkı (Ürgüp)": (38.63161, 34.91537)},
    "konaklama": {"Kayakapı Premium Caves (Ürgüp)": (38.62879, 34.91248), "Yunak Evleri Cappadocia (Ürgüp)": (38.63381, 34.90784), "Esbelli Evi Cave Hotel (Ürgüp)": (38.62985, 34.90882), "Dere Suites Cappadocia (Ürgüp)": (38.63273, 34.90841), "Seraphim Cave Hotel (Ürgüp)": (38.60942, 34.90375), "AJWA Cappadocia (Ürgüp)": (38.63411, 34.91035), "Utopia Cave Cappadocia (Ürgüp)": (38.63583, 34.90562)}
}

# POI verilerini yükle
def load_poi_data(db_config: Optional[Dict[str, str]] = None) -> Dict[str, Dict[str, Tuple[float, float]]]:
    """
    POI verilerini yükle - veritabanından veya varsayılan verilerden
    
    Args:
        db_config: Veritabanı konfigürasyonu (opsiyonel)
    
    Returns:
        POI verileri
    """
    if db_config:
        try:
            print("📊 Veritabanından POI verileri yükleniyor...")
            return load_poi_data_from_database(db_config)
        except Exception as e:
            print(f"⚠️ Veritabanı hatası: {e}")
            print("📋 Varsayılan POI verileri kullanılacak...")
    
    return DEFAULT_POI_DATA

# POI detaylarını görüntülemek için yardımcı fonksiyon
def create_enhanced_poi_popup(poi_name: str, coord: Tuple[float, float], style: Dict, 
                            order_index: Any, db: Optional[Any] = None, 
                            poi_details: Optional[Dict] = None) -> str:
    """
    Gelişmiş POI popup'ı oluştur
    
    Args:
        poi_name: POI adı
        coord: Koordinatlar
        style: Kategori stili
        order_index: Durak sırası
        db: Veritabanı bağlantısı (opsiyonel)
        poi_details: POI detayları (opsiyonel)
    
    Returns:
        HTML popup içeriği
    """
    display_name = style.get("display_name", "").split(" ")[-1]
    gmaps_url = f"https://maps.google.com/?q={coord[0]},{coord[1]}"
    
    # Temel popup
    popup_html = f"""<div style="font-family:'Segoe UI',sans-serif;max-width:400px;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.15);">
    <div style="background:{style.get('gradient',style['color'])};padding:16px;color:white;">
        <h3 style="margin:0 0 8px 0;font-size:18px;">{style.get('emoji','📍')} {poi_name}</h3>
        <p style="margin:0;font-size:13px;opacity:0.95;">{style.get('description','')}</p>
    </div>
    <div style="padding:16px;background:white;">"""
    
    # POI detayları varsa ekle
    if poi_details:
        if poi_details.get('description'):
            popup_html += f"""<div style="margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:8px;">
                <p style="margin:0;font-size:14px;color:#333;">{poi_details['description']}</p>
            </div>"""
        
        # Özellikler
        if poi_details.get('attributes'):
            attrs = poi_details['attributes']
            popup_html += """<div style="margin-bottom:16px;">"""
            
            if attrs.get('opening_hours'):
                popup_html += f"""<div style="margin-bottom:8px;">
                    <i class="fa fa-clock" style="width:20px;color:{style['color']};"></i>
                    <span style="font-size:13px;">Açılış: {attrs['opening_hours']}</span>
                </div>"""
            
            if attrs.get('phone'):
                popup_html += f"""<div style="margin-bottom:8px;">
                    <i class="fa fa-phone" style="width:20px;color:{style['color']};"></i>
                    <span style="font-size:13px;">{attrs['phone']}</span>
                </div>"""
            
            if attrs.get('rating'):
                popup_html += f"""<div style="margin-bottom:8px;">
                    <i class="fa fa-star" style="width:20px;color:#f39c12;"></i>
                    <span style="font-size:13px;">Puan: {attrs['rating']}/5</span>
                </div>"""
            
            popup_html += "</div>"
        
        # Görüntüler
        if poi_details.get('images'):
            popup_html += """<div style="margin-bottom:16px;">
                <h4 style="margin:0 0 8px 0;font-size:14px;color:#666;">Görüntüler</h4>
                <div style="display:flex;gap:8px;overflow-x:auto;">"""
            
            for img in poi_details['images'][:3]:  # İlk 3 görüntü
                if img.get('thumbnail_url') or img.get('url'):
                    img_url = img.get('thumbnail_url', img.get('url'))
                    popup_html += f"""<img src="{img_url}" 
                        style="width:100px;height:75px;object-fit:cover;border-radius:8px;" 
                        alt="{img.get('caption', 'POI görüntüsü')}">"""
            
            popup_html += "</div></div>"
    
    # Temel bilgiler
    popup_html += f"""<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:#f8f9fa;padding:12px;border-radius:8px;text-align:center;border-left:3px solid {style['color']};">
            <div style="font-size:20px;font-weight:700;color:{style['color']};">{order_index}</div>
            <div style="font-size:11px;color:#666;font-weight:600;">DURAK SIRASI</div>
        </div>
        <div style="background:#f8f9fa;padding:12px;border-radius:8px;text-align:center;border-left:3px solid {style['color']};">
            <div style="font-size:14px;font-weight:700;color:#2c3e50;">{display_name}</div>
            <div style="font-size:11px;color:#666;font-weight:600;">KATEGORİ</div>
        </div>
    </div>
    
    <div style="text-align:center;">
        <a href="{gmaps_url}" target="_blank" rel="noopener noreferrer" 
           style="background:{style['color']};color:white;padding:12px 24px;border-radius:25px;
                  text-decoration:none;font-size:13px;font-weight:600;display:inline-flex;
                  align-items:center;justify-content:center;transition:all 0.3s ease;
                  box-shadow:0 4px 15px {style.get('shadow_color','rgba(0,0,0,0.2)')};">
            <i class="fa fa-external-link-alt" style="margin-right:8px;"></i> Google Maps'te Aç
        </a>
    </div>
    </div></div>"""
    
    return popup_html

# Orijinal fonksiyonları import et (haversine_distance, load_road_network, vb.)
# [Buraya mevcut fonksiyonlar gelecek - kısalık için atladım]

# --- Ana Fonksiyon ---
def main(args: argparse.Namespace):
    try:
        print("✨ Kapadokya Gelişmiş Rota Oluşturucu Başlatılıyor ✨")
        
        # Veritabanı konfigürasyonu
        db_config = None
        if args.db_type and args.db_connection:
            db_config = {
                'type': args.db_type,
                'connection_string': args.db_connection
            }
            if args.db_type == 'mongodb' and args.db_name:
                db_config['database_name'] = args.db_name
        
        # POI verilerini yükle
        POI_DATA = load_poi_data(db_config)
        
        # Veritabanı bağlantısı (detaylı bilgi için)
        db = None
        if db_config:
            try:
                db = POIDatabaseFactory.create_database(**db_config)
                db.connect()
            except Exception as e:
                print(f"⚠️ Veritabanı bağlantısı kurulamadı: {e}")
                db = None
        
        categories = [args.category] if args.category and args.category in POI_DATA else list(POI_DATA.keys())
        if args.category and args.category not in POI_DATA: 
            print(f"⚠️ Kategori '{args.category}' bulunamadı. Tümü işleniyor.")

        # [Geri kalan kod aynı kalacak...]
        
        # Cleanup
        if db:
            db.disconnect()

    except Exception:
        print(f"\n💥 KRİTİK HATA: Ana program çalıştırılamadı.")
        traceback.print_exc()

# --- Komut Satırı Argümanları ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="🚶 Ürgüp Merkezli Gelişmiş Yürüyüş Rota Oluşturucu 🗺️\n\n"
                    "Bu araç, varsayılan olarak tüm kategoriler için optimize edilmiş\n"
                    "ve yükseklik profili çıkarılmış rotalar oluşturur.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        "category", 
        nargs="?", 
        choices=list(DEFAULT_POI_DATA.keys()), 
        default=None, 
        help="İşlenecek tek bir POI kategorisi belirtin.\nBelirtilmezse tüm kategoriler işlenir (varsayılan)."
    )
    parser.add_argument("-o", "--output", help="Oluşturulacak HTML harita dosyasının adı.")
    parser.add_argument("-g", "--graphfile", default=DEFAULT_GRAPH_FILE_URGUP, help=f"Yol ağı GraphML dosyası. (Varsayılan: '{DEFAULT_GRAPH_FILE_URGUP}')")
    parser.add_argument("-r", "--radius", type=float, default=DEFAULT_GRAPH_RADIUS_KM, help=f"Yol ağı indirme yarıçapı (km). (Varsayılan: {DEFAULT_GRAPH_RADIUS_KM} km)")
    
    parser.add_argument("--no-optimize", dest="optimize", action="store_false", help="Rota optimizasyonunu (TSP) devre dışı bırakır.")
    parser.add_argument("--no-elevation", dest="elevation", action="store_false", help="Yükseklik profili ve zorluk hesaplamasını devre dışı bırakır.")
    
    parser.add_argument("--start", help='Rotanın başlayacağı POI adını belirtin (örn: "Ürgüp Müzesi").\nBu özellik --no-optimize olmadan daha etkilidir.')
    
    # Veritabanı seçenekleri
    parser.add_argument("--db-type", choices=['postgresql', 'mongodb'], help="Veritabanı tipi")
    parser.add_argument("--db-connection", help="Veritabanı bağlantı string'i")
    parser.add_argument("--db-name", help="MongoDB veritabanı adı (MongoDB için)")

    # Varsayılan olarak optimizasyon ve yükseklik özelliklerini AÇIK yap
    parser.set_defaults(optimize=True, elevation=True)
    
    main(parser.parse_args())