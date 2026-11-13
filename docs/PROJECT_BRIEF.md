# 《叠城大冒险》（Layered City Adventures）— 项目概述

更新日期：2026-11-13

本文记录已确认的项目需求、候选技术方案和待讨论事项，供后续策划与开发交接使用。已确认需求以项目负责人本次指示为依据；候选方案不代表最终决策。

## 项目当前信息与确认状态

| 项目 | 内容 |
| --- | --- |
| 英文名称 | Layered City Adventures（暂定，最终名称 PROPOSED） |
| 中文名称 | 叠城大冒险（暂定，最终名称 PROPOSED） |
| 世界观 | 具有山城特色的虚构立体城市 |
| 游戏类型 | 2D 横版平台探索冒险游戏 |
| 核心体验 | 跳跃、探索、解谜、发现 |
| 参赛赛事 | 2026 首届重庆市小游戏创新创业大赛 |
| 参赛赛道 | 第一赛道：“渝你同行”特色赛道 |
| 参赛形式 | 个人参赛 |
| 主要目标 | 争取比赛获奖 |
| 网页游戏 | 支持通过浏览器直接打开和游玩 |
| Windows PC 游戏 | 支持作为独立桌面程序运行 |

双平台支持是项目负责人确认的项目需求，不应表述为赛事强制要求。具体发布、打包及运行细节仍待确认。

