# UI Implementation Notes v0.1

這份文件記錄 DiceEngine milestone 1 的實機 UI 回饋，避免暫時性測試介面被誤認為最終 UI。

## Loading boundary

HOME 不等待 DiceEngine / Three.js / cannon-es。

Dice 與未來 Choice 採 function-module lazy load：使用者點入功能後，才顯示該功能自己的 loading state 並載入重模組。

## iOS stepper interaction

Dice setup 的 `+ / -` stepper 必須避免 iOS Safari rapid tap 觸發 double-tap zoom。

只在 stepper 控制項使用 `touch-action: manipulation` 等 scoped interaction rules；不全站關閉 pinch zoom / accessibility zoom。

## Temporary UI status

Milestone 1 的功能頁（header、counter list、panel、result list、history 外觀）是 engine integration harness，不是 final visual design。

必須保留的是已凍結的 interaction / architecture contract，例如：

- Dice setup → Confirm → Roll → Result。
- shared DiceEngine。
- individual dice results + total。
- session state / history provenance。
- mobile-first portrait interaction。

仍可重做：

- typography。
- palette。
- counter visual form。
- panel composition。
- result presentation / animation。
- decorative elements。
- camera framing。
- loading screen visual language。

後續 UI 工作不得把目前 milestone harness 當成視覺基準鎖死。
