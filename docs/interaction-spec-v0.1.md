# Interaction Spec v0.1

產品名稱：**擲骰與選擇障礙輔助裝置**  
Repository：`decision-dice`

本文件記錄目前已確認的互動與系統行為，作為後續 Renderer、Physics、Dice Engine、Decision Engine 與 UI 實作的共同規格。

> 原則：先固定互動與資料語義，再做 Retro Renderer Lab 與 Physics Benchmark。字體、配色、邊框、Logo 比例等視覺細節暫不在本規格凍結。

---

## 1. App 整體結構

整體為單一 App，但使用者感覺像在同一台機器內切換工作模式，而不是一般網站換頁。

主要狀態：

```text
HOME
├─ DICE SETUP
│  └─ CONFIRM → DICE ROLL
└─ CHOICE SETUP
   └─ CONFIRM → CHOICE ROLL
```

### 1.1 HOME

- 首頁有完整 Logo。
- 首頁有骰子跑馬燈。
- 跑馬燈只屬於 HOME；進入 Dice / Choice 後消失。
- 完整 Logo 進入功能頁後消失。
- HOME 有兩個主要入口：`骰子`、`選擇`。
- 模式之間可直接切換，不必強制先回 HOME。

### 1.2 返回 HOME

- 功能頁有明顯 HOME 按鈕。
- 返回 HOME 時顯示離開提示。
- 未來會有「保留」與「清除」兩種語義。
- v0.1 中「保留」位置存在，但不執行保留功能；目前建議以 disabled / 尚未開放狀態呈現，避免看起來像壞掉。
- `清除並離開` 可用。
- Session 重新整理仍會清空。

---

## 2. Session 與 State

- 狀態只存在本次 App session。
- Dice / Choice 模式之間切換時，狀態可保留。
- Safari 重新整理後全部清空。
- 不使用永久保存作為 v0.1 的必要功能。
- History 有上限，不能無限增長。
- v0.1 暫定最近 20 筆；此數值可調整，不應寫死在資料模型中。

### 2.1 App 切到背景

若 Roll 後使用者切去 LINE / 其他 App：

- Roll 本身仍視為成立。
- 結果與動畫必須分離。
- 回到 App 時，若動畫已無必要，可直接顯示已完成結果。
- 不因 App 進背景而重新 Roll。

---

## 3. Dice Mode

Dice Mode 分成兩階段：`DICE SETUP` 與 `DICE ROLL`。

### 3.1 DICE SETUP

使用者進入 Dice Mode 後，不直接進 Roll 畫面。

第一階段只負責設定骰子數量：

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
- D3 直接有獨立按鈕，不使用 D6 長按切換。
- 按 `確認` 後才進入 DICE ROLL。

### 3.2 DICE ROLL

進入 Roll Stage 後：

- 顯示目前骰池摘要，例如 `D6 ×2 + D8 ×1`。
- Roll 時展開成實際 3D 骰子。
- 使用者按 ROLL 後，在本輪動畫完成前 ROLL 鎖定。
- v0.1 不允許連續排隊 Roll，也不以第二次點擊中止上一輪。

### 3.3 Reroll / Lock

v0.1 不一定實作，但資料架構必須預留：

- 個別骰子 reroll。
- 鎖住某些骰子後只 Roll 未鎖骰子。

### 3.4 Modifier

TRPG modifier（例如 `1d20 + 5`）不是 v0.1 強制功能，但資料模型必須預留支援。

---

## 4. Dice Result 資料模型

底層必須保存每顆骰子的 individual result，不只保存 total。

例如：

```text
2d6 + d8

D6 = 3
D6 = 5
D8 = 7
TOTAL = 15
```

建議概念：

```text
RollResult
├─ dice[]
│  ├─ type
│  ├─ value
│  └─ detail
├─ modifier
├─ total
└─ timing / metadata
```

### 4.1 Total

- 多骰需支援加總，這是 TRPG 基本需求。
- D100 與其他骰子混用時，D100 的最終 percentile value 參與 total。
- 例：`D100 = 74`, `D6 = 5` → `TOTAL = 79`。

### 4.2 Total 的顯示格式

