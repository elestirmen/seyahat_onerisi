# Design Document

## Overview

POI Media Viewer, harita üzerindeki POI popup'larında bulunan medya içeriklerini (resimler, videolar, ses dosyaları) modern bir modal arayüzde görüntüleyen bir JavaScript bileşenidir. Bu sistem, mevcut category_route_planner_with_db.py dosyasındaki POI popup'larına entegre edilecek ve kullanıcılara zengin medya deneyimi sunacaktır.

## Architecture

### Component Structure
```
POI Media Viewer
├── MediaModal (Ana modal container)
├── MediaDisplay (Medya görüntüleme alanı)
├── NavigationControls (İleri/geri butonları)
├── MediaInfo (Başlık, açıklama, metadata)
├── MediaControls (Video/audio kontrolleri)
└── ThumbnailStrip (Küçük resim şeridi)
```

### Integration Points
- **category_route_planner_with_db.py**: POI popup HTML'ine medya click handler'ları eklenir
- **Folium Map**: Modal overlay harita üzerine eklenir
- **POI API**: Medya URL'leri ve metadata'sı API'den alınır

## Components and Interfaces

### 1. MediaModal Class

```javascript
class MediaModal {
    constructor(options = {}) {
        this.currentIndex = 0;
        this.mediaItems = [];
        this.mediaType = null; // 'image', 'video', 'audio'
        this.poiId = null;
        this.isVisible = false;
    }
    
    // Public Methods
    show(mediaItems, startIndex = 0)
    hide()
    next()
    previous()
    goToIndex(index)
    
    // Private Methods
    _createModal()
    _renderMedia(mediaItem)
    _updateNavigation()
    _bindEvents()
}
```

### 2. Media Display Components

#### Image Display
```javascript
class ImageDisplay {
    render(imageData) {
        return `
            <div class="media-image-container">
                <img src="${imageData.url}" 
                     alt="${imageData.title || 'POI Image'}"
                     class="media-image"
                     loading="lazy">
                <div class="image-controls">
                    <button class="zoom-in">🔍+</button>
                    <button class="zoom-out">🔍-</button>
                    <button class="fullscreen">⛶</button>
                </div>
            </div>
        `;
    }
}
```

#### Video Display
```javascript
class VideoDisplay {
    render(videoData) {
        return `
            <div class="media-video-container">
                <video controls class="media-video" preload="metadata">
                    <source src="${videoData.url}" type="${videoData.mimeType}">
                    Video desteklenmiyor.
                </video>
            </div>
        `;
    }
}
```

#### Audio Display
```javascript
class AudioDisplay {
    render(audioData) {
        return `
            <div class="media-audio-container">
                <div class="audio-info">
                    <h4>${audioData.title || 'Ses Dosyası'}</h4>
                </div>
                <audio controls class="media-audio" preload="metadata">
                    <source src="${audioData.url}" type="${audioData.mimeType}">
                    Ses desteklenmiyor.
                </audio>
                <div class="audio-waveform" id="waveform-${audioData.id}"></div>
            </div>
        `;
    }
}
```

### 3. Navigation System

```javascript
class NavigationControls {
    constructor(modal) {
        this.modal = modal;
    }
    
    render() {
        return `
            <div class="media-navigation">
                <button class="nav-btn prev-btn" ${this.modal.currentIndex === 0 ? 'disabled' : ''}>
                    <i class="fa fa-chevron-left"></i>
                </button>
                <div class="media-counter">
                    ${this.modal.currentIndex + 1} / ${this.modal.mediaItems.length}
                </div>
                <button class="nav-btn next-btn" ${this.modal.currentIndex === this.modal.mediaItems.length - 1 ? 'disabled' : ''}>
                    <i class="fa fa-chevron-right"></i>
                </button>
            </div>
        `;
    }
}
```

## Data Models

### MediaItem Interface
```javascript
interface MediaItem {
    id: string;
    type: 'image' | 'video' | 'audio';
    url: string;
    thumbnailUrl?: string;
    title?: string;
    description?: string;
    mimeType: string;
    fileSize?: number;
    uploadDate?: string;
    duration?: number; // for video/audio
    dimensions?: { width: number, height: number }; // for images/videos
}
```

