import folium

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

# Example alternative routes (sample coordinates)
route1 = [
    pois["Turasan Şarap Evi"],
    pois["Asmalı Konak"],
    pois["Ürgüp Müzesi"],
    pois["Temenni Tepesi"],
    pois["Kadı Kalesi"],
]

route2 = [
    pois["Turasan Şarap Evi"],
    pois["Ürgüp Otogarı"],
    pois["Temenni Tepesi"],
    pois["Ürgüp Müzesi"],
    pois["Kadı Kalesi"],
]

folium.PolyLine(route1, color="blue", weight=5, opacity=0.7, tooltip="Rota 1").add_to(m)
folium.PolyLine(route2, color="red", weight=5, opacity=0.7, tooltip="Rota 2").add_to(m)

# Optional layer control to toggle routes
folium.LayerControl().add_to(m)

# Save map to HTML
m.save("urgup_rotalar.html")

print("Harita 'urgup_rotalar.html' olarak kaydedildi.")
