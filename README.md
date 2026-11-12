# 《叠城大冒险》（Layered City Adventures）

开发窗口从 [开发路线图与执行流程](docs/DEVELOPMENT_ROADMAP.md) 领取和记录任务。依据项目负责人最新要求，每次完成实现、测试、自审和进度更新后，可继续下一项已列任务，无须逐项往返 Work 领取提示词；正式决策变更、真实设计冲突和红线操作仍需暂停报告。

《叠城大冒险》（Layered City Adventures）是一款以具有山城特色的虚构立体城市为舞台的 2D 横版平台探索冒险游戏，核心体验是跳跃、探索、解谜与发现（CONFIRMED，2026-11-12）。

当前默认打开 M1.2.2 可操作物理灰盒，Web 与 Windows 使用同一份角色、地形与模拟代码。顶部「场景」可切回原固定步诊断场景。「重新启动」先销毁 Phaser 实例，再重新加载原页面并创建新实例；「重置灰盒」只重置原型角色，不是检查点恢复。

Mountain City: Last Delivery／山城有路：最后一单为历史名称。下文旧里程碑的日志、截图及证据保留当时名称，不改写为新名执行过的测试。真实地标资料与旧首关方案保留参考，其虚构世界叙事尚待适配；本次不新增玩法、不重写任务或通关条件。内部包名、appId、用户数据身份及项目目录不变。

操作：A/D 或 ←/→ 移动，Space 跳跃，短按低跳、长按高跳；R 或「重置灰盒」回到出生点。黄色方块为角色，脚底绿框表示已验证支撑，红框表示无支撑。沿右侧跨过墙壁和间隙后可测试连续坡面；掉出间隙后按 R。窗口失焦会清理输入，恢复后先松开 Space 再按，持续按住不会自动起跳。

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
| `tests/player-physics.test.mjs` | 受控时间运行 Phaser 内置的真实 Matter，验证控制、接触与重置。 |
| `tests/graybox-browser.mjs` | 真实窗口键盘操作、跳高／缓冲／跨隙／坡面与物理暂停断言。 |
| `tests/platform-smoke.mjs` | 可选 Chrome／Edge 的真实标签页测试，以及 Electron 原生最小化／恢复、独立包和重启回归。 |
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

按具体用例记录 T01–T06；以下 PASS 仅限列出的覆盖，不把整个分组或最终 Matter 选型判为通过：

| 测试目标 | 前置条件（平台） | 操作步骤 | 预期结果 | 实际结果 | 状态 | 问题／边界 |
| --- | --- | --- | --- | --- | --- | --- |
| T01 移动／反向／空中控制 | 三端灰盒，角色落地 | D 加速、A 反向、起跳后 D | 渐变速度、先制动、空中可转向 | 三端真实键盘断言通过 | PASS | 原型手感仍待用户体验 |
| T01 长短跳／一次消费 | 三端出生点 | 短按 Space；重置后长按及 repeat | 高度不同，持续按键不重跳 | 最低 Y 相差约 51.78；长按只跳一次 | PASS | 仅当前原型参数 |
| T01 土狼／缓冲 | 三端跨隙路径及出生点 | 离开边缘后起跳；落地前重按／提前过期 | 土狼可跳，缓冲一次消费，过期不重放 | 三端跨隙、缓冲 2 次与过期 1 次断言通过 | PASS | 土狼过期边界另由受控时间测试覆盖 |
| T01 侧碰与支撑边界 | Node 同一 Matter 世界／控制核心 | 悬空贴墙申请跳跃、过期后再按 | 不恢复起跳资格 | 自动化物理测试通过 | PASS | 此边界尚无单独三端 UI 用例 |
| T02 平地／墙／低顶／连续坡面 | 三端同一静态世界 | 行走顶墙、顶头跳、坡面上下行／停留 | 无穿透，上坡保持支撑，静止不滑 | 真实接触断言与上述坐标通过 | PASS | 只覆盖当前几何及速度 |
| T02 实体平台专项／单向平台 | 实体平台已绘制；单向平台未实现 | 未执行完整上下侧专项 | 后续按正式平台规则验收 | 无专项证据 | NOT RUN | 不将平台摆放等同于验收 |
| T03 动态／升降平台 | 未实现 | 未执行 | 后续验证承载与离开 | 无 | NOT RUN | 本次范围外 |
| T04 触发器／检查点事件 | 未实现业务触发器 | 未执行 | 后续验证进入／占用／离开及事务边界 | 无 | NOT RUN | 脚底查询不代表 T04 已通过 |
| T05 已实现用例一致性 | 三端相同核心与配置 | 同一脚本跑移动／跳跃／静态碰撞／暂停 | 规则结果一致 | 三端全部通过，长短跳与静止指标一致 | PASS | 触发器、动态平台及检查点恢复尚 NOT RUN |
| T06 隐藏／最小化输入与物理 | Web 换页；Windows 原生最小化 | 空中按住 Space+D，隐藏后恢复，松键再跳 | 冻结、无追赶、无自动跳跃、无穿透 | 三端 Tick 首帧不变，持有输入清除及新按键通过 | PASS | 检查点恢复及业务控制锁不在本次范围 |

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

## 当前限制

- Web 主包约 325 KB gzip，Vite 有体积提示；尚未做加载优化。
- `npm audit` 报告 electron-builder 依赖链共 6 项 moderate，涉及 minimatch；未强制升级传递依赖。该工具链未装入运行包。
- 未完成正式图标、作者及发行元数据、安装器或签名；当前仅验收 Windows 11 x64 的免安装目录。
- R1 已确认并修复隐藏页面被 Tick 增长就绪条件误判的问题。更早的重启等待超时证据不足，仍未定位；不得仅凭回归通过认定同源或宣称长期稳定。
- D01-R2 的选择器、身份记录与单测已通过；Chrome 与 Edge 定向仍在操作中捕获非预期 blur。Chrome 完整三端回归为 NOT RUN，NAME-05 保持 FAIL，不能据此认定长期稳定性或收口验收。
- 当前角色与静态地形是工程灰盒；未实现单向平台、动态／升降平台、触发器业务、任务、NPC、收藏品、事件事务或检查点。调试重置与最小化恢复都不等于 Checkpoint Recovery；不代表完整 T01–T06 或 MVP-G01–G06 已通过。本任务完成后等待审查，不自动进入下一任务。
