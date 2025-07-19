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
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>POI Yönetim Sistemi</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>
            body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
            .container { max-width: 800px; margin: 0 auto; }
            .card { background: white; border-radius: 12px; padding: 30px; margin: 20px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 10px 10px 10px 0; font-weight: 600; transition: all 0.3s ease; }
            .btn-primary { background: #3498db; color: white; }
            .btn-success { background: #27ae60; color: white; }
            .btn-info { background: #17a2b8; color: white; }
            .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
            h1 { color: #2c3e50; margin-bottom: 10px; }
            .subtitle { color: #7f8c8d; margin-bottom: 30px; }
            .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
            .feature-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; }
            .api-list { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .api-list ul { list-style: none; padding: 0; }
            .api-list li { padding: 8px 0; border-bottom: 1px solid #e9ecef; }
            .api-list li:last-child { border-bottom: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <h1><i class="fas fa-map-marked-alt"></i> POI Yönetim Sistemi</h1>
                <p class="subtitle">Kapadokya POI'leri ve Rota Haritaları Yönetim Paneli</p>
                
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3><i class="fas fa-cogs"></i> POI Yönetimi</h3>
                        <p>POI'leri ekle, düzenle, sil ve görsellerini yönet</p>
                        <a href="/poi_manager_ui.html" class="btn btn-primary">
                            <i class="fas fa-tools"></i> Yönetim Paneli
                        </a>
                    </div>
                    
                    <div class="feature-card">
                        <h3><i class="fas fa-map"></i> Harita Galerisi</h3>
                        <p>Oluşturulan rota haritalarını görüntüle ve indir</p>
                        <a href="/maps" class="btn btn-success">
                            <i class="fas fa-images"></i> Harita Listesi
                        </a>
                    </div>
                </div>
                
                <div class="api-list">
                    <h3><i class="fas fa-code"></i> API Dokümantasyonu</h3>
                    <ul>
                        <li><strong>GET</strong> <a href="/api/pois">/api/pois</a> - Tüm POI'leri listele</li>
                        <li><strong>POST</strong> /api/poi - Yeni POI ekle</li>
                        <li><strong>PUT</strong> /api/poi/&lt;id&gt; - POI güncelle</li>
                        <li><strong>DELETE</strong> /api/poi/&lt;id&gt; - POI sil</li>
                        <li><strong>GET</strong> /api/poi/&lt;id&gt;/images - POI görsellerini listele</li>
                        <li><strong>POST</strong> /api/poi/&lt;id&gt;/images - POI'ye görsel yükle</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
                    <p style="color: #7f8c8d; margin: 0;">
                        <i class="fas fa-info-circle"></i> 
                        Harita oluşturmak için: <code>python category_route_planner_with_db.py</code>
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
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
                            <h5 class="modal-title fw-bold"><i class="fas fa-image me-2"></i>${filename}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center p-4">
                            <img src="${imagePath}" class="img-fluid rounded-3 shadow-lg" alt="${poiName}" style="max-height: 70vh; transition: transform 0.3s ease;" 
                                 onload="this.style.opacity='1'" style="opacity: 0;">
                            <div class="mt-3">
                                <p class="text-muted mb-1"><i class="fas fa-map-marker-alt me-1"></i>${poiName}</p>
                                <small class="text-muted">Görseli büyütmek için tıklayın</small>
                            </div>
                        </div>
                        <div class="modal-footer justify-content-center">
                            <a href="${imagePath}" target="_blank" class="btn btn-primary">
                                <i class="fas fa-external-link-alt me-1"></i> Yeni Sekmede Aç
                            </a>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times me-1"></i> Kapat
                            </button>
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

                // Form alanlarını doldur (düzenleme için hazır hale getir)
                document.getElementById('poiId').value = poi._id;
                document.getElementById('poiName').value = poi.name;
                document.getElementById('poiCategory').value = poi.category;
                document.getElementById('poiLat').value = poi.latitude;
                document.getElementById('poiLon').value = poi.longitude;
                document.getElementById('poiDesc').value = poi.description || '';
                document.getElementById('poiTags').value = (poi.tags || []).join(', ');
                document.getElementById('poiImageUrl').value = poi.imageUrl || '';

                // Formu düzenleme moduna geçir
                document.getElementById('saveBtn').innerHTML = '🔄 Güncelle';
                document.getElementById('deleteBtn').classList.remove('d-none');
                document.getElementById('cancelEditBtn').classList.remove('d-none');

                // Panel başlığını güncelle
                document.getElementById('panelTitle').textContent = `📝 ${poi.name}`;
                document.getElementById('newPoiBtn').classList.remove('d-none');

                // Detaylar tab'ını göster ve aktif yap
                document.getElementById('details-tab-container').style.display = 'block';
                
                // Bootstrap tab geçişi
                const detailsTab = new bootstrap.Tab(document.getElementById('details-tab'));
                detailsTab.show();

                let detailHtml = `
                    <div class="poi-detail-header">
                        <h5 class="mb-2 fw-bold">${poi.name}</h5>
                        <span class="badge bg-light text-dark fs-6">${getCategoryDisplayName(poi.category)}</span>
                    </div>
                    
                    <div class="poi-detail-info">
                        <p class="mb-2"><i class="fas fa-map-marker-alt text-danger me-2"></i> <strong>Konum:</strong> ${poi.latitude.toFixed(6)}, ${poi.longitude.toFixed(6)}</p>`;

                if (poi.description) {
                    detailHtml += `<p class="mb-2"><i class="fas fa-info-circle text-info me-2"></i> <strong>Açıklama:</strong> ${poi.description}</p>`;
                }
                if (poi.tags && poi.tags.length > 0) {
                    detailHtml += `<p class="mb-2"><i class="fas fa-tags text-success me-2"></i> <strong>Etiketler:</strong> ${poi.tags.join(', ')}</p>`;
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
                                    <h6 class="mb-3"><i class="fas fa-images text-warning"></i> Görseller (${images.length})</h6>
                                    <div class="row g-3">`;
                            
                            images.forEach((image, index) => {
                                const imagePath = image.thumbnail_path || image.path;
                                const fullImagePath = image.path;
                                detailHtml += `
                                    <div class="col-6">
                                        <div class="image-card-enhanced" style="position: relative; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                                            <img src="/${imagePath}" 
                                                 class="img-fluid" 
                                                 style="height: 120px; width: 100%; object-fit: cover; cursor: pointer; transition: transform 0.3s ease;" 
                                                 alt="${image.filename}"
                                                 onclick="showImageModal('/${fullImagePath}', '${poi.name}', '${image.filename}')"
                                                 onmouseover="this.style.transform='scale(1.05)'"
                                                 onmouseout="this.style.transform='scale(1)'">
                                            <div class="image-info-overlay" style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 8px 12px;">
                                                <small class="text-white fw-bold">${getImageTypeIcon(image.filename)} ${(image.size / 1024).toFixed(0)}KB</small>
                                            </div>
                                            <button class="image-delete-btn-enhanced btn btn-danger" 
                                                    style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; padding: 0; font-size: 0.9rem; z-index: 10; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(220,53,69,0.4); transition: all 0.3s ease;"
                                                    onclick="deletePOIImageWithConfirm('${poi._id}', '${image.filename}', this)"
                                                    title="Görseli sil - ${image.filename}"
                                                    onmouseover="this.style.transform='scale(1.2)'; this.style.boxShadow='0 6px 16px rgba(220,53,69,0.6)'"
                                                    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(220,53,69,0.4)'">
                                                <i class="fas fa-trash"></i>
                                            </button>
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
                    <div class="poi-detail-actions">
                        <button class="btn btn-primary btn-sm" onclick="focusOnMap(${poi.latitude}, ${poi.longitude})">
                            <i class="fas fa-crosshairs me-1"></i> Haritada Göster
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="switchToFormTab()">
                            <i class="fas fa-edit me-1"></i> Düzenle
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCurrentPOI()">
                            <i class="fas fa-trash me-1"></i> Sil
                        </button>
                    </div>`;

                document.getElementById('poiDetailContent').innerHTML = detailHtml;

                // Mevcut görselleri form bölümünde de yükle (eğer loadPOIImages fonksiyonu varsa)
                if (typeof loadPOIImages === 'function') {
                    await loadPOIImages(poiId);
                }

            } catch (error) {
                showToast('POI detayları yüklenirken hata oluştu', 'error');
            } finally {
                hideLoading();
            }
        }
        
        // Görsel silme fonksiyonu
        async function deletePOIImage(poiId, filename, imageCardElement) {
            if (!confirm(`'${filename}' adlı görseli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
                return;
            }
            showLoading();
            try {
                const response = await fetch(`${apiBase}/poi/${poiId}/images/${filename}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Görsel silinemedi.');
                }

                showToast('Görsel başarıyla silindi', 'success');
                
                // Görsel kartını UI'dan kaldır
                if(imageCardElement) {
                    imageCardElement.remove();
                }
                
                // Eğer hiç görsel kalmadıysa, "Görseller" başlığını da kaldır
                const imageContainer = document.querySelector('.poi-detail-images .row');
                if (imageContainer && imageContainer.childElementCount === 0) {
                    document.querySelector('.poi-detail-images').remove();
                }

            } catch (error) {
                showToast(`Hata: ${error.message}`, 'error');
            } finally {
                hideLoading();
            }
        }

        // Daha güvenli görsel silme fonksiyonu - event bubbling problemini çözer
        async function deletePOIImageWithConfirm(poiId, filename, buttonElement) {
            // Tüm event propagation'ları durdur
            if (window.event) {
                window.event.stopPropagation();
                window.event.preventDefault();
            }
            
            if (!confirm(`'${filename}' adlı görseli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
                return false;
            }
            
            showLoading();
            try {
                const response = await fetch(`${apiBase}/poi/${poiId}/images/${filename}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Görsel silinemedi.');
                }

                showToast('Görsel başarıyla silindi', 'success');
                
                // Görsel kartının parent container'ını bul ve kaldır
                const imageCard = buttonElement.closest('.col-6');
                if (imageCard) {
                    imageCard.remove();
                }
                
                // Eğer hiç görsel kalmadıysa, "Görseller" başlığını da kaldır
                const imageContainer = document.querySelector('.poi-detail-images .row');
                if (imageContainer && imageContainer.childElementCount === 0) {
                    document.querySelector('.poi-detail-images').remove();
                }

            } catch (error) {
                showToast(`Hata: ${error.message}`, 'error');
            } finally {
                hideLoading();
            }
            
            return false; // Prevent any further event handling
        }

        // Birleşik panel için yardımcı fonksiyonlar
        function switchToFormTab() {
            const formTab = new bootstrap.Tab(document.getElementById('form-tab'));
            formTab.show();
        }

        function deleteCurrentPOI() {
            const poiId = document.getElementById('poiId').value;
            if (poiId) {
                deletePOI(poiId);
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

        /* Görsel silme butonu için gelişmiş stiller */
        .image-delete-btn {
            border-radius: 50% !important;
            transition: all 0.2s ease;
            background-color: #dc3545 !important;
            border: 2px solid white !important;
        }

        .image-delete-btn:hover {
            background-color: #c82333 !important;
            transform: scale(1.1);
            box-shadow: 0 4px 8px rgba(0,0,0,0.4) !important;
        }

        .image-card {
            transition: transform 0.2s ease;
        }

        .image-card:hover {
            transform: scale(1.02);
        }

        .image-card:hover .image-delete-btn {
            opacity: 1;
        }

        .image-delete-btn {
            opacity: 0.8;
        }

        /* Enhanced POI Detail Styles */
        .poi-detail-images {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            border: 1px solid #e9ecef;
        }

        .image-card-enhanced {
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .image-card-enhanced:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.25) !important;
        }

        .image-delete-btn-enhanced {
            background: linear-gradient(135deg, #dc3545, #c82333) !important;
            border: 2px solid white !important;
            opacity: 0.9;
        }

        .image-delete-btn-enhanced:hover {
            background: linear-gradient(135deg, #c82333, #bd2130) !important;
            opacity: 1 !important;
        }

        .poi-detail-header {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 16px;
            border-radius: 12px;
            margin: -1rem -1rem 1rem -1rem;
        }

        .poi-detail-info {
            background: white;
            border-radius: 8px;
            padding: 12px;
            border-left: 4px solid #007bff;
            margin-bottom: 16px;
        }

        .poi-detail-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            border-top: 1px solid #e9ecef;
        }

        .poi-detail-actions .btn {
            transition: all 0.2s ease;
        }

        .poi-detail-actions .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        /* Image Modal Improvements */
        .modal-content {
            border: none;
            border-radius: 16px;
            overflow: hidden;
        }

        .modal-header {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            border: none;
        }

        .modal-footer {
            border: none;
            background: #f8f9fa;
        }

        /* Toast Improvements */
        .toast {
            border-radius: 12px;
            border: none;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }

        .toast-success {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
        }

        .toast-error {
            background: linear-gradient(135deg, #dc3545, #e74c3c);
            color: white;
        }

        .toast-info {
            background: linear-gradient(135deg, #17a2b8, #007bff);
            color: white;
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
    
    # Dosya boyutu kontrolü - WebP dönüşümü sayesinde 15MB'a kadar kabul edebiliriz
    if file.content_length and file.content_length > 15 * 1024 * 1024:
        return jsonify({'error': 'Dosya boyutu 15MB\'dan küçük olmalıdır. WebP dönüşümü ile boyut otomatik olarak küçültülecektir.'}), 400
    
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

@app.route('/api/poi/<poi_id>/images/<filename>', methods=['DELETE'])
def delete_poi_image(poi_id, filename):
    """POI'nin belirli bir görselini sil"""
    try:
        # Dosya adının güvenli olduğundan emin ol
        if '..' in filename or filename.startswith('/'):
            return jsonify({'error': 'Invalid filename'}), 400

        # Görseli sil
        success = image_manager.delete_poi_image_by_id(poi_id, filename)

        if success:
            return jsonify({'success': True})
        else:
            # Belki dosya zaten yoktu, bu bir hata sayılmayabilir.
            # Yine de istemciye başarılı bir yanıt dönebiliriz.
            # Ancak loglarda "bulunamadı" uyarısı görünür.
            return jsonify({'success': True, 'message': 'Image not found or already deleted'}), 200

    except Exception as e:
        return jsonify({'error': f'Error deleting image: {str(e)}'}), 500

@app.route('/poi_images/<path:filename>')
def serve_poi_image(filename):
    """POI görsellerini serve et"""
    try:
        return send_from_directory('poi_images', filename)
    except FileNotFoundError:
        return jsonify({'error': 'Image not found'}), 404

# Statik HTML dosyalarını serve et
@app.route('/<filename>')
def serve_static_html(filename):
    """Statik HTML dosyalarını serve et"""
    try:
        # Güvenlik kontrolü - sadece HTML dosyalarına izin ver
        if not filename.endswith('.html') or filename == 'poi_manager_ui.html':
            return jsonify({'error': 'File not found'}), 404
        
        # Dosya var mı kontrol et
        if not os.path.exists(filename):
            return jsonify({'error': 'File not found'}), 404
            
        with open(filename, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return jsonify({'error': f'Error serving file: {str(e)}'}), 500

# Maps klasörü altındaki HTML dosyalarını serve et
@app.route('/maps/<filename>')
def serve_maps_html(filename):
    """Maps klasörü altındaki HTML dosyalarını serve et"""
    try:
        # Güvenlik kontrolü - sadece HTML dosyalarına izin ver
        if not filename.endswith('.html'):
            return jsonify({'error': 'File not found'}), 404
        
        # Dosya var mı kontrol et
        if not os.path.exists(filename):
            return jsonify({'error': 'File not found'}), 404
            
        with open(filename, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return jsonify({'error': f'Error serving file: {str(e)}'}), 500

@app.route('/maps')
def list_maps():
    """Mevcut harita dosyalarını listele"""
    try:
        import glob
        html_files = glob.glob('*.html')
        # poi_manager_ui.html'i hariç tut
        map_files = [f for f in html_files if f != 'poi_manager_ui.html']
        
        maps_html = """
        <h1>🗺️ Mevcut Harita Dosyaları</h1>
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        """
        
        if not map_files:
            maps_html += """
            <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
                <h3>📭 Henüz harita dosyası bulunamadı</h3>
                <p>Harita oluşturmak için:</p>
                <code style="background: #e9ecef; padding: 8px 12px; border-radius: 4px; display: inline-block; margin: 10px;">
                    python category_route_planner_with_db.py gastronomik
                </code>
            </div>
            """
        else:
            for map_file in sorted(map_files):
                file_size = os.path.getsize(map_file) / 1024  # KB
                maps_html += f"""
                <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 15px 0; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">
                        <i class="fa fa-map" style="margin-right: 8px; color: #3498db;"></i>
                        {map_file}
                    </h3>
                    <p style="margin: 5px 0; color: #666; font-size: 14px;">
                        <i class="fa fa-file" style="margin-right: 5px;"></i>
                        Boyut: {file_size:.1f} KB
                    </p>
                    <div style="margin-top: 15px;">
                        <a href="/maps/{map_file}" target="_blank" 
                           style="background: #3498db; color: white; padding: 10px 20px; border-radius: 5px; 
                                  text-decoration: none; margin-right: 10px; display: inline-block;">
                            <i class="fa fa-external-link-alt" style="margin-right: 5px;"></i>
                            Haritayı Aç
                        </a>
                        <a href="/download/{map_file}" 
                           style="background: #27ae60; color: white; padding: 10px 20px; border-radius: 5px; 
                                  text-decoration: none; display: inline-block;">
                            <i class="fa fa-download" style="margin-right: 5px;"></i>
                            İndir
                        </a>
                    </div>
                </div>
                """
        
        maps_html += """
        </div>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        """
        
        return maps_html
        
    except Exception as e:
        return f'<h1>Hata</h1><p>Harita dosyaları listelenemedi: {str(e)}</p>', 500

@app.route('/maps/<filename>')
def serve_map(filename):
    """Harita HTML dosyalarını serve et"""
    try:
        # Güvenlik kontrolü - sadece HTML dosyalarına izin ver
        if not filename.endswith('.html'):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Dosya var mı kontrol et
        if not os.path.exists(filename):
            return jsonify({'error': 'Map file not found'}), 404
        
        return send_from_directory('.', filename)
        
    except Exception as e:
        return jsonify({'error': f'Error serving map: {str(e)}'}), 500

@app.route('/download/<filename>')
def download_map(filename):
    """Harita dosyalarını indirme"""
    try:
        # Güvenlik kontrolü
        if not filename.endswith('.html'):
            return jsonify({'error': 'Invalid file type'}), 400
        
        if not os.path.exists(filename):
            return jsonify({'error': 'File not found'}), 404
        
        return send_from_directory('.', filename, as_attachment=True)
        
    except Exception as e:
        return jsonify({'error': f'Error downloading file: {str(e)}'}), 500

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