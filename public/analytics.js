/**
 * Analytics Client SDK
 * Embeddable tracking snippet for websites
 * 
 * Usage: Include this script in your HTML:
 * <script src="http://your-analytics-server:3000/analytics.js" data-server="http://your-analytics-server:3000"></script>
 */
(function () {
    'use strict';

    // ============================================
    // Configuration
    // ============================================
    const script = document.currentScript;
    const serverUrl = script?.getAttribute('data-server') ||
        script?.src.replace('/analytics.js', '') ||
        'http://localhost:3000';

    // ============================================
    // UUID Generator & Storage
    // ============================================
    function generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function getOrCreateUID() {
        const storageKey = '_analytics_uid';
        let uid = null;

        try {
            uid = localStorage.getItem(storageKey);
            if (!uid) {
                uid = generateUUID();
                localStorage.setItem(storageKey, uid);
            }
        } catch (e) {
            // localStorage not available, use session-only ID
            uid = window._analytics_uid || generateUUID();
            window._analytics_uid = uid;
        }

        return uid;
    }

    // ============================================
    // Data Collection
    // ============================================
    function getMetaData() {
        const meta = {
            resolution: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language || navigator.userLanguage,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            platform: navigator.platform,
            colorDepth: window.screen.colorDepth,
            pixelRatio: window.devicePixelRatio || 1,
            touchSupport: 'ontouchstart' in window,
            cookieEnabled: navigator.cookieEnabled
        };
        return JSON.stringify(meta);
    }

    // ============================================
    // Tracking Functions
    // ============================================
    function track(eventType, customData) {
        const uid = getOrCreateUID();
        const url = window.location.pathname + window.location.search;
        const referrer = document.referrer || '';

        let metaData = getMetaData();
        if (customData) {
            try {
                const meta = JSON.parse(metaData);
                Object.assign(meta, customData);
                metaData = JSON.stringify(meta);
            } catch (e) { }
        }

        const params = new URLSearchParams({
            uid,
            url,
            referrer,
            event_type: eventType,
            meta_data: metaData
        });

        const trackUrl = `${serverUrl}/collect?${params.toString()}`;

        // Use beacon API for reliable delivery
        if (navigator.sendBeacon) {
            navigator.sendBeacon(trackUrl);
        } else {
            // Fallback to image pixel
            const img = new Image(1, 1);
            img.src = trackUrl;
        }
    }

    function trackPageView() {
        track('pageview');
    }

    function trackEvent(eventName, eventData) {
        track(eventName, eventData);
    }

    // ============================================
    // Auto-tracking Setup
    // ============================================

    // Track initial pageview
    if (document.readyState === 'complete') {
        trackPageView();
    } else {
        window.addEventListener('load', trackPageView);
    }

    // Track SPA navigation (History API)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        trackPageView();
    };

    history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        trackPageView();
    };

    window.addEventListener('popstate', trackPageView);

    // ============================================
    // Public API
    // ============================================
    window.Analytics = {
        track: trackEvent,
        trackPageView,
        getUID: getOrCreateUID,
        version: '1.0.0'
    };

    console.log('📊 Analytics SDK loaded', { server: serverUrl, uid: getOrCreateUID() });

})();
