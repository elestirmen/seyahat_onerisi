# Design Document

## Overview

Bu tasarım, POI öneri sistemine Google Earth benzeri kullanıcı dostu bir konum izni dialog'u entegre eder. Mevcut `getUserLocation()` fonksiyonunu genişleterek, tarayıcının varsayılan konum izni dialog'u yerine özel bir arayüz sunar.

## Architecture

### Component Structure
```
LocationPermissionDialog
├── Dialog Container (Modal)
├── Header (Title + Close Button)
├── Content Area
│   ├── Location Icon
│   ├── Permission Message
│   └── Action Buttons
└── Overlay (Background)
```

### Integration Points
- Mevcut `getUserLocation()` fonksiyonu ile entegrasyon
- localStorage ile kullanıcı tercihlerinin saklanması
- POI öneri sisteminin mevcut error handling mekanizması ile uyum

## Components and Interfaces

### 1. LocationPermissionDialog Class

```javascript
class LocationPermissionDialog {
    constructor() {
        this.isVisible = false;
        this.userPreference = null;
        this.onPermissionGranted = null;
        this.onPermissionDenied = null;
    }

    show(options = {}) {
        // Dialog'u göster
    }

    hide() {
        // Dialog'u gizle
    }

    handlePermissionChoice(choice) {
        // Kullanıcı seçimini işle
    }
}
```

### 2. Permission Storage Interface

```javascript
const PermissionStorage = {
    STORAGE_KEY: 'poi_location_permission',
    
    savePreference(preference) {
        // localStorage'a kaydet
    },
    
    getPreference() {
        // localStorage'dan oku
    },
    
    clearPreference() {
        // Tercihi temizle
    }
};
```

### 3. Enhanced getUserLocation Function

Mevcut `getUserLocation()` fonksiyonu şu şekilde genişletilecek:

```javascript
async function getUserLocation() {
    // 1. Önce kullanıcı tercihini kontrol et
    const savedPreference = PermissionStorage.getPreference();
    
    if (savedPreference === 'never') {
        throw new Error('Kullanıcı konum iznini reddetmiş');
    }
    
    // 2. Tarayıcı izin durumunu kontrol et
    const permission = await navigator.permissions.query({name: 'geolocation'});
    
    if (permission.state === 'denied') {
        // Özel dialog göster
        return showLocationPermissionDialog();
    }
    
    if (permission.state === 'prompt') {
        // Özel dialog göster
        return showLocationPermissionDialog();
    }
    
    // 3. İzin varsa direkt konum al
    return getCurrentPositionPromise();
}
```

## Data Models

### Permission Preference Model
```javascript
const PermissionPreference = {
    ALWAYS: 'always',      // Siteyi ziyaret ederken izin ver
    ONCE: 'once',          // Bu defalık izin ver
    NEVER: 'never'         // Hiçbir zaman izin verme
};
```

### Dialog State Model
```javascript
const DialogState = {
    isVisible: false,
    currentChoice: null,
    callbacks: {
        onAllow: null,
        onDeny: null,
        onClose: null
    }
};
```

## User Interface Design

### Dialog Layout
```html
<div class="location-permission-overlay">
    <div class="location-permission-dialog">
        <div class="dialog-header">
            <h3>earth.google.com şunu yapmak istiyor:</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="dialog-content">
            <div class="permission-icon">
                <i class="fas fa-map-marker-alt"></i>
            </div>
            <p class="permission-message">Konumunuzu bilme</p>
            <div class="permission-buttons">
                <button class="permission-btn allow-always">
                    Siteyi ziyaret ederken izin ver
                </button>
                <button class="permission-btn allow-once">
                    Bu defalık izin ver
                </button>
                <button class="permission-btn deny">
                    Hiçbir zaman izin verme
                </button>
            </div>
        </div>
    </div>
</div>
```

### CSS Design System

#### Color Palette
- Primary Blue: #4285f4 (Google Blue)
- Light Blue: #e8f0fe
- Text Dark: #202124
- Text Light: #5f6368
- Border: #dadce0
- Background: rgba(0, 0, 0, 0.5)

#### Typography
- Header: 16px, font-weight: 500
- Message: 14px, font-weight: 400
- Buttons: 14px, font-weight: 500

#### Spacing
- Dialog padding: 24px
- Button spacing: 8px
- Icon size: 24px

## Error Handling

### Permission Denied Scenarios
1. **Kullanıcı "Hiçbir zaman izin verme" seçerse:**
   - Tercihi localStorage'a kaydet
   - Uygun hata mesajı göster
   - Alternatif çözümler öner (manuel konum girişi)

2. **Tarayıcı konum iznini reddetmişse:**
   - Tarayıcı ayarlarından izin verme talimatları göster
   - Site ayarlarını sıfırlama seçeneği sun

3. **Konum servisi kullanılamıyorsa:**
   - Güvenli bağlantı gerekliliğini açıkla
   - HTTPS kullanımını öner

### Fallback Mechanisms
- Manuel konum girişi seçeneği
- Varsayılan konum kullanımı
- IP tabanlı konum tespiti

## Testing Strategy

### Unit Tests
1. **LocationPermissionDialog Class Tests:**
   - Dialog gösterme/gizleme
   - Kullanıcı seçimi işleme
   - Callback fonksiyonları

2. **PermissionStorage Tests:**
   - localStorage okuma/yazma
   - Tercih kaydetme/silme
   - Hatalı veri işleme

### Integration Tests
1. **getUserLocation Function Tests:**
   - Farklı izin durumları
   - Dialog entegrasyonu
   - Error handling

2. **UI Interaction Tests:**
   - Button click handling
   - Dialog close behavior
   - Responsive design

### User Experience Tests
1. **Permission Flow Tests:**
   - İlk ziyaret deneyimi
   - Tekrar ziyaret senaryoları
   - İzin değiştirme akışı

2. **Accessibility Tests:**
   - Keyboard navigation
   - Screen reader compatibility
   - Focus management

## Performance Considerations

### Loading Strategy
- Dialog HTML'i lazy loading
- CSS sadece gerektiğinde yükleme
- JavaScript modül olarak organize etme

### Memory Management
- Dialog kapatıldığında event listener'ları temizleme
- DOM elementlerini cache'leme
- Gereksiz re-render'ları önleme

### Mobile Optimization
- Touch-friendly button sizes (minimum 44px)
- Responsive breakpoints
- Gesture support (swipe to close)

## Security Considerations

### Data Privacy
- Kullanıcı tercihlerini sadece localStorage'da saklama
- Konum verilerini sunucuya göndermeme
- HTTPS gerekliliğini zorunlu kılma

### Permission Validation
- Tarayıcı API'si ile çift kontrol
- Sahte permission state'lerini önleme
- Cross-origin güvenlik kontrolü

## Implementation Phases

### Phase 1: Core Dialog
- Basic dialog HTML/CSS
- Show/hide functionality
- Button click handlers

### Phase 2: Permission Logic
- localStorage integration
- Permission state checking
- getUserLocation integration

### Phase 3: Enhanced UX
- Animations and transitions
- Responsive design
- Accessibility features

### Phase 4: Testing & Polish
- Comprehensive testing
- Performance optimization
- Browser compatibility