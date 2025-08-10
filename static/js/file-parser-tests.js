/**
 * File Parser Tests
 * Unit tests for GPX, KML, and other file parsers
 */

// Mock File Parser Classes for testing
class GPXParser {
    static parse(fileContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(fileContent, 'text/xml');
            
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                throw new Error('Invalid XML format');
            }
            
            const tracks = xmlDoc.getElementsByTagName('trk');
            const waypoints = xmlDoc.getElementsByTagName('wpt');
            
            const routes = [];
            const pois = [];
            
            // Parse tracks (routes)
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                const name = track.getElementsByTagName('name')[0]?.textContent || `Track ${i + 1}`;
                const segments = track.getElementsByTagName('trkseg');
                
                const coordinates = [];
                for (let j = 0; j < segments.length; j++) {
                    const points = segments[j].getElementsByTagName('trkpt');
                    for (let k = 0; k < points.length; k++) {
                        const point = points[k];
                        const lat = parseFloat(point.getAttribute('lat'));
                        const lon = parseFloat(point.getAttribute('lon'));
                        if (!isNaN(lat) && !isNaN(lon)) {
                            coordinates.push([lon, lat]); // [lng, lat] for GeoJSON
                        }
                    }
                }
                
                if (coordinates.length > 0) {
                    routes.push({
                        name,
                        geometry: {
                            type: 'LineString',
                            coordinates
                        }
                    });
                }
            }
            
            // Parse waypoints (POIs)
            for (let i = 0; i < waypoints.length; i++) {
                const waypoint = waypoints[i];
                const lat = parseFloat(waypoint.getAttribute('lat'));
                const lon = parseFloat(waypoint.getAttribute('lon'));
                const name = waypoint.getElementsByTagName('name')[0]?.textContent || `Waypoint ${i + 1}`;
                const desc = waypoint.getElementsByTagName('desc')[0]?.textContent || '';
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    pois.push({
                        name,
                        description: desc,
                        latitude: lat,
                        longitude: lon,
                        category: 'doga_macera' // Default category for GPX waypoints
                    });
                }
            }
            
            return { routes, pois, waypoints: pois };
        } catch (error) {
            throw new Error(`GPX parsing failed: ${error.message}`);
        }
    }
}

class KMLParser {
    static parse(fileContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(fileContent, 'text/xml');
            
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                throw new Error('Invalid XML format');
            }
            
            const placemarks = xmlDoc.getElementsByTagName('Placemark');
            const routes = [];
            const pois = [];
            
            for (let i = 0; i < placemarks.length; i++) {
                const placemark = placemarks[i];
                const name = placemark.getElementsByTagName('name')[0]?.textContent || `Placemark ${i + 1}`;
                const desc = placemark.getElementsByTagName('description')[0]?.textContent || '';
                
                // Check for LineString (routes)
                const lineString = placemark.getElementsByTagName('LineString')[0];
                if (lineString) {
                    const coordinatesText = lineString.getElementsByTagName('coordinates')[0]?.textContent?.trim();
                    if (coordinatesText) {
                        const coordinates = coordinatesText.split(/\s+/).map(coord => {
                            const parts = coord.split(',');
                            const lon = parseFloat(parts[0]);
                            const lat = parseFloat(parts[1]);
                            return !isNaN(lon) && !isNaN(lat) ? [lon, lat] : null;
                        }).filter(coord => coord !== null);
                        
                        if (coordinates.length > 0) {
                            routes.push({
                                name,
                                description: desc,
                                geometry: {
                                    type: 'LineString',
                                    coordinates
                                }
                            });
                        }
                    }
                }
                
                // Check for Point (POIs)
                const point = placemark.getElementsByTagName('Point')[0];
                if (point) {
                    const coordinatesText = point.getElementsByTagName('coordinates')[0]?.textContent?.trim();
                    if (coordinatesText) {
                        const parts = coordinatesText.split(',');
                        const lon = parseFloat(parts[0]);
                        const lat = parseFloat(parts[1]);
                        
                        if (!isNaN(lon) && !isNaN(lat)) {
                            pois.push({
                                name,
                                description: desc,
                                latitude: lat,
                                longitude: lon,
                                category: 'kulturel' // Default category for KML points
                            });
                        }
                    }
                }
            }
            
            return { routes, pois, placemarks: pois };
        } catch (error) {
            throw new Error(`KML parsing failed: ${error.message}`);
        }
    }
}

