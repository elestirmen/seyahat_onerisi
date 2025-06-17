import os
import folium
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
    "Ürgüp Otogarı": (38.6240, 34.9125)
}

# Base map centered around Ürgüp
m = folium.Map(location=[38.6310, 34.9130], zoom_start=13)

# Add POI markers
for name, coords in pois.items():
    folium.Marker(location=coords, popup=name).add_to(m)

# Build routes using the road network if possible
G = load_graph()

if G:
    print("Yol ağı yüklendi, rotalar hesaplanıyor...")
    route1 = shortest_route(G, pois["Turasan Şarap Evi"], pois["Kadı Kalesi"])
    route2 = shortest_route(G, pois["Ürgüp Otogarı"], pois["Kadı Kalesi"])
else:
    print("Yol ağı bulunamadı, örnek koordinatlar kullanılacak.")
    # Approximations along main roads
    route1 = [
        pois["Turasan Şarap Evi"],
        (38.6327, 34.9185),
        (38.6339, 34.9148),
        pois["Ürgüp Müzesi"],
        (38.6327, 34.9110),
        pois["Temenni Tepesi"],
        pois["Kadı Kalesi"],
    ]

    route2 = [
        pois["Turasan Şarap Evi"],
        (38.6270, 34.9170),
        pois["Ürgüp Otogarı"],
        (38.6295, 34.9130),
        pois["Temenni Tepesi"],
        (38.6320, 34.9120),
        pois["Kadı Kalesi"],
    ]

# Calculate route lengths
length1 = route_length(route1)
length2 = route_length(route2)

# Create route polylines and keep references for JS
route1_line = folium.PolyLine(route1, color="blue", weight=5, opacity=0.7, tooltip="Rota 1")
route2_line = folium.PolyLine(route2, color="red", weight=5, opacity=0.7, tooltip="Rota 2")
route1_line.add_to(m)
route2_line.add_to(m)

# Dropdown menu for selecting routes and showing length
dropdown_html = f"""
<div id='route-control' style='position: fixed; top: 10px; left: 10px; z-index:9999; background:white; padding:6px; border-radius:4px;'>
  <select id='route-select'>
    <option value='' selected>Rota Seçiniz</option>
    <option value='route1'>Rota 1</option>
    <option value='route2'>Rota 2</option>
  </select>
  <div id='route-length' style='margin-top:4px;'></div>
</div>
"""
m.get_root().html.add_child(folium.Element(dropdown_html))

script = f"""
document.addEventListener('DOMContentLoaded', function() {{
  var mapObj = {m.get_name()};
  var line1 = {route1_line.get_name()};
  var line2 = {route2_line.get_name()};
  mapObj.removeLayer(line1);
  mapObj.removeLayer(line2);
  var select = document.getElementById('route-select');
  var info = document.getElementById('route-length');
  select.addEventListener('change', function() {{
    mapObj.removeLayer(line1);
    mapObj.removeLayer(line2);
    if (this.value === 'route1') {{
      line1.addTo(mapObj);
      info.innerHTML = 'Uzunluk: {length1:.2f} km';
    }} else if (this.value === 'route2') {{
      line2.addTo(mapObj);
      info.innerHTML = 'Uzunluk: {length2:.2f} km';
    }} else {{
      info.innerHTML = '';
    }}
  }});
}});
"""
m.get_root().script.add_child(folium.Element(script))

# Save map to HTML
m.save("urgup_rotalar.html")

print("Harita 'urgup_rotalar.html' olarak kaydedildi.")
