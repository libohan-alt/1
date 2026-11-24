/* =========================================================
 * data.js — 内容层
 *
 * 三层原材料（词表 / 句式 / 干扰池）+ 三份「规则」交给 engine.js 生成题库。
 * 不接触 DOM，可以单独在 Node 里跑。
 * ========================================================= */

/* ---------- 第 1 关：already / just / yet ---------- */

/* [原形, 过去分词, 宾语] */
var V1 = [
  ['finish','finished','the report'], ['read','read','this book'],
  ['write','written','the letter'],  ['eat','eaten','breakfast'],
  ['see','seen','this film'],        ['do','done','the homework'],
  ['take','taken','the medicine'],   ['buy','bought','the tickets'],
  ['send','sent','the email'],       ['find','found','my keys'],
  ['clean','cleaned','the room'],    ['wash','washed','the dishes'],
  ['make','made','the bed'],         ['meet','met','the new teacher'],
  ['print','printed','the photos'],  ['pack','packed','the bags'],
  ['call','called','the doctor'],    ['pay','paid','the bill'],
  ['post','posted','the parcel'],    ['repair','repaired','the bike'],
  ['water','watered','the flowers'], ['check','checked','the answers'],
  ['copy','copied','the notes'],     ['paint','painted','the wall'],
  ['fix','fixed','the chair'],       ['throw','thrown','the rubbish'],
  ['choose','chosen','the topic'],   ['forget','forgotten','the password'],
  ['lose','lost','my umbrella'],     ['cook','cooked','dinner'],
  ['draw','drawn','the picture'],    ['sing','sung','the song'],
  ['break','broken','the cup'],      ['open','opened','the window'],
  ['close','closed','the door'],     ['book','booked','the hotel'],
  ['collect','collected','the stamps'], ['plant','planted','the trees'],
  ['mend','mended','the shoes'],     ['borrow','borrowed','the novel']
];

/* pos: 'mid' → 空位在 have/has 与过去分词之间；'end' → 空位在句末 */
var F1 = [
  { t:'I have ___ {pp} {obj}.',    cn:'已经',  ans:'already', pos:'mid' },
  { t:'She has ___ {pp} {obj}.',   cn:'已经',  ans:'already', pos:'mid' },
  { t:'We have ___ {pp} {obj}.',   cn:'已经',  ans:'already', pos:'mid' },
  { t:'He has ___ {pp} {obj}.',    cn:'刚刚',  ans:'just',    pos:'mid' },
  { t:'They have ___ {pp} {obj}.', cn:'刚刚',  ans:'just',    pos:'mid' },
  { t:'You have ___ {pp} {obj}.',  cn:'刚刚',  ans:'just',    pos:'mid' },
  { t:'I have not {pp} {obj} ___.', cn:'还（没）', ans:'yet', pos:'end' },
  { t:'Have you {pp} {obj} ___?',  cn:'还…吗', ans:'yet',     pos:'end' },
  { t:'She has not {pp} {obj} ___.', cn:'还（没）', ans:'yet', pos:'end' },
  { t:'Has he {pp} {obj} ___?',    cn:'还…吗', ans:'yet',     pos:'end' }
];

var POOL1_MID = ['already','just','ever','never','recently','finally'];
var POOL1_END = ['yet','already','just','ever'];

/* ---------- 第 2 关：for / since ---------- */

var D2 = ['three years','five years','ten years','two years','a year','six months',
  'three months','two weeks','a week','three days','two days','ten minutes',
  'twenty minutes','half an hour','two hours','three hours','a long time',
  'quite a long time','ages','several weeks','several months','a few days',
  'many years','the last two years','a whole morning'];

var T2 = ['2020','2019','2018','last year','last Monday','last summer','last weekend',
  "three o'clock",'half past nine','six thirty','Monday','Tuesday morning','January',
  'last January','Christmas','the Spring Festival','my birthday','I was a child',
  'I was ten','we moved here','he left school','the beginning of term',
  'the summer holiday','I started this job','she came to Shanghai'];

var F2 = [
  'I have lived here ___ {x}.',
  'She has worked here ___ {x}.',
  'We have known each other ___ {x}.',
  'He has been ill ___ {x}.',
  'He has kept a diary ___ {x}.',
  'I have studied English ___ {x}.',
  'She has had this bike ___ {x}.'
];

var POOL2 = ['in','at','during','by','until'];

/* ---------- 第 3 关：been to / gone to ---------- */

var P3 = [
  { n:'Tom',        aux:'has',  p3:true,  P:'He'  },
  { n:'Lily',       aux:'has',  p3:true,  P:'She' },
  { n:'my father',  aux:'has',  p3:true,  P:'He'  },
  { n:'my mother',  aux:'has',  p3:true,  P:'She' },
  { n:'my brother', aux:'has',  p3:true,  P:'He'  },
  { n:'my sister',  aux:'has',  p3:true,  P:'She' },
  { n:'I',          aux:'have', p3:false, P:'I'   },
  { n:'we',         aux:'have', p3:false, P:'We'  },
  { n:'they',       aux:'have', p3:false, P:'They'},
  { n:'my parents', aux:'have', p3:false, P:'They'}
];

