# User Behavior Tracking and Analytics System
## IEEE Format Technical Report

---

### Abstract

This paper presents the design and implementation of a lightweight, self-hosted User Behavior Tracking and Analytics System. The system provides real-time website analytics capabilities including page view tracking, unique visitor identification, user journey visualization, and comprehensive traffic analysis. Built using Node.js, Express.js, and SQLite, the system offers a modern dashboard with interactive visualizations including Sankey diagrams for user flow analysis. The solution demonstrates a complete end-to-end implementation from frontend event instrumentation to backend data processing and visualization.

**Keywords**: Web Analytics, User Behavior Tracking, Event Instrumentation, Data Visualization, Sankey Diagram

---

## I. Introduction

Understanding user behavior on websites is crucial for improving user experience and business outcomes. Commercial analytics solutions like Google Analytics, while powerful, raise privacy concerns and may not meet specific customization needs. This project implements a self-hosted analytics system that provides essential tracking capabilities while maintaining full data ownership.

The system addresses the following objectives:
- Track page views and unique visitors across websites
- Capture user navigation patterns and session flows
- Provide real-time visualization of traffic data
- Support Single Page Application (SPA) tracking
- Enable cross-origin tracking for external website integration

---

## II. System Architecture

### A. Overall Architecture

The system follows a classic three-tier architecture consisting of:

1. **Data Collection Layer**: JavaScript SDK embedded in client websites
2. **Backend Processing Layer**: Node.js/Express.js server handling data ingestion and API requests
3. **Data Storage Layer**: SQLite database for persistent storage
4. **Presentation Layer**: Web-based dashboard with interactive visualizations

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Websites                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Website A  │  │  Website B  │  │  Website C  │              │
│  │ (analytics  │  │ (analytics  │  │ (analytics  │              │
│  │   SDK)      │  │   SDK)      │  │   SDK)      │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          │    HTTPS/HTTP Requests          │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Analytics Server                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Express.js Backend                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │    │
│  │  │ /collect │  │/api/stats│  │/api/flow │  │/api/clear│ │    │
│  │  │  (Track) │  │ (Stats)  │  │ (Sankey) │  │ (Admin)  │ │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │    │
│  └───────┼─────────────┼─────────────┼─────────────┼───────┘    │
│          │             │             │             │            │
│          ▼             ▼             ▼             ▼            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 SQLite Database (sql.js)                │    │
│  │              visits table: timestamp, ip,               │    │
│  │           user_agent, uid, url, referrer, ...           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Dashboard (Frontend)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Stats   │  │  Charts  │  │  Sankey  │  │ Visitors │        │
│  │  Cards   │  │ (Chart.js)│  │ (ECharts)│  │  Table   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### B. Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend Runtime | Node.js 18+ | JavaScript server environment |
| Web Framework | Express.js 4.x | HTTP request handling, routing |
| Database | sql.js (SQLite) | In-memory database with file persistence |
| Frontend Charts | Chart.js 4.x | Line and bar chart visualizations |
| Sankey Diagram | ECharts 5.x | User flow visualization |
| Styling | CSS3 | Modern glassmorphism design |

### C. Database Schema

The system uses a single `visits` table to store all tracking events:

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

**Field Descriptions:**
- `timestamp`: ISO 8601 formatted datetime of the event
- `ip`: Client IP address (supports proxy headers)
- `user_agent`: Browser user agent string
- `uid`: Unique visitor identifier (UUID v4, stored in localStorage)
- `url`: Page path being visited
- `referrer`: Previous page or external referrer
- `event_type`: Type of event (default: pageview)
- `meta_data`: JSON string containing additional metadata

---

## III. API Design

### A. Data Collection Endpoint

**GET /collect**

Receives tracking data from client websites and returns a 1x1 transparent GIF pixel.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| uid | string | Yes | Unique visitor identifier |
| url | string | Yes | Current page path |
| referrer | string | No | Referrer URL |
| event_type | string | No | Event type (default: pageview) |
| meta_data | string | No | JSON metadata |

**Response**: 1x1 transparent GIF (Content-Type: image/gif)

**Example Request**:
```
GET /collect?uid=abc-123&url=/products&referrer=https://google.com
```

### B. Statistics Endpoint

**GET /api/stats**

Returns aggregated analytics data for dashboard display.

