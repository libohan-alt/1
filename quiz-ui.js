/* =========================================================
 * quiz-ui.js — DOM rendering for the quiz
 * Depends on quiz.css; exposes window.QuizUI.
 * ========================================================= */
(function (global) {
  'use strict';

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function createAnswerFeedback(picked, answer, correct) {
    var feedback = el('div', 'quiz-answer-feedback quiz-answer-reveal');

    if (correct) {
      feedback.appendChild(el(
        'p',
        'quiz-answer-line quiz-answer-correct',
        '你的答案：' + picked + '（正确）'
      ));
    } else {
      feedback.appendChild(el(
        'p',
        'quiz-answer-line quiz-answer-user',
        '你的答案：' + picked
      ));
      feedback.appendChild(el(
        'p',
        'quiz-answer-line quiz-answer-correct',
        '正确答案：' + answer
      ));
    }

    return feedback;
  }

  function renderQuestion(host, item, index, total, remaining, timeLimit) {
    document.body.classList.remove('quiz-review-mode');
    document.body.classList.add('quiz-practice-mode');
    host.textContent = '';

    var wrap = el('div', 'quiz-question quiz-active');
    var timerText = null;
    var timerBar = null;

    if (remaining != null) {
      var timer = el('div', 'quiz-timer');
      timerText = el('span', 'quiz-timer-text', '剩余 ' + remaining + ' 秒');
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
      sentence.appendChild(el('span', 'quiz-blank', '___'));
      sentence.appendChild(document.createTextNode(item.sent.slice(blankIndex + 3)));
    }

    if (item.cn) {
      sentence.appendChild(document.createTextNode(' '));
      sentence.appendChild(el('small', 'quiz-cn', '（' + item.cn + '）'));
    }
    wrap.appendChild(sentence);

    var options = el('div', 'quiz-options');
    item.opts.forEach(function (option) {
      var button = el('button', 'quiz-option', option);
      button.type = 'button';
      button.dataset.value = option;
      options.appendChild(button);
    });

    wrap.appendChild(options);
    host.replaceChildren(wrap);

    return {
      root: wrap,
      options: options,
      sentence: sentence,
      timerText: timerText,
      timerBar: timerBar && timerBar.firstChild
    };
  }

  function renderSummary(host, correct, total, log, timedOut, onRestart) {
    document.body.classList.remove('quiz-practice-mode');
    document.body.classList.add('quiz-review-mode');
    host.textContent = '';

    var wrap = el('div', 'quiz-question quiz-summary');
    wrap.appendChild(el('div', 'quiz-score', correct + ' / ' + total));

    if (timedOut) {
      wrap.appendChild(el('p', 'quiz-timeout-message', '时间到，以下是本轮练习解析。'));
    }

    wrap.appendChild(el('h2', 'quiz-review-title', '练习解析'));
    log.forEach(function (entry, index) {
      var review = el('section', 'quiz-review-item');
      review.appendChild(el('p', 'quiz-review-question', (index + 1) + '. ' + entry.sent));
      review.appendChild(el(
        'p',
        'quiz-review-answer',
        '你的答案：' + entry.picked + '；正确答案：' + entry.answer
      ));

      if (entry.why) {
        review.appendChild(el('p', 'quiz-review-explanation', entry.why));
      }

      wrap.appendChild(review);
    });

    var again = el('button', 'quiz-option quiz-restart', '再来一轮');
    again.type = 'button';
    again.addEventListener('click', onRestart);

    wrap.appendChild(again);
    host.replaceChildren(wrap);
  }

  global.QuizUI = {
    createAnswerFeedback: createAnswerFeedback,
    renderQuestion: renderQuestion,
    renderSummary: renderSummary
  };
})(window);
