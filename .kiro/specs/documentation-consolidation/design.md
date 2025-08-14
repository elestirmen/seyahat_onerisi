# Design Document

## Overview

Bu tasarım dokümanı, mevcut dağınık dokümantasyon dosyalarını tek bir kapsamlı tutorial dosyasında birleştirme projesinin teknik yaklaşımını ve yapısını tanımlar. Proje, 30'dan fazla markdown dosyasını organize edilmiş, kullanıcı dostu tek bir dokümantasyon haline getirmeyi amaçlar.

## Architecture

### Dokümantasyon Yapısı

Yeni birleştirilmiş dokümantasyon şu ana bölümlerden oluşacak:

```
COMPREHENSIVE_TUTORIAL.md
├── 1. Giriş ve Genel Bakış
├── 2. Hızlı Başlangıç
├── 3. Sistem Gereksinimleri
├── 4. Kurulum Rehberi
├── 5. Veritabanı Kurulumu ve Yapılandırması
├── 6. API Dokümantasyonu
├── 7. Web Arayüzü Kullanımı
├── 8. Kimlik Doğrulama ve Güvenlik
├── 9. Rota Planlama ve Yönetimi
├── 10. POI Yönetimi
├── 11. Sistem Mimarisi
├── 12. Sorun Giderme
├── 13. Performans Optimizasyonu
├── 14. Geliştirici Rehberi
├── 15. Üretim Ortamı Hazırlığı
└── 16. Ek Kaynaklar ve Referanslar
```

### İçerik Kategorileri

Mevcut dosyalar şu kategorilere ayrılacak:

#### 1. Kurulum ve Yapılandırma
- `INSTALL.md`
- `KURULUM_REHBERI.md`
- `HIZLI_BASLATMA.md`
- `KURULUM_GUNCELLEME_NOTLARI.md`

#### 2. Kullanıcı Rehberleri
- `ADMIN_USER_GUIDE.md`
- `POI_YONETIM_REHBERI.md`
- `YEDEKLEME_REHBERI.md`

#### 3. Teknik Dokümantasyon
- `PROJE_MIMARISI.md`
- `AUTHENTICATION_CONFIG.md`
- `PREDEFINED_ROUTES_API_DOCUMENTATION.md`
- `poi_database_design.md`

#### 4. Uygulama Raporları
- `IMPLEMENTATION_SUMMARY.md`
- `FILE_UPLOAD_API_IMPLEMENTATION_SUMMARY.md`
- `POI_SUGGESTION_IMPLEMENTATION_SUMMARY.md`
- `ROUTE_PARSER_IMPLEMENTATION_SUMMARY.md`

#### 5. Sorun Giderme ve Bakım
- `POI_ASSOCIATION_DEBUG_GUIDE.md`
- `HOTFIX_INSTRUCTIONS.md`
- `TEST_SUMMARY.md`

## Components and Interfaces

### Dosya İşleme Bileşenleri

#### DocumentProcessor
```python
class DocumentProcessor:
    def __init__(self, source_files: List[str]):
        self.source_files = source_files
        self.processed_content = {}
    
    def read_files(self) -> Dict[str, str]:
        """Tüm kaynak dosyaları okur"""
        pass
    
    def extract_sections(self, content: str) -> Dict[str, str]:
        """Markdown başlıklarına göre bölümleri ayırır"""
        pass
    
    def categorize_content(self) -> Dict[str, List[str]]:
        """İçeriği kategorilere ayırır"""
        pass
```

#### ContentMerger
```python
class ContentMerger:
    def __init__(self, categorized_content: Dict[str, List[str]]):
        self.categorized_content = categorized_content
    
    def merge_sections(self, category: str) -> str:
        """Aynı kategorideki bölümleri birleştirir"""
        pass
    
    def resolve_duplicates(self, content: str) -> str:
        """Tekrarlanan içerikleri temizler"""
        pass
    
    def create_toc(self, content: str) -> str:
        """İçindekiler tablosu oluşturur"""
        pass
```

#### LanguageHandler
```python
class LanguageHandler:
    def __init__(self):
        self.turkish_files = []
        self.english_files = []
    
    def detect_language(self, content: str) -> str:
        """İçerik dilini tespit eder"""
        pass
    
    def separate_languages(self) -> Tuple[List[str], List[str]]:
        """Türkçe ve İngilizce içerikleri ayırır"""
        pass
    
    def merge_multilingual_content(self) -> str:
        """Çok dilli içeriği organize eder"""
        pass
```

### Çıktı Formatları

#### MarkdownGenerator
```python
class MarkdownGenerator:
    def __init__(self, merged_content: str):
        self.merged_content = merged_content
    
    def generate_header(self) -> str:
        """Dokümantasyon başlığı ve meta bilgileri"""
        pass
    
    def generate_toc(self) -> str:
        """Detaylı içindekiler tablosu"""
        pass
    
    def format_sections(self) -> str:
        """Bölümleri formatlar"""
        pass
    
    def add_navigation(self) -> str:
        """Bölümler arası navigasyon linkleri"""
        pass
```

## Data Models

### Dokümantasyon Yapısı

```python
@dataclass
class DocumentSection:
    title: str
    content: str
    level: int  # Başlık seviyesi (1-6)
    language: str  # 'tr', 'en', 'mixed'
    category: str
    source_file: str
    order: int

@dataclass
class MergedDocument:
    title: str
    description: str
    sections: List[DocumentSection]
    toc: str
    metadata: Dict[str, Any]
    created_at: datetime
    version: str
```

