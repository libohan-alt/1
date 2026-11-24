/* =========================================================
 * app.js — 旧版完整界面与交互逻辑
 * 当前 two/three/four/five.html 使用 quiz-mini.js，不加载本文件。
 * 本文件暂时保留，以免删除旧版完整界面实现。
 * 依赖 engine.js 和 data.js 先加载。
 * ========================================================= */

/* =========================================================
   图标
   ========================================================= */
var P = {
  mark:'<path d="M5 7h14M12 7v10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  sort:'<path d="M3 6h18M6.5 12h11M10 18h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  time:'<path d="M3 12h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M17 9l3 3-3 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="12" r="2.6" fill="currentColor"/>',
  search:'<circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="1.7"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  timer:'<circle cx="12" cy="13" r="7.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 9.5V13l2.5 1.8M9 3h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  check:'<path d="M4 12.5l5 5L20 6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  cross:'<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  back:'<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  chev:'<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  next:'<path d="M4 12h14M14 6l6 6-6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  reset:'<path d="M20 12a8 8 0 1 1-2.4-5.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 4v4.5h-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  gear:'<circle cx="12" cy="12" r="3.1" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.8v2.1M12 19.1v2.1M4.4 4.4l1.5 1.5M18.1 18.1l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.4 19.6l1.5-1.5M18.1 5.9l1.5-1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
};
function svg(n, s){
  s = s || 16;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + P[n] + '</svg>';
}

/* =========================================================
   关卡配置
   ========================================================= */
var LEVELS = [
  { id:1, type:'sort', icon:'sort', mono:true, title:'already / just / yet' },
  { id:2, type:'sort', icon:'time', mono:true, title:'for / since', timeline:true },
  { id:3, type:'choice', icon:'search', mono:true, title:'been to / gone to' },
  { id:4, type:'timed', icon:'timer', title:'综合练习' }
];

var PER_ROUND = 10;

/* =========================================================
   通用
   ========================================================= */
var STORE_KEY = 'tenselab.v3';
var progress = loadProgress();

function loadProgress(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e){ return {}; }
}
function saveProgress(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e){}
}
function $(s){ return document.querySelector(s); }
function el(tag, cls, html){
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
function showScreen(name){
  ['home','level','result'].forEach(function(n){
    $('#screen-' + n).style.display = (n === name ? '' : 'none');
  });
  document.body.classList.toggle('quiz', name === 'level');
  window.scrollTo({ top:0, behavior:'smooth' });
}
function setProgress(cur, total){
  $('#lvProgText').textContent = (cur < 10 ? '0' + cur : cur) + ' / ' + total;
  var box = $('#lvSegs');
  if (box.childElementCount !== total){
    box.innerHTML = '';
    for (var i = 0; i < total; i++) box.appendChild(document.createElement('i'));
  }
  Array.prototype.forEach.call(box.children, function(c, i){
    c.className = (i < cur ? 'on' : '');
  });
}
function pick(pool, n){
  var a = pool.slice(), out = [];
  for (var i = 0; i < n && a.length; i++){
    out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  }
  return out;
}
function sentHTML(s){
  return s.replace('___', '<span class="bl">___</span>');
}
function blankHTML(s){
  return s.replace('___', '<span class="bl"></span>');
}

/* =========================================================
   首页
   ========================================================= */
$('#markIcon').innerHTML = svg('mark', 17);
$('#btnReset').innerHTML = svg('reset', 13) + '<span>重置记录</span>';
$('#btnBack').innerHTML = svg('back', 15);

function renderHome(){
  var grid = $('#levelGrid');
  grid.innerHTML = '';
  LEVELS.forEach(function(lv){
    var rec = progress[lv.id] || {};
    var li = el('li');
    li.innerHTML =
      '<button class="lvrow">' +
        '<span class="ico">' + svg(lv.icon, 17) + '</span>' +
        '<span class="body"><b class="' + (lv.mono ? 'mono' : '') + '">' + lv.title + '</b></span>' +
        '<span class="dot' + (rec.done ? ' on' : '') + '"></span>' +
        '<span class="chev">' + svg('chev', 15) + '</span>' +
      '</button>';
    li.querySelector('button').addEventListener('click', function(){ startLevel(lv.id); });
    grid.appendChild(li);
  });
}

function startLevel(id){
  var lv = LEVELS.filter(function(l){ return l.id === id; })[0];
  $('#lvTitle').textContent = lv.title;
  $('#lvTitle').className = lv.mono ? 'mono' : '';
  var body = $('#lvBody');
  body.innerHTML = '';
  showScreen('level');
  setProgress(0, PER_ROUND);

  if (lv.type === 'sort') buildSort(body, lv, pick(BANK[lv.id], PER_ROUND));
  else if (lv.type === 'choice') buildChoice(body, lv, pick(BANK[3], PER_ROUND));
  else buildTimed(body, lv);
}

/* 环形进度图 */
function ring(pct, size){
  size = size || 76;
  var r = size / 2 - 5, c = 2 * Math.PI * r;
  var off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#e9e9ee" stroke-width="4"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="currentColor" ' +
    'stroke-width="4" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" ' +
    'stroke-dashoffset="' + off.toFixed(1) + '" ' +
    'transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
}

/* =========================================================
   鼓励语句池：对错各 30 × 18 = 540 条
   ========================================================= */

function encourage(ok){
  var A = ok ? ENC_OK_A : ENC_NO_A;
  var B = ok ? ENC_OK_B : ENC_NO_B;
  return A[Math.floor(Math.random() * A.length)] + '，' +
         B[Math.floor(Math.random() * B.length)] + '。';
}

/* ---------- 轻提示 ---------- */
var CFG_KEY = 'tenselab.cfg';
var CFG = (function(){
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
})();
if (!CFG.toast) CFG.toast = 'top';
function saveCfg(){
  try { localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); } catch (e) {}
}

