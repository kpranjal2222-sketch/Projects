# Link Terminal — Serverless URL Shortener & QR Code Generator

**Institution:** School of CS & AI, SR University  
**Course / Lab:** Cloud Computing (AWS Lab — Product Review)  
**Batch:** 66 | **Product No.:** 07  
**Cloud Environment:** AWS Academy Learner Lab (`us-east-1` — US East, N. Virginia)  
**Deployment Status:** Live & Verified  

---

## 1. Live Deployment & Access Links

| Resource | Identifier / Endpoint |
| :--- | :--- |
| **Live Web Application (S3)** | `http://link-terminal-pranjal-1.s3-website-us-east-1.amazonaws.com` |
| **API Gateway Invoke URL** | `https://3d12ebwpy0.execute-api.us-east-1.amazonaws.com` |
| **S3 Static Hosting Bucket** | `link-terminal-pranjal-1` |
| **API Gateway HTTP API** | `LinkTerminalHTTPAPI1` (API ID: `3d12ebwpy0`, Stage: `$default`) |
| **AWS Lambda Function** | `LinkTerminalAPI1` (Runtime: Python 3.12, Role: `LabRole`) |
| **Amazon DynamoDB Table** | `LinkMappings1` (Partition Key: `short_code` [String], On-Demand) |

---

## 2. Project Overview

**Link Terminal** is a 100% serverless cloud web application that associates long web URLs with short, human-readable 1–12 character codes (`A–Z`, `0–9`, `-`, `_`) and generates instant, scannable QR codes.

### Key Capabilities
- **Create Short Mappings (`POST /api/links`):** Validates user-supplied short codes and `http://` or `https://` URLs before persisting them in Amazon DynamoDB.
- **Resolve Short Codes (`GET /api/resolve/{short_code}`):** Retrieves destination URLs in sub-second latency, displays round-trip response time in milliseconds, and renders a scannable QR code on an HTML5 `<canvas>`.
- **Live Saved Codes Directory (`GET /api/links`):** Fetches and displays all stored mappings from DynamoDB with one-click **Resolve** and **Copy** actions, plus an automatic `localStorage` fallback if the list route is unreachable.
- **Interactive Pipeline & Theme Controls:** Features a 4-stage live request-flow visualizer (`01 Browser -> 02 API Gateway -> 03 Lambda -> 04 DynamoDB`), real-time API health badge (`AWS live API`), PNG QR download, and Light/Dark theme toggle.

---

## 3. Repository & Code File Structure

```text
link-terminal/
├── index.html           # Semantic frontend structure (Lookup, Create, Result, Request Flow, Saved Codes)
├── styles.css           # Responsive dual-theme styling (Light & Dark mode CSS variables, grid layout)
├── app.js               # Frontend state, API Gateway fetch calls, flow animation & QR canvas rendering
├── qrcode.js            # Client-side QR Code generator library (Kazuhiko Arase, MIT License)
├── lambda_function.py   # AWS Lambda Python 3.12 backend handler interfacing with DynamoDB via Boto3
└── README.md            # Project architecture, setup guide, API specs & team contributions
```

---

## 4. System Architecture

```text
+-------------------------------------------------------------------------+
|                            END USER (BROWSER)                           |
|       Loads Static Web UI (index.html, styles.css, app.js, qrcode.js)   |
+------------------------------------+------------------------------------+
                                     |
           1. Static Assets (HTTP)   |   2. REST/JSON Requests (HTTPS + CORS)
           v                         v
+------------------------+   +--------------------------------------------+
|       AMAZON S3        |   |         AMAZON API GATEWAY (HTTP API)      |
| link-terminal-pranjal-1|   |           LinkTerminalHTTPAPI1             |
| Static Website Hosting |   |  - POST /api/links                         |
+------------------------+   |  - GET  /api/links                         |
                             |  - GET  /api/resolve/{short_code}          |
                             +---------------------+----------------------+
                                                   |
                                                   | 3. Lambda Proxy Invocation
                                                   v
                             +--------------------------------------------+
                             |                 AWS LAMBDA                 |
                             |             LinkTerminalAPI1               |
                             |     Python 3.12 + Boto3 SDK (LabRole)      |
                             +---------------------+----------------------+
                                                   |
                                                   | 4. PutItem / GetItem / Scan
                                                   v
                             +--------------------------------------------+
                             |              AMAZON DYNAMODB               |
                             |               LinkMappings1                |
                             |   Partition Key: short_code (String)       |
                             +--------------------------------------------+
```

---

## 5. End-to-End Operational Workflows

### Workflow A: Create a Short Code (`POST /api/links`)
```text
[User enters short_code & URL]
              │
              ▼
[Client Validation in app.js] ──(Invalid)──▶ [Toast Alert: Format Error]
              │ (Valid: 1-12 chars & http/https)
              ▼
[POST https://3d12ebwpy0.execute-api.us-east-1.amazonaws.com/api/links]
              │
              ▼
[Lambda: LinkTerminalAPI1 parses JSON & calls DynamoDB PutItem]
              │
              ├──(Code Exists: HTTP 409)──▶ [Toast: Short code already exists]
              │
              ▼ (Success: HTTP 200/201)
[DynamoDB LinkMappings1 stores { short_code, url }]
              │
              ▼
[Frontend updates Saved Codes table & auto-resolves new QR code]
```

