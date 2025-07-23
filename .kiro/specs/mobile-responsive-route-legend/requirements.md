# Requirements Document

## Introduction

Bu özellik, `category_route_planner_with_db.py` dosyasının oluşturduğu HTML harita dosyalarındaki rota lejantını mobil cihazlarda daha kullanılabilir hale getirecektir. Mevcut lejant sabit konumda ve kapatılamadığı için mobil cihazlarda harita görünümünü engellemektedir. Bu özellik ile lejant açılıp kapatılabilir, mobil uyumlu boyutlarda olacak ve dokunmatik cihazlarda kolay kullanılabilecektir.

## Requirements

### Requirement 1

**User Story:** Mobil cihaz kullanıcısı olarak, harita lejantını açıp kapatabilmek istiyorum, böylece harita alanını tam olarak görebilirim.

#### Acceptance Criteria

1. WHEN kullanıcı mobil cihazda haritayı açtığında THEN lejant varsayılan olarak kapalı durumda olmalıdır
2. WHEN kullanıcı lejant toggle butonuna dokunduğunda THEN lejant açılıp kapanmalıdır
3. WHEN lejant açık durumdayken kullanıcı harita alanına dokunduğunda THEN lejant otomatik olarak kapanmalıdır
4. WHEN lejant kapalıyken THEN harita alanının tamamı görünür olmalıdır

### Requirement 2

**User Story:** Mobil cihaz kullanıcısı olarak, lejantın mobil ekran boyutuna uygun şekilde görüntülenmesini istiyorum, böylece içeriği rahatça okuyabilirim.

#### Acceptance Criteria

1. WHEN kullanıcı mobil cihazda lejantı açtığında THEN lejant ekran genişliğinin maksimum %90'ını kaplamalıdır
2. WHEN lejant açıkken THEN içerik kaydırılabilir olmalıdır (scroll)
3. WHEN lejant çok uzunsa THEN maksimum yükseklik sınırı olmalı ve kaydırma çubuğu görünmelidir
4. WHEN kullanıcı kategori öğelerine dokunduğunda THEN dokunma alanı yeterince büyük olmalıdır (minimum 44px)

### Requirement 3

**User Story:** Masaüstü kullanıcısı olarak, mevcut lejant işlevselliğinin korunmasını istiyorum, böylece alışkın olduğum deneyimi yaşayabilirim.

#### Acceptance Criteria

1. WHEN kullanıcı masaüstü cihazda haritayı açtığında THEN lejant varsayılan olarak açık durumda olmalıdır
2. WHEN ekran genişliği 768px'den büyükse THEN masaüstü lejant stili kullanılmalıdır
3. WHEN masaüstü modunda THEN lejant toggle butonu gizli olmalıdır
4. WHEN masaüstü modunda THEN mevcut hover efektleri korunmalıdır

### Requirement 4

**User Story:** Geliştirici olarak, lejant kodunun mevcut Python dosyasına entegre edilmesini istiyorum, böylece harita oluşturma sürecinde otomatik olarak mobil uyumlu lejant eklensin.

#### Acceptance Criteria

1. WHEN `add_enhanced_legend_and_controls` fonksiyonu çağrıldığında THEN mobil uyumlu CSS ve JavaScript kodları otomatik olarak eklenmelidir
2. WHEN HTML dosyası oluşturulduğunda THEN responsive meta tag'i otomatik olarak eklenmelidir
3. WHEN lejant oluşturulduğunda THEN hem mobil hem masaüstü stilleri aynı HTML içinde bulunmalıdır
4. WHEN mevcut lejant işlevselliği korunmalı THEN kategori toggle işlemleri çalışmaya devam etmelidir

### Requirement 5

**User Story:** Kullanıcı olarak, lejant toggle butonunun görsel olarak anlaşılır olmasını istiyorum, böylece nasıl kullanacağımı kolayca anlayabilirim.

#### Acceptance Criteria

1. WHEN lejant kapalıyken THEN toggle butonu "lejantı aç" anlamında bir ikon göstermelidir
2. WHEN lejant açıkken THEN toggle butonu "lejantı kapat" anlamında bir ikon göstermelidir
3. WHEN kullanıcı toggle butonuna dokunduğunda THEN görsel geri bildirim (animasyon) olmalıdır
4. WHEN toggle butonu görünürken THEN sabit konumda (sticky) ve erişilebilir olmalıdır

### Requirement 6

**User Story:** Kullanıcı olarak, lejant animasyonlarının pürüzsüz olmasını istiyorum, böylece kullanım deneyimi keyifli olsun.

#### Acceptance Criteria

1. WHEN lejant açılıp kapanırken THEN smooth transition animasyonu olmalıdır
2. WHEN animasyon süresi THEN 300ms'den fazla olmamalıdır
3. WHEN lejant açılırken THEN alt taraftan yukarı doğru slide animasyonu olmalıdır
4. WHEN lejant kapanırken THEN yukarıdan aşağı doğru slide animasyonu olmalıdır