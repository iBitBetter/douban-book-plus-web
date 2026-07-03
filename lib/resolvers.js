/**
 * 电子书平台直链解析器
 * 从原 background.js 提取，负责将书名/ISBN 解析为各平台直链
 *
 * 包含 5 个需要 API 调用的平台：
 *   微信读书 / 豆瓣阅读 / 得到 / 多看阅读 / 网易蜗牛读书
 *
 * （Z-Library 镜像探测见 mirror-probe.js，Anna's Archive 为纯前端 URL 拼接）
 */

const { encodeWereadId } = require('./weread-encode');
const { bookMatch } = require('./matcher');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * 微信读书：书名/ISBN 搜索 → bookDetail 直链
 */
async function resolveWereadUrl(title, isbn, author) {
  // 策略1：用书名搜索
  if (title) {
    try {
      var url = 'https://weread.qq.com/web/search/global?keyword=' + encodeURIComponent(title.trim());
      var resp = await fetch(url, { headers: { 'User-Agent': UA } });
      if (resp.ok) {
        var data = await resp.json();
        var books = data.books || [];
        if (books.length > 0) {
          var match = bookMatch(title, author, books,
            function (b) { return (b.bookInfo && b.bookInfo.title) || ''; },
            function (b) { return (b.bookInfo && b.bookInfo.author) || ''; },
            0.60);
          if (match.matched) {
            var bookId = String(books[match.index].bookInfo.bookId);
            var encodedId = encodeWereadId(bookId);
            return { platform: 'weread', url: 'https://weread.qq.com/web/bookDetail/' + encodedId, found: true };
          }
        }
      }
    } catch (e) {
      console.warn('[DB+] weread title search failed:', e.message);
    }
  }

  // 策略2：用 ISBN 搜索
  if (isbn) {
    try {
      var isbnUrl = 'https://weread.qq.com/web/search/global?keyword=' + encodeURIComponent(isbn);
      var isbnResp = await fetch(isbnUrl, { headers: { 'User-Agent': UA } });
      if (isbnResp.ok) {
        var isbnData = await isbnResp.json();
        var isbnBooks = isbnData.books || [];
        if (isbnBooks.length > 0) {
          var match = bookMatch(title, author, isbnBooks,
            function (b) { return (b.bookInfo && b.bookInfo.title) || ''; },
            function (b) { return (b.bookInfo && b.bookInfo.author) || ''; },
            0.50);
          if (match.matched) {
            var isbnBookId = String(isbnBooks[match.index].bookInfo.bookId);
            var isbnEncodedId = encodeWereadId(isbnBookId);
            return { platform: 'weread', url: 'https://weread.qq.com/web/bookDetail/' + isbnEncodedId, found: true };
          }
        }
      }
    } catch (e) {
      console.warn('[DB+] weread ISBN search failed:', e.message);
    }
  }

  var searchQuery = isbn || title || '';
  return { platform: 'weread', url: 'https://weread.qq.com/web/search?key=' + encodeURIComponent(searchQuery), found: false };
}

/**
 * 多看阅读：书名/ISBN 搜索 → reader/app.html 直链
 */
async function resolveDuokanUrl(title, isbn, author) {
  var searchQuery = isbn || title;
  if (!searchQuery) {
    return { platform: 'duokan', url: 'https://www.duokan.com/search/' + encodeURIComponent(title || ''), found: false };
  }
  try {
    var searchUrl = 'https://www.duokan.com/target/search/web?s=' + encodeURIComponent(searchQuery.trim()) + '&p=1';
    var resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Xiaomi 13) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.duokan.com/m/'
      }
    });
    if (resp.ok) {
      var data = await resp.json();
      var books = data.books || [];
      if (books.length > 0) {
        var match = bookMatch(title, author, books,
          function (b) { return b.title || ''; },
          function (b) { return b.author || ''; },
          0.60);
        if (match.matched) {
          var bookId = books[match.index].book_id;
          return { platform: 'duokan', url: 'https://www.duokan.com/reader/www/app.html?id=' + bookId, found: true };
        }
      }
    }
  } catch (e) {
    console.warn('[DB+] duokan search failed:', e.message);
  }
  return { platform: 'duokan', url: 'https://www.duokan.com/search/' + encodeURIComponent(searchQuery.trim()), found: false };
}

/**
 * 得到：书名搜索 → ebook/reader 直链
 */
