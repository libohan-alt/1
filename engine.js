/* =========================================================
 * engine.js — 出题算法（与科目无关）
 *
 * 输入：一份「规则」数组（每关一套）
 * 输出：Item[]，结构 { sent, cn, opts, idx, why }
 *
 * 本文件不认识「英语」「现在完成时」，也不接触 DOM。
 * 换科目 = 换 data.js 里的规则，这里一行不改。
 * ========================================================= */

var Engine = (function () {

  /* ---------- 32 位确定性伪随机（同种子必同序列） ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- Fisher–Yates 洗牌（严格等概率，不改原数组） ---------- */
  function seededShuffle(arr, seed) {
    var r = mulberry32(seed), a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- 单题的四个选项 ----------
   * correct  正确答案
   * pool     干扰词池
   * mustHave 必含的易混项（教学意图，不是随机）
   * take     另外再抽几个
   * 返回 { opts, idx }，写回 o
   */
  function withOpts(o, correct, pool, seed, mustHave, take) {
    var r = mulberry32(((seed * 2654435761) % 2147483647) + 7);
    mustHave = mustHave || [];
    if (take === undefined) take = 3;

    var extras = pool.filter(function (x) {
      return x !== correct && mustHave.indexOf(x) < 0;
    });
    for (var i = extras.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = extras[i]; extras[i] = extras[j]; extras[j] = t;
    }

    var all = [correct].concat(mustHave, extras.slice(0, take));
    for (var k = all.length - 1; k > 0; k--) {
      var m = Math.floor(r() * (k + 1));
      var tmp = all[k]; all[k] = all[m]; all[m] = tmp;
    }

    o.opts = all;
    o.idx = all.indexOf(correct);
    return o;
  }

  /* ---------- 工具 ---------- */
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /** 规则里的值可以是常量，也可以是函数 (row, each, i) => 值 */
  function val(v, row, item, i) {
    return typeof v === 'function' ? v(row, item, i) : v;
  }

  /* ---------- 展开：多轴笛卡尔积 ----------
   * axes = [{ name:'v', list:V1 }, { name:'f', list:F1 }]
   * → [{ v:…, f:… }, …]，第一个轴变化最慢
   */
  function expand(axes) {
    return axes.reduce(function (acc, axis) {
      var out = [];
      acc.forEach(function (prefix) {
        axis.list.forEach(function (v) {
          var row = {};
          for (var k in prefix) row[k] = prefix[k];
          row[axis.name] = v;
          out.push(row);
        });
      });
      return out;
    }, [{}]);
  }

  /* ---------- 主算法 ----------
   * rules = [{
   *   axes:     [{ name, list }],          必填，决定行
   *   when:     row => bool                 可选，整条规则的行过滤
   *   patterns: [{ … }]                     可选，每行按顺序套用多个"子规则"
   * }]
   * pattern 可写：
   *   when / every   (row, item, i) => bool  条件 / 稀疏采样
   *   each   数组    这一 pattern 每行产出多个（item 是当前元素，i 是下标）
   *   template       string | fn → 句子
   *   cn             string | fn → 中文提示
   *   answer         值 | fn → 正确答案
   *   pool           数组 | fn → 干扰池
   *   mustHave       数组 | fn → 必含项
   *   take           数字
   *   why            fn(answer, row) → 题解
   */
  function buildBank(rules, seed) {
    var all = [], n = 0;

    rules.forEach(function (rule) {
      var rows = expand(rule.axes);
      if (rule.when) rows = rows.filter(function (r) { return rule.when(r); });

      rows.forEach(function (row) {
        var patterns = rule.patterns || [rule];
        patterns.forEach(function (pat) {
          var each = pat.each || [null];
          each.forEach(function (item, i) {
            if (pat.when && !pat.when(row, item, i)) return;
            if (pat.every && !pat.every(row, item, i)) return;

            var cfg = {};
            for (var k in rule) cfg[k] = rule[k];
            for (var k2 in pat) cfg[k2] = pat[k2];
            cfg.each = null;   // 避免层层套用

            var ans = val(cfg.answer, row, item, i);
            var o = {
              sent: val(cfg.template, row, item, i),
              cn: cfg.cn ? val(cfg.cn, row, item, i) : '',
              why: cfg.why(ans, row, item, i)
            };
            all.push(withOpts(o, ans,
              val(cfg.pool, row, item, i), ++n,
              val(cfg.mustHave, row, item, i) || [],
              cfg.take));
          });
        });
      });
    });

    return seededShuffle(all, seed);
  }

  return {
    mulberry32: mulberry32,
    seededShuffle: seededShuffle,
    withOpts: withOpts,
    cap: cap,
    val: val,
    expand: expand,
    buildBank: buildBank
  };
})();