### POI Media Response
```javascript
interface POIMediaResponse {
    poiId: string;
    images: MediaItem[];
    videos: MediaItem[];
    audios: MediaItem[];
}
```

## Error Handling

### Error Types
1. **Network Errors**: Medya yüklenemediğinde
2. **Format Errors**: Desteklenmeyen medya formatları
3. **Permission Errors**: Erişim izni olmayan medya
4. **Loading Errors**: Bozuk veya eksik dosyalar

### Error Display
```javascript
class ErrorDisplay {
    static render(error) {
        return `
            <div class="media-error">
                <div class="error-icon">⚠️</div>
                <h3>Medya Yüklenemedi</h3>
                <p>${error.message}</p>
                <button class="retry-btn" onclick="retryLoad()">Tekrar Dene</button>
            </div>
        `;
    }
}
```

## Testing Strategy

### Unit Tests
- MediaModal class methods
- Navigation logic
- Media type detection
- Error handling scenarios

### Integration Tests
- POI popup integration
- API data loading
- Modal show/hide functionality
- Keyboard navigation

### User Experience Tests
- Mobile responsiveness
- Touch gesture support
- Loading performance
- Accessibility compliance

### Test Data Structure
```javascript
const testMediaData = {
    poiId: "test-poi-1",
    images: [
        {
            id: "img1",
            type: "image",
            url: "/test-images/poi1-image1.jpg",
            title: "Test Image 1",
            mimeType: "image/jpeg"
        }
    ],
    videos: [
        {
            id: "vid1", 
            type: "video",
            url: "/test-videos/poi1-video1.mp4",
            title: "Test Video 1",
            mimeType: "video/mp4",
            duration: 120
        }
    ],
    audios: [
        {
            id: "aud1",
            type: "audio", 
            url: "/test-audios/poi1-audio1.mp3",
            title: "Test Audio 1",
            mimeType: "audio/mpeg",
            duration: 180
        }
    ]
};
```

## Implementation Details

### CSS Architecture
```css
/* Modal Base Styles */
.media-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Responsive Design */
@media (max-width: 768px) {
    .media-modal-content {
        width: 95vw;
        height: 90vh;
        margin: 0;
    }
}
```

### JavaScript Integration
```javascript
// POI popup'a medya click handler ekleme
function addMediaClickHandlers(poiId) {
    document.querySelectorAll(`#poi-images-${poiId} img`).forEach((img, index) => {
        img.addEventListener('click', () => {
            loadPOIMedia(poiId, 'image', index);
        });
    });
    
    document.querySelectorAll(`#poi-videos-${poiId} video`).forEach((video, index) => {
        video.addEventListener('click', () => {
            loadPOIMedia(poiId, 'video', index);
        });
    });
    
    document.querySelectorAll(`#poi-audios-${poiId} audio`).forEach((audio, index) => {
        audio.addEventListener('click', () => {
            loadPOIMedia(poiId, 'audio', index);
        });
    });
}
```

### Performance Optimizations
1. **Lazy Loading**: Sadece görünen medya yüklenir
2. **Preloading**: Bir sonraki/önceki medya arka planda yüklenir
3. **Caching**: Yüklenen medya cache'lenir
4. **Progressive Loading**: Büyük medya için önce düşük kalite
5. **Virtual Scrolling**: Çok sayıda medya için

### Accessibility Features
1. **ARIA Labels**: Screen reader desteği
2. **Keyboard Navigation**: Tab, Arrow keys, ESC
3. **Focus Management**: Modal açılırken focus yönetimi
4. **High Contrast**: Yüksek kontrast modu desteği
5. **Caption Support**: Video altyazı desteği

### Mobile Optimizations
1. **Touch Gestures**: Swipe navigation
2. **Responsive Layout**: Ekran boyutuna uyum
3. **Touch Targets**: Büyük dokunma alanları
4. **Bandwidth Optimization**: Mobil için optimize edilmiş medya
5. **Orientation Support**: Yatay/dikey mod desteği