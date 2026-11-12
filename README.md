# Mountain City: Last Delivery

《山城有路：最后一单》已提供双端共享的 M1.2.1 固定步与暂停验证场景。画面中的标记由共享模拟移动，诊断区域显示 Tick、暂停令牌数量、帧内步数、余量和丢弃时间。「重新启动」先销毁 Phaser 实例，再重新加载原页面并创建新实例；不是检查点恢复。

## 技术栈与安装

要求 Node.js 22.12 或以上。本次在 Windows 11 x64、Node.js 24.15.0、npm 12.0.2 上验证。

| 依赖 | 锁定版本 | 用途 |
| --- | --- | --- |
| Phaser | 3.90.0 | 共享场景与 Canvas 渲染 |
| TypeScript | 5.9.3 | 核心、渲染与桌面主进程 |
| Vite | 8.3.7 | Web 开发与构建 |
| Electron | 44.11.1 | Windows 桌面容器 |
| electron-builder | 26.18.0 | Windows x64 应用目录打包 |
| playwright-core | 1.65.0 | 仅开发测试：真实浏览器／桌面生命周期验证，不打入应用 |

Electron 44.11.1 是本次核对的受支持稳定分支补丁版本，未使用预发布版本，见 [Electron Releases](https://releases.electronjs.org/)。选择 electron-builder 是为了直接打包已有 Vite 产物，不引入第二套 Renderer 构建流程；未安装 Forge。

在仓库根目录执行：

```powershell
npm.cmd ci --registry=https://registry.npmjs.org
```

Electron 二进制在首次桌面启动或构建时按锁定版本下载，后续复用本地缓存。安装过程不要求批准未使用的 Squirrel 安装脚本；当前交付采用应用目录。

本机 Node.js 直连下载会超时，本次干净安装和首次 Electron 下载实际使用了现有系统代理。需要同样联网方式时，在当前 PowerShell 会话执行以下设置；不修改系统代理或 `.npmrc`：

```powershell
$npmProxy = [System.Net.WebRequest]::DefaultWebProxy.GetProxy([uri]'https://registry.npmjs.org').AbsoluteUri
npm.cmd ci --registry=https://registry.npmjs.org --proxy=$npmProxy --https-proxy=$npmProxy
$env:HTTPS_PROXY = $npmProxy
$env:HTTP_PROXY = $npmProxy
$env:ELECTRON_GET_USE_PROXY = '1'
$env:ELECTRON_MIRROR = 'https://github.com/electron/electron/releases/download/'
```

## 在 Windows 上启动 Web 开发环境

在仓库根目录的 PowerShell 执行：

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

浏览器打开 [http://127.0.0.1:5173/](http://127.0.0.1:5173/)。

## 构建和预览 Web 产物

```powershell
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

构建先分别检查共享核心和完整 Web 工程的 TypeScript 类型，再生成 `dist/`。浏览器打开 [http://127.0.0.1:4173/](http://127.0.0.1:4173/) 预览构建结果。

## Electron 开发启动

```powershell
npm.cmd run electron:dev
```

该命令编译主进程，启动仅监听 `127.0.0.1` 的 Vite 服务，再创建 Electron 窗口。服务自动选取空闲端口，并在终端打印实际地址；关窗退出应用后，启动器同时关闭该服务。

## Windows 应用构建与运行

```powershell
npm.cmd run electron:build
& '.\release\win-unpacked\Mountain City Last Delivery.exe'
```

构建复用 Web 产物，编译主进程，并使用锁定的 Electron 二进制生成 `release/win-unpacked/`。这是免安装应用目录，运行与分发时必须保留整个目录，不能只复制 EXE。

生产入口为 `app://game/index.html?platform=windows`，只读取随包提供的本地资源，忽略开发服务环境变量；无需 Vite 服务、Node.js 或项目源码。当前未生成安装器，未进行代码签名、自动更新或公开发布。

## 代码结构

| 路径 | 职责 |
| --- | --- |
| `index.html` | Web 页面入口，提供画布容器和重启按钮。 |
| `src/platform/web/` | Web 适配层。 `main.ts` 调用核心、挂载 Phaser、处理销毁和重启，并将启动错误写入浏览器日志。 |
| `src/core/game.ts` | 共享入口，装配模拟与生命周期控制器，维护诊断标记状态。 |
| `src/core/simulation.ts` | 固定步累加器、实际 Tick、有界补算及余量／丢弃统计。 |
| `src/core/lifecycle.ts` | Owner + Key 去重、Token 所有权、退役与有效暂停集合。 |
| `src/platform/web/visibility.ts` | 两端共用的 Renderer 可见性适配，转发 Acquire／Release，不直接修改模拟。 |
| `src/rendering/phaser/startup.ts` | Phaser 渲染层，用 Canvas 绘制启动场景并管理渲染实例的销毁。 |
| `electron/main.ts` | 主进程：应用启动、窗口管理、关闭／重新激活、安全策略与本地协议。无游戏业务。 |
| `electron/local-resources.ts` | 校验开发地址与本地资源路径，阻止越界文件读取。 |
| `scripts/electron-dev.mjs` | 共同管理开发服务与 Electron 进程的启停。 |
| `tsconfig.electron.json` | 单独编译主进程至 `dist-electron/`，不向共享核心引入 Node.js 类型。 |
| `vite.config.ts` | 排除桌面构建输出的文件监听，避免打包触发开发页面刷新。 |
| `tests/local-resources.test.mjs` | 本地协议路径及开发地址白名单测试。 |
| `tests/simulation.test.mjs` | 可控时间下的固定步与暂停协议测试。 |
| `tests/visibility.test.mjs` | 可见性适配的隐藏启动、重复通知与解绑测试；不代替实机测试。 |
| `tests/platform-smoke.mjs` | 真实 Edge 标签页及 Electron 原生最小化／恢复，附独立包和重启回归。 |
| `docs/` | 策划、决策与赛事原始材料。 |

两端均运行 `index.html → src/platform/web/main.ts`。此入口直接引用同一个 `src/core/game.ts` 和 `src/rendering/phaser/startup.ts`；Electron Main 只选择开发 URL 或本地生产 URL。查询参数仅影响平台文字，不授予原生能力。没有独立 Windows 核心、场景、Preload 或 IPC 接口。

## M1.2.1 模拟与暂停实现

所有数值和接口都是本任务的工程验证实现，不修改 CONFIRMED 决策，不宣称最终物理或游戏参数已确定。

- 原型固定步为 20 ms（50 Hz），每个渲染帧最多执行 5 步。标记以每秒 100 单位在 600 单位长的轨道循环移动，不包含玩家输入或碰撞。
- 帧顺序：适配层提供单调 `performance.now()` 样本 → 共享模拟累加有效经过时间 → 每个实际步增加一个 SimulationTick，并用固定 Delta 更新标记 → 丢弃超额完整步、保留不足一步余量 → Phaser 绘制结果并更新诊断。没有物理、触发器、玩法事件或检查点批次。
- 渲染只提供调度机会，不使用 Phaser 已平滑的帧 Delta。首帧建立基线；暂停保留已有余量，恢复后首帧重建基线，不累积后台时间、不重播旧步。
- Controller 同步维护有效 Token 集合，只有集合清空才协调恢复。Owner 和 Request Key 是来源生成的独立 symbol；Token 是 Controller 创建的另一个 symbol，只作同进程实例内身份，不是跨进程凭据或业务 ID。
- 同一 Owner + Key 有效时返回原 Token，不使用引用计数；旧 Key 退役后返回 undefined。Release 只接受准确 Token 及其 Owner，返回 released、already-released 或 rejected；错误释放不改变其他暂停。
- 去重、所有权及退役记录保留至整个核心实例被释放；当前完整重启会创建新实例，不提供跨会话持久化或提前回收退役记录。

两端均通过真实 `document.visibilitychange` 接入。每个连续隐藏区间生成一个 Request Key，重复通知沿用；可见时仅释放该适配层的 Token，下次隐藏使用新 Key。Windows 保持 Electron 默认的后台节流设置，原生最小化会将 Renderer 可见性变为 hidden；已实际验证，无需 Preload 或 IPC。控制器不依赖模拟步推进或 CheckpointCoordinator。适配监听器在完整重启前解绑。

## Electron 安全边界

Renderer 明确关闭 `nodeIntegration`，启用 `contextIsolation`、`sandbox` 和 `webSecurity`。安全标准自定义协议不绕过 CSP，只允许读取 `dist/index.html` 与 `dist/assets/`；拒绝路径越界、凭据和其他主机。Main 在路径校验后通过 Electron 支持 ASAR 的文件接口读取资源，不向 Renderer 开放 `file://`。

仅允许主框架刷新原入口；拦截其他页面导航、重定向、子框架导航和新窗口，拒绝设备等权限请求。生产 CSP 禁止网络连接和外部代码，允许 Phaser 所需的内联样式，但不允许内联脚本或 `unsafe-eval`。源码未设置远程调试端口。

## M1.1.2 历史验证记录

验证日期：2026-11-11。以下结果仅覆盖 M1.1 静态启动场景。

| 验收项 | 状态 | 实际依据 |
| --- | --- | --- |
| M1.1-01 依赖安装 | PASS | 从最终锁文件在全新临时目录执行 `npm ci` 成功。 |
| M1.1-02 Web 开发启动 | PASS | Vite 启动；浏览器实际加载。 |
| M1.1-03 Web 加载共享核心 | PASS | 浏览器画布绘制核心返回的项目名与里程碑。 |
| M1.1-04 Web 场景渲染 | PASS | 浏览器文字／像素断言，原 Web 版两次重启复测；未捕获页面错误。 |
| M1.1-05 核心平台隔离 | PASS | 独立类型检查不加载 DOM 或 Node.js 类型；核心无平台 API 或平台模块引用。 |
| M1.1-06 Web 生产构建 | PASS | `npm run build` 成功；同一构建资源已在独立桌面包中实际运行。 |
| M1.1-07 Windows 桌面启动 | PASS | 开发命令创建可见窗口；移出仓库的生产包连续两次启动成功。 |
| M1.1-08 双端共享 | PASS | 两端同一入口及直接模块引用；ASAR 内 HTML、JS、CSS 与 Web 构建文件逐字节一致；双端均有实际渲染证据。 |
| M1.1-09 操作说明 | PASS | 本文记录的安装、开发和构建命令已执行，Windows 原生关窗后启动器退出码为 0。 |

开发版与生产包各连续启动两次，每次验证启动文字、画布像素、两次场景重启、窗口最小化／恢复、安全偏好、Node.js API 不可见、外部导航与新窗口拦截，以及原生关窗后退出码 0。生产测试将整个应用目录复制到仓库外，并关闭本项目开发服务；设置无效开发 URL 时仍从安全本地协议启动。未发现正常启动时的资源加载失败或页面／控制台错误。

```powershell
npm.cmd test
```

M1.1.2 当时仅有 3 组路径与开发地址测试。M1.2.1 的当前测试范围及结果见下节；应用包仍排除开发脚本、测试、策划资料与 `node_modules`。

## M1.2.1 实际验收

验证日期：2026-11-11，Windows 11 x64。本次实际执行：

```powershell
npm.cmd test
npm.cmd run electron:build
npm.cmd run test:platform
npm.cmd run electron:dev
git diff --check
```

`npm test` 执行核心／Renderer 类型检查、主进程编译及 11 组自动化测试，全部 PASS。核心测试直接以受控时间调用共享实现，不依赖真实时钟；Node 使用内置 TypeScript 类型擦除，无额外编译框架。

`test:platform` 需要已安装 Microsoft Edge、可交互 Windows 桌面及先行完成的生产构建。测试自建临时开发服务和独立浏览器配置，采用 `connectOverCDP({ noDefaults: true })`，不注入 Playwright 默认的焦点／可见性模拟。真实切换标签页及调用原生 BrowserWindow.minimize／restore，断言原生窗口确实最小化、Renderer 真实 hidden、Token 数量、标记与 Tick 停止。调试端口只由测试进程参数开启，不写入生产入口。

每端执行两轮隐藏／恢复，每轮持续 1200 ms；Web、Electron 开发版及仓库外生产包均通过。最近生产包记录为 Tick 4／Marker 8 隐藏，恢复首帧仍为 Tick 4；第二轮 Tick 5／Marker 10 同样保持。后台时间未转换为补算或丢弃时间。每端另连续重启 3 次，Electron 两种模式原生关窗退出码均为 0。生产包复制到临时目录，测试自建开发服务关闭后，从 app://game 运行，并忽略故意设置的无效开发 URL。原有 electron:dev 命令另行验证可见窗口及关窗后启动器退出码 0。

| 验收项 | 状态 | 执行证据 |
| --- | --- | --- |
| 1 不同帧分布 | PASS | 30／60／144 帧分布下，1 秒有效时间均执行 50 个固定步；分数步长另测。 |
| 2 固定 Delta 与实际 Tick | PASS | 逐步回调断言 Delta 恒为 20 ms，Tick 为实际回调的连续序号。 |
| 3 有界补算与丢弃 | PASS | 85 ms 与 10 秒间隔测试，补算不超过配置上限，余量保留且丢弃无回调。 |
| 4 令牌协议 | PASS | 重复 Acquire、多独立请求、错误 Owner、未知 Token、重复 Release、旧 Key 重交及跨实例拒绝。 |
| 5 多来源隔离 | PASS | 释放一方后另一 Token 保持暂停；适配层解绑不解除其他来源。 |
| 6 暂停与无追赶恢复 | PASS | 可控时间测试及三个真实环境的 Tick／标记冻结、首帧采样与后续继续推进。 |
| 7 Web 隐藏／恢复 | PASS | 真实 Edge 前后台标签页切换，两轮各 1200 ms。 |
| 8 Windows 最小化／恢复 | PASS | 开发版及仓库外生产包的原生最小化与真实 visibilityState 断言。 |
| 9 启动回归 | PASS | Web 开发服务、electron:dev、electron:build、独立包及三次重启检查通过。 |
| 10 核心平台隔离 | PASS | 核心在无 DOM／Node 全局类型配置下检查通过；未引入平台模块。 |

`git diff --check` 通过。旧未提交策划改动得到保留，未执行 Commit、Push 或公开发布。

## M1.2.1-R1 就绪与重启排查

验证日期：2026-11-11。本次只修改平台测试、证据输出及文档，不修改游戏、渲染、可见性适配或 Electron Main 的行为。七个应用源文件的前后 SHA-256 一致。

### 根因与就绪阶段

旧 ready() 将 Tick > 0 同时当作页面加载、场景创建及模拟运行的就绪条件，而且在显式显示／激活原生窗口前调用。隐藏页面按 CONFIRMED 规则暂停时，该条件本来就不应满足。当前分为：

1. 页面加载：document.readyState 为 complete，入口脚本已写入诊断数据，页面无错误提示；不要求 Tick 增长。
2. 场景就绪：真实显示、还原并激活窗口后，检查单一画布、POST_RENDER 后启用的重启按钮及实际画布像素；独立于 Tick。
3. 模拟运行：确认真实 visibilityState 为 visible、对应暂停已解除，再要求 Tick 在当前值基础上继续增长。

各阶段仍使用原 15 秒就绪预算，隐藏状态采用定时轮询，不依赖暂停的 RAF。未伪造可见性事件或属性，未关闭后台节流，也未删除暂停／恢复／重启断言。

受控复现使用真实最小化后的页面重载：窗口 visible=false、minimized=true、focused=false，页面 complete、hidden，已有画布，Tick 0／Marker 0／Token 1，页面错误为空。保持旧条件及原超时值时，旧 ready 检查稳定返回 FAIL；截图显示已创建的暂停场景。真实恢复窗口后，首个可见帧仍为 Tick 0，随后正常推进，discarded 不增加。这确认当前生产包报告中的就绪判定矛盾，不代表已确定最早那次重启超时的原因。

三轮正常启动的开发版与生产包初始窗口均实际显示、未最小化且已聚焦。原独立复测为何最初处于 hidden，没有充分证据，不能据受控复现反推其原生窗口原因。

### 重启、诊断与失败清理

重启前与导航后均执行真实窗口准备。测试分别记录旧画布移除、beforeunload、页面导航和加载，再检查新场景及模拟继续推进，不把隐藏且正确暂停的新页面直接判为失败。

每次运行在 `test-results/platform/run-*/report.json` 保存独立报告，不覆盖旧结果。包括阶段／操作、页面状态、窗口显示／最小化／焦点／尺寸、诊断数据、页面错误、导航和画布销毁标记、截图、进程输出与退出码、服务清理情况。最小化 Electron 的截图使用 BrowserWindow.capturePage(stayHidden=true)，不为取证显示窗口；截图不可用时也保存原始错误。

失败清理覆盖启动、调试连接和页面测试各阶段，只操作本轮保存的 ChildProcess 与调试连接，不按全局进程名关闭应用；先请求正常退出，必要时限定到本轮进程树。服务在 finally 中关闭，单个平台失败仍记录并继续其余可运行平台。

### 实际命令与逐轮结果

```powershell
npm.cmd test
npm.cmd run electron:build
npm.cmd run test:platform
npm.cmd run test:platform
npm.cmd run test:platform
git diff --check
```

前两项分别为 11 项单元测试 PASS、Web 与 Windows 生产构建 PASS。三轮平台测试连续执行，中间未改变测试驱动；源文件 SHA-256 校验一致。

| 轮次 | Web | Electron 开发版 | 仓库外独立生产包 | 退出码 | 报告 |
| --- | --- | --- | --- | --- | --- |
| 1 | PASS | PASS | PASS | 0 | [run-KYFCdy](test-results/platform/run-KYFCdy/report.json) |
| 2 | PASS | PASS | PASS | 0 | [run-Nzb2EF](test-results/platform/run-Nzb2EF/report.json) |
| 3 | PASS | PASS | PASS | 0 | [run-0MGiRV](test-results/platform/run-0MGiRV/report.json) |

每轮每端均覆盖隐藏启动 Tick 0、真实恢复、两轮各 1200 ms 的隐藏／恢复及三次完整重启。每轮三个测试进程均正常退出 0，服务清理通过。批次原始日志及驱动哈希见 [三轮汇总](test-results/platform/three-runs-20261111-224207/summary.json)；证据保存在本机，目录已加入 Git 忽略。

提交整理仅移除了测试驱动末尾的多余空行，没有逻辑变更；运行时的精确脚本已保存在同一批次目录的 platform-smoke-tested.mjs，前后哈希及格式等价检查见 commit-whitespace-audit.json。三轮汇总中的哈希对应实际运行版本。

排查中的失败也保留：

- `npm.cmd run test:platform -- --reproduce-legacy-ready`：旧 ready 子检查为预期 FAIL，修正后的完整流程 PASS。[首次复现](test-results/platform/run-hMzep8/report.json) 保留了最小化截图超时记录；改用原生 stayHidden 截图后，[再次复现](test-results/platform/run-GHIcez/report.json) 保存了 [超时现场截图](test-results/platform/run-GHIcez/010-electron-packaged-legacy-ready-timeout.png)。
- `npm.cmd run test:platform -- --dev-only --inject-failure=web-hidden-start`：[故障注入报告](test-results/platform/run-kDiCII/report.json) 明确记录 Web 为 FAIL、开发版 PASS、生产包 NOT RUN，命令退出 1，符合注入预期。随后验证本轮进程已退出、开发服务端口已关闭，失败截图与诊断均保留。该运行不计入三轮正常验收。

最早报告的重启等待超时仍为未定位历史记录：本次重启链路与三轮回归通过，不能证明旧现场与隐藏启动同源，也不宣称全面长期稳定性。未进入 Matter 或其他下一阶段开发。

## 当前限制

- Web 主包约 321 KB gzip，Vite 有体积提示；尚未做加载优化。
- `npm audit` 报告 electron-builder 依赖链共 6 项 moderate，涉及 minimatch；未强制升级传递依赖。该工具链未装入运行包。
- 未完成正式图标、作者及发行元数据、安装器或签名；当前仅验收 Windows 11 x64 的免安装目录。
- R1 已确认并修复隐藏页面被 Tick 增长就绪条件误判的问题。更早的重启等待超时证据不足，仍未定位；不得仅凭回归通过认定同源或宣称长期稳定。
- 当前只推进诊断标记，不包含正式玩家控制、物理、任务、事件事务或检查点。最小化恢复不等于 Checkpoint Recovery，也不代表 Matter T01–T06 或 MVP-G01–G06 已通过；这些用例仍为 NOT RUN。本任务完成后等待审查，不自动进入下一任务。
