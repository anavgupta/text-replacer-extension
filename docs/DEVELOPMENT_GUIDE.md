# Building a Chrome/Edge Text Replacer Extension

A comprehensive guide to building a browser extension that replaces text on web pages with configurable rules.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Manifest File (manifest.json)](#manifest-file)
3. [Content Script - The Core Engine](#content-script)
4. [Popup UI - User Interface](#popup-ui)
5. [Storage API - Persisting Data](#storage-api)
6. [Key Code Patterns](#key-code-patterns)
7. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
8. [Testing & Debugging](#testing--debugging)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Extension                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Popup UI   │    │   Content    │    │  Background  │  │
│  │  (popup.*)   │    │   Script     │    │   Service    │  │
│  │              │    │ (content.js) │    │  Worker      │  │
│  │  - Config    │    │              │    │              │  │
│  │  - Add/Edit  │    │  - DOM       │    │  - Lifecycle │  │
│  │  - Import    │    │    Traverse  │    │  - Init      │  │
│  │  - Export    │    │  - Replace   │    │              │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘  │
│         │                   │                               │
│         └───────────┬───────┘                               │
│                     ▼                                       │
│            ┌──────────────────┐                             │
│            │  Chrome Storage  │                             │
│            │   (sync/local)   │                             │
│            └──────────────────┘                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | File(s) | Purpose |
|-----------|---------|---------|
| **Manifest** | `manifest.json` | Extension configuration, permissions, entry points |
| **Popup UI** | `popup.html`, `popup.css`, `popup.js` | User interface for managing replacements |
| **Content Script** | `content.js` | Runs on web pages, performs text replacement |
| **Background Worker** | `background.js` | Extension lifecycle, initialization |
| **Storage** | Chrome Storage API | Persists replacement rules |

---

## Manifest File

The manifest is the extension's configuration file. We use **Manifest V3** (required for Chrome/Edge).

```json
{
  "manifest_version": 3,
  "name": "Text Replacer",
  "version": "1.0.0",
  "description": "Replace text on web pages",
  
  "permissions": [
    "storage",      // Access chrome.storage API
    "activeTab"     // Access current tab
  ],
  
  "host_permissions": [
    "<all_urls>"    // Run on all websites
  ],
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],   // Which pages to run on
      "js": ["content.js"],        // Script to inject
      "run_at": "document_end",    // When to inject
      "all_frames": true           // Run in iframes too
    }
  ],
  
  "action": {
    "default_popup": "popup.html", // Popup when icon clicked
    "default_icon": { ... }        // Extension icons
  },
  
  "background": {
    "service_worker": "background.js"  // Background script
  }
}
```

### Key Concepts

| Field | Purpose |
|-------|---------|
| `manifest_version: 3` | Latest version, required for new extensions |
| `permissions` | APIs the extension can access |
| `host_permissions` | Which websites the extension can interact with |
| `content_scripts` | Scripts injected into web pages |
| `run_at: "document_end"` | Inject after DOM is ready |

---

## Content Script

The content script runs on every web page and performs the actual text replacement.

### DOM Tree Traversal

```javascript
function replaceTextInNode(node, replacements) {
  // Text nodes contain the actual text content
  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.textContent;
    let modified = false;

    replacements.forEach(replacement => {
      const { textToReplace, replacementText } = replacement;
      
      // Escape special regex characters in search text
      const escapedText = textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedText, 'gi');  // Case-insensitive
      
      const newText = text.replace(regex, replacementText);
      if (newText !== text) {
        text = newText;
        modified = true;
      }
    });

    if (modified) {
      node.textContent = text;  // Update the DOM
    }
  } else {
    // Recursively process child nodes
    for (let i = 0; i < node.childNodes.length; i++) {
      replaceTextInNode(node.childNodes[i], replacements);
    }
  }
}
```

### Why Traverse Text Nodes?

```html
<p>Hello <strong>World</strong>!</p>
```

DOM structure:
```
<p>
├── TEXT_NODE: "Hello "
├── <strong>
│   └── TEXT_NODE: "World"
└── TEXT_NODE: "!"
```

We only modify `TEXT_NODE` elements to:
- Preserve HTML structure
- Avoid breaking event listeners
- Maintain element attributes

### Watching for Dynamic Content

Modern websites load content dynamically (AJAX, SPA frameworks). We use `MutationObserver`:

```javascript
const observer = new MutationObserver(() => {
  performReplacements();  // Re-run when DOM changes
});

observer.observe(document.body, {
  childList: true,   // Watch for added/removed nodes
  subtree: true      // Watch entire subtree
});
```

### Scope Matching

Allow replacements only on specific URLs/domains. Supports wildcards and multiple scopes.

#### Single Scope Matching

```javascript
function matchesSingleScope(url, scope) {
  if (!scope || scope.trim() === '') {
    return true;  // Empty scope = apply everywhere
  }

  const urlObj = new URL(url);
  const scopeLower = scope.toLowerCase().trim();
  const fullUrl = url.toLowerCase();
  
  // Wildcard support: *.example.com, */path/*
  if (scopeLower.includes('*')) {
    const pattern = scopeLower
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars EXCEPT *
      .replace(/\*/g, '.*');   // Convert * to .*
    const regex = new RegExp(pattern, 'i');
    
    // Test against FULL URL (enables path matching)
    if (regex.test(fullUrl)) return true;
    
    // Also test against hostname only
    if (regex.test(urlObj.hostname)) return true;
    
    return false;
  }
  
  // Simple domain/path matching
  return urlObj.hostname.includes(scopeLower) || fullUrl.includes(scopeLower);
}
```

#### Multi-Scope Support (Comma-Separated)

```javascript
function matchesScope(url, scope) {
  if (!scope || scope.trim() === '') {
    return true;  // No scope = apply everywhere
  }

  // Split by comma, check each scope
  const scopes = scope.split(',').map(s => s.trim()).filter(s => s);
  
  // Return true if ANY scope matches (OR logic)
  return scopes.some(singleScope => matchesSingleScope(url, singleScope));
}
```

#### Scope Pattern Examples

| Pattern | Matches | Does NOT Match |
|---------|---------|----------------|
| `example.com` | `https://example.com/page` | `https://other.com` |
| `*.example.com` | `sub.example.com`, `a.b.example.com` | `example.com` |
| `*/api/*` | `https://site.com/api/users` | `https://site.com/home` |
| `*/view*` | `.../view`, `.../view/`, `.../view?id=1` | `.../preview` |
| `*/view/*` | `.../view/123` | `.../view` (no trailing content!) |

> ⚠️ **Common Mistake:** `*/view/*` requires something AFTER `/view/`. Use `*/view*` to match URLs ending with `/view`.

---

## Popup UI

### Table-Based Layout

Compact display using HTML tables:

```html
<table class="replacements-table">
  <thead>
    <tr>
      <th>Find</th>
      <th>Replace</th>
      <th>Scope</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody id="replacementsList">
    <!-- Rows added dynamically -->
  </tbody>
</table>
```

### Dynamic Row Generation

```javascript
function renderReplacements() {
  const tbody = document.getElementById('replacementsList');
  tbody.innerHTML = '';
  
  replacements.forEach((replacement, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(replacement.textToReplace)}</td>
      <td>${escapeHtml(replacement.replacementText)}</td>
      <td>${replacement.scope || '—'}</td>
      <td>
        <button class="edit-btn" data-index="${index}">✎</button>
        <button class="delete-btn" data-index="${index}">×</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
```

### XSS Prevention

Always escape user content before inserting into HTML:

```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;  // Automatically escapes
  return div.innerHTML;
}
```

### Modal Dialog

```css
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.modal.active {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

```javascript
function openModal() {
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}
```

---

## Storage API

### Sync vs Local Storage

| Feature | `chrome.storage.sync` | `chrome.storage.local` |
|---------|----------------------|------------------------|
| **Syncs across devices** | ✅ Yes | ❌ No |
| **Requires sign-in** | ✅ Yes (Chrome) | ❌ No |
| **Storage limit** | ~100KB | ~5MB |
| **Edge compatibility** | ⚠️ May require sign-in | ✅ Always works |

### Usage Pattern

```javascript
// Save data
chrome.storage.sync.set({ replacements: [...] }, () => {
  if (chrome.runtime.lastError) {
    console.error('Save failed:', chrome.runtime.lastError);
  }
});

// Load data
chrome.storage.sync.get(['replacements'], (result) => {
  const replacements = result.replacements || [];
});

// Listen for changes (in content script)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.replacements) {
    performReplacements();  // Re-apply with new rules
  }
});
```

---

## Key Code Patterns

### 1. IIFE for Content Scripts

Wrap content scripts in an Immediately Invoked Function Expression to avoid polluting global scope:

```javascript
(function() {
  'use strict';
  
  // All code here is isolated
  const myVar = 'private';
  
})();
```

### 2. Escaping Regex Special Characters

User input may contain regex special characters:

```javascript
// User wants to replace "cost (USD)" 
// Without escaping: /cost (USD)/  ← Invalid regex!
// With escaping:    /cost \(USD\)/ ← Works!

const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

| Character | Meaning in Regex | Escaped |
|-----------|-----------------|---------|
| `.` | Any character | `\.` |
| `*` | Zero or more | `\*` |
| `+` | One or more | `\+` |
| `?` | Optional | `\?` |
| `(` `)` | Group | `\(` `\)` |
| `[` `]` | Character class | `\[` `\]` |
| `{` `}` | Quantifier | `\{` `\}` |
| `^` `$` | Anchors | `\^` `\$` |
| `|` | OR | `\|` |
| `\` | Escape | `\\` |

### 3. CSV Import/Export

```javascript
// Export - handle special characters
function escapeCsvField(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';  // Double quotes
  }
  return field;
}

// Import - parse quoted fields
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let char of line) {
    if (inQuotes) {
      if (char === '"') inQuotes = false;
      else current += char;
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}
```

### 4. File Download (Export)

```javascript
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);  // Clean up
}

