# Radarr IMDB Bridge

Chrome extension that lets you add movies directly from an IMDB title page into Radarr with a single click.

## Features
- Detects when you are on an IMDB movie page and pulls the title, year, and IMDB id.
- Lets you pick a Radarr quality profile and sends the movie straight to Radarr via its v3 API.
- Triggers Radarr to start searching immediately and surfaces success/error feedback inside the popup and as a desktop notification.
- Extension options page securely stores your Radarr URL, API key, root folder, and preferred quality profiles in `chrome.storage.local`.

## Install & Load
1. Clone or download this repository locally.
2. In Chrome/Edge open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, then choose **Load unpacked** and select the project folder.
3. Optional: pin the extension so its icon is visible on the toolbar.

## Initial Configuration
Open the extension options (Extensions page → Details → Extension options, or right-click the icon → Options) and fill in:

- **Radarr URL**: e.g. `https://radarr.example.com` (no trailing slash). Must be reachable from your browser.
- **API key**: found in Radarr → Settings → General → Security.
- **Default root folder**: the Radarr path where new movies should be stored.
- **Quality profiles**: enter each profile on its own line as `Name:ID`.

### Finding the Quality Profile IDs
Radarr shows the IDs via its API:

1. Visit `https://your-radarr-host/api/v3/qualityprofile?apikey=YOUR_KEY` in the browser (or use curl/Postman).
2. Each profile object in the JSON has its own `"id"` field; copy that value, not the nested `quality.id`.
3. Example: `Ultra-HD:6` or `HD - 720p/1080p:3`.
4. Set a default quality profile (optional) in the dropdown so it is pre-selected in the popup.

All settings are stored locally and never committed to source control.

## Usage Flow
1. Browse to a movie page on IMDB (`https://www.imdb.com/title/tt...`).
2. Click the extension icon. The popup shows the detected title/year and your quality profiles.
3. Click **Add Movie**. Success triggers a confirmation message and desktop notification. If Radarr reports an error (e.g., movie already exists), the popup displays a clear explanation.

The extension automatically opens the options page if required settings are missing.

## Development Notes
- Manifest v3 service worker (`background.js`) is used solely for install-time storage prep and notifications.
- `content.js` extracts movie metadata and validates that the page is a movie (not TV).
- `popup.js` orchestrates UI state, configuration reads, Radarr calls, user feedback, and the options redirect on first-run.
- `options.js` handles form persistence, parsing the profile list, and validation.

### Quick Test Loop
```bash
# from repo root
git status
# edit files as needed
# reload extension via chrome://extensions, refresh IMDB tab, and retest
```

## Troubleshooting
- **Popup says “Open an IMDB movie page”**: ensure the active tab is an IMDB movie URL (`/title/tt...`).
- **Radarr errors**: check the message in the popup, confirm URL/API key/profile IDs, and verify your browser can reach the Radarr host (CORS/HTTPS issues).
- **No downloads appear**: Radarr’s most recent Activity → Queue reveals search status. Make sure your download client is connected.

## Security
- API key and URL are stored only in `chrome.storage.local`. Nothing sensitive is committed to git.
- Remember to `.gitignore` any personal configuration exports before sharing the repository.

## License
MIT License. See `LICENSE` if included, or adopt your preferred license.
