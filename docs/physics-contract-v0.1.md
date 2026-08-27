# Physics Contract v0.1

本文件定義 `decision-dice` v0.1 的骰子物理與結果判定契約。

它不是 benchmark 參數抄本，也不是要求所有裝置得到完全相同的軌跡；它規定的是正式 Dice Engine 必須維持的行為、結果來源與可接受的降級方式。

---

## 1. 核心原則

### 1.1 結果來自骰子的最終物理姿態

正式骰子模式不得先抽出一個結果，再把骰子轉到指定面。

流程必須是：

1. 建立骰子物理 body。
2. 讓骰子受重力、碰撞、旋轉與阻尼影響。
3. 進入 settling。
4. 在最終姿態上讀取朝上的面。
5. 該面就是結果。

任何 settling assist 都只能作用於「目前物理狀態已經形成的姿態」，不能替骰子指定一個預先選好的數字。

### 1.2 可接受非自然式收尾，不接受預選面

v0.1 允許為了可靠結束而使用：

- 增加 damping。
- 對目前最朝上的面做姿態穩定。
- Per-die freeze。
- 到達最大 settling 時間後，把尚未固定的骰子凍結在當下姿態。

最後一項不算作弊：它只是把當下狀態停止；停止後才讀面。

### 1.3 每顆骰子是獨立結果

Dice Engine 必須保存每顆骰子的個別結果，不得只保存總和。

最小結果資料：

```js
{
  dieId,
  dieType,
  value,
  finalPosition,
  finalQuaternion,
  frozenBy,
}
```

總和是衍生值，不是唯一真相來源。

---

## 2. 模擬與畫面更新分離

### 2.1 Physics cadence

物理世界以 fixed-step 約 `1/60s` 為基準。

正式實作可使用 accumulator / bounded substeps，但不可故意把 physics 降成 12fps 來模仿舊遊戲。

### 2.2 3D presentation cadence

骰子 3D 畫面採約 `12fps` 的視覺更新。

物理可以在兩次 render 之間持續正常計算。

### 2.3 UI cadence

按鈕、文字、drawer、歷史紀錄等 UI 不跟隨 12fps 限制；它們使用一般瀏覽器更新節奏。

因此正式產品保留三種時間語言：

- 一般 UI：即時。
- 裝飾動畫：可使用 stepped motion。
- 3D dice stage：約 12fps。

---

## 3. Retro Renderer Contract C′

v0.1 的正式 3D dice renderer 採以下方向：

- 內部 render width 基準約 `240px`，高度依 viewport 比例計算。
- Anti-aliasing：OFF。
- CSS upscale：nearest / pixelated。
- Flat shading。
- 簡單 dither overlay。
- Whole-object transform snap：OFF。
- 不做整顆骰子每幀硬吸附到像素格的抖動。
- 真正 vertex jitter 不列入 v0.1 必需功能。

PS1 感主要由低解析、低 presentation fps、flat shading、dither 與突然的狀態切換構成，而不是靠破壞物理穩定性取得。

---

## 4. 投料：FAST Random Feeder

正式高數量骰池採 staggered random feed，而不是同一幀全部出生。

### 4.1 基準節奏

目前 benchmark 通過的 FAST 節奏：

- 一般間隔：約 `22–50ms`。
- 約 `8%` 機率插入 `65–95ms` 的 micro-pause。

未來可為不同裝置或骰子尺寸微調，但產品感受必須維持：

> 快速、略不規則、仍能感覺是一顆一顆骰子被倒入，而不是瞬間生成一團粒子。

### 4.2 出生隨機性

每顆骰子的以下項目應受控隨機：

- spawn x / z。
- 初始 quaternion。
- 線速度。
- 角速度。

### 4.3 禁止出生重疊

出生位置必須做 occupancy / clearance check。

若沒有安全位置：

1. 換候選點。
2. 多次失敗後延後該顆骰子的生成。

不可為追求固定 cadence 而讓兩顆骰子在出生時互相穿透；這會造成非自然的分離爆衝。

---

## 5. Collision policy

### 5.1 預設使用 FULL collision

v0.1 正式路徑：

- die ↔ environment：ON。
- die ↔ die：ON。

Ghost collision 不是正式預設模式，只保留為 debug / 未來極端降級工具。

### 5.2 同一個 physics world

同一次 roll 的所有骰子必須存在於同一個 Cannon world，不使用每顆骰子各自模擬的假碰撞。

### 5.3 Convex physical primitives

標準骰子以 convex body 為基礎：

- d4：tetrahedron。
- d6：box。
- d8：octahedron。
- d10：pentagonal trapezohedron。
- d20：icosahedron。
- d100：兩顆 d10 的 composite die。

視覺 mesh 與物理 shape 可以有非常小的差異，只要不改變使用者可理解的骰子形狀與讀面規則。

---

## 6. Containment

### 6.1 Physics cage 可以比畫面大

可見舞台與物理 containment 不需要完全重合。

正式物理世界可使用不可見的：

- floor。
- 四面 side walls。
- ceiling。

組成完整封閉 cage。

牆可以向不可見區域加厚，以降低高速物體在離散步進中 tunneling 的風險。

### 6.2 離開相機畫面不等於骰子失效

骰子短暫或最終跑出可見 camera frame 是可接受的，尤其在大型 dice pool。

只要該 die：

- 仍存在於 physics world。
- 最終姿態可取得。
- 可以讀出合法結果。

就不應視為失敗。

### 6.3 Benchmark 的 `escaped` 不是產品 metric

