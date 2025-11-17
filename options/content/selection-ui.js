/* exported selectionUI */

/**
 * @fileoverview UI component for displaying selection information.
 * This script creates and manages a floating card UI with multiple views
 * and a theme that syncs with the user's preference.
 */

var selectionUI = (() => {
    'use strict';

    let card = null;
    let currentTheme = 'light';
    const cardId = 'wordup-selection-card';

    /**
     * Fetches the theme from storage and applies it.
     */
    const applyTheme = async () => {
        try {
            const { theme } = await chrome.storage.sync.get('theme');
            if (theme) {
                currentTheme = theme;
                if (card) {
                    card.dataset.theme = currentTheme;
                }
            }
        } catch (e) {
            console.warn('WordUp: Could not load theme for UI card.');
        }
    };

    /**
     * Creates the main card element and injects its styles.
     */
    const createCard = () => {
        const newCard = document.createElement('div');
        newCard.id = cardId;
        newCard.setAttribute('role', 'dialog');
        newCard.setAttribute('aria-live', 'polite');
        newCard.style.display = 'none';
        newCard.dataset.theme = currentTheme; // Apply loaded theme
        document.body.appendChild(newCard);

        const style = document.createElement('style');
        style.textContent = `
            :root {
                --ilx-light-bg: #fff;
                --ilx-light-text: #202124;
                --ilx-light-secondary-text: #5f6368;
                --ilx-light-primary: #1a73e8;
                --ilx-light-bg-alt: #f1f3f4;
                --ilx-light-bg-hover: #e8eaed;

                --ilx-dark-bg: #2d2e30;
                --ilx-dark-text: #e8eaed;
                --ilx-dark-secondary-text: #969ba1;
                --ilx-dark-primary: #8ab4f8;
                --ilx-dark-bg-alt: #3c4043;
                --ilx-dark-bg-hover: #4a4d52;
            }

            #${cardId} {
                --bg-color: var(--ilx-light-bg);
                --text-color: var(--ilx-light-text);
                --secondary-text-color: var(--ilx-light-secondary-text);
                --primary-color: var(--ilx-light-primary);
                --bg-alt: var(--ilx-light-bg-alt);
                --bg-hover: var(--ilx-light-bg-hover);

                position: absolute;
                z-index: 2147483647;
                width: 300px;
                background-color: var(--bg-color);
                color: var(--text-color);
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                overflow: hidden;
                transition: opacity 0.15s ease-in-out, transform 0.15s ease-in-out;
                transform: scale(0.95);
                opacity: 0;
            }
            #${cardId}[data-theme="dark"] {
                --bg-color: var(--ilx-dark-bg);
                --text-color: var(--ilx-dark-text);
                --secondary-text-color: var(--ilx-dark-secondary-text);
                --primary-color: var(--ilx-dark-primary);
                --bg-alt: var(--ilx-dark-bg-alt);
                --bg-hover: var(--ilx-dark-bg-hover);
            }
            #${cardId} .ilx-pills-container {
                margin-top: 12px;
            }
            #${cardId} .ilx-pills-container h4 {
                margin: 0 0 6px 0;
                font-size: 12px;
                color: var(--secondary-text-color);
            }
            #${cardId} .ilx-pill {
                display: inline-block;
                background-color: var(--bg-alt);
                padding: 4px 8px;
                border-radius: 16px;
                font-size: 12px;
                margin: 2px;
            }
            #${cardId} .ilx-content { padding: 16px; }
            #${cardId} .ilx-loader { text-align: center; padding: 20px; }
            #${cardId} .ilx-definition strong {
                display: block;
                font-size: 16px;
                margin-bottom: 4px;
                color: var(--primary-color);
            }
            #${cardId} .ilx-error { color: #d93025; font-weight: 500; }
            #${cardId} .ilx-rewrite-actions button {
                width: 100%;
                background: var(--bg-alt);
                color: var(--text-color);
                border: none;
                padding: 10px;
                border-radius: 8px;
                margin-top: 8px;
                cursor: pointer;
                font-weight: 500;
                text-align: left;
            }
            #${cardId} .ilx-rewrite-actions button:hover { background: var(--bg-hover); }
            #${cardId} .ilx-rewritten-text {
                background-color: var(--bg-alt);
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 8px;
            }
            #${cardId} .ilx-header {
                display: flex;
                justify-content: flex-end;
                padding: 4px 8px;
                background-color: var(--bg-alt);
            }
            #${cardId} .ilx-close-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                color: var(--secondary-text-color);
            }
            #${cardId} .ilx-close-btn:hover {
                color: var(--text-color);
            }
            #${cardId} .ilx-footer {
                display: flex;
                justify-content: flex-end;
                padding: 8px 16px;
                background-color: var(--bg-alt);
                border-top: 1px solid var(--bg-hover);
            }
            #${cardId} .ilx-copy-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-weight: 600;
                color: var(--primary-color);
            }
            #${cardId} .ilx-insert-btn {
                background-color: var(--primary-color);
                color: var(--ilx-light-bg);
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                cursor: pointer;
                font-weight: 600;
                margin-right: 12px;
            }
        `;
        document.head.appendChild(style);
        newCard.addEventListener('click', handleCardClick);
        return newCard;
    };

    const handleCardClick = (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        const { action, text, tone } = target.dataset;

        if (action === 'rewrite') {
            document.dispatchEvent(new CustomEvent('wordup-rewrite-request', { detail: { text, tone } }));
        } else if (action === 'insert') {
            document.dispatchEvent(new CustomEvent('wordup-insert-request', { detail: { text } }));
        } else if (action === 'copy') {
            navigator.clipboard.writeText(text).then(() => {
                target.textContent = 'Copied!';
                setTimeout(() => {
                    target.textContent = 'Copy';
                }, 1500);
            });
        } else if (action === 'close') {
            hide();
        }
    };

    const render = (options) => {
        if (!card) card = createCard();
        let contentHtml = '';
        switch (options.view) {
            case 'loading':
                contentHtml = `<div class="ilx-loader">Loading...</div>`;
                break;
            case 'definition':
                const synonymsHtml = (options.data.synonyms && options.data.synonyms.length > 0)
                    ? `<div class="ilx-pills-container">
                           <h4>Synonyms</h4>
                           ${options.data.synonyms.slice(0, 5).map(s => `<span class="ilx-pill">${s}</span>`).join('')}
                       </div>`
                    : '';
                const antonymsHtml = (options.data.antonyms && options.data.antonyms.length > 0)
                    ? `<div class="ilx-pills-container">
                           <h4>Antonyms</h4>
                           ${options.data.antonyms.slice(0, 5).map(a => `<span class="ilx-pill">${a}</span>`).join('')}
                       </div>`
                    : '';

                contentHtml = `<div class="ilx-definition"><strong>${options.data.word}</strong><p>${options.data.meaning}</p>${synonymsHtml}${antonymsHtml}</div>`;
                break;
            case 'rewrite-options':
                contentHtml = `<div class="ilx-rewrite-actions">
                        <button data-action="rewrite" data-text="${options.text}" data-tone="Formal">Rewrite as Formal</button>
                        <button data-action="rewrite" data-text="${options.text}" data-tone="Casual">Rewrite as Casual</button>
                        <button data-action="rewrite" data-text="${options.text}" data-tone="Professional">Rewrite as Professional</button>
                    </div>`;
                break;
            case 'rewritten-text':
                const insertBtnHtml = options.isEditable
                    ? `<button class="ilx-insert-btn" data-action="insert" data-text="${options.data}">Insert</button>`
                    : '';

                contentHtml = `<div>
                    <div class="ilx-header">
                        <button class="ilx-close-btn" data-action="close" title="Close">×</button>
                    </div>
                    <div class="ilx-content"><div class="ilx-rewritten-text">${options.data}</div></div>
                    <div class="ilx-footer">${insertBtnHtml}<button class="ilx-copy-btn" data-action="copy" data-text="${options.data}">Copy</button></div>
                </div>`;
                break;
            case 'error':
                contentHtml = `<div class="ilx-error">${options.error}</div>`;
                break;
        }
        card.innerHTML = (options.view === 'rewritten-text') ? contentHtml : `<div class="ilx-content">${contentHtml}</div>`;
    };

    const show = (options) => {
        if (!card) card = createCard();
        applyTheme(); // Ensure theme is up-to-date
        render(options);

        const { rect } = options;

        // Temporarily display the card off-screen to measure its dimensions
        card.style.visibility = 'hidden';
        card.style.display = 'block';
        const cardRect = card.getBoundingClientRect();
        card.style.display = 'none';
        card.style.visibility = 'visible';

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 5; // 5px margin from viewport edges

        // --- Smart Positioning Logic ---

        // Default position: below the selection
        let top = rect.bottom + window.scrollY + margin;
        let left = rect.left + window.scrollX;

        // Adjust horizontal position to prevent right overflow
        if (left + cardRect.width > viewportWidth - margin) {
            left = viewportWidth - cardRect.width - margin;
        }

        // Adjust vertical position to prevent bottom overflow
        // If it doesn't fit below, try to place it above
        if (rect.bottom + cardRect.height + margin > viewportHeight && rect.top - cardRect.height - margin > 0) {
            top = rect.top + window.scrollY - cardRect.height - margin;
        }

        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        card.style.display = 'block';

        // Use requestAnimationFrame to ensure the transition is applied after the element is displayed.
        requestAnimationFrame(() => {
            card.style.transform = 'scale(1)';
            card.style.opacity = '1';
        });
    };

    const hide = () => {
        if (card) {
            card.style.transform = 'scale(0.95)';
            card.style.opacity = '0';
            // Wait for the transition to finish before hiding the element
            setTimeout(() => {
                card.style.display = 'none';
            }, 150); // Should match the transition duration
        }
    };

    // Expose public methods
    return {
        show,
        hide
    };
})();