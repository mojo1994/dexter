# DEXTER Testing Skill

## Environment Setup
- Backend: `cd backend && npm run dev` (port 3001)
- Frontend: `cd frontend && npm run dev` (port 5173)
- Kill existing processes on ports first: `fuser -k 3001/tcp; fuser -k 5173/tcp`
- Database: SQLite at `backend/data/dexter.db` (auto-created on first run)

## Test Accounts
- Register via UI: Name, Email, Password (min 6 chars)
- Previous test account: test@dexter.com / test123456 (persists if DB not reset)
- JWT tokens expire — may need to re-login between sessions

## Feature Testing Flows

### 1. Language Selector (i18n)
- Globe icon in dashboard header, next to user email
- Dropdown shows 5 languages: pt-BR, en-US, es, fr, de (with flag emojis)
- Switching language updates all UI text WITHOUT page reload
- Default language: pt-BR (fallback)
- localStorage key: `dexter_language`
- Backend serves locale files at: GET /locales/{lang}/{namespace}.json
- Namespaces: common, dashboard, clone, editor, settings

### 2. Clone Page with SSE Progress
- "Clone Page" button on dashboard opens modal
- Enter URL and optional project name
- Submit triggers SSE stream via POST /api/clone/stream
- Progress bar shows stages: fetching (10-35%), parsing (40%), downloading (50-80%), building (85-90%), complete (100%)
- 4 stage indicator circles animate through states
- On completion, auto-navigates to editor with cloned content
- Test URL: https://example.com (simple, fast to clone)

### 3. Load Page (ZIP Upload)
- "Load Page" button on dashboard opens LoadPageModal
- Drag-drop zone accepts only .zip files (max 100MB)
- ZIP must contain index.html at root
- File picker filters: *.ZIP, *.zip
- After selecting file: green checkmark, filename, size shown
- Project name auto-fills from ZIP filename
- Upload sends to POST /api/upload (multipart/form-data)
- On success, navigates to editor with uploaded content
- Create test ZIP: `mkdir -p /tmp/test-project && echo '<html>...</html>' > /tmp/test-project/index.html && cd /tmp && zip -r test-project.zip test-project/`

### 4. Editor Custom Blocks
- Left sidebar "COMPONENTS" panel shows blocks in categories:
  - Basic: Link Block, Quote, Text section, CTA Button, Divider, Spacer
  - Media: Video Embed
  - Advanced: Countdown, Testimonial, Pricing Card, FAQ, Social Proof
  - Layout: Hero Section
  - Forms: Contact Form
- Blocks are draggable into the canvas area
- Hero Section renders with gradient background, heading, CTA button

### 5. Media Manager
- Image icon in editor toolbar (second row, after Eye/preview icon)
- Opens modal with "Media" title, upload zone, and asset grid
- Empty state shows "No results found"
- Upload accepts image/* and video/* files
- Assets stored per-project via POST /api/pages/project/{id}/assets

### 6. Agent Fixer
- Background service, scans every 10 minutes (FIXER_SCAN_INTERVAL_MS=600000)
- Health endpoint: GET /api/health (returns agentFixer status with subsystem health)
- Backend logs: `[AgentFixer] Scan complete { duration: ..., issues: N, repairs: N }`
- Socket.IO emits `agent-fixer:heartbeat` events to connected clients
- Frontend DraggableToast appears on heartbeat (auto-dismiss 5s, drag-to-dismiss)
- Idle detection: toast only shows if user is active
- To test toast quickly, reduce FIXER_SCAN_INTERVAL_MS in backend env

## API Endpoints
- Auth: POST /api/auth/register, POST /api/auth/login, GET /api/auth/profile
- Projects: GET /api/projects, POST /api/projects, GET /api/projects/:id, DELETE /api/projects/:id
- Pages: GET /api/pages/:id, PUT /api/pages/:id
- Clone: POST /api/clone, POST /api/clone/stream (SSE)
- Upload: POST /api/upload (multipart, .zip only)
- Export: GET /api/projects/:id/export (ZIP download)
- Locales: GET /locales/:lang/:namespace.json
- Health: GET /api/health

## Common Issues
- Port already in use: `fuser -k 3001/tcp` before starting backend
- JWT expired: Re-login via the UI
- File picker for Load Page: Use Ctrl+L in GTK dialog to type path directly
- Puppeteer needs Chromium: ensure `chromium` is installed (see environment config)