function toast(ok, text){
  if (CFG.toast === 'off') return;
  var t = el('div', 'toast ' + CFG.toast + ' ' + (ok ? 'ok' : 'no'),
    (ok ? svg('check', 13) : svg('cross', 13)) + '<span>' + text + '</span>');
  document.body.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add('in'); });
  setTimeout(function(){
    t.classList.remove('in');
    setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, 200);
  }, 1500);
}

/* ---------- 题解 ---------- */
function fillAnswer(sent, word){
  return sentHTML(sent).replace('<span class="bl">___</span>',
    '<b class="ans">' + word + '</b>');
}

function solutionPanel(log){
  var sec = el('div', 'sec');
  sec.appendChild(el('div', 'h', '题解'));
  var box = el('div', 'sol');
  log.forEach(function(e){
    var item = e.item;
    var right = item.opts[item.idx];
    var ok = (e.picked === right);
    var row = el('div', 'solrow' + (ok ? ' ok' : ''));
    row.innerHTML =
      '<div class="sh">' +
        '<span class="b ' + (ok ? 'ok' : 'no') + '">' + (ok ? svg('check', 11) : svg('cross', 11)) + '</span>' +
        '<span class="ss">' + fillAnswer(item.sent, right) + '</span>' +
      '</div>' +
      (ok ? '' : '<div class="sr">你选了 <span class="mono">' + e.picked + '</span></div>') +
      '<p class="sw">' + item.why + '</p>';
    box.appendChild(row);
  });
  sec.appendChild(box);
  return sec;
}

/* ---------- 结算视图 ---------- */
function resultView(lv, correct, total, log, actions){
  var rate = Math.round(correct / total * 100);
  var rec = progress[lv.id] || {};
  rec.done = true;
  rec.best = Math.max(rec.best || 0, correct);
  progress[lv.id] = rec;
  saveProgress();

  var p = el('div', 'panel res');
  p.innerHTML = '<div class="res-top">' +
      '<div class="ringwrap">' + ring(rate) + '<span class="val">' + rate + '<i>%</i></span></div>' +
      '<p class="fin mono">' + correct + ' / ' + total + '</p>' +
    '</div>';
  p.appendChild(solutionPanel(log));

  var box = el('div', 'actions');
  actions.forEach(function(a){
    var b = el('button', 'btn ' + a.cls, a.html);
    b.onclick = a.fn;
    box.appendChild(b);
  });
  p.appendChild(box);
  return p;
}

/* =========================================================
   关卡 1 / 2：一屏一题
   ========================================================= */
