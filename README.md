# 《叠城大冒险》（Layered City Adventures）

开发窗口从 [开发路线图与执行流程](docs/DEVELOPMENT_ROADMAP.md) 领取和记录任务。当前按路线图单项实施，完成实现、测试、自审和进度记录后等待 Work 审查；正式决策变更、真实设计冲突和红线操作仍需暂停报告。

《叠城大冒险》（Layered City Adventures）是一款以具有山城特色的虚构立体城市为舞台的 2D 横版平台探索冒险游戏，核心体验是跳跃、探索、解谜与发现（CONFIRMED，2026-11-12）。

当前默认打开已加入 D04 水平／垂直移动平台、D05 非实体诊断区域、D07 统一交互原型和 D08 运行内进度原型的 M1.2.2 可操作物理灰盒，Web 与 Windows 使用同一份角色、地形、交互、进度与模拟代码。顶部「场景」可切回原固定步诊断场景。「重新启动」先销毁 Phaser 实例，再重新加载原页面并创建新实例；「重置灰盒」只重置原型角色、移动平台、诊断区域与临时交互状态，不清除 D08 的本次运行内记录，也不是检查点恢复。

Mountain City: Last Delivery／山城有路：最后一单为历史名称。下文旧里程碑的日志、截图及证据保留当时名称，不改写为新名执行过的测试。真实地标资料与旧首关方案保留参考，其虚构世界叙事尚待适配；本次不新增玩法、不重写任务或通关条件。内部包名、appId、用户数据身份及项目目录不变。

操作：A/D 或 ←/→ 移动，Space 跳跃，短按低跳、长按高跳；靠近调查 A／B、拾取 C、测试收藏 D 或测试目标 E 后按 E，调查面板使用 Escape 或「关闭」按钮结束；R 或「重置灰盒」回到出生点。黄色方块为角色，脚底绿框表示已验证支撑，红框表示无支撑。蓝色平台为上下均阻挡的实体平台；紫色“单向平台”可从下方跳过，并从上方落地行走；橙色平台水平往返，青色平台垂直升降，站在平台上会随平台运动。调查 A／B 的范围局部重叠，界面始终只选一个主要目标；拾取 C 只提供短暂反馈，不发放奖励。D08 的 D／E 分别登记一次测试收藏和一次目标／奖励／永久效果；右上 HUD 与 D08 测试路线门显示记录数和 OPEN／CLOSED 状态。R 保留本次页面运行内的 D08 记录并重新应用 OPEN；整页刷新或场景重载会创建新的运行内仓库。出生点右侧的蓝色 A 与粉色 B 是局部重叠的非实体诊断区域，只显示占用和进入／离开记录，不阻挡、不提供支撑。沿右侧跨过墙壁和间隙，再经连续坡面可到达两条移动平台；掉出间隙后按 R。窗口失焦会清理输入，恢复后先松开 Space／E 再按，持续按住不会自动起跳、重复交互或重复发奖。

## 技术栈与安装

要求 Node.js 22.12 或以上。本次在 Windows 11 x64、Node.js 24.15.0、npm 12.0.2 上验证。

| 依赖 | 锁定版本 | 用途 |
| --- | --- | --- |
| Phaser | 3.90.0 | 共享场景、Canvas 渲染及内置 Matter 0.20.0 灰盒验证，非最终物理选型 |
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
# 兼容启动入口，等价于上面的开发命令：
npm.cmd run electron
```

该命令编译主进程，启动仅监听 `127.0.0.1` 的 Vite 服务，再创建 Electron 窗口。服务自动选取空闲端口，并在终端打印实际地址；关窗退出应用后，启动器同时关闭该服务。

## Windows 应用构建与运行

```powershell
npm.cmd run electron:build
& '.\release\layered-city-adventures\win-unpacked\Layered City Adventures.exe'
```

构建复用 Web 产物，编译主进程，并使用锁定的 Electron 二进制生成 `release/layered-city-adventures/win-unpacked/`。这是免安装应用目录，运行与分发时必须保留整个目录，不能只复制 EXE。新目录避免覆盖仍在运行的旧体验包；旧 `release/win-unpacked/Mountain City Last Delivery.exe` 仅保留历史产物，不再是当前启动入口。

Windows 资源编辑仅写入产品名称等显示元数据，`signExecutable: false` 保持不签名。已核对 EXE 文件属性 ProductName 与 FileDescription 均为 `Layered City Adventures`；内部 `package.name` 和 Electron 用户数据身份仍为 `mountain-city-last-delivery`，AppUserModelID／appId 仍为 `io.mountaincity.lastdelivery`。

生产入口为 `app://game/index.html?platform=windows`，只读取随包提供的本地资源，忽略开发服务环境变量；无需 Vite 服务、Node.js 或项目源码。当前未生成安装器，未进行代码签名、自动更新或公开发布。

## 代码结构

| 路径 | 职责 |
| --- | --- |
| `index.html` | 共同页面入口、场景选择、调试重置与重启。 |
| `src/platform/web/` | Web 适配层。 `main.ts` 调用核心、挂载 Phaser、处理销毁和重启，并将启动错误写入浏览器日志。 |
| `src/core/game.ts` | 共享入口，装配模拟与生命周期控制器，维护诊断标记状态。 |
| `src/core/graybox.ts` | 共享灰盒入口，装配角色、固定步、物理端口与生命周期。 |
| `src/core/player.ts` | 原型参数、PC-01 输入许可、PC-02 请求及移动／跳跃规则；不依赖平台或 Phaser。 |
| `src/core/interaction.ts` | 原型调查／拾取对象、稳定目标选择、单次按键消费、临时反馈及交互自身控制限制；不依赖平台或 Phaser。 |
| `src/core/progress.ts` | D08 运行内进度仓库：四类稳定业务 ID、幂等登记、显式奖励关系、期望效果状态与只读快照；无平台或存储 API。 |
| `src/physics/matter/graybox-world.ts` | 两端共用 Matter 世界、静态地形、独立脚底区域与实际接触法线判定。 |
| `src/core/simulation.ts` | 固定步累加器、实际 Tick、有界补算及余量／丢弃统计。 |
| `src/core/lifecycle.ts` | Owner + Key 去重、Token 所有权、退役与有效暂停集合。 |
| `src/platform/web/visibility.ts` | 两端共用的 Renderer 可见性适配，转发 Acquire／Release，不直接修改模拟。 |
| `src/platform/web/player-input.ts` | 键盘、焦点与可见性转换为共享核心输入通知，解绑时清理。 |
| `src/rendering/phaser/startup.ts` | Phaser 渲染层，用 Canvas 绘制启动场景并管理渲染实例的销毁。 |
| `src/rendering/phaser/graybox.ts` | 灰盒绘制、跟随摄像机、说明文字；关闭自动 Matter 更新，由固定步调用 world.step。 |
| `electron/main.ts` | 主进程：应用启动、窗口管理、关闭／重新激活、安全策略与本地协议。无游戏业务。 |
| `electron/local-resources.ts` | 校验开发地址与本地资源路径，阻止越界文件读取。 |
| `scripts/electron-dev.mjs` | 共同管理开发服务与 Electron 进程的启停。 |
| `tsconfig.electron.json` | 单独编译主进程至 `dist-electron/`，不向共享核心引入 Node.js 类型。 |
| `vite.config.ts` | 排除桌面构建输出的文件监听，避免打包触发开发页面刷新。 |
| `tests/local-resources.test.mjs` | 本地协议路径及开发地址白名单测试。 |
| `tests/simulation.test.mjs` | 可控时间下的固定步与暂停协议测试。 |
| `tests/visibility.test.mjs` | 可见性适配的隐藏启动、重复通知与解绑测试；不代替实机测试。 |
| `tests/player-physics.test.mjs` | 受控时间运行 Phaser 内置的真实 Matter，验证控制、接触、平台、区域及 D08 进度／效果协调。 |
| `tests/interaction.test.mjs` | D07 交互目标、单次消费、控制锁、提示资格与生命周期门槛。 |
| `tests/progress.test.mjs` | D08 四类记录、非法请求、只读快照、目标／奖励幂等及永久效果期望状态。 |
| `tests/graybox-browser.mjs` | 真实窗口键盘操作、物理暂停、平台、区域、D07 交互及 D08 收藏／目标／奖励／效果断言。 |
| `tests/platform-smoke.mjs` | 可选 Chrome／Edge 的真实标签页测试，以及 Electron 原生最小化／恢复、独立包、重启与 D04-R1／D05／D07／D08 定向入口。 |
| `tests/browser-selection.mjs` | 解析 `--browser`、查找标准安装路径并核验 CDP 实际浏览器身份；缺失时不回退。 |
| `scripts/test.mjs` | 无参数时运行自动化单测，有参数时把平台测试参数原样转发给 `test:platform`。 |
| `docs/` | 策划、决策与赛事原始材料。 |

两端均运行 `index.html → src/platform/web/main.ts`，按场景装配同一个诊断核心或灰盒核心与 Matter 世界。Electron Main 只选择开发 URL 或本地生产 URL。查询参数仅影响平台文字，不授予原生能力。没有独立 Windows 核心、场景、Preload 或 IPC 接口。

## 自动化测试入口

```powershell
# 类型检查、Electron 编译与全部自动化单测
npm.cmd test

# Web 定向测试；不传 --browser 时默认 Chrome
npm.cmd run test -- --web-only --browser=chrome
npm.cmd run test -- --web-only --browser=edge

# Chrome Web + Electron 开发版 + 仓库外生产包完整回归
npm.cmd run test -- --browser=chrome

# D04-R1 移动平台生命周期定向验收；不执行既有完整长流程
npm.cmd run test:d04-r1

# D05 诊断区域三端定向验收；不执行既有完整长流程
npm.cmd run test:d05

# D07 调查／拾取交互三端定向验收；不执行既有完整长流程
npm.cmd run test:d07

# D08 运行内进度、幂等奖励与效果重建三端定向验收
npm.cmd run test:d08
```

平台测试只接受 `chrome`、`edge`，使用每次新建的临时用户配置目录，并通过 CDP `Browser.getVersion` 核对实际品牌。`report.json` 记录候选／实际路径、品牌、版本、进程 PID、启动参数、临时配置目录、页面与进程时间线，以及测试脚本和 ASAR 的 SHA-256。所选浏览器缺失时结果为 `BLOCKED`，不会静默切换浏览器、安装软件或使用个人资料。

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

## M1.2.2 物理灰盒实现

本节记录工程原型，不改变正式决策。Matter 仍处于优先验证阶段。

- 灰盒原型配置：`1000 / 60 ms`／步，每帧最多 5 步；原诊断场景保留 `20 ms`／步。两端同一场景使用相同配置，整步积压丢弃、余量保留及恢复重建基线沿用原运行时。
- 每个实际 Tick 顺序：读取一次性输入／缓冲 → 计算速度 → 写入 Matter → `world.step(fixedDelta)` 一次 → 脚底区域查询与有效实体接触法线联合判定 → 更新支撑、土狼时间与缓冲 → 渲染。Phaser `autoUpdate: false`，不存在第二条物理更新路径。
- `PLAYER_PROTOTYPE`：角色 28×44，速度 220 units/s，加速 1500、减速 2000 units/s²，空中系数 0.8；起跳速度 530 units/s，松键上升速度乘 0.6，土狼时间 100 ms，单次缓冲 130 ms。重力原型为 1400 units/s²，均可调整，不是最终参数。
- PC-01 由核心协调器的 Owner 集合决定是否允许输入；运动与支撑状态独立。PC-02 只接受非 repeat 的新按下，消费时同时清除请求及起跳资格；落地不会重放长按。失焦或不可见清除按键和缓冲并建立松键门槛，恢复不会自动重按。
- 脚底区域是独立、只查询的 Matter sensor，不参与质量或实体阻挡。只有脚底相交且存在当步有效非 sensor 接触、向上支撑法线及不过大的法向分离速度，才获得支撑；碰墙不能恢复资格。坡面使用切向速度和轻微贴地偏置；已验证静态坡面上的静止状态抵消重力，仍执行碰撞检测，不冻结世界。
- D03 的原型单向平台在 Matter 适配层使用独立碰撞类别。角色上升时持续关闭该平台对玩家的碰撞，直到身体完整越过平台顶面；仅当角色位于顶面以上并下降时恢复碰撞。平台无关的输入、跳跃资格和运动规则仍由共享核心处理，渲染层只负责占位样式与说明。
- Web 隐藏、Electron 原生最小化均经 Renderer 的真实 visibilitychange 请求暂停；窗口 blur/focus 只通知输入可用性，由 PC-01 决定许可。没有新增 IPC 或关闭后台节流。
- R／按钮重置只清理角色输入、速度、接触缓存和位置，保持 Tick 与 Matter 时钟继续累计；`Engine.clear` 后标记世界修改，确保下一步重建碰撞检测。切换场景沿用完整销毁与同 URL 重载，选择只保存在当前窗口 sessionStorage。

