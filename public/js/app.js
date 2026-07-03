/**
 * Douban eBook ++ Web — 主逻辑
 * 负责：主题切换 / 搜索调度 / 豆瓣链接解析 / 7 平台结果渲染
 */
(function () {
  'use strict';

  // ========================
  // 主题
  // ========================
  function initTheme() {
    var pref = DBPlus.storage.get('theme', 'system');
    applyTheme(pref);
    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.dataset.theme;
        DBPlus.storage.set('theme', t);
        applyTheme(t);
      });
    });
    // 跟随系统变化
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (DBPlus.storage.get('theme', 'system') === 'system') applyTheme('system');
      });
    } catch (e) {}
  }

  function applyTheme(pref) {
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.theme === pref);
    });
  }

  // ========================
  // 输入识别
  // ========================
  function isDoubanLink(s) {
    return s.indexOf('book.douban.com/subject/') !== -1;
  }

  function isIsbn(s) {
    var clean = s.replace(/[-\s]/g, '');
    return /^\d{9,13}[\dXx]$/.test(clean) || /^\d{13}$/.test(clean);
  }

  function cleanIsbn(s) {
    return s.replace(/[-\s]/g, '').trim();
  }

  // ========================
  // 搜索流程
  // ========================
  function initSearch() {
    var input = document.getElementById('searchInput');
    var btn = document.getElementById('searchBtn');
    btn.addEventListener('click', doSearch);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

    var advToggle = document.getElementById('advToggle');
    advToggle.addEventListener('click', function () {
      var open = advToggle.classList.toggle('open');
      document.getElementById('advFields').classList.toggle('open', open);
    });
  }

  function gatherInput() {
    return {
      main: document.getElementById('searchInput').value.trim(),
      isbn: document.getElementById('isbnInput').value.trim(),
      author: document.getElementById('authorInput').value.trim()
    };
  }

  async function doSearch() {
    var inp = gatherInput();
    if (!inp.main && !inp.isbn) {
      toast('请输入书名、ISBN 或豆瓣链接', 'error');
      return;
    }

    setLoading(true);
    renderSkeleton();

    var title = '', isbn = inp.isbn ? cleanIsbn(inp.isbn) : '', author = inp.author;

    try {
      if (inp.main && isDoubanLink(inp.main)) {
        toast('正在解析豆瓣页面…');
        var resp = await fetch('/api/parse-douban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inp.main })
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || '豆瓣解析失败');
        title = data.title || '';
        if (!isbn) isbn = data.isbn || '';
        if (!author) author = data.author || '';
      } else if (inp.main) {
        // 智能识别：纯数字串当 ISBN，否则当书名
        if (isIsbn(inp.main) && !isbn) {
          isbn = cleanIsbn(inp.main);
        } else {
          title = inp.main;
        }
      }

      if (!title && !isbn) {
        throw new Error('无法获取书名或 ISBN，请补充信息');
      }

      renderBookInfo(title, isbn, author);
      await searchPlatforms(title, isbn, author);
    } catch (e) {
      renderError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchPlatforms(title, isbn, author) {
    var resp = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, isbn: isbn, author: author })
    });
    var data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '搜索失败');

    // 5 个 API 平台结果
    var all = {};
    data.results.forEach(function (r) { all[r.platform] = r; });

    // Anna's Archive — 前端拼接
    var annasBase = DBPlus.storage.get('annas_base', DBPlus.DEFAULT_ANNAS_URL);
    var annasQ = isbn || title;
    var annasUrl = annasBase.replace('{query}', encodeURIComponent(annasQ));
    all['annas'] = {
      platform: 'annas', name: "Anna's Archive", color: '#805AD5',
      url: annasUrl, found: false, status: 'search'
    };

    // Z-Library — 占位，异步探测
    all['zlib'] = {
      platform: 'zlib', name: 'Z-Library', color: '#2B6CB0',
      url: '#', found: false, status: 'probing'
    };

    renderResults(all, title);
    probeZlib(isbn, title);
  }

  async function probeZlib(isbn, title) {
    var mirrors = DBPlus.storage.get('zlib_mirrors', DBPlus.DEFAULT_MIRRORS);
    try {
      var resp = await fetch('/api/probe-zlib', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn: isbn, title: title, mirrors: mirrors })
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '镜像探测失败');
      updateZlibCard(data);
    } catch (e) {
      updateZlibCard(null);
    }
  }

  // ========================
  // 渲染
  // ========================
  function renderBookInfo(title, isbn, author) {
    var parts = [];
    if (title) parts.push('《' + title + '》');
    if (isbn) parts.push('ISBN ' + isbn);
    if (author) parts.push(author);
    document.getElementById('resultsMeta').textContent = parts.join(' · ');
  }

  function renderSkeleton() {
    document.getElementById('resultsHead').style.display = 'flex';
    document.getElementById('resultsMeta').textContent = '解析中…';
    var html = '<div class="skeleton-grid">';
    for (var i = 0; i < 7; i++) html += '<div class="skeleton-card"></div>';
    html += '</div>';
    document.getElementById('resultsBody').innerHTML = html;
  }

  function renderResults(all, bookTitle) {
    var order = ['weread', 'doubanread', 'dedao', 'duokan', 'woniu', 'zlib', 'annas'];
    var html = '<div class="results-grid">';
    order.forEach(function (id) {
      var r = all[id];
      if (!r) return;
      var p = DBPlus.getPlatform(id);
      var icon = DBPlus.makeIcon(p.color, p.letter);
      var badge, cls, statusText, url, target;

      if (r.status === 'probing') {
        badge = '<span class="result-badge badge-probing">探测中</span>';
        cls = 'is-loading';
        statusText = '正在探测镜像可用性…';
        url = '#';
        target = '';
      } else if (r.found) {
        badge = '<span class="result-badge badge-direct">直达</span>';
        cls = 'is-direct';
        statusText = '已匹配，点击直达详情页';
        url = r.url;
        target = 'target="_blank" rel="noopener noreferrer"';
      } else {
        badge = '<span class="result-badge badge-search">搜索</span>';
        cls = '';
        statusText = '点击在新标签页搜索';
        url = r.url;
        target = 'target="_blank" rel="noopener noreferrer"';
      }

      html += '<a class="result-card ' + cls + '" style="--pc:' + p.color + '" ' +
        'href="' + escapeAttr(url) + '" ' + target +
        ' title="在 ' + p.name + ' 中查找《' + escapeAttr(bookTitle || '') + '》">' +
        '<img class="result-icon" src="' + icon + '" alt="' + escapeAttr(p.name) + '">' +
        '<div class="result-body"><div class="result-name">' + p.name + '</div>' +
        '<div class="result-status">' + statusText + '</div></div>' +
        badge + '</a>';
    });
    html += '</div>';
    document.getElementById('resultsBody').innerHTML = html;
  }

  function updateZlibCard(result) {
    var card = document.querySelector('.result-card[data-zlib]');
    // 通过平台顺序定位 zlib 卡片（第6张）
    var cards = document.querySelectorAll('.result-card');
    if (cards.length < 6) return;
    card = cards[5]; // zlib 是第6个
    if (!card) return;

    var badge = card.querySelector('.result-badge');
    var status = card.querySelector('.result-status');
    if (!badge || !status) return;

    if (result && result.url) {
      card.href = result.url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.classList.remove('is-loading');
      if (result.alive) {
        card.classList.add('is-direct');
        badge.className = 'result-badge badge-direct';
        badge.textContent = '直达';
        status.textContent = '镜像 ' + result.mirror + ' 可用，点击直达';
      } else {
        badge.className = 'result-badge badge-search';
        badge.textContent = '搜索';
        status.textContent = '镜像 ' + result.mirror + '（探活超时，点击尝试）';
      }
    } else {
      card.classList.remove('is-loading');
      badge.className = 'result-badge badge-search';
      badge.textContent = '搜索';
      status.textContent = '镜像探测失败，点击尝试搜索';
    }
  }

  function renderError(msg) {
    document.getElementById('resultsHead').style.display = 'none';
    document.getElementById('resultsBody').innerHTML =
      '<div class="empty-state"><span class="emoji">⚠️</span>' +
      '<p>' + escapeHtml(msg) + '</p>' +
      '<div class="tip">请检查输入或稍后重试</div></div>';
  }

  function setLoading(loading) {
    document.getElementById('searchBtn').disabled = loading;
  }

  // ========================
  // Toast
  // ========================
  var toastTimer = null;
  function toast(msg, type) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 2600);
  }

  // ========================
  // 工具
  // ========================
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  // ========================
  // 启动
  // ========================
  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initSearch();
  });
})();
