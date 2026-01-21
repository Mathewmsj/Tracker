/**
 * 高级流量模拟脚本
 * 生成真实的用户行为数据，包含：
 * - 用户漏斗转化路径
 * - 不同时段的访问分布
 * - 跳出用户、深度浏览用户
 * - 真实的来源分布
 */

const http = require('http');

// ============================================
// 配置
// ============================================
const CONFIG = {
    host: 'localhost',
    port: 3000,
    totalUsers: 500,              // 更多用户
    delayBetweenRequests: 30,     // 请求间隔
    batchSize: 20                 // 并发批次大小
};

// ============================================
// 用户行为类型分布
// ============================================
const USER_TYPES = {
    // 跳出用户 - 只看1页就走 (40%)
    bouncer: { weight: 40, minPages: 1, maxPages: 1 },
    // 浏览用户 - 看2-3页 (30%)
    browser: { weight: 30, minPages: 2, maxPages: 3 },
    // 深度用户 - 看4-8页 (20%)
    engaged: { weight: 20, minPages: 4, maxPages: 8 },
    // 转化用户 - 完整漏斗 (10%)
    converter: { weight: 10, minPages: 5, maxPages: 12 }
};

// ============================================
// 页面结构 - 模拟真实网站
// ============================================
const SITE_STRUCTURE = {
    landing: ['/', '/home'],
    products: ['/products', '/products/item-1', '/products/item-2', '/products/item-3'],
    docs: ['/docs', '/docs/getting-started', '/docs/api-reference', '/docs/tutorial'],
    blog: ['/blog', '/blog/post-1', '/blog/post-2', '/blog/news'],
    conversion: ['/pricing', '/signup', '/login', '/checkout', '/thank-you'],
    other: ['/about', '/contact', '/profile', '/settings', '/dashboard']
};

// 页面流转概率 - 模拟真实用户行为
const PAGE_FLOWS = {
    '/': { next: ['/products', '/docs', '/blog', '/about', '/pricing'], weights: [35, 25, 20, 10, 10] },
    '/home': { next: ['/products', '/docs', '/about', '/pricing'], weights: [40, 30, 15, 15] },
    '/products': { next: ['/products/item-1', '/products/item-2', '/pricing', '/docs'], weights: [35, 30, 25, 10] },
    '/products/item-1': { next: ['/products/item-2', '/pricing', '/checkout', '/products'], weights: [30, 35, 20, 15] },
    '/products/item-2': { next: ['/products/item-3', '/pricing', '/checkout', '/products'], weights: [25, 35, 25, 15] },
    '/products/item-3': { next: ['/pricing', '/checkout', '/products'], weights: [40, 35, 25] },
    '/pricing': { next: ['/signup', '/checkout', '/products', '/contact'], weights: [35, 30, 20, 15] },
    '/signup': { next: ['/checkout', '/dashboard', '/'], weights: [50, 40, 10] },
    '/checkout': { next: ['/thank-you', '/products', '/'], weights: [70, 20, 10] },
    '/thank-you': { next: ['/dashboard', '/products', '/blog'], weights: [50, 30, 20] },
    '/docs': { next: ['/docs/getting-started', '/docs/api-reference', '/products'], weights: [50, 35, 15] },
    '/docs/getting-started': { next: ['/docs/api-reference', '/docs/tutorial', '/products'], weights: [45, 35, 20] },
    '/docs/api-reference': { next: ['/docs/tutorial', '/products', '/pricing'], weights: [40, 35, 25] },
    '/docs/tutorial': { next: ['/products', '/pricing', '/signup'], weights: [40, 35, 25] },
    '/blog': { next: ['/blog/post-1', '/blog/post-2', '/products'], weights: [40, 35, 25] },
    '/blog/post-1': { next: ['/blog/post-2', '/products', '/signup'], weights: [40, 35, 25] },
    '/blog/post-2': { next: ['/blog/news', '/products', '/pricing'], weights: [35, 40, 25] },
    '/about': { next: ['/contact', '/products', '/pricing'], weights: [40, 35, 25] },
    '/contact': { next: ['/products', '/', '/about'], weights: [50, 30, 20] }
};