目前使用者先前回答為 `10.10`，無法確定原第 10 題的 A / B / C。

**待確認：**

A.
```text
3 + 5 + 7 + 3
TOTAL 18
```

B.
```text
骰子 15
修正 +3
TOTAL 18
```

C.
```text
TOTAL 18
點開才看詳細
```

目前其他答案顯示使用者偏好「預設詳細」，但此項不替使用者猜測。

---

## 5. D100

D100 採經典 percentile dice：**兩顆 d10**。

不是單顆 100 面骰。

資料語義上，D100 是一個 composite die：

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

D100 的兩顆 d10 可保留細節，但對 total 與其他上層功能輸出單一 percentile value。

---

## 6. Dice Physics 原則

目標：

- 標準 TRPG 骰子使用接近實體骰型的 convex collision geometry。
- d4 / d8 / d10 / d20 使用 ConvexPolyhedron 類型概念。
- d6 可使用 Box。
- D100 使用兩個 d10 body。
- 標準骰面排列盡量遵循實體骰慣例。

### 6.1 碰撞品質降級

正式上限尚未確定，需以 iPhone Physics Benchmark 決定。

預期可有多級模式：

1. 完整模式：骰子碰環境，也彼此互撞。
2. 降級模式：骰子碰桌面 / 盒壁，但彼此不碰撞，可穿模。
3. 更大量骰子時，可進一步提高 sleep / settling assist。

不同骰型仍保留自身 collision geometry；優先拿掉「骰子彼此碰撞」，而不是先把所有骰子簡化成球或立方體。

### 6.2 Roll 時間目標

- 目標約 1.5–2 秒內完成。
- 前 1 秒以自然物理為主。
- 超過 1 秒後啟動 settling assist。
- 使用者指定：以 **3 frames @ 24fps** 為半衰期，逐步增加協助讓骰子倒向穩定面。
- 這個 assist 不能先決定結果；它只應幫助當前物理狀態快速收斂。
- 若仍不穩定，可依當前最朝上的 face 判定 / 協助落面，而不是任意改成預抽結果。

---

## 7. Choice Mode

Choice Mode 分成兩階段：`CHOICE SETUP` 與 `CHOICE ROLL`。

### 7.1 CHOICE SETUP

使用者第一次進入時只輸入「有幾個選項」。

```text
你有幾個選項？

[ 7 ]

[確認]
```

- 不在第一頁強迫輸入選項名稱。
- 按確認後才進入下一階段。

### 7.2 Choice Count 範圍

產品領域上限目標：`99999`。

v0.1 實作上限：**20**。

規則：

- 底層資料模型不要假設 choiceCount 永遠 <= 20。
- v0.1 UI 對 >20 的數量顯示「目前版本支援最多 20 個選項」。
- 之後可逐步提高到 100 / 999 / 99999，而不重寫 Decision Engine。

### 7.3 確認後的 Choice Roll 畫面

確認數量後：

- 可以直接按下方 ROLL。
- 或點上方箭頭，打開選項名稱抽屜。
- 抽屜不是 Roll 的必要條件。
- Roll 時抽屜自動收起。

### 7.4 修改選項數量

- 確認後仍可修改數量。
- 修改時需警告現有選項文字可能被重排 / 截斷。

### 7.5 選項名稱

- 未填名稱的選項仍可被 Roll。
- 未命名結果顯示 `選項 N`。
- 重複名稱允許，但需警告，因為重複項等同產生加權效果。
- 選項數字 mapping 預設固定，不每次洗牌。

---

## 8. Decision Engine

決策原則：

- 系統優先使用骰子。
- 系統會推薦最合理的方法。
- 使用者可以覆寫推薦。
- 若骰子效率太差，可推薦可見式拉霸機。

概念輸出：

```text
DecisionPlan
├─ method: dice | slot
├─ recommended
├─ die / dice plan
├─ valid range
├─ rejected outcomes
└─ efficiency
```

### 8.1 無效骰 / Rejection

若選項數量與骰子面數不整除，允許 rejection sampling。

例如 7 個選項用 d8：

```text
D8
8

INVALID

REROLL

3

→ 選項 3
```

規則：

