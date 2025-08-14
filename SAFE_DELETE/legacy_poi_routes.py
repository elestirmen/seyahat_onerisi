## LEGACY POI ROUTES - MOVED TO BLUEPRINT
## These routes were removed from poi_api.py and moved to app/routes/poi.py
## Date: P6 - Infrastructure Cleanup
## Safe to permanently delete after 14 days

## /api/pois - list_pois_legacy()
@app.route('/api/pois', methods=['GET']) - moved to app/routes/poi.py
def list_pois_legacy():
    # Arama parametrelerini al
    search_query = request.args.get('search', '').strip()
    category = request.args.get('category')
    
    if JSON_FALLBACK:
        test_data = load_test_data()
        
        # Sadece aktif POI'leri filtrele ve integer ID'ler ata
        filtered_data = {}
        for cat, pois in test_data.items():
            if isinstance(pois, list):
                active_pois = []
                for poi in pois:
                    if poi.get('isActive', True):
                        # String _id'yi integer ID'ye çevir
                        if '_id' in poi and isinstance(poi['_id'], str):
                            # String ID'yi hash'leyerek integer ID oluştur
                            poi['id'] = abs(hash(poi['_id'])) % (10**9)  # 9 haneli pozitif integer
                        active_pois.append(poi)
                if active_pois:  # Sadece aktif POI'si olan kategorileri ekle
                    filtered_data[cat] = active_pois
        
        # Arama filtresi uygula
        if search_query:
            search_results = {}
            for cat, pois in filtered_data.items():
                matched_pois = []
                for poi in pois:
                    # POI adı, açıklama ve etiketlerde ara
                    search_fields = [
                        poi.get('name', ''),
                        poi.get('description', ''),
                        ', '.join(poi.get('tags', []))
                    ]
                    
                    # Herhangi bir alanda eşleşme var mı kontrol et
                    if any(fuzzy_search_match(search_query, field) for field in search_fields):
                        matched_pois.append(poi)
                
                if matched_pois:
                    search_results[cat] = matched_pois
            
            return jsonify(search_results)
        
        if category and category in filtered_data:
            return jsonify(filtered_data[category])
        return jsonify(filtered_data)
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        if search_query:
            # Veritabanında arama yap
            search_results = perform_database_search(db, search_query, category)
            db.disconnect()
            return jsonify(search_results)
        
        if category:
            # Yeni UI için uyumlu formatta aktif POI'leri getir
            pois = db.list_pois(category)
            db.disconnect()
            return jsonify(pois)
        
        # Tüm kategorilerdeki POI'leri döndür - dinamik kategori listesi
        try:
            with db.conn.cursor() as cur:
                cur.execute("SELECT DISTINCT category FROM pois WHERE is_active = true ORDER BY category")
                categories = [row[0] for row in cur.fetchall()]
            
            all_pois = {}
            for cat in categories:
                pois = db.list_pois(cat)
                if pois:  # Sadece POI'si olan kategorileri ekle
                    all_pois[cat] = pois
            db.disconnect()
            return jsonify(all_pois)
        except Exception as e:
            db.disconnect()
            return jsonify({'error': f'Category fetch error: {str(e)}'}), 500
        
    except Exception as e:
        db.disconnect()
        return jsonify({'error': f'Search error: {str(e)}'}), 500



## /api/search - search_pois()
@app.route('/api/search', methods=['GET'])
def search_pois():
    """
    Gelişmiş POI arama endpoint'i - Türkçe karakter desteği ile
    Parametreler:
    - q: Arama terimi
    - category: Kategori filtresi
    - limit: Maksimum sonuç sayısı (varsayılan: 50)
    """
    search_query = request.args.get('q', '').strip()
    category_filter = request.args.get('category')
    limit = int(request.args.get('limit', 50))
    
    if not search_query:
        return jsonify({'error': 'Arama terimi gerekli (q parametresi)'}), 400
    
    if len(search_query) < 2:
        return jsonify({'error': 'Arama terimi en az 2 karakter olmalı'}), 400
    
    try:
        if JSON_FALLBACK:
            # JSON fallback arama
            test_data = load_test_data()
            results = []
            
            for cat, pois in test_data.items():
                if category_filter and cat != category_filter:
                    continue
                    
                if isinstance(pois, list):
                    for poi in pois:
                        if not poi.get('isActive', True):
                            continue
                            
                        # Arama alanları
                        search_fields = [
                            poi.get('name', ''),
                            poi.get('description', ''),
                            ', '.join(poi.get('tags', [])),
                            cat  # Kategori adı da arama kapsamında
                        ]
                        
                        # Herhangi bir alanda eşleşme kontrolü
                        if any(fuzzy_search_match(search_query, field) for field in search_fields):
                            poi_result = dict(poi)
                            poi_result['relevance_score'] = calculate_relevance_score(search_query, poi)
                            results.append(poi_result)
            
            # Relevans skoruna göre sırala
            results.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
            
            # Limit uygula
            results = results[:limit]
            
            return jsonify({
                'query': search_query,
                'total_results': len(results),
                'results': results
            })
        
        else:
            # Veritabanı arama
            db = get_db()
            if not db:
                return jsonify({'error': 'Database connection failed'}), 500
            
            try:
                results = perform_advanced_database_search(db, search_query, category_filter, limit)
                db.disconnect()
                
                return jsonify({
                    'query': search_query,
                    'total_results': len(results),
                    'results': results
                })
                
            finally:
                if db:
                    db.disconnect()
                    
    except Exception as e:
        return jsonify({'error': f'Arama hatası: {str(e)}'}), 500