**Response Format**:
```json
{
    "pv": 1523,
    "uv": 342,
    "minuteTrend": [
        {"minute": "2026-01-22 09:01", "count": 5},
        {"minute": "2026-01-22 09:02", "count": 8}
    ],
    "hourlyTrend": [
        {"hour": "09", "count": 45},
        {"hour": "10", "count": 62}
    ],
    "topPages": [
        {"url": "/products", "count": 234},
        {"url": "/", "count": 189}
    ],
    "topReferrers": [
        {"referrer": "https://google.com", "count": 89},
        {"referrer": "direct", "count": 156}
    ]
}
```

### C. Flow Visualization Endpoint

**GET /api/flow**

Returns user navigation flow data for Sankey diagram visualization.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| maxLayers | integer | 5 | Maximum depth of navigation layers (1-10) |

**Response Format**:
```json
{
    "nodes": [
        {"name": "入口"},
        {"name": "外部来源"},
        {"name": "L1: /"},
        {"name": "L2: /products"}
    ],
    "links": [
        {"source": "入口", "target": "L1: /", "value": 45},
        {"source": "L1: /", "target": "L2: /products", "value": 23}
    ],
    "maxLayers": 5,
    "totalSessions": 156
}
```

### D. Visitors Endpoint

**GET /api/visitors**

Returns recent visitor records with device information.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | integer | 50 | Number of records (max 100) |

**Response Format**:
```json
{
    "visitors": [
        {
            "timestamp": "2026-01-22T09:15:30.000Z",
            "ip": "218.108.205.132",
            "uid": "abc-def-123",
            "url": "/products",
            "referrer": "https://google.com",
            "userAgent": "Mozilla/5.0...",
            "device": {
                "type": "desktop",
                "browser": "Chrome",
                "os": "Windows"
            }
        }
    ],
    "uniqueIPs": ["218.108.205.132", "123.45.67.89"]
}
```

### E. Data Clear Endpoint

**DELETE /api/clear**

Clears all tracking data from the database. Requires confirmation parameter.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| confirm | string | Yes | Must be "yes-delete-all-data" |

**Response Format**:
```json
{
    "success": true,
    "message": "All data has been cleared",
    "timestamp": "2026-01-22T09:30:00.000Z"
}
```

---

## IV. Frontend Event Tracking Method

### A. Tracking SDK Overview

The analytics SDK is a lightweight JavaScript snippet (~2KB) that automatically captures user behavior without requiring manual instrumentation.

### B. User Identification

Each visitor is assigned a unique identifier (UUID v4) stored in localStorage:

```javascript
var uid = localStorage.getItem('_uid') || (function() {
    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem('_uid', id);
    return id;
})();
```

This approach ensures:
- Persistent identification across sessions
- No cookies required (privacy-friendly)
- Automatic regeneration if storage is cleared

### C. Event Triggering Logic

The SDK tracks the following events automatically:

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| Page View | Page load complete | URL, referrer, timestamp |
| SPA Navigation | Hash change | New path, previous path |
| History Navigation | pushState/replaceState | New URL, previous URL |
| Back/Forward | popstate event | Current URL |

### D. SPA (Single Page Application) Support

Modern SPAs don't trigger full page reloads. The SDK intercepts routing events:

```javascript
// Hash change detection (Vue Router hash mode)
window.addEventListener('hashchange', function() {
    track(lastPath);
});

// History API interception
var origPush = history.pushState;
history.pushState = function() {
    origPush.apply(this, arguments);
    setTimeout(function() { track(lastPath); }, 0);
};

window.addEventListener('popstate', function() {
    track(lastPath);
});
```

### E. Data Transmission

Events are sent using the Fetch API with `no-cors` mode to support cross-origin tracking:

```javascript
fetch(url, {
    mode: 'no-cors',
    credentials: 'omit'
}).then(function() {
    console.log('📊 Tracked:', currentPath);
});
```

This method:
- Avoids CORS preflight requests
- Works across different domains
- Supports HTTPS to HTTP communication

---

## V. Data Visualization and Interpretation

### A. Dashboard Overview

The analytics dashboard provides a comprehensive view of website traffic through multiple visualization components.

### B. Key Metrics Cards

Four primary metrics are displayed prominently:

