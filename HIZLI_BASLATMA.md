# ⚡ POI Yönetim Sistemi - Hızlı Başlatma

## 🚀 5 Dakikada Kurulum

### 1. Gerekli Paketleri Kurun
```bash
pip install flask flask-cors pymongo
```

### 2. MongoDB'yi Başlatın
**Windows:** MongoDB Compass açın veya `mongod` komutunu çalıştırın
**Linux/Mac:** 
```bash
sudo systemctl start mongod  # veya brew services start mongodb-community
```

### 3. Veritabanını Hazırlayın
```bash
python setup_poi_database.py mongodb "mongodb://localhost:27017/"
```

### 4. API'yi Başlatın
```bash
export POI_DB_TYPE=mongodb
export POI_DB_CONNECTION=mongodb://localhost:27017/
python poi_api.py
```

### 5. Web Arayüzünü Açın
Tarayıcıda: `http://localhost:5000/poi_manager_ui.html`

---

## 🎯 Hızlı Test

1. **POI Ekle:** Haritaya çift tıklayın → Formu doldurun → Kaydet
2. **POI Düzenle:** Tabloda ✏️ butonuna tıklayın
3. **POI Sil:** Tabloda 🗑️ butonuna tıklayın
4. **Arama:** Üst taraftaki arama kutusunu kullanın

---

## ❌ Hızlı Sorun Çözme

**API başlamıyor?**
```bash
netstat -an | grep 5000  # Port kontrolü
```

**MongoDB bağlantı hatası?**
```bash
mongo --eval "db.runCommand('ping')"
```

**Harita görünmüyor?**
- İnternet bağlantınızı kontrol edin
- Tarayıcı konsolunu açın (F12) ve hataları kontrol edin

---

**Detaylı rehber için:** `POI_YONETIM_REHBERI.md` dosyasını okuyun.

**Hemen başlayın! 🎉**