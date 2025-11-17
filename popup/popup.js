(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const themeToggle = document.getElementById('ilx-theme-toggle');
    const searchInput = document.getElementById('ilx-search-input');
    const searchButton = document.getElementById('ilx-search-button');
    const searchResult = document.getElementById('ilx-search-result');
    const recentList = document.getElementById('ilx-recent-list');
    const syncButton = document.getElementById('ilx-sync-button');
    const optionsLink = document.getElementById('ilx-options-link');
    const statusBar = document.getElementById('ilx-status-bar');

    // --- State ---
    let currentTheme = 'light';
    const ICONS = {
      sun: '<svg viewBox=\'0 0 24 24\'><path d=\'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.64 5.64c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L5.64 8.46c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41l1.41-1.41zm12.72 12.72c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41l-1.41 1.41c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41l1.41-1.41zM5.64 18.36l1.41-1.41c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0zm12.72-12.72l1.41-1.41c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0z\'/></svg>',
      moon: '<svg viewBox=\'0 0 24 24\'><path d=\'M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z\'/></svg>',
    };

    // --- Helpers ---
    const reportError = (message) => {
      statusBar.textContent = message;
      statusBar.classList.add('ilx-error');
    };

    const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text).then(() => {
        statusBar.textContent = 'Copied to clipboard!';
        statusBar.classList.remove('ilx-error');
        setTimeout(updateStatus, 2000);
      }).catch(() => {
        reportError('Failed to copy text.');
      });
    };

    // --- Core Functions ---
    const updateTheme = (theme) => {
      currentTheme = theme;
      document.body.dataset.theme = theme;
      themeToggle.innerHTML = theme === 'light' ? ICONS.moon : ICONS.sun;
    };

    const updateStatus = () => {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        return reportError('Error: Extension context is invalid.');
      }
      chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          reportError('Service worker is inactive. Please reload the page.');
        } else if (response) {
          statusBar.textContent = `Status: OK | Errors: ${response.errorLogs.length} | Cache: ${response.cacheSize}`;
          statusBar.classList.remove('ilx-error');
        }
      });
    };

    const loadRecentLookups = async () => {
      try {
        const items = await chrome.storage.local.get(null);
        recentList.innerHTML = ''; // Clear list
        const lookupKeys = Object.keys(items)
          .filter((key) => key.startsWith('meaning_'))
          .sort((a, b) => items[b].expires - items[a].expires) // Sort by date
          .slice(0, 10); // Get top 10

        if (lookupKeys.length === 0) {
          recentList.innerHTML = '<li class="ilx-recent-item">No recent lookups.</li>';
          return;
        }

        for (const key of lookupKeys) {
          const term = key.replace('meaning_', '');
          const li = document.createElement('li');
          li.className = 'ilx-recent-item';
          li.textContent = term;
          li.dataset.term = term;
          recentList.appendChild(li);
        }
      } catch (e) {
        console.error(e);
        recentList.innerHTML = '<li class="ilx-recent-item">Could not load history.</li>';
      }
    };

    const handleSearch = (term) => {
      if (!term) return;

      searchResult.textContent = `Searching for '${term}'...`;
      searchResult.style.display = 'block';
      searchResult.classList.remove('ilx-error');

      chrome.runtime.sendMessage({ type: 'lookup', payload: { text: term } }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          searchResult.textContent = `Error: ${response ? response.error : 'Could not get definition.'}`;
          searchResult.classList.add('ilx-error');
          reportError('API key might be missing or invalid.');
        } else {
          // The response.data is an object, not a string.
          searchResult.textContent = response.data.meaning;
          loadRecentLookups(); // Refresh recent list
        }
      });
    };

    const handleRecentItemClick = async (term) => {
      // Optimistic UI: show in popup immediately
      handleSearch(term);

      // Ask content script to show UI
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'show_ui_for_term',
            payload: { text: term },
          });
        }
      } catch (e) {
        console.warn('Could not send message to active tab.', e);
      }
    };

    // --- Initialization ---
    const init = async () => {
      // Load theme
      try {
        const { theme } = await chrome.storage.sync.get('theme');
        updateTheme(theme || 'light');
      } catch (e) {
        console.warn('Could not load theme from storage.');
        updateTheme('light');
      }

      updateStatus();
      loadRecentLookups();
    };

    // --- Event Listeners ---
    themeToggle.addEventListener('click', () => {
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      updateTheme(newTheme);
      chrome.storage.sync.set({ theme: newTheme });
    });

    searchButton.addEventListener('click', () => handleSearch(searchInput.value.trim()));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch(searchInput.value.trim());
    });

    searchResult.addEventListener('click', () => {
      if (searchResult.textContent && !searchResult.classList.contains('ilx-error')) {
        copyToClipboard(searchResult.textContent);
      }
    });

    recentList.addEventListener('click', (e) => {
      if (e.target && e.target.matches('.ilx-recent-item')) {
        const term = e.target.dataset.term;
        if (term) {
          handleRecentItemClick(term);
        }
      }
    });

    optionsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());

    syncButton.addEventListener('click', () => {
      statusBar.textContent = 'Syncing...';
      loadRecentLookups();
      updateStatus();
    });

    init();
  });
})();