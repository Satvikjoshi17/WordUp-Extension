document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const form = document.getElementById('settings-form');
    const dictionaryUrlInput = document.getElementById('dictionary-url');
    const geminiKeyInput = document.getElementById('gemini-key');
    const statusMessage = document.getElementById('status-message');
    const exportButton = document.getElementById('export-data');
    const importInput = document.getElementById('import-data');
    const runDiagnosticsButton = document.getElementById('run-diagnostics');
    // The diagnostics output element is not in the current HTML, but we can keep the reference.
    // const diagnosticsOutput = document.getElementById('diagnostics-output'); 
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    const API_KEY_PLACEHOLDER = '••••••••••••••••';

    // --- Functions ---

    /**
     * Loads settings from chrome.storage and populates the form.
     */
    const loadSettings = async () => {
        try {
            const { config } = await chrome.storage.sync.get('config');
            const { apiKeys } = await chrome.storage.local.get('apiKeys');
            
            if (config && config.apiBaseUrls) {
                dictionaryUrlInput.value = config.apiBaseUrls.dictionary || '';
            }
            if (apiKeys && apiKeys.gemini) {
                geminiKeyInput.placeholder = API_KEY_PLACEHOLDER;
            }
        } catch (e) {
            showStatus('Error loading settings.', 'error');
            console.error(e);
        }
    };

    /**
     * Validates a URL endpoint with a HEAD request.
     * @param {string} url The URL to validate.
     * @returns {Promise<boolean>}
     */
    const validateEndpoint = async (url) => {
        if (!url) return true;
        try {
            // A simple GET request is sufficient. The options page has enough privileges.
            // We just want to see if it returns a non-error status.
            // We'll use a test query.
            const testUrl = url.endsWith('/') ? `${url}test` : `${url}/test`;
            const response = await fetch(testUrl);
            // We expect a 404 (Not Found) for a test word, which is a valid, reachable response.
            // A 200 OK is also fine. A network error or 5xx would be a failure.
            return response.status < 500;
        } catch (e) {
            console.error(`Endpoint validation failed for ${url}:`, e);
            return false;
        }
    };

    /**
     * Saves settings to chrome.storage.
     */
    const saveSettings = async (event) => {
        event.preventDefault();
        showStatus('Saving...', 'info');

        const newDictionaryUrl = dictionaryUrlInput.value.trim();
        const newGeminiKey = geminiKeyInput.value.trim();

        // Validate endpoint
        const isEndpointValid = await validateEndpoint(newDictionaryUrl);
        if (!isEndpointValid) {
            return showStatus(`Error: Dictionary URL "${newDictionaryUrl}" is not reachable.`, 'error');
        }

        try {
            // Get existing config from sync and apiKeys from local
            const { config } = await chrome.storage.sync.get('config');
            const { apiKeys } = await chrome.storage.local.get('apiKeys');
            
            const newConfig = config || {};
            newConfig.apiBaseUrls = newConfig.apiBaseUrls || {};
            newConfig.apiBaseUrls.dictionary = newDictionaryUrl;

            const newApiKeys = apiKeys || {};
            if (newGeminiKey && newGeminiKey !== API_KEY_PLACEHOLDER) {
                newApiKeys.gemini = newGeminiKey;
            }

            // Save non-sensitive config to sync and sensitive keys to local
            await chrome.storage.sync.set({ config: newConfig });
            await chrome.storage.local.set({ apiKeys: newApiKeys });
            
            showStatus('Settings saved successfully!', 'success');
            geminiKeyInput.value = ''; // Clear input for security
            if (newApiKeys.gemini) {
                geminiKeyInput.placeholder = API_KEY_PLACEHOLDER;
            }

        } catch (e) {
            showStatus('Error saving settings.', 'error');
            console.error(e);
        }
    };

    /**
     * Exports user data (word lists) as a JSON file.
     */
    const exportData = async () => {
        try {
            const allData = await chrome.storage.local.get(null);
            const wordData = Object.keys(allData)
                .filter(key => key.startsWith('meaning_'))
                .reduce((obj, key) => {
                    obj[key] = allData[key];
                    return obj;
                }, {});

            if (Object.keys(wordData).length === 0) {
                alert('No data to export.');
                return;
            }

            const blob = new Blob([JSON.stringify(wordData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `intellex-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Failed to export data.');
            console.error(e);
        }
    };

    /**
     * Imports data from a JSON file.
     */
    const importData = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                // Simple validation: check for 'meaning_' keys
                if (Object.keys(data).every(key => key.startsWith('meaning_'))) {
                    await chrome.storage.local.set(data);
                    alert('Data imported successfully!');
                } else {
                    alert('Invalid file format.');
                }
            } catch (err) {
                alert('Failed to parse JSON file.');
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    /**
     * Runs diagnostics by querying the service worker.
     */
    const runDiagnostics = () => {
        diagnosticsOutput.textContent = 'Running...';
        chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
            if (chrome.runtime.lastError) {
                diagnosticsOutput.textContent = `Error: ${chrome.runtime.lastError.message}`;
            } else {
                diagnosticsOutput.textContent = JSON.stringify(response, null, 2);
            }
        });
    };

    /**
     * Displays a status message.
     * @param {string} message The message to display.
     * @param {'success'|'error'|'info'} type The type of message.
     */
    const showStatus = (message, type) => {
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
    };

    /**
     * Applies the selected theme (light or dark) to the page.
     * @param {string} theme The theme to apply ('light' or 'dark').
     */
    const applyTheme = (theme) => {
        const sunIcon = `<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM12 9c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3zm0-5h-1v3h1V4zm0 15h-1v3h1v-3zM5.64 6.36L4.22 4.93 2.81 6.34l1.42 1.43L5.64 6.36zm13.43 12.01l1.42 1.42 1.41-1.41-1.42-1.42-1.41 1.41zM20 11v1h-3v-1h3zM4 11v1H1v-1h3zm12.07-5.64l1.41-1.41-1.42-1.42-1.41 1.41 1.42 1.42zM6.34 19.78l-1.41-1.41-1.42 1.42 1.41 1.41 1.42-1.42z"/></svg>`;
        const moonIcon = `<svg viewBox="0 0 24 24"><path d="M10 2c-1.82 0-3.53.5-5 1.35 2.99 1.73 5 4.95 5 8.65s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z"/></svg>`;

        if (theme === 'dark') {
            body.setAttribute('data-theme', 'dark');
            themeToggle.innerHTML = sunIcon;
        } else {
            body.removeAttribute('data-theme');
            themeToggle.innerHTML = moonIcon;
        }
    };

    /**
     * Handles the theme toggle button click.
     */
    const handleThemeToggle = () => {
        const currentTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        chrome.storage.local.set({ theme: currentTheme }, () => {
            applyTheme(currentTheme);
        });
    };


    // --- Event Listeners ---
    form.addEventListener('submit', saveSettings);
    exportButton.addEventListener('click', exportData);
    importInput.addEventListener('change', importData);
    themeToggle.addEventListener('click', handleThemeToggle);
    
    // The diagnostics button is present, but the output area is not in the HTML.
    // If you add `<pre id="diagnostics-output"></pre>` back, this will work.
    // runDiagnosticsButton.addEventListener('click', runDiagnostics);

    // --- Initialization ---
    loadSettings();

    // Load and apply the saved theme on startup
    chrome.storage.local.get('theme', (data) => {
        applyTheme(data.theme || 'light'); // Default to light theme
    });
});