var L3 = ['Shanghai','Beijing','London','Hong Kong','Hangzhou','Japan','the library',
  'the shop','the museum','the park','the post office','the bank','the hospital',
  'the supermarket','the cinema','the Science Museum','the gym','the office',
  'the airport','the zoo'];

var TM3 = ['in ten minutes','in an hour','tomorrow','on Friday','this afternoon','soon'];
var N3 = ['twice','three times','four times','five times','several times','many times'];
var POOL3_EVER = ['been to','gone to','gone in','been at'];


/* =========================================================
 * 题解生成
 * ========================================================= */

function why1(ans, v){
  var base = v[0], pp = v[1];
  if (ans === 'already'){
    return 'already 用在肯定句，表示「已经完成」。位置固定在 have/has 和过去分词之间：' +
      'have/has + already + 过去分词。它和 just 的区别在时间感：already 强调「早就完成了」，' +
      'just 强调「刚刚发生」。本句的过去分词是 ' + pp + '（' + base + '）。';
  }
  if (ans === 'just'){
    return 'just 表示「刚刚发生」，位置同样在 have/has 和过去分词之间：have/has + just + 过去分词。' +
      '如果换成 already，句意会变成「早就完成了」，与中文提示的「刚刚」不符。' +
      '本句的过去分词是 ' + pp + '（' + base + '）。';
  }
  return 'yet 只用于否定句和疑问句，一般放在句末，表示「还（没）」。' +
    '对应的肯定句要换成 already：I have not finished it yet. 与 I have already finished it. ' +
    '注意不要把 yet 塞进 have/has 和过去分词之间。本句的过去分词是 ' + pp + '（' + base + '）。';
}

function why2(ans){
  if (ans === 'for'){
    return 'for 后面接一段时间，回答的是「多久」，比如 three years、two weeks、half an hour。' +
      '判断方法：把后面的内容放到「持续了……多久」里读，读得通就用 for。' +
      'since 则接时间点或从句。两者常常可以互相改写：for three years 约等于 since three years ago。';
  }
  return 'since 后面接一个时间点（2020、last Monday、Monday、three o\'clock）或一个从句' +
    '（since I was a child），表示「从那一刻开始」。' +
    '判断方法：后面是「某个时刻」而不是「一段长度」，就用 since；如果是一段时间，必须用 for。';
}

function why3(ans, aux){
  var agree = aux === 'has'
    ? '本句主语是第三人称单数，助动词用 has。'
    : '本句主语是 I / you / 复数，助动词用 have。';
  if (ans === 'gone'){
    return 'have/has gone to 表示「去了某地，还没回来」，人不在现场。' +
      '判断线索：Where is …?、… is not here、He will be back …，这些说法都在暗示「这个人现在不在这儿」。' +
      agree;
  }
  return 'have/has been to 表示「去过某地」，人已经回来了，常与 ever、never、before 和次数连用。' +
    '判断线索：twice、three times、ever、before 都在讲经历。' +
    '另外 have/has been in 才是「待在某地多久」，和 been to 不是一回事。' + agree;
}


/* =========================================================
 * 三份规则 —— 交给 Engine.buildBank 生成题库
 * ========================================================= */

var SPEC1 = [{
  axes: [{ name:'v', list:V1 }, { name:'f', list:F1 }],
  template: function (r){ return r.f.t.replace('{pp}', r.v[1]).replace('{obj}', r.v[2]); },
  cn:    function (r){ return r.f.cn; },
  answer:function (r){ return r.f.ans; },
  pool:  function (r){ return r.f.pos === 'mid' ? POOL1_MID : POOL1_END; },
  why:   function (ans, r){ return why1(ans, r.v); },
  take: 3
}];

var SPEC2 = [{
  axes: [{ name:'f', list:F2 }, { name:'x', list:D2.concat(T2) }],
  template:  function (r){ return r.f.replace('{x}', r.x); },
  answer:    function (r){ return D2.indexOf(r.x) >= 0 ? 'for' : 'since'; },
  pool:      POOL2,
  mustHave:  function (r){ return [ D2.indexOf(r.x) >= 0 ? 'since' : 'for' ]; },
  why:       function (ans){ return why2(ans); },
  take: 2
}];

/* 第 3 关：同一批轴，套 5 种句式（顺序影响出题顺序，勿随意调整） */
var AXES3 = [{ name:'p', list:P3 }, { name:'pl', list:L3 }];

var pool3 = function (r){
  var o = r.p.aux === 'has' ? 'have' : 'has';
  return [o + ' been to', o + ' gone to', r.p.aux + ' gone in', o + ' gone in'];
};
var gone3 = function (r){ return r.p.aux + ' gone to'; };
var been3 = function (r){ return r.p.aux + ' been to'; };
var yes3  = function (r){ return r.p.p3; };
var sparse3 = function (r, v, i){ return (i + r.pl.length) % 2 === 0; };

