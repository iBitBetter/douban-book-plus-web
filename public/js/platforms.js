/**
 * 平台展示配置 — 7 个电子书平台的元数据
 * 图标用内联 SVG data URI 生成，零网络请求
 */
window.DBPlus = window.DBPlus || {};

DBPlus.makeIcon = function (color, letter) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">' +
    '<rect width="24" height="24" rx="6" fill="' + color + '"/>' +
    '<text x="12" y="17" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" ' +
    'font-family="system-ui,-apple-system,sans-serif">' + letter + '</text></svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
};

DBPlus.PLATFORMS = [
  { id: 'weread', name: '微信读书', color: '#07C160', letter: '微' },
  { id: 'doubanread', name: '豆瓣阅读', color: '#00B51D', letter: '豆' },
  { id: 'dedao', name: '得到', color: '#E96900', letter: '得' },
  { id: 'duokan', name: '多看阅读', color: '#FF6B35', letter: '多' },
  { id: 'woniu', name: '网易蜗牛读书', color: '#E44C4C', letter: '蜗' },
  { id: 'zlib', name: 'Z-Library', color: '#2B6CB0', letter: 'Z' },
  { id: 'annas', name: "Anna's Archive", color: '#805AD5', letter: 'A' }
];

DBPlus.getPlatform = function (id) {
  for (var i = 0; i < DBPlus.PLATFORMS.length; i++) {
    if (DBPlus.PLATFORMS[i].id === id) return DBPlus.PLATFORMS[i];
  }
  return null;
};

// Anna's Archive 默认搜索地址模板（{query} 为占位符）
DBPlus.DEFAULT_ANNAS_URL = 'https://annas-archive.gl/search?q={query}';

// Z-Library 默认镜像列表
DBPlus.DEFAULT_MIRRORS = [
  { name: 'zlib.re', homeUrl: 'https://zh.zlib.re/', searchBase: 'https://zh.vbh101.ru' }
];

// localStorage 读写封装
DBPlus.storage = {
  get: function (key, fallback) {
    try {
      var v = localStorage.getItem('dbplus_' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set: function (key, value) {
    try {
      localStorage.setItem('dbplus_' + key, JSON.stringify(value));
    } catch (e) {}
  }
};
