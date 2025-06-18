import os
import argparse
import folium
from folium import plugins, Html
import osmnx as ox
import networkx as nx
from math import atan2, cos, radians, sin, sqrt
from typing import List, Tuple, Dict, Optional, Any
import traceback # Hata ayıklama için
import json

# --- Sabitler ve Konfigürasyon ---
URGUP_CENTER_LOCATION = (38.6310, 34.9130) # Ürgüp merkezi
DEFAULT_ZOOM_URGUP = 13 # Ürgüp merkezine odaklanmak için zoom
DEFAULT_GRAPH_FILE_URGUP = "urgup_merkez_driving.graphml" # Ürgüp'e özel graph dosyası
EARTH_RADIUS_KM = 6371.0

CATEGORY_STYLES = {
    "gastronomik": {
        "color": "#e74c3c", 
        "icon": "utensils", 
        "icon_prefix": "fa",
        "display_name": "🍽️ Gastronomik",
        "description": "Restoranlar, kafeler ve lezzet noktaları"
    },
    "kulturel": {
        "color": "#3498db", 
        "icon": "landmark", 
        "icon_prefix": "fa",
        "display_name": "🏛️ Kültürel",
        "description": "Müzeler, tarihi yerler ve kültürel mekanlar"
    },
    "sanatsal": {
        "color": "#2ecc71", 
        "icon": "palette", 
        "icon_prefix": "fa",
        "display_name": "🎨 Sanatsal",
        "description": "Sanat galerileri, atölyeler ve yaratıcı mekanlar"
    },
    "doga_macera": {
        "color": "#f39c12", 
        "icon": "hiking", 
        "icon_prefix": "fa",
        "display_name": "🌿 Doğa & Macera",
        "description": "Doğal güzellikler ve macera aktiviteleri"
    },
    "konaklama": {
        "color": "#9b59b6", 
        "icon": "bed", 
        "icon_prefix": "fa",
        "display_name": "🏨 Konaklama",
        "description": "Oteller, pensiyonlar ve konaklama tesisleri"
    },
    "default": {
        "color": "#95a5a6", 
        "icon": "info-circle", 
        "icon_prefix": "fa",
        "display_name": "ℹ️ Diğer",
        "description": "Diğer ilgi çekici noktalar"
    }
}

