#!/usr/bin/env node

/**
 * Automated test for in-modal media overlay functionality
 * Tests predefined_routes.html page for media modal issues
 */

const puppeteer = require('puppeteer');

async function testMediaOverlay() {
    console.log('🚀 Starting automated media overlay test...');
    
    let browser;
    let results = {
        pageLoaded: false,
        jsLoaded: false,
        contextDetection: null,
        buttonsFound: false,
        overlayWorks: false,
        errors: []
    };
    
    try {
        // Launch browser
        browser = await puppeteer.launch({ 
            headless: false, // Show browser for debugging
            devtools: true,  // Open dev tools
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Listen to console messages
        page.on('console', msg => {
            const text = msg.text();
            console.log(`📋 Console: ${text}`);
            
            // Capture specific debug messages
            if (text.includes('updateMediaNavigation context:')) {
                results.contextDetection = text;
            }
            if (text.includes('Found buttons:')) {
                results.buttonsFound = text.includes('true');
            }
        });
        
        // Listen to errors
        page.on('error', err => {
            console.error('❌ Page Error:', err.message);
            results.errors.push(err.message);
        });
        
        // Go to predefined routes page
        console.log('🌐 Loading predefined routes page...');
        await page.goto('http://localhost:5560/predefined_routes.html', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        results.pageLoaded = true;
        console.log('✅ Page loaded successfully');
        
        // Wait for JavaScript to load
        await page.waitForFunction(() => typeof window.currentTab !== 'undefined', { timeout: 10000 });
        
        // Check if main JS functions are loaded
        const jsCheck = await page.evaluate(() => {
            return {
                currentTab: window.currentTab,
                pathname: window.location.pathname,
                hasCreateInModal: typeof createInModalMediaOverlay === 'function',
                hasTestFunction: typeof window.testInModalOverlay === 'function',
                hasCurrentMediaItems: typeof currentMediaItems !== 'undefined'
            };
        });
        
        console.log('🔍 JavaScript check:', jsCheck);
        results.jsLoaded = jsCheck.hasCreateInModal;
        
        // Test context detection
        const contextTest = await page.evaluate(() => {
            const isPersonalRoutes = window.location.pathname.includes('personal_routes') || window.currentTab === 'dynamic-routes';
            const isPredefinedRoutes = window.location.pathname.includes('predefined_routes') || window.currentTab === 'predefined-routes';
            
            return {
                currentTab: window.currentTab,
                pathname: window.location.pathname,
                isPersonalRoutes,
                isPredefinedRoutes
            };
        });
        
        console.log('🎯 Context detection:', contextTest);
        results.contextDetection = contextTest;
        
        // Test button selectors
        const buttonTest = await page.evaluate(() => {
            const personalButtons = {
                prev: document.querySelector('#poiDetailModal #poiMediaPrevBtn'),
                next: document.querySelector('#poiDetailModal #poiMediaNextBtn')
            };
            
            const predefinedButtons = {
                prev: document.querySelector('#poiDetailModal #predefinedMediaPrevBtn'),
                next: document.querySelector('#poiDetailModal #predefinedMediaNextBtn')
            };
            
            return {
                personalButtons: { prev: !!personalButtons.prev, next: !!personalButtons.next },
                predefinedButtons: { prev: !!predefinedButtons.prev, next: !!predefinedButtons.next },
                poiModal: !!document.querySelector('#poiDetailModal')
            };
        });
        
        console.log('🎛️ Button test:', buttonTest);
        results.buttonsFound = buttonTest.predefinedButtons.prev && buttonTest.predefinedButtons.next;
        
        // Try to test the overlay manually
        if (jsCheck.hasCreateInModal) {
            try {
                const overlayTest = await page.evaluate(() => {
                    // Set up test data
                    if (typeof currentMediaItems === 'undefined') {
                        window.currentMediaItems = [
                            { path: '/static/images/urgup-balloons.jpg', type: 'image', title: 'Test Image 1' }
                        ];
                    }
                    
                    // Try to create overlay
                    if (typeof createInModalMediaOverlay === 'function') {
                        try {
                            createInModalMediaOverlay(0);
                            return { success: true, overlay: !!document.querySelector('.in-modal-media-overlay') };
                        } catch (e) {
                            return { success: false, error: e.message };
                        }
                    }
                    
                    return { success: false, error: 'Function not found' };
                });
                
                console.log('🖼️ Overlay test:', overlayTest);
                results.overlayWorks = overlayTest.success;
                
            } catch (e) {
                console.error('❌ Overlay test failed:', e.message);
                results.errors.push(e.message);
            }
        }
        
        // Wait a bit to see results
        await page.waitForTimeout(3000);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        results.errors.push(error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    // Print results
    console.log('\n📊 Test Results:');
    console.log('================');
    Object.entries(results).forEach(([key, value]) => {
        const status = value === true ? '✅' : value === false ? '❌' : '🔍';
        console.log(`${status} ${key}: ${JSON.stringify(value, null, 2)}`);
    });
    
    return results;
}

// Check if puppeteer is available
async function checkDependencies() {
    try {
        require('puppeteer');
        return true;
    } catch (e) {
        console.log('📦 Installing puppeteer...');
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            exec('npm install puppeteer', (error) => {
                if (error) {
                    console.error('❌ Failed to install puppeteer:', error.message);
                    console.log('💡 Please run: npm install puppeteer');
                    resolve(false);
                } else {
                    console.log('✅ Puppeteer installed');
                    resolve(true);
                }
            });
        });
    }
}

// Run the test
if (require.main === module) {
    checkDependencies().then(hasDepends => {
        if (hasDepends) {
            testMediaOverlay().catch(console.error);
        } else {
            console.log('❌ Cannot run test without puppeteer');
            console.log('💡 Install with: npm install puppeteer');
            process.exit(1);
        }
    });
}

module.exports = { testMediaOverlay };
