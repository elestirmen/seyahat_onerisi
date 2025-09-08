(function(){
  // Isolate page-specific bootstrapping for predefined routes
  try {
    // Ensure we favor predefined flows
    window.currentTab = 'predefined-routes';

    // FORCE MOBILE ROUTE CARD LAYOUT
    function forceMobileRouteCards() {
      // Check for real mobile devices or small screens
      const isMobile = window.innerWidth <= 768 ||
                      window.screen.width <= 768 ||
                      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        console.warn('🔧 Forcing mobile route card layout for device:', {
          innerWidth: window.innerWidth,
          screenWidth: window.screen.width,
          userAgent: navigator.userAgent.substring(0, 50) + '...'
        });

        // Force list layout with aggressive override
        const routesList = document.querySelector('.predefined-routes-list');
        if (routesList) {
          routesList.style.setProperty('display', 'flex', 'important');
          routesList.style.setProperty('flex-direction', 'column', 'important');
          routesList.style.setProperty('gap', '16px', 'important');
          routesList.style.setProperty('padding', '0 8px', 'important');
          routesList.style.setProperty('width', '100%', 'important');
          routesList.style.setProperty('box-sizing', 'border-box', 'important');

          // Remove any grid classes that might conflict
          routesList.classList.remove('grid', 'grid-layout', 'cards-grid');
        }

        // Force card layout with aggressive override
        const routeCards = document.querySelectorAll('.predefined-routes-list .route-card');
        routeCards.forEach(card => {
          card.style.setProperty('display', 'block', 'important');
          card.style.setProperty('min-height', '420px', 'important');
          card.style.setProperty('width', '100%', 'important');
          card.style.setProperty('margin', '0', 'important');
          card.style.setProperty('border-radius', '16px', 'important');
          card.style.setProperty('box-shadow', '0 4px 20px rgba(0, 0, 0, 0.1)', 'important');
          card.style.setProperty('overflow', 'hidden', 'important');
          card.style.setProperty('position', 'relative', 'important');
          card.style.setProperty('box-sizing', 'border-box', 'important');

          // Remove any conflicting classes
          card.classList.remove('grid-item', 'col', 'card-grid');
        });

        // Force image layout with aggressive override
        const cardImages = document.querySelectorAll('.predefined-routes-list .route-card .route-card-image');
        cardImages.forEach(img => {
          img.style.setProperty('height', '180px', 'important');
          img.style.setProperty('width', '100%', 'important');
          img.style.setProperty('border-radius', '16px 16px 0 0', 'important');
          img.style.setProperty('background-color', '#f3f4f6', 'important');
          img.style.setProperty('display', 'block', 'important');
          img.style.setProperty('overflow', 'hidden', 'important');
        });

        // Force header layout with aggressive override
        const cardHeaders = document.querySelectorAll('.predefined-routes-list .route-card .route-card-header');
        cardHeaders.forEach(header => {
          header.style.setProperty('padding', '24px 16px 16px 16px', 'important');
          header.style.setProperty('display', 'block', 'important');
        });

        // Force title styling with aggressive override
        const cardTitles = document.querySelectorAll('.predefined-routes-list .route-card .route-card-title');
        cardTitles.forEach(title => {
          title.style.setProperty('font-size', '1.1rem', 'important');
          title.style.setProperty('font-weight', '600', 'important');
          title.style.setProperty('margin-bottom', '8px', 'important');
          title.style.setProperty('line-height', '1.3', 'important');
        });

        // Force description styling with aggressive override
        const cardDescriptions = document.querySelectorAll('.predefined-routes-list .route-card .route-card-description');
        cardDescriptions.forEach(desc => {
          desc.style.setProperty('font-size', '0.9rem', 'important');
          desc.style.setProperty('line-height', '1.5', 'important');
          desc.style.setProperty('color', '#666', 'important');
          desc.style.setProperty('margin', '0 0 20px 0', 'important');
          desc.style.setProperty('display', '-webkit-box', 'important');
          desc.style.setProperty('-webkit-line-clamp', '5', 'important');
          desc.style.setProperty('-webkit-box-orient', 'vertical', 'important');
          desc.style.setProperty('overflow', 'hidden', 'important');
          desc.style.setProperty('text-overflow', 'ellipsis', 'important');
          desc.style.setProperty('visibility', 'visible', 'important');
          desc.style.setProperty('opacity', '1', 'important');

          // Ensure description has content
          if (!desc.textContent || desc.textContent.trim() === '' || desc.textContent === 'Açıklama bulunmuyor.') {
            desc.textContent = 'Bu rota için özel bir açıklama bulunmuyor. Ancak bölgenin en güzel manzaralarını, tarihi ve kültürel zenginliklerini keşfetme fırsatı sunan eşsiz bir deneyim sizi bekliyor. Doğanın kalbinde unutulmaz anılar biriktirmeye hazır mısınız?';
          }
        });

        // Force meta layout with aggressive override
        const cardMetas = document.querySelectorAll('.predefined-routes-list .route-card .route-card-meta');
        cardMetas.forEach(meta => {
          meta.style.setProperty('padding', '0 16px 20px 16px', 'important');
          meta.style.setProperty('display', 'grid', 'important');
          meta.style.setProperty('grid-template-columns', '1fr 1fr', 'important');
          meta.style.setProperty('gap', '8px', 'important');
        });

        // Force meta item styling with aggressive override
        const metaItems = document.querySelectorAll('.predefined-routes-list .route-card .route-meta-item');
        metaItems.forEach(item => {
          item.style.setProperty('display', 'flex', 'important');
          item.style.setProperty('align-items', 'center', 'important');
          item.style.setProperty('gap', '6px', 'important');
          item.style.setProperty('padding', '6px 10px', 'important');
          item.style.setProperty('font-size', '0.85rem', 'important');
          item.style.setProperty('font-weight', '500', 'important');
          item.style.setProperty('border-radius', '8px', 'important');
          item.style.setProperty('background', 'rgba(59, 130, 246, 0.08)', 'important');
          item.style.setProperty('color', '#2563eb', 'important');
          item.style.setProperty('border', '1px solid rgba(59, 130, 246, 0.15)', 'important');
          item.style.setProperty('min-width', '0', 'important');
          item.style.setProperty('white-space', 'nowrap', 'important');
          item.style.setProperty('justify-content', 'flex-start', 'important');
          item.style.setProperty('box-sizing', 'border-box', 'important');
          item.style.setProperty('visibility', 'visible', 'important');
          item.style.setProperty('opacity', '1', 'important');

          // Force icons within meta items
          const icons = item.querySelectorAll('i, .fas, .far, .fab');
          icons.forEach(icon => {
            icon.style.setProperty('display', 'inline-block', 'important');
            icon.style.setProperty('visibility', 'visible', 'important');
            icon.style.setProperty('opacity', '1', 'important');
            icon.style.setProperty('font-size', '0.8rem', 'important');
            icon.style.setProperty('color', 'inherit', 'important');
            icon.style.setProperty('margin', '0', 'important');
            icon.style.setProperty('padding', '0', 'important');
          });

        // Hide refresh buttons
        const refreshButtons = document.querySelectorAll('.route-media-refresh-btn');
        refreshButtons.forEach(btn => {
          btn.style.setProperty('display', 'none', 'important');
          btn.style.setProperty('visibility', 'hidden', 'important');
        });
        });

        console.warn('✅ Mobile route card layout forced successfully');
      }
    }

    // Real device detection and cache busting
    const isRealMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                               window.screen.width <= 768 ||
                               window.innerWidth <= 768;

    // Force on multiple events for real devices
    function setupMobileForce() {
      if (isRealMobileDevice) {
        console.warn('📱 Real mobile device detected - Setting up aggressive layout forcing');

        // Force immediately
        forceMobileRouteCards();

        // Force on multiple intervals for cache busting
        const intervals = [100, 300, 500, 1000, 2000, 3000];
        intervals.forEach(delay => setTimeout(forceMobileRouteCards, delay));

        // Force on user interactions
        ['touchstart', 'touchend', 'click', 'scroll'].forEach(event => {
          document.addEventListener(event, () => setTimeout(forceMobileRouteCards, 50), { once: true });
        });
      }
    }

    // Apply on load and resize with multiple attempts
    window.addEventListener('load', setupMobileForce);
    window.addEventListener('resize', () => setTimeout(forceMobileRouteCards, 100));

    // Also apply after routes are loaded with multiple attempts
    const originalLoadPredefinedRoutes = window.loadPredefinedRoutes;
    if (originalLoadPredefinedRoutes) {
      window.loadPredefinedRoutes = async function() {
        const result = await originalLoadPredefinedRoutes.apply(this, arguments);
        const delays = [100, 300, 500, 1000, 2000];
        delays.forEach(delay => setTimeout(forceMobileRouteCards, delay));
        return result;
      };
    }

    // Force on DOM ready with real device check
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupMobileForce);
    } else {
      setupMobileForce();
    }

    // Extra force for real mobile devices
    if (isRealMobileDevice) {
      // Force on orientation change
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          forceMobileRouteCards();
          setTimeout(forceMobileRouteCards, 500);
        }, 100);
      });

      // Force on visibility change (when app comes back from background)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          setTimeout(forceMobileRouteCards, 100);
        }
      });
    }

    // Optional: parent ↔ iframe bridge (skeleton)
    window.addEventListener('message', function(e){
      // Reserved for future cross-frame communication
      // e.data && e.data.type === 'parent:ping'
    });

    // Notify parent shell this iframe is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'predefined:ready' }, '*');
    }

    // In split-page mode, there are no tabs; proactively load routes
    document.addEventListener('DOMContentLoaded', function(){
      try {
        if (typeof initializePredefinedRoutes === 'function') {
          initializePredefinedRoutes();
        }
      } catch (e) {
        console.error('initializePredefinedRoutes failed:', e);
      }

      (async () => {
        try {
          if (typeof loadPredefinedRoutes === 'function') {
            await loadPredefinedRoutes();
          }
        } catch (e) {
          console.error('loadPredefinedRoutes failed:', e);
        }
        try {
          if (typeof initializePredefinedMap === 'function') {
            await initializePredefinedMap();
          }
        } catch (e) {
          console.error('initializePredefinedMap failed:', e);
        }
      })();
    });
  } catch (err) {
    console.error('predefined_routes bootstrap error:', err);
  }
})();