// 外部来源分布 - 模拟真实流量来源
const TRAFFIC_SOURCES = [
    { source: 'https://google.com/search?q=analytics+tool', weight: 35 },
    { source: 'https://google.com/search?q=website+tracking', weight: 15 },
    { source: '', weight: 15 },  // 直接访问
    { source: 'https://github.com/analytics', weight: 8 },
    { source: 'https://twitter.com/ref/analytics', weight: 7 },
    { source: 'https://linkedin.com/posts/tech', weight: 6 },
    { source: 'https://reddit.com/r/webdev', weight: 5 },
    { source: 'https://facebook.com/ads', weight: 4 },
    { source: 'https://producthunt.com/products/analytics', weight: 3 },
    { source: 'https://bing.com/search', weight: 2 }
];

// 着陆页分布
const LANDING_PAGES = [
    { page: '/', weight: 30 },
    { page: '/home', weight: 15 },
    { page: '/products', weight: 20 },
    { page: '/docs/getting-started', weight: 15 },
    { page: '/blog/post-1', weight: 8 },
    { page: '/pricing', weight: 7 },
    { page: '/about', weight: 5 }
];

// User Agents - 真实设备分布
const USER_AGENTS = [
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', weight: 35 },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', weight: 20 },
    { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', weight: 20 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', weight: 8 },
    { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36', weight: 7 },
    { ua: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', weight: 5 },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/17.2', weight: 5 }
];

// ============================================
// 工具函数
// ============================================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function weightedPick(items) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;
    for (const item of items) {
        random -= (item.weight || 1);
        if (random <= 0) return item;
    }
    return items[items.length - 1];
}

function pickUserType() {
    const types = Object.entries(USER_TYPES).map(([name, config]) => ({
        name,
        ...config
    }));
    return weightedPick(types);
}

function getNextPage(currentPage) {
    const flow = PAGE_FLOWS[currentPage];
    if (!flow) {
        // 默认返回随机页面
        const allPages = Object.values(SITE_STRUCTURE).flat();
        return allPages[Math.floor(Math.random() * allPages.length)];
    }

    const options = flow.next.map((page, i) => ({
        page,
        weight: flow.weights[i]
    }));
    return weightedPick(options).page;
}

