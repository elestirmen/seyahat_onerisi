from flask import Flask, request, jsonify
from flask_cors import CORS
from poi_database_adapter import POIDatabaseFactory
import os

app = Flask(__name__)
CORS(app)

def get_db():
    db_type = os.environ.get('POI_DB_TYPE', 'mongodb')
    connection_string = os.environ.get('POI_DB_CONNECTION', 'mongodb://localhost:27017/')
    database_name = os.environ.get('POI_DB_NAME', 'poi_db')
    db = POIDatabaseFactory.create_database(
        db_type,
        connection_string=connection_string,
        database_name=database_name
    )
    db.connect()
    return db

@app.route('/api/pois', methods=['GET'])
def list_pois():
    db = get_db()
    category = request.args.get('category')
    if category:
        pois = db.get_pois_by_category(category)
        db.disconnect()
        return jsonify(pois)
    # Tüm kategorilerdeki POI'leri döndür
    categories = ['gastronomik', 'kulturel', 'sanatsal', 'doga_macera', 'konaklama']
    all_pois = {}
    for cat in categories:
        all_pois[cat] = db.get_pois_by_category(cat)
    db.disconnect()
    return jsonify(all_pois)

@app.route('/api/poi/<poi_id>', methods=['GET'])
def get_poi(poi_id):
    db = get_db()
    details = db.get_poi_details(poi_id)
    db.disconnect()
    if details:
        return jsonify(details)
    return jsonify({'error': 'POI not found'}), 404

@app.route('/api/poi', methods=['POST'])
def add_poi():
    db = get_db()
    poi_data = request.json
    poi_id = db.add_poi(poi_data)
    db.disconnect()
    return jsonify({'id': poi_id}), 201

@app.route('/api/poi/<poi_id>', methods=['PUT'])
def update_poi(poi_id):
    db = get_db()
    update_data = request.json
    result = db.update_poi(poi_id, update_data)
    db.disconnect()
    if result:
        return jsonify({'success': True})
    return jsonify({'error': 'Update failed'}), 400

@app.route('/api/poi/<poi_id>', methods=['DELETE'])
def delete_poi(poi_id):
    db = get_db()
    # Silme için isActive = False yapıyoruz (soft delete)
    result = db.update_poi(poi_id, {'isActive': False})
    db.disconnect()
    if result:
        return jsonify({'success': True})
    return jsonify({'error': 'Delete failed'}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)