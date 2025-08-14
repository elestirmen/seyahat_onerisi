# SAFE_DELETE RETENTION POLICY

**Başlangıç Tarihi:** 2024-01-20  
**Bekleme Süresi:** 14 gün  
**Kalıcı Silme Tarihi:** 2024-02-03

## Taşınan Dosyalar Özeti

### 🗑️ İstatistikler
- **Toplam taşınan dosya:** 30 adet
- **Test Python dosyaları:** 18 adet
- **Debug HTML dosyaları:** 10 adet
- **Backup dosyaları:** 1 adet (route_file_parser_backup.py)
- **Önceki taşınanlar:** 1 adet (poi_manager_ui.html)

### 📊 Dosya Kategorileri

#### Test Files (18 dosya)
```
test_files/
├── test_admin_panel_migration.py      (12KB)
├── test_system_integration.py         (20KB)  
├── test_api_core.py                   (15KB)
├── test_route_file_parser.py          (19KB)
├── test_poi_suggestion_api.py         (9KB)
├── test_poi_suggestion_integration.py (9KB)
├── test_route_parser_integration.py   (10KB)
├── test_route_service.py              (23KB)
├── test_route_creation.py             (3KB)
├── test_db_connection.py              (2KB)
├── test_auth_implementation.py        (15KB)
├── test_frontend_functionality.py     (18KB)
├── test_api_endpoints.py              (25KB)
├── test_poi_suggestion_simple.py      (8KB)
├── test_poi_suggestion_algorithm.py   (13KB)
├── test_api_integration.py            (9KB)
├── test_end_to_end_scenarios.py       (27KB)
└── test_file_upload_api.py            (16KB)
```

#### Debug HTML Files (10 dosya)
```
debug_html/
├── test_nearby_poi_feature.html       (7KB)
├── basic_map_test.html                (2KB)
├── test_map_layers.html               (6KB)
├── working_map_test.html              (5KB)
├── design-system-test.html            (8KB)
├── test_file_upload.html              (2KB)
├── simple_map_test.html               (6KB)
├── navigation-test.html               (9KB)
├── test-runner.html                   (26KB)
└── debug-test.html                    (9KB)
```

#### Backup Files (2 dosya)
```
├── poi_manager_ui.html                (255KB) - önceki taşınan
└── route_file_parser_backup.py       (271B)  - önceki taşınan
```

## Retention Timeline

### ✅ Faz 1: Güvenli Taşıma (2024-01-20)
- [x] DELETION_PROPOSAL.md analizi tamamlandı
- [x] Import graf analizi yapıldı
- [x] 18 test dosyası SAFE_DELETE/test_files/'e taşındı
- [x] 10 debug HTML dosyası SAFE_DELETE/debug_html/'e taşındı
- [x] 5 backup dosyası kalıcı silindi (hemen güvenli)
- [x] Restore script oluşturuldu ve test edildi

### ⏳ Faz 2: Bekletme Süreci (2024-01-20 - 2024-02-03)
- **Durum:** BAŞLADI
- **Süre:** 14 gün
- **Restore:** `scripts/restore_safe_delete.sh` ile mümkün
- **Monitör:** Günlük sistem kontrolü

### 🔥 Faz 3: Kalıcı Silme (2024-02-03)
- **Aksiyon:** SAFE_DELETE klasörünü tamamen sil
- **Komut:** `rm -rf SAFE_DELETE/`
- **Geri alınamaz:** ⚠️ Kalıcı silme işlemi

## Restore Prosedürü

### Tek Dosya Geri Getirme
```bash
scripts/restore_safe_delete.sh --specific-file test_api_core.py
```

### Kategori Geri Getirme  
```bash
scripts/restore_safe_delete.sh --category test_files
scripts/restore_safe_delete.sh --category debug_html
```

### Tüm Dosyaları Geri Getirme
```bash
scripts/restore_safe_delete.sh
```

### Dry Run (Test)
```bash
scripts/restore_safe_delete.sh --dry-run
```

### Dosya Listesi
```bash
scripts/restore_safe_delete.sh --list
```

## İzleme ve Kontrol

### Günlük Kontrol Listesi
- [ ] SAFE_DELETE klasörü mevcut mu?
- [ ] Restore script çalışıyor mu?
- [ ] Sistem normal çalışıyor mu? (contract testler)
- [ ] Bekletme süresi doldu mu?

### Kritik Uyarı Durumları
1. **Dosya İhtiyacı:** Silinmiş dosya acil gerekirse restore script kullan
2. **Sistem Hatası:** Contract testler kırılırsa dosyaları geri getir
3. **Performans Sorunu:** Beklenmeyen hata durumunda restore yap

## Risk Değerlendirmesi

### ✅ Düşük Risk
- Test dosyaları: Sadece development/testing için kullanılıyor
- Debug HTML: Development amaçlı test sayfaları
- Restore mekanizması: Tam otomatik geri getirme

### ⚠️ Orta Risk  
- poi_manager_ui.html: UI dosyası, ama yeni sürüm var
- route_file_parser_backup.py: Backup dosyası

### 🔒 Zero Risk
- Backup dosyaları: Zaten yedek dosyalar
- Temporary files: Geçici dosyalar

## Kalıcı Silme Onayı

**2024-02-03 tarihinde:**

1. [ ] Son sistem kontrolü yapıldı
2. [ ] Contract testler yeşil
3. [ ] 14 gün içinde restore ihtiyacı olmadı
4. [ ] Team lead onayı alındı

**ONAY SONRASI KOMUT:**
```bash
rm -rf SAFE_DELETE/
echo "P4 Safe Cleanup completed on $(date)" >> CHANGES.md
```

---

**⚠️ ÖNEMLİ NOT:** Bu dosyalar 14 gün boyunca geri getirilebilir. Süre dolmadan gerekli dosyaları restore edin.
