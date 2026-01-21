const express = require('express');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5055;
const DB_PATH = path.join(__dirname, 'analytics.db');

// ============================================
// Database Setup
// ============================================
let db;

async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new
    try {
        if (fs.existsSync(DB_PATH)) {
            const buffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(buffer);
            console.log('✅ Loaded existing database');
        } else {
            db = new SQL.Database();
            console.log('✅ Created new database');
        }
    } catch (e) {
        db = new SQL.Database();
        console.log('✅ Created new database (fresh start)');
    }

    // Create visits table if not exists
    db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      uid TEXT,
      url TEXT,
      referrer TEXT,
      event_type TEXT DEFAULT 'pageview',
      meta_data TEXT
    )
  `);

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON visits(timestamp)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_uid ON visits(uid)`);

    saveDatabase();
    console.log('✅ Database initialized');
}

function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// Auto-save every 10 seconds
setInterval(saveDatabase, 10000);

// ============================================
// Static Files
// ============================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// 1x1 Transparent GIF
// ============================================
const TRANSPARENT_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

// ============================================
// Collection API - GET /collect
// ============================================
app.get('/collect', (req, res) => {
    try {
        const {
            uid = null,
            url = null,
            referrer = null,
            event_type = 'pageview',
            meta_data = null
        } = req.query;

        // Extract IP (handle proxies)
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.socket?.remoteAddress
            || null;

        // Extract User-Agent
        const user_agent = req.headers['user-agent'] || null;

        // Current timestamp in ISO format
        const timestamp = new Date().toISOString();

        // Insert into database
        db.run(`
      INSERT INTO visits (timestamp, ip, user_agent, uid, url, referrer, event_type, meta_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [timestamp, ip, user_agent, uid, url, referrer, event_type, meta_data]);

        // Return 1x1 transparent GIF
        res.set({
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.send(TRANSPARENT_GIF);

    } catch (error) {
        console.error('❌ Error collecting data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// Stats API - GET /api/stats
// ============================================
app.get('/api/stats', (req, res) => {
    try {
        // Total Page Views
        const pvResult = db.exec('SELECT COUNT(*) as pv FROM visits');
        const pv = pvResult.length > 0 ? pvResult[0].values[0][0] : 0;

        // Unique Visitors (by uid)
        const uvResult = db.exec('SELECT COUNT(DISTINCT uid) as uv FROM visits WHERE uid IS NOT NULL');
        const uv = uvResult.length > 0 ? uvResult[0].values[0][0] : 0;

        // Last hour traffic by minute
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const trendResult = db.exec(`
      SELECT 
        strftime('%Y-%m-%d %H:%M', timestamp) as minute,
        COUNT(*) as count
      FROM visits
      WHERE timestamp >= '${oneHourAgo}'
      GROUP BY minute
      ORDER BY minute ASC
    `);

        const minuteTrend = trendResult.length > 0
            ? trendResult[0].values.map(row => ({ minute: row[0], count: row[1] }))
            : [];

        // Today's traffic by hour
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const hourlyResult = db.exec(`
      SELECT 
        strftime('%H', timestamp) as hour,
        COUNT(*) as count
      FROM visits
      WHERE timestamp >= '${todayStart.toISOString()}'
      GROUP BY hour
      ORDER BY hour ASC
    `);

        const hourlyTrend = hourlyResult.length > 0
            ? hourlyResult[0].values.map(row => ({ hour: row[0], count: row[1] }))
            : [];

        // Top pages
        const topPagesResult = db.exec(`
      SELECT url, COUNT(*) as count
      FROM visits
      WHERE url IS NOT NULL
      GROUP BY url
      ORDER BY count DESC
      LIMIT 10
    `);

        const topPages = topPagesResult.length > 0
            ? topPagesResult[0].values.map(row => ({ url: row[0], count: row[1] }))
            : [];

        // Top referrers
        const topReferrersResult = db.exec(`
      SELECT referrer, COUNT(*) as count
      FROM visits
      WHERE referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer
      ORDER BY count DESC
      LIMIT 10
    `);

        const topReferrers = topReferrersResult.length > 0
            ? topReferrersResult[0].values.map(row => ({ referrer: row[0], count: row[1] }))
            : [];

        res.json({
            pv,
            uv,
            minuteTrend,
            hourlyTrend,
            topPages,
            topReferrers
        });

    } catch (error) {
        console.error('❌ Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// Flow API - GET /api/flow (for Sankey diagram)
// Multi-level flow tracking
// ============================================
app.get('/api/flow', (req, res) => {
    try {
        // Get all visits ordered by user and time to build session flows
        const visitsResult = db.exec(`
          SELECT uid, url, referrer, timestamp
          FROM visits
          WHERE uid IS NOT NULL AND url IS NOT NULL
          ORDER BY uid, timestamp ASC
        `);

        if (visitsResult.length === 0) {
            return res.json({ nodes: [], links: [] });
        }

        // Build user sessions and track page sequences
        const userSessions = {};
        visitsResult[0].values.forEach(row => {
            const [uid, url, referrer] = row;
            if (!userSessions[uid]) {
                userSessions[uid] = [];
            }
            userSessions[uid].push({ url, referrer });
        });

        // Count transitions at each step level
        const transitionCounts = {};

        Object.values(userSessions).forEach(pages => {
            pages.forEach((page, index) => {
                // Limit to first 5 steps to avoid too complex diagram
                if (index >= 5) return;

                let source, target;
                const stepNum = index + 1;

                if (index === 0) {
                    // First page - source is entry point
                    if (!page.referrer || page.referrer === '') {
                        source = '入口';
                    } else if (page.referrer.startsWith('http')) {
                        source = '外部来源';
                    } else {
                        source = '站内跳转';
                    }
                    target = `L1: ${page.url}`;
                } else {
                    // Subsequent pages - create layered nodes
                    source = `L${index}: ${pages[index - 1].url}`;
                    target = `L${stepNum}: ${page.url}`;
                }

                // Skip self-loops
                if (source === target) return;

                const key = `${source}|||${target}`;
                transitionCounts[key] = (transitionCounts[key] || 0) + 1;
            });
        });

        // Build nodes and links
        const nodesSet = new Set();
        const links = [];

        Object.entries(transitionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 80) // Limit links
            .forEach(([key, value]) => {
                const [source, target] = key.split('|||');
                nodesSet.add(source);
                nodesSet.add(target);
                links.push({ source, target, value });
            });

        // Sort nodes by layer for better visualization
        const nodesList = Array.from(nodesSet);
        const getNodeOrder = (name) => {
            if (name === '入口' || name === '外部来源' || name === '站内跳转') return 0;
            const match = name.match(/^L(\d+):/);
            return match ? parseInt(match[1]) : 99;
        };

        nodesList.sort((a, b) => getNodeOrder(a) - getNodeOrder(b));
        const nodes = nodesList.map(name => ({ name }));

        res.json({ nodes, links });

    } catch (error) {
        console.error('❌ Error fetching flow:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// Start Server
// ============================================
initDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
🚀 Analytics Server running at http://0.0.0.0:${PORT}

Endpoints:
  - GET /collect?uid=...&url=...  → Tracking pixel
  - GET /api/stats                → Statistics JSON
  - GET /dashboard.html           → Dashboard UI
    `);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    if (db) {
        saveDatabase();
    }
    process.exit(0);
});