### İçerik Kategorileri

```python
class ContentCategory(Enum):
    INTRODUCTION = "introduction"
    QUICK_START = "quick_start"
    INSTALLATION = "installation"
    DATABASE = "database"
    API = "api"
    WEB_UI = "web_ui"
    AUTHENTICATION = "authentication"
    ROUTING = "routing"
    POI_MANAGEMENT = "poi_management"
    ARCHITECTURE = "architecture"
    TROUBLESHOOTING = "troubleshooting"
    PERFORMANCE = "performance"
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    RESOURCES = "resources"
```

## Error Handling

### Dosya İşleme Hataları

```python
class DocumentProcessingError(Exception):
    """Dokümantasyon işleme hatası"""
    pass

class FileNotFoundError(DocumentProcessingError):
    """Kaynak dosya bulunamadı"""
    pass

class ContentParsingError(DocumentProcessingError):
    """İçerik ayrıştırma hatası"""
    pass

class DuplicateContentError(DocumentProcessingError):
    """Tekrarlanan içerik hatası"""
    pass
```

### Hata Yönetimi Stratejisi

1. **Eksik Dosyalar**: Uyarı ver, devam et
2. **Bozuk Markdown**: Düzelt veya atla
3. **Tekrarlanan İçerik**: Akıllı birleştirme
4. **Dil Karışıklığı**: Manuel müdahale gerektiğinde uyar

## Testing Strategy

### Unit Tests

```python
class TestDocumentProcessor:
    def test_read_files(self):
        """Dosya okuma testleri"""
        pass
    
    def test_extract_sections(self):
        """Bölüm ayırma testleri"""
        pass
    
    def test_categorize_content(self):
        """İçerik kategorileme testleri"""
        pass

class TestContentMerger:
    def test_merge_sections(self):
        """Bölüm birleştirme testleri"""
        pass
    
    def test_resolve_duplicates(self):
        """Tekrar temizleme testleri"""
        pass
    
    def test_create_toc(self):
        """İçindekiler oluşturma testleri"""
        pass
```

### Integration Tests

```python
class TestFullPipeline:
    def test_complete_merge_process(self):
        """Tam birleştirme süreci testi"""
        pass
    
    def test_multilingual_handling(self):
        """Çok dilli içerik işleme testi"""
        pass
    
    def test_output_quality(self):
        """Çıktı kalitesi testi"""
        pass
```

### Quality Assurance

1. **İçerik Doğruluğu**: Orijinal bilgilerin korunması
2. **Bağlantı Kontrolü**: Tüm internal linklerin çalışması
3. **Format Tutarlılığı**: Markdown formatının doğruluğu
4. **Dil Tutarlılığı**: Türkçe ve İngilizce içeriklerin uyumu

## Implementation Approach

### Aşama 1: Analiz ve Planlama
1. Tüm mevcut dosyaları kataloglama
2. İçerik analizi ve kategorileme
3. Tekrarlanan içerikleri belirleme
4. Hedef yapıyı tasarlama

### Aşama 2: İçerik İşleme
1. Dosyaları okuma ve ayrıştırma
2. Bölümleri kategorilere ayırma
3. Tekrarları temizleme
4. Dil ayrımı yapma

### Aşama 3: Birleştirme ve Organizasyon
1. Kategorileri mantıklı sıraya dizme
2. İçerikleri birleştirme
3. İçindekiler tablosu oluşturma
4. Navigasyon linkleri ekleme

### Aşama 4: Kalite Kontrolü
1. İçerik doğruluğunu kontrol etme
2. Bağlantıları test etme
3. Format tutarlılığını sağlama
4. Kullanıcı testleri yapma

### Aşama 5: Temizlik ve Finalizasyon
1. Eski dosyaları yedekleme
2. Gereksiz dosyaları temizleme
3. Referansları güncelleme
4. Final dokümantasyonu yayınlama

## Performance Considerations

### Dosya İşleme Optimizasyonu
- Büyük dosyalar için streaming okuma
- Paralel işleme için multiprocessing
- Bellek kullanımını optimize etme

### İçerik Önbellekleme
- İşlenmiş içerikleri cache'leme
- Değişiklik tespiti için hash kullanma
- Incremental update desteği

### Çıktı Optimizasyonu
- Markdown rendering performansı
- İçindekiler tablosu optimizasyonu
- Büyük dokümantasyon için bölümleme

## Security and Maintenance

### Güvenlik Önlemleri
- Dosya yolu güvenliği
- İçerik sanitizasyonu
- Zararlı markdown önleme

### Bakım Stratejisi
- Otomatik güncelleme sistemi
- Versiyon kontrolü
- Değişiklik takibi
- Rollback mekanizması

## Migration Strategy

### Mevcut Sistemle Uyumluluk
1. Eski dosyaları SAFE_DELETE klasörüne taşıma
2. Yönlendirme sistemi oluşturma
3. Aşamalı geçiş planı
4. Geri dönüş stratejisi

### Kullanıcı Eğitimi
1. Yeni yapı hakkında bilgilendirme
2. Geçiş rehberi hazırlama
3. Sık sorulan sorular
4. Destek kanalları