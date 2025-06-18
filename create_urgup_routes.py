import os
import folium
from folium import plugins # Seçildi
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

# POI coordinates in Ürgüp (approximate)
pois = {
    "Turasan Şarap Evi": (38.6302, 34.9215),
    "Ürgüp Müzesi": (38.6323, 34.9116),
    "Temenni Tepesi": (38.6318, 34.9104),
    "Kadı Kalesi": (38.6351, 34.9089),
    "Asmalı Konak": (38.6346, 34.9128),
    "Ürgüp Otogarı": (38.6240, 34.9125), # Seçildi (virgülle)
}

# Base map centered around Ürgüp
m = folium.Map(location=[38.6310, 34.9130], zoom_start=13)

# Add POI markers with default icons (Seçildi - daha detaylı)
for name, (lat, lon) in pois.items():
    popup = folium.Popup(name, max_width=200)
    marker = folium.Marker(location=(lat, lon), tooltip=name, popup=popup)
    marker.add_to(m)

# Build routes using the road network if possible
G = load_graph()

if G:
    print("Yol ağı yüklendi, rotalar hesaplanıyor...")
    # Seçildi ([:2] olmadan)
    route1 = shortest_route(G, pois["Turasan Şarap Evi"], pois["Kadı Kalesi"])
    route2 = shortest_route(G, pois["Ürgüp Otogarı"], pois["Kadı Kalesi"])
else:
    print("Yol ağı bulunamadı, örnek koordinatlar kullanılacak.")
    # Approximations along main roads
    route1 = [
        # Seçildi ([:2] olmadan)
        pois["Turasan Şarap Evi"],
        (38.6327, 34.9185),
        (38.6339, 34.9148),
        pois["Ürgüp Müzesi"],
        (38.6327, 34.9110),
        pois["Temenni Tepesi"],
        pois["Kadı Kalesi"],
    ]

    # Yedek Rota 2 için mantıksal düzeltme: Otogardan başlamalı
    route2 = [
        pois["Ürgüp Otogarı"], # Mantıksal düzeltme
        (38.6295, 34.9130),   # Otogar civarı bir nokta
        (38.6320, 34.9120),   # Temenni Tepesi civarı bir nokta
        pois["Kadı Kalesi"],
    ]

# Calculate route lengths
length1 = route_length(route1)
length2 = route_length(route2)

# Create FeatureGroups for routes, including their lengths in names and tooltips
# Original comment: # Seçildi (FeatureGroup, Draw plugin, LayerControl collapsed=False)
fg1_name = f"Rota 1 ({length1:.2f} km)"
fg1 = folium.FeatureGroup(name=fg1_name)
poly1 = folium.PolyLine(
    route1,
    color="blue",
    weight=5,
    opacity=0.7,
    tooltip=fg1_name,
    popup=folium.Popup(fg1_name, max_width=200),
)
poly1.add_to(fg1)
fg1.add_to(m)

fg2_name = f"Rota 2 ({length2:.2f} km)"
fg2 = folium.FeatureGroup(name=fg2_name)
poly2 = folium.PolyLine(
    route2,
    color="red",
    weight=5,
    opacity=0.7,
    tooltip=fg2_name,
    popup=folium.Popup(fg2_name, max_width=200),
)
poly2.add_to(fg2)
fg2.add_to(m)

# Capture layer variable names for custom legend
fg1_id = fg1.get_name()
fg2_id = fg2.get_name()

# Add Draw plugin
plugins.Draw(export=False).add_to(m)

# Add LayerControl to toggle routes and other layers
folium.LayerControl(collapsed=False).add_to(m)

# Custom clickable legend
legend_html = f"""
<div id='route-legend' style='position: fixed; bottom: 40px; left: 10px; z-index:9999; background: white; padding:10px; border:2px solid #ccc;'>
  <h4 style='margin:0 0 5px 0;'>Rotalar</h4>
  <label style='display:block; margin-bottom:4px;'>
    <input type='checkbox' checked onclick="toggleLayer('{fg1_id}')">
    <span style='color: blue;'>■</span> Rota 1
  </label>
  <label style='display:block;'>
    <input type='checkbox' checked onclick="toggleLayer('{fg2_id}')">
    <span style='color: red;'>■</span> Rota 2
  </label>
</div>
<script>
function toggleLayer(layerId) {{
  var layer = window[layerId];
  if (map.hasLayer(layer)) {{
    map.removeLayer(layer);
  }} else {{
    map.addLayer(layer);
  }}
}}
</script>
"""
m.get_root().html.add_child(folium.Element(legend_html))

# Save map to HTML
m.save("urgup_rotalar.html")

print("Harita 'urgup_rotalar.html' olarak kaydedildi.")