# User Behavior Tracking and Analytics System

## IEEE Format Technical Report

---

**Abstract** — This paper presents a lightweight, self-hosted User Behavior Tracking and Analytics System providing real-time website analytics including page view tracking, unique visitor identification, user journey visualization via Sankey diagrams, device/browser analysis, and traffic channel classification. Built with Node.js, Express.js, and SQLite, the system offers comprehensive PV/UV metrics with interactive visualizations.

**Keywords**: Web Analytics, User Tracking, Sankey Diagram, Data Visualization, SPA Tracking

---

## I. Introduction

Understanding user behavior is crucial for optimizing web experiences. This project implements a complete self-hosted analytics solution with:
- Real-time traffic monitoring
- Device/browser/OS distribution analysis
- Traffic channel classification (Direct/Search/Social/Referral)
- User flow visualization with configurable depth
- Full SPA (Single Page Application) support

---

## II. System Architecture

### A. Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Client Websites                        │
│   [Analytics SDK] ──── HTTPS ────▶ /collect endpoint    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Analytics Server                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Express.js Backend                  │    │
│  │  /collect  /api/stats  /api/flow  /api/visitors │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │          SQLite Database (sql.js)               │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 Dashboard (Frontend)                     │
│  Stats Cards │ Charts │ Sankey │ Visitors Table         │
└─────────────────────────────────────────────────────────┘
```

### B. Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4.x |
| Database | sql.js (SQLite) |
| Charts | Chart.js 4.x |
| Flow Diagram | ECharts 5.x |

### C. Database Schema

```sql
CREATE TABLE visits (
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
```

---

## III. API Design

### A. Data Collection — GET /collect

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| uid | string | Unique visitor ID |
| url | string | Page path |
| referrer | string | Referrer URL |

**Response:** 1x1 transparent GIF

### B. Statistics — GET /api/stats

**Query Parameters:**
| Param | Values | Description |
|-------|--------|-------------|
| range | today/week/month/all | Date filter |

**Response Structure:**
```json
{
  "pv": 1523, "uv": 342,
  "realtimeUsers": 5,
  "newVisitors": 120, "returningVisitors": 222,
  "deviceStats": { "pv": {...}, "uv": {...} },
  "browserStats": { "pv": {...}, "uv": {...} },
  "channels": { "pv": {...}, "uv": {...} },
  "topPages": { "pv": [...], "uv": [...] },
  "entryPages": [...], "exitPages": [...]
}
```

### C. User Flow — GET /api/flow

| Param | Default | Description |
|-------|---------|-------------|
| maxLayers | 5 | Navigation depth (1-10) |

Returns Sankey diagram nodes and links.

### D. Visitors — GET /api/visitors

Returns recent visitor records with parsed device information.

### E. Clear Data — DELETE /api/clear

Requires `?confirm=yes-delete-all-data` for confirmation.

---

## IV. Frontend Event Tracking

### A. User Identification

```javascript
var uid = localStorage.getItem('_uid') || generateUUID();
localStorage.setItem('_uid', uid);
```

### B. Event Triggers

| Event | Trigger | Captured Data |
|-------|---------|---------------|
| Page View | window.load | URL, referrer, timestamp |
| SPA Route | hashchange | New path, previous path |
| History | pushState/popstate | URL changes |

### C. SPA Support

The SDK intercepts `history.pushState`, `history.replaceState`, and listens for `popstate` and `hashchange` events to track all navigation in Single Page Applications.

### D. Data Transmission

```javascript
fetch(url, { mode: 'no-cors', credentials: 'omit' });
```

Uses `no-cors` mode for cross-origin compatibility.

---

## V. Data Visualization

### A. Key Metrics (6 Cards)

| Metric | Insight |
|--------|---------|
| **PV** | Total content consumption |
| **UV** | Actual audience size |
| **New Visitors** | First-time users |
| **Returning** | Repeat visitors |
| **Depth** | Pages per visit |
| **Bounce Rate** | Single-page exits |

### B. PV/UV Toggle Feature

Device, browser, channel, and page statistics support switching between:
- **PV Mode**: Counts every page view
- **UV Mode**: Counts unique visitors only

### C. Date Range Selector

| Option | Data Shown |
|--------|------------|
| 今日 (Today) | Hourly breakdown |
| 本周 (Week) | Daily trend |
| 本月 (Month) | Daily trend |
| 全部 (All) | All historical data |

### D. Sankey Diagram

Visualizes user navigation paths with:
- Configurable layers (1-8)
- Entry sources: Direct, External, Internal
- Flow width proportional to user count
- Interactive tooltips

**Insights:**
- Identify drop-off points
- Discover popular paths
- Analyze conversion funnels

### E. Traffic Channels

| Channel | Detection |
|---------|-----------|
| Direct | Empty/no referrer |
| Search | Google, Bing, Baidu, etc. |
| Social | Facebook, Twitter, WeChat, etc. |
| Referral | Other external links |

### F. Real-time Indicator

Displays users active in the last 5 minutes.

---

## VI. Deployment

### A. Server Configuration

- **Server:** 110.40.153.38
- **Domain:** mathew-tracker.yunguhs.com
- **Port:** 8811
- **Process Manager:** pm2

### B. Live URLs

| Resource | URL |
|----------|-----|
| Dashboard | https://mathew-tracker.yunguhs.com/dashboard.html |
| GitHub | https://github.com/Mathewmsj/Tracker |

---

## VII. Conclusion

This system provides comprehensive analytics capabilities comparable to commercial solutions:

✅ Real-time traffic monitoring  
✅ Device/browser/OS analysis with PV/UV toggle  
✅ Traffic channel classification  
✅ User flow Sankey visualization  
✅ Full SPA support  
✅ Date range filtering  
✅ Entry/exit page analysis

**Future Enhancements:**
- IP geolocation mapping
- Session replay
- Custom event tracking
- A/B testing integration

---

## References

[1] Express.js, https://expressjs.com/  
[2] Chart.js, https://www.chartjs.org/  
[3] Apache ECharts, https://echarts.apache.org/  
[4] SQL.js, https://sql.js.org/

---

*Author: Sijia Ma (Mathew)*  
*Date: January 22, 2026*
