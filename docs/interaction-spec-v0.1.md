# Interaction Spec v0.1

產品名稱：**擲骰與選擇障礙輔助裝置**  
Repository：`decision-dice`

本文件記錄目前已確認的互動與系統行為，作為後續 Renderer、Physics、Dice Engine、Decision Engine 與 UI 實作的共同規格。

> 原則：先固定互動與資料語義，再用 Retro Renderer Lab 與 Physics Benchmark 決定技術參數。字體、配色、邊框、Logo 比例等視覺細節目前不凍結。

---

## 1. App 整體結構

整體為單一 App，但使用者感覺像在同一台機器內切換工作模式，而不是一般網站換頁。

```text
HOME
├─ DICE SETUP
│  └─ CONFIRM → DICE ROLL
└─ CHOICE SETUP
   └─ CONFIRM → CHOICE ROLL
```

### HOME

- 首頁有完整 Logo。
- 首頁有骰子跑馬燈。
- 跑馬燈只屬於 HOME；進入 Dice / Choice 後消失。
- 完整 Logo 進入功能頁後消失。
- HOME 有兩個主要入口：`骰子`、`選擇`。
- Dice / Choice 模式之間可直接切換，不必強制先回 HOME。

### 返回 HOME

- 功能頁有明顯 HOME 按鈕。
- 返回 HOME 時顯示離開提示。
- 未來保留「保留」與「清除」兩種語義。
- v0.1 中「保留」位置存在但 disabled，文案標示尚未開放；不能做成看似可按卻沒反應。
- `清除並離開` 可用。

---

## 2. Session 與 State

- 狀態只存在本次 App session。
- Dice / Choice 模式之間切換時可保留各自狀態。
- Safari 重新整理後全部清空。
- v0.1 不做永久保存。
- History 上限正式定為最近 **20 筆**。
- History 上限屬於設定常數，不應深綁資料模型。

### App 切到背景

若 Roll 後使用者切去 LINE / 其他 App：

- Roll 本身仍視為成立。
- 結果與動畫必須分離。
- 回到 App 時，若動畫已無必要，可直接顯示已完成結果。
- 不因 App 進背景而重新 Roll。

---

## 3. Dice Mode

Dice Mode 分成 `DICE SETUP` 與 `DICE ROLL`。

### DICE SETUP

進入 Dice Mode 後只設定骰子數量，不直接進 Roll 畫面。

```text
D3    [- 0 +]
D4    [- 0 +]
D6    [- 2 +]
D8    [- 1 +]
D10   [- 0 +]
D20   [- 0 +]
D100  [- 0 +]

[確認]
```

規則：

- `+ / -` 是主要增減方式。
- 同骰型合併顯示數量，不在 Setup 階段展開每顆骰子。
- D3 有獨立入口，不使用 D6 長按切換。
- 按 `確認` 後才進入 DICE ROLL。

### DICE ROLL

- 顯示目前骰池摘要，例如 `D6 ×2 + D8 ×1`。
- Roll 時展開成實際 3D 骰子。
- 使用者按 ROLL 後，在本輪動畫完成前 ROLL 鎖定。
- v0.1 不允許排隊 Roll，也不以第二次點擊中止上一輪。

### Reroll / Lock

v0.1 不一定實作，但資料架構必須預留：

- 個別骰子 reroll。
- 鎖住某些骰子後只 Roll 未鎖骰子。

### Modifier

TRPG modifier（例如 `1d20 + 5`）不是 v0.1 強制功能，但資料模型必須預留支援。

---

## 4. Dice Result 資料模型

底層保存每顆骰子的 individual result，不只保存 total。

```text
RollResult
├─ dice[]
│  ├─ type
│  ├─ value
│  └─ detail
├─ modifier
├─ subtotal
├─ total
└─ timing / metadata
```

### Total

- 多骰支援加總，作為 TRPG 基本需求。
- D100 與其他骰子混用時，D100 的最終 percentile value 參與 total。
- 例：`D100 = 74`, `D6 = 5` → `TOTAL = 79`。

