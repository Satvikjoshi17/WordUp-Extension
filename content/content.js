/* global selectionUI */

/**
 * @fileoverview Content script for WordUp.
 * This script handles user text selection, determines the context (word or sentence),
 * and triggers the appropriate UI. It also avoids conflicts with other extensions.
 */

(function() {
    'use strict';

    // --- State Management ---
    const STATE = {
        IDLE: 'IDLE', // No selection UI is active
        SHOWING_OPTIONS: 'SHOWING_OPTIONS', // The initial UI (definition or rewrite options) is visible
        AWAITING_REWRITE: 'AWAITING_REWRITE', // Waiting for the rewrite API response
        REWRITE_RESULT_VISIBLE: 'REWRITE_RESULT_VISIBLE' // The rewritten text is being displayed,
    };
    let currentState = STATE.IDLE;
    let lastSelectionRect = null; // Store the position of the last valid selection
    let lastSelectionRange = null; // Store the Range object for insertion

    // --- Configuration ---
    const DEBOUNCE_DELAY = 200;
    // Selectors for other extension UIs to avoid conflicts.
    const CONFLICTING_SELECTORS = [
        // Example: A selector for another known conflicting extension.
        '.deep_spark_container'
    ];

    // --- Utility Functions ---
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const isSelectionInEditableField = (selection) => {
        if (!selection.anchorNode) return false;
        let parent = selection.anchorNode.parentElement;
        while (parent) {
            if (parent.isContentEditable || parent.tagName === 'INPUT' || parent.tagName === 'TEXTAREA') {
                return true;
            }
            parent = parent.parentElement;
        }
        return false;
    };

    /**
     * Checks if a known conflicting UI element is visible near the selection.
     * @param {DOMRect} selectionRect - The bounding rectangle of the user's selection.
     * @returns {boolean} - True if a conflicting UI is found.
     */
    const isConflictingUiVisible = (selectionRect) => {
        for (const selector of CONFLICTING_SELECTORS) {
            const elem = document.querySelector(selector);
            if (elem) {
                const elemRect = elem.getBoundingClientRect();
                // Check if the element is visible and close to the selection
                if (elemRect.width > 0 && elemRect.height > 0 &&
                    Math.abs(elemRect.top - selectionRect.top) < 200 &&
                    Math.abs(elemRect.left - selectionRect.left) < 200) {
                    return true;
                }
            }
        }
        return false;
    };

    /**
     * Main handler for text selection. Determines context and shows the appropriate UI.
     */
    const handleTextSelection = () => {
        // Gracefully exit if the script is running in a sandboxed iframe (like the PDF viewer)
        // where it cannot create its UI. The context menu will handle this case.
        if (window.self !== window.top && !document.body) {
            return;
        }

        // Do not trigger a new selection UI if the user is viewing a rewrite result.
        if (currentState === STATE.REWRITE_RESULT_VISIBLE || currentState === STATE.AWAITING_REWRITE) return;

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            // If the selection is collapsed or non-existent, hide the UI and stop.
            if (currentState !== STATE.IDLE) {
                selectionUI.hide();
                currentState = STATE.IDLE;
            }
            return;
        }

        const selectionText = selection.toString().trim();
        // Store the selection's position so we can reuse it later, even if the selection is lost.
        lastSelectionRect = selection.getRangeAt(0).getBoundingClientRect();
        lastSelectionRange = selection.getRangeAt(0);

        if (selectionText.length < 2 || isConflictingUiVisible(lastSelectionRect)) {
            return;
        }

        const isSingleWord = !/\s/.test(selectionText);

        if (isSingleWord) {
            // Show loading state, then fetch definition
            selectionUI.show({
                view: 'loading',
                rect: lastSelectionRect
            });
            currentState = STATE.SHOWING_OPTIONS;

            // Before sending, check if the runtime is still connected.
            if (!chrome.runtime?.id) {
                console.warn('WordUp: Extension context invalidated. Please reload the page.');
                return disableAllListeners();
            }

            chrome.runtime.sendMessage({ type: 'lookup', payload: { text: selectionText } }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(`WordUp: Error during lookup: ${chrome.runtime.lastError.message}`);
                    return selectionUI.show({ view: 'error', rect: lastSelectionRect, error: 'Could not connect to the service.' });
                }
                // Only handle the response if there was no error.
                handleServiceWorkerResponse(response, lastSelectionRect, selectionText);
            });
        } else {
            // Show rewrite options for sentences
            selectionUI.show({
                view: 'rewrite-options',
                rect: lastSelectionRect,
                text: selectionText
            });
            currentState = STATE.SHOWING_OPTIONS;
        }
    };

    /**
     * Centralized handler for all responses from the service worker.
     * @param {object} response - The response object from the service worker.
     * @param {DOMRect} rect - The original selection rectangle.
     * @param {string} originalText - The original selected text.
     */
    const handleServiceWorkerResponse = (response, rect, originalText) => {
        if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                console.warn('WordUp: Context invalidated, please reload the page.');
                disableAllListeners();
            } else {
                selectionUI.show({ view: 'error', rect, error: 'Service worker error.' });
            }
            return;
        }

        if (response && response.success) {
            if (response.type === 'definition') {
                selectionUI.show({ view: 'definition', rect, data: response.data });
            } else if (response.type === 'rewritten') {
                // Add a small delay to ensure the loading state is visible, making the transition smoother.
                setTimeout(() => {
                    const isEditable = lastSelectionRange && isSelectionInEditableField(window.getSelection());
                    currentState = STATE.REWRITE_RESULT_VISIBLE; // Lock the UI open
                    selectionUI.show({
                        view: 'rewritten-text',
                        rect, data: response.data,
                        originalText,
                        isEditable
                    });
                }, 100); // 100ms delay
            }
        } else {
            // Handle API errors
            if (response && response.errorType === 'MODEL_OVERLOAD') {
                // If the model is overloaded, give the user an option to switch to a stable model.
                selectionUI.show({
                    view: 'model-selection',
                    rect,
                    originalText,
                    error: response.error || 'The default model is currently overloaded. Try the stable model.'
                });
            } else {
                selectionUI.show({ view: 'error', rect, error: response ? response.error : 'An unknown error occurred.' });
            }
            currentState = STATE.SHOWING_OPTIONS; // Allow user to try again
        }
    };

    // --- Event Listeners ---
    const debouncedMouseupHandler = debounce(handleTextSelection, DEBOUNCE_DELAY);
    
    const handleMouseDown = (event) => {
        const card = document.getElementById('wordup-selection-card');
        if (!card || card.style.display === 'none') return;

        const isClickInsideCard = card.contains(event.target);
        const isClickOutside = !isClickInsideCard;
 
        if (isClickOutside) {
            // If the user clicks away, always hide the UI and reset the state.
            // This provides a more predictable experience than leaving the rewrite card open.
            selectionUI.hide();
            currentState = STATE.IDLE;
        } else if (currentState === STATE.SHOWING_OPTIONS) {
            // If a click is inside the card while options are showing (e.g., clicking a rewrite button),
            // prevent the main mouseup handler from closing it.
            event.stopPropagation();
        }
    };

    const handleKeyDown = (event) => {
        // Ctrl+Shift+L for lookup/rewrite
        if (event.ctrlKey && event.shiftKey && (event.key === 'L' || event.key === 'l')) {
            event.preventDefault();
            handleTextSelection();
        }
    };

    const disableAllListeners = () => {
        document.removeEventListener('mouseup', debouncedMouseupHandler);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleMouseDown);
    };

    // Listen for rewrite requests from the UI script
    document.addEventListener('wordup-rewrite-request', (event) => {
        const { text, tone, model } = event.detail; // model can be 'stable'
        // Use the stored rectangle from the last valid selection.
        // This prevents errors if the user's click on a button deselects the text.
        if (!lastSelectionRect) return;
        
        currentState = STATE.AWAITING_REWRITE; // Set state to prevent other handlers from interfering
        selectionUI.show({ view: 'loading', rect: lastSelectionRect });

        // Before sending, check if the runtime is still connected.
        if (!chrome.runtime?.id) {
            console.warn('WordUp: Extension context invalidated. Please reload the page.');
            return disableAllListeners();
        }

        chrome.runtime.sendMessage({ type: 'rewriteTone', payload: { text, tone, model } }, (response) => {
            if (chrome.runtime.lastError) {
                if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                    console.warn('WordUp: Context invalidated, please reload the page.');
                    disableAllListeners(); // Stop listening to prevent further errors.
                    return;
                }
                console.error(`WordUp: Error during rewrite: ${chrome.runtime.lastError.message}`);
                return selectionUI.show({ view: 'error', rect: lastSelectionRect, error: 'Could not connect to the service.' });
            }
            // Only handle the response if there was no error.
            handleServiceWorkerResponse(response, lastSelectionRect, text);
        });
    });

    // Listen for insert requests from the UI script
    document.addEventListener('wordup-insert-request', (event) => {
        const { text } = event.detail;
        if (lastSelectionRange) {
            try {
                lastSelectionRange.deleteContents();
                lastSelectionRange.insertNode(document.createTextNode(text));
            } catch (e) {
                console.error('WordUp: Failed to insert text.', e);
            }
        }
        // Clean up after insertion
        selectionUI.hide();
        currentState = STATE.IDLE;
    });

    // --- Initialization ---
    document.addEventListener('mouseup', debouncedMouseupHandler);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
})();