from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from poi_database_adapter import POIDatabaseFactory
from poi_image_manager import POIImageManager
import os
import json
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# JSON verileri için fallback
JSON_FALLBACK = False
JSON_FILE_PATH = 'test_data.json'

# Görsel yönetimi
image_manager = POIImageManager()
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_test_data():
    """Test verilerini JSON dosyasından yükle"""
    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_test_data(data):
    """Test verilerini JSON dosyasına kaydet"""
    try:
        with open(JSON_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"JSON dosyasına yazma hatası: {e}")
        return False

def get_db():
    global JSON_FALLBACK
    try:
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        connection_string = os.environ.get('POI_DB_CONNECTION', 'postgresql://poi_user:poi_password@localhost/poi_db')
        database_name = os.environ.get('POI_DB_NAME', 'poi_db')
        db = POIDatabaseFactory.create_database(
            db_type,
            connection_string=connection_string,
            database_name=database_name
        )
        db.connect()
        return db
    except Exception as e:
        print(f"⚠️  Veritabanına bağlanılamadı, JSON verileri kullanılacak: {e}")
        JSON_FALLBACK = True
        return None

@app.route('/')
def index():
    return '''
    <h1>🗺️ POI Yönetim Sistemi</h1>
    <p>POI Yönetim arayüzüne erişmek için: <a href="/poi_manager_ui.html">Buraya tıklayın</a></p>
    <p>API Dokümantasyonu:</p>
    <ul>
        <li><a href="/api/pois">GET /api/pois</a> - Tüm POI'leri listele</li>
        <li>POST /api/poi - Yeni POI ekle</li>
        <li>PUT /api/poi/&lt;id&gt; - POI güncelle</li>
        <li>DELETE /api/poi/&lt;id&gt; - POI sil</li>
    </ul>
    '''

