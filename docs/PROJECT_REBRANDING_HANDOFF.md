# 《叠城大冒险》名称与项目定位更新交接

日期：2026-11-12。

面向对象：后续开发窗口。

确认依据：项目负责人本次明确指示。以下五项项目定位为 CONFIRMED。原交接创建时，文档同步、代码更名、构建和运行验证均待后续执行；本文件的建立不代表当时工程更名已经完成。2026-11-12 实际执行结果见第 7 节。

## 1. 已确认的名称与定位

| 项目 | 正式内容 | 状态 |
| --- | --- | --- |
| 中文正式名称 | 《叠城大冒险》 | CONFIRMED |
| 英文名称 | Layered City Adventures | CONFIRMED |
| 世界观 | 具有山城特色的虚构立体城市 | CONFIRMED |
| 游戏类型 | 2D 横版平台探索冒险游戏 | CONFIRMED |
| 核心体验 | 跳跃、探索、解谜、发现 | CONFIRMED |

统一项目介绍：

> 《叠城大冒险》（Layered City Adventures）是一款以具有山城特色的虚构立体城市为舞台的 2D 横版平台探索冒险游戏，核心体验是跳跃、探索、解谜与发现。

正文提及作品时使用《叠城大冒险》；窗口、按钮和标题等界面可使用不带书名号的“叠城大冒险”。英文名称保持上述拼写与大小写。

## 2. 新旧定位与历史记录

- 旧中文名称：山城有路：最后一单。
- 旧英文名称：Mountain City: Last Delivery。
- 两者保留为项目历史名称，不再作为当前对外名称。
- 当前世界是虚构城市。山城建筑、立体街巷与高差空间可以作为参考，不得把游戏空间默认描述成真实重庆路线或景区的直接复刻。
- 不再从旧名称中的 Last Delivery／最后一单推导送货、配送或“完成最后一单”是当前核心玩法。
- 本次指示只确认上表五项，不据此新增战斗、生存、随机生成、开放世界、强制收藏或其他玩法。

现有首关文档仍使用解放碑、沧白路、洪崖洞、嘉陵江等真实地名，并保留《把山城夜景寄给远方》等故事和任务设计。后续同步时须区分：

1. 项目名称和总体世界观：由本次确认更新。
2. 历史方案和真实建筑资料：保留原文、日期与来源，并说明其历史或参考性质。
3. 既有首关结构、谜题、任务和通关条件：本次未逐项重定，不因更名自动全部废止，也不得声称已经完成虚构世界适配。

若某条旧规则明确要求真实地理身份，与虚构世界定位存在冲突，标注具体条目及适用性待核对；不要通过机械替换地名、编造城市名称或重写任务剧情来掩盖冲突。该类叙事细节不阻塞本次界面更名。

## 3. 执行前盘点（历史记录）

盘点日期：2026-11-12。以下位置仍有旧名称或关联信息，开发前须再次核对实际文件。

| 文件或位置 | 当前内容与后续处理 |
| --- | --- |
| `AGENTS.md` | 项目定位仍为旧中英文名；同步最新名称和虚构世界定位，保留其他协作约束。 |
| `docs/PROJECT_BRIEF.md` | 标题、名称表及当前游戏方向需要同步；历史里程碑不得改写为以新名执行过的测试。 |
| `docs/DECISIONS.md` | 保留历史决策，追加本次名称与定位确认记录，说明其取代旧名称及不兼容的总体世界观表述。 |
| `README.md` | 标题、介绍及实际启动产物说明需要同步；不得提前写入尚未生成的新 EXE 或测试结果。 |
| `docs/PLAYER_CONTROL_DESIGN.md` | 项目名称需要同步；现有控制、输入、物理与暂停规则不因更名改变。 |
| `docs/HONGYADONG_LEVEL_DESIGN.md` | 项目归属名称需要同步；真实地标方案的历史／参考边界及虚构世界适用性需要说明，保留文件和原设计。 |
| `docs/QUEST_SYSTEM_DESIGN.md` | 项目名称需要同步；旧任务叙事的适用性需要核对，不擅自替换任务 ID、目标或奖励规则。 |
| `docs/PLAYER_CONTROL_DESIGN_REVIEW.md` | 属于历史审查报告；可补充现项目名称说明，不重写原审查结论。 |
| `src/core/game.ts` | 当前共享启动数据含旧中英文名，应统一更新，继续供双端复用。 |
| `index.html` | 当前页面标题为旧中文名，应更新。 |
| `electron/main.ts` | 默认窗口标题和启动错误对话框标题含旧名称，应更新。 |
| `package.json` | `description`、`build.productName` 含旧名称；用户可见产品信息应同步。内部包名与应用身份见下一节。 |
| `tests/platform-smoke.mjs` | 独立包启动路径仍引用 `Mountain City Last Delivery.exe`，应与后续实际产物保持一致。 |

