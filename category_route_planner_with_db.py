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
DEFAULT_ZOOM_URGUP = 16
DEFAULT_GRAPH_FILE_URGUP = "urgup_merkez_walking.graphml"
EARTH_RADIUS_KM = 6371.0
DEFAULT_GRAPH_RADIUS_KM = 10.0

# --- Harita Altlıkları (Tile Layers) ---
TILE_LAYERS = [
    {'name': '🗺️ OpenStreetMap (Varsayılan)', 'tiles': 'OpenStreetMap', 'attr': '© OpenStreetMap contributors'},
    {'name': '🛰️ Uydu Görüntüsü (Esri)', 'tiles': 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'attr': '© Esri & Community'},
    {'name': '🏔️ Topografik (OpenTopoMap)', 'tiles': 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 'attr': '© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors'},
    {'name': '🎨 Çok Renkli (CartoDB Voyager)', 'tiles': 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager_labels_under/{z}/{x}/{y}.png', 'attr': '© CartoDB © OpenStreetMap contributors'},
    {'name': '⚪ Sade Beyaz (CartoDB Positron)', 'tiles': 'CartoDB positron', 'attr': '© CartoDB © OpenStreetMap contributors'}
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
    POI verilerini yükle - veritabanından, JSON dosyasından veya varsayılan verilerden
    
    Args:
        db_config: Veritabanı konfigürasyonu (opsiyonel)
    
    Returns:
        POI verileri
    """
    # Önce veritabanından yüklemeyi dene
    if db_config:
        try:
            print("📊 Veritabanından POI verileri yükleniyor...")
            return load_poi_data_from_database(db_config)
        except Exception as e:
            print(f"⚠️ Veritabanı hatası: {e}")
            print("📋 JSON fallback deneniyor...")
    
    # JSON dosyasından yükle
    try:
        json_file_path = 'test_data.json'
        if os.path.exists(json_file_path):
            print(f"📄 JSON dosyasından POI verileri yükleniyor: {json_file_path}")
            with open(json_file_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            
            # JSON formatını eski formata dönüştür
            poi_data = {}
            for category, pois in json_data.items():
                if isinstance(pois, list):
                    poi_data[category] = {}
                    for poi in pois:
                        if poi.get('isActive', True):  # Sadece aktif POI'leri al
                            name = poi.get('name', '')
                            lat = poi.get('latitude', 0)
                            lon = poi.get('longitude', 0)
                            poi_data[category][name] = (lat, lon)
                else:
                    # Eski format (name: coordinates dict)
                    poi_data[category] = pois
            
            print(f"✅ JSON'dan {sum(len(cat_pois) for cat_pois in poi_data.values())} POI yüklendi")
            return poi_data
            
    except Exception as e:
        print(f"⚠️ JSON dosyası okuma hatası: {e}")
    
    print("📋 Varsayılan POI verileri kullanılacak...")
    return DEFAULT_POI_DATA

# POI detaylarını görüntülemek için yardımcı fonksiyon
def create_enhanced_poi_popup(poi_name: str, coord: Tuple[float, float], style: Dict, 
                            order_index: Any, db: Optional[Any] = None, 
                            poi_details: Optional[Dict] = None) -> str:
    """
    Gelişmiş POI popup'ı oluştur - Görsel desteği ile
    
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
    
    # Veritabanından POI detaylarını al (eğer db bağlantısı varsa)
    poi_id = None
    if db and not poi_details:
        try:
            # Önce koordinat eşleştirmesi ile POI bul (daha güvenilir)
            all_pois = db.list_pois()  # Tüm kategoriler
            for poi_data in all_pois:
                poi_lat = poi_data.get('latitude', 0)
                poi_lon = poi_data.get('longitude', 0)
                # Koordinat farkı 0.001'den küçükse eşleşme var
                if abs(poi_lat - coord[0]) < 0.001 and abs(poi_lon - coord[1]) < 0.001:
                    poi_id = poi_data.get('_id') or poi_data.get('id')
                    poi_details = db.get_poi_details(poi_id)
                    print(f"✅ POI koordinat eşleştirmesi: {poi_name} -> ID: {poi_id}")
                    break
        except Exception as e:
            print(f"⚠️ POI koordinat eşleştirmesi hatası: {e}")
    
    # Eğer hala POI ID'si yoksa, isim eşleştirmesi dene
    if not poi_id and db:
        try:
            # POI adına göre ara
            categories = ['gastronomik', 'kulturel', 'sanatsal', 'doga_macera', 'konaklama']
            for category in categories:
                pois = db.list_pois(category)
                for poi_data in pois:
                    if poi_data.get('name') == poi_name:
                        poi_id = poi_data.get('_id') or poi_data.get('id')
                        poi_details = db.get_poi_details(poi_id)
                        print(f"✅ POI isim eşleştirmesi: {poi_name} -> ID: {poi_id}")
                        break
                if poi_id:
                    break
        except Exception as e:
            print(f"⚠️ POI isim eşleştirmesi hatası: {e}")
    
    # Temel popup
    popup_html = f"""<div style="font-family:'Segoe UI',sans-serif;max-width:450px;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.15);">
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
        
    # Görüntüler - POI ID'si varsa görsel yükleme alanı ekle
    if poi_id:
        popup_html += f"""<div style="margin-bottom:16px;">
            <h4 style="margin:0 0 12px 0;font-size:14px;color:#666;display:flex;align-items:center;">
                <i class="fa fa-images" style="margin-right:8px;color:{style['color']};"></i>
                Görseller
                <span id="image-count-{poi_id}" style="margin-left:8px;font-size:12px;color:#999;"></span>
            </h4>
            <div id="poi-images-{poi_id}" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;max-height:200px;overflow-y:auto;">
                <div style="display:flex;align-items:center;justify-content:center;background:#f8f9fa;border-radius:8px;padding:20px;border:2px dashed #ddd;">
                    <div style="text-align:center;">
                        <div class="spinner-border spinner-border-sm text-primary" role="status" style="margin-bottom:8px;">
                            <span class="visually-hidden">Yükleniyor...</span>
                        </div>
                        <small style="color:#666;">Görseller yükleniyor...</small>
                    </div>
                </div>
            </div>
        </div>"""
    
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

# --- Yardımcı Fonksiyonlar ---

def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(radians, [coord1[0], coord1[1], coord2[0], coord2[1]])
    dlon, dlat = lon2 - lon1, lat2 - lat1
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    return EARTH_RADIUS_KM * 2 * atan2(sqrt(a), sqrt(1 - a))

def create_google_maps_route_url(ordered_pois: Dict[str, Tuple[float, float]]) -> str:
    """
    Sıralı POI'ler için Google Maps rotası URL'si oluşturur
    
    Args:
        ordered_pois: Sıralı POI sözlüğü {name: (lat, lon)}
    
    Returns:
        Google Maps route URL'si
    """
    if not ordered_pois or len(ordered_pois) < 2:
        return ""
    
    coords = list(ordered_pois.values())
    # İlk nokta origin, son nokta destination, aradakiler waypoint
    origin = f"{coords[0][0]},{coords[0][1]}"
    destination = f"{coords[-1][0]},{coords[-1][1]}"
    
    # Ara waypoint'ler (eğer varsa)
    waypoints = ""
    if len(coords) > 2:
        waypoint_coords = [f"{coord[0]},{coord[1]}" for coord in coords[1:-1]]
        waypoints = "/" + "/".join(waypoint_coords)
    
    # Google Maps yönlendirme URL'si
    google_maps_url = f"https://www.google.com/maps/dir/{origin}{waypoints}/{destination}/"
    
    return google_maps_url

def load_road_network(graph_file_path: str, radius_km: float) -> Optional[nx.MultiDiGraph]:
    if os.path.exists(graph_file_path):
        print(f"'{graph_file_path}' dosyasından yol ağı yükleniyor...")
        try:
            return ox.load_graphml(graph_file_path)
        except Exception as e:
            print(f"HATA: '{graph_file_path}' yüklenemedi: {e}. Yeniden indirme denenecek.")
    try:
        print(f"'{URGUP_CENTER_LOCATION}' merkezli {radius_km}km yarıçapta yaya yol ağı OSM'den indiriliyor...")
        G = ox.graph_from_point(URGUP_CENTER_LOCATION, dist=radius_km * 1000, network_type='walk', simplify=True)
        print(f"💾 Yol ağı '{graph_file_path}' olarak kaydediliyor...")
        ox.save_graphml(G, filepath=graph_file_path)
        return G
    except Exception as e:
        print(f"💥 KRİTİK İNDİRME HATASI: Yol ağı indirilemedi: {e}")
        return None

def get_shortest_path_route(G: nx.MultiDiGraph, origin_coord: Tuple[float, float], dest_coord: Tuple[float, float]) -> Tuple[List[Tuple[float, float]], float]:
    try:
        orig_node, dest_node = ox.nearest_nodes(G, X=[origin_coord[1], dest_coord[1]], Y=[origin_coord[0], dest_coord[0]])
        route_nodes = nx.shortest_path(G, orig_node, dest_node, weight="length")
        length = nx.shortest_path_length(G, orig_node, dest_node, weight="length")
        path_coords = [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in route_nodes]
        return path_coords, length / 1000.0
    except (nx.NetworkXNoPath, Exception):
        return [origin_coord, dest_coord], haversine_distance(origin_coord, dest_coord)

# --- TSP, Yükseklik ve Zorluk Fonksiyonları ---

def solve_tsp(G: nx.MultiDiGraph, pois: Dict[str, Tuple[float, float]], start_poi_name: Optional[str]) -> List[str]:
    print("🧠 En optimize rota (TSP) hesaplanıyor...")
    poi_names = list(pois.keys())
    if len(poi_names) < 2: return poi_names

    poi_nodes = {name: ox.nearest_nodes(G, X=coord[1], Y=coord[0]) for name, coord in pois.items()}
    dist_matrix = np.full((len(poi_names), len(poi_names)), np.inf)

    for i, name1 in enumerate(poi_names):
        for j, name2 in enumerate(poi_names):
            if i == j: dist_matrix[i, j] = 0; continue
            try:
                dist_matrix[i, j] = nx.shortest_path_length(G, poi_nodes[name1], poi_nodes[name2], weight='length')
            except nx.NetworkXNoPath:
                dist_matrix[i, j] = haversine_distance(pois[name1], pois[name2]) * 1000 * 1.5

    tsp_path_indices = nx.approximation.traveling_salesman_problem(nx.from_numpy_array(dist_matrix), weight='weight', cycle=False)
    
    if start_poi_name and start_poi_name in poi_names:
        try:
            start_node_index = poi_names.index(start_poi_name)
            start_index_in_path = tsp_path_indices.index(start_node_index)
            tsp_path_indices = tsp_path_indices[start_index_in_path:] + tsp_path_indices[:start_index_in_path]
        except ValueError:
            print(f"⚠️ Başlangıç noktası '{start_poi_name}' TSP rotasında bulunamadı.")
    
    ordered_poi_names = [poi_names[i] for i in tsp_path_indices]
    ordered_poi_names.append(ordered_poi_names[0]) # Döngüyü tamamla
    print(f"✅ Optimize edilmiş sıra: {' -> '.join(ordered_poi_names)}")
    return ordered_poi_names

def get_elevation_profile(route_coords: List[Tuple[float, float]]) -> Optional[List[float]]:
    """
    API'den yükseklik verilerini alır. Uzun rotaları 100'lük parçalara bölerek
    birden fazla GET isteği ile daha stabil bir şekilde veri çeker.
    """
    print("🏔️ Yükseklik profili verileri alınıyor...")
    if not route_coords:
        return None

    all_elevations = []
    chunk_size = 100  # GET isteği için güvenli chunk boyutu

    print(f"   -> Rota {len(route_coords)} noktadan oluşuyor. {chunk_size} noktalık parçalar halinde işlenecek.")

    for i in range(0, len(route_coords), chunk_size):
        chunk = route_coords[i:i + chunk_size]
        if not chunk:
            continue
        
        print(f"   -> Parça {i//chunk_size + 1}/{len(range(0, len(route_coords), chunk_size))} işleniyor...")

        latitudes_str = ",".join([str(round(c[0], 5)) for c in chunk])
        longitudes_str = ",".join([str(round(c[1], 5)) for c in chunk])
        
        url = "https://api.open-meteo.com/v1/elevation"
        params = {"latitude": latitudes_str, "longitude": longitudes_str}
        
        try:
            response = requests.get(url, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
            
            if 'elevation' in data and data['elevation']:
                all_elevations.extend(data['elevation'])
            else:
                print(f"⚠️ Yükseklik API'sinden (GET - Parça {i//chunk_size + 1}) geçerli veri alınamadı. Yanıt: {data}")
                return None # Bir parça başarısız olursa, tüm işlem başarısız olsun.
        except requests.exceptions.RequestException as e:
            print(f"💥 Yükseklik API hatası (GET - Parça {i//chunk_size + 1}): {e}")
            return None # Bir parça başarısız olursa, tüm işlem başarısız olsun.
    
    if all_elevations:
        print(f"✅ Toplam {len(all_elevations)} nokta için yükseklik verisi başarıyla alındı.")
        return all_elevations
    
    return None

def calculate_route_difficulty(elevations: List[float], length_km: float) -> Tuple[str, float, float]:
    if not elevations or len(elevations) < 2: return "Bilinmiyor", 0, 0
    diffs = np.diff(np.array(elevations))
    ascent = np.sum(diffs[diffs > 0])
    descent = np.abs(np.sum(diffs[diffs < 0]))
    score = length_km + (ascent / 100.0)
    if score < 5: difficulty = "Çok Kolay"
    elif score < 10: difficulty = "Kolay"
    elif score < 20: difficulty = "Orta"
    elif score < 30: difficulty = "Zor"
    else: difficulty = "Çok Zor"
    print(f"💪 Rota Zorluğu: {difficulty} (Tırmanış: {ascent:.1f}m, İniş: {descent:.1f}m)")
    return difficulty, ascent, descent

# --- Harita Oluşturma Fonksiyonları ---

def generate_and_add_route(folium_map: folium.Map, road_network: Optional[nx.MultiDiGraph], ordered_pois: Dict[str, Tuple[float, float]], style: Dict, category_name: str, fetch_elevation: bool):
    if not ordered_pois or len(ordered_pois) < 2: return 0.0, [], None
    
    poi_coords = list(ordered_pois.values())
    stitched_route, total_km = [], 0.0
    warnings = []

    for i in range(len(poi_coords) - 1):
        segment_coords, segment_km = get_shortest_path_route(road_network, poi_coords[i], poi_coords[i+1]) if road_network else ([poi_coords[i], poi_coords[i+1]], haversine_distance(poi_coords[i], poi_coords[i+1]))
        if len(segment_coords) == 2 and road_network: warnings.append(f"Uyarı: İki nokta arası yol bulunamadı, düz çizgi kullanıldı.")
        total_km += segment_km
        stitched_route.extend(segment_coords if not stitched_route else segment_coords[1:])

    elevations, difficulty, ascent, descent = None, "N/A", 0, 0
    elevation_data_available = False
    if fetch_elevation and stitched_route:
        elevations = get_elevation_profile(stitched_route)
        if elevations: 
            difficulty, ascent, descent = calculate_route_difficulty(elevations, total_km)
            elevation_data_available = True

    if stitched_route:
        display_name = style.get("display_name", category_name.capitalize())
        route_fg_name = f"🛣️ {display_name} Rotası"
        route_fg = folium.FeatureGroup(name=route_fg_name, show=True).add_to(folium_map)
        
        # Popup içeriğini oluşturma
        popup_html = f"""
        <div style="font-family: 'Segoe UI', sans-serif;">
            <h4 style="margin:5px 0 10px 0; color:{style['color']};">{display_name} Rota Bilgileri</h4>
            <p style="margin: 0 0 10px 0;">
                <b>Mesafe:</b> {total_km:.2f} km<br>
        """
        
        if elevation_data_available:
            popup_html += f"""
                <b>Zorluk:</b> {difficulty}<br>
                <b>Toplam Tırmanış:</b> {ascent:.1f} m<br>
                <b>Toplam İniş:</b> {descent:.1f} m
            """
        else:
            popup_html += "<small><i>Yükseklik verisi alınamadı. (--no-elevation kapalı mı?)</i></small>"

        popup_html += "</p>"

        stops_html = "<h5 style='margin-top:15px; margin-bottom:5px; border-top: 1px solid #eee; padding-top: 10px;'>Geçilecek Duraklar</h5><ol style='padding-left: 20px; margin: 0;'>"
        for poi_name in ordered_pois.keys():
            stops_html += f"<li style='margin-bottom: 5px;'>{poi_name}</li>"
        stops_html += "</ol>"
        popup_html += stops_html
        
        # Google Maps rota aktarma butonu
        google_maps_url = create_google_maps_route_url(ordered_pois)
        if google_maps_url:
            popup_html += f"""
            <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px; text-align: center;">
                <a href="{google_maps_url}" target="_blank" rel="noopener noreferrer" 
                   style="background: linear-gradient(135deg, #4285f4 0%, #34a853 50%, #ea4335 100%);
                          color: white; padding: 12px 20px; border-radius: 25px; text-decoration: none; 
                          font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; 
                          justify-content: center; transition: all 0.3s ease; 
                          box-shadow: 0 4px 15px rgba(66, 133, 244, 0.3);">
                    🗺️ Google Maps'te Rota Aç
                </a>
                <div style="margin-top: 8px; font-size: 11px; color: #666;">
                    Rotayı Google Maps'te açar ({len(ordered_pois)} durak)
                </div>
            </div>
            """

        if elevation_data_available:
            chart_id = f"chart_{category_name.replace(' ', '_')}"
            # SVG yükseklik profili oluştur (Chart.js yerine)
            svg_width = 350
            svg_height = 120
            margin = 20
            chart_width = svg_width - 2 * margin
            chart_height = svg_height - 2 * margin
            
            min_elevation = min(elevations)
            max_elevation = max(elevations)
            elevation_range = max_elevation - min_elevation
            
            if elevation_range == 0:
                elevation_range = 1  # Sıfır bölme hatasını önle
            
            # SVG path oluştur
            points = []
            for i, elevation in enumerate(elevations):
                x = margin + (i * chart_width / (len(elevations) - 1))
                y = svg_height - margin - ((elevation - min_elevation) * chart_height / elevation_range)
                points.append(f"{x},{y}")
            
            path_data = "M " + " L ".join(points)
            
            # Fill path için
            fill_points = [f"{margin},{svg_height - margin}"] + points + [f"{svg_width - margin},{svg_height - margin}"]
            fill_path = "M " + " L ".join(fill_points) + " Z"
            
            popup_html += f"""
            <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                <h5 style="margin-top:0; margin-bottom:10px;">Yükseklik Profili</h5>
                <div style="text-align: center; background: #f8f9fa; border-radius: 8px; padding: 10px;">
                    <svg width="{svg_width}" height="{svg_height}" style="background: white; border-radius: 4px;">
                        <!-- Arka plan ızgarası -->
                        <defs>
                            <pattern id="grid_{category_name.replace(' ', '_')}" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>
                            </pattern>
                        </defs>
                        <rect width="{svg_width}" height="{svg_height}" fill="url(#grid_{category_name.replace(' ', '_')})"/>
                        
                        <!-- Yükseklik alanı (fill) -->
                        <path d="{fill_path}" fill="rgba({int(style['color'][1:3],16)},{int(style['color'][3:5],16)},{int(style['color'][5:7],16)},0.3)" stroke="none"/>
                        
                        <!-- Yükseklik çizgisi -->
                        <path d="{path_data}" fill="none" stroke="{style['color']}" stroke-width="2.5"/>
                        
                        <!-- Y ekseni etiketi -->
                        <text x="5" y="15" font-family="Arial, sans-serif" font-size="11" fill="#666">
                            {max_elevation:.0f}m
                        </text>
                        <text x="5" y="{svg_height - 5}" font-family="Arial, sans-serif" font-size="11" fill="#666">
                            {min_elevation:.0f}m
                        </text>
                        
                        <!-- Başlangıç ve bitiş noktaları -->
                        <circle cx="{points[0].split(',')[0]}" cy="{points[0].split(',')[1]}" r="3" fill="{style['color']}" stroke="white" stroke-width="2"/>
                        <circle cx="{points[-1].split(',')[0]}" cy="{points[-1].split(',')[1]}" r="3" fill="{style['color']}" stroke="white" stroke-width="2"/>
                    </svg>
                    <div style="margin-top: 8px; font-size: 12px; color: #666;">
                        <strong>Min:</strong> {min_elevation:.0f}m &nbsp;|&nbsp; 
                        <strong>Max:</strong> {max_elevation:.0f}m &nbsp;|&nbsp; 
                        <strong>Fark:</strong> {elevation_range:.0f}m
                    </div>
                </div>
            </div>
            """
        
        popup_html += "</div>"

        iframe_height = 100 
        if ordered_pois:
            iframe_height += 40 + (len(ordered_pois) * 22)
            # Google Maps butonu için ek alan
            iframe_height += 80
        if elevation_data_available:
            iframe_height += 200
        
        iframe_height = min(iframe_height, 500)

        final_html = f"<div style='width: 380px; height: {iframe_height-20}px; overflow-y: auto;'>{popup_html}</div>"

        folium.PolyLine(
            locations=stitched_route, 
            color=style["color"], 
            weight=6, 
            opacity=0.8, 
            popup=folium.Popup(folium.IFrame(html=final_html, width=400, height=iframe_height))
        ).add_to(route_fg)
        
        return total_km, list(set(warnings)), route_fg.get_name()
    return 0.0, [], None

def add_poi_markers(pois: Dict[str, Tuple[float, float]], ordered_poi_names: List[str], style: Dict, poi_layer: folium.FeatureGroup, db: Optional[Any] = None):
    display_name = style.get("display_name", "").split(" ")[-1]
    for poi_name, coord in pois.items():
        try: order_index = ordered_poi_names.index(poi_name) + 1
        except ValueError: order_index = '?'

        # Gelişmiş popup oluştur (görsel desteği ile)
        popup_html = create_enhanced_poi_popup(poi_name, coord, style, order_index, db)
        tooltip_html = f"<div style='background:{style['color']};color:white;padding:8px 12px;border-radius:8px;font-family:sans-serif;box-shadow:0 4px 12px {style.get('shadow_color','rgba(0,0,0,0.3)')};'><strong>{order_index}. {poi_name}</strong></div>"
        
        icon = plugins.BeautifyIcon(
            icon=style.get("icon", "info-circle"),
            icon_prefix=style.get("icon_prefix", "fa"),
            border_color=style["color"],
            background_color=style["color"],
            text_color="white",
            number=order_index,
            icon_shape="marker"
        )
        folium.Marker(location=coord, tooltip=folium.Tooltip(tooltip_html), popup=folium.Popup(popup_html, max_width=450), icon=icon).add_to(poi_layer)

def add_image_loading_javascript(html_file_path: str):
    """
    HTML dosyasına otomatik görsel yükleme JavaScript'i ekler
    """
    try:
        with open(html_file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # JavaScript kodunu HTML'in sonuna ekle
        javascript_code = '''
        
        // Genel POI görsel yükleme fonksiyonu
        function loadPOIImages(poiId, poiName) {
            // API URL'ini dinamik olarak oluştur
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            const port = window.location.port || (protocol === 'https:' ? '443' : '80');
            const apiUrl = protocol + '//' + hostname + ':' + port + '/api/poi/' + poiId + '/images';
            
            const container = document.getElementById('poi-images-' + poiId);
            const countSpan = document.getElementById('image-count-' + poiId);
            
            if (!container) {
                console.log('❌ Container bulunamadı:', poiId);
                return;
            }
            
            console.log('🔍 POI Görsel Yükleniyor:', poiName, 'ID:', poiId, 'URL:', apiUrl);
            
            fetch(apiUrl)
                .then(response => {
                    console.log('📡 API Response Status:', response.status);
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('📦 API Response Data:', data);
                    const images = data.images || [];
                    console.log('🖼️ Images Array:', images, 'Length:', images.length);
                    
                    if (images.length === 0) {
                        console.log('⚠️ No images found for POI:', poiId);
                        container.innerHTML = '<small style="color:#999;text-align:center;padding:20px;display:block;">Henüz görsel eklenmemiş</small>';
                        return;
                    }
                    
                    if (countSpan) countSpan.textContent = '(' + images.length + ')';
                    
                    // Container'ı temizle
                    container.innerHTML = '';
                    
                    images.slice(0, 6).forEach((img, i) => {
                        const imgPath = img.thumbnail_path || img.path;
                        const fullPath = img.path;
                        const caption = img.filename || 'Görsel ' + (i + 1);
                        
                        const imgDiv = document.createElement('div');
                        imgDiv.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);transition:transform 0.2s ease;';
                        
                        const imgElement = document.createElement('img');
                        imgElement.src = '/' + imgPath;
                        imgElement.style.cssText = 'width:100%;height:80px;object-fit:cover;cursor:pointer;';
                        imgElement.alt = caption;
                        imgElement.onclick = function() { window.open('/' + fullPath, '_blank'); };
                        imgElement.onmouseover = function() { this.parentElement.style.transform = 'scale(1.05)'; };
                        imgElement.onmouseout = function() { this.parentElement.style.transform = 'scale(1)'; };
                        imgElement.onerror = function() { this.style.display = 'none'; console.log('Görsel yüklenemedi: ' + imgPath); };
                        
                        const overlay = document.createElement('div');
                        overlay.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:4px 8px;';
                        overlay.innerHTML = '<small style="color:white;font-size:10px;">' + caption.substring(0, 20) + (caption.length > 20 ? '...' : '') + '</small>';
                        
                        imgDiv.appendChild(imgElement);
                        imgDiv.appendChild(overlay);
                        container.appendChild(imgDiv);
                    });
                    
                    if (images.length > 6) {
                        const moreDiv = document.createElement('div');
                        moreDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#f8f9fa;border-radius:8px;padding:20px;border:2px dashed #ddd;';
                        moreDiv.innerHTML = '<small style="color:#666;text-align:center;"><i class="fa fa-plus-circle" style="font-size:16px;margin-bottom:4px;display:block;"></i>+' + (images.length - 6) + ' görsel daha</small>';
                        container.appendChild(moreDiv);
                    }
                    console.log('✅ Görseller yüklendi:', poiName, images.length, 'adet');
                })
                .catch(error => {
                    console.log('⚠️ Görsel yükleme hatası:', poiName, 'Error:', error.message);
                    console.log('🔗 Failed URL:', apiUrl);
                    container.innerHTML = '<small style="color:#999;text-align:center;padding:20px;display:block;">Görsel yüklenemedi: ' + error.message + '</small>';
                });
        }
        
        // Test - JavaScript çalışıyor mu?
        console.log('🧪 JavaScript dosyası yüklendi!');
        
        // Tüm popup'lar için otomatik görsel yükleme sistemi
        window.onload = function() {
            console.log('🚀 Sayfa tamamen yüklendi, popup event listener ekleniyor...');
            
            // Tüm popup açılma olaylarını dinle
            const map = window[Object.keys(window).find(key => key.startsWith('map_'))];
            console.log('🗺️ Harita objesi bulundu:', map ? 'Evet' : 'Hayır');
            
            if (map) {
                map.on('popupopen', function(e) {
                    console.log('📍 Popup açıldı, görsel yükleme başlatılıyor...');
                    
                    setTimeout(function() {
                        // Popup içindeki POI ID'sini bul
                        const popupContent = e.popup.getContent();
                        console.log('📄 Popup içeriği tipi:', typeof popupContent);
                        
                        if (typeof popupContent === 'string') {
                            const matches = popupContent.match(/poi-images-(\\d+)/);
                            console.log('🔍 POI ID regex sonucu:', matches);
                            
                            if (matches && matches[1]) {
                                const poiId = matches[1];
                                // POI adını popup başlığından çıkar
                                const titleMatch = popupContent.match(/<h3[^>]*>([^<]+)</);
                                const poiName = titleMatch ? titleMatch[1].replace(/🍽️|🏛️|🎨|🌿|🏨|📍/g, '').trim() : 'POI';
                                console.log('✅ POI bilgileri - ID:', poiId, 'Ad:', poiName);
                                loadPOIImages(poiId, poiName);
                            } else {
                                console.log('❌ POI ID bulunamadı popup içeriğinde');
                            }
                        } else {
                            console.log('❌ Popup içeriği string değil');
                        }
                    }, 500);
                });
                console.log('✅ Popup event listener başarıyla eklendi');
            } else {
                console.log('❌ Harita objesi bulunamadı');
            }
        });
        </script>
        </html>'''
        
        # Basit test JavaScript'i ekle
        simple_test = '''
<script>
console.log('🧪 BASIT TEST: JavaScript çalışıyor!');
</script>
'''
        
        # HTML dosyasının sonuna JavaScript kodunu ekle
        # Son </script> etiketinden sonra JavaScript'i ekle
        last_script_pos = html_content.rfind('</script>')
        if last_script_pos != -1:
            # Son </script> etiketinden sonra JavaScript'i ekle
            insert_pos = last_script_pos + len('</script>')
            html_content = html_content[:insert_pos] + '\n' + simple_test + '\n' + javascript_code + html_content[insert_pos:]
        else:
            # </body> etiketinden önce JavaScript'i ekle
            if '</body>' in html_content:
                html_content = html_content.replace('</body>', simple_test + '\n' + javascript_code + '\n</body>')
            elif html_content.endswith('</html>'):
                html_content = html_content.replace('</html>', simple_test + '\n' + javascript_code)
            else:
                html_content += simple_test + '\n' + javascript_code
        
        with open(html_file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
            
        print(f"✅ Otomatik görsel yükleme sistemi '{html_file_path}' dosyasına eklendi")
        
    except Exception as e:
        print(f"⚠️ JavaScript ekleme hatası: {e}")

def add_enhanced_legend_and_controls(folium_map: folium.Map, processed_categories: List[Tuple[str, str, float, int]], map_js_var: str):
    legend_html = """<div id="legend-panel" style="position:fixed;bottom:20px;left:20px;width:280px;background:rgba(255,255,255,0.9);border:1px solid #ddd;border-radius:12px;box-shadow:0 8px 25px rgba(0,0,0,0.12);z-index:9999;font-family:'Segoe UI',sans-serif;backdrop-filter:blur(10px);overflow:hidden;"><div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:14px;color:white;"><h3 style="margin:0;font-size:16px;text-align:center;">🗺️ Rota Lejantı</h3></div><div id="categories-container" style="padding:12px;max-height:350px;overflow-y:auto;">"""
    for cat_name, layer_var, length, poi_count in processed_categories:
        style = CATEGORY_STYLES.get(cat_name, CATEGORY_STYLES["default"])
        display_name = style.get("display_name", cat_name.capitalize())
        legend_html += f"""<div class="category-item" onclick="toggleLayer('{layer_var}', this)" style="display:flex;align-items:center;margin-bottom:8px;padding:10px;border-radius:10px;cursor:pointer;transition:all 0.3s ease;border-left:4px solid {style['color']};background:#f8f9fa;"><div class="toggle-indicator" style="width:10px;height:10px;border-radius:50%;background:{style['color']};margin-right:12px;"></div><div style="flex:1;"><div style="font-weight:600;font-size:13px;">{display_name}</div><div style="font-size:11px;color:#555;">{poi_count} Nokta | {length:.1f} km</div></div></div>"""
    legend_html += "</div></div>"
    control_script = f"""<script>function toggleLayer(layerVarName,element){{const layer=window[layerVarName];if(!layer)return;const indicator=element.querySelector('.toggle-indicator');if({map_js_var}.hasLayer(layer)){{{map_js_var}.removeLayer(layer);indicator.style.opacity='0.3';element.style.background='#f8f9fa';}}else{{{map_js_var}.addLayer(layer);indicator.style.opacity='1';element.style.background='#e9ecef';}}}}</script><style>.category-item:hover{{transform:scale(1.03);box-shadow:0 4px 15px rgba(0,0,0,0.1);}}</style>"""
    folium_map.get_root().html.add_child(folium.Element(legend_html + control_script))

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
            if args.db_type == 'postgresql' and hasattr(args, 'db_name') and args.db_name:
                db_config['database_name'] = args.db_name
        
        # POI verilerini yükle
        POI_DATA = load_poi_data(db_config)
        
        # Veritabanı bağlantısı (detaylı bilgi için)
        db = None
        if db_config:
            try:
                db = POIDatabaseFactory.create_database(
                    db_config['type'],
                    connection_string=db_config['connection_string'],
                    database_name=db_config.get('database_name')
                )
                db.connect()
            except Exception as e:
                print(f"⚠️ Veritabanı bağlantısı kurulamadı: {e}")
                db = None
        
        categories = [args.category] if args.category and args.category in POI_DATA else list(POI_DATA.keys())
        if args.category and args.category not in POI_DATA: 
            print(f"⚠️ Kategori '{args.category}' bulunamadı. Tümü işleniyor.")

        road_network = load_road_network(args.graphfile, args.radius)
        folium_map = folium.Map(location=URGUP_CENTER_LOCATION, zoom_start=DEFAULT_ZOOM_URGUP, tiles=None, max_zoom=20)
        
        poi_layer = folium.FeatureGroup(name="📍 Tüm POI Noktaları", show=True).add_to(folium_map)
        processed_for_legend = []
        
        for cat_name in categories:
            pois = POI_DATA.get(cat_name)
            if not pois: continue
            
            style = CATEGORY_STYLES.get(cat_name, CATEGORY_STYLES["default"])
            print(f"\n🔄 '{style.get('display_name', cat_name)}' işleniyor...")

            ordered_names = solve_tsp(road_network, pois, args.start) if args.optimize and road_network and len(pois) > 1 else list(pois.keys())
            if args.start and args.start in ordered_names and not (args.optimize and road_network):
                ordered_names.remove(args.start)
                ordered_names.insert(0, args.start)
            
            ordered_pois_dict = {name: pois[name] for name in ordered_names if name in pois}

            route_len, warnings, layer_var = generate_and_add_route(folium_map, road_network, ordered_pois_dict, style, cat_name, args.elevation)
            if warnings:
                for w in warnings: print(f"   - {w}")
            
            # Tek POI'li kategoriler için de lejanta ekleme
            if layer_var:
                processed_for_legend.append((cat_name, layer_var, route_len, len(pois)))
            elif len(pois) == 1:
                # Tek POI için özel layer oluştur
                single_poi_fg_name = f"📍 {style.get('display_name', cat_name.capitalize())} Noktası"
                processed_for_legend.append((cat_name, single_poi_fg_name, 0.0, len(pois)))

            add_poi_markers(pois, ordered_names, style, poi_layer, db)
            print(f"   ✅ {len(pois)} nokta ve rota eklendi: {route_len:.2f} km")

        # Diğer katmanları ekle (OpenStreetMap hariç)
        for tile in TILE_LAYERS[1:]: 
            folium.TileLayer(tiles=tile['tiles'], attr=tile['attr'], name=tile['name']).add_to(folium_map)
        
        # OpenStreetMap'i en son ekle (böylece aktif kalır)
        folium.TileLayer(tiles='OpenStreetMap', attr='© OpenStreetMap contributors', name='🗺️ OpenStreetMap (Varsayılan)').add_to(folium_map)
        plugins.Fullscreen(position="topleft").add_to(folium_map)
        plugins.MeasureControl(position='bottomleft', primary_length_unit='kilometers').add_to(folium_map)
        plugins.MiniMap(toggle_display=True).add_to(folium_map)
        if processed_for_legend: add_enhanced_legend_and_controls(folium_map, processed_for_legend, folium_map.get_name())
        folium.LayerControl(collapsed=False).add_to(folium_map)
        
        output_file = args.output or f"{args.category or 'tum_kategoriler'}{'_optimized' if args.optimize else ''}_rotasi.html"
        folium_map.save(output_file)
        
        # HTML dosyasına otomatik görsel yükleme JavaScript'i ekle
        add_image_loading_javascript(output_file)
        
        print(f"\n🎉 Harita başarıyla '{output_file}' olarak kaydedildi!")
        
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
    
    # Sadece PostgreSQL için argümanlar
    parser.add_argument("--db-type", choices=['postgresql'], default='postgresql', help="Veritabanı tipi (sadece postgresql destekleniyor)")
    parser.add_argument("--db-connection", default='postgresql://poi_user:poi_password@localhost/poi_db', help="Veritabanı bağlantı string'i (varsayılan: postgresql://poi_user:poi_password@localhost/poi_db)")
    parser.add_argument("--db-name", default='poi_db', help="Veritabanı adı (varsayılan: poi_db)")
    
    # Varsayılan olarak optimizasyon ve yükseklik özelliklerini AÇIK yap
    parser.set_defaults(optimize=True, elevation=True)
    
    main(parser.parse_args())