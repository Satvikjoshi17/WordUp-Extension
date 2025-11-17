# 🚀 WordUp — The Smart Vocabulary & Rewrite Assistant (Chrome Extension)

**Version:** 1.0 • **Manifest:** V3  
A clean, fast, and privacy-minded Chrome extension that gives you instant in-page definitions **and** AI-powered sentence rewrites using the Gemini API — all inside a beautifully unobtrusive floating card.

---

## ✨ Why WordUp Exists
Your browser should help you learn and write better — without forcing you to jump tabs, break focus, or fight clunky UX. WordUp does exactly that:

- **Select a word → Get a definition card instantly**
- **Select a sentence → Rewrite it in different tones using generative AI**
- **Right-click fallback where content scripts can’t run**
- **Manual search & theme control in the popup**
- **Configurable API key, data export/import, diagnostics**

Simple. Powerful. Zero noise.

---

# 🌟 Features

### 🔍 **On-Page Word Lookup**
Select a single word and a floating card appears with:
- Definition  
- Phonetic spelling  
- Synonyms / Antonyms  
- Copy support  

Zero navigation required.

---

### ✏️ **AI Sentence Rewriting (Gemini Powered)**
Select any phrase or sentence → choose a tone:
- **Formal**
- **Casual**
- **Professional**

If you're inside an editable field (textarea, input, contentEditable), you get an **Insert** button that drops the rewritten text right where it belongs.

---

### 🖱️ **Context Menu Fallback**
Useful for pages where content scripts don’t load (e.g., Chrome PDF Viewer):

> Right-click → **WordUp: Define “...”**  
Result appears in a clean mini-popup.

---

### 📌 **Popup Dashboard**
Your toolbar popup gives you:
- Manual search  
- Recently looked-up words  
- Theme toggle (Light/Dark)  
- Shortcut to Options

---

### ⚙️ **Options Page (Advanced Configuration)**
- Add your **Gemini API Key**
- Export / Import your vocabulary data
- Full diagnostics panel (API reachability, extension health, config status)

---

# 🔋 Performance, Caching & Reliability

### ⚡ Two-Layer Caching
- **In-memory LRU** (fast session lookups)  
- **Persistent cache** in `chrome.storage.local` with 7-day TTL  

### 🕒 Rate Limiting  
- Queue-based enforcement — example: **5 requests / sec**  
Prevents API abuse and random failures.

### 🛡️ Error Handling
- Clean structured error objects  
- Strong input validation  
- Safe fallback flows for edge cases (e.g., blocked content scripts)  

---

# 🔐 Security & Privacy

- **No API keys are hardcoded.**  
- **Your key stays local** (`chrome.storage.local`), not synced or uploaded.  
- Text is only sent to external APIs (dictionary or Gemini) **when you ask** — no background scraping, no telemetry.  
- DOM injection is minimal, isolated, and sanitized.

---

# 📥 Installation (Developer Mode)

1. Clone or download the project.  
2. Go to `chrome://extensions/`.  
3. Enable **Developer mode**.  
4. Click **Load unpacked** → select the `build/` folder.  
5. Extension loads instantly.

---

# 🧰 Developer Guide

### 📡 Background Service Worker
Handles:
- lookup and rewrite requests  
- API calls  
- caching  
- rate limiting  
- runtime config updates  
- message routing

### 🎣 Content Script (content.js)
- Detects selection changes  
- Determines “word vs sentence”  
- Manages state (`IDLE`, `SHOWING_OPTIONS`, `AWAITING_REWRITE`, etc.)  
- Dispatches/receives events from UI card  

### 🪟 Floating UI (selection-ui.js)
- Injects the **#wordup-selection-card**  
- Intelligent card positioning  
- Rendering views: loading, definition, rewrite options, errors  
- Dark/light theme sync  
- Emits actions (Copy, Insert, Rewrite)

---

# 🧪 Testing Checklist

- Word lookup on typical pages  
- Rewrite flows in editable vs non-editable environments  
- PDF viewer fallback via context menu  
- Dark/light mode consistency  
- Cache hit/miss behavior  
- Expired TTL cleanup  
- Invalid or missing API key handling  
- Service worker reactivation (common MV3 gotcha)  

---

# 🩺 Troubleshooting

### Card doesn’t appear
- Another extension might block DOM injection  
- Content script may be restricted on the current page  
- Check `chrome://extensions` → Inspect views  

### Rewrite not working
- Likely invalid Gemini API key  
- Check Options → Diagnostics  

### Insert button missing
- Your selection isn’t inside a supported editable field  

---
# 🚧 Roadmap

**Upcoming Improvements**
- Custom rewrite styles & user-defined tones  
- Offline word database for instant fallback  
- Optional server-proxy for enterprise environments  
- Analytics opt-in for stable error reporting  
- Enhanced UI animations & customization  

---

# 📝 License
MIT License — feel free to extend, remix, and improve.

---