该清单是已检查位置，不代替开发时的全仓搜索。忽略依赖目录、生成文件和测试证据中的历史名称，不能把它们当作当前源码遗漏直接批量替换。

## 4. 交给开发窗口的执行任务

任务目标：完成名称与定位同步，使 Web 和 Windows 当前可见界面采用新名称，不引入新玩法或架构变更。

### 4.1 文档同步

1. 先阅读 `AGENTS.md`、本文件、`DECISIONS.md`、`PROJECT_BRIEF.md`、`PLAYER_CONTROL_DESIGN.md` 和 `README.md`，检查 Git 工作区。
2. 在 `DECISIONS.md` 追加一条合并决策，建议标题为“Project Identity Update: Layered City Adventures”，状态 CONFIRMED，确认日期 2026-11-12，完整记录五项确认内容及依据。不拆成五条微型决策。
3. 同步项目概述、协作规则和相关设计文档中的当前名称与定位，明确历史内容和当前规则的区别。
4. 保留旧决策、原始赛事材料、旧测试证据、历史日志和报告。对被取代的当前表述补充说明，不删除历史。
5. 不将本次名称与定位确认解释为重新确认或取消所有旧任务与首关规则。

### 4.2 工程同步

1. 更新共享启动数据中的中英文名称，Web 与 Windows 继续共用同一入口、场景和游戏核心。
2. 更新浏览器页面标题、Electron 窗口标题、错误对话框标题及其他实际存在的用户可见旧名称。
3. 将 Windows 产品显示名更新为 `Layered City Adventures`，重新构建后核实实际 EXE 名称和位置，再同步启动说明及测试路径。不要手工重命名生成包中的文件来代替构建配置修改。
4. 更新项目描述中的当前产品介绍；不因更名升级依赖或更换打包工具。
5. 检查当前测试脚本对旧名称或旧产物路径的依赖，只调整相关预期和路径，保留原验收语义。

### 4.3 内部身份与范围边界

- 本次不移动或重命名现有项目目录 `D:\Workspace\Code_Projects\mountain-city-last-delivery`。
- 默认保留内部 `package.name`、Electron `appId`／AppUserModelID、临时目录前缀和既有存储路径，不把内部工程身份误认为当前展示名称。若后续要迁移这些身份，应先检查数据与路径影响，单独说明，不能顺手替换。
- 不修改 Event ID、Command ID、Transaction ID、Runtime Instance ID、Pause Owner、Request Key、Pause Token 以及检查点和任务身份的规则或已有记录。
- 保留 Web／Windows 共享核心、Electron 进程隔离、Matter-first、固定时间步、暂停协议和检查点恢复等正式技术与状态管理约束。
- 不实现新关卡、美术、角色动作或任务；不以更名替代可玩灰盒开发，也不在此次更名任务中扩大玩法范围。
- 不删除或覆盖无关修改，不执行 Git Commit、Push、发布或未经授权的不可逆操作。

## 5. 后续开发验收清单

原清单建立时均为 NOT RUN。下表更新为 2026-11-12 实际执行结果，具体证据及失败记录见第 7 节；未完成项目不记为 PASS。

| 编号 | 验收内容 | 当前状态 |
| --- | --- | --- |
| NAME-01 | 决策记录与项目概述准确包含五项正式定位，当前名称一致，历史名称有清晰说明。 | PASS |
| NAME-02 | Web 页面标题与共享场景显示“叠城大冒险”和 `Layered City Adventures`。 | PASS |
| NAME-03 | Windows 窗口、共享场景及产品显示名更新，重新构建后的独立包可以运行。 | PASS |
| NAME-04 | 测试启动路径、README 命令与实际生成的 EXE 名称一致。 | PASS |
| NAME-05 | 类型检查、适用自动化测试、Web 构建与 Windows 构建通过；双端正常运行、重启及暂停恢复未回归。 | PASS：Work 已核对 run-w2kthX 的三端新回归及当前版本，沿用匹配的已构建产物，26 项单测已报告通过。普通窗口人工体验仍 BLOCKED，旧失败保留，详见第 9 节。 |
| NAME-06 | 未改变核心架构和既有业务身份，未删除历史记录，未混淆虚构世界与真实地理资料。 | PASS |
| NAME-07 | 自动测试结束后，另行正常启动并保留一个人工体验窗口，提供截图和准确路径，不由测试脚本自动重启或关闭。 | PASS |
| NAME-08 | `git diff --check` 通过，并报告全部修改文件及仍存在的旧名称引用及其保留原因。 | PASS |