// Make parsers globally available
window.GPXParser = GPXParser;
window.KMLParser = KMLParser;

// File Parser Tests
if (window.POIManagerTests && window.POIManagerTests.testFramework) {
    const testFramework = window.POIManagerTests.testFramework;

    /**
     * Test GPX Parser with valid data
     */
    testFramework.test('GPX Parser - Valid Track', () => {
        const gpxContent = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
    <trk>
        <name>Test Track</name>
        <trkseg>
            <trkpt lat="38.6431" lon="34.8331">
                <ele>1000</ele>
            </trkpt>
            <trkpt lat="38.6441" lon="34.8341">
                <ele>1010</ele>
            </trkpt>
            <trkpt lat="38.6451" lon="34.8351">
                <ele>1020</ele>
            </trkpt>
        </trkseg>
    </trk>
</gpx>`;

        const result = GPXParser.parse(gpxContent);
        
        testFramework.assertNotNull(result, 'Parser should return result');
        testFramework.assertEqual(result.routes.length, 1, 'Should parse 1 track');
        testFramework.assertEqual(result.routes[0].name, 'Test Track', 'Track name should be correct');
        testFramework.assertEqual(result.routes[0].geometry.coordinates.length, 3, 'Should have 3 track points');
        testFramework.assertEqual(result.routes[0].geometry.coordinates[0][0], 34.8331, 'First point longitude should be correct');
        testFramework.assertEqual(result.routes[0].geometry.coordinates[0][1], 38.6431, 'First point latitude should be correct');
    });

    /**
     * Test GPX Parser with waypoints
     */
    testFramework.test('GPX Parser - Waypoints', () => {
        const gpxContent = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
    <wpt lat="38.6431" lon="34.8331">
        <name>Test Waypoint 1</name>
        <desc>First test waypoint</desc>
    </wpt>
    <wpt lat="38.6441" lon="34.8341">
        <name>Test Waypoint 2</name>
        <desc>Second test waypoint</desc>
    </wpt>
</gpx>`;

        const result = GPXParser.parse(gpxContent);
        
        testFramework.assertEqual(result.pois.length, 2, 'Should parse 2 waypoints');
        testFramework.assertEqual(result.pois[0].name, 'Test Waypoint 1', 'First waypoint name should be correct');
        testFramework.assertEqual(result.pois[0].description, 'First test waypoint', 'First waypoint description should be correct');
        testFramework.assertEqual(result.pois[0].latitude, 38.6431, 'First waypoint latitude should be correct');
        testFramework.assertEqual(result.pois[0].longitude, 34.8331, 'First waypoint longitude should be correct');
    });

    /**
     * Test GPX Parser with invalid XML
     */
    testFramework.test('GPX Parser - Invalid XML', () => {
        const invalidGpx = 'This is not valid XML';
        
        testFramework.assertThrows(() => {
            GPXParser.parse(invalidGpx);
        }, 'Should throw error for invalid XML');
    });

    /**
     * Test KML Parser with valid data
     */
    testFramework.test('KML Parser - Valid LineString', () => {
        const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <Placemark>
            <name>Test Route</name>
            <description>A test route</description>
            <LineString>
                <coordinates>
                    34.8331,38.6431,0
                    34.8341,38.6441,0
                    34.8351,38.6451,0
                </coordinates>
            </LineString>
        </Placemark>
    </Document>
</kml>`;

        const result = KMLParser.parse(kmlContent);
        
        testFramework.assertNotNull(result, 'Parser should return result');
        testFramework.assertEqual(result.routes.length, 1, 'Should parse 1 route');
        testFramework.assertEqual(result.routes[0].name, 'Test Route', 'Route name should be correct');
        testFramework.assertEqual(result.routes[0].description, 'A test route', 'Route description should be correct');
        testFramework.assertEqual(result.routes[0].geometry.coordinates.length, 3, 'Should have 3 coordinates');
    });

    /**
     * Test KML Parser with Points
     */
    testFramework.test('KML Parser - Points', () => {
        const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <Placemark>
            <name>Test Point 1</name>
            <description>First test point</description>
            <Point>
                <coordinates>34.8331,38.6431,0</coordinates>
            </Point>
        </Placemark>
        <Placemark>
            <name>Test Point 2</name>
            <description>Second test point</description>
            <Point>
                <coordinates>34.8341,38.6441,0</coordinates>
            </Point>
        </Placemark>
    </Document>
</kml>`;

        const result = KMLParser.parse(kmlContent);
        
        testFramework.assertEqual(result.pois.length, 2, 'Should parse 2 points');
        testFramework.assertEqual(result.pois[0].name, 'Test Point 1', 'First point name should be correct');
        testFramework.assertEqual(result.pois[0].latitude, 38.6431, 'First point latitude should be correct');
        testFramework.assertEqual(result.pois[0].longitude, 34.8331, 'First point longitude should be correct');
    });

    /**
     * Test KML Parser with invalid XML
     */
    testFramework.test('KML Parser - Invalid XML', () => {
        const invalidKml = 'This is not valid XML';
        
        testFramework.assertThrows(() => {
            KMLParser.parse(invalidKml);
        }, 'Should throw error for invalid XML');
    });

    /**
     * Test File Type Detection
     */
    testFramework.test('File Type Detection', () => {
        const gpxFile = new File(['<gpx></gpx>'], 'test.gpx', { type: 'application/gpx+xml' });
        const kmlFile = new File(['<kml></kml>'], 'test.kml', { type: 'application/vnd.google-earth.kml+xml' });
        const textFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
        
        // Test file extensions
        testFramework.assertTrue(gpxFile.name.endsWith('.gpx'), 'GPX file should have .gpx extension');
        testFramework.assertTrue(kmlFile.name.endsWith('.kml'), 'KML file should have .kml extension');
        testFramework.assertFalse(textFile.name.endsWith('.gpx'), 'Text file should not have .gpx extension');
        testFramework.assertFalse(textFile.name.endsWith('.kml'), 'Text file should not have .kml extension');
        
        // Test MIME types
        testFramework.assertEqual(gpxFile.type, 'application/gpx+xml', 'GPX file should have correct MIME type');
        testFramework.assertEqual(kmlFile.type, 'application/vnd.google-earth.kml+xml', 'KML file should have correct MIME type');
    });

    /**
     * Test Large File Handling
     */
    testFramework.test('Large File Handling', () => {
        // Create a large GPX content string
        let largeGpxContent = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
    <trk>
        <name>Large Track</name>
        <trkseg>`;
        
        // Add 1000 track points
        for (let i = 0; i < 1000; i++) {
            const lat = 38.6431 + (i * 0.0001);
            const lon = 34.8331 + (i * 0.0001);
            largeGpxContent += `<trkpt lat="${lat}" lon="${lon}"><ele>${1000 + i}</ele></trkpt>`;
        }
        
        largeGpxContent += `
        </trkseg>
    </trk>
</gpx>`;

        const startTime = performance.now();
        const result = GPXParser.parse(largeGpxContent);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        testFramework.assertEqual(result.routes.length, 1, 'Should parse large track');
        testFramework.assertEqual(result.routes[0].geometry.coordinates.length, 1000, 'Should parse all 1000 points');
        testFramework.assertTrue(duration < 1000, `Large file parsing should complete in <1s (took ${duration}ms)`);
    });

    /**
     * Test Coordinate Validation
     */
    testFramework.test('Coordinate Validation', () => {
        const invalidGpxContent = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
    <wpt lat="invalid" lon="34.8331">
        <name>Invalid Latitude</name>
    </wpt>
    <wpt lat="38.6431" lon="invalid">
        <name>Invalid Longitude</name>
    </wpt>
    <wpt lat="38.6431" lon="34.8331">
        <name>Valid Point</name>
    </wpt>
</gpx>`;

        const result = GPXParser.parse(invalidGpxContent);
        
        // Should only parse the valid waypoint
        testFramework.assertEqual(result.pois.length, 1, 'Should only parse valid coordinates');
        testFramework.assertEqual(result.pois[0].name, 'Valid Point', 'Should parse the valid waypoint');
    });

    /**
     * Test Empty File Handling
     */
    testFramework.test('Empty File Handling', () => {
        const emptyGpx = '<?xml version="1.0"?><gpx version="1.1"></gpx>';
        const result = GPXParser.parse(emptyGpx);
        
        testFramework.assertEqual(result.routes.length, 0, 'Empty GPX should return no routes');
        testFramework.assertEqual(result.pois.length, 0, 'Empty GPX should return no POIs');
    });

    console.log('📁 File Parser Tests loaded successfully');
}