### Workflow B: Resolve Short Code & Generate QR (`GET /api/resolve/{short_code}`)
```text
[User enters short_code or clicks "Resolve" in table]
              │
              ▼
[GET https://3d12ebwpy0.execute-api.us-east-1.amazonaws.com/api/resolve/{short_code}]
              │
              ▼
[Lambda: LinkTerminalAPI1 queries DynamoDB GetItem]
              │
              ├──(Not Found: HTTP 404)──▶ [Badge: NOT FOUND (Red)]
              │
              ▼ (Found: HTTP 200)
[Frontend displays Destination URL, Latency (ms), QR Canvas & PNG Download]
```

---

## 6. API Endpoint Reference

| Method | Route | Request Payload / Params | Success Response | Error Responses |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/links` | JSON: `{"short_code": "AWS2026", "url": "https://www.wikipedia.org"}` | `200` / `201` Created mapping JSON | `400` Invalid input, `409` Duplicate code |
| `GET` | `/api/links` | None | `200` JSON array/object of all saved items | `500` Internal server error |
| `GET` | `/api/resolve/{short_code}` | Path parameter: `short_code` (case-insensitive, normalized uppercase) | `200` JSON containing `url` / `destination_url` | `404` Short code not found |

---

## 7. Quick Setup & Deployment Guide (AWS Learner Lab)

1. **Start Learner Lab:** Open AWS Academy Learner Lab, click **Start Lab**, wait for the green status dot, and select **US East (N. Virginia) `us-east-1`**.
2. **DynamoDB:** Create table `LinkMappings1` with Partition Key `short_code` (**String**) and default settings.
3. **Lambda:** Create Python 3.12 function `LinkTerminalAPI1` using existing role **`LabRole`**. Deploy `lambda_function.py` configured to target table `LinkMappings1`.
4. **API Gateway:** Create an **HTTP API** named `LinkTerminalHTTPAPI1` with routes `GET /api/links`, `POST /api/links`, and `GET /api/resolve/{short_code}` integrated with `LinkTerminalAPI1`. Configure CORS (`Access-Control-Allow-Origin: *`, `Methods: GET, POST, OPTIONS`, `Headers: content-type`).
5. **Frontend Config:** Set `const API_BASE = "https://3d12ebwpy0.execute-api.us-east-1.amazonaws.com";` at the top of `app.js`.
6. **S3 Hosting:** Create bucket `link-terminal-pranjal-1`, disable *Block all public access*, enable **Static website hosting** (`index.html`), attach a public `s3:GetObject` bucket policy, and upload `index.html`, `styles.css`, `app.js`, and `qrcode.js` to the root.

---

## 8. Verification & Test Summary

| Test ID | Scenario | Input / Action | Expected & Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `TC-01` | Save URL Mapping | `AWS` -> `https://aws.amazon.com/` | Stored in `LinkMappings1`; status `AWS live API` | Passed |
| `TC-02` | Save Institutional Link | `SRU` -> `https://sru.edu.in/` | Stored in `LinkMappings1` and listed in UI table | Passed |
| `TC-03` | Resolve & QR Scan | Resolve `AWS` / `SRU` | Resolved in ~369–625 ms with valid QR code | Passed |
| `TC-04` | Missing Short Code | Resolve `ZZZZ` | Displays `NOT FOUND` badge and error toast | Passed |
| `TC-05` | Live Directory Sync | Page load / `Refresh` (`GET /api/links`) | Lists all DynamoDB items without fallback warning | Passed |

---

## 9. Team Members & Role Contributions

| Team Member | Assigned Role | Key Contributions |
| :--- | :--- | :--- |
| **Amit Kumar** | **Team Lead** | Led project coordination, configured AWS Lambda (`LinkTerminalAPI1`) with `LabRole`, integrated API Gateway HTTP routes, and conducted final end-to-end validation. |
| **Anurag Anand** | **Database & API Validation** | Designed and configured DynamoDB table `LinkMappings1` (`short_code` partition key), validated persistence operations, and verified the `GET /api/links` directory endpoint. |
| **Pranjal Kumar** | **Frontend & UI Engineering** | Built and deployed the S3 static dashboard (`link-terminal-pranjal-1`), implemented `app.js` API integration, live 4-node request-flow indicator, QR code canvas export, and Light/Dark themes. |
| **Chandan Kumar** | **QA, Boundary & Error Testing** | Executed boundary validation tests (invalid URLs, special characters, duplicate codes, `404` missing codes) and verified CORS and fallback error states. |
| **Shiva Aditya** | **Documentation & Architecture** | Authored system architecture diagrams, operational flowcharts, AWS resource specifications, and deployment verification records. |

---

## 10. Limitations & Future Scope

- **Learner Lab Session Window:** Resources run inside AWS Academy Learner Lab and pause automatically when the 4-hour session expires (persisted DynamoDB and S3 data remain intact and resume on lab restart).
- **HTTP Endpoint:** S3 static website hosting serves over HTTP; future versions will add **Amazon CloudFront** with SSL/TLS for HTTPS and custom domain support.
- **Planned Enhancements:** Direct HTTP `301/302` redirect route, user authentication via **Amazon Cognito**, link expiration using **DynamoDB TTL**, and click-count analytics.
