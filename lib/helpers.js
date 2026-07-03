/**
 * 共享辅助函数（api/ 与 server.js 共用）
 */

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

module.exports = { getSearchFallback: getSearchFallback };
