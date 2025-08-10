# 🗺️ Ürgüp POI Öneri Sistemi

Kullanıcı tercihlerine dayalı akıllı POI (Point of Interest) öneri sistemi. Ürgüp bölgesindeki turistik yerleri, restoranları, otelleri ve aktiviteleri kişiselleştirilmiş öneriler halinde sunar.

## ✨ Özellikler

### 🎯 Akıllı Öneri Sistemi
- **Kişiselleştirilmiş Öneriler**: 10 farklı kategori için tercih belirleme
- **Puanlama Sistemi**: 0-100 arası uygunluk puanları
- **İki Seviyeli Görüntüleme**: 
  - Yüksek puanlı öneriler (≥45 puan) öncelikli gösterim
  - Düşük puanlı alternatifler isteğe bağlı görüntüleme

### 🗺️ Gelişmiş Harita Entegrasyonu
- **İnteraktif Harita**: Leaflet.js tabanlı modern harita
- **Özel Marker'lar**: Kategori bazlı renkli ve ikonlu marker'lar
- **Popup Detayları**: Her POI için zengin bilgi kartları
- **Smooth Navigation**: "Haritada Göster" ile yumuşak geçişler
- **Responsive Tasarım**: Mobil uyumlu harita boyutları

### 🛣️ Rota Planlama
- **Çoklu POI Seçimi**: İstediğiniz POI'leri rotaya ekleme
- **Rota Detayları**: Mesafe, süre ve durak bilgileri
- **Yükseklik Profili**: Chart.js ile interaktif yükseklik grafiği
- **Google Maps Entegrasyonu**: Rotayı Google Maps'e aktarma
- **Başlangıç Noktası**: Özel başlangıç konumu belirleme

### 🎨 Modern Kullanıcı Arayüzü
- **Glassmorphism Tasarım**: Modern cam efekti tasarımı
- **Responsive Layout**: Tüm cihazlarda uyumlu görünüm
- **Smooth Animasyonlar**: CSS3 ve JavaScript animasyonları
- **Loading States**: Kullanıcı dostu yükleme göstergeleri
- **Touch Optimized**: Mobil dokunmatik optimizasyonları

### 📱 Medya Galerisi
- **Çoklu Medya Desteği**: Resim, video ve ses dosyaları
- **Modal Görüntüleyici**: Tam ekran medya görüntüleme
- **Lazy Loading**: Performans için gecikmeli yükleme
- **Thumbnail Preview**: POI kartlarında medya önizlemeleri

## 🚀 Kurulum

### Gereksinimler
- Python 3.8+
- Flask
- Modern web tarayıcısı (Chrome, Firefox, Safari, Edge)

### 1. Projeyi İndirin
```bash
git clone <repository-url>
cd urgup-poi-recommendation
```

### 2. Python Sanal Ortamı Oluşturun
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. Gerekli Paketleri Yükleyin
```bash
pip install flask
```

### 4. Proje Yapısını Kontrol Edin
```
urgup-poi-recommendation/
├── poi_api.py                 # Flask API sunucusu
├── poi_recommendation_system.html  # Ana HTML dosyası
├── static/
│   ├── css/
│   │   ├── poi_recommendation_system.css
│   │   ├── components.css
│   │   ├── design-tokens.css
│   │   ├── layout-system.css
│   │   └── ux-enhancements.css
│   └── js/
│       └── poi_recommendation_system.js
├── poi_data/
│   └── urgup_pois.json       # POI veritabanı
└── poi_media/                # Medya dosyaları (resim, video, ses)
```

### 5. Sunucuyu Başlatın
```bash
python poi_api.py
```

### 6. Uygulamayı Açın
Tarayıcınızda şu adresi açın:
```
http://localhost:5000
```

## 📊 Veri Yapısı

### POI Veri Formatı
```json
{
  "doga_macera": [
    {
      "id": "unique_id",
      "name": "POI Adı",
      "latitude": 38.6320,
      "longitude": 34.9120,
      "description": "POI açıklaması",
      "category": "doga_macera",
      "ratings": {
        "doga": 85,
        "macera": 90,
        "spor": 70
      }
    }
  ]
}
```

### Kategori Sistemi
- **🌿 Doğa & Macera**: Doğal güzellikler, hiking, outdoor aktiviteler
- **🍽️ Gastronomi**: Restoranlar, yerel lezzetler, wine tasting
- **🏨 Konaklama**: Oteller, pansiyonlar, butik konaklama
- **🏛️ Kültürel**: Müzeler, tarihi yerler, kültürel mekanlar
- **🎨 Sanatsal**: Sanat galerileri, atölyeler, kültür merkezleri