function randomIP() {
    // 生成更真实的IP分布（部分来自同一子网）
    const subnets = ['192.168.1', '10.0.0', '172.16.0', '203.45.67', '156.78.90', '89.123.45'];
    if (Math.random() > 0.7) {
        // 30% 来自相同子网
        const subnet = subnets[Math.floor(Math.random() * subnets.length)];
        return `${subnet}.${Math.floor(Math.random() * 256)}`;
    }
    return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

// ============================================
// HTTP 请求发送
// ============================================
function sendRequest(params, userAgent, fakeIP) {
    return new Promise((resolve, reject) => {
        const queryString = new URLSearchParams(params).toString();
        const options = {
            hostname: CONFIG.host,
            port: CONFIG.port,
            path: `/collect?${queryString}`,
            method: 'GET',
            headers: {
                'User-Agent': userAgent,
                'X-Forwarded-For': fakeIP
            }
        };

        const req = http.request(options, (res) => {
            res.on('data', () => { });
            res.on('end', () => resolve(res.statusCode));
        });

        req.on('error', (e) => reject(e));
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 模拟单个用户会话
// ============================================
async function simulateUser(userId) {
    const uid = generateUUID();
    const userType = pickUserType();
    const userAgent = weightedPick(USER_AGENTS).ua;
    const ip = randomIP();

    // 确定页面数量
    const numPages = userType.minPages +
        Math.floor(Math.random() * (userType.maxPages - userType.minPages + 1));

    // 选择着陆页和来源
    const landing = weightedPick(LANDING_PAGES);
    const source = weightedPick(TRAFFIC_SOURCES);

    let currentPage = landing.page;
    let referrer = source.source;
    let requestCount = 0;

    for (let i = 0; i < numPages; i++) {
        const resolution = ['1920x1080', '1366x768', '390x844', '414x896'][Math.floor(Math.random() * 4)];

        const meta = JSON.stringify({
            resolution,
            language: ['zh-CN', 'en-US', 'ja-JP'][Math.floor(Math.random() * 3)],
            timezone: 'Asia/Shanghai',
            user_type: userType.name,
            session_step: i + 1
        });

        const params = {
            uid,
            url: currentPage,
            referrer: i === 0 ? referrer : currentPage,
            event_type: 'pageview',
            meta_data: meta
        };

        try {
            await sendRequest(params, userAgent, ip);
            requestCount++;

            // 获取下一个页面
            const prevPage = currentPage;
            currentPage = getNextPage(currentPage);
            referrer = prevPage;

        } catch (error) {
            return { userId, success: false, requests: requestCount, userType: userType.name };
        }

        // 模拟用户阅读时间
        await sleep(CONFIG.delayBetweenRequests + Math.random() * 50);
    }

    return { userId, success: true, requests: requestCount, userType: userType.name };
}

// ============================================
// 主程序
// ============================================
async function runSimulation() {
    console.log(`
╔════════════════════════════════════════════════════╗
║       🎯 高级流量模拟器 - 真实用户行为模式          ║
╠════════════════════════════════════════════════════╣
║  目标服务器: http://${CONFIG.host}:${CONFIG.port}/collect
║  模拟用户数: ${CONFIG.totalUsers}
║  用户类型分布:
║    - 跳出用户 (1页):     40%
║    - 浏览用户 (2-3页):   30%
║    - 深度用户 (4-8页):   20%
║    - 转化用户 (5-12页):  10%
╚════════════════════════════════════════════════════╝
`);

    const startTime = Date.now();
    let totalRequests = 0;
    let successfulUsers = 0;
    const userTypeStats = { bouncer: 0, browser: 0, engaged: 0, converter: 0 };

    for (let i = 0; i < CONFIG.totalUsers; i += CONFIG.batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + CONFIG.batchSize, CONFIG.totalUsers); j++) {
            batch.push(simulateUser(j + 1));
        }

        const results = await Promise.all(batch);

        for (const result of results) {
            if (result.success) {
                successfulUsers++;
                totalRequests += result.requests;
                userTypeStats[result.userType]++;
            }
        }

        const progress = Math.min(i + CONFIG.batchSize, CONFIG.totalUsers);
        const percent = Math.round((progress / CONFIG.totalUsers) * 100);
        process.stdout.write(`\r⏳ 进度: ${progress}/${CONFIG.totalUsers} 用户 (${percent}%)`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n
╔════════════════════════════════════════════════════╗
║              ✅ 模拟完成！                         ║
╠════════════════════════════════════════════════════╣
║  耗时:         ${duration}s
║  成功用户:     ${successfulUsers}/${CONFIG.totalUsers}
║  总请求数:     ${totalRequests}
║  平均RPS:      ${(totalRequests / duration).toFixed(2)}
╠════════════════════════════════════════════════════╣
║  用户类型统计:
║    跳出用户:   ${userTypeStats.bouncer} (${(userTypeStats.bouncer / successfulUsers * 100).toFixed(1)}%)
║    浏览用户:   ${userTypeStats.browser} (${(userTypeStats.browser / successfulUsers * 100).toFixed(1)}%)
║    深度用户:   ${userTypeStats.engaged} (${(userTypeStats.engaged / successfulUsers * 100).toFixed(1)}%)
║    转化用户:   ${userTypeStats.converter} (${(userTypeStats.converter / successfulUsers * 100).toFixed(1)}%)
╚════════════════════════════════════════════════════╝

📊 查看仪表盘: http://localhost:${CONFIG.port}/dashboard.html
📈 API接口:    http://localhost:${CONFIG.port}/api/stats
🌊 流量图:     http://localhost:${CONFIG.port}/api/flow
`);
}

runSimulation().catch(console.error);
