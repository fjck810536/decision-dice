# Architecture Freeze v0.1

本文件在 `interaction-spec-v0.1` 與 `physics-contract-v0.1` 基礎上，凍結 `decision-dice` v0.1 的正式程式邊界。

目的不是把所有 UI 細節鎖死，而是避免首頁、Dice、Choice、physics、renderer 各自重做一套邏輯。

---

## 1. Product shell

v0.1 是單一 SPA / App Shell，不是三個互相獨立的頁面。

```text
APP
├─ HOME
├─ DICE MODE
└─ CHOICE MODE
```

HOME、DICE、CHOICE 以 state transition 切換。

未來若需要 URL deep-link，可再加 hash routing；v0.1 不依賴 router framework。

---

## 2. 技術基線

v0.1 採：

- HTML
- CSS
- Vanilla JavaScript
- ES modules
- Three.js
- cannon-es

不引入 React / Vue / Svelte，也不需要 build step 才能在 GitHub Pages 執行。

建議正式結構：

```text
index.html
src/
  app.js
  styles.css
  state/
    session-state.js
  views/
    home.js
    dice.js
    choice.js
  dice/
    engine.js
    geometry-registry.js
    physics-world.js
    face-resolver.js
    feeder.js
    settling.js
    result.js
  choice/
    decision-engine.js
    slot-presenter.js
  render/
    retro-renderer.js
  audio/
    audio-engine.js
  ui/
    result-sequencer.js
    history.js
```

檔名可以微調，但責任邊界不能重新混在一起。

---

## 3. Shared Dice Engine

DICE MODE 與 CHOICE MODE 必須共用同一個 `DiceEngine`。

禁止：

- Dice 頁一套 physics。
- Choice 頁為了選項 mapping 再複製另一套 dice simulation。

### 3.1 建議介面

```js
const roll = await diceEngine.roll({
  pool: [
    { type: 'd20', count: 2 },
    { type: 'd6', count: 1 },
  ],
});
```

最低輸出概念：

```js
{
  dice: [
    {
      dieId,
      type,
      value,
      componentResults,
      finalPose,
      frozenBy,
    }
  ],
  total,
  startedAt,
  completedAt,
}
```

`total` 是衍生值；`dice[]` 是權威資料。

---

## 4. GeometryRegistry

所有骰型的幾何、face normal、標準編號與物理 shape 定義集中於 GeometryRegistry。

它負責：

- visual geometry factory。
- cannon shape factory。
- face labels / values。
- local face normals。
- die scale / baseline physical parameters。
- composite metadata。

它不負責：

- roll animation loop。
- Choice mapping。
- result UI。

### v0.1 registry keys

```text
d3
d4
d6
d8
d10
d20
d100
```

`d100` 為 composite entry。

`d3` 的正式可見物理形狀仍可在 implementation 階段選定，但 UI 對外直接顯示 d3，不回退成隱藏 d6 操作。

---

## 5. PhysicsWorld

`PhysicsWorld` 封裝 cannon-es world 與環境。

它負責：

- gravity。
- solver / broadphase。
- floor / invisible cage。
- collision groups / masks。
- fixed-step。
- body add/remove/replace。

它不判斷某一面代表哪個數字。

---

## 6. Feeder

`DiceFeeder` 負責骰子的生成節奏與出生安全。

正式預設：FAST Random Feeder。

它負責：

- staggered scheduling。
- random spawn pose / velocity / spin。
- occupancy check。
- deferral。

它不決定骰子結果。

---

## 7. SettlingController

`SettlingController` 負責 roll 的後半段。

階段：

```text
FEEDING
→ POST_FEED_NATURAL
→ ASSIST
→ PER_DIE_FREEZE
→ HARD_FINALIZE
→ DONE
```

它可以讀取目前 face direction 來穩定姿態，但不能收到「希望骰出 X」這種輸入。

正式引擎不得把 benchmark timeout 暴露成使用者失敗畫面；deadline 到達時完成 hard finalization，再交給 FaceResolver 讀結果。

---

## 8. FaceResolver

`FaceResolver` 是唯一把 final pose 轉成骰值的地方。

輸入：

- die type。
- final quaternion。
- GeometryRegistry face metadata。

輸出：

- face id。
- value。
- confidence / alignment（debug 可選）。

PhysicsWorld 與 RetroRenderer 不自行計算結果。

---

## 9. RetroRenderer

整個 App 共用一個主要 Three renderer / canvas stage 實例；不要為每顆骰子建立 renderer，也不要讓 Dice 與 Choice 各自建立一套 renderer。

`RetroRenderer` 負責：

- C′ 低解析 render target / canvas sizing。
- 約 12fps presentation cadence。
- flat shading。
- nearest / pixelated upscale。
- dither。
- camera framing。
- mesh sync。

它不擁有 physics truth。

UI DOM 不受 12fps renderer cadence 限制。

---

## 10. Dice Mode

流程凍結為：

```text
HOME
↓
DICE SETUP
  - d3 d4 d6 d8 d10 d20 d100
  - 每種骰子 - / +
↓
CONFIRM
↓
ROLL STAGE
↓
RESULT
```

### v0.1 結果

至少顯示：

- 個別骰值。
- 骰子 subtotal / sum。
- modifier 欄位保留資料模型，但 UI 可延後。
- TOTAL。

Selective reroll、hold、advantage、exploding dice 等不進 v0.1 UI，但資料結構不得阻止未來加入。

---

