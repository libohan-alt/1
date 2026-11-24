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

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderQuestion(host, item, index, total, remaining, timeLimit) {
    host.innerHTML = '';

    var wrap = el('div', 'quiz-question');
    var timerText = null;
    var timerBar = null;

    if (remaining != null) {
      var timer = el('div', 'quiz-timer');
      timerText = el('span', 'quiz-timer-text', '');
      timerText.textContent = '剩余 ' + remaining + ' 秒';
      timerText.setAttribute('aria-live', 'polite');
      timerBar = el('span', 'quiz-timer-track');
      timerBar.appendChild(el('span', 'quiz-timer-bar'));
      timerBar.firstChild.style.width =
        Math.max(0, Math.min(1, remaining / timeLimit)) * 100 + '%';
      timer.appendChild(timerText);
      timer.appendChild(timerBar);
      wrap.appendChild(timer);
    }

    wrap.appendChild(el('div', 'quiz-progress', (index + 1) + ' / ' + total));

    var sentence = el('p', 'quiz-sentence');
    var blankIndex = item.sent.indexOf('___');
    if (blankIndex < 0) {
      sentence.appendChild(document.createTextNode(item.sent));
    } else {
      sentence.appendChild(document.createTextNode(item.sent.slice(0, blankIndex)));
      var blank = el('span', 'quiz-blank', '___');
      sentence.appendChild(blank);
      sentence.appendChild(document.createTextNode(item.sent.slice(blankIndex + 3)));
    }

    if (item.cn) {
      var hint = el('small', 'quiz-cn', '（' + item.cn + '）');
      sentence.appendChild(document.createTextNode(' '));
      sentence.appendChild(hint);
    }
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

    return {
      root: wrap,
      options: options,
      sentence: sentence,
      timerText: timerText,
      timerBar: timerBar && timerBar.firstChild
    };
  }

  function renderSummary(host, correct, total, log, timedOut, onRestart) {
    host.innerHTML = '';

    var wrap = el('div', 'quiz-question');
    wrap.appendChild(el('div', 'quiz-score', correct + ' / ' + total));

    if (timedOut) {
      wrap.appendChild(el('p', 'quiz-timeout-message', '时间到，以下是本轮练习解析。'));
    }

    wrap.appendChild(el('h2', 'quiz-review-title', '练习解析'));
    log.forEach(function (entry, index) {
      var review = el('section', 'quiz-review-item');
      var question = document.createElement('p');
      question.textContent = (index + 1) + '. ' + entry.sent;
      review.appendChild(question);

      var answer = document.createElement('p');
      answer.textContent = '你的答案：' + entry.picked + '；正确答案：' + entry.answer;
      review.appendChild(answer);

      if (entry.why) {
        var explanation = document.createElement('p');
        explanation.textContent = entry.why;
        review.appendChild(explanation);
      }

      wrap.appendChild(review);
    });

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

    var rounds = options.rounds == null ? 10 : Number(options.rounds);
    var type = options.type || 'c1';
    var timeLimit = options.timeLimit == null
      ? (type === 'all' ? 60 : 0)
      : Number(options.timeLimit);
    var bank = buildBank(type, options.seed);
    var running = false;

    if (!Number.isInteger(rounds) || rounds < 1) {
      throw new Error('rounds 必须是大于 0 的整数');
    }
    if (rounds > bank.length) {
      throw new Error(
        '本类别只有 ' + bank.length + ' 道题，rounds 不能超过题库数量'
      );
    }
    if (!Number.isInteger(timeLimit) || timeLimit < 0) {
      throw new Error('timeLimit 必须是大于或等于 0 的整数秒');
    }

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

    function ask(item, index, total, run) {
      return new Promise(function (resolve) {
        var view = renderQuestion(
          host,
          item,
          index,
          total,
          timeLimit ? Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000)) : null,
          timeLimit
        );
        run.activeView = view;
        var locked = false;
        var right = item.opts[item.idx];
        var pendingResult = null;
        var settled = false;

        function settle(result) {
          if (settled) return;
          settled = true;
          run.activeResolve = null;
          run.activeView = null;
          resolve(result);
        }

        run.activeResolve = function () {
          settle(pendingResult || {
            ok: false,
            picked: '未作答',
            answer: right,
            why: item.why || ''
          });
        };

        view.options.addEventListener('click', function (event) {
          var button = event.target.closest('.quiz-option');
          if (!button || locked) return;

          locked = true;
          var picked = button.dataset.value;
          var correct = picked === right;
          pendingResult = {
            ok: correct,
            picked: picked,
            answer: right,
            why: item.why || ''
          };

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

          var feedback = el(
            'p',
            correct ? 'quiz-feedback quiz-feedback-right' : 'quiz-feedback quiz-feedback-wrong',
            correct ? '回答正确' : '回答错误'
          );
          view.root.appendChild(feedback);

          var next = el('button', 'quiz-option quiz-next', null);
          next.type = 'button';
          next.textContent = '下一题';
          next.addEventListener('click', function () {
            settle(pendingResult);
          });
          view.root.appendChild(next);
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
      var run = {
        timedOut: false,
        deadline: timeLimit ? Date.now() + timeLimit * 1000 : 0,
        interval: null,
        activeResolve: null,
        activeView: null
      };

      function updateTimer() {
        if (!run.activeView || !run.activeView.timerText) return;
        var remaining = Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000));
        run.activeView.timerText.textContent = '剩余 ' + remaining + ' 秒';
        run.activeView.timerBar.style.width =
          Math.max(0, Math.min(1, remaining / timeLimit)) * 100 + '%';
        if (remaining <= 10) run.activeView.root.classList.add('quiz-time-warning');
      }

      function finish() {
        if (run.interval) clearInterval(run.interval);
        run.interval = null;
        running = false;
        renderSummary(host, correct, items.length, log, run.timedOut, start);
        return Promise.resolve({
          correct: correct,
          total: items.length,
          timedOut: run.timedOut,
          log: log
        });
      }

      if (timeLimit) {
        run.interval = setInterval(function () {
          updateTimer();
          if (Date.now() >= run.deadline) {
            run.timedOut = true;
            clearInterval(run.interval);
            run.interval = null;
            if (run.activeResolve) run.activeResolve();
          }
        }, 200);
      }

      function next() {
        if (index >= items.length) {
          return finish();
        }

        if (run.timedOut) {
          while (index < items.length) {
            var skipped = items[index++];
            log.push({
              sent: skipped.sent,
              picked: '未作答',
              answer: skipped.opts[skipped.idx],
              why: skipped.why || '',
              ok: false
            });
          }
          return finish();
        }

        var item = items[index];
        return ask(item, index, items.length, run).then(function (result) {
          if (result.ok) correct++;

          log.push({
            sent: item.sent,
            picked: result.picked,
            answer: result.answer,
            why: result.why,
            ok: result.ok
          });

          index++;
          updateTimer();
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
        + '.quiz-timer{display:flex;align-items:center;gap:12px;margin:0 0 18px;color:#4b5563;font-size:14px}'
        + '.quiz-timer-track{height:6px;flex:1;overflow:hidden;border-radius:999px;background:#e5e7eb}'
        + '.quiz-timer-bar{display:block;width:100%;height:100%;background:#4f46e5;transition:width .2s linear}'
        + '.quiz-time-warning .quiz-timer-text{color:#b42318;font-weight:700}'
        + '.quiz-time-warning .quiz-timer-bar{background:#b42318}'
        + '.quiz-right{border-color:#15803d;background:#f3fdf7;color:#14532d}'
        + '.quiz-wrong{border-color:#b42318;background:#fef5f4;color:#7f1d1d}'
        + '.quiz-feedback{font-weight:600;margin:18px 0 8px}'
        + '.quiz-feedback-right{color:#15803d}'
        + '.quiz-feedback-wrong{color:#b42318}'
        + '.quiz-explanation{color:#4b5563;font-size:15px;line-height:1.8;text-align:left;margin:12px auto;max-width:560px}'
        + '.quiz-next{margin-top:12px}'
        + '.quiz-score{font-size:44px;font-weight:700;letter-spacing:-.02em}'
        + '.quiz-review-title{margin:28px 0 12px;font-size:20px}'
        + '.quiz-review-item{text-align:left;margin:12px 0;padding:16px;border:1px solid #e5e7eb;border-radius:10px}'
        + '.quiz-review-item p{margin:6px 0;line-height:1.7}'
        + '.quiz-timeout-message{color:#b42318;font-weight:600}'
        + '.quiz-review-empty{color:#15803d;margin:20px 0}';

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