function buildSort(root, lv, items){
  var idx = 0, log = [], closed = false;
  var panel = el('div', 'panel');
  var holder = el('div', 'card-holder');
  panel.appendChild(holder);

  var tl = null;
  if (lv.timeline){
    tl = el('div', 'tl');
    tl.innerHTML = '<div class="axis"></div>' +
      '<div class="caps"><span>过去</span><span>现在</span></div>' +
      '<div class="items"><span class="empty"><i class="gd"></i> since　<i class="gb"></i> for</span></div>';
    panel.appendChild(tl);
  }
  root.appendChild(panel);

  var sdrag = null;

  function bindDrag(b, isLocked, onDrop){
    var sx = 0, sy = 0, moved = false;

    b.addEventListener('pointerdown', function(e){
      if (isLocked() || e.pointerType !== 'mouse') return;
      sx = e.clientX; sy = e.clientY; moved = false;
      sdrag = { el:b, sx:sx, sy:sy, ghost:null };
      // 捕获指针：否则光标一旦离开按钮，pointermove 就不再派发，拖拽会中断
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
    });

    b.addEventListener('pointermove', function(e){
      if (!sdrag || sdrag.el !== b) return;
      var dx = e.clientX - sdrag.sx, dy = e.clientY - sdrag.sy;
      if (!moved && Math.sqrt(dx * dx + dy * dy) > 5){ moved = true; startChip(); }
      if (moved) moveChip(e);
    });

    b.addEventListener('pointerup', function(e){
      if (!sdrag || sdrag.el !== b) return;
      var dropped = false;
      if (moved) dropped = endChip(e);
      clearHot();
      try { b.releasePointerCapture(e.pointerId); } catch (err) {}
      sdrag = null;
      if (dropped && !isLocked()) onDrop();
    });

    b.addEventListener('pointercancel', function(e){
      if (sdrag && sdrag.ghost) sdrag.ghost.remove();
      clearHot();
      try { b.releasePointerCapture(e.pointerId); } catch (err) {}
      sdrag = null;
    });

    function startChip(){
      var r = b.getBoundingClientRect();
      sdrag.ox = sdrag.sx - r.left;
      sdrag.oy = sdrag.sy - r.top;
      sdrag.rect = r;
      var g = b.cloneNode(true);
      g.className = 'slot ghostchip';
      g.style.width = r.width + 'px';
      g.style.height = r.height + 'px';
      g.style.transform = 'translate3d(' + r.left + 'px,' + r.top + 'px,0)';
      document.body.appendChild(g);
      sdrag.ghost = g;
      b.classList.add('dragging');
    }

    function moveChip(e){
      if (!sdrag.ghost) return;
      var x = e.clientX - sdrag.ox, y = e.clientY - sdrag.oy;
      sdrag.ghost.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(1.04)';
      var bl = blankUnder(e.clientX, e.clientY);
      Array.prototype.forEach.call(document.querySelectorAll('.bl.hot'), function(o){
        if (o !== bl) o.classList.remove('hot');
      });
      if (bl) bl.classList.add('hot');
    }

    function endChip(e){
      var bl = blankUnder(e.clientX, e.clientY);
      var g = sdrag.ghost, rect = sdrag.rect;
      b.classList.remove('dragging');
      if (g){
        if (bl) g.remove();
        else {
          g.classList.add('back');
          g.style.transform = 'translate3d(' + rect.left + 'px,' + rect.top + 'px,0) scale(.96)';
          g.style.opacity = '0';
          setTimeout(function(){ g.remove(); }, 190);
        }
      }
      return !!bl;
    }
  }

  function blankUnder(x, y){
    var n = document.elementFromPoint(x, y);
    if (!n || !n.closest) return null;
    var bl = n.closest('.bl');
    return (bl && document.contains(bl)) ? bl : null;
  }

  function clearHot(){
    Array.prototype.forEach.call(document.querySelectorAll('.bl.hot'), function(b){
      b.classList.remove('hot');
    });
  }

  function render(){
    holder.innerHTML = '';
    setProgress(idx, items.length);

    var item = items[idx];
    var wrap = el('div', 'qwrap');

    wrap.appendChild(el('p', 'q big',
      blankHTML(item.sent) + (item.cn ? ' <span class="cn">（' + item.cn + '）</span>' : '')));

    var slots = el('div', 'slots wide');
    var answered = false;

    function locked(){ return answered || closed; }

    function judge(picked){
      var right = item.opts[item.idx];
      var ok = (picked === right);
      log.push({ item:item, picked:picked });
      toast(ok, encourage(ok));

      Array.prototype.forEach.call(slots.children, function(x){
        x.disabled = true;
        if (x.dataset.bin === right) x.classList.add('pick-right');
        else if (x.dataset.bin === picked) x.classList.add('pick-wrong');
      });

      var bl = wrap.querySelector('.bl');
      if (bl){
        bl.textContent = right;
        bl.classList.add(ok ? 'fill-ok' : 'fill-no');
      }
      if (!ok){
        wrap.appendChild(el('div', 'picked-hint',
          '你选了 <span class="mono">' + picked + '</span>'));
      }
      if (tl) markTl(right);

      setTimeout(function(){
        if (closed) return;
        if (idx < items.length - 1){ idx++; render(); }
        else finish();
      }, ok ? 750 : 1250);
    }

    item.opts.forEach(function(o){
      var b = el('button', 'slot', o);
      b.dataset.bin = o;
      b.addEventListener('click', function(){
        if (locked()) return;
        answered = true;
        judge(o);
      });
      bindDrag(b, locked, function(){
        answered = true;
        judge(b.dataset.bin);
      });
      slots.appendChild(b);
    });

    wrap.appendChild(slots);
    holder.appendChild(wrap);
  }

  function markTl(word){
    var box = tl.querySelector('.items');
    box.innerHTML = '';
    box.appendChild(el('span', 'm',
      '<i class="' + (word === 'for' ? 'gb' : 'gd') + '"></i><span><b>' + word + '</b></span>'));
  }

  function finish(){
    closed = true;
    document.body.classList.remove('quiz');
    root.innerHTML = '';
    var correct = log.filter(function(l){ return l.picked === l.item.opts[l.item.idx]; }).length;
    root.appendChild(resultView(lv, correct, items.length, log, [{
      cls:'pri',
      html:(lv.id < 4 ? '下一关' : '返回') + svg('next', 13),
      fn:function(){
        if (lv.id < 4) startLevel(lv.id + 1);
        else { renderHome(); showScreen('home'); }
      }
    }, {
      cls:'sec', html:svg('reset', 13),
      fn:function(){ startLevel(lv.id); }
    }]));
    setProgress(items.length, items.length);
  }

  render();
}