## 11. Choice Mode

流程凍結為：

```text
HOME
↓
CHOICE SETUP
  - 輸入選項數 N
↓
CONFIRM
↓
CHOICE READY
  - 系統產生 DecisionPlan
  - labels drawer 可選
↓
ROLL / SLOT
↓
RESULT
```

Choice 不自己實作亂數動畫。

它分成：

### DecisionEngine

負責公平 mapping 與推薦 method。

### Presenter

- dice method → 呼叫 shared DiceEngine。
- slot method → 呼叫 SlotPresenter。

---

## 12. DecisionPlan

Choice 必須先產生明確 plan，而不是把判斷散落在 UI click handler。

概念結構：

```js
{
  choiceCount,
  method,
  recommendedMethod,
  dieType,
  validRange,
  efficiency,
  rejectionRule,
}
```

骰子 method 可以使用 rejection sampling。

例：

- N=3 → d6 exact grouping。
- N=5 → d10 exact grouping。
- N=7 → d8，8 reroll。
- N=11 → 可用 d20 rejection，但 UI 可推薦 slot。

Choice engine 的公平性與 dice physics 是兩層不同責任。

---

## 13. SlotPresenter

Slot / reel 的結果由 DecisionEngine / uniform RNG 先決定，再做動畫呈現。

這與 physical dice 不同：

- Dice：final physical face 是結果來源。
- Slot：algorithmic selection 是結果來源，reel 是 presenter。

兩者的 provenance 必須如實記錄，不假裝是同一種隨機機制。

---

## 14. ResultSequencer

Dice 與 Choice 共用 ResultSequencer。

詳細模式為 v0.1 預設。

例：

```text
D8
→ 6
→ OPTION 6
→ 吃拉麵
```

或：

```text
METHOD: SLOT
→ 17
→ OPTION 17
→ 吃拉麵
```

concise / detailed toggle 可由同一份 provenance render，不維護兩套結果資料。

---

## 15. SessionState

v0.1 只保留目前瀏覽 session 的狀態。

- mode switch：保留。
- refresh：清除。
- Home leave：v0.1 顯示 `清除並離開`；保留功能位置可以存在但標示尚未開放。
- history cap：20。

不導入帳號、server database、localStorage persistence。

---

## 16. History provenance

歷史資料不得只存最終一句文字。

Dice 至少保留：

- pool。
- individual values。
- total。
- modifier（若有）。
- timestamp/session order。

Choice 至少保留：

- N。
- method。
- raw rolls / slot raw selection。
- rejection / rerolls。
- mapped option index。
- label（若有）。

UI 預設可摺疊，資料則保留詳細版。

---

## 17. Audio

AudioEngine 與 physics 分離。

碰撞聲由 physics events 餵入，但 AudioEngine 負責：

- rate limiting。
- 多碰撞 aggregation。
- Dice / Choice 不同聲音語言。
- global mute。

v0.1 聲音預設 ON，畫面上有常駐 MUTE。

不依賴 iOS `navigator.vibrate()`。

---

## 18. View / orientation contract

v0.1 mobile-first，正式使用只支援直向。

Landscape：

```text
目前僅直向使用
```

以 overlay 阻擋操作，但不清除 session state。

所有主要 touch target 目標至少約 44 CSS px。

不得出現頁面級水平 overflow。

---

## 19. Home 與功能頁的責任分離

HOME 才有：

- smooth sprite dice marquee。
- 完整中文 logo。
- stepped logo float。

進入 Dice / Choice 後，上述 HOME decoration 消失。

首頁 marquee 使用 pre-rendered / fake-3D sprite，不呼叫正式 DiceEngine。

這是刻意的：首頁是視覺殼，正式 dice stage 才是物理世界。

---

## 20. v0.1 Architecture Freeze

以下決策現在視為 frozen：

- 單 SPA / App Shell。
- Home / Dice / Choice 三個主要 view state。
- 無 framework、靜態 ES modules。
- Dice / Choice 共用 DiceEngine。
- GeometryRegistry 集中骰型知識。
- PhysicsWorld 不負責結果 mapping。
- FaceResolver 是 physical face → value 的唯一入口。
- FAST Random Feeder。
- FULL die↔die collision 為預設。
- Per-die Freeze + Hard Finalization。
- C′ RetroRenderer。
- Choice 使用 DecisionPlan。
- Dice 與 Slot 明確區分結果來源。
- Session-only state / history cap 20。

以下不是 frozen，仍可在實作時調整：

- typography / palette 細節。
- result animation 的精確秒數。
- drawer 視覺樣式。
- 每種骰子的 mass / restitution 微調。
- camera framing。
- d3 具體 physical geometry。
- d4 最終讀面 convention 的 UI 表現。
- collision sound 素材。

---

## 21. 下一個 implementation milestone

不再建立新的產品架構 prototype。

下一步直接建立正式核心模組，優先順序：

```text
GeometryRegistry
↓
PhysicsWorld
↓
FaceResolver
↓
DiceFeeder
↓
SettlingController
↓
DiceEngine
↓
RetroRenderer integration
↓
DICE MODE first end-to-end roll
↓
CHOICE MODE integration
```

第一個正式 milestone 應該做到：

> 在 Dice Mode 選擇骰池 → Confirm → Roll → 真正跑 shared DiceEngine → 顯示 individual results + total。

到此才開始把目前 homepage shell 接回正式功能。

---

## Status

**Application architecture: FROZEN for v0.1.**