后续交付须分别说明：名称已同步的位置、仍属历史的引用、虚构世界尚未适配的旧叙事、实际执行的验证及未执行项目。名称同步完成不等于新玩法、美术或首关已经实现。

## 6. 原交接创建时的文档交付边界（历史记录）

本轮仅创建本交接文档。未修改既有策划文档、代码、工程配置或构建产物；未运行游戏测试；未执行 Git 提交。后续开发窗口读取本文件后执行上述更名任务，完成报告后停止，不自动进入其他里程碑。

## 7. 2026-11-12 实际执行记录

以下保留更名当轮和后续诊断的历史结果，NAME-05 的当前状态以后续 Work 审查记录为准，不回写原始失败报告。

更名及定位已实施；NAME-05 因平台测试的偶发 Web 中断保留 FAIL，不能将本轮整体宣称为全部通过。此前的 M1.2.2 未提交实现全部保留，没有新增玩法、提交、推送或发布。

### 名称与文档同步

- AGENTS、PROJECT_BRIEF、README、PLAYER_CONTROL_DESIGN、HONGYADONG_LEVEL_DESIGN、QUEST_SYSTEM_DESIGN 均采用当前中英文名称及虚构立体城市定位；DECISIONS 追加一条合并 CONFIRMED 决策，保留所有旧决策原文。
- PLAYER_CONTROL_DESIGN_REVIEW 保留旧审查项目名及日期，仅追加当前名称说明。原始赛事材料、旧测试日志和截图均未改写；真实建筑资料及地名保留参考。
- 具体适用性待核对：主角“来到重庆”、每个重庆地标独立关卡、旅行纪念册“来到重庆”及暂定名“重庆记忆册”、洪崖洞委托和 A/B/C/D 真实地点身份。已在相应文档说明，不编造替代地名，不修改任务目标、奖励、业务 ID 或拍摄分享通关条件。

### 工程与产物

- 共享 `PROJECT_IDENTITY` 提供双场景显示名称；浏览器标题、灰盒、诊断场景、Electron 默认窗口和错误对话框标题均已同步。错误对话框标题为源码核对，未故意制造启动故障弹窗。
- Windows 配置 `productName` 为 Layered City Adventures。首轮构建虽成功，文件属性仍为 Electron（名称属性核对 FAIL）；原因是原 `signAndEditExecutable: false` 跳过全部资源编辑。改为现有工具支持的 `signExecutable: false` 后重新构建，ProductName 与 FileDescription 均实测为 Layered City Adventures，仍不签名，未新增证书、图标或依赖。
- 实际 EXE：`D:\Workspace\Code_Projects\mountain-city-last-delivery\release\layered-city-adventures\win-unpacked\Layered City Adventures.exe`。新输出目录避免覆盖仍由用户体验的旧包；旧目录和旧窗口均未清理或关闭。
- 原无 `electron` 脚本，已补兼容入口，等价于 `electron:dev`。测试和 README 均指向新产物，未手工改名 EXE。
- 项目目录、package.name、AppUserModelID／appId、临时前缀及存储身份不变。两个 Windows 模式实测 appName 为 mountain-city-last-delivery，userData 为 `C:\Users\24839\AppData\Roaming\mountain-city-last-delivery`。
- 角色、固定步、暂停、Matter 世界、输入及两份灰盒测试等 10 个关键文件／锁文件前后 SHA-256 一致，见 [保留核对](../test-results/rebranding-20261112/preserved-after.json)；[产品与内部身份核对](../test-results/rebranding-20261112/identity-audit.json)。

### 实际命令与结果

| 命令／检查 | 结果 | 证据与边界 |
| --- | --- | --- |
| `npm.cmd test` | PASS | 20/20，含共享核心／Renderer 类型检查与 Electron 编译 |
| `npm.cmd run electron` | PASS | 实际创建新名可玩开发窗口；原生关窗后退出 0，服务退出；[窗口截图](../test-results/rebranding-20261112/electron-command-window.png) |
| `npm.cmd run test` | PASS | 再次实际执行，20/20 |
| `npm.cmd run electron:build` | PASS | Web 生产构建和新 Windows EXE 构建完成，产品属性核对通过 |
| `npm.cmd run test:platform` | 见逐轮记录 | 当前脚本保留全部操作与暂停断言，新增新名称与存储身份断言；不沿用旧 PASS |