/* =========================================================
   关卡 3：情景选择
   ========================================================= */
function buildChoice(root, lv, items){
  var idx = 0, log = [];
  var panel = el('div', 'panel');
  var holder = el('div');
  panel.appendChild(holder);
  root.appendChild(panel);

  function render(){
    holder.innerHTML = '';
    setProgress(idx, items.length);

    var q = items[idx];
    var wrap = el('div', 'qwrap');
    wrap.appendChild(el('p', 'q', blankHTML(q.sent)));

    var opts = el('div', 'opts');
    var answered = false;

    q.opts.forEach(function(text, i){
      var b = el('button', 'opt',
        '<span class="k mono">' + 'ABCD'[i] + '</span>' +
        '<span class="tx mono">' + text + '</span>' +
        '<span class="st">' + svg('check', 15) + '</span>');
      b.onclick = function(){
        if (answered) return;
        answered = true;
        var ok = (i === q.idx);
        log.push({ item:q, picked:text });
        toast(ok, encourage(ok));

        Array.prototype.forEach.call(opts.children, function(x, j){
          x.disabled = true;
          if (j === q.idx){
            x.classList.add('right');
            x.querySelector('.st').innerHTML = svg('check', 15);
          } else if (j === i){
            x.classList.add('wrong');
            x.querySelector('.st').innerHTML = svg('cross', 15);
          }
        });

        setTimeout(function(){
          if (idx < items.length - 1){ idx++; render(); }
          else finish();
        }, ok ? 650 : 1150);
      };
      opts.appendChild(b);
    });

    wrap.appendChild(opts);
    holder.appendChild(wrap);
  }

  function finish(){
    var correct = log.filter(function(l){ return l.picked === l.item.opts[l.item.idx]; }).length;
    document.body.classList.remove('quiz');
    root.innerHTML = '';
    root.appendChild(resultView(lv, correct, items.length, log, [{
      cls:'pri', html:'综合' + svg('next', 13),
      fn:function(){ startLevel(4); }
    }, {
      cls:'sec', html:svg('reset', 13),
      fn:function(){ startLevel(lv.id); }
    }]));
    setProgress(items.length, items.length);
  }

  render();
}

