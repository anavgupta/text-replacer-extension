# ReText — Chrome/Edge Extension

A browser extension that finds and replaces text on any web page. Supports scoping, regex, groups, and per-rule toggles.

## Features

- **Text Replacement** -- Replace any text on web pages (case-insensitive)
- **Whole Word Matching** -- Match complete words only, with special-character-aware boundaries
- **Regex Mode** -- Use regular expression patterns for advanced find/replace
- **Scope Filtering** -- Limit rules to specific domains, paths, or wildcard URL patterns (comma-separated)
- **Rule Groups** -- Organize rules into named groups (e.g., "Salesforce", "Internal")
- **Global Toggle** -- Enable/disable all replacements with one switch
- **Per-Rule Toggle** -- Enable/disable individual rules without deleting them
- **Search/Filter** -- Filter the rule list by text, replacement, scope, or group name
- **Badge Count** -- Extension icon shows the number of active rules (or "OFF" when disabled)
- **Keyboard Shortcut** -- `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac) to toggle globally
- **Context Menu** -- Right-click selected text to create a replacement rule instantly
- **Import/Export** -- Backup and restore rules as JSON or CSV (supports multiple JSON formats)
- **Undo Delete** -- 5-second undo toast after deleting a rule
- **Dynamic Content** -- Automatically applies to dynamically loaded content via MutationObserver
- **Accessibility** -- ARIA labels, keyboard focus management, and screen reader support
- **Edge Compatible** -- Automatic fallback from `chrome.storage.sync` to `chrome.storage.local`

## Installation

### Chrome
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" and select this folder

### Edge
1. Navigate to `edge://extensions/`
2. Enable "Developer mode" (bottom left toggle)
3. Click "Load unpacked" and select this folder

## Usage

1. Click the extension icon to open the popup
2. Click **Add** to create a replacement rule
3. Fill in the fields:
   - **Text to Replace** -- the text (or regex pattern) to find
   - **Replacement Text** -- what to replace it with
   - **Scope** (optional) -- limit to specific URLs (see examples below)
   - **Group** (optional) -- organize into a named group
   - **Whole word only** -- match complete words only
   - **Use regex** -- treat the find field as a regular expression
4. Rules apply immediately on all matching pages

### Scope Examples

| Pattern | Matches |
|---------|---------|
| *(empty)* | All pages |
| `example.com` | example.com and subdomains |
| `*.example.com` | All subdomains |
| `*/api/*` | Any URL with `/api/` in the path |
| `*/view*` | URLs containing `/view` (flexible) |
| `example.com, other.com` | Multiple domains (comma-separated) |

### Context Menu

Select any text on a page, right-click, and choose **Create replacement for "..."** to pre-fill a new rule.

## File Structure

```
├── manifest.json        # Extension config (Manifest V3)
├── content.js           # Injected into pages -- performs replacements
├── background.js        # Service worker -- badge, shortcuts, context menu
├── popup.html           # Popup UI structure
├── popup.css            # Popup styles (CSS variables for theming)
├── popup.js             # Popup logic (CRUD, import/export, toasts)
├── icon{16,48,128}.png  # Extension icons
├── tests/
│   └── test-all.js      # 256 unit tests
├── data/
│   └── codes.json       # Sample import data template
└── docs/
    └── DEVELOPMENT_GUIDE.md
```

## Testing

```bash
node tests/test-all.js
```

Runs 256 tests covering scope matching, text replacement, regex mode, toggles, search, badge count, CSV parsing, accessibility, groups, and more.

## Privacy

- All data stored locally (or synced via your browser account)
- No external servers contacted
- No data collected or transmitted

## License

MIT License
