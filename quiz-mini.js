/* =========================================================
 * quiz-mini.js — 测验界面与交互
 * 题目由 engine.js + data.js 提供；本文件暴露 window.Quiz。
 * ========================================================= */
(function (global) {
  'use strict';

  function buildBank(type, seed) {
    if (typeof type === 'number') type = 'c' + type;
    type = type || 'c1';

    var tokens = global.TOKENS;
    var category = tokens && tokens[type];
    var bank = category && (category.items || category.pool);

    if (!Array.isArray(bank)) {
      throw new Error(
        '题库类别不可用：' + type +
        '。请先按顺序加载 engine.js 和 data.js。'
      );
    }

    if (seed != null && global.Engine) {
      return global.Engine.seededShuffle(bank, seed);
    }

    return bank.slice();
  }

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function renderQuestion(host, item, index, total) {
    host.innerHTML = '';

    var wrap = el('div', 'quiz-question');
    wrap.appendChild(el('div', 'quiz-progress', (index + 1) + ' / ' + total));

    var sentence = el(
        'p',
        'quiz-sentence',
        item.sent.replace('___', '<span class="quiz-blank">___</span>') +
        (item.cn ? ' <small class="quiz-cn">（' + item.cn + '）</small>' : '')
    );
    wrap.appendChild(sentence);

    var options = el('div', 'quiz-options');
    item.opts.forEach(function (option) {
      var button = el('button', 'quiz-option', null);
      button.type = 'button';
      button.textContent = option;
      button.dataset.value = option;
      options.appendChild(button);
    });

    wrap.appendChild(options);
    host.appendChild(wrap);

    return { root: wrap, options: options, sentence: sentence };
  }

  function renderSummary(host, correct, total, onRestart) {
    host.innerHTML = '';

    var wrap = el('div', 'quiz-question');
    wrap.appendChild(el('div', 'quiz-score', correct + ' / ' + total));

    var again = el('button', 'quiz-option', null);
    again.type = 'button';
    again.textContent = '再来一轮';
    again.style.marginTop = '16px';
    again.addEventListener('click', onRestart);

    wrap.appendChild(again);
    host.appendChild(wrap);
  }

  function create(host, options) {
    options = options || {};

    if (!host) {
      throw new Error('Quiz.create 需要一个有效的题目容器');
    }

    var rounds = options.rounds || 10;
    var bank = buildBank(options.type || 'c1', options.seed);
    var running = false;

    function pick(count) {
      var remaining = bank.slice();
      var selected = [];

      for (var i = 0; i < count && remaining.length; i++) {
        selected.push(remaining.splice(
            Math.floor(Math.random() * remaining.length),
            1
        )[0]);
      }

      return selected;
    }

    function ask(item, index, total) {
      return new Promise(function (resolve) {
        var view = renderQuestion(host, item, index, total);
        var locked = false;
        var right = item.opts[item.idx];

        view.options.addEventListener('click', function (event) {
          var button = event.target.closest('.quiz-option');
          if (!button || locked) return;

          locked = true;
          var picked = button.dataset.value;
          var correct = picked === right;

          Array.prototype.forEach.call(view.options.children, function (option) {
            option.disabled = true;

            if (option.dataset.value === right) {
              option.classList.add('quiz-right');
            } else if (option === button) {
              option.classList.add('quiz-wrong');
            }
          });

          var blank = view.sentence.querySelector('.quiz-blank');
          if (blank) {
            blank.textContent = right;
            blank.className = 'quiz-blank quiz-filled';
          }

          setTimeout(function () {
            resolve({ ok: correct, picked: picked });
          }, correct ? 300 : 700);
        });
      });
    }

    function start() {
      if (running) {
        return Promise.reject(new Error('上一轮还没结束'));
      }

      running = true;
      var items = pick(rounds);
      var log = [];
      var correct = 0;
      var index = 0;

      function next() {
        if (index >= items.length) {
          running = false;
          renderSummary(host, correct, items.length, start);

          return Promise.resolve({
            correct: correct,
            total: items.length,
            log: log
          });
        }

        var item = items[index];
        return ask(item, index, items.length).then(function (result) {
          if (result.ok) correct++;

          log.push({
            sent: item.sent,
            picked: result.picked,
            ok: result.ok
          });

          index++;
          return next();
        });
      }

      return next();
    }

    return {
      start: start,
      bank: bank,
      get running() {
        return running;
      }
    };
  }

  function injectStyles() {
    if (document.getElementById('quiz-mini-style')) return;

    var css = ''
        + '.quiz-question{font-family:system-ui,"Microsoft YaHei",sans-serif;max-width:640px;margin:32px auto;padding:24px;text-align:center}'
        + '.quiz-progress{font-size:12px;color:#9ca3af;letter-spacing:.08em;margin-bottom:18px}'
        + '.quiz-sentence{font-size:22px;line-height:1.9;margin:0 0 24px;color:#111}'
        + '.quiz-cn{font-size:13px;color:#9ca3af}'
        + '.quiz-blank{display:inline-block;min-width:72px;border-bottom:2px solid #4f46e5;font-weight:600;color:#4f46e5}'
        + '.quiz-filled{border-bottom-color:#15803d;color:#15803d;background:#f3fdf7}'
        + '.quiz-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}'
        + '.quiz-option{font:inherit;font-size:15px;padding:12px 8px;border-radius:8px;border:1px solid #d8d8e0;background:#fff;cursor:pointer;transition:.15s}'
        + '.quiz-option:hover:not(:disabled){border-color:#4f46e5;color:#4f46e5;background:#f5f5ff}'
        + '.quiz-option:disabled{cursor:default}'
        + '.quiz-right{border-color:#15803d;background:#f3fdf7;color:#14532d}'
        + '.quiz-wrong{border-color:#b42318;background:#fef5f4;color:#7f1d1d}'
        + '.quiz-score{font-size:44px;font-weight:700;letter-spacing:-.02em}';

    var style = document.createElement('style');
    style.id = 'quiz-mini-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  injectStyles();

  global.Quiz = {
    create: create,
    buildBank: buildBank,
    styles: injectStyles
  };
})(window);