先前 benchmark 的 `escaped` / `escaped cage` 是即時位置 debug 指標；它可能因骰子暫時進入厚牆區域而上升，再下降。

正式產品不顯示此數字，也不把它當 roll 成敗條件。

若保留 debug 訊息，應改名為例如：

`OUTSIDE INNER BOUNDS`

真正需要處理的是「body 已無法取得有效最終姿態」，而不是「骰子中心曾經越過某條內部界線」。

---

## 7. Settling 與 Per-die Freeze

### 7.1 Settling 從最後一顆骰子入場後計時

不可從使用者按下 Roll 的時刻固定計算 settling。

正確階段：

```text
ROLL
↓
FEEDING
↓
LAST DIE SPAWNED
↓
POST-FEED NATURAL WINDOW
↓
ASSIST / PER-DIE FREEZE
↓
FINALIZE REMAINING DICE
↓
READ RESULTS
```

### 7.2 Natural window

benchmark 基準為最後一顆出生後約 `0.25s` 的自然碰撞時間。

這段不施加結果導向的姿態穩定。

### 7.3 Face-aware assist

進入 assist 後，可以：

- 增加 linear / angular damping。
- 依目前最朝上的 local face normal，對齊 world up。
- 抑制小幅殘餘 angular velocity。

face target 必須來自當前物理姿態，而不是 RNG 預選結果。

### 7.4 Per-die Freeze

每顆骰子可在足夠穩定時個別 freeze。

freeze 的正式行為：

1. 保留當下 position。
2. 保留當下 quaternion。
3. 不做瞬移。
4. 不翻到另一面。
5. 轉成不會再被喚醒的 static / fixed collision body。
6. 後續動態骰子仍可撞到它。

這種「上一幀還微動、下一幀喀地固定」的視覺在 v0.1 被視為可接受，且符合整體 retro presentation。

### 7.5 Hard finalization

正式 Dice Engine 不要求所有 body 必須自然進入 sleeping 才能結束。

當最大 settling deadline 到達：

- 尚未 freeze 的骰子直接在當下 position / quaternion freeze。
- 讀取其當下朝上面。
- roll 正常完成。

因此 benchmark 的 `49/50 frozen before timeout` 不代表正式產品必須卡住等待第 50 顆。

---

## 8. Face resolution

### 8.1 一般多面體

每一面在 GeometryRegistry 保存 local face normal 與 label/value。

最終結果以：

```text
max(dot(worldFaceNormal, worldUp))
```

找出最朝上的 face。

### 8.2 標準編號

GeometryRegistry 必須固定每種骰子的標準面號與相對配置。

物理 engine 不自行猜面號。

### 8.3 d100

d100 在 v0.1 是兩顆 d10 的 composite logical die：

- tens：`00,10,...90`
- ones：`0...9`
- `00 + 0 = 100`

Dice Engine 對外回傳一個 logical d100 result，同時保留兩顆 component results。

---

## 9. iPhone benchmark evidence

以下為實機 benchmark 的代表結果，不是跨裝置 SLA，而是證明目前架構在目標手機等級上有足夠 headroom。

### V5.2 / D20 / FAST Random Feed / FULL collision / Per-die Freeze / Thick Cage

```text
10xD20 | avg 1.31ms | max 7.00ms | feed 0.49s | settle 2.52s | total 3.02s | frozen 10/10
20xD20 | avg 1.70ms | max 5.00ms | feed 1.11s | settle 2.87s | total 3.99s | frozen 20/20
50xD20 | avg 2.16ms | max 9.00ms | feed 2.70s | settle timeout | total 7.22s | frozen 49/50
```

使用者實際觀看未觀察到明顯暴衝；Per-die Freeze 的突然固定感被接受為符合 PS1 視覺語言。

結論：

- 50 顆 D20 的 raw physics throughput 不是主要瓶頸。
- staggered feed 成功避免初始大量 interpenetration。
- FULL collision 可保留。
- Per-die Freeze 可作為正式 settling 架構。
- 正式產品應使用 hard finalization，而不是等待 benchmark timeout。

---

## 10. 正式 Dice Engine 的最低驗收條件

v0.1 Dice Engine 完成前至少必須滿足：

1. 支援 `d3 d4 d6 d8 d10 d20 d100` 的 GeometryRegistry entry。
2. 一次 roll 可建立多種骰型的混合 pool。
3. 每顆骰子有獨立 body、結果與 provenance。
4. 物理 fixed-step 與 12fps 3D render 分離。
5. FAST Random Feeder 不產生出生重疊。
6. 預設 FULL die↔die collision。
7. settling 使用 per-die freeze + hard finalization。
8. 結果只從最終 pose 解讀，不做 preselected face correction。
9. d100 作為 composite logical die。
10. 50 顆級別需 graceful completion，不因最後一顆不 sleep 而永久卡住。

---

## 11. 不再屬於 physics blocker 的項目

以下項目可在正式引擎實作中微調，不需要再開新一代 physics benchmark 才能前進：

- 精確 damping 常數。
- 每種骰型的個別 mass / restitution。
- 最大 settling deadline 的最終秒數。
- 高數量時 camera framing。
- cage 的不可見外部尺寸。
- debug 指標名稱。

除非正式 d4 / d8 / d10 / d100 幾何暴露出新的特定 bug，否則不再重新討論「要不要 FULL collision / staggered feed / per-die freeze」。

---

## Status

**Physics architecture: FROZEN for v0.1.**

下一步：依此契約建立正式 `DiceEngine`、`GeometryRegistry`、`PhysicsWorld`、`FaceResolver` 與 `RollResult`。