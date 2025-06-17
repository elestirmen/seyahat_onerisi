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
        return ox.graph_from_place("Ürgüp, Türkiye", network_type="drive")
    except Exception as exc:
        print("Yol ağı indirilemedi:", exc)
        return None


def shortest_route(G, origin, destination):
    """Return a list of coordinates representing the shortest route."""
    orig_node = ox.nearest_nodes(G, origin[1], origin[0])
    dest_node = ox.nearest_nodes(G, destination[1], destination[0])
    route = nx.shortest_path(G, orig_node, dest_node, weight="length")
    return [(G.nodes[n]["y"], G.nodes[n]["x"]) for n in route]


def route_length(coords):
    """Approximate length of a route given as (lat, lon) coordinates in km."""
    R = 6371.0
    total = 0.0
    for (lat1, lon1), (lat2, lon2) in zip(coords, coords[1:]):
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        total += R * c
    return total


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
        "Mustafapaşa Medresesi": (38.6130, 34.8980),
        "Cappadocia Art & History Museum": (38.6115, 34.8975),
        "Ürgüp Belediyesi": (38.6285, 34.9125),
        "Turasan Şarap Fabrikası": (38.6295, 34.9190),
        "Ortahisar Kalesi": (38.6235, 34.8490),
    },
    "sanatsal": {
        "Kapadokya Sanat Galerisi": (38.6325, 34.9135),
        "Peri Bacaları Fotoğraf Noktası": (38.6320, 34.9180),
        "Ürgüp Tiyatro Salonu": (38.6300, 34.9100),
        "Sanat Atölyesi": (38.6335, 34.9095),
        "El Sanatları Merkezi": (38.6340, 34.9110),
        "Kapadokya Sanat ve Tarih Müzesi": (38.6110, 34.8970),
        "Seramik Atölyesi": (38.6338, 34.9132),
        "Ürgüp Fotoğraf Galerisi": (38.6322, 34.9148),
        "Halı Dokuma Atölyesi": (38.6318, 34.9158),
        "Kapadokya Konser Alanı": (38.6298, 34.9122),
    },
}


def compute_category_route(G, coordinates):
    """Return combined route and length visiting coordinates in order."""
    if len(coordinates) < 2:
        return coordinates, 0.0
    route_coords = []
    total_length = 0.0
    points = list(coordinates)
    for origin, dest in zip(points, points[1:]):
        if G:
            segment = shortest_route(G, origin, dest)
        else:
            segment = [origin, dest]
        total_length += route_length(segment)
        if route_coords and segment[0] == route_coords[-1]:
            route_coords.extend(segment[1:])
        else:
            route_coords.extend(segment)
    return route_coords, total_length


def main(category=None):
    m = folium.Map(location=[38.6310, 34.9130], zoom_start=13)
    color_map = {"gastronomik": "red", "kulturel": "blue", "sanatsal": "green"}

    selected = [category] if category else list(pois.keys())

    G = load_graph()

    for cat in selected:
        items = pois[cat]
        coords = list(items.values())
        route, length = compute_category_route(G, coords)
        fg_name = f"{cat.capitalize()} Rota ({length:.2f} km)"
        fg = folium.FeatureGroup(name=fg_name)
        for name, (lat, lon) in items.items():
            icon = folium.Icon(color=color_map.get(cat, "gray"), icon="info-sign")
            folium.Marker(location=(lat, lon), tooltip=name, icon=icon).add_to(fg)
        folium.PolyLine(route, color=color_map.get(cat, "purple"), weight=5, opacity=0.7,
                        tooltip=fg_name).add_to(fg)
        fg.add_to(m)

    plugins.Draw(export=False).add_to(m)
    folium.LayerControl(collapsed=False).add_to(m)

    output = f"{category}_route.html" if category else "category_routes.html"
    m.save(output)
    print(f"Harita '{output}' olarak kaydedildi.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Kategoriye göre Ürgüp rotası oluştur")
    parser.add_argument("category", nargs="?", choices=pois.keys(),
                        help="Sadece belirtilen kategori için rota oluştur")
    args = parser.parse_args()
    main(args.category)
