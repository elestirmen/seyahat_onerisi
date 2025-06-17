import os

import folium
from folium import plugins
import osmnx as ox
import networkx as nx


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

# POI coordinates in Ürgüp (approximate)
pois = {
    "Turasan Şarap Evi": (38.6302, 34.9215),
    "Ürgüp Müzesi": (38.6323, 34.9116),
    "Temenni Tepesi": (38.6318, 34.9104),
    "Kadı Kalesi": (38.6351, 34.9089),
    "Asmalı Konak": (38.6346, 34.9128),
    "Ürgüp Otogarı": (38.6240, 34.9125),
}



# Base map centered around Ürgüp
m = folium.Map(location=[38.6310, 34.9130], zoom_start=13)

# Add POI markers with default icons
for name, (lat, lon) in pois.items():
    popup = folium.Popup(name, max_width=200)
    marker = folium.Marker(location=(lat, lon), tooltip=name, popup=popup)
    marker.add_to(m)

# Build routes using the road network if possible
G = load_graph()

if G:
    print("Yol ağı yüklendi, rotalar hesaplanıyor...")
    route1 = shortest_route(G, pois["Turasan Şarap Evi"][:2], pois["Kadı Kalesi"][:2])
    route2 = shortest_route(G, pois["Ürgüp Otogarı"][:2], pois["Kadı Kalesi"][:2])
else:
    print("Yol ağı bulunamadı, örnek koordinatlar kullanılacak.")
    # Approximations along main roads
    route1 = [
        pois["Turasan Şarap Evi"][:2],
        (38.6327, 34.9185),
        (38.6339, 34.9148),
        pois["Ürgüp Müzesi"][:2],
        (38.6327, 34.9110),
        pois["Temenni Tepesi"][:2],
        pois["Kadı Kalesi"][:2],
    ]

    route2 = [
        pois["Turasan Şarap Evi"][:2],
        (38.6270, 34.9170),
        pois["Ürgüp Otogarı"][:2],
        (38.6295, 34.9130),
        pois["Temenni Tepesi"][:2],
        (38.6320, 34.9120),
        pois["Kadı Kalesi"][:2],
    ]

fg1 = folium.FeatureGroup(name="Rota 1")
folium.PolyLine(route1, color="blue", weight=5, opacity=0.7, tooltip="Rota 1").add_to(fg1)
fg1.add_to(m)

fg2 = folium.FeatureGroup(name="Rota 2")
folium.PolyLine(route2, color="red", weight=5, opacity=0.7, tooltip="Rota 2").add_to(fg2)
fg2.add_to(m)

plugins.Draw(export=False).add_to(m)

# Optional layer control to toggle routes
folium.LayerControl(collapsed=False).add_to(m)

# Save map to HTML
m.save("urgup_rotalar.html")

print("Harita 'urgup_rotalar.html' olarak kaydedildi.")