var SPEC3 = [
  {
    axes: AXES3,
    patterns: [
      {   /* Where is …? → gone */
        when: yes3,
        template: function (r){ return Engine.cap('Where is ' + r.p.n + '? — ' + r.p.P + ' ___ ' + r.pl + '.'); },
        answer: gone3, pool: pool3, mustHave: function (r){ return [been3(r)]; },
        why: function (ans, r){ return why3('gone', r.p.aux); }, take: 2
      },
      {   /* … is not here. → gone */
        when: yes3,
        template: function (r){ return Engine.cap(r.p.n + ' is not here. ' + r.p.P + ' ___ ' + r.pl + '.'); },
        answer: gone3, pool: pool3, mustHave: function (r){ return [been3(r)]; },
        why: function (ans, r){ return why3('gone', r.p.aux); }, take: 2
      },
      {   /* … will be back … → gone（稀疏采样） */
        when: yes3, each: TM3, every: sparse3,
        template: function (r, tm){ return Engine.cap(r.p.n + ' ___ ' + r.pl + '. ' + r.p.P + ' will be back ' + tm + '.'); },
        answer: gone3, pool: pool3, mustHave: function (r){ return [been3(r)]; },
        why: function (ans, r){ return why3('gone', r.p.aux); }, take: 2
      },
      {   /* … twice. → been（稀疏采样） */
        each: N3, every: sparse3,
        template: function (r, k){ return Engine.cap(r.p.n + ' ___ ' + r.pl + ' ' + k + '.'); },
        answer: been3, pool: pool3, mustHave: function (r){ return [gone3(r)]; },
        why: function (ans, r){ return why3('been', r.p.aux); }, take: 2
      },
      {   /* … before. → been */
        template: function (r){ return Engine.cap(r.p.n + ' ___ ' + r.pl + ' before.'); },
        answer: been3, pool: pool3, mustHave: function (r){ return [gone3(r)]; },
        why: function (ans, r){ return why3('been', r.p.aux); }, take: 2
      }
    ]
  },
  {
    axes: [{ name:'pl', list:L3 }],
    patterns: [
      {   /* Have you ever …? → been to */
        template: function (r){ return 'Have you ever ___ ' + r.pl + '?'; },
        answer: 'been to', pool: POOL3_EVER, mustHave: ['gone to'],
        why: function (ans){ return why3('been', 'have'); }, take: 2
      }
    ]
  }
];


/* ---------- 生成题库 ---------- */
var BANK = {
  1: Engine.buildBank(SPEC1, 11),
  2: Engine.buildBank(SPEC2, 22),
  3: Engine.buildBank(SPEC3, 33)
};

/* ---------- 题库令牌：对外 API 用这个名字取题 ---------- */
var TOKENS = {
  c1:  { title:'already / just / yet',  items: BANK[1] },
  c2:  { title:'for / since',           items: BANK[2] },
  c3:  { title:'been to / gone to',     items: BANK[3] },
  all: { title:'综合', pool: BANK[1].concat(BANK[2]).concat(BANK[3]) }
};


/* =========================================================
 * 鼓励语池：对错各 30 × 18 = 540 条
 * ========================================================= */

var ENC_OK_A = [
  '对了', '正确', '没问题', '就是这个', '答得好', '判断准确', '思路对', '稳稳的', '抓住了',
  '没走偏', '干净利落', '反应很快', '这一下很准', '选得对', '看得准', '没被绕进去',
  '区分得很清楚', '没被干扰项带跑', '对位准确', '这一步很扎实', '眼光不错', '把握住了',
  '判断没问题', '下笔很稳', '没被表面的词骗到', '分辨得很清楚', '选得干脆',
  '这个位置你吃透了', '正确无误', '处理得很稳'
];
var ENC_OK_B = [
  '继续保持', '下一题', '这个节奏很好', '已经进入状态了', '后面的题也照这样来',
  '保持这个判断方式', '感觉出来了', '越来越顺', '稳定发挥', '就按这个思路走', '别停',
  '状态在线', '这样很好', '接着来', '节奏稳', '保持住', '顺下去', '一路推下去'
];
var ENC_NO_A = [
  '差一点', '这次没接住', '方向偏了', '先别急', '没关系', '这次没对上', '再看一眼',
  '这个容易混', '这题有坑，不怪你', '判断被带偏了', '差一步', '有点可惜', '这次没过',
  '卡在这儿了', '这里确实容易弄错', '先放一放', '不算大事', '别慌', '换个角度就好了',
  '这里容易看走眼', '别放在心上', '慢慢来', '这一步确实难', '容易被误导',
  '这题的干扰项很强', '先记一下位置', '值得再看一遍', '这里要多想一步',
  '别急着下结论', '这组本来就最容易错'
];
var ENC_NO_B = [
  '题解在最后，等会儿一起看', '后面还有机会', '先往下走，最后统一复盘',
  '记一下这个位置就好', '不影响后面', '接着做，最后一起看', '不要停在这里',
  '先过，回头细看', '最后有详细讲解', '这题先跳过', '保持节奏，后面还有题',
  '等会儿对照题解', '先记住这个感觉', '继续往下', '别被它拖住', '下一题继续',
  '最后会一起讲清楚', '先走，答案都在最后'
];