### Total 顯示格式

預設採：

```text
骰子 15
修正 +3
TOTAL 18
```

individual results 仍保留在詳細結果節奏中，例如：

```text
D6 = 3
D6 = 5
D8 = 7
────────
骰子 15
修正 +3
TOTAL 18
```

---

## 5. D100

D100 採經典 percentile dice：**兩顆 d10**，不是單顆 100 面骰。

```text
D100
├─ tens
├─ ones
└─ value 1..100
```

例如：

```text
70 + 4 → 74
00 + 0 → 100
```

視覺上是兩顆 d10；資料語義上對上層輸出單一 percentile value。

---

## 6. Dice Physics 原則

- 標準 TRPG 骰子使用接近實體骰型的 convex collision geometry。
- d4 / d8 / d10 / d20 使用 ConvexPolyhedron 類型概念。
- d6 使用 Box 即可。
- D100 使用兩個 d10 body。
- 標準骰面排列盡量遵循實體骰慣例。

### 碰撞品質降級

正式門檻由 iPhone Physics Benchmark 決定。

預期可有多級模式：

1. 完整模式：骰子碰環境，也彼此互撞。
2. Ghost 模式：骰子碰桌面 / 盒壁，但彼此不碰撞，可穿模。
3. 更大量骰子時，可進一步提高 sleep / settling assist。

優先拿掉「骰子彼此碰撞」，而不是先把不同骰型的 collision geometry 簡化成球或立方體。

### Roll 時間目標

- 目標約 1.5–2 秒內完成。
- 前 1 秒以自然物理為主。
- 超過 1 秒後啟動 settling assist。
- settling assist 的介入量以 **3 frames @ 24fps** 為半衰期快速增加。
- assist 不能先決定結果；只幫助當前物理狀態快速收斂。
- 若仍不穩定，可依當前最朝上的 face 協助落面，而不是任意改成預抽結果。

---

## 7. Choice Mode

Choice Mode 分成 `CHOICE SETUP` 與 `CHOICE ROLL`。

### CHOICE SETUP

第一階段只輸入選項數量。

```text
你有幾個選項？

[ 7 ]

[確認]
```

- 不在第一頁強迫輸入選項名稱。
- 按確認後才進入下一階段。

### Choice Count 範圍

- 產品領域上限目標：`99999`。
- v0.1 實作上限：**20**。
- 底層資料模型不得假設 choiceCount 永遠 <= 20。
- v0.1 UI 對 >20 顯示「目前版本支援最多 20 個選項」。

### CHOICE ROLL

確認數量後：

- 可以直接按下方 ROLL。
- 或點上方箭頭，打開選項名稱抽屜。
- 抽屜不是 Roll 的必要條件。
- v0.1 抽屜正式採 **push-down** layout。
- Roll 時抽屜自動收起。

### 修改選項數量

- 確認後仍可修改數量。
- 修改時警告現有選項文字可能被重排 / 截斷。

### 選項名稱

- 未填名稱仍可 Roll。
- 未命名結果顯示 `選項 N`。
- 重複名稱允許，但需警告，因為重複項會形成實質加權。
- 選項數字 mapping 預設固定，不每次洗牌。

---

## 8. Decision Engine

決策原則：

- 系統優先使用骰子。
- 系統會推薦最合理的方法。
- 使用者可以覆寫推薦。
- 若骰子效率太差，可推薦可見式拉霸機。

```text
DecisionPlan
├─ method: dice | slot
├─ recommended
├─ die / dice plan
├─ valid range
├─ rejected outcomes
└─ efficiency
```

### 無效骰 / Rejection

例如 7 個選項用 d8：

```text
D8
8

INVALID

REROLL

3

→ 選項 3
```

- 無效結果要讓使用者看到。
- 不偷偷在背景吞掉。
- ResultSequencer 保留 `INVALID → REROLL` 的顯示節奏。

---

## 9. Slot / 拉霸機