| Metric | Calculation | Insight |
|--------|-------------|---------|
| **Page Views (PV)** | COUNT(*) from visits | Total content consumption |
| **Unique Visitors (UV)** | COUNT(DISTINCT uid) | Actual audience size |
| **Visit Depth** | PV / UV | Content engagement level |
| **Bounce Rate** | Estimated from depth | Single-page visit percentage |

**Interpretation**: A high PV with low UV indicates returning visitors. High visit depth (>3) suggests engaging content. High bounce rate (>60%) may indicate content-audience mismatch.

### C. Traffic Trend Visualizations

#### Real-time Trend (Line Chart)
- **Data**: Page views per minute for the last hour
- **Purpose**: Identify traffic spikes and patterns
- **Insight**: Sudden spikes may indicate viral content or marketing campaign effects

#### Hourly Distribution (Bar Chart)
- **Data**: Page views aggregated by hour
- **Purpose**: Understand peak traffic times
- **Insight**: Helps optimize server resources and content publishing schedules

### D. Sankey Diagram (User Flow)

The Sankey diagram visualizes user navigation patterns across multiple layers:

**Components**:
- **Entry Nodes**: "入口" (direct), "外部来源" (external referrer)
- **Layer Nodes**: L1, L2, L3... representing navigation depth
- **Flow Width**: Proportional to number of users taking that path

**Layer Control**: Users can adjust visible layers (1-8) using interactive buttons.

**Insights from Sankey**:
1. **Drop-off Points**: Where flow narrows significantly indicates high exit pages
2. **Popular Paths**: Thick connections show common user journeys
3. **Conversion Funnels**: Track progression from landing → product → checkout
4. **Navigation Patterns**: Identify unexpected navigation behaviors

### E. Visitors Table

Displays detailed information for recent visitors:

| Column | Data | Purpose |
|--------|------|---------|
| Time | Visit timestamp | Activity timeline |
| IP | Client IP address | Geographic analysis potential |
| Page | Visited URL | Content popularity |
| Device | Browser/OS parsed from UA | Platform optimization |
| Source | Referrer domain | Traffic source analysis |

### F. Top Pages and Referrers

Ranked tables showing:
- **Top Pages**: Most visited URLs - identifies popular content
- **Top Referrers**: Traffic sources - shows marketing channel effectiveness

---

## VI. Deployment

### A. Server Configuration

The system is deployed on server `110.40.153.38` with the following configuration:

- **Domain**: mathew-tracker.yunguhs.com
- **Port**: 8811
- **Process Manager**: nohup for background execution
- **Reverse Proxy**: Nginx (configured by server administrator)

### B. Deployment Steps

```bash
# Clone repository
git clone https://github.com/Mathewmsj/Tracker.git

# Install dependencies
cd Tracker && npm install

# Start server in background
nohup node server.js > server.log 2>&1 &
```

### C. Live URLs

- **Dashboard**: https://mathew-tracker.yunguhs.com/dashboard.html
- **API Stats**: https://mathew-tracker.yunguhs.com/api/stats
- **GitHub Repository**: https://github.com/Mathewmsj/Tracker

---

## VII. Conclusion

This project successfully implements a complete User Behavior Tracking and Analytics System that meets all specified requirements:

1. **Complete Source Code**: Available on GitHub with clear structure and meaningful commits
2. **Production Deployment**: Accessible and functional on the designated server
3. **Core Features**: Page view tracking, unique visitor identification, user flow analysis
4. **Advanced Features**: SPA support, real-time updates, interactive Sankey diagram with layer controls

The system demonstrates practical application of web development technologies including Node.js, Express.js, SQLite, Chart.js, and ECharts. The modular architecture allows for easy extension and customization.

**Future Improvements**:
- IP-based geolocation with map visualization
- Event-based tracking (clicks, form submissions)
- A/B testing integration
- Data export functionality
- User session replay

---

## References

[1] Express.js Documentation, https://expressjs.com/

[2] Chart.js Documentation, https://www.chartjs.org/docs/

[3] Apache ECharts Documentation, https://echarts.apache.org/en/index.html

[4] SQL.js Project, https://sql.js.org/

[5] MDN Web Docs - History API, https://developer.mozilla.org/en-US/docs/Web/API/History_API

---

*Report prepared by: Mathew (Sijia Ma)*
*Date: January 22, 2026*
*Course: Final Project - User Behavior Tracking*
