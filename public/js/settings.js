/**
 * 设置页逻辑 — Z-Library 镜像 CRUD + Anna's Archive 地址配置
 * 从原 options.js 改造，chrome.storage.sync → localStorage (DBPlus.storage)
 */
(function () {
  'use strict';

  var mirrors = [];
  var editingIndex = -1; // -1 = 新增, >=0 = 编辑

  // ========================
  // 主题（与主页一致）
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
  }
  function applyTheme(pref) {
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.theme === pref);
    });
  }

  // ========================
  // 初始化
  // ========================
  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    loadConfig();
    bindEvents();
  });

  function loadConfig() {
    mirrors = DBPlus.storage.get('zlib_mirrors', null);
    if (!mirrors || mirrors.length === 0) {
      mirrors = JSON.parse(JSON.stringify(DBPlus.DEFAULT_MIRRORS));
    }
    renderMirrorList();

    var annasUrl = DBPlus.storage.get('annas_base', DBPlus.DEFAULT_ANNAS_URL);
    document.getElementById('annasUrl').value = annasUrl;
  }

  function saveMirrors() {
    DBPlus.storage.set('zlib_mirrors', mirrors);
    showStatus('配置已保存，下次搜索时生效', 'success');
  }

  function resetToDefaults() {
    mirrors = JSON.parse(JSON.stringify(DBPlus.DEFAULT_MIRRORS));
    DBPlus.storage.set('zlib_mirrors', mirrors);
    DBPlus.storage.set('annas_base', DBPlus.DEFAULT_ANNAS_URL);
    document.getElementById('annasUrl').value = DBPlus.DEFAULT_ANNAS_URL;
    renderMirrorList();
    showStatus('已恢复为默认配置', 'success');
  }

  // ========================
  // 渲染镜像列表
  // ========================
  function renderMirrorList() {
    var container = document.getElementById('mirrorList');

    if (mirrors.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无镜像，点击「添加镜像」开始</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < mirrors.length; i++) {
      var m = mirrors[i];
      html += '<div class="mirror-item">';
      html += '<span class="mirror-index">' + (i + 1) + '</span>';
      html += '<div class="mirror-info">';
      html += '<div class="mirror-name">' + escapeHtml(m.name) + '</div>';
      html += '<div class="mirror-urls">搜索: <code>' + escapeHtml(m.searchBase) + '</code></div>';
      html += '</div>';
      html += '<div class="mirror-actions">';
      html += '<button class="btn btn-secondary btn-small" data-action="up" data-index="' + i + '" title="上移">↑</button>';
      html += '<button class="btn btn-secondary btn-small" data-action="down" data-index="' + i + '" title="下移">↓</button>';
      html += '<button class="btn btn-secondary btn-small" data-action="edit" data-index="' + i + '">编辑</button>';
      html += '<button class="btn btn-danger btn-small" data-action="remove" data-index="' + i + '">删除</button>';
      html += '</div>';
      html += '</div>';
    }
    container.innerHTML = html;
    bindMirrorEvents();
  }

  function bindMirrorEvents() {
    document.querySelectorAll('.mirror-actions button').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = this.dataset.action;
        var index = parseInt(this.dataset.index, 10);
        switch (action) {
          case 'edit': openEditModal(index); break;
          case 'remove': removeMirror(index); break;
          case 'up': moveMirror(index, -1); break;
          case 'down': moveMirror(index, 1); break;
        }
      });
    });
  }

  function moveMirror(index, direction) {
    var newIndex = index + direction;
    if (newIndex < 0 || newIndex >= mirrors.length) return;
    var item = mirrors.splice(index, 1)[0];
    mirrors.splice(newIndex, 0, item);
    saveMirrors();
    renderMirrorList();
  }

  function removeMirror(index) {
    if (mirrors.length <= 1) {
      showStatus('至少保留一个镜像地址', 'error');
      return;
    }
    mirrors.splice(index, 1);
    saveMirrors();
    renderMirrorList();
  }

  // ========================
  // 编辑弹窗
  // ========================
  function openEditModal(index) {
    var modal = document.getElementById('editModal');
    var title = document.getElementById('modalTitle');
    var nameInput = document.getElementById('mirrorName');
    var searchInput = document.getElementById('mirrorSearchBase');
    var msg = document.getElementById('modalMsg');

    if (index >= 0) {
      title.textContent = '编辑镜像';
      nameInput.value = mirrors[index].name;
      searchInput.value = mirrors[index].searchBase;
      editingIndex = index;
    } else {
      title.textContent = '添加镜像';
      nameInput.value = '';
      searchInput.value = '';
      editingIndex = -1;
    }
    msg.style.display = 'none';
    modal.classList.add('open');
    nameInput.focus();
  }

  function closeModal() {
    document.getElementById('editModal').classList.remove('open');
    editingIndex = -1;
  }

  function saveMirror() {
    var name = document.getElementById('mirrorName').value.trim();
    var searchBase = document.getElementById('mirrorSearchBase').value.trim();

    if (!name) { showModalError('名称不能为空'); return; }
    if (!searchBase) { showModalError('搜索基础地址不能为空'); return; }

    // 去除尾部斜杠，保持一致
    searchBase = searchBase.replace(/\/+$/, '');

    // 名称唯一性
    for (var i = 0; i < mirrors.length; i++) {
      if (i !== editingIndex && mirrors[i].name === name) {
        showModalError('镜像名称「' + name + '」已存在');
        return;
      }
    }

    var mirror = { name: name, homeUrl: searchBase, searchBase: searchBase };
    if (editingIndex >= 0) {
      mirrors[editingIndex] = mirror;
    } else {
      mirrors.push(mirror);
    }
    saveMirrors();
    closeModal();
    renderMirrorList();
  }

  function showModalError(text) {
    var msg = document.getElementById('modalMsg');
    msg.textContent = text;
    msg.style.display = 'block';
  }

  // ========================
  // Anna's Archive
  // ========================
  function saveAnnasUrl() {
    var url = document.getElementById('annasUrl').value.trim();
    var statusEl = document.getElementById('annasStatus');

    if (!url) {
      showAnnasStatus('地址不能为空', 'error');
      return;
    }
    if (url.indexOf('{query}') === -1) {
      showAnnasStatus('地址必须包含 {query} 占位符', 'error');
      return;
    }

    DBPlus.storage.set('annas_base', url);
    showAnnasStatus("Anna's Archive 搜索地址已保存，下次搜索时生效", 'success');
  }

  function showAnnasStatus(msg, type) {
    var el = document.getElementById('annasStatus');
    el.textContent = msg;
    el.className = 'status-msg ' + (type || 'success');
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  // ========================
  // 事件绑定
  // ========================
  function bindEvents() {
    document.getElementById('btnAdd').addEventListener('click', function () { openEditModal(-1); });
    document.getElementById('btnReset').addEventListener('click', function () {
      if (confirm('确定要恢复为默认配置吗？当前配置将被覆盖。')) resetToDefaults();
    });
    document.getElementById('btnSave').addEventListener('click', saveMirror);
    document.getElementById('btnCancel').addEventListener('click', closeModal);
    document.getElementById('btnSaveAnnas').addEventListener('click', saveAnnasUrl);

    // 点击遮罩关闭
    document.getElementById('editModal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
    // Enter 保存 / Esc 关闭
    document.addEventListener('keydown', function (e) {
      var open = document.getElementById('editModal').classList.contains('open');
      if (e.key === 'Enter' && open) saveMirror();
      if (e.key === 'Escape' && open) closeModal();
    });
  }

  function showStatus(msg, type) {
    var el = document.getElementById('statusMsg');
    el.textContent = msg;
    el.className = 'status-msg ' + (type || 'success');
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
