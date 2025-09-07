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

  // Preference system initialization
  function initializePreferences() {
    try {
      // Initialize sliders
      initializeSliders();
      
      // Initialize quick selection buttons
      initializeQuickSelection();
      
      // Initialize explore button
      initializeExploreButton();
      
      console.log('Preference system initialized successfully');
    } catch (err) {
      console.error('Error initializing preferences:', err);
    }
  }

  // Initialize preference sliders
  function initializeSliders() {
    const sliders = document.querySelectorAll('.preference-slider');
    const valueLabels = ['İlgilenmiyorum', 'Az İlgim Var', 'İlgim Var', 'Çok İlgim Var', 'Kesinlikle İhtiyacım Var'];

    sliders.forEach(slider => {
      const valueDisplay = document.getElementById(slider.id + '-value');
      
      // Update display on slider change
      slider.addEventListener('input', function() {
        const value = parseInt(this.value);
        if (valueDisplay) {
          valueDisplay.textContent = valueLabels[value] || valueLabels[0];
        }
      });

      // Initialize display
      const initialValue = parseInt(slider.value);
      if (valueDisplay) {
        valueDisplay.textContent = valueLabels[initialValue] || valueLabels[0];
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

    const valueLabels = ['İlgilenmiyorum', 'Az İlgim Var', 'İlgim Var', 'Çok İlgim Var', 'Kesinlikle İhtiyacım Var'];

    // Apply preset values to sliders with animation
    Object.entries(presetConfig).forEach(([category, value]) => {
      const slider = document.getElementById(category);
      const valueDisplay = document.getElementById(category + '-value');
      
      if (slider && valueDisplay) {
        // Animate slider change
        const currentValue = parseInt(slider.value);
        const targetValue = value;
        
        if (currentValue !== targetValue) {
          animateSliderChange(slider, valueDisplay, currentValue, targetValue, valueLabels);
        }
      }
    });

    console.log(`Applied preset: ${preset}`);
  }

  // Animate slider value change
  function animateSliderChange(slider, valueDisplay, fromValue, toValue, valueLabels) {
    const steps = Math.abs(toValue - fromValue);
    const stepDirection = toValue > fromValue ? 1 : -1;
    const stepDuration = 100; // ms per step
    
    let currentStep = 0;
    
    const animate = () => {
      if (currentStep < steps) {
        const currentValue = fromValue + (stepDirection * currentStep);
        slider.value = currentValue;
        valueDisplay.textContent = valueLabels[currentValue] || valueLabels[0];
        
        // Add visual feedback
        slider.parentElement.classList.add('updating');
        
        currentStep++;
        setTimeout(animate, stepDuration);
      } else {
        // Final value
        slider.value = toValue;
        valueDisplay.textContent = valueLabels[toValue] || valueLabels[0];
        
        // Remove visual feedback
        setTimeout(() => {
          slider.parentElement.classList.remove('updating');
        }, 200);
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

  // Start free exploration mode
  async function startFreeExploration() {
    const exploreBtn = document.getElementById('exploreBtn');
    const resultsSection = document.getElementById('resultsSection');
    const mapSection = document.getElementById('mapSection');
    
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

      try {
        if (Array.isArray(pois) && pois.length > 0 && (typeof window.updateMapWithPOIs === 'function' || typeof updateMapWithPOIs === 'function')) {
          (window.updateMapWithPOIs || updateMapWithPOIs)(pois);
        }
      } catch (e) {
        console.warn('Could not update map with POIs:', e);
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
      // Remove loading state
      exploreBtn.classList.remove('loading');
      exploreBtn.querySelector('.btn-text').textContent = 'Serbest Keşif';
    }
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
      
      console.log(`Loaded ${pois.length} POIs for exploration`);
      
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

      console.log('Displaying POIs on exploration map:', pois.length);

      // Try different methods to display POIs
      if (typeof window.displayAllPOIs === 'function') {
        window.displayAllPOIs(pois);
      } else if (typeof displayPOIsOnMap === 'function') {
        displayPOIsOnMap(pois);
      } else if (typeof window.showAllPOIsOnMap === 'function') {
        window.showAllPOIsOnMap(pois);
      } else {
        // Fallback: trigger recommendation system with all preferences set to 0
        console.log('Using fallback method to display POIs');
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
