/**
 * @fileoverview Utility functions for the IntelliLex extension.
 * This file provides common helper functions like sanitization, debouncing,
 * throttling, and caching.
 */

/**
 * Sanitizes a string by replacing HTML special characters with their entities.
 * This is a basic protection against XSS. For more complex HTML, a library
 * like DOMPurify would be recommended.
 * @param {string} str The string to sanitize.
 * @returns {string} The sanitized string.
 */
export function safeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (match) => {
        switch (match) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case '\'': return '&#39;';
        default: return match;
        }
    });
}

/**
 * Creates a debounced function that delays invoking `fn` until after `ms`
 * milliseconds have elapsed since the last time the debounced function was invoked.
 * @param {Function} fn The function to debounce.
 * @param {number} ms The number of milliseconds to delay.
 * @returns {Function} The new debounced function.
 */
export function debounce(fn, ms) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
}

/**
 * Creates a throttled function that only invokes `fn` at most once per every
 * `ms` milliseconds.
 * @param {Function} fn The function to throttle.
 * @param {number} ms The number of milliseconds to throttle invocations to.
 * @returns {Function} The new throttled function.
 */
export function throttle(fn, ms) {
    let inThrottle = false;
    let lastArgs = null;
    let lastThis = null;

    function wrapper(...args) {
        lastArgs = args;
        lastThis = this;
        if (inThrottle) return;

        inThrottle = true;
        fn.apply(lastThis, lastArgs);
        setTimeout(function () {
            inThrottle = false;
            if (lastArgs) {
                wrapper.apply(lastThis, lastArgs);
                lastArgs = null;
                lastThis = null;
            }
        }, ms);
    }
    return wrapper;
}

/**
 * Normalizes a raw API response from the dictionary API into a consistent format.
 * @param {object} apiResponse The raw response from the dictionary API.
 * @returns {object|null} A normalized suggestion object or null if invalid.
 *
 * Example normalized format:
 * {
 *   word: 'hello',
 *   phonetic: '/həˈloʊ/',
 *   meaning: 'Used as a greeting or to begin a phone conversation.',
 *   source: 'api'
 * }
 */
export function formatSuggestions(apiResponse) {
    if (!Array.isArray(apiResponse) || apiResponse.length === 0) {
        return null;
    }
    const firstResult = apiResponse[0];
    const meaning = firstResult.meanings?.[0]?.definitions?.[0]?.definition;
    if (!meaning) {
        return null;
    }
    return {
        word: firstResult.word,
        phonetic: firstResult.phonetic || firstResult.phonetics?.find(p => p.text)?.text || '',
        meaning: meaning,
    };
}

/**
 * A simple in-memory cache with a Time-To-Live (TTL) for each entry.
 */
export class TtlCache {
    constructor(defaultTtl = 60 * 1000) { // Default TTL of 1 minute
        this.cache = new Map();
        this.defaultTtl = defaultTtl;
    }

    /**
     * Sets a value in the cache with a specific TTL.
     * @param {string} key The key for the cache entry.
     * @param {*} value The value to store.
     * @param {number} [ttl=this.defaultTtl] The TTL for this entry in milliseconds.
     */
    set(key, value, ttl = this.defaultTtl) {
        const expires = Date.now() + ttl;
        this.cache.set(key, { value, expires });
    }

    /**
     * Gets a value from the cache. Returns null if the key doesn't exist or has expired.
     * @param {string} key The key to retrieve.
     * @returns {*|null} The cached value or null.
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            return null;
        }
        // Check for expiry
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }

    /**
     * Checks if a key exists and is not expired.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Clears the entire cache.
     */
    clear() {
        this.cache.clear();
    }
}