/* =========================================================
   关卡 4：限时综合
   ========================================================= */
function buildTimed(root, lv){
  var all = BANK[1].concat(BANK[2]).concat(BANK[3]);
  var items = pick(all, PER_ROUND);
  var idx = 0, log = [];
  var LIMIT = 60;
  var remain = LIMIT;
  var raf = null, over = false;

  var panel = el('div', 'panel');
  root.appendChild(panel);

  var timer = el('div', 'timer',
    svg('timer', 15) + '<span class="num">' + LIMIT + '</span>' +
    '<span class="bar"><b style="transform:scaleX(1)"></b></span>');
  panel.appendChild(timer);
  var holder = el('div');
  panel.appendChild(holder);

  var numEl = timer.querySelector('.num');
  var barEl = timer.querySelector('.bar b');

  var t0 = performance.now();
  function loop(t){
    if (over) return;
    remain = Math.max(0, LIMIT - (t - t0) / 1000);
    numEl.textContent = Math.ceil(remain);
    barEl.style.transform = 'scaleX(' + (remain / LIMIT).toFixed(4) + ')';
    if (remain <= 10) timer.classList.add('warn');
    if (remain <= 0){ finish(); return; }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function render(){
    holder.innerHTML = '';
    setProgress(idx, items.length);

    var q = items[idx];
    var wrap = el('div', 'qwrap');
    wrap.appendChild(el('p', 'q', blankHTML(q.sent) +
      (q.cn ? ' <span class="cn">（' + q.cn + '）</span>' : '')));

    var opts = el('div', 'opts');
    var answered = false;

    q.opts.forEach(function(text, i){
      var b = el('button', 'opt',
        '<span class="k mono">' + 'ABCD'[i] + '</span>' +
        '<span class="tx mono">' + text + '</span>' +
        '<span class="st">' + svg('check', 15) + '</span>');
      b.onclick = function(){
        if (answered || over) return;
        answered = true;
        var ok = (i === q.idx);
        log.push({ item:q, picked:text });
        toast(ok, encourage(ok));

        Array.prototype.forEach.call(opts.children, function(x, j){
          x.disabled = true;
          if (j === q.idx){
            x.classList.add('right');
            x.querySelector('.st').innerHTML = svg('check', 15);
          } else if (j === i){
            x.classList.add('wrong');
            x.querySelector('.st').innerHTML = svg('cross', 15);
          }
        });

        setTimeout(function(){
          if (over) return;
          if (idx < items.length - 1){ idx++; render(); }
          else finish();
        }, ok ? 700 : 1200);
      };
      opts.appendChild(b);
    });

    wrap.appendChild(opts);
    holder.appendChild(wrap);
  }

  function finish(){
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);

    var correct = log.filter(function(l){ return l.picked === l.item.opts[l.item.idx]; }).length;
    var body = $('#resultBody');
    body.className = '';
    body.innerHTML = '';
    body.appendChild(resultView(lv, correct, items.length, log, [{
      cls:'pri', html:svg('reset', 13), fn:function(){ startLevel(4); }
    }, {
      cls:'sec', html:svg('back', 13),
      fn:function(){ renderHome(); showScreen('home'); }
    }]));
    showScreen('result');
  }

  render();
}

/* =========================================================
   启动
   ========================================================= */
$('#btnBack').addEventListener('click', function(){
  renderHome(); showScreen('home');
});
$('#btnReset').addEventListener('click', function(){
  if (!confirm('清空所有闯关记录？')) return;
  progress = {};
  saveProgress();
  renderHome();
});

/* ---------- 设置菜单 ---------- */
(function initSettings(){
  var btn = $('#btnSet');
  btn.innerHTML = svg('gear', 14);
  var menu = null;

  function close(){
    if (menu){ menu.parentNode.removeChild(menu); menu = null; }
  }

  btn.addEventListener('click', function(e){
    e.stopPropagation();
    if (menu){ close(); return; }

    menu = el('div', 'menu');
    menu.innerHTML = '<div class="mh">鼓励提示</div>' +
      [['top', '顶部'], ['bottom', '底部'], ['off', '关闭']].map(function(o){
        return '<button data-v="' + o[0] + '" class="' + (CFG.toast === o[0] ? 'on' : '') + '">' +
          '<span>' + o[1] + '</span><span class="tk">' + svg('check', 13) + '</span></button>';
      }).join('');
    document.querySelector('.hd').appendChild(menu);

    Array.prototype.forEach.call(menu.querySelectorAll('button'), function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        CFG.toast = b.dataset.v;
        saveCfg();
        close();
        if (CFG.toast !== 'off') toast(true, encourage(true));
      });
    });
  });

  document.addEventListener('pointerdown', function(e){
    if (!menu) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    close();
  }, true);
})();

