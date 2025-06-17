import os
import argparse
import folium
from folium import plugins
import osmnx as ox
import networkx as nx
from math import atan2, cos, radians, sin, sqrt


def load_graph(path="urgup_driving.graphml"):
    """Load road network from a GraphML file if available."""
    if os.path.exists(path):
        return ox.load_graphml(path)
    try:
        # Attempt to download if network access is permitted
        print("Ürgüp yol ağı indiriliyor (ilk çalıştırmada zaman alabilir)...")
        G = ox.graph_from_place("Ürgüp, Türkiye", network_type="drive")
        ox.save_graphml(G, filepath=path)
        print(f"Yol ağı '{path}' olarak kaydedildi.")
        return G
    except Exception as exc:
        print(f"Yol ağı indirilemedi veya kaydedilemedi: {exc}")
        print("Harita üzerinde düz çizgilerle rota gösterimi yapılacaktır.")
        return None


def shortest_route(G, origin, destination):
    """Return a list of coordinates representing the shortest route."""
    # Ensure origin and destination are (lat, lon)
    orig_node = ox.nearest_nodes(G, X=origin[1], Y=origin[0])
    dest_node = ox.nearest_nodes(G, X=destination[1], Y=destination[0])
    route = nx.shortest_path(G, orig_node, dest_node, weight="length")
    return [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in route]


def route_length(coords):
    """Approximate length of a route given as (lat, lon) coordinates in km."""
    R = 6371.0  # Earth radius in kilometers
    total_distance = 0.0
    for i in range(len(coords) - 1):
        lat1, lon1 = coords[i]
        lat2, lon2 = coords[i+1]
        
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        
        a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        distance = R * c
        total_distance += distance
    return total_distance


# Categorized POI coordinates in Ürgüp (approximate)
pois = {
    "gastronomik": {
        "Turasan Şarap Evi": (38.6302, 34.9215),
        "Ziggy Cafe": (38.6330, 34.9150),
        "Dimrit Cafe & Restaurant": (38.6332, 34.9153),
        "Sofra Restaurant": (38.6310, 34.9140),
        "Lagarto Restaurant": (38.6290, 34.9130),
        "Ürgüp Şarap Evi": (38.6285, 34.9170),
        "Tapu Cafe": (38.6320, 34.9165),
        "Fırın Express": (38.6315, 34.9155),
        "Kebap Evi": (38.6305, 34.9145),
        "Asmalı Konak Restaurant": (38.6346, 34.9128),
    },
    "kulturel": {
        "Ürgüp Müzesi": (38.6323, 34.9116),
        "Temenni Tepesi": (38.6318, 34.9104),
        "Kadı Kalesi": (38.6351, 34.9089),
        "Kapadokya Kültür Merkezi": (38.6280, 34.9120),
        "Ürgüp Kütüphanesi": (38.6314, 34.9122),
        "Mustafapaşa Medresesi": (38.6130, 34.8980), # Slightly outside Ürgüp center, for route diversity
        "Cappadocia Art & History Museum": (38.6115, 34.8975), # Near Mustafapaşa
        "Ürgüp Belediyesi": (38.6285, 34.9125),
        "Turasan Şarap Fabrikası": (38.6295, 34.9190), # Could be industrial but related to local culture
        "Ortahisar Kalesi": (38.6235, 34.8490), # Distinct location, good for routing
    },
    "sanatsal": {
        "Kapadokya Sanat Galerisi": (38.6325, 34.9135),
        "Peri Bacaları Fotoğraf Noktası": (38.6450, 34.9200), # A bit further for better route visualization
        "Ürgüp Tiyatro Salonu": (38.6300, 34.9100),
        "Sanat Atölyesi": (38.6335, 34.9095),
        "El Sanatları Merkezi": (38.6340, 34.9110),
        "Kapadokya Sanat ve Tarih Müzesi": (38.6110, 34.8970), # Same as Cappadocia Art & History, but for art focus
        "Seramik Atölyesi": (38.6338, 34.9132),
        "Ürgüp Fotoğraf Galerisi": (38.6322, 34.9148),
        "Halı Dokuma Atölyesi": (38.6318, 34.9158),
        "Kapadokya Konser Alanı": (38.6298, 34.9122),
    },
}


