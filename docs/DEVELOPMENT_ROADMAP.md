# 《坡坎之间》开发路线图与执行流程

更新日期：2026-11-15。

名称同步：当前项目名称为《坡坎之间》（CONFIRMED），英文名称未确定，宣传语仍 PROPOSED。依据见[当前名称决策](DECISIONS.md#project-name-pokan-20261115)。本轮只更新名称文档与交接草案，保留 H5-01、D12-A3、D13、MLV 等原任务状态、范围及证据；不代表源码、界面或 Windows 产物更名完成。

用途：开发窗口的统一工作入口，记录开发顺序、当前任务、验收要求和交接进度。后续直接维护本文，不为每个普通任务再创建一份提示词文档。

现行授权：三个窗口采用单任务审查流程。聊天策划提供产品／创意方案，负责人确认必要决策，Work 维护正式设计与本路线图并下发任务，Codex 负责实施、测试和报告；Work 审查后再安排下一项。普通工程细节不要求负责人逐项批准，开发窗口不自行领取下一里程碑。

HISTORICAL：曾有开发窗口依路线图连续推进、完成后自行领取下一项的授权，保留历史来源；现已被最新三窗口单任务审查规则取代。旧任务中类似“可继续／连续执行”的文字不覆盖本页现行模式。完整职责与文档写入边界见 [AGENTS](../AGENTS.md#三个窗口的职责与交接现行)。

## 2026-11-15 H5-01 任务卡：响应式画布与设备输入原型（现行）

状态：`BLOCKED（实现与当前版本 Chrome 自动化完成，H08 真机未执行；待 Work 审查）`。负责人已批准首个受限原型，开发窗口已按本卡实施。这只批准下列边界试制，不把横屏／UI 提案升级为 CONFIRMED，不批准 H5-02—05 或 D13。本任务卡及其提示词是现有 H5-01 的细化，不是新建任务或第二队列。

### 目标、事实基线与非目标

目标：在现有首关中呈现可见的触屏按钮和可用视口布局，键盘／多指触屏共用原 PlayerMotor，完成短距离走跳、NPC 交互／正常关闭、暂停／继续及中断后再输入。以 1—2 天增量实现为目标，不以纯事件单测或设计图代替运行成果。

核对基线：GitHub main、origin/main、HEAD 均为 d0c32c1d55df3dee0b977fed03d3cfdb78ad471a；开始时 AGENTS、DECISIONS、PROJECT_BRIEF、PLAYER_CONTROL_DESIGN、路线图已有修改，比赛 H5 计划、UI 线框文档及三张 SVG 尚未跟踪。须保留并读取实际工作区文档，不能仅用 main 中尚未包含的规划状态推断授权；实施开始如有新提交再核对差异，不自动合并／重置。

源码事实：
- bindPlayerInput 直接把键盘边缘送 core.key，尚无来源仲裁或触屏；core 经原 PlayerMotor／InteractionController 决定动作，PC-01／PC-02 不变。
- bindVisibilityPause 管 hidden 的独立 Token，可见 blur 由输入可用性处理。不能为触屏重建暂停系统。
- 首关 Phaser Canvas=1000×580、Scale.FIT；CSS 使用 100vh、预留 90px 和最小尺寸，缩放后的字号尚未按手机验证。
- Esc 当前正常结束调查／对话，closeInteraction 是既有受控入口；尚无普通产品暂停菜单。
- 入口直接使用 crypto.randomUUID，普通手机访问电脑 LAN HTTP 可能不具备该方法；不能把电脑 localhost 启动成功当真机地址可用。
- 旧 platform-smoke 即使 --web-only 仍有 ASAR 版本清单及历史路由。H5-01 不改该长套件，建立一个小型 Web 专项并复用现有浏览器选择 helper，避免 Electron 产物依赖和错报 D04。

不做：正式角色／C 美术、完整主菜单／结束／日志／音频、完整 A—D 真机通关验收、地图／碰撞／机关调整、平台运动／乘坐算法、MLV／场景切换框架、跨会话存档、新依赖／工具链／引擎或 Electron 打包。

### 原型默认值与未决产品事项

以下只是可调整试制值，不登记 CONFIRMED：
- 保留 1000×580／FIT。触控方向 60 CSS px、跳跃 72、交互 60、暂停命中框 48；实际命中框至少约 48、主要可读信息约 14 CSS px。空间不足时重排／留控件区，不静默把命中框缩到不可用。
- 建议横屏，但仅显示非阻断“建议横屏”提示；不锁屏、不在竖屏禁止游戏或新增 orientation Pause Token。本卡不宣称完整竖屏 UI 已验收，也不取得“竖屏可以不支持”的产品豁免。
- 保留当前 Esc 对话／调查语义；本原型通过明确的 DOM“暂停／继续”按钮操作，不新增全局 Esc 暂停路由。正式菜单和按状态分配 Esc 留 H5-03。
- 手机显示动作按钮，电脑默认键位；保留混合设备键盘和一个明确“触控操作”开关用于原型／模拟测试。该开关只控制本地输入呈现，不新增游戏模式。
- 长文本／整体产品面板重排留 H5-03；本卡只保证当前目标、必要交互提示和可触控“完成对话”可见、不被按钮遮住。

因此当前原型没有必须先由负责人重新选择的产品事项，可在这些限制内交接执行。若开发必须采用竖屏阻断／自动方向暂停、改变 Esc 正常完成语义或删改既有玩法才可实现，则停止，先给推荐方案与影响等负责人确认。

### 文件修改白名单

| 文件 | 允许变更 |
| --- | --- |
| src/platform/web/player-input.ts | 键盘转发改为同一来源聚合入口；保留 A／D／方向键、Space／E／Esc、调试 R 和清理语义；输入框不截获游戏键。 |
| src/platform/web/main.ts | 装配输入／触控／原型暂停桥接与清理，维护当前运行的单一适配器实例；有限 DOM 状态刷新。 |
| src/platform/web/visibility.ts | 仅必要的绑定／销毁协调，不改 hidden Owner／Key／Token 的正式语义。 |
| src/platform/web/style.css、index.html | 画布父容器、动态视口／安全区域与回退、触控 DOM、简易暂停／继续／完成对话按钮、viewport 元数据；不禁用全局浏览器缩放。 |
| src/rendering/phaser/first-level.ts | 仅局部字体／换行／提示与设备呈现，必要的可见布局刷新；不改世界、玩家／NPC 身份、机关位置或业务回调语义。 |
| 可新增 src/platform/web/input-sources.ts | 小型平台侧来源集合／边缘聚合，不建立通用输入引擎。 |
| 可新增 src/platform/web/touch-controls.ts | DOM 控件与 Pointer Events／pointer capture、布局和资源释放；不含移动／跳跃算法。 |
| 可选新增 src/platform/web/runtime-uuid.ts | 只有真机地址需要时加入无依赖浏览器 UUID 提供兼容层，沿用 RuntimeUuidProvider 合同；不改业务 ID 模块。 |
| 新增 tests/h5-input.test.mjs、tests/h5-input-browser.mjs | 输入／布局合同单测与小型生产 Web 专项。可直接复用 tests/browser-selection.mjs，不修改它。 |
| tests/visibility.test.mjs | 仅桥接签名若受影响时补回归，保留所有原断言。 |
| README.md、docs/DEVELOPMENT_ROADMAP.md | 实际入口／操作／证据与本任务实施结果，不改正式决策或自己的审查结论。 |

禁止修改 src/core/**、src/physics/**、其余 Phaser 场景、Electron、package.json／lockfile、Vite／TS／CI 配置、.env／证书、既有长平台套件和无关设计／资产。名单外确需改动先报告 Work；不因“顺手修复”扩大范围。任务执行前再次核对有无其他窗口正在编辑同一文件。

### 必须实现的行为与模块边界

1. 一个运行实例只有一个输入来源聚合器，键盘与触屏都经它送已有 core.key；规范化 A／← 等同动作，来源区分 keyboard code 和 pointerId／控件代次。有效来源 0→1 才 down、1→0 才 up，repeat／重复尾事件不产生新边缘；左右同时按沿原核心规则，不设设备优先级。
2. 支持左／右固定按钮、跳跃 down／hold／up、交互单次按下，多指移动＋跳跃；pointerup、pointercancel、lostpointercapture、滑出、重复释放、旧指针回调、控件关闭／销毁均幂等。游戏动作不同时绑定 pointerdown＋click 各执行一次；按钮事件不穿透到 Phaser 对话／场景。
3. 聚合层只转设备输入，不判地面、跳跃资格、NPC、机关或恢复完成。控制锁中被拒绝的输入不能在解锁后自动补发；不得读写核心私有字段、清 needsRelease 或用计时器反复发送按下。
4. 中断清理区分“有效输入归零”和“证明用户释放”。保持原 PC-02／E 释放门槛，不在 blur／hidden 后发送无条件伪造 keyup 抹掉门槛；取消旧手势后新的合法触摸序列也不能永久失效或必需多点一次才可用。开发者须给出事件顺序和来源状态证据，而非口头声称满足。
5. 暂停按钮使用独立 prototype-menu owner 的稳定请求身份申请 Token，重复打开复用，继续／销毁只释放自身准确 Token；与 hidden／错误／其他暂停并存。暂停前清理本适配器有效输入、保留重新按下门槛；暂停期间不消费动作，不关闭对话／接取任务。
6. 手机“完成对话”只走当前 core.closeInteraction；显示状态从原 snapshot 读取，不另存任务真相，正常完成才接取。取消指针／隐藏／旋转／卸载不调用正常关闭来清理对话。
7. blur／hidden／旋转／触控隐藏／卸载时释放本层来源、解除 capture、移除自绑监听，保留其他来源及其他 owner。销毁幂等、旧回调失效；组件清理不销毁借用的 Phaser Engine，不重写 MLV。Phaser 内部 document 监听另列，不算应用解绑成果。
8. 动态可用视口／safe-area 和回退，保持 FIT 比例；旋转／resize 不重建游戏、不换 Runtime、不重置任务／检查点／位置。旋转清理触控；普通地址栏缩放／桌面 resize 不冒充游戏重开。只对游戏操作区限制 touch-action／默认滚动，对话可滚动，正文／菜单不全局锁死。
9. 至少使当前目标、E／触控交互提示、必要关闭按钮可读；CSS 尺寸以实际显示测量，不以逻辑像素或 DPR 冒充。控件不能遮关键落点，overlay 非按钮区不吞 Phaser 指针。
10. 手机测试入口可使用已有受控 HTTPS 或局域网预览，记录实际 URL，不能把手机 127.0.0.1 指向电脑。若 LAN HTTP 缺 randomUUID，可在可选平台 helper 优先用 native randomUUID，否则以 crypto.getRandomValues 生成正确 v4／variant UUID；两者均不可用明确失败，不用 Math.random／时间戳／固定值，不改 Event／Command／Transaction 序列。
11. 不公开发布／建隧道／修改网络安全或证书来规避测试条件。受控局域网测试仅监听所需服务，结束关闭本任务创建的进程，不终止用户其他浏览器／服务。

UUID 兼容依据：[MDN randomUUID 的安全上下文限制](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)、[getRandomValues 的可用上下文](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)。这只是受限平台能力兼容，不冻结新的最终 UUID 生成方案。指针事件按 [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/) 验证取消与 capture，规范能力不等于每台手机已通过。

### 验收与证据分层（H01—H09）

| 用例 | 可执行验收 | 必须区分的证据 |
| --- | --- | --- |
| H01 来源聚合 | A＋←、键盘＋触屏同动作、多指交错释放、重复 down／up／repeat；只产生必要边缘，无错误松开／双跳。 | 平台纯单测可用命令记录替身，必须明示；不能替代 H03 浏览器／真机。 |
| H02 核心复用／锁 | 用原 PlayerMotor／core 检查一次消费、短按低跳／长按高跳；控制锁中不排队／重放；原 A／D／方向键／Space／E／Esc 不回归。 | 真实核心集成或现有真实 Phaser／Matter 浏览器。不要把已有减速滑行误判为对话必须瞬间位置冻结。 |
| H03 Chrome 可见原型 | 普通首关不靠传送：键盘走跳、到 NPC、触控模式走跳／交互／明确关闭、唯一一次任务链；可见按钮与截图。 | branded Chrome 桌面与 Chrome touch emulation 分栏；真实多指可用 CDP 触摸模拟但标为模拟，不冒称手机。 |
| H04 取消／中断 | up／cancel／lost capture／滑出／重复尾事件、blur／hidden、旋转、控件重建／卸载；旧操作不恢复，新有效操作能用，其他来源不被误释放。 | 注入 DOM cancel 仅为受控事件覆盖；真实切页、真机系统取消与旋转另记，不伪造为真实设备信号。 |
| H05 暂停／对话 | pause＋hidden 多原因；只解除自身；Tick／平台时钟确认暂停后冻结、恢复不追赶；持 Space／E／指针恢复不自动动作；暂停不提交对话。 | 真实 Chrome 后台标签页至少一次；可见 blur 与 hidden 分开。保留旧 run-Jc0SLc FAIL，新报告独立出证据。 |
| H06 布局／旋转 | 桌面 1280×720／1920×1080，模拟横屏 844×390／667×375、一次竖横变化；比例、CSS 字号／命中框、无关键裁切；原 UUID／进度／检查点不变。 | 尺寸只是原型测点，不是最终兼容列表；竖屏只检查非阻断提示与状态保留，不宣称取得竖屏豁免或完整可玩认证。 |
| H07 资源与版本 | 应用 listener／pointer／menu Token 解绑，旧回调无副作用；默认入口／旧实验室键盘不被误接触控；新增 UUID helper 分支／格式和失败路径如实覆盖。 | 不对第三方监听或完整 MLV／跨场景卸载作全面验收；渲染未更新的旧包不能当当前结果。 |
| H08 至少一台真实手机局部操作 | Android Chrome 或 iOS Safari 中至少一台：无键盘走跳、多指、短长跳、NPC 交互／关闭、暂停、切后台／回来、旋转／重布局。 | 记录设备／OS／浏览器、URL、方向／实际 CSS 视口、视频／截图、源码／产物指纹、执行者与步骤；负责人实际操作证据可纳入但须核对版本。 |
| H09 原有回归／范围 | 原单测不删不跳过；Web 生产构建和同版本专项完成；只报告局部原型，不报告手机 A—D 全通或最终双设备／Electron 验收。 | H5-05 才做两设备整关及 Android／iOS 覆盖；另一手机系统未测保持 NOT RUN。 |

分层结论：单测、Chrome 桌面、Chrome 触屏模拟、Android 真机、iOS 真机各列 PASS／FAIL／BLOCKED／NOT RUN。原型功能收口至少需要 H08 的一台真机；两者均无时，允许完成实现／模拟证据，但 H08 NOT RUN、H5-01 功能验收 BLOCKED，不用自动化 PASS 改成全面 DONE。若另一 OS 未测不冒称通过，最终补测留 H5-05。后续可独立工作的视觉任务是否推进由 Work 决定，不自动领取，也不连续纯测试空转。

### 必须执行的命令与报告入口（未来实施，不是本轮执行结果）

~~~powershell
node --experimental-strip-types --test tests/h5-input.test.mjs
npm.cmd test
npm.cmd run build
node tests/h5-input-browser.mjs --browser=chrome --production
git diff --check
~~~

tests/h5-input-browser.mjs 当前不存在，须在本任务中先实现再执行；是纯 Web 专项，不修改 package.json／scripts/test.mjs，不将未知参数传给旧 platform-smoke。应拒绝未知 CLI 参数，task=H5-01、scope=responsive-canvas-and-device-input，必须验证真为生产 dist 入口与 branded Chrome。

专项复用现有 browser-selection helper、现有 Playwright／Vite 依赖；不创建新通用测试框架，不启动 Electron，不要求 ASAR／EXE，不能复制整套 native 长流程。报告写入已忽略的 test-results/h5-01/run-*：按桌面／触屏模拟／真实设备分栏，含实际命令／退出码、全部变更源文件和入口实际 JS／CSS 的哈希、截图／操作时间线、页面错误、非预期中断、进程清理。自动化范围可单独 PASS，真实设备未执行仍 NOT RUN，功能验收缺口明确，不能用一个 overall PASS 遮盖。

设备实际操作入口：构建后可用 npm.cmd run preview -- --host 0.0.0.0 --port 4173 --strictPort 在可信局域网预览，电脑记录实际 LAN IP；仅在自身网络允许时使用，不擅改防火墙，不公开发布。无可达地址／真机即记录 BLOCKED。本轮不启动此服务。

### 实施顺序、风险与停止条件

1. Git／文档／源代码核对，先确定小型来源状态与正常结束／取消路径，补能揭露错误释放、门槛绕过和重复请求的单测。
2. 键盘接同一聚合器，验证不回归；再做 DOM 多指和生命周期清理，不复制运动。
3. 加基本暂停／继续与正常完成对话按钮；动态视口、FIT、实际字号和触控布局；按需补平台 UUID 兼容。
4. 单测／Web 构建→Chrome 生产专项／模拟→至少一台真机局部操作，留完整版本证据与缺口；不要先跑 Electron 或全物理套件。
5. 更新 README／本任务实施事实，输出报告并停止，等待 Work。

核心风险：中断后释放门槛被伪 keyup 消除或新触摸永久无效；键盘／多指错误互释；点击穿透／兼容 click 重复触发；实际小屏字与按钮遮挡；visible blur 和 hidden 混淆；LAN HTTP UUID／地址不可用；无真机而误报验收完成。

必须停止并报告：白名单内不能保持原协议、需改核心／碰撞／任务／已确认控制规则，需实施竖屏禁玩／方向强制暂停或 Esc 变更，需依赖／安全设置／公开发布，或同一问题两轮有效修复仍失败。提交最小复现／日志／版本，不扩为 MLV、换引擎或反复重跑挑 PASS。真实设备暂缺是验收缺口，不是安装新工具／伪造证据的理由。

### H5-01 Codex 执行提示词（本卡交接副本）

~~~text
项目：D:\Workspace\Code_Projects\mountain-city-last-delivery
任务：H5-01 响应式画布与设备输入原型。只执行路线图文首 H5-01 READY 任务卡。
本提示词供负责人转交；Work 本轮未执行开发。完成后等 Work 审查，不进入 H5-02／D13／MLV。

开始核对远端 main、HEAD／origin/main 和 git status；准备基线 d0c32c1。
读取 AGENTS、DECISIONS 的设备／PC-01／PC-02／暂停规则、H5 合并计划第 12 节、
路线图 H5-01 的完整白名单／H01—H09／命令。保留所有已有未提交文档、UI SVG 和代码。
确认无其他窗口同时写同一文件；发现实质冲突先报告，不 reset／覆盖。

目标是在现有首关出现可见触屏控件和响应式画布：
左右、多指移动＋跳跃 down/hold/up、交互、正常完成对话、基本暂停／继续。
键盘与触屏共用原 core.key／PlayerMotor；任务不制作正式美术或完整菜单。

只改任务卡白名单中的 web 输入／页面／样式／HTML、必要首关 Phaser 字号／提示，
可增 input-sources.ts／touch-controls.ts，按需 runtime-uuid.ts，
以及 h5-input.test.mjs／h5-input-browser.mjs、必要 visibility 测试、README 和路线图实施证据。
src/core/**、src/physics/**、其他场景、Electron、依赖／配置、旧长测试套件全部禁止修改。
必须越界时先交 Work，不能复制移动／跳跃／业务或添加新地图／框架。

每运行一个平台输入来源聚合器，keyboard code＋pointerId／代次独立登记。
只在有效来源 0→1／1→0 转发边缘；repeat／重复尾事件不产生新请求；
任何一个来源释放不取消其他仍持有来源。左右同时按保持原规则。
Pointer Events／capture 处理 up、cancel、lost capture、滑出、旋转、失焦、隐藏和销毁；
游戏动作不能 pointerdown＋click 双重触发，overlay 不能点击穿透。

保留 PC-02／E 的先释放再重新按门槛：不在失焦后无条件伪造 keyup 清门槛，
不自动恢复旧 held，不补发锁定时输入，也不让取消后的合法新触摸永久失效。
不读写核心私有字段；给出实际事件顺序和原核心断言。
触屏层不判断能否跳／机关可用或恢复完成；都交原协调器。

暂停经独立 prototype-menu owner＋稳定 Key／准确 Token，重复打开复用，
继续／卸载只释放自身，与 hidden／错误暂停并存。
保留现有 Esc 对话语义，本原型只通过明确 DOM 按钮暂停／继续，
不新增全局 Esc 暂停路由。暂停、隐藏、取消不调用正常完成对话。
触屏“完成对话”只调用原 core.closeInteraction，不能直接改任务进度。

逻辑画布保留 1000×580／FIT，动态可用视口和安全区带回退，不拉伸或重开游戏。
试制建议：方向60、跳跃72、交互60、暂停命中48 CSS px；
主要信息实际显示约14 CSS px，按钮不遮落点，数值可调整且不升为正式决策。
仅显示非阻断“建议横屏”，不锁方向、不禁竖屏、不加方向暂停 Token；
旋转清理触控但保留运行／任务／检查点。完整竖屏策略留负责人确认。
混合设备保留键盘，提供明确触控呈现开关；R 只保留调试。
只限制游戏操作区默认手势，对话可滚动，不能全页禁缩放或重写全套 HUD。

提前核对手机可达 URL 和浏览器能力。必要时平台 UUID helper 优先 native randomUUID，
否则 crypto.getRandomValues 正确生成 v4／variant；两者无则明确失败，
禁用 Math.random／时间戳／固定值，不改核心业务 ID。
可用可信 LAN preview，不公开发布、不改防火墙／证书，不把手机 localhost 当电脑。

按 H01—H09 先测再实现：来源互释／多指、原核心短长跳与单次消费、锁期间不积累、
真实 Chrome 走跳／NPC、cancel／lost capture、真实切页／回焦、暂停多 owner、
旋转不重置、解绑旧回调、实际 CSS 尺寸、原回归。
旧 Web blur FAIL 保留，新专项单独记录；不要因测试采样／正常减速误判或删除保护。

执行：
node --experimental-strip-types --test tests/h5-input.test.mjs
npm.cmd test
npm.cmd run build
node tests/h5-input-browser.mjs --browser=chrome --production
git diff --check

新的浏览器专项先实现再运行；只 Web／生产 dist／branded Chrome，
task=H5-01，scope=responsive-canvas-and-device-input；未知参数拒绝。
复用现有 browser-selection／Playwright／Vite，不跑 Electron、不要求 ASAR，
不修改 package 脚本、不把新参数传入旧平台套件或复制整套原生测试框架。

至少一台真实手机做本原型局部无键盘操作并记录型号／OS／浏览器／URL／视频截图／版本。
桌面 Chrome、桌面触屏模拟、Android 真机、iOS 真机分栏。
没有任何真机则 H08 NOT RUN、功能验收 BLOCKED；可报告实现和模拟完成，
不能标全面 DONE／手机 PASS。另一手机 OS 未测仍 NOT RUN，最终 A—D 双设备留 H5-05。
不要自动进入下一任务或为缺设备连续增加纯测试任务。

遇到核心协议冲突、需新增产品决定／依赖／发布或两轮有效修复仍失败，停止并给复现／日志。
不 Commit／Push／发布，不删除用户文件／重置 Git，不关闭用户已有浏览器或体验服务。
只清理本任务启动的资源。

报告：实际基线／Git、文件与白名单符合情况、输入事件和控制门槛证据、
H01—H09 的 PASS/FAIL/BLOCKED/NOT RUN、实际命令／退出码、源码与产物哈希、
同版本可见截图和操作 URL、真实操作与模拟分层、页面错误／中断／清理、剩余问题。
本任务可见成果是控件与布局；不能宣称正式美术、完整手机主线、最终双设备或 Matter 已验收。
报告后停止，等待 Work。
~~~

### 2026-11-15 H5-01 实施结果

实现和当前版本自动化证据完成，H5-01 功能验收仍为 `BLOCKED`，原因是没有任何真实手机执行 H08。不得把 Chrome 触屏模拟改写为手机 PASS。

- 输入：新增平台侧 `InputSourceAggregator`，键盘 code、pointerId 和控件代次分别登记；同动作只在有效来源 `0→1`／`1→0` 时提交 core 边缘。键盘与触控共用原 `core.key`／`PlayerMotor`，未修改 `src/core/**` 或 `src/physics/**`。
- 触控：新增左右、跳跃、交互、触控呈现开关、暂停／继续和“完成对话”。多指、短长跳、正常关闭对话、Pointer capture、cancel、leave、lost capture、hidden、旋转和销毁均有实现与测试。
- 释放门槛：blur／hidden 清理平台来源但不伪造 keyup；暂停期间的新按下在平台入口拒绝，不形成恢复后自动动作；合法新触摸会先完成旧释放门槛再提交按下。
- 暂停：使用独立 `prototype-menu` Owner、稳定 Request Key 和准确 Token，与 hidden 等原因共存；继续或卸载只释放自身。未修改暂停协议。
- 布局：保留 `1000×580`／`Scale.FIT`；动态可用视口与 safe-area 生效。实际 CSS 尺寸为方向 `60×60`、跳跃 `72×72`、交互 `60×60`，暂停按钮不小于 `48×48`。竖屏仅显示非阻断提示。
- UUID：原生 `crypto.randomUUID()` 优先；缺失时使用 `crypto.getRandomValues()` 生成正确 v4／variant；两者不可用明确失败。

| 用例 | 状态 | 证据 |
| --- | --- | --- |
| H01 | PASS | `tests/h5-input.test.mjs` 6/6；Chrome 多指、别名、键盘＋触控混合通过。 |
| H02 | PASS | 原 `PlayerMotor` 单次消费、控制锁和键盘短长跳回归通过。 |
| H03 | PASS | 生产 `dist`、品牌 Chrome；真实键盘与 Pointer Events 完成首关走跳、NPC 打开和正常关闭。 |
| H04 | PASS | cancel／lost capture／隐藏／旋转／销毁通过；新触摸一次可跳。 |
| H05 | PASS | 菜单＋真实 hidden 两个 Token；隐藏 Tick 冻结，恢复不追赶，无自动动作。 |
| H06 | PASS | 桌面与 `844×390` 触屏模拟的 CSS 尺寸、画布内布局及 Runtime 保留通过。 |
| H07 | PASS | 自绑资源释放和 UUID 原生／回退／错误路径通过；第三方 Phaser 监听另列。 |
| H08 | NOT RUN | 无 Android Chrome／iOS Safari 真机操作。 |
| H09 | PASS | `npm.cmd test` 186/186、`npm.cmd run build` 通过；未运行 Electron 或旧长套件替代真机。 |

实际命令：输入专项 `6/6` PASS；`npm.cmd test` 为 `186/186` PASS；`npm.cmd run build` 转换 36 modules 并成功；`node tests/h5-input-browser.mjs --browser=chrome --production` 的 12 项检查全部 PASS；`git diff --check` PASS。最终专项报告为 `test-results/h5-01/run-2026-11-15T08-08-34-554Z/report.json`，页面错误 `0`、非预期中断 `0`、清理 PASS。

失败历史保留：`run-2026-11-15T08-00-22-828Z` 显示暂停期间 pointerdown 在恢复后形成一次跳跃，修复为暂停期间拒绝按下提交；`run-2026-11-15T08-07-17-899Z` 显示新增“先按住再暂停”测试的发送顺序错误地允许按下在 Token 生效前被消费，改为先等待暂停生效再发送。更早失败报告不删除或改写。最终源码／产物哈希、截图与分层结果见 [README](../README.md#h5-01响应式画布与设备输入原型)。

## 2026-11-15 比赛 H5 电脑／手机补充与合并审查（历史规划门槛，任务状态以文首为准）

负责人已确认比赛 H5 同时支持电脑和手机浏览器，共用 Phaser／TypeScript／核心／首关配置，不复制关卡或业务逻辑；正式记录见 [设备支持决策](DECISIONS.md)。这项设备目标已 CONFIRMED，不再作为 P1 或未来可选项。横屏优先、竖屏提示、固定按钮、DOM overlay、具体 UI／操作实现与排期仍 PROPOSED／TO_VALIDATE，合并细化见 [比赛 H5 计划第 12 节](COMPETITION_H5_MVP_SCOPE_AND_DELIVERY_PLAN.md#12-电脑手机设备ui-与操作适配补充2026-11-15)。

本轮只维护设计和任务规划，不下发可执行提示词，当前没有 READY 开发任务。H5-PLAN-01 继续 WAITING_DECISION；等待负责人审查合并方案后再决定首个 H5-01。D12-A3 保持 DONE（待 Work 审查），D13 原卡和状态不改；MLV 后续仍暂缓，历史 PASS／FAIL 与已有代码保留。设备确认不等于手机功能已实现或本届 Electron 验收豁免已批准。

### Work 技术审查与必须收敛的边界

- 当前平台只有键盘绑定，core.key 是现有输入入口；PlayerMotor／InteractionController、PC-01／PC-02、Owner／Token 与升降平台限制继续复用，不新增移动／跳跃或机关判断。
- 输入原型先加入平台侧小型来源集合／计数：键盘 code＋pointerId，各动作最后一个有效来源释放才上送 up；repeat／重复尾事件不制造新请求。取消、失焦、旋转和销毁清理自身来源，不释放其他来源。
- Space／E 的 up 会清 needsRelease，不能用失焦后的伪造 up 绕过“先释放再按”；原型必须验证取消／旧指针失效、控制锁期间不补发、合法新接触可恢复。具体清理顺序由实现验证，不清核心私有状态。
- 当前首关 1000×580／FIT、CSS 的 100vh／固定上下预留和 Phaser 小字号需重新核对；显示 CSS 尺寸与逻辑像素不同。建议 DOM 触控覆盖，必要局部字号／布局，不复制 HUD 业务信息，不为手机改世界或碰撞。
- 暂停图标请求独立 menu owner，不能模拟 Escape 顺便关闭对话；桌面 Escape 的对话正常完成语义与探索暂停须按 UI 状态互斥路由。横屏提示若获批准，其暂停 owner 也只释放自身。
- 真实手机须有可访问的合适安全地址；手机 localhost 不是电脑，现有 loopback／crypto.randomUUID／资源路径要及早核对。不得为测试关安全功能、擅自公开发布或改网络安全设置。
- 新增设备会压缩美术缓冲，先做一个有可见按钮／布局和真实操作证据的输入原型，紧接 C 切片，不串联多个纯架构／测试任务。

### 唯一候选任务顺序（PROPOSED，全部未下发）

| 顺序／编号 | 当前状态 | 范围／可见交付 | 边界与窗口建议 |
| --- | --- | --- | --- |
| H5-PLAN-01 | WAITING_DECISION | 合并范围／设备／UI／输入规划，负责人审查横屏方案和任务范围。 | 当前只文档；电脑／手机目标本身不再重复请求确认。 |
| H5-01 | READY（受限原型，负责人转交执行；不冻结产品提案） | 响应式画布＋固定左右／跳跃／交互触控、必要对话关闭与简易暂停／继续；桌面与手机布局截图、按键／触控证据。 | 现有灰盒，不做正式美术／完整菜单；来源隔离、多指、短长跳和取消清理；11-16—17，1—2 天。 |
| H5-02 | PLANNED（PROPOSED） | C 吊脚楼可玩视觉切片和统一角色；同一键盘／触屏输入，真实可操作。 | 原 H5-VIS-01 映射至此；不改碰撞、谜题或机关摆位；11-18—19。 |
| H5-03 | PLANNED（PROPOSED） | 主菜单、HUD／E／手机动作提示、对话、暂停和完成／标题的双设备基础 UI。 | 原 H5-UI-01；不做完整日志／纪念册、不复制核心；11-20—21。 |
| H5-04A | PLANNED（PROPOSED） | A 解放碑／街巷＋B 入口全景／游客／唯一线索的视觉推广。 | H5-04 阶段首个 1—2 天子任务，原 H5-VIS-02；11-22—23。 |
| H5-04B | PLANNED（PROPOSED） | D 下层江岸／桥梁倒影、平台表现、四区风格统一。 | H5-04 下一个子任务，原 H5-VIS-03；11-24—25。 |
| H5-04C | PLANNED（PROPOSED） | 同一首关 A—D、错误／恢复、乘坐控制和最终流程收尾，只修实际 H5 阻断。 | 原 H5-FLOW-01；11-26／必要缓冲，不扩主线或隐藏环路。 |
| H5-05（D13 比赛验收候选映射） | PLANNED／未启动，D13 范围调整待审 | 桌面 Chrome＋Android Chrome／iOS Safari 按实际设备分别验证 H5-G01—G10 和 M01—M11。 | 不是第二份最终验收队列，不取消原 D13 的历史范围；11-27—29。 |
| H5-DEL-01 | PLANNED（PROPOSED） | H5 产物／运行说明、作品说明和不超过原通知要求的演示材料。 | 11-30 起，12-01 内部候选；发布／投稿另获授权。 |

H5-04 是内容阶段标识，实际每次只下发 A／B／C 中一个子任务，不并行领取。旧 H5-VIS-01／02／03、H5-UI-01、H5-FLOW-01 是被映射的候选历史，不是可独立领取的第二队列。日期不代表自动开工或完成承诺；新增手机后 P1 优先退让，不擅自把手机再次降为选做。

### H5-01 的受限原型建议与验收边界

拟修改平台输入／页面装配／CSS／HTML与必要局部 Phaser 字号／提示，增加最小触控桥接及对应测试；不改 PlayerMotor、Matter、任务／事务、快照／恢复／暂停算法，不接 MLV、新地图或依赖。具体白名单和完整提示词等待审查后生成。

首项只证明已有首关可通过触屏移动、短／长跳、多指、交互并明确关闭对话，基本暂停／继续、输入取消与回焦、旋转／控件销毁安全；完整美术在 H5-02，完整产品 UI 在 H5-03，手机 A—D 全通在 H5-05。原型按各自范围验收，不能用局部交互 PASS 宣称手机整关已完成。

每任务须交付：同版本截图／可见变化、浏览器入口、实际操作结果、相关测试、完成／未完成和版本指纹。H5-01 的可见变化是触控控件和布局，桌面保持键盘不回归；如果只交事件单测、没有实际页面控件和操作，不达目标。H5-02 必须真正出现角色与山城美术，不延续灰盒外观。

### 真机矩阵、历史 blur 与阶段门

计划第 12.6 节 M01—M11 覆盖桌面键盘、无键盘手机操作、多指／多来源、短长跳、up／cancel／lost capture、失焦／隐藏／旋转、对话／平台／暂停、实际 CSS 命中尺寸／字号、两设备完整 A—D 和证据版本。新增项目本轮均 NOT RUN。

桌面 Chrome、Android Chrome 真机、iOS Safari 真机分别列结果、机型／OS／浏览器、视口方向／安全上下文和实际操作记录；没有真机就 NOT RUN／BLOCKED，桌面设备模拟必须单列，不得冒充真机 PASS。可先完成模拟实现证据并记录缺口，由 Work 判断独立的 C 视觉工作是否可推进；不因工具缺口无限测试空转，但最终不宣布未实测设备通过。

历史 run-Jc0SLc 的 Web blur FAIL 保留，已有日志指出前台切到 ChatGPT，并非已证实应用内崩溃；H5-01 必须把原桌面输入／切页／回焦及手机取消／旋转一起核对。复现粘键、自动起跳／交互、误提交或无法恢复再安排最小修复，不删除保护，不以新增触屏忽略旧 FAIL，不重跑 Electron 三端替代手机证据。

### 状态与交付限制

本次新增 CONFIRMED 仅为负责人明确的设备目标；横屏优先和竖屏不可完整游玩的例外尚待负责人确认，不自动排除竖屏验收。固定方向按钮／尺寸、暂停路由和 DOM overlay 为可实施建议，不冻结工程参数。音效未制作时不得做假开关，音频内容仍 P1；R 只保留调试用途，不进入普通手机／电脑说明。

本轮同步设备决策、概述／协作和旧输入范围，并合并比赛计划／路线图；未修改代码、测试、依赖、碰撞或资产，未运行游戏／真机／构建，未启动 Codex、D13 或 MLV，未 Commit／Push。完成后等待负责人审查，再决定首个 H5-01。
## HISTORICAL：2026-11-15 设备补充前的 H5 瘦身规划与候选顺序

本轮仅完成 [比赛版范围与交付计划](COMPETITION_H5_MVP_SCOPE_AND_DELIVERY_PLAN.md)，状态 PROPOSED／待负责人审查。当前没有新下发的 READY 开发任务，不启动 Codex、D13、MLV-01A／R1／B，不从下方旧提示词继续领取。新的任务顺序和 H5 验收建议由负责人审查后，再由 Work 一次下发一项。

负责人本次明确的规划输入：普通 H5 浏览器游玩，最快交付现有可玩游戏，保留大型半开放长期方向，比赛在 12 月上旬；保留 Phaser／TypeScript／Vite／共享核心和当前 Matter 路线，不迁移、不新增依赖或通用加载架构。整体 P0／P1／P2、比赛版 Windows 验收例外及 D13 调整仍为待审方案，不在本轮改写 CONFIRMED。

### 核对事实与历史任务处置

开始核对时 main=731ac55；期间远端／本地更新为 d0c32c1d55df3dee0b977fed03d3cfdb78ad471a，已读文件字节未变化。该提交不是 Work 执行的；本轮最新分析基线为 d0c32c1。已保留未跟踪首关 UI 线框文档与三张 SVG，不据文件存在认定 UI 已实现。

本轮临时预览已有 dist，在 Chrome 首屏看到了 A／B、角色几何占位、HUD 和操作提示，服务已关闭；没有运行游戏验收、按键通关、新构建或 Electron 测试。源码显示 C 层次／装置／平台、对话与完成卡已有；正式贴图／动画和产品主菜单／暂停／结束导航仍是主要缺口。详细证据与资产盘点见新计划第 2 节，不能把预览视为当前完整版本 PASS。

| 事项 | 最后执行／审查事实（保留） | 比赛冲刺安排 |
| --- | --- | --- |
| D12-A3 | DONE（待 Work 审查）；原 SA 范围、历史 PASS／Web blur FAIL 不变。 | 先完成现有范围审查及 H5 相关差异核对，不为收口重跑 Electron 三端或扩张验收。 |
| D13 | 尚未启动；原“MVP 双端验收与交付”卡保留。 | 提议以新计划 H5-G01—G10 作为本届适用范围；原 MVP-G06 双端一致性另列未覆盖／本届豁免建议，负责人批准后再同步，不启动。 |
| MLV-01A | 已实施；原父项 BLOCKED 与后续 R1 交付记录保留，尚未 Work 收口。 | 后续架构审查／推广暂缓到比赛后，不回滚或删除已提交源码。 |
| MLV-01A-R1 | 开发方已交付 DONE（待 Work 审查），记录有 8/8、180/180 和构建 PASS。 | 停止继续下发纯架构修复；不自行追认审查通过，不把修复前 FAIL 说成当前仍必现。只在真实影响 H5 的路径安排最小处置。 |
| MLV-01B | 原 PLANNED。 | 比赛后再决定，当前不做第二布局 GUI、场景切换框架或三端资源套件。 |
| ARCH-01—10 | 研究／验证矩阵保留。 | 不作为比赛版前置和验收条件。 |
| V1.2／V1.3 | 原视觉计划与未执行事实保留。 | 仅作为 C 切片按需参考，不另做大型前置工程。 |
| 首关 UI 线框 V0.1 | PROPOSED，本地文档及 SVG 真实存在。 | 参考 HUD／对话结构；不自动确认键位、新日志或功能范围。 |

### 比赛版单任务顺序（全部待审、未下发）

任务只在本路线图登记；新计划解释范围与理由，不形成第二队列。下表为候选顺序，不允许按日期自动连续实施。

| 顺序／候选编号 | 状态 | 目标与可见交付 | 预计窗口与门槛 |
| --- | --- | --- | --- |
| H5-PLAN-01 | WAITING_DECISION | 本轮两份文档，负责人审查 P0、平台例外、任务顺序与日期风险。 | 11-15—11-16；当前无代码任务。 |
| H5-VIS-01 | PLANNED（PROPOSED） | 现有首关 C 吊脚楼视觉切片＋可用角色：木构剖面／木廊／灯光／前后景，实际 Chrome 游戏截图与走跳操作。 | 11-17—11-19 窗口，1—2 天实现＋修正余量；先批准本计划与切片范围，不改碰撞／机关摆位／业务。 |
| H5-VIS-02 | PLANNED（PROPOSED） | 复用模块制作 A 解放碑／街巷和 B 入口全景／游客／唯一线索。 | 11-20—11-21；先审 C 质量，不承接额外支线。 |
| H5-VIS-03 | PLANNED（PROPOSED） | D 下层江岸／桥梁倒影、升降通路表现及四区统一。 | 11-22—11-23；保持 D 低于 C3、真实路线可走。 |
| H5-UI-01 | PLANNED（PROPOSED） | 最小主菜单／HUD／对话／暂停／完成结束；截图体现开始和结束，不重做核心。 | 11-24—11-25；先核对暂停与对话关闭意图、重开与运行内进度边界。 |
| H5-FLOW-01 | PLANNED（PROPOSED） | 正常键盘完整主线、线索／机关反馈、失败恢复与已有乘坐控制收尾；仅修真实 H5 阻断。 | 11-26 及必要缓冲；不用时间表强行扩范围。 |
| D13（拟比赛 H5 范围） | PLANNED／未启动，范围调整待审 | H5-G01—G10、当前完整通关、Chrome 焦点／输入、实际静态产物；不另建重复最终验收任务。 | 11-27—11-29；需负责人确认本届验收例外，保留原 D13 与旧结果。 |
| H5-DEL-01 | PLANNED（PROPOSED） | H5 候选产物、键位／运行说明、作品说明书和演示准备。 | 11-30 起，12-01 内部候选；发布／投稿另获授权。 |

P0 为角色／走跳、连续 A—D／多层建筑、游客对话／委托、唯一线索／机关、平台路线、D 拍摄完成、运行内恢复、基础 HUD／对话／暂停／开始结束、H5 通关。
P1 只在有余量和单项批准时考虑可选路线、少量文化收藏、简单日志／纪念展示、音频和更多动画；不把 C-H／J2／J3 自动加入 MVP。
P2 为多章多关、城市地图、完整纪念册、复杂支线、MLV／通用加载、Tiled、跨关／跨会话存档与插件。
大型半开放仍有效；单主线不等于只拉长一条走廊。具体可玩面积／局部自由与新连接仍需空间审查，不凭美术背景宣称大关卡已完成。

### 首个视觉建议与 Web 风险

H5-VIS-01 只做现有可达 C 路线和角色表现：美术与碰撞分离、可站面／落点清晰、吊脚楼辨识、暖色夜景、前景不过度遮挡。交付须有同版本游戏截图、H5 地址、真实按键结果、相关测试、已完成／未完成和源码／资源来源。图稿／纹理建议不等于游戏成果；首轮没有可见变化须说明并判定目标未达。具体实施提示词等负责人审查后再生成。

原 run-Jc0SLc Web FAIL 为真实 blur，日志 seq 27 显示前台切到 ChatGPT；不能据此直接判应用崩溃或把历史 FAIL 清零。输入适配已有可见性＋焦点门槛，隐藏暂停另用 Token；新计划第 7 节记录完整边界。本轮未做焦点功能验收。把 Chrome 真实操作／切页恢复核对并入首个视觉任务；若出现粘键、自动跳跃／交互、任务误提交、无法恢复或后台追赶，再单独安排最小修复，不为消除测试报错删保护或重跑完整三端。

H5 验收只以实际执行证据标 PASS／FAIL／BLOCKED／NOT RUN；新计划 H5-G01—G10 全部待执行。生产资源路径／安全上下文、开始→完成流程、永久／临时恢复与默认画面属于比赛关键路径，不要求先完成所有技术矩阵。现有普通 UI、C3 机关位置与新乘坐规则的差异仍按原状态核对，不借本次计划自动升级。

### 日期与交付材料

按负责人要求保留 2026-12-01 为内部最早封版目标。仓库校内通知写 2026-12-06 邮箱投稿截止、报名表及 PPT／PDF 说明书为必备、可运行包与不超过 3 分钟视频为加分材料；尚未核实后续改期、H5 投稿／访问环境或手机要求。两种日期不得混写成同一官方截止。多余时间优先修复／体验优化，不重开架构或扩功能。

本轮只写规划和路线图；不改 AGENTS／DECISIONS／PROJECT_BRIEF 的现有双平台正式约束，不修改源码、测试、依赖、素材或碰撞，不迁移引擎，不启动开发、D13 或 MLV，不 Commit／Push。等待负责人审查，之后才安排首个可见成果任务。

## HISTORICAL：2026-11-15 Work 审查：MLV-01A BLOCKED，MLV-01A-R1 READY

现行结论：MLV-01A 暂不收口，状态 BLOCKED；下一项只实施 MLV-01A-R1。MLV-01B 保持 PLANNED，D13 不启动。下方原 READY 授权、开发方 DONE／PASS 和既有审查草稿保留历史，由本节更新当前交接状态，不改写其执行结果。

### 本轮独立核对与复验

- HEAD 仍为 `731ac55ccc1a58e659801fdb783127b56a4f09dc`。开始时有 5 个已跟踪修改及 3 个未跟踪新增，均保留；Work 只修改本路线图。
- 已读实际定义校验、装配／销毁、物理适配器全生命周期差异、core 终止包装、新测试及既有首关业务链，不仅依赖开发报告。
- 开发报告所列 6 份源码／测试 SHA-256 与当前文件全部匹配；ASAR `2F0C5A5C02FB36B95841C809ED02AA71874FFECB0682E1E608CA610F0EB39FB8`、EXE `464FDAC7CDC15510AF555D3284FD2C94C27850270438B83F3D8DDBE8FDB36BDD` 也匹配。
- 本轮实际重新执行 `npm.cmd test`：PASS，退出 0，178/178、0 fail、0 skipped；类型检查及 Electron Main 编译通过。这不证明新销毁边界完备。
- 本轮使用无文件写入 Node 脚本、真实 Matter 和首关真实业务链补充两项回归：FAIL，退出 1，失败 2 项，见下表；没有更改源码或测试文件。
- 本轮未重建生产包、未启动 GUI／平台套件；开发方构建 PASS 是已有记录，产物哈希匹配不代替本轮构建执行。MLV GUI／V05-B 仍 NOT RUN。

| 发现 | 位置／实际复现 | 影响 |
| --- | --- | --- |
| P1：运行事务被成功销毁 | `src/core/graybox.ts` destroy 只检查事件、捕获／恢复锁及 Pause Token，没有检查 goalRoute／gameplay 的业务事务。真实 FirstLevelRuntime 接取委托后推进 Tick 1：phase=verifying、transactionStatus=running、原 Event 已退役、目标数 1、Result Event 尚无；此时装配 destroy 实际返回 destroyed，World Body 从 14 变为 0，期望 blocked。 | 已写业务未完成 verify／终态／结果闭环就被终止，无法继续完成，违反 A“无活动业务事务才销毁”的前置。Inbox 空不等于事务静止。 |
| P2：终止包装伪造释放成功 | `src/core/graybox.ts` lifecycleView.release 在 coreDestroyed 时无条件返回 released。上述销毁后以全新错误 Owner＋不存在 Token 调用，实际 released，期望 rejected。 | “不变更暂停状态”不等于“所有权验证正确”，不得用假成功绕过准确 Token＋Owner 和重复释放语义。 |

R01 的实际复现接线为 `createPrototypeLevelAssembly(M, FIRST_LEVEL_DEFINITION, { coreOptions: { uuidProvider, extraEventTypes: FIRST_LEVEL_EVENT_TYPES, createGameplayRuntime: context => new FirstLevelRuntime(context) } })`；先 frame(0)，通过该真实 runtime 的 talkToNpc action 提交委托，再 frame(fixedDeltaMs)。这是纯核心／真实 Matter 审查，不是人工对话或 GUI 验收。记录身份为原 Event／Command／Transaction=1/1/1、Result=null；不改变业务规则。

### MLV-01A-R1 任务登记

| 任务 | 当前状态 | 范围与门槛 |
| --- | --- | --- |
| MLV-01A | BLOCKED（Work 审查发现两项缺陷） | 原实现和 178 项结果保留，R1 经 Work 审查后再决定收口；不能直接进入 B。 |
| MLV-01A-R1 | READY（本轮 Work 下发） | 仅修复活动业务链的销毁准入及终止后的 Release 所有权／幂等返回，补真实回归。属于已批准 A 范围内的普通缺陷修复，不新建取消／跨关协议。 |
| MLV-01B | PLANNED | A 及 R1 经 Work 审查后再安排；当前不实施。 |

### MLV-01A-R1 Codex 实施提示词（现行）

```text
项目：D:\Workspace\Code_Projects\mountain-city-last-delivery
任务：MLV-01A-R1，READY。只修复下面两项，不进入 MLV-01B／D13。
基线 HEAD：731ac55ccc1a58e659801fdb783127b56a4f09dc。
开始检查 git status／diff，保留 A 的全部未提交源码、测试、README 和 Work 路线图修改。
先读 AGENTS、路线图文首本轮审查、A 已批准边界、DECISIONS 中暂停令牌协议。
核对 graybox、level-assembly、goal-route-runtime、FirstLevelRuntime 与现有真实测试。

缺陷一：
core.destroy() 不能仅靠 Inbox／Pending／Processing 判断无活动业务。
真实首关委托 Tick 1 已 apply，原事件已退役，事务仍 running／verifying，结果事件未创建；
此时现在返回 destroyed 并清除 14 个 Body。应返回 blocked，core/world/Engine 保持可继续工作。

补充最小、可信、只读的业务静止判定。
覆盖 core 自有 goalRoute 和装配进去的首关 gameplay 业务流程；
检查真实事务与结果收尾，不使用“目标已完成”或“队列空”冒充静止。
可以在现有 runtime 接口增加小型只读销毁准入合同，不建立通用管理器或新注册框架。
运行中、待业务重试／恢复、terminal-pending、结果尚未完成的已开始链路不得被当作闲置。
若无法可靠判定就保守阻断并给出原因。
未开始的 idle、真正完成且安全收尾的成功／失败链路不得永久阻止正常销毁。
不发明取消或强制提交；拒绝销毁后继续原 frame，允许原事务按既有合法阶段完成，
原 Event／Command／Transaction／Result 身份与目标／奖励／效果计数保持。
装配层收到 blocked 必须立即返回，不 dispose world、不 clear Engine、不置终止标志。

缺陷二：
终止后的 lifecycle.release 不得无条件返回 released。
保持准确 Owner＋Token 校验：错误 Owner／未知 Token 为 rejected；
已合法释放 Token 的正确 Owner 重复释放保持 already-released。
销毁后旧 acquire 不分配令牌，旧 release 不改变 pauseCount／paused、不触发模拟恢复。
优先复用原验证逻辑或做等价受控包装，不修改 lifecycle.ts 的协议和算法。
不能通过删除断言掩盖返回语义；旧 V05 错误期待 released 的断言应更正，保留无副作用断言。

允许修改：
src/core/graybox.ts；
必要的小型只读接口／判定：src/core/goal-route-runtime.ts、src/core/first-level.ts；
src/physics/matter/level-assembly.ts 仅在需要保证 blocked 不清理时修改；
tests/level-assembly.test.mjs 及直接相关的现有测试；
README.md 和本路线图当前任务的实施证据。
不改物理适配、玩家、模拟、事件／命令／事务、快照／恢复算法，不改依赖／配置或正式决策。
若这些限制内无法修复，报告最小阻塞，不扩大范围。

先红后绿：
R01：真实 FirstLevelRuntime 委托 Tick 1，事务 running／verifying、原事件退役且无结果。
调用 core／assembly 的 destroy 均 blocked；
断言 World Body、Engine、Tick、进度、业务身份与终止标志不被销毁调用改变。
继续推进，原链只完成一次且收尾后允许正常销毁，再销毁幂等。
R02：用既有故障注入构造业务等待／terminal-pending 等真实非静止路径，
并验证 core 自有 goalRoute 与首关 gameplay 都被覆盖；不伪造快照状态；
阻断不强制恢复、不创建新身份、不重复业务，正常静止路径不被误锁。
R03：正常释放有效 Token 后销毁，保存旧 acquire/release 引用；
正确 Owner 重复原 Token 为 already-released，错误 Owner 与未知 Token 为 rejected；
pauseCount、paused、Tick、物理步、业务／输入不变。
R04：保留原六项 V01—V06 和全部有效现有测试；
修复不能改变双 Engine 隔离、外部 sentinel、逆序清理、重复销毁或首关业务语义。

执行并记录：
node --experimental-strip-types --test tests/level-assembly.test.mjs
npm.cmd test
npm.cmd run electron:build
git diff --check

本次不新增平台分支、不跑 GUI 长套件；GUI／三端新增流程／V05-B 保持 NOT RUN。
不能以旧产物哈希或构建成功冒充新宿主运行。
同一问题两轮有效修复仍失败，保留复现／日志／版本交 Work，不反复挑 PASS。
不 Commit／Push／发布，不删除用户文件或重置 Git，不操作已有体验窗口。

完成报告：实际基线、变更文件、修复前 FAIL 和修复后 R01—R04、
命令／退出码／真实结果、销毁前后资源与身份／计数证据、版本哈希、剩余问题。
状态只使用 PASS／FAIL／BLOCKED／NOT RUN。父项 A 不自行改为审查通过；
报告后停止，等待 Work 审查，不自动开始 B／D13。
```

## 2026-11-15 MLV-01A 批准与下发

负责人在本会话明确回复“已经批准了”，要求提供提示词交开发窗口执行。Work 据此将 MLV-01A 从 WAITING_DECISION 转为 READY，并以下方完整提示词单项下发；批准不表示已经实现、测试通过或正式架构冻结。只实施受限描述、全生命周期物理配置化、无 DOM 装配与真实 Matter 验证。MLV-01B 保持 PLANNED，D13 不启动，D12-A3 原状态／原验收／历史证据保持不变。

此前“未批准／不得实施”仅为 2026-11-14 审查时状态，由本记录取代；既有草稿继续保留。开发窗口开始前检查 Git，保留本路线图全部未提交修改；完成后报告并等待 Work 审查，不自行推进下一项。Work 本次只同步授权和提示词，不执行开发或游戏测试，不 Commit／Push。

## 2026-11-14 本轮 Work 复核补充：D12-A3 与 MLV-01A／B

本节为本轮现行审查／规划入口，优先于下方开始前已存在的未提交草稿。本轮只修改本路线图；已获负责人同意在保留草稿基础上补充，不覆盖其他文件。核对 GitHub main 与本地 HEAD 为 `731ac55ccc1a58e659801fdb783127b56a4f09dc`；完整规划中的 `2547b32` 仍是当时分析基线。

D12-A3 原状态保留 **DONE（待 Work 审查）**，原 SA01–SA05、D13 的任务／依赖／验收均不改动。下面既有草稿中的“Work 审查通过／已收口”作为原稿建议保留，不作为本轮状态迁移；“重新执行 172/172”是原稿记述，本轮未执行 npm、构建或游戏测试，不能借用为本轮 PASS。HISTORICAL：2026-11-14 审查时 A 为 WAITING_DECISION；负责人已于 2026-11-15 批准，现行授权见文首记录，B 仍仅保留依赖规划。

### D12-A3 本轮 Work 审查结果

审查已完成实际 Git 差异／当前源码、现有测试断言和历史证据核对，而非只采信文字报告。建议原 SA 功能切片可按历史同应用版本证据继续评审；当前未发现需扩大本任务修复范围的新增功能阻断，但不宣称本轮全量运行 PASS，也不代替负责人对下述证据边界的审查。

| 审查项 | 本轮核对结果与限制 |
| --- | --- |
| SA01 实际空间 | 已读 `726d337 → eafa089` 的实现差异和当前共享配置、Matter／Phaser 使用；C1／C2／C3 地形逐层下降、D 上缘 620 低于 C3 上缘 500，当前首关空间／锚点单测仍保留真实 Body 与支撑断言。查看了现有 C3／D 历史截图；不是本轮人工游玩或按图验收。 |
| SA02–SA04 主线／恢复／暂停 | 现有 `checkFirstLevel` 和 `run-uz0UtE` 各端事件记录包含 A／B、错误与正确操作、任务后／机关后恢复、C 中下层、乘梯到 D、完成及 R 保留；冻结／恢复 Tick 为 2151→2151、2164→2164、2168→2168，目标／奖励／效果 3/0/3。只支持该定向范围，不升级为全部首关或完整 MVP。 |
| SA05 历史三端版本 | [run-uz0UtE](../test-results/platform/run-uz0UtE/report.json) 为三端历史 PASS，三个进程退出 0、清理失败为空；36 项哈希中 35 项与当前一致，差异仅是 `tests/first-level.test.mjs` 的文件版本。当前应用源码、平台脚本、浏览器路线和 ASAR 与报告匹配；不把旧单测文件当作当前文件运行证据。 |
| 最新复跑 | [run-Jc0SLc](../test-results/platform/run-Jc0SLc/report.json) 36 项哈希均匹配；Chrome Web 在布局／窗口阶段因真实 blur 为 FAIL，两个 Electron 环境 PASS。原报告与失败状态保留，不仅凭历史 PASS 消除此项失败，也不据此证明长期稳定。 |
| 单测／构建 | README 记录过 172/172 与构建 PASS；本轮仅核查文件／历史记录，未重新执行。原稿“本轮重跑”不作本轮证据。本轮新增运行测试为 NOT RUN，不把静态代码审查替代实际测试。 |
| 证据完整性 | 两份 report.json SHA-256 分别为 `9D985EFD4DF5C1EDED05D2D1A7BE840AF84FAAE3130355063B0440159ED4DE9A`、`D8A7F93AAAA819FDADE6906466EBC254F6CE0544D8E18FFF94D190B87EA5B354`，本轮只读复核。 |
| 不覆盖 | 新乘坐控制八条／V2 机关下移／完整空间图稿／最终美术／最终 Matter／跨会话存档／完整 MVP／Edge 与人工长期手感；不追认这些内容已在 D12-A3 实现。 |

### 拆分决定与审批门槛

采用 A／B 拆分，取代原合并实施建议。A 专注受限描述、全生命周期物理配置与无 DOM 的共享核心装配；B 才接 Phaser、调试入口、应用监听和三端。A 不改现有 Phaser／Web／Electron 入口；其新装配函数先由真实 Matter 测试使用，生产宿主接入是 B 的工作，不虚报已接线。

负责人已于 2026-11-15 批准收敛后的 A 阶段，Work 将唯一任务登记转 READY 并下发下方提示词。A 实现后还须 Work 审查，B 不自动启动。D12-A3 原状态及 D13 原任务／验收不改，当前不启动 D13。

### MLV-01A 收敛后的数据与文件边界

- `PrototypeLevelDefinition` 只包含当前垂直升降平台物理原型实际需要的布局、稳定身份和 `SnapshotScenario`；不是通用场景 schema。A 只用一个初始有效检查点／备用锚点，不新增正式检查点网络或触发玩法；捕获数据合同测试使用受控固定步边界及显式 scenario 的现有 API，不冒充运行中事务捕获接线。玩家尺寸、脚底形状、重力、支撑阈值、碰撞类别及移动参数继续取原有共享原型，不开放成地图可任意覆盖的参数；只将布局相关身份／坐标改为实例数据。
- `levelId` 必须与所有 checkpoint 配置一致，checkpointId 非空唯一、default 存在且有效；spawn 的 x／y／facing 与初始 checkpoint anchor 一致，备用锚点保持原顺序。升降对象与 registry 一一对应，只允许适配器已支持的 vertical、stateVersion、schemaVersion；不因类型定义可写 horizontal 就声称该适配器支持。重复／不支持类型与版本在创建 Engine／Body 前拒绝；不得套用首关默认值掩盖缺项。
- 测试布局的 levelId、checkpointId、平台／地形／门／失败区／探针等布局对象身份、路线效果 ID 与 Runtime Instance ID 均独立；UUID 使用同一种注入式生成服务但每实例取得不同值，不必创建第二套 UUID 算法。调查只读，无首关 actionId／任务／奖励／进度写入，不实例化 FirstLevelRuntime。
- 独立测试路线效果只测试物理适配器的 `setPermanentEffect` 与一致性校验合同，不为测试给 `progress.ts` 增加业务白名单或伪造目标／事务成功；完整恢复用独立、空进度的闭合路线基线验证。首关真实永久效果重施继续由原首关回归证明，两类证据分开。
- 首关所有现有数值、导出身份／默认值及物理算法保持；允许默认定义作为向后兼容入口，但实例初始化后不得继续读取首关布局常量。共享算法常量不是“首关配置串用”，不能为通过搜索断言而复制／改写 PlayerMotor。
- 建议新增 `src/core/prototype-level.ts`、`src/physics/matter/level-assembly.ts`、`tests/level-assembly.test.mjs`。允许修改 `src/core/first-level.ts`（描述及兼容导出）、`src/physics/matter/first-level-world.ts`（数据来源／资源账本）、`src/core/graybox.ts`（仅终止门槛）、必要的现有首关／玩家物理单测。README 只补实际证据；禁止修改 snapshot／recovery／player／simulation／lifecycle／progress／事件事务算法、宿主与渲染入口、依赖和构建配置。确需越界即报告，不自行扩展。

### 全生命周期核对表（A 必须逐项给证据）

| 路径 | 当前需要解除的首关绑定／A 验证 |
| --- | --- |
| 构造／出生／全 Body | 当前字段初值、构造和地形循环读 FIRST_LEVEL_*；需在构造器前校验并以同一实例定义初始化，默认首关等价。 |
| 平台运动／支撑承载 | 当前周期／端点、previousSupport 与支撑速度判断读首关 lift；用测试配置跑完整周期并核对位移、支撑、时钟，算法不改。 |
| 永久效果 | 当前开路效果匹配首关进度 ID；测试独立 effect 可应用、重复应用不反转，首关 effect 不得误开测试门。 |
| 冻结／捕获／应用 | 当前 exact registry／objectId 固定为首关 lift；以独立 registry 验证 owner、逻辑状态及旧／跨布局对象拒绝。 |
| 恢复重建／世界验证 | 当前 Body 尺寸／label 与永久路线期望读首关常量；重建的新 Body 使用测试定义，旧 Body 移除，状态、版本、世界与路线一致。 |
| 锚点验证／放置 | 坐标、失败区和探针身份按实例；共享玩家形状／支撑算法不变，验证后安全放置、不制造触发进入。 |
| reset／failureZone／diagnostics | reset 回本实例出生和平台初态，失败区／平台尺寸／support／标识报告来自同一实例；不跳回首关坐标。 |
| checkpoint 占用接口 | 实际 CheckpointTriggerRuntime 的 #assertStates 即使 disabled 也要求固定两条实验室记录，不能直接返回空数组／自定义 trigger ID。A 保持既有禁用兼容槽；这些槽没有测试地图 Body、不会触发或替代独立有效 checkpoint，兼容债务明确记录，不宣称触发器已关卡化。 |


新增接线限制：`SnapshotCaptureRuntime` 当前在锁的关卡、checkpoint 查找和冻结 registry 上仍使用实验室常量。A 不改其算法或数据接线、不在测试地图开放 requestCheckpointCapture，不通过首关／实验室 checkpoint 冒充独立捕获。首次快照与正常失败恢复已支持传入独立 scenario；它们和直接适配器数据合同是 A 的验证对象。运行中事务捕获、触发器定义的真正关卡化仍 TO_VALIDATE；若负责人要求它们也是 A 必做，则本卡需重新限缩／审查，不能自行追加核心模块修改。

### 资源所有权、终止与 V05 分层

| 层 | 所有权与清理责任 |
| --- | --- |
| A 的无 DOM 装配函数 | 每次创建独立 Engine／World、适配器、core；只拥有自己创建的 Engine，关闭顺序为停止接入并终止 core → 适配器清理 → 清理自身 Engine 的缓存／本实例订阅。不返回裸露可继续推进的更新回调。 |
| Matter 适配器 | 记录自己创建／仍持有的 Body，包括恢复替换后的新 Body；借用 Engine 不代表拥有整个 World。dispose 只移除自身对象，不清空宿主 Engine／其他 Body。构造中途抛错也必须能用资源账本回收，不能等 constructor 返回后才试图清理。 |
| 共享 core | 目前无 destroy；A 可增加最小终止标志与幂等终止入口。销毁后 frame／key、已保存的 lifecycle.acquire／release 引用及 reset、交互关闭、可用性、捕获／恢复等可写入口明确拒绝或有界无副作用；不得再推进 Tick／Matter、创建事件或重开事务。仅在 graybox 内增加终止门槛／受控包装，不改 lifecycle 算法或运行中的阶段与算法。 |
| B 的 Phaser／宿主 | Phaser Engine 由 Phaser 宿主所有；适配器不能作为自己的 Engine 销毁。解绑应用输入／可见性 → 停帧／终止 core → 清理适配器／场景／Phaser；每层只释放自己的 owner／资源。A 不冒充已经实现宿主接线。 |
| 第三方内部监听 | Phaser 3 document 级监听的既有特殊行为单独列账，B 以真实操作核查。不算本项目自绑监听，也不以“第三方遗留”掩盖应用 listener 未解除；不在 A 修补 Phaser 内部实现。 |

装配成功还须主动核对初始快照 READY；createGrayboxCore 当前可能捕获初始化错误后返回 FAILED 状态而不抛异常，装配函数不得把这种返回当成功，应保留原因、禁止控制并回收已取得资源。A 的销毁验收以无活动捕获／恢复／业务事务为前置；若有活动 owner，必须明确拒绝成功清理并报告，不能强行释放或伪造业务终态。活动流程中的最终取消／退场语义不在 A 暗自决定。

重复销毁有界且幂等；清理异常不能返回成功，终止门槛保持、错误可检查，后续显式清理只能处理残留资源，不再推进业务。部分装配失败按逆序清理，原始错误与清理错误都保留。V05-A 检查 Matter／core；V05-B 检查本项目 window keydown／keyup／blur／focus 与 document visibilitychange 绑定、旧回调及第三方监听，分别计数、分别出证据，不用“页面已关闭”代替释放验证。

### V01—V06 现行可执行口径（取代下方原稿矩阵的宽泛表述）

| 用例 | A 的执行与断言 | B／未覆盖边界 |
| --- | --- | --- |
| V01 描述校验 | 表驱动合法／非法定义；含非有限值、重复身份、无效 default、跨 level checkpoint、spawn 不一致、不支持 axis／版本／registry。注入 Engine／Body 创建计数，失败均为 0；不要求两实例的“描述 levelId”全局唯一生成服务。 | 编辑器／外部地图导入 NOT RUN。 |
| V02 全生命周期 | 测试布局坐标／尺寸／标识与首关明显不同；依上表逐项调用真实物理适配器，推进平台完整周期、独立效果重复应用，在受控固定步边界用显式 scenario 的现有纯捕获／校验 API 验证 freeze→capture→apply→rebuild→world/anchor validate→place→reset，核对真实 Body 与 diagnostics；空进度／闭合路线基线执行一次原共享恢复流程。不调用未关卡化的运行中捕获协调器来冒充此项。 | 本用例是适配器合同／真实 Matter 集成，不伪造新任务永久效果业务成功。 |
| V03 双 Engine／共享能力 | 同进程双 Engine，断言 engine/world/body 引用不共享，分别用原 core 输入走跳／落地／只读调查及暂停；A 的 Tick／状态／销毁不影响 B，Runtime UUID 不同，测试进度／首关业务记录为空。 | 不证明运行中跨关切换／进度承接。 |
| V04 快照一致性 | 合法测试初始快照 READY，独立 source／registry；错误 Runtime／Level／Checkpoint／schema／对象版本／对象集走既有预检查，无临时应用／重建／放置／永久重施写入，不改原快照和控制保护。 | 不新增每关存档槽或修改恢复算法。 |
| V05-A 资源／终止 | 至少三轮创建销毁；在借用 Engine 中预放非本适配器的 sentinel Body，dispose 后 sentinel 保留、自有 Body 不在 World；恢复替换的新 Body 也被清理。保存旧 frame／key 与 lifecycle.acquire／release 引用后销毁并调用，Tick／输入／交互／事件／进度／pauseCount／暂停状态及 Matter 步数不变；逐阶段故障注入验证逆序清理、重复／清理失败不影响另一 Engine。 | V05-B 本项目应用监听与真实宿主：NOT RUN，保留给 B，单独记录 Phaser 内部。 |
| V06 首关回归／阶段门 | 默认描述深度等价保留旧值，原有效测试不删不跳过；执行 A 专项、无参数 npm.cmd test、生产构建和 diff 检查。首关测试数按实际报告，不以历史 172 冒充新 PASS。 | A 不改／运行新的平台分支，不报三端通过；B 再做现有 D12 定向与 MLV 专项，范围分别标注。 |

测试路由以 `scripts/test.mjs` 为准：无参数 `npm.cmd test` 与 `npm.cmd run test` 都转 `test:unit`；加额外参数转 `test:platform`。带 `--browser=chrome` 本身不会选择 D12；`npm.cmd run test:d12-a1 -- --browser=chrome` 才显式带 `--d12-a1`，当前 task=D12-A3、scope=first-level-dialogue-completion-and-play-readability，只算其实际覆盖。不能把它当全部首关自动化或完整 MVP。

B 才增加 `--level-assembly` 的显式分支；报告 task=MLV-01B、scope=prototype-level-dual-layout，必须校验实际执行分支，不能忽略未知参数后运行默认 D04 并报成功。分开记录各平台与 V05-B，失败保留 FAIL，受阻 BLOCKED，未执行 NOT RUN。A 没有该分支，禁止在 A 调用它。

### MLV-01A Codex 提示词（已批准，READY）

以下为已批准的现行完整提示词，取代下方历史短提示词。本次只下发 MLV-01A；实现完成后停止并等待 Work 审查。

```text
项目：D:\Workspace\Code_Projects\mountain-city-last-delivery
任务：仅 MLV-01A；准备基线 731ac55ccc1a58e659801fdb783127b56a4f09dc。
状态门槛：先读 AGENTS.md 和 docs/DEVELOPMENT_ROADMAP.md 本轮复核补充及 MLV-01A/B 登记。
负责人已于 2026-11-15 批准本阶段，Work 已将任务登记为 READY 并下发。请实施 A，不启动 B／D13。若实际工作区与批准边界存在冲突，先报告，不自行扩大范围。
实施前检查远端、HEAD、git status，保留已有修改；2547b32 是规划分析基线，不是当前实施 HEAD。

目标：受限描述、严格数据一致性校验、现有 FirstLevelMatterWorld 全生命周期配置化，
一个无 DOM 的统一装配函数，以及首关／独立测试布局的真实 Matter 验证。
不做 Phaser 测试地图、宿主入口或三端接线，这些属于 B；不启动 D13。

阅读本路线图、DECISIONS、完整游戏规划、首关空间／玩家控制设计，以及实际 first-level、
graybox、snapshot、recovery、progress、物理适配器、输入／可见性绑定和现有测试。
不把概念 LevelDefinition／Catalog／Loader／Behavior 当已实现。

允许新增 src/core/prototype-level.ts、src/physics/matter/level-assembly.ts、
tests/level-assembly.test.mjs；可小改 src/core/first-level.ts（定义／兼容导出）、
src/physics/matter/first-level-world.ts（实例数据／自有资源账本）、
src/core/graybox.ts（仅终止门槛），及必要的首关／玩家物理测试。
README 仅实际证据，路线图仅当前任务实施记录，不改正式决策或审查结论。
名单外运行代码、配置或依赖确需修改时先交 Work，不扩大实现。

按本轮数据一致性和生命周期表执行：先校验、再为每布局创建独立 Engine、适配器和 core。
首关默认定义／原数值／业务身份不变；测试定义的 level/checkpoint/对象/effect/Runtime 独立。
定义与 SnapshotScenario 同 level，checkpoint 唯一且 default 有效，spawn 与初始 anchor 一致，
platform ID 与 registry 一致，axis/schema/stateVersion 仅允许实际适配器支持的版本。
不开放玩家尺寸／重力／碰撞容差的地图覆盖，不复制运动、支撑、承载或恢复算法。

配置化覆盖字段初值、构造／出生、所有 Body、平台完整周期、永久效果、
freeze/capture/apply、恢复重建／世界校验、锚点／放置、reset、failureZone、
diagnostics 及禁用 checkpoint 兼容接口；不能运行后回读 FIRST_LEVEL_* 布局常量。
当前协调器 disabled 仍要求固定实验室占用槽，保留其无 Body／禁用兼容形态，不返回空数组。
SnapshotCaptureRuntime 仍绑定实验室，A 不开放运行中捕获或重构它；捕获只做显式 scenario
的纯 API／适配器合同，初始快照与空进度正常恢复用已有独立 scenario 入口。
保持默认调用兼容。测试普通调查不带首关 action，不写任务／奖励／永久进度。
独立 effect 只做物理合同测试，不修改 progress 白名单；完整恢复使用空进度基线，
首关真正永久开路仍由原首关测试证明。

实现幂等终止与资源清理：core 先停止接受 frame/key、旧 lifecycle.acquire/release 引用和其他可写请求，再释放适配器自有 Body，
最后由装配函数清理自建 Engine；适配器借用 Engine 时不清空外部 World。
constructor 未返回即失败也要回收已创建 Body；恢复生成的新 Body 必须纳入账本。
core 返回 FAILED 而未抛错也不能装配成功，必须检查初始快照 READY。
销毁验收在无活动捕获／恢复／业务事务时执行；活动 owner 不强行解锁或伪造取消。
清理失败保留错误／终止门槛，不自动重开业务；重复清理只能处理残留资源。
仅在 graybox 内增加生命周期入口的终止包装，不修改 lifecycle 算法；销毁后 pauseCount/暂停状态不得变化。
不得通过 core 外层按钮“禁用”代替旧 frame/key 和 lifecycle.acquire/release 引用的终止验证。
宿主监听与 Phaser 内部 document 监听留给 B 分账，不声称 A 已通过真实窗口清理。

先补能揭露旧实例数据串用／校验不一致／终止失效的测试，再实现。
V01—V06 按本轮现行矩阵执行：双 Engine、真实 Body／支撑、原 core 走跳与只读交互、
合法与非法快照、预检零写入、生命周期全路径、借用 Engine sentinel 保留、
至少三轮销毁、保存旧 frame/key 和 lifecycle.acquire/release 引用再调用、逐阶段失败逆序清理、首关回归。
用 Phaser 当前捆绑的 Matter 注入测试，不新增物理依赖；不以 mock 代替真实求解。

实际执行：
node --experimental-strip-types --test tests/level-assembly.test.mjs
npm.cmd test
npm.cmd run electron:build
git diff --check
无参数 npm.cmd test 才是本轮全部现有单测入口；旧 D12 平台报告不代表全部首关回归。
A 不实现或执行 --level-assembly，不调用未识别参数冒充通过。
构建成功不代表新装配函数已经被宿主调用；GUI／三端／V05-B 一律 NOT RUN。

禁止第二章／四章六关实施、通用 Catalog/Loader/Behavior 框架、ECS、Tiled、新依赖、
新玩法／移动能力／跨关进度／跨会话存档／多关快照语义及修改 CONFIRMED。
不改 player/simulation/lifecycle/snapshot/recovery/progress 或事件事务算法。
如必须改变这些契约、共享物理算法或显著扩张范围，停止交 Work；
同一问题两轮有效修复仍失败，保留最小复现／日志／版本，不挑选重复跑出的 PASS。
不 Commit、Push、发布、删除用户文件或重置工作区，不自动开始 B 或 D13。

完成报告：实际基线与 Git 状态；文件／配置来源清单；V01—V06 逐项命令、
退出码和 PASS/FAIL/BLOCKED/NOT RUN；原首关回归；所有权／销毁／故障清理证据；
源码／测试／产物哈希；未覆盖的 V05-B／GUI／跨关语义和剩余问题。
声明当前只支持的受限对象集合，不能宣布完整多关架构已完成。报告后停止，等待 Work。
```

### 2026-11-15 MLV-01A 实施记录

历史交付记录：以下 DONE／PASS 为开发方提交时状态与实际测试结果，原文保留；本轮 Work 新增回归 FAIL 及当前 BLOCKED／R1 READY 以文首为准。

执行基线为 `731ac55ccc1a58e659801fdb783127b56a4f09dc`，开始时仅保留 Work 对本文的未提交修改。当前实现状态为 **DONE（待 Work 审查）**；没有启动 MLV-01B 或 D13，没有修改 D12-A3 的原状态、验收范围或历史证据。

实际新增 `src/core/prototype-level.ts`、`src/physics/matter/level-assembly.ts`、`tests/level-assembly.test.mjs`，并小范围修改首个受限定义、Matter 适配器及共享 core 的终止门槛。`PrototypeLevelDefinition` 只支持当前适配器实际使用的静态矩形地形、一个路线门、一个垂直升降平台、一个失败 sensor、稳定对象／Body／效果身份、一个初始 checkpoint／备用锚点序列、禁用 checkpoint 兼容槽和只读调查对象；没有建立 Catalog、Loader、Behavior、通用对象注册、Tiled 或跨关进度。

物理适配器构造时先校验定义，再进行 Engine／Body 之后的资源创建；实例的出生、全部 Body、平台周期、永久效果、冻结／捕获／应用、恢复重建、世界校验、锚点、放置、reset、failureZone 与 diagnostics 均只读实例定义。适配器以 Body 账本只清理自有对象，借用 Engine 时保留外部 Body 并恢复原重力；装配函数拥有自建 Engine，初始化快照非 READY 或任一装配阶段失败时按 core → world → engine 逆序回收。共享 core 终止后，已保存的 frame／key／lifecycle.acquire／release 引用不再改变 Tick、物理、输入、事件、进度或暂停状态。

| 验收项 | 实际结果 |
| --- | --- |
| V01 描述校验 | PASS。合法定义通过；非法 schema／type／axis、未知交互 shape／kind、非有限值、重复对象／Body 身份、跨 level checkpoint、无效 default、spawn 不一致、registry／stateVersion 不匹配和缺 terrain 均在 Engine／Body 创建数为 `0` 时拒绝。 |
| V02 全生命周期 | PASS。独立测试布局使用不同 level／checkpoint／object／effect／Body label 与坐标，真实推进一个完整平台周期，验证冻结期间平台时钟与位置均停止，并通过显式 scenario 完成 capture→apply→rebuild→world/anchor validation→place→reset→failure recovery；诊断中没有首关身份。 |
| V03 双 Engine | PASS。首关与测试布局拥有不同 Engine、World、Body、Runtime UUID 和 Tick；测试布局通过原 core 完成移动、跳跃、落地、只读调查和暂停，销毁首关实例不改变测试布局。测试进度／首关业务记录为空。 |
| V04 快照预检 | PASS。非法 Runtime／Level／Checkpoint／schemaVersion／对象 stateVersion、缺对象和非有限载荷均经原完整恢复流程进入预检查失败；临时应用、重建、放置与永久效果恢复写入计数为 `0`，原快照和控制保护保持。 |
| V05-A Matter／core 终止 | PASS。完成三轮独立装配／销毁；借用 Engine 的外部 sentinel 保留，自有 Body 与恢复替换 Body 被移除；旧 frame／key／lifecycle acquire／release 引用无副作用；constructor 部分失败、装配阶段失败逆序清理、重复销毁和单 Body 清理故障后的显式重试均有测试。活动 Pause Token 先阻断销毁，释放后才允许终止。 |
| V05-B 宿主监听 | NOT RUN。应用输入／可见性监听、Phaser 内部 document 监听和真实场景切换保留给 MLV-01B。 |
| V06 首关回归／构建 | PASS。默认定义与原首关空间值、snapshot scenario、interaction identity 及 `player`／`foot-region`／`failure-gap-early-a` Body 身份深度等价；原首关 10 项测试保留。`npm.cmd test` 为 `178/178` PASS，0 fail、0 skipped；类型检查、Electron Main 编译、Vite 生产构建与 Windows x64 目录构建 PASS。 |

专项命令 `node --experimental-strip-types --test tests/level-assembly.test.mjs` 为 `6/6` PASS。A 未增加或执行 `--level-assembly` 平台分支；Chrome Web、Electron 开发版、独立包、GUI 以及运行中 checkpoint capture 协调器关卡化均为 NOT RUN。Matter 仍是验证候选，不是最终物理选型。

### 2026-11-15 MLV-01A-R1 实施记录

状态：`DONE（待 Work 审查）`。父项 MLV-01A 仍按文首保持 `BLOCKED`，本记录不自行收口。基线 HEAD 与 `origin/main` 均为 `731ac55ccc1a58e659801fdb783127b56a4f09dc`；开始时 Work 的路线图修改及 MLV-01A 的 5 个已跟踪修改、3 个未跟踪新增全部保留。本轮只修改 `src/core/graybox.ts`、`src/core/goal-route-runtime.ts`、`src/core/first-level.ts`、`tests/level-assembly.test.mjs`、README 和本路线图。执行期间工作区另有与 R1 无关的首关 UI 线框文档及三份 SVG 未跟踪新增，已原样保留，未纳入本任务。

修复前先写回归并实际得到 `3 FAIL`：真实首关 Tick 1 在 `verifying`／`running`、原 Event 已退役且 Result 尚未创建时，core 与 assembly 均错误返回 `destroyed`；core 自有 goalRoute 在 `verifying` 与 `terminal-pending` 时同样错误销毁；终止后错误 Owner＋未知 Token 的旧 release 错误返回 `released`。

修复增加两层小型只读 readiness，不接管事务或建立新管理器：

- `PrototypeGoalRouteRuntime.destroyReadiness`：`idle` 安全；运行中、待重试／恢复、terminal-pending、结果尚未创建／消费／确认退役及无法确认的中间阶段阻断；`succeeded`／`failed` 仅在两事件均安全退役后允许清理。
- `FirstLevelRuntime.destroyReadiness`：汇总 `quest`、`lift`、`complete`，core destroy 同时读取该聚合与 core 自有 goalRoute。任何 blocker 存在时 core 不设置终止标志，assembly 也不 dispose World、不清 Engine；拒绝后仍可继续 frame 完成原链。
- 终止后 lifecycle 继续使用原 Owner＋Token 校验，不伪造成功；旧 acquire 仍不创建令牌，旧 release 不改变暂停、Tick、物理、输入或业务状态。

| 用例 | 状态 | 实际结果 |
| --- | --- | --- |
| R01 真实首关活动事务 | PASS | 真实 `FirstLevelRuntime` 委托 Tick 1：`phase=verifying`、`transactionStatus=running`、Event／Command／Transaction `1/1/1`、Result `null`、目标数 `1`、原 Event 已退役。core 与 assembly destroy 均 `blocked`；World Body、Engine timestamp、Tick、physicsSteps、进度与业务身份不变。继续 frame 后原链只完成一次，安全收尾后正常销毁，再次销毁幂等。 |
| R02 core 自有路线故障 | PASS | 既有 terminal-commit 故障先得到 `verifying/running`，再进入 `blocked/terminal-pending`；两次销毁均被 core goal route 阻断，Result Event 保持 `null`，命令／事务各 `1`、结果事件 `0`，未强制恢复、重开或重复业务。 |
| R03 终止后 Token | PASS | 正常释放后销毁：旧 acquire 为 `undefined`；正确 Owner 重复原 Token 为 `already-released`，错误 Owner 与未知 Token 均为 `rejected`；`pauseCount`、paused、Tick、physicsSteps、player 与 progress 不变。 |
| R04 既有语义 | PASS | V01–V06 保留；专项 `8/8`、无参数 `npm.cmd test` `180/180`，0 fail、0 skipped。双 Engine、sentinel、逆序清理、重复销毁与首关业务未回归。 |

实际命令与结果：

| 命令 | 状态 | 退出码／结果 |
| --- | --- | --- |
| 修复前 `node --experimental-strip-types --test tests/level-assembly.test.mjs` | FAIL | 退出 `1`；`5/8` PASS，R01、R02、V05-A 共 3 项按预期失败。 |
| 修复后 `node --experimental-strip-types --test tests/level-assembly.test.mjs` | PASS | 退出 `0`；`8/8`，0 fail、0 skipped。 |
| `npm.cmd test` | PASS | 退出 `0`；类型检查、Electron Main 编译通过，`180/180`，0 fail、0 skipped。 |
| `npm.cmd run electron:build` | PASS | 退出 `0`；Vite 33 modules、Electron Main 与 Windows x64 目录构建成功。仅有既有 bundle 体积、缺少 author、默认图标警告。 |

版本证据：生产入口 `release/layered-city-adventures/win-unpacked/Layered City Adventures.exe`；ASAR `EBF753C234AD67278D07C44EB2A1ED942C0C61A6B5F5E6E9A7E9762067ACC4E2`；EXE `A0065F1BF2BC5052E87E62D7AC0C5FBC2AAA2B445862E60859252C1962A27B28`。源码／测试 SHA-256：`graybox.ts` `6CC8BA089ED571BE7D21E4D209145561243C00557C61C13A3CB199CC8248BF3C`、`goal-route-runtime.ts` `271992BA186CD1431D0B0F3B99332ADE73DA683C04B906E02432755EB4AC6C91`、`first-level.ts` `0033B527B6E6CED477C072934A9C1C013BD54A4365D76DA97FB07E3ECE49023E`、`level-assembly.test.mjs` `1D6A853FFE841C5FE254ED0065009883DF14576F2F9EE4259F10979B12DE4B6E`。`level-assembly.ts` 保持 `24012A41D85BD08070E2DB287EBE1E463681AC5E3978E87ED34E81DD9ADF2738`，未修改。

R1 未新增平台测试分支，未运行 GUI／三端长套件；V05-B、Chrome Web、Electron 开发版、独立包运行、运行中 checkpoint capture 协调器关卡化仍为 NOT RUN。报告后停止，等待 Work 审查，不进入 MLV-01B 或 D13，不 Commit／Push。

## 1. 规则与事实来源

- 当前项目名称：《坡坎之间》（CONFIRMED，2026-11-15）；英文名称未确定。叠城大冒险／Layered City Adventures 为旧工作名称；当前使用名称不等于商标、重名核验或正式发行名称冻结完成。
- 世界观：具有山城特色的虚构立体城市。
- 类型与体验：2D 横版平台探索冒险；跳跃、探索、解谜、发现。
- 设计约束以项目负责人最新明确指示和 `DECISIONS.md` 的有效 CONFIRMED 记录为准；项目概述见 `PROJECT_BRIEF.md`，名称同步范围见 `PROJECT_REBRANDING_HANDOFF.md`。
- 具体控制、关卡、任务规则分别查阅现有设计文档。历史审查建议、PROPOSED 参数和本路线图的工程安排，不自动成为正式产品或技术决策。
- 本文是唯一开发任务入口；聊天提示词只引用这里的任务编号与边界，不能建立第二队列。正式设计约束来自有效决策，不从旧名推导配送玩法；首关四区地点与下行方案 A 已确认，其余未涉及的世界观映射仍待具体核对。
- 现行任务实施后报告并等待 Work 审查；旧连续流程仅作历史。改变 CONFIRMED、核心选型、批准范围及红线操作仍按第 4 节暂停报告。

## 2. 当前阶段与历史基线

2026-11-14 D12-A3 执行：基线 HEAD 为 `726d337`，开始时已有设计文档未提交修改，均保留。首关现按方案 A 实现 A 解放碑出生、B 沧白路／洪崖洞入口、C1／C2／C3 下行与 D 下层嘉陵江岸；当前 `npm.cmd test` 为 172/172 PASS，生产构建和同一应用版本的三端定向通过。最新测试夹具复跑保留 Web `blur` FAIL，详见第 7 节。

| 当前事项 | 真实状态 |
| --- | --- |
| 协作模式 | Work 单项下发 → Codex 实施／测试 → Work 审查；正式设计由 Work 主维护。 |
| 名称 | 当前中文项目名称为《坡坎之间》，英文名称未确定；旧工作名与旧正式名称表保留历史，正式发行名称尚未冻结。 |
| 首关空间 | 方案 A 为 CONFIRMED，A 解放碑出生、C 下行、D 下层嘉陵江岸；不再待选方案。 |
| 图 A／图 B | 两张原 PNG 已在 `2547b32` 归档；本轮格式／尺寸／哈希复核一致，原缺图 BLOCKED 为历史。按图制作与新空间验收仍 NOT RUN。 |
| 下一建议 | H5-01 受限响应式／设备输入原型已准备为 READY，等待负责人转交；非阻断横屏建议、保留 Esc、独立按钮暂停，不决定竖屏豁免。后续 H5-02、D13 和 MLV 不启动。 |

### HISTORICAL：2026-11-12 初建基线

以下来自 2026-11-12 的文件盘点、README 和开发交付记录。本轮只维护流程文档，未重新运行代码测试，不能将“已报告交付”当作本轮独立复验通过。

| 已有工作 | 当前证据和限制 |
| --- | --- |
| M1.1.2：Web／Electron 双端启动 | 源码、构建配置和历史运行记录已存在。 |
| M1.2.1：固定步与生命周期暂停 | 累加器、有界补算、暂停令牌及平台接入已实现，历史测试记录已存在。 |
| M1.2.1-R1：就绪判定修复 | 已报告三轮通过；隐藏页面不应因 Tick 不增长被误判，历史未知问题保留。 |
| M1.2.2：玩家与静态地形灰盒 | 源码存在；Work 已按当前代码及 run-w2kthX 复核已实现范围。普通窗口独立人工体验仍受工具限制。 |
| 名称与虚构世界定位同步 | 已实施，NAME-05 经 D01-R3 三端新自动化与版本复核后通过；历史失败保留，普通窗口人工部分独立为 BLOCKED／NOT RUN。 |
| 单向／移动／升降平台 | 普通实体平台与特殊单向平台已由 D03 实现；D04 已实现水平往返与垂直升降实体平台，真实 Matter 单测、生产构建及三端定向承载通过。完整平台套件仍受焦点中断影响。 |
| 统一交互与运行内进度原型 | D07 已实现调查／拾取交互；D08 已实现运行内收藏、目标、奖励及永久效果幂等原型。正式任务、跨会话存档、业务事件事务与检查点恢复仍未实现。 |

当前工作区存在未提交的灰盒、更名及文档改动。不得为了“从干净状态开始”而删除、覆盖或回滚它们。

## 3. 开发窗口每次如何执行

1. 阅读 `AGENTS.md` 和本文，检查 Git 状态、代码与已有测试；确认没有另一个窗口同时修改同一批文件。
2. 读取当前任务卡和必要设计条目，不每次重新讨论全部架构，不重复开发已有功能。
3. 只实施 Work 已下发的当前单项任务，开始时标 IN_PROGRESS；PLANNED 是建议，不是本轮自动执行许可。已有实现先核对，不重新搭建。
4. Work 在第 7 节维护任务卡：目标、状态、范围／非目标、模块、约束、验收、测试和产物；Codex 仅补实际进展与证据，不自行追加另一项任务或改正式需求。普通实现方式自行选择。
5. 增量实现，执行适用测试、类型检查和构建；涉及界面、输入、碰撞或生命周期时，增加真实运行验证。
6. 修复本任务引入的失败，检查回归。不削弱断言，不删除失败记录，不用静态检查替代真实运行。
7. Codex 自审并更新 README 的实际工程说明、当前任务进展／测试证据；需要正式设计调整时列出差异交 Work，不并行改写正式决策／专项设计。Work 核验后同步概述与设计，不把未验证能力混入验收。
8. 完成后报告并等待 Work 审查，不能自行进入下一任务；同时最多一个实施任务处于 IN_PROGRESS。实现完成与最终验收分开登记。
9. 遇到阻塞时记录最小复现和不依赖该阻塞的工作，交 Work 判断下一安排；开发窗口不自行切换任务、扩大范围或绕过决策。
10. 当前任务完成或需要负责人决定时，报告已完成、未完成、证据和待审查事项，由 Work 安排下一任务。会话中断后从本文恢复，不凭聊天印象重复实施。

任务状态：READY、IN_PROGRESS、DONE、BLOCKED、WAITING_DECISION、PLANNED。Codex 可报告“实现完成，待 Work 审查”；最终验收结论由 Work 依据源码／差异和证据记录。缺少证据不算通过，历史 DONE 不自动覆盖后续发现的缺口。

测试结果：PASS、BLOCKED、FAIL、NOT RUN，Warning 另记。DONE 必须具备该任务范围内的自审和实际验证，未覆盖的后续能力须明确列出。

## 4. 必须停止并报告的情况

- 需要改变 CONFIRMED 设计、核心技术选型或扩大批准范围。
- 正式约束存在真实冲突，不能在当前范围内同时满足。
- 必须决定尚未批准的剧情、玩法或最终物理选型，现有资料不足以继续对应内容。
- 可能丢失用户代码或数据，或涉及 AGENTS.md 列明的删除、密钥／配置修改、Git 高风险操作及外部发布。
- 关键测试持续失败，无法在当前方案内修复；报告证据和已尝试方法，不伪报通过。
- 同一问题经过两轮有效修复仍失败，或涉及跨模块架构冲突时，整理最小复现和版本证据交由 Work，不无限重试。
- 检测到另一开发窗口正在修改相同文件，不能安全区分和合并变更。

普通函数命名、数据结构、适用测试、局部 Bug 修复和可调整原型参数不需要停止。实现选择不自动升级为正式决策。

## 5. 第一批：当前工程到物理灰盒收口

目标：在新名称下稳定体验走跳、不同平台与碰撞，形成真实双端证据。本节初建时采用连续流程，现保留历史任务与证据；实际执行仍按 Work 单项下发与审查，不从本段领取新任务。

| 顺序 | 任务 | 依赖 | 当前状态 | 完成条件 |
| --- | --- | --- | --- | --- |
| D01 | 名称与定位同步 | 已有工作名使用依据 | DONE | Work 核对 run-w2kthX 三端自动化及当前脚本／ASAR 版本，NAME-05 按当前版本通过；历史失败保留，普通窗口人工体验另列 BLOCKED。 |
| D01-R1 | Web 平台回归中断定位与验收收口 | D01 的失败证据 | BLOCKED | 已补时间线／中断锁存及故障注入；两版定向 Web 均捕获非预期 blur，停止重试交 Work；NAME-05 仍 FAIL，完整三端 NOT RUN。 |
| D01-R2 | Chrome／Edge 可选入口与受控对照 | D01-R1 的停止报告 | BLOCKED | 选择器、身份记录与单测已完成；Chrome／Edge 定向均捕获操作中 blur，完整三端回归因 Chrome 未通过而 NOT RUN；NAME-05 仍 FAIL，等待 Work 审查。 |
| D01-R3 | 受控回归与普通窗口人工体验 | D01-R2 | BLOCKED | run-w2kthX 的 Chrome／Electron 两模式自动化通过；普通窗口人工操作因工具限制未执行，不宣称整项完成。Work 将人工项单独保留，不再阻塞 D03。 |
| D02 | 当前玩家灰盒交付复核 | D01 | DONE | Work 复核现有核心／物理代码、真实 Matter 单测覆盖和 run-w2kthX 三端灰盒子项，仅验收已实现范围，非完整 T01～T06。 |
| D03 | 实体与单向平台专项 | D02 | DONE | Work 已核对代码、P01–P06 三端证据及当前哈希，并重新执行 32/32 单测通过；限当前原型范围，独立人工走跳及 Edge 未执行项保留。 |
| D04 | 移动与升降平台承载 | D03 | DONE | Work 按当前原型范围收口：38/38 单测及已有三端承载证据通过，D04-R1 补齐真实生命周期专项；历史完整套件 FAIL、Edge 与独立人工未覆盖项仍保留。 |
| D04-R1 | 移动平台生命周期定向验收 | D04 实现 | DONE | Work 已核对 run-KPoUKj 三端报告、专项断言、源码与 ASAR 哈希，并重跑 38/38 单测；只验收移动平台生命周期定向范围。 |
| D05 | 物理触发区域与生命周期诊断 | D04 | DONE | Work 已核对 92cc389 实现、run-2Ch7Xr 三端证据与源码／ASAR 哈希，重跑 44/44 单测 PASS；限 G01–G06 诊断区域范围，非完整业务触发器验收。 |
| D06 | 物理灰盒阶段回归与报告 | D03～D05 | DONE | Work 已核对三份成功报告、全部版本哈希与 Tick 断言修正，并重跑 44/44 单测 PASS；限已实现灰盒范围，允许进入 D07。历史 FAIL、人工 BLOCKED 和未实现项保留。 |

### D01：使用现有交接，不重复写任务

直接执行 `PROJECT_REBRANDING_HANDOFF.md`。保留已有玩家灰盒，默认打开可操作场景。内部目录、appId、包名、存储及业务 ID 不顺手迁移；当前窗口已做过的同步无需重做，先完成其余验证。

### D02：验证已有交付，不重新造轮子

本项现已按第 7 节 Work 审查收口；以下保留验证依据说明，不要求在 D03 前再重复做一轮同内容验收。

参考 README 的 M1.2.2 记录、当前脚本及 `test-results/platform/run-LYLeed/` 的版本／结果记录。证据可能只存在于本机；缺失时补跑适用验证，不编造结果。记录当前源码、脚本和产物的版本对应关系。历史未知问题保留，但不在没有新证据时无期限阻止独立功能开发。

### D03～D05：范围与必要测试

- 物理仍由共享固定步驱动；Matter-first 是验证候选，不增加第二套自动物理更新。
- D03 覆盖单向平台向上穿越、顶点转向、自上落地、边缘离开、邻接实体地形及短长跳配合。禁止把全部地面改为单向或实现主动下落穿透。
- D04 先实现一条水平往返路径和一条垂直升降路径，采用可调原型几何；明确平台逻辑位置、玩家支撑与离开行为，不顺带新增机关网络、任务或检查点。
- D05 只做物理诊断触发区域与生命周期记录，不冒充检查点系统。复杂事件事务和仲裁在对应业务任务接入，不提前搭空框架，也不能在后续业务接入时绕过正式协议。
- 每项补有意义的受控物理测试和真实双端操作验证；回归已有走跳、支撑和生命周期。不重复跑与变更无关的全部检查，除非存在新风险。
- 参数采用可调整工程值，写清单位、语义和测试条件，不要求用户逐个决定数值。

### D06：物理验证与正式选型分开

必要物理测试全部通过，才能提交 Matter 为最终方案候选；是否正式采用仍需单独确认，开发窗口不能自行批准。

包含完整检查点恢复的 T03／T04／T06 子项须等恢复系统实现后验证，不能在本批伪记 PASS，也不因此把全部恢复架构提前塞进本批。仅通过基础物理子项时，可继续下节允许的通用原型工作，但保持候选标识。若 Matter 无法满足核心需求，报告证据与备用路线，不自行切换技术。

## 6. 后续顺序与真实决策关口

以下为工程拆分顺序，不代表功能已完成或新产品需求已确认。进入每项前，开发窗口先在第 7 节缩成一个可以独立验收的小任务，无需 Work 另写提示词。

| 阶段 | 目标与最小范围 | 前置与关口 |
| --- | --- | --- |
| D07：统一交互原型（DONE） | 主体交互与 D07-R1 两项补修已由 Work 按当前原型范围收口；历史完整回归及最新定向证据分别保留。 | 不代表正式任务或检查点实现；允许 D08。 |
| D07-R1：交互提示与重置松键门槛（DONE） | Work 核对 run-LTvqUU、源码／脚本／产物版本及修复，重跑 52/52 测试 PASS。 | 仅限指定缺陷与定向范围；未重跑完整物理长套件。 |
| D08：永久进度原型（DONE） | Work 核对实现与 run-nlbzAQ 三端版本证据，重跑 59/59 测试 PASS；限运行内测试内容。 | D07 补充回归 run-xHiVwG 仅 Web PASS，Electron 两端 NOT RUN；无跨会话存档或正式任务。 |
| D09：最小事件与事务协议（当前原型范围已验收） | 目标 E 的事件、命令、跨 Tick 事务与唯一最终结果已接共享宿主并由 Work 审查；核心与三端证据分别保留。 | 不代表收藏及全部玩法迁移、正式任务、命令／事务安全清理或跨会话协议完成。 |
| D09-A1：统一事件创建与原子入队（DONE） | Work 核对 3f27478 的原子创建、故障回滚与哈希，并重跑 66/66 测试 PASS；当前纯核心范围收口。 | 不代表宿主、玩法或真实业务事件已接入。 |
| D09-A2：固定阶段单轮分发与事件防重（DONE） | Work 核对 b6cf8eb 实现、源码／测试哈希及边界，重跑 75/75 测试 PASS，当前纯核心范围收口。 | Accepted 仍仅为测试替身；未接宿主或真实命令事务。 |
| D09-A3：生产者确认与连续安全退役（DONE） | Work 按 6038571 核对权限、清理及水位线实现和哈希，重跑 81/81 测试 PASS，当前核心范围收口。 | 未接宿主，Accepted 仍为测试替身；不含跨会话保证。 |
| D09-B1：稳定命令与原子接收意图（DONE） | Work 按 6ff9d24 核对实现／哈希，重跑 87/87 测试 PASS，纯核心接收范围收口。 | 尚未执行事务或接宿主，不把 Accepted 等同业务成功。 |
| D09-B2：真实交付分类与 Unknown 核查（DONE） | Work 按 d954e24 核对真实接收／查询联调及哈希，重跑 94/94 测试 PASS，当前核心范围收口。 | 未执行业务事务，未接宿主；不代表 GUI 端到端通过。 |
| D09-C1：最小事务执行与终态判定（DONE） | 主体与终态有界恢复经 Work 复审收口；104/104 测试 PASS。 | 仅当前核心原型，不代表宿主、检查点或存档完成。 |
| D09-C1-R1：终态提交失败的有界恢复（DONE） | Work 按 c94a797 核对修复／哈希并重跑 104/104 测试，持续故障不再同调用递归。 | 终态登记失败保留结果且不重跑业务；工程状态不升级为正式枚举。 |
| D09-C2：唯一最终结果事件（DONE） | 主体与 R1 经 Work 按 adebba2 复审；源码哈希匹配，重跑 112/112 测试 PASS，当前核心范围收口。 | 1023641 的入口缺口与历史 BLOCKED 保留；不代表宿主已接入。 |
| D09-C2-R1：结果事件受控创建与分发入口补修（DONE） | Work 核对公开创建拒绝、内部受控放行及三种分发模式边界；112/112 测试 PASS。 | 合法结果闭环保留；仍只有纯核心验证，没有 GUI 业务链证据。 |
| D09-D1：测试目标 E 的共享宿主业务闭环（DONE） | Work 按 d3210cb 核对源码、三端报告及版本，重跑 118/118 测试 PASS；当前目标 E 范围收口。 | 只迁移这一测试目标；D08 收藏原型、正式任务、检查点与存档不在本段范围。 |
| D10：检查点捕获（当前灰盒范围已验收） | 初始备份、运行中捕获、局部冻结、资源清理及触发仲裁已完成；D10-A3 由 Work 按源码／三端证据审查收口。 | 不代表正式关卡、长时资源清理、恢复或存档已完成。 |
| D10-A1：固定快照登记与初始备用快照（DONE） | Work 按 72c3395 审查初始化、原子存储、控制组合及 26 项三端版本记录，重跑 126/126 测试 PASS；当前范围收口。 | 不代表运行中捕获、正式检查点触发、坠落传送、完整 Recovery 或存档完成。 |
| D10-A2：运行中捕获事务与局部冻结（DONE） | 主体及 R1 经 Work 按 5fc9be9 复审，139/139 测试及两条旧复现重跑通过，当前核心／Matter 组合范围收口。 | 历史资源收尾缺陷保留；不代表新捕获 GUI／触发／仲裁已完成。 |
| D10-A2-R1：失败后的资源清理与重新准入（DONE） | Work 核对资源所有权、终态后显式清理和历史 requestId 回执；新独立请求能够重新捕获，原终态不重开。 | 本轮未重跑 GUI；旧 A1 报告不冒充当前资源修复后的端到端证据。 |
| D10-A3：灰盒检查点触发、批次仲裁与可玩捕获（DONE） | Work 按 bb6e20d 核对实际阶段、触发／防重与三端报告全部 28 项版本，重跑 144/144 测试 PASS。 | 仅现有灰盒；历史 run-zrOvKK FAIL、Edge／人工未覆盖保留，不代表恢复已实现。 |
| D11：失败与恢复（当前基础灰盒范围收口） | Work 复核 R1 统一资源准入、真实 Matter 原复现及当前三端证据；161/161 测试 PASS。 | 保留外部冻结 GUI／Edge／人工未执行范围，不宣称所有未来关卡或异常均验收；不继续扩充独立基础灰盒。 |
| D11-A1：正常坠落恢复闭环（DONE） | Work 按 d65859a 核对正常流程及 30 项三端版本，重跑 149/149 测试 PASS；当前正常恢复范围收口。 | 仅当前已配置主锚点与有限错误边界；不代表完整世界验证、自动重建、RecoveryError 或存档。 |
| D11-A2：安全锚点与世界一致性验证（DONE） | Work 核对实际实现、run-xrUFrD 全部 30 项版本记录，并重跑 154/154 测试 PASS；当前核心／真实 Matter 及三端正常恢复范围收口。 | Warning 为合成注入；备用／故障 GUI 仍 NOT RUN，不代表自动完整重建、RecoveryError 或最终物理方案已验收。 |
| D11-A3：一次自动完整重建与 RecoveryError 交互闭环（DONE） | 主体及 R1 经 Work 按当前实现与证据收口，历史资源安全门槛 BLOCKED／复现记录保留。 | 只验收已实现范围；外部冻结 GUI 注入和独立人工未执行，Matter 仍为候选。 |
| D11-A3-R1：恢复前资源安全门槛补修（DONE） | Work 重跑 161/161 测试，并独立重跑外部冻结旧复现：等待时零重建、旧 Body 保留，释放后原快照恢复成功；两份三端报告各 30 项版本匹配。 | 当前缺陷范围收口，历史 FAIL 保留，未将核心资源冲突测试冒充三端故障注入。 |
| D12：首关内容整合 | 形成从开始到结束的主线路径，整合玩家、交互、谜题、任务及恢复，先可玩切片再补表现。 | A1 先用功能标签验证已冻结主线；现实地名映射与最终叙事未定案，不凭更名重写故事。 |
| D12-A1：首关最小可玩流程（DONE，当前切片范围） | 主体闭环与 A2 对话修复经 Work 核对，171/171 测试及当前三端证据有效。 | 不表示最终地图／美术／完整 MVP 通过；方案 A 已确认，下层江岸布局与现代码上行 D 的实施差异仍待后续任务同步。 |
| D12-A2：首关对话完成时序与游玩可读性（DONE） | Work 重跑 171/171 测试、旧 NPC 复现和 36 项三端报告版本检查；对话正常结束后唯一接取，当前范围收口。 | 独立人工长期手感／Edge 未执行；路线冲突不因对话／UI 验收而消失。 |
| D12-V1.1：首关空间参考图归档（原图已归档） | 方案 A 与修正版图片 B 的用途已确认；两张原图已在 `2547b32` 归档，PNG／尺寸／SHA-256 复核一致。 | 旧缺图 BLOCKED 保留历史；归档完整性不等于空间布局评审或按图制作通过，后者仍 NOT RUN，不擅自重画原图。 |
| D12-A3：方案 A 首关空间同步（DONE，待 Work 审查） | 已将解放碑出生、沧白路入口、C 多层下行、D 下层江岸接入现有占位关卡，并完成真实通行、机关、恢复、暂停及三端定向；本轮已核对应用哈希及 `run-uz0UtE` 等历史证据，审查范围与限制见本轮补充，不改变原状态。 | 原图已归档；按图匹配／新空间验收仍 NOT RUN。最新复跑 Web `blur` FAIL 原样保留。平台端点为 `TO_VALIDATE`，不做正式美术或最终物理决定。 |
| D13：MVP 双端验收与交付 | 按实际有效首关规则验证主线、错误操作、失败恢复、永久进度和奖励幂等，修复阻断问题，交付可玩产物。 | D12；正式物理方案需单独确认；旧 MVP-G 用例须先核对适用性，不删旧结果。 |

MLV-01 不在上表内改动 D13 的原任务、依赖或验收范围。其拆分见下方“MLV-01A／B 任务登记”；2026-11-15 已批准当前只实施 A，D13 仍不启动，后续顺序由 Work 审查后安排。

应集中向用户确认：最终物理采用决定；虚构城市下旧首关叙事和任务是否沿用／怎样调整；实施持久化时确需明确的跨会话语义。只提交具体证据与影响当前工作的选项，不把整份 PROPOSED 清单变成审批流程。

既有正式约束内的普通实现无需重复做产品决策；仍须按 Work 下发单项实施、报告和审查，不以“连续推进”自行领取下一任务。

## 7. 当前任务与持续记录

当前任务：H5-01 响应式画布与设备输入受限原型已实现并通过当前版本桌面 Chrome／触屏模拟自动化，状态为 `BLOCKED（H08 真机 NOT RUN，待 Work 审查）`。完整结果见文首实施记录；横屏豁免、全局 Esc 暂停和完整 UI 仍未确认且不在本卡实施；H5-02／D13／MLV 不启动。D12-A3 历史状态保持。

当前实施范围：MLV-01A 的受限关卡描述、首关 Matter 适配器全生命周期配置化、无 DOM 物理装配、双布局真实 Matter 测试和 core／Body／Engine 终止已实现；没有接入 Phaser 测试地图或宿主。

当前模式：采用三窗口单任务审查。D12-A3 平台端点、速度及周期仍是 `TO_VALIDATE` 工程选择，不代表正式参数；图片归档不等于图像匹配通过。MLV-01A 已完成受限关卡描述、物理适配器全生命周期配置化、统一物理装配与双布局真实 Matter 验证，当前等待 Work 审查；Phaser 测试地图、调试入口和宿主清理验证留到 MLV-01B。未启动 B 或 D13。历史候选任务及等待记录保留，以下最新记录优先。

### 2026-11-14 文档任务：完整游戏内容与关卡扩展架构

文档整理完成，待负责人审查；新增 [完整游戏内容规划与关卡扩展架构方案](FULL_GAME_CONTENT_AND_LEVEL_EXPANSION_ARCHITECTURE.md)。基线为本轮核对的 GitHub main `2547b32a5756e887eadf27bf48b6fcda967f5f95`，本地一致，开始时工作区干净。

本轮仅 [Large Semi-Open Levels](DECISIONS.md#2026-11-14large-semi-open-levels大型半开放关卡) 为负责人确认的新正式方向，旧小型／紧凑规模保留 HISTORICAL。大型不是开放世界，首关 MVP／单线索单机关／任务／通关／恢复边界不扩大，详细地图继续引用首关空间原型。四章六关、章节主题、通用关卡模块和 Tiled 仍 PROPOSED；导入／切换／资源／容量／性能等 TO_VALIDATE，ARCH-01—10 均 NOT RUN。

README、本页与 DECISIONS 的旧缺图描述均补历史／现行状态说明。两张 PNG 文件和既有哈希不变，图片完整性复核不当作空间或代码验收。本页下方 D12-A3 原任务卡、原执行报告及同期图片记录中的“本次缺图”是当时事实，完整保留，不用新归档回写旧测试结果。

这不是实施任务或提示词，不改 D12-A3 DONE（待 Work 审查），不启动 D13，不修改源码／测试／碰撞／游戏行为，不运行构建／游戏测试，不自动提交或推送。后续仅建议负责人审查规模之外的内容和跨关语义，不在本轮下发开发任务。

### 2026-11-14 文档任务：首关完整空间灰盒原型设计方案 V1

文档整理／原图归档：DONE（待负责人审查）；设计正文仍 PROPOSED，实施／GBX-01—10 均 NOT RUN。基线为本轮重新读取的 GitHub main `68ad83d97dff784a7288deb2230a7393de170389`，本地一致、开始时工作区干净。交付见 [全关空间方案](FIRST_LEVEL_GRAYBOX_SPATIAL_PROTOTYPE_V1.md)，与关卡 C 区 V2 交叉引用，不建 C 区 V3 或第二份开发任务队列。

原始风格图 V1、黑白布局修正版 V1.1 已取得并原样归档，PNG／尺寸／源目标哈希核对 PASS，清单见[美术登记](ART_DIRECTION_AND_SCENE_PROTOTYPE.md#图片归档与采用状态)；以下历史“缺图 BLOCKED”保留为当时事实。图片存在不代表空间实现、游戏验收或全部 V1.1 评审通过。

A 区旧 A1—A4 保留 HISTORICAL，新候选 A-GB-01—03；当前上层机关与 V2 下层 C3-02 摆位差异登记待设计同步。J1 必经、隐藏环路具体几何及完整空间均未确认；C-H／收藏／支线／观察不进 MVP。乘坐方案 A 沿用 CONFIRMED，自动往返／两端短停的独立原始确认在可访问会话未核实，继续 PROPOSED，不把助手建议当负责人批准。

本轮只修改设计文档与归档参考原图，不改源码／测试／碰撞，不运行游戏测试或构建，不进行代码验收；D12-A3 状态、原任务卡及历史报告不变，不启动 D13，不生成 Codex 开发任务。下一阶段仅建议负责人审查空间提案与确认依据，结束后等待审查。

### 2026-11-14 三个窗口协作初始化核对

HISTORICAL：本小节为原图入库前的协作初始化快照。下文“缺文件 BLOCKED”保留当时事实，当前两图已在 `2547b32` 归档；不作为现在的文件状态。

职责与写入边界统一见 [AGENTS](../AGENTS.md#三个窗口的职责与交接现行)：聊天窗口产品／创意，Work 正式文档／架构／任务与验收，Codex 源码／测试证据／README。负责人确认必要决策，普通实现不逐项审批；本文是唯一开发任务入口。开发报告不能代替 Work 的源码／差异／日志核验，核对旧报告与重新运行测试必须分别说明。

方案 A 已有正式记录，保持 CONFIRMED，不新增冲突路线决策。名称的首次更名 CONFIRMED 表是历史，现仍按后续 Working Title Pending Final Confirmation 使用工作名；本次不替负责人作最终定名。首关两张 PNG 路径均缺文件，继续 BLOCKED，不启用图片引用、不虚报资产。后续 D12-A3 已把原先平台 y=549→309 与上层 D 的实施差异同步为 C3 下行 D。

### 2026-11-14 文档同步：C3—D 升降平台乘坐操作方案 A

本项是设计文档同步，不是新的实施任务或里程碑。核对 GitHub `main` 与本地基线均为 `eafa089849ebac4e87ee101376fb3651d0a57ed6`。负责人确认的八条乘坐控制集中见 [DECISIONS](DECISIONS.md#2026-11-14c3d-升降平台乘坐操作方案-a有限自由操作)，在现有 C 区 V2 内细化站点与安全边界，不另建 V3，不重复登记 C→D 路线方案 A。

有限左右调整、行驶禁跳／禁中途上下、到站完全停止并对齐后完整控制及站点自由上下已 CONFIRMED；双站调度／自动往返／空载／循环／停靠时间／速度／尺寸／端点及恢复后停 C3 或恢复运行的策略仍 PROPOSED / TO_VALIDATE。J1、外环具体几何和完整版内容均不升级，不加入当前 MVP 必做条件。

D12-A3 当前状态、原任务卡／SA01–SA05、实现报告及历史测试记录保持原样，本次不进行代码验收，不启动 D13。后续如安排实现，再单项验证安全左右调整、运行禁跳和中途上下门槛、停稳对齐后控制释放、其他 owner／生命周期暂停及恢复可通行；这些只是未执行的设计验证事项，不是本轮测试 PASS。缺陷或实现差异由后续真实审查记录，不能拿旧 D12-A3 报告充当新乘坐规则的验收。

### D12-A3 任务卡：方案 A 首关空间同步

2026-11-14 文档更新边界：C 区空间 V2 已登记为 PROPOSED，详见[关卡主文](HONGYADONG_LEVEL_DESIGN.md#c-区完整空间布局-v2proposed)。C1／C2-A／C2-B／C3 细分、J1 作为必经短跳、井道向下行程不是本任务新增验收；C-H／J2／J3／收藏／支线／观察／老店主只属完整版待确认、未排期内容。外部绕行方案 B 的方向确认不等于授权制作隐藏环路。本次不改变当前 D12-A3 进度、原 SA01–SA05 或开启新里程碑；后续采纳提案再由 Work 单项安排。

状态：DONE（待 Work 审查）。本任务卡保留原始实施边界；实际结果见下方“2026-11-14 D12-A3 执行结果”。本轮审查补充只记录复核结论，不更改本状态或 SA01–SA05。

- 目标：在现有可玩首关把 A 出生身份、C 多层下行、D 下层嘉陵江岸与方案 A 对齐，保持 NPC、单线索／单装置、真实升降辅助通路、拍摄分享和失败恢复完整可玩。当前基线为 D12-A2，使用实际源码／Git，历史 171 项与三端证据不是新地图验收。
- 范围／模块：以 `src/physics/matter/first-level-world.ts` 几何／平台／门／失败区，`src/core/first-level.ts` 首关对象／锚点配置、`src/rendering/phaser/first-level.ts` 占位表现与镜头，以及现有首关／平台测试为主。确需调整共享快照／恢复接入时只做最小配置修正，复用已有核心，不重建第二套世界协议。
- A／B：A 画面和提示明确在解放碑周边出生，提供移动、跳跃、主动交互教学；可用不承担新碰撞的纪念碑轮廓与街巷占位图，不增加攀爬纪念碑／历史卡。B 明确沧白路与洪崖洞入口、游客与唯一环境线索；完成对话才自动接取的 A2 语义保持。
- C／D：用现有运动能力、楼梯／连续支撑与木走廊／悬挑平台组织可辨认的多层 C，主线自上而下，出口接低于 C 主线出口的 D 江岸。不是只更名现有上层 D 或换江水背景。单装置正确操作真实开路，错误可重试；不加第二机关／线索、分支捷径或新移动能力，仍满足全部联合通关条件。
- 平台：总体下行不等于冻结平台单向下行。开发可为当前原型选择能连通、承载和恢复的临时端点／运行方式，写清选择、证据及 TO_VALIDATE 状态，不从缺失图片或旧代码推导正式参数，不擅自改 CONFIRMED；不能以“没有最终停靠数值”为由重新发起总体路线审批。
- 资产：两张用户原图仍缺，不要求按未见图像像素复刻；仅依据已确认文字做占位空间同步。不得生成替代图冒充原图、宣称已归档或顺带制作正式美术／新地名／新对白。图片归档作为独立阻塞项保留。
- 恢复／身份：出生与备用安全锚点、失败区、初始快照与平台恢复必须适配新几何，不能照搬旧上层 D 坐标。任务已接取、机关完成、OPEN 效果与任务完成永久保留，临时运动可回退；已开路线恢复后仍可通行。沿用原业务身份和幂等，不为 R／恢复重新建业务链，不削弱 A3-R1 资源门槛。
- 非目标：正式美术、最终 Matter 选择、存档、任务／奖励扩展、额外检查点网络、通用地图编辑器或重大框架重构。不改项目最终名称、包名、appId 或用户数据身份，不覆盖既有改动。

| 用例 | 验收标准 |
| --- | --- |
| SA01：实际空间 | 正常出生在明确呈现解放碑的 A，B 入口／游客／线索可达；C 有可辨认的多层下行，D 是下层江岸。核对真实地形高度与路线，不只检查标签／数值比较。 |
| SA02：主线与机关 | 普通键盘从 A 经 B 对话／线索、C 错误再正确操作、真实平台辅助通行到 D；全部条件后主动拍摄分享完成。完整路线不用传送、调试按钮或直接写状态。 |
| SA03：失败恢复 | 接委托后及机关开路后各实际坠落并恢复，保留进度／OPEN、重新建立安全支撑和占用；平台瞬时位置回退不把路线锁死，重复交互不增身份／奖励。 |
| SA04：暂停与输入 | 对话／平台运动期间真实隐藏或原生最小化，恢复不追赶、不自动跳跃／交互；重置不覆盖原快照，其他 owner 不被解锁。共享资源门槛与旧实验室语义保留。 |
| SA05：三端与证据 | 当前版本 Chrome Web、Electron 开发版及仓库外独立包同一配置真实跑通，截图／录像含 A 出生、B、C 多层路线、平台和下层 D；记录端点原型、报告／产物哈希、实际退出／清理与未覆盖项。 |

必须验证：类型检查与 `npm.cmd test`（保留原有效语义）、`npm.cmd run electron:build`、扩展现有 `npm.cmd run test:d12-a1 -- --browser=chrome` 覆盖新路线、`git diff --check`。如调整共享恢复，补相关旧实验室／资源门槛回归；可合并会话，不无理由重跑所有历史长套件。更新测试坐标／行进步骤须跟随实际新几何，不能通过关闭失败区、放宽断言或瞬移让整条路线假通过。

预期产物：当前源码与必要测试、准确运行入口、一个正常可玩窗口、新地图截图／报告及 README 的实际操作说明；在本文补实施事实和证据，将正式文档需要变化的差异提交 Work。所有结果用 PASS／FAIL／BLOCKED／NOT RUN，原失败保留。完成后等待 Work 审查，不启动下项，不 Commit／Push／发布。本次只生成该任务卡／提示词，未授权当前文档核对过程自行实施它。

### 2026-11-14 D12-A3 执行结果

基线 HEAD 为 `726d337`。实现新增共享 `FIRST_LEVEL_SPATIAL_CONFIG`，作为 Matter、Phaser、快照锚点和测试同一坐标源：A 解放碑 → B 沧白路／洪崖洞入口 → C1 上层木廊 → C2 中层街巷 → C3 下层檐廊 → D 下层嘉陵江岸。真实地形上缘依次为 B `260`、C1 `355`、C2 `430`、C3 `500`、D `620`；出生 `80,278,1`，备用 `360,278,1`、`480,238,1`，失败区 `y=720`。

唯一升降辅助通路对象仍为 `first-level-service-lift`，原型参数为 `x=1645`、`y=509→629`、`7200 ms`，明确记录 `TO_VALIDATE`。路线门、业务 Event／Command／Transaction／Result 身份、单线索、单机关、错误重试、正常关闭 NPC 对话后才接取和全部通关条件均保持。R 与恢复保留任务、机关、OPEN 及完成效果，只回退角色和平台临时状态。

| 用例 | 状态 | 证据 |
| --- | --- | --- |
| SA01：实际空间 | PASS | 真实 Matter Body 高度、A／B／C／D 支撑和锚点有效；另核对出生与两部分备用锚点。 |
| SA02：主线与机关 | PASS | 三端真实键盘完成 A→B→C1／C2／C3→下降平台→D，并主动拍摄分享。 |
| SA03：失败恢复 | PASS | 接委托后与开路后各一次真实坠落；原业务身份、目标、永久效果和 OPEN 路线保持。 |
| SA04：暂停与输入 | PASS | 平台下降期间真实 hidden／原生 minimized 冻结 Tick、位置和路径时钟；恢复不追赶、不自动跳跃，R 不覆盖快照。 |
| SA05：三端与证据 | PASS | [run-uz0UtE](../test-results/platform/run-uz0UtE/report.json) 的 Chrome Web、Electron 开发版和仓库外独立包均 PASS；三端退出码 `0`、清理失败为空、无非预期中断。 |

三端业务身份一致：Quest `1/1/1/2`、Lift `4/2/2/5`、Complete `7/3/3/8`。平台暂停／恢复首 Tick 分别为 Web `2151→2151`、Electron 开发版 `2164→2164`、独立包 `2168→2168`。截图位于 [D12-A3 证据目录](../test-results/d12-a3-20261114/)，覆盖 A 出生、B 接取、C1／C2／C3、下降平台、D 江岸、完成态及桌面端。

当前源码 Electron 体验窗口已另行启动并保留：PID `26112`、HWND `39980398`、标题“叠城大冒险 | Layered City Adventures”、URL `http://127.0.0.1:61034/?platform=windows`。[当前窗口截图](../test-results/d12-a3-20261114/experience-current.png)及[启动记录](../test-results/d12-a3-20261114/experience-launch.json)已保存。旧体验窗口未关闭；启动日志中的 Chromium cache-lock 警告来自两个开发窗口共用原有 userData，当前页面正常渲染，但多窗口缓存隔离仍是开发环境限制。

实际执行：

| 检查 | 状态 | 结果 |
| --- | --- | --- |
| `npm.cmd test` | PASS | 类型检查、Electron Main 编译通过；`172/172` PASS，0 fail、0 skipped。 |
| `npm.cmd run electron:build` | PASS | Vite 32 modules；Windows x64 免安装目录生成，仅有既有体积／author／图标警告。 |
| `npm.cmd run test:d12-a1 -- --browser=chrome` | PASS／最新复跑 FAIL | `run-uz0UtE` 三端 PASS；修复 SA01 夹具自身占位后生成 `run-Jc0SLc`，Web 被前台 `ChatGPT` 抢焦点触发真实 `blur`，Electron 开发版与独立包仍 PASS。两个报告均保留。 |

版本证据：ASAR `D0306C4E511D6E374D701D03882B39E1B5F067F175B5CB9E102BE2A3B82FF98D`；EXE `ACC371E78647005A196E89C4857CB9EF93BFE852756A83240FC0AB20545C5345`；`run-uz0UtE` 报告 SHA-256 `9D985EFD4DF5C1EDED05D2D1A7BE840AF84FAAE3130355063B0440159ED4DE9A`；`run-Jc0SLc` 报告 SHA-256 `D8A7F93AAAA819FDADE6906466EBC254F6CE0544D8E18FFF94D190B87EA5B354`。当前 `tests/first-level.test.mjs` 为 `DA9398098C923B2DE661256B06DA442BD85B72A82307AF2565B09A4F905B52CA`；与成功报告所用版本的差异只为验证前移开夹具玩家 Body，应用源码及浏览器路线未变。

历史失败保留：`run-D4GJNT` 为 NPC 提示未同步；`run-MKbxH6` 为 C2 边缘按键过早；`run-gedARw` 为真实 `blur`；Web 定向成功轮 `run-tGQlx0` 先于三端成功。两张用户原图仍缺失，图片归档和按图匹配 BLOCKED；本次只按文字方案同步占位空间，不宣称按图复刻。Edge、独立人工长期手感、正式美术、存档、正式检查点和完整 MVP-G01–G06 仍 NOT RUN。当前状态 DONE（待 Work 审查），不进入 D13，不 Commit／Push／发布。

### 2026-11-14 D12-A3 Work 审查

HISTORICAL／既有未提交草稿：本小节原文保留。其“重新执行 172/172”和“已收口”为开始前原稿记述／建议，不是本轮执行声明或已批准状态；本轮实际只读复核与现行状态以文首补充为准。

审查基线为 GitHub `main`、本地 `HEAD`、`origin/main` 三者一致的 `731ac55ccc1a58e659801fdb783127b56a4f09dc`，开始时工作区干净。审查仅修改本路线图的审查与后续任务登记，不改 D12-A3 源码、测试、物理参数、CONFIRMED 决策或 D13 任务范围；本轮未 Commit、Push 或发布。

| 审查项 | 结果 | 证据与边界 |
| --- | --- | --- |
| 当前首关自动化 | PASS | 重新执行 `npm.cmd test`：类型检查、Electron Main 编译及 `172/172` 测试 PASS，0 fail、0 skipped。 |
| SA01–SA05 实现证据 | PASS | [run-uz0UtE](../test-results/platform/run-uz0UtE/report.json) 的 Chrome Web、Electron 开发版、仓库外独立包均 PASS；`cleanupFailures` 为空，进程退出码均为 `0`。报告 SHA-256 为 `9D985EFD4DF5C1EDED05D2D1A7BE840AF84FAAE3130355063B0440159ED4DE9A`。 |
| 当前应用版本对应关系 | PASS | 当前 `src/physics/matter/first-level-world.ts`、`src/core/first-level.ts` 和 ASAR 分别为 `7CE945E364597DD4891E81AC97DDDD957E920E137F7CF6BC6258BA0F4BDF103B`、`2F84DCF0079A35762512D66457A62E5ED3472654CBE4DBAF2ACC2C813CB0B34E`、`D0306C4E511D6E374D701D03882B39E1B5F067F175B5CB9E102BE2A3B82FF98D`，与 `run-uz0UtE` 一致。 |
| 最新夹具复跑 | FAIL，外部焦点中断 | [run-Jc0SLc](../test-results/platform/run-Jc0SLc/report.json) 中 Chrome Web 在 `first-level-UX03-UX05-default-layout-debug-toggle-and-viewports` 发生真实 `blur`；Electron 开发版与独立包 PASS。应用源码和 ASAR 哈希与成功报告一致，仅 `tests/first-level.test.mjs` 夹具哈希变化；现有证据不能归为物理或空间布局回归。报告原样保留，不改写为 PASS。 |
| 未覆盖范围 | NOT RUN | 按图匹配、新空间验收、Edge、独立人工长期手感、正式美术、存档、正式检查和完整 MVP-G01–G06 仍未执行或未验收。 |

结论：D12-A3 在原有 SA01–SA05 范围内收口。该结论不覆盖最新 Web `blur` 的环境失败，也不赋予第二布局、Tiled、大关卡装配或 D13 自动通过资格。平台端点、速度、周期及工程坐标继续为 `TO_VALIDATE`，Matter 仍不是最终物理选型。

### 2026-11-14 MLV-01A／B 任务登记

原 MLV-01 合并方案不直接下发。当前 `FirstLevelMatterWorld` 虽然部分读取 `FIRST_LEVEL_SPATIAL_CONFIG`，但构造后的快照场景、出生、升降平台、永久效果、冻结／捕获／应用、恢复重建、世界一致性校验、锚点探测、玩家放置、reset、失败区和诊断仍直接引用首关常量；若只改构造函数，第二布局会在恢复或重置时读回首关数据。核心物理配置化和宿主／三端生命周期清理又需要不同证据层级，因此拆为两个阶段门槛明确的独立任务。

| 任务 | 当前状态 | 依赖 | 范围 |
| --- | --- | --- | --- |
| MLV-01A：受限关卡描述、全生命周期物理配置化与双布局真实 Matter 验证 | BLOCKED（Work 复现两项终止缺陷，待 R1） | D12-A3 原范围 Work 复核已记录；负责人已批准收敛后的 A 范围，不据此改写 D12-A3 状态／历史 FAIL | 数据校验、首关定义提取、Matter 适配器全生命周期配置化、统一物理装配、独立 Engine 双布局测试、核心／适配器销毁与首关回归。实施证据见文首记录。 |
| MLV-01B：Phaser 测试地图、调试入口与宿主三端生命周期验证 | PLANNED | MLV-01A 实现、测试及 Work 审查通过 | 测试地图表现、调试入口、应用输入／可见性监听清理、场景切换、Chrome Web、Electron 开发版和独立包显式 `--level-assembly` 验证。 |

本登记现仅授权 MLV-01A。负责人批准的是本阶段实施边界，不将概念架构升级为正式通用架构；A 未经 Work 审查前不得开始 MLV-01B，不得把 A 的纯 Matter 结果描述为宿主或三端验收。

#### MLV-01A 最小实现边界

原稿保留说明：以下边界、矩阵和短提示词由文首本轮补充收敛／取代；玩家／脚底参数、未知版本／身份、销毁范围、允许文件及测试口径均以本轮补充为准，不从旧宽泛表述扩大 A。

- 目标：建立受限、可校验的 `PrototypeLevelDefinition`，把现有首关描述迁入该定义，并让同一 Matter 适配器从构造到销毁全程只读取所注入定义。用首关布局与一套独立测试布局验证装配，不建立关卡编辑器、通用 ECS、任意对象注册系统或 Tiled 运行时。
- 定义范围：只允许当前实际适配器支持的数据，包括 levelId、空间尺寸、出生／备用锚点、失败区、静态地形、必要固定 Body、一个升降平台、路线门、快照场景、唯一可适配的移动平台临时对象、永久路线效果 ID、玩家／脚底原型和诊断身份。未知字段、未知类型、未支持对象版本或首关专用业务字段应拒绝。
- 全生命周期：构造、出生、地形与全部物理对象、平台运动、永久效果、初始及运行中快照、冻结、捕获、应用、恢复重建、世界一致性校验、锚点验证、玩家放置、reset、failureZone 和 diagnostics 均从同一实例定义读取；不得在该实例生命周期中回退读取 `FIRST_LEVEL_*` 常量。
- 算法冻结：保留现有 Matter 运动、支撑、承载、碰撞、固定步、恢复与资源门槛算法。配置化只替换数据来源；不得借本任务调整速度、重力、容差、跳跃、恢复顺序或碰撞语义。
- 一致性：`PrototypeLevelDefinition.levelId` 与快照场景一致；至少一个 checkpoint，checkpointId 唯一，default checkpoint 存在；spawn anchor 与初始 checkpoint anchor 完全一致；fallbackAnchor 保持配置顺序；快照 registry 中每个 objectId 对应唯一真实移动平台，类型／axis、stateVersion 和 schemaVersion 得到适配器支持。
- 身份隔离：第二布局必须使用独立 levelId、checkpointId、平台对象 ID、路线效果 ID、Body label、失败区 ID 和 Runtime UUID 来源。不得创建或读取首关任务、奖励、永久进度记录，也不得复用首关 `first-level-*` 业务身份。
- 物理隔离：两个布局分别创建独立 `Matter.Engine`；不得共享 World、Composite、Body、快照、进度或 runtime context。销毁或推进一个布局不得改变另一个。
- 资源所有权：Matter tests 的最小装配 helper 拥有其创建的 Engine；适配器只移除本实例创建的 Body，不擅自清空宿主提供的其他 Body。Phaser 中的 Engine 继续由 Phaser 宿主拥有，B 阶段接入时必须遵守这一边界。
- 销毁语义：适配器和 `createGrayboxCore` 增加最小生命周期终止入口。重复销毁幂等；销毁后 `core.frame()` 不推进 Tick，`core.key()` 不改变输入／交互／业务状态，不再产生副作用。应用自绑的窗口输入和 document 可见性监听属于 B 阶段宿主装配；Phaser 3 在 `Game.destroy()` 后保留的第三方 document 级监听必须单独记录，不计作本项目资源。
- 部分装配失败：装配顺序固定为创建 Engine → 创建适配器 → 创建共享核心。任一步失败或注入失败时，按逆序释放已创建资源，移除已登记 Body，保持其他 Engine／布局不受影响；清理本身失败必须保留可检查错误，不能报告成功。

#### MLV-01A 验收矩阵

| 用例 | 可执行验收 | 预期证据 |
| --- | --- | --- |
| V01：描述与校验 | 合法首关定义和合法测试布局定义通过；未知 schema／type／version、重复 level／checkpoint／object／Body ID、缺失 default checkpoint、无效有限数值、spawn 与初始 anchor 不一致、未知 registry 对象均被拒绝。 | 表驱动单测记录每个拒绝码；拒绝发生在创建 Matter Body 和捕获快照之前。 |
| V02：全生命周期配置化 | 用测试布局的非首关坐标、label、platform ID、effect ID、failureZone 和 diagnostics 执行构造、step、永久效果、initial capture、freeze／capture／apply、rebuild、validate world、validate anchor、place player、reset。另执行恢复路径。 | 测试布局返回的状态全部保留测试布局身份；任何检查不得看到 `first-level-*` 常量或首关坐标。首关行为回归与原测试一致。 |
| V03：双布局与隔离 Engine | 同进程创建首关布局和测试布局，各自独立 Engine、runtime UUID 和 Tick；分别推进、暂停、捕获、恢复、销毁。 | 两套 Body／快照／业务记录不交叉；推进或销毁一个后另一个继续按原状态工作；测试布局的进度持久记录为空。 |
| V04：快照 registry 一致性 | 校验 levelId、checkpointId、spawn／initial anchor、registry objectId、axis 类型、object stateVersion、scenario schemaVersion；测试布局不得复用首关任务、奖励、effect 或对象 ID。 | 合法场景可捕获／应用／重建；未知对象、未知版本、重复 ID、跨布局 checkpoint 和首关身份注入均 FAIL 且无半记录。 |
| V05：资源所有权与幂等销毁 | 适配器只移除自身 Body；测试 helper 创建的 Engine 只由 helper 清理；核心销毁后 `frame/key/reset` 不产生状态副作用；双重 destroy、部分装配失败和清理中断可检查。 | Body 前后数量、Engine 是否保留、Tick／输入／进度不变、重复清理次数及错误状态均有断言；一个布局销毁不影响另一个。宿主监听清理标记为 B／NOT RUN。 |
| V06：首关回归与阶段门槛 | 新增 `tests/level-assembly.test.mjs` 及必要的现有测试扩展；执行定向测试、`npm.cmd test`、`npm.cmd run electron:build`、`git diff --check`。 | 原有测试全部保留，新增 V01–V05 自动化 PASS；生产构建 PASS；首关现有 172 项语义无回归。GUI 三端、真实窗口监听清理和 `--level-assembly` 标为 NOT RUN，交由 B。 |

#### MLV-01A 测试命令与证据边界

- 定向测试可执行 `node --experimental-strip-types --test tests/level-assembly.test.mjs`；全量核心回归执行 `npm.cmd test`。不得把 `npm.cmd run test:d12-a1 -- --browser=chrome` 当作完整首关回归，该入口当前用于 D12-A3 的 `first-level-dialogue-completion-and-play-readability` 平台场景。
- A 阶段可执行 `npm.cmd run electron:build` 验证现有应用仍可构建，但不得声称 Phaser 测试地图、调试入口或宿主监听清理已通过。
- A 完成后报告定义 schema、配置字段、销毁所有权、V01–V06 结果、源码／测试哈希、ASAR／EXE 哈希及未覆盖项，等待 Work 审查；不自动开始 B。

#### MLV-01A Codex 开发提示词

```text
项目：D:\Workspace\Code_Projects\mountain-city-last-delivery

只执行 docs/DEVELOPMENT_ROADMAP.md 第 7 节的 MLV-01A；该任务当前必须是负责人批准后的 READY 状态。开始前阅读 AGENTS.md、本路线图、DECISIONS.md、首关设计及当前 Matter／快照／恢复代码，检查 Git 并保留已有修改。

实现受限 PrototypeLevelDefinition、完整校验和统一物理装配。把现有首关数据提取为第一个定义，并建立一套使用独立 levelId、checkpointId、对象 ID、effect ID、Body label、Runtime UUID 且不接触首关任务／奖励／进度的第二布局。FirstLevelMatterWorld 或等价适配器必须从构造到销毁只读取实例定义，覆盖出生、地形和全部 Body、平台运动、永久效果、快照冻结／捕获／应用、恢复重建、世界校验、锚点验证、玩家放置、reset、failureZone 与 diagnostics。

保留现有物理算法，只替换配置来源。两个布局必须使用独立 Matter.Engine。明确 Engine、适配器 Body、共享核心和应用监听的所有权；实现最小 destroy／dispose、幂等重复销毁、部分装配失败逆序回收，以及销毁后 frame/key 不再生效。Phaser 3 的第三方监听单独记录。

按 V01–V06 先补红灯测试再实现，验证非法 schema／type／version、重复或跨布局 ID、anchor 不一致、未知 registry 对象、无半记录、双 Engine 隔离、非法版本／身份／缺对象恢复预检零写入、适配器清理、核心销毁、部分装配失败和首关回归。第二布局不得使用首关任务、奖励或永久进度身份。

执行定向 tests/level-assembly.test.mjs、npm.cmd test、npm.cmd run electron:build、git diff --check。不要新增依赖，不建关卡编辑器／通用对象框架／Tiled 运行时，不改物理参数、CONFIRMED、D13，不做 Phaser 测试地图、调试入口、宿主监听或三端验收，不 Commit／Push／发布。更新 README 与路线图实际证据，按 V01–V06 报告 PASS／FAIL／BLOCKED／NOT RUN 后停止，等待 Work 审查。
```

#### MLV-01B 规划边界

- 只有 MLV-01A 经 Work 审查通过后，才能建立测试地图的 Phaser 表现和调试入口。B 复用 A 的定义、装配和核心测试结果，不重复建设第二套物理逻辑。
- B 必须证明应用自有 `keydown`、`keyup`、`blur`、`focus` 和 `visibilitychange` 监听在场景切换／销毁时被解除，旧回调不能继续操作已销毁 core；Phaser 3 内部 document 级监听单独记录，不伪装成本项目已清理。
- B 的平台入口必须增加明确分支，例如 `npm.cmd run test:level-assembly -- --browser=chrome`。报告 `task` 必须为 `MLV-01B`，`scope` 必须为 `prototype-level-dual-layout`，记录 Chrome Web、Electron 开发版、仓库外独立包及各阶段 PASS／FAIL／BLOCKED，且不得沿用 D12-A3 的 task／scope。
- B 未通过前，不得把 A 的真实 Matter 双布局结果描述成双端或宿主装配完成。

### 2026-11-14 首关空间方案 A 正式同步与图片归档

HISTORICAL：本小节记录原图取得前的路线与归档要求；路线 CONFIRMED 继续有效，缺文件结论已由后续 `2547b32` 原样归档与完整性登记取代，不是当前阻塞项。

负责人本次明确确认：解放碑出生与教学 → 沧白路与洪崖洞入口 → 多层吊脚楼自上而下探索 → 下层嘉陵江岸 → 拍摄／分享 → 首关完成。A 不能设在洪崖洞或不含解放碑定位的普通街道；单线索／单机关、错误可重试、既有通关条件及永久／临时规则不变，首关不增加历史卡、隐藏收藏或额外支线。正式依据见 [DECISIONS](DECISIONS.md#2026-11-14首关空间布局与-cd-方案-a)。

图片 A 只作风格参考，图片 B 修正版为现行空间概念参考；旧未明确解放碑出生点的初稿仅作 HISTORICAL，不再是现行依据。两图均不冻结具体坐标、碰撞、平台运行方向或停靠点，不能仅凭概念图改变技术选型／物理参数。

计划归档至 `docs/assets/art-direction/first-level-visual-concept-v1.png` 与 `docs/assets/art-direction/first-level-layout-v1.1.png`。本次可访问消息与附件目录没有两张原图，故图片存在／内容核对为 BLOCKED，不创建占位图、不复制旧图顶替、不声称已经归档。收到后原样复制并核对 PNG 格式、图 A／B 身份、修正版及源／目标哈希，再启用美术文档的仓库相对引用；文字决策不因缺图退回 PROPOSED。

本次只同步五份设计文档并准备归档目录，未改应用源码／Matter／地图／包配置，未执行运行测试或 Git 提交。原上行代码仍是待修实施差异，后续独立地图同步任务应同时验证地面／门／平台、安全锚点、快照与永久开路；不因为本次决策登记就自行开始实现。

### 2026-11-14 D12-A2 Work 收口与 D12-V1.1 放行

HISTORICAL：以下保留当时的验收与原型安排，路线尚待确认的说法仅描述当时状态；现行方案 A 与修正版参考图以上方最新同步记录为准。

基线 `858f7fb`，已有 D12-A2 源码／测试／README 改动、美术文档及其他规划改动全部保留。Work 阅读正常关闭激活与中断分离的共享交互实现；重新执行 `npm.cmd test`，171/171 PASS，0 fail、0 skipped，类型检查／Electron Main 编译通过。独立重跑旧真实 Matter NPC 复现：打开后推进 12 步仍 investigation、questAccepted=false、quest phase=idle、goals=0；正常 Escape 后推进业务，questAccepted=true、phase=succeeded、goals=1，未重复接取。

`run-k5NJOY/report.json` 明确为 D12-A2，36 项版本记录全部匹配当前文件，Chrome Web／Electron 开发版／独立包均 PASS、code 0、清理 PASS、cleanupFailures 为空。报告 SHA-256 为 `68B13DFE636F4D54840DEC970F6FC5D6771FB0DC2C853E10C310A9235E653CC8`。Work 查看已有 `web-1280x720.png` 的正常画面：默认调试区收起、范围圈与 Tick 不常驻、可见角色／游客和单一目标；这是截图检查，不是本轮实际运行或独立人工通关。本轮未重跑构建／GUI，历史 FAIL、Edge 与人工未覆盖限制保留。

A2 及 A1 当前切片交互缺口收口；ART-ROUTE-01 仍存在，源码平台仍从 y=549 升至 y=309。负责人上一项文档任务明确要求推荐处置等待确认，当前不能把“安排下一任务”泛化为修改正式路线的授权。美术文档允许确认前制作两种路线的标注草图，因此下项先交付具体黑白原型，不新增长篇背景文档，也不继续补框架。

### D12-V1.1 任务卡：首关黑白空间布局对照原型

HISTORICAL：以下为负责人明确方案 A 和指定修正版图片 B 之前的原任务，保留原文追溯，不再作为当前实施授权。当前以本节顶部的图片归档／空间同步记录为准；不继续要求“先选路线”或生成替代用户原图。

**目标**：交付三张实际可打开、可比较的黑白空间图和一个查看入口，让负责人能看见现代码与下行推荐的差别，并为路线处置提供具体评审对象。对应美术文档的 V1.1，不是重新开发灰盒，也不是仅再写一份文字方案。

**依据与输入**：AGENTS、DECISIONS 最新视觉方向 B、ART_DIRECTION_AND_SCENE_PROTOTYPE 第 7–10 节、HONGYADONG_LEVEL_DESIGN 已确认四区／向下探索、首关任务冻结、现有 `first-level-world.ts`／`first-level.ts`／Phaser 场景。先核对实际 Git 与当前源码，不照抄聊天坐标，不覆盖既有修改。

**产物与范围**：可在 `docs/art-prototypes/v1.1/` 新建少量独立文件：`current-layout.svg`、`descending-layout-proposal.svg`、`c-cutaway-proposal.svg`、`index.html`；输出清晰 PNG 预览／实际渲染截图供直接评审。路径是本次工程安排，不是新的项目资源管线决策；避免另建重复 Markdown 报告，解释集中在查看入口和现有美术文档。

1. 现代码布局图：从实际代码抽取 A／B／C／D 相对位置、地面／台阶、出生点、NPC、唯一线索、单装置两个操作位、路线门、升降平台上下端点、D 拍摄点及失败区域。忠实画出 C 低位到 D 上层的上行关系，标注“当前实现，非最终路线批准”。可使用统一缩放，记录坐标来源与基线；不要把当前单层 C 画成已经实现多层建筑。
2. 下行候选图：保留 A→B→C→D 和既有任务／单谜题，画出 B 高处、C 上中下层楼梯／走廊、一个装置与升降通路，最后接 D 下层江岸。明确“PROPOSED，待负责人确认，非游戏坐标”。只组织已有玩法，不加分支、收藏门槛、第二条线索、第二机关或新移动能力；示意相对高度，不冻结平台尺寸／速度或新安全锚点。
3. C 区剖面候选图：展示吊脚楼柱脚、横梁、楼板、木走廊、楼梯及一段升降通路，分清玩法面和背景／前景结构。包含可见玩家尺度参考，主线箭头从上到下；与下行候选保持同一出口关系。没有身体／碰撞模型验证的距离标注为示意，不用草图声称跳跃可达。
4. 图例和视觉：纯黑白／有限灰度，靠实线／虚线、线宽、箭头、标签区分可走面、装饰、平台运动、任务对象与候选状态；不要使用成套彩色风格／夜景色板冒充 V1.3。重点是空间拓扑、建筑剖面与可读性，远近景只用轮廓交代，不提前制作正式美术资产。
5. 查看入口：一个不依赖后端／构建的静态页面展示三图，能缩放／看清中文图例并列出现状与候选，附简短差异和影响清单。两种路线均明确状态，不提供“应用到游戏”按钮，不改根目录 `index.html`，不创建新游戏入口或覆盖当前可玩场景。
6. 处置说明：重申 Work 推荐保持原设计的 C 下行、D 下层江岸，但不能替负责人确认；列出将来需要一起调整的地图、平台、导轨、门、镜头、出生／备用锚点、快照与永久开路回归。当前只画候选，不自动实施任何项。

| 用例 | 验收要求 |
| --- | --- |
| VP01：现状准确 | 对照源码逐项核对 A–D、上行平台及关键对象，不遗漏唯一线索、装置、拍摄点和坠落区；图上坐标／比例有出处，不把候选混入现状。 |
| VP02：候选可读 | 主线 A–D、C 向下层叠、D 下层江岸、单线索单装置及平台出口清楚；候选图和 C 剖面彼此一致，无新增玩法。 |
| VP03：状态与权限 | 每图可直接看到“当前实现”或“PROPOSED”，路线处置仍待确认；没有任何源码／碰撞／任务／ID／配置改动，也不把制作图稿当成正式决策。 |
| VP04：实际渲染 | 使用已有工具在 Chrome 实际打开查看入口／SVG，检查中文、箭头、图例、缩放、重叠和裁切，保留真实截图及可分享预览。静态解析通过不等于渲染通过；未验证跳跃、物理或 Electron 运行则 NOT RUN。 |
| VP05：交付与完整性 | 所有本地引用有效，图稿能脱离开发服务查看，保留编辑源和 PNG／截图；更新现有美术文档阶段状态及路线图证据，候选审美／路线评审仍待负责人，不标成已批准布局。 |

**模块边界与验证**：只增加独立图稿／查看文件并维护确受影响的文档，不改 `src/`、Electron、根页面、package／锁文件、物理碰撞或现游戏默认入口；不新增依赖、不安装工具、不改技术选型。优先用可编辑 SVG 表达这种工程空间图，不要求图像生成服务。记录实际渲染方法、文件版本、本地链接／SVG 解析与 `git diff --check`；既然不改应用，无须重跑 npm 全套／生产构建或三端游戏套件，明确 NOT RUN 原因。查看页面的通过只表示文档原型可显示，不能记为游戏验收 PASS。

**风险与停止**：代码读到的位置与文档不一致时标出现状，不修源码来匹配图；候选需要未经确认的新玩法才可连通时收缩为已定玩法，不自行批准新能力。完成后输出图稿预览、差异和待确认的路线处置，等待 Work／负责人审查，不进入 V1.2／V1.3、游戏内切片或 D13，不 Commit／Push／发布。当前可独立制作对照图，不需要在画图前再次要求负责人批准最终路线。

2026-11-14 美术文档维护时的历史范围：当时仅整理[美术风格与场景原型](ART_DIRECTION_AND_SCENE_PROTOTYPE.md)，未启动 D12-A2 代码实施或替换灰盒。视觉方向 B 已确认，制作参数／原型细则仍 PROPOSED。ART-ROUTE-01 已登记 C 下行／下层江岸设计与现代码上行 D 的冲突；推荐处置等待负责人确认。原 A2 对话／UI 修正不因此变为改图授权；C/D 最终高差、绑定布局的美术定稿与游戏内切片接入须在处置明确及后续单项授权后执行，不能把美术图稿或当前自动化报告算成路线冲突已解决。当前具体任务以本节顶部最新登记为准。

### 2026-11-14 D12-A1 Work 审查与 D12-A2 放行

实际 HEAD 为 `858f7fb`，开始审查时工作区干净，与开发报告中的“全部未提交”表述不同；Work 本轮没有提交、暂存或回退操作，以实际 Git 为准。Work 阅读首关流程、单场景 Matter 世界、共享进度／事务接线、默认启动、首关测试及已有画面。重新执行 `npm.cmd test`：168/168 PASS，0 fail、0 skipped，类型检查及 Electron Main 编译通过。

`run-TJOXd1/report.json` 为 D12-A1 三端 PASS，全部 34 项版本记录匹配当前文件；三端进程 code 0、清理 PASS、cleanupFailures 为空。报告 SHA-256 为 `F69FDB3ECD3D3CFCBDAC7A58E03A543627E39524A251F063BECD911B19CCCA35`。Work 本轮未重新构建／运行 GUI，查看了已有 `test-results/d12-a1-20261114/web-c-route-open.png`，不把截图检查当作人工通关或本轮重跑三端测试。主体 A–D 流程、真实平台、业务与恢复证据有效；历史 FAIL 保留。

确定缺陷：首关 NPC 配置 `activateOnOpen: true`，共享交互在打开调查时立即调用业务激活，实际与文案“对话结束后自动接取”不符，也与 QUEST_SYSTEM_DESIGN 当前任务表“完成对话并了解委托后”不符。Work 在内存中复用真实 `tests/first-level.test.mjs` fixture，放置到 NPC 后按 E 打开，不按 Escape／关闭，推进 12 步：仍为 investigation、activeId 为 first-level-b-npc，但 questAccepted=true、goals=1、quest flow=succeeded。测试夹具仅用于复现，不冒充正常主线游玩；原正常流程测试太快关闭面板，未覆盖这一边界。

画面可读性也需本轮收敛：交互范围椭圆、玩家脚底／失败区域调试表现和 Tick／开发阶段标签常驻，页面与画布重复目标面板，业务反馈直接提及“请求／事务”；左、右选项先用绿／红区分，易在观察环境线索前暗示正确答案。它们不是底层架构缺口，不再扩展基础框架。A1 保留主体实现和通过证据，完整验收待 A2 修正对话时序并做当前版本回归后收口。

### D12-A2 任务卡：首关对话完成时序与游玩可读性

- 目标：使当前首关符合“主动完成对话后自动接取”，并在正常窗口里用清晰的角色／场景／交互／目标呈现完整主线。沿用 A1 几何、机关规则、任务内容和核心，无新玩法或关卡重做。
- 依据：AGENTS、DECISIONS 首关 MVP 冻结、QUEST_SYSTEM_DESIGN 首关任务表、PLAYER_CONTROL_DESIGN 的交互控制／暂停／持键规则，以及本节 Work 复现。读取 `first-level.ts`、`interaction.ts`、首关 Phaser 表现、Web 入口与样式、现有首关测试；先核对 Git，不覆盖其他窗口工作。
- 对话正常完成：打开 NPC 对话只进入对话／控制限制状态，不创建接取业务事件、命令、事务或永久记录；玩家读完本次短对话并正常结束（现有关闭按钮或 Escape）后提交且仅提交一次接取请求，仍经固定协调阶段的原业务链完成，无接取／拒绝弹窗。用最小、显式区分的完成／中断原因，不把所有调查 close 都默认当成提交。
- 对话中断：坠落恢复、R 重置、场景销毁等系统中断只清理本交互，不提交未完成委托；隐藏／最小化或失焦沿用既有暂停／输入规则，不偷偷结束对话或接取。恢复后可正常完成；已接取 NPC 重复交互、重复关闭、按键 repeat 不创建第二套业务身份。不要通过计时自动关闭、读取提示文字或 DOM 回调直接写进度实现。
- 核心职责：可为共享交互补一个最小完成回调／结果及明确关闭原因，或使用现有等价入口；只对配置需要的对象生效，保留实验室调查／拾取原语义。正常结束动作进入原首关共享流程，不复制任务状态；释放自身控制 owner，保留其他 owner、暂停和 needsRelease 门槛。
- 玩家画面：正常模式隐藏交互范围圈、碰撞／脚底／失败 sensor、Tick、Runtime／事务编号及 D12 开发标签，放到已有调试开关；实际物理／交互范围不因此改变。保留清楚的当前目标、靠近时 E 提示和必要反馈，合并画布与页面的重复信息，避免大段面板挤占场景。普通玩家反馈使用“委托已接取／平台启动中／路线已开放／拍摄完成”等实际状态，不展示内部事务术语，也不能在提交未成功时提前显示成功。
- 装置与线索：保持一个控制装置的左右两个操作选项，视觉上画成同一装置的两个部位／控制位，保持各选项正常输入和唯一选择。未操作前不以成功绿／失败红直接标答案，不在普通操作提示中提前写正确选项；B 区保留一条实际可观察的灯带／图形线索及原有简短说明，装置上能找到对应关系。错误反馈可鼓励重新观察，正确后再呈现成功状态；不增加第二条线索、额外机关、读线索硬门槛或复杂动画。
- 场景区分：用现有 Phaser 基础图形提供易辨认的玩家／NPC 轮廓、装置、平台与观景标记即可，替换诊断点的语义；保持层叠街巷占位背景。不引入资产依赖、生成整套正式美术、改写地名／正式对白或改变物理手感。截图应能辨认人物、可走地面、装置及当前目标。
- 布局：Chrome 1280×720 与 1920×1080 客户区做实际检查；Electron 在当前可用窗口尺寸检查。正常模式主玩法、目标和 E／关闭操作应在窗口内可见，不依赖滚动整页寻找交互按钮；长对话可在受限面板内滚动，不把页面滚动作为正常操作流程。保留调试入口，默认收起，布局选择属于工程原型。

| 用例 | 验收内容 |
| --- | --- |
| UX01：先红后绿与正常结束 | 复现打开 NPC 对话后等待仍未接取、零接取业务身份；分别用关闭按钮／Escape 正常结束后创建唯一业务链，事务成功后更新目标。保留修复前 FAIL 和修复后证据。 |
| UX02：中断／重复隔离 | 打开后系统中断不提交；隐藏／最小化保持对话且无自动提交，恢复后正常结束一次。重复关闭／对话、持 E／repeat、恢复旧输入均不重复接取，不解除别人的控制限制。 |
| UX03：默认画面与线索 | 默认无诊断椭圆／碰撞／Tick／事务文案，目标不重复遮挡；装置只有一个且选项不提前标正确／错误，环境线索仍可发现并解释操作。切换调试仅影响显示，不能改业务。截图和检查记录如实说明主观可读性，不宣称人工手感测试。 |
| UX04：主线与恢复回归 | Chrome Web、Electron 开发版、仓库外独立包用正常输入完成当前 A–D，保留任务接取／机关后真实坠落、OPEN 路线、平台承载、拍摄条件和重复互动幂等。测试等待新的“对话完成”边界，不能继续靠打开即接取取巧。 |
| UX05：窗口与操作 | 记录两种 Web 尺寸及 Electron 实际客户区，截图含 A、B 对话、C 未解谜、乘平台、D 完成；全部必要提示和按钮可见可用，标题／恢复错误界面与暂停不回归。未做 Edge／独立人工长期手感则保留 NOT RUN。 |

测试与交付：保留原 168 项有效语义，补必要核心及真实 Matter 回归；执行 `npm.cmd test`、`npm.cmd run electron:build` 和现有首关三端定向入口、`git diff --check`。可以扩展 `test:d12-a1` 覆盖本任务，不为改名再建一套平台框架；报告明确实际任务和逐子项范围。无需无理由重跑所有物理／异常长套件，改动共享交互时保留旧实验室语义测试。更新 README、路线图、必要概述，给出当前版本正常体验入口和截图，保留一个可玩窗口，不关闭用户旧窗口。

完成后等待 Work 审查，不进入 D13，不 Commit／Push／发布；不修改 CONFIRMED、奖励／存档／最终 Matter 选型，不实现新游戏系统。此任务无新增用户产品决策；若两轮有效修复仍失败，按既有规则提交最小复现。

### 2026-11-14 D12-A2 执行结果

D12-A2 当前为 DONE（待 Work 审查）。打开 B 区 NPC 调查现在只进入 `investigation` 并取得本交互自己的控制限制，不创建接取 Event／Command／Transaction 或永久记录；只有关闭按钮或 Escape 产生的 `normal-close` 才调用原首关业务入口。重置、坠落恢复与场景中断只中断本交互；隐藏／最小化保持对话和控制限制，恢复后继续等待玩家主动完成。重复关闭、持 E 和恢复旧输入不会创建第二套业务身份。

正常模式默认收起调试入口并隐藏交互范围圈、脚底／失败 sensor、Tick、Runtime／事务编号和开发阶段标签。当前目标只保留一份；A 区起点、B 区游客与山势灯带、C 区同一吊臂装置的两个控制位、升降平台和 D 区拍摄点使用现有 Phaser 图形提供可辨认占位。两个控制位在操作前均为中性黄色；B 线索明确指向装置左侧，不再用绿色／红色提前暗示答案。实验室、场景切换、完整诊断和重置仍可通过折叠的调试入口使用。

| 用例 | 状态 | 实际结果 |
| --- | --- | --- |
| UX01：先红后绿与正常结束 | PASS | 修复前真实测试证明打开对话后等待仍会接取；修复后打开并暂停时为零接取身份，正常关闭后只创建一条 Quest 业务链，事务完成后更新目标。 |
| UX02：中断／重复隔离 | PASS | 隐藏恢复、重置和坠落中断不提交未完成对话；重复关闭、持 E 与恢复后完成不新增业务身份，交互只释放自己的 control owner。 |
| UX03：默认画面与线索 | PASS | 默认调试内容不可见，调试展开只改变显示；页面无旧重复 HUD；装置选项为同一中性装置的两部分，B 线索指向左侧。 |
| UX04：主线与恢复回归 | PASS | Chrome、Electron 开发版及独立包均完成 A–D，包含 NPC 完成后接取、接取后恢复、C 错误／正确操作、机关后恢复、真实 lift、暂停和完成。 |
| UX05：窗口与操作 | PASS | Web 1280×720、1920×1080 和 Electron 客户区的主画面、目标、E 提示与关闭按钮均在窗口内；只验证窗口内占位可读性，不冒充独立人工长期手感。 |

`npm.cmd test` 为 171/171 PASS，0 fail、0 skipped，类型检查及 Electron Main 编译通过；原 168 项有效语义保留，新增首关完成时序、交互关闭原因及浏览器回归。`npm.cmd run electron:build` PASS，Vite 构建 32 modules，仅有既有 bundle 体积、缺少 author 和默认 Electron 图标警告。

Web 定向 [run-jowRc3](../test-results/platform/run-jowRc3/report.json) PASS。最终完整三端 [run-k5NJOY](../test-results/platform/run-k5NJOY/report.json) PASS：Chrome Web、Electron 开发版和仓库外独立包全部通过；三个测试自有进程退出码均为 `0`、`cleanupStatus=PASS`、`cleanupFailures=[]`。报告记录的 36 项脚本、源码、测试与 ASAR 哈希均与当前文件匹配。Chrome 身份为 `Google Chrome 156.0.8078.74`，路径 `C:\Users\24839\AppData\Local\Google\Chrome\Application\chrome.exe`。

关键布局数据：Web 1280×720 画布为约 `x=96.9..1183.1`、`y=40.5..670.5`；Web 1920×1080 为约 `x=320..1600`、`y=40.5..782.5`；Electron 客户区 `1011×685` 的画布为约 `x=12..999`、`y=40.5..613.0`，三者正常模式均不依赖页面滚动。三端 lift 暂停／恢复首 Tick 分别保持 `2187→2187`、`2168→2168`、`2178→2178`，lift clock 分别保持 `15283.33→15283.33 ms`、`15183.33→15183.33 ms`、`15216.67→15216.67 ms`，持键恢复新增跳跃为 0。业务身份在两端保持 Quest `Event 1／Command 1／Transaction 1／Result 2`、Lift `Event 4／Command 2／Transaction 2／Result 5`、Complete `Event 7／Command 3／Transaction 3／Result 8`。

首轮三端 [run-zzdhkc](../test-results/platform/run-zzdhkc/report.json) 为 FAIL，三端均已完成主要业务与恢复，但测试仍点击已移入折叠调试区的 `#reset-graybox`，因元素不可见而超时；报告、截图和失败过程保留。测试随后改用正常玩家可用的真实 `KeyR`，没有恢复重复页面面板、削弱重置断言或伪造点击。最终结果见 `run-k5NJOY`。

版本证据：基线提交 `858f7fb`；生产入口 `release/layered-city-adventures/win-unpacked/Layered City Adventures.exe`；ASAR 为 `4E8F103A748514CE8C917DC66863074A4C1700275E35BA9E0939EFA479D1F5A9`，EXE 为 `3CA5C7F6260E5DF21F8EC446F971A4AFD75B0C4257D1C9329EEDEFA652503CFA`；报告／时间线为 `68B13DFE636F4D54840DEC970F6FC5D6771FB0DC2C853E10C310A9235E653CC8`／`C6D2696EE27A744358FB6772EF2954E1A3A1054D24743F7DEC762C6C3CA81D1D`。

当前版本截图和体验记录位于 [D12-A2 证据目录](../test-results/d12-a2-20261114/)。正常 Electron 开发窗口使用 `npm.cmd run electron` 启动，PID `38568`、HWND `224396378`、标题“叠城大冒险 | Layered City Adventures”、URL `http://127.0.0.1:62707/?platform=windows`；窗口留给用户自行操作和关闭。

Edge、独立人工长期手感、正式美术、现实地理叙事适配、正式任务／奖励、跨会话存档、正式检查点与完整 MVP-G01–G06 仍 NOT RUN。Matter 仍是验证候选；D12-A2 完成后停止等待 Work 审查，不进入 D13。

### 2026-11-14 D11-A3-R1 Work 审查与基础灰盒收口

基线 `5b08af4`，开始时已有 16 个修改文件全部保留。Work 阅读正常、自动和手动入口的共用 `#resourceSafeForWorldWrites()`，确认等待期间保留尝试模式、不触碰其他 owner、不额外消费自动预算。重新执行 `npm.cmd test`：161/161 PASS，0 fail、0 skipped，类型检查及 Electron Main 编译通过。

独立复跑原真实 Matter 复现：外部 owner 冻结两个登记平台后触发真实坠落，推进 35 步仍为 waiting-for-capture、wait=7、rebuilds=0、控制锁保持、旧 Body 均存在；由原 owner 释放后进入 Succeeded、仅一次重建、原有效快照不变、控制按流程释放。修复关闭上轮确定缺陷。

当前 `run-7mtcju` 故障报告与 `run-vEjpyw` 正常报告各 30 项版本全部匹配文件，三端均 PASS、进程 code 0、cleanup PASS、cleanupFailures 为空。报告 SHA-256 分别为 `FD4E3BDCC9C59452F22A886DE01E7F42A5ACCC5B02F0F4E6386B85E452B064DD`、`5957793E867AB0327B4A5022A6419D638335FAB7347FAFC5B612B58692E19D18`。EXE SHA-256 匹配 `72D51F7D4870101D6C22BBE66589987A25583645FCF48DC4C465847CB490AF3A`。Work 本轮未重新构建／运行 GUI；资源冲突仍以真实 Matter 集成证据验收，外部冻结 GUI、Edge、独立人工未执行状态不改写。历史 FAIL 保留。

D11-A3 与 R1 按当前范围收口。基础灰盒到此停止增加功能，不以补齐未来接口、完整错误码、存档或最终参数作为进入首关的前置。下一项做可见、可玩、能完成的主线，最终 Matter 采用与正式叙事／美术仍另行确认。

### D12-A1 任务卡：首关最小可玩流程

**目标与交付**：正常打开 Web 或 Windows 应用即可从 A 区开始，走过 B 区委托与线索、C 区机关与升降通路，在 D 区主动完成拍摄／分享并看到首关完成反馈。不是再增加一组诊断按钮；需能用正常移动、跳跃和交互完整游玩。先占位表现，完整主线为一个有边界的实施任务。

**依据与前置**：阅读 AGENTS、DECISIONS 的 Hongyadong First-Level MVP Design Freeze、PROJECT_BRIEF、HONGYADONG_LEVEL_DESIGN 的首关 MVP／四区规则、QUEST_SYSTEM_DESIGN 的首关任务与恢复，以及 PLAYER_CONTROL_DESIGN 的现行控制、暂停、快照／恢复章节。D07–D11 已有可复用实现；先核对代码，保留所有未提交修改。CONFIRMED 规则继续有效，不重新讨论已定主线。

**内容范围**：

1. A 区：安全出生点，短小清晰的移动／跳跃／E 交互提示，通过街巷、台阶／平台走向 B。用层叠建筑轮廓、木走廊、上下高差等占位图形表达山城空间；不要直接把实验室障碍依次换成四区名称。
2. B 区：上层观景位置能看见下方主线空间，提供年轻游客 NPC。玩家主动对话并了解简短委托后自动接取《把山城夜景寄给远方》，无接取／拒绝弹窗，靠近不能自动接取。展示本区唯一核心环境线索，与 C 装置操作有可理解对应。
3. C 区：多层走廊／楼梯式平台，主线整体向下；一个装置和一个正确操作。可自行采用明确标注的临时箭头／方向线索与两个简单操作选项验证，最终线索／对白／外观仍 PROPOSED；不是两个独立机关。错误有清楚反馈、可重试，无永久惩罚；正确操作启动真实可乘坐的升降平台，开放通往 D 的路线。不能只改 HUD 的 OPEN 而无真实碰撞／通路变化；解锁前不能从普通路线绕过机关直接完成。
4. D 区：指定观景点，主线已接取、机关成功、路线开放、玩家在位置范围内且主动完成拍摄与分享互动后，才永久登记完成并展示明确完成面板。拍摄／分享是游戏内模拟表现，不接摄像头、外部社交服务或发布。仅走到 D、靠近触发器或重复按键不能提前通关。
5. 界面：显示当前目标和必要操作提示，完成时有可读反馈。布局优先给游戏场景，完整身份／Tick 诊断收起到调试区域；默认启动首关，保留现有实验室与诊断显式入口。任务反馈、对白／选择关闭等只管理自己的控制限制，不挪用生命周期暂停或解除其他 owner。

**叙事与原型权限**：目前用 A／B／C／D 功能标签，NPC／线索／拍摄文案用不宣称现实旅游路线的简短占位内容；旧四区真实地名与来源保留在设计文档，不机械替换、不编造新城市地名。原冻结任务与通关行为不因占位改变，不把本次文案升级为正式虚构世界适配。具体坐标、平台尺寸、摄像机跟随与线索表现可做必要局部工程选择，记录为可验证原型，不增加产品审批关卡。

**模块与边界**：

- 共享核心负责首关流程、任务条件、机关判定与永久状态；可新增小型首关配置／任务流程模块及专项测试。复用现有交互、固定步、控制协调、事件／命令／事务／唯一结果事件，不在 UI 回调里直接写永久进度；一次业务事件仍最多一条命令、一笔事务。
- 主线接取、机关完成／路线解锁、主线完成需要独立稳定的业务记录，不复用 prototype-goal-e 或实验室收藏 ID；可最小扩展已有运行内进度及事务执行器接入。接取不凭空发奖，奖励具体内容未定则不新增正式奖励；已有配置的奖励必须幂等。不建通用任务编辑器、全任务框架、背包或新事件协议。
- 首关几何、装置、平台位置与渲染可通过现有 Matter 适配／Phaser 增加小型场景配置；不得复制另一套玩家、物理、暂停或恢复核心。当前实验室的固定两平台与检查点配置不是正式首关地图；如需配置化，仅做到首关实际对象登记和可信出生备份即可，不扩展通用关卡加载系统。
- 首关初始出生备份必须完整登记其真实临时对象并通过验证；可仅使用这个备份，不为本项增加额外检查点选址。不能拿实验室的 Runtime／Level／Checkpoint 或快照冒充首关。新增场景使用自己的可信配置，继续共用相同运行内生成机制及模块职责。
- 失败后临时世界按有效快照回退，再应用永久进度、重建／验证和放置，成功后恢复控制。已接任务、机关成功、路线解锁与任务完成保持；升降平台位置／运动阶段可回退，但已解锁路线仍须真实可通行，不要求重新解谜。不重捕快照覆盖恢复来源，不重新发放奖励，不重放旧事件，保留 R 原有调试性质与持键门槛。
- Web 与 Windows 共用同一入口、首关配置、Phaser 场景和游戏规则；不引入 Electron／DOM 到共享核心，不新增依赖或改变 Matter 候选状态。现有实验室测试入口明确选场景，不能因默认改为首关而悄悄测错页面。

**验收与测试**：

| 用例 | 必须证明的行为 |
| --- | --- |
| LV01：完整可玩主线 | 从正常启动 A 出生，用普通输入经 B 对话／观察线索、C 正确操作并乘平台到 D，拍摄／分享成功后才出现完成反馈。完整主线路径不得靠传送、直接改状态或调试按钮完成。 |
| LV02：错误与前置条件 | 错误操作不永久惩罚，再试正确可开路；靠近 NPC 不接任务，到 D 不自动完成，缺任一通关条件时不记完成，随后补齐仍可正常通关。边界条件可辅以核心夹具，不能冒充普通游玩。 |
| LV03：接任务后失败 | 从接任务前的出生备份恢复，任务仍已接取；控制、输入门槛、交互及路径可继续，NPC 重复对话不重复接取／发奖。 |
| LV04：机关完成后失败 | 从解谜前的临时备份恢复，机关完成、路线解锁保持，真实平台／路线可通行；不再次解谜，瞬时位置可回退，重复正确操作／拍摄不重复写入。 |
| LV05：暂停与身份隔离 | 对话、平台乘坐或交互期间实际隐藏／最小化及恢复，无后台追赶、自动跳跃／交互或额外奖励；首关与旧实验室配置、快照／业务身份不串用。资源准入 R1 与恢复保护不回归。 |
| LV06：三端交付 | Chrome Web、Electron 开发版、仓库外独立包使用当前同一版本，至少执行正常 A–D 完整路线及任务／机关失败恢复、重复交互。截图含四区、乘坐平台及完成反馈，记录平台、版本、退出／清理和未覆盖项。 |

执行 `npm.cmd test`（保留原 161 项有效语义）、`npm.cmd run electron:build`、新增首关三端定向入口（建议 `npm.cmd run test:d12-a1`）和 `git diff --check`。配置／共享恢复若有变动，补相关旧实验室恢复定向回归；复用会话和既有用例，不无理由重跑所有历史长套件。当前切片用例映射到 MVP-G01–G06 时注明占位内容与实际执行范围，不将它描述为最终关卡／美术／Matter 正式选型全面通过；独立人工与 Edge 未执行则如实登记。

**交付与停止条件**：更新 README 的真实启动／操作／测试方式、本文任务状态、项目概述；确有新实现事实时才同步关卡／任务设计文档，保留 PROPOSED 与历史。给用户保留一个当前版本正常启动的可玩首关窗口，附截图和简短通关路线，不关闭用户旧窗口。只做这一主线切片，不加支线／战斗／收藏门槛、存档、正式美术、泛化架构或最终物理决策。两轮有效修复仍失败按规则交 Work；当前无须新增用户产品决策。完成后等待审查，不自动进入下一任务，不 Commit／Push／发布。

### 2026-11-14 D12-A1 执行结果

普通 Web 与 Windows 启动现在默认进入首关，实验室保留在「调试入口」。A 区安全出生并以普通走跳到达 B；B 区游客必须由玩家按 E 主动交互，对话完成后才接取《把山城夜景寄给远方》。C 区使用同一装置的两个吊臂验证错误可重试和单一正确操作；正确事务完成后 open 路线门并启动可承载玩家的 `first-level-service-lift`。D 区必须已接委托、机关完成、路线开放、实际进入范围且主动按 E，才创建完成事务并显示完成反馈。首关使用独立 Level `first-level-night-postcard`、Checkpoint `first-level-initial-spawn` 和快照对象 `first-level-service-lift`，不串用实验室身份。

交互回调不直接写永久进度。委托、机关和完成分别走独立 Event／Command／Transaction／Result Event；当前无具体奖励内容，基准记录为 `goals=3`、`rewards=0`、`effects=3`。真实平台移动时同步刷新 Matter broadphase；D 入口无多余实体墙阻挡。接入中发现的静态 lift broadphase、多余 upper-back-wall 和测试提前松开方向键三次 FAIL 均保留原报告，不改为 PASS。

| 用例 | 状态 | 实际结果 |
| --- | --- | --- |
| LV01 完整可玩主线 | PASS | Chrome、Electron 开发版、仓库外独立包均以真实键盘从 A 走跳到 B，主动接取，试错并完成 C，乘真实 lift 到 D，主动拍摄／分享后才完成。 |
| LV02 错误与前置条件 | PASS | 靠近 NPC、仅到 D、缺任务或路线条件不会接取／完成；右侧错误吊臂可重试，左侧正确操作后可继续。 |
| LV03 接任务后失败 | PASS | 接任务后真实坠落恢复，任务、控制与交互继续；重复 NPC 交互不新增身份或记录。 |
| LV04 机关完成后失败 | PASS | 机关后真实坠落恢复，OPEN 路线与 lift 保持、可继续乘坐；不重复解谜、机关或拍摄记录。 |
| LV05 暂停与身份隔离 | PASS | lift 乘坐期间 Web hidden 与 Windows 原生 minimized 冻结 Tick、lift 和平台时钟；恢复首帧不追后台时间，持键不自动跳跃／交互。 |
| LV06 三端交付 | PASS | 当前版本三端完成完整路线、两次失败恢复、重复交互、暂停和 R，进程退出码 `0`，清理失败为空。 |

`npm.cmd test` PASS，类型检查与 Electron 编译通过，`168/168` 测试、0 fail、0 skipped；原 161 项语义保留，新增 LV01–LV06 七项。`npm.cmd run electron:build` PASS，Vite 构建 32 modules；[run-TJOXd1](../test-results/platform/run-TJOXd1/report.json) 的 Chrome Web、Electron 开发版与仓库外独立包全部 PASS。

三端实际 Tick／lift clock 冻结与恢复首帧为 Web `2099/15316.67 ms → 2099/15316.67 ms`、Electron Dev `2116/15200 ms → 2116/15200 ms`、Packaged `2119/15233.33 ms → 2119/15233.33 ms`；持键恢复新增跳跃均为 `0`。三端业务身份一致：Quest `Event 1 / Command 1 / Transaction 1 / Result 2`，Lift `Event 4 / Command 2 / Transaction 2 / Result 5`，Complete `Event 7 / Command 3 / Transaction 3 / Result 8`。

生产 ASAR SHA-256 为 `73D72C361441EE48BE602A6BF7123AD06314C635125707070A246585DD08A9D7`，EXE 为 `CEF97C4284DDAFC38B3F4D9263016B7A448815E184358B7EBF2517D66D8A1AA7`，报告／时间线为 `F69FDB3ECD3D3CFCBDAC7A58E03A543627E39524A251F063BECD911B19CCCA35`／`E4206952FBE5B6EA9AFA1E52EF38445FA93967F381E322088AE1EF9F0DD3FD`。截图、各阶段证据和体验启动记录位于 [D12-A1 证据目录](../test-results/d12-a1-20261114/)；正常 Electron 开发窗口 PID `42164`、HWND `345178514` 保持运行，留给用户操作。

历史 `run-Q8HwAh`、`run-hdsvW4`、`run-7RefUf` FAIL 保留。Edge、独立人工长期手感、正式任务／奖励、存档、正式检查点、最终美术与现实地理叙事适配均 NOT RUN。Matter 仍为验证候选，当前不宣称完整 MVP-G01–G06 通过。D12-A1 为 DONE（待 Work 审查），不进入 D13，不 Commit／Push／发布。

### 2026-11-14 D11-A3 Work 审查：资源安全门槛回归

基线 `5b08af4`，开始时 16 个修改文件全部保留。Work 本轮重新执行 `npm.cmd test`，类型检查、Electron Main 编译与 157/157 测试 PASS，0 fail、0 skipped。故障报告 `run-2nj3IC` 与正常报告 `run-nBb5pI` 各 30 项版本记录均匹配当前文件；两份报告三端 PASS、各进程退出码 0、清理 PASS，无清理失败。报告 SHA-256 分别为 `054F2547312972F2E1AB374ED5D1FC0DA3719904658DF6958E94FA40FF3066DC`、`549CF0E943484AB4C7CFB350FE26181FE19496CC21256E346AD32B185A203AEB`。Work 本轮未重新构建或启动 GUI，不把证据核对描述为重新执行三端测试。

审查发现确定回归：`advanceAfterCoordination()` 淡出结束时设置 waiting-for-capture 后立即调用 `#beginAttempt()`，该入口不检查 `#captureSafe()`；只有下一次留在 waiting-for-capture 的推进才检查，但正常首尝试已经越过。自动与手动入口也没有共同的世界写入安全门槛。

Work 在内存中复用 `tests/recovery.test.mjs` 的真实 Matter fixture，无文件修改地执行：建立初始快照 → 另一 owner 调用 `freezeTemporaryObjects()` 冻结完整登记集合 → 触发真实坠落 → 推进 35 步／70 步。35 步时已 `fading-in`、`captureWaitTicks=0`、`managedWorldRebuildCount=1`，旧两个平台 Body 均被移除，而外部冻结记录仍有效；70 步时 `succeeded`、恢复次数 1、`controlLockHeld=false`、`triggersShielded=false`，两个平台仍在外部冻结集合。该路径违反等待资源安全释放及所有权边界，现有 157 项和三端场景未覆盖，D11-A3 不能直接收口。

### D11-A3-R1 任务卡：恢复前资源安全门槛补修

- 目标与范围：只修上述真实回归，在任何恢复性世界写入前统一检查捕获锁、执行 owner／资源释放状态及对象冻结；保留既有 A3 行为，不重新开发恢复系统。
- 模块：`src/core/recovery.ts` 与 `tests/recovery.test.mjs` 为主；确需诊断／测试路由接线时最小调整，不改变平台物理、快照结构、业务协议或暂停协议，不新增依赖。
- 准入：正常首尝试、自动完整重建、手动完整重试均须经过同一受控安全门槛。淡出结束不能先恢复再等下一 Tick 检查；世界被其他 owner 占用时不得应用快照、重新应用世界效果、替换 Body、放置玩家或解锁。自动阶段也须重新检查，不能只依赖上一阶段曾经安全。
- 等待与来源：沿用现有有限等待配置与 Fail-Closed；等待期间以实际 Tick 推进，不忙循环、不暗中释放其他 owner、不抢锁、不取消捕获、不强行清空冻结。正常恢复应在已有捕获安全收尾后选择当前有效来源；一旦首次选定，自动／手动仍使用同一原始来源。超时进入 RecoveryError 并保留控制／触发保护；自动重建不能作为绕开资源锁的手段。
- 尝试语义：等待不能丢失原尝试模式、每 Tick 新建手动请求或重新分配自动预算。手动点击只登记一次，释放自身错误暂停后可等待实际安全条件，仍受其他生命周期暂停约束。源版本等预检查始终保持零写入保护，不因为增加等待而允许非法数据；不新增用户重试次数限制。
- R01：真实 Matter 外部 owner 冻结全部登记平台，触发失败，越过淡出时间后仍未执行恢复写入／替换 Body／放置／解锁；外部 owner 主动释放后正常恢复完成，身份、原有效快照与进度保持。保留先红后绿证据。
- R02：捕获锁／执行资源未安全收尾时等待；在完整原有捕获提交后使用正确当前检查点恢复。覆盖独立锁／资源与实际冻结条件，避免只测一个布尔值。等待超时进入 Error、旧资源仍属于原 owner，无恢复性世界写入；故障解除后主动重试可恢复。
- R03：在普通尝试失败与下一阶段自动重建之间引入外部冻结，自动阶段先等待，不替换受占用 Body；手动重试时外部冻结也遵守相同门槛。等待不重复消费尝试额度／创建身份，资源释放后继续原模式；同一请求重复点击仍只有一个在途流程。
- R04：保留原 157 项有效语义；正常、一次自动重建、版本拒绝、持续错误、标题往返、手动失败／成功、永久效果幂等及独立 Pause Owner 规则不回归。复用 A3 定向三端入口证明修复后故障界面与正常恢复仍可运行；新增外部冻结 GUI 注入不作为强制项，新增资源边界以真实 Matter 集成证据为主，不以旧报告代替当前源码回归。
- 验证与交付：`npm.cmd test`、`npm.cmd run electron:build`、现有 A3 三端定向和正常恢复入口（可合并会话）及 `git diff --check`；记录新用例、实际路由、产物版本及未覆盖范围。只更新 README、本文及必要概述，不改 CONFIRMED，不清理或改写历史失败。当前无需用户新增产品决策。完成后停止等待 Work，不 Commit／Push／发布。

### 2026-11-14 D11-A3-R1 执行结果

根因已由四项真实 Matter／完整恢复流程回归复现：淡出结束会直接调用首次恢复，自动重建与手动重试入口也各自绕过了资源安全条件。修复后，正常首次恢复、自动完整重建和手动完整重试均在应用快照、重新应用永久效果、替换受管 Body、放置玩家或解除控制前调用同一 `#resourceSafeForWorldWrites()` 门槛。该门槛同时检查捕获锁、执行 owner 的资源释放状态及当前世界冻结集合；不安全时只累计现有 `captureWaitTicks` 并保持原阶段，超过既有 `maxCaptureSettleTicks=120` 后进入失败关闭。资源解除后从原阶段继续，不重新捕获、不创建新身份、不增加自动重建额度。

新增 R01–R03 共四项回归先在修复前得到 `0/4 PASS`：R01 外部 owner 冻结全部登记平台仍在淡出结束后进入恢复；R02 已提交捕获但锁／资源未释放时未等待；R03 的自动与手动入口均越过冻结条件。修复后 `4/4 PASS`。覆盖的零写入事实包括 `applyTemporarySnapshot`、`rebuildRecoveryWorld`、`placePlayerAtAnchor`、`setPermanentEffect` 调用数均为 `0`，并核对旧 Matter Body 身份未替换、旧有效快照和永久进度未改变。

`npm.cmd test` 为 161/161 PASS，0 fail、0 skipped；原 157 项保留，新增四项资源安全回归。`npm.cmd run electron:build` PASS，当前 ASAR 为 `898C93CF4F6D4E113EF9D85A26BCC2E2C6285F43B8EA4B4DE82F4A0481AB3579`，EXE 为 `72D51F7D4870101D6C22BBE66589987A25583645FCF48DC4C465847CB490AF3A`。

三端故障闭环 `run-7mtcju` 与三端正常恢复 `run-vEjpyw` 均为 Chrome Web、Electron 开发版、仓库外独立包 PASS；三端进程退出码均为 `0`，`cleanupFailures=[]`，无页面错误或非预期 FAIL。报告／时间线 SHA-256 分别为 `FD4E3BDCC9C59452F22A886DE01E7F42A5ACCC5B02F0F4E6386B85E452B064DD`／`3827C64533D8F9C3F92D35208CF70199D13D193B7064899F301D8F39495191BC` 与 `5957793E867AB0327B4A5022A6419D638335FAB7347FAFC5B612B58692E19D18`／`D74B389D1A6C95BB1F86548CC76C39D9FF086E3FA6DADFE3D9CA9EEAA10F35B1`。当前 `src/core/recovery.ts`、`tests/recovery.test.mjs`、`tests/graybox-browser.mjs` 的 SHA-256 分别为 `E9CF428DB8BEC648C6605494FA32B70A4D9A8C172BAA583CC318F8CCEF4A7F87`、`ECE45D7E34FD8290067FE5415CE511F52E51F14500F5612C09E8EDD56900F2B6`、`A952BA0080EC5BA4C6D44F4F2A38DDAEE4A2993D735A27B8000C01BB4A5CA3F4`。

历史正常恢复三端报告 `run-VVXP9H` 保持 FAIL：独立生产包准备真实输入时过早释放 `KeyA`，角色停在缺口边缘而未进入失败区；修正测试准备后 `run-vEjpyw` 三端通过。该 FAIL、时间线和失败截图均保留。资源冲突分支本轮的证据层级是真实 Matter 核心／完整恢复流程，不是三端 GUI 注入；Edge、独立人工手感、存档、正式关卡与 D12 均为 NOT RUN。R1 完成后停止，等待 Work 审查，不 Commit／Push／发布。

### 灰盒收敛与后续方向（当前不是新增实施授权）

基础灰盒已具备走跳、静态／单向／移动平台、交互、运行内进度、事件事务、检查点捕获与正常／异常恢复。R1 后不再为了灰盒完整而增加未来扩展、错误码体系、存档、额外机关或全平台参数调优；仍有未运行的 Edge、独立人工及最终 Matter 选型，分别保留真实状态，不伪装全面通过。

下一项优先为 D12-A1 首关最小可玩流程，把已有能力组织成可从起点玩到终点的 A → B → C → D、NPC 委托、单线索单机关和终点完成反馈。先采用 A／B／C／D 功能标签及占位表现，不擅自更改旧冻结谜题／通关条件或编造虚构地名；真实地理身份与新世界观确需调整时只提交具体冲突，不把整份文档重新设计一遍。D12-A1 的执行规格在 R1 审查后下发，当前不实现。时间以这项真实阻断是否修复为准，不再用无止境灰盒子任务作为交付目标。

### 2026-11-14 D11-A2 Work 审查与 D11-A3 放行

审查基线 `d65859a`，保留开始时已有的 11 个未提交修改文件。Work 核对恢复流程、真实 Matter 世界查询与预设备用锚点、安全空间／支撑／坠落区检查、世界 Critical／Warning 报告，以及 AV01–AV05 的整流程预检查零写入与身份保持。当前实现满足 A2 范围；Warning 的当前证据是明确标注的合成注入，不描述为真实装饰场景验收。

本轮实际重跑 `npm.cmd test`：类型检查、Electron Main 编译及 154/154 测试 PASS，0 fail、0 skipped。`run-xrUFrD/report.json` 的全部 30 项版本记录与当前文件匹配，三端 PASS、进程退出码 0、无页面错误／非预期中断／清理失败。报告 SHA-256 为 `9F9F5763BF95EE13034D71A89BF41F0487983A1E81208E1C565A234596A1DC57`，ASAR 为 `F6DB54B409F009CE7511EFD836A3CCD57183DE1D6F22D1BAEF23DB366EAC91DF`。报告沿用 D11-A1 任务标签，证明当前版本的正常恢复宿主回归，不证明备用或故障 GUI 已执行。本轮未重新构建或运行 GUI；历史三次 FAIL 及其采样断言修正记录原样保留，Edge／独立人工未执行项不改判。

D11-A2 按当前范围收口。下一步执行以下一个任务；不再增加脱离当前功能的架构设计关卡，不将任何工程选择升级为 CONFIRMED。

### D11-A3 任务卡：一次自动完整重建与 RecoveryError 交互闭环

- 目标：正常恢复失败后有界尝试一次自动完整重建；仍失败则显示 RecoveryError，允许玩家主动完整重试或返回最小标题视图。补齐可操作的故障闭环及三端证据，不改正常恢复手感。
- 依据：先阅读 AGENTS、本节、PLAYER_CONTROL_DESIGN 的“版本不兼容不自动重建”“Fail-Closed”“RecoveryError 一次自动完整重建与玩家后续选择”“RecoveryError 允许玩家反复主动重试”及相关 DECISIONS。版本不兼容直接进入 RecoveryError；其他适用错误保留最多一次自动完整重建。手动重试失败后回错误界面，不补充自动重建额度。
- 模块：增量扩展 `recovery.ts`、`graybox.ts`、现有 Matter 世界重建适配、生命周期接线及 Web／Phaser 表现；复用既有快照仓库、业务总线、控制 owner 与暂停协议。接口／错误分类／诊断字段为本次工程实现，不新增正式 API 或通用恢复框架。
- 源数据先保留：首次选定恢复来源时保留原始只读数据和上下文，再执行严格预检查；即使版本非法也能在后续主动重试中使用同一原始来源。不得因验证失败时 `sourceSnapshot` 尚未赋值而重新读取已变化的当前记录；不得重新捕获、替换有效快照或清除进度来“修复”。捕获资源未收尾时继续等待既有安全条件，不夺取其他 owner 的锁／冻结。
- 有界调度：一次真实失败恢复流程只有一份自动重建预算；每次推进有界返回，重建／再次验证安排在明确后续阶段，不在 catch 内递归重试，不按每帧或每个手动请求重置额度。以局部类型化原因区分版本不兼容，不解析显示文案。非法源仍须先预检查，任何重试均不能绕过零恢复性写入要求；区分自动尝试数与实际重建次数。
- 真正完整重建：本灰盒先以全部固定登记临时对象及其关联物理 Body／缓存／引用为完整受管对象集合，重建整个集合，不只修复失败对象，也不能只再次调用当前设置既有 Body 位置的普通重建。验证实际 Body 已重新建立、旧引用不再参与碰撞／支撑／渲染；稳定逻辑对象 ID、快照状态版本不变。静态地形不因此纳入新快照；持久静态错误仍应验证失败。对象边界属于注明的当前工程范围，不确认历史整套五阶段架构。
- 重新应用与验证：完整重建后从同一原始快照恢复临时逻辑，重新应用永久效果，完成物理状态构建、A2 世界 Critical／Warning 与有序锚点检查、玩家放置及占用／输入同步，最后淡入。Critical 或全部锚点失败均不解锁；仅 Warning 不触发重建。不要创建新核心、Runtime UUID、快照仓库、协调器或业务编号序列，不把重建当成重开游戏。
- RecoveryError：显示可读的失败阶段、原因、检查点及有限诊断，提供“手动重试”“返回标题”两个真实按钮。保留恢复 owner 与触发屏蔽；R、动画结束、切换页面内部场景或释放其他 owner 均不得绕过失败关闭。恢复动作从受控核心入口发起，表现层不直接修改快照、物理或控制锁。
- 手动重试：只在错误状态接受，立即登记唯一进行中的尝试，拒绝重复点击／按键 repeat 产生并发。每次重新从预检查执行完整恢复流程，沿用原来源与身份，不从失败步骤续跑，不新增自动重建预算。允许多次主动重试；失败回 RecoveryError，成功仅在全部验证及淡入完成后释放自身控制限制。历史与计数有界，不设置未经批准的玩家重试次数上限。
- 最小标题去向：在同一运行实例内实现简洁标题视图及“返回恢复界面”入口即可，不扩展正式主菜单／新游戏流程。此次采用保留原快照、进度、错误流程和业务身份的低风险内存实现；这是原保留方式提案的一种工程验证，不升级为正式跨场景／跨会话架构。不得复用现有 `window.location.reload()` 丢弃运行数据；返回恢复界面仍受错误状态约束，不能直接继续未验证的游戏。
- 暂停与输入：错误／标题界面须在模拟不推进时仍可操作。需要暂停时通过既有 Lifecycle Controller 申请自身 Owner／Key／Token，只释放自己持有的令牌；保留后台、最小化和其他来源的暂停。同一持续请求去重，释放后新请求使用新 Key；不泄漏令牌，不强行 resume。主动重试的请求登记不依赖 SimulationTick，实际恢复仍在合法模拟阶段推进；暂停在固定步内生效后不得继续同帧补算。失焦／持键门槛和无后台追赶规则保持。
- 故障验收接线：允许增加默认关闭、明确命名的受限测试启动场景／白名单夹具，复用真实恢复、Matter 和界面；不得暴露任意改快照／执行代码接口，不给普通玩家常驻生产故障按钮，不新增 Preload／IPC。至少覆盖一次真实必要 Body 丢失、持续恢复故障、版本不兼容，以及备用锚点真实 GUI 场景；每份报告写清场景、注入方式和当前产物版本，合成故障不冒充自然故障。

| 用例 | 验收要求 |
| --- | --- |
| ER01：自动重建成功 | 普通恢复遇到缺失必要受管 Body 后，恰好一次完整重建，全部受管对象得到新 Body，原逻辑身份／源快照／永久进度不变；验证后成功恢复，目标／奖励／效果仍 1/1/1。 |
| ER02：持续错误与版本例外 | 持续 Critical 故障最多一次自动尝试后进入 Error，无递归／自动循环。schemaVersion／stateVersion 不兼容直接 Error、自动重建次数 0；手动重试仍验证原非法来源，恢复性世界写入为 0。其他非法来源也不绕过预检查。 |
| ER03：主动重试 | 连点只启动一次；连续主动失败不新增自动重建额度，解除受控故障后下一次主动完整重试成功；不重新捕获／发奖／重放旧业务。未通过验证前控制与触发屏蔽保持。 |
| ER04：标题与暂停隔离 | Error → 标题 → 返回恢复界面保留相同数据和身份；隐藏／原生最小化与错误暂停可并存，释放错误 owner 不解除其他暂停。界面在无 Tick 时可操作，恢复无后台追赶／旧持键自动跳跃或交互。 |
| ER05：世界与锚点回归 | Warning 不触发自动重建；自动与手动路径都经过世界及有序备用锚点检查，永久路线保持可通行；旧 Body 无幽灵支撑，正常 A／B 捕获、目标 E 与坠落路径不回归。 |
| ER06：三端故障闭环 | Chrome Web、Electron 开发版、仓库外独立包实际执行自动成功、Error／手动失败与成功、标题往返、版本拒绝、备用落点；保留真实按钮操作、窗口生命周期、逐项诊断和截图。未执行部分不能计 PASS。 |

交付：保留原 154 项有效测试语义，执行 `npm.cmd test`、`npm.cmd run electron:build`、新增受限三端定向入口（建议 `npm.cmd run test:d11-a3`）及现有正常恢复回归、`git diff --check`。可合并三端会话减少重复启动，但不能以旧报告代替当前正常／故障验证。核对实际测试路由、源码／产物哈希、逐端退出码、页面错误和清理；历史 FAIL 保留，Edge／独立人工等未执行项如实登记。更新 README、本文、必要项目概述；保留一个由当前版本启动的正常体验窗口，提供准确入口与截图，不关闭用户已有窗口。

不做：新玩法、正式关卡／任务、跨会话存档、最终 Matter 选型、完整标题美术、重大依赖或架构重构。普通工程细节自行处理，不改 CONFIRMED；同一问题两轮有效修复仍失败则带最小复现交 Work。完成报告后停止等待审查，不进入 D12，不 Commit／Push／发布；当前无须新增用户产品决策。

### D11-A3 执行结果（2026-11-14）

恢复 Core 在首次选择来源时保存原始只读快照与运行上下文。`SnapshotValidationError` 区分 `version-incompatible` 与 `invalid-source`；schema／对象版本不兼容在任何恢复性世界写入前直接进入 RecoveryError，自动重建预算保持 `0`。可适用失败在明确后续阶段最多自动完整重建一次，不在 catch 内递归重试。手动重试只接受新一次显式请求，从预检查重新执行，始终复用首次来源，不补自动预算、不重新捕获或替换检查点。

Matter 适配器按固定登记清单移除两条移动平台旧 Body，重新创建并替换 Body／运行时引用，清理 Engine pair、broadphase、速度与承载状态，保持逻辑对象 ID 和快照状态版本不变。重建完成后重新应用临时状态、永久效果，执行 A2 世界 Critical／Warning 与有序锚点验证，再放置玩家、清理输入、同步占用并淡入。RecoveryError 与标题视图使用同运行实例和共享 Core 受控入口；错误暂停 token 与其他生命周期暂停隔离，标题操作在模拟冻结时仍可点击。

| 用例 | 状态 | 实际结果 |
| --- | --- | --- |
| ER01 自动重建成功 | PASS | 核心真实 Matter 与三端故障夹具均证明缺失必要移动平台 Body 后恰好自动重建 `1` 次；固定登记对象全部获得新 Body，旧 Body 不再参与碰撞／支撑，源快照、Runtime 和永久进度不变。 |
| ER02 持续错误与版本例外 | PASS | 持续故障在自动重建后进入 Error，不循环；版本 `999` 的自动尝试、重建和恢复性世界写入均为 `0`，多次手动仍验证同一非法原来源。 |
| ER03 主动重试 | PASS | 错误状态立即登记唯一手动尝试并拒绝并发；解除故障后下一次完整手动重试成功，自动次数保持 `1/1`，不重捕、不重复发奖、不重放业务。 |
| ER04 标题与暂停隔离 | PASS | Error → 标题 → Error 保持同一 Runtime、快照、错误与流程记录；三端错误暂停期间 Tick 冻结，隐藏／最小化 token 可并存，标题按钮不依赖 Tick。 |
| ER05 世界与锚点回归 | PASS | Warning 不触发重建；自动和手动路径均重新执行世界与锚点验证。主点受阻时选中首个备用 `160,472,1`，世界为 valid；正常 A 记录、目标 E、奖励和 OPEN 路线回归通过。 |
| ER06 三端故障闭环 | PASS | [run-2nj3IC](../test-results/platform/run-2nj3IC/report.json) 的 Chrome Web、Electron 开发版及仓库外独立生产包全部 PASS，均覆盖自动重建、备用锚点、Error、标题往返、手动失败／成功、版本拒绝和正常生命周期；进程退出码 `0`，无非预期中断、页面错误或清理失败。 |

Chrome Web-only 定向 [run-cDBIYS](../test-results/platform/run-cDBIYS/report.json) PASS。当前正常恢复回归 [run-nBb5pI](../test-results/platform/run-nBb5pI/report.json) 的 Web、Electron 开发版和独立包 PASS，初始备用与 A 记录恢复均 `worldValidation=valid`、主锚点尝试数 `1`，永久进度保持 `1/1/1`、路线 OPEN。

`npm.cmd test` PASS：类型检查、Electron Main 编译及 `157/157` 测试通过，0 fail、0 skipped；原 `154` 项保留，新增 ER01–ER03 三组真实 Matter／完整恢复流程测试。`npm.cmd run electron:build` PASS，Vite 生成 29 modules，Windows x64 免安装目录重新生成；仅保留 bundle 体积、缺少 author 和默认图标警告。

历史失败保持原状：

- `run-Woq1KB` 重复移除同一个已缺失 Body。
- `run-ScUKJZ` 备用场景未先进入自动重建分支。
- `run-zCZULe` 备用场景遮挡物清理时机错误；修复后 `run-cDBIYS` PASS。
- `run-rte6R5` 测试错误地把 `?recoveryFault=...` 放入 `MCLD_DEV_URL`，被 Electron 开发 URL 的根路径校验拒绝；故障开关实际由独立 `MCLD_RECOVERY_FAULT` 白名单传入。修正测试变量后 `run-2nj3IC` 三端 PASS，该失败不归为恢复业务缺陷。

版本证据：

- 基线 `5b08af4`；生产入口 `release/layered-city-adventures/win-unpacked/Layered City Adventures.exe`。
- ASAR `391A1027FA84D7561234EB517501A8D790D56549272A45F5D4F24063E5ACE964`；EXE `76170801121572EF0E2C79D9C5AAE7E1A43A98D3911C71EF1A412595ACBF7371`。
- `run-2nj3IC/report.json` `054F2547312972F2E1AB374ED5D1FC0DA3719904658DF6958E94FA40FF3066DC`；`timeline.jsonl` `86FA35BF8B3B7714E2EC42AA8A66FBFC2DB566A9183B293872F9CCF9D9F7DD39`。
- `run-nBb5pI/report.json` `549CF0E943484AB4C7CFB350FE26181FE19496CC21256E346AD32B185A203AEB`；`timeline.jsonl` `2F14387DC63A54D156790B7F8D3BA14A01885BBBBCF52B7EEC736DE186C08FFE`。
- `src/core/recovery.ts` `87C9AD8D313D451CB93B05D1CE48ED0A8A0A0514851550F81D69DDB7D40764D8`；`src/physics/matter/graybox-world.ts` `2286CB211313623E8ACB5003FB9106B905A79FF17648D4D14F977D517135314C`。
- `tests/recovery.test.mjs` `FE6AF6D82CE2F3E78D1456399B076E4900F13ED882ECE4A2F8EAA01A22516495`；`tests/graybox-browser.mjs` `DA233CF3C02334C8617DA55BC08925C16DFD54AFF71E0CA8C6EB702536E595E8`；`tests/platform-smoke.mjs` `0C1E12205BA1D9DA9A8A209FF9EFADAC0E59FED86DC29878886EB3CF4CC807FB`。

当前源码正常体验窗口使用 `npm.cmd run electron` 保留：PID `45808`、HWND `45026026`、URL `http://127.0.0.1:54427/?platform=windows`；[体验截图](../test-results/d11-a3-final-20261114/experience-cua.png)、[启动记录](../test-results/d11-a3-final-20261114/experience-launch.json)，截图 SHA-256 `7FB6B037603DE28825889481DF9FEA5149DE8A9019DCBDD103D2D41D942DA790`。Edge、独立人工手感、正式标题美术、跨会话存档、正式关卡和最终 Matter 选型仍 NOT RUN。D11-A3 当前为 DONE（待 Work 审查），不进入 D12，不 Commit／Push／发布。

### 2026-11-14 D11-A1 Work 审查

基线 `d65859a`，开始时工作区干净。Work 阅读真实失败 sensor、检测后的控制／触发屏蔽、受限失败通知、单流程推进、等待捕获资源收尾、两阶段世界应用、主锚点验证、玩家放置、输入门槛和触发基线同步，以及实际 Matter 适配与测试。检测时先建立独立控制限制以防同 Tick 新操作，失败通知完成受控处理／确认退役后推进恢复；不把通知 Completed 当成恢复成功。源码为初始路线新增了窄落隙，属于灰盒测试几何，不是正式关卡修改；玩家物理参数未因此定案。

本轮重跑 `npm.cmd test`，类型检查、Electron Main 编译及 149/149 测试 PASS，0 fail、0 skipped；未重跑构建或 GUI。`run-uSMH74` 全部 30 项已列源码／脚本／ASAR 版本条目匹配当前文件，三端 PASS、code 0、清理 PASS、无非预期中断／页面错误。报告 JSON SHA-256 为 `DC8895BA6AA8E58470F4384CAA7959A81AEBB4D3B02BEF832CD485E70CB3A1BD`；当前 EXE 匹配报告。历史 FAIL 与测试收紧记录保留，Edge／独立人工／完整长套件不改判。

验证边界：初始备用与 A 主锚点的正常恢复、17 次连续失败、持键／在途捕获及部分失败锁定有真实核心覆盖。RF05 中错误版本／缺对象是验证器抛错断言，不能据此称整条失败流程的全部边界已验证；现有真实世界验证主要是主锚点空间与支撑，尚无独立完整世界校验报告、备用点遍历及坠落区排除。报告的“平台时钟恢复后”采样发生在 fading-in 阶段，之后平台可随实际步继续，不意味着淡入结束仍精确停在捕获时钟。

D11-A1 在当前正常路径范围收口，必要的安全校验和更完整流程级错误证据由下一项补齐。完整自动重建、RecoveryError、返回标题、存档和正式关卡仍未实现，不因正常恢复通过自动宣称异常恢复完备。

### D11-A2 任务卡：安全锚点与世界一致性验证

- 目标：在现有真实恢复链中，先完成可查询的世界一致性检查，再按“主锚点 → 预设备用顺序”选择第一个安全落点；关键错误或全部锚点不安全时继续失败关闭。补版本／对象等预检查错误的整流程证据，而不是只增加脱离恢复流程的验证器断言。
- 依据：PLAYER_CONTROL_DESIGN／DECISIONS 中 Fixed Respawn Anchor、恢复锚点按关卡预设顺序尝试、Critical Error／Warning 世界验证、严格版本／版本不兼容不自动重建、Fail-Closed、两阶段恢复与控制开放规则。备用顺序不同于检查点请求 priority，不擅自把请求仲裁规则推广为锚点排序。具体接口／字段／容差和灰盒备用坐标属于工程实现，不确认全局错误码或正式关卡配置。
- 模块：增量扩展 `recovery.ts`、现有检查点配置和 Matter 锚点／世界查询适配，必要时新增小型纯校验模块及测试；`graybox.ts` 接线，Phaser／页面只呈现只读报告和选中落点。复用既有 Runtime、快照仓库、控制 owner、阶段与失败关闭，不重写正常恢复、不新增依赖／通用验证框架或平行事件协议。
- 配置与身份：主／备用锚点属于可信关卡配置，备份列表有限且预先确定；至少一个灰盒检查点配置两个有序备用点，以覆盖跳过不安全点和停止于首个有效点。位置按现有真实静态地面选择，不改变玩家参数、不新增机关玩法。源快照的主锚点／checkpointId／Runtime 不因选中备用点被覆盖；恢复执行记录另记 primary／selected anchor 与尝试顺序，下一次恢复仍从主点重新检查。不要求每个未来检查点都有备用点，不新增全局 Anchor ID Generator。
- 三项锚点安全：在临时逻辑恢复、永久效果应用及物理重建之后，逐点检查玩家完整碰撞空间、真实有效支撑、与坠落失败区域不重叠。使用真实当前 Matter 世界，不只相信 terrain 数组或对象标签；已从 Composite 移除的地面不能继续作为幽灵支撑，sensor 不能算障碍或有效支撑。初始／A／B 主点保持兼容；本段限当前静态地面锚点，不声称复杂运动平台／任意坡面恢复均验收。
- 有限选择：先主点，主点不安全才按配置顺序试备份；找到首个通过全部检查者立即停止。不能随机、按距离自行排序、平移坐标反复试探或扫描地图寻找未知安全位置。全部失败返回清楚的逐点原因，玩家不放置、不淡入解锁；只读诊断和源码中的有限循环可证明有界。
- 世界一致性报告：检查必要登记对象在逻辑与实际物理世界中的存在／身份、平台时钟与快照逻辑的一致性、真实位置／碰撞体与恢复结果匹配、永久效果／实际路线碰撞状态，以及恢复期间触发屏蔽。最终占用基线在玩家放置后的现有收尾处核查，不要求在放置前证明未来占用已同步，也不据此确认历史“两次完整验证”架构。容差只能作为注明的原型数值，不能借放宽阈值掩盖错误。查询接口不暴露可变内部集合、不读取 DOM／Node／Electron，也不把只读诊断数据直接当成真实物理事实。
- Critical Error／Warning：必要对象、玩法逻辑、永久进度、碰撞、路线、安全和触发状态错误是关键错误，阻断恢复；不能通过换备用点绕过全局世界错误。只有不影响玩法的纯装饰／环境表现异常可作 Warning，视觉误导路线或危险判断仍属关键错误。报告保持小型局部类型化信息，便于后续异常处理，不制定全局正式错误码体系；当前没有合理的真实装饰告警时不为凑分类新增玩法／渲染系统。告警与核心／画布验证范围要如实说明。
- 阶段与控制：保持“预检查 → 临时逻辑 → 永久效果 → 物理重建 → 世界检查 → 有序锚点检查 → 玩家放置／输入清理／占用同步 → 淡入 → 仅释放恢复 owner”的顺序。世界关键错误不进入备用锚点循环，锚点全部失败不放置玩家；没有通过验证不能仅靠动画结束、R 或释放其他 owner 解锁。生命周期暂停使新增验证／尝试状态冻结，恢复后无补算或额外物理步。
- 预检查真实失败路径：错误 Runtime／Level／Checkpoint、schemaVersion／stateVersion、必要对象缺失及非法载荷，应在任何恢复性世界写入前拒绝，控制与触发屏蔽保持。使用最小只读源注入／受控夹具构造，不给生产页面增加任意写快照的 API；记录恢复应用／重建／放置调用次数为 0，而不只 assert 验证器 throw。该计数不包括淡出期间按原规则继续的普通物理步。保留原始坏数据和原快照，不默认补齐、不跳过对象、不迁移或重捕。
- 数据保护与错误去向：备用成功只影响本次落点，不更新当前快照、Checkpoint ID、永久进度或业务身份；目标 E 路线和奖励保持。版本或世界关键错误、锚点全失败时保留原数据并进入现有受限错误路径，提供结构化原因；本段尚不实现正式自动完整重建／RecoveryError 交互，不能把错误锁定画成“异常恢复成功”。其已确认的完整规则继续留待下一段实现，不以本任务的最小错误出口替代它。

验收与测试：

| 用例 | 必须验证的结果 |
| --- | --- |
| AV01 主点与预设顺序 | 正常主点通过，不访问备用；主点受阻、首备用也不安全时选下一预设点；多个备用都安全时只选配置中的首个。真实 Matter 全流程验证实际落点／朝向／支撑，不只测试排序函数。 |
| AV02 空间／支撑／坠落区 | 覆盖实体重叠、无支撑、仅 sensor 支撑、物理世界已移除但内部列表仍保留的“地面”、与失败区重叠的落点；均不作为有效点。全部预设点失败时不传送／不解锁，不搜索未知位置。 |
| AV03 世界关键错误 | 必需平台缺失或真实碰撞体未在世界、重建位置不一致、永久开放路线碰撞错误等分别成为关键错误；不靠备用点掩盖。原快照／进度保留，后续旧动画或 R 不解锁。 |
| AV04 告警与前置保护 | 合理非关键 Warning 不阻断安全恢复，混有 Critical 必须阻断；非法版本／身份／缺对象在恢复整流程中验证，世界写入／放置均未发生。合成告警测试要标注，不冒称真实画布故障已测。 |
| AV05 幂等／暂停／原路径 | 备用成功后原记录／所有业务身份不变，不误触发锚点所在检查点；真实离开重入仍可捕获。暂停／持 Space／E、重复失败、原 17 次循环与永久奖励／路线保护不回归；尝试次数受配置长度限制。 |
| AV06 当前三端回归 | Chrome Web、Electron 开发版、仓库外生产包运行当前构建的正常恢复与捕获／目标 E 路线，诊断显示世界检查和实际选中主点。新增备用／故障路径至少有真实 Matter 核心集成证据；若有受控隔离场景可三端执行则记录，否则该部分 GUI 明确 NOT RUN，不能用默认主点成功代替备用点 GUI 通过。 |

- 执行与证据：类型检查、`npm.cmd test`、`npm.cmd run electron:build`、当前构建的 `npm.cmd run test:d11-a1 -- --browser=chrome` 三端回归和 `git diff --check`；可另设精确专项命令，先核对参数路由，避免像上次误入平台长套件。保留原 149 项有效语义，报告实际命令、验证层级、源快照摘要、世界检查项、全部锚点尝试／选中原因、修改世界／放置次数、退出／清理及新资源哈希。补回归不以无意义镜像断言凑数量，旧 FAIL 原样保留。
- 交付与停止：界面说明选中的主／备用点及关键错误／告警，不加生产故障按钮或任意移动锚点工具；提供当前三端报告和正常体验入口，不能默认旧窗口已加载新产物，不关闭用户窗口。更新 README、本文、概述和实际受影响设计实现章节，保持字段为原型。没有新的产品决策需确认，常规数据结构／备用坐标自行选择；不做完整自动重建、RecoveryError 面板／手动重试／标题、跨会话存档、正式关卡／任务、新玩法或依赖，不改变 CONFIRMED／物理参数／暂停协议，不删除文件、不 Commit／Push／发布。完成后等待 Work 审查；同问题两轮有效修复失败或真实架构冲突时保留最小复现升级。

### D11-A2 执行结果（2026-11-14）

恢复配置新增有限可信备用顺序：初始检查点 `80,472,1 → [160,472,1, 700,472,-1]`，A 检查点 `1200,472,1 → [1160,472,1, 1300,472,-1]`，B 保留单一主点。恢复只从当前有效快照取来源；主点失败才按数组顺序检查，首个安全点通过后立即停止，不随机搜索、不读请求 priority。选中备用不写回源 primary anchor、Checkpoint ID、Runtime、业务身份或永久进度。

世界检查发生在临时平台应用、永久效果重协调和真实 Matter 重建之后、玩家放置之前。真实 `Composite.allBodies()` 用于排除已从物理世界移除但数组仍保留的幽灵 Body；sensor 不算阻挡或支撑，完整玩家碰撞体不得与失败区重叠。关键检查覆盖固定平台逻辑／真实 Body／轴向／时钟／方向／相位／周期／位置／尺寸、单向平台、路线门、检查点与诊断 sensor、永久 OPEN／CLOSED 对门 collision mask，以及控制锁和触发屏蔽。没有正式装饰系统，因此 Warning 分支使用明确标注的合成注入，不宣称真实画布装饰故障已测。

预检查使用只读测试源进入完整恢复流程。错误 Runtime／Level／Checkpoint、schema／state 版本、缺对象和非有限载荷均在临时应用、永久效果、物理重建及玩家放置之前失败；测试包装计数证明这些恢复性世界写入为 `0`。原快照、控制锁与触发屏蔽保持，R 不能解锁。

| 用例 | 状态 | 实际结果 |
| --- | --- | --- |
| AV01 主点与预设顺序 | PASS | 真实 Matter 全流程：主点安全只尝试 `1` 次；主点受阻选首备用；首备用仍不安全时选第二备用并恢复朝向；首个安全点后不访问后续。 |
| AV02 空间／支撑／坠落区 | PASS | 实体重叠、无支撑、仅 sensor、Composite 移除但 `terrain` 保留的 `ground-a`、失败区重叠均拒绝；全部点失败时不放置、不淡入解锁、不搜索未知坐标。 |
| AV03 世界关键错误 | PASS | 平台 Body 缺失、真实位置不一致和 OPEN 路线门 mask 错误分别产生 Critical；不进入备用循环，原快照／进度保留。 |
| AV04 告警与前置保护 | PASS | 合成 Warning 单独存在时安全恢复；Warning 加 Critical 时阻断；7 类非法身份／版本／对象／载荷均在零恢复性世界写入下失败。 |
| AV05 幂等／原路径 | PASS | A 主点受阻后选中备用 `1160,472,1`；源记录仍为 A，Checkpoint／Runtime／Event／Command／Transaction 不变，目标／奖励／效果 `1/1/1`、路线 OPEN、保存数和 Entry 数不增加；原 17 次循环、暂停和输入门槛回归通过。 |
| AV06 当前三端正常恢复 | PASS | [run-xrUFrD](../test-results/platform/run-xrUFrD/report.json) 中 Chrome Web、Electron 开发版、仓库外独立包全部 PASS；三端 `worldValidation=valid`、选中主点、尝试数 `1`。 |
| AV06 备用／故障三端 GUI | NOT RUN | 当前没有生产故障按钮或备用锚点受控 GUI；不能以默认主点通过代替备用／故障 GUI 通过。 |

`npm.cmd test` 为 `154/154` PASS，0 fail、0 skipped；新增 AV01–AV05 五项并保留原 149 项。`npm.cmd run electron:build` PASS；`npm.cmd run test:d11-a1 -- --browser=chrome` 三端 PASS，使用 Chrome `156.0.8078.74`，三个测试自有进程 exit code `0`，`cleanupFailures=[]`，非预期中断和页面错误均为 `0`。

最终报告 JSON SHA-256 为 `9F9F5763BF95EE13034D71A89BF41F0487983A1E81208E1C565A234596A1DC57`，`timeline.jsonl` 为 `297CBFB1A06C1D3467FBA2E1B1FA25D8032E7586E7495C4C47F80A1E6C9CCF5C`；ASAR 为 `F6DB54B409F009CE7511EFD836A3CCD57183DE1D6F22D1BAEF23DB366EAC91DF`，EXE 为 `84D84572EAD089C524880FF346FE6D0338809712F2315438D9225C329D8D4D56`。最终脚本／源码哈希为：`src/core/recovery.ts` `945AD1C5CB13380BE961FE3DB549EF07919B32A3B50A8C35145B0468DBB15F0C`、`src/physics/matter/graybox-world.ts` `9DC1242FEF40E0E2EB44833873724F27494326FF79523055C54C9DAA1DA8C4EE`、`src/core/snapshot.ts` `BC922890C0ED335F5D226064A26724193F238F5DC697F19A2E956C0A0CF7433C`、`tests/recovery.test.mjs` `A69E76E8AE3F8B58E9E2008174D27345E32416BA267DE5887883667012B82AA6`、`tests/graybox-browser.mjs` `F6A82D91068003EAA837F40A625F2502E95DCB03A2C6BB6EF744890B42ECCE89`。

供用户体验的最终 Electron 开发窗口使用 `npm.cmd run electron` 启动并保留：PID `464`、HWND `38144282`，标题“叠城大冒险 | Layered City Adventures”，URL `http://127.0.0.1:50354/?platform=windows`；[体验截图](../test-results/d11-a2-final-20261114/experience.png)、[启动记录](../test-results/d11-a2-final-20261114/experience-launch.json)，截图 SHA-256 为 `6411E356C269220680E938F0F0D64B73A52E75E635FEF5197131A6DBFA7790F4`。画面明确显示 `D11-A2` 恢复诊断。旧 D11-A1、较早 D11-A2 和其他体验窗口未关闭。

历史 `run-d9OOXw`、`run-SxTbQP`、`run-7y0Bor` 等 FAIL 继续保留；D11-A2 的 `run-zxQUDC`、`run-bcMZCA`、`run-7J4q1n` 也保留为测试脚本修正前的 FAIL。它们依次暴露：跨阶段复用淡入计时器不能按一个单调值比较；恢复快照重建后平台时钟会从快照值重新前进；`fading-in` 采样须按实际 `tick - recoveryPlacedTick` 检查固定步推进。第三次修复后 `run-xrUFrD` 三端 PASS；`run-uSMH74`、`run-cu1i2u` 只作为历史正常路径证据。Edge、独立人工手感、备用／故障 GUI、完整自动重建／RecoveryError、存档和正式关卡仍 NOT RUN。D11-A2 当前为 DONE（待 Work 审查），不自动进入后续任务，不 Commit／Push／发布。

### 2026-11-14 D10-A3 Work 审查

基线 `bb6e20d`，开始时工作区干净。Work 阅读触发占用边沿、每 Tick 开批／物理检测／闭批仲裁／受限进入事件收尾／单轮 bus 分发／胜出后创建捕获事件的实际顺序，及 R 防护、基线同步和 TR 测试。相同 Tick 请求按唯一 priority 排序，捕获事件在普通分发之后创建，下一 Tick 才交付；传感器不直接冻结平台。进入事件有独立 producer 与受限收尾，不伪造普通 Accepted Command。触发机会消耗与捕获执行分离，离开不取消、忙碌不补发与真正重入已有对应真实 Matter 测试。

本轮重跑 `npm.cmd test`，类型检查、Electron Main 编译及 144/144 测试 PASS，0 fail、0 skipped；未重跑构建或 GUI。`run-hmo8zZ` 全部 28 项已列源码／脚本／ASAR 哈希匹配当前文件，三端均 PASS、进程 code 0、清理 PASS、cleanupFailures 为空，无非预期中断／页面错误。报告 JSON 为 `592849A14D42B6D591D8FC115A85995F7582ED5D10D8C75824606187FC49890F`，当前 EXE 也匹配交付哈希。首次 run-zrOvKK FAIL 与测试准备修正记录保留。当前触发源是在物理步后同步采样，不据此宣称通用异步迟到请求接口、Edge、人工手感或完整物理长套件已通过。

D10-A3 与 D10 当前灰盒捕获范围收口。R 仍只是调试重置，不能当作快照恢复；下一项是可玩正常坠落恢复。正式场景内容、异常恢复、存档及物理最终选型保持原状态。

### D11-A1 任务卡：正常坠落恢复闭环

- 目标：玩家真实走跳跌入独立坠落区域后，经共享协调入口启动单次失败恢复；短暂淡出，使用当前有效检查点的完整快照回滚临时世界，重新应用永久效果，重建物理／视觉并验证已配置锚点，放置玩家、清理瞬时状态，淡入后由 PC-01 恢复控制。首次检查点激活前使用初始备用记录，之后使用实际最新有效记录；不能只调用 R/reset 或刷新页面冒充恢复。
- 依据：DECISIONS／PLAYER_CONTROL_DESIGN 的初始完整备用快照、单有效检查点、永久记录幂等、Failure / Recovery 触发屏蔽、两阶段恢复、Fixed Respawn Anchor、世界一致性验证、短暂淡出淡入及 PC-01／PC-02。复用 D10 的固定登记、严格版本、源 Runtime、现有平台状态及共享协调器。只实现正常成功路径和必要失败关闭保护，具体接口／阶段名／动画数值为工程原型，不确认完整五阶段提案或最终参数。
- 模块：新增必要的小型共享恢复状态模块与测试，在 `graybox.ts` 接线；在 Matter 适配器实现逻辑状态应用、物理重建／安全锚点查询和玩家放置；Phaser 仅根据只读状态画简单淡出淡入、更新摄像机，Web 只做既有输入／生命周期适配。不得把恢复业务放进 Electron Main、DOM 或 Phaser 回调，不新增依赖／完整场景框架。
- 独立失败检测：在现有真实可跌落间隙下方设置独立 sensor 区域，不加生命值、复活次数或惩罚。检测基于实际固定步和玩家主体，只报告失败请求，不在物理碰撞回调里直接传送。区域坐标／尺寸按当前灰盒工程配置选择，不能修改玩家跳跃／碰撞参数来凑用例。至少一条三端路线通过真实移动掉落，不直接调用恢复函数或篡改成功状态。
- 统一入口与单流程：失败通知遵循已有协调器创建／登记／入队／防重，协调器通过受控流程入口接纳失败。允许像检查点进入事件一样采用范围受限的无命令通知收尾，但不得伪造 Accepted、泛化任意 handler 完成或另造事件总线；通知处理结束与恢复完成明确区分。恢复流程持有自己的活动身份与状态，只能存在一笔，重复坠落／旧事件不重复淡出、传送或新建流程。不要求每个淡出阶段新增业务 Command／Transaction，也不得引入目标记录容量导致“最多复活 16 次”等次数限制；如使用这些身份，必须复用原生成器及防重规则。
- 控制与输入：从协调接纳失败起通过独立 recovery owner 锁定移动、跳跃、交互，必要时终止临时调查／反馈，只释放其自身控制限制；其他 owner 保持有效。清理速度、跳跃请求／计时、输入缓冲、交互／坠落状态，保留“先松开再按”的门槛，不能因 reset 清除 needsRelease。恢复后持续持有 Space／E 不自动跳跃或交互。R 和其他调试入口不得打断、绕过或并行执行恢复。
- 触发屏蔽与在途捕获：Failure／Recovery 期间停止新的检查点激活／刷新与坠落流程，既有占用与基线可受控同步，不关闭整个碰撞系统。未完成的进入请求要明确阻挡／消费，不在恢复结束补发，不清空整个 Inbox 或重放 Completed。已启动捕获按既有不可取消规则安全完成／失败并释放其资源，不能为恢复强行夺锁或改写冻结对象。正常实现可先在锁定／淡出阶段等待其安全收尾，再锁定当时最新有效的原子快照作为本次恢复源；记录该选择时机，之后不换源。无法确认旧资源已安全释放时保持受限并报告，不重开旧捕获，不引入 while 等待或无限恢复。
- 预检查与数据保护：在修改世界前验证捕获来源 Runtime／Level／Checkpoint、schemaVersion、所有固定对象 ID／stateVersion、载荷完整性与有限数值。快照不可变，整个恢复不调用 capture／commit，不覆盖或重建当前记录，不清空永久进度。恢复不重新生成 Runtime UUID，不回退 SimulationTick、物理步计数、Event／Command／Transaction 序列或其已知状态；不得整页 reload 或新建一个空运行实例作为复活。
- 两阶段世界恢复：先把所有登记平台恢复为快照里的临时逻辑时钟／相位／位置等，再应用独立进度产生的永久效果，形成完整逻辑结果；然后依据该结果统一更新真实碰撞体与必要视觉、清理陈旧接触／速度／冲量缓存。不能直接反序列化 Matter Body／Engine，也不能把当前引擎全局时钟回拨到平台临时时钟。两逻辑阶段应有明确边界和可测试顺序；两者之间不得发生半恢复世界的普通物理求解。临时平台时钟可回滚，但后续运动从恢复值继续，不补算失败／恢复经过的路程；目标 E 已开放路线必须保持实际可通行、奖励不再发。
- 锚点与放置：世界重建后，检查当前检查点已经配置的主锚点，使用真实碰撞空间、有效支撑和坠落区域排除进行验证；传感器不算阻挡或支撑。通过后才放置玩家并恢复朝向，刷新支撑及摄像机。初始／A／B 使用已有配置，不取玩家坠落坐标、不全图扫描未知安全位置。正常单主锚点成功路径必需的检查不能省略；多备用锚点遍历和复杂世界验证后续单独验收。遇到不安全主锚点时必须保持锁定／触发屏蔽和原数据，不能“临时找个位置”强行成功。
- 触发重同步：玩家放置后、恢复屏蔽解除前，同步检查点与坠落区域的实际占用基线及机会状态。A／B 锚点就在检查点区域内，恢复不能伪造 enter 自动重捕，需真实离开再进入才有新机会。相同失败区域重复通知不能重开当前流程；传送后的旧触发事件不得重放。恢复前后的业务编号继续递增，恢复不是一次新场景／检查点激活。
- 时间与呈现：淡出淡入使用简单覆盖层，时长／曲线作为可调原型参数记录；进度随实际固定步推进，平台适配层隐藏／最小化时恢复状态与淡化时钟一起冻结，恢复后不补算。生命周期暂停不变成失败恢复，不能通过 Pause Token 把自己等待的恢复 Tick 永远暂停。核心始终定义实际阶段次序与物理更新边界，保持正常每 Tick 一次求解，不额外补步。只有世界／锚点验证与淡入都成功，才释放 recovery owner；动画回调不能单独解锁。
- 最小错误保护与明确未完成：版本／对象／逻辑应用／物理重建／永久效果／锚点验证失败时，保留原快照、永久记录与流程诊断，锁定并屏蔽触发，显示可读受阻原因，不闪退、不自动解锁、不循环重建。本段不实现完整自动重建、正式 RecoveryError 面板／手动重试／返回标题；相关正式规则仍有效但实现明确留待后续，不将这个最小受阻状态宣称为完整异常恢复已通过。

验收与测试：

| 用例 | 必须验证的结果 |
| --- | --- |
| RF01 初始备用恢复 | 未激活 A／B 时真实坠落，经淡出／世界恢复／验证／淡入回到初始锚点；全程只一笔恢复，正常开放控制发生在最后，R 仍是独立调试功能。 |
| RF02 当前记录与平台回滚 | 激活 A／B 后让平台继续运动，再坠落，恢复使用对应的最后有效记录／锚点；真实平台逻辑回到快照，世界与碰撞同步、清旧速度，后续无追赶。当前记录与源快照内容不变。 |
| RF03 永久进度／反复失败 | 目标 E 完成、奖励／路线已开放后坠落，目标／奖励／效果仍只一次，门保持可通行；连续多个失败恢复不增加奖励、不重开原业务事件、不重置 Runtime 或业务序列。核心循环至少越过原型常见 16 条记录上限，证明未引入次数限制或无界完整事件历史。 |
| RF04 输入／触发与并发 | 持 Space／E、临时调查、恢复中重复坠落、R、同 Tick 新检查点请求及已启动捕获场景均覆盖；已启动捕获不取消，新触发不补发；恢复到区域内不自动刷新，真实离开重入后仍可保存。 |
| RF05 暂停与必要失败保护 | 核心精确暂停恢复中间阶段，三端真实隐藏／最小化后无状态／淡化时钟追赶；错误版本／缺少对象／重建失败／不安全锚点时保持锁定与源数据，不靠动画／reset 解锁。错误场景只按实际核心覆盖记 PASS，完整异常恢复仍 NOT RUN。 |
| RF06 三端真实游玩 | Chrome Web、Electron 开发版、仓库外独立包分别完成一次初始备份坠落与一次 A／B 捕获后的真实坠落恢复；提供阶段、源记录、锚点、恢复次数、输入门槛及进度证据。测试通过不等于人工手感验收或最终 Matter 选型。 |

- 验证交付：运行类型检查、`npm.cmd test`、`npm.cmd run electron:build`、建议新增 `npm.cmd run test:d11-a1` 的三端定向入口及 `git diff --check`；保留原 144 项有效语义并覆盖 A3 捕获／目标 E 相关回归，可合并会话。既有纯物理用例确需隔离新增自动恢复时，明确夹具范围，不能在正常三端恢复路线关闭失败检测。报告 task D11-A1、当前新增源文件／脚本／资源／产物哈希、逐端退出／清理和历史 FAIL，不能用旧捕获报告作恢复证据。
- 体验与停止：提供真实坠落、淡出、锚点恢复和路线保留截图，保留一个正常体验窗口、启动命令和操作路线，不关闭用户已有窗口。只维护真实受影响的 README、路线图、概述和必要设计实现说明；不新增正式关卡内容／任务、备用点搜索、完整自动重建／RecoveryError、存档、依赖或平台，不改 CONFIRMED／物理参数／暂停协议。工程细节自行确定，无新增产品决策需求；真实冲突或同问题两轮有效修复失败则保留最小复现交 Work。不删除文件、不 Commit／Push／发布，完成后等待审查，不自动进入 D11 后续任务。

### D11-A1 执行结果（2026-11-14）

已在当前灰盒完成正常坠落恢复闭环。独立失败 sensor 为 `failure-plane-graybox-a`，中心 `560,620`、尺寸 `300x42`；淡出／淡入各 `500 ms`，捕获资源安全收尾等待上限 `120` Tick。恢复只从当前有效检查点选取一次来源，依次执行 `fading-out → waiting-for-capture → restoring → validating → fading-in → succeeded`。世界阶段先应用固定平台快照并重新协调永久效果，再重建真实 Matter 碰撞、验证固定主锚点、放置玩家和清理瞬时输入，最后同步触发基线并在淡入结束后释放 recovery owner。

恢复不调用 capture／commit、不重载页面、不重置 Runtime、SimulationTick、物理步或业务身份。Space 与 E 的松键门槛独立保留；三端在恢复完成时仍持有两键，报告中的页面诊断均为 `needsRelease=true`、`interactionNeedsRelease=true`、`jumps=0`。生命周期隐藏／最小化期间恢复阶段、淡化、平台和物理时钟冻结，恢复后不补算。

验收结果：

| 用例 | 状态 | 实际结果 |
| --- | --- | --- |
| RF01 初始备用恢复 | PASS | 核心真实 Matter 与三端真实走跳回到 `graybox-initial-spawn`／`80,472,1`，支撑 `ground-a`；恢复只在淡入完成后开放控制。 |
| RF02 当前记录与平台回滚 | PASS | 三端先真实完成 A 捕获，再让平台继续运动并坠落；恢复回到 `graybox-test-capture-a`／`1200,472,1`，平台逻辑回滚且 A 保存数／Entry 数不变。 |
| RF03 永久进度与反复失败 | PASS | 核心连续 17 次失败仍保持同一 Runtime、目标／奖励／永久效果 `1/1/1` 和开放路线，没有 16 次恢复上限或旧事件重放。 |
| RF04 输入、触发与并发 | PASS | 三端持续按住 Space／E 恢复后无自动跳跃、无交互重放；核心覆盖调查中断、重复坠落、R 拒绝、在途捕获和恢复后区域基线。 |
| RF05 暂停与失败关闭 | PASS | 三端真实隐藏／原生最小化无追赶；核心故障注入的错误版本、缺对象、重建、永久效果和不安全锚点均保持锁定与原数据。 |
| RF06 三端真实游玩 | PASS | [run-uSMH74](../test-results/platform/run-uSMH74/report.json) 中 Chrome Web、Electron 开发版和仓库外独立包均 PASS，三个测试自有进程退出码 `0`，清理失败、页面错误和非预期中断均为 `0`。 |

三端恢复关键 Tick：

| 环境 | 初始检测 → 完成 | A 检测 → 恢复完成 | A 平台时钟：捕获 → 继续 → 恢复后 |
| --- | --- | --- | --- |
| Chrome Web | `217 → 278` | `862 → 921` | `6083.33 → 6950.00 → 6150.00 ms` |
| Electron 开发版 | `240 → 304` | `867 → 926` | `6000.00 → 6700.00 → 6000.00 ms` |
| 独立生产包 | `236 → 299` | `867 → 926` | `6033.33 → 6766.67 → 6033.33 ms` |

`npm.cmd test` 为 `149/149` PASS，0 fail、0 skipped；`npm.cmd run electron:build` PASS；`npm.cmd run test:d11-a1 -- --browser=chrome` 三端 PASS。当前报告 SHA-256 为 `DC8895BA6AA8E58470F4384CAA7959A81AEBB4D3B02BEF832CD485E70CB3A1BD`，ASAR 为 `A4126CBE4E742B26205940569BF418C54FC493E379B7E147F6D1EFEA6CD56BF3`，EXE 为 `7B6A94D6E976D1D32DFBE5BCB916B422FE5799DECE5B30CD6463F071FEF7A432`。

历史失败 `run-d9OOXw`、`run-SxTbQP` 和 `run-7y0Bor` 保留为 FAIL；`run-LX3ZH5` 为 Web-only 附加 PASS，`run-Fk0Zr8` 为收紧持续 Space／E 证据前的三端 PASS。Edge、独立人工手感和完整物理长套件本轮 NOT RUN。完整自动重建／RecoveryError 交互、多备用锚点搜索、跨会话存档、正式关卡与最终物理选型均未完成。

供用户体验的正常 Electron 窗口继续运行：PID `11088`、HWND `612241018`，标题“叠城大冒险 | Layered City Adventures”，[体验截图](../test-results/d11-a1-20261114/experience.png)，[启动记录](../test-results/d11-a1-20261114/experience-launch.json)。窗口留给用户自行操作和关闭。

D11-A1 当前为 DONE（待 Work 审查）；等待审查，不自动进入 D11 后续任务，不 Commit／Push／发布。

### 2026-11-14 D10-A2-R1 Work 复审

基线 `5fc9be9`，开始时工作区干净。Work 阅读执行器自身冻结标记、冻结／锁分别清理、终态后 recover 仅执行资源清理、历史 requestId 回执及新请求准入；源码／专项测试哈希分别为 `4A0955E2905876FF9F5994B4D50DCF83CFDD9C7A1AC835D7EF5D9E19B1D9FE4A`、`AD07E83B93C3F6EB76C09416C732DB2C403CAD338A3248812F662D731024264B`，匹配报告。本轮重跑 `npm.cmd test`，类型检查、Electron Main 编译及 139/139 自动化测试 PASS，0 fail、0 skipped；没有重跑构建或 GUI。当前 ASAR／EXE 哈希也匹配交付报告，但不以构建产物代替新捕获 GUI 证据。

Work 另用当前真实核心和 Phaser 内置 Matter 重跑两条旧复现：外部冻结冲突的原请求保持 Failed，外部解冻后全新 requestId 返回 created，Event 3 的后继捕获 Succeeded；提交前失败叠加一次锁释放中断，原事务 Failed／lock held，显式清理一次后仍 Failed、lock false、cleanupAttempts 1，新独立请求随后 Succeeded。现有 R1 测试另覆盖持续冻结清理故障、历史身份、他人资源保护与重复清理幂等。两条阻断缺口关闭，D10-A2 在当前核心／真实 Matter 模块集成范围收口；历史失败、未完成平台长入口、Edge／人工限制均保留。

下一项转向可见捕获接线，不再新增无关协议层。真实触发与 Tick 仲裁尚未实现，不能把 A2 的 granted 测试请求当成生产传感器接线；正式恢复与存档仍未实现。

### D10-A3 任务卡：灰盒检查点触发、批次仲裁与可玩捕获

- 目标：玩家在现有灰盒走跳进入检查点测试区域后，自动产生进入请求；统一收集当前实际 Tick 的请求，闭批仲裁，只让胜出且获准的请求启动已有捕获事务。界面显示候选／有效检查点及真实结果，玩家可以离开、重入刷新或走向另一检查点替换。先交付可操作闭环，不做坠落传送或恢复。
- 依据与当前基础：遵循 DECISIONS 和 PLAYER_CONTROL_DESIGN 的 Fixed-Phase Batch Collection、Batch Collection Before Arbitration、Simulation Tick Arbitration、Unique Checkpoint Priority（数字小优先）、Centralized Checkpoint Arbitration、Independent State Modules、Single-pass Event Dispatch、同点不排队／离开不取消、全局单捕获事务及永久／临时分离。复用 D10-A1／A2／R1 的共享 BusinessRuntimeBus、捕获事务、原子存储与资源清理，不重写执行器／生成器，不新建事件总线或第二个协调器。
- 模块范围：新增必要的轻量 Trigger Lifecycle／Request Batch 与协调组合（不强制各建一个类），由 `graybox.ts` 接入实际固定步；物理层只提供玩家与区域的真实占用检测，Phaser／Web 显示区域和只读状态。扩展当前灰盒检查点配置和最少测试，不新增依赖、菜单系统、正式地图或通用区域编辑器。与原 D05 诊断区分开，不能将诊断 enter 计数直接当成检查点尝试状态。
- 测试区域与配置：至少两个可见、可通过现有走跳抵达的临时检查点区域，区域允许局部重叠以验证竞争，也能验证独立进入。出生点、正常 R 位置和原目标 E 测试路线不得因新增区域发生意外自动激活；初始出生备份保持隐式，不把它直接改为一个正式触发区域凑数量。可新增第二个测试 checkpointId、锚点和区域，坐标／尺寸／优先级数值均为灰盒工程配置，不升级为首关正式位置。配置验证覆盖身份、锚点、区域数值和同一竞争范围的唯一优先级，重复优先级报配置错误，不用回调先后、Event ID 或随机数打破平局。
- 触发器职责：根据每次实际物理步之后的玩家主体占用更新 enter／sustain／exit；持续停留不重复申请，真正离开再进入才产生新机会。每次真实进入具有稳定请求身份，重复通知沿用，重入使用新身份，不复用暂停请求 Key／Token。触发器只向统一协调入口报告，不直接抢锁、冻结、提交快照或自行设置 granted=true。初始化／调试重置后的基线同步不产生伪 enter，不给暂停、渲染帧、丢弃时间制造进入机会。
- 批次与阶段：每个实际 Tick 开始打开收集批次，世界／物理／触发检测期间只登记；所有相关检测与请求收集完成后才关闭，再按有效批次 Tick 和唯一优先级升序仲裁。第一个请求不得立即捕获；交换触发器创建／回调顺序，胜者不变。关闭后的迟到请求归下一有效批次，不修改旧批次；已落选／已被阻挡的请求不得借此重新排入下一批。写清宿主的真实阶段顺序，不改变固定时间步、单 Tick 一次 Matter 求解，也不重复调用共享 bus.dispatch(tick)。
- 事件与授权：进入请求必须遵循统一事件创建／登记／入队和身份规则，不能绕过既有 Inbox 直接把传感器数组当作已正式处理的事件。请求批次保留已校验的进入引用，不擅自改其他模块内部状态。只由协调器的闭批仲裁产生受控胜出授权，再接入现有捕获入口；不得仅凭外部载荷的 granted 字段绕过仲裁。若胜出后另建捕获业务事件，必须显式关联进入请求，使用新 Event ID 并遵循单轮延后，不能递归 dispatch 让它插入已固定批次；如复用源事件，仍保证一个 Event 最多交付一个 Command。
- 无命令进入路径：落选／被阻挡或仅完成收集仲裁的进入事件，不得伪造 Accepted Command 回执，也不能遗留不可结束的 Pending／Processing 或悄悄删除。可以为检查点请求增加受限、可查询的收集／仲裁处理结束路径，最后确认与安全退役仍走既有 producer 协议；只有真正的捕获命令才进入目标事务模块。该工程细化不泛化为任意 handler 返回即 Completed，普通命令事件仍由真实 Accepted 才完成，不升级全部无命令事件的最终 API。
- 胜负与忙碌：只有胜出者尝试获取现有全局捕获锁；落选、锁忙或现有捕获生命周期尚未收尾的请求均消耗本次进入机会，不缓存、不排队、不在结束后自动补发。占用状态仍正常更新。同一检查点事务期间重入也只更新占用／消耗机会，不并行；离开不取消已启动捕获。区分真实 lock held 与 A2 的结果／资源收尾 busy，诊断不得把已释放的锁假报为仍被持有，不能绕过 R1 准入强行启动。
- 成功／失败：捕获候选不冒充当前有效检查点；只在原子提交成功后更新有效 checkpointId／锚点／快照。失败保留旧记录并给出简短反馈，站在区域内不得自动重试；资源释放或显式清理成功也不能凭空产生重入。原事件与结果事件独立确认／安全退役，历史 requestId 不因新区域触发被覆盖。保留有限容量及有限近期诊断；满时明确反馈并保留旧检查点，不能清空历史、回退 ID 或改成无限队列。本段不实现命令／事务通用清理或无限时长运行保证。
- 暂停与调试重置：沿用 Lifecycle Controller／Pause Token；真实隐藏或最小化时占用、批次、捕获与反馈不推进，恢复不补算、不重放。R 在对象冻结时必须有界拒绝并反馈，不让现有物理 reset 抛异常逃逸到页面，不取消捕获、不排队重置；正常 R 保留当前有效检查点、运行身份、进度和奖励，并同步触发器占用基线，不能合成一次重入。普通对话锁、失焦松键门槛及无关交互继续独立生效，不用全局暂停／玩家锁替代捕获局部冻结。
- 可玩反馈：场景画出测试区域与名称；显示当前有效检查点、最近进入／仲裁结果、候选与提交状态、捕获／结果身份及保存次数。短暂显示“保存中／已保存／本次被阻挡／保存失败”等真实反馈，Pending 不显示成功，提交后不长期留着旧 Pending 提示。基于实际快照呈现，不在 DOM 或渲染器直接写业务状态。保留现有目标 E、收藏 D 与其他灰盒功能，不顺带制作正式首关美术或任务系统。

验收与测试：

| 用例 | 必须验证的结果 |
| --- | --- |
| TR01 进入／停留／重入 | 实际移动进入自动完成一笔捕获，停留多个 Tick 不重复；离开保留快照，真正重入生成新请求／业务身份并刷新；进入另一区域替换当前记录，始终只有一个有效检查点。 |
| TR02 完整闭批与顺序 | 同 Tick 同时进入两区，低数值优先级唯一胜出；倒置区域／回调／创建顺序结果不变。重复优先级明确配置错误。较早 Tick 请求不被后到优先级倒置；批次关闭后的迟到请求只能进入下一有效批次。 |
| TR03 不排队／非取消 | 捕获中离开不取消，重入／另一点被阻挡不补发；结束后仍停留不捕获，须再离开重入。落选进入机会同样消耗；事件／结果确认退役后重复旧请求不再执行。 |
| TR04 失败与资源边界 | 核心故障测试验证捕获失败保留旧数据，不自动重试；R1 的终态后清理不重开事务，清理后必须新的有效进入才可启动。不要求为 GUI 新增生产故障按钮，不把核心故障 PASS 冒充三端故障运行。 |
| TR05 暂停／重置／控制 | 核心精确验证捕获中暂停与 R 拒绝，避免靠极短 GUI 采样抢状态；三端真实隐藏／原生最小化后状态不变，恢复不重触发。正常 R 后基线同步、无伪 enter、当前记录与永久效果／身份保留，控制锁和松键门槛不回归。 |
| TR06 三端可玩闭环 | Chrome Web、Electron 开发版、仓库外独立生产包均用真实方向／跳跃输入进入区域，产生真实事务／结果并保存。至少一条正常端到端路线不调用 requestCheckpointCapture、不伪造授权／占用或直接写快照；复杂竞争可用可控核心／真实 Matter 场景确定性构造。目标 E 仍正常开门且奖励一次。 |

- 执行：类型检查、`npm.cmd test`、`npm.cmd run electron:build`、建议新增 `npm.cmd run test:d10-a3` 的三端定向入口及 `git diff --check`；保留原 139 项有效语义，并运行受影响的 A1 初始化／目标 E 相关回归（可合并同一三端会话）。旧测试因新增正常自动进入而需要更新时，说明行为差异，不删除身份、无副作用或幂等断言。测试 task 为 D10-A3，记录当前新增模块、脚本、应用资源与产物哈希，不能沿用旧 A1 PASS 证明新 GUI。Edge／完整长套件或人工未跑就如实标记。
- 证据与交付：逐端记录检测 Tick／有效批次／关闭与仲裁 Tick、各区占用与机会、胜负原因、候选／当前 checkpointId、锁与资源归属、完整事件／命令／事务／结果身份及 capture／commit 次数；提供真实区域、保存反馈截图和准确操作路线。测试自有窗口清理后另保留一个可供用户体验的正常窗口及启动记录，不关闭用户已有窗口，不把自动化按键称作人工手感验收。
- 停止边界：只做现有灰盒测试区域和已确认的进入／捕获规则，不做坠落传送、两阶段恢复、RecoveryError、存档、正式关卡内容／任务、新平台或依赖；Matter 仍是验证候选。普通工程接口、区域坐标与数据结构自行选择并注明原型，无新产品决策需确认；真实 CONFIRMED 冲突或同问题两轮有效修复失败再交 Work。更新 README、本文、项目概述及确实受影响设计章节，保留历史／用户修改，不删除文件、不 Commit／Push／发布。完成后停止等 Work 审查，不自动进入 D11。

### 2026-11-14 D10-A3 执行结果

在现有灰盒新增金色 A／绿色 B 两个可见检查点 sensor，配置为局部重叠的 `80x92` 区域，priority 分别为 `10`／`20`，路线 OPEN 后启用。共享核心按真实物理步后的占用更新 enter／sustain／exit，收集当前 Tick 请求后闭批，并以 `(batchTick, priority)` 选择唯一胜出者；落选、锁忙或资源收尾中的请求只消耗本次机会。胜出请求先完成并退役受限的检查点进入事件，再创建关联 `sourceEntryEventId` 的捕获事件，进入既有真实命令、跨 Tick 事务、原子提交、结果事件、确认与资源释放链。R 在局部冻结期间有界拒绝，正常 R 保留当前记录、Runtime、进度、目标 E 奖励与 OPEN 效果，并同步占用基线。

`npm.cmd test` 为 `144/144` PASS，0 fail、0 skipped，保留原 139 项；新增 D10-A3 核心测试 5 项，覆盖 TR01–TR05。生产构建 PASS，ASAR 为 `1F7CE7668B71DAFC9C860E58F1C99632657904D28AD859DCB72DFEE36DD55FA0`，Windows EXE 为 `D56A12B198E3418B8A3941C0F7465DD4DAB182478F6BF9CAF5AA5E2437AF8C7B`。三端定向 [run-hmo8zZ](../test-results/platform/run-hmo8zZ/report.json) 的 Chrome Web、Electron 开发版、仓库外独立生产包全部 PASS，清理失败、页面错误及非预期中断均为 0。

三端 A 捕获身份均为 Entry／Capture／Command／Transaction／Result `3／4／2／2／5`，B 均为 `6／7／3／3／8`，A 真实重入均为 `10／4／4／11`；暂停 Tick、A／B 检测 Tick 和浮点位置按渲染调度不同。首次 [run-zrOvKK](../test-results/platform/run-zrOvKK/report.json) 的失败已保留：Web 测试在已快速保存后仍读取旧候选，Electron 路线产生额外重入；修正准备逻辑后通过，应用捕获规则未放宽。

TR06 只证明当前灰盒的可玩捕获闭环；Edge、完整物理长套件及独立人工操作本轮 NOT RUN，坠落传送、完整恢复、RecoveryError 和存档仍 NOT RUN。Matter 仍是验证候选。当前等待 Work 审查，不进入 D11，不 Commit／Push／发布。

### 2026-11-14 D10-A2 Work 审查与 R1 任务卡

基线 `7921b13`，审查开始时工作区干净。Work 阅读共享 BusinessRuntimeBus、真实接收／执行接线、捕获／提交／清理和真实 Matter 冻结适配及 CT 测试；交付报告所列三项核心／测试 SHA-256 均匹配。本轮重跑 `npm.cmd test`，类型检查、Electron Main 编译及 136/136 自动化测试 PASS，0 fail、0 skipped，未重跑构建或 GUI。`run-sJQsTu` 的 26 项已列版本条目匹配当前文件，三个进程 code 0、清理 PASS、无清理失败或非预期中断／页面错误；它仍仅为当前产物的 A1 宿主回归，不是新捕获 GUI 验收。

Work 用当前真实核心和 Phaser 内置 Matter 做两次无文件写入复现，发现 P1 资源收尾缺口：

1. 他人先冻结两个平台，本次请求因冲突进入正式 Failed，自己的捕获锁已释放。对方随后正常解冻并继续模拟后，实际无冻结、锁也空闲；但对同一检查点使用全新 requestId 提交独立请求仍返回 existing，反馈“still owns the active capture lifecycle”。Event 仍为 1、authorizationRequestId 仍为 first、captureAttempts 为 0，新请求无法启动。原因是 `#releaseResources` 尝试释放他人的冻结得到 owner-mismatch，`#finish` 又用“存在任意冻结”而非“本事务仍持有资源”判断，执行器 owner 残留；之后没有完成收尾的入口。
2. 第二对象 capture 抛错，同时 before-release-lock 仅中断一次。原事务正式 Failed、平台已解冻，但自身锁仍 held。故障已经解除，后续显式 recover 却仅返回“Capture transaction 1 does not require recovery”，运行 phase 变成 blocked、锁仍 held；全新 requestId 仍被当成 existing。业务终态恢复入口不处理已终结事务的资源清理，不能靠重新执行 Failed 事务补救。

旧 CT04 验证了冲突失败不释放他人冻结，但未继续验证冲突解除后的新捕获；CT05c 只覆盖成功提交后的资源释放故障，没有覆盖提交前失败后清理中断。因此不把现有 PASS 改成 FAIL，但 D10-A2 整体暂为 BLOCKED，只安排以下 R1。下一步触发区域／仲裁／可见反馈继续保留为后续方向，不在本轮授权范围。

- 目标／模块：在 `snapshot-capture-runtime.ts` 修复执行器与运行组合的资源所有权、清理收尾及准入；必要时在物理冻结适配器提供最小的受控所有权查询，补 `snapshot-capture.test.mjs` 回归。复用现有 Manager 和冻结／锁，不改架构、依赖或业务终态语义。
- 所有权边界：必须分别知道本事务是否确实取得冻结、是否仍持有自己的捕获锁，以及自己的资源是否已安全释放。不能用 frozenObjectIds 非空推断归属，不能要求他人解冻才允许清除本事务的无资源 owner，也不能尝试解除他人冻结以结束自己。busy 从未取得冻结的分支只收尾自身资源；释放结果与实际拥有关系一致时才更新本地状态。
- 终态与资源生命周期分离：事务进入 Failed／Succeeded 后仍可能有清理待办；应提供明确、有界、幂等的受控清理／核查方式，不依赖 Manager.recover 接受已终态事务。可以局部扩展现有驱动接口，但不得把终态改回 running／recovery-pending，不重新 accept、capture、commit、发奖或生成第二个结果事件；错误及原身份继续可查。故障持续时保守保留自己真实持有的资源和诊断，每次调用有界，不递归重试到成功。
- 重新准入：本事务资源与自身 owner 已收尾，且原事件／结果生命周期达到既有安全结束条件后，使用新 requestId 的新独立请求必须能正常创建并完成。旧请求仍返回原身份，不因清理重跑。对尚未结束的不同独立请求明确拒绝／阻挡，不冒充同一个 existing、不排队、不在资源释放后自动补发；不通过清空全部记录、重置序列或重建 Runtime 来恢复准入。
- R01：新增先红后绿回归，按“他人冻结 → 本次失败并完成结果链 → 新 requestId 在冲突仍有效／已解除两个阶段尝试”验证。不得释放外部冻结；自己没有持有的资源不形成永远活动的 owner。外部解冻后，显式新请求可成功，旧失败事务／身份不重开；验证同一检查点及另一个受支持检查点的准入。
- R02：第二对象捕获失败，同时自己的锁释放只失败一次；保留旧快照和正式 Failed，后续受控清理仅释放原资源，故障解除后允许新请求。另覆盖自己的冻结释放中断，防止只修锁分支。持续清理故障每次有界、资源状态真实，解除后清理幂等，不执行原捕获或改变原 Failed。
- R03：清理不释放外部 owner，新请求在旧请求真正未收尾时不会误合并或被偷偷缓存；收尾后需显式新请求才执行，重复旧请求不新增 Event／Command／Transaction／Result。初始化 owner、Pause Token、玩家控制锁及永久进度不受影响。
- R04：保留原 136 项有效语义，尤其 CT05 已提交回执丢失／终态登记中断、1/1/1 捕获提交计数、平台无追赶、目标 E 共用身份／协调器与永久奖励幂等。不要为解决收尾问题放开并发捕获、删除资源故障注入或弱化他人资源保护断言。
- 验证与证据：执行类型检查、`npm.cmd test`、`npm.cmd run electron:build`、`git diff --check`；记录修复前后原事务终态、requestId、owner／锁／冻结的归属与实际状态、清理尝试、原／新 Event 与 Transaction ID、capture／commit 计数及旧快照保护。若修改物理冻结适配／主机接线，执行 `test:d10-a1` 三端回归；仅核心收尾变化未重跑 GUI 时明确 NOT RUN，不把旧产物报告当成新版本端到端证据。捕获 GUI 一直未接，不要求为 R1 增加界面。
- 交付与停止：更新 README、路线图和受影响概述，保留历史复现和 PASS／未覆盖记录；没有新增产品决策需求，普通实现细节自行处理。不做触发区、仲裁、新玩法、恢复／RecoveryError、存档或资源通用框架，不改 CONFIRMED／物理参数／暂停协议；不删除文件、不关闭用户窗口、不 Commit／Push／发布。完成后等待 Work 审查，不自动进入后续任务；同问题两轮有效修复仍失败则保留最小复现升级分析。

### 2026-11-14 D10-A2-R1 执行结果

基线为 `7921b13`。先补的 R01／R02 三项回归在修复前稳定失败：外部冻结冲突后新 requestId 被误报 `existing`；锁／冻结释放中断场景由 Manager 终态恢复拒绝，运行相位进入 `blocked`。修复后三项全部 PASS，原 136 项语义保留，`npm.cmd test` 为 `139/139` PASS，0 fail、0 skipped。

执行器新增独立的自身冻结所有权，不用 `frozenObjectIds` 非空推断 owner。冻结与锁分别释放；冻结释放中断不会跳过锁释放，外部 owner 的冻结不会被调用。正式 Succeeded／Failed 的显式 `recoverCheckpointCapture()` 只执行一次资源清理，不调用 Manager recovery、不改事务终态、不重新 accept／capture／commit／发布结果。持续故障保留真实所有权和错误诊断，后续调用幂等。

请求回执按 requestId 独立保存。R01 中外部冻结始终未释放，首请求以 Event／Command／Transaction／Result `1／1／1／2` Failed；冲突期间新请求形成独立 `3／2／2／4` Failed；外部解冻后显式新请求以 `5／3／3／6` Succeeded。再次提交首 requestId 返回原 `1／1／1／2`，没有新记录。R02 锁释放首次中断时，新请求在清理前返回 `lock-busy`；显式清理后锁释放，第二次清理为幂等 `already-released`，后继 requestId 才能成功。冻结释放连续中断时锁仍独立释放，故障解除后冻结才清理；原快照和 Failed 终态不变，cleanup 未增加 capture／commit 次数。

`npm.cmd run electron:build` PASS：Vite 生产构建 27 modules，Windows x64 免安装目录生成；仅有既有 bundle 体积、缺少 author 和默认 Electron 图标警告。当前 ASAR SHA-256 为 `80E19824EE4CB6355C66D76951EF9074B9E309D49FDCE54CB95E5CDAFCE06042`，EXE 为 `80AEA3008BBBB41B148E6A6879088739BF1EC89EFA85665514575BDD6751C19B`。本轮未修改物理冻结适配或宿主接线，D10-A1 三端定向、新捕获 GUI、Edge、触发区／仲裁、恢复与存档均为 NOT RUN；旧 `run-sJQsTu` 不作为当前源码的端到端证据。详细实现、逐项结果和哈希见 [README D10-A2-R1](../README.md#d10-a2-r1失败资源清理与重新准入)。

D10-A2-R1 为 DONE（待 Work 审查），D10-A2 父项尚未收口。报告后停止；不 Commit／Push／发布，不自动进入后续任务。

### 2026-11-14 D10-A1 Work 审查

基线 `72c3395`，开始时工作区干净。Work 阅读固定登记、严格字段／版本验证、冻结数据副本、单记录原子替换、初始化顺序、PC-01 owner 组合与失败锁定，以及真实 Matter 捕获和对应测试。源码三项 SHA-256 均匹配交付报告。本轮执行 `npm.cmd test`，类型检查、Electron Main 编译及 126/126 自动化测试 PASS，0 fail、0 skipped；未重跑构建或 GUI。

三端报告 `run-KTqUQ0` 的全部 26 项源码／脚本／ASAR 哈希匹配当前文件，Chrome Web／Electron 开发版／独立包均 PASS，三个进程 code 为 0、清理 PASS、cleanupFailures 为空，未发现非预期中断／页面错误。报告 JSON SHA-256 为 `2B477F701541826E8365DF094FD7128CE69A7182184CD6BE81D89C2B9691188E`。初始化捕获在实际模拟前完成，现有平台／永久进度排除、R 不重捕及初始化限制不被其他 owner 解除等边界符合当前范围。快照的 Runtime UUID 仅为来源上下文，不表示捕获或恢复生成器、事件／命令／事务记录。

D10-A1 当前范围收口。现有验证器仍限定初始 checkpointId，存储尚未绑定运行中捕获事务，平台尚无事务局部冻结能力；这些是下一段增量工作，不把初始化 READY 当作运行中捕获或 Checkpoint Recovery 已通过。Edge／人工限制和既有短反馈刷新问题保留。

### D10-A2 任务卡：运行中捕获事务与局部冻结

- 目标：基于 A1 的固定清单和单有效记录，完成一笔真实捕获事务：获准及持锁 → 固定安全边界冻结登记对象 → 一次完整候选捕获 → 后续合法 Tick 验证／原子提交 → 事务终结并解除自身冻结与锁。成功替换检查点身份与完整快照，失败保留旧记录；玩家移动、普通物理及无关业务继续运行。
- 依据：DECISIONS／PLAYER_CONTROL_DESIGN 中 Transactional Snapshot Commit、Atomic Snapshot Capture、Fixed Snapshot Registry、严格版本、全局单捕获事务、Non-cancellable Capture Transaction、捕获期间局部屏蔽、失败保留旧检查点及 Independent State Modules；事务身份／终态／结果反馈沿用 D09 已实现规则。不确定新最终 API、锁结构或重试参数。
- 模块：增量扩展 `snapshot.ts` 的已配置检查点元数据与原子存储，新增必要的小型捕获执行器／事务组合；在 `graybox-world.ts` 提供真实固定对象的局部冻结能力。复用真实 Command／Transaction 接收意图与 `RuntimeTransactionExecutionManager`，不另造编号、接收记录或终态框架。允许为非进度业务提供必要的、可测试的副作用观察／分类接缝，不能把所有逻辑堆入 events.ts 或重写既有目标 E。共享核心保持平台无关，无新依赖。
- 本段驱动边界：用核心测试组合中的显式已获准请求驱动，来自同一 RuntimeEventContext 的真实 Command／Accepted intent，沿用原 Command ID／Transaction ID。外围组合组织准入和一个关卡共享的独立捕获锁，执行器仅报告结果／错误，Transaction Manager 决定重试、恢复与终态。尚未实现触发区域、进入机会消耗、Tick 批次与优先级仲裁，不伪称已经完成这些行为；测试夹具的已获准请求不能直接推广为生产触发器自行抢锁。
- 锁与资源所有权：一个关卡最多一笔持锁捕获；不同检查点共享同一锁，锁与对象冻结独立管理。只有获准并成功取得锁的操作可以启动实际捕获；未获准／锁忙直接返回无捕获结果，不在内部建立等待队列，不在锁释放后自动补发。不得把锁忙操作先报告为已接受捕获后再无限等待。重复启动／推进不能新增执行身份或第二份候选；清理只能释放当前操作自己的资源，不能释放他人的锁或冻结。
- 局部冻结：覆盖两类登记平台的所有逻辑变更入口，包括自动运动时钟／相位、位置更新与调试重置入口；不能只拦输入却让每步运动继续改变状态。冻结期间 Matter 仍每个实际 Tick 求解一次，已冻结平台作为静止支撑，清除其当步位移／速度贡献，防止残留承载速度。解除后从冻结逻辑时钟继续，不补算冻结期间平台路程、不瞬移；未登记对象、玩家移动、生命周期控制和永久进度均不因捕获而全局暂停。不要复用 Pause Token 或玩家全局控制锁实现捕获。
- 局部交互：提供可供后续宿主查询／接入的冻结对象资格边界；相关事件／任务／适配器入口也必须遵守冻结，不能留公开写入旁路。被屏蔽操作不缓冲、不排队，解冻不自动补发。当前登记平台没有主动交互时，用最小受控模块测试证明变更受限，不为测试新增机关玩法或新的交互对象；具体真实输入与触发接线在下一段完成。
- 同边界捕获：对象全部在同一指定实际 SimulationTick 的安全阶段读取，冻结先于读取；不得跨 Tick 逐对象采样。候选读取可以一次同步完成，验证／提交可以在后续 Tick，期间对象继续冻结；不得用暂停整个世界保持一致，不在 Matter 碰撞回调中提交。快照记录逻辑状态而非 Body／Engine，全部继承严格版本／字段／固定对象校验；执行不依赖渲染帧或计时器。
- 原子替换：支持明确的灰盒测试检查点配置（至少两项，以验证身份替换），不指定正式地图坐标或设施。运行 UUID、Level ID、Checkpoint ID 与预设锚点必须匹配当前可信配置，不能因不再硬编码 initial ID 就接受任意外部身份。独立候选完整验证后只替换一个当前有效记录；旧 ID、旧锚点、旧对象数据要么整体保留，要么整体更新。捕获／验证／提交前故障保留原记录并结束本次失败处理，不把候选当第二个有效检查点。
- 提交后的故障：现有 Manager 主要按目标／奖励／效果差分识别副作用，本次必须能识别“快照已经提交”这一事实，不能因为奖励新增为 0 就当成未执行业务。提交后回执丢失、verify 或终态登记中断时，只核查同一事务的提交事实／候选，不回滚已成功的新有效记录、不重新采样更晚的世界状态、不分配新身份。必要扩展限于这一真实业务边界，不伪造进度新增来触发旧错误分支。terminal-pending 沿用有界显式恢复，不能同调用递归重试或误判 Failed；已确定成功的捕获不得仅因终态元数据失败改成失败。
- 结束与冻结清理：普通失败有旧有效记录时允许继续探索；成功或已正式失败后，按明确顺序清理本事务资源，并保留只读诊断。无法确认提交／清理状态时保守保留错误及自身资源，不能谎报已释放，也不能用重开事务消除错误。后续显式核查／清理沿用原身份，幂等且有界；不要求本段制作异常 UI。离开区域不属于执行器取消条件，不新增取消／Cancelled 终态；此处不声称已有真实离开触发器测试。
- 身份与结果：初始化使用的快照仓库与运行中捕获仓库遵循同一结构及单记录语义，永久进度／各业务编号序列仍独立。核心集成成功／失败后可通过已有 C2 发布各自唯一最终结果，验证不重开原事件或重复执行捕获；复用已有通路，不新建事件总线。真实目标 E 与捕获使用测试组合内同一运行上下文、不同目标模块，不能为新捕获单独伪造一个运行实例来回避共享边界。

验收与测试：

| 用例 | 必须验证的结果 |
| --- | --- |
| CT01 真实成功与替换 | 从 A1 初始记录出发，真实命令／意图与原身份跨 Tick 执行；持锁、冻结和候选可观察；提交前仍为旧记录，成功后检查点／锚点／全部对象一次更新，只保留一份有效记录。正常资源释放，结果事件唯一。 |
| CT02 局部冻结与承载 | 用真实 Matter 世界验证水平／垂直平台状态不变，玩家可行走／起跳，实际 Tick／Matter 步继续；相关修改／重置不穿透冻结，无关进度／测试门正常；解冻后无平台追赶或残留速度。 |
| CT03 准入与防重 | 两检查点共享锁，竞争者不启动／不排队，释放后不自动执行；重复命令／启动、同 Tick／倒退／递归推进和终态重进不产生重复提交、身份或结果。 |
| CT04 提交前失败 | 冻结准备、第二对象捕获、结构／版本校验及提交前故障逐类验证；旧检查点／锚点／数据完整不变，永久进度不变；能够确认失败时清理自身资源，不留下半冻结。 |
| CT05 提交后中断 | 已提交后回执／verify／终态登记故障有界返回；后续显式核查／恢复用同一 Command／Transaction 及原候选，不重新 capture、不回退旧快照，不把元数据故障改判业务失败。覆盖持续终态故障、只读状态与安全资源保留／释放。 |
| CT06 隔离与回归 | 原 126 项有效语义保留；A1 初始化失败仍锁定且 R 不能解锁；目标 E 幂等、暂停及重置不回归。新捕获的真实核心模块链／Matter 测试与既有宿主 GUI 回归明确区分。 |

- 执行与证据：运行类型检查、`npm.cmd test`、`npm.cmd run electron:build` 和 `git diff --check`；报告每个阶段 Tick、原／候选／有效 checkpointId、锁／冻结状态、capture／commit 尝试与成功数、完整身份及故障恢复前后数据。由于修改实际物理适配器，执行既有 `npm.cmd run test:d10-a1` 三端回归，验证当前产物下初始化和目标 E；该 GUI 测试不是新运行中捕获的端到端证据。新捕获宿主／区域接线仍 NOT RUN，不为本段新增 GUI 捕获按钮；Edge／未受影响完整长套件未跑就如实标记。
- 交付与停止：更新 README、本文与受影响概述，保留历史 FAIL、已有改动和体验窗口。普通数据结构／同步实现自行选择，没有新的产品决策需要确认；真实冲突或同问题两轮有效修复失败再升级 Work。不得实现真实进入批次／优先级仲裁、正式检查点区域、坠落传送、两阶段恢复、RecoveryError、存档、新玩法／依赖或通用重试框架；不修改 CONFIRMED、物理参数或生命周期暂停规则，不删除文件、不 Commit／Push／发布。只完成本项并等待 Work 审查，后续才安排触发／共享宿主接线。

### 2026-11-14 D10-A2 执行结果

新增 `src/core/business-runtime-bus.ts`、`src/core/snapshot-capture-runtime.ts` 和 `tests/snapshot-capture.test.mjs`，并增量修改 `snapshot.ts`、`graybox.ts`、`goal-route-runtime.ts`、`transactions.ts`、真实 Matter 世界及既有快照测试。目标 E 与运行中捕获共享一个 Runtime UUID、Event 序列和事件协调器，但分别注册 `prototype.progress.target` 与 `prototype.snapshot.target`；捕获没有另建运行实例、编号器或事件总线。

捕获顺序为：可信授权与 Request Key 校验 → 单关卡锁取得所有权或直接返回 `lock-busy` → Pending Event 与真实 Command／Accepted intent → 固定登记平台局部冻结并在同一实际 Tick 同步捕获完整候选 → 下一合法 Tick 严格验证并原子替换唯一有效记录 → 唯一 Result Event 消费、确认和安全退役 → 释放本事务冻结与锁。事件、命令、事务和结果身份沿用既有 D09 模块；提交后故障通过 `effectsApplied` 副作用接缝保留为原事务恢复，不因目标／奖励新增为零而重捕或误判失败。

CT01–CT06 全部 PASS：

- CT01：初始记录 `graybox-initial-spawn` 在提交前不变；成功后唯一记录变为 `graybox-test-capture-a`，锚点一次更新为 `640,472,1`。Event／Command／Transaction／Result 为 `1／1／1／2`，capture／commit／success 为 `1／1／1`。
- CT02：真实 Matter 平台时钟、位置、方向和速度在冻结 Tick 内保持不变，玩家仍能移动和跳跃，物理步数随实际 Tick 增加；冻结期间 R 被拒绝。解冻后平台只从原时钟继续，无补算路程或残留承载速度；冻结期间目标 E 的目标／奖励／永久效果仍为 `1／1／1`。
- CT03：两个检查点共享锁，竞争者不排队。同一请求在 `verifying`、`result-pending` 和终态均保持原身份；结果确认／退役前不启动第二笔生命周期，终态后必须使用新 Request Key 才可显式开新捕获。
- CT04：第二个对象捕获失败、外部冻结冲突、验证失败和提交前故障均保留旧记录、锚点、对象数据和永久进度；本事务已取得的锁、自身冻结被清理，外部 owner 的冻结不被释放。
- CT05：提交后回执丢失、资源释放中断及持续终态登记故障均保持有界、可观察、显式恢复。恢复沿用原 Command／Transaction 与候选，capture／commit／success 保持 `1／1／1`；已提交记录不回退，业务不被改判失败。
- CT06：原 126 项语义保留；目标 E 与捕获共享 Runtime 但 Target／Command 隔离。A1 初始化失败、暂停、R 和目标 E 回归继续通过，共享核心隔离扫描无平台 API。

执行证据：

- `npm.cmd test`：`136/136` PASS，0 fail、0 skipped；原 126 项保留，新增 10 项。
- `npm.cmd run electron:build`：PASS，Vite 27 modules，Windows x64 免目录构建成功；仅 bundle 体积、缺少 author 和默认 Electron 图标警告。
- `npm.cmd run test:d10-a1`：`run-sJQsTu` 的 Chrome Web、Electron 开发版、仓库外独立生产包全部 PASS；三进程退出码 `0`、cleanupFailures 为空、页面错误为 `0`。三端均完成初始快照、真实隐藏／原生最小化、目标 E、R 保留和完整重载；这是 A1 宿主回归，不是 D10-A2 捕获 GUI。
- `git diff --check`：PASS，仅有既有 LF/CRLF 提示。

版本证据：基线 `72c3395`；ASAR `22351ECC2A7B00A8E3C3C528AC7C56DF9EFAAE82897C332F8A2800BB06B182E6`，EXE `07360A7EA7E88500682ADCB0849944039E2EF0BEB11C76FCD8169E9B25022876`，报告 JSON `BFD5ABC70909876FC5EF82BE7010B2AA23EB03C58F5CBFC6397CD21E0B545E21`。详细 CT 数据、截图和源码哈希见 [README D10-A2](../README.md#d10-a2运行中捕获事务与局部冻结)。

正式触发区域、进入机会／优先级仲裁、捕获 GUI、坠落传送、两阶段恢复、RecoveryError、存档、Edge 和未受影响完整物理长套件均为 NOT RUN；Matter 仍是验证候选。D10-A2 当前状态为 DONE（待 Work 审查），不自动进入 D11，不 Commit／Push／发布。

### 2026-11-13 D09-D1 Work 审查

Work 阅读运行组合、实际固定步接线、进度／门体协调、producer 独立确认和退役、输入／暂停／重置回归及平台测试断言。本轮审查期间开发变更已由另一窗口提交为 `d3210cb`；Work 未执行提交或改动其代码／索引，开始文档维护时工作区干净。本轮重跑 `npm.cmd test`，类型检查、Electron Main 编译及 118/118 测试 PASS，0 fail、0 skipped；未重跑构建或 GUI。

`run-2FGMG5` 与 D08 `run-ERvFKU` 各自全部 23 项源码／脚本／ASAR 版本条目均与当前文件匹配；三端 PASS、进程 code 均为 0、cleanupFailures 为空，未发现非预期中断或页面错误。主报告 JSON SHA-256 为 `EAC60D411B0EDDAE777FCA33A35A344657A61F485EAA1ECE121CB470BB9BA800`；当前 ASAR／EXE 与交付报告匹配。D07 `run-SAhfNN` 的应用源码／ASAR 仍一致，但 `tests/graybox-browser.mjs` 后续因 D08 异步等待修正而变更，故它是相同应用版本下较早测试脚本的回归证据，不能称作当前全部脚本均重新跑过 D07。两次 D08 历史 FAIL 继续保留，人工体验／Edge 的未覆盖不改判。

按实际代码与 H01 测试澄清阶段：Accepted 本身没有业务效果；同 Tick 后续 apply 已登记目标／奖励／永久效果，且灰盒每个实际 Tick 都协调门体；下一 Tick verify 登记终态，再下一协调阶段消费结果并完成最终通知。不能将报告中的“业务状态只在终态和结果消费后出现”当作实现事实，也不能把结果消费改为再次发奖。该时序符合本次任务原有跨 Tick 事务与结果通知分离范围，README 同步澄清。R 是调试重置，整页重载是新测试运行，均不冒充检查点恢复或同实例场景切换。

Work 另查看生产包成功截图：右上诊断已显示 SUCCEEDED／OPEN 与完整身份，底部短反馈仍在其原有 1200 ms 时限内显示创建时的 Pending 文案。这是非阻断的反馈刷新问题，不能把该短文案当作当前真实生命周期；保留为后续交互表现修正项，不据此声称所有界面文案均已同步，也不扩张 D10-A1 的实现范围。

D09-D1 当前目标 E 原型闭环收口，D09 的最小可玩链已具备后续检查点工作的基础；不宣称全部正式业务或完整 T01–T06 通过。下一项按既定顺序进入检查点登记与初始备用快照，不再增加无关纯协议任务。

### D10-A1 任务卡：固定快照登记与初始备用快照

- 目标：现有灰盒初始化时，为真实临时世界对象建立固定登记清单，捕获并验证一份完整初始备用快照，与出生恢复目标作为单个当前有效记录提交；成功之前通过既有 Player Control Coordinator 阻止正常探索。玩家暂时仍使用原 R 调试重置，不实现坠落后传送或完整恢复。
- 依据：DECISIONS 的 Initial Spawn Fallback、完整初始备用快照、Snapshot Management／Fixed Snapshot Registry、单一当前有效快照、Atomic Snapshot Capture、Transactional Snapshot Commit、严格 schemaVersion／stateVersion，以及永久进度与临时状态分离；专项规则见 PLAYER_CONTROL_DESIGN 的检查点系统和文末固定登记／版本章节。本任务确定的是灰盒工程实现，不将接口、字段、版本数值或最终关卡清单升级为 CONFIRMED。
- 模块与依赖：优先新增小型共享核心快照／登记模块及必要测试，向 `graybox.ts` 注入真实逻辑状态适配器；物理适配只在 `src/physics/matter/graybox-world.ts` 提供必要的逻辑读出，Phaser／Web 入口负责初始化接线与显示只读诊断。复用 PC-01 的独立 owner 控制限制，不另建全局控制布尔值，不新增依赖或通用序列化／持久化框架。没有单独 moving-platform.ts，按实际现有世界模块增量修改。
- 固定登记：以明确的灰盒必需对象配置核对实际登记，不只遍历已成功登记的对象然后声称没有遗漏。当前需要回滚的真实临时对象至少覆盖水平移动平台和垂直升降平台的可重建逻辑状态；稳定对象 ID 与业务 ID／Event ID 等分别管理。重复 ID、缺少必需对象、未知对象、非法版本或无效捕获能力均明确失败；初始化后封闭登记，不开放任意动态增删。对象隐藏／禁用不从清单删除。临时路线状态如确实不存在，不为填表编造对象。
- 快照内容：包含共同 schemaVersion、每对象 stateVersion 与稳定 ID、逻辑载荷，以及同一个有效记录中的检查点身份／当前灰盒关卡身份和既有出生锚点（位置／朝向）。初始与后续正式快照共用结构；本段只提交初始备份，不创建额外可供恢复的历史列表。平台可用运动逻辑时钟／相位或等价可重建状态，具体最小字段由开发窗口结合现有三角波运动实现选择并记录；必须验证可用性与有限数值，不能直接复制 Matter Body／Engine／接触缓存、速度冲量或 Phaser 对象。
- 明确排除：永久收藏、目标、奖励、路线解锁和永久世界效果仓库；Event／Command／Transaction 记录及递增序列；输入 held／buffer／needsRelease、当前调查／反馈会话、Pause Owner／Key／Token；诊断计数、触发器占用缓存及渲染动画。玩家恢复位置使用固定锚点元数据，不把当前坐标／速度当成检查点录制姿态。单向平台的碰撞缓存、支撑与触发占用在后续恢复阶段重建，不伪装成永久进度或可直接还原的引擎内部状态。永久测试门的 OPEN 来自进度协调，不作为临时快照关闭值回滚。
- 初始化顺序：建立世界与平台 → 应用传入的已有永久进度／世界效果 → 确定既有初始锚点 → 在开始普通模拟／玩家探索之前的初始化安全边界捕获固定清单 → 完整校验候选 → 原子登记初始有效记录 → 仅释放初始化 owner。初始化捕获不额外执行 Matter step，不递增或伪造 SimulationTick，也不递归分发普通业务事件。最终控制是否开放仍由 PC-01 根据全部 owner 决定，不能解除失焦／对话等其他限制。
- 原子性与版本：候选独立构建，所有必需对象捕获／校验通过后，检查点身份、锚点与完整快照一次性成为当前有效记录；对象读取异常、版本／结构／ID 错误或提交故障都不能留下半记录。纯核心存储测试验证候选失败不覆盖原有效记录；不为此接入第二个正式检查点或运行中捕获流程。快照与载荷不可被外部修改，保留有限的一份当前有效数据，严格匹配支持版本，不自动迁移、不跳过必需对象、不用默认值掩盖缺失。恢复阶段版本不兼容的 RecoveryError 规则仍是后续任务，不宣称本段已实现。
- 初始化失败：没有旧有效记录时保持初始化控制限制，窗口继续显示可读的“快照初始化失败／探索未开放”状态和必要诊断，不自动开放、不崩溃闪退、不无限重试。R 或释放其他 owner 不能绕过该限制；本段不制作 RecoveryError 流程／手动恢复 UI。成功后重复初始化不得覆盖已有快照，不能每帧重新捕获。有效记录的内部提交接口可做必要原子故障测试，但不通过 UI 暴露运行中随意改写快照。
- 运行边界与隔离：同一次测试运行保留同一快照仓库和业务上下文，R 不重新捕获、清空或替换初始备份，也不重置任何业务 ID；永久路线完成后，原快照仍是原临时数据，永久记录单独保留。完整重启按现有明确语义建立新测试运行及新的初始备份。不得新建第二套运行 UUID／事件协调器来给快照编号；本段不改造 D09 命令链，不把初始化同步操作假报成已通过正式检查点事件仲裁。

验收与测试：

| 用例 | 必须验证的结果 |
| --- | --- |
| CP01 固定登记 | 正确必需清单通过；重复、遗漏、未知对象、非法版本及无效适配器明确拒绝。初始化封闭后不能增删，隐藏／禁用不影响必需集合。 |
| CP02 初始完整快照 | 真实灰盒两类平台均参与，使用共同结构、独立对象版本和出生锚点；捕获先于控制开放，未推进 Tick／物理步。用注入的既有进度验证永久效果先应用且不进入临时快照。 |
| CP03 原子失败与不可变性 | 多对象中途失败、校验失败、提交故障均无半记录；旧有效记录存在时保持原检查点／锚点／数据，没有旧记录时仍为空。外部修改捕获源或读取结果不改变已提交数据。 |
| CP04 严格边界 | schemaVersion／stateVersion 不符、缺少必需对象、非有限逻辑数据均拒绝，无迁移或默认补齐；快照不包含引擎对象、永久记录、输入、暂停令牌或业务编号序列。 |
| CP05 控制与重置 | 正常初始化只释放自身 owner，其他控制锁仍有效；失败无法移动／跳跃／交互，R 不能解锁。成功后目标 E 仍可完成并开门；R 保留原备份、UUID、业务身份与奖励，不冒称已从快照恢复。 |
| CP06 三端真实启动 | Chrome Web、Electron 开发版、仓库外生产包均读到初始备份 READY、正确对象数／版本／锚点，并可正常走跳和执行目标 E；真实隐藏／最小化恢复后快照不重复捕获，初始化次数／运行 UUID 不变。完整重启创建新运行的初始记录。 |

- 执行：`npm.cmd test`、`npm.cmd run electron:build`，新增或扩展复用现有 harness 的 D10-A1 三端定向入口（建议 `npm.cmd run test:d10-a1`），并运行受影响的 D09-D1 实际链回归；可以合并启动会话，不能只用对象数静态断言代替实际目标 E 运行。故障／不可变性主要通过核心与真实灰盒模块测试，三端正常初始化与操作必须有运行证据；不要求为测试加入生产故障按钮。保留原 118 项有效语义，未受影响物理长套件／Edge 未跑就标 NOT RUN。
- 证据与体验：报告 task、当前源码／脚本／ASAR 版本、逐端结果和退出／清理信息；截图显示正常场景及初始检查点状态，记录捕获对象／版本／锚点、成功或错误、捕获次数与实际 Tick。不能把初始化成功标成完整 Checkpoint Recovery PASS。保留一个正常体验窗口及准确命令／路径，不关闭用户已有窗口；人工手感无证据继续 BLOCKED／NOT RUN。
- 不做与停止：不添加正式检查点区域、进入批次／仲裁、全局捕获事务锁／局部冻结、运行中刷新事务、失败触发／淡出传送、锚点空间搜索、两阶段恢复、RecoveryError、磁盘存档、正式任务或新玩法。后续捕获与恢复按原设计分段实现，不在本任务提前建完整框架。常规字段／数据结构自行选择，没有新增产品确认需求；真实设计冲突再报告。更新 README、路线图和确实受影响的设计文档／项目概述，原型接口不升级正式 API；保留历史和用户修改，不改物理参数、暂停协议或技术选型，不删除文件、不 Commit／Push／发布。完成后停止等 Work 审查，不自动开始 D10 下一段；同问题两轮有效修复仍失败则保留最小复现升级分析。

### 2026-11-13 D10-A1 执行结果

新增 `src/core/snapshot.ts`，固定登记 `moving-horizontal-a:1` 与 `moving-vertical-a:1`，使用整体 `schemaVersion: 1`、`checkpointId: graybox-initial-spawn`、`levelId: graybox-platform-lab` 和出生锚点 `{ x: 80, y: 472, facing: 1 }`。快照只保存两条移动平台的可重建逻辑状态；永久进度、业务 ID／序列、输入、交互会话、Pause Token、Matter 对象和接触缓存均被排除。候选完整校验后被深冻结，并一次性成为唯一当前记录。

真实灰盒先建立 Matter 世界、申请独立 `checkpoint-initialization` 控制 owner、协调已有永久效果，再捕获／校验／提交固定对象，仅在 READY 时释放自身 owner。第二对象捕获、校验或提交故障均不留下半记录；失败时移动、跳跃、交互和 R 仍受限，HUD 显示初始化错误。R 后续不会重新捕获或覆盖备份，也不会重置 Runtime UUID、D08 进度或 D09-D1 身份。

验收证据：

| 用例 | 状态 | 证据 |
| --- | --- | --- |
| CP01 固定登记 | PASS | 专项核心测试覆盖精确对象集合、冻结登记、重复／遗漏／未知 ID、非法整体／对象版本及无效适配器。 |
| CP02 初始完整快照 | PASS | 真实 Matter 灰盒在 Tick／Matter step 均为 0 时捕获两平台；注入永久目标后捕获观察显示永久效果已应用且业务 ID 未进入载荷。 |
| CP03 原子失败与不可变性 | PASS | 多对象中途失败、校验／提交故障均保留旧记录或保持空记录；捕获源和读取结果的后续修改不能改写已提交数据。 |
| CP04 严格边界 | PASS | 结构、版本、对象类型、轴、方向、相位、周期和有限数值严格校验；额外进度或 Event 字段被拒绝。 |
| CP05 控制与重置 | PASS | 初始化 owner 与其他控制锁独立；失败下输入和 R 不能绕过限制。成功后目标 E、R 保留备份／UUID／进度和永久效果。 |
| CP06 三端真实启动 | PASS | `run-KTqUQ0` 三端均 READY、2 对象、版本 `1/1`、锚点 `80,472,1`；真实隐藏／最小化不重捕，目标 E 为 `1/1/1/2`，完整重载生成新 UUID。 |

执行结果：`npm.cmd test` 为 `126/126` PASS，原 118 项保留并新增 8 项；`npm.cmd run electron:build` PASS；`npm.cmd run test:d10-a1` PASS。三端报告中的 Web／Electron 开发版／生产包均 PASS，进程退出码为 `0`、`cleanupFailures` 为空。快照冻结 Tick 分别为 Web `45→47`、开发版 `53→55`、生产包 `47→49`，恢复前后 jump／interaction 消费计数不变；三端目标 E 均完成并保持原初始载荷，R 后捕获次数仍为 `1`。截图、运行时 UUID、哈希和体验入口见 [README D10-A1](../README.md#d10-a1固定快照登记与初始备用快照)。

本轮未实施正式检查点触发、运行中捕获、坠落传送、完整恢复、RecoveryError 或存档，不能把 READY 或 R 描述为 Checkpoint Recovery。Edge、独立人工手感继续 NOT RUN／BLOCKED；Matter 仍是验证候选。D10-A1 完成后等待 Work 审查，不自动领取 D10 下一段或 D11。

### 2026-11-13 D09-C2-R1 Work 复审

审查基线 `adebba2`，开始时工作区干净。Work 核对普通 create 在准备候选前拒绝保留类型、私有 normalize 仅在受控结果创建处放行、真实交付／测试替身的类型与权威关联检查，以及结果专用分发的关联校验。`events.ts` SHA-256 为 `9A055CECD7681DF169ADB82FC1579D6974939FEF2DA9747788B3D27E86A277F4`，专项测试为 `CBE1DCF5A6F82DC5F5DDC2A9389BFC562C2AB5CCDF8D7F061F24066AA30722EB`，其余两项核心哈希也匹配交付报告。本轮实际重跑 `npm.cmd test`，类型检查、Electron Main 编译及 112/112 测试 PASS，0 fail、0 skipped；没有另跑生产构建或 GUI。

R01／R02 通过公开入口覆盖无／owned producer、有／无类型白名单以及结果形态载荷；拒绝不消耗编号，三种模式的 handler／receipt／consumer 不被调用。Work 另重跑此前的真实核心无文件写入复现：普通 create 返回 rejected／reserved-event-type，随后空 coordination 轮次的 handler、consumer、Command 和 intent 均为 0，下一 Event ID 保持 1，Inbox 为 0。分发防御另经源码检查，不把入口拒绝测试描述为已强行注入损坏的私有生命周期记录。原 G01–G06 合法结果链继续通过。R1 缺口关闭，D09-C2 在当前纯核心范围收口；历史复现与失败保留，GUI 业务链仍 NOT RUN。下一段不继续扩展纯核心协议，转入一个已有测试交互的可玩接线。

### D09-D1 任务卡：测试目标 E 的共享宿主业务闭环

- 目标：玩家在现有灰盒目标 E 范围按 E，真实走完「协调器创建 Pending 事件 → 固定阶段交付一个稳定 Command → 目标模块原子接收意图 → Transaction Manager 跨 Tick 执行现有目标／奖励／永久效果 → 唯一最终结果事件 → 后续固定阶段消费、生产者确认与安全退役」。界面显示实际处理结果，测试路线真实打开；不以纯核心替身或直接改计数冒充宿主闭环。
- 当前基础与依据：`graybox.ts` 仍在交互回调直接调用 `progress.completeGoal()`；Phaser 创建灰盒 core，Web 与 Electron 使用同一入口。复用 D09-A1～C2 的真实模块、D08 已有 goal/reward/effect 及 `PrototypeProgressTransactionExecutor`，不重写协议。约束查阅 DECISIONS 中统一创建／原子提交、固定阶段与单轮分发、单事件单命令、Accepted 对应原事件 Completed、事件与事务生命周期分离、唯一最终结果、producer 确认和运行实例身份规则；Player Control Design 的固定 Tick、输入与暂停规则保持不变。
- 实施模块：在共享核心增加必要的小型运行组合／接线模块，复用事件、命令、交付、事务、结果及进度模块；调整 `graybox.ts` 的目标 E 回调与实际固定步接线。平台入口仅注入 UUID provider 等平台能力；Phaser 与页面只读取快照和呈现反馈。必要修改 `src/platform/web/main.ts`、`src/rendering/phaser/graybox.ts`、交互反馈接口及现有测试。不得把游戏业务塞入 Electron Main、物理回调或 DOM 点击处理，不继续把 UI 和目标业务堆入 events.ts。
- 范围只含目标 E：取消该目标的同步 completeGoal 旁路，接受输入仅请求创建正式事件并反馈“已请求／处理中”；没有真实提交成功不能先加目标、奖励或开门。调查 A／B、短反馈 C 与收藏 D 保持原行为；收藏 D 仍是尚未迁移的 D08 直接原型，必须明确限制，不能宣称全部游戏业务都已接入新链。已有目标完成后的重复交互可以只读返回“已完成”，不要求为无新业务意义的提示新增命令。
- 运行对象与身份：一次完整灰盒测试运行只组装一份 RuntimeEventContext、协调器、目标模块、执行 Manager 和共用进度仓库。UUID 由平台无关 provider 注入，共享核心不调用 DOM／Node／Electron；具体平台 API 属工程实现，不新增正式 UUID 版本决策。四套 ID 与能力句柄沿用现有模块，不能额外手造身份或每次按键重新初始化生成器。
- 固定步接线：保留一次实际 Tick 一次 Matter 求解。世界／物理／交互更新后，在明确的固定协调阶段单轮 dispatch，再推进已接受的事务及终态结果发布等后续阶段；写明实际阶段顺序。事务 apply 与 verify 跨至少两个实际 Tick，不在一帧内循环 drain 或伪造 Tick。协调阶段之后创建的结果保持 Pending，等待下一次合法协调阶段；不用渲染回调、计时器或墙上时钟推进业务。此工程接线不宣称已实现检查点请求批次或捕获仲裁。
- 事件与事务完成分离：真实 Accepted 后原 Event 可 Completed，但不能将界面最终成功设为 Accepted；只有 Manager 正式终态及结果消费确定最终反馈。结果消费只记录通知／反馈，不再 completeGoal、发奖励、执行 apply 或产生新 Command。Manager 执行和目标进度修改保持权威，渲染器不直接改变内部状态。
- 永久效果与反馈：Manager、界面和世界协调使用同一进度仓库；业务写入后的永久路线效果经既有 reconcile 接口应用到真实 Matter 门体，保留碰撞和视觉状态一致。反馈计时只随实际固定步；可有“请求已接收／处理中／成功／失败或受阻”的最小反馈，不新增任务面板、正式奖励内容或通用通知系统。提供有界只读诊断，包含运行 UUID、原 Event／Command／Transaction／Result Event ID、关键阶段 Tick、实际终态、结果消费次数及业务新增计数；不得泄露可变集合或 capability 给 DOM。
- 确认与容量：原始交互 producer 与事务结果 producer 各自读取实际 Completed 结果、显式确认，并在 dispatch 结束且安全条件满足时退役；不能用原事件确认代替结果确认。保留必要稳定结果关联及原命令／事务记录，沿用有限容量；满时明确失败，不自动清空历史、重置序列或新增命令／事务回收框架。诊断最多保留必要的有限近期记录。
- 重置与运行边界：R 及页面灰盒重置只清临时物理／交互状态，保留进度、运行上下文、编号与已接受链；不得因重置重跑已完成事务、重复奖励，或把待处理事务丢弃。当前“场景选择／重新启动”实际销毁 Phaser 并整页 reload，本段不要求重构整个场景系统；若保留此方式，必须在 UI、README 和测试中明确这是完整重新初始化测试运行，生成新 UUID，不冒称同实例场景切换连续性已验证，也不得推广为正式关卡切换方案。真正同实例切换仍须复用上下文／序列；禁止用 storage 保存业务 ID 来伪装生命周期正确。
- 暂停与错误：继续使用 Lifecycle Controller／Pause Token，不把后台暂停转成普通事件。暂停不 dispatch、不 advance、不消费或推进反馈计时，恢复不补算、不重放输入。正常事务随实际步推进；错误按既有 Accepted／Retryable／Rejected／Unknown 和 Manager 显式恢复约束处理，禁止为了演示成功强行补发、while 重试、清空阻断或重跑 apply。创建拒绝没有业务效果，已成功业务遇到结果通知故障仍保留原终态和身份；界面显示可检查的受阻信息。本段不制作通用重试 UI。

验收与测试：

| 用例 | 必须验证的结果 |
| --- | --- |
| H01 正常可玩链 | 全新运行，真实输入在目标 E 创建 Pending 事件，输入调用本身不修改目标／奖励／门体。真实目标 accept，原事件 Completed；跨 Tick apply／verify 后 Succeeded；独立 Result Event ID 在更晚的 coordination 被消费，不新增第二条 Command／Transaction。目标、奖励和效果各新增 1，门实际可通行。 |
| H02 幂等与输入 | 持 E、repeat、释放后重复交互不重复发奖或开启第二份相同事务执行；已接受的同 Command／Result 重取与确认沿用原身份。失焦后必须先松键再按，调查提示资格及其他 owner 控制锁不回归。 |
| H03 暂停与恢复 | 核心可控时间测试精确覆盖 Pending／执行中暂停，Tick、阶段、业务计数与反馈时钟冻结；恢复只在实际步继续。三端真实切标签／原生最小化验证状态保留、无后台追赶及无持键自动触发；不强求 GUI 在一个极短 Tick 窗口恰好采中间状态来替代核心确定性测试。 |
| H04 调试重置与身份 | 完成后 R 重置，原 UUID／序列和关联不变，路线重新协调为 OPEN，奖励不重复。Pending／进行中重置不丢接受记录或重复 apply。完整测试运行重新初始化则新 UUID／独立记录；明确区别于同运行场景切换，不称为 Checkpoint Recovery。 |
| H05 失败与资源 | 在共享组合层用可控故障验证创建拒绝无副作用、结果发布／消费失败不重跑成功业务、已有容量拒绝不重置 ID。每次操作有界；不要求为 GUI 新建故障按钮，纯核心故障测试不能冒充三端实际故障运行。 |
| H06 三端与既有回归 | Chrome Web、Electron 开发版、仓库外独立生产包均走同一真实链；提供可见路线／反馈截图和只读身份／阶段证据。保留 D07 调查与输入、D08 收藏／目标幂等与重置、既有物理和生命周期的相关回归，不把异步事务完成前的旧同步断言直接删除。 |

- 执行验证：`npm.cmd test`、`npm.cmd run electron:build`、新建或扩展可复用的 D09-D1 三端定向入口（建议 `npm.cmd run test:d09-d1`）及现有 D07／D08 受影响回归。可共用启动与测试会话，避免重复搭建 harness；如旧目标测试确因正式阶段接线变更，应按实际 Tick／最终结果等待并解释，不能降低幂等、身份、无副作用或暂停断言。未受影响的物理长套件可记录 NOT RUN 并说明，当前链的三端定向验证不能省略。Web 默认 branded Chrome，Edge 未执行就写 NOT RUN。
- 证据与体验：定向报告 task 字段为 D09-D1，记录当前源码及实际运行资源哈希、浏览器／Electron 版本、逐端结果、退出／清理状态和历史 FAIL。不再用 D04 旧标签或旧产物证明新链运行；新核心应真实进入运行包，以实际新产物核对。提供正常启动命令、生产入口、真实游戏截图与操作路线；测试自有窗口清理后另保留一个可供用户操作的体验窗口，记录启动信息，不把自动化截图标成人工手感 PASS，不关闭用户已有窗口。
- 交付与停止：只更新真实受影响的 README、路线图与项目概述，保留 Work 与用户已有修改；明确未迁移收藏／正式业务、人工限制与 NOT RUN。没有新增产品决策需求，普通工程细节自行解决。不得新增正式任务／玩法、检查点／RecoveryError、存档、命令／事务通用清理、依赖或新平台；不改 CONFIRMED、Matter 候选状态、物理参数、暂停协议或输入规则。不删除文件、不 Commit／Push／发布。当前单项完成后停止等 Work 审查，不自动进入 D10；两轮有效修复仍失败或真实跨模块冲突时保留最小复现交 Work。

### 2026-11-13 D09-D1 执行结果

基线 `adebba2`，开始时保留 `DEVELOPMENT_ROADMAP.md` 与 `PROJECT_BRIEF.md` 的 Work 修改。新增 `src/core/goal-route-runtime.ts` 作为单次运行的小型宿主组合，复用既有事件上下文、事件／命令协调器、真实目标接收、跨 Tick Transaction Manager、唯一结果来源和共享进度仓库。`graybox.ts` 仅在现有实际 Tick 的物理与交互更新后调用一次 `goalRoute.step()`；每次实际 Tick 仍只有一次 Matter 求解。平台入口只注入 UUID provider，Phaser 与诊断页只读取快照。

目标 E 的按 E 回调现在只请求创建 `prototype.route.open.requested` Pending 事件，不再同步调用 `completeGoal()`。实际 Tick 内的固定顺序是：单轮 coordination dispatch → 读取交付结果并确认／处理原事件 → Manager `start/advance` → apply 后至少下一 Tick 才 verify → 正式终态后由 Manager 创建唯一 `transaction.result` → 更晚协调阶段消费结果 → 原事件和结果事件分别确认／退役 → 共享进度 reconcile 到真实门体。Accepted 只推进原事件，不授予最终成功；目标、奖励、效果及门体只在事务执行和共享进度写入后改变。

H01–H06：

| 用例 | 状态 | 实际证据 |
| --- | --- | --- |
| H01 正常可玩链 | PASS | 核心组合先得到 Event `1` Pending 且业务 `0/0/0`；真实目标和跨 Tick 事务完成后 Event `1`／Command `1`／Transaction `1`／Result Event `2`，业务 `1/1/1`，结果消费 `1`。 |
| H02 幂等与输入 | PASS | Pending 重复请求返回 existing；完成后重复交互返回 completed。三端命令、事务、结果和奖励均不增加；持键、失焦恢复及重复按 E 无自动重复。 |
| H03 暂停与恢复 | PASS | 核心可控测试分别冻结 Pending 和执行中事务；三端真实隐藏／最小化后 Tick、阶段、业务与结果均不推进，恢复不追赶。 |
| H04 调试重置与身份 | PASS | Pending 重置保留已接受链；完成后 R 保留 Runtime UUID、Event／Command／Transaction／Result ID、奖励 `1` 和 OPEN。完整重启生成新 UUID 并从 CLOSED／空业务开始。 |
| H05 失败与资源 | PASS | 注入事件创建失败在编号、Inbox 和业务写入前回滚；注入结果消费失败每次合法协调 Tick 最多尝试一次，不重跑 apply、不改变原 Result Event ID 与事务终态。 |
| H06 三端与回归 | PASS | D09-D1、D07 与 D08 当前三端定向均 PASS；D08 旧同步反馈失败 `run-MTYI1g` 和未等待终态的 `run-JmR87w` 保留。 |

最终 D09-D1 报告为 `test-results/platform/run-2FGMG5`：Chrome Web Runtime `bed57577-e9c5-4e5b-8d2e-780e74bfe80b`，开发版 `46789686-efb4-4502-b621-52afdce55cdf`，生产包 `ca0a0cc2-429b-462c-92f1-b3d2a7a955e1`；三端均为 Event `1`、Command `1`、Transaction `1`、Result Event `2`，结果消费 `1` 次。Web／开发版／生产包的 apply→verify→consume Tick 分别为 `142→143→144`、`155→156→157`、`149→150→151`。三进程退出码均为 `0`，`cleanupFailures=0`。

D07 定向报告为 `run-SAhfNN`，D08 最终报告为 `run-ERvFKU`。类型检查、Electron Main 编译及 `npm.cmd test` 的 `118/118` PASS；`npm.cmd run electron:build` PASS；共享核心隔离扫描无平台 API 输出；`git diff --check` PASS，仅有 LF/CRLF 提示。当前 ASAR／EXE 为 `AB0EA7E9798BB872F9B784BF8F827A287F80213CA137C5C1CADEEAB20D53E850`／`7A6F271FA22D55A8CCA88D2BD919F9CC29C9973FA462F60702E78C919CC73674`。

自动化结束后另用 `npm.cmd run electron` 启动正常体验窗口 PID `37556`、HWND `66850124`、Vite `http://127.0.0.1:57607/`；真实截图与启动记录保留在 `test-results/d09-d1-20261113/`，窗口留给用户自行关闭。

未迁移收藏 D、正式任务、磁盘存档、检查点或同实例场景切换；Edge、完整人工手感、Checkpoint Recovery 与 RecoveryError 为 NOT RUN／BLOCKED。Matter 仍为候选。D09-D1 等待 Work 审查，不进入 D10，不 Commit／Push／发布。

### 2026-11-13 D09-C2 Work 审查与 R1 任务卡

审查基线 `1023641`，开始时工作区干净。Work 阅读结果创建、authority 校验、原子绑定、事务终态来源、结果分发及 G01–G06；源码／专项测试四项 SHA-256 均匹配开发报告。本轮实际执行 `npm.cmd test`，类型检查、Electron Main 编译及 110/110 自动化测试 PASS，0 fail、0 skipped；未重跑生产构建或 GUI，不以不变 ASAR／EXE 证明宿主已接线。

发现 P1 入口缺口：`EventCreationCoordinator.create()` 使用通用类型与 JSON 校验，没有限制 `transaction.result` 必须走受控结果创建。真实交付分支仅依据生命周期记录是否带有 `transactionResult` 关联选择结果消费者；普通创建的同名事件没有该关联，因而进入普通命令 handler。Work 通过无文件写入 Node 核心复现：新运行实例启用 `TRANSACTION_RESULT_EVENT_TYPE`，配置真实目标模块与结果消费者；普通 create 传入 `{ type: TRANSACTION_RESULT_EVENT_TYPE, payload: { terminal: { status: 'succeeded' }, transactionId: 999 } }`，未创建任何真实事务终态或结果 authority。返回 created；在 Tick 1 coordination 分发返回 completed，普通 handler 调用 1 次、结果消费者 0 次，Command 数与真实事务 intent 数各 1。此处只创建意图，未执行事务业务，不声称目标／奖励已被修改。

这不是理论上的接口偏好：它允许保留结果类型绕过“正式终态才能创建结果”的入口，并走入明确禁止的业务命令路径。现有 G04 覆盖伪造 source／关联，但未覆盖普通 create 的同名入口。因此 D09-C2 暂为 BLOCKED，先补以下 R1，宿主接线顺延；不删除原 PASS、开发 DONE 或未运行记录。

- 目标／范围：修复普通事件创建与结果通知创建的边界。修改 `src/core/events.ts` 及必要测试；必要时局部调整结果合同，禁止为此次修复进行模块大重构。复用既有 Transaction Manager authority → coordinator 结果创建路径，不新增依赖、权限框架或第二套结果生成服务。
- 创建约束：`transaction.result` 是受控结果路径保留类型；普通 `create()` 不得创建它，无论是否传入普通 producer、是否在 allowedEventTypes 中显式启用、或是否未配置类型白名单。即使传入与真实结果完全同形的载荷，也不能取得权威结果身份。拒绝必须发生在正式分配、登记和入队前，不消耗 Event ID／容量，不产生绑定或业务副作用；具体错误名称由实施者选择并记录，不升级为正式 API。
- 合法路径：Manager 已正式登记 Succeeded／Failed 后仍经受控接口请求唯一结果；正常创建、提交回执丢失、重复请求、结果退役后的原身份查询继续有效。不要在共用的私有校验中无条件封死结果类型，导致合法路径也无法创建；不允许靠放开普通 create 再在载荷中加入布尔标记或可复制字段区分权限。
- 分发约束：审查真实交付、旧测试替身和结果专用模式，结果类型与权威关联必须一致。保留结果类型但缺少／不匹配真实关联的事件应保守拒绝或阻断，不能退回普通命令 handler，也不能凭载荷字段触发结果消费者。不要求通过公开 API 人工篡改内部集合；必要的测试接缝保持最小，不暴露可任意写生命周期的生产接口。
- R01：首先新增会在修复前稳定失败的公开入口回归，覆盖普通 producer／无 producer，以及显式结果类型白名单／未设白名单。伪造载荷与复制真实结果载荷均被拒绝；下一候选 Event ID、Inbox、完整生命周期及结果绑定保持不变；不能只拒绝示例中的 999 或字段不完整情况。
- R02：真实模块集成中验证非法结果请求不能进入普通 handler、accept 或结果消费者，Command／intent／业务新增均为 0；随后合法普通事件仍能创建并沿用正确编号。结果专用／真实交付／替身分发入口均检查同一职责边界，不以某个业务 handler 恰好拒绝类型代替核心保护。
- R03：保留并验证真实终态结果的完整成功链；合法结果由结果消费者处理，普通 handler／Command／Transaction 数不增加。保留非终态与 terminal-pending 拒绝、原子回滚、回执丢失、完成登记失败恢复、独立确认与退役、退役后同结果 ID 等 G01–G06 有效语义，不削弱原 110 项断言以追求 PASS。
- 验证：执行类型检查、`npm.cmd test`、`npm.cmd run electron:build` 和 `git diff --check`；报告修复前后 created／rejected、handler／consumer 调用数、Command／intent 数及 Event ID／Inbox／绑定变化。纯核心仍未接宿主，Chrome／Electron／独立包新业务链为 NOT RUN，无须重跑未受影响的物理 GUI 长套件。构建成功不等于端到端运行通过。
- 风险与停止：避免仅做 UI／业务 handler 防御，避免误伤合法结果创建或普通事件。没有新增产品决策需求；若发现必须改变 CONFIRMED 才能修复的真实冲突，报告具体冲突。更新 README、本文与受影响项目概述，保留历史证据；不实现宿主接线、正式任务、检查点、RecoveryError、存档或新玩法，不改物理／输入／暂停规则，不删除文件、不关闭既有体验窗口，不 Commit／Push／发布。完成后等待 Work 审查；同一问题两轮有效修复仍失败则提交最小复现，不反复重跑挑选 PASS。

#### 2026-11-13 D09-C2-R1 执行结果

修复前先运行新回归：R01 预期 `reserved-event-type`，实际普通 create 返回 `created`，下一候选 Event ID 从预期 `1` 变为 `3`；R02 的真实交付、测试替身和结果专用三种模式均实际创建无关联结果事件并进入普通命令路径。两项红灯未删除或改写。

修复在 `src/core/events.ts` 增加保留类型拒绝，并将“允许创建保留结果类型”限制为协调器内部受控结果创建调用的私有参数。普通 create 在 Event ID 分配、生命周期登记、Inbox 与结果绑定之前返回 `reserved-event-type`；无论是否有普通 producer、是否显式白名单及是否配置白名单都不放行。真实交付与测试替身分发先检查结果类型和权威关联，保留类型缺失关联时返回 `result-lifecycle-invalid`，不再进入普通 handler；结果专用模式继续拒绝无关联事件。Manager authority 到受控结果创建路径保留。

R01 现覆盖无 producer／普通 owned producer、显式结果类型白名单／未设白名单和伪造／复制形态载荷；拒绝后 Event ID、计数、生命周期、Inbox、结果绑定均不变。R02 三种分发模式中 handler、receipt、consumer、Command、intent 和绑定调用数均为 0，随后合法普通事件回到 Event ID `1`。R03 由原 G01–G06 全部保留并通过，覆盖合法终态创建、故障回滚、回执丢失、固定阶段幂等消费、确认／退役及持续故障有界返回。

专项 `tests/transaction-results.test.mjs` 为 `8/8` PASS；`npm.cmd run typecheck` PASS；`npm.cmd test` 为 `112/112` PASS，0 fail、0 skipped；`npm.cmd run electron:build` PASS；共享核心隔离扫描无输出；`git diff --check` PASS。源码哈希：`events.ts` `9A055CECD7681DF169ADB82FC1579D6974939FEF2DA9747788B3D27E86A277F4`、`transactions.ts` `ABEFDB5E1990C897B5AF3483025ED66E41140F746A1B445D505A6B2887DDF7BD`、`transaction-results.ts` `4BF518631115B2AA8A3C83299EC816ECA30138298F2E071ADEE07E951ACAF5A8`，专项测试 `CBE1DCF5A6F82DC5F5DDC2A9389BFC562C2AB5CCDF8D7F061F24066AA30722EB`。

生产 ASAR `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B` 与 EXE `BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973` 未变化，因为结果核心没有进入宿主入口。Chrome Web／Electron 开发版／独立包新事件业务链、检查点、存档和 Edge 均 NOT RUN。R1 状态为 DONE（待 Work 审查），D09-C2 继续 BLOCKED；不自动进入后续任务，不 Commit／Push／发布。

R1 收口后建议下一项：仅将现有“开启测试路线”交互接入共享宿主的真实事件 → 命令 → 跨 Tick 事务 → 唯一最终结果链，并做 Chrome／Electron 开发版／独立生产包定向验证。此处是后续方向，不是本轮开发授权；本轮不得顺带实施。

### 2026-11-13 D09-C1-R1 Work 复审

Work 按 `c94a797` 阅读终态提交失败立即返回、pendingTerminal 保存、显式新 Tick 恢复及持续故障回归；源码／测试 SHA-256 分别为 `EE43AF96C5CDC76714F4DBFF9F3F06DDDB96CBBDA85FEE190188628358E8BE22`、`5F400FB13D6B2D3E319ED053A33B82160941C483B45520656BF2C6556E965DF2`，匹配报告。本轮重跑类型检查、Electron Main 编译及 104/104 测试 PASS；未重跑构建或 GUI。旧复现所涉连续 5 次故障现由 R01 覆盖：每个显式调用只增加一次提交尝试、业务执行不重跑，解除故障后登记原 Succeeded；Failed 的保留／恢复另有覆盖。

D09-C1-R1 缺口关闭，D09-C1 在当前核心原型范围收口。terminal-pending 只是尚未正式登记终态的工程状态，不能成为最终结果事件来源。预算与内部状态保持原型性质，旧复现、历史测试／未覆盖项保留。下一段 D09-C2 收尾最终反馈，不以当前不变 ASAR 或体验窗口宣称新核心已在 GUI 中运行。

### D09-C2 任务卡：唯一最终结果事件

- 目标：连通“真实事务终态 → 协调器原子创建唯一最终结果事件 → 后续合法阶段幂等消费 → 生产者显式确认与安全退役”的核心闭环。结果创建／消费出错只恢复反馈，不重跑已完成业务，不重开原事件。
- 依据：Independent Transaction Result Event、Complete Identity Association Context、One Final Result Event per Transaction、Two Terminal Transaction Outcomes、Coordinator-owned Event Creation Entry、Coordinator Auto-Enqueue、Atomic Create-Register-Enqueue Commit、Single-pass Event Dispatch、Event ID + Idempotent Processing、Producer Acknowledgement。字段／内部接口和结果处理方式是受控工程实现，不升级 PROPOSED 为最终 API。
- 范围：在既有事务管理、事件创建／分发／确认模块上做最小扩展，必要时增加小型结果反馈模块，避免把所有细节继续堆入 events.ts。不新建全局总线、第三方消息依赖或事务执行框架；沿用真实 D08 进度业务验证核心链，保留现有 GUI 原型接线。
- 终态来源：只接受目标 Transaction Manager 已正式登记的 Succeeded／Failed，不接受 not-started、running、retry-pending、recovery-pending 或 terminal-pending。使用受控 Manager／producer 关联核对真实终态与身份，不凭外部任意载荷或一个数字 Transaction ID 推断终态；协调器不自行执行 verify 或决定 Failed。
- 身份上下文：结果事件拥有新的统一 Event ID，沿用原 Runtime Instance ID，显式携带原 Event ID、Command ID、Transaction ID 及终态。自身 Event ID 与原 Event ID 分别命名，不混用、不互相编码；不分配新 Command／Transaction ID。原始 Event 已 Completed／退役后仍不重开，身份关联从持有的命令／意图／事务记录取得，不要求保留原完整事件来发布结果。
- 唯一创建：事务管理模块向协调器请求创建，不能自行编号或直接入 Inbox。每个事务维护稳定的最终结果关联／创建身份；同一终态重复请求、回执丢失后查询／重试、对象重取，均得到原 Result Event ID，不再次分配。不能只在调用方“收到返回值”后才记住 ID，否则提交成功但返回丢失会产生第二个事件。
- 原子性与失败：继续遵守候选 ID、Pending 登记与 Inbox 原子提交；结果身份绑定必须与成功创建一致，不能留下“事件创建成功但绑定缺失”或绑定到已回滚候选。创建失败无正式事件时可显式重试创建，事务终态和业务效果保持不变；无法确认创建是否成功时先查询既有绑定，不能盲目再 create。每次尝试有界，不递归补发，不引入自动重试次数／间隔。
- 结果消费：沿用固定阶段、单轮及 Pending 实际分发前转 Processing。结果事件应走明确的结果通知消费分支，只记录／展示可查询的最终结果，不再发业务 Command、启动 Transaction、发奖励或递归生成新结果。不得将结果消费者返回伪造成 Accepted 命令回执。
- 消费结束：本次为结果通知路径提供受控、可测试的协调处理完成返回；成功消费后可进入 Completed，以继续既有 producer 确认／退役协议。这里表示该结果通知处理结束，不是一次新命令交付，不改变原命令分支 Accepted 才完成的约束；不能把此特殊路径泛化为任意 handler 返回即 Completed，不据此锁定所有无命令事件的最终 API。
- 消费失败恢复：保留原 Result Event ID、已知生命周期和消费诊断，不换身份重投、不执行原业务；通过明确后续合法阶段恢复该通知。若消费者效果已经应用、但完成登记／回执中断，按事务身份／结果身份核查并幂等完成，不能重复增加通知业务效果。不清空全局错误并重放此前 Completed 批次，不丢后续 Pending。
- 原交付独立：事务结果通知不是原命令 Unknown 的查询替代，不因看到 Succeeded／Failed 就绕过原目标 accept/query 规则；原始事件完成后不重开。事务执行器不会因结果创建、消费、确认或退役失败被再次调用，原奖励新增数不变。
- 生产者与退役：结果事件的 producer 为受控事务来源；结果通知本身处理完成后，由该 producer 取得处理结果、明确确认，再按既有条件退役。原始事件与结果事件各自确认和退役，不互相代替。结果事件已退役后同一事务再次请求反馈仍指向原结果身份／已退役状态，不能再创建第二个正式事件；保留必要的轻量关联，不能因事件完整记录删除而丢掉唯一性约束。
- 资源保护：事务／命令记录和必要最终结果绑定不因事件退役擅自删除，采用明确有限容量，与已有事件预算一致地保守准入。不能为腾空间遗忘旧结果绑定，也不保留无限完整事件历史；本段不实现命令／事务生命周期安全清理、跨会话结果存储或无界查询循环。
- G01：真实核心链成功事务与最终失败事务分别创建一个正式结果事件，携带完整独立关联；非终态、尤其 terminal-pending，不创建事件、不消耗正式 Event ID。原业务新增次数和原事件终态不变。
- G02：创建准备／提交／绑定故障及队列满可恢复；提交成功但返回丢失后仍复用原 Result Event ID，单事务不出现两个正式事件。重复请求不能增加业务执行、Command／Transaction 编号或正式结果数量。
- G03：结果在正确后续协调阶段消费，不插入当前轮、不递归处理；消费不生成命令或新事务。消费成功及完成登记故障的恢复均保持通知幂等与同一结果身份，旧 Completed 不重放。
- G04：原始事件可以先确认退役，事务随后完成并正确反馈；命令 Unknown 与最终事务结果保持独立。伪造原 runtime／event／command／transaction／producer、篡改终态、跨目标请求均拒绝，不能借结果路径绕过创建与身份规则。
- G05：结果事件完成→producer 显式确认→安全退役后，重投旧事件仍拒绝，再次请求同一事务结果也不创建新 Event ID；乱序反馈／确认不越过不安全水位线缺口，容量拒绝不污染现有数据。
- G06：保留原 104 项有效语义，补真实模块链与故障测试，持续结果创建／消费故障均有界、不会重新调用业务 apply，正常／异常业务终态不重开。记录创建尝试数、正式结果数、结果消费尝试／有效次数及奖励新增数，不用单一 PASS 掩盖不同验证层级。
- 验证报告：类型检查、`npm.cmd test`、适用 Web／Electron 构建及 `git diff --check`；提供四套身份关联、原始／结果事件状态、事务终态、失败恢复前后计数、producer 确认／水位线和版本哈希。仍未接宿主，Chrome／Electron GUI 事务流程 NOT RUN，无需重跑未受影响的物理长套件，不以不变 ASAR 作为核心链已运行证据。
- 停止范围：不接 Web／Electron 入口、正式任务、检查点／RecoveryError、磁盘存档或新玩法；不确定最终重试参数、物理方案或 UUID API，不改 CONFIRMED、不新增依赖。不删除文件、不关闭体验窗口、不 Commit／Push／发布；更新 README、路线图与实际受影响的项目概述，完成后停止等 Work 审查。两轮有效修复仍失败或真实架构冲突时提交最小复现，无新增用户产品决策需求；后续再安排宿主接线与可玩链路验证。

### 2026-11-13 D09-C2 执行结果

在 `src/core/transaction-results.ts` 新增结果事件合同，并扩展事件协调器与 `RuntimeTransactionExecutionManager`。Manager 只通过自有 authority 向协调器提供已正式登记的 Succeeded／Failed；结果事件拥有新 Event ID，并携带原 Runtime／Event／Command／Transaction／target 关联。结果 Pending 登记、Inbox 入队、Event ID 提交和事务到结果绑定按受控创建流程提交；准备、提交或绑定故障完整回滚，提交后回执丢失则保留原绑定并返回 Unknown。

固定阶段 dispatch 在普通命令 handler 之前识别结果事件，单轮快照不变。通知消费者成功或报告 already-consumed 后才登记 Completed；完成登记故障恢复为同一 Pending 事件，不创建 Command／Transaction，不重跑原事务业务。结果 source 自己的 producer 在 Completed 后读取、显式确认并在安全条件满足后退役；原事件与结果事件互不代表。

G01–G06：

| 用例 | 状态 | 主要证据 |
| --- | --- | --- |
| G01 | PASS | Succeeded／Failed 各创建一个 Result Event ID `2` 并绑定完整身份；running 与 terminal-pending 均拒绝，不消耗事件号。 |
| G02 | PASS | 七类准备／提交／绑定故障全部回滚；Inbox／结果绑定容量拒绝不污染；回执丢失后重复请求沿用原 Result Event ID。 |
| G03 | PASS | 创建时不消费；固定 Tick 消费不产生 Command／Transaction；完成登记失败以同 ID 恢复，业务新增不重复。 |
| G04 | PASS | 原事件可先退役再反馈；原命令 Unknown 与事务结果独立；伪造 source、runtime、target、terminal 和关联均拒绝。 |
| G05 | PASS | 错误 producer 不能确认；结果确认／退役独立；旧事件重投拒绝，退役后重复反馈仍用原 ID，容量拒绝不删已有绑定。 |
| G06 | PASS | 连续创建／消费故障每次有界返回；业务保持 `1/1/1`，命令／事务身份不新增；记录创建尝试、消费尝试和正式结果数。 |

`npm.cmd run typecheck`、D09-C2 专项 `6/6`、`npm.cmd test` 的 `110/110` 及 `npm.cmd run electron:build` 均 PASS；0 fail、0 skipped。源码哈希为 `events.ts` `790AC1D04FCED62A052E17700E43128C7D53B24EDAD40A4B41088318D1BB1F75`、`transactions.ts` `ABEFDB5E1990C897B5AF3483025ED66E41140F746A1B445D505A6B2887DDF7BD`、`transaction-results.ts` `4BF518631115B2AA8A3C83299EC816ECA30138298F2E071ADEE07E951ACAF5A8`，专项测试哈希 `6F8DC1561F8E20343E20500745C7958BC358269BFC34F380E12995031B2C50FC`。

生产 ASAR `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B` 与 EXE `BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973` 未变化，因为新核心未进入宿主入口。Chrome Web／Electron 开发版／独立包事务结果运行、宿主接线、检查点、RecoveryError、存档和 Edge 均 NOT RUN。Matter 仍为候选。详细边界与 G01–G06 证据见 [README D09-C2](../README.md#d09-c2唯一最终结果事件核心)。状态为 DONE（待 Work 审查），不自动进入后续任务，不 Commit／Push／发布。

### 2026-11-13 D09-C1 Work 审查与 R1 任务卡

基线 `cef92d2`，审查开始时工作区干净。Work 阅读事务执行、错误路径与测试，transactions 源码／测试哈希分别为 `CD06434C1B477E520E5DC0DD5BCF02E57164A60E59969DE0B3473782990FB98C`、`585FB3C4DA2967350F736281BE6912245BC1E2A0C7959446303D89F128CFA093`，匹配报告。本轮重跑类型检查、Electron Main 编译及 100/100 测试 PASS；未重跑构建或 GUI。既有证据保留，但不能据此认为未覆盖故障正确。

Work 使用当前真实核心模块做无文件写入 Node 复现：真实 Accepted 意图、真实 D08 进度，retryBudget=0／recoveryBudget=0；Tick 2 apply 成功，Tick 3 verify 后的 `before-terminal-commit` 连续抛错 5 次、第 6 次允许通过。同一次 advance(Tick 3) 内发生 6 次终态提交调用，最后记录为 Failed，进度目标／奖励／效果仍为 1/1/1。源码原因是 `#commitTerminal` 捕获故障后调用 `#routeAfterError`，耗尽路径后再次调用 `#commitTerminal`；持续故障没有递归退出条件。此次运行用有限 5 次故障避免实际栈耗尽，持续失败会无限递归是从源码控制流得出的风险判断，不伪称已执行栈溢出测试。

现有 F04 只让终态故障出现一次并随后恢复，未覆盖该路径。D09-C1 暂为 BLOCKED，只安排以下 R1，不扩大到 C2。工程重试／恢复预算保持原型参数，不能靠提高预算、移除故障注入、吞异常或自动重复调用来掩盖问题。

- 目标／模块：在 `transactions.ts` 修复终态登记中断的控制流，并补真实核心集成回归；仅必要的执行状态／错误元数据调整，不改进度、交付、物理或正式设计。
- 行为：每次显式操作中的终态登记尝试必须有界，不允许 catch→错误处理→同 Tick 再递归登记到成功。提交失败立即保留原事务、已观察业务效果、错误与待登记结果，并返回可检查的非终态／受阻结果；不能在未成功登记时假报 Succeeded 或 Failed。
- 结果与恢复：业务已经 verify 成功而终态元数据写入失败，不能仅因元数据故障把业务结果递归改判失败。保留明确待登记结果；下一合法阶段可由显式恢复／登记重试入口处理，沿用原身份，不重新 accept、创建意图或调用 apply。若原本应登记 Failed，也须保留原业务失败依据，元数据恢复不重新运行失败业务。允许必要只读 verify，不增发目标或奖励。
- 不混淆预算：区分业务重试／安全恢复与终态登记本身的失败。业务路径预算为 0 时也必须安全返回，不能形成无限递归或要求无限自动恢复；后续元数据恢复的具体接口由实施者选择并记录工程边界，不偷偷修改全局终态规则或升级为新正式参数。
- R01：新增可稳定失败的回归：retryBudget=0、recoveryBudget=0、终态故障连续 5 次后才放行，验证单次调用不会执行 6 次提交；故障一直有效时，多次显式后续操作均快速返回、无递归／栈溢出或业务重跑。用受控计数／短超时保护测试，不能靠等到进程崩溃判断。
- R02：Succeeded 待登记场景下保持已完成业务／原身份，后续同 Tick／倒退调用拒绝；解除故障后，在新合法 Tick 显式恢复并正确终结。目标、奖励、效果各仍只新增一次，原 Event 不重开，Command／Transaction 编号不变化。
- R03：原业务应 Failed 的终态登记也持续失败，安全保留失败依据、不得提前声称已写入终态；恢复后仍为正确的 Failed，不重新 apply、不错误变为 Succeeded。覆盖预算非零时的同类故障，不能仅修补零预算特例。
- R04：保留原 100 项有效语义，包括一次故障的既有恢复、Unknown 已执行后核查、目标与奖励幂等、终态防重；如原错误路径断言确需调整，解释其为何错误，不能放宽无副作用、身份或终态验证。
- 验证与报告：类型检查、`npm.cmd test`、适用 Web／Electron 构建、`git diff --check`；报告修复前后每次调用提交尝试数、Tick、待登记／已登记状态、错误及业务新增数、版本哈希。本段仍未接宿主，GUI／三端事务运行及最终结果事件 NOT RUN，无需重跑未变动的物理长套件。
- 交付与停止：更新 README、路线图和受影响的项目概述，保留原报告和复现记录。不新增结果事件、宿主、检查点、存档、正式玩法、依赖或通用持久化框架；无新增用户产品决策，不改 CONFIRMED、不删除文件、不关闭体验窗口、不 Commit／Push／发布。两轮有效修复仍失败则整理最小复现交 Work，完成后停止等审查，不开始 C2。

### 2026-11-13 D09-C1-R1 执行结果

D09-C1-R1 已按任务卡完成终态登记控制流修复，等待 Work 审查。`RuntimeTransactionExecutionManager` 新增 `terminal-pending` 状态、`pendingTerminal` 待登记结果、`terminalCommitAttempts` 独立计数和终态登记错误记录。`apply／verify` 得到最终业务结果后只调用一次终态提交入口；提交失败不再进入 `#routeAfterError`，因此不会触碰业务 retry／recovery 预算，也不会在单次操作内递归。

终态登记失败时，记录保留原 Runtime／Event／Command／Transaction／target、业务新增、错误和预期 Succeeded／Failed 结果，但 `terminal` 仍为空并返回可检查的 `terminal-pending`。后续 `advance()` 明确要求显式 recovery，`recover()`只在新合法 Tick 重新登记保留结果；不执行 executor、不重新 accept、不创建 intent 或第二事务。终态登记恢复不消耗业务预算，Succeeded 与 Failed 待登记结果都沿用原身份。

| 用例 | 状态 | 实际证据 |
| --- | --- | --- |
| R01 持续故障 | PASS | 修复前复现为同一 Tick `3` 内 6 次提交并错误 Failed。修复后零预算下 Tick `3` 只提交 1 次并保留 Succeeded pending；Tick `4–7` 每次显式 recover 各提交 1 次仍 pending；Tick `8` 第 6 次提交成功进入 Succeeded。业务执行尝试保持 `2`，目标／奖励／效果保持 `1/1/1`。 |
| R02 Succeeded 待登记 | PASS | `pendingTerminal` 保留 Tick `3`；同 Tick／倒退 Tick 拒绝，advance 要求显式恢复。Tick `4` 解除故障后只重试元数据登记并 Succeeded；Event 保持 Completed，原 Command／Transaction／intent 与编号不变。 |
| R03 Failed 待登记 | PASS | 使用非零预算，业务永久错误后预期 Failed 的终态登记连续失败时只保留 `terminal-pending`，不提前写 `terminal`。解除故障后恢复为原 `prototype.invalid-completion-request` Failed，execution 尝试仍为 `1`，没有重新 apply 或改成 Succeeded。 |
| R04 原语义 | PASS | 正常登记仍为单次提交并在 Tick `3` Succeeded；终态后 advance／retry／recovery 均返回 `terminal`。原 100 项测试保留，F04 的旧断言由 `recovery-pending` 更正为 `terminal-pending`，原因是终态元数据故障不属于业务恢复状态；无副作用、身份和终态验证未放宽。 |

`npm.cmd run typecheck` PASS；`npm.cmd test` 为 `104/104` PASS，0 fail、0 skipped；`npm.cmd run electron:build` PASS。修复基线 `cef92d23e226cd649de34b6cd35ebae03ee1a4c7`。`src/core/transactions.ts` SHA-256 为 `EE43AF96C5CDC76714F4DBFF9F3F06DDDB96CBBDA85FEE190188628358E8BE22`，`tests/transactions.test.mjs` 为 `5F400FB13D6B2D3E319ED053A33B82160941C483B45520656BF2C6556E965DF2`。生产 ASAR 与 EXE 仍为 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`／`BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`，与新核心未进入宿主入口一致。

Chrome Web／Electron 开发版／独立包事务运行、Edge、最终 Transaction Result Event、宿主、检查点与存档均为 NOT RUN；未重跑未修改的物理长套件。详细证据见 [README D09-C1-R1](../README.md#d09-c1-r1终态提交失败的有界恢复)。当前等待 Work 审查，不进入结果事件或其他后续任务，不 Commit／Push／发布。

### 2026-11-13 D09-B2 Work 审查

Work 按 `d954e24` 阅读真实交付、按原 Command ID 查询、接收结果关联验证和显式重试测试，events／commands／delivery 源码与 delivery 测试哈希均匹配交付报告。审查开始时工作区干净，本轮重跑类型检查、Electron Main 编译及 94/94 测试 PASS，未另跑构建或 GUI。真实接收与旧替身分离，丢失回执不重跑 handler 或重新创建意图，当前核心联调范围收口。

下一段须注意：当前 `acceptanceMatchesCommand` 以 intent 的 `executionState=not-started` 校验。接收意图与运行执行状态必须分开，事务运行／完成后不能让原命令核查误判为尚未接受；应以已提交接收／意图的身份关联为依据。该情况在当前 B2 无执行的范围不构成失败，但属于 C1 新集成的必要回归。ASAR 相同不代表宿主事件链已运行，GUI、检查点及存档仍未验收。

### D09-C1 任务卡：最小事务执行与终态判定

- 目标：从真实目标已经提交的事务意图启动执行，形成可跨多个实际模拟步推进的核心事务；用现有 D08 进度模块验证一项测试业务效果，完成成功、可恢复中间失败和最终失败的最小闭环。不接 GUI，不制作新玩法或通用工作流引擎。
- 依据：Atomic Acceptance and Transaction Intent、Transaction ID at Intent Creation、Target Transaction Manager-owned Idempotent Command Acceptance、Two Terminal Transaction Outcomes、Failure Only After Retry and Recovery Paths Are Exhausted、Transaction Manager-owned Failure Classification and Retry Decision、Event-Transaction Lifecycle Separation、One Final Result Event per Transaction。具体中间状态、错误类型和接口是注明的工程原型，不将 PROPOSED 重试次数／间隔或通用恢复策略升级正式决策。
- 模块：目标事务管理模块是执行状态、错误分类、重试／恢复和终态判定的唯一权威，可组合一个小型 `transactions` 核心模块；执行器只报告结果／错误。Event Coordinator 继续只管交付／核查／事件生命周期，不接管事务内部执行，不把事务执行逻辑继续塞入事件大文件。执行器通过平台无关端口作用于进度，核心无 DOM／Node／Electron／Phaser 依赖。
- 启动与身份：只为真实已 Accepted 的有效意图创建一次执行记录，沿用其 Runtime／原 Event／Command／Transaction／target 关联；重复启动、重交、显式恢复或重试不能创建第二个执行身份。未接收、原子回滚失败、不属于该目标或其他 runtime 的输入拒绝。Event 已 Completed／安全退役不撤销或重新建立有效意图，原身份仍能从命令／意图记录追溯。
- 阶段推进：接收阶段仍不直接执行业务；后续显式的合法模拟阶段推进事务，至少演示一项跨两个不同 Tick 的执行。重复／倒退 Tick、递归进入不得重复执行同一步，不靠墙上时间推进。当前调用由核心集成测试驱动，不声称已经接入 Simulation Runtime；暂停不调用推进时不得自行运行计时器或后台任务。
- 测试业务：使用 D08 已有测试目标／收藏等稳定业务 ID，执行器调用真正的 InMemoryRunProgress，目标成功后记录一次目标／奖励／永久效果，避免只修改假计数。使用一个受控目标操作即可，不新增正式任务／文化内容／背包、可玩谜题或物理机关。原 D08 灰盒原型接线保持不变，本段的事务执行仅在核心组合测试中启用。
- 意图与当前状态：意图是已提交的创建依据，执行状态另行管理并清楚命名。Accepted 查询和重复命令仍返回同一已提交关联，不能因为事务正在运行或已经终结而变为 Unknown；必要时最小迁移查询视图／验证逻辑并说明原因。不得把原始 not-started 创建字段当成当前执行状态。
- 错误权威：执行器报告可控错误，由 Transaction Manager 判断是合法重试、安全恢复还是无可用路径。仍有任何合法路径就保留原事务、不得进入 Failed；一次恢复失败或达到某测试重试条件也不能单独推导 Failed。明确不可重试且无安全恢复的测试错误可直接最终失败；不要求实际尝试已确定不可用或不安全的路径。
- 重试／恢复：采用小型、显式触发的原型入口和可验证策略，不添加自动重试调度、固定次数／间隔、无限恢复或通用策略框架。重试／恢复保持原 Transaction ID，不通过重交事件、换命令或重新分配编号绕过失败。部分业务效果已生效时要通过幂等设置／进度状态核查安全继续，奖励不能新增第二份；区分执行尝试数与有效业务新增数，不能把重复尝试算成重复发奖。
- 终态：只保留 Succeeded／Failed 两种最终结果，无 Cancelled 第三终态；运行、待重试、恢复中均不冒充终态。终态记录不可因后续推进、重试、重复交付或原事件状态变化而重新打开；记录清晰的最终结果与原始身份，为下一段结果事件提供只读来源。本段不分配 Result Event ID、不创建假结果事件，不把终态查询当成 Transaction Result Event 已实现。
- 容量与清理：执行记录与命令接收／事务意图、事件记录各自独立。事件退役不清理事务状态，不能为腾容量删除终态防重信息；用明确有限的准入保护，不实现尚未设计的命令／事务安全清理或跨会话持久化。原记录和原身份保留，不借本段建立新运行身份或重置编号。
- F01：真实事件→命令→Accepted 意图后原事件 Completed、业务尚未执行；后续两个合法 Tick 推进真实 D08 测试业务至 Succeeded，奖励和效果只新增一次，身份全程不变。
- F02：重复启动／同 Tick／倒退／递归／终态后推进都不重复有效业务，已 Accepted 的重复命令仍返回原事务。原事件确认退役后，事务仍可完成并保持原 Event 关联。
- F03：暂时失败保留事务且不创建最终结果，显式重试后仍同 ID；安全恢复可用时不提前 Failed，模拟一次恢复失败但仍有其他合法路径时仍非终态。最终失败只在测试策略明确没有合法重试／安全恢复后由 Manager 判定，执行器不能自行写 Failed。
- F04：业务应用前及应用后／终态登记前注入中断，安全重试／核查不能重复目标或奖励。最终 Succeeded／Failed 后重复操作不重新执行，不能新建 Transaction ID 逃避原事务终态。
- F05：回执丢失造成原事件 Unknown，目标意图随后已经运行／Succeeded／Failed，再按原 Command ID 查询仍确认 Accepted 并完成原事件，不重交、不重跑原 handler 或业务。验证接收查询与执行结果的独立性，而非只调整状态字符串。
- F06：保持原 94 项的有效语义，补核心执行与真实模块集成测试、只读查询、容量／非法身份和暂停无推进边界；旧 B1／B2 中未调用执行入口的用例仍应业务执行 0。不得为了增加计数而删除这些保护或把测试替身改成默认成功。
- 验证报告：类型检查、`npm.cmd test`、适用 Web／Electron 构建与 `git diff --check`；提供逐 Tick 执行状态、错误分类／路径依据、原始身份、尝试与业务新增次数、终态前后快照及版本哈希。未接宿主，GUI／三端事务运行 NOT RUN；最终结果事件、检查点与存档 NOT RUN，不重跑未改的物理长套件，不用旧 ASAR／体验截图作新事务证据。
- 不做与停止：本段不生成或消费最终 Transaction Result Event、不接 Web／Electron 入口／现有 D08 交互、不实现检查点／RecoveryError、磁盘存档或正式任务；不追加最终参数／依赖，不改 CONFIRMED。更新 README、路线图和项目概述的实际进度，不新增大型架构文档。两轮有效修复仍失败或正式边界冲突时交 Work，无新增用户产品决策需求；不删除文件、不关闭体验窗口、不 Commit／Push／发布，完成后停止等审查，下一段再安排唯一最终结果事件。

### 2026-11-13 D09-C1 执行结果

D09-C1 已按任务卡完成纯核心最小事务，等待 Work 审查。新增 `src/core/transactions.ts` 与 `tests/transactions.test.mjs`。执行 Manager 只从目标权威 `query(Command ID)` 返回的真实 Accepted record／intent 启动一次记录，沿用原 Runtime、Event、Command、Transaction、target、command type 与 payload；原始 intent 保持 `not-started`，运行状态单独保存。每次推进前重新查询并核对关联，命令接收记录、事务运行状态和事件生命周期互不替代。

原型状态为 `not-started → running → Succeeded／Failed`，中间可进入 `retry-pending` 或 `recovery-pending`。业务阶段固定为 `apply → verify`，只接受严格递增的 SimulationTick；F01 在 Tick `2` 应用目标／奖励／永久效果，在 Tick `3` 校验并完成。Manager 通过执行前后 D08 Progress 快照差分记录有效业务新增。默认记录容量 `256`、显式重试预算 `1`、安全恢复预算 `1`，均为可配置工程值。

| 场景 | 逐 Tick 状态与证据 |
| --- | --- |
| 成功 | Tick `2` apply：目标／奖励／效果各 `1`，执行尝试 `1`；Tick `3` verify：执行尝试 `2`，Succeeded，业务新增保持 `1`。 |
| 暂时失败 | Tick `2` 应用前错误：retry-pending、业务新增 `0`；Tick `3` 显式 retry 沿用同一 Transaction，apply 成功；Tick `4` verify Succeeded。 |
| 业务后异常 | Tick `2` 观察到新增 `1` 后异常：recovery-pending 且阶段切到 verify；Tick `3` 首次恢复失败仍保留 1 条恢复路径；Tick `4` 安全 verify 成功，未再次 apply。 |
| 终态中断（R1 前） | D09-C1 初版在 verify 成功但终态登记故障时进入 recovery-pending，未覆盖持续故障；该状态已由 R1 修正为独立的 `terminal-pending`，历史记录保留。 |
| 无安全恢复 | 已观察业务效果但 recovery 预算为 `0` 时直接 Failed，即使 retry 预算存在也不重新 apply。 |

错误分类由 Manager 独占：`prototype.temporary-apply` 在无业务新增时走 retry；业务写入后异常、`prototype.ambiguous-apply`、`prototype.progress-incomplete` 与 `prototype.recovery-transient` 走 recovery；终态提交中断由 R1 单独保存为 `terminal-pending`，不进入业务错误路由；`prototype.invalid-completion-request` 与 `prototype.invalid-progress` 明确为 permanent；未分类错误只有在尚有可检查路径时保留，不能自动判成功。终态之后不能重开，也不能靠重新交付事件、接受 Command 或新建执行记录绕过。

F01–F06 全部 PASS。真实丢失回执场景中，目标已接受但 Event 保持 Unknown；事务使用同一 Command／Transaction 完成 Succeeded 后，下一合法阶段仍按原 Command ID 查询并完成原事件，handler、accept 与 intent 数不增加。F06 保留原 94 项语义，新增容量、错误身份、只读快照、递归、同／倒退 Tick、无调用不推进和平台隔离测试；旧 B1／B2 未调用执行入口时业务执行数仍为 `0`。

`npm.cmd run typecheck` PASS；`npm.cmd test` 为 `100/100` PASS，0 fail、0 skipped；`npm.cmd run electron:build` PASS。基线提交 `d954e2456130ad0ffddd94d18ee0e2f7a126db67`。`src/core/transactions.ts` SHA-256 为 `CD06434C1B477E520E5DC0DD5BCF02E57164A60E59969DE0B3473782990FB98C`，`tests/transactions.test.mjs` 为 `585FB3C4DA2967350F736281BE6912245BC1E2A0C7959446303D89F128CFA093`。生产 ASAR 与 EXE 仍为 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`／`BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`，与新核心未进入宿主入口一致。

Chrome Web／Electron 开发版／独立包事务运行、Edge、最终 Transaction Result Event、真实正式业务、宿主、检查点与存档均为 NOT RUN；不重跑未修改的物理长套件，不用旧 ASAR／截图证明本段。详细证据见 [README D09-C1](../README.md#d09-c1最小事务执行与终态判定核心)。当前等待 Work 审查，不进入结果事件或其他后续任务，不 Commit／Push／发布。

### 2026-11-13 D09-B1 Work 审查

Work 按 `6ff9d24` 阅读稳定命令、目标幂等接收及原子意图提交／回滚，events／commands 源码与 commands 测试哈希均匹配报告。审查开始时工作区干净，本轮重跑类型检查、Electron Main 编译及 87/87 测试 PASS，未重跑构建或 GUI。重复命令保持原 capability 和事务关联；提交失败回滚记录与意图、已分配事务号保留空洞，符合当前范围。D09-B1 收口，但事件成功分支仍用 Accepted 测试替身；下一段须明确区分真实目标接收与替身合同，不把 not-started 意图当业务成功。

### D09-B2 任务卡：真实交付分类与 Unknown 核查

- 目标：核心层连通“Pending 事件 → 固定阶段 Processing → 原稳定命令 → 真实目标原子接收 → 原事件 Completed”，覆盖四类交付结果与 Unknown 主动查询。真实指调用已有 TargetTransactionModule，不是实际游戏事务或 GUI 端到端。
- 依据：Command Handoff Failure Classification、Reconciliation Before Retry、Command Handoff = Event Completion、Event-Transaction Lifecycle Separation、Stable Command ID、Single-Command Event Handoff、Atomic Acceptance and Transaction Intent，以及固定阶段／单轮／防重／确认规则。具体接口与异常记录为工程实现，不确认新的事件终态或重试参数。
- 模块：增量扩展 events／commands 的受控接口，必要时新增小型交付模块，避免无关细节继续堆入事件大文件。旧测试可保留明确的替身模式；真实模式必须使用实际目标 receipt／intent，不能缺省 Accepted 或把真实回执转换为 testCommandReference 冒充联调。两模式配置明确且不意外同时生效，不重构无关模块或新增依赖。
- 正常路径：合法协调阶段为原事件取得唯一稳定命令并提交原目标。目标返回明确原子接收成功后，协调器验证 runtime／Event／Command／Transaction／target 关联，原事件才 Completed，最终协调结果携带真实关联。事务保持 not-started、业务执行数为 0；Accepted 不等于 Succeeded，不释放事务锁或清除目标记录。
- 分类：Accepted 仅目标明确接受；Retryable 需证明从未接受且原因暂时；Rejected 为不合法／不支持／违反规则且不自动重试；不能确定是否接受为 Unknown。底层 failed／blocked／rejected 不能机械映射，尤其回滚不确认、调用抛错或回执缺失不能当成未接受。
- Unknown 核查：保留原事件／命令／去重记录及原目标，阻止同一命令重交。协调器在后续合法协调阶段按原 Command ID 调用原目标权威 query，不直接读写目标 map。found 需身份关联一致才转 Accepted；权威 not-found 还要按实际原因区分 Retryable／Rejected。查询异常、blocked、关联不一致或不明确均保持 Unknown，不能解释成未接受。
- 恢复与显式重试：已接收但丢失回执，查询确认后只完成原事件，不重跑 handler、不重新创建 Event／Command、不再次 accept 或分配新事务号。不能简单清空 dispatchBlocked 后重放整个批次，也不丢其他 Pending。只有确认 Retryable 后允许显式触发一次交付重试，沿用原 Event／Command；有效 Transaction 身份不变，未形成意图的失败仍按空洞规则处理。不实现自动次数／间隔、退避或无限轮询。
- 生命周期边界：四类交付结果与事件生命周期独立。Retryable／Rejected／Unknown 的正式事件终态尚未确认，本段保留分类与现场，不假报 Completed、强制退回 Pending 或偷偷新增全套异常枚举。操作遵守单轮、合法阶段、无递归；新事件仍延后。未解决交付不确定性不能自动确认清理，真实 Accepted 完成后仍按生产者确认／退役协议；事件退役不清除命令接收记录。
- E01：无 Accepted 替身的真实核心成功链，Pending→Processing→Completed、一个 Command／有效 Transaction 意图、生产者可读真实关联，业务执行数始终 0。
- E02：四类结果有明确依据；非法身份／目标／载荷不误报成功，证明未接受的暂时故障才 Retryable，永久无效请求不自动重试，不确定回滚／调用异常保持 Unknown。
- E03：故障在真实目标已经提交、但调用方未得到回执处注入。初次 Unknown、恰一份意图；禁止重交，下一阶段按原 Command ID 查询后完成，accept 次数、原 handler 次数、事务编号均不增加。
- E04：目标接受前中断且权威 not-found，分别按暂时／永久原因分类 Retryable／Rejected；Retryable 显式重试沿用原命令，最多一份有效意图。查询失败、目标 blocked、关联不一致保持 Unknown，重交被拒绝。
- E05：递归／同阶段重入不重复执行，恢复不重放 Completed 或丢 Pending；确认与退役后命令接收记录仍有效。交付记录有限准入，不无界增长，不自行新增命令／事务退役协议。
- E06：保留原 87 项有效语义，新增 E01–E05 集成／故障测试，回归原子接收、事件防重、确认及退役。新测试调用真实目标模块和明确故障接缝，不把调用故障模拟声称为实际 IPC 故障；旧替身测试保持标识。
- 验证报告：类型检查、`npm.cmd test`、适用 Web／Electron 构建与 `git diff --check`；提供逐阶段状态、交付／查询／accept／handler 次数、四套身份、意图数量、错误分类、源码／测试哈希和未完成项。仍未接宿主，GUI／三端业务运行为 NOT RUN，不要求重跑未变物理长套件，不用旧 ASAR／截图证明新链运行。更新 README、路线图和实际受影响的项目概述，不新增大型协议文档。
- 不做与停止：不执行事务、不产生最终 Transaction Result Event、不接宿主／D08 玩法、检查点、存档或正式任务；不把内部异常当 RecoveryError、不锁玩家或擅自暂停全部事务。无新增依赖、正式决策变更或用户产品决策，不删除文件、不关闭体验窗口、不 Commit／Push／发布。两轮有效修复仍失败或跨模块冲突时交 Work，完成后停止等审查，后续再安排事务执行与最终反馈。

### 2026-11-13 D09-B2 执行结果

D09-B2 已按任务卡完成纯核心真实交付联调，等待 Work 审查。新增 `src/core/delivery.ts`，把 `EventCreationCoordinator` 的真实模式接到已有 `TargetTransactionModule.accept/query`；旧 `commandReceiptTestDouble` 路径保留并明确标为测试替身，两种模式互斥。真实 handler 只执行一次并创建原事件唯一稳定命令，目标返回明确 Accepted 且 Runtime／Event／Command／Transaction／target 关联一致时，原事件才进入 Completed，生产者结果携带真实 `commandId／targetId／transactionId`。事务 intent 保持 `not-started`，业务执行数固定为 `0`。

分类不机械映射底层状态：接收事务确认回滚完成后，临时故障才可经权威 `not-found` 查询成为 Retryable，永久故障成为 Rejected；未知回滚、调用抛错、blocked、查询异常及关联不一致均为 Unknown。Unknown 只允许按原 Command ID 查询，不重跑 handler 或重新 accept；found 一致时直接完成原事件。Retryable 不自动重交，只能在后续合法 `dispatch()` 中通过 `retryDeliveryEventIds` 显式列出，沿用原 Event／Command；未形成 intent 的失败事务号保留空洞。交付记录按 Event 使用有限准入容量，不删除未完成记录。

| 用例 | 状态 | 实际证据 |
| --- | --- | --- |
| E01 真实成功链 | PASS | handler／accept 各 `1`，Command `1`、intent `1`、Transaction `1`；事件 Completed，生产者读取真实关联，业务执行 `0`。 |
| E02 四类结果 | PASS | 同批 Accepted／Retryable／Rejected／Unknown 分类明确；临时与永久故障均在权威 `not-found` 后分类，未分类故障保持 Unknown。 |
| E03 丢失回执 | PASS | 首轮 Unknown，目标已有唯一意图；下一阶段 query 确认后 Completed，handler／accept／Command／Transaction 均不增加。 |
| E04 核查与重试 | PASS | 临时故障留下事务号 `1` 空洞，显式重试沿用原 Command 后形成唯一 intent 与事务 `2`；永久故障禁止重试；Accept、查询、blocked、关联异常保持 Unknown。 |
| E05 单轮、防重与容量 | PASS | 新事件延后、递归拒绝、Completed 不重放、Pending 不丢失；退役不清除命令记录；交付容量满时拒绝新增且保留既有记录。 |
| E06 回归与隔离 | PASS | 原 87 项语义保留，新增 7 项 D09-B2 测试；旧替身与真实接收路径分离，`delivery.ts` 无平台专属 API。 |

`npm.cmd run typecheck` PASS；`npm.cmd test` 为 `94/94` PASS；`npm.cmd run electron:build` PASS。Chrome Web／Electron 开发版／独立包业务链、真实游戏事务、最终结果事件、宿主、检查点与存档均为 NOT RUN。源码哈希：`events.ts` `8DA6DA0E958137A76A903865B3413A8E2367DD68F7E3FD2C04D7F2B86F7393D7`、`commands.ts` `A577A90C9C6AEE147897B0AB977789BF3DD5FF9BDE67B5EA54C4B4E7197E3E06`、`delivery.ts` `2B1B96ED790612A13A8859282147E10C27D5CAC08C4B38CBE574ACD6F1C7DA86`、`delivery.test.mjs` `8A2223BA2779EFC20144D2073B1CBADA073E0EC68CC9E795305C62FD55F9B4DE`。生产 ASAR 与 EXE 哈希仍为 D09-B1 的 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`／`BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`，说明新核心尚未进入宿主入口。详细报告见 [README D09-B2](../README.md#d09-b2真实交付分类与-unknown-核查核心)。

### 2026-11-13 D09-A3 Work 审查

Work 按 `6038571` 阅读生产者／结果 capability 校验、显式确认、退役条件、清理故障保守处理及对应测试；源码和三份事件测试的 SHA-256 均与报告一致。审查开始时工作区干净，本轮重跑类型检查、Electron Main 编译及 81/81 测试 PASS，未另跑生产构建或 GUI。完整记录清理后由水位线／轻量记录继续防重，组合容量限制避免低位缺口导致无界增长；结果与生产者权限使用弱引用辅助标识，正常清理移除完整结果引用。

D09-A3 当前核心范围收口。其 Completed 结果仍只表达测试命令接收成功，不能等同于事务最终结果；现有可玩包入口没有使用事件内核，GUI／真实业务仍 NOT RUN。不重跑未改动的物理长套件，也不把原 ASAR 一致解释为事件宿主运行通过。允许进入 D09-B1，继续保留正式接口／参数提案状态及未完成范围。

### D09-B1 任务卡：稳定命令与原子接收意图

- 目标：实现可独立验证的“创建稳定逻辑命令 → 目标事务管理模块检查重复 → 原子登记接收记录、事务创建意图及 Transaction ID 关联 → 返回 Accepted”闭环。只接收和保存意图，不执行进度修改、开门、捕获／恢复或其他实际事务。
- 正式依据：Stable Command ID、Runtime-scoped Independent Command ID Infrastructure、Target Transaction Manager-owned Idempotent Command Acceptance、Atomic Acceptance and Transaction Intent、Transaction ID at Intent Creation、Runtime-scoped Independent Transaction ID Generator、Non-reusable Transaction IDs with Permitted Gaps、Runtime-instance Scoped Transaction ID Uniqueness、Single-Command Event Handoff、Explicit Association with Independent Identities。工程接口、类型、容量和失败细分不升级为正式决策。
- 模块范围：在共享核心新增小型命令／接收模块及必要的独立编号基础设施，增量扩展当前运行上下文与协调器的受控创建入口。避免继续把无关命令业务堆入事件大文件；不为整理结构大范围重构已验收内核，不新增 Command Creation Service、依赖或通用消息框架。
- 身份分配：同一运行上下文提供一个 Command ID Generator 和一个 Transaction ID Generator，分别维护独立单调整数序列，不共用 Event ID 序列。协调器通过受控接口申请命令身份；目标事务模块在创建意图时经受控接口申请事务身份。不同体系可以碰巧具有相同数字，测试应验证序列独立而非强求数值各不相同。临时模块重建共用原运行基础设施，新完整上下文独立；不在场景／目标模块内部重置序列。
- 命令创建：一个真实逻辑命令创建一次稳定 Command ID，关联原 Runtime Instance ID、原 Event ID、目标模块、类型与不可篡改载荷。原事件最多创建并交付一条命令；重复取得／交付同一逻辑命令沿用原身份，不能为重试生成新 ID。关联显式保存，不把 Event ID 编码成 Command ID，不把实例 UUID 拼为替代原始业务 ID 的复合编号。目标不应由重投时任意改写。
- 创建边界：可用已登记测试事件作为来源，复用其运行身份与受控状态查询，不要求宿主接入或改现有分发替身。源事件未知／跨运行、无效类型载荷或第二条不同命令请求明确拒绝，不影响现有事件状态。Command ID 分配失败策略采用注明的保守工程实现，不擅自套用事件水位线或 Transaction ID 的空洞规则。
- 目标模块权威：各目标事务管理模块独立持有自己的命令接收记录、意图及只读查询。先按原 Command ID 查已接收记录；同 ID、相同不可变内容重复交付返回原 Accepted／关联信息，不创建新意图或再次分配有效 Transaction ID。同 ID 篡改载荷、原事件、运行身份或目标必须拒绝，不能仅改 target 字段就让另一个模块接受同一命令并创建第二个事务。
- 事务意图与原子性：新命令先准备接收记录与对应意图，在意图创建阶段申请 Transaction ID；接收记录、意图和四套身份关联整体成功后才正式生效并返回 Accepted。任一步失败整体回滚业务记录和关联，不出现可见的已接受记录而无意图，或孤立意图。协调器不持有或任意修改目标模块内部接收／执行状态，生成器只负责身份分配。
- 事务编号规则：Transaction ID 分配即消耗，提交失败不回退序列、不回收、不补洞。首次接收原子提交失败且确认没有有效意图时，再次接收同命令可申请更大的新候选事务编号，原空洞不可复用；已经成功提交的意图则必须沿用原 Transaction ID，重交／恢复不能创建第二个独立事务。安全整数边界明确拒绝，不回绕，不能把事务编号空洞用于事件水位线推进。
- Accepted 语义：只表示接收记录与意图及关联已经统一提交，事务可以尚未启动，不能把返回 Accepted 写成 Succeeded 或最终结果。目标按原 Command ID 提供权威接收／意图查询供测试核对；本段不实现协调器四类交付结果联调、Unknown 主动核查循环、重试调度或故障后真实事务恢复，无法确认提交／回滚完整时保守阻断，不假定未接收或自动重投。
- 保留与容量：命令接收记录与事务意图独立于事件记录生命周期。原 Event Completed、确认或退役不清除命令记录，不重开源事件；重复同命令仍必须返回原关联。具体命令／事务清理协议待设计，本段用明确有限的准入容量保护，满时拒绝新接收，不能为腾空间删除有效记录；只读快照不能改内部状态。
- D01：同一运行上下文跨多个测试生产者／目标模块创建命令，三套编号独立、Runtime ID 一致；单事件最多一条命令，重复取得／交付保持原 ID，非法或跨 runtime 来源无副作用。
- D02：成功接收恰有一份接收记录和一份意图、一个有效 Transaction ID 关联；Accepted 可查询但实际业务执行次数为 0。多个目标各自持有记录，不能越权查询／改写另一模块，伪造 target 不创建第二个关联。
- D03：重复同命令不新增记录、意图或有效事务身份，不重发奖励、不推进进度；同 ID 篡改载荷／身份拒绝。事件记录安全退役后命令接收记录仍有效，按原 Command ID 重交返回相同事务关联。
- D04：对接收准备、事务编号分配后、接收记录／意图／关联提交等有意义故障点注入，验证整体回滚且保留原已接受命令；失败的 Transaction ID 留洞不复用、再次成功使用更大编号。无法确认回滚时后续操作保守阻断，不冒报 Accepted。
- D05：已提交意图在模拟尚未启动时可查询并沿用原 Command／Transaction 身份，不能为“恢复”另建意图；新空运行上下文不承诺跨会话恢复，运行实例同号不会冒充旧命令。容量与编号边界拒绝不污染有效记录。
- D06：原事件单轮、防重、显式确认、水位线及原子创建回归保持；新模块无 DOM／Node／Electron／Phaser 依赖，不改变当前 D08 进度、交互、物理或暂停规则。
- 验证与交付：保留原 81 项有效测试并新增 D01–D06 核心／集成和故障测试，执行类型检查、`npm.cmd test`、适用 Web／Electron 构建与 `git diff --check`。提供原子提交前后／失败快照、重复接收与事务空洞证据、版本哈希和未完成项；纯核心未接宿主，GUI／三端业务链明确 NOT RUN，不用旧截图冒充。更新 README、路线图和实际受影响的项目概述，不另造大量协议文档。
- 停止边界：不替换现有 Accepted 测试替身冒充真实事件→业务端到端；不执行实际事务、不生成最终结果事件、不接检查点／存档／任务、不新增奖励内容或最终参数。无用户新增产品决策需求，不改变 CONFIRMED、不删除文件、不关闭体验窗口、不 Commit／Push／发布；两轮有效修复仍失败或出现架构冲突时整理最小复现交 Work。完成后报告并停止，后续再安排真实交付核查与事务执行段。

### 2026-11-13 D09-B1 执行结果

`RuntimeEventContext` 现持有 Event、Command、Transaction 三套独立序列。`EventCreationCoordinator.createCommandCoordinator()` 是每个运行上下文唯一的命令协调入口；命令创建复用事件重投校验确认 Runtime／Event ID／type／payload，每个源事件只允许一条不可变命令，同内容重复取得沿用原 Command ID。目标模块通过不可伪造 command capability 校验 runtime 与 target，复制或篡改命令不能创建关联。

各目标模块独立持有接收状态：首次接收按 Command ID 查重，新命令先检查容量，再从运行实例级 Transaction 序列分配编号，并在一个组合存储值中同时保存 Accepted receipt、`intent-created` intent 与 Runtime／Event／Command／Transaction 四套关联。外部查询与快照只投影完整组合记录；重复交付返回原 intent 与 Transaction ID。Accepted 不代表事务启动或成功，业务执行次数固定为 `0`。

实测成功接收为一份 receipt、一份 intent 和事务 `1`；重复接收仍为事务 `1`。四个故障点 `transaction-id-allocated`、`receipt-prepared`、`before-atomic-commit`、`after-atomic-commit` 均整体回滚，分别消耗事务 `2–5`；同一命令重试使用事务 `6`，空洞未复用。回滚故障使目标模块进入 `blocked`，查询、快照和后续接收不冒报 Accepted。容量满时拒绝且事务号不前进；Command／Transaction 达到 `Number.MAX_SAFE_INTEGER` 后明确耗尽，不回绕。Event 安全退役后目标仍返回原 Command／Transaction 关联。

D01–D06 全部 PASS。原 81 项语义保留，`npm.cmd test` 为 `87/87` PASS，类型检查、Electron Main 编译和 `npm.cmd run electron:build` PASS。基线 `6038571c07a7acd993776b3d9c55e2c5d48a6c8f`；`src/core/events.ts`、`src/core/commands.ts`、`tests/commands.test.mjs` SHA-256 分别为 `46D82DBBBD2E49A780974B63906FACD57AA04865781E8AC5F8A6374B5D157E0B`、`A69AB5485E8B11FF7E8954B4505341B518EF3D745393DA3D28101FDF7B8FF3D4`、`7D1D6893F7A2617FCA214CA2277ED0E7EA9639AAA92325917106EE5CD0211A98`。三份既有事件测试哈希保持不变；生产 ASAR 与 EXE 仍分别为 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`、`BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`。

Chrome Web／Electron 开发版／独立包业务链、Edge、四类交付结果联调、Unknown 核查、真实事务执行、结果事件、检查点、存档和正式任务均为 NOT RUN。命令模块未进入宿主入口，ASAR／EXE 一致不构成 GUI 事件业务运行通过。当前等待 Work 审查，不进入后续任务，不 Commit／Push／发布。

### 2026-11-13 D09-A2 Work 审查

Work 按 `b6cf8eb` 阅读阶段入口、单轮固定批次、逐事件状态转换、原事件重投校验、Accepted 接收测试替身和异常阻断，核对源码／两份事件测试哈希均与交付报告一致。审查开始时工作区干净；本轮重跑类型检查、Electron Main 编译及 75/75 测试 PASS，未重跑生产构建或 GUI。事件模块尚未接宿主，ASAR 仍为 D08 同版，不构成事件三端端到端证据。

当前阶段排序、单一 coordination 阶段、测试命令引用与异常保留均是注明的工程实现，不确认真实命令接收、完整异常恢复或检查点仲裁已实现。D09-A2 当前范围收口；未确认事件不能清理，historyCapacity 到限拒绝是有效保护。下一段 D09-A3 在显式确认与安全退役前提下释放完整记录，同时保留旧 ID 防重和资源上限。

### D09-A3 任务卡：生产者确认与连续安全退役

- 目标：为现有事件内核完成“返回最终协调处理结果 → 生产者明确确认不再提交 → 检查安全条件 → 清理完整记录 → 永久拒绝旧 ID”的核心闭环，使容量可安全回收。继续纯核心与模块集成，不改当前可玩灰盒或接入真实业务。
- 依据：Lifecycle-based Deduplication Record Management、Producer Acknowledgement、Retirement Watermark、Atomic ID Allocation and Registration、Event ID + Idempotent Processing、Runtime-scoped Event ID Generator。已有 Pending／Processing／Completed、固定阶段单轮和原子创建不变；不把示例 Retryable／Rejected 等直接扩为本段正式状态枚举。
- 生产者边界：创建事件时能够识别其所属生产者，提供最小受控的结果读取／通知及确认接口；关联身份由协调器验证，不允许其他生产者、其他 runtime 或只持一个数字 ID 的调用替其确认。具体 producer 句柄等属于工程实现，不复用 Pause Owner、Pause Token 或业务 ID，不新增全局身份服务。更新测试构造接缝时保留原有行为验证。
- 最终处理结果：本段只覆盖已实现的 Completed 成功分支。结果明确表达“协调处理完成／测试命令交付被接受”，不是业务事务成功或独立 Transaction Result Event。生产者应先获得该最终处理结果，再显式确认该事件不再提交并释放本地引用；不能因分发返回、读过状态、出队、时间经过或 Completed 自动确认。
- 安全条件：终态结果已提供给正确生产者、显式确认已收到、事件不在 Inbox／当前处理集合／活动处理流程中，且无未解决的重试或交付不确定性，才允许安全退役。Pending、Processing、被阻断的异常事件及尚未确认的 Completed 必须保留。不通过强行改状态、默认确认、超时确认或生产者销毁来绕过缺口；其他失败／重试生命周期待后续接入。
- 确认与清理分开：确认只登记生产者承诺，不立即抹去全部防重信息。通过明确的安全清理入口／边界执行退役，不能在 handler 运行途中删掉当前轮仍引用的记录；重复确认／重复退役幂等，错误身份或无效请求不修改其他记录。未取得最终结果、尚未满足条件时拒绝确认或清理，返回可检查结果。
- 水位线：维护从最早有效 Event ID 起连续安全退役的最高 ID，只前进不回退。不能用最大已分配／已完成／已确认 ID 代替水位线，也不能越过 Pending、Processing、未确认或其他不安全缺口；候选创建失败的未提交编号不算正式分配或退役事件。
- 缺口轻量记录：水位线以上已经安全退役、但前面仍有缺口的 ID 保留轻量记录；缺口补齐后连续推进并合并／移除已被水位线覆盖的轻量记录。旧 ID 无论低于水位线还是位于缺口以上的已退役集合，重提交均直接拒绝，不重新登记、不入队、不执行 handler。未知未分配 ID 和其他 runtime 同号 ID 也不能被当成可接受事件。
- 原始身份与容量：回收完整生命周期／指纹／结果数据不重置 Event ID 生成器，不复用正式分配过的 ID。水位线与有效起点的工程初值要说明，并覆盖现有 initialNextEventId 的边界测试；不得把未存在的有效事件伪称已经完成。释放完整记录后可继续创建更大 ID，但不能因轻量记录不占 historyCapacity 就无限累积缺口记录；把完整记录和缺口防重信息纳入明确资源预算或采用同等有效准入限制，满时拒绝新建且不消耗 ID，不能删除不安全缺口换容量。
- 数据职责：生命周期登记模块管理完整记录，独立退役信息管理水位线与轻量记录，协调器组织确认和清理，不任意写其他模块内部状态；不强制每项各建一个类。快照保持只读，结果／生产者关联不可被外部篡改。
- 失败保守性：清理失败或完整性无法确认时保留原记录或有效退役防重信息并明确报错，不能出现“完整记录没了、旧 ID 又可执行”的窗口。用必要的故障接缝验证，不新增通用事务框架；不因清理出错自动重开 Completed、重发命令或重跑业务。
- C01：Completed 结果只向正确生产者提供，显式确认与本地引用释放可演示；未确认不清理。重复确认无额外副作用，错误 producer／runtime／未知 ID 均不污染状态。
- C02：Pending、Processing、异常阻断以及未得到最终结果／未确认记录不能退役；handler 内确认／清理不会破坏当前轮，既有单轮延后和防重继续成立。
- C03：按 3、2、1 等乱序完成安全退役，验证轻量记录与水位线演变；存在低位缺口时水位线不跳过，补齐后一次连续推进，旧 ID 始终拒绝。把高位事件安全退役与单纯高位 Completed／确认区分测试。
- C04：已退役原事件重投、伪造不同载荷的旧 ID、水位线以上轻量退役 ID 重投都不执行；清理后新事件编号继续增加，runtime 隔离，原创建回滚和重复分发保护保持。
- C05：小容量下多轮“创建→分发→结果→确认→退役”可重复进行，完整记录不会无限增长；长期低位缺口加大量高位事件不会让轻量记录无限增长，达到预算保守拒绝，填补安全缺口后恢复可用容量，不丢未确认事件。
- C06：清理故障、重复清理、非默认起始 Event ID 和安全整数边界有意义覆盖；水位线推进不因 MAX_SAFE_INTEGER 的加法回绕或巨量空洞扫描失控。失败不改变业务进度、运行 UUID、生成序列或既有 Completed 执行次数。
- 验证：保留原 75 项测试的有效语义，补充 C01–C06 核心／模块集成和必要失败路径，执行类型检查、`npm.cmd test`、适用 Web／Electron 构建、`git diff --check`。此段仍未接宿主，GUI／三端业务事件端到端明确 NOT RUN，不要求重跑物理长套件；Accepted 仍仅测试替身，不冒称真实命令／事务完成。
- 交付与停止：在 README、路线图、项目概述记录实际 API 边界与工程资源策略，提供乱序退役前后快照、执行计数、拒绝结果及版本证据；不复制完整正式规则或新增大型设计文档。不实现宿主生命周期迁移、正式命令接收／事务、Unknown 核查、检查点、存档、任务或新玩法。无新依赖、正式决策变更或用户产品决策，不删除文件、不关闭体验窗口、不 Commit／Push／发布。两轮有效修复仍失败或架构冲突提交最小复现交 Work，完成后停止等审查。

### 2026-11-13 D09-A3 执行结果

`EventCreationCoordinator.createProducer()` 生成协调器私有句柄，`create(request, producer)` 将 Event ID 与该生产者绑定。`readFinalResult()` 只向正确生产者返回 Completed 测试命令交付结果 capability；`acknowledge()` 登记生产者不再提交的承诺；`retire()` 仅在结果已读、已确认、事件不在 Inbox 且没有活动分发轮次时执行。错误 producer／runtime、伪造句柄或结果 capability、Pending／Processing、未确认及 handler 内退役均拒绝。确认和退役分别幂等，确认本身不删除完整记录；完整记录退役后，生产者仍持原 capability 的重复确认仍返回 already-acknowledged。

独立退役账本从 `initialNextEventId - 1` 开始维护连续水位线和其上的轻量缺口 ID。实测按 3→2→1 退役：完成并确认后水位线 `0`、轻量 `[]`；先退役 3 后水位线 `0`、轻量 `[3]`；再退役 2 后水位线 `0`、轻量 `[2,3]`；最后退役 1 后水位线 `3`、轻量 `[]`、下一 Event ID `4`。容量 `1` 连续三轮退役后，水位线 `3`、完整／轻量记录均为 `0`、下一 Event ID `4`。

`historyCapacity` 同时限制完整记录与缺口轻量记录。低位缺口加高位退役记录达到总预算时，新建被拒绝且编号不推进；补齐缺口后轻量集合一次合并并恢复创建。创建回滚不足一个 ID 的情况不作为退役缺口。三个清理故障接缝验证保守失败：删除前失败保留完整记录和可防重状态，删除后故障保留已提交的退役记录，旧 ID 始终拒绝；重复退役幂等，不重跑 handler、不改变运行 UUID 或编号。非默认起点 `100` 与 `Number.MAX_SAFE_INTEGER` 边界通过，无加法回绕或编号复用。

C01–C06 全部 PASS。原 75 项语义保留，`npm.cmd test` 为 `81/81` PASS，类型检查、Electron Main 编译和 `npm.cmd run electron:build` PASS。基线 `b6cf8eb36ddf57b474a885a14e0ff485e6da54c2`；`src/core/events.ts`、`tests/events.test.mjs`、`tests/events-dispatch.test.mjs`、`tests/events-retirement.test.mjs` SHA-256 分别为 `E28021C12B87E2B558DEECEF0F8743E5F87D1E11CE809E37869DF75BCE39FE1E`、`FD09A57F7ED2DA9C5D7BC8E98482B8DE7715293F738360358BAF5A14DC16584D`、`4CA6511E11F6AADBCF477437F85BB926F918CC588BB55803418ED572E77ECE7C`、`7DA7E2958CC580E78092FE4194711450B9241CA552C71F8B14044416B8043252`。事件模块未进入宿主入口，生产 ASAR 与 EXE 仍分别为 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`、`BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`。

Chrome Web／Electron 开发版／独立包业务事件运行、Edge、真实命令接收、事务、结果事件、检查点与存档均为 NOT RUN；测试命令接收替身不升级为正式事务设计。当前等待 Work 审查，不进入后续任务，不 Commit／Push／发布。

### 2026-11-13 D09-A1 Work 审查

Work 阅读 `events.ts`、原子创建／故障注入测试和现有正式事件边界。当前基线为 `3f27478`，工作区已干净；本轮未操作 Git 暂存、提交或推送。源码与测试 SHA-256 分别为 `10B426F6BB8A660F4996EC3FBC5904FF1E74390D0359E6CD2905F1BC20683D2E`、`E5B642ACA370D8B1BFAA93ED13F04A0FA6E5D3AA12FFA615A8F1F98B19A351DD`，与交付报告一致，ASAR 仍为 D08 同版。Work 重跑类型检查、Electron Main 编译及 66/66 测试 PASS；本轮未重跑生产构建或 GUI。D09-A1 在纯核心创建范围收口，不等于宿主运行、事件分发或业务事务已实现。

当前原子内核采用同步提交和测试故障接缝；下一段必须继续保证创建失败不产生半记录、分发不读取半提交事件。工程类名、容量、安全整数与 UUID 注入方式均非新的正式技术决策。原 D08 进度／交互运行保持原状，允许 D09-A2。

### D09-A2 任务卡：固定阶段单轮分发与事件防重

- 目标：在现有原子创建内核上补齐一次明确协调阶段的分发，验证固定集合、逐事件状态转换及 Event ID 防重。仍为纯核心与模块集成，不改当前 Web／Electron 宿主或 D08 玩法，不一次实现完整事件事务协议。
- 依据：Phase-based Event Dispatch、Single-pass Event Dispatch、Transition Before Dispatch、Event ID + Idempotent Processing、Pending as Initial State、Event-Transaction Lifecycle Separation、Command Handoff = Event Completion、Independent State Modules。保留 D09-A1 原子创建与生成职责；具体阶段接口和内部结果表示属于可调整工程实现，不修改 CONFIRMED。
- 模块范围：增量扩展现有协调器、生命周期登记和 Inbox 的受控接口；必要时增加小型分发实现，不另建全局总线或重复 Coordinator。核心无 DOM／Node／Electron／Phaser 依赖，不让调用方任意改登记状态；已返回事件的创建时 Pending 信息不能被误用为当前状态，当前状态由生命周期登记负责。
- 阶段入口：由调用方显式提供实际模拟步与协调阶段上下文，创建／普通读取不会触发分发；本段通过模拟调用验证阶段边界，不声称已接 Simulation Runtime。阶段顺序采用清楚记录的最小原型规则，同一阶段重复／倒退调用不得变相新增一轮。不得把渲染帧数、Event ID 或墙上时间当 SimulationTick。
- 单轮规则：阶段开始时固定本轮事件集合，先按资格判定选择，未选中的事件继续 Pending；不能收到一个事件立即处理。对每个即将执行的事件检查当前身份／生命周期，成功从 Pending 转 Processing 后才调用处理逻辑，不在轮开始时批量转 Processing。
- 后生事件与递归：本轮处理期间，处理逻辑可通过唯一创建入口生成新事件，但只进入待处理 Inbox；本轮集合不可追加。新事件等待下一次符合条件阶段，不允许递归调用处理器或在同一阶段内循环 drain 到空。递归分发请求明确拒绝且不破坏外层上下文；创建仍遵守原子提交、编号唯一和容量规则。
- 防重：提供必要的受控原事件重投／重复分发测试路径，验证相同 Event ID 只执行一次。必须校验原运行上下文和登记身份，不能拿另一个运行实例的相同数字 ID 冒充，也不能用相同 ID 携带修改后的载荷执行。不能因 Inbox 条目已移出就遗忘 Processing／Completed 记录；未知事件不自动注册为新事件，新的真实逻辑事件须通过创建入口获得新 ID。
- 成功分支与测试替身：本段可用显式注入的同步测试接收端模拟一条占位命令的 Accepted 交付，以验证原事件进入 Completed；占位命令身份与 Event ID 独立，并明确不是已实现真实 Command ID Generator／事务管理。不能把普通 handler 返回、无命令分支、单纯出队或真实业务执行完成当成 Accepted。没有交付确认不得标 Completed，也不增加 Dispatched。Completed 不意味着事务成功、不释放事务锁、不清理记录。
- 异常边界：资格／状态转换失败时不运行 handler；执行中抛错或交付不确定时，不假报 Completed、不自动重投或重新编号。保留事件、已知状态与内部异常信息，以可检查的阻断结果停止有风险的后续分发；未处理项保留，不丢弃整个轮次。后续 Retryable／Rejected／Unknown 核查与重试的正式接收协议仍未接入，不能在本段偷偷定义全套异常终态或实现盲目重试。
- 资源与保留：Pending、Processing 和未满足确认／清理条件的记录均保留，不按年龄、轮次或 Completed 自动删除。尚未实现生产者确认及水位线时，设置明确的工程准入上限／拒绝策略使内核不会因分发腾出 Inbox 就无限增长完整历史；达到上限拒绝新建，不破坏原子创建或改为静默清理。后续再实现安全退役，不提前宣称该能力。
- B01：创建后仍 Pending，只有调用合法协调阶段才处理；handler 内可观察自身 Processing，尚未轮到的其他事件仍 Pending。非法阶段／不满足资格／状态转换失败不产生业务副作用。
- B02：事件 A 的处理创建事件 B，第一轮只执行 A，B 保持 Pending；下一符合条件阶段才执行 B。递归分发和重复阶段调用均不导致 B 当轮执行或 A 重复执行，多个后生事件也不能突破固定集合。
- B03：同一已登记事件重复重投、Processing／Completed 后重投及伪造其他 runtime 相同数字 ID 都不能重复处理；载荷篡改被拒绝。真实新事件继续使用不同 ID，不能把防重当成状态合法性检查的替代。
- B04：测试接收端明确 Accepted 后才完成原事件；回调结束本身不算成功交付。异常／未知交付保留现场、不自动重试、不影响先前完成事件，不丢未处理项。此 PASS 仅证明替身合同分支，不是命令事务端到端验收。
- B05：分发期间创建失败、队列／记录上限、只读快照、原子回滚与不同生产者编号规则保持一致；完成事件仍保留必要记录，准入限制避免无界增长。保留 D09-A1 的全部有意义原子测试。
- 验证：保留原 66 项测试的有效语义并新增 B01–B05 核心／模块集成测试，执行类型检查、`npm.cmd test`、适用 Web／Electron 构建和 `git diff --check`。原 A05 对“创建不自动处理”的断言继续成立，若测试名字或仅反映上一段未实现 API 的存在性断言需要更新，注明原因，不能削弱创建边界。
- 报告：提供阶段前／中／后快照、执行计数、新事件延后和异常保留证据，标明测试替身；本段不接宿主，因此 GUI／三端业务事件端到端为 NOT RUN，不用旧 D08 截图冒充。README、路线图和项目概述只记录实际实现与工程边界，不新增大型协议文档或复制所有规则。
- 不做与停止：不迁移当前 D08 接线、不实现正式检查点进入批次／优先级仲裁、全局捕获锁、Command／Transaction 生成器、命令接收／事务意图、结果事件、生产者确认／水位线清理、存档或新玩法。不能以测试阶段排序替代检查点唯一优先级仲裁。无新增依赖、正式设计变更或用户产品决策，不删除文件、不关闭用户体验窗口、不 Commit／Push／发布。两轮有效修复仍失败或架构冲突时整理最小复现交 Work，完成后停止等审查。

### 2026-11-13 D09-A2 执行结果

`EventCreationCoordinator` 现提供显式 `dispatch({ runtimeInstanceId, simulationTick, phase: 'coordination' })`。合法阶段启动时固定 Inbox 事件数组；每个事件在实际调用 handler 前独立从 Pending 转 Processing，handler 正常结束且明确注入的测试接收替身返回 Accepted 后才转 Completed。handler 创建的新事件只进入 Inbox，递归分发返回 `recursive-dispatch`，重复／倒退 Tick 返回 `phase-order`。

`probeRedelivery()` 按 Event ID、Runtime Instance UUID、type、payload 与保留生命周期校验重复投递；其他 runtime、篡改载荷和未知事件不再入队或执行。handler、状态转换或测试接收失败时，事件保留可检查状态，协调器记录 `dispatchFailure` 并阻断后续分发，不自动重试。Pending／Processing／Completed 记录不自动删除；有限 `historyCapacity` 默认原型值为 `1024`，达到上限拒绝新建且不消耗 Event ID。

B01–B05 均有核心／模块集成测试 PASS。原 A01–A05 保留，其中 A05 只把已过时的“不存在 dispatch API”断言改为“创建不自动分发”，创建边界未被削弱。Accepted → Completed 仅由测试替身合同验证，不是真实 Command ID、命令接收、Transaction 或结果事件。

`npm.cmd test` 为 75/75 PASS，类型检查与 Electron Main 编译 PASS；`npm.cmd run electron:build` PASS。`src/core/events.ts`、`tests/events.test.mjs`、`tests/events-dispatch.test.mjs` SHA-256 分别为 `0703A235ADCB59C407795C1207D3EE478D3DED7A6EB5C55F648C695AB93AC500`、`C356663B184A7CAFF42A8E4177C9CB687D963C5AFFDE205E865995F05B809B6C`、`4CA6511E11F6AADBCF477437F85BB926F918CC588BB55803418ED572E77ECE7C`。事件模块未进入当前宿主入口，生产 ASAR 与 EXE 仍分别为 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`、`BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`。

Chrome Web／Electron 开发版／独立包业务事件运行、Edge、真实命令事务、结果事件、生产者确认／水位线清理、检查点与存档均为 NOT RUN。当前等待 Work 审查，不进入 D09 后续任务。

### 2026-11-13 D08 Work 审查

Work 保留 `92cc389` 上全部 D07／D08 等未提交修改。阅读进度模块、交互接线、临时世界重置／永久效果重协调及新增测试；`run-nlbzAQ` 三端 PASS，全部版本条目与当前文件匹配，三端退出码 0、清理失败为 0。本轮重跑类型检查、Electron Main 编译及 59/59 自动化测试 PASS，未重跑 GUI 或生产构建。永久记录与临时 reset 分离，同一仓库注入新世界后仍可应用效果，符合当前任务范围。

补充范围核对：`run-xHiVwG` 的 D07 回归仅 Web PASS，Electron 开发／独立包均为 NOT RUN，不能表述为 D07 最新三端回归通过；D08 自身三端定向证据有效。现有整页重载会重新创建仓库是已说明的原型限制，不视为正式运行实例身份生命周期已实现，后续接入须遵守场景切换不重置运行身份的规则。D08 当前范围收口，允许 D09-A1；历史 FAIL、人工 BLOCKED、Edge 未测、完整业务恢复和最终 Matter 选型未完成状态不变。

### D09-A1 任务卡：统一事件创建与原子入队

- 目标：交付可测试的事件创建内核：协调器统一组织候选 ID、Pending 生命周期记录和 Inbox 入队，三者整体提交成功后才对外可见；失败不消耗正式 Event ID、不留下孤立事件。D09 先做这条明确的基础边界，下一段再接入固定阶段分发和实际业务，不一次建全套框架。
- 正式依据：`DECISIONS.md` 的 Runtime Instance Identity、UUID-based Runtime Instance ID Generation、Centralized／Monotonic／Runtime-scoped Event ID Generator、Coordinator-owned Event Creation Entry、Coordinator Auto-Enqueue、Atomic ID Allocation and Registration、All-or-Nothing Atomic Registration、Atomic Create-Register-Enqueue Commit、Pending as Initial State、Independent State Modules。具体接口、容器和 UUID 工程细节由实施者合理选择并注明原型，不自动升级正式决策。
- 实施范围：共享核心中的小型运行上下文、Event ID 生成机制、生命周期登记和协调器 Inbox 创建流程；逻辑职责独立，不强制拆成多个类或文件，不新增 Event Creation Service、第三方消息系统或全局总线。不改玩家／物理／交互／暂停行为，也不把正式检查点仲裁提前塞入创建流程。
- 运行身份：上下文持有独立 Runtime Instance ID（UUID）及一套共享 Event ID 序列，生产者通过协调器请求创建，不能自行编号。UUID 生成能力通过注入的平台无关接口提供，核心不依赖 DOM、Node 或 Electron；可在测试组合层用真实 UUID 实现验证，不必为本任务新增依赖。不同临时生产者／场景对象共享同一上下文时，UUID 与序列不重置；只有明确销毁并创建新运行上下文才产生新 UUID 和新序列。
- 接入边界：本任务先交付纯核心模块与模块间集成测试，不替换当前 Web 挂载、场景整页重载或 D08 原型调用，不冒称正式运行身份已贯穿全部场景。不得通过 sessionStorage／localStorage 保号来掩盖生命周期差异；后续宿主接入需显式处理场景重载问题。当前 UUID 上下文不管理 Command ID／Transaction ID 或永久内容 ID。
- ID 规则：新逻辑事件使用该上下文统一的单调递增整数；不以墙上时间、随机数或 UUID 生成 Event ID。候选 ID 是内部数据，未提交不视为分配；序列仅整体成功后推进，不把 Transaction ID 的允许空洞规则套到 Event ID。安全整数／溢出边界选择可验证的工程策略，无法安全分配时明确拒绝，不回绕／复用已分配 ID。
- 原子规则：协调器校验创建请求，准备候选、初始记录和 Inbox 写入，保证提交前其他模块／生产者观察不到部分成功。任一步失败则回滚未完成写入，不返回正式事件，不推进序列。无法确认回滚完整时，阻止后续分配并提供可检查的内部错误，不擅自触发检查点 RecoveryError、解除控制锁或自动重建。
- 登记与队列：正式事件具有独立 Event ID、Runtime Instance ID 和必要的类型／载荷，初始状态唯一为 Pending；不引入 Registered 中间正式状态。成功后自动入 Inbox，生产者不再二次提交；创建不运行 handler、不推进 Tick、不修改进度，也不进入 Processing。调用者获得的事件／只读视图不能改写内核状态。校验空／不支持的测试类型与不合法载荷，拒绝时保持整体不变。
- 重复与资源边界：本段以每次创建新逻辑事件为入口，不额外暴露可绕过协调器的分配／登记／提交入口。若为测试提供同一事件重投路径，必须沿用原 ID 并防止重复 Pending 入队，不得重建新身份。采用有限的原型容量或显式拒绝策略验证队列满时的全有或全无，不无限累积演示事件；不按年龄删除 Pending／未确认事件，不提前实现退役清理。
- A01：同一上下文多个生产者交替创建事件，Event ID 严格递增、唯一，UUID 相同；重建临时对象后继续编号，新上下文身份独立。不可把这些测试当成实际游戏场景生命周期已接入。
- A02：创建成功同时存在一个正式 Pending 记录和一个 Inbox 条目，返回值与登记身份一致；自动入队只发生一次，创建期间没有 handler／业务副作用或 Tick 推进，外部快照无法修改内部记录。
- A03：校验、候选准备、登记准备、入队准备／提交等故障点用必要的可控测试注入验证，失败无正式 ID 消耗、无半记录或孤立 Inbox；恢复后下一次成功仍使用正确编号。不能只测最早的参数校验失败就声称覆盖完整原子流程。
- A04：队列容量耗尽、非法请求及编号边界均明确拒绝且状态一致；可证明回滚完整时能继续正确创建。模拟回滚完整性无法确认时，后续创建被阻止，错误可检查且不假报成功。
- A05：正式事件始终从 Pending 开始；生成器、生命周期登记、协调器职责未混用，未实现部分如 Processing、Completed、Producer Acknowledgement、水位线、命令／事务和检查点明确 NOT RUN，而非把假处理器算真实业务通过。
- 测试方式：保留既有 59 项并新增核心行为／故障路径及跨模块集成测试；执行类型检查、`npm.cmd test`、适用 Web／Electron 构建和 `git diff --check`。本段没有真实玩法接入，不强制重跑 GUI 长套件，三端运行验证可明确 NOT RUN；若意外修改宿主或输入等运行路径则须补受影响验证，不用旧三端报告声称新模块已端到端运行。
- 验收与文档：提供新增／修改文件、测试命令与结果、故障注入前后内核快照、版本对应及剩余边界；说明 UUID 提供方式和运行上下文仅完成核心层。README／路线图／项目概述只记实际实现，不把数据类型、接口或工程选择写进 CONFIRMED；不新增大型协议文档或重复完整正式规则。
- 停止范围：不实现固定阶段分发、生命周期终态／重试／确认清理、退役水位线、Command／Transaction ID、事务意图、结果反馈、检查点、存档、正式任务或新玩法；不迁移现有 D08 接线，不更改正式决策／技术选型，不新增依赖、不删除文件、不关闭用户体验窗口、不 Commit／Push／发布。两轮有效修复仍失败或架构冲突时提交最小复现交 Work。完成后停止等审查，后续再安排 D09 的事件分发段。

### 2026-11-13 D09-A1 执行结果

D09-A1 已按任务卡完成纯核心实现，等待 Work 审查。新增 `src/core/events.ts`，以 `RuntimeEventContext` 持有注入式 UUID 和共享单调序列，并限制一个上下文只创建一个协调器；`EventCreationCoordinator.create()` 统一组织候选 Event ID、Pending 生命周期记录及有限 Inbox。生成器、生命周期登记和队列状态保持独立，没有导出可绕过协调器的分配或提交入口。

成功提交结果为同一冻结事件、一个 Pending 生命周期记录和一个 Inbox 条目，同时把序列推进到下一候选。类型／载荷校验、候选准备、登记准备、Inbox 容量、三个提交点及回滚均有测试接缝。可确认失败完整恢复编号与两条记录；回滚无法确认时内核进入阻断状态并通过 `rollback-unconfirmed` 快照错误阻止后续创建。最大安全整数使用后明确拒绝，不回绕。

| 检查 | 状态 | 证据 |
| --- | --- | --- |
| A01 运行身份与编号 | PASS | 同一上下文多个生产者交替创建 `1、2、3`，UUID 不变；新上下文重新从 `1` 开始并使用不同 UUID。 |
| A02 Pending／Inbox 原子可见 | PASS | 成功快照同时包含一条 Pending 记录和一个队列项；事件、载荷和快照冻结，创建不处理、不推进 Tick。 |
| A03 故障回滚 | PASS | 七个准备／提交故障点均无记录、无队列项、无编号消耗；恢复后的下一次成功复用正确编号。回滚故障阻断后续创建。 |
| A04 容量和边界 | PASS | Inbox 满、空／不支持类型、非法载荷与 Event ID 耗尽均明确拒绝，状态保持一致。 |
| A05 职责与未实现边界 | PASS | 生成器、登记和协调器职责分离；事件只从 Pending 开始。Processing、Completed、确认、水位线、分发、命令／事务及检查点均为 NOT RUN。 |
| `npm.cmd test` | PASS | 类型检查、Electron Main 编译及 `66/66` 测试 PASS，原 59 项全部保留。 |
| `npm.cmd run electron:build` | PASS | Web 生产构建、Electron Main 编译及 Windows x64 免安装目录构建 PASS。 |
| GUI／三端事件运行 | NOT RUN | 模块未接入当前 Web／Electron 入口，不以旧 D08 三端报告替代。 |
| `git diff --check` | PASS | 无空白错误，仅有既有 LF／CRLF 提示。 |

当前 `src/core/events.ts` SHA-256 为 `10B426F6BB8A660F4996EC3FBC5904FF1E74390D0359E6CD2905F1BC20683D2E`，`tests/events.test.mjs` 为 `E5B642ACA370D8B1BFAA93ED13F04A0FA6E5D3AA12FFA615A8F1F98B19A351DD`。生产 ASAR 仍为 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`，说明未接入运行包的 D09-A1 新模块未改变宿主事件处理。Matter 仍为候选；当前等待 Work 审查，不进入 D09 后续分段，不 Commit／Push／发布。

### 2026-11-13 D07-R1 Work 复审

Work 保留 `92cc389` 上全部未提交修改。核对 `InteractionController` 的提示资格与 reset 松键门槛修复、输入适配诊断刷新及 R01／R02 回归测试；`run-LTvqUU` 三端 PASS，全部报告版本条目与当前文件匹配，三个测试进程退出码 0，清理失败为 0。本轮重新执行类型检查、Electron Main 编译及 52/52 自动化测试 PASS，未重跑 GUI 或生产构建。可见但未聚焦时保持不可用符合既有控制规则，测试等待真实焦点恢复的修正合理。

D07-R1 两项缺口关闭，结合 D07 主体证据，D07 按当前原型范围收口，允许 D08。修复前 FAIL、`run-PkdgnR`、独立人工 BLOCKED 和 Edge NOT RUN 保留；本结论不扩展为完整任务、永久进度、事件事务或检查点已实现，也不确认 Matter 最终方案。

### D08 任务卡：运行内永久进度与幂等应用原型

- 目标：用少量明确标识的测试内容，交付“获得测试收藏／完成测试目标 → 奖励只记一次 → 永久世界效果生效 → 重置临时世界后仍可重建效果”的可见闭环。这里的永久指与临时世界重置分离的运行内记录，不等于跨会话磁盘存档。
- 依据：`QUEST_SYSTEM_DESIGN.md`“收藏品、任务目标、奖励与永久效果的唯一 ID 和幂等规则”，`PLAYER_CONTROL_DESIGN.md`“永久记录唯一 ID 与幂等恢复”，以及 `DECISIONS.md` 中永久进度与临时世界分离的有效 CONFIRMED 决策。字段、容器、UI 和测试 ID 配置是工程原型，不将现有 PROPOSED 数据分类自动升级为正式结构。
- 最小模块：共享核心新增一个小型内存进度模块，管理收藏、已完成目标、已领取奖励、永久效果四类独立业务身份和记录；运行入口持有记录，临时世界／交互展示只通过受控接口读取、登记及重新协调。不得由 Renderer 直接修改内部集合，输出可供显示的只读快照／副本，不引入通用数据库、存档框架或另一个游戏核心。
- 身份规则：为测试内容配置稳定 ID，各业务类型独立且通过显式关系关联，不能用对象地址、位置、渲染顺序或当前时间当业务身份，也不复用 Event／Command／Transaction ID。稳定配置在临时对象重建后仍指向同一内容；无效或未知测试内容请求须明确拒绝且不污染记录。相同 ID 重复申请返回未新增／已存在等明确工程结果，不重复计入数量。
- 测试内容与体验：保留 D07 A／B／C 原语义，在不干扰既有走跳路线处增加少量 D08 测试对象，复用主动 E 交互入口。一项用于收藏，一项用于完成测试目标并登记关联的测试奖励／永久效果；可用小型测试挡板或明确的路线开放标志显示效果，须有对应世界逻辑状态，不只改一行文字。内容标明测试，无正式文化资产、真实奖励、主线任务或新谜题。
- 奖励与效果：相同收藏／目标／奖励的成功新增次数最多一次；重复交互不能增加第二份测试奖励。永久效果采用设定期望状态（如 open=true），不能使用 toggle；重复协调不关闭路线或重复发奖。世界对象销毁重建或临时状态回到初始关闭后，即使效果 ID 已在永久记录中，也必须能重新应用该效果，不能将“已记录”误当“永远不用再同步世界”。
- 临时状态：玩家位置／速度、交互面板、反馈计时、平台瞬时位置及区域占用按原规则重置；R 不清除本次运行的永久记录，重置后先建立临时初始状态，再重新协调永久效果并刷新表现。奖励计数属于永久记录，交互操作次数仍为临时诊断，两者分别展示，不能用清空诊断冒充重新发奖。这里是调试重置验证，不是检查点快照恢复。
- 生命周期边界：至少在同一个进度实例下完成临时对象重建并验证保留，进度仓库不能跟着每个世界对象的 reset 重建。浏览器刷新、整页重载、应用退出后保留不属于本次承诺；如现有场景切换采用整页重载，明确该限制，不用 localStorage／sessionStorage 偷补存档，也不借此擅自确认正式 Runtime Instance 生命周期。新增运行或测试 fixture 可用全新空仓库，不能静默清除现有运行记录。
- 暂停与隔离：隐藏／最小化、焦点变化、调查关闭不能修改进度、重复申请奖励或重放操作；沿用 D07-R1 的提示资格和松键门槛。进度模块无 DOM／Node／Electron／Phaser 依赖，平台适配层不接管奖励或业务记录。
- 后续协议边界：D08 只验证数据与效果语义。以清楚标识的原型接线连接测试交互，不实现 Event Inbox、命令／事务 ID、跨多项业务写入的事务保证或完整任务状态机；这些仍按 D09 分阶段接入。测试内容引用先做必要校验，不能把当前同步原型宣称为正式命令交付／事务实现，后续生产业务不得绕过正式协议。
- P01：初始记录为空；四类 ID 独立，登记与只读查询正确，重复同类 ID 不增加数量，非法请求不产生记录。
- P02：通过真实主动交互获得测试收藏，重复按键、离开再进入、临时对象重建后再次尝试都不重复获得；展示正确状态。
- P03：完成测试目标与领取测试奖励多次，目标／奖励均只记录一次；重同步世界效果不会再次触发奖励发放。
- P04：永久效果首次生效、重复应用、临时世界重置／对象重建后再应用均得到同一逻辑与视觉状态，不出现 toggle、重复发奖或永久效果消失。若实现测试挡板，验证碰撞／路线状态与显示一致。
- P05：R 重置玩家、交互及平台等临时状态，永久记录保留；同一个仓库注入重建对象仍可重同步，新空 fixture 不继承其他测试状态。不把进度快照当成临时检查点快照。
- P06：真实隐藏／最小化至少 1200 ms 及恢复后，记录和奖励次数不变，未产生自动交互；保留原有 D07-R1、控制所有权、跳跃、平台与区域行为。
- 验证与证据：保留已有 52 项并增加有意义的进度／幂等单测和重建集成测试，执行类型检查、生产构建及 `git diff --check`。Chrome Web、Electron 开发版和仓库外独立包执行相同 D08 定向流程，记录四类 ID／记录数、奖励新增次数、永久效果逻辑状态、重置前后值、真实窗口状态、截图、源码／脚本／ASAR 哈希和清理结果。新增交互接线影响 D07 时补其定向回归；只在确有运动／输入风险时追加完整物理长套件，不无理由反复跑全部历史测试。
- 修改范围：核心进度模块、必要原型交互接线、灰盒世界效果与显示、适用测试；更新 README、路线图及项目概述。专项文档只补实际工程边界，不复制完整决策。数据结构、测试参数和命名由执行者自行选择，本任务无新增用户产品决策。
- 风险与停止：重点防止重复发奖、已记录效果无法重新应用、临时 reset 清空永久记录及 Renderer 越权。两轮有效修复仍失败或正式设计冲突时提交最小复现交 Work。不新增依赖、存储 API、正式任务／背包、检查点、完整事件事务、最终奖励内容或技术选型；不删除文件、不关闭用户体验窗口、不 Commit／Push／发布。完成后停止等 Work 审查，不进入 D09。

### 2026-11-13 D08 执行结果

D08 已按任务卡实现并完成当前原型范围验证，等待 Work 审查。新增 `src/core/progress.ts`，由共享灰盒核心持有 `InMemoryRunProgress`；收藏、目标、奖励和永久效果使用四个独立集合及只读快照。测试 ID 为 `collection.prototype.travel-token`、`goal.prototype.open-test-route`、`reward.prototype.open-test-route`、`effect.prototype.open-test-route`，目标到奖励／效果的关联显式配置，不接受对象地址、位置或时间作为身份。

灰盒在出生点右侧加入测试收藏 D（`x=420`、范围 `45×110`）和测试目标 E（`x=490`、范围 `45×110`），复用 D07 主动 E 入口，并保留 A／B／C 原语义。目标完成后，位于 `x=620,y=290` 的 `progress-test-route-gate` 从玩家碰撞 mask `0x0002` 切换为 `0`，视觉和诊断同步为 OPEN；效果使用 `expectedActive=true`，重复协调不会 toggle。R 先将玩家、交互、平台、区域与物理瞬时状态恢复初值，再由同一进度仓库重新应用效果，不重建或清空仓库。

| 检查 | 状态 | 证据 |
| --- | --- | --- |
| P01～P06 自动化 | PASS | `npm.cmd test`：类型检查、Electron Main 编译及 `59/59` 测试通过；新增 3 项纯进度测试和 4 项真实 Matter 集成测试，原 52 项保留。 |
| 生产构建 | PASS | `npm.cmd run electron:build` 成功生成 Windows x64 应用目录，Vite 18 modules。 |
| D08 三端定向 | PASS | [run-nlbzAQ](../test-results/platform/run-nlbzAQ/report.json)：Chrome Web、Electron 开发版、仓库外独立包均 PASS；页面错误、非预期中断、清理失败均为 `0`。 |
| D07 定向回归 | PASS | [run-xHiVwG](../test-results/platform/run-xHiVwG/report.json)：Chrome Web 的原 A／B／C、提示资格、松键门槛、控制锁与拾取反馈回归通过。 |
| 完整物理长套件 | NOT RUN | 未改玩家物理手感、固定步或暂停规则，按任务要求不无理由重跑。 |
| Edge | NOT RUN | 本轮仅用 Chrome 做三端自动化。 |
| 独立人工长按 | BLOCKED | Computer Use 仍不能可靠跨游戏帧持续按键。 |

三端 D08 均从空记录开始，完成测试内容后为收藏／目标／奖励／效果 `1/1/1/1`；R 后临时交互记录清零而四类运行内记录保留，测试门仍为 OPEN。隐藏或原生最小化超过 `1200 ms` 时记录与 E 消费数冻结，恢复首帧 Tick 分别为 Web `489`、Electron 开发版 `462`、独立包 `475`，没有后台时间追赶或自动重放；释放 E 后提示正常返回。

当前产物 ASAR SHA-256 为 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`，Windows EXE 为 `BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`；源码、脚本、截图和逐项结果见 [README D08](../README.md#d08运行内进度与幂等应用原型)。现有正常开发体验窗口 PID `30952`／HWND `13896118` 保留，D08 截图与启动信息见 [experience-launch.json](../test-results/d08-20261113/experience-launch.json)。D08 仍是页面运行内原型，不代表跨会话存档、正式任务／收藏册、奖励内容、业务事件事务或检查点已实现；Matter 仍为候选。等待 Work 审查，不进入 D09，不 Commit／Push／发布。

### 2026-11-13 D07 Work 审查与 D07-R1 任务卡

Work 保留当前 `92cc389` 上的全部未提交 D07 修改，阅读核心交互、输入适配及测试。`run-obVH8m` 与 `run-HAkFWZ` 三端 PASS，全部报告版本条目与当前文件匹配，每份有三端正常退出记录、无清理失败。本轮重跑 `npm.cmd test`：类型检查、Electron Main 编译及 50/50 测试 PASS；未另跑 GUI 或生产构建。调查锁定后沿既有减速曲线制动的测试修正符合当前控制模型，不要求修改物理手感。

但使用当前核心类的无文件写入 Node 复现发现两项缺口（不是 GUI 复测结果）：

1. 在范围内且没有打开调查时，外部控制来源锁定后 `controls.allowed=false`，`snapshot.prompt` 仍为 `E 调查 B`；`isPaused=true` 时亦然。Phaser 只按 prompt 是否非空显示，未将提示隐藏或标记为不可操作。与 D07 原任务“不可交互状态提示消失／禁用”不符。
2. `E down → 关闭调查（E 未释放）→ setAvailable(false) → reset → 恢复可用 → E down（无 keyup）`：重置前 `needsRelease=true`，重置后变成 false，并可再次进入 investigation。原因是 `reset()` 仅检查已清空的 held 集合，没有保留既存松键门槛。应与 PlayerMotor 的 reset 语义一样避免重置绕过门槛。此处验证的是核心防护语义，不宣称已观察到系统自动生成该按键序列。

上述测试 PASS 保留，不能推导未覆盖边界正确。D07 暂为 BLOCKED，仅安排下列局部修复，不重开设计或扩大到 D08。

- 目标／模块：修复 `src/core/interaction.ts` 的提示可用性和重置输入清理，必要时最小调整显示／诊断层；优先复用现有状态，不新建控制协调器或输入框架。
- R01：范围内 idle／feedback 时，外部控制阻塞、不可用或暂停期间不得显示可操作提示；允许直接隐藏，或显示明确不可操作状态且不误导玩家。恢复可交互后提示按实际候选恢复。保留活动调查面板和正常关闭行为，不以隐藏提示顺带结束调查或释放别人的控制请求。
- R02：reset 保留尚未解除的 E 松键要求；无论 held 是否已因失焦清空，都不能重置为可直接触发。观察到 E keyup 后才解除该门槛，正常新按下可触发一次。保持普通未持键重置可用、已有按住／repeat 防重及 PC-02 跳跃语义，不把修复做成永久禁用交互。
- 必要测试：新增先失败后通过的核心用例，覆盖 R01 的外部 owner／不可用／暂停及恢复，R02 的原始复现顺序和 keyup 后正常触发；保留已有 50 项，验证关闭调查／重置只释放自身限制，物理仍继续、正常拾取仍无长锁。不修改无关物理测试或放宽旧断言。
- 实际三端：复用 D07 定向入口，在 Chrome Web、Electron 开发版和仓库外独立包验证范围内失焦／隐藏／最小化后的实时提示可用性、调查保留、恢复与重置后的松键行为。真实隐藏使用已有平台能力，不伪造 visibility；核心事件序列可用单测明确覆盖，不把程序注入事件冒充系统原生按键证据。截图可能是后台最后一帧，结合实时 DOM／状态报告判断。
- 检查与证据：执行 `npm.cmd test`、适用生产构建、D07 三端定向和 `git diff --check`，记录新脚本／源码／ASAR 哈希及具体用例结果。无需无理由重跑全部物理长套件；若发现实际影响运动或生命周期，再追加受影响回归。保留旧 PASS、FAIL 和独立人工 BLOCKED。
- 交付与边界：更新 README、路线图及实际受影响的项目进度，说明修复前后语义；不改正式设计、最终键位、物理参数，不新增依赖、永久进度、任务、存档、事件事务或检查点。不删除文件、不关闭用户体验窗口、不 Commit／Push／发布。两轮有效修复仍失败则提交最小复现交 Work；完成后报告并停止，等待审查，不进入 D08。

### 2026-11-13 D07-R1 执行结果

R01 修复：交互快照现在仅在输入可用、模拟未暂停、`PlayerControlCoordinator` 允许交互、E 没有待释放门槛且当前没有按住 E 时返回可操作提示。活动调查仍可跨失焦／暂停保留，恢复只在真实可用性满足后显示提示，不结束调查、不释放其他 owner。`bindPlayerInput` 在焦点／可见性改变并调用 `setAvailable` 后同步刷新诊断，平台层仍只转换信号。

R02 修复：`reset()` 使用既有 `needsRelease` 状态与当前 held E 的并集保留松键门槛，不再因失焦已清空 held 而重写为 false；只有真实 E keyup 清除门槛。普通未持键重置仍可立即正常交互，不形成永久禁用。

新增 R01／R02 在修复前分别复现外部 owner 下错误提示和重置清除门槛，均为 FAIL；修复后 `npm.cmd test` 为 52/52 PASS。`npm.cmd run electron:build` PASS。D07 定向首轮 [run-PkdgnR](../test-results/platform/run-PkdgnR/report.json) 保留：Web PASS；Electron 开发版和独立包在 visibility 已恢复但真实焦点尚未回归的首个 rAF 中仍正确保持 `control=false`、提示为空，测试过早要求控制恢复。测试准备修正为记录“可见但未聚焦”的不可用状态，再等待真实 `document.hasFocus()` 与提示恢复；没有关闭暂停、伪造可见性或放宽应用断言。

最终 [run-LTvqUU](../test-results/platform/run-LTvqUU/report.json) 的 Chrome Web、Electron 开发版和仓库外独立包均 PASS，清理失败、页面错误和非预期中断均为 `0`。三端隐藏时均为 `prompt="" / control=false`；Electron 两模式可见但未聚焦时继续保持不可用，聚焦后恢复 `E 调查 B`；原始“E 未释放 → 关闭调查 → 失焦 → 重置 → 无 keyup 再按”顺序仍不触发，keyup 后提示恢复且下一次按下只消费一次。

当前 ASAR SHA-256 为 `958B8B18379FD2E5FEF83F3401F686CB0CD694FDAFD3255DBF1733E7FB99848C`，EXE 为 `763FC4C078A8D66CAD8D2E7B115FFA336710ADE65283FBBF8004788F4D1CA390`。`src/core/interaction.ts`、`src/platform/web/player-input.ts`、`tests/graybox-browser.mjs` 和 `tests/platform-smoke.mjs` 的当前哈希分别为 `F707047FA612BB8BB33DE7674CD8622BA5FE346C4B3B740054FDFED9624C298A`、`95D499A22943A32A9E5926FE23AA32A1BC48DB26B1F0D0D9547FA36D702FAB08`、`D675FB197392A328326099EA139A35986235CB88092DA3391491B1D9F92F696D`、`86C3477A85F12DB81992C430E236AB0A801B9A59C169F1D065D7D38DDA38F4FB`。

按任务范围未重跑完整物理长套件；Edge NOT RUN、独立人工长期按键 BLOCKED、历史 FAIL 和未实现业务能力继续保留。证据和截图见 [README D07-R1](../README.md#d07-r1提示可用性与重置松键门槛)。D07-R1 等待 Work 审查，不进入 D08，不 Commit／Push／发布。

### 2026-11-13 D06 Work 审查

基线 `92cc389` 加 D06 的四文件未提交修改，Work 保留原有修改。检查 M06 断言及同步真实 Matter 重置测试：浏览器异步采样期间 Tick 可以继续推进，改为不回退符合要求；同步单测仍验证 Reset 调用本身不改变 Tick。`run-Wo3C3j`、`run-JY8AVr`、`run-twh8V6` 三份报告三端均 PASS，全部版本条目与当前文件匹配，分别有三个退出码 0 的清理记录且无非预期中断。完整入口沿用历史 task=D04，两个定向入口分别标识 D04-R1／D05；通过报告 ID、执行范围和哈希归属本次 D06，不改写原报告标签。

Work 本轮重跑 `npm.cmd test`，类型检查、Electron Main 编译及 44/44 自动化测试 PASS；未重新执行三端 GUI 或生产构建，运行结果依据已核对版本的交付证据。D06 在已实现灰盒范围验收完成，允许 D07。旧 FAIL、独立人工手感 BLOCKED、Edge 未测、检查点及 RecoveryError 未实现均保留；不将 Matter 确认为最终方案。

### D07 任务卡：统一交互原型

- 目标：在可玩灰盒交付“走近看提示 → 主动按键交互 → 显示反馈 → 结束并继续移动”的完整体验。只验证交互机制，不实现主线任务、正式 NPC 对白或检查点。
- 设计依据：`PLAYER_CONTROL_DESIGN.md` 第 3 节 CONFIRMED“主动按键与统一交互入口”“交互期间的玩家控制”，以及 `DECISIONS.md` 的 PC-01／PC-02。朝向优先、合适的最近目标和单一主要提示保持；键位、距离、平局细则及 UI 采用注明的可调原型，不升级正式决策。
- 原型内容：设置两个范围可重叠的占位调查对象，用于选择验证；再设置一个只提供短暂拾取式反馈的占位对象，用于验证不设置长时间控制锁。标明测试对象，不编造地名、剧情、任务或奖励；反馈计数仅为临时诊断，不接入永久进度，也不代表已实现正式收藏品。
- 模块：共享核心管理交互候选、朝向、选中目标、一次按下请求及临时交互状态；物理适配仅提供平台无关的位置／支撑等必要数据，Phaser／DOM 负责可见对象、主要提示和反馈，平台输入层传递按下／释放／可用性。可新增一个小型交互模块，不新建通用组件系统、事件总线或另一套核心。
- 选择与提示：仅有效范围内对象可选，优先面对的有效对象，再考虑合适的最近对象；同等条件用稳定的工程规则避免抖动并记录选择，不依赖对象创建或渲染顺序碰运气。任何时刻只显示一个可操作的主要提示，离开范围或进入不可交互状态即消失／禁用；不能靠近后自动打开内容。
- 输入：原型可用 E 触发、Escape 或明确关闭按钮结束调查，记录为临时键位。一次新的有效按下只消费一次，不因按住、自动 repeat、补算或目标切换连续触发；范围外、忙碌、失焦／暂停时的触发不缓存、不补发，恢复必须重新释放再按下。触发时重新核对目标有效性，避免显示的旧目标被错误执行；不影响原跳跃缓冲规则。
- 控制权：调查开始后通过现有 PlayerControlCoordinator 申请限制移动与跳跃；结束只撤销自己的限制，不能直接全局解锁，另一来源仍阻塞时保持锁定。物理继续正常模拟，不冻结碰撞体或通过 Pause Token 暂停整个世界。普通拾取式反馈不持有长时间运动锁，不实现正式机关操作类型。
- 生命周期：交互内容打开期间隐藏／最小化，沿用 Runtime Lifecycle Controller 暂停；恢复不自动重开、关闭、再次交互或跳跃。原型可以保留当前调查面板，内容须明确；关闭面板不解除仍有效的失焦或其他控制限制。调试重置、重启与场景切换清理临时交互和自身控制请求、旧监听／回调，不清掉其他来源的限制；保持原有业务 ID 与 Tick 规则。
- 职责边界：本次为未连接业务系统的交互测试，使用临时对象标识，不冒充正式 Event／Command／Transaction／Session ID。后续任务、永久进度、机关和检查点业务必须按已有协议接入，不能把本原型直接当成绕过统一事件／事务的生产业务路径。D05 诊断区域仍只读诊断，不擅自转为检查点或真实任务触发器。
- I01：范围外无提示且按键无效；进入后只有一个主要提示，未按键不执行；离开提示消失。
- I02：重叠范围面对方向、距离和稳定平局选择正确，反向或换位置能切换主要目标，一次按下不同时操作多个对象。
- I03：调查可打开并关闭；移动／跳跃被协调器阻止，物理继续；结束后正常控制恢复，另一控制来源仍存在时不能被错误解除。
- I04：按住 E、repeat、补算及跨目标移动不重复消费；关闭调查仍按住 E 不重开，释放并重新按下才有新请求。锁定／失焦期间的 Space 遵守原 PC-02 松键门槛。
- I05：拾取式占位对象有可见短反馈，不产生长时间运动锁；不发放真实奖励或写入永久记录。
- I06：调查打开和交互键持有期间，执行真实 Web 隐藏／Electron 原生最小化与恢复，至少 1200 ms 冻结；无后台追赶、自动交互或错误解锁。调试重置和场景切换后无旧面板、重复回调或遗留自有锁。
- I07：保留已有 44 项并新增有意义的核心交互测试及真实输入集成测试；回归走跳、支撑、区域诊断与移动平台。输入与共享核心发生变化时执行一次适用的三端完整回归，再按需隔离验证新交互，不无理由重复全部历史专项。
- 验证交付：类型检查、单测、生产构建、`git diff --check`；Chrome Web、Electron 开发版和仓库外独立包执行相同 I01–I06 定向场景，记录目标 ID、交互状态、控制许可、消费计数、Tick、脚本／源码／产物版本、截图和清理结果。使用 PASS／FAIL／BLOCKED／NOT RUN，不用自动化冒充人工体验，不把未实现业务归为 PASS。
- 风险与处理：控制锁所有权、失焦输入及按住重触发是重点。接口、距离和原型 UI 等普通工程细节自行选择；两轮有效修复仍失败或出现架构冲突则停止，提交最小复现交 Work，不自行改 CONFIRMED。当前无需用户新增产品决策。
- 修改与停止：增量修改核心交互、灰盒集成、输入与显示，以及必要测试、README、路线图／项目进度；如需专项设计文档，仅记录实际原型行为和未定边界。不新增依赖、存档、任务、正式 NPC、事件事务或检查点，不确定最终键位／物理选型，不删除文件、不 Commit／Push／发布，不关闭用户体验窗口。给出准确启动入口与简短操作说明，完成报告后停止，不进入 D08。

### 2026-11-13 D07 执行结果

D07 在共享核心新增小型交互控制器，并在现有灰盒加入调查 A／B 与拾取 C。A、B 分别位于 `x=200 / 260`，范围均为 `80×110` 且局部重叠；C 位于 `x=335`，范围 `70×110`。E 为原型交互键，Escape 关闭调查，拾取反馈 `1200 ms`，朝向速度阈值 `5`；目标按朝向、距离平方和稳定对象 ID 依次选择。参数与对象仍是工程验证值，不升级正式决策。

调查使用现有 `PlayerControlCoordinator` 的独立 owner 限制移动和跳跃，关闭只释放该 owner；拾取不持有长时间运动锁。E 的按下／释放、失焦门槛、暂停判定、repeat 去重和单次消费都位于共享交互模块；平台输入层只传递键位与可用性。交互候选和反馈计时在固定步、唯一一次 Matter 求解与支撑刷新之后更新，不由渲染帧推进。

首轮 [run-ALZnzH](../test-results/platform/run-ALZnzH/report.json) 三端在 `graybox-D07-I03-I04-control-lock-hold-and-pause` FAIL，原报告保留。原断言要求调查打开后角色位置立即严格不变；实际既有速度继续减速并滑行约 `2.67–7.22 px`，随后 `vx=0`，期间移动／跳跃输入已锁定且未发生跳跃。测试改为验证惯性归零后位置稳定和锁仍有效，没有放宽暂停、输入或交互断言。

D07-R1 前，`npm.cmd test` 为 50/50 PASS；`npm.cmd run electron:build` PASS。最终定向 [run-obVH8m](../test-results/platform/run-obVH8m/report.json) 的 Chrome Web、Electron 开发版和仓库外独立包均 PASS；三端调查打开／隐藏冻结／恢复 Tick 分别为 `171/225/226`、`173/220/222`、`165/214/216`，消费数和开始数在恢复前后不增加，恢复后控制仍由调查 owner 锁定。当时源码与产物随后执行一次完整入口 [run-HAkFWZ](../test-results/platform/run-HAkFWZ/report.json)，三端 PASS，清理失败、页面错误和非预期中断均为 `0`。

D07-R1 前的正式产物 ASAR SHA-256 为 `9FAE0259711801B3CD57DB71381F8A343C0C17C0E44B2A7B5218DFF70E1BE641`，Windows EXE SHA-256 为 `25B604AD000A6CEF4A1B9A2BCCD285F4C85DE78E6B27C2BDB68575C56DD96046`。当时 `tests/platform-smoke.mjs`、`tests/graybox-browser.mjs` 和 `src/core/interaction.ts` 的 SHA-256 分别为 `098ED363C85D73C0AFB919DB6D9871F243A0D91F67A016C83AFF95FC64D13EAF`、`42B92673A3E9D493583492852D494D69AE4FC7F097BF1F439CAD3AEA65FBC5BA`、`0A89F1A196B09DCA5D0643D4D8B9632057B273CE33BBFB31719F539BB2F684BF`；当前证据以上文 D07-R1 执行结果为准。

正常开发体验窗口以 PID `30952`、HWND `13896118` 保留，标题“叠城大冒险 | Layered City Adventures”；截图和启动记录见 [experience-launch.json](../test-results/d07-20261113/experience-launch.json)。Edge 未重测（NOT RUN），独立人工长期按键体验受工具限制（BLOCKED）。I01–I07 当前原型范围均有真实 Matter、定向三端或完整三端证据；正式任务、奖励、永久进度、业务事件事务和检查点仍为 NOT RUN。Matter 仍是候选；Work 在本段后发现的提示与重置门槛缺口已由前面的 D07-R1 执行结果修复，当前等待 Work 复审，不进入 D08。

### 2026-11-13 D05 Work 审查

基线为 `92cc389`，审查开始时工作区干净。Work 阅读 D05 源码差异、真实 Matter 测试和三端定向脚本，核对 `run-2Ch7Xr/report.json`、截图及三端正常退出／清理记录；当前核心、物理适配、Web 入口、测试脚本及生产 ASAR 哈希与报告一致。本轮重新执行 `npm.cmd test`：类型检查、Electron Main 编译及 44/44 自动化测试 PASS；未重跑 GUI 专项或生产构建，其结果依据版本匹配的开发窗口证据。

两个区域只查询玩家主体，sensor 不加入支撑集合；占用变化在实际固定步求解后归并，历史最多 8 条，调试重置单独同步基线而不生成步行事件。本次实现满足 D05 当前任务范围，允许进入 D06。历史长套件 FAIL、Edge 未测、独立人工体验及业务检查点恢复仍保留原状态，不宣称完整 T01–T06 或 Matter 最终选型通过。

### D06 任务卡：物理灰盒阶段回归与报告

- 目标：对当前同一版本汇总并执行已实现物理能力的三端回归，给出可追溯的阶段结论和用户可体验入口，为 D07 交互原型提供依据。本次以验证收尾为主，不新增玩法或扩大物理功能。
- 依据与范围：沿用 Physics Graybox Prototype Acceptance Criteria、Matter-first、固定步／有界补算、输入许可与松键门槛、暂停令牌、共享 Renderer 的既有约束；阅读 README 现有验收记录及 D03／D04／D04-R1／D05 任务，不重复设计。
- 测试矩阵：在 README 现有灰盒章节集中维护 T01 玩家移动与跳跃、T02 静态地形与单向平台、T03 移动／升降平台、T04 非实体诊断触发区域、T05 双端行为一致性、T06 隐藏／最小化生命周期六组。逐子项列目标、前置条件、步骤、预期／实际结果、状态、问题及证据链接；区分真实 Matter 单测、真实三端自动化和独立人工操作，不能互相冒充。
- 版本与执行：检查 Git 和现有体验窗口，保留用户修改及进程。执行 `npm.cmd test`、适用生产构建及 `git diff --check`；记录应用源码、测试脚本、运行环境与 ASAR 哈希。同一版产物复用时验证哈希并注明原构建证据，不能把旧包当新代码。GUI 回归串行执行，避免多个测试窗口互相抢焦点。
- 三端范围：Chrome Web、Electron 开发版和仓库外独立生产包执行同一组已实现规则。复用现有完整平台入口、`test:d04-r1` 与 `test:d05`，完整入口本身不包含 D05 分支，不能漏测后仍声称全覆盖。可以仅增加最小 D06 调度／报告汇总；每个子命令保留独立退出码、覆盖范围和失败证据，不重构通用测试框架，不把多个局部 PASS 包装成原完整入口 PASS。
- 回归重点：走跳与短长跳、土狼时间／缓冲、墙壁／天花板／坡面、实体与单向平台、移动／升降平台承载与脱离、两个区域进入／占用／离开及重置、场景切换、隐藏启动／暂停恢复、持键释放和窗口关闭。检查固定步唯一求解、实际 Tick 与时钟对应、无后台追赶或丢弃时间事件。双端对照同一规则与原型容差，不要求渲染调度造成的绝对 Tick 或浮点轨迹逐位相同。
- 失败处理：完整长套件先执行一轮，保留所有结果。若某用例被意外失焦打断，只针对未取得证据的必要子项做隔离验证并记录关联，不反复重跑全套挑选 PASS；仍不能执行则明确 BLOCKED。不得忽略失焦锁存、强行抢焦点、重放按键、伪造可见性或削弱断言。确认是应用缺陷才最小修复并重跑受影响项；同一问题两轮有效修复仍失败或架构冲突时停止交 Work。
- 覆盖边界：未实现的检查点捕获、永久进度协调、两阶段恢复、RecoveryError 与对应组合场景仍为 NOT RUN；本轮不能为了补齐测试提前实现它们，也不能用 R 调试重置冒充检查点恢复。未执行的 Edge／独立人工操作如实记录，不用自动化替代；本任务不强制扩大为 Edge 全套兼容性工程。
- 可体验交付：保留现有正常体验窗口；需要新开时用正常启动入口，与测试自有窗口区分。提供准确命令、生产包路径、当前进程状态、真实截图和简短操作路线：基础走跳 → 单向平台 → 两个移动平台 → 诊断区域。测试清理只处理本轮自有进程，不能关闭用户体验窗口。独立人工工具仍受限时记 BLOCKED，不为此开启工具修复任务。
- 收口判据：六组已实现子项均有明确证据或未通过原因；未实现项、历史 FAIL 和剩余问题可追踪；无已知且未报告的阻断玩法缺陷。若仍有必要子项 FAIL／BLOCKED，不能宣布整体物理验收通过，报告对后续独立 D07 的影响，由 Work 判断是否允许继续。本次不自行确认 Matter 为最终方案，不新定性能阈值或最终参数。
- 修改范围：优先更新 README、路线图和受影响的项目概述；必要时最小调整现有测试入口。无需新增验收文档、业务模块、新依赖或泛化框架；DECISIONS 中正式规则不变。
- 交付与停止：提交逐项 PASS／FAIL／BLOCKED／NOT RUN、命令／退出码、矩阵、截图、当前产物与未解决问题，给出是否具备进入 D07 的工程建议，报告后停止等待 Work。不得自动开发 D07、Commit／Push／发布、删除文件或关闭用户应用。本任务无须新增用户产品决策。

### 2026-11-13 D06 执行结果

在同一当前版本完成物理灰盒阶段回归，没有修改玩家、输入、物理、暂停、平台或构建配置；测试层只修正一处 M06 浏览器断言并保存新证据。首轮完整三端 [run-KRssuy](../test-results/platform/run-KRssuy/report.json) 均在 `graybox-D04-M05-M06-platform-pause-reset` FAIL：调用调试重置后到采样之间固定步继续推进，Web／Electron 开发／独立包 Tick 分别从 `4033／4021／4012` 前进到 `4046／4035／4026`。任务语义要求全局 Tick 不回退，而不是采样时严格相等；现断言为 `resetState.tick >= tickBeforeReset`，同步真实 Matter M06 仍证明 Reset 调用本身不改变 Tick。原 FAIL 报告保留。

修复后只重跑一轮完整长套件 [run-Wo3C3j](../test-results/platform/run-Wo3C3j/report.json)，Chrome Web、Electron 开发版和仓库外独立生产包均 PASS；非预期中断、页面错误、清理失败均为 0，三个测试进程退出码均为 0。随后串行执行 [run-JY8AVr](../test-results/platform/run-JY8AVr/report.json) 的 D04-R1 移动平台生命周期专项及 [run-twh8V6](../test-results/platform/run-twh8V6/report.json) 的 D05 诊断区域专项，三端均 PASS。三份报告的 ASAR SHA-256 均为 `C1C3C9B366B1A88F885DF1FE917A898BA6143BADC8C0DDF33FA6F6710F01A3F2`；成功报告使用当前 `tests/graybox-browser.mjs` SHA-256 `3BE983D0CD04B70077681028886D7254305F1700426524455D68CD1CC0772242`。

`npm.cmd test` 为 44/44 PASS；`npm.cmd run electron:build` PASS；当前 Windows EXE SHA-256 为 `D89CF19C2F36376B0DB3C03EAEE506E1203A45E705E66C87E626261C8DEB470B`。完整套件三端隐藏恢复 Tick 为 `3998→3998`、`3985→3985`、`3989→3989`，平台时钟均保持 `8766.667 ms`；D04-R1 平台冻结、持键门槛和 D05 区域恢复无重复 enter 均通过。T01–T06 已实现子项矩阵见 [README](../README.md#d06物理灰盒阶段回归)。

当前证据支持进入 D07 的工程建议限于已实现灰盒范围；Edge、独立人工操作、移动单向／旋转／挤压平台、正式业务触发器、Event Inbox、完整检查点及 RecoveryError 仍为 NOT RUN 或 BLOCKED。历史 `run-1rk8KM`、`run-4xEAdj`、`run-cYdmZk` 和 D04-R1 早期失败不复写；Matter 仍为验证候选，不自行确认最终选型。正常 `npm.cmd run electron` 体验窗口 PID `47016`、HWND `27723594` 保留，D06 截图和启动记录位于 [D06 证据目录](../test-results/d06-20261113/)。

### 2026-11-13 D04-R1 Work 审查

审查基线 `8fc32d1`，开始时工作区干净。Work 检查诊断缓存修复与专项测试实现、`run-KPoUKj/report.json`、实际截图及三端退出／清理记录；三个报告脚本／适配文件和生产 ASAR 的 SHA-256 与当前文件一致。重新执行 `npm.cmd test`，类型检查、Electron Main 编译及 38/38 测试 PASS。本轮未重新运行 GUI 专项或生产构建，运行验收依据为已核对版本的开发窗口证据。

诊断修复仅保留最近一次真实物理诊断，未改写暂停、固定步、输入或 Matter 规则。隐藏时截图可能仍为最后一帧可见画面，冻结／暂停应结合报告中的实时 DOM 诊断和原生窗口状态判断，不能把截图标签单独作为暂停证据。当前证据满足 D04-R1，并结合已有承载验证收口 D04；保留此前专项失败和完整长套件 FAIL，不宣称其已修复或完整 T01–T06 已通过。Edge、独立人工体验、完整检查点恢复仍未验收。允许进入 D05；D06 再整理灰盒阶段回归矩阵及未覆盖项。

### 2026-11-13 D05 执行结果

在灰盒出生点右侧新增 `diagnostic-zone-a`（中心 `400,462`、`120×76`）与 `diagnostic-zone-b`（中心 `450,462`、`120×76`）两个局部重叠 Matter sensor。检测在唯一一次真实 Matter 求解后按实际固定步执行，只查询玩家主体与区域；区域不进入地形／支撑集合，不阻挡、不承载、不改变跳跃资格。每个区域独立维护占用、连续占用步数、进入／离开计数及最多 8 条带真实 SimulationTick 的记录，诊断序号不冒充业务 ID。

暂停时不执行区域检测；恢复不制造 enter。调试重置在传送后重建真实位置基线，不生成伪事件、不重置全局 Tick；场景切换销毁旧世界后从空状态创建。真实 Matter 单测保留原 38 项并新增 G01–G06 六组，`npm.cmd test` 为 44/44 PASS。`npm.cmd run electron:build` PASS，当前 ASAR SHA-256 为 `C1C3C9B366B1A88F885DF1FE917A898BA6143BADC8C0DDF33FA6F6710F01A3F2`。

[run-2Ch7Xr](../test-results/platform/run-2Ch7Xr/report.json) 的 Chrome Web、Electron 开发版和仓库外独立生产包均 PASS；非预期中断、页面错误与清理失败均为 0，测试自有 PID `14068 / 23080 / 33388` 均退出码 0。每端从区域外真实进入 A、区域内跳跃并保持 `ground-a` 支撑、进入 B-only、返回重叠区并在恢复后再次记录退出／进入；隐藏／恢复首帧的 Tick、物理步数、平台时钟及区域计数为：

| 环境 | A enter Tick／持续步 | 隐藏→恢复 Tick、物理步、平台时钟 | 恢复后再次进入 |
| --- | --- | --- | --- |
| Chrome Web `156.0.8078.74` | `99 / 21` | `317 / 317 / 1516.667 → 317 / 317 / 1516.667` | Tick `368`，E2 X1 |
| Electron 开发版 | `105 / 20` | `311 / 311 / 1466.667 → 311 / 311 / 1466.667` | Tick `362`，E2 X1 |
| 独立生产包 | `113 / 20` | `325 / 325 / 1533.333 → 325 / 325 / 1533.333` | Tick `375`，E2 X1 |

两端 Electron 的原生窗口实际记录最小化时 `visible=false / minimized=true`，恢复时 `visible=true / minimized=false / focused=true`。成功截图覆盖 A／B 重叠、隐藏冻结、恢复、重置基线、场景切换和完成状态，位于 [D05 证据目录](../test-results/platform/run-2Ch7Xr/)。正常 `npm.cmd run electron` 体验窗口保留：PID `47016`、HWND `27723594`、标题“叠城大冒险 | Layered City Adventures”，截图与启动记录见 [D05 常驻窗口证据](../test-results/d05-20261113/)。

本结果只覆盖 D05 诊断区域和现有回归烟测，不是完整 T04、触发器业务、检查点或 T01–T06 验收。Edge 为 NOT RUN；`run-1rk8KM`、`run-4xEAdj`、`run-cYdmZk` 的完整平台长套件 FAIL 原样保留。Matter 仍为候选，不自动进入 D06；Commit、Push 与发布未执行。

### D05 任务卡：物理触发区域与生命周期诊断

- 目标：在现有可玩灰盒放置两个可到达、可区分且局部重叠的静态诊断区域，验证实体碰撞与非实体触发检测共存。区域只显示占用与进入／离开记录，不启动任务、机关、失败或检查点。
- 依据：Physics Graybox Prototype Acceptance Criteria 的 T04 基础碰撞／触发子项，以及固定步、SimulationTick、独立状态和暂停协议。实现参数均为原型；真实业务事件以后仍须接入统一协调器入口与阶段规则，本次诊断记录不是正式业务 Event。
- 模块边界：Matter 适配层负责物理检测并输出平台无关的区域 ID／占用数据；占用变化与诊断状态按固定模拟步维护，Phaser 和 Web 入口只读显示。沿用当前接口，确有必要时做最小扩展；不在渲染帧或物理回调中跨模块写状态，不新建通用事件框架。
- 检测语义：依据玩家主体与区域的真实几何重叠，脚底查询区域、地形和移动平台不得冒充玩家触发。区域不阻挡玩家、不提供支撑、不改变质量、速度或跳跃资格；与实体平台重叠时，原有支撑仍正确。
- 生命周期：每个区域独立维护 occupied；外到内只记录一次 enter，持续占用可显示状态／累计实际步数，内到外只记录一次 exit；真正离开再进入可以再次 enter。每次实际固定步只归并一次区域结果，多接触对或重复检测不得重复计数。
- 诊断：显示区域轮廓、ID、当前占用及进入／离开计数，最近记录带实际 SimulationTick；历史采用有界保存。诊断序号不得复用或冒充 Event ID、Command ID、Transaction ID，也不提前冻结最终接口或字段设计。
- 暂停与重置：暂停时不更新占用计数或产生新记录，恢复后继续实际物理状态，不凭重新显示页面制造 enter。R 调试重置要清除旧接触缓存，并建立与重置后真实位置一致的占用基线；明确记录 reset／基线同步，而非把传送伪装成正常步行 enter／exit。场景切换和重新启动不残留旧监听或重复处理。此规则仅用于调试诊断，不代替未来检查点恢复。
- G01：从区域外进入、停留多个 Tick、离开并再进入，计数与状态正确；重复检测不会多次 enter。
- G02：两个重叠区域各自正确进入／离开，不能合并或串改；相同一步发生的变化使用同一真实 Tick，诊断显示次序不得影响结果。
- G03：穿过区域不受阻、站在区域内仍由真实地面／平台支撑；空中仅重叠区域不能获得落地或额外跳跃资格，脚底 sensor 单独接近不能触发主体进入。
- G04：区域内真实隐藏／最小化至少 1200 ms，状态与计数冻结；恢复无后台追赶、无重复 enter，后续正常离开／再进入可记录。
- G05：区域内外调试重置后占用与真实位置一致，无旧接触或伪步行事件；切换场景再返回不重复监听。不重置全局 Tick／业务 ID，不冒充存档恢复。
- G06：保留走跳、实体／单向平台、移动／升降平台回归；补算实际步各自检测，丢弃时间不生成区域记录或虚拟 Tick。
- 验证与证据：保留原 38 项自动化测试并补真实 Matter 用例，执行类型检查、生产构建与 `git diff --check`；Chrome Web、Electron 开发及仓库外独立包执行相同 D05 定向场景。复用最小测试选择入口和原生窗口控制，不要求先跑完整长套件。报告记录区域状态／计数、Tick、真实隐藏／窗口状态、脚本及产物哈希、截图与清理结果；历史 FAIL 不改写，未执行项如实列 NOT RUN／BLOCKED。
- 风险处理：边界容差和测试区位置由实施者选合理原型值并记录，不为普通参数请求产品决策。意外失焦保持取证，不抢焦点或伪造可见性；同一问题两轮有效修复仍失败或出现架构冲突时停止并提交最小复现。
- 不做：CheckpointCoordinator、Event Inbox、业务 ID 生成器、捕获事务、检查点恢复、永久进度、NPC／任务／机关、美术、新依赖或最终物理选型；不修改 CONFIRMED、不 Commit／Push／发布、不删除文件或关闭用户应用。
- 交付：更新 README、路线图及确实受影响的项目概述；提供准确体验入口、操作说明和真实截图。状态达到任务范围验收后报告，停止并等待 Work，不进入 D06。当前任务不需要新增用户产品决策。

### 2026-11-13 D04 Work 审查与 D04-R1 任务卡

审查基线：`20828a2`，审查开始时工作区干净。Work 重新执行 `npm.cmd test`，类型检查、Electron Main 编译及 38/38 自动化测试 PASS；三个测试脚本与现有 ASAR 的 SHA-256 均匹配 D04 报告。已检查承载实现、现有专项用例和截图。`run-cYdmZk` 三端均明确记录交互中 `blur` FAIL，不能改判 PASS，也不足以证明其来源一定是游戏缺陷。单测中的暂停不替代 Windows 原生窗口实测，D04 继续保持 BLOCKED，等待下列必要证据。

- 目标：补齐 M05 的真实平台生命周期证据，不重复开发移动平台，不开启泛化测试工具重构或 D05。独立人工工具验收继续按原状态记录，不作为本任务新增关卡。
- 范围：优先复用 `tests/platform-smoke.mjs` 的平台启动、真实隐藏／最小化、恢复和清理能力，以及 `tests/graybox-browser.mjs` 的既有承载与暂停断言。允许增加最小专项选择入口，使本任务可以直接执行，不必先通过既有整套长流程。新命令由实施者记录到 README，不预先声称已经存在。
- 三端矩阵：Chrome Web 使用真实标签页切换；Electron 开发版及仓库外独立生产包使用真实原生窗口最小化／恢复。每端均覆盖水平平台和垂直平台上的有效支撑。通过真实物理和输入建立支撑，不直接伪造 support 或 visibility 状态。
- 暂停断言：确认真实 hidden／minimized 和暂停生效后采样，后台至少停留 1200 ms；Tick、物理时钟、平台路径位置／阶段／方向与玩家状态保持冻结。输入清理可能发生在暂停转换中，不能把转换前后的正常清理误判为冻结失败。
- 恢复断言：记录首个恢复采样及后续固定步，不能补算后台停留时间；平台路径时钟增量与实际物理步数一致，继续承载且不残留错误速度。至少覆盖一次持有 Space 时暂停：恢复不得自动跳跃，释放后重新按下可正常操作。沿用当前 PC-01／PC-02 输入规则。
- 焦点与异常：测试主动隐藏前声明预期阶段，避免把本次测试自己触发的预期 blur 记为意外中断；其他交互阶段的意外失焦仍保留失败取证，不忽略、不抢焦点或重放按键。只管理本轮启动的进程，不关闭用户应用。若环境再次阻止专项执行，报告 BLOCKED 及最小时间线；针对同一问题两轮有效修复仍失败即停止并交 Work，不反复重跑挑选 PASS。
- 证据：以 D04-R1 标识报告，逐端、逐平台记录支撑 ID、相对位置、Tick、物理／平台时钟、原生窗口状态、输入状态、截图和退出／清理结果；记录源码、测试脚本和生产 ASAR 哈希。已有包匹配当前应用代码时可复用，不以测试脚本改动为由强制重建；应用代码确有修复时才重新构建并验证对应产物。
- 回归：执行 `npm.cmd test` 与 `git diff --check`。保留原有完整套件 FAIL，不要求为了本任务重复执行整个长套件；专项 PASS 仅证明上述覆盖项，不能写成完整 T01–T06 或整套平台测试通过。
- 职责：Work 本轮只安排验收任务；执行窗口自行完成必要的局部测试调整。只有确认应用缺陷才做最小修复，不能通过改核心暂停语义、放宽承载断言或新增依赖绕过问题。
- 交付：更新 README、路线图及确实受影响的项目进度，区分本次专项与历史失败。体验窗口仅在明确说明并可保留时提供，测试完成不能声称旧 PID 仍在运行；原 PID `30508` 已结束，原截图和启动记录保留为历史证据。报告后停止，由 Work 判断 D04 是否收口，再安排 D05。
- 禁止：新增触发器业务、检查点、NPC、任务、美术或通用框架；修改正式决策或技术选型；覆盖历史报告；Commit／Push／发布；关闭用户已有窗口或删除文件。

### 2026-11-13 D04-R1 执行结果

新增最小专项入口 `npm.cmd run test:d04-r1`，内部执行 `tests/platform-smoke.mjs --d04-r1`。它复用现有开发服务、Chrome／CDP、原生窗口读取、中断锁存、截图和自有进程清理，但不执行既有隐藏启动、两轮普通暂停、三次重启或完整灰盒长流程。Chrome 使用真实后台标签页切换；Electron 开发版与仓库外独立生产包调用真实原生最小化／恢复。

成功轮 [run-KPoUKj](../test-results/platform/run-KPoUKj/report.json) 三端 PASS，非预期中断、页面错误和清理失败均为 0。每端均先经真实物理与键盘建立有效支撑，再后台停留至少 1200 ms：

| 环境 | 水平平台 Tick／物理步／平台时钟（冻结→恢复首帧） | 垂直平台 Tick／物理步／平台时钟（冻结→恢复首帧） | 结果 |
| --- | --- | --- | --- |
| Chrome Web | `554 / 554 / 8866.667 → 554 / 554 / 8866.667` | `1311 / 1311 / 11283.333 → 1311 / 1311 / 11283.333` | PASS |
| Electron 开发版 | `566 / 566 / 8850.000 → 566 / 566 / 8850.000` | `1320 / 1320 / 11266.667 → 1320 / 1320 / 11266.667` | PASS |
| 仓库外独立生产包 | `559 / 559 / 8866.667 → 559 / 559 / 8866.667` | `1313 / 1313 / 11283.333 → 1313 / 1313 / 11283.333` | PASS |

水平平台有效支撑下的相对 X 为 `42.236 / 45.347 / 42.236 px`，垂直平台相对 Y 均约 `-30.95 px`；恢复后继续承载，世界速度与平台速度一致，没有后台 Tick 追赶、额外平台路程或旧速度。三端均覆盖水平平台按住 Space 后暂停：恢复前后跳跃计数为 `4 → 4` 且保持松键门槛，松开后重新按下才到 `5`。Electron 两种模式均实测最小化时 `visible=false / minimized=true / focused=false`，恢复时 `visible=true / minimized=false / focused=true`。Chrome 为 `156.0.8078.74`；测试进程 PID `796 / 27776 / 36672` 均退出 0，清理 PASS。

定向过程确认并修复一个诊断呈现缺陷：`visibilitychange` 刷新诊断时若未携带平台快照，会清空平台位置、阶段、方向和时钟字段。`src/platform/web/main.ts` 现缓存最近一次真实灰盒平台诊断，在暂停刷新时复用；正式暂停规则、共享模拟、输入和物理语义未改。重新构建后的 ASAR SHA-256 为 `9239B4673ADA2FA0D4B012F3D58B28E2C051096352604B0BCF66AF9361E14DB5`；成功报告中的 `platform-smoke.mjs`、`graybox-browser.mjs`、`src/platform/web/main.ts` 哈希分别为 `A128A6D1BA9CFD250D0E20FC38C69ECABF15F4E21BC22B05895CE8F832ECCDBE`、`BFC016A882A7A36921537A33534D3C4C0B1FCE2FBEE7FC5188A9E64B5B697B9D`、`08FCEBCC3FD746133B2F17D7691000E9B2FADF4A4CB88C17E09EC2F302D9DA65`。

成功截图保留在 [D04-R1 证据目录](../test-results/platform/run-KPoUKj/)：Web 的 `001`／`003`／`005`，Electron 开发版的 `010`／`012`／`014`，独立包的 `019`／`021`／`023`，分别覆盖水平、持 Space 和垂直平台的隐藏冻结现场；每端另有恢复与完成截图。专项失败尝试 `run-PmBECe`、`run-LnHbxW`、`run-rtWcfh`、`run-xyDdSD` 均保留 FAIL。既有完整平台长套件 [run-1rk8KM](../test-results/platform/run-1rk8KM/report.json)、[run-4xEAdj](../test-results/platform/run-4xEAdj/report.json)、[run-cYdmZk](../test-results/platform/run-cYdmZk/report.json) 也保持 FAIL；专项 PASS 不覆盖、替代或推断这些结果。

最终 `npm.cmd test` 为 38/38 PASS；`npm.cmd run electron:build` 已通过，当前 ASAR 与成功报告一致。Edge 未执行，记 NOT RUN。本轮未重新运行完整平台长套件，也未另开常驻人工体验窗口；D04 旧体验 PID `30508` 已结束，其历史截图和启动记录保留。D04-R1 仅关闭本任务的真实移动平台 M05 定向证据缺口，D04 是否收口及是否进入 D05 由 Work 审查。

### D04 任务卡

- 目标：在现有可玩灰盒增加一条水平往返实体平台和一条垂直往返升降实体平台，验证可靠承载。它们本次均为普通实体平台，不实现移动的单向平台、旋转平台或挤压死亡。
- 依据：`PLAYER_CONTROL_DESIGN.md` 的移动平台有效支撑规则，以及 Matter-first、Physics Graybox Prototype Acceptance Criteria、PC-01／PC-02、固定步与暂停协议。D03 已验收；参数、路线和起跳惯性均为可调整原型，Matter 仍非最终选型。
- 模块：Matter 适配层管理平台碰撞体、逻辑路径、位置与承载接触；共享核心只接收平台无关的支撑／运动数据并管理玩家输入和跳跃资格；Phaser 每帧读取状态更新显示，不用渲染 Tween 或墙上时间驱动物理。允许最小扩展现有物理端口，不新建通用平台框架。
- 固定步顺序：明确平台路径更新、玩家控制／承载、唯一 Matter 求解与有效支撑刷新之间的顺序。每个实际 Tick 只推进一次路径与物理；丢弃时间和暂停时间不推进平台，不独立创建计时循环。
- 速度与随动：区分玩家自身移动、支撑平台运动和最终世界位移，明确单位，保证平台位移只施加一次，不能被玩家速度写入覆盖。移动支撑的分离判定应考虑相对平台的法向速度，不能只沿用静态地形的绝对速度或简单提高容差掩盖脱离。
- 支撑：沿用独立脚底区域＋当步有效实体接触＋方向验证。只在有效支撑时随动，侧碰、顶头或仅 sensor 重叠不能绑定平台；离开或起跳后清除承载关联，旧接触不能重授跳跃资格。
- 起跳惯性：执行者选择并记录一种一致的原型策略，明确是否继承平台额外速度及施加时机，避免重复叠加；不擅自升级为正式手感决策，也不为此要求用户先确定最终数值。
- 路线与表现：路径有固定端点并可反向，几何保证安全余量，避免把未定义的夹压规则引入本任务。平台逻辑状态与碰撞体／显示位置一致，给出可到达测试区与区分标识，保留 D03 原测试区。
- M01：从上方登上水平／垂直平台、静止随动及端点反向稳定，持续多轮无累积漂移、掉穿或抖动。
- M02：随平台左右行走、制动、反向及移动到边缘，玩家自主运动与承载都正确；走出边缘后自然脱离。
- M03：平台运动时起跳、落回及离开后再落地，短长跳、土狼时间与输入缓冲不回归；侧面／下方接触不得误判支撑。
- M04：空中角色不会被无接触平台远程携带，切换地面与不同平台后不继续应用旧平台位移；单向平台原规则保持。
- M05：站在或离开平台时隐藏／最小化，玩家、平台、路径阶段、Tick 与物理时钟冻结；恢复首帧无追赶或自动跳跃。补算上限与丢弃时间不产生额外平台路程。
- M06：调试重置可复位角色和平台的初始逻辑位置／方向，清理速度与支撑缓存，后续重新碰撞正常；不重置全局 Tick 或业务身份，不冒充检查点快照恢复。
- 验证：真实 Matter 单测保留原 32 项并新增承载用例，至少跨多个完整往返周期；生产构建及 Chrome Web、Electron 开发、仓库外独立包执行相同新增场景。T03 只记录此次承载／生命周期子项，完整快照恢复与 T04 仍未实现；Edge 未测则 NOT RUN。
- 证据：新增用例清楚标识 D04，记录平台 ID、位置／阶段、支撑 ID 和玩家相对位置等必要诊断，注明脚本及产物版本；不要再仅凭沿用的 D01-R2 报告标签归属新任务，不修改旧报告。
- 不做：机关开关、NPC、任务、收藏、检查点、事件事务、自动存档、正式美术、新依赖、技术切换、Commit／Push／发布。保留用户体验窗口及旧包，产物被占用时使用安全的独立输出或报告，不强制结束用户应用。
- 交付：更新 README 和当前任务状态；提供准确入口、操作说明和真实截图。独立人工工具受限可继续记 BLOCKED，不把它改 PASS或另开修工具任务；实际功能失败仍须处理。两轮有效修复仍失败则提交最小复现与差异，交由 Work 分析。完成后停止。

### D04 执行结果（2026-11-13）

D04 已实现并保留：`moving-horizontal-a` 宽 100、高 18，`x=1710 → 1780`、`y=300`、周期 4000 ms；`moving-vertical-a` 宽 72、高 18，`x=1910`、`y=310 → 220`、周期 3600 ms。平台路径、Matter 碰撞体与显示位置同源，只随实际固定步推进。每步顺序为上一 Tick 有效支撑 → 平台路径 → 自主速度 → 一次承载位移 → 单向平台资格 → 唯一 Matter 求解 → 支撑刷新。上一 Tick 验证的支撑只施加一次位移；侧碰、下方或 sensor 单独重叠不绑定承载，分离判定使用相对平台速度。起跳不继承平台额外速度，为原型策略而非正式手感决策。

`npm.cmd test` PASS，类型检查、Electron Main 编译和 38/38 测试通过；M01–M06 六组真实 Matter 测试保留原 32 项并全部通过。`npm.cmd run electron:build` PASS，新 ASAR SHA-256 为 `4C84A124F30A62B24354C9078D7B8F57B2B828DD60F3E1E6177E57A7DBDEA1B7`。D03 旧包归档在 `release/d03-20261113/win-unpacked/`，旧 ASAR SHA-256 为 `A087F4C9C95610DC12D178CBBD9296DCD211BA5C028CF9DD3CA2DE298329D0C0`；当前入口仍为 `release/layered-city-adventures/win-unpacked/Layered City Adventures.exe`。

三端定向真实运行均 PASS：Chrome Web、Electron 开发版、仓库外独立生产包分别站上两条平台，得到 `moving-horizontal-a`／`moving-vertical-a` 支撑，平台速度分别为 `worldVx=35`、`worldVy=-50`，玩家相对平台高度约 `-30.95 px`。截图保存在 [D04 证据目录](../test-results/d04-20261113/)。当前 `platform-smoke.mjs`、`graybox-browser.mjs`、`player-physics.test.mjs` SHA-256 分别为 `9CED6D650FD1B54976FF64837FA39A486EE2334DF0E236EF65527DB72FC55991`、`CA9DDFB3CF0DFCD3FC6F840689D5AAB6D4707B97EF0DABB32F2B44160DEB7F9F`、`B8121B79605EFA0966EBAEA1A60306DAFF80972DB4648B7F9D88BD91DD85297A`。

正式完整平台套件三次均为 FAIL，原始证据保留：[run-1rk8KM](../test-results/platform/run-1rk8KM/report.json) 在既有短长跳用例失焦；[run-4xEAdj](../test-results/platform/run-4xEAdj/report.json) Web 在既有地面／墙用例失焦，Electron 两种模式已登上水平平台但旧断言把约 `-30.95 px` 误写为应接近 0，修正为接近 `-31`；[run-cYdmZk](../test-results/platform/run-cYdmZk/report.json) 三端又在既有重启／碰撞／移动阶段失焦。未自动抢回焦点、重放按键、关闭暂停或削弱断言。焦点中断来源未定位，不能据此认定游戏缺陷；也不把三端平台定向 PASS 写成完整套件 PASS。

正常 `npm.cmd run electron` 已启动并保留体验窗口：PID `30508`、HWND `5508372`、标题“叠城大冒险 | Layered City Adventures”，[实际截图](../test-results/d04-20261113/electron-dev-experience.png)与[启动记录](../test-results/d04-20261113/experience-launch.json)已保存。Windows 原生最小化／恢复专项因完整脚本受焦点中断而 BLOCKED，不由真实 Matter 单测替代；Edge 为 NOT RUN。`git diff --check` 退出 0，仅有 Git 的 LF／CRLF 提示。

### 2026-11-13 D03 Work 审查

Work 阅读了平台碰撞实现、核心边界及 P01–P06 测试，查看实际单向平台截图；本轮重新执行 `npm.cmd test`，类型检查、Electron 编译及 32/32 单测 PASS。核对 [run-C3nYeL](../test-results/platform/run-C3nYeL/report.json)：三端均 PASS，均含新增平台事件，无 unexpected-interruption 或 cleanupFailures，三个测试进程退出码 0；报告内 6 个测试文件及 ASAR 哈希匹配当前文件。本轮未重新构建或运行三端 GUI 回归，后者为已执行证据复核。

首轮阈值错误与修正记录均保留；实体平台 a 与 b 的底面高度不同，浏览器用例 b 的理论中心边界约 430，修正值与几何及实际接触一致，未删除碰撞断言。D03 在当前原型尺寸、速度与容差下通过，允许进入 D04；不等于任意配置、长期稳定性、Edge、独立人工操作或完整 T01～T06 全部通过。

### D03 任务卡

- 目标：在可玩灰盒增加明确标识的特殊单向平台，并补齐普通实体平台专项。单向平台允许从下方跳过、从上方落地站稳和行走；实体平台保留原有阻挡。
- 前置：基线提交 `90f93e6`，run-w2kthX 三端自动化通过。开发前再次检查工作区及实际代码，保留已有实现。
- 依据：`PLAYER_CONTROL_DESIGN.md` 的“普通实体平台与特殊单向平台”“独立脚底检测区域与物理接触验证”、PC-01／PC-02、固定步、暂停及 Matter-first 正式规则。
- 模块：`src/physics/matter/graybox-world.ts` 管理平台分类和碰撞资格；`src/core/player.ts`／`graybox.ts` 保留平台无关语义，必要时最小扩展接口；`src/rendering/phaser/graybox.ts` 绘制清晰标识和可到达的测试区；真实 Matter 单测及现有三端用例补新增覆盖。
- 实现：固定模拟步内结合跨越前后的位置、方向判断单向碰撞资格，不能仅凭当前重叠即启用碰撞，也不能事后改坐标伪装穿越。算法与容差由开发者验证，不升级为最终设计。
- 支撑：穿越／忽略中的平台不得通过脚底重叠、侧面或旧接触恢复跳跃资格。有效落地仍须脚底区域、当步实体接触及支撑方向联合验证。
- P01：实体平台下方阻挡、上方承载及边缘离开正常。
- P02：单向平台自下跳过，不顶头或弹飞，尚未越过时不提前卡住。
- P03：自上落地、站立和行走稳定；支撑非 sensor 重叠假阳性，长按不重复跳跃。
- P04：平台附近短跳／顶点、未越过后回落、边缘和相邻实体地形不产生卡死或假落地。
- P05：自然走出边缘及土狼／缓冲正常；下方向键加跳跃不会主动下落穿透。
- P06：穿越或站立时重置、隐藏／最小化及恢复，不残留碰撞忽略、旧支撑或自动起跳。
- 测试：新增真实 Matter 受控用例，保留原 26 项，执行类型检查、构建和 Chrome Web＋Electron 开发＋独立包实际验证。记录 T02 及受影响 T01／T05／T06 子项，不宣称完整六组全部通过，Edge 未重测则 NOT RUN。
- 不做：移动／升降平台、任务、NPC、检查点、事件事务、正式美术、新依赖、技术改选、Commit／Push／发布。不大规模重写控制或测试框架。
- 人工体验：普通窗口人工项单独保留。提供正常启动入口和当前自动化截图，用户可自行体验；工具无法定位时记 BLOCKED，不修工具、不再增开独立验收任务。真正的新功能测试失败仍须修复，不能借此绕过。
- 风险：新碰撞规则可能污染实体接触、造成假落地或重置残留；同一问题两轮有效修复仍失败，提交最小复现与差异，由 Work 分析。完成后停止。

### D03 执行结果

2026-11-13：实现普通实体平台与特殊单向平台灰盒。Matter 适配层以独立碰撞类别和位置／方向状态控制单向资格；共享核心的输入、跳跃资格与运动规则未引入平台专属依赖。Phaser 仅增加紫色平台和文字说明。实际 `npm.cmd test` 为 32/32 PASS；`npm.cmd run electron:build` PASS；Chrome Web 专用平台用例与原有走跳、坡面、重置、暂停回归通过。[run-C3nYeL](../test-results/platform/run-C3nYeL/report.json) 的 Chrome Web、Electron 开发版和仓库外独立生产包全部 PASS，新增平台事件的隐藏 Tick 与恢复首帧分别为 1751→1751、1758→1758、1751→1751，非预期中断和清理失败均为 0。

首个 Chrome 定向 [run-mcrKWk](../test-results/platform/run-mcrKWk/report.json) 因测试阈值误写 FAIL：`solid-platform-b` 底面为 408、角色半高 22，理论最低中心 Y 为 430，实际真实接触为 429.95；修正断言后 [run-KTyv3D](../test-results/platform/run-KTyv3D/report.json) PASS，失败证据保留。当前 ASAR SHA-256 为 `A087F4C9C95610DC12D178CBBD9296DCD211BA5C028CF9DD3CA2DE298329D0C0`。

[Chrome 单向平台截图](../test-results/d03-20261113/one-way-platform-browser.png)显示 `one-way-platform-a` 有效支撑；[Electron 开发窗口截图](../test-results/d03-20261113/electron-dev-platforms.png)来自保留的正常 `npm.cmd run electron` 窗口。Computer Use 可读取及重启窗口，但不能可靠产生跨越游戏帧的持续按键，独立人工走跳仍为 BLOCKED／NOT RUN，不替代或改写三端真实键盘自动化结果。Edge 本轮 NOT RUN。T03／T04 未开发。

### D01-R3 审查结论与保留项

2026-11-12：Work 核对 [run-w2kthX](../test-results/platform/run-w2kthX/report.json) 并审查现有核心／物理边界与真实 Matter 用例。报告 task 字段沿用 D01-R2，按开发聊天与执行时间归于 D01-R3 的新回归，不修改原报告。Chrome Web、Electron 开发版与独立生产包均 PASS；18 个灰盒子项通过，unexpected-interruption 为 0，三个进程退出 0，cleanupFailures 为空。报告内 6 个测试文件及 ASAR 哈希均匹配当前文件。开发报告另记录 `npm.cmd test` 26/26 PASS；Work 本轮未重复运行平台或单测。

NAME-05 的当前自动化缺口据此关闭，D01、D02 在已实现范围收口。历史 R1／R2 停止记录、旧浏览器关闭原因及 Edge 未重测状态保留，不因新一次通过宣称旧根因已解决或长期稳定性全面通过。

普通 Chrome／Windows 窗口的独立人工操作与截图仍为 BLOCKED／NOT RUN，原因是 Computer Use 无法可靠定位浏览器 URL 后结束该轮。此限制不等于游戏功能失败，也不能改记人工 PASS。Work 不再把该重复人工通道作为 D03 前置；后续收集用户体验，发现具体缺陷再修复。D01-R3 整体仍未全部完成。

### D01-R2 任务卡

- 目标：移除 Web 测试对 Edge 可执行文件的硬编码，以 Chrome 为默认 Web 测试浏览器、Edge 为显式对照入口，验证中断是否随浏览器变化。本次是测试工程配置，不改变 Electron 或正式物理选型。
- 现状：D01-R1 任务为 BLOCKED，NAME-05 仍 FAIL，21 项单测已报告 PASS。两轮有效修改后仍发生非预期 blur；目前未证明属于应用缺陷。此项为 Work 根据停止证据安排的新受控实验，不是授权继续盲目重试。
- 范围：平台测试入口、必要的小型浏览器路径解析辅助与单测、README 和本路线图。保持灰盒用例、中断锁存、焦点／可见性判定、原生启动与 CDP 连接方式不变；不同时改变多个变量。
- 入口：支持 `--browser=chrome`、`--browser=edge`，不传默认 Chrome；与现有 `--web-only`、故障注入、开发／生产模式兼容。未知参数值明确报错；所选浏览器不存在时报 BLOCKED 并给出路径说明，不静默回退、不安装或替换浏览器。
- 身份：查找本机标准安装位置，包含用户级 Chrome；Chrome 与 Edge 均使用新的测试自有临时配置目录，禁止接管个人资料、清理用户缓存或更改系统默认浏览器。保留每次运行目录。
- 报告：记录请求浏览器、实际品牌、版本、可执行路径、所属 PID、启动参数、脚本／应用／产物哈希及前台／页面轨迹。测试结果必须能区分 Chrome、Edge 与 Electron；Electron 仍为自己的运行环境，不因选 Chrome 就跳过桌面测试。
- 测试：补默认值、显式两浏览器、未知值、路径缺失且不回退的单测；执行全部已有 21 项及新增测试。最终同一测试版本下各执行一次 `--web-only --browser=chrome` 与 `--web-only --browser=edge`，保留成功和失败。Chrome 定向通过后，再执行一次 Chrome Web＋Electron 开发＋独立生产包的完整回归。
- 控制变量：测试串行，不边测试边操作另一体验窗口；准备阶段允许正常激活，操作中不得自动抢回焦点、重放输入、关闭暂停、伪造可见性或放宽断言。不得把两个不同版本的运行当作严格对照。
- 若 Chrome 定向失败，先保留现场，不反复跑到通过；按两轮有效修复上限报告 Work。Edge 失败时继续保留原始状态和事件，不把它改记为 Chrome 结果，也不重新无限修复 Edge。
- 构建：若只改测试和文档，核对既有 ASAR 版本即可；不为选择测试浏览器升级依赖或重建应用。意外发现必须修改应用的缺陷时先报告，不在本任务中扩展游戏源码修复。
- 验收：选择器和报告准确，单测通过，对照已执行且结果真实；Chrome 定向通过则完整回归有新证据。对照可以记录 Edge FAIL，但不能宣称“所有浏览器通过”；NAME-05 是否收口由 Work 审查对照后决定，不因切换默认浏览器自动改 PASS。
- 不做：新玩法、新平台类型、新依赖、个人浏览器设置变更、历史证据改写、Commit／Push／发布。报告后停止，不领取 D03。

2026-11-12 D01-R2 执行结果：BLOCKED，等待 Work 审查。`npm.cmd test` 为 26/26 PASS。Chrome 定向 [run-PX4mYQ](../test-results/platform/run-PX4mYQ/report.json) 在第三次重启后的模拟运行阶段被 blur 中断；现场随后采样到 `magpie-windows-amd64` 前台 PID 28304，应用进入 hidden／Token 1 并冻结 Tick，未重放操作。Edge 定向 [run-NLRqlv](../test-results/platform/run-NLRqlv/report.json) 在灰盒短按／长按用例捕获 blur，保留 FAIL，未认定与 Chrome 同源。两次使用相同测试脚本和用例，Chrome `156.0.8078.74`、Edge `156.0.4314.58`；实际产品版本不同，不称浏览器同版本。Chrome 定向未通过，完整 Chrome＋Electron 回归 NOT RUN。未知浏览器值退出 1；缺失路径 [run-6ItWii](../test-results/platform/run-6ItWii/report.json) 为 BLOCKED、没有启动进程或回退 Edge。既有 ASAR `D15471D0BCFB6D2640A1B1103B6B3DD796099ED0BB0EC8D582CECC92DA76EBAF` 与更名版本基线一致，未重建。NAME-05 仍 FAIL，不领取下一项。

### D01-R1 任务卡与历史执行记录

- 目标：解决 NAME-05 的验收缺口。当前名称与功能实现保留，不重做命名或扩展物理能力。
- 已核对证据：`run-odchVH` 的坡面操作中 blur→hidden／Token 1 后超时；`run-31w8KP` 的页面／浏览器连接关闭；`run-nS0u4P` 三端通过。不能将前两者未经验证归为同一根因。
- 当前版本：`test-results/rebranding-20261112/verified-version.json` 的平台脚本、灰盒脚本与 ASAR 哈希均匹配本轮读取的文件；不是单纯引用过期报告。
- 涉及模块：`tests/platform-smoke.mjs`、`tests/graybox-browser.mjs` 及必要的小型测试辅助；仅证明确有应用缺陷时才修相关应用模块，不直接调整玩家或暂停参数掩盖问题。
- 必须记录：预期隐藏／关闭与非预期中断的区分，输入操作区间的可见性与焦点轨迹，page/context/browser 关闭、断连、crash 与原生进程退出的统一时间线，以及清理请求的发起时刻和所属 PID。
- 实现边界：准备阶段可通过真实窗口操作建立前置条件；操作中断不得自动重放按键或静默重跑用例。超时或失败后先保存现场，再清理自己创建的进程；不得关闭用户体验窗口。
- 验收：原 20 项测试通过；可控的失焦／隐藏及浏览器关闭场景能形成准确失败证据且正常清理；无干扰前提下两次定向 Web 验证及一次完整三端回归均执行并如实记录。用例失败不得改记 PASS，环境确实不具备时说明 BLOCKED，不追求刷次数得到绿色。
- 退出条件：同一问题两轮有效修复仍失败，提交最小复现、原始日志、差异与版本，交由 Work 分析；未满足验收不得宣称 D01 完成。
- 文档：README 记录当前结果；NAME-05 根据实际证据更新，保留历史失败。本轮 Work 已处理名称暂定状态，开发任务不进行新一轮品牌替换。
- 不做：单向／移动平台、任务剧情、事件事务、检查点、新依赖、技术切换、Commit／Push／发布。
- 下一项：通过后再评估 D02 的剩余覆盖，避免重复跑已等价覆盖的验证；尚未通过时不启动 D03。

2026-11-12 Codex 执行结果：BLOCKED，等待 Work 审查，不领取下一项。仅修改测试与工程记录，应用 16 个源文件／配置／锁文件和现有 ASAR 保持一致；无重新构建需求。原 20 项加中断锁存竞态回归 1 项共 21/21 PASS。两版定向 Web 分别为 `run-aXFnZF`、`run-07MJ9j`，均 FAIL；第二版记录到测试 Edge PID 36380 的前台 HWND 41423248→15338990→41423248，blur 先于清理，未重放按键或恢复焦点，具体内部窗口与触发来源仍未定位。已达到两轮限制，完整三端回归 NOT RUN，不把旧三端 PASS 用作本轮验收。

故障注入全部命令仍退出 1，和正常回归分开：`run-0uvjFC` 隐藏冻结／输入清理观察 PASS（第一版）；`run-V0C1Ia` 受控关闭的 page/context/browser/进程退出链及“先关闭、后清理”验证 PASS（第二版）。`run-FUfhkZ` 初版误把注入前 blur 算入关闭验证，原报告不改，补充审计判为 FAIL；已加注入请求必须先于中断的校验。`run-isv90S` 在隐藏注入前再次 blur，校验正确 FAIL，未执行隐藏，未算作注入成功。最终本地修正了截图等待期间操作先完成可能误报 PASS 的竞态，单测 PASS；该最终小改未再跑平台，遵守停止条件。完整日志、源码差异、版本、操作前置与最小复现见 [README D01-R1](../README.md#d01-r1web-中断诊断与停止记录)及 [证据汇总](../test-results/d01-r1-baseline/summary.json)。

待 Work 分析：先核对 Edge 同 PID 不同 HWND 的类型、测试后台页与浏览器窗口的关系，以及是否有测试工具／浏览器 UI 引发焦点切换；当前证据不证明具体原因，也不能倒推历史 `run-31w8KP` 的连接关闭来源。不调整玩家或暂停参数，不改变架构来规避。两个用户体验进程 38428、47600 保持运行。

每项仅补充以下必要信息，不新建提示词文件：

```text
任务 ID／状态：
目标与范围（含不做什么）：
依据与前置：
验收用例：
实际改动：
执行命令与结果：
证据路径及对应版本：
问题／阻塞／未覆盖：
下一任务：
```

历史报告不回填成后来才实现的功能。DONE 后出现回归，新增修复记录并修正受影响状态，保留旧证据。

## 8. 每批交付与人工体验

- 开发窗口完成实现、测试和自审；Work 用于阶段审查或疑难问题，不是每个任务的强制前置。
- 实际实现变化时才更新 README、进度与受影响文档，不为完整度扩增文档。
- 批次交付保留可见、可操作的入口与准确路径。自动化结束后另行正常启动体验窗口，保留到用户自行关闭；测试清理不能关闭该窗口。
- 普通任务间简短汇报，不必每次等待回复；决策关口、批次总结或中断时说明当前状态和下一步。
- 不自动 Commit、Push、修改密钥／CI/CD、删除文件或公开发布；范围外操作按 AGENTS.md 执行。

## 9. 本轮维护记录

2026-11-12：建立本统一路线图并补充协作入口。现有更名任务正在另一窗口执行，保留其变更；本轮不开发代码，不重新执行运行测试，不将历史交付或后续任务标为本轮 PASS。

2026-11-12 后续 Work 审查：更名已交付但 NAME-05 未通过，登记 D01-R1。重新执行 `npm.cmd test`，类型检查、Electron 编译及 20 项自动化测试 PASS；本轮未重跑浏览器／Windows 平台测试或生产构建，相关历史 FAIL 保留。当前测试脚本与 ASAR 匹配更名版本记录。名称按用户最新指示标为暂定工作名，未改变显示字符串或内部身份。

2026-11-12 D01-R2：完成 Chrome／Edge 显式入口、标准路径解析、临时配置和实际身份报告；新增 5 项选择测试，连同原 21 项为 26/26 PASS。Chrome 与 Edge 定向各执行一次且均因操作中 blur FAIL，保存现场并按实际状态停止；完整三端回归 NOT RUN。`git diff --check` 退出 0。历史 D01-R1 失败和用户体验窗口保留，没有 Commit、Push 或发布。

2026-11-13 D03：完成实体平台与单向平台专项。原 26 项加 P01–P06 六组真实 Matter 测试为 32/32 PASS；类型检查、Electron 编译、生产构建及 Chrome Web／Electron 开发／仓库外独立包 PASS。保留测试阈值误导致的 `run-mcrKWk` FAIL 及后续定向 `run-KTyv3D`、完整 `run-C3nYeL` 证据。Matter 仍不是最终物理选型，Edge、T03、T04 及独立人工走跳未通过或未执行，报告后等待 Work 审查，不进入 D04。

2026-11-13 D04：实现 `moving-horizontal-a` 与 `moving-vertical-a` 固定步承载、相对速度分离和调试重置。原 32 项加 M01–M06 六组真实 Matter 测试为 38/38 PASS；生产构建和三端平台定向 PASS。正式完整平台套件三次因交互中 blur FAIL，原始报告保留；Windows 原生最小化专项 BLOCKED，Edge NOT RUN。正常 Electron 体验窗口 PID 30508 保留。报告后等待 Work 审查，不进入 D05，不 Commit／Push／发布。

2026-11-13 D05：实现两个局部重叠的非实体诊断区域及进入／持续占用／离开状态，保留移动平台和既有走跳回归。原 38 项加 G01–G06 六组真实 Matter 测试为 44/44 PASS；生产构建及 Chrome Web／Electron 开发／仓库外独立包 D05 定向 PASS，非预期中断、页面错误与清理失败均为 0。历史完整平台套件 FAIL 与 Edge NOT RUN 保留；正常 Electron 体验窗口 PID 47016 保留。报告后等待 Work 审查，不进入 D06，不 Commit／Push／发布。

2026-11-13 D06：对同一版本完成物理灰盒阶段回归。44/44 单测与生产构建 PASS；首轮 `run-KRssuy` 暴露 M06 浏览器测试把“Tick 不回退”误写为采样时严格相等，三端 FAIL 原样保留。断言修正后 `run-Wo3C3j` 完整三端 PASS；`run-JY8AVr` 移动平台生命周期和 `run-twh8V6` 诊断区域三端定向 PASS。T01–T06 已实现子项、历史 FAIL、Edge NOT RUN、独立人工 BLOCKED 及检查点相关 NOT RUN 已汇总到 README。Matter 仍为候选；等待 Work 审查，不进入 D07，不 Commit／Push／发布。

2026-11-13 D07／D07-R1：D07 交付调查、拾取、单一目标、协调器控制限制和生命周期交互闭环；50/50 单测、生产构建、`run-obVH8m` 三端定向及 `run-HAkFWZ` 完整回归通过，首轮 `run-ALZnzH` 惯性断言 FAIL 保留。D07-R1 修复不可交互提示和重置松键门槛，修复前新增 R01／R02 均能复现失败，修复后 52/52 单测、生产构建及 `run-LTvqUU` 三端定向 PASS；`run-PkdgnR` 的 Electron 恢复焦点时序 FAIL 保留。按范围未重跑完整物理长套件，Edge NOT RUN、人工 BLOCKED 和业务功能 NOT RUN 继续保留；等待 Work 审查，不进入 D08，不 Commit／Push／发布。

2026-11-13 D08：新增运行内进度仓库、四类独立稳定业务 ID、收藏／目标／奖励幂等登记、显式永久效果状态及真实 Matter 测试路线门。原 52 项加 7 项进度／重建测试为 59/59 PASS；生产构建成功，`run-nlbzAQ` 的 Chrome Web／Electron 开发版／仓库外独立包 D08 定向 PASS，`run-xHiVwG` 的 Chrome Web D07 交互回归 PASS。R 保留本次页面运行内记录并重新应用 OPEN 效果，隐藏／最小化冻结且无自动重复交互。Edge NOT RUN、独立人工 BLOCKED、完整物理长套件 NOT RUN；跨会话存档、正式任务、事件事务与检查点仍未实现。等待 Work 审查，不进入 D09，不 Commit／Push／发布。

2026-11-13 D09-A1：新增共享核心运行上下文、注入式 UUID、共享单调 Event ID、Pending 生命周期登记、有限 Inbox 和协调器原子创建入口。原 59 项加 7 项事件测试为 66/66 PASS；生产构建成功。成功、非法输入、队列满、安全整数边界及七个准备／提交故障点均验证；可确认回滚不消耗编号、不留单独登记或队列项，未确认回滚会阻断后续创建。模块未接入 Web／Electron／D08，不含分发、终态、命令、事务、检查点或存档，GUI 与三端事件运行 NOT RUN。等待 Work 审查，不进入 D09 后续分段，不 Commit／Push／发布。

2026-11-13 D09-C2：完成唯一最终结果事件核心。正式 Succeeded／Failed 经 Manager authority 与受控 source 请求协调器原子创建新结果事件；结果携带原 Runtime／Event／Command／Transaction／target 关联。固定阶段结果通知分支不创建命令或重跑事务，故障恢复保持同 Event ID；结果 producer 独立确认／退役，退役后重复反馈仍沿用原身份。`npm.cmd test` 为 110/110 PASS，生产构建 PASS；源码／测试和 ASAR／EXE 哈希已登记。未接宿主，GUI／三端事务结果、检查点、存档和 Edge 为 NOT RUN。当前状态 DONE（待 Work 审查），不自动进入下一任务，不 Commit／Push／发布。

2026-11-13 D09-C2-R1：修复 Work 复现的保留结果类型公开入口。普通 create 在编号／登记前统一拒绝 `transaction.result`，内部受控结果路径显式放行；真实交付、测试替身及结果专用分发均阻止无权威关联的结果类型进入 handler／accept／consumer。修复前 R01／R02 红灯保留，修复后专项 8/8、全量 112/112、类型检查、生产构建和格式检查 PASS；G01–G06 合法结果创建、回滚、消费、确认与退役均未回归。纯核心仍未接宿主，GUI／三端事务结果、检查点、存档和 Edge 为 NOT RUN；R1 DONE（待 Work 审查），D09-C2 保持 BLOCKED，不 Commit／Push／发布。

<a id="brand-01-display-name-draft"></a>

## 2026-11-15 BRAND-01 界面名称同步交接草案（非当前实施任务）

状态：PLANNED（仅准备交接草案，待负责人审查与独立源码修改授权；非 READY，未启动）。本次名称任务只授权文档；不以该草案接替或推进 H5-01，不改变 D12-A3、D13 或既有测试结论。正式名称依据见[当前名称决策](DECISIONS.md#project-name-pokan-20261115)，盘点见[品牌交接](PROJECT_REBRANDING_HANDOFF.md#current-brand-20261115)。

目标：在后续获得授权后，以最小显示文字修改使 Web／共享 Phaser 画面和 Electron 运行时窗口使用“坡坎之间”，不出现未经确认的英文正式名，不修改玩法、输入或品牌资产。Windows 打包 productName／EXE 文件名另列待审，不纳入此草案。

当前事实：共享 PROJECT_IDENTITY、HTML 页面／恢复标题、Phaser 名称组合和 Electron 标题仍使用旧名；平台烟雾测试有对应旧名称断言。package.json 的 description 属开发者介绍，productName 属影响产物命名的打包元数据，两者本次保留。历史报告与现有产物不会因未来显示名修复被追溯改写。

### 可交给 Codex 的执行提示词（待单独批准后使用）

你负责 BRAND-01“玩家可见显示名称同步”。本提示词是路线图任务的唯一执行版本；当前为未启动草案，只有负责人另行授权源码修改并完成同文件交接后才执行。不要执行 H5-01、D13 或其他任务。

1. 开始前核对 GitHub 最新 main、HEAD、git status，阅读 AGENTS.md、DECISIONS.md 的 2026-11-15 当前名称决策、PROJECT_BRIEF.md、本任务及 PROJECT_REBRANDING_HANDOFF.md。保留 H5-01 等未提交修改；如果另一个窗口仍编辑同文件，先交接。若远端不同，列出影响，不自动合并、回退或覆盖。
2. 名称：当前中文为“坡坎之间”，英文名称未确定。旧英文工作名不得继续作为当前副标题，也不得自行翻译或把 PROPOSED 宣传语自动用于正式界面。保持 PROJECT_IDENTITY 的接口和所有运行身份，仅调整显示字段；空副标题不得残留“ · ”、“ | ”、空白占位或可访问标签中的旧英文。
3. 源码白名单：src/core/game.ts 仅 PROJECT_IDENTITY 显示常量；index.html 仅 title／恢复标题与 kicker 文案及必要隐藏呈现；src/rendering/phaser/startup.ts、graybox.ts、first-level.ts 仅名称、副标题显示／aria-label 拼接；electron/main.ts 仅启动错误框与 BrowserWindow 显示标题。不要修改这些文件中的启动、监听、输入、控制、暂停、恢复、渲染布局或物理逻辑。
4. 测试白名单：tests/platform-smoke.mjs 仅对应 Web title、#game aria-label、Electron window title 的名称预期；可以在现有测试文件中加入名称显示断言。不得修改可执行文件查找路径、测试路由、报告任务名、历史报告或其他业务断言。README.md 与本任务只补实际修改、版本、执行证据和未覆盖范围，不改正式设计。
5. 最小实施顺序：先盘点所有名称消费者；修改共享显示常量与 HTML；处理空副标题；修改 Electron 显示标题；更新相应名称断言；检查变更仅涉及显示。禁止全仓替换。
6. 不修改 package.json、package-lock.json、任何构建配置或技术标识；保持 package.name、appId、userData、MCLD_*、release/layered-city-adventures、Layered City Adventures.exe 以及所有业务／测试 ID。Windows 打包名称仍旧是本任务明确未覆盖项，不伪称全面品牌迁移。不得新增依赖、资产或通用品牌框架，不改地图、物理、PlayerMotor、触屏、生命周期或恢复核心，不提交、推送、发布。
7. 验证命令：先运行 npm.cmd test（不加参数，现路由为类型检查／Electron 编译与单元测试），然后 npm.cmd run build，最后 git diff --check。不得把带参数 npm.cmd test 的历史平台路由当作本任务小型名称验收，也不为改标题默认重跑完整三端长套件或 Windows 生产打包。
8. 真实 Chrome 定向验证：用当前 Web 入口检查浏览器标题、首关 #game aria-label、恢复标题、固定步／物理诊断场景名称；保留实际截图、地址与当前版本。短距离移动／跳跃及 NPC 正常交互只作显示修改回归，不宣称完成 H5 双设备验收。恢复标题可用现有受控路径验证，不新增任意快照写入或玩家常驻故障入口。
9. Electron 仅核对当前源码开发窗口标题及可触达的显示路径；启动错误框不能安全触发时明确 NOT RUN，静态核对单列。历史生产 EXE 的旧名不作为新代码验收失败或已完成证据。缺少真实设备／窗口能力时标记 NOT RUN 或 BLOCKED，不冒充真机或三端运行通过。
10. 验收：白名单内当前显示名一致；无新英文名／未确认宣传语；空副标题呈现自然；技术身份和路径不变；相关自动化通过；Chrome 运行证据匹配新源码；其他窗口修改保留；Windows 包名、商标与发行品牌事项明确未完成。
11. 停止条件：出现需要改白名单外核心／配置、业务行为变化、打包身份迁移、正式决策冲突或同问题两轮有效修复仍失败，保留最小复现、日志与版本交 Work。不要通过放宽断言、重复挑选 PASS 或删除证据继续。
12. 报告修改文件和精确范围、测试命令／退出码／PASS/FAIL/BLOCKED/NOT RUN、截图／运行入口／源码版本、保留的旧名称及原因、未完成事项和实际 Git 状态。完成后等待 Work 审查，不自动启动下一任务，不 Commit／Push。
