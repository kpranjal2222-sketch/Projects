# Link Terminal (LT•01) — Physical URL Shortener

## 1. Project overview
Link Terminal is a physical/virtual URL-shortening interface. A user enters a compact short code using three simulated hardware buttons or the web form. The resolver looks up the code and returns the destination URL, which is shown on an OLED-style display and in the web response panel.

**Important implementation status:** the provided HTML is a browser-based prototype. Its default mode uses local demo mappings. The page can call a configured Flask-style API for URL resolution, but database persistence is not provided by the HTML alone. AWS API Gateway, Lambda, and DynamoDB must be deployed and connected in the backend before claiming that lookups or newly added mappings are stored in AWS.

## 2. Main features
- OLED-style virtual device with selectable display phosphor themes.
- UP, DOWN, and SELECT controls; keyboard shortcuts are also supported.
- Character-wheel and preset-code input modes.
- Short-code lookup through demo data or a configured API endpoint.
- Add custom code-to-URL mappings in demo mode; mappings are saved in the browser's local storage.
- Light/dark page appearance toggle, with the selection remembered in the browser.
- Result panel with destination URL, copy/open actions, and a visual QR-style area.
- Pipeline trace and serial-style activity log for explaining the intended request flow.
- Responsive layout for presentation on a laptop or projector.

## 3. Technology stack
### Current prototype
- HTML5 — page structure and controls.
- CSS — layout, device/OLED styling, responsive rules, light/dark appearance.
- Vanilla JavaScript — input state, code selection, lookup, logs, and UI updates.
- Browser `localStorage` — saves custom mappings and page-theme preference locally in the same browser.

### Intended cloud-connected deployment
- ESP32-WROOM-32 — reads physical UP/DOWN/SELECT buttons and sends a request over Wi-Fi.
- SSD1306 128×64 I²C OLED — displays the short code, status, and destination information.
- Python Flask or AWS API Gateway — HTTP API boundary (choose the actual deployed route).
- AWS Lambda — validates the short code and performs the lookup/write operation.
- Amazon DynamoDB — stores the short-code-to-URL mapping.

Do not list a service as operational unless it is actually deployed and tested. The current UI's architecture trace is explanatory; highlighting a node does not itself prove that a live AWS request occurred.

## 4. Data model
A simple DynamoDB item can use:
- `short_code` (partition key, string): unique code such as `LAB42`.
- `url` (string): destination URL, e.g. `https://docs.aws.amazon.com/`.
- Optional fields: `created_at`, `updated_at`, `created_by`, and `description`.

The application should normalize codes to uppercase, validate allowed characters, validate URLs, and handle duplicate codes according to a defined policy (reject, update, or require confirmation).

## 5. Workflow

### A. Resolve a short code
1. The user chooses a code with the physical buttons, preset mode, or web form.
2. The UI sends `GET /api/resolve/<CODE>` to the configured API (or reads local demo data in demo mode).
3. The backend validates the code.
4. The resolver reads the matching item from DynamoDB using the short code as the partition key.
5. The backend returns JSON containing the destination URL.
6. The UI shows success/error status, the full URL, and the OLED-style display updates.
7. The ESP32 version follows the same logical flow and renders the response on the physical OLED.

### B. Add a short-code mapping
1. The user submits a short code and destination URL.
2. The frontend validates basic input and normalizes the code.
3. In **demo mode**, the mapping is stored in browser `localStorage` and remains available in that browser.
4. In a cloud deployment, the frontend must call a dedicated authenticated write endpoint (for example, `POST /api/links`) which validates the request and writes an item to DynamoDB.
5. The API returns a success or error response; the UI should display that actual response.

**Current limitation:** the HTML form does not write to DynamoDB. It must not be presented as a real database insert until a backend write endpoint has been implemented and tested.

## 6. Suggested API contract
### Resolve
`GET /api/resolve/{short_code}`

Success response:
```json
{
  "short_code": "LAB42",
  "url": "https://docs.aws.amazon.com/"
}
```

Not-found response (example):
```json
{
  "error": "Short code not found"
}
```

### Create or update a mapping
`POST /api/links`

Request:
```json
{
  "short_code": "LAB42",
  "url": "https://docs.aws.amazon.com/"
}
```

The backend should return an appropriate `201 Created` response for a new mapping, `200 OK` for an update if updates are allowed, and `400`/`409` for invalid or duplicate data as appropriate. Protect the write endpoint from unauthorized use.

## 7. Demo controls
- **UP / DOWN:** move through the character wheel or browse presets, depending on selected input mode.
- **SELECT:** start/confirm character input; in preset mode, resolve the selected preset.
- **Backspace / Delete:** remove the last character.
- **Resolve on Cloud:** submit the current code to the configured resolver.
- **Light/Dark Mode:** changes the webpage appearance; OLED color selection is independent.
- **Add mapping:** saves a mapping locally in demo mode. It does not create a DynamoDB record without backend write support.

## 8. Presentation script
1. Explain the problem: long URLs are awkward to enter on a small physical device.
2. Show a short code such as `LAB42`.
3. Use the preset mode or web form to resolve it.
4. Point out the OLED-style status and destination panel.
5. Add a custom mapping and refresh the page to show browser-local persistence.
6. Explain the intended AWS workflow: API → Lambda → DynamoDB → response.
7. Clearly state which cloud components are deployed and tested versus simulated.

## 9. Before final submission
- Configure and test the real API URL; do not use a placeholder endpoint.
- Implement and test the backend write route if mappings must be stored in DynamoDB.
- Add CORS configuration if frontend and API origins differ.
- Validate URLs and short-code format on both frontend and backend.
- Handle duplicate codes, missing codes, API timeouts, and network errors.
- Never expose AWS access keys or secrets in frontend code.
- Confirm GPIO pins and wiring match the actual ESP32 build; the page's pin labels are illustrative until verified.
- Test both light and dark modes, browser refresh, keyboard controls, and mobile/projector sizing.

## Source file layout and sound verification
- `index.html` loads `styles.css` and `app.js`.
- `app.js` uses `AudioContext` to synthesize tick, select, success, and error tones.
- The **♪ TEST SOUND** control is a direct user click to test audio output. Browser speaker playback must be verified on the actual presentation machine.