- 無效結果要讓使用者看到。
- 不偷偷在背景吞掉。
- ResultSequencer 需保留 INVALID → REROLL 的顯示節奏。

---

## 9. Slot / 拉霸機

非骰子決策模式採**可見的拉霸 reel**，優先於轉盤。

原因：

- 高選項數量時比圓形轉盤可讀。
- 可支援未來大量選項。
- 動畫與公平 RNG 可分離。

### 9.1 公平性

拉霸動畫本身不決定結果。

流程：

1. Decision Engine 先公平抽出 `1..N`。
2. reel 播放捲動 / 減速 / 停止動畫。
3. 最終停在既定結果。

### 9.2 顯示內容

- reel 永遠以數字為主體。
- 選項名稱在最終結果階段再翻譯。

預設詳細揭露節奏：

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

結果不是一次性 pop 出全部內容，而是具有節奏的逐步揭露。

預設：**詳細模式**。

未來可提供簡潔 / 詳細切換。

Dice 與 Choice 共用 ResultSequencer 概念，但各自擁有不同步驟。

例：

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

History 只存在本 session。

每筆保存完整資料，而不是只保存最後文字。

### 11.1 Dice History

保存：

- 骰池配置
- individual results
- D100 細節
- modifier（未來）
- total
- 必要的 roll metadata

### 11.2 Choice History

保存：

- choice count
- method / DecisionPlan
- invalid roll / reroll 過程
- 最終 index
- 最終名稱（若有）

### 11.3 History UI

- History 可展開查看詳細內容。
- `Roll Again with Same Setup` 不一定在 v0.1 實作，但 state model 預留。

---

## 12. Orientation / 手機方向

產品以直向手機為主要使用模式。

橫向時：

- 不勉強做完整橫向 layout。
- 顯示遮蔽畫面的 orientation overlay。
- 文案類似：`目前僅支援直向使用` / `請旋轉裝置`。
- overlay 出現時暫停接受主要互動。
- 轉回直向後恢復原狀態，不清除資料。

---

## 13. Audio

- 骰子碰撞聲預設開啟。
- Choice / 拉霸有自己的聲音語言，例如 reel tick、停止聲。
- Dice 與 Choice 都有聲音，但不是同一套音效。
- 介面需有明顯 MUTE。

---

## 14. Settings

v0.1 需要一個小型設定頁 / 設定面板，不做大型偏好系統。

至少預留：

- Sound / Mute
- Motion / reduced motion 類設定
- Physics info / debug 類資訊入口（可視產品呈現方式決定是否公開）

---

## 15. Reset / Clear

需要區分兩種語義：

- `Clear Mode`：只清目前模式。
- `Reset Session`：清 Dice、Choice、History，整個 session 歸零。

兩者不應混成同一個容易誤按的按鈕。

---

## 16. 已確認但暫不凍結的視覺方向

這些方向存在，但不在本互動規格內鎖死：

- PS1 / 點陣 / late-90s Web3D 視覺語言。
- 3D 可低內部解析度、nearest-neighbor、flat shading。
- 3D 顯示可故意低幀率，但物理保持較高更新率。
- HOME 的跑馬燈本身保持絲滑無縫；Logo 可使用頓挫式漂浮。
- 跑馬燈骰子可使用預渲染 / sprite，而非大量即時 WebGL 物件。

需透過 `Retro Renderer Lab` 實機比較後再固定：

- internal resolution
- 3D presentation FPS
- antialias
- texture filtering
- flat shading
- vertex snapping / jitter
- UI 是否採 integer / stepped movement

---

## 17. 下一步工程順序

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

---

## 18. 待確認清單

目前真正未定的主要項目：

1. Total 詳細顯示格式（原第 10 題 `10.10`，需確認 A / B / C）。
2. v0.1 History 的精確上限是否採 20。
3. Renderer Lab 後固定的 RetroRenderer 技術參數。
4. Physics Benchmark 後固定的完整碰撞 / ghost collision 數量門檻。
5. Choice 抽屜最終採 push / overlay / 其他形式；目前只要求穩定、Roll 時自動收起。

以上項目未確定前，不應由實作者自行猜測成永久規格。
