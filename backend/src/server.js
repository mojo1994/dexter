require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { initializeDatabase } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const AgentFixer = require('./services/agent-fixer');

// Import routes
const authRoutes = require('./routes/auth.routes');
const cloneRoutes = require('./routes/clone.routes');
const projectRoutes = require('./routes/project.routes');
const pageRoutes = require('./routes/page.routes');
const uploadRoutes = require('./routes/upload.routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize database
initializeDatabase();

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(generalLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve locale files
app.use('/locales', express.static(path.join(__dirname, '..', 'locales')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clone', cloneRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/upload', uploadRoutes);

// Locales API endpoint
app.get('/api/locales/:lang/:namespace.json', (req, res) => {
  const { lang, namespace } = req.params;
  const allowedLangs = ['pt-BR', 'en-US', 'es', 'fr', 'de'];
  const allowedNs = ['common', 'editor', 'clone', 'settings', 'dashboard'];

  if (!allowedLangs.includes(lang) || !allowedNs.includes(namespace)) {
    return res.status(404).json({ error: 'Translation not found' });
  }

  const filePath = path.join(__dirname, '..', 'locales', lang, namespace + '.json');
  if (require('fs').existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // Fallback to pt-BR
  const fallbackPath = path.join(__dirname, '..', 'locales', 'pt-BR', namespace + '.json');
  if (require('fs').existsSync(fallbackPath)) {
    return res.sendFile(fallbackPath);
  }

  res.status(404).json({ error: 'Translation not found' });
});

// Agent Fixer status endpoint
app.get('/api/agent-fixer/status', (req, res) => {
  res.json(agentFixer.getStatus());
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    agentFixer: agentFixer.getStatus(),
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start Agent Fixer
const agentFixer = new AgentFixer(io);
agentFixer.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  agentFixer.stop();
  server.close();
});

server.listen(PORT, () => {
  console.log('DEXTER API server running on port ' + PORT);
  console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('Agent Fixer: ' + (process.env.FIXER_ENABLED !== 'false' ? 'enabled' : 'disabled'));
});

module.exports = app;
