#!/usr/bin/env python3
"""
Integration test for Route File Parser
Demonstrates parsing of sample route files
"""

import tempfile
import os
import zipfile
from route_file_parser import RouteFileParser, RouteParserError


def create_sample_gpx():
    """Create a sample GPX file for testing"""
    gpx_content = '''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Kapadokya Route Planner" xmlns="http://www.topografix.com/GPX/1/1">
    <metadata>
        <name>Ürgüp - Göreme Yürüyüş Rotası</name>
        <desc>Ürgüp merkezinden Göreme'ye doğru güzel bir yürüyüş rotası</desc>
        <time>2024-01-15T09:00:00Z</time>
    </metadata>
    <trk>
        <name>Ana Rota</name>
        <desc>Peribacaları arasından geçen ana yürüyüş rotası</desc>
        <trkseg>
            <trkpt lat="38.6431" lon="34.8213">
                <ele>1200</ele>
                <time>2024-01-15T09:00:00Z</time>
            </trkpt>
            <trkpt lat="38.6441" lon="34.8223">
                <ele>1210</ele>
                <time>2024-01-15T09:15:00Z</time>
            </trkpt>
            <trkpt lat="38.6451" lon="34.8233">
                <ele>1220</ele>
                <time>2024-01-15T09:30:00Z</time>
            </trkpt>
            <trkpt lat="38.6461" lon="34.8243">
                <ele>1215</ele>
                <time>2024-01-15T09:45:00Z</time>
            </trkpt>
            <trkpt lat="38.6471" lon="34.8253">
                <ele>1205</ele>
                <time>2024-01-15T10:00:00Z</time>
            </trkpt>
        </trkseg>
    </trk>
    <wpt lat="38.6436" lon="34.8218">
        <name>Manzara Noktası</name>
        <desc>Güzel manzara için durulacak nokta</desc>
        <ele>1205</ele>
    </wpt>
    <wpt lat="38.6456" lon="34.8238">
        <name>Dinlenme Alanı</name>
        <desc>Gölgeli dinlenme alanı</desc>
        <ele>1218</ele>
    </wpt>
</gpx>'''
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.gpx', delete=False) as f:
        f.write(gpx_content)
        return f.name


def create_sample_kml():
    """Create a sample KML file for testing"""
    kml_content = '''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>Kapadokya Balon Turu Rotası</name>
        <description>Sıcak hava balonu ile yapılan tur rotası</description>
        <ExtendedData>
            <Data name="distance">
                <value>5500.0</value>
            </Data>
            <Data name="creator">
                <value>Kapadokya Balon Turları</value>
            </Data>
            <Data name="type">
                <value>balloon</value>
            </Data>
        </ExtendedData>
        <Placemark>
            <name>Balon Rota Hattı</name>
            <description>Ana balon uçuş rotası</description>
            <LineString>
                <coordinates>
                    34.8213,38.6431,1200
                    34.8223,38.6441,1210
                    34.8233,38.6451,1220
                    34.8243,38.6461,1215
                    34.8253,38.6471,1205
                </coordinates>
            </LineString>
        </Placemark>
        <Placemark>
            <name>Kalkış Noktası</name>
            <description>Balonların kalkış yaptığı alan</description>
            <Point>
                <coordinates>34.8213,38.6431,1200</coordinates>
            </Point>
        </Placemark>
        <Placemark>
            <name>İniş Noktası</name>
            <description>Balonların iniş yaptığı alan</description>
            <Point>
                <coordinates>34.8253,38.6471,1205</coordinates>
            </Point>
        </Placemark>
    </Document>
</kml>'''
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.kml', delete=False) as f:
        f.write(kml_content)
        return f.name


def create_sample_kmz():
    """Create a sample KMZ file for testing"""
    kml_content = '''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>Avanos Çömlek Atölyesi Turu</name>
        <description>Avanos'ta çömlek atölyelerini gezen tur rotası</description>
        <Placemark>
            <name>Tur Rotası</name>
            <LineString>
                <coordinates>
                    34.8413,38.7131,950
                    34.8423,38.7141,955
                    34.8433,38.7151,960
                    34.8443,38.7161,965
                </coordinates>
            </LineString>
        </Placemark>
        <Placemark>
            <name>Chez Galip Saç Müzesi</name>
            <description>Ünlü saç müzesi</description>
            <Point>
                <coordinates>34.8418,38.7136,952</coordinates>
            </Point>
        </Placemark>
        <Placemark>
            <name>Avanos Çömlek Atölyesi</name>
            <description>Geleneksel çömlek yapım atölyesi</description>
            <Point>
                <coordinates>34.8438,38.7156,962</coordinates>
            </Point>
        </Placemark>
    </Document>
</kml>'''
    
    with tempfile.NamedTemporaryFile(suffix='.kmz', delete=False) as kmz_file:
        with zipfile.ZipFile(kmz_file, 'w') as zf:
            zf.writestr('doc.kml', kml_content)
            # Add a sample image file to demonstrate media handling
            zf.writestr('images/pottery.jpg', b'fake image data')
        return kmz_file.name


