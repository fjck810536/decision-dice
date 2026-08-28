export function mountSystemControls({ state, audioEngine, onRefreshMode }) {
  const host = document.createElement('div');
  host.className = 'system-controls-host';
  host.innerHTML = `
    <div class="system-dock" aria-label="系統控制">
      <button type="button" class="system-dock-button" id="global-mute">MUTE</button>
      <button type="button" class="system-dock-button" id="global-settings">SET</button>
    </div>
    <section class="system-settings" id="system-settings" hidden aria-label="系統設定">
      <div class="system-settings-head">
        <div><span class="system-code">SYSTEM SETTINGS</span><strong>設定</strong></div>
        <button type="button" class="system-dock-button" id="settings-close">×</button>
      </div>
      <button type="button" class="system-setting-row" id="settings-sound">
        <span>聲音</span><strong>SOUND ON</strong>
      </button>
      <button type="button" class="system-setting-row" id="test-sound">
        <span>TEST SOUND</span><strong id="audio-status">LOCKED</strong>
      </button>
      <div class="system-setting-note">TEST SOUND 會直接檢查 iPhone Safari 的 Web Audio 是否已解鎖；目前音色仍是暫定程序音。</div>
      <button type="button" class="system-setting-row danger" id="clear-current-mode">
        <span>CLEAR MODE</span><strong>目前模式設定</strong>
      </button>
      <div class="system-setting-note">HOME 只是返回首頁，不清資料。Clear Mode 才會重設目前 Dice / Choice 的設定；history 保留。</div>
      <button type="button" class="system-setting-row danger" id="reset-session">
        <span>RESET SESSION</span><strong>全部清除</strong>
      </button>
      <div class="system-setting-note">Reset Session 會清除 Dice、Choice 與全部 history；等同重新整理。</div>
    </section>
  `;
  document.body.appendChild(host);

  const muteButton = host.querySelector('#global-mute');
  const settings = host.querySelector('#system-settings');
  const soundSetting = host.querySelector('#settings-sound');
  const soundSettingValue = soundSetting.querySelector('strong');
  const audioStatus = host.querySelector('#audio-status');
  const clearModeButton = host.querySelector('#clear-current-mode');
  const clearModeValue = clearModeButton.querySelector('strong');

  const syncSoundUi = () => {
    muteButton.textContent = audioEngine.isMuted ? 'UNMUTE' : 'MUTE';
    soundSettingValue.textContent = audioEngine.isMuted ? 'MUTED' : 'SOUND ON';
    audioStatus.textContent = audioEngine.status;
    muteButton.classList.toggle('is-muted', audioEngine.isMuted);
  };

  const syncModeUi = () => {
    const active = state.mode === 'dice' || state.mode === 'choice';
    clearModeButton.disabled = !active;
    clearModeValue.textContent = active
      ? (state.mode === 'dice' ? '清除骰子設定' : '清除選擇設定')
      : 'HOME 無目前模式';
  };

  const syncAll = () => {
    syncSoundUi();
    syncModeUi();
  };

  const toggleMute = async () => {
    audioEngine.toggleMuted();
    if (!audioEngine.isMuted) await audioEngine.unlock();
    syncSoundUi();
  };

  muteButton.addEventListener('click', toggleMute);
  soundSetting.addEventListener('click', toggleMute);

  host.querySelector('#test-sound').addEventListener('click', async () => {
    if (audioEngine.isMuted) audioEngine.setMuted(false);
    await audioEngine.playTestSound();
    syncSoundUi();
  });

  host.querySelector('#global-settings').addEventListener('click', () => {
    settings.hidden = !settings.hidden;
    syncAll();
  });
  host.querySelector('#settings-close').addEventListener('click', () => {
    settings.hidden = true;
  });

  clearModeButton.addEventListener('click', () => {
    const mode = state.mode;
    if (mode !== 'dice' && mode !== 'choice') return;
    const label = mode === 'dice' ? '骰子' : '選擇';
    const confirmed = window.confirm(`清除${label}模式目前設定？History 會保留。`);
    if (!confirmed) return;
    if (mode === 'dice') state.clearDiceMode();
    else state.clearChoiceMode();
    settings.hidden = true;
    onRefreshMode?.(mode);
  });

  host.querySelector('#reset-session').addEventListener('click', () => {
    const confirmed = window.confirm('RESET SESSION？Dice、Choice 與全部 history 都會清除。');
    if (confirmed) window.location.reload();
  });

  const unlockFromGesture = () => {
    audioEngine.unlock().finally(syncSoundUi);
  };
  document.addEventListener('pointerdown', unlockFromGesture, { passive: true });
  document.addEventListener('touchend', unlockFromGesture, { passive: true });

  syncAll();

  return {
    sync: syncAll,
    closeSettings() {
      settings.hidden = true;
    },
  };
}
