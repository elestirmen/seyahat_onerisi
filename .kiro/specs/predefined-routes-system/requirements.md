# Requirements Document

## Introduction

Bu özellik, mevcut POI tabanlı dinamik rota oluşturma sisteminin yanında, önceden hazırlanmış rotalar sistemi ekleyecektir. Kullanıcılar artık hem kişisel tercihlerine göre POI'lerden oluşturulan dinamik rotalar hem de uzmanlar tarafından önceden hazırlanmış rotalar arasından seçim yapabileceklerdir. Ayrıca POI yönetim paneline rota hazırlama ve düzenleme özellikleri eklenecektir.

## Requirements

### Requirement 1

**User Story:** Bir turist olarak, uzmanlar tarafından önceden hazırlanmış rotaları görebilmek istiyorum, böylece deneyimli rehberlerin önerdiği güzergahları takip edebilirim.

#### Acceptance Criteria

1. WHEN kullanıcı rota önerisi sayfasını açtığında THEN sistem hem "Kişisel Tercihlerime Göre Rotalar" hem de "Hazır Rotalar" seçeneklerini gösterecektir
2. WHEN kullanıcı "Hazır Rotalar" sekmesini seçtiğinde THEN sistem veritabanındaki tüm aktif hazır rotaları listeleyecektir
3. WHEN hazır rota listesi gösterildiğinde THEN her rota için isim, açıklama, zorluk seviyesi, tahmini süre, mesafe ve rota tipi bilgileri görünecektir
4. IF bir hazır rota seçildiğinde THEN sistem rotanın detaylarını ve haritada güzergahını gösterecektir

### Requirement 2

**User Story:** Bir yönetici olarak, POI yönetim panelinden yeni rotalar oluşturabilmek istiyorum, böylece turistler için özel güzergahlar hazırlayabilirim.

#### Acceptance Criteria

1. WHEN yönetici POI yönetim panelini açtığında THEN sistem "POI Yönetimi" ve "Rota Yönetimi" sekmelerini gösterecektir
2. WHEN yönetici "Rota Yönetimi" sekmesini seçtiğinde THEN sistem mevcut rotaları listeleyen ve yeni rota ekleme formu içeren arayüzü gösterecektir
3. WHEN yönetici "Yeni Rota Ekle" butonuna tıkladığında THEN sistem rota oluşturma formunu açacaktır
4. WHEN rota oluşturma formunda THEN sistem rota adı, açıklama, tip, zorluk seviyesi, tahmini süre ve POI seçimi alanlarını sunacaktır
5. IF form geçerli verilerle doldurulup gönderildiğinde THEN sistem yeni rotayı veritabanına kaydedecektir

### Requirement 3

**User Story:** Bir yönetici olarak, mevcut rotaları düzenleyebilmek istiyorum, böylece rotaları güncel tutabilir ve iyileştirebilirim.

#### Acceptance Criteria

1. WHEN yönetici rota listesinde bir rotanın "Düzenle" butonuna tıkladığında THEN sistem rota düzenleme formunu açacaktır
2. WHEN düzenleme formu açıldığında THEN sistem mevcut rota bilgilerini form alanlarında gösterecektir
3. WHEN yönetici rota bilgilerini değiştirip kaydettiğinde THEN sistem güncellenmiş bilgileri veritabanına kaydedecektir
4. IF rota silinmek istendiğinde THEN sistem onay mesajı gösterecek ve onaylandığında rotayı veritabanından kaldıracaktır

### Requirement 4

**User Story:** Bir turist olarak, hazır rotaların detaylarını görebilmek istiyorum, böylece hangi rotayı seçeceğime karar verebilirim.

#### Acceptance Criteria

1. WHEN kullanıcı bir hazır rotaya tıkladığında THEN sistem rotanın detay sayfasını açacaktır
2. WHEN rota detay sayfası açıldığında THEN sistem rota haritası, POI listesi, zorluk bilgileri ve açıklamaları gösterecektir
3. WHEN kullanıcı rotayı seçtiğinde THEN sistem rotayı aktif hale getirecek ve navigasyon için hazırlayacaktır
4. IF rota dairesel değilse THEN sistem başlangıç ve bitiş noktalarını açıkça belirtecektir

### Requirement 5

**User Story:** Bir sistem kullanıcısı olarak, mevcut POI tabanlı dinamik rota sistemi çalışmaya devam etmeli, böylece yeni özellik eski işlevselliği bozmaz.

#### Acceptance Criteria

1. WHEN kullanıcı "Kişisel Tercihlerime Göre Rotalar" sekmesini seçtiğinde THEN mevcut POI tabanlı rota oluşturma sistemi normal şekilde çalışacaktır
2. WHEN dinamik rota oluşturulduğunda THEN sistem kategori tercihlerine göre POI'leri seçmeye devam edecektir
3. WHEN her iki rota tipi de mevcut olduğunda THEN sistem kullanıcının seçimine göre uygun rota tipini gösterecektir
4. IF veritabanı bağlantısı başarısız olursa THEN sistem varsayılan POI verilerini kullanmaya devam edecektir

### Requirement 6

**User Story:** Bir yönetici olarak, rotaları POI'lerle ilişkilendirebilmek istiyorum, böylece rotalar belirli ilgi noktalarını içerebilir.

#### Acceptance Criteria

1. WHEN rota oluşturma formunda THEN sistem mevcut POI'leri seçilebilir liste olarak gösterecektir
2. WHEN yönetici POI'leri seçtiğinde THEN sistem seçilen POI'leri rota ile ilişkilendirecektir
3. WHEN rota kaydedildiğinde THEN sistem POI ilişkilerini route_pois tablosuna kaydedecektir
4. IF rota görüntülendiğinde THEN sistem ilişkili POI'leri haritada işaretleyecektir

### Requirement 7

**User Story:** Bir turist olarak, rotaları filtreleyebilmek istiyorum, böylece tercihlerime uygun rotaları kolayca bulabilirim.

#### Acceptance Criteria

1. WHEN hazır rotalar sayfasında THEN sistem rota tipi, zorluk seviyesi ve süre filtrelerini sunacaktır
2. WHEN kullanıcı filtre seçtiğinde THEN sistem sadece kriterlere uyan rotaları gösterecektir
3. WHEN birden fazla filtre uygulandığında THEN sistem tüm kriterleri karşılayan rotaları listeleyecektir
4. IF hiçbir rota kriterlere uymuyorsa THEN sistem "Kriterlere uygun rota bulunamadı" mesajı gösterecektir