## 🎛️ Kullanım Kılavuzu

### 1. Tercih Belirleme
- Ana sayfada 10 farklı kategori için tercih seviyenizi ayarlayın
- Slider'ları kullanarak ilgi seviyenizi belirtin:
  - **İlgilenmiyorum** (0)
  - **Az İlgiliyim** (25)
  - **Orta Seviye** (50)
  - **Çok İlgiliyim** (75)
  - **Kesinlikle İhtiyacım Var** (100)

### 2. Öneri Alma
- "Önerilerimi Getir" butonuna tıklayın
- Sistem tercihlerinizi analiz ederek önerileri hesaplar
- Yüksek puanlı öneriler (≥45 puan) öncelikli gösterilir

### 3. Harita Kullanımı
- POI kartlarındaki "Haritada Göster" butonunu kullanın
- Marker'lara tıklayarak detaylı bilgi alın
- Harita üzerinde zoom ve pan işlemleri yapın

### 4. Rota Planlama
- İstediğiniz POI'leri "Rotaya Ekle" ile seçin
- Rota detaylarını görüntüleyin
- Google Maps'e aktararak navigasyon başlatın

### 5. Medya Görüntüleme
- POI kartlarındaki medya önizlemelerine tıklayın
- Modal pencerede tam ekran görüntüleme
- Resim, video ve ses dosyalarını inceleyin

## 🔧 Özelleştirme

### CSS Değişkenleri
```css
:root {
    --primary-color: #667eea;
    --secondary-color: #f8f9fa;
    --accent-color: #28a745;
    --text-color: #2c3e50;
    --border-color: #dee2e6;
}
```

### Kategori Renkleri
Her kategori için özel renkler tanımlanmıştır:
```css
--doga-color: #27ae60;
--yemek-color: #e74c3c;
--tarihi-color: #8e44ad;
/* ... diğer kategoriler */
```

### Responsive Breakpoint'ler
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## 🚀 Performans Optimizasyonları

### Frontend
- **Lazy Loading**: Medya dosyaları için gecikmeli yükleme
- **GPU Acceleration**: CSS transform'lar için hardware acceleration
- **Debounced Events**: Scroll ve resize event'leri için debouncing
- **Image Optimization**: Otomatik resim boyutlandırma

### Backend
- **Caching**: POI verilerini memory'de cache'leme
- **Gzip Compression**: HTTP response'ları için sıkıştırma
- **Static File Serving**: Efficient static file delivery

## 🔒 Güvenlik

- **Input Validation**: Tüm kullanıcı girdileri doğrulanır
- **XSS Protection**: HTML içeriği sanitize edilir
- **CORS Headers**: Uygun CORS politikaları
- **Rate Limiting**: API endpoint'leri için rate limiting

## 🐛 Sorun Giderme

### Yaygın Sorunlar

**1. Harita Yüklenmiyor**
```javascript
// Konsol hatalarını kontrol edin
// Leaflet.js kütüphanesinin yüklendiğinden emin olun
```

**2. POI Verileri Gelmiyor**
```bash
# API sunucusunun çalıştığından emin olun
curl http://localhost:5000/api/pois
```

**3. Medya Dosyaları Görünmüyor**
```bash
# poi_media klasörünün var olduğundan emin olun
ls -la poi_media/
```

### Debug Modu
```javascript
// Konsol loglarını etkinleştirin
localStorage.setItem('debug', 'true');
```

## 📈 Gelecek Geliştirmeler

- [ ] **Kullanıcı Hesapları**: Kişisel tercih kaydetme
- [ ] **Sosyal Özellikler**: POI paylaşımı ve yorumlar
- [ ] **Offline Destek**: PWA özellikleri
- [ ] **AI Önerileri**: Machine learning tabanlı öneriler
- [ ] **Çoklu Dil**: İngilizce ve diğer dil desteği
- [ ] **API Genişletme**: RESTful API endpoint'leri
- [ ] **Admin Panel**: POI yönetimi için admin arayüzü

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## 📞 İletişim

Proje hakkında sorularınız için:
- GitHub Issues kullanın
- Email: [your-email@example.com]

---

**Not**: Bu proje Ürgüp turizmi için geliştirilmiş bir demo uygulamadır. Gerçek kullanım için POI verilerinin güncel tutulması önerilir.