| 轮次／当前报告 | Web | Electron 开发版 | 仓库外独立生产包 | 命令退出 |
| --- | --- | --- | --- | --- |
| [run-odchVH](../test-results/platform/run-odchVH/report.json) | FAIL：坡面操作中真实 blur→hidden，Tick 1099／Token 1，未继续行走 | PASS | PASS | 1 |
| [run-nS0u4P](../test-results/platform/run-nS0u4P/report.json) | PASS | PASS | PASS | 0 |
| [run-31w8KP](../test-results/platform/run-31w8KP/report.json) | FAIL：第一次隐藏恢复的场景检查时浏览器连接关闭，进程退出 4294967295 | PASS | PASS | 1 |

三轮之间未改测试脚本或应用源码。完整通过轮覆盖每端原诊断场景的隐藏启动、两轮隐藏／恢复、三次重启、双场景切换，以及灰盒移动、反向、空中控制、长短跳、缓冲、跨隙、坡面、墙顶碰撞、重置及持键最小化／隐藏恢复。生产包复制到仓库外，测试自建开发服务关闭后独立运行；三个进程均退出 0、未强制清理。[Web 灰盒](../test-results/platform/run-nS0u4P/003-web-graybox-completed.png)、[Windows 诊断](../test-results/platform/run-nS0u4P/010-electron-packaged-initial-load-before-activation.png)、[Windows 灰盒](../test-results/platform/run-nS0u4P/013-electron-packaged-graybox-completed.png)均已实际检查新中英文名。

尚未解决：首轮为何失焦变 hidden、追加轮 Edge 为何关闭均未定位。已核对焦点轨迹、页面错误、进程输出及退出情况，未发现对应应用页面异常；Windows Application 近期日志查询未取得可归因的 msedge 崩溃记录。不能据此证明是用户操作、游戏逻辑错误或旧重启超时同源。没有关闭后台节流、伪造可见性、延长超时或削弱断言，也不通过反复重试掩盖失败。开发命令与旧体验窗口并行时另有缓存访问警告，未清理用户目录或更换存储路径；未影响已完成的功能验证。

### 修改文件与旧引用

本次修改 16 个文件：`AGENTS.md`、`README.md`、`docs/PROJECT_REBRANDING_HANDOFF.md`、`docs/DECISIONS.md`、`docs/PROJECT_BRIEF.md`、`docs/PLAYER_CONTROL_DESIGN.md`、`docs/HONGYADONG_LEVEL_DESIGN.md`、`docs/QUEST_SYSTEM_DESIGN.md`、`docs/PLAYER_CONTROL_DESIGN_REVIEW.md`、`package.json`、`index.html`、`electron/main.ts`、`src/core/game.ts`、`src/rendering/phaser/startup.ts`、`src/rendering/phaser/graybox.ts`、`tests/platform-smoke.mjs`。未覆盖原有 `src/platform/web/main.ts`、样式、玩家／物理／输入及测试等未提交改动。

`git diff --check` 实际退出 0。任务期间另出现未跟踪的 `docs/DEVELOPMENT_ROADMAP.md`，保持原样，不纳入本次更名修改文件；所有未提交文件继续保留。当前版本和检查状态见 [版本记录](../test-results/rebranding-20261112/verified-version.json)。

当前应用源码、脚本与产品配置中无用户可见旧名称；保留的旧名位于历史决策、审查、交接盘点、旧产物说明及历史边界说明中。内部 mountain-city-last-delivery、io.mountaincity.lastdelivery、MCLD_DEV_URL 和临时目录前缀按授权范围保留，未机械替换。[旧名引用清单](../test-results/rebranding-20261112/retained-name-references.txt)仅记录当前文本，生成物与历史证据保持原样。

### 人工体验交付

全部自动化结束后，另以无调试参数的正常新 EXE 启动，默认显示可操作灰盒，已实际检查窗口和场景的中英文新名。启动 PID 38428；[启动记录](../test-results/rebranding-20261112/experience-launch.json)与[实际窗口截图](../test-results/rebranding-20261112/experience-window.png)已保存。该窗口不归测试脚本管理，不自动关闭、重启或最小化；原旧体验窗口也未操作，用户自行关闭。

