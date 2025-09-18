(function(){
  // Isolate page-specific bootstrapping for personal (dynamic) routes
  try {
    // Hint main script which mode we're in
    window.currentTab = 'dynamic-routes';

    // Optional: parent ↔ iframe bridge (skeleton)
    window.addEventListener('message', function(e){
      // Reserved for future cross-frame communication
      // e.data && e.data.type === 'parent:ping'
    });

    // Notify parent shell this iframe is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'personal:ready' }, '*');
    }

    // Initialize preference system when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializePreferences);
    } else {
      initializePreferences();
    }

  } catch (err) {
    console.error('personal_routes bootstrap error:', err);
  }

  // Enhanced preference levels system
  const preferenceLevels = {
    0: {
      text: 'İlgilenmiyorum',
      weight: 0,
      description: 'Bu kategoride hiç ilgi duymuyorum',
      multiplier: 0.1,
      color: '#e2e8f0',
      icon: 'times-circle'
    },
    1: {
      text: 'Az İlgim Var',
      weight: 0.25,
      description: 'Ara sıra ilgilenirim',
      multiplier: 0.5,
      color: '#cbd5e1',
      icon: 'minus-circle'
    },
    2: {
      text: 'İlgim Var',
      weight: 0.5,
      description: 'Ortalama düzeyde ilgilenirim',
      multiplier: 1.0,
      color: '#94a3b8',
      icon: 'circle'
    },
    3: {
      text: 'Çok İlgim Var',
      weight: 0.75,
      description: 'Çok fazla ilgilenirim',
      multiplier: 1.5,
      color: '#64748b',
      icon: 'plus-circle'
    },
    4: {
      text: 'Kesinlikle İhtiyacım Var',
      weight: 1.0,
      description: 'Bu kategoride mutlaka deneyim yaşamak istiyorum',
      multiplier: 2.0,
      color: '#1e293b',
      icon: 'star'
    }
  };

  // Initialize enhanced preference system
  function initializeEnhancedPreferences() {
    console.warn('Initializing enhanced preference system...');

    // Add CSS for enhanced UI
    addEnhancedPreferenceStyles();

    // Initialize preference level indicators
    initializePreferenceLevelIndicators();

    // Initialize smart presets
    initializeSmartPresets();
  }

  // Get current context information
  function getCurrentContext() {
    return {
      timeOfDay: new Date().getHours(),
      weather: 'sunny', // Bu gerçek hava durumu API'sinden gelebilir
      season: new Date().getMonth() + 1,
      groupSize: 1,
      purpose: 'tourism'
    };
  }

  // Add enhanced CSS styles
  function addEnhancedPreferenceStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .preference-level-indicator {
        display: flex;
        justify-content: center;
        margin-top: 8px;
      }

      .level-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 2px solid #e2e8f0;
        transition: all 0.3s ease;
        cursor: help;
      }

      .preference-item.level-0 .level-indicator { background: #e2e8f0; border-color: #e2e8f0; }
      .preference-item.level-1 .level-indicator { background: #cbd5e1; border-color: #cbd5e1; }
      .preference-item.level-2 .level-indicator { background: #94a3b8; border-color: #94a3b8; }
      .preference-item.level-3 .level-indicator { background: #64748b; border-color: #64748b; }
      .preference-item.level-4 .level-indicator { background: #1e293b; border-color: #1e293b; }

      .preference-text {
        font-weight: 500;
        color: #374151;
        font-size: 0.9rem;
      }

      /* Tooltip styling for descriptions */
      .preference-info span[title] {
        cursor: help;
        border-bottom: 1px dotted #cbd5e1;
      }

      .preference-info span[title]:hover {
        border-bottom-color: #94a3b8;
      }

      .slider-track {
        --fill-percentage: 0%;
        background: linear-gradient(to right,
          #3b82f6 0%,
          #3b82f6 var(--fill-percentage),
          #e2e8f0 var(--fill-percentage),
          #e2e8f0 100%);
        transition: all 0.3s ease;
      }

      .slider-track.updating {
        animation: pulse 0.3s ease-in-out;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .preference-item.updating {
        animation: preferenceUpdate 0.6s ease-in-out;
      }

      @keyframes preferenceUpdate {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }

      /* Smart Preset Styles */
      .smart-preset {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 12px;
        padding: 12px 16px;
        margin: 4px;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        min-height: 80px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .smart-preset:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }

      .smart-preset.active {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        box-shadow: 0 6px 25px rgba(79, 172, 254, 0.5);
      }

      .preset-info {
        flex: 1;
        text-align: left;
      }

      .preset-name {
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 2px;
      }

      .preset-description {
        font-size: 0.75rem;
        opacity: 0.9;
        margin-bottom: 2px;
      }

      .preset-reasoning {
        font-size: 0.7rem;
        opacity: 0.8;
        font-style: italic;
      }

      /* Preset Feedback Styles */
      .preset-feedback {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 0;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 16px;
        font-weight: 500;
        animation: slideInRightEnhanced 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        min-width: 320px;
      }

      .preset-feedback-icon {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        margin: 12px 0 12px 12px;
      }

      .preset-feedback-content {
        flex: 1;
        padding: 12px 0;
      }

      .preset-feedback-title {
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 2px;
      }

      .preset-feedback-message {
        font-size: 0.85rem;
        opacity: 0.9;
        margin-bottom: 2px;
      }

      .preset-feedback-reason {
        font-size: 0.75rem;
        opacity: 0.8;
        font-style: italic;
      }

      .preset-feedback-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        opacity: 0.7;
        transition: all 0.2s ease;
        margin-right: 12px;
      }

      .preset-feedback-close:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.1);
      }

      @keyframes slideInRightEnhanced {
        from {
          transform: translateX(100%) scale(0.8);
          opacity: 0;
        }
        to {
          transform: translateX(0) scale(1);
          opacity: 1;
        }
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .recommendations-tier-summary {
          justify-content: flex-start;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .tier-badge {
          flex-shrink: 0;
        }

        .preference-level-indicator {
          margin-top: 6px;
        }

        .level-indicator {
          width: 6px;
          height: 6px;
        }
      }

      /* Compact layout for better space usage */
      .preference-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .preference-title {
        font-weight: 600;
        color: #374151;
      }

      .preference-value {
        text-align: right;
        min-width: 120px;
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize preference level indicators
  function initializePreferenceLevelIndicators() {
    const preferenceItems = document.querySelectorAll('.preference-item');

    preferenceItems.forEach(item => {
      const category = item.dataset.category;
      const slider = item.querySelector('.preference-slider');
      const valueDisplay = item.querySelector('.preference-value');

      if (slider && valueDisplay) {
        // Add compact level indicator (just the dot)
        const indicator = document.createElement('div');
        indicator.className = 'preference-level-indicator';
        indicator.innerHTML = `<div class="level-indicator" title="Seviye açıklaması burada görünecek"></div>`;

        valueDisplay.parentNode.appendChild(indicator);

        // Update on slider change
        slider.addEventListener('input', () => {
          updateEnhancedSliderDisplay(slider, valueDisplay, indicator);
        });

        // Initial update
        updateEnhancedSliderDisplay(slider, valueDisplay, indicator);
      }
    });
  }

  // Enhanced slider display update function
  function updateEnhancedSliderDisplay(slider, valueDisplay, indicator) {
    const value = parseInt(slider.value);
    console.log(`🔧 Updating slider ${slider.id} to ${value}`);

    const preferenceData = preferenceLevels[value];

    if (!preferenceData) {
      console.error(`❌ No preferenceData found for value ${value}`);
      return;
    }

    // Update container class for styling
    const container = slider.closest('.preference-item');
    if (container) {
      container.className = container.className.replace(/level-\d+/g, '');
      container.classList.add(`level-${value}`);
    }

    // Update value display with compact enhanced info
    if (valueDisplay) {
      valueDisplay.innerHTML = `
        <div class="preference-text">${preferenceData.text}</div>
      `;

      // Add description as title attribute for hover tooltip
      valueDisplay.title = preferenceData.description;
    }

    // Update level indicator if exists
    if (indicator) {
      const levelIndicator = indicator.querySelector('.level-indicator');

      if (levelIndicator) {
        levelIndicator.style.backgroundColor = preferenceData.color;
        levelIndicator.style.borderColor = preferenceData.color;
        levelIndicator.title = preferenceData.description;
      }
    }

    // Update slider track
    const percentage = (value / 4) * 100;
    const track = slider.parentElement?.querySelector('.slider-track') || slider;
    if (track) {
      track.style.setProperty('--fill-percentage', `${percentage}%`);
    }

    // Add visual feedback (unless skipped)
    if (container) {
      container.classList.add('updating');
      setTimeout(() => {
        container.classList.remove('updating');
      }, 300);
    }
  }

  // Initialize smart presets
  function initializeSmartPresets() {
    // Get context information
    const context = getCurrentContext();

    // Generate smart presets
    const smartPresets = generateSmartPresets({}, context);

    // Display smart presets in UI
    displaySmartPresets(smartPresets);

    console.warn('Smart presets initialized:', smartPresets.length);
  }

  // Akıllı preset sistemi
  function generateSmartPresets(userProfile, context) {
    const smartPresets = [];
    const currentHour = context?.timeOfDay || new Date().getHours();
    const currentWeather = context?.weather || 'unknown';
    const currentSeason = context?.season || new Date().getMonth() + 1;

    // Zaman bazlı öneriler
    if (currentHour >= 6 && currentHour <= 10) {
        smartPresets.push({
            name: 'Sabah Keyfi',
            icon: 'sun',
            description: 'Kahvaltı ve sabah aktiviteleri',
            preferences: { yemek: 4, rahatlatıcı: 3, doga: 2 },
            reasoning: 'Sabah saatlerinde enerji dolu aktiviteler',
            type: 'time-based'
        });
    } else if (currentHour >= 17 && currentHour <= 21) {
        smartPresets.push({
            name: 'Akşam Yemeği & Eğlence',
            icon: 'moon',
            description: 'Yemek ve akşam eğlencesi',
            preferences: { yemek: 4, gece_hayati: 3, eglence: 3 },
            reasoning: 'Akşam saatlerinde sosyal aktiviteler',
            type: 'time-based'
        });
    }

    // Hava durumu bazlı öneriler
    if (currentWeather === 'sunny') {
        smartPresets.push({
            name: 'Güneşli Gün',
            icon: 'sun',
            description: 'Açık hava aktiviteleri',
            preferences: { doga: 4, macera: 3, spor: 3 },
            reasoning: 'Güneşli havada açık hava deneyimleri',
            type: 'weather-based'
        });
    } else if (currentWeather === 'rainy') {
        smartPresets.push({
            name: 'Yağmurlu Gün',
            icon: 'cloud-rain',
            description: 'Kapalı mekan aktiviteleri',
            preferences: { tarihi: 4, sanat_kultur: 3, alisveris: 3 },
            reasoning: 'Yağmurlu havada kapalı mekan seçenekleri',
            type: 'weather-based'
        });
    }

    // Mevsim bazlı öneriler
    if (currentSeason >= 6 && currentSeason <= 8) { // Yaz
        smartPresets.push({
            name: 'Yaz Aktiviteleri',
            icon: 'umbrella-beach',
            description: 'Yaz mevsimi için ideal aktiviteler',
            preferences: { doga: 4, macera: 3, yemek: 3 },
            reasoning: 'Yaz mevsiminde açık hava ve su aktiviteleri',
            type: 'season-based'
        });
    } else if (currentSeason >= 12 || currentSeason <= 2) { // Kış
        smartPresets.push({
            name: 'Kış Aktiviteleri',
            icon: 'snowflake',
            description: 'Kış mevsimi için sıcak aktiviteler',
            preferences: { rahatlatıcı: 4, tarihi: 3, yemek: 3 },
            reasoning: 'Kış mevsiminde kapalı mekan ve sıcak aktiviteler',
            type: 'season-based'
        });
    }

    // Geçmiş davranış bazlı öneriler
    if (userProfile?.history && userProfile.history.length > 0) {
        const favoriteCategory = getMostFrequentCategory(userProfile.history);
        if (favoriteCategory) {
            smartPresets.push({
                name: `${getCategoryDisplayName(favoriteCategory)} Odaklı`,
                icon: getCategoryIcon(favoriteCategory),
                description: `Daha fazla ${getCategoryDisplayName(favoriteCategory)} deneyimi`,
                preferences: { [favoriteCategory]: 4 },
                reasoning: 'Geçmiş tercihlerinize göre kişiselleştirildi',
                type: 'behavior-based'
            });
        }
    }

    // Grup boyutu bazlı öneriler
    if (context?.groupSize) {
        if (context.groupSize > 4) {
            smartPresets.push({
                name: 'Grup Aktiviteleri',
                icon: 'users',
                description: 'Büyük grup için uygun yerler',
                preferences: { eglence: 4, yemek: 3, alisveris: 2 },
                reasoning: 'Grup boyutu için optimize edildi',
                type: 'group-based'
            });
        } else if (context.groupSize === 2) {
            smartPresets.push({
                name: 'Romantik Kaçamak',
                icon: 'heart',
                description: 'İkili için özel yerler',
                preferences: { rahatlatıcı: 4, yemek: 4, doga: 2 },
                reasoning: 'Romantik atmosfer için uygun yerler',
                type: 'group-based'
            });
        }
    }

    // Özel durumlar
    if (context?.purpose === 'business') {
        smartPresets.push({
            name: 'İş Seyahati',
            icon: 'briefcase',
            description: 'İş seyahati için uygun yerler',
            preferences: { rahatlatıcı: 3, yemek: 3, tarihi: 2 },
            reasoning: 'İş seyahati için profesyonel ve rahat ortamlar',
            type: 'purpose-based'
        });
    }

    // Trend bazlı öneriler (mevcut POI verilerine göre)
    const trendingPreset = generateTrendingPreset();
    if (trendingPreset) {
        smartPresets.push(trendingPreset);
    }

    return smartPresets.slice(0, 4); // Maksimum 4 akıllı öneri
  }

  function getMostFrequentCategory(history) {
    const categoryCounts = {};
    history.forEach(item => {
        if (item.category) {
            categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
        }
    });

    return Object.entries(categoryCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
  }

  function getCategoryDisplayName(category) {
    const names = {
        'doga': 'Doğa',
        'yemek': 'Yemek',
        'tarihi': 'Tarih',
        'eglence': 'Eğlence',
        'sanat_kultur': 'Sanat & Kültür',
        'macera': 'Macera',
        'rahatlatici': 'Rahatlatıcı',
        'spor': 'Spor',
        'alisveris': 'Alışveriş',
        'gece_hayati': 'Gece Hayatı'
    };
    return names[category] || category;
  }

  function getCategoryIcon(category) {
    const icons = {
        'doga': 'tree',
        'yemek': 'utensils',
        'tarihi': 'landmark',
        'eglence': 'gamepad',
        'sanat_kultur': 'palette',
        'macera': 'mountain',
        'rahatlatıcı': 'spa',
        'spor': 'running',
        'alisveris': 'shopping-bag',
        'gece_hayati': 'moon'
    };
    return icons[category] || 'map-marker-alt';
  }

  function generateTrendingPreset() {
    // Bu fonksiyon gerçek POI verilerinden trendleri analiz edebilir
    // Şimdilik örnek bir preset döndürüyoruz
    return {
        name: 'Trend Yerler',
        icon: 'fire',
        description: 'Şu anda popüler olan yerler',
        preferences: { eglence: 3, yemek: 3, gece_hayati: 2 },
        reasoning: 'Güncel trendlere göre seçilmiş yerler',
        type: 'trending'
    };
  }

  // Akıllı preset'leri UI'ya ekle
  function displaySmartPresets(smartPresets) {
    console.log('🎨 Displaying smart presets:', smartPresets);

    const presetContainer = document.querySelector('.quick-selection-buttons');
    console.log('📦 Preset container found:', !!presetContainer);

    if (!presetContainer) {
      console.error('❌ Preset container not found!');
      return;
    }

    // Önce mevcut akıllı preset'leri temizle
    const existingSmart = presetContainer.querySelectorAll('.smart-preset');
    existingSmart.forEach(el => el.remove());
    console.log('🧹 Cleared existing smart presets');

    // Yeni akıllı preset'leri ekle
    smartPresets.forEach(preset => {
        console.log('➕ Adding preset:', preset.name);

        const presetElement = document.createElement('button');
        presetElement.className = 'quick-btn smart-preset';
        presetElement.innerHTML = `
            <i class="fas fa-${preset.icon}"></i>
            <div class="preset-info">
                <div class="preset-name">${preset.name}</div>
                <div class="preset-description">${preset.description}</div>
                <div class="preset-reasoning">${preset.reasoning}</div>
            </div>
        `;

        presetElement.addEventListener('click', () => {
          console.log('🎯 Smart preset clicked:', preset.name);
          applySmartPreset(preset);
          highlightSmartPreset(presetElement);
        });

        presetContainer.appendChild(presetElement);
        console.log('✅ Preset added to DOM:', preset.name);
    });

    console.log('🎉 All smart presets displayed');
  }

  function applySmartPreset(preset) {
    console.log('🎯 Applying smart preset:', preset.name);
    console.log('📊 Preferences:', preset.preferences);

    // DOM hazır mı kontrol et
    if (document.readyState !== 'complete') {
      console.warn('⚠️ DOM not ready, waiting...');
      setTimeout(() => applySmartPreset(preset), 100);
      return;
    }

    // Smart preset'ler için doğrudan slider'ları güncelle
    // applyPreset fonksiyonunu kullanma çünkü presets objesinde yok
    let updatedCount = 0;

    Object.entries(preset.preferences).forEach(([category, value]) => {
      console.log(`🔄 Processing ${category} -> ${value}`);

      const slider = document.getElementById(category);
      const valueDisplay = document.getElementById(category + '-value');

      console.log(`🔍 Slider found for ${category}:`, !!slider);
      console.log(`🔍 ValueDisplay found for ${category}:`, !!valueDisplay);

      if (slider && valueDisplay) {
        console.log(`✅ Both elements found for ${category}`);

        // Animate slider change with enhanced display
        const currentValue = parseInt(slider.value);
        const targetValue = value;

        console.log(`📊 ${category}: ${currentValue} -> ${targetValue}`);

        if (currentValue !== targetValue) {
          // Önce doğrudan slider'ı güncelle (fallback)
          slider.value = targetValue;
          console.log(`🔧 Set slider ${category} value to ${targetValue}`);

          updateEnhancedSliderDisplay(slider, valueDisplay);
          console.log(`🎨 Updated display for ${category}`);

          // Sonra animasyonu çalıştır
          setTimeout(() => {
            animateSliderChange(slider, valueDisplay, currentValue, targetValue);
            console.log(`✨ Animation started for ${category}`);
          }, 50);

          updatedCount++;
        } else {
          console.log(`⏭️ ${category} already at target value ${targetValue}`);
        }
      } else {
        console.error(`❌ Could not find slider or valueDisplay for ${category}`);
        console.error(`   Slider element:`, slider);
        console.error(`   ValueDisplay element:`, valueDisplay);
      }
    });

    console.log(`🎉 Applied smart preset: ${preset.name} (${updatedCount} sliders updated)`);

    // Kullanıcı geri bildirimi
    showPresetFeedback(preset);

    // Preset kullanımını takip et
    trackPresetUsage(preset);
  }

  function highlightSmartPreset(element) {
    // Tüm akıllı preset'lerin vurgusunu kaldır
    const allSmart = document.querySelectorAll('.smart-preset');
    allSmart.forEach(el => el.classList.remove('active'));

    // Seçili preset'i vurgula
    element.classList.add('active');

    // Belirli bir süre sonra vurguyu kaldır
    setTimeout(() => {
      element.classList.remove('active');
    }, 3000);
  }

  function showPresetFeedback(preset) {
    // Önceki bildirimleri temizle
    const existingNotifications = document.querySelectorAll('.preset-feedback');
    existingNotifications.forEach(notification => notification.remove());

    // Yeni bildirim oluştur
    const notification = document.createElement('div');
    notification.className = 'preset-feedback';
    notification.innerHTML = `
        <div class="preset-feedback-icon">
            <i class="fas fa-${preset.icon}"></i>
        </div>
        <div class="preset-feedback-content">
            <div class="preset-feedback-title">${preset.name}</div>
            <div class="preset-feedback-message">Ayarlar başarıyla uygulandı!</div>
            <div class="preset-feedback-reason">${preset.reasoning}</div>
        </div>
        <button class="preset-feedback-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    // Otomatik kapanma
    let autoCloseTimeout = setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 4000);

    // Hover'da otomatik kapanmayı durdur
    notification.addEventListener('mouseenter', () => {
        clearTimeout(autoCloseTimeout);
    });

    notification.addEventListener('mouseleave', () => {
        autoCloseTimeout = setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 2000);
    });
  }

  // Preset kullanımını takip et (gelecekte analitik için)
  function trackPresetUsage(preset) {
    const usageData = {
      presetName: preset.name,
      presetType: preset.type,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      context: getCurrentContext()
    };

    // Local storage'a kaydet (şimdilik)
    try {
      const usageHistory = JSON.parse(localStorage.getItem('presetUsageHistory') || '[]');
      usageHistory.push(usageData);

      // Son 50 kullanımı tut
      if (usageHistory.length > 50) {
        usageHistory.splice(0, usageHistory.length - 50);
      }

      localStorage.setItem('presetUsageHistory', JSON.stringify(usageHistory));
    } catch (e) {
      console.warn('Could not save preset usage data:', e);
    }
  }

  // Test function for debugging smart presets
  function testSmartPreset() {
    console.log('🧪 Testing Güneşli Gün preset...');

    const testPreset = {
      name: 'Güneşli Gün',
      preferences: { doga: 4, macera: 3, spor: 3 },
      reasoning: 'Test preset',
      type: 'test'
    };

    applySmartPreset(testPreset);
  }

  // Debug function to check all elements
  function debugElements() {
    console.log('🔍 Debug: Checking all elements...');

    // Check preset container
    const presetContainer = document.querySelector('.quick-selection-buttons');
    console.log('📦 Preset container:', presetContainer);

    // Check smart presets
    const smartPresets = document.querySelectorAll('.smart-preset');
    console.log('🎯 Smart presets found:', smartPresets.length);
    smartPresets.forEach((preset, index) => {
      console.log(`   ${index + 1}. ${preset.textContent.trim()}`);
    });

    // Check sliders
    const sliders = ['doga', 'yemek', 'tarihi', 'eglence', 'sanat_kultur', 'macera', 'rahatlatici', 'spor', 'alisveris', 'gece_hayati'];
    sliders.forEach(category => {
      const slider = document.getElementById(category);
      const valueDisplay = document.getElementById(category + '-value');
      console.log(`🔧 ${category}: slider=${!!slider}, display=${!!valueDisplay}`);
    });

    // Check context
    const context = getCurrentContext();
    console.log('🌤️ Current context:', context);

    return {
      presetContainer: !!presetContainer,
      smartPresetsCount: smartPresets.length,
      sliders: sliders.map(cat => ({
        category: cat,
        slider: !!document.getElementById(cat),
        display: !!document.getElementById(cat + '-value')
      })),
      context: context
    };
  }

  // Manual test functions
  function testSlider(category, value) {
    console.log(`🧪 Testing slider ${category} -> ${value}`);

    const slider = document.getElementById(category);
    const valueDisplay = document.getElementById(category + '-value');

    if (slider && valueDisplay) {
      slider.value = value;
      updateEnhancedSliderDisplay(slider, valueDisplay);
      console.log(`✅ Successfully updated ${category} to ${value}`);
      return true;
    } else {
      console.error(`❌ Could not find elements for ${category}`);
      return false;
    }
  }

  // Global test functions - make sure they're available
  function setupGlobalFunctions() {
    window.testSmartPreset = testSmartPreset;
    window.debugElements = debugElements;
    window.testSlider = testSlider;

    console.log('🔧 Global test functions set up:', {
      testSmartPreset: typeof window.testSmartPreset,
      debugElements: typeof window.debugElements,
      testSlider: typeof window.testSlider
    });
  }

  // Setup immediately and also after DOM is ready
  setupGlobalFunctions();

  // Also setup when DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobalFunctions);
  } else {
    // DOM already loaded, but try again in case
    setTimeout(setupGlobalFunctions, 100);
  }

  // Preference system initialization
  function initializePreferences() {
    try {
      // Initialize enhanced preference system
      initializeEnhancedPreferences();

      // Initialize sliders
      initializeSliders();

      // Initialize quick selection buttons
      initializeQuickSelection();

      // Initialize explore button
      initializeExploreButton();

      console.warn('Preference system initialized successfully');
    } catch (err) {
      console.error('Error initializing preferences:', err);
    }
  }

  // Initialize preference sliders (enhanced version)
  function initializeSliders() {
    const sliders = document.querySelectorAll('.preference-slider');

    sliders.forEach(slider => {
      const valueDisplay = document.getElementById(slider.id + '-value');

      // Update display on slider change
      slider.addEventListener('input', function() {
        const indicator = valueDisplay?.parentNode?.querySelector('.preference-level-indicator');
        updateEnhancedSliderDisplay(slider, valueDisplay, indicator);
      });

      // Initialize display
      const initialValue = parseInt(slider.value);
      if (valueDisplay) {
        updateEnhancedSliderDisplay(slider, valueDisplay);
      }
    });
  }

  // Initialize quick selection buttons
  function initializeQuickSelection() {
    const quickButtons = document.querySelectorAll('.quick-btn[data-preset]');
    
    quickButtons.forEach(button => {
      button.addEventListener('click', function() {
        const preset = this.dataset.preset;
        applyPreset(preset);
        // Auto-trigger recommendations after applying a preset
        try {
          const recommendBtn = document.getElementById('recommendBtn');
          if (recommendBtn && !recommendBtn.disabled) {
            setTimeout(() => {
              if (!recommendBtn.disabled) {
                recommendBtn.click();
              }
            }, 600);
          }
        } catch (e) {
          // Silent if recommend flow unavailable
        }
        
        // Visual feedback
        quickButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        // Remove active state after animation
        setTimeout(() => {
          this.classList.remove('active');
        }, 2000);
      });
    });
  }

  // Apply preset configurations to sliders
  function applyPreset(preset) {
    const presets = {
      'nature': {
        'doga': 4,
        'macera': 3,
        'rahatlatici': 3,
        'spor': 2,
        'tarihi': 1,
        'yemek': 2,
        'eglence': 1,
        'sanat_kultur': 1,
        'alisveris': 0,
        'gece_hayati': 0
      },
      'culture': {
        'tarihi': 4,
        'sanat_kultur': 4,
        'doga': 1,
        'yemek': 2,
        'macera': 1,
        'rahatlatici': 2,
        'eglence': 2,
        'spor': 0,
        'alisveris': 1,
        'gece_hayati': 1
      },
      'food': {
        'yemek': 4,
        'tarihi': 2,
        'sanat_kultur': 2,
        'doga': 1,
        'rahatlatici': 3,
        'eglence': 2,
        'macera': 0,
        'spor': 0,
        'alisveris': 1,
        'gece_hayati': 2
      },
      'relax': {
        'rahatlatici': 4,
        'doga': 3,
        'yemek': 3,
        'tarihi': 1,
        'sanat_kultur': 2,
        'macera': 0,
        'spor': 1,
        'eglence': 1,
        'alisveris': 2,
        'gece_hayati': 0
      },
      'adventure': {
        'macera': 4,
        'spor': 4,
        'doga': 3,
        'eglence': 2,
        'yemek': 2,
        'tarihi': 1,
        'sanat_kultur': 1,
        'rahatlatici': 1,
        'alisveris': 0,
        'gece_hayati': 1
      },
      'nightlife': {
        'gece_hayati': 4,
        'eglence': 4,
        'yemek': 3,
        'alisveris': 2,
        'sanat_kultur': 2,
        'spor': 1,
        'macera': 0,
        'doga': 0,
        'tarihi': 1,
        'rahatlatici': 1
      },
      'shopping': {
        'alisveris': 4,
        'yemek': 3,
        'eglence': 2,
        'sanat_kultur': 2,
        'gece_hayati': 2,
        'rahatlatici': 2,
        'tarihi': 1,
        'doga': 0,
        'macera': 0,
        'spor': 0
      },
      'art': {
        'sanat_kultur': 4,
        'tarihi': 3,
        'yemek': 2,
        'alisveris': 2,
        'eglence': 2,
        'rahatlatici': 2,
        'doga': 1,
        'gece_hayati': 1,
        'macera': 0,
        'spor': 0
      },
      'family': {
        'eglence': 4,
        'doga': 3,
        'yemek': 3,
        'tarihi': 2,
        'sanat_kultur': 2,
        'alisveris': 2,
        'rahatlatici': 2,
        'spor': 1,
        'macera': 1,
        'gece_hayati': 0
      },
      'romantic': {
        'rahatlatici': 4,
        'yemek': 4,
        'doga': 3,
        'sanat_kultur': 3,
        'tarihi': 2,
        'gece_hayati': 2,
        'eglence': 1,
        'alisveris': 1,
        'spor': 0,
        'macera': 0
      }
    };

    const presetConfig = presets[preset];
    if (!presetConfig) {
      console.warn('Unknown preset:', preset);
      return;
    }

    // Apply preset values to sliders (immediate + events for reliability)
    Object.entries(presetConfig).forEach(([category, value]) => {
      const slider = document.getElementById(category);
      const valueDisplay = document.getElementById(category + '-value');
      if (slider && valueDisplay) {
        slider.value = value;
        updateEnhancedSliderDisplay(slider, valueDisplay);
        try {
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          slider.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
      }
    });

    console.warn(`Applied preset: ${preset}`);
  }

  // Animate slider value change with enhanced display
  function animateSliderChange(slider, valueDisplay, fromValue, toValue) {
    const steps = Math.abs(toValue - fromValue);
    const stepDirection = toValue > fromValue ? 1 : -1;
    const stepDuration = 100; // ms per step
    
    let currentStep = 0;
    
    const animate = () => {
      if (currentStep < steps) {
        const currentValue = fromValue + (stepDirection * currentStep);
        slider.value = currentValue;

        // Use enhanced display method
        updateEnhancedSliderDisplay(slider, valueDisplay, {
          forceValue: currentValue,
          skipAnimation: true
        });

        // Add visual feedback
        slider.parentElement.classList.add('updating');

        currentStep++;
        setTimeout(animate, stepDuration);
      } else {
        // Final value
        slider.value = toValue;

        // Use enhanced display method for final value
        updateEnhancedSliderDisplay(slider, valueDisplay, {
          forceValue: toValue,
          skipAnimation: false
        });

        // Remove visual feedback
        setTimeout(() => {
          slider.parentElement.classList.remove('updating');
        }, 200);

        // Dispatch change event so any listeners recalc preferences
        try {
          slider.dispatchEvent(new Event('change', { bubbles: true }));
          slider.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (_) {}
      }
    };
    
    animate();
  }

  // Initialize explore button
  function initializeExploreButton() {
    const exploreBtn = document.getElementById('exploreBtn');
    
    if (exploreBtn) {
      exploreBtn.addEventListener('click', function() {
        startFreeExploration();
      });
    }
  }

  // Safety: event delegation fallback for quick presets
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.quick-btn[data-preset]');
    if (!btn) return;
    const preset = btn.dataset.preset;
    if (!preset) return;
    try {
      applyPreset(preset);
    } catch (err) {
      console.error('Preset apply failed via delegation:', err);
    }
  });

  // Start free exploration mode
  async function startFreeExploration() {
    const exploreBtn = document.getElementById('exploreBtn');
    const resultsSection = document.getElementById('resultsSection');
    const mapSection = document.getElementById('mapSection');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    try {
      // Add loading state
      exploreBtn.classList.add('loading');
      exploreBtn.querySelector('.btn-text').textContent = 'Yükleniyor';
      
      // Show results section
      resultsSection.style.display = 'block';
      
      // Clear previous results
      const recommendationResults = document.getElementById('recommendationResults');
      recommendationResults.innerHTML = `
        <div class="exploration-header">
          <h3><i class="fas fa-compass"></i> Serbest Keşif Modu</h3>
          <p>Tüm POI'ler haritada gösteriliyor. İstediğiniz yeri keşfedebilir, detaylarını inceleyebilirsiniz.</p>
        </div>
      `;
      
      // Show map section first
      mapSection.style.display = 'block';
      
      // Initialize main map (independent of recommendations)
      try {
        if (typeof window.initializeMainMap === 'function' || typeof initializeMainMap === 'function') {
          await (window.initializeMainMap || initializeMainMap)();
        }
      } catch (mapError) {
        console.warn('Map initialization error (continuing anyway):', mapError);
      }

      // Load all POIs and show them on the map
      const pois = await loadAllPOIs();
      let mapUpdated = false;

      try {
        if (Array.isArray(pois) && pois.length > 0 && (typeof window.updateMapWithPOIs === 'function' || typeof updateMapWithPOIs === 'function')) {
          (window.updateMapWithPOIs || updateMapWithPOIs)(pois);
          mapUpdated = true;
        }
      } catch (e) {
        console.warn('Could not update map with POIs:', e);
      }

      if (!mapUpdated) {
        displayPOIsOnExplorationMap(pois);
      }

      // Focus the map section
      try {
        if (typeof window.switchToDynamicMapView === 'function' || typeof switchToDynamicMapView === 'function') {
          (window.switchToDynamicMapView || switchToDynamicMapView)();
        } else {
          setTimeout(() => {
            mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 200);
        }
      } catch (_) {}
      
    } catch (error) {
      console.error('Error in free exploration:', error);
      
      // Show error message
      const recommendationResults = document.getElementById('recommendationResults');
      recommendationResults.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Bir hata oluştu</h3>
          <p>POI'ler yüklenirken bir sorun yaşandı: ${error.message || 'Bilinmeyen hata'}</p>
          <button onclick="location.reload()" class="retry-btn">Sayfayı Yenile</button>
        </div>
      `;
      
    } finally {
      hideRecommendationLoadingIndicator(loadingIndicator);

      // Remove loading state
      exploreBtn.classList.remove('loading');
      exploreBtn.querySelector('.btn-text').textContent = 'Serbest Keşif';
    }
  }

  function hideRecommendationLoadingIndicator(loadingIndicatorFromCaller) {
    const indicator = loadingIndicatorFromCaller || document.getElementById('loadingIndicator');
    if (!indicator) {
      return;
    }

    if (window.loadingManager && typeof window.loadingManager.hideLoading === 'function') {
      try {
        window.loadingManager.hideLoading('loadingIndicator');
      } catch (managerError) {
        console.warn('Loading manager hide failed:', managerError);
      }
    }

    indicator.style.display = 'none';

    if (indicator.style.opacity) {
      indicator.style.opacity = '';
    }

    indicator.classList.remove('d-none');
    indicator.removeAttribute('hidden');
  }

  // Load all POIs for exploration
  async function loadAllPOIs() {
    try {
      // Use the existing API endpoint to get all POIs
      const apiBase = window.apiBase || '/api';
      const response = await fetch(`${apiBase}/pois`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();

      // Handle different response formats
      let pois = [];
      if (Array.isArray(data)) {
        // Direct array
        pois = data;
      } else if (data && Array.isArray(data.pois)) {
        // Paginated list { pois: [...] }
        pois = data.pois;
      } else if (data && Array.isArray(data.data)) {
        // Generic data container { data: [...] }
        pois = data.data;
      } else if (data && data.results && Array.isArray(data.results)) {
        // Alternative { results: [...] }
        pois = data.results;
      } else if (data && typeof data === 'object') {
        // Categorized object: { categoryName: [ ...pois ], ... }
        // Flatten all category arrays
        try {
          const flattened = [];
          for (const [category, list] of Object.entries(data)) {
            if (Array.isArray(list)) {
              for (const poi of list) {
                // Preserve existing poi fields and ensure category is set
                flattened.push({ ...poi, category: poi.category || category });
              }
            }
          }
          pois = flattened;
        } catch (e) {
          console.warn('Failed to flatten categorized POIs:', e);
          pois = [];
        }
      } else {
        console.warn('Unexpected API response format:', data);
        pois = [];
      }
      
      console.warn(`Loaded ${pois.length} POIs for exploration`);
      
      // Display POI count
      const recommendationResults = document.getElementById('recommendationResults');
      const existingHeader = recommendationResults.querySelector('.exploration-header');
      if (existingHeader) {
        existingHeader.innerHTML = `
          <h3><i class="fas fa-compass"></i> Serbest Keşif Modu</h3>
          <p><strong>${pois.length} POI</strong> haritada gösteriliyor. İstediğiniz yeri keşfedebilir, detaylarını inceleyebilirsiniz.</p>
          <div class="exploration-stats">
            <span class="stat-item"><i class="fas fa-map-marker-alt"></i> ${pois.length} Konum</span>
            <span class="stat-item"><i class="fas fa-layer-group"></i> Tüm Kategoriler</span>
            <span class="stat-item"><i class="fas fa-mouse-pointer"></i> Tıklayarak Keşfedin</span>
          </div>
        `;
      }
      
      // If no POIs, show graceful empty state
      if (!(pois.length > 0)) {
        console.warn('No POIs found to display');

        // Graceful empty-state UI instead of throwing
        const recommendationResults = document.getElementById('recommendationResults');
        const existingHeader = recommendationResults.querySelector('.exploration-header');
        if (existingHeader) {
          existingHeader.insertAdjacentHTML('afterend', `
            <div class="no-results" style="margin: 16px 0;">
              <div class="no-results-icon"><i class="fas fa-map-marker-alt"></i></div>
              <h3>Henüz POI Bulunamadı</h3>
              <p>Sistemde kayıtlı POI görünmüyor. Yine de haritayı keşfedebilir veya aşağıdaki seçenekleri deneyebilirsiniz.</p>
              <div style="display:flex; gap:10px; justify-content:center; flex-wrap: wrap;">
                <button class="retry-btn" onclick="location.reload()"><i class="fas fa-redo"></i> Yeniden Dene</button>
                <button class="retry-btn" onclick="document.getElementById('recommendBtn')?.click()"><i class="fas fa-magic"></i> Önerilerimi Getir</button>
              </div>
            </div>
          `);
        }
      }
      
      return pois;
      
    } catch (error) {
      console.error('Error loading POIs:', error);
      throw error;
    }
  }

  // Safely display POIs on map for exploration
  function displayPOIsOnExplorationMap(pois) {
    try {
      // Validate POIs array
      if (!Array.isArray(pois) || pois.length === 0) {
        console.warn('Invalid POIs array for map display');
        return;
      }

      console.warn('Displaying POIs on exploration map:', pois.length);

      // Try different methods to display POIs
      if (typeof window.displayAllPOIs === 'function') {
        window.displayAllPOIs(pois);
      } else if (typeof displayPOIsOnMap === 'function') {
        displayPOIsOnMap(pois);
      } else if (typeof window.showAllPOIsOnMap === 'function') {
        window.showAllPOIsOnMap(pois);
      } else {
        // Fallback: trigger recommendation system with all preferences set to 0
        console.warn('Using fallback method to display POIs');
        triggerRecommendationWithAllPOIs(pois);
      }

    } catch (error) {
      console.error('Error displaying POIs on map:', error);
      // Don't throw here, just log the error
    }
  }

  // Fallback method to trigger recommendation system
  function triggerRecommendationWithAllPOIs(pois) {
    try {
      // Set all preferences to 0 to get all POIs
      const sliders = document.querySelectorAll('.preference-slider');
      sliders.forEach(slider => {
        slider.value = 0;
      });

      // Trigger the main recommendation system
      const recommendBtn = document.getElementById('recommendBtn');
      if (recommendBtn && typeof recommendBtn.click === 'function') {
        // Simulate click on recommend button
        setTimeout(() => {
          recommendBtn.click();
        }, 100);
      } else {
        console.warn('Could not trigger recommendation system');
      }

    } catch (error) {
      console.error('Error in fallback POI display:', error);
    }
  }


})();
