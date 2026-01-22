const express = require('express');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8811;
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
// CORS - Allow cross-origin requests
// ============================================
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

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
// Query params: ?range=today|week|month|all|custom&start=DATE&end=DATE
// ============================================
app.get('/api/stats', (req, res) => {
    try {
        const range = req.query.range || 'today';
        let startDate, endDate = new Date().toISOString();

        const now = new Date();
        switch (range) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
                break;
            case 'custom':
                startDate = req.query.start || new Date(now.setDate(now.getDate() - 7)).toISOString();
                endDate = req.query.end || new Date().toISOString();
                break;
            default:
                startDate = '2000-01-01';
        }

        const dateFilter = `timestamp >= '${startDate}' AND timestamp <= '${endDate}'`;

        // Total Page Views (filtered)
        const pvResult = db.exec(`SELECT COUNT(*) FROM visits WHERE ${dateFilter}`);
        const pv = pvResult.length > 0 ? pvResult[0].values[0][0] : 0;

        // Unique Visitors (filtered)
        const uvResult = db.exec(`SELECT COUNT(DISTINCT uid) FROM visits WHERE uid IS NOT NULL AND ${dateFilter}`);
        const uv = uvResult.length > 0 ? uvResult[0].values[0][0] : 0;

        // Real-time active users (last 5 minutes)
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const realtimeResult = db.exec(`SELECT COUNT(DISTINCT uid) FROM visits WHERE timestamp >= '${fiveMinAgo}'`);
        const realtimeUsers = realtimeResult.length > 0 ? realtimeResult[0].values[0][0] : 0;

        // New vs Returning visitors
        const allUidsResult = db.exec(`SELECT uid, MIN(timestamp) as first_visit FROM visits WHERE uid IS NOT NULL GROUP BY uid`);
        let newVisitors = 0, returningVisitors = 0;
        if (allUidsResult.length > 0) {
            allUidsResult[0].values.forEach(row => {
                const firstVisit = new Date(row[1]);
                const start = new Date(startDate);
                if (firstVisit >= start) newVisitors++;
                else returningVisitors++;
            });
        }

        // Last hour traffic by minute
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const trendResult = db.exec(`
          SELECT strftime('%Y-%m-%d %H:%M', timestamp) as minute, COUNT(*) as count
          FROM visits WHERE timestamp >= '${oneHourAgo}'
          GROUP BY minute ORDER BY minute ASC
        `);
        const minuteTrend = trendResult.length > 0
            ? trendResult[0].values.map(row => ({ minute: row[0], count: row[1] })) : [];

        // Hourly/Daily trend based on range
        let hourlyTrend = [];
        if (range === 'today') {
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const hourlyResult = db.exec(`
              SELECT strftime('%H', timestamp) as hour, COUNT(*) as count
              FROM visits WHERE timestamp >= '${todayStart.toISOString()}'
              GROUP BY hour ORDER BY hour ASC
            `);
            hourlyTrend = hourlyResult.length > 0
                ? hourlyResult[0].values.map(row => ({ hour: row[0], count: row[1] })) : [];
        } else {
            // Daily trend for week/month
            const dailyResult = db.exec(`
              SELECT strftime('%m-%d', timestamp) as day, COUNT(*) as count
              FROM visits WHERE ${dateFilter}
              GROUP BY day ORDER BY day ASC
            `);
            hourlyTrend = dailyResult.length > 0
                ? dailyResult[0].values.map(row => ({ hour: row[0], count: row[1] })) : [];
        }

        // Top pages
        const topPagesResult = db.exec(`
          SELECT url, COUNT(*) as count FROM visits
          WHERE url IS NOT NULL AND ${dateFilter}
          GROUP BY url ORDER BY count DESC LIMIT 10
        `);
        const topPages = topPagesResult.length > 0
            ? topPagesResult[0].values.map(row => ({ url: row[0], count: row[1] })) : [];

        // Top referrers
        const topReferrersResult = db.exec(`
          SELECT referrer, COUNT(*) as count FROM visits
          WHERE referrer IS NOT NULL AND referrer != '' AND ${dateFilter}
          GROUP BY referrer ORDER BY count DESC LIMIT 10
        `);
        const topReferrers = topReferrersResult.length > 0
            ? topReferrersResult[0].values.map(row => ({ referrer: row[0], count: row[1] })) : [];

        // Device/Browser stats
        const deviceStats = { desktop: 0, mobile: 0, tablet: 0 };
        const browserStats = {};
        const osStats = {};
        const uaResult = db.exec(`SELECT user_agent FROM visits WHERE user_agent IS NOT NULL AND ${dateFilter}`);
        if (uaResult.length > 0) {
            uaResult[0].values.forEach(row => {
                const ua = row[0] || '';
                // Device
                if (/mobile|android|iphone/i.test(ua) && !/tablet|ipad/i.test(ua)) deviceStats.mobile++;
                else if (/tablet|ipad/i.test(ua)) deviceStats.tablet++;
                else deviceStats.desktop++;
                // Browser
                let browser = 'Other';
                if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
                else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
                else if (/firefox/i.test(ua)) browser = 'Firefox';
                else if (/edge/i.test(ua)) browser = 'Edge';
                browserStats[browser] = (browserStats[browser] || 0) + 1;
                // OS
                let os = 'Other';
                if (/windows/i.test(ua)) os = 'Windows';
                else if (/mac os/i.test(ua)) os = 'macOS';
                else if (/linux/i.test(ua) && !/android/i.test(ua)) os = 'Linux';
                else if (/android/i.test(ua)) os = 'Android';
                else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS';
                osStats[os] = (osStats[os] || 0) + 1;
            });
        }

        // Traffic Channels
        const channels = { direct: 0, search: 0, social: 0, referral: 0 };
        const refResult = db.exec(`SELECT referrer FROM visits WHERE ${dateFilter}`);
        if (refResult.length > 0) {
            refResult[0].values.forEach(row => {
                const ref = (row[0] || '').toLowerCase();
                if (!ref || ref === 'direct') channels.direct++;
                else if (/google|bing|baidu|yahoo|duckduckgo|yandex/.test(ref)) channels.search++;
                else if (/facebook|twitter|instagram|linkedin|tiktok|weibo|wechat/.test(ref)) channels.social++;
                else channels.referral++;
            });
        }

        // Entry pages (first page of each session)
        const entryResult = db.exec(`
          SELECT url, COUNT(*) as count FROM (
            SELECT uid, MIN(timestamp), url FROM visits 
            WHERE uid IS NOT NULL AND url IS NOT NULL AND ${dateFilter}
            GROUP BY uid
          ) GROUP BY url ORDER BY count DESC LIMIT 5
        `);
        const entryPages = entryResult.length > 0
            ? entryResult[0].values.map(row => ({ url: row[0], count: row[1] })) : [];

        // Exit pages (last page of each session)
        const exitResult = db.exec(`
          SELECT url, COUNT(*) as count FROM (
            SELECT uid, MAX(timestamp), url FROM visits 
            WHERE uid IS NOT NULL AND url IS NOT NULL AND ${dateFilter}
            GROUP BY uid
          ) GROUP BY url ORDER BY count DESC LIMIT 5
        `);
        const exitPages = exitResult.length > 0
            ? exitResult[0].values.map(row => ({ url: row[0], count: row[1] })) : [];

        res.json({
            pv, uv, realtimeUsers,
            newVisitors, returningVisitors,
            minuteTrend, hourlyTrend,
            topPages, topReferrers,
            deviceStats, browserStats, osStats,
            channels, entryPages, exitPages,
            dateRange: { start: startDate, end: endDate, range }
        });

    } catch (error) {
        console.error('❌ Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// Visitors API - GET /api/visitors (recent visitors with IP)
// ============================================
app.get('/api/visitors', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);

        const visitorsResult = db.exec(`
          SELECT 
            timestamp,
            ip,
            uid,
            url,
            referrer,
            user_agent
          FROM visits
          ORDER BY timestamp DESC
          LIMIT ${limit}
        `);

        const visitors = visitorsResult.length > 0
            ? visitorsResult[0].values.map(row => ({
                timestamp: row[0],
                ip: row[1],
                uid: row[2],
                url: row[3],
                referrer: row[4],
                userAgent: row[5],
                // Parse device from user agent
                device: parseDevice(row[5])
            }))
            : [];

        // Get unique IPs for geo lookup
        const uniqueIPs = [...new Set(visitors.map(v => v.ip).filter(Boolean))];

        res.json({ visitors, uniqueIPs });

    } catch (error) {
        console.error('❌ Error fetching visitors:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Parse device from user agent
function parseDevice(ua) {
    if (!ua) return { type: 'unknown', browser: 'unknown', os: 'unknown' };

    let type = 'desktop';
    if (/mobile|android|iphone|ipad/i.test(ua)) type = 'mobile';
    if (/tablet|ipad/i.test(ua)) type = 'tablet';

    let browser = 'other';
    if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/edge/i.test(ua)) browser = 'Edge';

    let os = 'other';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ios/i.test(ua)) os = 'iOS';

    return { type, browser, os };
}

// ============================================
// Clear Data API - DELETE /api/clear
// ============================================
app.delete('/api/clear', (req, res) => {
    try {
        const { confirm } = req.query;

        if (confirm !== 'yes-delete-all-data') {
            return res.status(400).json({
                error: 'Missing confirmation',
                message: 'Add ?confirm=yes-delete-all-data to confirm deletion'
            });
        }

        db.run('DELETE FROM visits');
        saveDatabase();

        res.json({
            success: true,
            message: 'All data has been cleared',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error clearing data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// Flow API - GET /api/flow (for Sankey diagram)
// Multi-level flow tracking with configurable layers
// Query params: ?maxLayers=5 (default 5, max 10)
// ============================================
app.get('/api/flow', (req, res) => {
    try {
        const maxLayers = Math.min(Math.max(parseInt(req.query.maxLayers) || 5, 1), 10);

        // Get all visits ordered by user and time to build session flows
        const visitsResult = db.exec(`
          SELECT uid, url, referrer, timestamp
          FROM visits
          WHERE uid IS NOT NULL AND url IS NOT NULL
          ORDER BY uid, timestamp ASC
        `);

        if (visitsResult.length === 0) {
            return res.json({ nodes: [], links: [], maxLayers });
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
                // Respect maxLayers setting
                if (index >= maxLayers) return;

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
            .slice(0, 100) // Limit links
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

        res.json({ nodes, links, maxLayers, totalSessions: Object.keys(userSessions).length });

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
