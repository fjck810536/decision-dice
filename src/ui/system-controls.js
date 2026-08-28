function makeLeaveGate({ mode, onClear }) {
  const modeLabel = mode === 'choice' ? '選擇' : '骰子';
  const backdrop = document.createElement('div');
  backdrop.className = 'system-modal-backdrop';
  backdrop.innerHTML = `
    <section class="system-modal" role="dialog" aria-modal="true" aria-labelledby="leave-title">
      <p class="system-code">LEAVE ${mode.toUpperCase()} MODE</p>
      <h2 id="leave-title">返回 HOME？</h2>
      <p>目前 v0.1 只開放「清除並離開」。這會重設${modeLabel}模式的設定，但 session history 仍保留。</p>
      <div class="system-modal-actions">
        <button type="button" class="system-option" disabled>保留｜尚未開放</button>
        <button type="button" class="system-option danger" data-clear>清除並離開</button>
        <button type="button" class="system-option" data-cancel>取消</button>
      </div>
    </section>
  `;

  const close = () => backdrop.remove();
  backdrop.querySelector('[data-cancel]').addEventListener('click', close);
  backdrop.querySelector('[data-clear]').addEventListener('click', () => {
    close();
    onClear();
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.body.appendChild(backdrop);
  backdrop.querySelector('[data-clear]').focus();
}

export function mountSystemControls({ state, audioEngine, onHome }) {
  const host = document.createElement('div');
  host.className = 'system-controls-host';
  host.innerHTML = `
    <div class="system-dock" aria-label="系統控制">
      <button type="button" class="system-dock-button" id="global-mute">SOUND ON</button>
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
      <div class="system-setting-note">Dice 碰撞與 Choice reel 使用不同的暫定程序音。音色之後可整批替換。</div>
      <button type="button" class="system-setting-row danger" id="reset-session">
        <span>RESET SESSION</span><strong>全部清除</strong>
      </button>
      <div class="system-setting-note">Reset Session 會清除 Dice、Choice 與全部 history；等同重新整理。Clear Mode 只清目前模式設定。</div>
    </section>
  `;
  document.body.appendChild(host);

  const muteButton = host.querySelector('#global-mute');
  const settings = host.querySelector('#system-settings');
  const soundSetting = host.querySelector('#settings-sound');
  const soundSettingValue = soundSetting.querySelector('strong');

  const syncSoundUi = () => {
    const text = audioEngine.isMuted ? 'MUTED' : 'SOUND ON';
    muteButton.textContent = text;
    soundSettingValue.textContent = text;
    muteButton.classList.toggle('is-muted', audioEngine.isMuted);
  };

  const toggleMute = () => {
    audioEngine.toggleMuted();
    if (!audioEngine.isMuted) audioEngine.unlock();
    syncSoundUi();
  };

  muteButton.addEventListener('click', toggleMute);
  soundSetting.addEventListener('click', toggleMute);
  host.querySelector('#global-settings').addEventListener('click', () => {
    settings.hidden = !settings.hidden;
  });
  host.querySelector('#settings-close').addEventListener('click', () => {
    settings.hidden = true;
  });
  host.querySelector('#reset-session').addEventListener('click', () => {
    const confirmed = window.confirm('RESET SESSION？Dice、Choice 與全部 history 都會清除。');
    if (confirmed) window.location.reload();
  });

  document.addEventListener('pointerdown', () => {
    audioEngine.unlock();
  }, { passive: true });

  document.addEventListener('click', (event) => {
    const leaveButton = event.target.closest('#leave-mode, #leave-choice');
    if (!leaveButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const mode = leaveButton.id === 'leave-choice' ? 'choice' : 'dice';
    makeLeaveGate({
      mode,
      onClear() {
        if (mode === 'choice') state.clearChoiceMode();
        else state.clearDiceMode();
        onHome();
      },
    });
  }, true);

  syncSoundUi();

  return {
    sync: syncSoundUi,
    closeSettings() {
      settings.hidden = true;
    },
  };
}
