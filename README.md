# 英语学习工具

一个无需安装依赖的静态英语语法练习项目，提供三类专项练习和一项 60 秒限时综合练习。

## 运行

建议通过本地 HTTP 服务打开，避免浏览器对本地文件的限制。使用 Windows PowerShell：

```powershell
cd d:\1\proojects\untitled1\1
py -m http.server 8000
```

然后访问 <http://localhost:8000/>。停止服务时在 PowerShell 按 `Ctrl+C`。

## 页面与类别

| 页面 | 内容 | 类别 |
| --- | --- | --- |
| `index.html` | 课程首页 | — |
| `two.html` | Already / Just / Yet | `c1` |
| `three.html` | For / Since | `c2` |
| `four.html` | Have been / Gone to | `c3` |
| `five.html` | 综合练习，限时 60 秒 | `all` |

专项练习默认每轮 10 题。答题后会短暂显示用户答案与正确答案，不显示解析或“回答错误”提示；约半秒后自动平滑切换到下一题。答案解析在本轮结束后统一呈现；综合练习超时后也会进入复盘，未答题目会标记为“未作答”。

## JavaScript 文件关系

- `engine.js`：通用题目生成、选项构造与洗牌算法，不负责页面显示。
- `data.js`：三类题目的素材、出题规则、题解，并通过 `TOKENS` 暴露 `c1`、`c2`、`c3` 和 `all` 题库。
- `quiz-ui.js`：负责题目和复盘页面的 DOM 渲染，并切换练习/复盘状态。
- `quiz-mini.js`：从 `TOKENS` 读取题目，负责答题流程、计时与结果统计。
- `quiz.css`：独立视觉样式。练习页使用渐变背景；复盘页背景为固定纯色，题目和解析卡片保留毛玻璃效果，只有解析文字入场动画。
- `app.js`：旧版完整界面的实现。目前这些 HTML 页面没有加载它；运行旧版界面前，需要提供它依赖的页面 DOM，并先加载 `engine.js`、`data.js`。

练习题卡与选项沿用首页的黑白渐变、玻璃质感、大圆角和高对比视觉；对错反馈、计时和结束复盘保持简洁，题目文字仍以纯文本方式渲染。

练习页先加载 `quiz.css`，脚本按此顺序加载：

```html
<script src="engine.js"></script>
<script src="data.js"></script>
<script src="quiz-ui.js"></script>
<script src="quiz-mini.js"></script>
```

创建练习时通过类别选择题库：

```js
var quiz = Quiz.create(document.getElementById('app'), {
  type: 'c2',
  rounds: 10
});
quiz.start();
```

可用类别为 `c1`、`c2`、`c3`、`all`。综合练习可配置 `timeLimit`（秒）；默认值为 60 秒。专项练习默认不计时。

## 安全说明

这是一个本地静态学习工具，不包含账号、服务端或敏感信息处理。当前测验界面使用 DOM 文本节点展示题目、选项和解析，不把题库文本作为 HTML 执行；首页课程入口使用普通链接，不使用内联跳转脚本。

- 题库应作为可信的项目内容维护。若将来允许导入用户题目、从 API 加载题目或支持评论等不可信内容，继续使用 `textContent` 和 DOM 节点；不要将这些内容拼进 `innerHTML`、`eval` 或内联事件处理器。
- 不要把密码、API 密钥或其他凭据放入 HTML、JavaScript、题库或提交到版本库。静态页面无法保护写在客户端的秘密。
- 若部署到公开网站，使用 HTTPS，并由 Web 服务器设置合适的安全响应头（例如 Content-Security-Policy、X-Content-Type-Options、Referrer-Policy）；不要仅依赖页面代码实现安全边界。
- `app.js` 是未接入当前练习页面的旧版代码。重新启用前，应单独检查其中的动态 HTML 渲染，再确认只把可信内容写入 HTML。

## 验证

可用 Node.js 检查脚本语法：

```powershell
node --check .\engine.js
node --check .\data.js
node --check .\quiz-ui.js
node --check .\quiz-mini.js
```
