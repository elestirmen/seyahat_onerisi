# -*- coding: utf-8 -*-
import os
import argparse
import folium
from folium import plugins
import osmnx as ox
import networkx as nx
from math import atan2, cos, radians, sin, sqrt
from typing import List, Tuple, Dict, Optional, Any
import traceback # Hata ayıklama için

# --- Sabitler ve Konfigürasyon ---
URGUP_CENTER_LOCATION = (38.6310, 34.9130) # Ürgüp merkezi
DEFAULT_ZOOM_URGUP = 13 # Ürgüp merkezine odaklanmak için zoom
DEFAULT_GRAPH_FILE_URGUP = "urgup_merkez_walking.graphml" # Ürgüp'e özel graph dosyası
EARTH_RADIUS_KM = 6371.0
DEFAULT_GRAPH_RADIUS_KM = 10.0  # Daha geniş kapsam için varsayılan yarıçap (km)

# Öneri 1'e göre: Harita altlıkları (Tile Layers) tek bir yerden yönetilecek şekilde düzenlendi.
# Bu liste hem komut satırı argümanlarını hem de haritadaki katman kontrol menüsünü oluşturur.
TILE_LAYERS = [
    {
        'name': 'Varsayılan (OpenStreetMap)',
        'tiles': 'OpenStreetMap',
        'attr': '© OpenStreetMap contributors'
    },
    {
        'name': 'Topoğrafik (OpenTopoMap)',
        'tiles': 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        'attr': '© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors'
    },
    {
        'name': 'Çok Renkli (CartoDB Voyager)',
        'tiles': 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager_labels_under/{z}/{x}/{y}.png',
        'attr': '© CartoDB © OpenStreetMap contributors'
    },
    {
        'name': 'Uydu Görüntüsü (Esri)',
        'tiles': 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        'attr': '© Esri © i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    },
    {
        'name': 'Sade Beyaz (CartoDB Positron)',
        'tiles': 'CartoDB positron',
        'attr': '© CartoDB © OpenStreetMap contributors'
    },
    {
        'name': 'Karanlık Mod (CartoDB Dark Matter)',
        'tiles': 'CartoDB dark_matter',
        'attr': '© CartoDB © OpenStreetMap contributors'
    }
]


CATEGORY_STYLES = {
    "gastronomik": {
        "color": "#e74c3c", 
        "gradient": "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
        "icon": "utensils", 
        "icon_prefix": "fa",
        "display_name": "🍽️ Gastronomik",
        "description": "Restoranlar, kafeler ve lezzet noktaları",
        "emoji": "🍽️",
        "shadow_color": "rgba(231, 76, 60, 0.3)"
    },
    "kulturel": {
        "color": "#3498db", 
        "gradient": "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
        "icon": "landmark", 
        "icon_prefix": "fa",
        "display_name": "🏛️ Kültürel",
        "description": "Müzeler, tarihi yerler ve kültürel mekanlar",
        "emoji": "🏛️",
        "shadow_color": "rgba(52, 152, 219, 0.3)"
    },
    "sanatsal": {
        "color": "#2ecc71", 
        "gradient": "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)",
        "icon": "palette", 
        "icon_prefix": "fa",
        "display_name": "🎨 Sanatsal",
        "description": "Sanat galerileri, atölyeler ve yaratıcı mekanlar",
        "emoji": "🎨",
        "shadow_color": "rgba(46, 204, 113, 0.3)"
    },
    "doga_macera": {
        "color": "#f39c12", 
        "gradient": "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
        "icon": "hiking", 
        "icon_prefix": "fa",
        "display_name": "🌿 Doğa & Macera",
        "description": "Doğal güzellikler ve macera aktiviteleri",
        "emoji": "🌿",
        "shadow_color": "rgba(243, 156, 18, 0.3)"
    },
    "konaklama": {
        "color": "#9b59b6", 
        "gradient": "linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)",
        "icon": "bed", 
        "icon_prefix": "fa",
        "display_name": "🏨 Konaklama",
        "description": "Oteller, pansiyonlar ve konaklama tesisleri",
        "emoji": "🏨",
        "shadow_color": "rgba(155, 89, 182, 0.3)"
    },
    "default": {
        "color": "#95a5a6", 
        "gradient": "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)",
        "icon": "info-circle", 
        "icon_prefix": "fa",
        "display_name": "ℹ️ Diğer",
        "description": "Diğer ilgi çekici noktalar",
        "emoji": "ℹ️",
        "shadow_color": "rgba(149, 165, 166, 0.3)"
    }
}

POI_DATA: Dict[str, Dict[str, Tuple[float, float]]] = {
    "gastronomik": {
        "Ziggy Cafe & Restaurant (Ürgüp)": (38.633115, 34.907022),
        "Ehlikeyf Restaurant (Ürgüp)": (38.630610, 34.911284),
        "Sofra Restaurant (Ürgüp)": (38.63099, 34.91382),
        "Lagarto Restaurant (Kayakapı Premium Caves - Ürgüp)": (38.631862, 34.907135),
        "Fırın Express Pide & Kebap (Ürgüp)": (38.63161, 34.91537),
        "Mahzen Şarap Evi (Ürgüp)": (38.63411, 34.91035),
        "Apetino Restaurant (Ürgüp)": (38.63231, 34.91345),
        "Kolcuoğlu Ürgüp (Ürgüp)": (38.63145, 34.91183),
        "Han Çırağan Restaurant (Ürgüp)": (38.63309, 34.91522),
        "Ürgüp Pide Salonu (Ürgüp)": (38.63102, 34.91251),
    },
    "kulturel": {
        "Ürgüp Müzesi": (38.63222, 34.91148),
        "Temenni Tepesi (Ürgüp)": (38.63194, 34.91054),
        "Cappadocia Ebru Art House (Ürgüp)": (38.63161, 34.91537),
        "Ürgüp Erhan Ayata At Müzesi ve Güzel Atlar Sergisi (Ürgüp)": (38.62985, 34.90882),
        "Temenni Anıt Mezarı (Ürgüp)": (38.63194, 34.91054),
        "Rum Hamamı (Ürgüp)": (38.63273, 34.90841),
    },
    "sanatsal": {
        "El Sanatları Çarşısı (Ürgüp Cumhuriyet Meydanı)": (38.63145, 34.91183),
        "Kapadokya Sanat ve El Sanatları Merkezi (Ürgüp)": (38.63102, 34.91251),
        "Kilim Art Gallery (Ürgüp)": (38.63231, 34.91345),
    },
    "doga_macera": {
        "Temenni Hill (Ürgüp)": (38.63194, 34.91054),
        "Ürgüp ATV Turu Başlangıç Noktası (Ürgüp)": (38.63851, 34.91352),
        "Üç Güzeller Peribacaları (Ürgüp)": (38.635366, 34.890657),
        "Vefa Küçük Parkı (Ürgüp)": (38.63161, 34.91537),
    },
    # Öneri 4'e göre: 'konaklama' kategorisi aktif edildi.
    "konaklama": {
         "Kayakapı Premium Caves (Ürgüp)": (38.62879, 34.91248),
         "Yunak Evleri Cappadocia (Ürgüp)": (38.63381, 34.90784),
         "Esbelli Evi Cave Hotel (Ürgüp)": (38.62985, 34.90882),
         "Dere Suites Cappadocia (Ürgüp)": (38.63273, 34.90841),
         "Seraphim Cave Hotel (Ürgüp)": (38.60942, 34.90375),
         "AJWA Cappadocia (Ürgüp)": (38.63411, 34.91035),
         "Utopia Cave Cappadocia (Ürgüp)": (38.63583, 34.90562),
    }
}

# --- Yardımcı Fonksiyonlar ---

def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return EARTH_RADIUS_KM * c

# Öneri 3'e göre: Kullanılmayan `calculate_optimal_bounding_box` fonksiyonu kaldırıldı.

def check_graph_coverage(G: nx.MultiDiGraph, poi_coords: List[Tuple[float, float]], 
                         max_distance_km: float = 3.0) -> bool:
    """Graph'in POI'ları yeterince kapsayıp kapsamadığını kontrol eder."""
    try:
        uncovered_count = 0
        for coord in poi_coords:
            lat, lon = coord
            try:
                nearest_node = ox.nearest_nodes(G, X=lon, Y=lat)
                nearest_node_coord = (G.nodes[nearest_node]["y"], G.nodes[nearest_node]["x"])
                distance_km = haversine_distance(coord, nearest_node_coord)
                if distance_km > max_distance_km:
                    uncovered_count += 1
            except Exception:
                uncovered_count += 1
        coverage_ratio = (len(poi_coords) - uncovered_count) / len(poi_coords) if poi_coords else 1.0
        print(f"    📊 Kapsam oranı: %{coverage_ratio * 100:.1f} ({len(poi_coords) - uncovered_count}/{len(poi_coords)} POI)")
        return coverage_ratio >= 0.7 
    except Exception as e:
        print(f"    ⚠️ Kapsam kontrolü başarısız: {e}")
        return False

def detect_distant_pois(poi_coords: List[Tuple[float, float]], 
                        center: Tuple[float, float] = URGUP_CENTER_LOCATION,
                        distant_threshold_km: float = 12.0) -> Tuple[List[Tuple[float, float]], List[Tuple[float, float]]]:
    """POI'ları merkeze olan uzaklığa göre yakın ve uzak olarak ayırır."""
    near_pois, distant_pois = [], []
    for coord in poi_coords:
        if haversine_distance(center, coord) > distant_threshold_km:
            distant_pois.append(coord)
        else:
            near_pois.append(coord)
    return near_pois, distant_pois

def load_road_network(graph_file_path: str, radius_km: float = DEFAULT_GRAPH_RADIUS_KM, 
                      default_place_query_for_download: str = "Ürgüp, Türkiye",
                      all_poi_coords: Optional[List[Tuple[float, float]]] = None) -> Optional[nx.MultiDiGraph]:
    """Yol ağını yükler. Eğer uzak POI'lar varsa, daha geniş bir bölge (Nevşehir) indirir."""
    is_distant_scenario = False
    if all_poi_coords:
        _, distant_pois = detect_distant_pois(all_poi_coords)
        if distant_pois:
            is_distant_scenario = True
            print(f"🌍 Uzak POI'lar tespit edildi. Geniş kapsamlı yol ağı indirilecek: Nevşehir.")
            
    force_download = is_distant_scenario and "urgup" in graph_file_path.lower()
    
    if os.path.exists(graph_file_path) and not force_download:
        print(f"'{graph_file_path}' dosyasından yol ağı yükleniyor...")
        try:
            G = ox.load_graphml(graph_file_path)
            if all_poi_coords and not check_graph_coverage(G, all_poi_coords):
                print(f"⚠️ Mevcut yol ağı yetersiz. Yeniden indirilecek.")
            else:
                print(f"✅ Mevcut yol ağı yeterli görünüyor.")
                return G
        except Exception as e:
            print(f"HATA: '{graph_file_path}' yüklenemedi: {e}. Yeniden indirme denenecek.")

    G = None
    try:
        if is_distant_scenario:
            place_to_download = "Nevşehir, Türkiye"
            print(f"🎯 Strateji: '{place_to_download}' için yaya yol ağı indiriliyor...")
            G = ox.graph_from_place(place_to_download, network_type='walk', simplify=False)
        else:
            print(f"🎯 Strateji: '{default_place_query_for_download}' için {radius_km}km yarıçapta yaya yol ağı indiriliyor...")
            G = ox.graph_from_point(URGUP_CENTER_LOCATION, dist=radius_km * 1000, network_type='walk', simplify=False)
            
    except Exception as e:
        print(f"💥 KRİTİK İNDİRME HATASI: {e}")
        print("🚧 Rota hesaplamaları sadece düz çizgilerle yapılacaktır.")
        return None

    if G is not None:
        print(f"💾 Yol ağı kaydediliyor... ({len(G.nodes)} düğüm, {len(G.edges)} kenar)")
        try:
            # Öneri 5'e göre: Dosya adı "driving" yerine "walking" olarak düzeltildi.
            save_path = "nevsehir_walking_high_res.graphml" if is_distant_scenario else graph_file_path.replace(".graphml", "_high_res.graphml")
            ox.save_graphml(G, filepath=save_path)
            print(f"✅ Yol ağı '{save_path}' olarak kaydedildi.")
        except Exception as save_e:
            print(f"⚠️ Kaydetme hatası: {save_e}, devam ediliyor...")
        return G
    return None

def get_shortest_path_route_and_length(G: nx.MultiDiGraph, origin_coord: Tuple[float, float], destination_coord: Tuple[float, float]) -> Tuple[List[Tuple[float, float]], float]:
    try:
        origin_node, destination_node = ox.nearest_nodes(G, X=[origin_coord[1], destination_coord[1]], Y=[origin_coord[0], destination_coord[0]])
        if origin_node == destination_node: return [[origin_coord, destination_coord]], haversine_distance(origin_coord, destination_coord)

        route_nodes = nx.shortest_path(G, origin_node, destination_node, weight="length")
        route_length_meters = nx.shortest_path_length(G, origin_node, destination_node, weight="length")
        
        path_coords = []
        for u, v in zip(route_nodes[:-1], route_nodes[1:]):
            edge_data = min(G.get_edge_data(u, v).values(), key=lambda d: d["length"])
            if "geometry" in edge_data:
                xs, ys = edge_data["geometry"].xy
                path_coords.extend(list(zip(ys, xs)))
            else:
                path_coords.append((G.nodes[u]["y"], G.nodes[u]["x"]))
        
        if route_nodes:
             path_coords.append((G.nodes[route_nodes[-1]]["y"], G.nodes[route_nodes[-1]]["x"]))

        final_path_coords = [origin_coord] + path_coords + [destination_coord]
        return final_path_coords, route_length_meters / 1000.0
    
    except (nx.NetworkXNoPath, Exception) as e:
        # Hata durumunda fallback olarak düz çizgi kullanılır
        print(f"    🚧 Rota Hesaplanamadı, Düz Çizgi Kullanılıyor: {origin_coord} -> {destination_coord} | Sebep: {type(e).__name__}")
        return [origin_coord, destination_coord], haversine_distance(origin_coord, destination_coord)

def generate_route_for_poi_order(G: Optional[nx.MultiDiGraph], ordered_poi_coords: List[Tuple[float, float]]) -> Tuple[List[Tuple[float, float]], float, List[str]]:
    if not ordered_poi_coords or len(ordered_poi_coords) < 2:
        return ordered_poi_coords, 0.0, []

    stitched_route_coords: List[Tuple[float, float]] = []
    total_actual_route_length_km = 0.0
    warnings = []

    for i in range(len(ordered_poi_coords) - 1):
        start_poi, end_poi = ordered_poi_coords[i], ordered_poi_coords[i+1]
        
        if G:
            segment_coords, segment_length_km = get_shortest_path_route_and_length(G, start_poi, end_poi)
            if len(segment_coords) == 2: # get_shortest_path_route_and_length fallback'e düştü demek
                warnings.append(f"Uyarı: ({start_poi[0]:.3f}) <-> ({end_poi[0]:.3f}) arası yol bulunamadı, düz çizgi kullanıldı.")
        else:
            segment_coords = [start_poi, end_poi]
            segment_length_km = haversine_distance(start_poi, end_poi)
            warnings.append(f"Bilgi: Yol ağı yüklenmediği için düz çizgi kullanıldı.")
        
        total_actual_route_length_km += segment_length_km
        
        if not stitched_route_coords:
            stitched_route_coords.extend(segment_coords)
        else:
            if haversine_distance(stitched_route_coords[-1], segment_coords[0]) < 0.0001:
                stitched_route_coords.extend(segment_coords[1:])
            else:
                stitched_route_coords.extend(segment_coords)
                
    return stitched_route_coords, total_actual_route_length_km, warnings

# --- Harita Oluşturma Fonksiyonları ---

def add_poi_markers_and_route_to_map(folium_map: folium.Map, category_name: str, category_pois: Dict[str, Tuple[float, float]], road_network: Optional[nx.MultiDiGraph], poi_layer: folium.FeatureGroup) -> Tuple[float, List[str], str]:
    style = CATEGORY_STYLES.get(category_name, CATEGORY_STYLES["default"])
    display_name = style.get("display_name", category_name.capitalize())
    route_feature_group_name = f"🛣️ {display_name} Rotası"
    route_fg = folium.FeatureGroup(name=route_feature_group_name, show=True)

    poi_coords_in_order = list(category_pois.values())
    route_path_coords, route_length_km, generation_warnings = generate_route_for_poi_order(road_network, poi_coords_in_order)

    for i, (poi_name, coord) in enumerate(category_pois.items()):
        # Öneri 2'ye göre: Google Maps URL'i daha standart bir formatla güncellendi.
        gmaps_search_url = f"https://maps.google.com/?q={coord[0]},{coord[1]}"
        
        popup_html = f"""
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 350px; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.15);">
            <div style="background: {style.get('gradient', style['color'])}; padding: 16px; color: white;">
                <h3 style="margin: 0 0 8px 0; font-size: 18px;">{style.get('emoji', '📍')} {poi_name}</h3>
                <p style="margin: 0; font-size: 13px; opacity: 0.95;">{style.get('description', '')}</p>
            </div>
            <div style="padding: 16px; background: white;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center; border-left: 3px solid {style['color']};">
                        <div style="font-size: 20px; font-weight: 700; color: {style['color']};">{i+1}</div>
                        <div style="font-size: 11px; color: #666; font-weight: 600;">DURAK SIRASI</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center; border-left: 3px solid {style['color']};">
                         <div style="font-size: 14px; font-weight: 700; color: #2c3e50;">{display_name.split(" ")[1]}</div>
                         <div style="font-size: 11px; color: #666; font-weight: 600;">KATEGORİ</div>
                    </div>
                </div>
                <div style="text-align: center;">
                    <a href="{gmaps_search_url}" target="_blank" rel="noopener noreferrer" style="background: {style['color']}; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; transition: all 0.3s ease; box-shadow: 0 4px 15px {style.get('shadow_color', 'rgba(0,0,0,0.2)')};">
                        <i class="fa fa-external-link-alt" style="margin-right: 8px;"></i> Google Maps'te Aç
                    </a>
                </div>
            </div>
        </div>
        """
        tooltip_html = f"<div style='background: {style['color']}; color: white; padding: 8px 12px; border-radius: 8px; font-family: sans-serif; box-shadow: 0 4px 12px {style.get('shadow_color', 'rgba(0,0,0,0.3)')};'><strong>{i+1}. {poi_name}</strong></div>"
        
        icon_to_use = plugins.BeautifyIcon(icon=style.get("icon", "info-circle"), icon_prefix=style.get("icon_prefix", "fa"), border_color=style["color"], background_color=style["color"], text_color="white", number=i + 1, icon_shape="marker")
        folium.Marker(location=coord, tooltip=folium.Tooltip(tooltip_html, sticky=True), popup=folium.Popup(popup_html, max_width=350), icon=icon_to_use).add_to(poi_layer)

    if route_path_coords and len(route_path_coords) >= 2:
        is_straight_line = any("düz çizgi kullanıldı" in w for w in generation_warnings)
        polyline_options = {"locations": route_path_coords, "color": style["color"], "weight": 6, "opacity": 0.8}
        if is_straight_line:
            polyline_options.update({"dash_array": '15, 10', "weight": 4, "opacity": 0.7})
        
        route_line = folium.PolyLine(**polyline_options)
        route_line.add_child(folium.Tooltip(f"🛣️ {display_name}: {route_length_km:.2f} km", sticky=False))
        route_line.add_to(route_fg)

    route_fg.add_to(folium_map)
    return route_length_km, generation_warnings, route_fg.get_name()

def add_enhanced_legend_and_controls(folium_map: folium.Map, processed_categories: List[Tuple[str, str, float, int]], map_js_var: str):
    legend_html = """
     <div id="legend-panel" style="position: fixed; bottom: 20px; left: 20px; width: 280px; background: rgba(255,255,255,0.9);
     border: 1px solid #ddd; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.12); z-index: 9999; font-family: 'Segoe UI', sans-serif;
     backdrop-filter: blur(10px); overflow: hidden;">
         <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 14px; color: white;">
             <h3 style="margin: 0; font-size: 16px; text-align: center;">🗺️ Rota Lejantı</h3>
         </div>
         <div id="categories-container" style="padding: 12px; max-height: 350px; overflow-y: auto;">
    """
    
    for cat_name, layer_var, length, poi_count in processed_categories:
        style = CATEGORY_STYLES.get(cat_name, CATEGORY_STYLES["default"])
        display_name = style.get("display_name", cat_name.capitalize())
        legend_html += f"""
        <div class="category-item" onclick="toggleLayer('{layer_var}', this)" style="display: flex; align-items: center; margin-bottom: 8px; padding: 10px; border-radius: 10px; cursor: pointer; transition: all 0.3s ease; border-left: 4px solid {style['color']}; background: #f8f9fa;">
             <div class="toggle-indicator" style="width: 10px; height: 10px; border-radius: 50%; background: {style['color']}; margin-right: 12px;"></div>
             <div style="flex: 1;">
                 <div style="font-weight: 600; font-size: 13px;">{display_name}</div>
                 <div style="font-size: 11px; color: #555;">{poi_count} Nokta | {length:.1f} km</div>
             </div>
        </div>
        """
    legend_html += "</div></div>"
    
    control_script = f"""
    <script>
        function toggleLayer(layerVarName, element) {{
            const layer = window[layerVarName];
            if (!layer) return;
            const indicator = element.querySelector('.toggle-indicator');
            if ({map_js_var}.hasLayer(layer)) {{
                {map_js_var}.removeLayer(layer);
                indicator.style.opacity = '0.3';
                element.style.background = '#f8f9fa';
            }} else {{
                {map_js_var}.addLayer(layer);
                indicator.style.opacity = '1';
                element.style.background = '#e9ecef';
            }}
        }}
    </script>
    <style>
        .category-item:hover {{ transform: scale(1.03); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }}
    </style>
    """
    folium_map.get_root().html.add_child(folium.Element(legend_html + control_script))

def add_enhanced_map_features(folium_map: folium.Map):
    """Gelişmiş harita özelliklerini ekler."""
    for tile_info in TILE_LAYERS:
        folium.TileLayer(
            tiles=tile_info['tiles'],
            attr=tile_info['attr'],
            name=tile_info['name'],
            overlay=False,
            control=True
        ).add_to(folium_map)
    
    plugins.Fullscreen(position="topleft", title="Tam Ekran", title_cancel="Tam Ekrandan Çık").add_to(folium_map)
    plugins.MeasureControl(position='bottomleft', primary_length_unit='kilometers').add_to(folium_map)
    plugins.MiniMap(toggle_display=True, position='bottomright').add_to(folium_map)
    folium.LayerControl(collapsed=False, position='topright').add_to(folium_map)

# --- Ana Fonksiyon ---
def main(selected_category: Optional[str], output_filename: str, graph_filepath: str, map_tiles: str, radius_km: float):
    folium_map = None  
    all_warnings = []
    try:
        print("✨ Kapadokya Gelişmiş Rota Oluşturucu Başlatılıyor ✨")
        
        categories_to_process = [selected_category] if selected_category and selected_category in POI_DATA else list(POI_DATA.keys())
        if selected_category and selected_category not in POI_DATA:
             print(f"⚠️ Seçilen '{selected_category}' kategorisi bulunamadı. Tüm kategoriler işleniyor.")

        all_poi_coords = [coord for cat in categories_to_process for coord in POI_DATA.get(cat, {}).values()]
        print(f"📍 Toplam {len(all_poi_coords)} POI koordinatı işlenecek...")
        
        _, distant_pois = detect_distant_pois(all_poi_coords)
        final_graph_filepath = "nevsehir_walking_high_res.graphml" if distant_pois else graph_filepath.replace(".graphml", "_high_res.graphml")

        road_network = load_road_network(final_graph_filepath, radius_km, all_poi_coords=all_poi_coords)
        
        default_tile_info = next((item for item in TILE_LAYERS if item['name'] == map_tiles), TILE_LAYERS[0])
        
        folium_map = folium.Map(location=URGUP_CENTER_LOCATION, zoom_start=DEFAULT_ZOOM_URGUP, tiles=default_tile_info['tiles'], attr=default_tile_info['attr'], prefer_canvas=True)
        
        poi_layer = folium.FeatureGroup(name="📍 Tüm POI Noktaları", show=True).add_to(folium_map)
        processed_categories_for_legend = []
        
        for cat_name in categories_to_process:
            category_pois = POI_DATA.get(cat_name)
            if not category_pois: continue

            print(f"\n🔄 '{CATEGORY_STYLES.get(cat_name, {}).get('display_name', cat_name.capitalize())}' kategorisi işleniyor...")
            route_len, cat_warnings, layer_var = add_poi_markers_and_route_to_map(folium_map, cat_name, category_pois, road_network, poi_layer)
            all_warnings.extend(cat_warnings)

            if route_len > 0 or len(category_pois) > 0:
                print(f"    ✅ {len(category_pois)} nokta ve rota eklendi: {route_len:.2f} km")
                processed_categories_for_legend.append((cat_name, layer_var, route_len, len(category_pois)))

        add_enhanced_map_features(folium_map)
        if processed_categories_for_legend:
            add_enhanced_legend_and_controls(folium_map, processed_categories_for_legend, folium_map.get_name())

        folium_map.save(output_filename)
        print(f"\n🎉 Harita başarıyla '{output_filename}' olarak kaydedildi!")

        if all_warnings:
            print("\n⚠️ Rota Oluşturma Bildirimleri:")
            for warning in sorted(set(all_warnings)):
                print(f"    • {warning}")

    except Exception as e_main:
        print(f"\n💥 KRİTİK HATA: {e_main}")
        traceback.print_exc()

# --- Komut Satırı Argümanları ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="🚶 Ürgüp Merkezli POI Yürüyüş Rota Oluşturucu 🗺️",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("category", nargs="?", choices=list(POI_DATA.keys()), default=None, help="İşlenecek POI kategorisi. Belirtilmezse tümü işlenir.")
    parser.add_argument("-o", "--output", default=None, help="Oluşturulacak HTML harita dosyasının adı.")
    parser.add_argument("-g", "--graphfile", default=DEFAULT_GRAPH_FILE_URGUP, help=f"Yol ağı GraphML dosyası. Varsayılan: '{DEFAULT_GRAPH_FILE_URGUP}'")
    parser.add_argument("-t", "--tiles", default=TILE_LAYERS[0]['name'], choices=[layer['name'] for layer in TILE_LAYERS], help="Harita için kullanılacak altlık. Varsayılan: 'Varsayılan (OpenStreetMap)'")
    parser.add_argument("-r", "--radius", type=float, default=DEFAULT_GRAPH_RADIUS_KM, help=f"Yol ağı indirme yarıçapı (km). Varsayılan: {DEFAULT_GRAPH_RADIUS_KM} km")
    
    args = parser.parse_args()

    if args.output is None:
        output_file = f"{args.category.lower() if args.category else 'tum_kategoriler'}_urgup_rotasi.html"
    else:
        output_file = args.output if args.output.lower().endswith(".html") else args.output + ".html"
        
    main(args.category, output_file, args.graphfile, args.tiles, args.radius)