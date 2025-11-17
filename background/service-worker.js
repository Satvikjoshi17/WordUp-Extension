// c:/Users/ayush/OneDrive/Desktop/PROJECT FILES (SCHOOL)/Chrome Extension/intelli-lex/src/background/service-worker.js

/**
 * @fileoverview Service worker for WordUp.
 *
 * This script handles background tasks such as API requests, caching,
 * and routing messages between different parts of the extension.
 */

'use strict';

// --- Configuration ---
// These would be set in the options page and stored in chrome.storage.
const config = {
    apiBaseUrls: {
        dictionary: 'https://api.dictionaryapi.dev/api/v2/entries/en/',
        dictionary_fallback: 'https://api.example-fallback-dictionary.com/v1/', // Example fallback
        // Placeholder for other APIs
        thesaurus: 'https://api.example-thesaurus.com/v1/',
        translation: 'https://api.example-translation.com/v2/',
        toneRewrite: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    },
    apiKeys: {
        thesaurus: null,
        translation: null,
        gemini: null, // Gemini API Key
    },
    cacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

// --- LRU Cache (In-Memory) ---
class LRUCache {
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value); // Move to end (most recently used)
        return value;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }

    has(key) {
        return this.cache.has(key);
    }
}

const sessionCache = new LRUCache();

// --- Persistent Cache (chrome.storage.local) ---
const persistentCache = {
    async get(key) {
        try {
            const result = await chrome.storage.local.get(key);
            if (!result[key]) return null;

            const item = result[key];
            // Check if the item has expired
            if (Date.now() > item.expires) {
                await chrome.storage.local.remove(key);
                return null;
            }
            return item.value;
        } catch (error) {
            logError('persistentCache.get', { error });
            return null;
        }
    },
    async set(key, value) {
        try {
            const expires = Date.now() + config.cacheTTL;
            await chrome.storage.local.set({ [key]: { value, expires } });
        } catch (error) {
            logError('persistentCache.set', { error });
        }
    },
};

// --- Rate Limiter ---
const rateLimiter = {
    queue: [],
    isProcessing: false,
    requestsPerSecond: 5,
    processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }
        this.isProcessing = true;
        const interval = 1000 / this.requestsPerSecond;
        const timerId = setInterval(() => {
            if (this.queue.length > 0) {
                const request = this.queue.shift();
                request();
            } else {
                clearInterval(timerId);
                this.isProcessing = false;
            }
        }, interval);
    },
    add(request) {
        this.queue.push(request);
        this.processQueue();
    },
};

// --- Error & Status Logging ---
const errorLogs = [];
const maxLogSize = 100;

function logError(source, details) {
    let processedDetails = details;
    // If details is an object that contains an Error, extract its message and stack for better logging.
    if (details && typeof details === 'object' && details.error instanceof Error) {
        processedDetails = {
            ...details,
            error: {
                message: details.error.message,
                stack: details.error.stack,
            },
        };
    }
    const errorRecord = {
        timestamp: new Date().toISOString(),
        source,
        details: processedDetails,
    };
    errorLogs.unshift(errorRecord);
    if (errorLogs.length > maxLogSize) {
        errorLogs.pop();
    }
    console.error('WordUp Error:', errorRecord);
}

function getStatus() {
    return {
        errorLogs,
        cacheSize: sessionCache.cache.size,
        rateLimiterQueue: rateLimiter.queue.length,
    };
}