// Usage
downloadFile(JSON.stringify(data), 'backup.json', 'application/json');
downloadFile(csvContent, 'backup.csv', 'text/csv');
```

### 5. Multi-Format Import (JSON with Array Scopes)

The import function supports multiple JSON formats:

```javascript
function importReplacements(fileContent) {
  const data = JSON.parse(fileContent);
  let validReplacements = [];
  
  if (data.replacements && Array.isArray(data.replacements)) {
    // Standard format: { replacements: [{textToReplace, replacementText, scope}] }
    validReplacements = data.replacements;
    
  } else if (data.codes && Array.isArray(data.codes)) {
    // Codes format: { codes: [{code, name, scope}] }
    // Scope can be string OR array of strings
    validReplacements = data.codes.map(r => {
      let scope = '';
      if (Array.isArray(r.scope)) {
        scope = r.scope.join(', ');  // Convert array to comma-separated
      } else if (r.scope) {
        scope = r.scope;
      }
      return {
        textToReplace: r.code,
        replacementText: r.name,
        scope: scope
      };
    });
  }
  
  return validReplacements;
}
```

#### Supported Import Formats

**Format 1: Standard Backup**
```json
{
  "replacements": [
    { "textToReplace": "hello", "replacementText": "hi", "scope": "example.com" }
  ]
}
```

**Format 2: Codes with String Scope**
```json
{
  "codes": [
    { "code": "8601", "name": "On QS Load", "scope": "example.com" }
  ]
}
```

**Format 3: Codes with Array Scope (Multiple URLs)**
```json
{
  "codes": [
    {
      "code": "8601",
      "name": "On QS Load",
      "scope": [
        "*/related/Histories/view*",
        "*/lightning/r/SBQQ__Quote__c/*",
        "*.salesforce.com"
      ]
    }
  ]
}
```

Array scopes are converted to comma-separated strings on import:
```
["scope1", "scope2", "scope3"] → "scope1, scope2, scope3"
```

---

## Common Pitfalls & Solutions

### 1. Regex Global Flag with test()

❌ **Problem:**
```javascript
const regex = /hello/gi;
if (regex.test(text)) {        // Advances lastIndex
  text = text.replace(regex, 'hi');  // Misses first match!
}
```

✅ **Solution:**
```javascript
const regex = /hello/gi;
const newText = text.replace(regex, 'hi');
if (newText !== text) {
  // Replacement happened
}
```

### 2. Storage Sync Issues in Edge

❌ **Problem:** `chrome.storage.sync` may not work in Edge without Microsoft account sign-in.

✅ **Solution:** Use `chrome.storage.local` for better compatibility:
```javascript
const storage = chrome.storage.local;  // Works everywhere
```

### 3. Content Script Not Loading

❌ **Problem:** Content script doesn't run on some pages.

✅ **Checklist:**
- Check `matches` pattern in manifest
- Browser extension pages (`chrome://`, `edge://`) are restricted
- Check for CSP (Content Security Policy) blocks
- Ensure extension is enabled and reloaded