async function resolveDedaoUrl(title, author) {
  if (!title) {
    return { platform: 'dedao', url: 'https://www.dedao.cn/search?keyword=', found: false };
  }
  try {
    var resp = await fetch('https://www.dedao.cn/api/search/pc/suggest', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: title.trim(), searchType: 2 })
    });
    if (resp.ok) {
      var data = await resp.json();
      var lists = (data.c && data.c.list) || [];
      var ebooks = [];
      for (var i = 0; i < lists.length; i++) {
        var items = lists[i].list || [];
        for (var j = 0; j < items.length; j++) {
          var item = items[j];
          if (item.type === 2 && item.extra && item.extra.enid) {
            ebooks.push(item);
          }
        }
      }
      if (ebooks.length > 0) {
        var match = bookMatch(title, author, ebooks,
          function (b) { return b.title || ''; },
          function (b) { return (b.extra && b.extra.authorName) || ''; },
          0.55);
        if (match.matched) {
          var enid = ebooks[match.index].extra.enid;
          return { platform: 'dedao', url: 'https://www.dedao.cn/ebook/reader?id=' + enid, found: true };
        }
      }
    }
  } catch (e) {
    console.warn('[DB+] dedao search failed:', e.message);
  }
  return { platform: 'dedao', url: 'https://www.dedao.cn/search?keyword=' + encodeURIComponent(title.trim()), found: false };
}

/**
 * 豆瓣阅读：书名搜索 → reader/ebook 直链
 */
async function resolveDoubanReadUrl(title, author) {
  if (!title) {
    return { platform: 'doubanread', url: 'https://read.douban.com/search?q=', found: false };
  }
  try {
    var searchUrl = 'https://read.douban.com/j/search?query=' + encodeURIComponent(title.trim());
    var resp = await fetch(searchUrl, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*' }
    });
    if (resp.ok) {
      var data = await resp.json();
      if (Array.isArray(data)) {
        var ebooks = [];
        for (var i = 0; i < data.length; i++) {
          if (data[i].type === 'ebook' && data[i].id) {
            ebooks.push(data[i]);
          }
        }
        if (ebooks.length > 0) {
          var match = bookMatch(title, author, ebooks,
            function (b) { return b.title || ''; },
            function (b) { return b.author || ''; },
            0.55);
          if (match.matched) {
            return { platform: 'doubanread', url: 'https://read.douban.com/reader/ebook/' + ebooks[match.index].id + '/', found: true };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[DB+] douban read search failed:', e.message);
  }
  return { platform: 'doubanread', url: 'https://read.douban.com/search?q=' + encodeURIComponent(title.trim()), found: false };
}

/**
 * 网易蜗牛读书：书名搜索 → share/book 直链
 * ⚠️ 仅支持书名搜索，ISBN 无效
 */
async function resolveWoniuUrl(title, isbn, author) {
  var searchQuery = title;
  if (!searchQuery) {
    return { platform: 'woniu', url: 'https://du.163.com/search?keyword=', found: false };
  }
  try {
    var searchUrl = 'https://du.163.com/search/book.json?word=' + encodeURIComponent(searchQuery.trim()) + '&page=1&pageSize=5';
    var resp = await fetch(searchUrl, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' }
    });
    if (resp.ok) {
      var data = await resp.json();
      if (data.code === 0) {
        var bookWrappers = data.bookWrappers || [];
        if (bookWrappers.length > 0) {
          var match = bookMatch(title, author, bookWrappers,
            function (b) { return (b.book && b.book.title) || ''; },
            function (b) { return (b.book && b.book.author) || ''; },
            0.60);
          if (match.matched) {
            var bookId = (bookWrappers[match.index].book && bookWrappers[match.index].book.bookId) || bookWrappers[match.index].bookId;
            return { platform: 'woniu', url: 'https://du.163.com/share/book/' + bookId, found: true };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[DB+] woniu search failed:', e.message);
  }
  return { platform: 'woniu', url: 'https://du.163.com/search?keyword=' + encodeURIComponent(searchQuery.trim()), found: false };
}

module.exports = {
  resolveWereadUrl: resolveWereadUrl,
  resolveDuokanUrl: resolveDuokanUrl,
  resolveDedaoUrl: resolveDedaoUrl,
  resolveDoubanReadUrl: resolveDoubanReadUrl,
  resolveWoniuUrl: resolveWoniuUrl
};