## /api/poi/<poi_id> - get_poi()
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



## /api/pois/by-rating - search_pois_by_rating()
@app.route('/api/pois/by-rating', methods=['GET'])
def search_pois_by_rating():
    """Rating'e göre POI arama"""
    if JSON_FALLBACK:
        return jsonify({'error': 'Rating arama sadece veritabanı modunda çalışır'}), 400
    
    category = request.args.get('category')  # Rating kategorisi (tarihi, doga, vb.)
    min_score = request.args.get('min_score', 0, type=int)  # Minimum puan
    limit = request.args.get('limit', 20, type=int)
    
    if not category or category not in RATING_CATEGORIES:
        return jsonify({
            'error': 'Valid rating category required',
            'valid_categories': list(RATING_CATEGORIES.keys())
        }), 400
    
    if min_score < 0 or min_score > 100:
        return jsonify({'error': 'min_score must be between 0-100'}), 400
    
    db = get_db()
    if not db:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        # Rating tablosu sorgusu
        query = """
            SELECT
                p.id as _id,
                p.name,
                p.category,
                ST_Y(p.location::geometry) as latitude,
                ST_X(p.location::geometry) as longitude,
                p.description,
                COALESCE(pr.rating, 0) as rating_score
            FROM pois p
            LEFT JOIN poi_ratings pr ON pr.poi_id = p.id AND pr.category = %s
            WHERE p.is_active = true AND COALESCE(pr.rating, 0) >= %s
            ORDER BY rating_score DESC, p.name ASC
            LIMIT %s
        """

        with db.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (category, min_score, limit))
            results = cur.fetchall()
        
        # Sonuçları formatla
        formatted_results = []
        for row in results:
            poi_data = dict(row)
            # Tüm rating'leri ekle
            poi_data['ratings'] = db.get_poi_ratings(poi_data['_id']) or db.get_default_ratings()
                
            formatted_results.append(poi_data)
        
        return jsonify({
            'category': category,
            'category_info': RATING_CATEGORIES[category],
            'min_score': min_score,
            'total_results': len(formatted_results),
            'results': formatted_results
        })
        
    except Exception as e:
        return jsonify({'error': f'Error searching by rating: {str(e)}'}), 500
    finally:
        db.disconnect()

# Medya yönetimi endpoint'leri (görsel, video, ses, 3D model)


## /api/poi/<poi_id>/media - get_poi_media()
@app.route('/api/poi/<poi_id>/media', methods=['GET'])
def get_poi_media(poi_id):
    """POI'nin tüm medya dosyalarını listele"""
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
        
        # Medya türünü filtrele (opsiyonel)
        media_type = request.args.get('type')
        
        # Medya dosyalarını getir - POI ID bazlı sistem
        media_files = media_manager.get_poi_media_by_id(poi_id, media_type)
        return jsonify({'media': media_files})
        
    except Exception as e:
        return jsonify({'error': f'Error fetching media: {str(e)}'}), 500



## /api/poi/<poi_id>/images - get_poi_images_legacy()
@app.route('/api/poi/<poi_id>/images', methods=['GET'])
def get_poi_images_legacy(poi_id):
    """Geriye uyumluluk için eski görsel listeleme endpoint'i"""
    try:
        # Sadece görsel türündeki medyaları getir
        request.args = request.args.copy()
        request.args['type'] = 'image'
        
        response_data = get_poi_media(poi_id)
        if isinstance(response_data, tuple):
            data, status_code = response_data
        else:
            data = response_data
            status_code = 200
            
        # Response formatını eski API ile uyumlu hale getir
        if hasattr(data, 'get_json'):
            json_data = data.get_json()
        else:
            json_data = data
            
        if 'media' in json_data:
            json_data['images'] = json_data.pop('media')
            
        return jsonify(json_data), status_code
        
    except Exception as e:
        return jsonify({'error': f'Error fetching images: {str(e)}'}), 500