POI_DATA: Dict[str, Dict[str, Tuple[float, float]]] = {
    "gastronomik": {
        "Ziggy Cafe & Restaurant (Ürgüp)": (38.63294, 34.91489),
        "Dimrit Cafe & Restaurant (Ürgüp)": (38.63309, 34.91522),
        "Sofra Restaurant (Ürgüp)": (38.63099, 34.91382),
        "Ehlikeyf Restaurant (Ürgüp)": (38.63188, 34.91307),
        "Lagarto Restaurant (Kayakapı Premium Caves - Ürgüp)": (38.62883, 34.91285),
        "Fırın Express Pide & Kebap (Ürgüp)": (38.63161, 34.91537),
        "Turasan Şarap Fabrikası Satış Yeri (Ürgüp)": (38.62939, 34.91888),
        "Old Greek House Restaurant (Mustafapaşa)": (38.57741, 34.89868),
        "Seki Restaurant (Argos in Cappadocia - Uçhisar)": (38.63072, 34.82845),
        "Lil'a Restaurant (Museum Hotel - Uçhisar)": (38.63191, 34.82682),
        "Elai Restaurant (Uçhisar)": (38.63143, 34.82939),
        "Topdeck Cave Restaurant (Göreme)": (38.64242, 34.82765),
        "Dibek Geleneksel Ev Yemekleri (Göreme)": (38.64278, 34.82817),
        "Seten Anatolian Cuisine (Göreme)": (38.64125, 34.82870),
        "Bizim Ev Restaurant (Avanos)": (38.71618, 34.84578),
        "Uranos Sarıkaya Restaurant (Avanos - Kaya Oyma)": (38.71186, 34.83597),
    },
    "kulturel": {
        "Ürgüp Müzesi": (38.63222, 34.91148),
        "Temenni Tepesi (Kadir Kalesi ve Kılıçarslan Gazi Türbesi - Ürgüp)": (38.63194, 34.91054),
        "Mustafapaşa (Sinasos) Köy Meydanı": (38.57593, 34.89694),
        "Aziz Konstantin Elena Kilisesi (Mustafapaşa)": (38.57678, 34.89655),
        "Gomeda Vadisi (Mustafapaşa Yakını)": (38.58790, 34.89010),
        "Ortahisar Kalesi": (38.63359, 34.85871),
        "Ortahisar Etnografya Müzesi": (38.63375, 34.85813),
        "Göreme Açık Hava Müzesi": (38.63941, 34.84433),
        "Tokalı Kilise (Göreme Açık Hava Müzesi Girişi)": (38.63989, 34.84304),
        "Zelve Açık Hava Müzesi": (38.68733, 34.85781),
        "Paşabağları (Rahipler Vadisi)": (38.67795, 34.85582),
        "Çavuşin Köyü Eski Camii ve Harabeler": (38.67691, 34.83385),
        "Vaftizci Yahya Kilisesi (Çavuşin)": (38.67553, 34.83351),
        "Derinkuyu Yeraltı Şehri": (38.37292, 34.73391),
        "Kaymaklı Yeraltı Şehri": (38.45895, 34.75184),
        "Özkonak Yeraltı Şehri": (38.76174, 34.83972),
        "Sobesos Antik Kenti (Şahinefendi Köyü)": (38.51995, 34.99783),
        "Kayseri Arkeoloji Müzesi": (38.71861, 35.48833),
    },
    "sanatsal": {
        "El Sanatları Çarşısı (Ürgüp Cumhuriyet Meydanı)": (38.63145, 34.91183),
        "Kapadokya Sanat ve El Sanatları Merkezi (Ürgüp)": (38.63102, 34.91251),
        "Kapadokya Sanat ve Tarih Müzesi (Bebek Müzesi - Mustafapaşa)": (38.57493, 34.89635),
        "Guray Seramik Müzesi (Avanos - Yeraltı Seramik Müzesi)": (38.71791, 34.84282),
        "Chez Galip Saç Müzesi ve Seramik Atölyesi (Avanos)": (38.71895, 34.84334),
        "Sarıhan Kervansarayı (Avanos Yolu - Derviş Gösterileri)": (38.74495, 34.79981),
        "Venessa Seramik (Avanos)": (38.71752, 34.84493),
        "Üç Güzeller Peri Bacaları (Ürgüp)": (38.65293, 34.93182),
        "Devrent Vadisi (Hayal Vadisi - Pembe Vadi)": (38.66981, 34.89985),
        "Güvercinlik Vadisi Manzara Noktası (Uçhisar)": (38.62995, 34.81983),
        "Aşk Vadisi (Bağlıdere Vadisi) Manzara Noktası": (38.65792, 34.82481),
        "Kızılçukur Vadisi Gün Batımı İzleme Noktası": (38.64983, 34.85974),
        "Ortahisar Panorama Seyir Terası": (38.63241, 34.85695),
    },
    "doga_macera": {
        "Ihlara Vadisi Başlangıç Noktası (Ihlara Köyü)": (38.24451, 34.30543),
        "Güllüdere Vadisi Yürüyüş Parkuru Girişi (Göreme Yakını)": (38.65495, 34.84481),
        "Zemi Vadisi Yürüyüş Parkuru (Göreme-Uçhisar arası)": (38.63493, 34.83785),
        "Pancarlık Vadisi ve Kilisesi (Ürgüp-Ortahisar arası)": (38.61502, 34.87363),
        "Soğanlı Vadisi (Yeşilhisar)": (38.41792, 34.99491),
        "Balon Turu Kalkış Alanları (Göreme çevresi - genel bir nokta)": (38.65005, 34.84998),
        "ATV Safari Tur Başlangıç Noktası (Göreme/Çavuşin - genel bir nokta)": (38.66996, 34.83997),
        "At Turu Çiftlikleri (Göreme/Avanos - genel bir nokta)": (38.66501, 34.83502),
        "Kızılırmak Üzerinde Gondol ve Jet Boat (Avanos Taş Köprü civarı)": (38.71583, 34.84485),
        "Erciyes Dağı Kayak Merkezi (Kayseri)": (38.54952, 35.48951),
    },
    "konaklama": {
        "Kayakapı Premium Caves - Special Class (Ürgüp)": (38.62879, 34.91248),
        "Yunak Evleri Cappadocia (Ürgüp)": (38.63381, 34.90784),
        "Esbelli Evi Cave Hotel (Ürgüp)": (38.62985, 34.90882),
        "Dere Suites Cappadocia (Ürgüp)": (38.63273, 34.90841),
        "Seraphim Cave Hotel (Ürgüp)": (38.60942, 34.90375),
        "Argos in Cappadocia (Uçhisar)": (38.63048, 34.82796),
        "Museum Hotel - Special Class (Uçhisar)": (38.63177, 34.82648),
        "CCR Cappadocia Cave Resort & Spa (Uçhisar)": (38.62699, 34.82499),
        "Sultan Cave Suites (Göreme)": (38.64148, 34.82797),
        "Mithra Cave Hotel (Göreme)": (38.64079, 34.82848),
        "Kelebek Special Cave Hotel & Spa (Göreme)": (38.64121, 34.82873),
        "Traveller's Cave Pension (Göreme)": (38.64042, 34.82743),
        "Hezen Cave Hotel (Ortahisar)": (38.63445, 34.85942),
        "Gamirasu Cave Hotel (Ayvalı Köyü - Mustafapaşa Yakını)": (38.58291, 34.93485),
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

def load_road_network(graph_file_path: str, default_place_query_for_download: str = "Ürgüp, Türkiye") -> Optional[nx.MultiDiGraph]:
    if os.path.exists(graph_file_path):
        print(f"'{graph_file_path}' dosyasından yol ağı yükleniyor...")
        try:
            return ox.load_graphml(graph_file_path)
        except Exception as e:
            print(f"HATA: '{graph_file_path}' yüklenemedi: {e}. Yeniden indirme denenecek.")
    
    print(f"'{graph_file_path}' bulunamadı/yüklenemedi. '{default_place_query_for_download}' için yol ağı indiriliyor...")
    try:
        G = ox.graph_from_place(default_place_query_for_download, network_type="drive", retain_all=True)
        print("Yol ağı indirildi. Kaydediliyor...")
        ox.save_graphml(G, filepath=graph_file_path)
        print(f"Yol ağı '{graph_file_path}' olarak kaydedildi.")
        return G
    except Exception as e:
        print(f"KRİTİK HATA: Yol ağı indirilemedi ({default_place_query_for_download}): {e}")
        print("Rota hesaplamaları sadece düz çizgilerle (hava mesafesi) yapılacaktır.")
        return None

def get_shortest_path_route_and_length(
    G: nx.MultiDiGraph,
    origin_coord: Tuple[float, float],
    destination_coord: Tuple[float, float]
) -> Tuple[List[Tuple[float, float]], float]:
    try:
        origin_node = ox.nearest_nodes(G, X=origin_coord[1], Y=origin_coord[0])
        destination_node = ox.nearest_nodes(G, X=destination_coord[1], Y=destination_coord[0])

        if origin_node == destination_node:
            return [origin_coord], 0.0

        route_nodes = nx.shortest_path(G, origin_node, destination_node, weight="length")
        route_length_meters = nx.shortest_path_length(G, origin_node, destination_node, weight="length")
        
        path_coords = [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in route_nodes]
        
        final_path_coords = []
        if path_coords:
            # Başlangıç POI'sini ekle (eğer yolun ilk noktasından çok farklıysa veya yol boşsa)
            if not final_path_coords or haversine_distance(path_coords[0], origin_coord) > 0.001:
                 final_path_coords.append(origin_coord)
            final_path_coords.extend(path_coords)
            # Bitiş POI'sini ekle (eğer yolun son noktasından çok farklıysa)
            if haversine_distance(path_coords[-1], destination_coord) > 0.001:
                 final_path_coords.append(destination_coord)
        else: # path_coords boşsa (çok nadir, ama olabilir)
            final_path_coords = [origin_coord, destination_coord]

        return final_path_coords, route_length_meters / 1000.0
    
    except (nx.NetworkXNoPath, Exception) as e:
        straight_path_coords = [origin_coord, destination_coord]
        straight_length_km = haversine_distance(origin_coord, destination_coord)
        return straight_path_coords, straight_length_km


def generate_route_for_poi_order(
    G: Optional[nx.MultiDiGraph],
    ordered_poi_coords: List[Tuple[float, float]]
) -> Tuple[List[Tuple[float, float]], float, List[str]]:
    if not ordered_poi_coords:
        return [], 0.0, []
    if len(ordered_poi_coords) < 2:
        # Tek POI varsa, rota sadece o POI'dir, uzunluk 0. Koordinatları bir liste içinde döndür.
        return [ordered_poi_coords[0]] if ordered_poi_coords else [], 0.0, []


    stitched_route_coords: List[Tuple[float, float]] = []
    total_actual_route_length_km = 0.0
    warnings = []

    for i in range(len(ordered_poi_coords) - 1):
        start_poi = ordered_poi_coords[i]
        end_poi = ordered_poi_coords[i+1]

        segment_coords: List[Tuple[float, float]]
        segment_actual_length_km: float

        if G:
            segment_coords, segment_actual_length_km = get_shortest_path_route_and_length(G, start_poi, end_poi)
            # Düz çizgi fallback kontrolü (get_shortest_path_route_and_length içinde zaten bu mantık var, burada sadece uyarı için)
            if len(segment_coords) == 2 and segment_coords[0] == start_poi and segment_coords[1] == end_poi:
                # Eğer segment_actual_length_km, haversine mesafesine çok yakınsa, bu düz çizgi demektir.
                if abs(segment_actual_length_km - haversine_distance(start_poi, end_poi)) < 0.001: # Küçük bir tolerans
                    warnings.append(f"Uyarı: ({start_poi[0]:.3f},{start_poi[1]:.3f}) <-> ({end_poi[0]:.3f},{end_poi[1]:.3f}) arası yol ağında rota bulunamadı, düz çizgi kullanıldı.")
        else:
            segment_coords = [start_poi, end_poi]
            segment_actual_length_km = haversine_distance(start_poi, end_poi)
            warnings.append(f"Bilgi: Yol ağı yüklenmediği için ({start_poi[0]:.3f},{start_poi[1]:.3f}) <-> ({end_poi[0]:.3f},{end_poi[1]:.3f}) arası düz çizgi kullanıldı.")


        total_actual_route_length_km += segment_actual_length_km

        if not segment_coords:
            warnings.append(f"Kritik Uyarı: {start_poi} <-> {end_poi} arası segment koordinatları boş döndü.")
            continue

        if not stitched_route_coords: # Eklenecek ilk segment ise
            stitched_route_coords.extend(segment_coords)
        else:
            # Önceki segmentin son noktası, yeni segmentin ilk noktasıyla aynıysa,
            # yeni segmentin ilk noktasını atla (tekrarlamayı önle).
            # Küçük bir toleransla karşılaştırma yapmak daha güvenli olabilir.
            if stitched_route_coords and segment_coords and \
               haversine_distance(stitched_route_coords[-1], segment_coords[0]) < 0.0001: # Çok küçük mesafe toleransı
                stitched_route_coords.extend(segment_coords[1:])
            else:
                stitched_route_coords.extend(segment_coords)
        
    return stitched_route_coords, total_actual_route_length_km, warnings

# --- Harita Oluşturma Fonksiyonları ---

def add_poi_markers_and_route_to_map(
    folium_map: folium.Map,
    category_name: str,
    category_pois: Dict[str, Tuple[float, float]],
    road_network: Optional[nx.MultiDiGraph]
) -> Tuple[float, List[str], str]:
    style = CATEGORY_STYLES.get(category_name, CATEGORY_STYLES["default"])
    display_name = style.get("display_name", category_name.capitalize())
    feature_group_name = f"{display_name}"
    fg = folium.FeatureGroup(name=feature_group_name, show=True)

    poi_coords_in_order = list(category_pois.values())
    route_path_coords, route_length_km, generation_warnings = generate_route_for_poi_order(road_network, poi_coords_in_order)

    # POI marker'larını ekle
    for i, (poi_name, coord) in enumerate(category_pois.items()):
        gmaps_search_url = f"https://www.google.com/maps/search/?api=1&query={coord[0]},{coord[1]}"
        
        # Gelişmiş popup HTML
        popup_html = f"""
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 320px; padding: 10px;">
            <div style="border-left: 4px solid {style['color']}; padding-left: 10px; margin-bottom: 10px;">
                <h3 style="margin: 0 0 5px 0; color: {style['color']}; font-size: 16px;">
                    {style.get('icon', '📍')} {poi_name}
                </h3>
                <p style="margin: 0; color: #666; font-size: 12px;">{style.get('description', '')}</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 8px; border-radius: 5px; margin-bottom: 10px;">
                <p style="margin: 2px 0; font-size: 13px;"><strong>📍 Sıra:</strong> {i+1}. durak</p>
                <p style="margin: 2px 0; font-size: 13px;"><strong>🗂️ Kategori:</strong> {display_name}</p>
                <p style="margin: 2px 0; font-size: 13px;"><strong>📊 Koordinat:</strong> {coord[0]:.5f}, {coord[1]:.5f}</p>
            </div>
            
            <div style="text-align: center;">
                <a href="{gmaps_search_url}" target="_blank" rel="noopener noreferrer" 
                   style="background-color: {style['color']}; color: white; padding: 8px 16px; 
                          border-radius: 20px; text-decoration: none; font-size: 12px; 
                          display: inline-block; transition: all 0.3s;">
                    🗺️ Google Maps'te Aç
                </a>
            </div>
        </div>
        """
        
        # Gelişmiş tooltip
        tooltip_html = f"""
        <div style="font-weight: bold; color: {style['color']}; font-size: 14px;">
            {i+1}. {poi_name}<br>
            <small style="color: #666;">{display_name}</small>
        </div>
        """
        
        icon_to_use = plugins.BeautifyIcon(
            icon=style.get("icon", "info-circle"),
            icon_prefix=style.get("icon_prefix", "fa"),
            icon_style=f"color:white; font-size:14px;",
            border_color=style["color"],
            background_color=style["color"],
            text_color="white",
            number=i + 1,
            icon_shape="marker"
        )
        
        folium.Marker(
            location=coord,
            tooltip=folium.Tooltip(tooltip_html, sticky=True),
            popup=folium.Popup(popup_html, max_width=350),
            icon=icon_to_use
        ).add_to(fg)

    # Rota çizgisini ekle (gelişmiş özelliklerle)
    if route_path_coords and len(route_path_coords) >= 2:
        is_straight_line = False
        route_type = "Yol Ağı Rotası"
        
        # Düz çizgi kontrolü
        if not road_network or any("düz çizgi kullanıldı" in w for w in generation_warnings):
            is_straight_line = True
            route_type = "Hava Mesafesi (Düz Çizgi)"
        
        # Rota detayları için popup
        route_popup_html = f"""
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 280px; padding: 15px;">
            <h3 style="margin: 0 0 10px 0; color: {style['color']}; text-align: center;">
                📍 {display_name} Rotası
            </h3>
            
            <div style="background: linear-gradient(135deg, {style['color']}20, {style['color']}10); 
                        padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                <p style="margin: 5px 0; font-size: 14px;"><strong>📏 Uzunluk:</strong> {route_length_km:.2f} km</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>🛣️ Tip:</strong> {route_type}</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>📍 Duraklar:</strong> {len(category_pois)} nokta</p>
                <p style="margin: 5px 0; font-size: 14px;"><strong>⏱️ Tahmini Süre:</strong> {int(route_length_km * 2)} dakika</p>
            </div>
            
            <div style="font-size: 12px; color: #666;">
                <p style="margin: 5px 0;"><strong>💡 İpucu:</strong> Marker'lara tıklayarak detayları görebilirsiniz</p>
                {'<p style="margin: 5px 0; color: #e74c3c;"><strong>⚠️</strong> Bazı bölümler düz çizgi olarak gösterilmiştir</p>' if is_straight_line else ''}
            </div>
        </div>
        """
        
        polyline_options = {
            "locations": route_path_coords,
            "color": style["color"],
            "weight": 6,
            "opacity": 0.8,
            "smooth_factor": 1.0
        }
        
        if is_straight_line:
            polyline_options.update({
                "dash_array": '15, 10',
                "weight": 4,
                "opacity": 0.7
            })
        
        route_line = folium.PolyLine(**polyline_options)
        route_line.add_child(folium.Popup(route_popup_html, max_width=300))
        
        # Hover tooltip for route
        route_tooltip = f"🛣️ {display_name}: {route_length_km:.2f} km ({route_type})"
        route_line.add_child(folium.Tooltip(route_tooltip, sticky=False))
        
        route_line.add_to(fg)

    fg.add_to(folium_map)
    return route_length_km, generation_warnings, fg.get_name()

def add_enhanced_legend_and_controls(folium_map: folium.Map, processed_categories: List[Tuple[str, str, float, int]], map_js_var: str):
    """Gelişmiş lejant ve kontrol paneli ekler"""
    if not processed_categories:
        return
    
    # İstatistikler
    total_length = sum(length for _, _, length, _ in processed_categories)
    total_pois = sum(pois for _, _, _, pois in processed_categories)
    
    # Ana lejant HTML
    legend_html = f"""
    <div id="legend-panel" style="position: fixed; top: 20px; right: 20px; width: 320px; 
                                  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                                  border: none; border-radius: 15px; box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                                  z-index: 9999; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                  backdrop-filter: blur(10px); overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    padding: 15px; color: white; position: relative;">
            <h3 style="margin: 0; font-size: 18px; text-align: center; font-weight: 600;">
                🗺️ Kapadokya Rota Rehberi
            </h3>
            <button id="legend-toggle" style="position: absolute; top: 15px; right: 15px; 
                                              background: rgba(255,255,255,0.2); border: none; 
                                              color: white; width: 30px; height: 30px; 
                                              border-radius: 50%; cursor: pointer; font-size: 16px;">
                ✕
            </button>
        </div>
        
        <!-- İstatistikler -->
        <div style="background: #f8f9fa; padding: 12px; border-bottom: 1px solid #e9ecef;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666;">
                <span><strong>📍 Toplam Nokta:</strong> {total_pois}</span>
                <span><strong>📏 Toplam Mesafe:</strong> {total_length:.1f} km</span>
            </div>
        </div>
        
        <!-- Kategoriler -->
        <div id="categories-container" style="padding: 15px; max-height: 400px; overflow-y: auto;">
    """
    
    for cat_name, layer_var, length, poi_count in processed_categories:
        style = CATEGORY_STYLES.get(cat_name, CATEGORY_STYLES["default"])
        display_name = style.get("display_name", cat_name.capitalize())
        description = style.get("description", "")
        
        legend_html += f"""
        <div class="category-item" onclick="toggleLayer('{layer_var}', this)" 
             style="background: white; margin-bottom: 10px; padding: 12px; border-radius: 10px; 
                    cursor: pointer; transition: all 0.3s; border-left: 4px solid {style['color']};
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'"
             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'">
            
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <i class="fa {style.get('icon', 'info-circle')}" 
                   style="color: {style['color']}; font-size: 18px; margin-right: 12px; width: 20px;"></i>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333; font-size: 14px;">{display_name}</div>
                    <div style="font-size: 11px; color: #888; margin-top: 2px;">{description}</div>
                </div>
                <div class="toggle-indicator" style="width: 12px; height: 12px; border-radius: 50%; 
                                                    background-color: {style['color']}; 
                                                    box-shadow: 0 0 0 2px white, 0 0 0 3px {style['color']};"></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666;">
                <span>📍 {poi_count} nokta</span>
                <span>📏 {length:.1f} km</span>
                <span>⏱️ ~{int(length * 2)} dk</span>
            </div>
        </div>
        """
    
    legend_html += f"""
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 12px; text-align: center; border-top: 1px solid #e9ecef;">
            <button onclick="toggleAllLayers()" 
                    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                           color: white; border: none; padding: 8px 16px; border-radius: 20px; 
                           font-size: 12px; cursor: pointer; font-weight: 500;">
                🔄 Tümünü Aç/Kapat
            </button>
        </div>
    </div>
    """
    
    # JavaScript kontrolcüleri
    control_script = f"""
    <script>
    let allLayersVisible = true;
    const layerStates = {{}};
    
    function toggleLayer(layerVarName, element) {{
        const layer = window[layerVarName];
        if (!layer) return;
        
        const indicator = element.querySelector('.toggle-indicator');
        const isVisible = {map_js_var}.hasLayer(layer);
        
        if (isVisible) {{
            {map_js_var}.removeLayer(layer);
            indicator.style.opacity = '0.3';
            element.style.opacity = '0.6';
            layerStates[layerVarName] = false;
        }} else {{
            {map_js_var}.addLayer(layer);
            indicator.style.opacity = '1';
            element.style.opacity = '1';
            layerStates[layerVarName] = true;
        }}
    }}
    
    function toggleAllLayers() {{
        allLayersVisible = !allLayersVisible;
        const categoryItems = document.querySelectorAll('.category-item');
        
        categoryItems.forEach(item => {{
            const layerVar = item.getAttribute('onclick').match(/'([^']+)'/)[1];
            const layer = window[layerVar];
            const indicator = item.querySelector('.toggle-indicator');
            
            if (allLayersVisible) {{
                if (!{map_js_var}.hasLayer(layer)) {{
                    {map_js_var}.addLayer(layer);
                }}
                indicator.style.opacity = '1';
                item.style.opacity = '1';
            }} else {{
                if ({map_js_var}.hasLayer(layer)) {{
                    {map_js_var}.removeLayer(layer);
                }}
                indicator.style.opacity = '0.3';
                item.style.opacity = '0.6';
            }}
        }});
    }}
    
    document.getElementById('legend-toggle').addEventListener('click', function(e) {{
        e.stopPropagation();
        const panel = document.getElementById('legend-panel');
        if (panel.style.display === 'none') {{
            panel.style.display = 'block';
            panel.style.animation = 'slideInRight 0.3s ease-out';
        }} else {{
            panel.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => panel.style.display = 'none', 300);
        }}
    }});
    
    // Animasyonlar
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {{
            from {{ transform: translateX(100%); opacity: 0; }}
            to {{ transform: translateX(0); opacity: 1; }}
        }}
        @keyframes slideOutRight {{
            from {{ transform: translateX(0); opacity: 1; }}
            to {{ transform: translateX(100%); opacity: 0; }}
        }}
        .category-item:hover {{
            transform: translateY(-2px) !important;
        }}
    `;
    document.head.appendChild(style);
    </script>
    """
    
    folium_map.get_root().html.add_child(folium.Element(legend_html + control_script))

def add_enhanced_map_features(folium_map: folium.Map):
    """Gelişmiş harita özelliklerini ekler"""
    
    # Tam ekran
    plugins.Fullscreen(
        position="topleft",
        title="🔍 Tam Ekran",
        title_cancel="❌ Tam Ekrandan Çık",
        force_separate_button=True,
    ).add_to(folium_map)
    
    # Çizim araçları
    plugins.Draw(
        export=True, 
        filename='kapadokya_cizimlerim.geojson',
        draw_options={
            'polyline': {'shapeOptions': {'color': '#3498db', 'weight': 4, 'opacity': 0.8}},
            'polygon': {'shapeOptions': {'color': '#2ecc71', 'fillColor': '#2ecc71', 'fillOpacity': 0.2}},
            'rectangle': {'shapeOptions': {'color': '#f39c12', 'fillColor': '#f39c12', 'fillOpacity': 0.2}},
            'circle': {'shapeOptions': {'color': '#e74c3c', 'fillColor': '#e74c3c', 'fillOpacity': 0.2}},
            'marker': {},
            'circlemarker': {}
        },
        edit_options={'edit': True, 'remove': True}
    ).add_to(folium_map)
    
    # Mesafe ölçüm
    plugins.MeasureControl(
        position='bottomleft',
        primary_length_unit='kilometers',
        secondary_length_unit='miles',
        primary_area_unit='sqkilometers',
        secondary_area_unit='sqmiles',
        completed_color='#e74c3c',
        active_color='#3498db'
    ).add_to(folium_map)
    
    # Mini harita
    plugins.MiniMap(
        toggle_display=True, 
        position='bottomright', 
        zoom_level_offset=-5,
        width=150, 
        height=150
    ).add_to(folium_map)
    
    # Gelişmiş katman kontrolü
    folium.LayerControl(
        collapsed=False, 
        position='topright'
    ).add_to(folium_map)

# --- Ana Fonksiyon ---
def main(
    selected_category: Optional[str],
    output_filename: str,
    graph_filepath: str,
    map_tiles: str
):
    folium_map = None 
    all_warnings = []
    try:
        print("✨ Kapadokya Gelişmiş Rota Oluşturucu Başlatılıyor ✨")

        road_network = load_road_network(graph_filepath, default_place_query_for_download="Ürgüp, Türkiye")
        
        # Gelişmiş harita oluşturma
        folium_map = folium.Map(
            location=URGUP_CENTER_LOCATION, 
            zoom_start=DEFAULT_ZOOM_URGUP, 
            tiles=map_tiles,
            prefer_canvas=True
        )
        
        # Gelişmiş başlık
        category_display = CATEGORY_STYLES.get(selected_category, {}).get("display_name", selected_category.capitalize()) if selected_category else "🌟 Tüm Kategoriler"
        map_title_html = f'''
        <div style="position: fixed; top: 20px; left: 20px; z-index: 1000; 
                    background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,249,250,0.95) 100%);
                    padding: 15px 25px; border-radius: 15px; 
                    box-shadow: 0 8px 32px rgba(0,0,0,0.1); backdrop-filter: blur(10px);
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <h2 style="margin: 0; color: #2c3e50; font-size: 20px; font-weight: 600;">
                🗺️ Kapadokya Rota Haritası
            </h2>
            <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 14px;">
                📍 {category_display}
            </p>
        </div>
        '''
        folium_map.get_root().html.add_child(folium.Element(map_title_html))

        categories_to_process = []
        if selected_category:
            if selected_category in POI_DATA:
                categories_to_process.append(selected_category)
            else:
                print(f"⚠️ Seçilen '{selected_category}' kategorisi POI verilerinde bulunamadı.")
        else:
            categories_to_process = list(POI_DATA.keys())
        
        processed_categories_for_legend = []
        total_routes_length = 0
        total_pois_count = 0

        for cat_name in categories_to_process:
            category_pois = POI_DATA.get(cat_name)
            if not category_pois:
                print(f"ℹ️ '{cat_name}' kategorisi için POI bulunmuyor, atlanıyor.")
                continue

            print(f"\n🔄 '{CATEGORY_STYLES.get(cat_name, {}).get('display_name', cat_name.capitalize())}' kategorisi işleniyor...")
            route_len, cat_warnings, layer_var = add_poi_markers_and_route_to_map(folium_map, cat_name, category_pois, road_network)
            all_warnings.extend(cat_warnings)

            if route_len > 0 or len(category_pois) == 1:
                if len(category_pois) > 1 and route_len > 0:
                    print(f"   ✅ Rota eklendi: {route_len:.2f} km, {len(category_pois)} nokta")
                elif len(category_pois) == 1:
                    print(f"   ✅ 1 nokta eklendi")
                else:
                    print(f"   ✅ {len(category_pois)} nokta eklendi (rota: {route_len:.2f} km)")

            processed_categories_for_legend.append((cat_name, layer_var, route_len, len(category_pois)))
            total_routes_length += route_len
            total_pois_count += len(category_pois)

            if selected_category and cat_name == selected_category:
                style = CATEGORY_STYLES.get(selected_category, {})
                display_name = style.get("display_name", selected_category.capitalize())
                print(f"\n📋 '{display_name}' Rota Detayları:")
                print(f"   📍 Ziyaret edilecek {len(category_pois)} nokta:")
                for i, poi_name in enumerate(category_pois.keys()):
                    print(f"      {i+1}. {poi_name}")
                if route_len > 0 and len(category_pois) > 1:
                    print(f"   📏 Toplam Rota Uzunluğu: {route_len:.2f} km")
                    print(f"   ⏱️ Tahmini Sürüş Süresi: {int(route_len * 2)} dakika")
        
        # Gelişmiş harita özelliklerini ekle
        add_enhanced_map_features(folium_map)
        
        # Gelişmiş lejant ve kontrolleri ekle
        if processed_categories_for_legend:
            add_enhanced_legend_and_controls(folium_map, processed_categories_for_legend, folium_map.get_name())

        folium_map.save(output_filename)
        print(f"\n🎉 Harita başarıyla '{output_filename}' olarak kaydedildi!")
        print(f"   📊 Toplam: {total_pois_count} nokta, {total_routes_length:.2f} km rota")
        print(f"   ⏱️ Toplam tahmini süre: {int(total_routes_length * 2)} dakika")

        if all_warnings:
            print(f"\n⚠️ Rota Oluşturma Bildirimleri ({len(set(all_warnings))} adet):")
            for warning in sorted(set(all_warnings))[:5]:  # İlk 5 uyarıyı göster
                print(f"   • {warning}")
            if len(set(all_warnings)) > 5:
                print(f"   ... ve {len(set(all_warnings)) - 5} uyarı daha")
        
        if not road_network:
            print("\n   ⚠️ Yol ağı yüklenemediği için rotalar düz çizgi olarak gösterildi")
        elif road_network and total_pois_count > 0:
            print("\n   ✅ Rotalar Ürgüp yol ağı kullanılarak hesaplandı")
            
        print(f"\n🎯 Kullanım İpuçları:")
        print(f"   • Sağ üstteki lejanttan kategorileri açıp kapatabilirsiniz")
        print(f"   • Rota çizgilerine tıklayarak detaylı bilgi alabilirsiniz")
        print(f"   • Marker'lara tıklayarak nokta detaylarını görebilirsiniz")
        print(f"   • Sol üstteki araçlarla haritada çizim yapabilirsiniz")

    except Exception as e_main:
        print(f"\n💥 KRİTİK HATA: {e_main}")
        traceback.print_exc()
        
        if folium_map is not None:
            try:
                error_html = f"""
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                            background: #fee; border: 2px solid #f66; border-radius: 10px;
                            padding: 20px; z-index: 10000; font-family: Arial, sans-serif;
                            box-shadow: 0 8px 32px rgba(244,67,54,0.3);">
                    <h3>💥 Hata Oluştu</h3>
                    <p>Harita oluşturulurken bir sorun yaşandı.</p>
                    <p><strong>Detay:</strong> {str(e_main)[:150]}...</p>
                    <p><small>Konsol loglarını kontrol edin.</small></p>
                </div>
                """
                folium_map.get_root().html.add_child(folium.Element(error_html))
                
                error_map_filename = output_filename.replace(".html", "_HATALI.html")
                folium_map.save(error_map_filename)
                print(f"\n⚠️ Kısmi harita '{error_map_filename}' olarak kaydedildi.")
            except Exception as e_save_error:
                print(f"⚠️ Hata haritası kaydedilemedi: {e_save_error}")
            
    finally:
        print("\n✨ Program tamamlandı ✨")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="📍 Ürgüp Merkezli POI Rota Oluşturucu 🗺️\n"
                    "Belirtilen kategorideki veya tüm kategorilerdeki ilgi çekici noktalar (POI) için "
                    "Ürgüp yol ağını kullanarak rotalar oluşturur ve interaktif bir harita üzerinde gösterir.\n"
                    "Yol ağı bulunamazsa veya bazı bağlantılar kurulamıyorsa, noktalar arası düz çizgiler kullanılır.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        "category", nargs="?",
        choices=list(POI_DATA.keys()) + [None], # None seçeneğini de choices'a ekleyebiliriz
        default=None,
        help="İşlenecek POI kategorisi (örn: gastronomik, kulturel).\n"
             "Belirtilmezse, tüm kategoriler için ayrı rotalar ve katmanlar oluşturulur."
    )
    parser.add_argument(
        "-o", "--output",
        default=None,
        help="Oluşturulacak HTML harita dosyasının adı.\n"
             "Varsayılan: '[kategori]_urgup_rotasi.html' veya 'tum_kategoriler_urgup_rotasi.html'"
    )
    parser.add_argument(
        "-g", "--graphfile",
        default=DEFAULT_GRAPH_FILE_URGUP,
        help=f"Yol ağı için kullanılacak GraphML dosyasının yolu.\n"
             f"Varsayılan: '{DEFAULT_GRAPH_FILE_URGUP}'\n(Eğer dosya yoksa, Ürgüp için otomatik olarak indirilir)."
    )
    parser.add_argument(
        "-t", "--tiles",
        default="OpenStreetMap",
        choices=["OpenStreetMap", "CartoDB positron", "CartoDB dark_matter", "Stamen Terrain", "Stamen Toner", "Stamen Watercolor", "Esri WorldImagery"],
        help="Harita için kullanılacak altlık (tile layer).\n"
             "Varsayılan: OpenStreetMap\n"
             "Diğer seçenekler: CartoDB positron, CartoDB dark_matter, Stamen Terrain, vb."
    )
    
    args = parser.parse_args()

    # Çıktı dosyası adını belirle
    if args.output is None:
        if args.category:
            output_file = f"{args.category.lower().replace(' ', '_')}_urgup_rotasi.html"
        else:
            output_file = "tum_kategoriler_urgup_rotasi.html"
    else:
        output_file = args.output
        if not output_file.lower().endswith(".html"):
            output_file += ".html"
            
    main(args.category, output_file, args.graphfile, args.tiles)