// --- API Handlers ---
const api = {
    /**
     * Fetches the meaning of a word.
     * @param {string} text The word to look up.
     * @returns {Promise<object>} A promise that resolves to the sanitized API response.
     */
    async lookupMeaning(text) {
        const cacheKey = `meaning_${text.toLowerCase()}`;
        
        // 1. Check session cache
        let data = sessionCache.get(cacheKey);
        if (data) return { success: true, data, source: 'session' };

        // 2. Check persistent cache
        data = await persistentCache.get(cacheKey);
        if (data) {
            sessionCache.set(cacheKey, data); // Hydrate session cache
            return { success: true, data, source: 'persistent' };
        }

        // 3. Fetch from API
        return new Promise(resolve => {
            rateLimiter.add(async () => {
                let responseData = null;
                let error = null;

                // --- Attempt 1: Primary API ---
                try {
                    const response = await fetch(`${config.apiBaseUrls.dictionary}${text}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const rawData = await response.json();
                    responseData = this.sanitizeDictionaryResponse(rawData);
                } catch (e) {
                    error = e;
                    logError('api.lookupMeaning (Primary)', { text, error: e.message });
                    // Don't resolve yet, try the fallback
                }

                // --- Attempt 2: Fallback API (if primary failed) ---
                // if (!responseData) {
                //     console.log('Primary API failed, trying fallback...');
                //     try {
                //         // const fallbackResponse = await fetch(`${config.apiBaseUrls.dictionary_fallback}${text}`);
                //         // ... handle fallback response and sanitization ...
                //     } catch (e) {
                //         logError('api.lookupMeaning (Fallback)', { text, error: e.message });
                //     }
                // }

                if (responseData) {
                    sessionCache.set(cacheKey, responseData);
                    await persistentCache.set(cacheKey, responseData);
                    resolve({ success: true, type: 'definition', data: responseData, source: 'api' });
                } else {
                    resolve({ success: false, error: 'Failed to fetch definition.' });
                }
            });
        });
    },

    sanitizeDictionaryResponse(data) {
        if (!Array.isArray(data) || data.length === 0) return null;
        const firstResult = data[0];
        const meaning = firstResult.meanings?.[0]?.definitions?.[0]?.definition;
        const allSynonyms = new Set();
        const allAntonyms = new Set();

        if (!meaning) return null;

        // Collect all unique synonyms and antonyms from all meaning groups
        firstResult.meanings?.forEach(m => {
            m.synonyms?.forEach(s => allSynonyms.add(s));
            m.antonyms?.forEach(a => allAntonyms.add(a));
        });

        return {
            word: firstResult.word,
            phonetic: firstResult.phonetic || firstResult.phonetics?.find(p => p.text)?.text,
            meaning,
            synonyms: Array.from(allSynonyms),
            antonyms: Array.from(allAntonyms),
        };
    },

    async rewriteTone(text, tone) {
        if (!config.apiKeys.gemini) {
            const errorMessage = 'Gemini API key is not configured.';
            logError('api.rewriteTone', { error: errorMessage });
            return { success: false, error: errorMessage };
        }

        const url = `${config.apiBaseUrls.toneRewrite}?key=${config.apiKeys.gemini}`;
        const prompt = `Rewrite the following text in a ${tone} tone. Provide ONLY the rewritten text, with no additional commentary, introductory phrases, or explanations. Do not include quotation marks around the rewritten text. Original text: "${text}"`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ "text": prompt }]
                    }]
                })
            });

            if (!response.ok) {
                let errorDetails = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    // Google API errors often have a structure like { error: { message: '...' } }
                    if (errorData.error && errorData.error.message) {
                        // Shorten the Google API error for better display in the UI
                        errorDetails = errorData.error.message.split(' API key')[0];
                    }
                } catch (e) {
                    // Response body was not JSON, stick with the status code
                }
                throw new Error(errorDetails);
            }

            const result = await response.json();
            const rewrittenText = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!rewrittenText) {
                // This can happen if the model has safety blocks.
                const blockReason = result.promptFeedback?.blockReason;
                if (blockReason) {
                    throw new Error(`Content blocked by API: ${blockReason}`);
                }
                throw new Error('Invalid response structure from Gemini API.');
            }

            return { success: true, type: 'rewritten', data: rewrittenText.trim() };
        } catch (error) {
            logError('api.rewriteTone', { text, error: error.message });
            return { success: false, error: error.message };
        }
    }
};


// --- Message Router ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Ensure the request is from our extension
    if (!sender.tab && !sender.url.startsWith(chrome.runtime.getURL(''))) {
        logError('onMessage.security', { error: 'Untrusted message source', sender });
        return false; // Do not process
    }

    const { type, payload } = request;

    switch (type) {
    case 'lookup': // Changed from 'lookupMeaning' to match content script
        api.lookupMeaning(payload.text).then(sendResponse);
        return true; // Indicates async response

    case 'rewriteTone':
        api.rewriteTone(payload.text, payload.tone).then(sendResponse);
        return true;
        
    case 'getStatus':
        sendResponse(getStatus());
        return false; // Sync response

    case 'telemetry':
        // For now, just log telemetry events. This could be expanded.
        sendResponse({success: true});
        return false;

    default:
        logError('onMessage.router', { error: 'Unknown message type', type });
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
});

// --- Extension Lifecycle ---
chrome.runtime.onInstalled.addListener(() => {
    // Here you could set default configuration in chrome.storage
    chrome.storage.sync.set({
        config: {
            apiBaseUrls: config.apiBaseUrls,
            // Do NOT store API keys in sync storage. Use local or have the user enter them.
        }
    });

    // Create context menus on installation.
    chrome.contextMenus.create({
        id: 'wordup-define',
        title: 'WordUp: Define "%s"',
        contexts: ['selection']
    });

    chrome.contextMenus.create({
        id: 'wordup-rewrite-separator',
        type: 'separator',
        contexts: ['selection']
    });
});

// --- Context Menus for PDFs and other restricted pages ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'wordup-define' && info.selectionText) {
        api.lookupMeaning(info.selectionText.trim()).then(result => {
            const dataString = encodeURIComponent(JSON.stringify(result));
            const popupUrl = chrome.runtime.getURL(`popup-result/popup-result.html?data=${dataString}&word=${encodeURIComponent(info.selectionText.trim())}`);

            chrome.windows.create({
                url: popupUrl,
                type: 'popup',
                width: 320,
                height: 200,
                top: Math.round(tab.top ?? 0),
                left: Math.round((tab.left ?? 0) + (tab.width ?? 0) - 320)
            });
        });
    }
});
// Function to load configuration from storage
const loadConfiguration = () => {
    chrome.storage.sync.get('config', (data) => {
        if (data.config) {
            Object.assign(config, data.config);
        }
    });
    chrome.storage.local.get(['apiKeys'], (data) => {
        if (data.apiKeys) {
            Object.assign(config.apiKeys, data.apiKeys);
        }
    });
};

// Load configuration immediately when the service worker starts

loadConfiguration();



// --- Storage Change Listener ---

chrome.storage.onChanged.addListener((changes, namespace) => {

    if (namespace === 'local' && changes.apiKeys) {

        const newApiKeys = changes.apiKeys.newValue;

        if (newApiKeys) {

            Object.assign(config.apiKeys, newApiKeys);

        }

    }

    if (namespace === 'sync' && changes.config) {

        const newConfig = changes.config.newValue;

        if (newConfig) {

            Object.assign(config, newConfig);

        }

    }

});