def compute_category_route(G, coordinates_list):
    """Return combined route and length visiting coordinates in order."""
    if not coordinates_list or len(coordinates_list) < 2:
        return coordinates_list, 0.0
    
    route_coords = []
    total_length = 0.0
    
    # Use the provided order of POIs for the route
    current_route_segment = [coordinates_list[0]] # Start with the first POI

    for i in range(len(coordinates_list) - 1):
        origin_coord = coordinates_list[i]
        dest_coord = coordinates_list[i+1]
        
        if G: # If graph is loaded, find shortest path on roads
            try:
                segment = shortest_route(G, origin_coord, dest_coord)
            except nx.NetworkXNoPath:
                print(f"Uyarı: {origin_coord} ile {dest_coord} arasında yol bulunamadı. Düz çizgi kullanılacak.")
                segment = [origin_coord, dest_coord]
            except Exception as e:
                print(f"Rota hesaplamada hata ({origin_coord} -> {dest_coord}): {e}. Düz çizgi kullanılacak.")
                segment = [origin_coord, dest_coord]
        else: # If no graph, draw straight lines
            segment = [origin_coord, dest_coord]
        
        segment_length = route_length(segment)
        total_length += segment_length
        
        # Append segment to the main route, avoiding duplicate points
        if not route_coords: # First segment
             route_coords.extend(segment)
        elif segment and segment[0] == route_coords[-1]:
            route_coords.extend(segment[1:])
        else:
            route_coords.extend(segment)
            
    return route_coords, total_length


def main(category=None):
    m = folium.Map(location=[38.6310, 34.9130], zoom_start=13, tiles="OpenStreetMap")
    color_map = {"gastronomik": "red", "kulturel": "blue", "sanatsal": "green"}

    # Determine which categories to process
    categories_to_process = [category] if category else list(pois.keys())

    G = load_graph() # Load graph once

    for cat_name in categories_to_process:
        if cat_name not in pois:
            print(f"Uyarı: Kategori '{cat_name}' POI listesinde bulunamadı, atlanıyor.")
            continue

        category_pois = pois[cat_name]
        # Get coordinates in the order they are defined in the pois dictionary
        # This assumes the order in the dictionary is the desired visitation order for the route.
        poi_coordinates = list(category_pois.values()) 

        if not poi_coordinates:
            print(f"Uyarı: '{cat_name}' kategorisi için POI bulunamadı.")
            continue

        # Compute route for this category
        route_path_coords, route_path_length = compute_category_route(G, poi_coordinates)
        
        feature_group_name = f"{cat_name.capitalize()} Rota ({route_path_length:.2f} km)"
        fg = folium.FeatureGroup(name=feature_group_name, show=True)

        # Add markers for POIs in this category
        for poi_name, (lat, lon) in category_pois.items():
            icon_color = color_map.get(cat_name, "gray") # Default to gray if category color not in map
            folium.Marker(
                location=(lat, lon),
                tooltip=f"{poi_name} ({cat_name.capitalize()})",
                icon=folium.Icon(color=icon_color, icon="info-sign")
            ).add_to(fg)

        # Add the route PolyLine for this category
        if route_path_coords and len(route_path_coords) >= 2:
            line_color = color_map.get(cat_name, "purple") # Default to purple for line
            folium.PolyLine(
                locations=route_path_coords,
                color=line_color,
                weight=5,
                opacity=0.7,
                tooltip=feature_group_name 
            ).add_to(fg)
        
        fg.add_to(m)

        # If a single category was specified (and it's the current one), print its details
        if category and cat_name == category:
            print(f"\n'{category.capitalize()}' kategorisi için rota detayları:")
            print("POI noktaları (ziyaret sırasına göre):")
            for poi_name_ordered in category_pois.keys(): # Print in defined order
                print(f"- {poi_name_ordered}")
            print(f"Toplam rota uzunluğu: {route_path_length:.2f} km")

    # Add map plugins
    plugins.Draw(export=False, draw_options={'polyline': True, 'polygon': False, 'rectangle': False, 'circle': False, 'marker': False, 'circlemarker': False}).add_to(m)
    plugins.Fullscreen().add_to(m)
    folium.LayerControl(collapsed=False).add_to(m)

    # Determine output filename
    output_filename = f"{category}_route.html" if category else "all_category_routes.html"
    m.save(output_filename)
    print(f"\nHarita '{output_filename}' olarak kaydedildi.")
    if not G:
        print("Not: Yol ağı yüklenemediği için rotalar düz çizgilerle gösterilmiştir.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ürgüp'teki ilgi çekici noktalar için kategorilere göre rota oluşturur ve harita üzerinde gösterir."
    )
    parser.add_argument(
        "category",
        nargs="?", # Makes the argument optional
        choices=list(pois.keys()), # Restrict choices to defined categories
        default=None, # If not provided, category will be None
        help=(
            "Belirli bir kategori için rota oluşturur (örn: gastronomik, kulturel, sanatsal). "
            "Belirtilmezse tüm kategoriler için ayrı ayrı rotalar oluşturulur."
        )
    )
    args = parser.parse_args()
    main(args.category)