### M1.2.2 实际验收与证据

验证日期：2026-11-12，Windows 11 x64，真实 Edge、Electron 开发窗口与仓库外 Windows 生产包；没有伪造 visibilitychange、修改 visibilityState 或关闭后台节流。

```powershell
npm.cmd test
npm.cmd run electron:build
npm.cmd run test:platform
git diff --check
```

`npm test`：类型检查、主进程编译、原 11 项与新增 9 项测试全部 PASS（20/20）。新测试直接使用 Phaser 自带的真实 Matter，不使用假碰撞器；受控时间验证固定步、移动、长短跳、一次消费、土狼时间有效／过期、缓冲有效／过期、碰墙不恢复资格、坡面持续支撑、静止、控制锁、暂停及重置后的重新碰撞。核心独立于 DOM／Node 的类型检查及平台引用搜索通过。

`electron:build`：PASS，同时完成 Web 生产构建与 Windows 应用目录构建。`test:platform` 最终版本：[run-LYLeed 完整报告](test-results/platform/run-LYLeed/report.json)，退出 0。每端保留原诊断场景的隐藏启动、两轮各 1200 ms 隐藏／恢复、三次销毁重启；另执行相同的 6 组灰盒真实键盘与物理测试。生产包移至仓库外，开发服务关闭后运行。

| 平台 | 当前脚本结果 | 短按／长按最低中心 Y | 灰盒隐藏 Tick → 恢复首帧 | 坡面静止 X 漂移 | 截图 |
| --- | --- | --- | --- | --- | --- |
| Web | PASS | 433.88 / 382.11 | 1256 → 1256 | 0 | [Web](test-results/platform/run-LYLeed/003-web-graybox-completed.png) |
| Electron 开发版 | PASS | 433.88 / 382.11 | 1253 → 1253 | 0 | [开发版](test-results/platform/run-LYLeed/008-electron-dev-graybox-completed.png) |
| 仓库外独立生产包 | PASS | 433.88 / 382.11 | 1247 → 1247 | 0 | [生产包](test-results/platform/run-LYLeed/013-electron-packaged-graybox-completed.png) |

隐藏期间完整物理诊断、位置、速度、Tick 与物理时钟不变；恢复首帧没有补算或新增丢弃时间。按住 Space 恢复并落地后仍为一次起跳，松键再按才变为两次；Matter 步数等于 Tick，时钟等于 Tick × 固定 Delta。墙边中心 X 约 506.06，低顶跳跃最小中心 Y 约 451.95，均存在对应真实接触，未穿透。

Electron 两个测试进程正常退出 0。Edge 本轮关闭请求后仍驻留，测试限定到自己启动的 PID 树执行清理，退出 1（Warning：浏览器清理路径，不是页面断言失败）；所有测试进程已退出、服务已关闭，未操作用户其他窗口。报告保留 forcedCleanup 与原始浏览器输出。

最终脚本及关键源文件／ASAR 的 SHA-256 见 [版本记录](test-results/platform/run-LYLeed/verified-version.json)。自动化结束后，另以无调试参数的正常 EXE 启动体验窗口，保留至用户自行关闭，不归测试清理管理；[启动记录](test-results/platform/run-LYLeed/experience-launch.json) 与 [实际窗口截图](test-results/platform/run-LYLeed/experience-window.png) 已保存。再次体验可执行上文 Windows 应用运行命令。

