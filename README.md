# DEXTER

A SaaS platform for cloning and editing sales pages (TSL/VSL) with an integrated visual editor.

## Features

- **Page Cloning** - Clone any web page by URL with full asset extraction (images, CSS, JS, fonts)
- **Visual Editor** - Drag-and-drop page editor powered by GrapeJS with real-time preview
- **Responsive Design** - Edit and preview pages across desktop, tablet, and mobile
- **Version History** - Save and restore page versions
- **Export** - Download pages as ZIP files
- **Authentication** - JWT-based user authentication
- **Auto-save** - Automatic saving every 30 seconds

## Tech Stack

### Backend
- Node.js + Express.js
- Puppeteer (headless page cloning)
- Cheerio (HTML parsing)
- SQLite (via better-sqlite3)
- Bull + Redis (job queue, optional)
- JWT authentication

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS
- GrapeJS (visual editor)
- Zustand (state management)
- React Query
- React Router

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/mojo1994/dexter.git
cd dexter
```

2. **Backend Setup**
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
The API will start on `http://localhost:3001`.

3. **Frontend Setup**
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
The app will open on `http://localhost:5173`.

### Docker Setup

```bash
docker-compose up --build
```

This starts:
- Backend API on port 3001
- Frontend on port 80
- Redis on port 6379

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get profile
- `PUT /api/auth/profile` - Update profile

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/:id/export` - Export as ZIP

### Cloning
- `POST /api/clone` - Clone a page by URL
- `GET /api/clone/status/:projectId` - Check clone status

### Pages
- `GET /api/pages/:id` - Get page
- `PUT /api/pages/:id` - Update page
- `DELETE /api/pages/:id` - Delete page
- `POST /api/pages/project/:projectId` - Create page
- `POST /api/pages/:id/versions` - Save version
- `GET /api/pages/:id/versions` - List versions
- `POST /api/pages/:id/versions/restore` - Restore version

### Assets
- `POST /api/pages/project/:projectId/assets` - Upload asset
- `GET /api/pages/project/:projectId/assets` - List assets

## Environment Variables

### Backend (.env)
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | API server port |
| NODE_ENV | development | Environment |
| JWT_SECRET | - | JWT signing secret |
| JWT_EXPIRES_IN | 7d | Token expiration |
| REDIS_HOST | localhost | Redis host (optional) |
| REDIS_PORT | 6379 | Redis port |
| FRONTEND_URL | http://localhost:5173 | CORS origin |

### Frontend (.env)
| Variable | Default | Description |
|----------|---------|-------------|
| VITE_API_URL | http://localhost:3001/api | Backend API URL |

## Project Structure

```
dexter/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, Redis, Queue config
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/       # Auth, rate limiting, error handling
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic (cloner, page, asset)
│   │   ├── utils/           # Helper functions
│   │   └── server.js        # Express app entry point
│   ├── uploads/             # Uploaded/cloned assets
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Login, Register, Dashboard, Editor
│   │   ├── services/        # API client
│   │   ├── store/           # Zustand stores
│   │   ├── App.tsx          # Router setup
│   │   └── main.tsx         # Entry point
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── nginx.conf
└── README.md
```

## Design

- **Colors**: Blue (#2563EB), Green (#10B981), Dark (#1F2937)
- **Font**: Inter
- **Style**: Minimal, professional, clean UI

## License

MIT
