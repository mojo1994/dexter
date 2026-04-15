const fs = require('fs');
const path = require('path');

const SCAN_INTERVAL = parseInt(process.env.FIXER_SCAN_INTERVAL_MS, 10) || 600000; // 10 minutes
const LOG_FILE = process.env.FIXER_LOG_FILE || '/var/log/agent-fixer.log';
const ALERT_WEBHOOK = process.env.FIXER_ALERT_WEBHOOK || '';
const LOG_LEVEL = process.env.FIXER_LOG_LEVEL || 'info';
const ENABLED = process.env.FIXER_ENABLED !== 'false';

class AgentFixer {
  constructor(io) {
    this.io = io; // Socket.IO instance
    this.timer = null;
    this.isRunning = false;
    this.lastScan = null;
    this.healthStatus = {
      database: 'ok',
      storage: 'ok',
      puppeteer: 'ok',
      memory: 'ok',
      disk: 'ok',
    };
  }

  start() {
    if (!ENABLED) {
      this.log('info', 'Agent Fixer is disabled');
      return;
    }

    this.log('info', 'Agent Fixer started', { interval: SCAN_INTERVAL });

    // Run initial scan after 30 seconds
    setTimeout(() => this.runScan(), 30000);

    // Schedule recurring scans
    this.timer = setInterval(() => this.runScan(), SCAN_INTERVAL);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.log('info', 'Agent Fixer stopped');
  }

