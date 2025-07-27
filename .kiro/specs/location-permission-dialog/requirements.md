# Requirements Document

## Introduction

Bu özellik, POI öneri sisteminde kullanıcıdan konum izni alırken daha kullanıcı dostu ve açıklayıcı bir dialog gösterilmesini sağlar. Google Earth benzeri bir arayüz ile kullanıcıya konum izninin neden gerekli olduğunu açıklar ve farklı seçenekler sunar.

## Requirements

### Requirement 1

**User Story:** Kullanıcı olarak, konum izni istendiğinde neden bu iznin gerekli olduğunu anlayabilmek ve farklı seçenekler arasından seçim yapabilmek istiyorum.

#### Acceptance Criteria

1. WHEN kullanıcı "Recommend" butonuna tıkladığında AND konum izni daha önce verilmemişse THEN sistem özel bir konum izni dialog'u gösterecek
2. WHEN konum izni dialog'u gösterildiğinde THEN dialog "Konumunuzu bilme" başlığını içerecek
3. WHEN konum izni dialog'u gösterildiğinde THEN dialog üç seçenek sunacak: "Siteyi ziyaret ederken izin ver", "Bu defalık izin ver", "Hiçbir zaman izin verme"

### Requirement 2

**User Story:** Kullanıcı olarak, konum izni dialog'unda seçimimi yaptıktan sonra sistemin buna uygun davranmasını istiyorum.

#### Acceptance Criteria

1. WHEN kullanıcı "Siteyi ziyaret ederken izin ver" seçeneğini seçerse THEN sistem kalıcı konum izni isteyecek ve gelecekteki ziyaretlerde otomatik izin kullanacak
2. WHEN kullanıcı "Bu defalık izin ver" seçeneğini seçerse THEN sistem sadece bu oturum için konum izni isteyecek
3. WHEN kullanıcı "Hiçbir zaman izin verme" seçeneğini seçerse THEN sistem konum izni istemeyecek ve bu tercihi hatırlayacak
4. WHEN kullanıcı herhangi bir seçenek seçtikten sonra THEN dialog kapanacak ve seçime uygun aksiyon başlayacak

### Requirement 3

**User Story:** Kullanıcı olarak, konum izni dialog'unun görsel olarak çekici ve anlaşılır olmasını istiyorum.

#### Acceptance Criteria

1. WHEN konum izni dialog'u gösterildiğinde THEN dialog modern ve temiz bir tasarıma sahip olacak
2. WHEN konum izni dialog'u gösterildiğinde THEN dialog konum ikonu içerecek
3. WHEN konum izni dialog'u gösterildiğinde THEN dialog butonları mavi renk temasında olacak
4. WHEN konum izni dialog'u gösterildiğinde THEN dialog responsive tasarıma sahip olacak
5. WHEN kullanıcı dialog dışına tıklarsa THEN dialog kapanacak

### Requirement 4

**User Story:** Kullanıcı olarak, konum izni tercihlerimin hatırlanmasını ve bir sonraki ziyaretimde tekrar sorulmamasını istiyorum.

#### Acceptance Criteria

1. WHEN kullanıcı "Hiçbir zaman izin verme" seçerse THEN bu tercih localStorage'da saklanacak
2. WHEN kullanıcı daha önce "Hiçbir zaman izin verme" seçmişse THEN konum izni dialog'u gösterilmeyecek
3. WHEN kullanıcı "Siteyi ziyaret ederken izin ver" seçerse AND tarayıcı izin verirse THEN gelecekteki ziyaretlerde otomatik konum alınacak
4. WHEN kullanıcı konum izni tercihlerini sıfırlamak isterse THEN tarayıcı ayarlarından veya site ayarlarından bunu yapabilecek