@app.route('/poi_manager_ui.html')
def serve_ui():
    try:
        # HTML dosyasını oku ve görsel desteği ekle
        with open('poi_manager_ui.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Görsel desteği için JavaScript kodlarını ekle
        enhanced_js = """
        // Görsel modal ve yardımcı fonksiyonlar
        function showImageModal(imagePath, poiName, filename) {
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">📸 ${filename}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center">
                            <img src="${imagePath}" class="img-fluid rounded shadow" alt="${poiName}" style="max-height: 70vh;">
                            <div class="mt-2">
                                <small class="text-muted">${poiName}</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <a href="${imagePath}" target="_blank" class="btn btn-outline-primary btn-sm">
                                <i class="fas fa-external-link-alt"></i> Yeni Sekmede Aç
                            </a>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            
            modal.addEventListener('hidden.bs.modal', () => {
                modal.remove();
            });
        }

        function getImageTypeIcon(filename) {
            const name = filename.toLowerCase();
            if (name.includes('exterior') || name.includes('dis')) return '🏢';
            if (name.includes('interior') || name.includes('ic')) return '🏠';
            if (name.includes('food') || name.includes('yemek')) return '🍽️';
            if (name.includes('menu')) return '📋';
            if (name.includes('logo')) return '🏷️';
            return '📷';
        }

        // showPOIDetail fonksiyonunu güncelle
        async function showPOIDetail(poiId) {
            showLoading();
            try {
                const response = await fetch(`${apiBase}/poi/${poiId}`);
                if (!response.ok) throw new Error('POI not found');
                const poi = await response.json();

                selectedPOI = poi;

                let detailHtml = `
                    <div class="poi-detail-header">
                        <h5 class="mb-2">${poi.name}</h5>
                        <span class="badge bg-primary mb-2">${getCategoryDisplayName(poi.category)}</span>
                    </div>
                    
                    <div class="poi-detail-info">
                        <p class="mb-2"><i class="fas fa-map-marker-alt text-danger"></i> <strong>Konum:</strong> ${poi.latitude.toFixed(6)}, ${poi.longitude.toFixed(6)}</p>`;

                if (poi.description) {
                    detailHtml += `<p class="mb-2"><i class="fas fa-info-circle text-info"></i> <strong>Açıklama:</strong> ${poi.description}</p>`;
                }
                if (poi.tags && poi.tags.length > 0) {
                    detailHtml += `<p class="mb-2"><i class="fas fa-tags text-success"></i> <strong>Etiketler:</strong> ${poi.tags.join(', ')}</p>`;
                }
                
                detailHtml += `</div>`;

                // Görselleri yükle ve göster
                try {
                    const imagesResponse = await fetch(`${apiBase}/poi/${poiId}/images`);
                    if (imagesResponse.ok) {
                        const imagesData = await imagesResponse.json();
                        const images = imagesData.images || [];
                        
                        if (images.length > 0) {
                            detailHtml += `
                                <div class="poi-detail-images mt-3">
                                    <h6 class="mb-2"><i class="fas fa-images text-warning"></i> Görseller (${images.length})</h6>
                                    <div class="row g-2">`;
                            
                            images.forEach((image, index) => {
                                const imagePath = image.thumbnail_path || image.path;
                                const fullImagePath = image.path;
                                detailHtml += `
                                    <div class="col-6">
                                        <div class="image-card">
                                            <img src="/${imagePath}" 
                                                 class="img-fluid rounded shadow-sm" 
                                                 style="height: 100px; width: 100%; object-fit: cover; cursor: pointer;" 
                                                 alt="${image.filename}"
                                                 onclick="showImageModal('/${fullImagePath}', '${poi.name}', '${image.filename}')">
                                            <div class="image-overlay">
                                                <small class="text-white">${getImageTypeIcon(image.filename)} ${(image.size / 1024).toFixed(0)}KB</small>
                                            </div>
                                        </div>
                                    </div>`;
                            });
                            
                            detailHtml += `
                                    </div>
                                </div>`;
                        }
                    }
                } catch (imageError) {
                    console.log('Görseller yüklenemedi:', imageError);
                }

                // Eski imageUrl desteği (geriye uyumluluk)
                if (poi.imageUrl && !detailHtml.includes('poi-detail-images')) {
                    detailHtml += `
                        <div class="poi-detail-images mt-3">
                            <h6 class="mb-2"><i class="fas fa-image text-warning"></i> Görsel</h6>
                            <img src="${poi.imageUrl}" 
                                 class="img-fluid rounded shadow" 
                                 alt="${poi.name}"
                                 onclick="showImageModal('${poi.imageUrl}', '${poi.name}', 'POI Görseli')">
                        </div>`;
                }

                detailHtml += `
                    <hr>
                    <div class="poi-detail-actions">
                        <button class="btn btn-outline-primary btn-sm me-2" onclick="focusOnMap(${poi.latitude}, ${poi.longitude})">
                            <i class="fas fa-crosshairs"></i> Haritada Göster
                        </button>
                        <button class="btn btn-outline-secondary btn-sm me-2" onclick="editPOI('${poi._id}')">
                            <i class="fas fa-edit"></i> Düzenle
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deletePOI('${poi._id}')">
                            <i class="fas fa-trash"></i> Sil
                        </button>
                    </div>`;

                document.getElementById('poiDetailContent').innerHTML = detailHtml;

                if (!document.getElementById('poiDetailPanel').classList.contains('active')) {
                    document.getElementById('poiDetailPanel').classList.add('active');
                }

            } catch (error) {
                showToast('POI detayları yüklenirken hata oluştu', 'error');
            } finally {
                hideLoading();
            }
        }
        """
        
        # CSS eklemeleri
        enhanced_css = """
        /* POI Detay Görselleri için CSS */
        .poi-detail-header {
            border-bottom: 1px solid #eee;
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
        }

        .poi-detail-info {
            margin-bottom: 1rem;
        }

        .poi-detail-images .image-card {
            position: relative;
            overflow: hidden;
            border-radius: 8px;
            transition: transform 0.2s ease;
        }

        .poi-detail-images .image-card:hover {
            transform: scale(1.05);
        }

        .poi-detail-images .image-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.7));
            padding: 0.25rem;
            font-size: 0.75rem;
        }

        .poi-detail-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        """
        
        # CSS'i head bölümüne ekle
        html_content = html_content.replace('</style>', enhanced_css + '\n    </style>')
        
        # JavaScript'i script bölümünün başına ekle
        html_content = html_content.replace(
            '// Sayfa yüklendiğinde',
            enhanced_js + '\n\n        // Sayfa yüklendiğinde'
        )
        
        return html_content
        
    except FileNotFoundError:
        return '<h1>❌ Hata</h1><p>poi_manager_ui.html dosyası bulunamadı!</p><p>Dosyanın API ile aynı klasörde olduğundan emin olun.</p>', 404

@app.route('/api/pois', methods=['GET'])
def list_pois():
    if JSON_FALLBACK:
        test_data = load_test_data()
        category = request.args.get('category')
        
        # Sadece aktif POI'leri filtrele
        filtered_data = {}
        for cat, pois in test_data.items():
            if isinstance(pois, list):
                active_pois = [poi for poi in pois if poi.get('isActive', True)]
                if active_pois:  # Sadece aktif POI'si olan kategorileri ekle
                    filtered_data[cat] = active_pois
        
        if category and category in filtered_data:
            return jsonify(filtered_data[category])
        return jsonify(filtered_data)
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    category = request.args.get('category')
    if category:
        # Yeni UI için uyumlu formatta aktif POI'leri getir
        pois = db.list_pois(category)
        db.disconnect()
        return jsonify(pois)
    # Tüm kategorilerdeki POI'leri döndür
    categories = ['gastronomik', 'kulturel', 'sanatsal', 'doga_macera', 'konaklama']
    all_pois = {}
    for cat in categories:
        all_pois[cat] = db.list_pois(cat)
    db.disconnect()
    return jsonify(all_pois)

@app.route('/api/poi/<poi_id>', methods=['GET'])
def get_poi(poi_id):
    if JSON_FALLBACK:
        test_data = load_test_data()
        for category_pois in test_data.values():
            if isinstance(category_pois, list):
                for poi in category_pois:
                    if poi.get('_id') == poi_id and poi.get('isActive', True):
                        return jsonify(poi)
        return jsonify({'error': 'POI not found'}), 404
    
    # POI ID'nin geçerli olup olmadığını kontrol et
    try:
        poi_id = int(poi_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid POI ID format'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    details = db.get_poi_details(poi_id)
    db.disconnect()
    if details:
        return jsonify(details)
    return jsonify({'error': 'POI not found'}), 404

@app.route('/api/poi', methods=['POST'])
def add_poi():
    if JSON_FALLBACK:
        try:
            poi_data = request.json
            
            # Yeni POI için ID oluştur
            new_id = str(uuid.uuid4())
            
            # Yeni POI objesi oluştur
            new_poi = {
                '_id': new_id,
                'name': poi_data.get('name', ''),
                'category': poi_data.get('category', ''),
                'latitude': float(poi_data.get('latitude', 0)),
                'longitude': float(poi_data.get('longitude', 0)),
                'description': poi_data.get('description', ''),
                'tags': poi_data.get('tags', []),
                'imageUrl': poi_data.get('imageUrl', ''),
                'isActive': True,
                'createdAt': datetime.now().isoformat()
            }
            
            # Mevcut verileri yükle
            test_data = load_test_data()
            
            # Kategori yoksa oluştur
            if new_poi['category'] not in test_data:
                test_data[new_poi['category']] = []
            
            # POI'yi ekle
            test_data[new_poi['category']].append(new_poi)
            
            # JSON dosyasına kaydet
            if save_test_data(test_data):
                return jsonify({'id': new_id}), 201
            else:
                return jsonify({'error': 'Failed to save POI'}), 500
                
        except Exception as e:
            return jsonify({'error': f'Error adding POI: {str(e)}'}), 500
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    poi_data = request.json
    poi_id = db.add_poi(poi_data)
    db.disconnect()
    return jsonify({'id': poi_id}), 201

@app.route('/api/poi/<poi_id>', methods=['PUT'])
def update_poi(poi_id):
    if JSON_FALLBACK:
        try:
            update_data = request.json
            test_data = load_test_data()
            
            # POI'yi bul ve güncelle
            for category, pois in test_data.items():
                if isinstance(pois, list):
                    for i, poi in enumerate(pois):
                        if poi.get('_id') == poi_id:
                            # Güncelleme verilerini uygula
                            for key, value in update_data.items():
                                if key != '_id':  # ID değiştirilmemeli
                                    pois[i][key] = value
                            
                            pois[i]['updatedAt'] = datetime.now().isoformat()
                            
                            # Kategori değiştiyse POI'yi taşı
                            if 'category' in update_data and update_data['category'] != category:
                                new_category = update_data['category']
                                if new_category not in test_data:
                                    test_data[new_category] = []
                                
                                # POI'yi yeni kategoriye taşı
                                updated_poi = pois.pop(i)
                                test_data[new_category].append(updated_poi)
                            
                            if save_test_data(test_data):
                                return jsonify({'success': True})
                            else:
                                return jsonify({'error': 'Failed to save changes'}), 500
            
            return jsonify({'error': 'POI not found'}), 404
            
        except Exception as e:
            return jsonify({'error': f'Error updating POI: {str(e)}'}), 500
    
    # POI ID'nin geçerli olup olmadığını kontrol et
    if poi_id == 'undefined' or poi_id is None:
        return jsonify({'error': 'Invalid POI ID'}), 400
    
    try:
        poi_id = int(poi_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid POI ID format'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    update_data = request.json
    result = db.update_poi(poi_id, update_data)
    db.disconnect()
    if result:
        return jsonify({'success': True})
    return jsonify({'error': 'Update failed'}), 400

@app.route('/api/poi/<poi_id>', methods=['DELETE'])
def delete_poi(poi_id):
    if JSON_FALLBACK:
        try:
            test_data = load_test_data()
            
            # POI'yi bul ve sil (soft delete)
            for category, pois in test_data.items():
                if isinstance(pois, list):
                    for poi in pois:
                        if poi.get('_id') == poi_id:
                            poi['isActive'] = False
                            poi['deletedAt'] = datetime.now().isoformat()
                            
                            if save_test_data(test_data):
                                return jsonify({'success': True})
                            else:
                                return jsonify({'error': 'Failed to save changes'}), 500
            
            return jsonify({'error': 'POI not found'}), 404
            
        except Exception as e:
            return jsonify({'error': f'Error deleting POI: {str(e)}'}), 500
    
    # POI ID'nin geçerli olup olmadığını kontrol et
    try:
        poi_id = int(poi_id)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid POI ID format'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    # Silme için isActive = False yapıyoruz (soft delete)
    result = db.update_poi(poi_id, {'isActive': False})
    db.disconnect()
    if result:
        return jsonify({'success': True})
    return jsonify({'error': 'Delete failed'}), 400

# Görsel yönetimi endpoint'leri
@app.route('/api/poi/<poi_id>/images', methods=['POST'])
def upload_poi_image(poi_id):
    """POI'ye görsel yükle"""
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}), 400
    
    try:
        # POI bilgilerini al
        if JSON_FALLBACK:
            test_data = load_test_data()
            poi = None
            poi_category = None
            for category, pois in test_data.items():
                if isinstance(pois, list):
                    for p in pois:
                        if p.get('_id') == poi_id:
                            poi = p
                            poi_category = category
                            break
            if not poi:
                return jsonify({'error': 'POI not found'}), 404
            poi_name = poi['name']
        else:
            try:
                poi_id_int = int(poi_id)
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid POI ID format'}), 400
            
            db = get_db()
            if not db:
                return jsonify({'error': 'Database connection failed'}), 500
            
            poi_details = db.get_poi_details(poi_id_int)
            db.disconnect()
            
            if not poi_details:
                return jsonify({'error': 'POI not found'}), 404
            
            poi_name = poi_details['name']
            poi_category = poi_details['category']
        
        # Geçici dosya kaydet
        filename = secure_filename(file.filename)
        temp_path = f"/tmp/{uuid.uuid4()}_{filename}"
        file.save(temp_path)
        
        # Form verilerini al
        image_type = request.form.get('type', 'photo')
        caption = request.form.get('caption', '')
        is_primary = request.form.get('is_primary', 'false').lower() == 'true'
        
        # Görseli işle ve kaydet - POI ID bazlı klasör yapısı
        result = image_manager.add_poi_image_by_id(
            poi_id=poi_id,
            poi_name=poi_name,
            category=poi_category,
            image_file_path=temp_path,
            image_type=image_type,
            caption=caption,
            is_primary=is_primary
        )
        
        # Geçici dosyayı sil
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        if result:
            return jsonify({
                'success': True,
                'image': result
            }), 201
        else:
            return jsonify({'error': 'Failed to process image'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Error uploading image: {str(e)}'}), 500

@app.route('/api/poi/<poi_id>/images', methods=['GET'])
def get_poi_images(poi_id):
    """POI'nin görsellerini listele"""
    try:
        if JSON_FALLBACK:
            test_data = load_test_data()
            poi = None
            poi_category = None
            for category, pois in test_data.items():
                if isinstance(pois, list):
                    for p in pois:
                        if p.get('_id') == poi_id:
                            poi = p
                            poi_category = category
                            break
            if not poi:
                return jsonify({'error': 'POI not found'}), 404
            poi_name = poi['name']
        else:
            try:
                poi_id_int = int(poi_id)
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid POI ID format'}), 400
            
            db = get_db()
            if not db:
                return jsonify({'error': 'Database connection failed'}), 500
            
            poi_details = db.get_poi_details(poi_id_int)
            db.disconnect()
            
            if not poi_details:
                return jsonify({'error': 'POI not found'}), 404
            
            poi_name = poi_details['name']
            poi_category = poi_details['category']
        
        # Görselleri getir - POI ID bazlı sistem
        images = image_manager.get_poi_images_by_id(poi_id)
        return jsonify({'images': images})
        
    except Exception as e:
        return jsonify({'error': f'Error fetching images: {str(e)}'}), 500

@app.route('/poi_images/<path:filename>')
def serve_poi_image(filename):
    """POI görsellerini serve et"""
    try:
        return send_from_directory('poi_images', filename)
    except FileNotFoundError:
        return jsonify({'error': 'Image not found'}), 404

if __name__ == '__main__':
    print("🚀 POI Yönetim Sistemi başlatılıyor...")
    print("📊 Web arayüzü: http://localhost:5505/poi_manager_ui.html")
    print("🔌 API endpoint'leri: http://localhost:5505/api/")
    
    # Test database connection to show accurate status
    db = get_db()
    if JSON_FALLBACK:
        print("⚠️  JSON fallback modu - tüm işlemler JSON dosyasında yapılacak")
    elif db is not None:
        db_type = os.environ.get('POI_DB_TYPE', 'postgresql')
        print(f"✅ {db_type.upper()} veritabanı bağlantısı aktif")
        db.disconnect()
    else:
        print("❌ Veritabanı bağlantısı başarısız")
    
    app.run(debug=True, host='0.0.0.0', port=5505)