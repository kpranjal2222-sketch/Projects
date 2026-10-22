# Link Terminal LT•01 — Presentation Package

Open `index.html` in a modern browser to run the frontend prototype.

- Default behavior: local demo data.
- Custom demo mappings are stored in this browser using localStorage.
- Configure an API base URL using **Cloud Endpoint** to test an existing compatible resolver API.
- The current frontend does not write new mappings to DynamoDB. Implement and test a backend write route before presenting database writes as live. API mode selection only configures the endpoint; it does not prove connectivity until a lookup succeeds.
- See `PROJECT.md` for architecture, data model, workflow, API contract, limitations, and presentation checklist.

No AWS credentials should be placed in this frontend package.

## Separated source files
- `index.html` — markup and structure
- `styles.css` — all page and OLED styling
- `app.js` — lookup, buttons, audio, and demo persistence

## Audio test
Click **♪ TEST SOUND** in the header. The browser synthesizes button tones with the Web Audio API; no sound files are required. Audio output depends on browser autoplay policies, tab/site permissions, OS volume, and the selected output device. Physical ESP32 piezo hardware is not tested by this browser demo.
