/* =========================================================
 * quiz-mini.js — quiz flow and state
 * Depends on engine.js, data.js, and quiz-ui.js; exposes window.Quiz.
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

  function create(host, options) {
    options = options || {};

    if (!global.QuizUI) {
      throw new Error('QuizUI 未加载，请先引入 quiz-ui.js');
    }
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
        var view = global.QuizUI.renderQuestion(
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
        var advanceTimer = null;
        var transitionTimer = null;

        function settle(result) {
          if (settled) return;
          settled = true;
          if (advanceTimer != null) clearTimeout(advanceTimer);
          if (transitionTimer != null) clearTimeout(transitionTimer);
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

          view.root.appendChild(
            global.QuizUI.createAnswerFeedback(picked, right, correct)
          );

          advanceTimer = setTimeout(function () {
            if (settled) return;
            view.root.classList.add('quiz-leaving');
            transitionTimer = setTimeout(function () {
              settle(pendingResult);
            }, 180);
          }, 500);
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
        global.QuizUI.renderSummary(host, correct, items.length, log, run.timedOut, start);
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

  global.Quiz = {
    create: create,
    buildBank: buildBank
  };
})(window);