再次启动：在 PowerShell 执行 `& 'D:\Workspace\Code_Projects\mountain-city-last-delivery\release\layered-city-adventures\win-unpacked\Layered City Adventures.exe'`。A/D 或 ←/→ 移动，Space 短按低跳、长按高跳，R 或「重置灰盒」回出生点；顶部「场景」选择可操作物理灰盒／固定步诊断，切换沿用销毁和页面重载。失焦恢复后先松开 Space 再按。没有将调试重置称为检查点恢复。

## 8. D01-R1 验收补充（2026-11-12）

NAME-05 保持 FAIL，D01-R1 为 BLOCKED，等待 Work 审查。正式设计和名称字符串未修改，旧失败未删除。

诊断现已区分预期隐藏／关闭、非预期 blur／hidden 和清理前关闭。时间线包含源时间、接收时间、用例、按键、诊断、页面／上下文／浏览器关闭与断连、crash、进程退出、原生前台 PID／HWND 及清理发起；先保存现场，再清理测试自己的 PID。发现中断后不抢回焦点、不重放按键。修正了未等待生命周期脚本安装、坡面中途重复激活、关闭状态被“已清理”覆盖、注入先后顺序遗漏及等待截图时可能误报 PASS 等测试层问题。

原 20 项及新增竞态回归共 21/21 PASS。有效观察：第一版隐藏注入 `run-0uvjFC` 的 Tick／物理／位置冻结、输入锁与松键门槛 PASS；第二版关闭注入 `run-V0C1Ia` 的请求→page close→context close→browser disconnected→进程退出→cleanup 链 PASS。命令均保留预期 FAIL／退出 1，不计正常回归。初版 `run-FUfhkZ` 的注入验证漏判先后顺序，虽原报告写 PASS，审计明确为 FAIL；严格校验后 `run-isv90S` 的注入前 blur 被判 FAIL，没有执行原计划隐藏。

两版正常定向 Web：[run-aXFnZF](../test-results/platform/run-aXFnZF/report.json)、[run-07MJ9j](../test-results/platform/run-07MJ9j/report.json) 均 FAIL。最新现场为测试自己的 Edge PID 36380，按住 D 时 blur，已记录的原生前台从 HWND 41423248 切到 15338990 又返回；cleanup 在中断后，用户体验窗口未关闭。50 ms 原生采样仅提供上下文，不能排除更短的切换或确定窗口类型；不能据此归因于用户、Matter 或具体 Edge 功能。

两轮限制后停止平台重试，完整三端和最终本地竞态修正后的平台验证为 NOT RUN；不能关闭 NAME-05。应用及现有产物哈希未变，不重建、不迁移存储、不更名。证据版本、源码差异、命令与未完成项见 [README](../README.md#d01-r1web-中断诊断与停止记录)、[汇总](../test-results/d01-r1-baseline/summary.json)及 [全部运行](../test-results/d01-r1-baseline/all-runs.json)。

执行流程补充（2026-11-12）：上段保留为建立本交接时的范围记录。项目负责人随后要求取消逐项往返 Work 分配提示词的流程。进入 [连续开发路线图](DEVELOPMENT_ROADMAP.md) 模式后，本任务作为 D01 执行，验证并记录完成后可继续下一项已列任务，不要求为普通任务单独等待 Work；真实决策关口与红线操作仍需暂停。

## 9. 2026-11-12 D01-R3 后续 Work 审查

Work 核对 [run-w2kthX](../test-results/platform/run-w2kthX/report.json)：Chrome Web、Electron 开发版和独立生产包均 PASS，无 unexpected-interruption，三个测试进程退出 0，cleanupFailures 为空。报告内 6 个测试文件与 ASAR 哈希匹配当前文件，基线提交为 `90f93e6`。开发报告记录同轮 `npm.cmd test` 26/26 PASS；Work 本轮为证据复核，未重新构建或重复运行平台测试。

NAME-05 按当前版本自动化范围更新为 PASS，不代表历史故障根因查明或 Edge 重新通过。普通 Chrome／Windows 窗口的独立人工操作、截图及人工生命周期检查仍为 BLOCKED／NOT RUN，不以自动化冒充人工结果。该工具定位限制单独保留，不继续阻塞实体／单向平台开发；D01-R3 整体仍未全部完成。下一项为 [路线图 D03](DEVELOPMENT_ROADMAP.md#7-当前任务与持续记录)。