总体世界观、类型与核心体验仍为 CONFIRMED。名称曾按 2026-11-12 的更名指示实施，后续长期协作指令明确其为工作名、尚未最终冻结，现按“Working Title Pending Final Confirmation”记录为最终名称待确认；原 [合并决策](DECISIONS.md#2026-11-12project-identity-update-layered-city-adventures) 保留历史。当前介绍：《叠城大冒险》（Layered City Adventures，均为暂定名）是一款以具有山城特色的虚构立体城市为舞台的 2D 横版平台探索冒险游戏，核心体验是跳跃、探索、解谜与发现。

历史名称为 Mountain City: Last Delivery／山城有路：最后一单，旧测试与里程碑仍按当时名称追溯。本次不从 Last Delivery／最后一单推导送货玩法，不改动关卡、任务、通关或技术规则。

真实地理适用性待核对的具体条目：下文旧主角“来到重庆”、关卡结构第 1 条“每个重庆地标对应一个独立关卡”、旅行纪念册“来到重庆”的叙事、首关 A/B/C/D 的真实地名以及《把山城夜景寄给远方》的现实景区委托。它们保留为原方案与资料，不再证明当前世界是现实重庆；其虚构世界映射、对白与命名未适配。本次不替换地名、不重写任务目标或通关条件，其他既有规则按原确认状态保留。

## 已确认的双平台架构

Single Codebase, Web-first, Shared Game Core（CONFIRMED，2026-11-09）。Web 和 Windows 共用同一代码库和一套权威游戏核心，使用相同的游戏规则与状态管理语义。第一阶段优先在 Web 开发和验证；Windows 必须复用共享核心，并在早期原型阶段验证兼容性，不能等到发布前。

- **共享游戏核心**：玩家控制、物理碰撞与模拟、Runtime Lifecycle Controller、NPC 与交互、任务进度、Event Inbox 与协调器、Transaction Manager、Checkpoint Capture、Checkpoint Recovery、永久世界进度。
- **平台适配层**：游戏启动、窗口管理、输入设备接入、平台存储、平台生命周期信号接入与转换、日志输出、构建与发布（含打包）。

平台 API 由适配层处理，不进入核心玩法逻辑。适配层接入输入设备，将平台生命周期信号转换为平台无关通知；共享核心的 Runtime Lifecycle Controller 管理运行时生命周期，不接管玩家控制或检查点恢复。适配层提供存储能力，核心定义快照和永久进度的状态语义。完整规则见 [DECISIONS.md](DECISIONS.md)。

### CONFIRMED：Electron Desktop Shell with Shared Renderer

确认日期：2026-11-11。第一版 Windows 正式采用 Electron，不同时引入 Tauri。Electron Main 只负责启动、窗口和桌面应用生命周期及必要的原生能力协调；Renderer 复用现有 Web 游戏入口、Phaser 场景和共享核心。Electron 是桌面容器，不是游戏引擎，不在 Main 中实现玩家控制、物理、任务或关卡，也不复制 Windows 玩法逻辑。

开发时加载 Vite 开发服务，生产时加载随应用打包的本地游戏资源。共享核心不依赖 Electron、Node.js 或 Windows API；平台差异由适配层转换，生命周期通知交给共享核心控制器按既有暂停协议处理，不直接修改业务或控制模拟。

Renderer 禁用 nodeIntegration，启用 Context Isolation 与 Process Sandboxing，保持 webSecurity。禁止不受信任的远程代码，限制导航与新窗口；不暴露完整 ipcRenderer，确需 IPC 时限制通道和参数。无需原生能力时不创建 Preload API；确需时仅暴露最小权限接口。生产环境优先安全本地加载；若使用 file://，须记录原因与安全措施。完整 19 条规则和安全约束见 [DECISIONS.md](DECISIONS.md)。

M1.1.2 工程已采用 Electron 44.11.1、electron-builder 26.18.0、安全本地协议与 Windows x64 免安装应用目录；应用 ID 暂用 io.mountaincity.lastdelivery。正式安装器、图标／安装界面／发行元数据、原生存储及未来必要的 Preload／IPC 仍待设计。代码签名、自动更新、macOS、Linux 及正式发布流水线不属于第一版要求。

### M1.1 实际进度

核对日期：2026-11-11。依据为现有 [README.md](../README.md)、工程文件与“开发”聊天中的 M1.1 报告。下表沿用该报告的结果，本轮未重新安装依赖、构建或运行测试。

| 验收项 | 原 M1.1 报告状态 | 当前文档核对 |
| --- | --- | --- |
| M1.1-01 至 -06：安装、Web 启动、核心加载、渲染、核心平台隔离、生产构建 | PASS | M1.1.2 已从最终锁文件执行干净安装，复测 Web，完成类型检查与 Web 构建。 |
| M1.1-07：Windows 桌面启动 | BLOCKED | M1.1.2 实测已更新为 PASS：开发命令创建可见窗口；本地生产包移出仓库后连续两次启动、渲染和关闭成功。 |
| M1.1-08：双端共用核心 | BLOCKED | M1.1.2 实测已更新为 PASS：同一 HTML、入口和核心／场景引用；打包资源与 Web 构建逐字节一致。 |
| M1.1-09：运行与构建说明 | PASS | README 已更新为实际验证过的 Web 与 Electron 安装、开发、构建和启动命令，并记录验证边界。 |

M1.1.2 交付时结构为 src/core/game.ts（启动数据与共享入口）、src/rendering/phaser/startup.ts（Phaser 启动场景）、src/platform/web/main.ts（Web 挂载、日志、销毁与重启）及相关页面、样式和配置。当时是静态启动骨架，不代表玩家控制、Runtime Lifecycle Controller、物理模拟、任务或检查点已经实现。后续工程进度见下节；Matter 的 T01–T06 与首关 MVP-G01–G06 仍未执行。

2026-11-11 M1.1.2 实施后：Electron 壳、共享 Renderer、安全本地协议及应用目录已实现，开发版和独立生产包均完成启动、画布、重启、最小化／恢复、导航限制与原生关窗退出验证。仅验收静态启动，不表示固定模拟步、暂停令牌或物理生命周期已实现。详细证据与 M1.1 九项验收见 [README.md](../README.md)，等待项目负责人验收，不自动进入 M1.2。

### M1.2.1 工程验证进度

2026-11-11，依据项目负责人明确分配的开发任务，完成固定步模拟与生命周期暂停的最小闭环，等待审查。本节为实施事实，不改变 CONFIRMED 决策或将原型参数升级为最终设计。

- 共享核心新增 FixedStepSimulation 与 RuntimeLifecycleController，实际 Tick、累加器、有限补算、完整积压丢弃、余量保留及 Owner + Request Key／Token 协议均已接入。
- 原型值为 20 ms／步、每帧最多 5 步，仅推进简单标记和诊断；没有正式玩家、物理或业务事件。
- Web 与 Electron 共用 Renderer visibilitychange 适配；真实标签页隐藏和原生最小化均可暂停，恢复首帧重建基线。未增加 Preload 或 IPC，未修改永久进度或业务 ID 规则。
- 11 组自动化测试、Web／Electron 开发／仓库外生产包的双轮隐藏恢复与连续三次重启回归通过。一次较早平台重启等待超时未确认根因，后续复测通过；证据只覆盖当前本机环境。
- 具体命令、逐项验收和限制见 [README.md](../README.md)。Matter T01–T06、MVP-G01–G06 仍为 NOT RUN；不自动进入下一开发任务。

### M1.2.1-R1 就绪与重启排查

2026-11-11，依据明确分配的排查任务，仅调整平台测试与证据输出，不修改 CONFIRMED 决策或应用行为。原 ready() 在真实窗口准备前要求 Tick 增长，误判符合规则的隐藏暂停页面；现将页面加载、场景就绪和可见后模拟运行分开检查。真实最小化后重载复现 Tick 0／Token 1，旧检查按原 15 秒预算超时；恢复窗口后首帧 Tick 仍为 0，随后继续推进。七个相关应用源文件哈希未变。

11 项单元测试与生产构建通过，完整平台测试连续三轮全部 PASS；每轮覆盖 Web、Electron 开发版、仓库外生产包，以及每端两轮隐藏恢复、三次重启和隐藏启动。已保存截图、原生窗口／页面状态、销毁与导航记录、进程退出与服务清理证据；故障注入的预期 FAIL 与 NOT RUN 记录未删除。

原独立生产包初始为何 hidden、早先重启超时是否同源，均不能从现有证据确认；保留历史未定位记录，不因三轮通过宣称长期稳定。详见 [README 的 R1 记录](../README.md#m121-r1-就绪与重启排查)，完成后停止，等待审查。

### M1.2.2 可操作角色与基础物理灰盒

2026-11-12，按本次明确任务增加独立物理灰盒；默认可用 A/D 或方向键移动、Space 跳跃、R 调试重置，原固定步诊断场景仍可切换。两端复用 Phaser 内置 Matter 0.20.0 世界和角色规则；Matter 自动更新关闭，仅共享固定步推进。灰盒工程值为 60 Hz、每帧最多 5 步，诊断场景保留原 20 ms；数值、键位及接口不升级为正式参数。

实现平滑加减速、反向减速、空中控制、可变跳高、100 ms 土狼时间和 130 ms 单次缓冲；PC-01 输入许可与运动状态分离，PC-02 松键门槛防止恢复后自动跳跃。独立脚底区域结合实际实体接触法线验证支撑；包含地面、墙壁、低天花板、实体平台、间隙和连续坡面。R 只重置灰盒角色，不是检查点恢复。

20 项自动化测试（含原 11 项）、类型检查、Web／Windows 生产构建通过。最终当前平台脚本 run-LYLeed 在 Web、Electron 开发版、仓库外独立生产包通过：长短跳最低中心 Y 约 433.88／382.11，坡面静止 X 漂移 0；灰盒隐藏／恢复首帧 Tick 分别保持 1256、1253、1247。保留每端原诊断场景两轮隐藏及三次重启回归；Edge 需限定自己 PID 树清理的 Warning 及开发中失败均有保留。具体命令、截图、问题修复及 T01–T06 子项记录见 [README](../README.md#m122-物理灰盒实现)。

未实现单向／动态／升降平台、触发器业务、任务或检查点；不宣称完整物理验收或首关验收通过，最终物理引擎仍待确认。完成后停止，等待审查。

### D01-R3 工程审查与当前任务

工程进度补充（2026-11-12，D01-R3）：Work 核对 run-w2kthX 的 Chrome／Electron 开发／独立生产包自动化均 PASS，并确认当前测试文件和 ASAR 版本匹配；开发报告单测为 26/26 PASS。NAME-05 按当前自动化范围收口，普通窗口人工体验因工具定位限制仍 BLOCKED／NOT RUN，不冒充已执行。允许推进 D03 实体／单向平台；旧失败、Edge 未重测和最终物理选型未定的边界保留。当前任务与命令／证据分别见 [路线图](DEVELOPMENT_ROADMAP.md)及 [README](../README.md)。

### D03 工程审查与 D04 任务

2026-11-13：Work 复核实体／单向平台代码、当前脚本与产物版本及 run-C3nYeL 三端证据，并重新执行 32/32 单测通过，D03 在当前原型范围验收完成。下一项为水平往返平台与垂直升降平台承载，不提前引入任务机关或检查点；物理仍为 Matter-first 验证候选，完整 T03／T04、最终选型、Edge 与独立人工走跳不因此通过。详细范围与验收见 [路线图 D04](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)，工程命令和证据见 [README](../README.md)。

### D04 工程审查与 D05 任务

2026-11-13：Work 按当前原型范围验收 D04 移动／升降平台及 D04-R1 生命周期专项。核对 `8fc32d1` 源码、`run-KPoUKj` 三端报告与生产 ASAR 哈希，并重新执行类型检查、Electron Main 编译和 38/38 自动化测试 PASS；真实隐藏／原生最小化、恢复无追赶及持键门槛以匹配版本的专项证据为依据，本轮未另跑 GUI。历史完整平台长套件 FAIL 继续保留，Edge、独立人工体验与完整 T01–T06 不因此通过，Matter 仍为候选。下一项 D05 仅实现物理诊断触发区域及进入／占用／离开记录，不提前接入任务、机关或检查点。详见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)，执行窗口完成后等待 Work 审查。

### D05 工程执行状态

2026-11-13：D05 已在灰盒加入两个局部重叠的非实体 Matter 诊断区域，按实际固定步独立记录进入、持续占用和离开；区域不阻挡、不承载、不授予跳跃资格。原 38 项加 G01–G06 六组真实 Matter 测试为 44/44 PASS，生产构建成功，`run-2Ch7Xr` 的 Chrome Web、Electron 开发版及仓库外独立生产包定向验证均 PASS，真实隐藏／最小化期间状态与 Tick 冻结，恢复无重复进入或后台追赶。历史完整平台套件 FAIL、Edge NOT RUN 继续保留；本结果只覆盖诊断区域，不代表完整 T04、业务触发、检查点或 T01–T06 已通过，Matter 仍为候选。详见 [README](../README.md#d05物理诊断区域与生命周期)和[路线图执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d05-执行结果)；该段保留 D05 完成时的状态，后续 D06 执行结果见下节。

### D05 Work 审查与 D06 任务

2026-11-13：Work 按 `92cc389` 源码及 `run-2Ch7Xr` 三端报告核对 D05 诊断区域，当前源码／脚本和生产 ASAR 哈希一致，本轮重跑类型检查、Electron Main 编译和 44/44 自动化测试 PASS；GUI 专项和生产构建依据已核对版本的开发证据，本轮未重新执行。D05 在诊断范围验收收口，下一项 D06 汇总并回归现有物理灰盒能力，整理六组子项证据及体验入口，不新增功能。历史完整套件 FAIL、Edge／独立人工未执行、未实现检查点相关用例继续明确保留；Matter 最终方案不因此确认。详见[路线图 D06 任务卡](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。

### D06 工程执行状态

2026-11-13：D06 对同一版物理灰盒完成阶段回归，未新增玩法或修改玩家、输入、物理、暂停及平台规则。首轮 `run-KRssuy` 三端均因既有浏览器测试把“调试重置不得回退 Tick”误写为重置返回后的采样必须严格相等而 FAIL；实际 Tick 在重置返回与采样之间继续正常前进。断言修正为不回退后，原始 FAIL 保留，完整套件 `run-Wo3C3j`、移动平台生命周期 `run-JY8AVr` 和诊断区域 `run-twh8V6` 的 Chrome Web、Electron 开发版及仓库外独立生产包均 PASS。

`npm.cmd test` 为 44/44 PASS，生产构建成功，当前 ASAR SHA-256 为 `C1C3C9B366B1A88F885DF1FE917A898BA6143BADC8C0DDF33FA6F6710F01A3F2`。已实现 T01–T06 子项及重置、隐藏／最小化、平台和诊断区域的当前证据已集中维护在 [README](../README.md#d06物理灰盒阶段回归)；Edge、独立人工操作、移动单向／旋转／挤压、正式业务触发器、Event Inbox、完整检查点和 RecoveryError 仍未覆盖，历史失败继续保留。结论仅为已实现灰盒范围具备进入 D07 的工程建议，不代表完整 T01–T06、完整恢复架构或 Matter 最终选型通过；等待 Work 审查，不自动进入 D07。

### D06 Work 审查与 D07 任务

2026-11-13：Work 保留 D06 四文件未提交改动，核对 `run-Wo3C3j`、`run-JY8AVr`、`run-twh8V6` 全部版本条目、三端 PASS 和正常清理记录，确认异步重置采样改为 Tick 不回退与同步真实 Matter 测试一致。本轮重跑类型检查、Electron Main 编译和 44/44 单测 PASS，未重新执行 GUI 或生产构建。D06 在已实现灰盒范围收口，下一项 D07 制作占位调查／拾取反馈的主动按键交互原型，验证单一提示、目标选择、控制限制及生命周期，不新增主线任务、永久进度或检查点。旧失败、人工 BLOCKED、未覆盖业务恢复及最终物理方案待确认的边界继续保留，具体执行[路线图 D07 任务卡](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。

### D07 工程执行状态

2026-11-13：D07 已在现有双端共享灰盒实现统一交互原型。两个调查对象 A／B 的范围局部重叠，按朝向、距离和稳定对象 ID 选择单一主要目标；拾取 C 只显示 `1200 ms` 临时反馈。E 的按下／释放、repeat 去重、失焦释放门槛、暂停判定和一次消费位于共享核心，调查通过现有 `PlayerControlCoordinator` 的独立 owner 限制移动与跳跃，结束只释放自身限制。交互候选与反馈只随真实固定步推进；隐藏／最小化恢复不自动重开或重复交互，调试重置与场景切换清理临时状态。

原 44 项加 6 组交互及真实 Matter 集成测试后，`npm.cmd test` 为 50/50 PASS；生产构建成功。最终 `run-obVH8m` 的 Chrome Web、Electron 开发版和仓库外独立生产包交互专项均 PASS，`run-HAkFWZ` 的当前版本完整三端回归亦 PASS。首轮 `run-ALZnzH` 三端 FAIL 保留：原断言未允许调查锁生效前的既有惯性减速，实际滑行约 `2.67–7.22 px` 后速度归零；修正后的断言仍验证输入锁、无自动跳跃、稳定位置和暂停语义。

正式产物 ASAR SHA-256 为 `9FAE0259711801B3CD57DB71381F8A343C0C17C0E44B2A7B5218DFF70E1BE641`。I01–I07 当前原型范围已完成验证；Edge NOT RUN、独立人工长期按键 BLOCKED，正式任务、奖励、永久进度、业务 Event／Command／Transaction、检查点和 RecoveryError 仍为 NOT RUN。Matter 仍为候选，详见 [README](../README.md#d07统一交互原型)和[路线图 D07 执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d07-执行结果)。当前等待 Work 审查，不进入 D08。

### D07 Work 审查与局部修复

2026-11-13：Work 核对 `run-obVH8m` 与 `run-HAkFWZ` 的三端 PASS、全部版本哈希和正常清理记录，并重跑类型检查、Electron Main 编译及 50/50 自动化测试 PASS。本轮未重跑 GUI。核心复现另发现：不可交互时仍给出可操作提示，以及失焦后重置清除既存 E 松键门槛。已有验证结果保留，但 D07 暂不整体验收；下一项仅为 D07-R1 两项局部修复和定向回归，不进入 D08 永久进度。具体复现与范围见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)，不修改正式控制规则或技术选型。

### D07-R1 工程执行状态

2026-11-13：交互提示现在仅在输入可用、模拟未暂停、控制协调器允许交互、E 无待释放门槛且当前未按住 E 时显示；隐藏、暂停或外部控制阻塞期间提示为空，真实焦点和可用性恢复后重新显示。调试重置改用既有松键门槛与当前 held E 的并集，不会因失焦已清空 held 而绕过“先释放再按”的要求。

新增 R01／R02 测试先分别复现提示错误显示和重置清除松键门槛，修复后 `npm.cmd test` 为 52/52 PASS，生产构建成功。D07 定向首轮 `run-PkdgnR` 保留：Electron 两种模式在可见但尚未聚焦时正确保持控制与提示不可用，原测试过早要求恢复；最终 `run-LTvqUU` 的 Chrome Web、Electron 开发版和仓库外独立生产包均 PASS，隐藏时提示消失、焦点恢复后重新显示，重置后无 keyup 不触发、收到 release 后才允许下一次单次交互。

当前 ASAR SHA-256 为 `958B8B18379FD2E5FEF83F3401F686CB0CD694FDAFD3255DBF1733E7FB99848C`。本任务未重跑完整物理长套件；历史 FAIL、Edge NOT RUN、独立人工长期按键 BLOCKED，以及正式任务、永久进度、业务事件事务和检查点 NOT RUN 继续保留。Matter 仍为候选，详见 [README](../README.md#d07-r1提示可用性与重置松键门槛)和[路线图 D07-R1 执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d07-r1-执行结果)。当前等待 Work 审查，不进入 D08。

### D07-R1 Work 复审与 D08 任务

2026-11-13：Work 核对交互提示资格、重置保留 E 松键门槛及对应回归测试，`run-LTvqUU` 三端报告全部版本条目与当前文件一致，三个退出码 0、清理失败为 0。本轮重跑类型检查、Electron Main 编译及 52/52 单测 PASS，未另跑 GUI 或生产构建。D07-R1 两项缺口关闭，D07 按当前原型范围收口；历史 FAIL、Edge NOT RUN、人工 BLOCKED 不变。下一项 D08 仅实现内存中的永久业务记录与临时状态分离、唯一 ID 去重、奖励只记一次及永久效果可重复协调，使用测试内容，不实现磁盘存档、正式任务、事件事务或检查点。范围、运行内保留边界和验收见[路线图 D08](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。

### D08 工程执行状态

2026-11-13：D08 已在共享核心实现 `InMemoryRunProgress`，分别保存测试收藏、已完成目标、已领取奖励和永久效果。四个稳定业务 ID 独立配置，目标到奖励／永久效果使用显式关系；无效或未知请求返回拒绝且不污染记录，只读快照不暴露内部集合。灰盒新增测试收藏 D、测试目标 E，并复用 D07 主动 E 入口；目标完成后由真实 Matter 碰撞 mask 打开测试路线门，重复协调始终设置 `expectedActive=true`。R 清理玩家、交互、平台与区域临时状态后，由同一仓库重新应用 OPEN，不清空本次页面运行内记录。

原 52 项加 3 项纯进度测试和 4 项真实 Matter 重建测试后，`npm.cmd test` 为 `59/59` PASS，生产构建成功。`run-nlbzAQ` 的 Chrome Web、Electron 开发版和仓库外独立包 D08 定向全部 PASS，三端均验证 `0/0/0/0 → 1/1/1/1 → R 后 1/1/1/1`、测试门保持 OPEN，并在真实隐藏／最小化超过 `1200 ms` 时不改记录或重放交互；`run-xHiVwG` 的 Chrome Web D07 交互回归 PASS。

当前 ASAR SHA-256 为 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`，Windows EXE SHA-256 为 `BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`。这里的“永久”只指同一页面运行内，整页刷新／场景重载会新建空仓库；跨会话存档、正式任务／收藏册、奖励内容、Event／Command／Transaction、检查点和 RecoveryError 仍为 NOT RUN。Edge NOT RUN、独立人工长按 BLOCKED、完整物理长套件按范围 NOT RUN，Matter 仍为候选。详见 [README](../README.md#d08运行内进度与幂等应用原型)和[路线图 D08 执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d08-执行结果)。当前等待 Work 审查，不进入 D09。

### D08 Work 审查与 D09-A1 任务

2026-11-13：Work 阅读运行内进度、世界效果与重置代码，核对 `run-nlbzAQ` 三端 PASS 及全部当前版本哈希、正常退出与清理记录；本轮重跑类型检查、Electron Main 编译和 59/59 测试 PASS，未重跑 GUI 或生产构建。D07 补充报告 `run-xHiVwG` 仅 Web PASS，Electron 两端 NOT RUN，不能推导为三端交互回归。D08 在内存进度与临时世界分离的原型范围收口，整页重载后新仓库等限制保留，不代表正式 Runtime Instance 生命周期或跨会话存档完成。

下一项 D09-A1 只实现核心层运行上下文和统一事件创建／Pending 登记／Inbox 原子提交，以单测和模块集成验证成功／失败的一致性；不迁移 D08 接线、不接管宿主场景切换、不提前实现分发、命令、事务或检查点。正式身份、原子创建规则保持原状，接口／UUID 工程选择不自动成为正式决策。具体范围和 A01–A05 验收见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。

### D09-A1 工程执行状态

2026-11-13：共享核心新增 `RuntimeEventContext` 与 `EventCreationCoordinator`。运行上下文通过注入的 `RuntimeUuidProvider` 获取一次运行 UUID，并持有从 `1` 至安全整数上限的共享 Event ID 序列，每个上下文最多创建一个协调器；当前 Web／Electron 入口尚未创建或使用该上下文，因此不表示正式运行身份已贯穿场景。协调器是唯一公开创建入口，统一提交候选 Event ID、Pending 生命周期记录和有限 Inbox，提交成功后才返回冻结事件；创建不执行 handler、不推进 Tick，也不接 D08 行为。

故障注入覆盖校验、候选准备、登记准备、Inbox 准备及三个提交点。可确认失败会回滚编号、登记和队列，下一次创建仍使用未消耗编号；无法确认回滚时后续创建被阻断，快照提供 `rollback-unconfirmed` 错误。A01–A05 全部 PASS，`npm.cmd test` 为 `66/66` PASS，生产构建成功。该模块尚未接入宿主，GUI／三端事件运行、分发、Processing／Completed、Producer Acknowledgement、水位线、命令、事务、检查点和存档均为 NOT RUN。设计中的 CONFIRMED 规则未被工程数据结构改写；Matter 仍是候选，当前等待 Work 审查，不进入 D09 后续分段。

### D09-A1 Work 审查与 D09-A2 任务

2026-11-13：Work 按当前 `3f27478` 核对事件创建、生命周期登记、有限 Inbox、故障回滚和安全整数测试，源码／测试哈希与报告一致，本轮重跑类型检查、Electron Main 编译及 66/66 单测 PASS，未重跑 GUI 或生产构建。D09-A1 在纯核心范围收口，模块尚未进入现有玩法包入口，ASAR 与 D08 一致并非宿主事件运行通过。

下一项 D09-A2 只增量实现固定阶段单轮分发、Pending 实际分发前转 Processing、原事件防重及异常保留。Accepted → Completed 仅用明确标注的命令接收测试替身验证，不等于真实命令／事务已接入；生产者确认、退役水位线、实际业务接线与检查点仍后续实施。范围与 B01–B05 验收见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)，不改正式规则或最终技术选型。

### D09-A2 工程执行状态

2026-11-13：D09-A2 已在现有创建内核上完成纯核心固定阶段分发。`EventCreationCoordinator.dispatch()` 只接受与运行上下文一致的 `coordination` 阶段和严格递增的实际 SimulationTick；阶段进入时固定 Inbox 批次，逐事件在实际调用 handler 前执行 Pending → Processing。handler 产生的后生事件只进入 Inbox，下一合法阶段才处理；递归分发与重复／倒退阶段不新增轮次。

只有 handler 正常结束且明确注入的测试命令接收替身返回 Accepted 后才执行 Processing → Completed，测试命令引用与 Event ID 独立。`probeRedelivery()` 校验 Event ID、Runtime Instance UUID、type、payload 和当前生命周期，Processing／Completed 后不会因 Inbox 移出而再次执行；其他 runtime、载荷篡改与未知事件均拒绝。handler、状态转换或接收失败会保留当前事件与未处理项、记录可检查失败并阻断后续分发，不自动重试。Pending／Processing／Completed 记录不再自动清理，有限历史容量达到上限时拒绝新建且不消耗 Event ID。

B01–B05 核心／模块集成测试及原 A01–A05 均 PASS，`npm.cmd test` 为 `75/75` PASS，类型检查、Electron Main 编译和生产构建成功。当前 Web／Electron 宿主仍未接入事件协调器，因此 Chrome／Electron 业务事件三端运行、Edge、真实 Command ID Generator、命令接收、事务意图／结果事件、生产者确认、水位线清理、检查点和存档均为 NOT RUN。测试替身不升级为正式事务设计，CONFIRMED 决策与 Matter 候选状态不变。详见 [README](../README.md#d09-a2固定阶段单轮分发与事件防重核心) 和[路线图执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d09-a2-执行结果)；当前等待 Work 审查，不进入后续任务。

### D09-A2 Work 审查与 D09-A3 任务

2026-11-13：Work 按 `b6cf8eb` 核对固定阶段单轮分发、事件防重及异常保留代码与哈希，本轮重跑类型检查、Electron Main 编译及 75/75 测试 PASS，未另跑生产构建或 GUI。D09-A2 在纯核心范围收口，Accepted → Completed 仍仅证明测试接收替身合同，不代表真实命令／事务或宿主事件运行通过。

下一项 D09-A3 实现生产者最终处理结果与显式确认、安全清理、连续退役水位线和缺口轻量记录；未完成／未确认事件不清理，清理后旧 ID 仍拒绝，并验证完整与轻量记录均不会无界增长。仍不接宿主、真实业务、检查点或存档，范围和 C01–C06 验收见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。工程接口与容量策略不升级为正式架构决策。

### D09-A3 工程执行状态

2026-11-13：D09-A3 已在纯核心事件内核上完成生产者结果、显式确认与安全退役。协调器通过不可伪造的 producer 句柄和 Completed 结果 capability 校验身份；只有结果已提供给正确生产者、已显式确认、事件不在 Inbox 且没有活动分发轮次时才删除完整记录。确认和退役分别幂等，确认本身不清除记录。连续退役水位线与缺口轻量 ID 共同拒绝旧 Event ID；完整记录与轻量记录共享 `historyCapacity` 预算，满时拒绝新建且不消耗编号，清理后编号继续递增。清理故障保留完整记录或有效退役防重信息，不重开 Completed、不重发命令或重跑 handler。

C01–C06 全部 PASS，原 75 项语义保留；`npm.cmd test` 为 `81/81` PASS，类型检查、Electron Main 编译和生产构建成功。当前 Web／Electron 宿主仍未使用事件协调器，因此 GUI／三端业务事件、Edge、真实命令接收、事务、结果事件、检查点和存档均为 NOT RUN；Accepted 仍是测试替身。这里的旧 ID 永久拒绝仅指同一 Runtime Event Context 运行内，不表示跨会话存档或持久化保证。Matter 仍是候选，详见 [README](../README.md#d09-a3生产者确认与连续安全退役核心)和[路线图执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d09-a3-执行结果)。当前等待 Work 审查，不进入后续任务。

### D09-A3 Work 审查与 D09-B1 任务

2026-11-13：Work 按 `6038571` 核对生产者／结果 capability、确认、退役水位线、组合容量和清理故障处理，源码与三份事件测试哈希匹配交付报告，本轮重跑类型检查、Electron Main 编译及 81/81 单测 PASS，未重跑构建或 GUI。D09-A3 在纯核心范围收口，旧 ID 拒绝仅在所属运行上下文内有效，Accepted 仍为测试替身，现有可玩包没有接入事件内核。

下一项 D09-B1 实现运行实例级独立 Command／Transaction 编号、稳定命令、目标模块幂等接收，以及接收记录／事务创建意图／身份关联的原子提交。Accepted 不代表事务执行成功，失败事务编号不回收；真实业务执行、四类交付联调／Unknown 核查、结果事件、宿主与检查点仍后续安排。具体范围与 D01–D06 验收见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)，工程接口和数据结构不升级正式决策。

### D09-B1 工程执行状态

2026-11-13：D09-B1 已在纯核心完成稳定命令与目标事务模块的原子接收意图。运行上下文独立维护 Event、Command、Transaction 三套序列；命令协调器以受控源事件校验保证单事件最多一条稳定命令，目标模块以不可伪造 command capability 校验 runtime 与 target。首次接收在容量检查后分配 Transaction ID，并原子提交 Accepted receipt、`intent-created` intent 及四套身份关联；重复命令返回原关联，篡改身份拒绝。提交失败回滚 receipt／intent，但已分配 Transaction ID 不回收、不补洞；无法确认回滚时目标模块保守阻断。

D01–D06 全部 PASS，原 81 项语义保留；`npm.cmd test` 为 `87/87` PASS，类型检查、Electron Main 编译和生产构建成功。Accepted 只表示接收意图提交成功，不表示事务启动、执行或业务成功；业务执行次数固定为 `0`。当前 Web／Electron 宿主仍未使用事件或命令内核，因此 GUI／三端业务链、Edge、四类交付结果联调、Unknown 核查、真实事务、结果事件、检查点和存档均为 NOT RUN。Matter 仍是候选，详见 [README](../README.md#d09-b1稳定命令与原子事务接收意图核心)和[路线图执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d09-b1-执行结果)。当前等待 Work 审查，不进入后续任务。

### D09-B1 Work 审查与 D09-B2 任务

2026-11-13：Work 按 `6ff9d24` 核对稳定命令、目标幂等接收和原子意图提交／事务编号空洞，events／commands 源码及 commands 测试哈希与报告一致，本轮重跑类型检查、Electron Main 编译及 87/87 单测 PASS，未重跑构建或 GUI。D09-B1 在纯核心接收范围收口，事务尚未启动，事件成功分支仍用 Accepted 测试替身。

下一项 D09-B2 将事件协调器接到真实接收模块，验证四类交付结果及 Unknown 按原 Command ID 核查：已接受不重交，确认未接受后按原因区分可重试或拒绝，不明确继续 Unknown。仍只做核心模块联调，不执行游戏业务、不接宿主，不提前实现事务最终反馈或检查点。范围与 E01–E06 验收见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)，不擅自确认异常事件终态或自动重试参数。

### D09-B2 执行结果

2026-11-13：真实事件交付核心已接通现有目标事务接收模块。Accepted 只在目标原子接收且四套身份关联验证一致时完成原事件；Retryable 只在确认未接收并具有临时故障证据时成立；永久故障为 Rejected；回滚不确定、调用异常、目标 blocked、查询失败及关联不一致保持 Unknown。Unknown 后续只按原 Command ID 查询，不重跑 handler 或重新接收；Retryable 只在合法协调阶段显式触发，沿用原 Event／Command，未形成意图的失败仍保留事务编号空洞。

旧测试接收替身与真实交付路径互斥并保持明确区分。E01–E06 全部 PASS，原 87 项测试保留，`npm.cmd test` 为 `94/94` PASS，类型检查与生产构建通过。Accepted 仍只表示目标接收，intent 保持 `not-started`，业务执行数为 `0`；真实游戏事务、最终结果事件、宿主接线、检查点、存档和 GUI／三端业务链均不属于本段，仍为 NOT RUN。详细证据见 [README](../README.md#d09-b2真实交付分类与-unknown-核查核心)和[路线图执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d09-b2-执行结果)。当前等待 Work 审查，不进入后续任务。

### D09-B2 Work 审查与 D09-C1 任务

2026-11-13：Work 按 `d954e24` 核对真实命令交付、Unknown 按原 Command ID 核查、显式重试和身份验证，四个源码／测试哈希匹配报告，本轮重跑类型检查、Electron Main 编译及 94/94 测试 PASS，未重跑构建或 GUI。D09-B2 按核心联调范围收口，事务仍未执行，宿主未接入。

下一项 D09-C1 从已提交意图启动最小事务，使用 D08 进度模块验证测试业务及幂等重试，由目标 Transaction Manager 统一判断中间错误、合法恢复路径和 Succeeded／Failed 两种终态。接收意图与运行状态分离，事务已执行后原命令查询仍需确认 Accepted；原事件 Completed／退役不能重开或替换事务身份。仅核心组合测试启用，不改现有灰盒交互或接宿主，最终结果事件留到下一段，范围与 F01–F06 见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。

### D09-C1 工程执行状态

2026-11-13：D09-C1 已在纯核心完成最小事务执行。`RuntimeTransactionExecutionManager` 从真实目标 `query(Command ID)` 返回的 Accepted record／intent 启动一次执行，原 creation intent 保持 `not-started`，运行状态另存并始终沿用原 Runtime／Event／Command／Transaction／target 关联。固定阶段为 `apply → verify`，只接受严格递增的 SimulationTick；F01 在两个 Tick 内通过 D08 `InMemoryRunProgress` 一次登记目标、奖励和永久效果，并进入 Succeeded。

重试与恢复由 Manager 独占判断。暂时应用错误在无业务新增时可进入 retry-pending；业务写入后异常或核查失败可进入 recovery-pending，并固定从 verify 安全继续，不重复 apply。终态元数据登记失败由 R1 单独进入 terminal-pending，不占用业务预算。已观察业务效果但没有恢复路径时直接 Failed，不会使用 retry 重写；只有无合法重试／安全恢复路径才由 Manager 判定最终失败。终态不可重开，重复启动、接受命令、事件退役或后续操作都不能建立第二个事务身份。F05 证明原事件 Unknown 与事务 Succeeded 相互独立，事务完成不会自动改写事件，后续仍按原 Command ID 查询并完成。

F01–F06 全部 PASS，原 94 项语义保留，`npm.cmd test` 为 `100/100` PASS；类型检查与 Windows 生产构建 PASS。该模块尚未接灰盒或宿主，GUI／三端事务、最终结果事件、检查点、存档和正式业务均为 NOT RUN；Matter 仍为候选，ASAR／EXE 未变化不能解释为宿主已运行新事务。当前等待 Work 审查，不自动进入下一任务，不 Commit／Push／发布。详细证据见 [README](../README.md#d09-c1最小事务执行与终态判定核心)和[路线图执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d09-c1-执行结果)。

### D09-C1 Work 审查与局部修复

2026-11-13：Work 按 `cef92d2` 核对事务源码／测试哈希与报告一致，重跑类型检查、Electron Main 编译及 100/100 测试 PASS，未重跑构建或 GUI。另用真实核心组合复现：业务 apply 成功后，终态登记故障连续 5 次，会在同一次 Tick 3 调用中递归提交 6 次；持续失败的源码路径无递归终止条件。既有测试只覆盖一次终态中断，未覆盖该问题。

D09-C1 暂不整体验收。下一项 D09-C1-R1 只修终态元数据登记失败的有界控制流、待登记结果保留和显式后续恢复，不重复业务 apply 或改原事务身份。最终结果事件、宿主及检查点继续未实现，不以 100 项 PASS 掩盖新复现，具体 R01–R04 验收见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。

### D09-C1-R1 工程执行状态

2026-11-13：终态登记故障的递归路径已修复。Manager 新增 `terminal-pending`、`pendingTerminal` 和独立 `terminalCommitAttempts`。每次显式 advance／recover 最多提交一次终态元数据；失败立即保存原身份、业务新增、错误和预期 Succeeded／Failed 结果，不进入业务错误路由。业务预算为零或非零时都适用。

待登记 Succeeded／Failed 只能在新合法 Tick 通过显式 recovery 继续登记，不重新 accept、不创建 Command／Transaction intent、不调用 executor apply。R01 的零预算持续故障中，Tick `3` 与后续每次调用均只提交一次，业务保持 `1/1/1`，第 6 次显式提交才成功；R02 证明成功结果恢复和身份不变；R03 证明原业务失败在元数据恢复后仍为 Failed，execution 尝试保持 `1`；R04 保留正常终态和原有 100 项测试语义。

`npm.cmd test` 为 `104/104` PASS，类型检查与 Windows 生产构建 PASS。修复尚未接宿主，GUI／三端事务、最终结果事件、检查点、存档和 Edge 均为 NOT RUN；ASAR／EXE 不变不能解释为宿主运行。D09-C1 与 R1 当前等待 Work 审查，不自动进入后续任务，不 Commit／Push／发布。详细证据见 [README](../README.md#d09-c1-r1终态提交失败的有界恢复)和[路线图执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d09-c1-r1-执行结果)。

### D09-C1-R1 Work 复审与 D09-C2 任务

2026-11-13：Work 按 `c94a797` 复核终态登记有界返回、pendingTerminal 与显式后续恢复，源码／测试哈希匹配报告，本轮重跑类型检查、Electron Main 编译及 104/104 测试 PASS，未重跑构建或 GUI。R1 递归缺口关闭，D09-C1 在当前核心原型范围收口；terminal-pending 尚非正式业务终态，不能据此发布最终结果。

下一项 D09-C2 实现事务终态经协调器创建唯一最终结果事件、完整身份关联、固定阶段幂等消费及 producer 确认／安全退役。结果创建或处理失败不能重跑原事务；已提交但返回丢失、结果事件已退役后重复反馈等情况都须复用原结果身份。仍只做核心链收尾，不接宿主、检查点或存档；受控结果通知完成路径不冒充命令 Accepted，也不泛化为任意无命令事件 API。范围与 G01–G06 见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。

### D09-C2 工程执行状态

2026-11-13：唯一最终结果事件核心已实现。只有 Transaction Manager 正式登记的 Succeeded／Failed 能经受控 authority 向协调器请求结果；结果事件拥有新的 Event ID，并显式携带原 Runtime／Event／Command／Transaction／target 关联。事件登记、Inbox 入队和事务到结果绑定原子提交，准备／提交故障完整回滚；提交后回执丢失或结果已退役时，重复请求仍复用原 Result Event ID。

结果事件在固定协调阶段独立消费，不创建 Command／Transaction、不重跑原事务，也不调用业务 `apply`。消费成功后才 Completed；完成登记失败以同一 Pending 身份恢复，并由结果 source 的 producer 独立确认和安全退役。原事件与结果事件生命周期互不代表，原命令 Unknown 也不能替代事务最终结果。

G01–G06 全部 PASS，原 104 项测试保留，`npm.cmd test` 为 `110/110` PASS；类型检查、D09-C2 专项 `6/6` 与 Windows 生产构建 PASS。结果核心尚未接宿主，GUI／三端事务结果、检查点、RecoveryError、存档和 Edge 均为 NOT RUN；ASAR／EXE 未变化不能解释为宿主已运行。D09-C2 开发报告当时状态为 DONE（待 Work 审查），后续结论见下方 Work 审查；不自动进入后续任务，不 Commit／Push／发布。详细证据见 [README](../README.md#d09-c2唯一最终结果事件核心)和[路线图执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d09-c2-执行结果)。

### D09-C2 Work 审查与 D09-C2-R1 任务

2026-11-13：Work 按 `1023641` 阅读结果创建、权威终态来源、原子绑定与消费恢复，四项源码／专项测试哈希匹配报告；本轮重跑类型检查、Electron Main 编译及 110/110 自动化测试 PASS，未另跑构建或 GUI。另用真实核心无文件写入复现：普通 `create()` 可以创建保留类型 `transaction.result`，不具备权威结果关联，固定阶段却进入普通命令 handler，形成 1 条 Command 和 1 份真实事务 intent，结果消费者调用 0 次。未执行事务业务，不将此复现描述为已修改奖励或永久进度。

D09-C2 主体与历史测试结果保留，但整体暂为 BLOCKED；下一项只执行 D09-C2-R1，封住普通创建入口并补充分发边界回归，保留合法 Manager 结果创建、原子回滚、稳定身份及确认／退役链。没有新的产品或技术选型决策；宿主接线、三端业务链、检查点与存档仍未实现，不因核心测试通过提前标为完成。详细复现、范围与 R01–R03 见[路线图当前任务](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。R1 完成后报告并等待 Work 审查，不自动领取后续任务。

### D09-C2-R1 工程执行状态

2026-11-13：结果事件入口补修完成。修复前新增 R01／R02 先稳定失败：普通 `create()` 实际创建 `transaction.result` 并消耗候选 Event ID，真实交付、测试替身及结果专用三种分发模式均错误进入普通路径。现普通 create 在编号、容量、生命周期、Inbox 和结果绑定之前返回 `reserved-event-type`；仅 Transaction Manager authority 经受控结果创建调用显式放行。结果类型但缺少权威关联的事件返回 `result-lifecycle-invalid`，不能进入普通 handler、accept 或结果 consumer。

R01 覆盖无 producer／普通 owned producer、显式白名单／无白名单及伪造和复制形态载荷，所有拒绝路径都没有 Event ID 或状态副作用；R02 三种模式中 handler、receipt、consumer、Command、intent 和绑定调用数均为 0；R03 由原 G01–G06 全部保留并通过，合法终态结果创建、稳定 Result Event ID、原子回滚、幂等消费、生产者确认和安全退役没有回归。专项测试 `8/8`、类型检查、`npm.cmd test` 的 `112/112`、生产构建、共享核心隔离扫描及 `git diff --check` 均 PASS。

`events.ts` SHA-256 为 `9A055CECD7681DF169ADB82FC1579D6974939FEF2DA9747788B3D27E86A277F4`，专项测试为 `CBE1DCF5A6F82DC5F5DDC2A9389BFC562C2AB5CCDF8D7F061F24066AA30722EB`；ASAR／EXE 仍为 `92999B8A38D5B10DF331314D94F161AC3E2739E37C0E758D773E5A8B4D48CB8B`／`BB578EADD877147171729D3A5EF4D785ABB52B51EA8CE522DA83945869398973`，因为核心尚未进入宿主入口。GUI／三端事件业务链、检查点、存档和 Edge 均为 NOT RUN。R1 当前 DONE（待 Work 审查），D09-C2 在审查确认前保持 BLOCKED；不自动领取后续任务，不 Commit／Push／发布。详细证据见 [README](../README.md#d09-c2-r1结果事件受控创建与分发入口补修)和[路线图执行结果](DEVELOPMENT_ROADMAP.md#2026-11-13-d09-c2-r1-执行结果)。

## 已确认的游戏设计方向

确认日期：2026-11-06；依据：项目负责人本次明确指示。

- 视角：2D 横版。
- 美术风格：卡通手绘。
- 洪崖洞场景表现（CONFIRMED，2026-11-06）：保持 2D 横版，以横向卷轴和多层平台为基础，玩家通过左右移动、跳跃、楼梯及平台探索不同高度；重要区域采用建筑剖面式构图，表现内外空间、楼层、木质走廊、支撑与悬挑关系。参考真实建筑，允许合理空间压缩和内部路线改编；不将原创建筑结构描述为真实建筑，不改为 3D。具体布局、剖面比例、楼层路线、摄像机、美术资产制作及细节简化程度待设计或原型验证；详见 [HONGYADONG_LEVEL_DESIGN.md](HONGYADONG_LEVEL_DESIGN.md)。
- 核心玩法：平台跳跃、场景探索、环境解谜三部分组成。
- 主角（历史定位，真实地理身份适用性待核对）：来到重庆的年轻冒险者；不作为当前虚构城市的现实身份约束。
- 第一关主线（CONFIRMED，2026-11-06）：以重庆洪崖洞为主题，故事为《把山城夜景寄给远方》；主角帮助一位年轻游客寻找能够欣赏洪崖洞夜景的观景位置，以温暖、轻松的旅行冒险氛围自然引出场景探索、环境解谜和重庆文化收藏。任务接取、单机关结构及通关条件按下方 MVP 冻结执行；NPC 细节、地图实现和奖励内容仍待设计。升降平台、机关等属于游戏原创玩法，不代表洪崖洞真实设施；详见 [QUEST_SYSTEM_DESIGN.md](QUEST_SYSTEM_DESIGN.md)。
- 战斗边界：不设置传统战斗系统。
- 第一版操作：键盘作为游戏内主要操作方式，鼠标用于菜单和 UI 点击；暂不优先支持游戏手柄和手机触屏。具体键位仍待验证。
- 玩家控制组织（CONFIRMED，2026-11-07，PC-01 / PC-02）：统一 Player Control Coordinator 接受各系统的状态开始/结束请求，并独占控制开放决定权；控制状态与运动信息分离。跳跃采用一次有效按下一个请求，成功起跳消费请求和资格，锁定/失败恢复/失焦清理请求与缓冲，控制恢复后须松开再按下，不因持续按住而自动起跳。具体状态划分、优先级、Session ID、输入实现细化和锁定期间物理行为仍为 PROPOSED，详见 [PLAYER_CONTROL_DESIGN.md](PLAYER_CONTROL_DESIGN.md)。
- 生命值与复活：不设置生命值系统，不限制玩家复活次数（CONFIRMED，2026-11-06）。
- 挑战来源：地形、跳跃、环境机关、线索解谜和 NPC 任务。
- 任务接取（CONFIRMED，2026-11-06）：玩家主动与发布任务的 NPC 交互并了解委托后自动接取，不额外显示“接受任务”和“暂不接受”选择框；任务加入列表并显示新任务提示。仅靠近 NPC 不会接取任务，必须主动交互并触发相应对话流程。详见 [QUEST_SYSTEM_DESIGN.md](QUEST_SYSTEM_DESIGN.md)。
- 文化收藏系统（CONFIRMED，2026-11-06）：采用传统旅行纪念册形式，而不是纯列表式图鉴，体现来到重庆冒险并记录旅行记忆的氛围；将文化收藏品与探索发现内容整理到一本纪念册中，结合任务奖励和场景探索拾取机制。最终名称、页面结构、条目字段、收藏品类型、具体 UI 及交互方式仍待详细设计。
- 检查点：采用快照恢复；进入指定触发区域自动激活并保存当前关卡状态，环境挑战失败后恢复最近一次激活的检查点快照（CONFIRMED，2026-11-06）。具体环境失败触发条件和快照完整字段仍待验证。
- 永久进度与幂等（CONFIRMED，2026-11-07）：收藏品、任务目标、奖励和永久世界效果分别使用稳定唯一 ID，保持独立业务身份；同一对象不重复获取、记录或发奖，永久效果重复应用不发生错误反向变化。永久记录不随检查点恢复清除；恢复临时世界后重新应用永久效果并同步场景，已完成目标对应的永久效果优先于快照。数据分类名称仍为建议，各关对象清单与管理范围、捕获具体边界及一致性细则、跨会话保存方式仍待确认，详见 [QUEST_SYSTEM_DESIGN.md](QUEST_SYSTEM_DESIGN.md) 与 [PLAYER_CONTROL_DESIGN.md](PLAYER_CONTROL_DESIGN.md)。
- 初始备用检查点完整快照（CONFIRMED，2026-11-07）：与正式检查点共用快照结构和恢复机制；先初始化场景、临时机关和平台，加载并应用永久进度及永久效果，记录安全出生位置、捕获管理范围内临时状态并登记备用检查点，完成后才开放玩家控制。只捕获登记对象的逻辑状态，不复制整个世界；具体字段分类仍为提案。
- 第一版快照数量（CONFIRMED，2026-11-07）：只保留一个当前有效检查点及其完整临时快照；其他检查点捕获与验证通过后按事务规则替换，离开保留、重入刷新、持续停留不捕获；返回旧检查点重新捕获当前世界，不保留可供恢复的历史快照。永久进度独立管理。恢复期间暂停普通世界更新仍为 PROPOSED，捕获前冻结参与快照对象状态变更则已由事务式提交确认，详见玩家控制文档。
- 恢复触发事件屏蔽（CONFIRMED，2026-11-07）：Failure / Recovery 全局屏蔽坠落、检查点激活及快照刷新事件处理，物理碰撞不因此整体关闭；只允许一个恢复流程，重复事件不重做淡出、恢复和传送。恢复结束前重算占用，传送及重启触发器不产生虚假进入；坠落和检查点区域均须真正离开再进入才产生新事件。
- 原子快照捕获（CONFIRMED，2026-11-07）：检查点触发先提交请求，不在物理碰撞回调内捕获；登记临时对象在同一安全模拟边界捕获逻辑状态，候选快照独立构建，验证对象 ID、完整性与结构后才原子替换。失败保留旧有效快照，初始备用快照失败不开放探索。具体安全边界和验证细则仍待设计。
- 事务式快照提交（CONFIRMED，2026-11-08）：捕获前暂时冻结参与快照对象的状态变更，数据写入独立候选快照；验证登记清单、唯一 ID、对象版本、必要字段和数据完整性后，才能将当前检查点 ID 与快照原子提交，不允许部分提交。捕获或验证失败丢弃候选，完整保留原有效检查点及快照，第一版仍只有一个有效检查点；初始备用快照失败无旧数据可回退，不开放控制。事务结束后解除局部冻结已确认，具体冻结与解除实现及提交调度仍待细化，调试日志与错误编号仍为 PROPOSED。
- 捕获事务不因离开而取消（CONFIRMED，2026-11-08，Non-cancellable Capture Transaction）：进入检查点区域后启动事务，必须完成捕获、验证及提交或失败处理；提前离开不取消，成功后原子提交、失败后保留旧检查点，事务结束后解除局部冻结。触发器占用与事务状态独立，正常记录离开；同一检查点重入按下述不排队规则处理。既有移动、局部交互屏蔽、失败处理及安全模拟边界规则不变。
- 同一检查点不排队第二次捕获（CONFIRMED，2026-11-08）：同一时间最多一个捕获事务，事务中离开不取消、重入只更新占用，不并行、不缓存不排队第二次请求。当前事务成功则提交，失败则保留旧检查点；失败后仍在区域内不自动重试，必须在事务结束后真正离开并重新进入才可再试。`triggerOccupied`、`captureInProgress`、`attemptConsumed` 为三个独立状态概念的建议名称（PROPOSED），具体实现待定。
- 关卡级全局单捕获事务（CONFIRMED，2026-11-08）：整个关卡最多一个捕获事务，不同检查点共享全局捕获事务锁，不并发冻结、捕获或提交。其他检查点被阻挡时只更新占用，请求不缓存不排队；当前事务成功或失败后释放锁，不补发此前请求，玩家须真正离开被阻挡区域并重新进入才能再试。全局锁与对象局部冻结分别管理，不影响玩家移动；具体锁表示、释放与解冻顺序仍待设计，请求选择方向现按下述统一仲裁规则执行。
- 检查点统一仲裁（CONFIRMED，2026-11-08，Centralized Checkpoint Arbitration）：所有触发器向 CheckpointCoordinator 提交进入请求，不独立启动捕获；按实际进入先后处理，同一模拟边界的多个请求按关卡预设优先级仲裁。只有胜出者可尝试获取全局锁；未胜出请求不启动、不缓存不排队不补发，本次进入机会已消耗，须真正离开再进入。锁已占用时新请求直接阻挡。职责现按下述三模块决策组织，不要求独立类；同优先级属配置错误，进入顺序按 SimulationTick，逻辑阶段及优先级升序按 Fixed-Phase Batch Collection 执行；编号、引擎接入及具体配置未定。
- 三套独立状态模块（CONFIRMED，2026-11-08，Independent State Modules）：CheckpointCoordinator 统一协调 Request Batch、Capture Transaction、Trigger Lifecycle，各自维护独立状态和生命周期。三者分别负责收集/关批次/仲裁，获取锁/局部冻结/捕获/验证/原子提交，以及进出/机会消耗/重新触发资格；Global Capture Lock 独立管理。捕获期间批次和触发器仍正常工作，模块通过明确接口协作，不任意修改其他模块内部状态。统一事件入口现由下述决策确认，具体状态枚举与转换、字段、独立类、Coordinator 内部结构、具体事件协议、锁实现及错误/状态恢复实现仍为 PROPOSED，不改变既有恢复规则。
- 统一协调器事件入口（CONFIRMED，2026-11-08，Coordinator Event Inbox）：所有检查点相关模块经统一入口提交事件，由 CheckpointCoordinator 接收、校验、调度并组织跨模块状态转换；事件有明确类型与必要数据，事件和命令在概念上区分。三模块各管内部状态，不任意互改；不引入第三方消息系统或复杂全局事件总线。分发方向现按下述固定阶段式事件分发决策执行，具体 API、队列及处理细节仍未定，不改变捕获请求不排队不补发和固定 Tick 仲裁规则。
- 固定阶段式事件分发（CONFIRMED，2026-11-08，Phase-based Event Dispatch）：模块先提交事件，提交不等于立即处理；协调器在规定阶段统一读取、校验、分类及调度，不在物理回调中直接执行复杂跨模块转换，也不允许绕过协调器修改其他模块内部状态。进入事件在当前 Tick 批次关闭前收集，关闭后统一仲裁；捕获成功/失败经入口反馈，不引入第三方消息系统或复杂全局总线。新事件按单轮规则执行，去重按 Event ID 幂等规则执行；具体类型/数据、队列实现、阶段位置、排序、事件失败恢复、命令接口及去重实现细节仍为提案，不将示例名称升级为 API。
- 事件唯一 ID 与幂等（CONFIRMED，2026-11-08，Event ID + Idempotent Processing）：每个逻辑事件有唯一 Event ID，协调器记录已接受和处理的 ID，相同 ID 只处理一次，不同真实进入生成不同 ID；重要转换仍检查当前状态，去重不代替事务检查。去重记录有明确生命周期，不无限保存完整历史；保留与清理方向现按下述生命周期管理规则执行，具体确认、清理时机、识别、结构及成功/失败更新仍待设计。生成按统一生成器执行，事件记录不替代永久进度记录。
- 生命周期去重记录管理（CONFIRMED，2026-11-08，Lifecycle-based Deduplication Record Management）：待处理、处理中及允许重试事件须保留记录；终态后确认生产者不再提交，并满足安全条件才可清理完整记录。过期 ID 重提交拒绝，不无限保存完整历史，清理不破坏唯一性且不代替事务验证。确认按显式确认规则、过期识别按连续退役水位线执行；具体接口、清理时机、轻量记录结构、失败重试及序列协调仍待细化，分类名称不是最终 API 或枚举。
- 生产者显式确认（CONFIRMED，2026-11-08，Producer Acknowledgement）：生产者创建事件并取得 ID，协调器接收处理并返回最终结果；生产者确认不再提交后释放本地引用，协调器检查全部安全条件，通过后才可清理完整记录。Retryable 不得提前确认清理，确认不等于立即删除全部防重信息，退役 ID 重提交仍拒绝。过期防重方向现按水位线决策；确认接口、结果定义、超时/异常、安全条件、引用释放顺序及具体防重/生成器协调仍为提案，不新增自动确认或超时清理。
- 连续退役水位线（CONFIRMED，2026-11-08，Retirement Watermark）：协调器维护从最早有效 ID 开始连续安全退役的最高 ID，ID 小于等于水位线直接拒绝，水位线只前进不回退，不能越过未完成、未确认或不安全的 ID。线上已退役但前方有缺口的 ID 暂留轻量记录并拒绝重提交，缺口补齐后可推进，不永久保存完整历史。分配与登记原子化、未提交 ID 须有记录现已确认；初始值、非连续记录结构、推进时机、清理顺序及实例销毁清理仍为提案。
- 原子分配与登记（CONFIRMED，2026-11-08，Atomic ID Allocation and Registration）：创建逻辑事件时统一分配新 ID，并原子完成初始生命周期登记，成功后按下述 Coordinator Auto-Enqueue 由协调器自动入队，生产者不再第二次显式提交；取消已登记事件须明确终态。每个已分配 ID 都有生命周期记录，水位线推进前可确认状态，不允许不明缺口，生成/登记/去重职责仍独立。初始状态已按 Pending as Initial State 确认为 Pending；取消终态、记录结构、生成器与登记模块接口及去重协调仍待细化；失败边界按下条正式决策执行，原七项提案保留于详细文档。按下述统一原子提交规则，正式提交后同时完成登记与入队，但不等于已处理；取消终态不等于已安全退役。
- 全有或全无原子登记（CONFIRMED，2026-11-08，All-or-Nothing Atomic Registration）：先准备候选 ID 与初始生命周期记录，整体成功后才正式提交编号并返回事件，序列也仅在成功提交后推进。任一步骤失败须回滚未完成操作，未提交候选不算已分配且不得交给生产者；无法确认回滚完整性时暂停后续分配并进入内部异常处理，保持 ID Generator、Lifecycle Registry 与 Coordinator 职责边界。创建入口与组织协调责任已由下条决策确认，具体事务边界、调用接口、候选表示、回滚与异常恢复及存储关系仍待设计，唯一初始状态现已确认为 Pending；原八项提案保留于详细文档。候选与已分配 ID 的区分不改变正式分配后不复用及安全退役规则。
- 统一事件创建入口（CONFIRMED，2026-11-08，Coordinator-owned Event Creation Entry）：所有生产者通过 CheckpointCoordinator 请求创建逻辑事件，不得直接分配 ID；协调器组织生成器与生命周期登记模块完成候选准备、登记和原子提交，成功后返回正式事件，失败遵循 All-or-Nothing。协调器不接管模块内部状态，不新增独立 Event Creation Service，保留 Inbox、固定阶段与单轮分发。创建与登记成功后由协调器自动入队，替代此前生产者再次提交的流程；入队不等于处理，创建接口、生成/登记接口、候选表示、事务工程边界、回滚顺序、回滚失败异常处理、恢复分配条件及生命周期/去重存储关系等剩余八项保持 PROPOSED，唯一初始状态已确认为 Pending，原九项提案保留于详细文档。
- 协调器自动入队（CONFIRMED，2026-11-08，Coordinator Auto-Enqueue）：生产者通过 CheckpointCoordinator 请求创建逻辑事件，协调器组织 ID 分配、初始登记及成功后的 Event Inbox 自动入队，生产者不再执行第二次显式提交；入队不等于立即处理，保留固定阶段、单轮、Simulation Tick 批次边界与独立模块职责。三项统一原子提交与失败整体回滚现由下条决策确认；原八项提案保留于详细文档。返回值、阶段接入、入队后状态、资源管理及拒绝通知仍待设计，具体提交点和回滚实现按当前九项提案细化。
- 创建、登记与入队统一原子提交（CONFIRMED，2026-11-08，Atomic Create-Register-Enqueue Commit）：同时准备候选 Event ID、初始生命周期记录和 Inbox 入队操作，三项全部成功后才统一提交并对外可见；任一步骤失败整体回滚，失败事件不得返回生产者，不允许正式登记但未成功入队的孤立事件。回滚完整性无法确认时暂停后续 ID 分配并进入内部异常处理；编号序列仅在三项统一提交成功后推进，保持固定阶段、单轮及模块职责。执行机制、队列预留、生命周期提交顺序、提交点与可见性边界、回滚顺序、异常恢复、Inbox 容量、失败返回结果及结构/接口九项为 PROPOSED。
- 唯一初始生命周期状态（CONFIRMED，2026-11-08，Pending as Initial State）：统一原子提交前仅为内部候选；ID 分配、初始登记与 Inbox 入队全部成功后正式事件直接处于 Pending，不设 Registered 等中间状态。Pending 表示尚未开始处理，进入符合条件的协调处理阶段才转为 Processing；自动入队不等于立即处理，保留固定阶段、单轮及独立模块职责。转换逻辑时机现按下条 Transition Before Dispatch 确认；成功交接命令后结束原事件处理的方向已按 Event-Transaction Lifecycle Separation 确认；其他路径结束细节、Retryable 与重试、Rejected 及未成功交付等路径的终态、失败分类、合法性校验细节及生命周期/去重协调等原提案未确认细节仍为 PROPOSED，具体引擎接入未定，其余示例状态不一并定案。
- 实际分发前转换（CONFIRMED，2026-11-08，Transition Before Dispatch）：协调阶段开始时确定本轮集合；逐事件校验处理资格与当前状态，即将交给对应处理逻辑前才由 Pending 转 Processing，转换成功后才能处理。未选中事件保持 Pending，转换失败不得执行处理；新事件延后到下一次符合条件阶段，不递归处理，保留单轮、独立模块及 Tick 边界。事件与业务事务分离及成功交接命令后原事件处理结束的方向已按下条决策确认；原七项提案保留于详细文档，成功命令交付后终态已按 Command Handoff = Event Completion 确认为 Completed；其他路径结束细节及失败/重试/异常规则和关联追踪实现仍为 PROPOSED，不锁定代码枚举或 API。
- 事件与业务事务生命周期分离（CONFIRMED，2026-11-08，Event-Transaction Lifecycle Separation）：Processing 仅代表当前事件的校验、资格判断、仲裁和命令分发；成功将命令交给事务管理模块后原事件处理结束，不等待事务最终完成。业务事务独立管理且可跨 Tick，成功或失败后以具有独立 ID 与生命周期的新协调器事件反馈，不直接修改其他模块内部状态，保留独立模块与单轮规则。成功命令交付后的原事件终态现按下条决策确认为 Completed；交接成功判据、分发失败分类、结果事件结构、结果关联、重复反馈处理及事件/事务追踪等原提案剩余六项为 PROPOSED，原七项保留于详细文档；原事件结束不自动释放事务锁或清理去重记录。
- 命令交付即事件完成（CONFIRMED，2026-11-08，Command Handoff = Event Completion）：协调器成功交付命令后，原事件直接进入 Completed，不设 Dispatched；Completed 只表示协调处理结束，不代表业务事务成功，也不等待跨 Tick 事务结束。事务结果通过新事件反馈，业务失败不重新执行原事件；事件结束不自动释放事务锁或清理去重记录，保持生命周期分离及独立模块架构。四类命令交付结果方向现按下条决策确认；精确判据、具体失败/拒绝条件、重试、异常恢复、命令防重及业务结果结构/关联等仍待设计，原八项提案保留于详细文档。
- 命令交付四类结果（CONFIRMED，2026-11-08，Command Handoff Failure Classification）：Accepted 表示目标模块明确接受命令，原事件进入 Completed，不代表业务事务成功；Retryable 要求暂时故障且可确认命令未被接受，仅允许按后续重试规则再试；Rejected 表示不合法、不支持或违反规则，不自动重试；Unknown 表示接受情况不明，须异常处理，不得按 Retryable 盲目重交。业务事务结果仍以独立协调器事件反馈，保持生命周期分离与独立模块职责。Unknown 核查方向现按下条 Reconciliation Before Retry 确认；具体查询、异常恢复、生命周期状态、分类判据、重试安排与命令防重等实现仍待设计，原十项提案保留于详细文档；四类名称不自动成为代码枚举或事件生命周期状态。
- Unknown 先核查再重试（CONFIRMED，2026-11-08，Reconciliation Before Retry）：保留原事件及去重记录并暂停同一命令重交，由 CheckpointCoordinator 主动查询目标事务模块；确认已接受则按 Accepted 处理且不重交，确认从未接受则按实际原因分类为 Retryable 或 Rejected，只有 Retryable 可进入后续重试。查询失败或不明继续保持 Unknown，不能推定未接受；记录保留至满足安全清理条件。查询使用原 Command ID 现按下条 Stable Command ID 确认；查询接口、命令/事务具体关联、结果结构、执行时机与次数、查询失败处理、事件状态与转换、重试细则、拒绝错误细分等实施细节仍为 PROPOSED，不自动暂停其他相关事务或锁定 API。
- 稳定命令身份（CONFIRMED，2026-11-08，Stable Command ID）：每条逻辑业务命令创建时分配独立唯一 Command ID，同一命令交付重试和 Unknown 查询沿用原 ID；目标事务模块据此识别，同一 Command ID 不得重复启动事务。Command ID 与 Event ID 独立，不同逻辑命令不得共用 ID。旧的单事件多命令规则保留于决策历史，现按 Single-Command Event Handoff 限为最多一个命令。运行实例级独立生成器与独立递增序列现按下条决策确认，原十项提案保留于详细文档。具体装配、初始化/销毁时机、格式与类型、唯一性范围、ID 关联结构、命令去重记录结构与保留清理、创建失败处理仍待设计；记录归属按目标模块幂等接收决策执行。第一版不设计多命令完成判定，命令记录不自动套用 Event ID 退役水位线。
- 运行实例级独立命令编号（CONFIRMED，2026-11-09，Runtime-scoped Independent Command ID Infrastructure）：每个游戏运行实例共用一个独立 Command ID Generator，CheckpointCoordinator 经受控接口申请编号。生成器维护自身单调递增序列，切换场景或检查点不重置，两类系统不得直接重置；不另设 Command Creation Service，生成器只负责编号，与 Event ID 生成、命令去重和事务状态管理分离。装配位置、初始化与销毁时机、整数类型、溢出处理、唯一性工程范围、接口、分配与登记的事务边界及去重记录生命周期八项为 PROPOSED，Transaction ID 与 Command ID 的逻辑关联按 Transaction ID at Intent Creation 执行，具体关联结构仍待设计。
- 目标事务模块幂等接收（CONFIRMED，2026-11-09，Target Transaction Manager-owned Idempotent Command Acceptance）：目标事务模块独立维护接收记录，先查 Command ID，新命令先登记再启动事务；已接受的重复命令返回原接收结果或事务关联，不再次启动。Unknown 由协调器发起查询，目标模块按原 Command ID 提供权威结果。接收记录与事务状态分别管理，协调器不直接维护目标模块内部状态。接收记录与事务创建意图的原子提交范围按下条决策执行。记录结构与状态、提交点、恢复、Transaction ID 的具体生成与关联结构、返回值、查询接口及保留清理等实现仍待设计。
- 命令接收与事务意图原子提交（CONFIRMED，2026-11-09，Atomic Acceptance and Transaction Intent）：目标模块查验 Command ID 后，将新命令接收记录与事务创建意图一并提交，成功后才是 Accepted；失败不得留下部分可见的已接受记录或孤立意图。实际事务在提交后独立执行，可跨 Tick；Accepted 不表示事务成功。尚未启动或中断时可依据已提交意图恢复，同一 Command ID 不因重交或恢复创建重复事务。Transaction ID 与接收记录、事务意图保持原子提交一致性，按下条决策执行。记录与状态结构、具体提交与回滚、恢复、重复命令返回及清理等仍为 PROPOSED。
- 事务意图创建时分配事务 ID（CONFIRMED，2026-11-09，Transaction ID at Intent Creation）：创建意图时分配 Transaction ID，关联 Command ID、接收记录与意图，原子提交成功后才生效。实际事务启动、重试和恢复沿用原 ID，一个 Command ID 不得关联多个独立事务身份。三类 ID 身份独立，Transaction ID 存在不代表事务成功。生成器范围及编号策略按下条决策执行；具体装配、整数类型、分配失败处理、关联结构与安全清理仍为 PROPOSED。
- 运行实例级独立事务编号（CONFIRMED，2026-11-09，Runtime-scoped Independent Transaction ID Generator）：每个运行实例共用一个独立 Transaction ID Generator，各事务模块经受控接口申请，不能自行维护序列。使用独立的单调递增整数序列，不与 Event ID 或 Command ID 共用，场景与检查点切换不重置；生成器只负责身份分配，不管理事务状态。意图创建时分配、原子提交成功后生效、启动与恢复沿用原 ID 的规则不变。失败编号处置按下条决策执行；唯一性范围按 Runtime-instance Scoped Transaction ID Uniqueness 确认为当前运行实例；装配、初始化与销毁、具体类型、溢出、接口、分配失败、分配与提交边界和跨会话兼容等实现仍为 PROPOSED。
- 事务编号不复用与允许空洞（CONFIRMED，2026-11-09，Non-reusable Transaction IDs with Permitted Gaps）：Transaction ID 分配即消耗，在同一运行实例内永不复用。提交失败时回滚命令接收记录、事务创建意图及 ID 关联，生成器序列不回退，后续继续递增且不补洞。只有提交成功才建立有效关联，已生效事务的重试和恢复沿用原 ID。唯一性范围按下条决策执行，具体类型、溢出、接口、初始化与销毁、分配失败、执行边界、跨会话兼容及记录保留清理仍为 PROPOSED。
- 事务编号仅在运行实例内唯一（CONFIRMED，2026-11-09，Runtime-instance Scoped Transaction ID Uniqueness）：完整销毁并重新初始化运行实例后可重新初始化 Transaction ID 编号，不同实例允许同号；场景与检查点切换不重置，实例内仍不复用、不补洞。第一版不引入全局持久化编号服务，同一 Command ID 在所属实例内最多关联一个独立事务身份。跨运行实例追踪的组合身份按下条 Runtime Instance Identity 执行；具体身份结构、跨会话支持及生成器实现仍为 PROPOSED。
- 独立运行实例身份（CONFIRMED，2026-11-09，Runtime Instance Identity）：完整初始化时创建新的 Runtime Instance ID，场景和检查点切换沿用，完整销毁结束生命周期。它只标识运行实例；Event ID、Command ID、Transaction ID 继续分别标识实例内的协调器事件、业务命令和业务事务，保留独立递增序列。跨实例追踪使用实例 ID 与对应业务 ID 组合识别。生成方式按下条决策确认为 UUID，具体版本、库、类型与格式、唯一性保证、持久化、接口与关联结构、创建/清理时机、日志追踪及跨会话恢复和兼容仍为 PROPOSED。
- 运行实例 ID 使用 UUID（CONFIRMED，2026-11-09，UUID-based Runtime Instance ID Generation）：每次完整初始化生成新 UUID，场景与检查点切换沿用，完整销毁结束其生命周期。实例 UUID 不与 Event ID、Command ID、Transaction ID 共用生成器或递增序列，无需全局持久化递增计数器；跨实例追踪与对应业务 ID 组合，显式关联按下条决策执行。UUID 版本、生成库、格式、唯一性保证、持久化、生命周期接入及跨会话实现等仍为 PROPOSED。
- 显式关联与独立身份（CONFIRMED，2026-11-09，Explicit Association with Independent Identities）：Runtime Instance ID 提供共同实例上下文，Event、Command、Transaction 用显式关联追踪，四套 ID 各自生成，不相互编码或以复合 ID 替代原始身份。跨实例追踪仍按实例 ID 与业务 ID 组合；同一 Command ID 不关联多个独立 Transaction ID，重试与恢复沿用原 ID。关系基数按下条决策执行；具体关联结构、结果回关联、重试恢复维护、记录生命周期与清理及跨会话兼容仍为 PROPOSED。
- 单事件单命令交付（CONFIRMED，2026-11-09，Single-Command Event Handoff）：单个 Event 最多创建并交付一个 Command，成功接收的 Command 对应一个 Transaction。多对象效果可组织在一个复合命令与事务中；第一版不做多命令完成计数或部分结果协调。命令交付成功后原 Event 进入 Completed，事务独立跨 Tick 执行，重试与恢复沿用原 Command ID 和 Transaction ID。结果反馈按下条 Independent Transaction Result Event 执行；关联结构、结果事件实现、复合效果组织、跨对象事务边界及关联记录清理仍为 PROPOSED。
- 独立事务结果事件（CONFIRMED，2026-11-09，Independent Transaction Result Event）：事务形成需反馈的结果后，经 CheckpointCoordinator 请求创建新事件，使用新的 Event ID，沿用原 Runtime Instance ID，显式关联原 Event、Command 和 Transaction ID。协调器负责创建、原子登记入队及分发；重复反馈沿用同一结果 ID，原 Event 的 Completed 不受影响。结果事件独立遵守单轮、幂等及生产者确认规则；必携带的身份上下文按下条决策执行。触发与数量按 One Final Result Event per Transaction 执行；结构载荷、最终阶段具体判据、关联实现、失败恢复和安全清理仍为 PROPOSED。
- 结果事件完整身份上下文（CONFIRMED，2026-11-09，Complete Identity Association Context）：结果事件必须携带自身的新 Event ID，以及原 Runtime Instance ID、Event ID、Command ID 和 Transaction ID。结果 Event ID 与原始 Event ID 分开，四种关联身份独立，不以复合 ID 替代；重复反馈复用结果 ID，原事件保持 Completed。协调器继续统一创建并遵守原子创建、自动入队和幂等规则。触发与数量按下条决策执行；字段结构、载荷、结果分类与最终阶段具体时机、创建接口、稳定复用、失败恢复及清理仍为 PROPOSED。
- 每事务最多一个最终结果事件（CONFIRMED，2026-11-09，One Final Result Event per Transaction）：只在事务进入 Succeeded 或 Failed 后经协调器创建，终态范围按下条 Two Terminal Transaction Outcomes 执行；中间状态及可重试失败不生成结果事件。重试和恢复沿用原 Transaction ID；创建失败重处理创建请求，重复反馈沿用原 Result Event ID。事务内部状态由事务模块管理，原事件保持 Completed，结果事件的完整身份上下文与通用分发、幂等和确认规则不变。最终结果判据、ID 保存、关联记录、失败恢复、生命周期与清理仍为 PROPOSED。
- 两种事务终态（CONFIRMED，2026-11-09，Two Terminal Transaction Outcomes）：Succeeded 表示事务成功完成，Failed 表示最终失败且不能继续执行。事务模块判定终态，协调器只接收结果，不自行推断；执行中、恢复中和可重试失败不触发最终事件。第一版不增设 Cancelled，取消是否支持及语义未定。每笔事务仍最多一个最终事件，携带完整身份，创建失败不重跑事务。Failed 的逻辑前提按下条决策执行；具体错误判据、重试限制与调度、终态时机和结果创建关联等仍为 PROPOSED。
- Failed 须无合法重试或安全恢复路径（CONFIRMED，2026-11-09，Failure Only After Retry and Recovery Paths Are Exhausted）：由事务模块判定。达到重试上限或恢复失败后仍检查其他可用路径；已知不可用或不安全的路径无需实际尝试。重试恢复沿用原 Transaction ID，协调器不管理内部重试。终态结果事件创建失败仅重处理创建请求。错误分类与代码、重试策略、安全路径与优先级、选择和终态执行时机仍为 PROPOSED。
- 事务错误处理由事务管理模块统一决定（CONFIRMED，2026-11-09，Transaction Manager-owned Failure Classification and Retry Decision）：执行模块报告结果和错误；Transaction Manager 判定可重试性与安全恢复需求，协调重试和恢复，并决定能否进入 Failed。执行模块不得自行判定终态，协调器按既有规则创建和处理最终结果事件。重试恢复沿用原 Transaction ID，仅 Succeeded 或 Failed 可创建最终结果事件。分类与代码、重试上限和调度、安全恢复判据、路径选择、终态时机及接口仍为 PROPOSED。
- 统一事件 ID 生成器（CONFIRMED，2026-11-08，Centralized Event ID Generator）：所有事件生产模块共用统一生成机制，不各自制定编号规则；每个逻辑事件首次创建时分配 ID，同一事件重复提交沿用原 ID，不同逻辑事件使用新 ID，生成与去重独立。策略按 Monotonic Sequence ID、生命周期及重置按 Runtime-scoped Event ID Generator 执行；具体类型、归属、接口及去重协调仍待设计。
- 单调递增事件 ID（CONFIRMED，2026-11-08，Monotonic Sequence ID）：新逻辑事件获得递增整数 ID，所有生产模块共用同一序列，同一事件重复提交沿用原 ID，运行实例内不得复用；不依赖系统时间或随机数，生成与去重独立。运行实例生命周期及重置边界已由下述决策确认，类型与溢出、具体归属及去重协调等工程细节仍为提案。Event ID 不替代 Tick 与优先级仲裁，清理去重记录不授权实例内 ID 复用。
- 运行实例级生成器（CONFIRMED，2026-11-08，Runtime-scoped Event ID Generator）：整个游戏运行实例只有一个 Event ID 生成器，A—D 所有区域共用序列；场景切换、检查点切换和新场景加载不重置，只有运行实例完整销毁并重新初始化才重置。Event ID 仅标识运行时逻辑事件，不替代永久任务、收藏品或检查点 ID。具体归属、数据类型、溢出、唯一性工程实现、去重生命周期协调及接口六项仍为 PROPOSED。
- 单轮事件分发（CONFIRMED，2026-11-08，Single-pass Event Dispatch）：每次协调阶段开始确定本轮集合，只处理集合内事件；处理中产生的新事件进入待处理队列，不插入本轮，不递归调用处理器，延后至下一符合条件的协调阶段。不得通过级联绕过状态转换，进入事件仍遵循 Tick 批次关闭边界；固定阶段与三模块独立状态不变。队列具体实现和符合条件阶段的工程安排未定，事件延后处理不授权被阻挡捕获请求排队或补发。
- 检查点优先级唯一（CONFIRMED，2026-11-08，Unique Checkpoint Priority）：同一仲裁范围内可能同时触发的检查点必须配置不同优先级，重复属于关卡配置错误，开发阶段通过配置验证提前发现；运行时不得随机或依赖对象创建/代码执行顺序选胜。唯一性不要求覆盖全游戏，优先级只解决同一模拟步请求，不取代不同模拟步的 SimulationTick 先后。方向已确认升序（Lower Number = Higher Priority），具体配置、配置验证时机和错误反馈仍待设计。
- 模拟步编号仲裁（CONFIRMED，2026-11-08，Simulation Tick Arbitration）：每个检查点进入事件记录 SimulationTick，由 CheckpointCoordinator 在不同模拟步间按编号从小到大仲裁，同一步多个请求按关卡唯一优先级升序；不使用墙上时钟，不依赖物理回调或创建顺序。全局单事务锁及被阻挡请求不缓存不排队不补发规则不变。步内按固定逻辑阶段收集，每个固定模拟步对应一个 SimulationTick；编号实现、具体引擎接入及关卡配置仍待确认。
- 先收集再仲裁（CONFIRMED，2026-11-08，Batch Collection Before Arbitration）：每 Tick 设置独立收集阶段，所有触发器统一提交，同一 Tick 请求全部收集、批次关闭后由协调器仲裁，不得首请求到达就启动捕获。不同 Tick 按 SimulationTick 从小到大，同 Tick 按唯一优先级升序，仅胜出者尝试获取全局锁，其他请求不缓存不排队不补发，结果不依赖回调顺序。逻辑阶段边界已由下述决策确认，引擎接入及具体工程实现仍为提案。
- 固定阶段式收集（CONFIRMED，2026-11-08，Fixed-Phase Batch Collection）：Tick 开始开启批次，世界更新、物理检测及触发器处理期间只登记请求，相关物理和触发器事件全部完成后关闭，再由 CheckpointCoordinator 仲裁。已关闭批次不得追加，迟到请求归下一有效模拟步；同 Tick 优先级升序，数字越小越优先。迟到归属不等于落选或被阻挡请求的补发。固定时间步现已确认；SimulationTick 编号实现、物理事件接入、引擎生命周期回调位置及批次与物理阶段工程实现仍为 PROPOSED。
- 捕获期间局部交互屏蔽（CONFIRMED，2026-11-08）：针对已登记快照对象的交互请求暂时屏蔽，不进入输入缓冲、不建立延迟队列；结束后必须重新按下交互键，持续按住不得自动触发。移动和移动输入、无关正常交互不受该屏蔽影响；事件、回调、任务逻辑及其他修改入口同样遵守局部冻结，不得绕过。事务式提交及既有交互控制规则不变，冻结与解除实现、事务结束的执行判定、入口接入与提示表现仍待细化，详见 [PLAYER_CONTROL_DESIGN.md](PLAYER_CONTROL_DESIGN.md)。
- 新检查点捕获失败（CONFIRMED，2026-11-08）：已有有效检查点时丢弃失败候选，不更新原 ID、不覆盖完整快照、不影响永久进度，不因此进入 RecoveryError，玩家保持正常探索并获得简短反馈。同一次连续进入只尝试一次，失败后仍在区域内不自动重试，须在事务结束后真正离开并重新进入；后续其他检查点成功时仍可按事务规则替换。该规则不覆盖初始备用快照失败禁止开放控制的约束，也不改变恢复时版本不兼容直接进入 RecoveryError 的规则。反馈具体形式与触发边界检测仍待设计。
- 固定快照登记清单（CONFIRMED，2026-11-07）：所有快照对象初始化时登记并使用稳定唯一 ID，第一版不任意动态注册注销；隐藏、禁用或停止不删除登记，按自身逻辑状态记录；静态建筑、装饰、永久进度与输入不进入临时快照。初始化验证清单，重复 ID、遗漏或无效数据阻止开放探索。
- 快照严格版本校验（CONFIRMED，2026-11-08）：整体 schemaVersion 与各对象独立 stateVersion 必须存在，整体与必要对象的版本须分别匹配当前程序及对象支持版本；对象 ID 符合固定登记清单，必要对象缺失、重复或数据不合法则拒绝恢复。第一版不自动迁移旧快照，不跳过必要对象或用默认值掩盖缺失。版本管理不等同于跨会话存档；版本升级规则、纯美术变化处理及独立错误代码四项规范仍为 PROPOSED，详见 [PLAYER_CONTROL_DESIGN.md](PLAYER_CONTROL_DESIGN.md)。
- 版本不兼容处理（CONFIRMED，2026-11-08）：任何世界状态修改前完成版本检查；整体 schemaVersion 或必要对象 stateVersion 不兼容属于 Critical Error，立即拒绝恢复并直接进入 RecoveryError，不执行自动完整重建、不部分恢复，保留原有效快照及全部永久进度。玩家仍可反复主动重试，每次从 Preflight 开始，不兼容数据不会因重试自动修复；完整五阶段架构未据此定案。
- 失败关闭式恢复（CONFIRMED，2026-11-07）：快照验证、必要对象、恢复、永久效果应用或世界一致性验证失败时，保留原有效快照与全部永久进度，持续锁定控制并屏蔽坠落/检查点事件；尝试重建管理状态，重应用原快照及永久进度并重新验证，不强行解锁或无限自动重建。重建次数和失败后去向由下述 RecoveryError 决策细化；完整五阶段、重建对象具体边界、独立机关恢复接口及暂停普通世界更新仍待确认，详见 [PLAYER_CONTROL_DESIGN.md](PLAYER_CONTROL_DESIGN.md)。
- RecoveryError 处理（CONFIRMED，2026-11-08）：除版本不兼容专门路径外，适用的正常恢复失败最多一次自动完整重建，重建成功后重新执行世界一致性验证；自动失败后停止自动重试并进入错误界面，提供手动重试和返回标题界面两个操作。玩家可反复主动重试，无固定次数上限；每次使用原当前有效快照从 Preflight 开始完整恢复，不从失败步骤继续、不重捕或覆盖快照、不触发额外自动完整重建，失败后返回 RecoveryError。同一时间只允许一个恢复流程，失败期间始终锁定控制，保留原检查点 ID、完整快照及全部永久进度和效果数据。错误编号、具体界面、返回标题后的运行时数据保留及跨会话持久化仍待确认。

- 两阶段世界恢复（CONFIRMED，2026-11-07）：先恢复登记临时对象的逻辑状态并重新应用永久进度/效果，不依赖实时碰撞体变化决定逻辑；再依据最终逻辑重建碰撞、更新平台位置、机关/路线碰撞及视觉，清理旧速度和过渡动画，两阶段均不播放普通机关操作动画。世界一致性验证通过后才进入玩家恢复，失败继续按 Fail-Closed 处理。
- 固定安全恢复锚点（CONFIRMED，2026-11-07）：各检查点预配安全坐标与朝向，特殊区域可配备用锚点；世界逻辑恢复、永久效果应用及物理/视觉重建后，玩家放置前校验碰撞空间、有效支撑及坠落区域。不改变检查点 ID、快照及永久进度，不随意选择未经设计验证的位置。
- 锚点预设优先级（CONFIRMED，2026-11-08）：一个主点，特殊检查点可配置多个备用点；先主点再按预设顺序验证备用点，选首个全部验证通过的位置，全部失败进入 RecoveryError；不扫描未知位置，配置与临时快照分离。每次恢复重置到主点、备用点不自动提升及静态支撑优先仍待确认。
- 世界一致性验证分级（CONFIRMED，2026-11-08）：玩法逻辑、永久进度、物理碰撞、路线、玩家安全及触发器错误属于 Critical Error，阻断恢复并执行 Fail-Closed；误导路线、机关或危险判断的视觉错误同样属于 Critical Error。不影响玩法的纯装饰和环境表现异常属于 Warning，可以记录但不阻断恢复，不得误当关键错误。独立验证器、只检查不修复、报告结构、两次验证及覆盖方案等七项架构提案仍为 PROPOSED，未改变既有淡入完成后由协调器开放控制的规则，详见 [PLAYER_CONTROL_DESIGN.md](PLAYER_CONTROL_DESIGN.md)。

以上为正式决策及已明确标注的提案；关卡细节和任务具体内容尚待设计。关卡结构的已确认方向见下节。

## 已确认的关卡结构与设计原则

决策主题：采用小型半开放关卡结构（Small Semi-Open Levels）。

确认日期：2026-11-06；依据：项目负责人本次明确指示。状态：已确认。

1. 历史地理组织表述：“每个重庆地标对应一个独立关卡”；其现实地标身份与虚构世界的适用性待核对。每关由多个相互连接的小区域组成的结构不因更名改变。
2. 玩家可以在一定范围内自由选择探索顺序，不要求完全按照固定路线推进。
3. 部分区域需要通过完成任务、寻找线索或解开机关才能解锁。
4. 玩家可以返回之前探索过的区域。
5. 每个关卡都有独立的主要任务和明确的完成目标。
6. 不制作大型开放世界，控制地图规模和开发复杂度。

关卡设计原则：

- 探索自由但不能让玩家迷路，通过任务提示、场景引导和视觉提示帮助玩家。
- 谜题与场景结合，尽量通过环境观察、角色移动、场景互动和机关操作解决，避免大量独立弹窗问答。
- 每个关卡有独立的完成体验：完成任务、获得奖励并自然进入下一关。奖励内容与关卡切换方式仍待详细设计。

待详细设计：每关最终区域数量、区域连接关系、地图拓扑结构、区域解锁条件、返回已探索区域的具体机制、关卡切换方式。

每关 3～4 个区域的早期通用参考不作为硬性要求；首关已明确以四个主要功能区域为规划基线。2026-11-07 确认 A 区为解放碑周边城市街区（起点、城市序章、新手教学），B 区为沧白路与洪崖洞入口（进入洪崖洞、NPC 互动、文化探索），C 区为洪崖洞多层吊脚楼探索区（建筑探索、平台跳跃、核心机关），D 区为嘉陵江岸与千厮门大桥观景段（主线收尾、夜景展示），主线旅行顺序为 A → B → C → D。首关整体仍以洪崖洞主线为核心，不据早期“每个地标独立关卡”的表述将四区拆关。

开局不采用直接选择景点的菜单（CONFIRMED）；后续通过城市地图和旅行手账随剧情开放其他重庆地标仅为考虑方案（PROPOSED / TO_VALIDATE）。具体尺寸、真实步行路线、坐标与内部路线仍待设计，游戏压缩路线不得描述为真实路线。最新地图状态见 [HONGYADONG_LEVEL_DESIGN.md](HONGYADONG_LEVEL_DESIGN.md)，不将功能定位当作最终地图。

## 首关 MVP 设计冻结

状态：CONFIRMED。确认日期：2026-11-09。单一正式决策：[Hongyadong First-Level MVP Design Freeze](DECISIONS.md)，包含 **Single Mainline Route A-B-C-D**、**Single-Clue Single-Device Puzzle** 和 **Permanent Progress Retention with Temporary State Rollback**。

首关只验收 A → B → C → D 的单一主线：A 区解放碑出生与基础教学 → B 区洪崖洞全景揭示、年轻游客委托自动接取与唯一核心线索 → C 区吊脚楼逐层向下、单装置正确操作启动升降平台并开放 D 区路线 → D 区嘉陵江岸指定位置拍摄与分享、记录主线完成并反馈。仅抵达 D 区不算通关；主线接取、C 区机关成功、路线开放、抵达指定位置及拍摄与分享成功均为必要条件。

保留 2D 横版、山城建筑探索及环境解谜，不引入传统战斗。支线、隐藏收藏品、A 区历史卡、额外探索路线、复杂分支及非必要机关不属于本次验收范围，原有设计保留供后续使用。

| 编号 | 首关 MVP 逻辑设计 | 状态 |
| --- | --- | --- |
| D01 | A → B → C → D 主线流程 | CONFIRMED |
| D02 | B 区 NPC 委托与自动接取 | CONFIRMED |
| D03 | C 区单线索、单机关解谜 | CONFIRMED |
| D04 | D 区拍摄与通关条件 | CONFIRMED |
| D05 | 永久进度与临时状态分类 | CONFIRMED |
| D06 | 失败后的检查点恢复行为 | CONFIRMED |

失败后保留主线接取、目标与主线完成、C 区机关完成、路线解锁和发放记录；若后续启用文化收藏，已获得记录也保留。临时机关操作、平台瞬时位置／阶段及其余临时状态按既有检查点恢复处理。恢复先还原临时逻辑、再应用永久效果，重建和验证通过后才开放控制；已解锁路线仍须可通行。可使用初始出生备用检查点，额外正式检查点位置不阻塞首关灰盒。

**PROPOSED**：NPC 完整对白、线索具体内容、机关外观、地图坐标、平台尺寸、奖励具体内容、额外检查点位置、摄像机参数和动画效果。上述细节不阻塞首关灰盒。MVP-G01 至 MVP-G06 已登记在 [DECISIONS.md](DECISIONS.md)，均为 NOT RUN。关卡与任务详情见 [HONGYADONG_LEVEL_DESIGN.md](HONGYADONG_LEVEL_DESIGN.md) 和 [QUEST_SYSTEM_DESIGN.md](QUEST_SYSTEM_DESIGN.md)。

## 重庆地域文化与真实建筑设计原则

状态：CONFIRMED；确认日期：2026-11-06。依据：项目负责人本次明确指示。

游戏需要突出重庆地域文化特色：

1. 重庆真实地标建筑应作为场景美术的重要参考。
2. 尽可能还原真实建筑的外观、空间结构和地域特色。
3. 允许为了 2D 横版游戏玩法进行合理空间压缩和游戏化改编。
4. 重庆历史、建筑文化、民俗、方言和非遗元素应自然融入探索、任务、NPC 互动和收藏系统。
5. 玩家应在游玩过程中主动发现和了解重庆文化，而不是只阅读大量说明文字。
6. 必须区分真实历史建筑资料与游戏原创设计，不得将虚构机关、道路或设施描述为真实存在。
7. 文化历史介绍需要有可靠资料依据。

该原则与既定卡通手绘风格、小型半开放结构及原创机关设计并行有效，不要求现实地图一比一复刻。具体文化内容、交互和收藏配置仍待设计；洪崖洞资料及探索方向见 [HONGYADONG_LEVEL_DESIGN.md](HONGYADONG_LEVEL_DESIGN.md)。

## 待验证提案（未确认为正式设计）

- 核心特色机制提案：山城立体空间探索。
- 可能涉及的空间元素：多层建筑、楼梯、桥梁、升降平台和隐藏道路。
- 玩家能力候选：行走、跳跃、交互、观察、推拉。

上述提案均待验证，不能视为已确认需求。核心玩法包含平台跳跃，不代表本节整套能力候选已全部确定。原生命值方案提案已于 2026-11-06 正式确认为不设置生命值系统，检查点快照恢复也已确认，相关内容已归入正式设计方向。玩家控制的规则、提案及初始测试参数见 [PLAYER_CONTROL_DESIGN.md](PLAYER_CONTROL_DESIGN.md)。

## 技术状态：M1.1 工程基线、正式选型与候选边界

| 技术 | 职责 | 状态 |
| --- | --- | --- |
| Phaser 3 | 两端共用的场景与渲染层 | M1.1 已使用；不因容器决策自动确认最终物理方案 |
| TypeScript | 共享核心及 Web 工程 | M1.1 已使用，本次不新增其最终选型决策 |
| Vite | Web 开发与构建；Electron 开发时加载其服务 | M1.1 已使用，M1.1.2 生产包复用其构建产物 |
| Electron | Windows 桌面容器 | CONFIRMED，2026-11-11；M1.1.2 工程已实现并验证 44.11.1 |

历史上上述四项均作为候选组合记录，原提案保留在 DECISIONS.md。当前工程采用 Phaser 3.90.0、TypeScript 5.9.3、Vite 8.3.7 和 Electron 44.11.1；M1.1.2 以 electron-builder 26.18.0 打包（见 README）。这些是工程已用依赖，最终物理引擎仍待原型验收，不将整套候选组合一并升级为最终技术决策。

### CONFIRMED：Matter-first Physics Prototype Validation

确认日期：2026-11-09。原 Matter-first 提案已确认为第一阶段验证路线：使用 Phaser + Matter 构建第一版物理灰盒，覆盖玩家控制、地形碰撞与移动平台承载，在 Web 和 Windows 上使用同一游戏核心及物理规则。Matter 验证不通过时，评估 Phaser + 受限自定义碰撞控制。最终物理选型依据原型结果另行决定。完整决策及原提案历史见 [DECISIONS.md](DECISIONS.md)。

### CONFIRMED：Physics Graybox Prototype Acceptance Criteria

确认日期：2026-11-09。独立物理灰盒按 T01–T06 验收：玩家移动与跳跃、静态地形碰撞（含单向平台）、动态平台与升降平台、触发器与碰撞事件、Web 与 Windows 一致性、页面切换和窗口最小化后的生命周期安全性。两端执行相同用例并验证玩家控制与物理引擎的兼容性。每组记录测试目标、前置条件、操作步骤、预期结果、实际结果、测试状态和问题。结果统一使用 PASS、BLOCKED、FAIL，不影响核心玩法的非关键表现异常另记 Warning。

两端必要测试全部通过后，Matter 才可提交为最终物理方案的候选，正式采用需另行决策。详细分组与记录模板见 [DECISIONS.md](DECISIONS.md)。验收标准已确认，测试尚未执行。

### CONFIRMED：Fixed Timestep Simulation with Accumulator

确认日期：2026-11-09。游戏核心与物理模拟使用固定时间步，由时间累加器管理推进；渲染独立于模拟。每个固定步对应一个 SimulationTick，与渲染帧数无关；Web 与 Windows 共用模拟时间步配置，不用单个异常大的时间步推进物理。

沿用已确认的 Tick 阶段：先收集本步相关物理和触发器事件，关闭批次后再由协调器仲裁。灰盒用例继续验证触发器、双端一致性与生命周期安全性。模拟频率、时间步数值、渲染插值及物理与游戏逻辑的具体更新顺序仍为 PROPOSED。完整规则见 [DECISIONS.md](DECISIONS.md)。

### CONFIRMED：Bounded Catch-up with Excess Time Discard

确认日期：2026-11-09。每帧把有效经过时间加入累加器，只用固定步长模拟，且每帧补算步数有上限。达到上限后丢弃剩余完整步时间，保留不足一步的余量。丢弃时间不更新物理或玩法、不产生虚拟 SimulationTick、不补发事件或推进事务。

页面隐藏或 Windows 窗口最小化时暂停模拟，不累计后台时间。恢复时重新建立有效时间采样基线，不补算后台停留时间，也不重放暂停前已处理事件。Web 和 Windows 共用上述语义；补算步数上限的数值、时间限制、过载诊断、暂停恢复实现及恢复时是否清除不足一步的余量仍为 PROPOSED。完整规则见 [DECISIONS.md](DECISIONS.md)。

### CONFIRMED：Centralized Runtime Lifecycle Controller

确认日期：2026-11-09。Web 和 Windows 的平台适配层将各自的原生信号转换为平台无关通知，由共享核心的 Runtime Lifecycle Controller 统一管理生命周期状态，并通过平台无关接口协调 Simulation Runtime 暂停与恢复。平台适配层不直接控制物理、玩家控制或业务状态。

生命周期控制独立于 SimulationTick、普通游戏事件分发及 CheckpointCoordinator。暂停时不产生模拟步；恢复时重建有效时间采样基线，不补算后台时间。固定时间步、有界补算及 Tick 仲裁规则不变。平台暂停与恢复不触发检查点恢复，也不修改永久进度、任务进度或 Event ID、Command ID、Transaction ID。控制器的具体实现仍为 PROPOSED，完整规则见 [DECISIONS.md](DECISIONS.md)。

### CONFIRMED：Pause Reason Set

确认日期：2026-11-09。所有模拟暂停来源经 Runtime Lifecycle Controller 提交添加或解除请求，由控制器统一维护有效暂停原因集合。解除请求只移除对应原因；集合非空时模拟保持暂停，全部解除后才允许协调恢复。对同一原因重复添加或移除均采用幂等处理；集合决定暂停状态，不以单一布尔值覆盖或按优先级仲裁。

Platform Adapters 只转换生命周期信号，不直接修改集合或控制物理；Simulation Runtime 执行暂停与恢复，不判断暂停原因。原因管理独立于 SimulationTick、普通游戏事件分发和 CheckpointCoordinator。恢复不补算后台时间，不触发检查点恢复，也不改写永久进度、任务进度或业务 ID。原因实例身份及所有权语义由后续 Owner-scoped Pause Token 明确；具体实现仍为 PROPOSED。

### CONFIRMED：Owner-scoped Pause Token

确认日期：2026-11-09。Runtime Lifecycle Controller 为每个独立有效暂停请求创建并登记一个独立的 Pause Token，且每个令牌只归一个 Pause Owner。Owner 持有自己的令牌，只能凭对应令牌请求释放；同一持续请求重复通知复用原令牌，同一 Owner 的不同独立请求使用不同令牌。重复释放必须幂等；无效令牌或其他 Owner 的令牌不得解除暂停。

Pause Reason Set 按有效令牌实例管理：集合非空必须保持暂停，全部释放后才允许协调恢复。Web 和 Windows 适配层转换信号，控制器维护集合，Simulation Runtime 只执行暂停与恢复。令牌管理独立于 SimulationTick 和 CheckpointCoordinator，不进入 Event Inbox、不复用 Event ID、Command ID、Transaction ID 或 Runtime Instance ID，也不写入检查点快照；暂停恢复不改写永久进度、任务进度或业务事务状态。完整规则和工程待定项见 [DECISIONS.md](DECISIONS.md)。

### CONFIRMED：Pause Token Acquisition and Release Protocol

确认日期：2026-11-09。正式方案为 Explicit Acquire / Release Protocol。Pause Owner 以自己的身份向 Runtime Lifecycle Controller 申请，控制器登记令牌及所有权后才返回令牌。同一持续有效请求复用原令牌，不额外创建或通过引用计数改变暂停状态；不同独立请求使用不同令牌，不能重新激活已释放令牌。

Owner 只能凭准确的自有令牌向控制器请求释放。成功释放只移除该令牌；重复释放必须幂等，未知、已释放或无权释放的令牌不改变有效集合。集合非空时必须保持暂停，清空后才允许控制器协调 Simulation Runtime 恢复。模拟运行时不创建、释放或验证令牌；协议不依赖 SimulationTick、普通游戏事件分发或 CheckpointCoordinator，不触发检查点恢复。具体接口、返回结构、失败分类、原子性与并发等工程细节仍为 PROPOSED，详见 [DECISIONS.md](DECISIONS.md)。

### CONFIRMED：Pause Request Identity and Deduplication

确认日期：2026-11-09。正式方案为 Owner-scoped Pause Request Key。Owner 为每个独立请求提供稳定的 Request Key。控制器按 Owner + Request Key 去重：同一 Owner 与 Key 的有效请求重复 Acquire 时复用原 Pause Token；不同 Owner 即使使用相同 Key，或同一 Owner 使用不同 Key，均为不同请求。Owner 或暂停原因类型相同不构成合并依据。

Request Key 只识别请求，Release 仍须提供准确的 Pause Token 并验证 Owner。释放后重提旧 Key 不得重新激活原令牌；新独立请求使用新 Key 和新 Token。有效令牌集合非空时继续暂停。身份管理独立于业务 ID、Runtime Instance ID、SimulationTick 和普通游戏事件分发，不经 CheckpointCoordinator，也不触发检查点恢复。生成职责及重试规则由下述决策明确；具体工程实现仍为 PROPOSED。

### CONFIRMED：Pause Request Key Generation and Lifecycle

确认日期：2026-11-09。正式方案为 Owner-generated Opaque Request Key。Pause Owner 在首次提交 Acquire 前生成并持有不含业务含义的 Request Key。同一持续请求的重复通知与 Acquire 重试沿用原 Key；不同独立请求使用新 Key，不同 Owner 使用相同 Key 也属于不同请求。已结束的请求不能用旧 Key 重新激活。

Runtime Lifecycle Controller 接收 Owner + Request Key，负责识别、登记、去重和维护 Key 与 Pause Token 的关联，不生成 Request Key。Release 仍以 Owner + Pause Token 验证所有权；Simulation Runtime 不负责 Key 或 Token 管理，有效令牌集合非空时继续暂停。Key 的类型、格式、算法、唯一性范围、创建与销毁实现、退役记录及 Acquire 失败恢复等仍为 PROPOSED，详见 [DECISIONS.md](DECISIONS.md)。

## 待确认事项

| 事项 | 当前状态 |
| --- | --- |
| 游戏类型与具体规则 | 2D 横版平台探索冒险游戏及跳跃、探索、解谜、发现已于 2026-11-12 CONFIRMED；具体机制与规则细节仍按各项状态执行 |
| 核心玩法的具体实现 | 三部分组成已确认；具体机制、操作规则及待验证提案的取舍待确认 |
| 任务系统详细设计 | 首关 MVP 主线目标、接取、通关及恢复边界已冻结。实时提示与独立日志、双线奖励及文化收藏方向已确认；具体追踪规则、UI 布局与操作方式、奖励分配、收藏品数量、收藏册名称，以及首关以外的任务规模、解锁、完成条件与恢复分类仍待讨论；详见任务系统设计文档 |
| 重庆文化元素的具体融入方式 | 重视真实建筑、历史文化与地域特色的原则已确认；具体区域、数量、互动方式、文化条目和收藏品配置待详细设计 |
| 游戏关卡设计 | 小型半开放结构与首关 A–D 主线已确认；首关具体坐标、空间连接、尺寸、摄像机与表现待灰盒，额外路线不属于 MVP；其余关卡数量、地标、拓扑、任务与奖励仍待设计 |
| 最终物理引擎与版本 | PROPOSED；Matter-first 路线已确认，Matter 尚未通过验收；Electron 容器已确认，不代表物理选型已定 |
| Electron 后续工程细节 | M1.1.2 已采用 44.11.1、electron-builder、安全本地协议及应用目录；正式安装器、图标／安装界面／发行元数据、原生存储及未来必要的 Preload／IPC 待设计 |
| 模拟、显示与性能 | PROPOSED；时间步数值与频率、每帧补算上限的数值、单次有效时间限制、卡顿数值参数、累加器溢出处理、具体更新顺序、渲染插值、逻辑分辨率与缩放、目标帧率、性能监控、过载诊断及输入延迟阈值待确认；有界补算和完整步积压丢弃规则已确认 |
| 物理参数与生命周期控制器实现 | PROPOSED；碰撞精度阈值、坡面角度限制、物理参数、控制器状态与转换、双端信号映射、令牌类型与生成、唯一性范围、Owner 表示、注册与生命周期、所有权验证、Acquire / Release 接口与返回值、失败分类、登记与状态生效的原子性、重复请求识别实现、同类型并存、并发协调、遗留与遗失恢复、记录与销毁清理、暂停 UI 与菜单、累加器恢复、控制器转换失败与异常恢复、初始化与销毁时机待确认；暂停原因集合、令牌所有权与协议语义已确认 |
| 暂停请求身份与退役实现 | PROPOSED；Request Key 的数据类型、格式、具体生成算法、唯一性范围、创建与销毁时机的工程实现，Owner、Key 与 Token 的数据结构，旧 Key 返回结果、退役记录与清理、Acquire 失败恢复与重试及并发协调待确认；Owner 生成不透明 Key、首次申请前准备与重试沿用规则已确认 |
| 平台兼容与存档互通 | PROPOSED；最低浏览器和 Windows 版本、双端存档互通方式待确认；早期 Windows 兼容性验证已确认 |
| 网页版本的发布方式 | 待确认 |
| Windows 版本的打包方式 | Electron 已确认；M1.1.2 应用目录已构建和独立运行验证，正式安装器与发行配置待设计 |

首关主线接取、C 区机关完成、路线解锁及主线完成均不随快照回滚。其他任务的接取与进行中状态、具体快照字段和跨会话存档仍待设计；唯一 ID 与幂等、永久效果优先于快照的既有规则不变。

此前聊天中提出的路线解谜、立体交通、体力系统及四个关卡等内容属于策划建议，不作为本次已确认需求。后续须经讨论确认后再纳入正式设计。

## 现有赛事材料

原始材料保存在 `大赛文档/`，本次维护不修改原件：

- [比赛通知](大赛文档/关于组织参加2026首届重庆市小游戏创新创业大赛的通知.docx)：记载赛道、材料、投稿方式和时间安排。按该文件，作品征集截止日期为 2026-12-06；必备材料为报名信息表及作品说明书，说明书采用 PPT/PDF，建议 10—20 页；可运行游戏包及不超过 3 分钟的演示视频属于加分材料。
- [报名信息表](大赛文档/附件1：2026首届重庆市小游戏创新创业大赛参赛报名信息表.doc)：含报名字段、原创声明及作品说明要求。其注意事项要求 PPT/PDF 包含目标用户、核心玩法、美术风格、广告融入方式与展示逻辑、商业化可行性。相关方案尚待讨论；此要求不等同于本次决定在游戏中接入广告。表中的示例信息不作为项目负责人真实报名资料。

上述赛事信息来自当前本地文件，后续如收到更新通知，应核对并更新。详细设计决定及状态变更记录在 [DECISIONS.md](DECISIONS.md)。

## 历史盘点：首关 MVP 冻结前的设计工作总览

此表保留冻结前的原始工作包及批次统计，不作为现行首关灰盒的开工门槛。P01、L01、L06、Q01、Q07 中涉及首关必做范围、主线、谜题、完成判定和进度保留的规则已冻结；这些工作包中的坐标、表现和工程实现仍可在灰盒中细化。L05 等可选探索不纳入首关 MVP 验收。当前冻结状态以本文件「首关 MVP 设计冻结」为准。

盘点日期：2026-11-09。范围：[DECISIONS.md](DECISIONS.md)、[PLAYER_CONTROL_DESIGN.md](PLAYER_CONTROL_DESIGN.md)、[PROJECT_BRIEF.md](PROJECT_BRIEF.md) 和 [HONGYADONG_LEVEL_DESIGN.md](HONGYADONG_LEVEL_DESIGN.md)。覆盖仍有效的 `PROPOSED`，以及以 `TO_VALIDATE`、待确认、待细化或候选表述的未决设计。同一个设计问题在不同文档或历史提案中重复出现时合并；已被正式决策替代的规则不再计数。任务和收藏只统计这四份文档已有记录。

**共 72 项，归为 11 个主题，建议分四批。** 下表明细每行计一项；同一项可以包含需要一起处理的细节。批次按最早需要处理的时间归类，属于建议排期，不改变各项设计状态，也不要求每项都单独形成正式决策。

| 主题 | 第一版开发前 | 开发中验证或细化 | 可后置 | 小计 |
| --- | ---: | ---: | ---: | ---: |
| 项目范围、技术与发布 | 1 | 4 | 0 | 5 |
| 关卡、文化与场景 | 2 | 7 | 1 | 10 |
| 任务、收藏与永久进度 | 2 | 5 | 0 | 7 |
| 玩家控制、交互与碰撞 | 1 | 8 | 0 | 9 |
| 检查点配置、快照与捕获 | 3 | 3 | 0 | 6 |
| 检查点恢复与验收 | 1 | 5 | 0 | 6 |
| 协调器、事件与退役 | 3 | 4 | 0 | 7 |
| 身份、关联与跨会话 | 1 | 5 | 2 | 8 |
| 命令交付与接收 | 3 | 2 | 0 | 5 |
| 业务事务执行与终态 | 2 | 2 | 1 | 5 |
| 最终事务结果反馈 | 2 | 2 | 0 | 4 |
| 合计 | 21 | 47 | 4 | 72 |

建议确认顺序：

1. **第一批：确定最小可玩范围和模块边界（21 项）。** 在已确认的单代码库、Web 优先、共享核心、Matter-first 验证路线及灰盒验收标准下，先明确洪崖洞主线通路与谜题，再明确控制权、任务进度与快照边界。随后按“事件分发 → 命令接收 → 事务执行 → 最终反馈”理清最小契约，明确捕获和恢复的提交与失败边界。开发前只需明确会阻塞相应模块的规则，接口形状和数值可留到实现。
2. **第二批：灰盒与联调（44 项）。** 按 T01–T06 在早期原型验证 Windows 兼容性，用同一核心比较两端行为。用原型验证地图和镜头、输入手感、物理支撑、触发器及锚点；结合实际流程细化事件、事务和结果反馈的实现，并建立关键恢复用例。先验证短路径，再补任务、文化内容和 UI。
3. **第三批：恢复回归与参赛交付（3 项）。** 执行恢复组合回归，确定网页发布与 Windows 打包方式，完成参赛作品说明。
4. **第四批：按实际需要扩展（4 项）。** 后续地标、跨会话存档与事务追踪、取消语义均可后置；不计入第一版开发前的确认范围。

历史提案中，优先级方向、Event 初始状态、单事件最多一条命令、独立运行实例 UUID、每笔事务最多一个最终结果、两种最终结果及 Failed 判定权已由正式决策明确。仍待定的是这些规则的落地细节。命令交付重试、业务事务重试与玩家检查点恢复是不同流程，分别盘点。

### 项目范围、技术与发布

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| P01 | 首个可玩版本的范围 | 细化玩法规则和山城立体探索的最小闭环；明确首关必做内容，以及观察、推拉等能力候选是否进入第一版。 | 1 |
| P02 | 双平台原型验收与技术细化 | 共用代码库、Web 优先、Windows 早期验证、Matter-first 路线及灰盒验收标准已确认。开发中按 T01–T06 记录结果，依据验证细化待选引擎、桌面封装、运行环境下限、分辨率与缩放及性能阈值；模拟节奏见 E01。最终物理方案需另行决策。 | 2 |
| P03 | 网页发布 | 确定网页版本的发布与访问方式。 | 3 |
| P04 | Windows 打包 | 确定 Windows 独立版本的打包与交付方式。 | 3 |
| P05 | 参赛作品说明 | 细化目标用户、核心玩法与美术呈现、广告融入方式说明及商业化可行性；不据此要求游戏接入广告。 | 3 |

### 关卡、文化与场景

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| L01 | 洪崖洞主线通路 | 确定 A → B → C → D 的最小可玩连接、区域解锁、回访和切换方式，以及 D 区主线收尾的基本动线；D 区尺寸、内部路线与观景点布置留到灰盒验证。 | 1 |
| L02 | A 区布局 | 验证 A1–A4、总长度与各段宽度、出生点、纪念碑调查及其他对象位置；保留解放碑历史卡和基础教学定位。 | 2 |
| L03 | B 区布局 | 验证 B1–B4 尺寸和连接、NPC 与调查点布置、原创示意图位置、B4 接入 C 区的具体路线。 | 2 |
| L04 | C 区布局 | 验证 C1–C3 的平台、楼梯、走廊及下层出口、跳跃间隙和高差、地图总体尺寸；不锁定示意图。 | 2 |
| L05 | 可选探索布置 | 验证居民支线入口、隐藏走廊和环路、隐藏观景点、建筑和文化调查点的空间分布。 | 2 |
| L06 | A+C 谜题最小规则 | 确定线索到操作到开路的可玩流程；维护示意图、先通电后启动、开关与启动杆、错误反馈及完成判定仍待取舍。 | 1 |
| L07 | 升降平台的关卡用途 | 验证控制装置和平台的位置、启动反馈、乘坐方向及解锁路线；具体承载碰撞见 C09。 | 2 |
| L08 | 镜头与剖面表现 | 验证 B2 全景演出的时长、构图和控制交接，以及镜头跟随、显示范围、场景分层和建筑剖面比例。 | 2 |
| L09 | 真实参考与文化内容制作 | 细化美术资产方法和简化程度，核对真实建筑、步行路线与文化资料，设计知识卡、方言及调查内容，区分真实资料和游戏原创空间。 | 2 |
| L10 | 后续地标与旅行串联 | 讨论后续关卡数量、地标、区域规模和解锁顺序，以及城市地图和旅行手账开放后续地标的规则、界面与操作。 | 4 |

### 任务、收藏与永久进度

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| Q01 | 首关任务流程 | 明确主线目标、阶段与完成触发；细化主支线规则、规模和是否将支线作为通关门槛。 | 1 |
| Q02 | NPC 与对白 | 细化小满暂定名、人物资料与完整对话，以及居民委托和明信片画师的具体内容。 | 2 |
| Q03 | 任务提示与日志 | 验证提示位置、日志分类、默认追踪、切换追踪及同时显示的目标数。 | 2 |
| Q04 | 任务奖励分配 | 细化主线、探索与居民委托的收藏品和解锁奖励、故事或隐藏内容、任务完成反馈。 | 2 |
| Q05 | 文化收藏品配置 | 设计类别、种类、每关数量、拾取方式与场景分布，以及明信片等具体条目；同一永久收藏 ID 不重复获得已确认。 | 2 |
| Q06 | 旅行纪念册 | 确定名称、翻页和分区方式、条目内容、未获得占位、视觉和交互呈现。 | 2 |
| Q07 | 任务进度与快照的边界 | 明确接取、进行中目标与局部谜题的临时或永久分类、必要记录和恢复后的重应用；已完成目标及永久效果保留。 | 1 |

### 玩家控制、交互与碰撞

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| C01 | 控制状态与控制权 | 明确探索、交互、演出、失败和恢复的状态切换、互斥、抢占、优先级及会话校验的最小规则。 | 1 |
| C02 | 锁定期间的物理行为 | 验证水平惯性、重力和支撑的处理、稳定支撑的交互开始条件、机关操作的锁定类型。 | 2 |
| C03 | 键位和平台输入 | 验证移动、跳跃、交互、暂停键位候选及提示文案，检查浏览器与 Windows 输入和失焦表现。 | 2 |
| C04 | 跳跃输入细化 | 验证按下/按住/松开、缓冲提前松键低跳、单次截断、旧接触清理与失焦/解锁行为；既有一次性请求规则不变。 | 2 |
| C05 | 移动与跳跃手感 | 验证加减速、最大速度、空中控制、跳跃初速和重力、低跳截断、土狼时间、缓冲与实际跳跃高距。 | 2 |
| C06 | 主动交互目标选择 | 验证范围、朝向与距离的权重、平局、提示和普通拾取反馈。 | 2 |
| C07 | 实体碰撞与脚底支撑 | 验证角色和脚底尺寸、有效接触方向、坡度与平台接缝、墙顶地边界、栏杆木梁装饰、NPC 等触发对象的碰撞取舍。 | 2 |
| C08 | 特殊单向平台 | 验证从下方穿越、从上方落地、边缘与楼梯墙体的连接，以及少量特殊平台的数量与位置。 | 2 |
| C09 | 升降平台的物理承载 | 验证平台碰撞、承载、支撑判定及与检查点恢复后的接触重建。 | 2 |

### 检查点配置、快照与捕获

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| S01 | 检查点和坠落触发配置 | 确定检查点的数量与位置、坠落区域的判定、触发边界及反复进出的防抖规则，以及其他环境失败条件与恢复细节。 | 2 |
| S02 | 同 Tick 仲裁配置 | 分配可能同时触发的检查点优先级，细化重复值验证时机与错误反馈；较小数值优先已确认。 | 2 |
| S03 | 固定快照登记清单 | 界定关卡内登记范围、对象能力与 ID、完整性验证和遗漏检测；不扩大到全世界复制。 | 1 |
| S04 | 快照字段和版本契约 | 定义元数据、每个对象逻辑字段及结构校验，细化版本升级标准与错误标识；严格版本校验与不迁移规则不变。 | 1 |
| S05 | 运行时快照存储 | 细化单一当前快照的运行时存储与跨区域、关卡切换的管理边界；与跨会话存档分开。 | 2 |
| S06 | 捕获提交边界 | 确定请求到安全模拟边界的衔接、局部冻结及解冻时序、状态修改拦截和提交完整性；简短失败反馈和开发诊断细节可随后验证。 | 1 |

### 检查点恢复与验收

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| R01 | 恢复流水线 | 细化预检查、两阶段恢复、永久效果重应用、对象恢复顺序、普通更新暂停范围及异常完整重建的边界。 | 1 |
| R02 | 安全恢复锚点 | 配置出生及正式检查点锚点与备用顺序，验证静态支撑优先、碰撞空间与坠落区检查，以及跨次恢复是否从主锚点重新验证、备用锚点是否自动提升。 | 2 |
| R03 | 世界一致性校验 | 细化校验器职责、校验报告、覆盖范围及世界重建后和玩家放置后的验证时机。 | 2 |
| R04 | 玩家恢复与触发器同步 | 验证玩家放置后重新建立支撑及触发器占用同步，细化淡出淡入时长和曲线、摄像机重新定位及输入锁定时机。 | 2 |
| R05 | RecoveryError 界面与返回标题 | 细化错误显示、诊断编号和返回标题时运行中数据的保留方式；既有自动与主动重试规则不变。 | 2 |
| R06 | 恢复验收计划 | 开发中建立捕获、版本、恢复、永久进度、锚点、校验、错误流程和触发器的关键用例，交付前完成组合回归；未执行不记 PASS。 | 2 |

### 协调器、事件与退役

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| E01 | SimulationTick 与批次接入 | 开发前明确逻辑 Tick 和请求批次的接入边界；固定时间步、有界补算、超额完整步丢弃与独立于 Tick 的生命周期控制、令牌所有权、Acquire / Release 协议及 Owner 生成与复用 Request Key 的语义已确认。开发中验证时间步与补算数值、卡顿与溢出处理、生命周期控制器、令牌协议与 Key 生成退役实现、暂停恢复、插值、更新顺序细节与引擎接入；既有收集和仲裁规则不变。 | 1 |
| E02 | 模块协作契约 | 细化三模块状态及转换、占用与尝试资格、全局锁、事件和命令接口；不要求为每项职责建类。 | 1 |
| E03 | 事件分发细节 | 细化事件类型与数据、Inbox 容量和资源管理、处理阶段及顺序；单轮和固定阶段原则不变。 | 2 |
| E04 | 协调器事件状态转换 | 细化无命令路径、已登记事件取消后的终态、Rejected 和 Retryable 等尚未定的处理状态、异常后能否重新进入 Processing、合法性校验与去重记录更新。 | 2 |
| E05 | 原子创建、登记与入队 | 细化候选 ID、初始记录、队列预留和统一提交的执行边界、可见性、失败反馈、回滚与恢复分配条件。 | 1 |
| E06 | 生产者确认 | 细化最终处理结果和确认接口、引用释放顺序、超时与异常、记录安全清理条件。 | 2 |
| E07 | 事件去重与水位线实现 | 细化记录结构、重复和过期识别、初始值、非连续退役记录、推进与清理顺序及实例销毁处理；不越过未安全退役 ID。 | 2 |

### 身份、关联与跨会话

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| I01 | Runtime Instance UUID | 选择 UUID 版本、生成库、类型及序列化格式，明确唯一性保证的表述。 | 2 |
| I02 | 运行实例身份接入 | 细化 Runtime Instance ID 的创建和清理时机、装配和访问接口。 | 2 |
| I03 | Event ID 生成器实现 | 细化装配、接口、数据类型、唯一性范围的工程实现及溢出处理；保留候选原子登记的编号规则。 | 2 |
| I04 | Command 与 Transaction 编号实现 | 分别细化独立生成器的装配、初始化销毁、接口、类型、唯一性范围、溢出与分配失败，以及与各自登记提交的边界。 | 2 |
| I05 | 显式身份关联契约 | 确定 Event、Command、Transaction 的关联结构和重试恢复追踪，是否需要 Event 与 Transaction 直连；关联基数和身份独立性已确认。 | 1 |
| I06 | 身份关联记录保留 | 细化运行中关联记录的生命周期和清理，协调命令、事务与事件各自的记录。 | 2 |
| I07 | 跨会话身份与事务追踪 | 评估 UUID 与关联记录的持久化、跨会话日志、身份兼容及是否支持恢复未完成事务。 | 4 |
| I08 | 跨会话游戏存档 | 单独决定永久进度和检查点是否持久化、存档结构与兼容方式；Web 与 Windows 的存档互通方式仍为 PROPOSED。 | 4 |

### 命令交付与接收

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| H01 | 命令交付结果契约 | 明确 Accepted 的成功判据及 Retryable、Rejected、Unknown 的分类、异常和返回接口。 | 1 |
| H02 | Unknown 核查 | 明确按原 Command ID 查询的权威结果、接口、关联及未确认处理；核查次数、时机与是否暂停其他操作可在开发中细化。 | 1 |
| H03 | 命令交付重试 | 细化仅在确认未接收且可重试时的次数、间隔、调度和原事件状态转换；与业务事务重试区分。 | 2 |
| H04 | 目标模块的接收与意图提交 | 细化记录与意图的结构、状态、原子执行和回滚、重复命令的应答及 Transaction ID 关联。 | 1 |
| H05 | 事务意图启动与记录清理 | 细化已提交但未启动或启动中断的恢复、模块重新初始化与接收记录和意图的保留及安全清理。 | 2 |

### 业务事务执行与终态

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| T01 | 执行结果上报与错误分类 | 明确执行模块上报契约、可重试和不可重试的分类及错误代码体系；分类权归 Transaction Manager。 | 1 |
| T02 | 安全恢复路径与终态判据 | 定义合法路径、优先级与选择规则、路径耗尽判定以及 Succeeded/Failed 的进入条件和时机。 | 1 |
| T03 | 业务事务重试调度 | 验证重试次数上限、间隔和调度策略；用尽次数后仍须判断其他安全恢复路径。 | 2 |
| T04 | 复合命令的效果边界 | 细化多世界对象效果的组织、执行与恢复边界；与接收记录和事务意图的原子提交分开。 | 2 |
| T05 | 事务取消的范围和语义 | 以后按实际需要决定是否支持取消及其语义；第一版不增加 Cancelled 终态。 | 4 |

### 最终事务结果反馈

| 编号 | 待设计事项 | 核对范围 | 批次 |
| --- | --- | --- | ---: |
| F01 | 结果事件载荷和请求接口 | 细化结果事件的数据结构、结果载荷、完整身份上下文和创建请求接口；不改变已确认的两种最终结果。 | 2 |
| F02 | 终态与唯一结果身份 | 细化终态到结果事件创建的关联、Result Event ID 的保存和重复反馈复用；每笔事务最多一个最终事件。 | 1 |
| F03 | 最终结果事件创建失败恢复 | 确定如何重新处理创建请求或补发缺失的最终反馈，保留事务终态和原有身份，不重跑已完成事务。 | 1 |
| F04 | 结果事件处理与安全清理 | 细化处理失败的恢复、重复反馈识别、追踪生命周期及安全清理，沿用通用事件去重和生产者确认原则。 | 2 |