def test_parser_integration():
    """Test the complete parser integration"""
    parser = RouteFileParser()
    
    print("🧪 Route File Parser Integration Test")
    print("=" * 50)
    
    # Test GPX parsing
    print("\n📍 GPX Dosyası Test Ediliyor...")
    gpx_file = create_sample_gpx()
    try:
        gpx_result = parser.parse_file(gpx_file)
        print(f"✅ GPX başarıyla parse edildi")
        print(f"   📝 Rota adı: {gpx_result.metadata.name}")
        print(f"   📏 Nokta sayısı: {len(gpx_result.points)}")
        print(f"   📍 Waypoint sayısı: {len(gpx_result.waypoints)}")
        print(f"   📐 Mesafe: {gpx_result.metadata.distance:.1f}m" if gpx_result.metadata.distance else "   📐 Mesafe: Hesaplanmadı")
        
        # Test metadata extraction
        metadata = parser.extract_metadata(gpx_result)
        print(f"   🔍 Dosya hash: {metadata['file_hash'][:16]}...")
        
    except RouteParserError as e:
        print(f"❌ GPX parse hatası: {e.message}")
    finally:
        os.unlink(gpx_file)
    
    # Test KML parsing
    print("\n🗺️  KML Dosyası Test Ediliyor...")
    kml_file = create_sample_kml()
    try:
        kml_result = parser.parse_file(kml_file)
        print(f"✅ KML başarıyla parse edildi")
        print(f"   📝 Rota adı: {kml_result.metadata.name}")
        print(f"   📏 Nokta sayısı: {len(kml_result.points)}")
        print(f"   📍 Waypoint sayısı: {len(kml_result.waypoints)}")
        print(f"   👤 Oluşturan: {kml_result.metadata.creator}")
        print(f"   🏷️  Tür: {kml_result.metadata.route_type}")
        print(f"   📐 Mesafe: {kml_result.metadata.distance:.1f}m" if kml_result.metadata.distance else "   📐 Mesafe: Hesaplanmadı")
        
    except RouteParserError as e:
        print(f"❌ KML parse hatası: {e.message}")
    finally:
        os.unlink(kml_file)
    
    # Test KMZ parsing
    print("\n📦 KMZ Dosyası Test Ediliyor...")
    kmz_file = create_sample_kmz()
    try:
        kmz_result = parser.parse_file(kmz_file)
        print(f"✅ KMZ başarıyla parse edildi")
        print(f"   📝 Rota adı: {kmz_result.metadata.name}")
        print(f"   📏 Nokta sayısı: {len(kmz_result.points)}")
        print(f"   📍 Waypoint sayısı: {len(kmz_result.waypoints)}")
        print(f"   📐 Mesafe: {kmz_result.metadata.distance:.1f}m" if kmz_result.metadata.distance else "   📐 Mesafe: Hesaplanmadı")
        
    except RouteParserError as e:
        print(f"❌ KMZ parse hatası: {e.message}")
    finally:
        os.unlink(kmz_file)
    
    # Test POI suggestion functionality
    print("\n🎯 POI Önerisi Test Ediliyor...")
    if 'gpx_result' in locals():
        # Create sample POI data
        sample_pois = [
            {
                'id': 1,
                'name': 'Göreme Açık Hava Müzesi',
                'category': 'müze',
                'latitude': 38.6445,
                'longitude': 34.8225
            },
            {
                'id': 2,
                'name': 'Uchisar Kalesi',
                'category': 'tarihi_yer',
                'latitude': 38.6365,
                'longitude': 34.8105
            },
            {
                'id': 3,
                'name': 'Çok Uzak POI',
                'category': 'diğer',
                'latitude': 39.0000,
                'longitude': 35.0000
            }
        ]
        
        # Extract route coordinates
        route_coords = [(p.latitude, p.longitude) for p in gpx_result.points]
        
        # Get POI suggestions
        suggestions = parser.suggest_pois(route_coords, sample_pois, max_distance=2000)
        
        print(f"   🎯 {len(suggestions)} POI önerisi bulundu:")
        for suggestion in suggestions:
            print(f"      • {suggestion['name']} ({suggestion['category']})")
            print(f"        📏 Rotaya uzaklık: {suggestion['distance_from_route']:.1f}m")
            print(f"        ⭐ Uyumluluk skoru: {suggestion['compatibility_score']:.1f}")
    
    # Test validation functionality
    print("\n✅ Veri Validasyonu Test Ediliyor...")
    
    # Valid data
    valid_data = {
        'points': [
            {'latitude': 38.6431, 'longitude': 34.8213},
            {'latitude': 38.6441, 'longitude': 34.8223}
        ],
        'metadata': {
            'name': 'Test Route',
            'description': 'Test description'
        }
    }
    
    validation_result = parser.validate_route_data(valid_data)
    print(f"   ✅ Geçerli veri validasyonu: {'Başarılı' if validation_result['is_valid'] else 'Başarısız'}")
    
    # Invalid data
    invalid_data = {
        'points': [
            {'latitude': 91, 'longitude': 181}  # Invalid coordinates
        ]
    }
    
    validation_result = parser.validate_route_data(invalid_data)
    print(f"   ❌ Geçersiz veri validasyonu: {'Başarılı' if not validation_result['is_valid'] else 'Başarısız'}")
    print(f"      Hata sayısı: {validation_result['error_count']}")
    
    print("\n🎉 Integration test tamamlandı!")


if __name__ == "__main__":
    test_parser_integration()