/* =========================================================
   对外 API：window.QuizLab
   ---------------------------------------------------------
   QuizLab.build('c1', 3)   → Item[]           同步拿题
   QuizLab.ask('c2')        → Promise<boolean> 渲染一题，等点击，返回对错
   QuizLab.run('c3', 5)     → Promise<{correct,total,log}>
   QuizLab.tokens()         → ['c1','c2','c3','all']

   令牌：c1 / c2 / c3 / all，也可以传关卡序号 1 / 2 / 3。
   用户点击是异步的，所以只能返回 Promise —— JS 没办法"卡住"等一次点击。
   ========================================================= */
var QuizLab = (function () {

  var mount = null;

  function spec(token){
    var t = TOKENS[token];
    if (!t && typeof token === 'number') t = TOKENS['c' + token];
    if (!t){
      throw new Error('未知令牌: ' + token +
        '（可用：' + Object.keys(TOKENS).join(' / ') + '）');
    }
    return t;
  }

  function source(token){
    var s = spec(token);
    return s.items || s.pool;
  }

  /** 同步出题：从指定令牌的题池里抽 count 道 */
  function build(token, count){
    return pick(source(token), count || 1);
  }

  /** 渲染一道题，等用户点击，返回 Promise<boolean>（答对为 true） */
  function ask(token){
    return new Promise(function (resolve) {
      var item = build(token, 1)[0];

      var stale = document.getElementById('askMount');   // 上一次没清干净的先移除
      if (stale) stale.parentNode.removeChild(stale);

      var prev = 'home';
      ['home', 'level', 'result'].forEach(function (n){
        if (document.getElementById('screen-' + n).style.display !== 'none') prev = n;
      });

      mount = el('div', 'panel');
      mount.id = 'askMount';
      document.querySelector('.wrap').appendChild(mount);

      ['home', 'level', 'result'].forEach(function (n){
        document.getElementById('screen-' + n).style.display = 'none';
      });
      document.body.classList.add('quiz');

      var wrap = el('div', 'qwrap');
      wrap.appendChild(el('p', 'q big',
        blankHTML(item.sent) + (item.cn ? ' <span class="cn">（' + item.cn + '）</span>' : '')));

      var slots = el('div', 'slots wide');
      var done = false;

      item.opts.forEach(function (o){
        var b = el('button', 'slot', o);
        b.addEventListener('click', function (){
          if (done) return;
          done = true;

          var ok = (o === item.opts[item.idx]);

          Array.prototype.forEach.call(slots.children, function (x){
            x.disabled = true;
            if (x.textContent === item.opts[item.idx]) x.classList.add('pick-right');
            else if (x === b) x.classList.add('pick-wrong');
          });
          var bl = wrap.querySelector('.bl');
          if (bl){
            bl.textContent = item.opts[item.idx];
            bl.classList.add(ok ? 'fill-ok' : 'fill-no');
          }

          setTimeout(function (){
            var m = document.getElementById('askMount');
            if (m) m.parentNode.removeChild(m);
            mount = null;
            if (prev === 'home') renderHome();
            showScreen(prev);        // 用统一的切屏逻辑恢复，顺带还原 body.quiz
            resolve(ok);             // ★ 布尔值从这里返回
          }, ok ? 450 : 900);
        });
        slots.appendChild(b);
      });

      wrap.appendChild(slots);
      mount.appendChild(wrap);
    });
  }

  /** 连续 n 道题，全部答完返回统计 */
  function run(token, count){
    var n = count || 5, i = 0, correct = 0, log = [];
    function next(){
      if (i >= n) return Promise.resolve({ correct: correct, total: n, log: log });
      return ask(token).then(function (ok){
        i++;
        if (ok) correct++;
        log.push(ok);
        return next();
      });
    }
    return next();
  }

  return {
    build: build,
    ask: ask,
    run: run,
    tokens: function (){ return Object.keys(TOKENS); }
  };
})();

window.QuizLab = QuizLab;

renderHome();
