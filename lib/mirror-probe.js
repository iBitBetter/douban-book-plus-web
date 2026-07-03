/**
 * Z-Library 镜像智能探测
 * 从原 background.js 提取，改造为接收镜像列表参数（不再依赖 chrome.storage）
 */

/**
 * 带超时的 fetch，用于快速探测镜像可用性
 */
function fetchWithTimeout(url, timeoutMs) {
  return new Promise(function (resolve) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
      resolve(false);
    }, timeoutMs);

    fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
      .then(function () {
        clearTimeout(timer);
        resolve(true);
      })
      .catch(function () {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

/**
 * 顺序探测 Z-Library 镜像，返回第一个可用的
 * @param {Array<{name:string, homeUrl:string, searchBase:string}>} mirrors - 镜像列表
 * @param {string} isbn - 书籍 ISBN，用于构造搜索链接
 * @param {string} title - 书名（备用，无 ISBN 时）
 * @returns {Promise<{url: string, mirror: string, alive: boolean}>}
 */
async function probeZLibraryMirrors(mirrors, isbn, title) {
  var PROBE_TIMEOUT = 3000;

  for (var i = 0; i < mirrors.length; i++) {
    var mirror = mirrors[i];
    var searchQuery = isbn || title;
    var searchUrl = mirror.searchBase;
    if (searchQuery) {
      searchUrl += '/s/' + encodeURIComponent(searchQuery.trim());
    } else {
      searchUrl += '/';
    }

    try {
      var alive = await fetchWithTimeout(searchUrl, PROBE_TIMEOUT);
      if (alive) {
        return { url: searchUrl, mirror: mirror.name, alive: true };
      }
    } catch (e) {
      // 继续探测下一个
    }
  }

  // 全部不可用，返回第一个作为兜底
  var fallback = mirrors[0];
  var fallbackSearchQuery = isbn || title;
  var fallbackUrl = fallback.searchBase;
  if (fallbackSearchQuery) {
    fallbackUrl += '/s/' + encodeURIComponent(fallbackSearchQuery.trim());
  } else {
    fallbackUrl += '/';
  }
  return { url: fallbackUrl, mirror: fallback.name, alive: false };
}

module.exports = { probeZLibraryMirrors: probeZLibraryMirrors };