非骰子決策模式採**可見拉霸 reel**，優先於轉盤。

- 高選項數量時比圓形轉盤可讀。
- 可支援未來大量選項。
- 動畫與公平 RNG 分離。

流程：

1. Decision Engine 先公平抽出 `1..N`。
2. reel 播放捲動 / 減速 / 停止動畫。
3. 最終停在既定結果。

reel 永遠以數字為主體；選項名稱在結果階段再翻譯。

```text
METHOD: SLOT
↓
17
↓
OPTION 17
↓
選項名稱
```

---

## 10. Result Sequencer

結果不是一次 pop 出全部內容，而是具有節奏的逐步揭露。

- 預設為**詳細模式**。
- 未來可提供簡潔 / 詳細切換。
- Dice 與 Choice 共用 ResultSequencer 概念，但各自有不同步驟。

例如：

```text
D8
↓
8
↓
INVALID
↓
REROLL
↓
3
↓
OPTION 3
↓
拉麵
```

---

## 11. History

History 只存在本 session，最多最近 **20 筆**。

### Dice History

保存：

- 骰池配置
- individual results
- D100 細節
- modifier（未來）
- subtotal / total
- 必要的 roll metadata

### Choice History

保存：

- choice count
- method / DecisionPlan
- invalid roll / reroll 過程
- 最終 index
- 最終名稱（若有）

### History UI

- History 可展開查看詳細內容。
- `Roll Again with Same Setup` 不一定在 v0.1 實作，但 state model 預留。

---

## 12. Orientation / 手機方向

產品以直向手機為主要使用模式。

橫向時：

- 不勉強做完整橫向 layout。
- 顯示遮蔽畫面的 orientation overlay。
- 文案類似：`目前僅支援直向使用` / `請旋轉裝置`。
- overlay 出現時暫停主要互動。
- 轉回直向後恢復原狀態，不清除資料。

---

## 13. Audio

- 骰子碰撞聲預設開啟。
- Choice / 拉霸有自己的聲音語言，例如 reel tick、停止聲。
- Dice 與 Choice 都有聲音，但不是同一套音效。
- 介面需有明顯 MUTE。

---

## 14. Settings

v0.1 需要小型設定頁 / 設定面板，不做大型偏好系統。

至少預留：

- Sound / Mute
- Motion / reduced motion
- Physics info / debug 類資訊入口

---

## 15. Reset / Clear

需要區分：

- `Clear Mode`：只清目前模式。
- `Reset Session`：清 Dice、Choice、History，整個 session 歸零。

兩者不應混成同一個容易誤按的按鈕。

---

## 16. 視覺方向：已知但尚未凍結

目前方向：

- PS1 / 點陣 / late-90s Web3D。
- 3D 可採低內部解析度、nearest-neighbor、flat shading。
- 3D 顯示可故意低幀率，但物理保持較高更新率。
- HOME 跑馬燈保持絲滑無縫。
- Logo 可使用頓挫式漂浮。
- 跑馬燈骰子可使用預渲染 / sprite，而非大量即時 WebGL 物件。

以下由 `Retro Renderer Lab` 實機比較後凍結：

- internal resolution
- 3D presentation FPS
- antialias
- texture filtering
- flat shading
- vertex snapping / jitter
- UI 是否採 integer / stepped movement

---

## 17. 尚待實驗決定的技術參數

這些不是互動規格缺口，不要求先由使用者憑空決策：

1. `Retro Renderer Lab` 後固定 RetroRenderer 技術參數。
2. `Physics Benchmark` 後固定完整碰撞 / ghost collision 數量門檻。

---

## 18. 下一步工程順序

```text
Interaction Spec v0.1
        ↓
Retro Renderer Lab
        ↓
Physics Benchmark
        ↓
Architecture Freeze
        ↓
Dice Engine
        ↓
Decision Engine / Slot
        ↓
正式 App Shell / UI 美術
```

互動規格 v0.1 至此收口；後續實作者不應擅自改變上述流程與資料語義，除非另行更新本文件。
