/**
 * Douban eBook ++ — Web 版服务端（零依赖，仅用 Node 内置模块）
 *
 * 职责：
 *   1. 提供前端静态文件
 *   2. 作为 CORS 代理，并行解析 5 个电子书平台 API（原插件 background.js 的角色）
 *   3. 解析豆瓣链接，提取书名/ISBN/作者
 *   4. 探测 Z-Library 镜像可用性
 *
 * 启动：node server.js  （默认 http://localhost:3000）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const resolvers = require('./lib/resolvers');
const { probeZLibraryMirrors } = require('./lib/mirror-probe');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// ========================
// 工具函数
// ========================
function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      try {
        var raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  var body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function serveStatic(req, res) {
  var urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  var filePath = path.join(PUBLIC_DIR, urlPath);
  // 防路径穿越
  if (filePath.indexOf(PUBLIC_DIR) !== 0) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      // SPA 回退到 index.html
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), function (e2, d2) {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function getSearchFallback(platform, title, isbn) {
  var q = isbn || title || '';
  var map = {
    weread: 'https://weread.qq.com/web/search?key=',
    doubanread: 'https://read.douban.com/search?q=',
    dedao: 'https://www.dedao.cn/search?keyword=',
    duokan: 'https://www.duokan.com/search/',
    woniu: 'https://du.163.com/search?keyword='
  };
  return (map[platform] || '') + encodeURIComponent(q);
}

// ========================
// API 处理器
// ========================
async function handleParseDouban(req, res) {
  var body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: '请求体解析失败' }); }
  var url = (body.url || '').trim();
  if (!url || url.indexOf('book.douban.com/subject/') === -1) {
    return sendJson(res, 400, { error: '请输入有效的豆瓣书籍链接（含 book.douban.com/subject/）' });
  }
  try {
    var resp = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' } });
    if (!resp.ok) return sendJson(res, 502, { error: '豆瓣页面请求失败：HTTP ' + resp.status });
    var html = await resp.text();

    var title = '';
    var titleMatch = html.match(/<span[^>]*property="v:itemreviewed"[^>]*>([^<]+)<\/span>/i);
    if (titleMatch) title = titleMatch[1].trim();
    if (!title) {
      var ogMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      if (ogMatch) title = ogMatch[1].trim();
    }

    var isbn = '';
    var isbnMatch = html.match(/ISBN[:\s]*(\d[\d\-Xx]{9,17})/i);
    if (isbnMatch) isbn = isbnMatch[1].replace(/[-\s]/g, '').trim();

    var author = '';
    var authorMatch = html.match(/<a[^>]*href="[^"]*\/author\/[^"]*"[^>]*>([^<]+)<\/a>/i);
    if (authorMatch) author = authorMatch[1].trim();

    sendJson(res, 200, { title: title, isbn: isbn, author: author });
  } catch (e) {
    sendJson(res, 500, { error: '解析失败：' + e.message });
  }
}

async function handleSearch(req, res) {
  var body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: '请求体解析失败' }); }
  var title = (body.title || '').trim();
  var isbn = (body.isbn || '').trim();
  var author = (body.author || '').trim();

  if (!title && !isbn) {
    return sendJson(res, 400, { error: '请至少输入书名或 ISBN' });
  }

  var tasks = [
    { platform: 'weread', name: '微信读书', color: '#07C160', run: function () { return resolvers.resolveWereadUrl(title, isbn, author); } },
    { platform: 'doubanread', name: '豆瓣阅读', color: '#00B51D', run: function () { return resolvers.resolveDoubanReadUrl(title, author); } },
    { platform: 'dedao', name: '得到', color: '#E96900', run: function () { return resolvers.resolveDedaoUrl(title, author); } },
    { platform: 'duokan', name: '多看阅读', color: '#FF6B35', run: function () { return resolvers.resolveDuokanUrl(title, isbn, author); } },
    { platform: 'woniu', name: '网易蜗牛读书', color: '#E44C4C', run: function () { return resolvers.resolveWoniuUrl(title, isbn, author); } }
  ];

  var settled = await Promise.allSettled(tasks.map(function (t) { return t.run(); }));

  var results = settled.map(function (s, i) {
    var t = tasks[i];
    if (s.status === 'fulfilled') {
      return { platform: s.value.platform, name: t.name, color: t.color, url: s.value.url, found: s.value.found };
    }
    return { platform: t.platform, name: t.name, color: t.color, url: getSearchFallback(t.platform, title, isbn), found: false };
  });

  sendJson(res, 200, { results: results });
}

async function handleProbeZlib(req, res) {
  var body;
  try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: '请求体解析失败' }); }
  var isbn = (body.isbn || '').trim();
  var title = (body.title || '').trim();
  var mirrors = body.mirrors;

  if (!Array.isArray(mirrors) || mirrors.length === 0) {
    return sendJson(res, 400, { error: '镜像列表为空' });
  }
  try {
    var result = await probeZLibraryMirrors(mirrors, isbn, title);
    sendJson(res, 200, result);
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
}

// ========================
// HTTP 服务
// ========================
var server = http.createServer(function (req, res) {
  var method = req.method;
  var urlPath = req.url.split('?')[0];

  // CORS 预检
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // API 路由
  if (urlPath === '/api/health' && method === 'GET') {
    return sendJson(res, 200, { ok: true, service: 'douban-ebook-plus-web', time: new Date().toISOString() });
  }
  if (urlPath === '/api/parse-douban' && method === 'POST') {
    return handleParseDouban(req, res);
  }
  if (urlPath === '/api/search' && method === 'POST') {
    return handleSearch(req, res);
  }
  if (urlPath === '/api/probe-zlib' && method === 'POST') {
    return handleProbeZlib(req, res);
  }
  if (urlPath.indexOf('/api/') === 0) {
    return sendJson(res, 404, { error: 'Not found' });
  }

  // 静态文件
  if (method === 'GET') {
    return serveStatic(req, res);
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, function () {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Douban eBook ++ Web  已启动');
  console.log('  地址: http://localhost:' + PORT);
  console.log('  零依赖 · 仅 Node 内置模块');
  console.log('  按 Ctrl+C 停止');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
