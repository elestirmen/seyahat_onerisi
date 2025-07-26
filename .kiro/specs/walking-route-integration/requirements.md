# Walking Route Integration - Requirements Document

## Introduction

Bu spec, POI öneri sisteminde gerçek yürüyüş yollarını kullanarak rota hesaplama özelliğinin geliştirilmesini kapsar. Şu anda sistem "kuş uçumu" düz çizgiler kullanıyor, ancak kullanıcılar gerçek sokaklar ve yürüyüş yolları üzerinden rota görmek istiyor.

## Requirements

### Requirement 1: OSMnx Kütüphane Entegrasyonu

**User Story:** Sistem yöneticisi olarak, yürüyüş rotalarının gerçek yollar üzerinden hesaplanması için OSMnx kütüphanesinin düzgün kurulmasını ve çalışmasını istiyorum.

#### Acceptance Criteria

1. WHEN sistem başlatıldığında THEN OSMnx kütüphanesi başarıyla import edilmeli
2. WHEN OSMnx import edilemezse THEN sistem uygun hata mesajı vermeli ve fallback moda geçmeli
3. IF OSMnx mevcut değilse THEN requirements.txt dosyasına eklenmeli
4. WHEN pip install çalıştırıldığında THEN tüm bağımlılıklar başarıyla kurulmalı

### Requirement 2: Ürgüp Bölgesi Yürüyüş Ağı

**User Story:** Kullanıcı olarak, Ürgüp bölgesindeki POI'ler arasında gerçek yürüyüş yolları üzerinden rota görmek istiyorum.

#### Acceptance Criteria

1. WHEN rota hesaplanırken THEN Ürgüp bölgesi için yürüyüş ağı (walking network) indirilmeli
2. WHEN ağ indirilemezse THEN cache'lenmiş ağ kullanılmalı
3. IF cache yoksa THEN fallback olarak düz çizgi rotası gösterilmeli
4. WHEN yürüyüş ağı kullanıldığında THEN rota yeşil renkte gösterilmeli
5. WHEN fallback kullanıldığında THEN rota kırmızı kesikli çizgi olarak gösterilmeli

### Requirement 3: Rota Optimizasyonu

**User Story:** Kullanıcı olarak, seçtiğim POI'ler arasında en kısa yürüyüş rotasını görmek istiyorum.

#### Acceptance Criteria

1. WHEN birden fazla POI seçildiğinde THEN NetworkX shortest_path algoritması kullanılmalı
2. WHEN rota hesaplanamadığında THEN hata mesajı gösterilmeli
3. WHEN rota bulunduğunda THEN toplam mesafe ve tahmini yürüme süresi gösterilmeli
4. IF başlangıç noktası belirlenmişse THEN rota oradan başlamalı

### Requirement 4: Hata Yönetimi ve Fallback

**User Story:** Kullanıcı olarak, yürüyüş rotası hesaplanamadığında bile bir rota görmek istiyorum.

#### Acceptance Criteria

1. WHEN OSMnx hatası oluştuğunda THEN kullanıcıya anlaşılır mesaj gösterilmeli
2. WHEN ağ indirilemediğinde THEN otomatik olarak düz çizgi rotasına geçilmeli
3. WHEN API timeout oluştuğunda THEN 10 saniye sonra fallback aktif olmalı
4. WHEN rota bulunamadığında THEN alternatif öneriler sunulmalı

### Requirement 5: Performans ve Cache

**User Story:** Sistem yöneticisi olarak, rota hesaplama işlemlerinin hızlı olmasını ve gereksiz ağ trafiği oluşturmamasını istiyorum.

#### Acceptance Criteria

1. WHEN aynı bölge için rota istendiğinde THEN cache'lenmiş ağ kullanılmalı
2. WHEN cache 24 saatten eskiyse THEN yeniden indirilmeli
3. WHEN ağ indirme işlemi 30 saniyeden uzun sürerse THEN timeout olmalı
4. WHEN rota hesaplama 10 saniyeden uzun sürerse THEN fallback aktif olmalı

### Requirement 6: Kullanıcı Bilgilendirme

**User Story:** Kullanıcı olarak, hangi tür rotanın gösterildiğini (gerçek yol vs düz çizgi) bilmek istiyorum.

#### Acceptance Criteria

1. WHEN gerçek yürüyüş rotası gösterildiğinde THEN "🚶 Yürüyüş Rotası" etiketi görünmeli
2. WHEN düz çizgi rotası gösterildiğinde THEN "⚠️ Düz çizgi rotası" uyarısı görünmeli
3. WHEN rota hesaplanırken THEN loading göstergesi aktif olmalı
4. WHEN hata oluştuğunda THEN kullanıcı dostu hata mesajı gösterilmeli

## Technical Constraints

- OSMnx kütüphanesi Python 3.8+ gerektirir
- NetworkX bağımlılığı mevcut olmalı
- İnternet bağlantısı ağ indirme için gerekli
- Ürgüp bölgesi koordinatları: 38.61-38.65N, 34.89-34.93E

## Success Criteria

- ✅ Gerçek yürüyüş yolları üzerinden rota hesaplama
- ✅ Fallback mekanizması çalışıyor
- ✅ Kullanıcı bilgilendirme sistemi aktif
- ✅ Performance kabul edilebilir seviyede (< 10 saniye)
- ✅ Hata durumlarında sistem çökmüyor