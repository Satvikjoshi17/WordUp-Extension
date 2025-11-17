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

# 🧠 Architecture Overview

WordUp uses a clean, event-driven MV3 setup ensuring speed, reliability, and zero UI clutter.