以下表保留 M1.2.2 当时的 T01–T06 子项记录；D03–D05 后续实现及当前状态统一见 [D06 灰盒阶段回归](#d06物理灰盒阶段回归)。表中的 PASS 仍只限当时列出的覆盖，不把整个分组或最终 Matter 选型判为通过：

| 测试目标 | 前置条件（平台） | 操作步骤 | 预期结果 | 实际结果 | 状态 | 问题／边界 |
| --- | --- | --- | --- | --- | --- | --- |
| T01 移动／反向／空中控制 | 三端灰盒，角色落地 | D 加速、A 反向、起跳后 D | 渐变速度、先制动、空中可转向 | 三端真实键盘断言通过 | PASS | 原型手感仍待用户体验 |
| T01 长短跳／一次消费 | 三端出生点 | 短按 Space；重置后长按及 repeat | 高度不同，持续按键不重跳 | 最低 Y 相差约 51.78；长按只跳一次 | PASS | 仅当前原型参数 |
| T01 土狼／缓冲 | 三端跨隙路径及出生点 | 离开边缘后起跳；落地前重按／提前过期 | 土狼可跳，缓冲一次消费，过期不重放 | 三端跨隙、缓冲 2 次与过期 1 次断言通过 | PASS | 土狼过期边界另由受控时间测试覆盖 |
| T01 侧碰与支撑边界 | Node 同一 Matter 世界／控制核心 | 悬空贴墙申请跳跃、过期后再按 | 不恢复起跳资格 | 自动化物理测试通过 | PASS | 此边界尚无单独三端 UI 用例 |
| T02 平地／墙／低顶／连续坡面 | 三端同一静态世界 | 行走顶墙、顶头跳、坡面上下行／停留 | 无穿透，上坡保持支撑，静止不滑 | 真实接触断言与上述坐标通过 | PASS | 只覆盖当前几何及速度 |
| T02 实体平台专项／单向平台 | 三端同一灰盒平台区 | 实体平台顶底、单向平台上下穿越、站立行走、短跳未越过、边缘离开 | 单向只允许自下穿越和自上承载，无假落地 | 三端专项用例通过；真实 Matter 单测覆盖 P01–P06 | PASS | 仅当前原型尺寸、速度与容差；不支持主动下落穿透 |
| T03 动态／升降平台 | M1.2.2 时未实现；D04 后续专项另记 | 未执行 | 后续验证承载与离开 | 无 | NOT RUN | 原 M1.2.2 范围外；D04 只验证承载子项，完整恢复仍未通过 |
| T04 触发器／检查点事件 | 未实现业务触发器 | 未执行 | 后续验证进入／占用／离开及事务边界 | 无 | NOT RUN | 脚底查询不代表 T04 已通过 |
| T05 已实现用例一致性 | 三端相同核心与配置 | 同一脚本跑移动／跳跃／静态碰撞／单向平台／暂停 | 规则结果一致 | 三端全部通过；平台峰值、支撑和恢复基线一致 | PASS | 触发器、动态平台及检查点恢复尚 NOT RUN |
| T06 隐藏／最小化输入与物理 | Web 换页；Windows 原生最小化 | 空中及单向平台上隐藏／最小化，恢复后检查输入与支撑 | 冻结、无追赶、无自动跳跃、无残留忽略状态 | 三端 Tick 首帧不变，单向平台支撑保持且无自动跳跃 | PASS | 检查点恢复及业务控制锁不在本次范围 |

开发中的失败没有删除：[run-Czg7tl](test-results/platform/run-Czg7tl/report.json) 暴露调试重置清空检测器后未重建导致穿地，现已修复并加持续落地测试；[run-8JEfY6](test-results/platform/run-8JEfY6/report.json) 的 Web 在下坡阶段真实变为 hidden／Token 1，等待超时，窗口为何被遮挡未确认，Electron 开发版通过。已增加焦点轨迹与操作前真实激活。[run-ANNQzJ](test-results/platform/run-ANNQzJ/report.json) 为中间版本三端 PASS；之后新增严格坡面支撑单测曾 FAIL，修正为法线分离速度判定后，20 项和最终 run-LYLeed 重新全部通过。旧 R1 三轮日志不代替本次证据，历史重启超时仍保留未定位。

## 2026-11-12 更名与定位同步验证

当前名称、虚构城市定位及工程显示信息已同步，详见 [更名执行报告与 NAME-01–08](docs/PROJECT_REBRANDING_HANDOFF.md#7-2026-11-12-实际执行记录)。历史名称、旧测试截图、真实建筑资料和原首关方案保留追溯，不代表当前世界是现实重庆复刻或已经完成叙事适配。

实际执行 `npm.cmd test`、`npm.cmd run electron`、`npm.cmd run test`、`npm.cmd run electron:build`，前两次单元测试均 20/20，开发命令可见启动及原生关窗退出 0，Web／Windows 构建通过。产品资源编辑只同步名称，仍不签名；角色、物理、输入、暂停、固定步及锁文件等 10 个关键文件保持原字节。

当前平台脚本新增名称、窗口标题、appName 与 userData 断言，保留全部灰盒回归。三轮实际结果分别为：[run-odchVH](test-results/platform/run-odchVH/report.json) Web FAIL／开发 PASS／生产 PASS；[run-nS0u4P](test-results/platform/run-nS0u4P/report.json) 三端全部 PASS；[run-31w8KP](test-results/platform/run-31w8KP/report.json) Web FAIL／开发 PASS／生产 PASS。NAME-05 保留 FAIL，不宣称稳定全部通过：首轮真实失焦 hidden 导致坡面操作等待超时，追加轮 Edge 连接关闭、退出 4294967295，来源均未定位；没有削弱断言或改写失败。

完整 PASS 轮使用新名称 Web、开发版及仓库外生产包，覆盖原诊断两轮隐藏恢复与三次重启、灰盒移动／长短跳／跨隙／坡面／碰撞／重置／暂停恢复。三端灰盒恢复首帧 Tick 分别保持 1275、1267、1262，没有后台追赶；三个测试进程正常退出 0。[Web 灰盒截图](test-results/platform/run-nS0u4P/003-web-graybox-completed.png)、[Windows 诊断截图](test-results/platform/run-nS0u4P/010-electron-packaged-initial-load-before-activation.png)及完整记录均为本轮新生成。旧 R1 或 M1.2.2 的 PASS 不代替本轮证据。

自动测试结束后，另以正常新 EXE 启动并保留默认灰盒窗口，由用户自行关闭；[实际界面截图](test-results/rebranding-20261112/experience-window.png)及[无调试参数启动记录](test-results/rebranding-20261112/experience-launch.json)已保存。准确 EXE 路径和运行命令见上文 Windows 应用构建与运行，操作见本文开头。

## D01-R1：Web 中断诊断与停止记录

2026-11-12，Windows 11 x64／Node 24.15.0／npm 12.0.2，真实 Edge，未换浏览器或依赖。D01-R1 为 BLOCKED，NAME-05 保持 FAIL，交 Work 审查，不进入后续功能。

只改测试：`platform-observer.mjs` 锁存中断并记录事件，`foreground-window.ps1` 作为测试自有隐藏进程只读采样前台 PID／HWND（50 ms，不操作窗口）；`platform-smoke.mjs` 串行保存报告及实时 `timeline.jsonl`，记录预期状态、当前用例、源时间和接收时间、Tick／位置／物理／输入、page/context/browser 关闭与断连、crash、原生进程退出、清理请求和目标 PID。采样／事件中的 HUD 值可能先于下一次刷新，使用后续采样及现场核对输入清理。

准备阶段真实显示、恢复并验证 visible + focus；操作中任何 blur／hidden 或关闭先锁存、截图与保存，再停止断言。原坡面中途激活已移除；剩余准备／恢复入口在激活前检查中断，不能把丢失焦点掩盖成继续操作。键盘入口统一检查锁存，不重放按键；正常关闭和失败清理均记录意图，退出码与清理是否完成分开，不将异常退出改记正常 PASS。生命周期注入脚本等待安装完成。

原始三轮不能倒推完整根因：`run-odchVH` 表明真实隐藏后按规则暂停，不能判为物理错误；`run-31w8KP` 缺少关闭和清理请求时间，不能确认由清理、用户或浏览器异常引起。两类保留分别调查。

实际命令与全部平台尝试如下；故障注入命令退出 1、平台结果 FAIL 是保留的原始结果，验证项另记，不能计正常 PASS：

| 命令／报告 | 结果 | 实际证据 |
| --- | --- | --- |
| `npm.cmd test` | PASS | 原 20 项及类型检查通过；最终追加 1 项锁存竞态回归后 21/21 |
| `npm.cmd run test:platform -- --inject-interruption=hidden`／[run-0uvjFC](test-results/platform/run-0uvjFC/report.json) | FAIL（预期注入）；观察验证 PASS | 第一版，先注入再 blur，冻结 Tick／位置／物理、Token 1、输入锁、buffer 0、松键门槛；中断后无输入或激活 |
| `npm.cmd run test:platform -- --inject-interruption=close`／[run-FUfhkZ](test-results/platform/run-FUfhkZ/report.json) | FAIL；补充审计验证 FAIL | 初版验证错误地接受了注入前的 blur（seq 27 早于请求 seq 32），原 PASS 记录保留但不采信 |
| `npm.cmd run test:platform -- --web-only`／[run-aXFnZF](test-results/platform/run-aXFnZF/report.json) | FAIL | 第一版，第二次重启准备后出现 blur，立即锁存；未继续点击或抢回焦点 |
| `npm.cmd run test:platform -- --inject-interruption=close`／[run-V0C1Ia](test-results/platform/run-V0C1Ia/report.json) | FAIL（预期注入）；验证 PASS | 第二版严格校验：seq 30 请求，31/32 页面关闭，37 context close，38 disconnected，39 进程退出 0，42 才开始清理 |
| `npm.cmd run test:platform -- --inject-interruption=hidden`／[run-isv90S](test-results/platform/run-isv90S/report.json) | FAIL；注入验证 FAIL | 第二版在注入前 blur，未执行隐藏，未冒充预期注入成功 |
| `npm.cmd run test:platform -- --web-only`／[run-07MJ9j](test-results/platform/run-07MJ9j/report.json) | FAIL | 第二版，D 按下后约 323 ms blur；seq 176 中断、185 cleanup，之后无新按键／激活 |
| `npm.cmd run test:platform` 完整三端 | NOT RUN | 两版定向仍中断，达到停止条件，不再重跑挑选 PASS |
| Web／Windows 生产重建 | NOT RUN | 无应用或配置变更；16 个应用／配置／锁文件哈希及既有 ASAR 均与基线一致 |
| `git diff --check` | PASS | 实际退出 0；保留全部已有未提交改动，无删除、Commit 或 Push |

最新现场：已记录的前台始终是测试 Edge PID 36380，HWND 41423248→15338990→41423248；页面 blur 时仍 visible，未发生旧现场的 hidden。不能把这次短暂失焦、旧隐藏及旧浏览器关闭视为同源。采样不确定内部窗口类型，也不能证明短于 50 ms 的外部切换不存在；需 Work 分析测试后台页、浏览器窗口与焦点来源。当前证据证明清理晚于中断，未证明应用缺陷，未修改玩家参数、物理或暂停逻辑。

收尾本地测试还发现截图未完成时操作可能先返回、形成子项误报 PASS 的竞态。已补结果返回前的锁存检查，新增单测先实际 FAIL、修正后 PASS；最终 `npm test` 21/21。遵守停止条件，该最终小改后没有再跑平台，不能把之前注入结果当作最终版本集成 PASS。

只修改本节相关测试与记录：`tests/platform-smoke.mjs`、`tests/graybox-browser.mjs`、新增 `tests/platform-observer.mjs`、`tests/platform-observer.test.mjs`、`tests/foreground-window.ps1`，以及 README、路线图和 NAME-05 交接证据。没有应用、依赖或构建配置变更；历史失败未删除，用户体验 PID 38428／47600 仍运行。基线匹配、逐轮哈希与审计、最小复现、最终源码和差异统一在 [证据目录](test-results/d01-r1-baseline/summary.json)。本机证据目录未提交 Git。

## D01-R2：Chrome／Edge 可选入口与受控对照

2026-11-12 执行，Windows 11 x64、Node.js 24.15.0、npm 12.0.2。本次只修改平台测试入口、小型浏览器选择辅助、测试与文档，没有修改游戏源码、依赖、Electron、暂停语义、物理参数或构建产物。D01-R2 执行状态为 `BLOCKED`；NAME-05 仍为 `FAIL`，由 Work 审查，不因默认浏览器改为 Chrome 而自动收口。

`npm.cmd test` 为 PASS：共享核心与 Renderer 类型检查、Electron Main 编译及 26/26 自动化测试通过。新增 5 项覆盖默认 Chrome、显式 Chrome／Edge、未知／空／裸／重复参数、用户级 Chrome 路径优先、所选浏览器缺失时不回退，以及 CDP 浏览器身份解析。

Chrome 与 Edge 使用同一版测试脚本和同一套用例，两次报告中的应用 ASAR 及脚本哈希一致。实际浏览器产品版本并不相同，因此只称“同一测试版本对照”，不称浏览器二进制同版本：

| 浏览器 | 实际品牌 | 产品版本与路径 | PID／临时配置 | 结果 |
| --- | --- | --- | --- | --- |
| Chrome | Google Chrome | `156.0.8078.74`；`C:\Users\24839\AppData\Local\Google\Chrome\Application\chrome.exe` | PID 46412；`C:\Users\24839\AppData\Local\Temp\mountain-city-d01-r2-chrome-QYVi4X` | [run-PX4mYQ](test-results/platform/run-PX4mYQ/report.json) FAIL |
| Edge | Microsoft Edge | `156.0.4314.58`；`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` | PID 33900；`C:\Users\24839\AppData\Local\Temp\mountain-city-d01-r2-edge-3ZWNCB` | [run-NLRqlv](test-results/platform/run-NLRqlv/report.json) FAIL |

两次启动均带 `--remote-debugging-port=0`、当轮独有 `--user-data-dir`、`--no-first-run about:blank`，未接管用户资料或修改默认浏览器。报告中的 `Browser.getVersion` 分别返回 `Chrome/156.0.8078.74` 与 `Edg/156.0.4314.58`，所选身份核验 PASS。

实际命令与结果：

| 命令 | 状态 | 实际证据 |
| --- | --- | --- |
| `npm.cmd run test -- --web-only --browser=chrome` | FAIL | 第三次重启后的模拟运行阶段捕获 blur；随后采样到 `magpie-windows-amd64` 前台 PID 28304，页面进入 hidden、Token 1、Tick 6，应用按协议暂停。未重放操作或抢回焦点；[中断截图](test-results/platform/run-PX4mYQ/003-web-interruption-first.png)。 |
| `npm.cmd run test -- --web-only --browser=edge` | FAIL | 灰盒短按／长按单次跳跃阶段捕获 `Unexpected platform interruption: blur`；后续页面为 visible、`controlAllowed=false`、`needsRelease=true`。未把这次中断认定为与 Chrome 同源；[失败截图](test-results/platform/run-NLRqlv/004-web-failure.png)。 |
| `npm.cmd run test -- --browser=chrome` | NOT RUN | Chrome 定向未通过，按任务前置条件不执行完整三端回归；Electron 开发版与生产包在本轮为 NOT RUN，不能沿用历史 PASS。 |
| `npm.cmd run test -- --web-only --browser=firefox` | PASS（预期负向） | 退出 1，输出 `Unknown browser "firefox"` 并列出允许值。 |
| 缺失路径负向检查 | PASS（预期 BLOCKED） | 进程级覆盖三个标准安装根目录后运行 Chrome 定向，退出 1；[run-6ItWii](test-results/platform/run-6ItWii/report.json) 中 Web 为 BLOCKED、`processes: []`，未回退 Edge。 |
| Web／Windows 生产重建 | NOT RUN | 仅测试与文档变化；当前 ASAR SHA-256 为 `D15471D0BCFB6D2640A1B1103B6B3DD796099ED0BB0EC8D582CECC92DA76EBAF`，与 `test-results/rebranding-20261112/verified-version.json` 的既有基线一致。 |
| `git diff --check` | PASS | 实际退出 0；全部既有未提交改动保留，无 Commit、Push 或发布。 |

两个失败命令的浏览器主进程均在测试自有清理后退出 0，`cleanupFailures` 为空；临时浏览器配置、CDP 连接、测试开发服务与前台只读辅助均按本轮归属清理。完整启动参数、事件序号、窗口／页面状态、截图、进程输出、脚本与 ASAR 哈希均保存在各自运行目录。历史 D01-R1 失败证据未删除，用户体验窗口未被本任务关闭。

## D03：实体平台与单向平台专项

2026-11-13 执行，只扩展灰盒平台碰撞能力，没有实现移动／升降平台、NPC、任务、检查点、事件事务或正式美术，也没有新增依赖、改变共享核心职责或改变 Matter 的候选状态。

实现位于 Matter 适配层：普通实体平台保持双向阻挡；特殊单向平台使用独立碰撞类别，角色上升时忽略该平台，直至完整越过顶面，随后只在角色位于顶面以上并下降时恢复碰撞。比较使用角色位置、身体边界和当步运动方向，没有事后改坐标。有效落地仍要求脚底查询命中平台、存在当步真实非 sensor pair、支撑法线向上，避免穿越状态、侧面接触或 sensor 单独重叠恢复跳跃资格。交互表现使用紫色单向平台及“下方跳穿”文字，实体平台继续使用蓝色及“上下均阻挡”说明。

真实 Matter 单测由原 26 项增至 32 项，P01–P06 六组全部通过，覆盖实体平台底面阻挡与顶部承载、单向从下穿越、短跳未越过、顶部站立行走、脚底 sensor 假阳性隔离、边缘下落、土狼／缓冲、`ArrowDown + Space` 不主动穿落、穿越中重置、暂停和恢复。另在浏览器层加入同一组真实键盘与生命周期断言。

实际命令与结果：

| 命令／报告 | 状态 | 证据 |
| --- | --- | --- |
| `npm.cmd test` | PASS | 类型检查、Electron Main 编译及 32/32 自动化测试通过。 |
| `npm.cmd run electron:build` | PASS | Vite 生产构建、Electron Main 编译及 Windows x64 免安装目录重新生成；保留 Phaser 主包约 325 KB gzip 的体积警告。 |
| `npm.cmd run test -- --web-only --browser=chrome` | FAIL（已修正测试阈值） | [run-mcrKWk](test-results/platform/run-mcrKWk/report.json) 捕获实体平台底面真实接触；`solid-platform-b` 理论最低中心 Y 为 430，原断言误写为 439，实际 429.95。失败截图与报告保留。 |
| 修正阈值后再次执行 Chrome Web 定向 | PASS | [run-KTyv3D](test-results/platform/run-KTyv3D/report.json) 全部原有及新增 Web 用例通过。 |
| `npm.cmd run test -- --browser=chrome` | PASS | [run-C3nYeL](test-results/platform/run-C3nYeL/report.json) 的 Chrome Web、Electron 开发版和仓库外独立生产包全部 PASS；非预期中断 0，清理失败 0。 |
| `npm.cmd run electron` | PASS | 实际启动标题为“叠城大冒险 | Layered City Adventures”的可见开发窗口，进程 PID 18564，默认灰盒可运行；该体验窗口保留给用户自行关闭。 |
| Edge 全套回归 | NOT RUN | 本任务未修改 Edge 入口；不以 Chrome 通过推导 Edge 结果。 |

三端新增平台用例记录如下。报告内 `task` 字段仍沿用平台脚本既有的 `D01-R2` 常量；轮次归属依据本轮日期、命令和新增 `P01-P06-solid-and-one-way-platforms` 事件，不修改历史报告生成字段。

| 平台 | 实体底面最低中心 Y | 短跳峰值 Y | 单向跳跃峰值 Y | 单向平台实体顶部 Y | 隐藏 Tick → 恢复首帧 |
| --- | --- | --- | --- | --- | --- |
| Chrome Web | 429.95 | 428.95 | 382.11 | 368.05 | 1751 → 1751 |
| Electron 开发版 | 429.95 | 428.95 | 382.11 | 368.05 | 1758 → 1758 |
| 仓库外独立生产包 | 429.95 | 433.88 | 382.11 | 368.05 | 1751 → 1751 |

短跳均未进入单向平台支撑，长跳完整越过并从上方落地；三端均未在单向穿越中产生 ceiling 接触。单向平台站稳后继续按住 Space 不自动连跳，`ArrowDown + Space` 触发普通上跳而非向下穿透。可见性暂停期间完整诊断冻结，恢复首帧不追赶后台 Tick，输入保持松键门槛，平台碰撞忽略状态和支持状态未残留。

当前源码与产物的平台脚本、灰盒脚本及 ASAR 哈希已写入 [run-C3nYeL 报告](test-results/platform/run-C3nYeL/report.json)；ASAR SHA-256 为 `A087F4C9C95610DC12D178CBBD9296DCD211BA5C028CF9DD3CA2DE298329D0C0`。仓库外生产包入口为 `release/layered-city-adventures/win-unpacked/Layered City Adventures.exe`。

[Chrome 单向平台实际截图](test-results/d03-20261113/one-way-platform-browser.png)展示角色站在紫色单向平台上，诊断支撑为 `one-way-platform-a`；[Electron 开发窗口截图](test-results/d03-20261113/electron-dev-platforms.png)保存了保留窗口的实际界面。Computer Use 可以读取并重启窗口，但无法可靠产生符合游戏帧采样的持续按键，因此独立人工走跳仍记 BLOCKED／NOT RUN；不据此替代三端真实键盘自动化证据。

在 D03 当时，T02 实体／单向平台及受影响的 T01、T05、T06 子项按上表为 PASS；T03 动态／升降平台、T04 触发器和检查点事件为 NOT RUN。后续 D04／D05 已补齐各自专项，当前状态以 [D06 子项矩阵](#d06物理灰盒阶段回归)为准。Matter 仍只是物理验证候选，不宣称完整 T01–T06 或最终物理选型通过。

### D03 Work 复核（2026-11-13）

Work 已审查代码、真实 Matter 测试及平台截图，并重新执行 `npm.cmd test`，32/32 PASS；[run-C3nYeL](test-results/platform/run-C3nYeL/report.json) 的三端 P01–P06、进程退出及清理记录通过，6 个测试文件和 ASAR 哈希与当前文件匹配。本轮未重新构建或重跑 GUI 平台测试，不把证据核对写成新执行。D03 按当前原型范围验收通过，当前任务为 [D04 水平／垂直平台承载](docs/DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。独立人工走跳、Edge、完整恢复及最终物理选型仍未据此通过。

## D04：水平移动平台与垂直升降平台承载

2026-11-13 执行，只扩展灰盒平台的固定步承载能力。没有实现移动单向平台、旋转或挤压规则、机关、NPC、任务、检查点、事件事务、存档或正式美术；没有新增依赖、改变共享核心职责或改变 Matter 的候选状态。

两条平台均由 Matter 适配层保存逻辑路径与实际碰撞体，只随共享核心的实际 `SimulationTick` 推进：

- `moving-horizontal-a`：宽 100、高 18，`x=1710 → 1780`，`y=300`，周期 4000 ms，使用橙色显示。
- `moving-vertical-a`：宽 72、高 18，`x=1910`，`y=310 → 220`，周期 3600 ms，使用青色显示；诊断中的 `+Y` 向下、`-Y` 向上。
- 参数、路线与起跳惯性均为可调原型，不是最终关卡设计或手感决策。

每个实际固定步按以下顺序执行：保存上一 Tick 已验证的移动支撑 → 推进平台路径 → 写入共享核心计算的玩家自主速度 → 对上一 Tick 的有效移动支撑施加一次平台位移 → 更新单向平台碰撞资格 → 唯一一次 Matter 求解 → 刷新脚底查询、实体 pair、相对速度和支撑身份。Phaser 只在渲染帧读取逻辑与碰撞体状态更新图形，不使用 Tween 或渲染帧推动平台。

承载只接受“脚底查询命中、当步真实非 sensor 接触、向上支撑法线、可接受相对分离速度”共同验证的平台。侧碰、顶头或 sensor 单独重叠不会绑定承载；离开边缘或起跳后立即停止使用旧平台位移。分离判定使用玩家世界速度与平台速度之差。原型策略为起跳不继承平台额外速度。调试重置恢复两条平台的位置、方向、阶段、周期计数、速度、支撑与接触缓存，但不重置全局 Tick；这不是检查点恢复。

真实 Matter 单测由原 32 项增至 38 项，D04 M01–M06 六组全部 PASS：多个完整往返周期稳定、随动与边缘离开、平台上的短长跳／土狼／缓冲、侧面和下方接触不远程携带、暂停与有界补算不增加平台路程、重置后重新碰撞。三端平台专项另用实际键盘完成登台、随动、支撑 ID 与速度检查：

| 环境 | 水平平台证据 | 垂直平台证据 | 结果 |
| --- | --- | --- | --- |
| Chrome Web | `moving-horizontal-a`，平台 `worldVx=35` | `moving-vertical-a`，平台 `worldVy=-50` | PASS |
| Electron 开发版 | 同上 | 同上 | PASS |
| 仓库外独立生产包 | 同上 | 同上 | PASS |

三端角色相对平台高度均约 `-30.95 px`，与角色半高 22、平台半高 9 及 Matter 接触容差一致。截图：[Web 水平](test-results/d04-20261113/web-horizontal.png)、[Web 垂直](test-results/d04-20261113/web-vertical.png)、[Electron 开发版水平](test-results/d04-20261113/electron-dev-horizontal.png)、[Electron 开发版垂直](test-results/d04-20261113/electron-dev-vertical.png)、[独立包水平](test-results/d04-20261113/electron-packaged-horizontal.png)、[独立包垂直](test-results/d04-20261113/electron-packaged-vertical.png)。

当前脚本 SHA-256：`tests/platform-smoke.mjs` 为 `9CED6D650FD1B54976FF64837FA39A486EE2334DF0E236EF65527DB72FC55991`，`tests/graybox-browser.mjs` 为 `CA9DDFB3CF0DFCD3FC6F840689D5AAB6D4707B97EF0DABB32F2B44160DEB7F9F`，`tests/player-physics.test.mjs` 为 `B8121B79605EFA0966EBAEA1A60306DAFF80972DB4648B7F9D88BD91DD85297A`；产物 ASAR 见下表。

实际命令与结果：

| 命令／报告 | 状态 | 证据 |
| --- | --- | --- |
| `npm.cmd test` | PASS | TypeScript 核心／Renderer 检查、Electron Main 编译及 38/38 自动化测试通过。 |
| `npm.cmd run electron:build` | PASS | Vite 生产构建与 Windows x64 免安装目录重新生成；新 ASAR SHA-256 为 `4C84A124F30A62B24354C9078D7B8F57B2B828DD60F3E1E6177E57A7DBDEA1B7`。 |
| 三端 D04 平台专项实际运行 | PASS | Chrome Web、Electron 开发版与仓库外独立生产包均登上两条平台并得到预期支撑 ID 与平台速度；失败和清理归自己启动的测试进程处理。 |
| `npm.cmd run test -- --browser=chrome` | FAIL | [run-1rk8KM](test-results/platform/run-1rk8KM/report.json)、[run-4xEAdj](test-results/platform/run-4xEAdj/report.json)、[run-cYdmZk](test-results/platform/run-cYdmZk/report.json) 均保留。首次 Web 在既有短长跳用例失焦；第二轮 Web 在既有地面／墙用例失焦，开发版与独立包已登上水平平台，但测试相对高度阈值误写后修正；第三轮 Web、开发版和独立包分别在重启、既有碰撞和移动用例失焦。焦点丢失发生在交互期间，未自动抢焦点或重放按键。 |
| `npm.cmd run electron` | PASS | 正常启动标题为“叠城大冒险 | Layered City Adventures”的可见开发窗口，PID `30508`、HWND `5508372`；保留给用户自行关闭。[实际截图](test-results/d04-20261113/electron-dev-experience.png)及[启动记录](test-results/d04-20261113/experience-launch.json)。 |
| Windows 原生最小化／恢复专项 | BLOCKED | 完整脚本多次被交互中 blur 打断，未得到当前版本平台上最小化专项的充分现场；不以真实 Matter 单测替代，也不宣称 M05 平台实测 PASS。 |
| Edge 全套回归 | NOT RUN | 本任务只按指定 Chrome 入口验证；Chrome 通过不能推导 Edge。 |
| `git diff --check` | PASS | 实际退出 0；仅出现 Git 的 LF→CRLF 提示，没有空白错误。 |

D04 的平台实现和 M01–M04、M06 当前自动化范围通过；M05 的暂停、丢弃时间和重置逻辑由真实 Matter 单测通过，但 Windows 原生最小化专项仍为 BLOCKED。完整三端平台脚本因焦点环境中断保留 FAIL，不能改写成 PASS。T03 只记录本次承载子项，完整检查点恢复及 T04 均未实现；Matter 仍是验证候选。

## D04-R1：移动平台生命周期定向验收

2026-11-13 执行。该专项只补齐 D04 中水平与垂直移动平台的真实隐藏／原生最小化生命周期证据；没有重新实现移动平台、修改正式暂停规则、重跑既有完整长流程或开发 D05。

定向入口复用现有 Vite 服务、CDP、原生窗口状态读取、中断锁存、截图和自有进程清理能力：

```powershell
npm.cmd run test:d04-r1
```

入口内部使用 `tests/platform-smoke.mjs --d04-r1`，跳过原有隐藏启动、两轮普通暂停、三次重启和整段灰盒长流程。Chrome Web 通过真实后台标签页建立 `hidden → visible`；Electron 开发版和仓库外独立生产包通过真实 `BrowserWindow.minimize()`／`restore()` 建立原生最小化与恢复。三端都先用真实物理和键盘登上平台，再断言有效支撑、Tick、物理步数、平台路径时钟、阶段、方向、输入和承载状态。

每端后台至少停留 1200 ms。下表箭头两侧分别为完整冻结后的采样与恢复首帧；冻结时暂停 Token 为 1，恢复首帧为 0：

| 环境 | 水平平台 Tick／物理步／平台时钟 | 垂直平台 Tick／物理步／平台时钟 | 结果 |
| --- | --- | --- | --- |
| Chrome Web | `554 / 554 / 8866.667 → 554 / 554 / 8866.667` | `1311 / 1311 / 11283.333 → 1311 / 1311 / 11283.333` | PASS |
| Electron 开发版 | `566 / 566 / 8850.000 → 566 / 566 / 8850.000` | `1320 / 1320 / 11266.667 → 1320 / 1320 / 11266.667` | PASS |
| 仓库外独立生产包 | `559 / 559 / 8866.667 → 559 / 559 / 8866.667` | `1313 / 1313 / 11283.333 → 1313 / 1313 / 11283.333` | PASS |

水平平台有效支撑下的相对 X 分别为 `42.236`、`45.347`、`42.236 px`，垂直平台相对 Y 均约 `-30.95 px`。恢复后继续承载，世界速度与平台速度保持一致；没有后台 Tick 追赶、额外平台路程、旧速度或自动跳跃。三端另覆盖一次在水平平台上按住 Space 后暂停：恢复前后跳跃计数均为 `4`，保持 `needsRelease=true`；松开后重新按下才变为 `5`。

Electron 两种模式均真实记录最小化时 `visible=false`、`minimized=true`、`focused=false`，恢复时 `visible=true`、`minimized=false`、`focused=true`。Web 浏览器为 Google Chrome `156.0.8078.74`。测试自有进程 PID `796`（Web）、`27776`（Electron 开发版）、`36672`（独立包）均正常退出 0，清理状态为 PASS；非预期中断、页面错误和清理失败均为 0。

专项同时修复了一个诊断呈现缺陷：页面在 `visibilitychange` 时刷新诊断若未携带新平台快照，会清空平台位置、阶段、方向和时钟字段，造成暂停冻结采样无法核对。`src/platform/web/main.ts` 现在只缓存最近一次真实灰盒平台诊断并在暂停刷新时复用；共享模拟、暂停令牌、输入和物理规则未改。应用源码变化后已重新构建，当前生产 ASAR SHA-256 为 `9239B4673ADA2FA0D4B012F3D58B28E2C051096352604B0BCF66AF9361E14DB5`。成功报告所用 `tests/platform-smoke.mjs`、`tests/graybox-browser.mjs`、`src/platform/web/main.ts` SHA-256 分别为 `A128A6D1BA9CFD250D0E20FC38C69ECABF15F4E21BC22B05895CE8F832ECCDBE`、`BFC016A882A7A36921537A33534D3C4C0B1FCE2FBEE7FC5188A9E64B5B697B9D`、`08FCEBCC3FD746133B2F17D7691000E9B2FADF4A4CB88C17E09EC2F302D9DA65`。

| 命令／检查 | 状态 | 证据 |
| --- | --- | --- |
| `npm.cmd test` | PASS | 类型检查、Electron Main 编译及 38/38 自动化测试通过。 |
| `npm.cmd run electron:build` | PASS | 应用诊断修复后重新生成 Windows x64 免安装目录，当前 ASAR 哈希与成功报告一致。 |
| `npm.cmd run test:d04-r1` | PASS | [run-KPoUKj](test-results/platform/run-KPoUKj/report.json) 的 Chrome Web、Electron 开发版和仓库外独立生产包全部 PASS。 |
| 既有完整平台长套件 | FAIL（历史保留） | [run-1rk8KM](test-results/platform/run-1rk8KM/report.json)、[run-4xEAdj](test-results/platform/run-4xEAdj/report.json)、[run-cYdmZk](test-results/platform/run-cYdmZk/report.json) 保持原 FAIL；定向 PASS 不覆盖这些结果。 |
| Edge | NOT RUN | 本任务未要求重测 Edge，不以 Chrome 结果推导 Edge。 |

成功截图均位于 [run-KPoUKj](test-results/platform/run-KPoUKj/)：

- [Web 水平平台隐藏冻结](test-results/platform/run-KPoUKj/001-web-horizontal-support-hidden-frozen.png)、[Web 持 Space 隐藏冻结](test-results/platform/run-KPoUKj/003-web-horizontal-held-space-hidden-frozen.png)、[Web 垂直平台隐藏冻结](test-results/platform/run-KPoUKj/005-web-vertical-support-hidden-frozen.png)。
- [Electron 开发版水平平台隐藏冻结](test-results/platform/run-KPoUKj/010-electron-dev-horizontal-support-hidden-frozen.png)、[持 Space 隐藏冻结](test-results/platform/run-KPoUKj/012-electron-dev-horizontal-held-space-hidden-frozen.png)、[垂直平台隐藏冻结](test-results/platform/run-KPoUKj/014-electron-dev-vertical-support-hidden-frozen.png)。
- [独立生产包水平平台隐藏冻结](test-results/platform/run-KPoUKj/019-electron-packaged-horizontal-support-hidden-frozen.png)、[持 Space 隐藏冻结](test-results/platform/run-KPoUKj/021-electron-packaged-horizontal-held-space-hidden-frozen.png)、[垂直平台隐藏冻结](test-results/platform/run-KPoUKj/023-electron-packaged-vertical-support-hidden-frozen.png)。

本专项之前的 `run-PmBECe`（错误沿用诊断场景像素断言）、`run-LnHbxW`（准备阶段 blur 与暂停转换首帧）、`run-rtWcfh`（暂停快照被清空）和 `run-xyDdSD`（首次真实 keyup 前错误尝试新按下）均保持 FAIL，未删除或改写。D04-R1 PASS 仅证明上述移动平台生命周期范围；不表示完整平台长套件、完整 T01–T06、Edge、人工体验或 Matter 最终选型已经通过。D04 已由 Work 按该专项范围收口。

## D05：物理诊断区域与生命周期

2026-11-13 执行，只增加固定步驱动的非实体诊断区域。没有实现 CheckpointCoordinator、Event Inbox、业务 ID、捕获事务、检查点恢复、永久进度、NPC、任务、机关或正式美术；没有新增依赖，也没有把诊断记录升级为正式业务 Event。

- `diagnostic-zone-a`：中心 `x=400, y=462`，尺寸 `120 × 76`，蓝色显示。
- `diagnostic-zone-b`：中心 `x=450, y=462`，尺寸 `120 × 76`，粉色显示；与 A 在横向局部重叠。
- 两区域均为 Matter sensor，只通过 `Query.collides` 检测玩家主体与区域几何重叠。它们不在可支撑地形集合中，不阻挡、不承载，也不改变质量、速度或跳跃资格。
- 每个实际固定步只查询并归并一次区域结果。外到内记录一次 enter，持续占用累加实际步数，内到外记录一次 exit；真正离开后可再次 enter。每个区域独立维护状态和最多 8 条带 `SimulationTick` 的历史。
- `diagnosticOrdinal` 只用于本机诊断显示顺序，不冒充 Event ID、Command ID、Transaction ID 或永久业务 ID。
- 调试重置会按传送后的真实位置重建占用基线，不生成伪 enter／exit，不重置全局 Tick；场景切换会销毁旧世界和监听，不继承旧计数或占用。

真实 Matter 单测由原 38 项增至 44 项，G01–G06 六组全部 PASS：

| 用例 | 状态 | 实际覆盖 |
| --- | --- | --- |
| G01 | PASS | 真实走进、停留多个 Tick、离开及再进入；持续检测不重复 enter。 |
| G02 | PASS | A／B 重叠区域的占用和计数独立变化；同一步变化使用真实 Tick。 |
| G03 | PASS | 穿行无阻挡、区域内仍由 `ground-a` 支撑；脚底 sensor 不触发区域，空中重叠不授予跳跃资格。 |
| G04 | PASS | 隐藏／最小化至少 1200 ms 时状态、计数、Tick 与平台时钟冻结；恢复不重复 enter、不追赶。 |
| G05 | PASS | 区域内／外调试重置按实际位置建立基线；无伪事件、不重置 Tick；场景切换后无旧状态。 |
| G06 | PASS | 有界补算只按实际步检测，丢弃时间不生成记录；D05 定向场景回归移动平台时钟和物理步一致性。仅覆盖本任务范围。 |

`npm.cmd run test:d05` 一次完成 Chrome Web、Electron 开发版与仓库外独立生产包，报告为 [run-2Ch7Xr](test-results/platform/run-2Ch7Xr/report.json)，三端均 PASS，非预期中断、页面错误和清理失败均为 0。Chrome 为 `156.0.8078.74`；Electron 两种模式均真实记录最小化时 `visible=false / minimized=true`，恢复时 `visible=true / minimized=false / focused=true`。

| 环境 | A 首次 enter Tick／持续步数 | B-only 状态与计数 | 重叠状态 | 隐藏／恢复首帧 Tick、物理步与平台时钟 | A 恢复后再次进入 |
| --- | --- | --- | --- | --- | --- |
| Chrome Web | `99 / 21` | `A OFF X1；B ON E1` | A ON E2；B ON E1 | `317 / 317 / 1516.667 → 317 / 317 / 1516.667` | Tick `368`，E2 X1 |
| Electron 开发版 | `105 / 20` | `A OFF X1；B ON E1` | A ON E2；B ON E1 | `311 / 311 / 1466.667 → 311 / 311 / 1466.667` | Tick `362`，E2 X1 |
| 仓库外独立生产包 | `113 / 20` | `A OFF X1；B ON E1` | A ON E2；B ON E1 | `325 / 325 / 1533.333 → 325 / 325 / 1533.333` | Tick `375`，E2 X1 |

三端隐藏／恢复前后 A 的 `enterCount=1 / exitCount=0`、占用步数和平台时钟均保持不变；继续运行后才正常记录退出与再次进入。每端区域内跳跃后支撑仍为 `ground-a`。测试自有 Chrome、Electron 开发版和独立包 PID `14068 / 23080 / 33388` 均退出码 0，清理 PASS。

主要截图位于 [run-2Ch7Xr](test-results/platform/run-2Ch7Xr/)：

- Web：[区域占用](test-results/platform/run-2Ch7Xr/001-web-zone-a-enter-sustained.png)、[A／B 独立重叠](test-results/platform/run-2Ch7Xr/002-web-zones-overlap-independent.png)、[隐藏冻结](test-results/platform/run-2Ch7Xr/004-web-zone-a-hidden-frozen.png)、[恢复](test-results/platform/run-2Ch7Xr/005-web-zone-a-restored.png)、[场景切换清理](test-results/platform/run-2Ch7Xr/008-web-scene-switch-zones-clean.png)。
- Electron 开发版：[A／B 独立重叠](test-results/platform/run-2Ch7Xr/013-electron-dev-zones-overlap-independent.png)、[最小化冻结](test-results/platform/run-2Ch7Xr/015-electron-dev-zone-a-hidden-frozen.png)、[恢复](test-results/platform/run-2Ch7Xr/016-electron-dev-zone-a-restored.png)、[场景切换清理](test-results/platform/run-2Ch7Xr/019-electron-dev-scene-switch-zones-clean.png)。
- 仓库外独立生产包：[A／B 独立重叠](test-results/platform/run-2Ch7Xr/024-electron-packaged-zones-overlap-independent.png)、[最小化冻结](test-results/platform/run-2Ch7Xr/026-electron-packaged-zone-a-hidden-frozen.png)、[恢复](test-results/platform/run-2Ch7Xr/027-electron-packaged-zone-a-restored.png)、[场景切换清理](test-results/platform/run-2Ch7Xr/030-electron-packaged-scene-switch-zones-clean.png)。

执行结果：

| 命令／检查 | 状态 | 证据 |
| --- | --- | --- |
| `npm.cmd test` | PASS | TypeScript 核心／Renderer 检查、Electron Main 编译及 44/44 自动化测试通过。 |
| `npm.cmd run electron:build` | PASS | Vite 生产构建与 Windows x64 免安装目录成功；ASAR SHA-256 为 `C1C3C9B366B1A88F885DF1FE917A898BA6143BADC8C0DDF33FA6F6710F01A3F2`。 |
| `npm.cmd run test:d05` | PASS | [run-2Ch7Xr](test-results/platform/run-2Ch7Xr/report.json)：Chrome Web、Electron 开发版和仓库外独立生产包均通过，清理失败为空。 |
| `npm.cmd run electron` | PASS | 正常开发窗口保留给用户体验：PID `47016`、HWND `27723594`，标题“叠城大冒险 | Layered City Adventures”。[实际截图](test-results/d05-20261113/electron-dev-experience.png)及[启动记录](test-results/d05-20261113/experience-launch.json)。 |
| 既有完整平台长套件 | FAIL（历史保留） | `run-1rk8KM`、`run-4xEAdj`、`run-cYdmZk` 的原始 FAIL 不因 D05 定向 PASS 改写。 |
| Edge | NOT RUN | 本任务只要求 Chrome 定向三端，不以 Chrome 结果推导 Edge。 |
| `git diff --check` | PASS | 实际退出 0；仅有 Git 的 LF／CRLF 提示，没有空白错误。 |

报告内当前脚本 SHA-256：`tests/platform-smoke.mjs` 为 `CC47D0B962FB52C947A73D5710EC2802E449D3ED853EB4E4EA6D36D099E498CD`，`tests/graybox-browser.mjs` 为 `B74DE2A82F68DA6DDF67B80B3077C387954B784E6E47C8F26E1CC22E01924FB0`，`tests/player-physics.test.mjs` 为 `2EF42457740C448707A091A3BE5DB79373876FC12C132E1BBC9B1CF73A46FE0E`。D05 只关闭诊断区域生命周期子项，不表示完整 T04、触发器业务、检查点、T01–T06 或首关 MVP 已全部通过；Matter 仍是验证候选。

## D06：物理灰盒阶段回归

2026-11-13 对同一版灰盒执行阶段回归。本次没有新增玩法、依赖或平台类型，没有修改玩家运动、输入、物理、暂停或构建配置，也没有实现检查点、任务、NPC 或事件事务。应用源码与 D05 构建同版；测试层只修正了 M06 浏览器断言，并新增本轮证据记录。

首轮完整套件 [run-KRssuy](test-results/platform/run-KRssuy/report.json) 三端均在同一既有子项 `graybox-D04-M05-M06-platform-pause-reset` FAIL。调用调试重置后，从返回至下一次采样之间页面继续执行固定步，Web、Electron 开发版和独立包分别从 Tick `4033 / 4021 / 4012` 前进到 `4046 / 4035 / 4026`。任务要求是重置不能回退全局 Tick，真实 Matter 同步单测也已验证 Reset 调用本身不改变 Tick；原测试错误地要求采样时严格相等。现改为断言 `resetState.tick >= tickBeforeReset`，仍验证不倒退，同时允许重置返回后的正常固定步推进。原始 FAIL 报告保留，未重写。

执行命令与结果：

| 命令／检查 | 状态 | 实际结果 |
| --- | --- | --- |
| `npm.cmd test` | PASS | 共享核心／Renderer 类型检查、Electron Main 编译及 `44/44` 自动化测试通过，0 fail、0 skipped。 |
| `npm.cmd run electron:build` | PASS | Web 生产构建及 Windows x64 免安装目录成功；沿用既有体积和发行元数据警告，无构建错误。 |
| `npm.cmd run test -- --browser=chrome` | PASS | [run-Wo3C3j](test-results/platform/run-Wo3C3j/report.json)：Chrome Web、Electron 开发版和仓库外独立生产包均 PASS。 |
| `npm.cmd run test:d04-r1` | PASS | [run-JY8AVr](test-results/platform/run-JY8AVr/report.json)：三端移动平台真实隐藏／最小化生命周期均 PASS。 |
| `npm.cmd run test:d05` | PASS | [run-twh8V6](test-results/platform/run-twh8V6/report.json)：三端诊断区域进入／占用／离开、重置和场景切换均 PASS。 |
| `npm.cmd run electron` | PASS | 正常开发体验窗口继续运行；PID `47016`、HWND `27723594`，标题为“叠城大冒险 | Layered City Adventures”。 |
| Edge 全套回归 | NOT RUN | 本轮按已确认的 Chrome 默认入口验证，不以 Chrome 结果推导 Edge。 |
| 独立人工走跳 | BLOCKED | Computer Use 可读取窗口和截图，但不能可靠产生跨越游戏帧的持续按键；不把自动键盘验证冒充人工体验。 |

三份成功报告均为三端正常退出码 `0`，`cleanupFailures`、非预期中断和页面错误均为 `0`。完整套件中，Web、Electron 开发版和独立包的隐藏恢复 Tick 分别为 `3998→3998`、`3985→3985`、`3989→3989`，平台时钟分别保持 `8766.667 ms`；三次重启、隐藏启动和持键恢复门槛同时通过。D04-R1 的水平平台 Tick／物理步／平台时钟在三端分别为 `551 / 572 / 566`，隐藏与恢复首帧完全相同；垂直平台分别为 `1312 / 1331 / 1324`，平台时钟同样不变。D05 的冻结与恢复首帧 Tick 分别为 `316→316`、`321→321`、`318→318`，诊断区域 A 的 `enterCount` 均保持 `1`。

当前版本证据：

- ASAR SHA-256：`C1C3C9B366B1A88F885DF1FE917A898BA6143BADC8C0DDF33FA6F6710F01A3F2`。
- Windows EXE：`release/layered-city-adventures/win-unpacked/Layered City Adventures.exe`，SHA-256 `D89CF19C2F36376B0DB3C03EAEE506E1203A45E705E66C87E626261C8DEB470B`。
- 成功报告脚本哈希：`tests/graybox-browser.mjs` 为 `3BE983D0CD04B70077681028886D7254305F1700426524455D68CD1CC0772242`，`tests/platform-smoke.mjs` 为 `CC47D0B962FB52C947A73D5710EC2802E449D3ED853EB4E4EA6D36D099E498CD`，`tests/player-physics.test.mjs` 为 `2EF42457740C448707A091A3BE5DB79373876FC12C132E1BBC9B1CF73A46FE0E`。
- Chrome 实际身份：Google Chrome `156.0.8078.74`；Electron 为锁定的 `44.11.1`。
- 当前代码基线为 `92cc389`，工作区中的 D06 测试与文档尚未提交。

T01–T06 当前子项矩阵如下。“真实 Matter 单测”“三端真实键盘／窗口自动化”和“独立人工操作”分别记录，不能用一种证据替代另一种。

| 分组／子项 | 条件与步骤 | 预期／实际结果 | 状态 | 边界与证据 |
| --- | --- | --- | --- | --- |
| T01 平滑加减速、反向和空中控制 | 三端灰盒；D 加速、A 反向、起跳后 D | 渐变且可反向、空中可转向；实际 `movingX=157.33`、`reversedVx=-220`、`airVx=100` | PASS | 当前原型参数；[run-Wo3C3j](test-results/platform/run-Wo3C3j/report.json) |
| T01 短跳、长跳和单次消费 | 三端出生点；短按／长按 Space，并持续按住落地 | 长按更高且不自动连跳；实际峰值 `428.95 / 382.11`，持续按键仅 `1` 次 | PASS | 不改最终手感参数；[run-Wo3C3j](test-results/platform/run-Wo3C3j/report.json) |
| T01 土狼时间与输入缓冲 | 三端跨隙及落地前按键 | 离边后可跳一次，缓冲仅消费一次，过期不补发；三端断言通过 | PASS | 精确边界另由真实 Matter 单测覆盖 |
| T01 侧碰不能恢复跳跃资格 | 真实 Matter 单测；悬空贴墙后申请跳跃 | 侧向接触不授予支撑或第二次空中跳跃 | PASS | 仅单测层，尚无单独三端 UI 用例 |
| T02 地面、墙、低顶和连续坡面 | 三端同一静态世界；行走、顶墙、顶头跳、上下坡和停留 | 无穿透；实际低顶最小 Y `451.95`、墙边约 `506.11`；坡面通过且静止漂移 `0` | PASS | 仅当前几何与速度 |
| T02 实体平台与单向平台 | 三端平台区；实体顶底、单向上下穿越、站立、边缘和短跳 | 实体双向阻挡；单向自下穿越、自上承载，无假落地 | PASS | P01–P06 真实 Matter 单测 + 三端；不支持主动下落穿透 |
| T03 水平与垂直平台承载 | 三端真实键盘登台并随动；覆盖多个反向周期 | 得到 `moving-horizontal-a` / `moving-vertical-a`，无掉穿或累计漂移 | PASS | [run-Wo3C3j](test-results/platform/run-Wo3C3j/report.json) |
| T03 平台行走、起跳、落回和离开 | 平台运动时走、停、反向、起跳和走出边缘 | 自主运动与平台位移只施加一次；跳跃后落回或自然脱离 | PASS | 起跳不继承额外速度是原型策略 |
| T03 暂停、最小化与重置 | 平台上真实隐藏／原生最小化；持 Space；随后调试重置 | Tick、物理步和平台时钟冻结；恢复不追赶、不自动跳跃；重置不回退 Tick | PASS | [run-JY8AVr](test-results/platform/run-JY8AVr/report.json)；Windows 两种 Electron 模式均有原生窗口状态 |
| T03 移动单向、旋转与挤压平台 | 本轮未实现 | 后续专项验证 | NOT RUN | 不属于 D04／D06 当前范围 |
| T04 区域 enter／sustain／exit／re-entry | 三端从区域外真实走入、停留、离开并再次进入 | 每次转换只记录一次，持续步数和真实 Tick 正确 | PASS | [run-twh8V6](test-results/platform/run-twh8V6/report.json) |
| T04 重叠区域独立性 | 三端进入 A、B-only、A+B 重叠和 A-only | A／B 占用状态、无事件和计数独立变化 | PASS | G01–G02 真实 Matter + 三端 |
| T04 非实体语义 | 穿行、在区域内跳跃，并单独重叠脚底 sensor | 不阻挡、不承载、不改变跳跃资格；仅 sensor 不触发区域 | PASS | G03 真实 Matter + 三端支撑断言 |
| T04 暂停、重置与场景切换 | 区域占用时隐藏／最小化，恢复后重置并切换场景 | 恢复不产生虚假 enter；重置同步基线；切换后旧状态为 0 | PASS | [run-twh8V6](test-results/platform/run-twh8V6/report.json) |
| T04 正式业务触发器、Event Inbox 与检查点 | 尚未实现 | 后续阶段验证事务与恢复边界 | NOT RUN | 诊断记录不是业务 Event |
| T05 Chrome Web、Electron 开发版与独立包一致性 | 同一核心和配置执行完整套件及两项定向套件 | 三端结果一致；允许调度造成 Tick 与浮点轨迹不同 | PASS | 三份成功报告；Windows 默认包含开发版和仓库外生产包 |
| T05 共享核心平台隔离 | 独立核心类型检查及模块引用检查 | 核心不加载 DOM／Node 平台 API，运行同一个 Renderer 核心 | PASS | `npm.cmd test` |
| T05 Edge 兼容性 | 用 Edge 显式入口执行对照 | 本轮未执行 | NOT RUN | Chrome 通过不推导 Edge |
| T05 绝对 Tick／浮点轨迹逐位一致 | 三端渲染调度不同 | 不作为验收条件；比较规则、支撑和容差内结果 | NOT RUN | 任务明确不要求逐位一致 |
| T06 隐藏启动、两轮隐藏恢复和三次重启 | 三端真实页面／原生窗口生命周期 | 隐藏启动允许 Tick 0；恢复后继续；三端三次重启和原生关闭均通过 | PASS | [run-Wo3C3j](test-results/platform/run-Wo3C3j/report.json) |
| T06 无后台追赶和持键恢复 | Web 隐藏、Windows 原生最小化至少 1200 ms；恢复首帧采样 | Tick、物理步、平台时钟和区域状态冻结；不补算、不自动跳跃 | PASS | 完整套件、D04-R1、D05 三份报告 |
| T06 调试重置边界 | 角色、平台和区域状态变化后使用 R／按钮 | 重置原型状态，不重置全局 Tick，不称检查点恢复 | PASS | 真实 Matter M06／G05 + 三端 |
| T06 完整检查点与 RecoveryError | 尚未实现捕获、永久进度协调和两阶段恢复 | 后续专项验证 | NOT RUN | 不得用调试重置或最小化恢复冒充 |

现有正常体验入口：

```powershell
npm.cmd run electron
& '.\release\layered-city-adventures\win-unpacked\Layered City Adventures.exe'
```

推荐操作路线：从出生点练习 A/D、短按／长按 Space → 进入蓝色／粉色诊断区域 → 跨越间隙和坡面 → 登上有标记的实体与单向平台 → 到达橙色水平平台和青色升降平台 → 分别隐藏标签页或最小化窗口，恢复后检查暂停、输入门槛和继续承载。按 R 可重置当前原型状态，但这不是检查点恢复。

本轮重新截取的正常开发体验窗口见 [D06 实际截图](test-results/d06-20261113/electron-dev-experience.png)，启动与 SHA-256 记录见 [experience-launch.json](test-results/d06-20261113/experience-launch.json)。三端自动化截图分别见 [完整套件](test-results/platform/run-Wo3C3j/005-web-graybox-completed.png)、[移动平台生命周期](test-results/platform/run-JY8AVr/016-electron-dev-D04-R1-moving-platform-lifecycle-completed.png)和[诊断区域](test-results/platform/run-twh8V6/027-electron-packaged-zone-a-restored.png)。

结论：当前已实现的物理灰盒子项和三项定向回归均通过，没有已知且未报告的阻断玩法缺陷。当前版本的既有完整长套件最终证据为 PASS；运行中曾出现的失焦类历史 FAIL、首轮 M06 测试断言 FAIL、Edge 未测、独立人工操作 BLOCKED 和检查点相关 NOT RUN 均继续保留。因此只能认为 D06 的“已实现灰盒范围”具备进入 D07 的工程条件，不能宣布完整 T01–T06、完整恢复架构或 Matter 最终选型通过。

## D07：统一交互原型

2026-11-13 在现有灰盒交付“进入范围显示提示 → 主动按 E → 展示调查面板或短暂拾取反馈 → 结束后继续移动”的最小闭环。未新增正式任务、NPC、对白、奖励、永久进度、收藏品、业务事件或检查点；本次对象、键位、范围、选择和反馈时长均为可调整原型。

原型对象与规则：

- `prototype-investigation-a`：`x=200`、范围 `80×110`，显示临时调查 A。
- `prototype-investigation-b`：`x=260`、范围 `80×110`，与 A 局部重叠，显示临时调查 B。
- `prototype-pickup-c`：`x=335`、范围 `70×110`，只显示 `1200 ms` 短暂反馈，不持有长时间移动锁。
- 目标选择仅考虑有效范围，依次按朝向、距离平方和稳定对象 ID 排序；反向或位置变化可以切换目标，任何时刻只显示一个主要提示。
- E 只在新的有效按下时消费一次；键盘 repeat、按住、暂停、失焦及补算不缓存触发。Escape 或面板「关闭」按钮只关闭当前调查。失焦、暂停、其他控制来源阻塞或 E 尚未释放时不显示可操作提示；恢复可交互后提示按实际候选重新显示。
- 调查开始通过现有 `PlayerControlCoordinator` 使用交互自身 owner 申请移动／跳跃限制；关闭只撤销该 owner。物理、重力和支撑继续按固定步运行，没有暂停整个世界。
- 交互状态和拾取反馈计时只在真实 SimulationTick 推进。隐藏或最小化时由现有生命周期暂停，恢复不会自动关闭、重开或再次交互；调试重置和场景切换清除交互状态、反馈及自身限制。

固定步内顺序为：读取上一 Tick 的玩家状态 → 解析本 Tick 输入与固定步动作 → 唯一一次 Matter 求解和支撑刷新 → 刷新交互候选与主目标 → 按固定 Delta 推进短反馈计时。平台和既有诊断区域逻辑未改成由渲染帧驱动。

执行结果：

| 命令／检查 | 状态 | 实际结果 |
| --- | --- | --- |
| `npm.cmd test` | PASS | 共享核心／Renderer 类型检查、Electron Main 编译及 `50/50` 自动化测试通过，0 fail、0 skipped。 |
| `npm.cmd run electron:build` | PASS | Vite 生产构建成功，主包约 `1,226.48 kB`，gzip 约 `330.17 kB`；Windows x64 免安装目录生成成功。 |
| `npm.cmd run test:d07` | PASS | [run-obVH8m](test-results/platform/run-obVH8m/report.json)：Chrome Web、Electron 开发版和仓库外独立包均 PASS，清理失败、页面错误和非预期中断均为 `0`。 |
| `npm.cmd run test -- --browser=chrome` | PASS | [run-HAkFWZ](test-results/platform/run-HAkFWZ/report.json)：当前源码和产物的完整三端回归 PASS。通用入口报告中的 `task` 字段沿用历史 `D04` 标签，本轮按执行范围归入 D07。 |
| `npm.cmd run electron` | PASS | 正常开发体验窗口已启动并保留；PID `30952`、HWND `13896118`，标题为“叠城大冒险 | Layered City Adventures”。 |
| Edge 交互定向 | NOT RUN | 本轮未重测 Edge；Chrome 结果不推导 Edge。 |
| 独立人工走跳／交互 | BLOCKED | Computer Use 可读取窗口并截图，但不能可靠保持跨游戏帧的按键；不把自动键盘测试冒充独立人工体验。 |

首轮 D07 定向 [run-ALZnzH](test-results/platform/run-ALZnzH/report.json) 三端均为真实 FAIL，保留原报告。失败用例要求调查打开后角色位置立即严格不变；实际既有速度按减速曲线继续滑行约 `2.67–7.22 px`，随后 `vx=0`。调查 owner 已限制新移动／跳跃输入且没有发生跳跃，因此原断言把正常惯性当成错误。断言改为验证速度最终归零、减速完成后位置稳定、控制锁与暂停语义没有放宽；最终定向和完整回归报告单独记录，未改写首轮 FAIL。

I01–I07 验收：

| 用例 | 状态 | 实际证据 |
| --- | --- | --- |
| I01 范围提示与主动交互 | PASS | 范围外无提示和消费；进入后仅一个主要提示；未按 E 不自动打开；离开后提示消失。 |
| I02 重叠目标选择 | PASS | A／B 局部重叠；面向、距离及稳定 ID 决定唯一目标；反向可切换；一次 E 不同时操作多个对象。 |
| I03 调查与协调器控制 | PASS | 调查打开后移动输入、跳跃和再次交互受限，Matter 与固定步继续；Escape／关闭按钮只释放交互自身限制。 |
| I04 按住、repeat、失焦与暂停 | PASS | 按住 E 和 repeat 不重复消费；关闭后仍按住不重开；Web hidden 与 Windows 原生 minimized 后消费数／开始数不增加，恢复仍要求释放再按。 |
| I05 拾取短反馈 | PASS | 拾取 C 显示短暂反馈，`controlAllowed=true`，可继续移动；没有奖励或永久记录。 |
| I06 重置与场景切换 | PASS | 调试重置后回到 idle、计数清零并释放自身限制；切换诊断场景后无旧面板、计数或锁残留。 |
| I07 回归与双端边界 | PASS | `50/50` 单测；D07 三端专项及完整三端回归 PASS；共享核心未新增 DOM／Node／Phaser 平台 API。 |

D07 三端调查冻结／恢复首帧：

| 环境 | 调查打开 Tick | 隐藏冻结 Tick | 恢复 Tick | 恢复后控制 |
| --- | ---: | ---: | ---: | --- |
| Chrome Web | 171 | 225 | 226 | LOCKED |
| Electron 开发版 | 173 | 220 | 222 | LOCKED |
| 仓库外独立包 | 165 | 214 | 216 | LOCKED |

三端恢复后调查内容仍打开，消费数和开始数没有增加；Escape 关闭后控制恢复。实际隐藏持续超过 `1200 ms`，Tick 仅在恢复后的首次有效采样继续。自动化无法消除各渲染调度的 Tick 差异，因此只比较规则、冻结语义和容差内结果。

当前版本证据：

- ASAR SHA-256：`9FAE0259711801B3CD57DB71381F8A343C0C17C0E44B2A7B5218DFF70E1BE641`。
- Windows EXE SHA-256：`25B604AD000A6CEF4A1B9A2BCCD285F4C85DE78E6B27C2BDB68575C56DD96046`。
- `tests/platform-smoke.mjs`：`098ED363C85D73C0AFB919DB6D9871F243A0D91F67A016C83AFF95FC64D13EAF`。
- `tests/graybox-browser.mjs`：`42B92673A3E9D493583492852D494D69AE4FC7F097BF1F439CAD3AEA65FBC5BA`。
- `src/core/interaction.ts`：`0A89F1A196B09DCA5D0643D4D8B9632057B273CE33BBFB31719F539BB2F684BF`。
- Chrome 实际身份：Google Chrome `156.0.8078.74`；Electron `44.11.1`。
- 当前代码基线：`92cc389`；D07 修改尚未提交。

真实截图：

- [Web 调查面板](test-results/platform/run-obVH8m/002-web-D07-investigation-open.png)
- [Web 调查隐藏冻结](test-results/platform/run-obVH8m/003-web-D07-investigation-hidden-frozen.png)
- [Web 拾取反馈](test-results/platform/run-obVH8m/005-web-D07-pickup-feedback.png)
- [Electron 开发版调查面板](test-results/platform/run-obVH8m/012-electron-dev-D07-investigation-open.png)
- [独立生产包调查面板](test-results/platform/run-obVH8m/022-electron-packaged-D07-investigation-open.png)
- [正常开发体验窗口](test-results/d07-20261113/electron-dev-experience.png)，启动信息见 [experience-launch.json](test-results/d07-20261113/experience-launch.json)。

体验入口与操作：

```powershell
npm.cmd run electron
& '.\release\layered-city-adventures\win-unpacked\Layered City Adventures.exe'
```

从出生点向右靠近调查 A／B；在重叠区反向观察主要提示切换，按 E 打开面板，按 Escape 或点击「关闭」结束。继续向右靠近拾取 C，按 E 触发短反馈并在反馈未结束时继续移动。最后按 R 检查交互状态与计数清空。该路线只验证原型交互，不代表正式内容、奖励或任务流程。

### D07-R1：提示可用性与重置松键门槛

2026-11-13 的 Work 审查发现两项核心边界缺口，D07-R1 只修复这两项，不修改物理手感、暂停协议、正式键位或其他正式规则：

1. `snapshot.prompt` 原先只判断候选和活动调查，外部控制 owner 阻塞、输入不可用或暂停时仍返回 `E 调查 B`。现在提示还要求输入可用、模拟未暂停、控制协调器允许交互、E 没有待释放门槛且当前没有按住 E。恢复后只依据这些真实条件重新显示。
2. 重置原先根据 `held` 集合重写松键门槛；输入失焦已清空 `held`、但 `needsRelease=true` 时，重置会把门槛错误清除。现在重置使用 `needsRelease || held.has(E)` 保留既有门槛，直到真实 E keyup 才解除。

平台适配层只增加一个最小同步回调：`bindPlayerInput` 在焦点／可见性状态变化并调用 `setAvailable` 后通知诊断刷新，使隐藏、暂停或失焦时的提示状态立即落入实时 DOM 数据。应用状态仍由共享交互控制器决定，没有在平台层直接修改交互或模拟。

D07-R1 执行结果：

| 检查 | 状态 | 实际结果 |
| --- | --- | --- |
| 新增 R01／R02 测试在修复前 | FAIL | R01 在外部 owner 阻塞时仍得到 `E 调查 B`；R02 在原始失焦、重置、无 keyup 顺序中把 `needsRelease` 从 `true` 错误改为 `false`。失败仅用于先失败后通过验证，不覆盖历史 PASS。 |
| `npm.cmd test` | PASS | 原 50 项加 2 项回归共 `52/52` PASS；类型检查、Electron Main 编译、0 fail、0 skipped。 |
| `npm.cmd run electron:build` | PASS | Vite 17 个模块及 Windows x64 免安装目录构建成功；主包约 `1,226.59 kB`，gzip 约 `330.20 kB`。 |
| `npm.cmd run test:d07 -- --browser=chrome` 首轮 | FAIL | [run-PkdgnR](test-results/platform/run-PkdgnR/report.json) 保留：Chrome Web PASS；Electron 开发版和独立包在 visibility 已恢复、但真实焦点尚未回归的首个采样中，提示和控制仍正确保持不可用，测试却过早要求 `controlAllowed=true`。 |
| `npm.cmd run test:d07 -- --browser=chrome` 最终 | PASS | [run-LTvqUU](test-results/platform/run-LTvqUU/report.json)：Chrome Web、Electron 开发版和仓库外独立包全部 PASS；清理失败、页面错误和非预期中断均为 `0`。 |
| 完整物理长套件 | NOT RUN | D07-R1 只改交互可用性与输入门槛；按任务范围复用 D07 定向入口，没有理由重跑全部物理流程。 |
| Edge | NOT RUN | 本轮未重测 Edge。 |
| 独立人工长按体验 | BLOCKED | 继续保留工具限制，不以自动键盘测试冒充人工体验。 |

三端 D07-R1 实时结果：

| 环境 | 隐藏期间 | 可见但尚未聚焦 | 聚焦且可交互 | 重置后不 keyup |
| --- | --- | --- | --- | --- |
| Chrome Web | `prompt=""`, `control=false` | 未形成该中间态 | `prompt="E 调查 B"`, `control=true` | `needsRelease=true`, `prompt=""`, 不触发 |
| Electron 开发版 | `prompt=""`, `control=false` | `prompt=""`, `control=false` | `prompt="E 调查 B"`, `control=true` | `needsRelease=true`, `prompt=""`, 不触发 |
| 仓库外独立包 | `prompt=""`, `control=false` | `prompt=""`, `control=false` | `prompt="E 调查 B"`, `control=true` | `needsRelease=true`, `prompt=""`, 不触发 |

三端均验证：隐藏前提示可见；隐藏或最小化期间提示消失；窗口可见但尚未取得焦点时仍不可操作；真实焦点恢复后才重新显示。调查打开后隐藏／恢复仍保留原面板和控制 owner。原始复现顺序中，E 未释放时关闭调查、失焦、重置、返回目标范围并再次收到 E down，仍未触发；只有收到 E keyup 后提示恢复，下一次按下才消费一次并打开调查。

D07-R1 当前证据：

- ASAR SHA-256：`958B8B18379FD2E5FEF83F3401F686CB0CD694FDAFD3255DBF1733E7FB99848C`。
- Windows EXE SHA-256：`763FC4C078A8D66CAD8D2E7B115FFA336710ADE65283FBBF8004788F4D1CA390`。
- `src/core/interaction.ts`：`F707047FA612BB8BB33DE7674CD8622BA5FE346C4B3B740054FDFED9624C298A`。
- `src/platform/web/player-input.ts`：`95D499A22943A32A9E5926FE23AA32A1BC48DB26B1F0D0D9547FA36D702FAB08`。
- `tests/graybox-browser.mjs`：`D675FB197392A328326099EA139A35986235CB88092DA3391491B1D9F92F696D`。
- `tests/platform-smoke.mjs`：`86C3477A85F12DB81992C430E236AB0A801B9A59C169F1D065D7D38DDA38F4FB`。

D07-R1 截图：

- [Web 隐藏期间提示消失](test-results/platform/run-LTvqUU/002-web-D07-R1-prompt-hidden-frozen.png)
- [Web 恢复后提示重新显示](test-results/platform/run-LTvqUU/003-web-D07-R1-prompt-restored.png)
- [Electron 开发版重置后仍保持松键门槛](test-results/platform/run-LTvqUU/019-electron-dev-D07-R1-release-gate-reset-held.png)
- [独立包恢复后提示重新显示](test-results/platform/run-LTvqUU/031-electron-packaged-D07-R1-prompt-restored.png)

结论：D07 主体和 D07-R1 两项缺口在当前原型范围内已经修复并通过三端定向验证。历史 `run-ALZnzH` 与 D07-R1 首轮 `run-PkdgnR` FAIL 均保留；Edge NOT RUN、独立人工长期按键 BLOCKED 和未实现业务能力继续保留。Matter 仍为验证候选，当前等待 Work 审查，不进入 D08。

## D08：运行内进度与幂等应用原型

2026-11-13 按路线图 D08 交付“测试收藏 D／测试目标 E → 目标与奖励只登记一次 → 永久效果打开测试路线门 → R 重建临时世界后保留记录并重开门”的最小闭环。这里的“永久”只指同一页面运行内，未使用 `localStorage`、`sessionStorage`、文件或远端存储；整页刷新、场景重载和应用退出都会创建新的空进度仓库。

共享核心新增 `InMemoryRunProgress`，以私有集合分别管理收藏、目标、奖励和永久效果，并通过只读快照向 Renderer 展示。D08 测试 ID 保持独立且显式关联：

| 类型 | 稳定 ID |
| --- | --- |
| 收藏 | `collection.prototype.travel-token` |
| 目标 | `goal.prototype.open-test-route` |
| 奖励 | `reward.prototype.open-test-route` |
| 永久效果 | `effect.prototype.open-test-route` |

E 交互仍由 D07 的主动输入入口消费。收藏和目标重复操作会生成可见“已存在／未新增”反馈，新增次数不增加；目标首次完成才登记关联奖励并设置 `expectedActive=true`。效果采用显式期望状态，reconcile 不会 toggle，也不会增加奖励。D08 测试路线门是真实 Matter 静态碰撞体：CLOSED 时以玩家碰撞类别阻挡，OPEN 后将碰撞 mask 置零并同步颜色、状态文字与诊断数据。R 先恢复角色、交互、平台和区域临时状态，再由同一进度仓库重新协调永久效果。

实现顺序与边界：

1. 临时世界／交互对象初始化。
2. 进度仓库按稳定 ID 提供只读记录。
3. 玩家主动 E 交互触发受控登记。
4. 目标、关联奖励和期望效果分别幂等写入。
5. 效果协调器读取期望状态并设置 Matter 碰撞资格。
6. R 重建临时初始状态，保留仓库，再重新应用效果。

P01–P06 验收：

| 用例 | 状态 | 实际证据 |
| --- | --- | --- |
| P01 初始空、四类 ID 独立、非法请求 | PASS | 纯核心测试验证 4 类空记录、4 个不同稳定 ID、只读快照、未知类别与错误关系均被拒绝且不污染集合。 |
| P02 收藏去重与对象重建 | PASS | 真实 Matter 的按键、重复按键、离开再进入及同一仓库注入新世界均保持收藏数 `1`；浏览器三端实际消费 3 次，收藏仍为 `1`。 |
| P03 目标与奖励只记一次 | PASS | 重复交互、重复调用目标完成和重复效果协调后，目标／奖励／效果均保持 `1`，未生成第二份奖励。 |
| P04 永久效果不 toggle 并可重建 | PASS | 期望状态连续设为 `true` 仍为 OPEN；临时关闭世界效果后 R／新世界协调重新打开，碰撞 mask 与实际显示一致。 |
| P05 R 保留永久记录、清理临时状态 | PASS | 三端 R 后玩家回到 `x=80`、交互消费／反馈计数归零、平台时钟重置，四类记录仍为 `1/1/1/1` 且测试门保持 OPEN。 |
| P06 隐藏／最小化冻结 | PASS | 三端真实隐藏或原生最小化超过 `1200 ms` 时记录和 E 消费数不变；恢复后不自动交互，仍要求释放 E，保留 D07 控制门槛。 |

D08 三端定向与趋势性状态：

| 环境 | 结果 | 完成前 | 完成后 | R 后 | 隐藏冻结 Tick → 恢复首帧 Tick | 隐藏期间 E 消费 |
| --- | --- | --- | --- | --- | --- | --- |
| Chrome Web | PASS | `0/0/0/0` | `1/1/1/1` | `1/1/1/1`，OPEN | `488 → 489` | `1 → 1` |
| Electron 开发版 | PASS | `0/0/0/0` | `1/1/1/1` | `1/1/1/1`，OPEN | `459 → 462` | `1 → 1` |
| 仓库外独立包 | PASS | `0/0/0/0` | `1/1/1/1` | `1/1/1/1`，OPEN | `472 → 475` | `1 → 1` |

表中 `0/0/0/0` 和 `1/1/1/1` 依次为收藏／目标／奖励／效果记录数。各端 Tick 差值来自真实窗口恢复调度，规则比较不要求跨端逐位相同。

实际执行：

| 检查 | 状态 | 结果 |
| --- | --- | --- |
| `npm.cmd test` | PASS | 类型检查、Electron Main 编译及 `59/59` 自动化测试 PASS，0 fail、0 skipped。 |
| `npm.cmd run electron:build` | PASS | Vite 18 个模块与 Windows x64 免安装目录构建成功；仅保留主包体积、缺少 author 和默认图标警告。 |
| `npm.cmd run test:d08 -- --browser=chrome` | PASS | [run-nlbzAQ](test-results/platform/run-nlbzAQ/report.json)：Chrome Web、Electron 开发版和仓库外独立包全部 PASS；页面错误、非预期中断及清理失败均为 `0`。 |
| `npm.cmd run test:d07 -- --web-only --browser=chrome` | PASS | [run-xHiVwG](test-results/platform/run-xHiVwG/report.json)：原 A／B／C、提示资格、松键门槛、控制锁、拾取反馈和场景清理定向回归 PASS。 |
| 完整物理长套件 | NOT RUN | D08 复用既有输入、固定步和平台，未改物理手感；按任务范围不重跑全部物理流程。 |
| Edge | NOT RUN | 本轮使用 Chrome 三端回归，不声称 Edge 已通过。 |
| 独立人工长按 | BLOCKED | 既有 Computer Use 无法可靠跨游戏帧持续按键；自动键盘结果不替代人工体验声明。 |

当前证据：

- ASAR SHA-256：`92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`。
- Windows EXE SHA-256：`BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`。
- `src/core/progress.ts`：`A0DF39377B0DC2EDD2399F4AE7A9A54542E79060E05770D3E78A9CC882DEB5F6`。
- `src/core/graybox.ts`：`CDA9392A9FFB2B6F9E72AB4E2571A94C29F8A41A0AA7745BB668D65795B6FB7C`。
- `src/core/interaction.ts`：`5449AAF18CC9DA8A9D4D8CB29641A75477A7AC3618A8115017D5EA8A4F02FE43`。
- `src/physics/matter/graybox-world.ts`：`7A8D3CBCED2E7B70ED77EBB3A8ED41C4FFB329486B04B7B92EF392C0D01F5B6E`。
- `tests/graybox-browser.mjs`：`2F7715A4BBF945FE6E37A3F85599E60A4F2AD967A16B762B92C67042B7D7FA35`。
- `tests/platform-smoke.mjs`：`AA193E3C3E56CCBDA62C592319376703011C3BCFD6E3E6183C1ADDC73A8E8973`。

真实截图：

- [Web 收藏首次登记](test-results/platform/run-nlbzAQ/001-web-D08-collection-first.png)
- [Web 目标／奖励完成，测试路线门 OPEN](test-results/platform/run-nlbzAQ/002-web-D08-goal-route-open.png)
- [Web R 后记录保留并重新应用效果](test-results/platform/run-nlbzAQ/004-web-D08-reset-progress-retained.png)
- [Web 隐藏期间冻结](test-results/platform/run-nlbzAQ/005-web-D08-hidden-frozen.png)
- [Electron 开发版目标与 OPEN 门](test-results/platform/run-nlbzAQ/010-electron-dev-D08-goal-route-open.png)
- [仓库外独立包目标与 OPEN 门](test-results/platform/run-nlbzAQ/018-electron-packaged-D08-goal-route-open.png)
- [正常开发体验窗口（D08 源码已加载）](test-results/d08-20261113/electron-dev-experience.png)，启动信息见 [experience-launch.json](test-results/d08-20261113/experience-launch.json)。

现有正常开发体验窗口继续保留，PID `30952`、HWND `13896118`、标题“叠城大冒险 | Layered City Adventures”；本轮未关闭或将其交给测试清理。结论限 D08 运行内原型：正式跨会话存档、正式任务／收藏册、奖励内容、Event／Command／Transaction、检查点及 RecoveryError 均未实现，Matter 仍未成为最终物理方案。当前等待 Work 审查，不进入 D09，不 Commit／Push／发布。

## 当前限制

- 最新执行（D08，2026-11-13）：[run-nlbzAQ](test-results/platform/run-nlbzAQ/report.json) 的 Chrome Web、Electron 开发版和仓库外独立包均 PASS；D07 定向回归 [run-xHiVwG](test-results/platform/run-xHiVwG/report.json) PASS，Edge 为 NOT RUN。
- Web 主包约 325 KB gzip，Vite 有体积提示；尚未做加载优化。
- `npm audit` 报告 electron-builder 依赖链共 6 项 moderate，涉及 minimatch；未强制升级传递依赖。该工具链未装入运行包。
- 未完成正式图标、作者及发行元数据、安装器或签名；当前仅验收 Windows 11 x64 的免安装目录。
- R1 已确认并修复隐藏页面被 Tick 增长就绪条件误判的问题。更早的重启等待超时证据不足，仍未定位；不得仅凭回归通过认定同源或宣称长期稳定。
- 历史 D01-R2 的 Chrome／Edge 定向曾因 blur 失败，当时完整三端 NOT RUN。后续 D01-R3 的 Chrome 三端已通过，旧根因和 Edge 兼容性未知项仍保留，不能据此宣称长期稳定性全面通过。
- 当前角色、静态实体平台、单向平台、水平移动平台、垂直升降平台、非实体诊断区域、调查／拾取交互及 D08 运行内进度是工程灰盒；未实现移动单向平台、旋转／挤压、正式触发器业务、主动下落穿透、NPC、正式任务／收藏册、跨会话存档、事件事务或检查点。D08 的“永久”仅限当前页面运行内；调试重置、最小化恢复、运行内进度和交互原型都不等于 Checkpoint Recovery；不代表完整 T01–T06 或 MVP-G01–G06 已通过。D08 已完成当前原型范围的实现和验证，等待 Work 审查，不自动进入 D09。
