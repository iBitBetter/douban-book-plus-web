/**
 * POST /api/search
 * 并行解析 5 个电子书平台，返回直链或搜索页兜底
 *
 * body: { title, isbn, author }
 * 返回: { results: [{ platform, name, color, url, found }] }
 */
const resolvers = require('../lib/resolvers');
const { getSearchFallback } = require('../lib/helpers');

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var body = req.body || {};
  var title = (body.title || '').trim();
  var isbn = (body.isbn || '').trim();
  var author = (body.author || '').trim();

  if (!title && !isbn) {
    return res.status(400).json({ error: '请至少输入书名或 ISBN' });
  }

  var tasks = [
    { platform: 'weread', name: '微信读书', color: '#07C160', run: function () { return resolvers.resolveWereadUrl(title, isbn, author); } },
    { platform: 'doubanread', name: '豆瓣阅读', color: '#00B51D', run: function () { return resolvers.resolveDoubanReadUrl(title, author); } },
    { platform: 'dedao', name: '得到', color: '#E96900', run: function () { return resolvers.resolveDedaoUrl(title, author); } },
    { platform: 'duokan', name: '多看阅读', color: '#FF6B35', run: function () { return resolvers.resolveDuokanUrl(title, isbn, author); } },
    { platform: 'woniu', name: '网易蜗牛读书', color: '#E44C4C', run: function () { return resolvers.resolveWoniuUrl(title, isbn, author); } }
  ];

  // 并行解析，单个失败不影响其他
  var settled = await Promise.allSettled(tasks.map(function (t) { return t.run(); }));

  var results = settled.map(function (s, i) {
    var t = tasks[i];
    if (s.status === 'fulfilled') {
      return {
        platform: s.value.platform,
        name: t.name,
        color: t.color,
        url: s.value.url,
        found: s.value.found
      };
    }
    // 异常兜底：搜索页
    return {
      platform: t.platform,
      name: t.name,
      color: t.color,
      url: getSearchFallback(t.platform, title, isbn),
      found: false
    };
  });

  res.status(200).json({ results: results });
};
