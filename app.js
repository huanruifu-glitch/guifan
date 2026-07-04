/* 建筑规范查询 —— 纯前端逻辑，无后端。数据: js/data.js(window.STANDARDS)、js/topics.js(window.PARTS) */
(function () {
  'use strict';

  var DATA = (window.STANDARDS || []).slice();
  var PARTS = window.PARTS || [];
  var DATA_CODES = {};
  DATA.forEach(function (s) { DATA_CODES[s.code] = true; });
  var CAT_NAME = { predesign: '设计前期', design: '常用规范', atlas: '国标图集' };
  var LINK_META = {
    '正文': { label: '官方全文', btn: '搜索并查看全文 ↗', hint: '点击将检索官方来源（住建部/中国政府网）；该强制性规范全文已公开，可在结果中下载 PDF。' },
    '公告': { label: '官方公告', btn: '搜索官方公告 ↗', hint: '点击将检索官方发布公告（含实施信息）；如为推荐性标准，完整正文可能需购买。' },
    '门户': { label: '官方检索', btn: '检索现行版本 ↗', hint: '该标准官方多不免费公开全文；点击将检索官方来源，完整正文可能需购买或查阅纸质版。' },
    '书目': { label: '官方书目', btn: '搜索该图集 ↗', hint: '图集正文受版权保护、无免费全文；点击检索官方书目，正文需购买。' }
  };
  var DEFAULT_PH = '搜索规范名称或编号，如 抗震 / GB 55001';
  var ASSIST_PH = '输入部位，如 地下室、屋面、卫生间、外墙';
  var DIR_BANNER = '<a class="dir-banner" target="_blank" rel="noopener" href="https://www.chinabuilding.com.cn/shtml/bookslist-1-2.html">📖 官方完整图集目录（中国建筑标准设计网·建筑专业，始终最新）↗</a>';
  var LS_KEY = 'guifan_updates_read_at';
  var EXAMPLES = ['地下室', '屋面', '外墙', '阳台', '卫生间', '门窗', '楼梯', '内隔墙', '吊顶', '楼地面', '机房', '汽车库', '防火', '保温', '防水', '变形缝', '无障碍', '雨篷', '托幼中小学', '人防', '室外工程', '平法'];

  var state = { cat: 'design', group: 'all', keyword: '' };

  var $ = function (id) { return document.getElementById(id); };
  var listEl = $('list'), emptyEl = $('empty'), metaEl = $('resultMeta');
  var subfilterEl = $('subfilter'), tabsEl = $('tabs');
  var searchInput = $('searchInput'), clearBtn = $('clearBtn');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function baidu(q) { return 'https://www.baidu.com/s?wd=' + encodeURIComponent(q); }
  function shortLabel(p) { return p.name.split(/[ /（(]/)[0]; }
  function partGroup(p) { if (/专题|专项/.test(p.name)) return '构造专题'; if (/平法|结构/.test(p.name)) return '结构'; return '主体部位'; }
  function nodeHit(it, kw) { if (!kw) return false; kw = kw.toLowerCase(); return it.a.toLowerCase().indexOf(kw) > -1 || (it.n && it.n.toLowerCase().indexOf(kw) > -1) || (it.atl || []).some(function (a) { return (a[0] + a[1]).toLowerCase().indexOf(kw) > -1; }); }
  function plainChecklist(p) { return p.name + ' · 施工图节点清单\n' + p.items.map(function (it, i) { return (i + 1) + '. ' + it.a + (it.atl && it.atl.length ? '  [图集] ' + it.atl.map(function (a) { return a[0]; }).join('、') : '') + (it.n ? '\n   注：' + it.n : ''); }).join('\n'); }
  var RECENT_KEY = 'guifan_recent_parts';
  function partByName(name) { return PARTS.filter(function (p) { return p.name === name; })[0]; }
  function getRecent() { var arr; try { arr = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { arr = []; } var names = PARTS.map(function (p) { return p.name; }); return arr.filter(function (n) { return names.indexOf(n) > -1; }); }
  function recordRecent(name) { var arr = getRecent().filter(function (n) { return n !== name; }); arr.unshift(name); arr = arr.slice(0, 8); try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr)); } catch (e) {} }
  var CITIES = window.CITIES || [];
  var CITY_DOCS = window.CITY_DOCS || [];
  var CITY_PH = '输入城市，如 上海、成都、武汉';
  var RECENT_CITY_KEY = 'guifan_recent_cities';
  function getRecentCities() { var arr; try { arr = JSON.parse(localStorage.getItem(RECENT_CITY_KEY) || '[]'); } catch (e) { arr = []; } var names = CITIES.map(function (c) { return c.name; }); return arr.filter(function (n) { return names.indexOf(n) > -1; }); }
  function recordRecentCity(name) { var arr = getRecentCities().filter(function (n) { return n !== name; }); arr.unshift(name); arr = arr.slice(0, 8); try { localStorage.setItem(RECENT_CITY_KEY, JSON.stringify(arr)); } catch (e) {} }
  function plainCityList(c) { return c.name + ' · 设计前期资料清单\n' + CITY_DOCS.map(function (d, i) { return (i + 1) + '. ' + d.t + (d.n ? '\n   注：' + d.n : ''); }).join('\n'); }
  function cityChip(name) { return '<button class="ex-chip" data-city="' + esc(name) + '">' + esc(name) + '</button>'; }
  function exGroup(label, chipsHtml) { return '<div class="ex-group"><div class="ex-glabel">' + label + '</div><div class="ex-wrap">' + chipsHtml + '</div></div>'; }

  function cityLanding() {
    var html = '';
    var recent = getRecentCities();
    if (recent.length) html += exGroup('🕘 最近查过', recent.map(function (n) { return '<button class="ex-chip recent" data-city="' + esc(n) + '">' + esc(n) + '</button>'; }).join(''));
    var regions = [];
    CITIES.forEach(function (c) { if (regions.indexOf(c.region) < 0) regions.push(c.region); });
    regions.forEach(function (r) { html += exGroup(r, CITIES.filter(function (c) { return c.region === r; }).map(function (c) { return cityChip(c.name); }).join('')); });
    return html;
  }

  function cityCard(c) {
    var items = CITY_DOCS.map(function (d, i) {
      var url = baidu(c.name + d.q + ' 现行 全文 site:gov.cn');
      return '<div class="node">' +
        '<div class="node-a"><span class="node-idx">' + (i + 1) + '</span>' + esc(d.t) + '</div>' +
        '<div class="node-atlas"><a class="atlas-chip" target="_blank" rel="noopener" href="' + esc(url) + '">🔍 官方检索：' + esc(c.name) + esc(d.q.split(" ")[0]) + ' 现行全文 ↗</a></div>' +
        (d.n ? '<div class="node-note">' + esc(d.n) + '</div>' : '') +
        '</div>';
    }).join('');
    return '<div class="part-card">' +
      '<div class="part-head"><div class="part-name">🏙️ ' + esc(c.name) + ' · 设计前期资料清单</div>' +
      '<button class="copy-list" data-city="' + esc(c.name) + '">📋 复制清单</button></div>' +
      '<div class="part-intro">做 ' + esc(c.name) + ' 的项目前，逐项检索收集以下地方资料。<b>检索已限定官方政府网站（gov.cn），确保来源权威。</b></div>' +
      '<div class="node-count">共 ' + CITY_DOCS.length + ' 类地方资料</div>' + items +
      '<a class="topic-more" target="_blank" rel="noopener" href="' + esc(baidu(c.name + ' 规划和自然资源局 site:gov.cn')) + '">前往 ' + esc(c.name) + ' 规划和自然资源局官网（官方） ↗</a>' +
      '</div>';
  }

  function bindCity() {
    Array.prototype.forEach.call(listEl.querySelectorAll('.ex-chip[data-city]'), function (b) {
      b.addEventListener('click', function () { searchInput.value = b.getAttribute('data-city'); state.keyword = searchInput.value; clearBtn.hidden = false; render(); });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('.copy-list[data-city]'), function (b) {
      b.addEventListener('click', function () {
        var c = CITIES.filter(function (x) { return x.name === b.getAttribute('data-city'); })[0]; if (!c) return;
        var txt = plainCityList(c);
        var done = function () { b.textContent = '已复制 ✓'; setTimeout(function () { b.textContent = '📋 复制清单'; }, 1500); };
        if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(done, function () { fbCopy(txt, done); }); } else { fbCopy(txt, done); }
      });
    });
  }

  function renderCity() {
    subfilterEl.innerHTML = '';
    var kw = state.keyword.trim();
    if (!kw) {
      metaEl.textContent = '选择城市，一次列出做该城市项目要收集的设计前期地方资料清单，每项带精准检索直达。';
      listEl.innerHTML = '<div class="assist-intro">选择城市：</div>' + cityLanding();
      emptyEl.hidden = true; bindCity(); return;
    }
    var exact = CITIES.filter(function (c) { return c.name === kw; });
    var hits = exact.length ? exact : CITIES.filter(function (c) { return c.name.indexOf(kw) > -1 || kw.indexOf(c.name) > -1; });
    if (exact.length || hits.length === 1) {
      var c = hits[0]; recordRecentCity(c.name);
      metaEl.textContent = '「' + c.name + '」设计前期资料清单';
      listEl.innerHTML = cityCard(c);
    } else if (hits.length) {
      metaEl.textContent = '匹配到 ' + hits.length + ' 个城市';
      listEl.innerHTML = '<div class="assist-intro">选择城市：</div><div class="ex-wrap">' + hits.map(function (c) { return cityChip(c.name); }).join('') + '</div>';
    } else {
      metaEl.textContent = '未收录“' + kw + '”';
      listEl.innerHTML = '<div class="part-card"><div class="part-name">未收录“' + esc(kw) + '”</div>' +
        '<div class="muted small">可直接检索该城市规划技术规定：</div>' +
        '<a class="topic-more" target="_blank" rel="noopener" href="' + esc(baidu(kw + ' 城市规划管理技术规定 现行 全文 site:gov.cn')) + '">在官方政府网检索“' + esc(kw) + '”规划技术规定 ↗</a></div>';
    }
    emptyEl.hidden = true; bindCity();
  }


  /* ---------- 更新提醒 ---------- */
  function renderUpdates() {
    var readAt = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
    var ups = DATA.filter(function (s) { return s.isUpdate; })
      .sort(function (a, b) { return (b.effectiveDate || '').localeCompare(a.effectiveDate || ''); });
    var latest = ups.reduce(function (m, s) { var t = Date.parse((s.effectiveDate || '') + 'T00:00:00') || 0; return Math.max(m, t); }, 0);
    var banner = $('updateBanner');
    if (!ups.length || (readAt && latest && readAt >= latest)) { banner.hidden = true; return; }
    $('updateCount').textContent = ups.length + ' 条';
    $('updateList').innerHTML = ups.map(function (s) {
      var cls = s.changeType === '废止' ? 'tag-abolished' : 'tag-new';
      return '<div class="update-item" data-code="' + esc(s.code) + '"><div class="u-title"><span class="tag ' + cls + '">' + esc(s.changeType || '更新') + '</span> ' + esc(s.title) + '</div><div class="u-meta">' + esc(s.code) + ' · ' + esc(s.effectiveDate || '') + ' 实施</div></div>';
    }).join('');
    banner.hidden = false;
    Array.prototype.forEach.call($('updateList').children, function (el) {
      el.addEventListener('click', function () { openDetail(el.getAttribute('data-code')); });
    });
    $('markReadBtn').onclick = function () { localStorage.setItem(LS_KEY, String(Date.now())); banner.hidden = true; };
  }

  /* ---------- 二级分组筛选 ---------- */
  function renderSubfilter() {
    if (state.cat === 'all' || state.cat === 'assistant') { subfilterEl.innerHTML = ''; return; }
    var groups = [];
    DATA.forEach(function (s) { if (s.category === state.cat && s.group && groups.indexOf(s.group) === -1) groups.push(s.group); });
    if (groups.length < 2) { subfilterEl.innerHTML = ''; return; }
    var chips = ['all'].concat(groups);
    subfilterEl.innerHTML = chips.map(function (g) {
      return '<button class="chip' + (state.group === g ? ' active' : '') + '" data-group="' + esc(g) + '">' + esc(g === 'all' ? '全部' : g) + '</button>';
    }).join('');
    Array.prototype.forEach.call(subfilterEl.children, function (el) {
      el.addEventListener('click', function () { state.group = el.getAttribute('data-group'); render(); });
    });
  }

  /* ---------- 列表过滤 ---------- */
  function matches(s) {
    if (state.cat !== 'all' && s.category !== state.cat) return false;
    if (state.group !== 'all' && s.group !== state.group) return false;
    var kw = state.keyword.trim().toLowerCase();
    if (kw) {
      var kwNoSpace = kw.replace(/\s+/g, '');
      var hay = [s.title, s.code, s.codeSearch, s.scope, s.group].join(' ').toLowerCase();
      if (hay.indexOf(kw) === -1 && hay.replace(/\s+/g, '').indexOf(kwNoSpace) === -1) return false;
    }
    return true;
  }

  /* ---------- 图集助手（部位→节点清单） ---------- */
  function matchParts(kw) {
    kw = kw.trim().toLowerCase();
    if (!kw) return [];
    return PARTS.map(function (p) {
      var score = 0;
      p.keys.forEach(function (k) { k = k.toLowerCase(); if (kw.indexOf(k) > -1 || k.indexOf(kw) > -1) score += 3; });
      if (p.name.toLowerCase().indexOf(kw) > -1) score += 3;
      p.items.forEach(function (it) {
        if (it.a.toLowerCase().indexOf(kw) > -1) score += 2;
        if (it.n && it.n.toLowerCase().indexOf(kw) > -1) score += 1;
        (it.atl || []).forEach(function (a) { if ((a[0] + a[1]).toLowerCase().indexOf(kw) > -1) score += 1; });
      });
      return { p: p, score: score };
    }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; }).map(function (x) { return x.p; });
  }

  function exampleChips() {
    var html = '';
    var recent = getRecent();
    if (recent.length) {
      html += '<div class="ex-group"><div class="ex-glabel">🕘 最近用过</div><div class="ex-wrap">' +
        recent.map(function (n) { var rp = partByName(n); return '<button class="ex-chip recent" data-topic="' + esc(n) + '">' + esc(shortLabel(rp)) + '</button>'; }).join('') + '</div></div>';
    }
    var order = ['主体部位', '构造专题', '结构'];
    var groups = {};
    PARTS.forEach(function (p) { var g = partGroup(p); (groups[g] = groups[g] || []).push(p); });
    html += order.filter(function (g) { return groups[g]; }).map(function (g) {
      return '<div class="ex-group"><div class="ex-glabel">' + g + '</div><div class="ex-wrap">' +
        groups[g].map(function (p) { return '<button class="ex-chip" data-topic="' + esc(p.name) + '">' + esc(shortLabel(p)) + '</button>'; }).join('') + '</div></div>';
    }).join('');
    return html;
  }

  function partCard(p, kw) {
    var items = p.items.map(function (it, i) {
      var hit = nodeHit(it, kw) ? ' node-hit' : '';
      var atl = (it.atl && it.atl.length)
        ? it.atl.map(function (a) {
            return '<a class="atlas-chip" target="_blank" rel="noopener" href="' + esc(baidu(a[0] + ' ' + a[1] + ' 中国建筑标准设计网')) + '"><b>' + esc(a[0]) + '</b> ' + esc(a[1]) + '</a>';
          }).join('')
        : '<div class="muted small">按专项/厂家图集或规范，无通用国标图集</div>';
      var codes = (it.c || []).map(function (c) {
        if (DATA_CODES[c]) return '<span class="code-chip" data-code="' + esc(c) + '">' + esc(c) + '</span>';
        return '<a class="code-chip" target="_blank" rel="noopener" href="' + esc(baidu(c + ' 住房和城乡建设部')) + '">' + esc(c) + '</a>';
      }).join('');
      return '<div class="node' + hit + '">' +
        '<div class="node-a"><span class="node-idx">' + (i + 1) + '</span>' + esc(it.a) + '</div>' +
        '<div class="node-atlas">' + atl + '</div>' +
        (it.n ? '<div class="node-note">' + esc(it.n) + '</div>' : '') +
        (codes ? '<div class="node-codes">' + codes + '</div>' : '') +
        '</div>';
    }).join('');
    return '<div class="part-card">' +
      '<div class="part-head"><div class="part-name">🏗️ ' + esc(p.name) + ' · 施工图节点清单</div>' +
      '<button class="copy-list" data-part="' + esc(p.name) + '">📋 复制清单</button></div>' +
      (p.intro ? '<div class="part-intro">' + esc(p.intro) + '</div>' : '') +
      '<div class="node-count">共 ' + p.items.length + ' 个节点，逐项核对</div>' +
      items +
      '<a class="topic-more" target="_blank" rel="noopener" href="' + esc(baidu(p.name + ' 图集 大样 做法 国家建筑标准设计')) + '">按“' + esc(p.name) + '”检索更多图集 ↗</a>' +
      '</div>';
  }

  function renderAssistant() {
    subfilterEl.innerHTML = '';
    var kw = state.keyword.trim();
    if (!kw) {
      metaEl.textContent = '输入部位，返回该部位施工图要考虑的全部节点清单，每项对应应参考的图集与规范，帮你查漏补缺。';
      listEl.innerHTML = DIR_BANNER + '<div class="assist-intro">选择部位：</div>' + exampleChips();
      emptyEl.hidden = true;
      bindAssist();
      return;
    }
    var exact = PARTS.filter(function (p) { return p.name === kw; });
    var hits = exact.length ? exact : matchParts(kw);
    if (hits.length) {
      var primary = hits[0];
      if (exact.length) recordRecent(primary.name);
      var related = hits.slice(1, 8);
      metaEl.textContent = '「' + shortLabel(primary) + '」施工图节点清单' + (related.length ? '　·　另有 ' + related.length + ' 个相关部位' : '');
      var relHtml = related.length
        ? '<div class="related"><span class="related-label">相关部位：</span>' + related.map(function (p) { return '<button class="ex-chip sm" data-topic="' + esc(p.name) + '">' + esc(shortLabel(p)) + '</button>'; }).join('') + '</div>'
        : '';
      listEl.innerHTML = DIR_BANNER + partCard(primary, kw) + relHtml;
    } else {
      metaEl.textContent = '未收录“' + kw + '”';
      listEl.innerHTML = '<div class="part-card"><div class="part-name">未收录“' + esc(kw) + '”</div>' +
        '<div class="muted small">试试按部位输入（如 地下室 / 屋面 / 外墙 / 卫生间），或直接检索图集：</div>' +
        '<a class="topic-more" target="_blank" rel="noopener" href="' + esc(baidu(kw + ' 图集 做法 国家建筑标准设计')) + '">检索“' + esc(kw) + '”相关图集 ↗</a>' +
        '<div class="assist-intro" style="margin-top:14px">换个部位：</div>' + exampleChips() + '</div>';
    }
    emptyEl.hidden = true;
    bindAssist();
  }

  function fbCopy(text, done) { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done && done(); } catch (e) {} document.body.removeChild(t); }
  function bindAssist() {
    Array.prototype.forEach.call(listEl.querySelectorAll('.ex-chip'), function (b) {
      b.addEventListener('click', function () {
        searchInput.value = b.getAttribute('data-topic'); state.keyword = searchInput.value;
        clearBtn.hidden = false; render();
      });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('.code-chip[data-code]'), function (b) {
      b.addEventListener('click', function () { openDetail(b.getAttribute('data-code')); });
    });
    Array.prototype.forEach.call(listEl.querySelectorAll('.copy-list'), function (b) {
      b.addEventListener('click', function () {
        var p = PARTS.filter(function (x) { return x.name === b.getAttribute('data-part'); })[0];
        if (!p) return;
        var txt = plainChecklist(p);
        var done = function () { b.textContent = '已复制 ✓'; setTimeout(function () { b.textContent = '📋 复制清单'; }, 1500); };
        if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(done, function () { fbCopy(txt, done); }); } else { fbCopy(txt, done); }
      });
    });
  }

  /* ---------- 主渲染 ---------- */
  function render() {
    Array.prototype.forEach.call(tabsEl.children, function (b) { b.classList.toggle('active', b.getAttribute('data-cat') === state.cat); });
    searchInput.placeholder = state.cat === 'assistant' ? ASSIST_PH : (state.cat === 'city' ? CITY_PH : DEFAULT_PH);
    if (state.cat === 'assistant') { renderAssistant(); return; }
    if (state.cat === 'city') { renderCity(); return; }

    renderSubfilter();
    var rows = DATA.filter(matches).sort(function (a, b) {
      return (a.category).localeCompare(b.category) || (a.sort - b.sort) || a.code.localeCompare(b.code);
    });
    metaEl.textContent = '共 ' + rows.length + ' 条' + (state.keyword ? '（搜索：' + state.keyword + '）' : '');
    emptyEl.hidden = rows.length > 0;
    listEl.innerHTML = rows.map(function (s) {
      var st = s.status === '现行' ? 'tag-current' : 'tag-abolished';
      var mand = s.mandatory ? '<span class="mand">强制性</span>' : '';
      var eff = s.effectiveDate ? s.effectiveDate + ' 实施' : '';
      return '<div class="std-item" data-code="' + esc(s.code) + '"><div class="std-top"><div class="std-name">' + esc(s.title) + '</div><span class="tag ' + st + '">' + esc(s.status) + '</span></div><div class="std-code">' + esc(s.code) + '</div><div class="std-metaline">' + esc(CAT_NAME[s.category] || '') + (s.group ? ' · ' + esc(s.group) : '') + (eff ? ' · ' + eff : '') + mand + (s.linkType ? ' <span class="lt-mini lt-' + esc(s.linkType) + '">' + esc((LINK_META[s.linkType] || {}).label || s.linkType) + '</span>' : '') + '</div></div>';
    }).join('');
    Array.prototype.forEach.call(listEl.children, function (el) {
      el.addEventListener('click', function () { openDetail(el.getAttribute('data-code')); });
    });
  }

  /* ---------- 我的离线库（IndexedDB 存 PDF，仅存本机、每人私有） ---------- */
  var IDB = (function () {
    var dbp = null;
    function open() {
      if (!window.indexedDB) return Promise.reject('no-idb');
      if (dbp) return dbp;
      dbp = new Promise(function (resolve, reject) {
        var req = indexedDB.open('guifanPDF', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('pdfs'); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
      return dbp;
    }
    function run(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction('pdfs', mode), store = t.objectStore('pdfs'), rq = fn(store);
          t.oncomplete = function () { resolve(rq ? rq.result : undefined); };
          t.onerror = function () { reject(t.error); };
        });
      });
    }
    return {
      get: function (k) { return run('readonly', function (s) { return s.get(k); }); },
      set: function (k, v) { return run('readwrite', function (s) { return s.put(v, k); }); },
      del: function (k) { return run('readwrite', function (s) { return s.delete(k); }); }
    };
  })();

  var MYLIB_HTML = '<div class="mylib"><div class="mylib-title">📁 我的离线库</div>' +
    '<div id="localPdfArea" class="mylib-area muted small">检查本地文件…</div>' +
    '<input id="pdfInput" type="file" accept="application/pdf" hidden></div>';

  function refreshLocalPdf(code) {
    var area = $('localPdfArea'); if (!area) return;
    if (!window.indexedDB) { area.textContent = '当前浏览器不支持离线库。'; return; }
    IDB.get(code).then(function (rec) {
      var a = $('localPdfArea'); if (!a) return;
      if (rec && rec.blob) {
        var mb = (rec.blob.size / 1048576).toFixed(1);
        a.innerHTML = '<button class="d-pdf mylib-open">📄 打开我的PDF（离线）</button>' +
          '<button class="mylib-del">🗑 删除本地文件</button>' +
          '<div class="mylib-name">已存：' + esc(rec.name || 'PDF') + '（' + mb + 'MB·仅存本机）</div>';
        a.querySelector('.mylib-open').addEventListener('click', function () {
          var u = URL.createObjectURL(rec.blob); window.open(u, '_blank');
          setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
        });
        a.querySelector('.mylib-del').addEventListener('click', function () { IDB.del(code).then(function () { refreshLocalPdf(code); }); });
      } else {
        a.innerHTML = '<button class="mylib-import">📂 导入本规范PDF（离线保存）</button>' +
          '<div class="mylib-hint">导入后离线可看、不再重复下载；文件只存在你自己的手机/浏览器里。</div>';
        a.querySelector('.mylib-import').addEventListener('click', function () {
          var inp = $('pdfInput'); if (!inp) return;
          inp.onchange = function () {
            var f = inp.files && inp.files[0]; if (!f) return;
            var btn = $('localPdfArea').querySelector('.mylib-import'); if (btn) btn.textContent = '正在保存…';
            IDB.set(code, { name: f.name, blob: f }).then(function () { refreshLocalPdf(code); }, function () { if (btn) btn.textContent = '保存失败，请重试'; });
            inp.value = '';
          };
          inp.click();
        });
      }
    }, function () { var a2 = $('localPdfArea'); if (a2) a2.textContent = '离线库不可用。'; });
  }

  /* ---------- 关于 / 我的离线库总览 ---------- */
  function idbAll() {
    if (!window.indexedDB) return Promise.resolve([]);
    return new Promise(function (resolve) {
      var req = indexedDB.open('guifanPDF', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('pdfs'); };
      req.onsuccess = function () {
        var db = req.result, t = db.transaction('pdfs', 'readonly'), store = t.objectStore('pdfs'), out = [];
        var c = store.openCursor();
        c.onsuccess = function () { var cur = c.result; if (cur) { out.push({ code: cur.key, name: (cur.value && cur.value.name) || '', size: (cur.value && cur.value.blob) ? cur.value.blob.size : 0 }); cur.continue(); } };
        t.oncomplete = function () { resolve(out); };
      };
      req.onerror = function () { resolve([]); };
    });
  }
  function renderLibList() {
    var a0 = $('libArea'); if (!a0) return;
    idbAll().then(function (list) {
      var el = $('libArea'); if (!el) return;
      if (!list.length) { el.innerHTML = '还没有导入 PDF。在任意规范详情页点“📂 导入本规范PDF”即可建立你的离线库。'; return; }
      var total = list.reduce(function (m, x) { return m + x.size; }, 0);
      var rows = list.map(function (x) {
        return '<div class="lib-row"><div class="lib-info"><b>' + esc(x.code) + '</b><span>' + esc(x.name || 'PDF') + ' · ' + (x.size / 1048576).toFixed(1) + 'MB</span></div>' +
          '<button class="lib-open" data-code="' + esc(x.code) + '">打开</button><button class="lib-del" data-code="' + esc(x.code) + '">删除</button></div>';
      }).join('');
      el.innerHTML = '<div class="lib-total">已存 ' + list.length + ' 本 · 共 ' + (total / 1048576).toFixed(1) + ' MB（仅存本机）</div>' + rows + '<button class="lib-clear">🗑 全部清空</button>';
      Array.prototype.forEach.call(el.querySelectorAll('.lib-open'), function (b) { b.addEventListener('click', function () { IDB.get(b.getAttribute('data-code')).then(function (rec) { if (rec && rec.blob) { var u = URL.createObjectURL(rec.blob); window.open(u, '_blank'); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); } }); }); });
      Array.prototype.forEach.call(el.querySelectorAll('.lib-del'), function (b) { b.addEventListener('click', function () { IDB.del(b.getAttribute('data-code')).then(renderLibList); }); });
      el.querySelector('.lib-clear').addEventListener('click', function () { if (!window.confirm('确定清空全部离线 PDF？')) return; Promise.all(list.map(function (x) { return IDB.del(x.code); })).then(renderLibList); });
    });
  }
  function openAbout() {
    var html = '<div class="d-title">关于 · 我的库</div>' +
      '<div class="about-sec">📁 我的离线库</div><div id="libArea" class="about-lib muted small">读取中…</div>' +
      '<div class="about-sec">📖 使用说明</div><div class="about-text"><b>常用规范</b>：搜名称或编号（GB 55001 / GB55001 都行），看状态、实施日期、替代关系；GB55 强制性规范可开官方免费 PDF，其余可检索或导入自己的 PDF。<br><b>图集助手</b>：输入部位（地下室/屋面/外墙…），返回该部位施工图要考虑的节点清单，每项对应应参考的图集，帮你查漏补缺。<br><b>城市规定</b>：选城市，列出做该城市项目要收集的地方资料清单，官方政府网（gov.cn）检索直达。</div>' +
      '<div class="about-sec">🔒 数据来源</div><div class="about-text">规范编号/状态/日期对照住建部、中国政府网核对；图集对照中国建筑标准设计网现行目录；城市资料限定政府网检索。仅供查阅参考，请以官方最新发布为准。</div>' +
      '<div class="about-sec">💾 关于离线库</div><div class="about-text">导入的 PDF 只存在你自己的手机/浏览器本地，私有、离线可用；清除浏览器数据或换设备会清空。建议先导入最常用的十几本。</div>';
    $('detailBody').innerHTML = html;
    $('detailMask').hidden = false; document.body.style.overflow = 'hidden';
    renderLibList();
  }

  /* ---------- 详情 ---------- */
  function openDetail(code) {
    var s = DATA.filter(function (x) { return x.code === code; })[0];
    if (!s) return;
    var st = s.status === '现行' ? 'tag-current' : 'tag-abolished';
    var rows = '';
    function row(k, v) { if (!v) return ''; return '<div class="d-row"><span class="d-k">' + k + '</span><span class="d-v">' + esc(v) + '</span></div>'; }
    rows += row('发布单位', s.publisher); rows += row('实施日期', s.effectiveDate);
    rows += row('替代旧版', s.replaces); rows += row('适用范围', s.scope);
    var lm = LINK_META[s.linkType] || LINK_META['公告'];
    var html = '<div class="d-title">' + esc(s.title) + '</div><div class="d-code">' + esc(s.code) + '</div>' +
      '<div class="d-tags"><span class="tag ' + st + '">' + esc(s.status) + '</span>' + (s.mandatory ? '<span class="tag tag-abolished">强制性</span>' : '') + (s.group ? '<span class="tag tag-new">' + esc(s.group) + '</span>' : '') + '</div>' +
      '<div class="d-rows">' + rows + '</div>' + (s.summary ? '<div class="d-summary">' + esc(s.summary) + '</div>' : '') +
      (s.pdfUrl ? '<a class="d-pdf" href="' + esc(s.pdfUrl) + '" target="_blank" rel="noopener">📄 打开官方 PDF（免费全文·可保存离线）↗</a>' : '') +
      (s.officialUrl ? '<div class="d-linktype"><span class="lt-badge lt-' + esc(s.linkType) + '">' + esc(lm.label) + '</span><span class="lt-hint">' + esc(lm.hint) + '</span></div><a class="d-link" href="' + esc(s.officialUrl) + '" target="_blank" rel="noopener">' + esc(lm.btn) + '</a><button class="d-copy" data-url="' + esc(s.officialUrl) + '">复制搜索链接</button>' : '<div class="d-url">暂无链接，可自行检索该编号。</div>');
    html += MYLIB_HTML;
    $('detailBody').innerHTML = html;
    refreshLocalPdf(s.code);
    var copyBtn = $('detailBody').querySelector('.d-copy');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var url = copyBtn.getAttribute('data-url');
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(toastCopied, function () { fallbackCopy(url); }); else fallbackCopy(url);
    });
    $('detailMask').hidden = false; document.body.style.overflow = 'hidden';
  }
  function closeDetail() { $('detailMask').hidden = true; document.body.style.overflow = ''; }
  function toastCopied() { var b = $('detailBody').querySelector('.d-copy'); if (b) { b.textContent = '已复制 ✓'; setTimeout(function () { b.textContent = '复制搜索链接'; }, 1500); } }
  function fallbackCopy(text) { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toastCopied(); } catch (e) {} document.body.removeChild(t); }

  /* ---------- 事件 ---------- */
  Array.prototype.forEach.call(tabsEl.children, function (b) {
    b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); state.group = 'all'; state.keyword = ''; searchInput.value = ''; clearBtn.hidden = true; render(); });
  });
  searchInput.addEventListener('input', function () { state.keyword = searchInput.value; clearBtn.hidden = !searchInput.value; render(); });
  clearBtn.addEventListener('click', function () { searchInput.value = ''; state.keyword = ''; clearBtn.hidden = true; render(); searchInput.focus(); });
  $('detailClose').addEventListener('click', closeDetail);
  $('detailMask').addEventListener('click', function (e) { if (e.target === $('detailMask')) closeDetail(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

  /* ---------- PWA 安装 ---------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; $('installBtn').hidden = false; });
  $('installBtn').addEventListener('click', function () {
    if (!deferredPrompt) return; deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () { deferredPrompt = null; $('installBtn').hidden = true; });
  });
  window.addEventListener('appinstalled', function () { $('installBtn').hidden = true; });
  if ($('aboutBtn')) $('aboutBtn').addEventListener('click', openAbout);

  renderUpdates();
  render();
})();