### 4. DOM Not Ready

❌ **Problem:** Script runs before DOM exists.

✅ **Solution:**
```javascript
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();  // DOM already ready
}
```

### 5. XSS Vulnerability

❌ **Problem:** Inserting user content directly into HTML.
```javascript
element.innerHTML = userInput;  // DANGEROUS!
```

✅ **Solution:**
```javascript
element.textContent = userInput;  // Safe
// Or escape HTML entities
element.innerHTML = escapeHtml(userInput);
```

### 6. Scope Pattern Trailing Slash

❌ **Problem:** Scope `*/view/*` doesn't match URLs ending with `/view`

```
URL:    https://example.com/page/view
Scope:  */view/*
Regex:  .*/view/.*
Result: NO MATCH (requires something after /view/)
```

✅ **Solution:** Use `*/view*` (no trailing slash before asterisk)

```
URL:    https://example.com/page/view
Scope:  */view*
Regex:  .*/view.*
Result: MATCH ✅
```

| Pattern | Matches URLs ending with |
|---------|-------------------------|
| `*/view/*` | `/view/123`, `/view/` (needs content after `/view/`) |
| `*/view*` | `/view`, `/view/`, `/view?id=1`, `/view/123` |

### 7. Scope Only Matching Hostname

❌ **Problem:** Scope pattern only tested against hostname, not full URL path.

