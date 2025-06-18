import os
import argparse
import folium
from folium import plugins, Html
import osmnx as ox
import networkx as nx
from math import atan2, cos, radians, sin, sqrt
from typing import List, Tuple, Dict, Optional, Any
import traceback # Hata ayıklama için

# --- Sabitler ve Konfigürasyon ---
URGUP_CENTER_LOCATION = (38.6310, 34.9130) # Ürgüp merkezi
DEFAULT_ZOOM_URGUP = 13 # Ürgüp merkezine odaklanmak için zoom
DEFAULT_GRAPH_FILE_URGUP = "urgup_merkez_driving.graphml" # Ürgüp'e özel graph dosyası
EARTH_RADIUS_KM = 6371.0

CATEGORY_STYLES = {
    "gastronomik": {"color": "red", "icon": "utensils", "icon_prefix": "fa"},
    "kulturel": {"color": "blue", "icon": "landmark", "icon_prefix": "fa"},
    "sanatsal": {"color": "green", "icon": "palette", "icon_prefix": "fa"},
    "doga_macera": {"color": "orange", "icon": "hiking", "icon_prefix": "fa"},
    "konaklama": {"color": "purple", "icon": "bed", "icon_prefix": "fa"},
    "default": {"color": "gray", "icon": "info-circle", "icon_prefix": "fa"} # DEĞİŞİKLİK: Glyphicon yerine FontAwesome
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
    feature_group_name = f"{category_name.capitalize()} Noktaları ve Rotası"
    fg = folium.FeatureGroup(name=feature_group_name, show=True) # Varsayılan olarak gösterilsin

    poi_coords_in_order = list(category_pois.values())
    route_path_coords, route_length_km, generation_warnings = generate_route_for_poi_order(road_network, poi_coords_in_order)

    for i, (poi_name, coord) in enumerate(category_pois.items()):
        gmaps_search_url = f"https://www.google.com/maps/search/?api=1&query={coord[0]},{coord[1]}"
        popup_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 280px;">
            <h4 style="margin-bottom: 5px; color: {style['color']};">{i+1}. {poi_name}</h4>
            <p style="margin: 2px 0;"><strong>Kategori:</strong> {category_name.capitalize()}</p>
            <p style="margin: 2px 0;"><strong>Koordinatlar:</strong> ({coord[0]:.5f}, {coord[1]:.5f})</p>
            <a href="{gmaps_search_url}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">Google Maps'te Görüntüle</a>
        </div>
        """
        icon_to_use = plugins.BeautifyIcon(
            icon=style.get("icon", "info-circle"), # Stil içinde ikon yoksa varsayılan kullan
            icon_prefix=style.get("icon_prefix", "fa"), # Stil içinde prefix yoksa varsayılan kullan
            icon_style=f"color:white; font-size:14px;",
            border_color=style["color"],
            background_color=style["color"],
            text_color="white",
            number=i + 1,
            icon_shape="marker"
        )
        folium.Marker(
            location=coord,
            tooltip=f"<b>{i+1}. {poi_name}</b><br>({category_name.capitalize()})",
            popup=folium.Popup(popup_html, max_width=300),
            icon=icon_to_use
        ).add_to(fg)

    route_tooltip = f"{category_name.capitalize()} Rotası: {route_length_km:.2f} km"
    is_straight_line_only_route = False
    if not road_network and len(poi_coords_in_order) >= 2: # Yol ağı yoksa ve en az 2 POI varsa, bu kesin düz çizgidir
        is_straight_line_only_route = True
        route_tooltip += " (Yol ağı yok - Düz Çizgi)"
    elif any("düz çizgi kullanıldı" in w for w in generation_warnings):
         route_tooltip += " (Bazı kısımlar düz çizgi)"
    
    # Sadece tek POI varsa veya hiç POI yoksa rota çizme
    if route_path_coords and len(route_path_coords) >= 2:
        # Eğer rota sadece iki noktadan oluşuyorsa ve bunlar orijinal POI'ler ise
        # ve yol ağı yoksa veya bir uyarıda "düz çizgi" geçiyorsa, kesikli çizgi kullan.
        # Bu, generate_route_for_poi_order'ın fallback davranışını yakalar.
        if len(route_path_coords) == 2 and route_path_coords[0] in poi_coords_in_order and route_path_coords[1] in poi_coords_in_order:
            if not road_network or any("düz çizgi kullanıldı" in w for w in generation_warnings):
                is_straight_line_only_route = True


        polyline_options = {
            "locations": route_path_coords,
            "color": style["color"],
            "weight": 5,
            "opacity": 0.8
        }
        if is_straight_line_only_route:
            polyline_options["dash_array"] = '10, 5'
            polyline_options["weight"] = 3
            polyline_options["opacity"] = 0.6

        poly = folium.PolyLine(**polyline_options)
        poly.add_child(folium.Popup(route_tooltip))
        poly.add_to(fg)
    elif len(poi_coords_in_order) == 1:
        # Tek POI varsa rota çizilmez, sadece marker eklenir. generation_warnings bu durumda boş olmalı.
        pass


    fg.add_to(folium_map)
    return route_length_km, generation_warnings, fg.get_name()

def add_custom_legend(folium_map: folium.Map, processed_categories: List[Tuple[str, str]], map_js_var: str):
    if not processed_categories: return

    legend_title = '<h4 style="margin-top:0; margin-bottom:5px; text-align:center; font-weight:bold; font-size:16px;">🗺️ Lejant</h4>'
    legend_html = f"""
     <div id="legend-container" style="position: fixed;
                 bottom: 20px; left: 10px; width: auto; min-width:180px; max_width: 220px;
                 border:2px solid #bbb; z-index:9999; font-size:12px;
                 background-color:rgba(255,255,255,0.95);
                 border-radius:8px; padding: 10px; box-shadow: 3px 3px 5px #888888;">
       <div style="text-align:right;"><a href="#" id="legend-toggle" style="text-decoration:none;">[X]</a></div>
       {legend_title}
       <ul style="list-style-type:none; padding-left:0; margin-bottom:0;">
    """
    # Sadece işlenen ve stili olan kategorileri lejantta göster
    categories_in_legend = set()

    for cat_name, layer_var in processed_categories:
        # Eğer kategori zaten lejantta varsa tekrar ekleme (çok olası değil ama önlem)
        if cat_name in categories_in_legend:
            continue

        style = CATEGORY_STYLES.get(cat_name) # Kategori için stili al
        if not style: # Eğer kategori için özel bir stil yoksa, default stili dene
            style = CATEGORY_STYLES.get("default")
        
        if style: # Stil bulunduysa (ya kategoriye özel ya da default)
            icon_html = ""
            icon_name = style.get("icon", "info-circle") # İkon adı yoksa varsayılan
            icon_prefix = style.get("icon_prefix", "fa") # Prefix yoksa varsayılan
            color = style.get("color", "gray") # Renk yoksa varsayılan

            if icon_prefix == "fa":
                icon_html = f'<i class="fa {icon_name}" style="color:{color}; font-size:16px; margin-right: 8px; vertical-align: middle;"></i>'
            elif icon_prefix == "glyphicon": # Artık kullanılmıyor ama kodda kalabilir
                 icon_html = f'<i class="glyphicon {icon_name}" style="color:{color}; font-size:14px; margin-right: 8px; vertical-align: middle;"></i>'
            
            legend_html += (
                f'<li onclick="toggleLayer(\'{layer_var}\', this)" '
                f'style="cursor:pointer; margin-bottom: 5px; display: flex; align-items: center;">'
                f'{icon_html}<span style="font-size:13px;">{cat_name.capitalize()}</span></li>'
            )
            categories_in_legend.add(cat_name)
        else:
            print(f"Uyarı: '{cat_name}' kategorisi için lejant stili bulunamadı (default dahil).")


    legend_html += "</ul></div>"
    toggle_script = f"""
    <script>
    function toggleLayer(layerVarName, el){{
        var layer = window[layerVarName];
        if(!layer) return;
        if({map_js_var}.hasLayer(layer)){{
            {map_js_var}.removeLayer(layer);
            if(el) el.style.opacity = 0.5;
        }}else{{
            {map_js_var}.addLayer(layer);
            if(el) el.style.opacity = 1.0;
        }}
    }}
    document.getElementById('legend-toggle').addEventListener('click', function(e){{
        e.preventDefault();
        var legend = document.getElementById('legend-container');
        if(legend.style.display === 'none') {{
            legend.style.display = 'block';
        }} else {{
            legend.style.display = 'none';
        }}
    }});
    </script>
    """
    folium_map.get_root().html.add_child(folium.Element(legend_html + toggle_script))

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
        print("✨ Ürgüp Merkezli Rota Oluşturucu Başlatılıyor ✨")

        road_network = load_road_network(graph_filepath, default_place_query_for_download="Ürgüp, Türkiye")
        
        folium_map = folium.Map(location=URGUP_CENTER_LOCATION, zoom_start=DEFAULT_ZOOM_URGUP, tiles=map_tiles)
        
        map_title_html = f'<h3 align="center" style="font-size:20px"><b>Kapadokya Rota Haritası: {selected_category.capitalize() if selected_category else "Tüm Kategoriler"}</b></h3>'
        folium_map.get_root().html.add_child(folium.Element(map_title_html))

        categories_to_process = []
        if selected_category:
            if selected_category in POI_DATA:
                categories_to_process.append(selected_category)
            else:
                print(f"Uyarı: Seçilen '{selected_category}' kategorisi POI verilerinde bulunamadı.")
        else:
            categories_to_process = list(POI_DATA.keys())
        
        processed_categories_for_legend = [] # Lejant için gerçekten işlenen kategoriler

        total_routes_length = 0
        total_pois_count = 0

        for cat_name in categories_to_process:
            category_pois = POI_DATA.get(cat_name) # .get() kullanımı daha güvenli
            if not category_pois:
                print(f"Bilgi: '{cat_name}' kategorisi için POI bulunmuyor veya kategori POI_DATA'da yok, atlanıyor.")
                continue

            print(f"\n➡️  '{cat_name.capitalize()}' kategorisi işleniyor...")
            route_len, cat_warnings, layer_var = add_poi_markers_and_route_to_map(folium_map, cat_name, category_pois, road_network)
            all_warnings.extend(cat_warnings)

            if route_len > 0 or len(category_pois) == 1 : # Tek POI varsa da bilgi ver
                # Rota uzunluğu 0 olabilir (örn: tek POI)
                if len(category_pois) > 1 and route_len > 0:
                     print(f"   '{cat_name.capitalize()}' rotası haritaya eklendi. Hesaplanan uzunluk: {route_len:.2f} km")
                elif len(category_pois) == 1:
                     print(f"   '{cat_name.capitalize()}' kategorisinden 1 nokta haritaya eklendi.")
                else: # Birden fazla POI var ama rota uzunluğu 0 (örn. tüm POI'ler aynı yerde)
                     print(f"   '{cat_name.capitalize()}' noktaları haritaya eklendi (rota uzunluğu {route_len:.2f} km).")

            else: # Hiç POI yoksa (yukarıdaki `if not category_pois:` ile yakalanmalı ama yine de)
                 print(f"   '{cat_name.capitalize()}' için gösterilecek nokta bulunamadı veya rota oluşturulamadı.")

            processed_categories_for_legend.append((cat_name, layer_var))  # Bu kategori işlendi ve lejantta olmalı
            total_routes_length += route_len
            total_pois_count += len(category_pois)

            if selected_category and cat_name == selected_category: # Sadece seçili kategori için detaylar
                print(f"\n--- '{selected_category.capitalize()}' Rota Detayları ---")
                print(f"  Toplam {len(category_pois)} nokta ziyaret edilecek:")
                for i, poi_name in enumerate(category_pois.keys()):
                    print(f"    {i+1}. {poi_name}")
                if route_len > 0 and len(category_pois) > 1:
                    print(f"  Hesaplanan Toplam Rota Uzunluğu: {route_len:.2f} km")
        
        plugins.Fullscreen(
            position="topright",
            title="Tam Ekran",
            title_cancel="Tam Ekrandan Çık",
            force_separate_button=True,
        ).add_to(folium_map)

        plugins.Draw(
            export=True, filename='cizimlerim.geojson',
            draw_options={
                'polyline': {'shapeOptions': {'color': '#007bff', 'weight': 5, 'opacity': 0.7}},
                'polygon': {'shapeOptions': {'color': '#28a745', 'fillColor': '#28a745', 'fillOpacity': 0.3}},
                'rectangle': {'shapeOptions': {'color': '#ffc107', 'fillColor': '#ffc107', 'fillOpacity': 0.3}},
                'circle': {'shapeOptions': {'color': '#dc3545', 'fillColor': '#dc3545', 'fillOpacity': 0.3}},
                'marker': {} 
            },
            edit_options={'edit': True, 'remove': True}
        ).add_to(folium_map)

        plugins.MeasureControl(
            position='bottomleft',
            primary_length_unit='kilometers',
            secondary_length_unit='miles',
            primary_area_unit='sqmeters',
            secondary_area_unit='acres'
        ).add_to(folium_map)
        
        plugins.MiniMap(toggle_display=True, position='bottomright', zoom_level_offset=-4).add_to(folium_map)


        if processed_categories_for_legend:  # Sadece gerçekten işlenen kategoriler için lejant
             add_custom_legend(folium_map, processed_categories_for_legend, folium_map.get_name())
        
        folium.LayerControl(collapsed=False, position='topright').add_to(folium_map)

        folium_map.save(output_filename)
        print(f"\n✅ Harita başarıyla '{output_filename}' olarak kaydedildi.")
        print(f"   Toplam {total_pois_count} nokta ve yaklaşık {total_routes_length:.2f} km rota işlendi.")

        if all_warnings:
            print("\n--- Rota Oluşturma Uyarıları/Bilgileri ---")
            unique_warnings = sorted(list(set(all_warnings)))
            for warning in unique_warnings:
                print(f"   {warning}")
        
        if not road_network:
            print("\n   ⚠️ ÖNEMLİ UYARI: Yol ağı yüklenemediği için tüm rotalar sadece düz çizgilerle (hava mesafesi) gösterilmiştir.")
        elif any("yol ağında rota bulunamadı" in w for w in all_warnings): # Daha spesifik kontrol
            print("\n   ⚠️ BİLGİ: Bazı noktalar arası yol ağında rota bulunamadığından düz çizgi kullanılmıştır.")
        elif road_network and not any("yol ağında rota bulunamadı" in w for w in all_warnings) and total_pois_count > 0:
             print("\n   ℹ️ Bilgi: Rotalar (uygun olanlar) Ürgüp yol ağı kullanılarak hesaplanmıştır.")


    except Exception as e_main:
        print(f"\n‼️‼️‼️ KRİTİK HATA main fonksiyonunda oluştu ‼️‼️‼️")
        print(f"Hata Mesajı: {e_main}")
        print("---------------- Traceback Başlangıcı ----------------")
        traceback.print_exc()
        print("----------------- Traceback Sonu -----------------")
        
        if folium_map is not None:
            try:
                error_html = f"""
                <div style="position: fixed; top: 10px; left: 10px; width: 300px; 
                            background-color: #ffdddd; border-left: 6px solid #f44336; 
                            padding: 10px; z-index: 10000; font-family: Arial, sans-serif;">
                    <h4>⛔ KRİTİK HATA OLUŞTU ⛔</h4>
                    <p>Harita oluşturulurken bir sorunla karşılaşıldı.</p>
                    <p><strong>Detay:</strong> {str(e_main)[:200]}...</p>
                    <p><small>Lütfen konsol loglarını kontrol edin.</small></p>
                </div>
                """
                folium_map.get_root().html.add_child(folium.Element(error_html))
                
                error_map_filename = output_filename.replace(".html", "_HATALI.html")
                folium_map.save(error_map_filename)
                print(f"\n⚠️ Hata ayıklama için kısmi harita '{error_map_filename}' olarak kaydedilmeye çalışıldı.")
            except Exception as e_save_error:
                print(f"⚠️ Hata haritası da kaydedilemedi: {e_save_error}")
        else:
            print("\n⚠️ Harita nesnesi oluşturulamadığı için hata haritası kaydedilemedi.")
            
    finally:
        print("\n✨ Program Tamamlandı (veya bir hata ile sonlandı) ✨")


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
