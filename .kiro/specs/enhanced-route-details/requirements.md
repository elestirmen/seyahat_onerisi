# Requirements Document

## Introduction

Bu özellik, oluşturulan rotalar için detaylı bilgi görüntüleme ve Google Maps entegrasyonunu geliştirir. Kullanıcılar rota tıkladığında elevation profili, durak listesi görebilecek ve Google Maps'e tam rotayı tek seferde aktarabilecek.

## Requirements

### Requirement 1

**User Story:** Kullanıcı olarak, oluşturduğum rotaya tıkladığımda rotanın elevation profilini ve yükseklik bilgilerini görmek istiyorum.

#### Acceptance Criteria

1. WHEN kullanıcı haritadaki rota çizgisine tıkladığında THEN rota detay paneli açılacak
2. WHEN rota detay paneli açıldığında THEN elevation profili grafiği gösterilecek
3. WHEN elevation profili gösterildiğinde THEN minimum, maksimum ve ortalama yükseklik değerleri gösterilecek
4. WHEN elevation profili gösterildiğinde THEN toplam yükselme ve alçalma miktarları hesaplanacak

### Requirement 2

**User Story:** Kullanıcı olarak, rota detaylarında hangi POI'lerin ziyaret edileceğini sıralı bir şekilde görmek istiyorum.

#### Acceptance Criteria

1. WHEN rota detay paneli açıldığında THEN rotadaki tüm duraklar sıralı liste halinde gösterilecek
2. WHEN durak listesi gösterildiğinde THEN her durak için POI adı, kategorisi ve ikonu gösterilecek
3. WHEN durak listesi gösterildiğinde THEN başlangıç noktası (kullanıcı konumu) ilk sırada gösterilecek
4. WHEN bir durağa tıklandığında THEN haritada o POI vurgulanacak

### Requirement 3

**User Story:** Kullanıcı olarak, Google Maps'e rotayı aktardığımda tüm rotanın tek seferde aktarılmasını istiyorum, segment segment değil.

#### Acceptance Criteria

1. WHEN kullanıcı "Google Maps'e Aktar" butonuna tıkladığında THEN tüm rota tek URL ile aktarılacak
2. WHEN Google Maps URL'i oluşturulduğunda THEN başlangıç noktası origin parametresi olacak
3. WHEN Google Maps URL'i oluşturulduğunda THEN son POI destination parametresi olacak
4. WHEN Google Maps URL'i oluşturulduğunda THEN ara POI'ler waypoints parametresi olacak
5. WHEN Google Maps açıldığında THEN tüm rota tek navigasyon olarak görünecek

### Requirement 4

**User Story:** Kullanıcı olarak, rota detaylarında mesafe, süre ve diğer özet bilgileri görmek istiyorum.

#### Acceptance Criteria

1. WHEN rota detay paneli açıldığında THEN toplam mesafe gösterilecek
2. WHEN rota detay paneli açıldığında THEN tahmini süre gösterilecek
3. WHEN rota detay paneli açıldığında THEN ziyaret edilecek POI sayısı gösterilecek
4. WHEN rota detay paneli açıldığında THEN rota türü (yürüyüş/araç) gösterilecek