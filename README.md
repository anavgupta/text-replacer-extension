# Text Replacer Chrome/Edge Extension

A browser extension that allows you to replace text on web pages with custom replacements. Configure text to replace, replacement text, and optional scope filtering.

## Features

- **Text Replacement**: Replace any text on web pages with custom text
- **Scope Filtering**: Optionally limit replacements to specific domains or URL patterns
- **Real-time Updates**: Changes apply immediately without page refresh
- **Dynamic Content Support**: Works with dynamically loaded content
- **Multiple Replacements**: Configure multiple text replacements simultaneously

## Installation

### For Chrome:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this extension folder

### For Edge:
1. Open Edge and navigate to `edge://extensions/`
2. Enable "Developer mode" (toggle in bottom left)
3. Click "Load unpacked"
4. Select this extension folder

## Usage

1. Click the extension icon in your browser toolbar
2. Click "+ Add Replacement" to create a new replacement rule
3. Fill in:
   - **Text to Replace**: The text you want to replace (case-insensitive)
   - **Replacement Text**: The text that will replace it
   - **Scope (Optional)**: Limit where the replacement applies (see Scope Examples below)
4. Replacements are saved automatically and apply immediately

## Scope Examples

The scope field allows you to limit where replacements are applied:

- **Empty**: Apply replacement on all websites
- `example.com` - Matches example.com and all subdomains
- `*.example.com` - Matches all subdomains of example.com
- `https://example.com/*` - Matches all pages on example.com
- `github.com` - Matches github.com specifically

## Icon Files

The extension requires icon files. You have two options:

1. **Use the HTML generator**: Open `generate-icons.html` in your browser and click the download buttons to generate the icon files.

2. **Create manually**: Create PNG images:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)

You can also use any image editor or online icon generator to create these files.

## Technical Details

- **Manifest Version**: 3 (Chrome/Edge compatible)
- **Storage**: Uses Chrome sync storage for cross-device synchronization
- **Content Script**: Runs on all pages to perform text replacement
- **Mutation Observer**: Watches for dynamic content changes

## Privacy

This extension:
- Only stores your replacement configurations locally/synced to your account
- Does not collect or transmit any data
- Does not access any external servers
- All processing happens locally in your browser

## License

MIT License - feel free to modify and distribute as needed.
