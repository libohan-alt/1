(function () {
  'use strict';

  var SAVE_KEY = 'fogbound-english-king-v1';
  var TILE = 40;
  var COLS = 22;
  var ROWS = 15;
  var BASE_FOG_RADIUS = 4;
  var FOG_RADIUS_PER_BOSS = 0.75;
  var BOSSES = [
    { id: 'c1', title: 'Already / Just / Yet', name: '时序之主', color: '#b04e52' },
    { id: 'c2', title: 'For / Since', name: '岁月之主', color: '#8a79a8' },
    { id: 'c3', title: 'Been to / Gone to', name: '归途之主', color: '#4e8190' }
  ];
  var DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  var NPCS = [
    { x: 6, y: 5, name: '伊芙', color: '#9babb0', lines: ['村里的人总说 already、just 和 yet 是一团雾。我们明明知道它们，却总在句子里迷路；雾也因此遮住了去雾林的路。', '雾林深处住着时序之主。若你愿意，替我们拨开这团时序之雾，找回词语的秩序吧。'] },
    { x: 15, y: 5, name: '奥伦', color: '#a9a08c', lines: ['for 和 since 把我难住了。一个问持续多久，一个问从什么时候开始，可我总把它们弄反。钟楼的雾就从这里漫出来。', '旧钟楼下有岁月之主。请帮我们理清时间，让钟声再次穿过浓雾。'] },
    { x: 10, y: 11, name: '米拉', color: '#a49bb4', lines: ['been to 是去过，gone to 是去了还没回来。我知道规则，可一紧张就分不清，连回家的路也被雾藏起来了。', '黑湖对岸的归途之主守着雾中的归路。你能替我们辨清归来与离开吗？'] }
  ];

  var canvas = document.getElementById('world');
  var ctx = canvas.getContext('2d');
  var overlay = document.createElement('div');
  overlay.className = 'game-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  document.querySelector('.game-frame').appendChild(overlay);

  var intro = document.getElementById('intro-panel');
  var adventure = document.getElementById('adventure');
  var nameForm = document.getElementById('name-form');
  var surnameInput = document.getElementById('surname');
  var chapterLabel = document.getElementById('chapter-label');
  var chapterTitle = document.getElementById('chapter-title');
  var hudName = document.getElementById('hud-name');
  var knowledgeCount = document.getElementById('knowledge-count');
  var bossProgress = document.getElementById('boss-progress');
  var enemyStatus = document.getElementById('enemy-status');
  var saveNote = document.getElementById('save-note');
  var leaveBattleAction = document.getElementById('leave-battle-action');
  var comprehensivePracticeLink = document.getElementById('comprehensive-practice-link');
  var helpPanel = null;
  var helpReturnFocus = null;

  var save = loadSave();
  var mode = 'intro';
  var scene = 'village';
  var player = { x: 2, y: 7, facing: 'right' };
  var knowledge = 0;
  var battleBosses = [];
  var enemies = [];
  var traps = [];
  var portals = [];
  var walls = new Set();
  var buildings = [];
  var usedBuildingEffects = new Set();
  var buildingBuffs = { shield: 0, exposed: 0 };
  var nextBattleShield = 0;
  var villageBlessingClaimed = false;
  var runner = null;
  var eventLog = document.getElementById('event-log');
  var questionPools = {};
  var activeQuestion = null;
  var battleLog = [];
  var swordEffects = [];
  var lastPlayerAttack = 0;
  var battlePauseAt = null;
  var frameTime = 0;
  var lastFrame = 0;
  var heldMovement = null;
  var movementRepeatTimer = null;
  var viewportWidth = window.innerWidth;
  var viewportHeight = window.innerHeight;
  var pixelRatio = 1;
  var tileScale = 1;

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { surname: '', defeated: [], bossDefeats: 0, comprehensiveDefeated: false };
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') data = {};
      var defeated = Array.isArray(data.defeated)
        ? data.defeated.filter(function (id) { return BOSSES.some(function (boss) { return boss.id === id; }); })
        : [];
      return {
        surname: typeof data.surname === 'string' ? data.surname.slice(0, 16) : '',
        defeated: defeated,
        bossDefeats: Number.isInteger(data.bossDefeats) && data.bossDefeats >= 0
          ? data.bossDefeats
          : defeated.length,
        comprehensiveDefeated: data.comprehensiveDefeated === true
      };
    } catch (error) {
      console.error('无法读取冒险存档：', error);
      return { surname: '', defeated: [], bossDefeats: 0, comprehensiveDefeated: false };
    }
  }

  function drawBuildingEffects() {
    buildings.forEach(function (building) {
      var effect = building.effect;
      if (!effect || (effect.kind === 'blessing' && villageBlessingClaimed) ||
          (effect.kind !== 'blessing' && usedBuildingEffects.has(effect.name))) return;
      var x = (effect.x + 0.5) * TILE;
      var y = (effect.y + 0.5) * TILE;
      ctx.save();
      ctx.fillStyle = effect.kind === 'exposed' ? 'rgba(177, 82, 86, .22)' : 'rgba(118, 177, 185, .2)';
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = effect.kind === 'exposed' ? '#c87878' : '#9bc4c8';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = effect.kind === 'exposed' ? '#e5a19b' : '#d4e4dc';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(effect.icon, x, y);
      ctx.restore();
    });
  }

  function updateSightLabel() {
    chapterLabel.textContent = (scene === 'arena' ? '试炼' : '雾村') +
      ' · 视野 +' + (save.bossDefeats * FOG_RADIUS_PER_BOSS).toFixed(2) + ' 格';
  }

  function saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      saveNote.textContent = '进度保存在此浏览器';
    } catch (error) {
      console.error('无法保存冒险进度：', error);
      saveNote.textContent = '存档失败：浏览器存储不可用';
      announce('无法保存进度，请检查浏览器存储权限。');
    }
  }

  function announce(message) {
    eventLog.textContent = message;
  }

  function setMode(next) {
    mode = next;
    overlay.hidden = true;
    overlay.textContent = '';
    document.body.dataset.mode = next;
    leaveBattleAction.hidden = next !== 'battle';
    updateHud();
    if (next === 'village' || next === 'battle') canvas.focus();
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(label, className, action) {
    var node = element('button', className || 'dialog-button', label);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function openOverlay(nextMode, title, eyebrow) {
    mode = nextMode;
    document.body.dataset.mode = nextMode;
    overlay.textContent = '';
    overlay.hidden = false;
    var card = element('div', 'overlay-card');
    if (eyebrow) card.appendChild(element('p', 'eyebrow', eyebrow));
    if (title) {
      var heading = element('h2', 'overlay-title', title);
      heading.id = 'overlay-heading';
      card.appendChild(heading);
      overlay.setAttribute('aria-labelledby', 'overlay-heading');
    }
    overlay.appendChild(card);
    return card;
  }

  function showDialogue(title, lines, onComplete, eyebrow) {
    var card = openOverlay('dialogue', title, eyebrow || '雾中的声音');
    var lineIndex = 0;
    var paragraph = element('p', 'dialogue-line', lines[0]);
    var actions = element('div', 'dialogue-actions');
    var nextButton = button('继续 · Enter', 'primary-button dialog-next', advance);
    var leaveButton = button('暂时离开', 'quiet-button dialogue-leave', leaveDialogue);
    card.appendChild(paragraph);
    actions.appendChild(nextButton);
    actions.appendChild(leaveButton);
    card.appendChild(actions);
    nextButton.focus();

    function leaveDialogue() {
      setMode('village');
      draw();
      announce('你暂时结束了交谈。雾仍笼罩着村庄，村民还在等候。');
    }

    function advance() {
      lineIndex++;
      if (lineIndex >= lines.length) {
        if (onComplete) onComplete();
        return;
      }
      paragraph.textContent = lines[lineIndex];
      nextButton.focus();
    }
  }

  function village() {
    scene = 'village';
    player = { x: 2, y: 7, facing: 'right' };
    knowledge = 0;
    buildingBuffs = { shield: 0, exposed: 0 };
    nextBattleShield = 0;
    villageBlessingClaimed = false;
    usedBuildingEffects.clear();
    battleBosses = [];
    enemies = [];
    traps = [];
    portals = [];
    runner = null;
    createVillageMap();
    setMode('village');
    updateSightLabel();
    chapterTitle.textContent = '村口的低语';
    updateHud();
    draw();
  }

  function activateBuildingEffect(x, y) {
    var building = buildings.filter(function (item) {
      return item.effect && item.effect.x === x && item.effect.y === y;
    })[0];
    if (!building) return;
    var effect = building.effect;
    if (effect.kind === 'blessing') {
      if (mode !== 'village' || villageBlessingClaimed) return;
      villageBlessingClaimed = true;
      nextBattleShield = 3;
    } else {
      if (mode !== 'battle' || usedBuildingEffects.has(effect.name)) return;
      usedBuildingEffects.add(effect.name);
      if (effect.kind === 'knowledge') knowledge += 2;
      else if (effect.kind === 'shield') buildingBuffs.shield = 3;
      else if (effect.kind === 'exposed') buildingBuffs.exposed = 2;
    }
    announce(effect.name + '：' + effect.description);
    updateHud();
  }

  function startVillageStory() {
    village();
    showDialogue('村民的请求', [
      '长夜垂落，雾村只剩几盏将熄的灯。你踏过霜草而来，三道叹息穿雾而至，三位村民各守着一处失落的语言。',
      '迷雾深处，三位知识之主再度自雾底苏醒。他们从未甘心沉寂，正欲卷土重来；先后击败他们，才能迎来最后的综合试炼。',
      '靠近村民按 E 倾听。每一题答对，便有一星知识照亮前路；每走一格、每挥一次剑，都要以知识为薪。击败知识之主，视野便随雾退而渐远。'
    ], function () {
      setMode('village');
      announce('雾村：走近村民并按 E 交谈。');
    }, '序章 · 雾从长夜来');
  }

  function createVillageMap() {
    walls = new Set();
    buildings = [];
    addBoundaryWalls();
    addBuilding(2, 2, 2, 2, 'village', {
      x: 2, y: 4, name: '守夜祠', icon: '+', kind: 'blessing',
      description: '领取守夜祝福：下一场战斗获得 3 点护盾。'
    });
    addBuilding(8, 2, 2, 2, 'village');
    addBuilding(13, 2, 2, 2, 'village');
    addBuilding(18, 2, 2, 2, 'village');
    addBuilding(5, 9, 3, 2, 'village');
    addBuilding(14, 9, 3, 2, 'village');
    [
      [4, 3], [4, 4], [4, 5], [4, 6],
      [8, 3], [8, 4], [8, 5], [8, 6],
      [12, 3], [12, 4], [12, 5], [12, 6],
      [17, 3], [17, 4], [17, 5], [17, 6],
      [5, 9], [6, 9], [7, 9], [8, 9],
      [13, 9], [14, 9], [15, 9], [16, 9]
    ].forEach(function (point) { walls.add(key(point[0], point[1])); });
  }

  function createArenaMap() {
    walls = new Set();
    buildings = [];
    addBoundaryWalls();
    addBuilding(2, 3, 3, 1, 'ruin', {
      x: 5, y: 4, name: '遗忘藏书楼', icon: '+', kind: 'knowledge',
      description: '拾回散落的知识，获得 2 点知识。'
    });
    addBuilding(8, 4, 2, 1, 'ruin', {
      x: 7, y: 4, name: '裂纹钟楼', icon: '!', kind: 'exposed',
      description: '钟声惊醒了敌人；下一次受击额外损失 2 点知识。'
    });
    addBuilding(12, 1, 3, 1, 'ruin', {
      x: 11, y: 1, name: '守望高台', icon: '◇', kind: 'shield',
      description: '高台护佑你：抵消下一次受击的 3 点伤害。'
    });
    addBuilding(17, 6, 3, 1, 'ruin', {
      x: 16, y: 6, name: '余烬祭坛', icon: '+', kind: 'knowledge',
      description: '余烬照亮心智，获得 2 点知识。'
    });
    addBuilding(8, 11, 3, 1, 'ruin', {
      x: 7, y: 11, name: '蚀雾庭院', icon: '!', kind: 'exposed',
      description: '蚀雾缠身；下一次受击额外损失 2 点知识。'
    });
    [
      [6, 2], [6, 3], [6, 4], [6, 5], [6, 6],
      [6, 9], [6, 10], [6, 11], [6, 12],
      [10, 1], [10, 2], [10, 3], [10, 4],
      [10, 7], [10, 8], [10, 9], [10, 10],
      [14, 4], [14, 5], [14, 6], [14, 7],
      [14, 10], [14, 11], [14, 12], [14, 13],
      [3, 8], [4, 8], [5, 8],
      [17, 6], [18, 6], [19, 6],
      [8, 12], [9, 12], [10, 12],
      [2, 3], [3, 3], [4, 3],
      [8, 5], [9, 5],
      [12, 2], [13, 2], [14, 2],
      [17, 9], [18, 9], [19, 9],
      [3, 11], [4, 11]
    ].forEach(function (point) { walls.add(key(point[0], point[1])); });
  }

  function addBoundaryWalls() {
    for (var x = 0; x < COLS; x++) {
      walls.add(key(x, 0));
      walls.add(key(x, ROWS - 1));
    }
    for (var y = 0; y < ROWS; y++) {
      walls.add(key(0, y));
      walls.add(key(COLS - 1, y));
    }
  }

  function addBuilding(x, y, width, height, style, effect) {
    buildings.push({ x: x, y: y, width: width, height: height, style: style, effect: effect || null });
    for (var row = y; row < y + height; row++) {
      for (var column = x; column < x + width; column++) {
        walls.add(key(column, row));
      }
    }
  }

  function key(x, y) {
    return x + ',' + y;
  }

  function blocked(x, y) {
    return x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1 || walls.has(key(x, y));
  }

  function closestNpc() {
    var nearest = null;
    var distance = Infinity;
    NPCS.forEach(function (npc, index) {
      var d = Math.abs(npc.x - player.x) + Math.abs(npc.y - player.y);
      if (d < distance) {
        distance = d;
        nearest = { npc: npc, index: index, distance: d };
      }
    });
    return nearest && nearest.distance <= 2 ? nearest : null;
  }

  function interact() {
    if (mode === 'dialogue') {
      var next = overlay.querySelector('.dialog-next');
      if (next) next.click();
      return;
    }
    if (mode !== 'village') return;
    var nearby = closestNpc();
    if (!nearby) {
      announce('再靠近一位村民，按 E 开始交谈。');
      return;
    }
    var completed = BOSSES.filter(function (boss) { return save.defeated.includes(boss.id); }).length;
    var title = nearby.npc.name + ' · 村民';
    var lines = completed
      ? [nearby.npc.name + '望着你，声音穿过薄雾传来。', save.defeated.length === BOSSES.length
        ? '「三位知识之主仍不肯认输，已在雾底重聚。最后的综合试炼里，他们会一同卷土重来。」'
        : '「村子还等着你。每击败一位知识之主，雾便会退去一些。选择下一场挑战吧。」']
      : nearby.npc.lines;
    showDialogue(title, lines, function () {
      if (save.comprehensiveDefeated) {
        showEnding();
      } else {
        showSelection();
      }
    }, completed ? '归来的英雄' : '村民的请求');
  }

  function showSelection() {
    var allBossesDefeated = save.defeated.length === BOSSES.length;
    var card = openOverlay('selection', allBossesDefeated ? '最后的试炼' : '选择挑战',
      allBossesDefeated ? '浓雾深处 · 三位知识之主卷土重来' : '雾林深处 · 未完成的试炼');
    card.appendChild(element('p', 'overlay-copy', allBossesDefeated
      ? '三位知识之主不甘落败，将在综合试炼中一同归来。击败他们，雾村才能迎来真正的黎明。'
      : '答题获得知识点；移动和挥剑各消耗 1 点。每击败一位知识之主，视野便会穿透更远的迷雾。'));
    var choices = element('div', 'challenge-list');
    if (!allBossesDefeated) {
      BOSSES.forEach(function (boss) {
        if (save.defeated.includes(boss.id)) return;
        var choice = button('', 'challenge-choice', function () {
          startBattle([boss.id]);
        });
        choice.appendChild(element('strong', '', boss.title));
        choice.appendChild(element('span', '', '挑战 ' + boss.name));
        choices.appendChild(choice);
      });
    } else {
      choices.appendChild(button(
        '综合挑战 · 三位 boss 同时来袭',
        'challenge-choice challenge-combined',
        function () { startBattle(BOSSES.map(function (boss) { return boss.id; })); }
      ));
    }
    card.appendChild(choices);
    card.appendChild(button('回到村庄', 'quiet-button overlay-back', function () {
      setMode('village');
      draw();
    }));
    var first = choices.querySelector('button');
    if (first) first.focus();
  }

  function startBattle(bossIds) {
    scene = 'arena';
    battleBosses = bossIds.slice();
    knowledge = 0;
    buildingBuffs = { shield: nextBattleShield, exposed: 0 };
    nextBattleShield = 0;
    usedBuildingEffects.clear();
    battleLog = [];
    swordEffects = [];
    activeQuestion = null;
    battlePauseAt = null;
    player = { x: 2, y: 7, facing: 'right' };
    createArenaMap();
    traps = [
      { x: 4, y: 4, label: '薄冰' },
      { x: 8, y: 7, label: '裂隙' },
      { x: 12, y: 10, label: '毒雾' },
      { x: 18, y: 3, label: '薄冰' },
      { x: 19, y: 11, label: '裂隙' },
      { x: 8, y: 3, label: '毒雾' },
      { x: 9, y: 2, label: '薄冰' },
      { x: 12, y: 6, label: '裂隙' },
      { x: 3, y: 10, label: '毒雾' }
    ];
    portals = [
      { x: 3, y: 12, toX: 18, toY: 2 },
      { x: 18, y: 2, toX: 3, toY: 12 }
    ];
    enemies = [];
    var spots = [{ x: 18, y: 4 }, { x: 18, y: 8 }, { x: 18, y: 11 }];
    bossIds.forEach(function (id, index) {
      var boss = getBoss(id);
      if (!boss) return;
      enemies.push({
        id: id,
        kind: 'boss',
        name: boss.name,
        title: boss.title,
        color: boss.color,
        x: spots[index].x,
        y: spots[index].y,
        hp: 20,
        maxHp: 20,
        attacks: 0,
        nextMove: performance.now() + 1500,
        nextAttack: performance.now() + 4200,
        attackEffect: null,
        alive: true
      });
      questionPools[id] = [];
    });
    setMode('battle');
    updateSightLabel();
    chapterTitle.textContent = bossIds.length > 1 ? '三位知识之主' : getBoss(bossIds[0]).name;
    announce('试炼开始。按 Q 原地答题；走近遗迹可拾取知识、护盾，也要当心蚀雾。');
    updateHud();
    draw();
    document.getElementById('answer-action').focus();
  }

  function getBoss(id) {
    return BOSSES.filter(function (boss) { return boss.id === id; })[0];
  }

  function updateHud() {
    hudName.textContent = save.surname || '—';
    knowledgeCount.textContent = String(knowledge);
    bossProgress.textContent = save.defeated.length + ' / 3';
    var comprehensiveUnlocked = save.defeated.length === BOSSES.length;
    comprehensivePracticeLink.setAttribute('aria-disabled', String(!comprehensiveUnlocked));
    comprehensivePracticeLink.tabIndex = comprehensiveUnlocked ? 0 : -1;
    comprehensivePracticeLink.textContent = comprehensiveUnlocked
      ? '综合练习'
      : '综合练习（击败三位知识之主解锁）';
    enemyStatus.hidden = mode !== 'battle' && mode !== 'question' && mode !== 'questionResult';
    leaveBattleAction.hidden = mode !== 'battle';
    if (!enemyStatus.hidden) {
      enemyStatus.textContent = enemies.filter(function (enemy) { return enemy.alive; })
        .map(function (enemy) {
          return enemy.name + ' ' + enemy.hp + '/' + enemy.maxHp;
        }).join('　·　') || '战场已肃清';
      if (buildingBuffs.shield > 0) enemyStatus.textContent += '　·　护盾 ' + buildingBuffs.shield;
      if (buildingBuffs.exposed > 0) enemyStatus.textContent += '　·　易伤 +' + buildingBuffs.exposed;
      if (nextBattleShield > 0 && mode !== 'battle') enemyStatus.textContent += '　·　守夜护盾 ' + nextBattleShield;
    }
  }

  function movePlayer(direction) {
    var vector = DIRECTIONS[direction];
    if (!vector || (mode !== 'village' && mode !== 'battle')) return;
    player.facing = direction;
    var nx = player.x + vector.x;
    var ny = player.y + vector.y;
    if (blocked(nx, ny) || enemyAt(nx, ny) || npcAt(nx, ny)) {
      draw();
      return;
    }
    if (mode === 'battle') {
      if (knowledge < 1) {
        failBattle('知识点不足，无法继续移动。');
        return;
      }
      knowledge--;
    }
    player.x = nx;
    player.y = ny;
    var portal = portals.filter(function (item) { return item.x === nx && item.y === ny; })[0];
    if (portal && !blocked(portal.toX, portal.toY) && !enemyAt(portal.toX, portal.toY)) {
      player.x = portal.toX;
      player.y = portal.toY;
      announce('传送门将你送往迷宫的另一端。');
    }
    var trap = traps.filter(function (item) { return item.x === player.x && item.y === player.y; })[0];
    if (trap) {
      knowledge -= 2;
      announce('你踏入' + trap.label + '陷阱，损失 2 点知识。');
      if (knowledge < 0) {
        updateHud();
        failBattle('知识点跌破了零，迷雾吞没了你的意识。');
        return;
      }
    }
    activateBuildingEffect(player.x, player.y);
    updateHud();
    draw();
  }

  function npcAt(x, y) {
    return scene === 'village' && NPCS.some(function (npc) { return npc.x === x && npc.y === y; });
  }

  function enemyAt(x, y) {
    return scene === 'arena' && enemies.some(function (enemy) {
      return enemy.alive && enemy.x === x && enemy.y === y;
    });
  }

  function attack() {
    if (mode !== 'battle') return;
    var now = performance.now();
    if (now - lastPlayerAttack < 260) return;
    lastPlayerAttack = now;
    if (knowledge < 1) {
      failBattle('知识点不足，无法挥剑。');
      return;
    }
    knowledge--;
    swordEffects.push({
      x: player.x,
      y: player.y,
      direction: player.facing,
      team: 'player',
      started: now,
      duration: 460,
      maxRadius: TILE * 2,
      hit: new Set()
    });
    announce('挥剑斩出扩展剑弧，消耗 1 点知识。');
    updateHud();
    draw();
  }

  function openQuestion() {
    if (mode !== 'battle') return;
    var livingBosses = enemies.filter(function (enemy) { return enemy.alive && enemy.kind === 'boss'; });
    if (!livingBosses.length) {
      announce('战场已肃清。');
      return;
    }
    pauseBattleClock();
    var bossId = livingBosses[Math.floor(Math.random() * livingBosses.length)].id;
    activeQuestion = getQuestion(bossId);
    var card = openOverlay('question', '答题积攒知识', '按 1–' + activeQuestion.opts.length + ' 或点击选项');
    card.appendChild(element('p', 'question-sentence', activeQuestion.sent));
    if (activeQuestion.cn) card.appendChild(element('p', 'question-hint', '（' + activeQuestion.cn + '）'));
    var options = element('div', 'question-options');
    activeQuestion.opts.forEach(function (option, index) {
      options.appendChild(button((index + 1) + '. ' + option, 'answer-choice', function () {
        answer(index);
      }));
    });
    card.appendChild(options);
    card.appendChild(button('返回战场', 'quiet-button overlay-back', resumeQuestion));
    card.appendChild(button('离开战场并复盘', 'quiet-button overlay-back', leaveBattle));
    options.querySelector('button').focus();
    updateHud();
  }

  function getQuestion(id) {
    var queue = questionPools[id];
    if (!queue || !queue.length) {
      var token = window.TOKENS[id];
      if (!token || !Array.isArray(token.items) || !token.items.length) {
        throw new Error('题库不可用：' + id);
      }
      queue = window.Engine.seededShuffle(token.items, Math.floor(Math.random() * 2147483647));
      questionPools[id] = queue;
    }
    return questionPools[id].shift();
  }

  function answer(index) {
    if (mode !== 'question' || !activeQuestion) return;
    var correct = index === activeQuestion.idx;
    var selected = activeQuestion.opts[index];
    if (correct) {
      knowledge++;
    } else {
      knowledge--;
    }
    var question = activeQuestion;
    activeQuestion = null;
    battleLog.push({
      sent: question.sent,
      picked: selected,
      answer: question.opts[question.idx],
      why: question.why || '',
      correct: correct
    });
    var feedback = correct
      ? '知识点 +1'
      : '知识点 -1';
    if (knowledge < 0) {
      failBattle('答错使知识点跌破了零，迷雾吞没了你的意识。');
      return;
    }
    var card = openOverlay('questionResult', correct ? '判断正确' : '再辨一辨', feedback);
    card.appendChild(element('p', 'question-sentence', question.sent));
    card.appendChild(element('p', correct ? 'result-correct' : 'result-wrong',
      '你的答案：' + selected + '　·　正确答案：' + question.opts[question.idx]));
    if (!correct && question.why) card.appendChild(element('p', 'explanation', question.why));
    card.appendChild(button('继续答题 · Enter', 'primary-button dialog-next', continueQuestion));
    card.appendChild(button('结束答题，返回战场', 'quiet-button overlay-back', resumeBattle));
    card.appendChild(button('退出战场并复盘', 'quiet-button overlay-back', leaveBattle));
    card.querySelector('.dialog-next').focus();
    updateHud();
    announce(correct ? '答对了，获得 1 点知识。' : '答错了，失去 1 点知识。');
  }

  function resumeBattle() {
    if (mode !== 'questionResult') return;
    resumeBattleClock();
    setMode('battle');
    draw();
  }

  function resumeQuestion() {
    if (mode !== 'question') return;
    activeQuestion = null;
    resumeBattleClock();
    setMode('battle');
    draw();
  }

  function continueQuestion() {
    if (mode !== 'questionResult') return;
    setMode('battle');
    openQuestion();
  }

  function pauseBattleClock() {
    if (battlePauseAt == null) battlePauseAt = performance.now();
  }

  function resumeBattleClock() {
    if (battlePauseAt == null) return;
    var pausedFor = performance.now() - battlePauseAt;
    enemies.forEach(function (enemy) {
      enemy.nextMove += pausedFor;
      enemy.nextAttack += pausedFor;
      if (enemy.attackEffect) enemy.attackEffect.started += pausedFor;
    });
    swordEffects.forEach(function (effect) {
      effect.started += pausedFor;
    });
    battlePauseAt = null;
  }

  function applyEnemyAttack(enemy) {
    if (mode !== 'battle') return;
    var damage;
    if (enemy.kind === 'boss') {
      enemy.attacks++;
      if (enemy.attacks % 10 === 0) {
        damage = 20;
        spawnMinion(enemy);
        announce(enemy.name + '发动大招并召来小怪！知识点 -20。');
      } else {
        damage = 5;
        announce(enemy.name + '发动普通攻击。知识点 -5。');
      }
    } else {
      damage = 1;
      announce('小怪袭来。知识点 -1。');
    }
    if (buildingBuffs.exposed > 0) {
      damage += buildingBuffs.exposed;
      buildingBuffs.exposed = 0;
    }
    if (buildingBuffs.shield > 0) {
      damage = Math.max(0, damage - buildingBuffs.shield);
      buildingBuffs.shield = 0;
    }
    knowledge -= damage;
    enemy.nextAttack = performance.now() + (enemy.kind === 'boss' ? 2300 : 1500);
    updateHud();
    if (knowledge <= 0) {
      failBattle('敌人的攻击耗尽了你的知识点。');
    }
  }

  function startEnemyAttack(enemy, now) {
    var dx = player.x - enemy.x;
    var dy = player.y - enemy.y;
    var direction = Math.abs(dx) >= Math.abs(dy)
      ? (dx >= 0 ? 'right' : 'left')
      : (dy >= 0 ? 'down' : 'up');
    enemy.attackEffect = {
      x: enemy.x,
      y: enemy.y,
      direction: direction,
      team: 'enemy',
      started: now,
      duration: 620,
      maxRadius: TILE * 2
    };
    enemy.nextAttack = now + (enemy.kind === 'boss' ? 2700 : 1900);
    announce(enemy.name + '蓄力挥出扩展剑弧！');
  }

  function spawnMinion(boss) {
    var candidates = [
      { x: boss.x + 1, y: boss.y },
      { x: boss.x - 1, y: boss.y },
      { x: boss.x, y: boss.y + 1 },
      { x: boss.x, y: boss.y - 1 }
    ];
    var spawn = candidates.filter(function (point) {
      return !blocked(point.x, point.y) && !enemyAt(point.x, point.y) &&
        (point.x !== player.x || point.y !== player.y);
    })[0];
    if (!spawn) return;
    enemies.push({
      id: 'minion-' + Math.random().toString(36).slice(2),
      kind: 'minion',
      name: '雾中小怪',
      color: '#9c6d51',
      x: spawn.x,
      y: spawn.y,
      hp: 10,
      maxHp: 10,
      nextMove: performance.now() + 1000,
      nextAttack: performance.now() + 1600,
      attackEffect: null,
      alive: true
    });
  }

  function failBattle(message) {
    if (mode !== 'battle' && mode !== 'question' && mode !== 'questionResult') return;
    activeQuestion = null;
    battlePauseAt = null;
    knowledge = 0;
    updateHud();
    announce(message);
    var retryIds = battleBosses.slice();
    var card = openOverlay('defeat', '雾再次吞没了道路', '挑战失败');
    card.appendChild(element('p', 'overlay-copy', message + ' 本局知识点已清空，可以重新挑战或回到村庄。'));
    card.appendChild(button('重新挑战', 'primary-button', function () { startBattle(retryIds); }));
    card.appendChild(button('回到村庄并复盘', 'quiet-button overlay-back', function () {
      showBattleReview('失败 · 本局解析', village);
    }));
    card.querySelector('button').focus();
    updateHud();
  }

  function finishBattle() {
    battleBosses.forEach(function (id) {
      if (!save.defeated.includes(id)) save.defeated.push(id);
    });
    if (battleBosses.length === BOSSES.length) save.comprehensiveDefeated = true;
    saveProgress();
    showBattleReview('胜利 · 试炼复盘', afterBattle);
  }

  function afterBattle() {
    if (save.comprehensiveDefeated) {
      showEnding();
      return;
    }
    village();
    runner = { x: COLS - 2, y: 7, nextStep: performance.now() + 350 };
    var lines = [
      '村民们从屋檐下走出来，望着退散的雾，彼此传递着消息。「英语王真的打败了知识之主！你看，街角的灯又亮起来了。」',
      '「他挥剑时没有退缩，还把我们困住的难题一一理清。每驱散一层迷雾，我们就能看见更多回家的路。英语王的勇气，我们会一直传颂。」'
    ];
    if (save.defeated.length === BOSSES.length) {
      lines.push('一位年轻村民穿过薄雾跑来，低声道：「三位知识之主仍不死心，正于雾底重聚。他们要一同卷土重来——请为最后的综合试炼做好准备。」');
    } else {
      lines.push('一位年轻村民穿过薄雾跑来，停在你面前：「远处还有雾没有散去。还有别的知识之主，请再帮我们一次吧。」');
    }
    showDialogue('雾中的传颂', lines, function () {
      showSelection();
    }, '归村 · 人们传颂着你的事迹');
  }

  function showBattleReview(title, onComplete) {
    var card = openOverlay('battleReview', title, '本局答题解析 · 共 ' + battleLog.length + ' 题');
    if (!battleLog.length) {
      card.appendChild(element('p', 'overlay-copy', '本局没有完成答题。'));
    }
    battleLog.forEach(function (entry, index) {
      var item = element('section', 'battle-review-item');
      item.appendChild(element('h3', 'battle-review-question', (index + 1) + '. ' + entry.sent));
      item.appendChild(element(
        'p',
        entry.correct ? 'result-correct' : 'result-wrong',
        '你的答案：' + entry.picked + '　·　正确答案：' + entry.answer
      ));
      if (entry.why) item.appendChild(element('p', 'explanation', entry.why));
      card.appendChild(item);
    });
    card.appendChild(button('继续', 'primary-button dialog-next', onComplete));
    card.querySelector('.dialog-next').focus();
  }

  function leaveBattle() {
    if (mode !== 'battle' && mode !== 'question' && mode !== 'questionResult') return;
    activeQuestion = null;
    battlePauseAt = null;
    showBattleReview('离开战场 · 本局解析', function () {
      village();
      announce('你离开了战场。未击败的知识之主仍在迷宫中。');
    });
  }

  function showEnding() {
    scene = 'village';
    createVillageMap();
    player = { x: 10, y: 7, facing: 'up' };
    enemies = [];
    knowledge = 0;
    setMode('epilogue');
    var card = openOverlay('epilogue', '石碑上的姓氏', '终章 · 雾散之后');
    var stone = element('div', 'stone-inscription', save.surname || '无名');
    card.appendChild(stone);
    var lines = [
      { speaker: '村民甲', text: '「石碑上的字，终于在晨光里显出来了。可那位曾为我们劈开长夜的人，再也不会从雾中归来。」' },
      { speaker: '村民乙', text: '「我多希望他还能听见这些话。是他把勇气留给了我们，也让每个孩子敢于开口说出自己的第一句英语。」' },
      { speaker: '村民甲', text: '「往后的每一个清晨，我们都会带着他的光，继续走下去。」' }
    ];
    var speaker = element('p', 'dialogue-speaker', lines[0].speaker);
    var dialogue = element('p', 'dialogue-line', lines[0].text);
    var lineIndex = 0;
    var nextLine = button('继续', 'primary-button dialog-next', advanceEpilogue);
    card.appendChild(speaker);
    card.appendChild(dialogue);
    card.appendChild(nextLine);
    nextLine.focus();
    draw();

    function advanceEpilogue() {
      lineIndex++;
      if (lineIndex < lines.length) {
        speaker.textContent = lines[lineIndex].speaker;
        dialogue.textContent = lines[lineIndex].text;
        return;
      }
      nextLine.remove();
      card.appendChild(element('p', 'ending-tagline', '下一步，敬请期待'));
      var restart = button('重新开始故事', 'quiet-button overlay-back', resetAdventure);
      card.appendChild(restart);
      restart.focus();
      announce('大结局：' + save.surname + ' 姓氏被刻在石碑上。');
    }
  }

  function resetAdventure() {
    if (!window.confirm('重新开始会清除已击败的 boss 记录，确定继续吗？')) return;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (error) {
      console.error('无法清除冒险存档：', error);
      saveNote.textContent = '清档失败：浏览器存储不可用';
      announce('无法清除存档，请检查浏览器存储权限。');
      return;
    }
    save = { surname: '', defeated: [], bossDefeats: 0, comprehensiveDefeated: false };
    knowledge = 0;
    enemies = [];
    battleBosses = [];
    intro.hidden = false;
    adventure.hidden = true;
    overlay.hidden = true;
    overlay.textContent = '';
    mode = 'intro';
    surnameInput.value = '';
    surnameInput.focus();
    document.body.dataset.mode = 'intro';
  }

  function showHelp() {
    if (helpPanel) return;
    helpReturnFocus = document.activeElement;
    helpPanel = element('div', 'help-overlay');
    helpPanel.setAttribute('role', 'dialog');
    helpPanel.setAttribute('aria-modal', 'true');
    helpPanel.setAttribute('aria-labelledby', 'help-title');
    var card = element('section', 'help-card');
    var heading = element('h2', 'overlay-title', '雾村冒险说明');
    heading.id = 'help-title';
    card.appendChild(heading);
    var markdown = [
      '# 操作',
      '- 方向键或 WASD：移动；战场中每格消耗 1 点知识。',
      '- Q：原地答题；答对 +1，答错 -1。答题可无限继续，直到选择返回。',
      '- Space：挥剑，消耗 1 点知识；剑弧逐渐扩展，最多覆盖前方两格。',
      '- E：靠近村民交谈。数字键 1–4：选择答案。',
      '- F1 或 ?：随时打开本说明；Esc：关闭说明。',
      '',
      '# 战斗规则',
      '- boss：每次命中减少 1 HP，命中 20 次击败。',
      '- boss 朝前挥出两格范围的红色剑弧；剑弧完成时命中才会造成伤害。',
      '- boss 每十次攻击发动大招，扣 20 点并召唤小怪；普通攻击扣 5 点。',
      '- 小怪每次攻击扣 1 点；受到 10 次剑击后消失。',
      '- 知识点不足以移动或挥剑时挑战失败；任何行为使知识点跌到 0 以下，也会立即失败。',
      '- 答错扣 1 点；若知识点原本为 0，答错会跌为负数并立即失败。',
      '- 战斗胜利或离开战场时，会显示本局所有已答题目的答案与解析。',
      '',
      '# 地图与进度',
      '- 村庄守夜祠可为下一场战斗储存 3 点护盾；遗迹旁带符号的地砖各有一次效果：+ 回复 2 点知识，◇ 抵消下一次受击的 3 点伤害，! 使下一次受击多损失 2 点知识。',
      '- 蓝色传送门可穿越战场；红色陷阱会损失 2 点知识。建筑与遗迹会阻挡通行。',
      '- 初始视野为 4 格；每击败一位单体 boss，视野扩大 0.75 格。',
      '- 先分别击败三位 boss，才会解锁三位 boss 同时归来的综合挑战。',
      '- boss 会寻路、避开陷阱，并尝试躲避玩家的剑弧。',
      '- 通关进度和姓氏保存在本机浏览器；“重新开始”会清除记录。'
    ].join('\n');
    renderMarkdown(card, markdown);
    var close = button('关闭 · Esc', 'primary-button help-close', closeHelp);
    card.appendChild(close);
    helpPanel.appendChild(card);
    helpPanel.addEventListener('click', function (event) {
      if (event.target === helpPanel) closeHelp();
    });
    document.body.appendChild(helpPanel);
    close.focus();
  }

  function renderMarkdown(host, markdown) {
    var currentList = null;
    markdown.split('\n').forEach(function (line) {
      if (!line.trim()) {
        currentList = null;
        return;
      }
      if (line.indexOf('# ') === 0) {
        currentList = null;
        host.appendChild(element('h3', 'help-section-title', line.slice(2)));
        return;
      }
      if (line.indexOf('- ') === 0) {
        if (!currentList) {
          currentList = element('ul', 'help-list');
          host.appendChild(currentList);
        }
        currentList.appendChild(element('li', '', line.slice(2)));
        return;
      }
      currentList = null;
      host.appendChild(element('p', 'help-paragraph', line));
    });
  }

  function closeHelp() {
    if (!helpPanel) return;
    helpPanel.remove();
    helpPanel = null;
    if (helpReturnFocus && typeof helpReturnFocus.focus === 'function') helpReturnFocus.focus();
    else if (mode === 'battle' || mode === 'village') canvas.focus();
  }

  function findNextStep(enemy) {
    var queue = [{ x: enemy.x, y: enemy.y, first: null }];
    var visited = new Set([key(enemy.x, enemy.y)]);
    var goal = key(player.x, player.y);
    while (queue.length) {
      var current = queue.shift();
      if (key(current.x, current.y) === goal) return current.first;
      Object.keys(DIRECTIONS).forEach(function (direction) {
        var vector = DIRECTIONS[direction];
        var nx = current.x + vector.x;
        var ny = current.y + vector.y;
        var nextKey = key(nx, ny);
        if (visited.has(nextKey) || blocked(nx, ny) || isTrap(nx, ny) ||
            (enemyAt(nx, ny) && (nx !== enemy.x || ny !== enemy.y))) return;
        visited.add(nextKey);
        queue.push({
          x: nx,
          y: ny,
          first: current.first || { x: nx, y: ny }
        });
      });
    }
    return null;
  }

  function isTrap(x, y) {
    return traps.some(function (trap) { return trap.x === x && trap.y === y; });
  }

  function moveEnemy(enemy, now) {
    if (now < enemy.nextMove || !enemy.alive || enemy.attackEffect) return;
    enemy.nextMove = now + (enemy.kind === 'boss' ? 320 : 260);
    var distance = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
    var threateningSwing = swordEffects.some(function (effect) {
      return effect.team === 'player' && now < effect.started + effect.duration &&
        withinAttackArc(effect, enemy.x, enemy.y, TILE * 2);
    });
    if (threateningSwing) {
      var forward = DIRECTIONS[player.facing];
      var dodge = Object.keys(DIRECTIONS).map(function (direction) {
        var vector = DIRECTIONS[direction];
        return { x: enemy.x + vector.x, y: enemy.y + vector.y };
      }).filter(function (point) {
        return !blocked(point.x, point.y) && !isTrap(point.x, point.y) &&
          !enemyAt(point.x, point.y) &&
          Math.abs(point.x - player.x) + Math.abs(point.y - player.y) > distance;
      })[0];
      if (dodge) {
        enemy.x = dodge.x;
        enemy.y = dodge.y;
        return;
      }
    }
    if (distance <= 2) return;
    var target = findNextStep(enemy);
    if (!target) return;
    if (!enemyAt(target.x, target.y) && (target.x !== player.x || target.y !== player.y)) {
      enemy.x = target.x;
      enemy.y = target.y;
    }
  }

  function updateBattle(now) {
    if (mode !== 'battle') return;
    updateSwordEffects(now);
    enemies.forEach(function (enemy) { moveEnemy(enemy, now); });
    if (mode !== 'battle') return;
    enemies.slice().forEach(function (enemy) {
      if (!enemy.alive || mode !== 'battle') return;
      if (enemy.attackEffect) {
        if (now - enemy.attackEffect.started >= enemy.attackEffect.duration) {
          var hit = withinAttackArc(enemy.attackEffect, player.x, player.y, TILE * 2);
          enemy.attackEffect = null;
          if (hit) applyEnemyAttack(enemy);
        }
        return;
      }
      var dx = (player.x - enemy.x) * TILE;
      var dy = (player.y - enemy.y) * TILE;
      if (Math.sqrt(dx * dx + dy * dy) <= TILE * 2.15 && now >= enemy.nextAttack) {
        startEnemyAttack(enemy, now);
      }
    });
    updateHud();
  }

  function withinAttackArc(effect, targetX, targetY, maxRadius) {
    var dx = (targetX - effect.x) * TILE;
    var dy = (targetY - effect.y) * TILE;
    var radius = Math.sqrt(dx * dx + dy * dy);
    if (radius < TILE * 0.35 || radius > maxRadius) return false;
    var direction = DIRECTIONS[effect.direction];
    var forward = dx * direction.x + dy * direction.y;
    var side = Math.abs(dx * direction.y - dy * direction.x);
    return forward > 0 && side <= forward * 1.15 + TILE * 0.25;
  }

  function updateSwordEffects(now) {
    swordEffects.forEach(function (effect) {
      var progress = Math.min(1, (now - effect.started) / effect.duration);
      var radius = effect.maxRadius * progress;
      enemies.forEach(function (enemy) {
        if (!enemy.alive || effect.hit.has(enemy.id)) return;
        if (withinAttackArc(effect, enemy.x, enemy.y, radius)) {
          effect.hit.add(enemy.id);
          damageEnemy(enemy);
        }
      });
    });
    swordEffects = swordEffects.filter(function (effect) {
      return now - effect.started < effect.duration;
    });
  }

  function damageEnemy(target) {
    if (mode !== 'battle' || !target.alive) return;
    target.hp--;
    announce('剑弧命中 ' + target.name + '。还需 ' + target.hp + ' 次命中。');
    if (target.hp <= 0) {
      target.alive = false;
      if (target.kind === 'boss') {
        save.bossDefeats++;
        saveProgress();
        updateSightLabel();
        announce(target.name + '倒下了，视野穿透迷雾更远了。');
      }
      else announce('小怪被击退，消失在雾中。');
      if (!enemies.some(function (enemy) { return enemy.alive && enemy.kind === 'boss'; })) {
        enemies.forEach(function (enemy) { enemy.alive = false; });
        finishBattle();
      }
    }
    updateHud();
  }

  function updateRunner(now) {
    if (!runner || now < runner.nextStep) return;
    runner.nextStep = now + 280;
    if (runner.x > player.x + 1) runner.x--;
  }

  function resizeCanvas() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    tileScale = Math.min(viewportWidth, viewportHeight) * 0.085 / TILE;
    canvas.width = Math.round(viewportWidth * pixelRatio);
    canvas.height = Math.round(viewportHeight * pixelRatio);
  }

  function draw() {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    ctx.fillStyle = '#0a0f14';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    ctx.save();
    ctx.translate(viewportWidth / 2, viewportHeight / 2);
    ctx.scale(tileScale, tileScale);
    ctx.translate(-(player.x + 0.5) * TILE, -(player.y + 0.5) * TILE);
    drawFloor();
    drawWalls();
    drawBuildings();
    if (scene === 'arena') {
      traps.forEach(drawTrap);
      portals.forEach(drawPortal);
      enemies.forEach(function (enemy) {
        if (enemy.attackEffect) drawSwordEffect(enemy.attackEffect, performance.now());
      });
      swordEffects.forEach(function (effect) { drawSwordEffect(effect, performance.now()); });
      enemies.forEach(drawEnemy);
    } else {
      NPCS.forEach(drawNpc);
      if (runner) drawRunner();
    }
    drawBuildingEffects();
    drawPlayer();
    var nearby = mode === 'village' ? closestNpc() : null;
    if (nearby) {
      ctx.fillStyle = 'rgba(207, 220, 226, .9)';
      ctx.font = (12 / tileScale) + 'px "KaiTi", "楷体", "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('E · 交谈', (player.x + 0.5) * TILE, (player.y - 0.55) * TILE);
    }
    ctx.restore();
    drawFog();
  }

  function drawFog() {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    var centerX = viewportWidth / 2;
    var centerY = viewportHeight / 2;
    var radius = TILE * (BASE_FOG_RADIUS + save.bossDefeats * FOG_RADIUS_PER_BOSS) * tileScale;
    var fog = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    fog.addColorStop(0, 'rgba(3, 6, 10, .08)');
    fog.addColorStop(.7, 'rgba(3, 6, 10, .18)');
    fog.addColorStop(.92, 'rgba(3, 6, 10, .9)');
    fog.addColorStop(1, 'rgba(3, 6, 10, 1)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  }

  function drawFloor() {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var shade = ((x * 17 + y * 31) % 4) * 2;
        ctx.fillStyle = scene === 'arena'
          ? 'rgb(' + (19 + shade) + ',' + (27 + shade) + ',' + (33 + shade) + ')'
          : 'rgb(' + (24 + shade) + ',' + (34 + shade) + ',' + (40 + shade) + ')';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.strokeStyle = 'rgba(151, 174, 184, .045)';
        ctx.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
        if ((x * 7 + y * 11) % 19 === 0) {
          ctx.fillStyle = 'rgba(196, 209, 211, .08)';
          ctx.fillRect(x * TILE + 8, y * TILE + 27, 2, 2);
        }
      }
    }
  }

  function drawWalls() {
    walls.forEach(function (position) {
      var parts = position.split(',');
      var x = Number(parts[0]) * TILE;
      var y = Number(parts[1]) * TILE;
      ctx.fillStyle = scene === 'arena' ? '#11171d' : '#182127';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(167, 184, 192, .08)';
      ctx.fillRect(x + 3, y + 3, TILE - 6, 3);
      ctx.strokeStyle = 'rgba(0, 0, 0, .45)';
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    });
  }

  function drawBuildings() {
    buildings.forEach(function (building) {
      var x = building.x * TILE;
      var y = building.y * TILE;
      var width = building.width * TILE;
      var height = building.height * TILE;
      var ruined = building.style === 'ruin';
      var wallColor = ruined ? '#1a1b20' : '#263039';
      var roofColor = ruined ? '#30282d' : '#34444b';
      var edgeColor = ruined ? '#80605b' : '#8b9b9d';
      ctx.fillStyle = 'rgba(0, 0, 0, .48)';
      ctx.fillRect(x - 3, y + height - 4, width + 7, 8);
      ctx.fillStyle = wallColor;
      ctx.fillRect(x + 4, y + 12, width - 8, height - 12);
      ctx.fillStyle = roofColor;
      ctx.beginPath();
      ctx.moveTo(x, y + 15);
      ctx.lineTo(x + width * .18, y);
      ctx.lineTo(x + width * .78, y + 2);
      ctx.lineTo(x + width, y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, .58)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = ruined ? '#101217' : '#11191e';
      ctx.fillRect(x + width * .42, y + height * .48, width * .18, height * .52 - 5);
      ctx.fillStyle = edgeColor;
      ctx.globalAlpha = .45;
      ctx.fillRect(x + 9, y + 21, Math.max(4, width * .15), 3);
      ctx.fillRect(x + width - 14, y + 21, 5, Math.max(5, height * .22));
      ctx.globalAlpha = 1;
      if (ruined) {
        ctx.strokeStyle = 'rgba(177, 108, 99, .35)';
        ctx.beginPath();
        ctx.moveTo(x + width * .67, y + 8);
        ctx.lineTo(x + width * .58, y + 20);
        ctx.lineTo(x + width * .72, y + 29);
        ctx.stroke();
      }
    });
  }

  function drawTrap(trap) {
    var cx = (trap.x + 0.5) * TILE;
    var cy = (trap.y + 0.5) * TILE;
    ctx.fillStyle = 'rgba(130, 48, 57, .42)';
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(198, 111, 112, .68)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 5);
    ctx.lineTo(cx + 7, cy + 6);
    ctx.moveTo(cx + 7, cy - 7);
    ctx.lineTo(cx - 6, cy + 8);
    ctx.stroke();
  }

  function drawPortal(portal) {
    var cx = (portal.x + 0.5) * TILE;
    var cy = (portal.y + 0.5) * TILE;
    ctx.strokeStyle = 'rgba(116, 182, 198, .78)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 11, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(64, 120, 139, .2)';
    ctx.fill();
  }

  function drawNpc(npc) {
    var cx = (npc.x + 0.5) * TILE;
    var cy = (npc.y + 0.5) * TILE;
    ctx.fillStyle = 'rgba(0, 0, 0, .34)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 9, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = npc.color;
    ctx.beginPath();
    ctx.arc(cx, cy - 3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#28333a';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 12);
    ctx.lineTo(cx - 7, cy + 1);
    ctx.lineTo(cx + 7, cy + 1);
    ctx.lineTo(cx + 12, cy + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d7e0e1';
    ctx.font = (11 / tileScale) + 'px "KaiTi", "楷体", "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(npc.name, cx, cy + 27);
  }

  function drawRunner() {
    drawNpc({
      x: runner.x,
      y: runner.y,
      name: '赶来的村民',
      color: '#c18e68'
    });
  }

  function drawEnemy(enemy) {
    if (!enemy.alive) return;
    var cx = (enemy.x + 0.5) * TILE;
    var cy = (enemy.y + 0.5) * TILE;
    ctx.fillStyle = 'rgba(0, 0, 0, .45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    if (enemy.kind === 'boss') {
      ctx.moveTo(cx, cy - 16);
      ctx.lineTo(cx + 15, cy - 3);
      ctx.lineTo(cx + 11, cy + 14);
      ctx.lineTo(cx, cy + 18);
      ctx.lineTo(cx - 11, cy + 14);
      ctx.lineTo(cx - 15, cy - 3);
      ctx.closePath();
    } else {
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#f2d6c6';
    ctx.fillRect(cx - 5, cy - 4, 3, 3);
    ctx.fillRect(cx + 3, cy - 4, 3, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, .58)';
    ctx.fillRect(cx - 15, cy - 23, 30, 4);
    ctx.fillStyle = enemy.kind === 'boss' ? '#b54e58' : '#bd885c';
    ctx.fillRect(cx - 15, cy - 23, 30 * (enemy.hp / enemy.maxHp), 4);
    if (enemy.kind === 'boss') {
      ctx.fillStyle = 'rgba(233, 226, 218, .85)';
      ctx.font = (10 / tileScale) + 'px "KaiTi", "楷体", "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(enemy.name, cx, cy - 27);
    }
  }

  function drawSwordEffect(effect, now) {
    var progress = Math.max(0, Math.min(1, (now - effect.started) / effect.duration));
    var radius = Math.max(3, effect.maxRadius * progress);
    var centerX = (effect.x + 0.5) * TILE;
    var centerY = (effect.y + 0.5) * TILE;
    var direction = DIRECTIONS[effect.direction];
    var angle = Math.atan2(direction.y, direction.x);
    var halfArc = Math.PI / 3;
    ctx.save();
    ctx.globalAlpha = (1 - progress * 0.65) * 0.82;
    ctx.fillStyle = effect.team === 'player' ? '#d9f3f5' : '#cf6466';
    ctx.strokeStyle = effect.team === 'player' ? '#efffff' : '#ef8580';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle - halfArc, angle + halfArc);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    var cx = (player.x + 0.5) * TILE;
    var cy = (player.y + 0.5) * TILE;
    ctx.fillStyle = 'rgba(0, 0, 0, .42)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8dfe0';
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#54717b';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 13);
    ctx.lineTo(cx - 8, cy - 1);
    ctx.lineTo(cx + 8, cy - 1);
    ctx.lineTo(cx + 10, cy + 13);
    ctx.closePath();
    ctx.fill();
    var vector = DIRECTIONS[player.facing];
    ctx.strokeStyle = '#d9e3e3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + vector.x * 8, cy + vector.y * 5);
    ctx.lineTo(cx + vector.x * 18, cy + vector.y * 13);
    ctx.stroke();
  }

  function tick(timestamp) {
    var delta = timestamp - lastFrame;
    lastFrame = timestamp;
    frameTime += delta;
    updateRunner(timestamp);
    if (frameTime > 100) {
      frameTime = 0;
      updateBattle(timestamp);
      draw();
    }
    window.requestAnimationFrame(tick);
  }

  function stopHeldMovement() {
    heldMovement = null;
    if (movementRepeatTimer !== null) {
      window.clearInterval(movementRepeatTimer);
      movementRepeatTimer = null;
    }
  }

  function startHeldMovement(key, direction) {
    if (heldMovement === key) return;
    stopHeldMovement();
    heldMovement = key;
    movePlayer(direction);
    movementRepeatTimer = window.setInterval(function () {
      if (heldMovement !== key || (mode !== 'village' && mode !== 'battle')) {
        stopHeldMovement();
        return;
      }
      movePlayer(direction);
    }, 120);
  }

  function handleKey(event) {
    var target = event.target;
    var keyName = event.key.toLowerCase();
    var codeName = event.code || '';
    var isTextInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
    if (keyName === 'f1' || (keyName === '?' && !isTextInput)) {
      event.preventDefault();
      if (helpPanel) closeHelp();
      else showHelp();
      return;
    }
    if (helpPanel) {
      if (keyName === 'escape') {
        event.preventDefault();
        closeHelp();
      }
      return;
    }
    if (isTextInput) return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(keyName)) {
      event.preventDefault();
    }
    if (mode === 'dialogue') {
      if (keyName === 'enter' || keyName === ' ' || keyName === 'e') interact();
      return;
    }
    if (mode === 'epilogue') {
      if (keyName === 'enter' || keyName === ' ' || keyName === 'e') {
        var endingNext = overlay.querySelector('.dialog-next');
        if (endingNext) endingNext.click();
      }
      return;
    }
    if (mode === 'question') {
      if (/^[1-4]$/.test(keyName)) answer(Number(keyName) - 1);
      return;
    }
    if (mode === 'questionResult') {
      if (keyName === 'enter' || keyName === ' ' || keyName === 'e') {
        var continueButton = overlay.querySelector('.dialog-next');
        if (continueButton) continueButton.click();
      }
      return;
    }
    if (mode === 'battleReview') {
      if (keyName === 'enter' || keyName === ' ' || keyName === 'e') {
        var reviewContinue = overlay.querySelector('.dialog-next');
        if (reviewContinue) reviewContinue.click();
      }
      return;
    }
    if (mode === 'defeat') {
      if (keyName === 'r') {
        var retry = battleBosses.slice();
        startBattle(retry);
      } else if (keyName === 'v') {
        village();
      }
      return;
    }
    if (mode === 'village' && keyName === 'e') {
      interact();
      return;
    }
    if (mode !== 'village' && mode !== 'battle') return;
    var movement = {
      arrowup: 'up',
      w: 'up',
      arrowdown: 'down',
      s: 'down',
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right'
    }[keyName] || {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right'
    }[codeName];
    if (movement) {
      event.preventDefault();
      startHeldMovement(codeName || keyName, movement);
      return;
    }
    if (event.repeat) return;
    if (keyName === 'q' && mode === 'battle') openQuestion();
    else if (keyName === ' ' && mode === 'battle') attack();
  }

  nameForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var surname = surnameInput.value.trim();
    if (!surname) {
      surnameInput.focus();
      return;
    }
    save.surname = surname.slice(0, 16);
    save.defeated = [];
    save.bossDefeats = 0;
    save.comprehensiveDefeated = false;
    saveProgress();
    intro.hidden = true;
    adventure.hidden = false;
    startVillageStory();
  });

  document.getElementById('reset-game').addEventListener('click', resetAdventure);
  document.getElementById('help-toggle').addEventListener('click', showHelp);
  comprehensivePracticeLink.addEventListener('click', function (event) {
    if (save.defeated.length === BOSSES.length) return;
    event.preventDefault();
    announce('先分别击败三位知识之主，综合练习才会向你开启。');
  });
  document.getElementById('answer-action').addEventListener('click', openQuestion);
  document.getElementById('attack-action').addEventListener('click', attack);
  document.getElementById('interact-action').addEventListener('click', interact);
  leaveBattleAction.addEventListener('click', leaveBattle);
  Array.prototype.forEach.call(document.querySelectorAll('[data-move]'), function (control) {
    if (!window.PointerEvent) {
      control.addEventListener('click', function () { movePlayer(control.dataset.move); });
      return;
    }
    var activePointer = null;
    control.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      activePointer = event.pointerId;
      control.setPointerCapture(event.pointerId);
      startHeldMovement('pointer-' + event.pointerId, control.dataset.move);
    });
    function releasePointer(event) {
      if (activePointer !== event.pointerId) return;
      activePointer = null;
      stopHeldMovement();
    }
    control.addEventListener('pointerup', releasePointer);
    control.addEventListener('pointercancel', releasePointer);
    control.addEventListener('click', function (event) {
      if (event.detail === 0) movePlayer(control.dataset.move);
    });
  });
  document.addEventListener('keydown', handleKey, true);
  document.addEventListener('keyup', function (event) {
    var releasedKey = event.code || event.key.toLowerCase();
    if (heldMovement === releasedKey) stopHeldMovement();
  }, true);
  window.addEventListener('blur', stopHeldMovement);
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  if (save.surname) {
    intro.hidden = true;
    adventure.hidden = false;
    village();
    if (save.comprehensiveDefeated) showEnding();
    else announce('存档已载入。走近村民并按 E 继续冒险。');
  } else {
    intro.hidden = false;
    adventure.hidden = true;
  }
  window.requestAnimationFrame(tick);
})();