```javascript
// Only checks hostname
regex.test(urlObj.hostname);  // Misses path patterns like */api/*
```

✅ **Solution:** Test against full URL for path matching:

```javascript
const fullUrl = url.toLowerCase();

// Test against full URL first (enables path matching)
if (regex.test(fullUrl)) return true;

// Fall back to hostname matching
if (regex.test(urlObj.hostname)) return true;
```

---

## Testing & Debugging

### Loading the Extension

1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select extension folder

### Debugging Popup

1. Click extension icon to open popup
2. Right-click inside popup → "Inspect"
3. DevTools opens for popup context

### Debugging Content Script

1. Go to any web page
2. Open DevTools (F12)
3. Console shows content script logs
4. Look for "Text Replacer:" prefixed messages

### Debugging Background Worker

1. Go to `chrome://extensions/`
2. Find your extension
3. Click "Service Worker" link
4. DevTools opens for background context

### Adding Debug Logs

```javascript
console.log('Text Replacer: Content script loaded on', window.location.href);
console.log('Text Replacer: Found', replacements.length, 'replacements');
console.log('Text Replacer: Active for this page:', activeReplacements.length);
```

---

## File Structure

```
GCExtension - Replacer/
├── manifest.json           # Extension configuration (Manifest V3)
├── content.js              # Content script - injected into web pages
├── background.js           # Service worker - extension lifecycle
├── popup.html              # Popup UI structure
├── popup.css               # Popup UI styles (table layout, modal)
├── popup.js                # Popup UI logic (CRUD, import/export)
├── icon16.png              # Toolbar icon (16x16)
├── icon48.png              # Extension page icon (48x48)
├── icon128.png             # Store/large icon (128x128)
├── data/
│   └── codes.json          # Sample data file (codes with array scopes)
├── docs/
│   └── DEVELOPMENT_GUIDE.md  # This documentation
├── dist/
│   └── TextReplacer/       # Clean packaged extension folder
│       ├── manifest.json
│       ├── content.js
│       ├── background.js
│       ├── popup.html
│       ├── popup.css
│       ├── popup.js
│       └── icon*.png
├── .gitignore              # Git ignore rules
├── README.md               # User-facing documentation
├── create-icons.ps1        # PowerShell script to generate icons
├── generate-icons.html     # HTML tool to generate icons
└── TextReplacer-*.zip      # Packaged releases
```

---

## Summary

| Concept | Key Takeaway |
|---------|--------------|
| **Manifest V3** | Required for Chrome/Edge, uses service workers |
| **Content Scripts** | Run in page context, can access DOM |
| **Storage API** | Use `local` for compatibility, `sync` for cross-device |
| **DOM Traversal** | Only modify TEXT_NODE to preserve structure |
| **MutationObserver** | Handle dynamic content (SPA, AJAX) |
| **Regex Escaping** | Always escape user input for regex |
| **Global Flag Bug** | Don't use `test()` before `replace()` with `g` flag |
| **Multi-Scope** | Support comma-separated scopes, array import |
| **URL Path Matching** | Test scope against full URL, not just hostname |
| **Trailing Slash** | Use `*/path*` not `*/path/*` to match URLs ending with `/path` |

---

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Content Scripts Guide](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

---

*Created by Anav Gupta*
