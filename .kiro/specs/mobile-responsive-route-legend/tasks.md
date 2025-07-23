# Implementation Plan

- [x] 1. Create responsive CSS system for legend panel
  - Create CSS media queries for mobile, tablet, and desktop breakpoints
  - Implement mobile-first responsive design approach
  - Add CSS custom properties for consistent theming
  - Create smooth transition animations for legend show/hide
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 6.4_

- [x] 2. Implement mobile legend toggle button component
  - Create fixed-position toggle button for mobile devices
  - Add FontAwesome icons with state-based icon switching
  - Implement touch-friendly button sizing (minimum 44px)
  - Add visual feedback animations for button interactions
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 2.4_

- [x] 3. Develop JavaScript controller for responsive legend behavior
  - Create legend state management system
  - Implement toggle functionality for mobile legend visibility
  - Add screen size detection and responsive behavior switching
  - Create auto-hide functionality when user interacts with map
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2_

- [x] 4. Integrate responsive legend system into Python function
  - Modify `add_enhanced_legend_and_controls` function to generate responsive HTML
  - Add responsive meta viewport tag to HTML output
  - Integrate CSS and JavaScript code generation into existing function
  - Ensure backward compatibility with existing legend functionality
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Implement desktop mode preservation and mobile detection
  - Add CSS media query logic to show/hide toggle button based on screen size
  - Preserve existing desktop legend behavior for screens >768px
  - Implement smooth transitions between mobile and desktop modes
  - Add window resize event handling for dynamic mode switching
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Add touch event handling and mobile optimizations
  - Implement touch event listeners for mobile interactions
  - Add swipe gesture support for legend closing
  - Optimize touch target sizes for mobile usability
  - Add haptic feedback simulation through CSS animations
  - _Requirements: 2.4, 1.3, 6.1, 6.2_

- [x] 7. Create comprehensive error handling and fallbacks
  - Add graceful degradation for unsupported CSS features
  - Implement JavaScript error handling for missing DOM elements
  - Add fallback styles for older browsers
  - Create feature detection for touch capabilities
  - _Requirements: 4.4, 3.4_

- [x] 8. Test responsive legend across different screen sizes and devices
  - Test mobile legend functionality on various mobile screen sizes (320px-768px)
  - Verify desktop legend preservation on screens >768px
  - Test tablet behavior in intermediate screen sizes (769px-1024px)
  - Validate touch interactions and button responsiveness
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

- [x] 9. Optimize performance and animations
  - Implement hardware-accelerated CSS animations using transform3d
  - Add reduced motion support for accessibility
  - Optimize JavaScript event handling with debouncing
  - Test animation performance on low-end mobile devices
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 10. Integrate and validate with existing category route planner
  - Test integration with `category_route_planner_with_db.py`
  - Verify that existing layer toggle functionality continues to work
  - Test with different numbers of categories and POI data
  - Validate HTML output generation and JavaScript injection
  - _Requirements: 4.1, 4.2, 4.3, 4.4_