  async runScan() {
    if (this.isRunning) {
      this.log('warn', 'Scan already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const issues = [];
    const repairs = [];

    try {
      // 1. Check database connectivity
      try {
        const { db } = require('../config/database');
        db.prepare('SELECT 1').get();
        this.healthStatus.database = 'ok';
      } catch (err) {
        this.healthStatus.database = 'error';
        issues.push({ component: 'database', error: err.message });
        // Attempt reconnect
        try {
          const { initializeDatabase } = require('../config/database');
          initializeDatabase();
          repairs.push({ component: 'database', action: 'reconnected' });
          this.healthStatus.database = 'repaired';
        } catch (repairErr) {
          this.log('error', 'Database repair failed', { error: repairErr.message });
          await this.sendAlert('Database connection failed and could not be repaired');
        }
      }

      // 2. Check memory usage
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      if (heapUsedMB > 500) {
        this.healthStatus.memory = 'warning';
        issues.push({ component: 'memory', used: heapUsedMB + 'MB', total: heapTotalMB + 'MB' });
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          repairs.push({ component: 'memory', action: 'garbage_collection' });
        }
      } else {
        this.healthStatus.memory = 'ok';
      }

      // 3. Check disk space (uploads directory)
      try {
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
        if (fs.existsSync(uploadsDir)) {
          const stats = this.getDirSize(uploadsDir);
          const sizeMB = Math.round(stats / 1024 / 1024);
          if (sizeMB > 5000) { // 5GB threshold
            this.healthStatus.disk = 'warning';
            issues.push({ component: 'disk', uploadsSize: sizeMB + 'MB' });
            // Clean up temp files
            const tempDir = path.join(uploadsDir, 'temp');
            if (fs.existsSync(tempDir)) {
              const tempFiles = fs.readdirSync(tempDir);
              let cleaned = 0;
              for (const file of tempFiles) {
                const filePath = path.join(tempDir, file);
                const stat = fs.statSync(filePath);
                // Remove temp files older than 1 hour
                if (Date.now() - stat.mtimeMs > 3600000) {
                  fs.unlinkSync(filePath);
                  cleaned++;
                }
              }
              if (cleaned > 0) {
                repairs.push({ component: 'disk', action: 'cleaned_temp_files', count: cleaned });
              }
            }
          } else {
            this.healthStatus.disk = 'ok';
          }
        }
      } catch (err) {
        this.log('warn', 'Disk check failed', { error: err.message });
      }

      // 4. Check for failed/stuck projects
      try {
        const { db } = require('../config/database');
        // Find projects stuck in "cloning" status for more than 10 minutes
        const stuckProjects = db.prepare(
          "SELECT id FROM projects WHERE status = 'cloning' AND updated_at < datetime('now', '-10 minutes')"
        ).all();

        if (stuckProjects.length > 0) {
          for (const project of stuckProjects) {
            db.prepare("UPDATE projects SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(project.id);
            repairs.push({ component: 'projects', action: 'marked_failed', projectId: project.id });
          }
          issues.push({ component: 'projects', stuckCount: stuckProjects.length });
        }
      } catch (err) {
        this.log('warn', 'Project cleanup check failed', { error: err.message });
      }

      // 5. Check Puppeteer browser health
      try {
        const clonerService = require('./cloner.service');
        if (clonerService.browser && !clonerService.browser.isConnected()) {
          this.healthStatus.puppeteer = 'error';
          issues.push({ component: 'puppeteer', error: 'Browser disconnected' });
          clonerService.browser = null;
          repairs.push({ component: 'puppeteer', action: 'cleared_stale_browser' });
          this.healthStatus.puppeteer = 'repaired';
        } else {
          this.healthStatus.puppeteer = 'ok';
        }
      } catch (err) {
        this.log('warn', 'Puppeteer check failed', { error: err.message });
      }

      const duration = Date.now() - startTime;
      this.lastScan = {
        timestamp: new Date().toISOString(),
        duration: duration + 'ms',
        issues: issues.length,
        repairs: repairs.length,
        health: { ...this.healthStatus },
      };

      this.log('info', 'Scan complete', {
        duration: duration + 'ms',
        issues: issues.length,
        repairs: repairs.length,
      });

      // Emit heartbeat to connected clients
      if (this.io) {
        this.io.emit('agent-fixer:heartbeat', {
          status: issues.length === 0 ? 'healthy' : 'repaired',
          message: issues.length === 0
            ? 'System health check completed. All systems operational.'
            : 'System health check completed. ' + repairs.length + ' issue(s) auto-repaired.',
          timestamp: new Date().toISOString(),
          health: this.healthStatus,
        });
      }

    } catch (err) {
      this.log('error', 'Scan failed', { error: err.message });
    } finally {
      this.isRunning = false;
    }
  }

  getDirSize(dirPath) {
    let totalSize = 0;
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          totalSize += this.getDirSize(filePath);
        } else {
          totalSize += stat.size;
        }
      }
    } catch {}
    return totalSize;
  }

  async sendAlert(message) {
    if (!ALERT_WEBHOOK) return;
    try {
      const https = require('https');
      const http = require('http');
      const url = new URL(ALERT_WEBHOOK);
      const client = url.protocol === 'https:' ? https : http;
      const data = JSON.stringify({
        service: 'DEXTER Agent Fixer',
        severity: 'critical',
        message,
        timestamp: new Date().toISOString(),
        health: this.healthStatus,
      });

      const req = client.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      });
      req.write(data);
      req.end();
    } catch (err) {
      this.log('error', 'Failed to send alert', { error: err.message });
    }
  }

  log(level, message, meta) {
    const levels = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) < levels.indexOf(LOG_LEVEL)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'agent-fixer',
      message,
      ...meta,
    };

    const line = JSON.stringify(entry) + '\n';

    // Write to log file
    try {
      const logDir = path.dirname(LOG_FILE);
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(LOG_FILE, line);
    } catch {
      // Fallback to console
    }

    // Also log to console
    if (level === 'error') console.error('[AgentFixer]', message, meta || '');
    else if (level === 'warn') console.warn('[AgentFixer]', message, meta || '');
    else console.log('[AgentFixer]', message, meta || '');
  }

  getStatus() {
    return {
      enabled: ENABLED,
      running: this.isRunning,
      lastScan: this.lastScan,
      health: this.healthStatus,
      scanInterval: SCAN_INTERVAL,
    };
  }
}

module.exports = AgentFixer;
