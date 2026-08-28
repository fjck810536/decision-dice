const rowA = ['D3', 'D4', 'D6', 'D8', 'D10', 'D20', 'D100'];
const rowB = ['D20', 'D8', 'D3', 'D100', 'D4', 'D6', 'D10'];
const rowC = ['D10', 'D4', 'D100', 'D6', 'D8', 'D20', 'D3'];

function dieChips(items) {
  const oneRow = items.map((label) => (
    `<span class="die-chip"><span class="die-label">${label}</span></span>`
  )).join('');
  return `<div class="marquee-row">${oneRow}</div><div class="marquee-row" aria-hidden="true">${oneRow}</div>`;
}

export function renderHome(container, { onDice, onChoice }) {
  container.innerHTML = `
    <div class="top-code" aria-hidden="true">
      <span>DECISION AUXILIARY DEVICE</span>
      <span>SYS:01</span>
    </div>

    <section class="marquee-stack" aria-label="支援骰子類型">
      <div class="marquee"><div class="marquee-track">${dieChips(rowA)}</div></div>
      <div class="marquee reverse"><div class="marquee-track">${dieChips(rowB)}</div></div>
      <div class="marquee fast"><div class="marquee-track">${dieChips(rowC)}</div></div>
    </section>

    <section class="hero" aria-labelledby="main-title">
      <div class="logo-wrap">
        <p class="logo-kicker">DICE / CHOICE ASSIST SYSTEM</p>
        <h1 id="main-title" class="logo">
          <span>擲骰與</span>
          <span>選擇障礙</span>
          <span>輔助裝置</span>
        </h1>
        <div class="serial" aria-hidden="true">
          <span>TYPE: D.C.A.D.</span>
          <span>VER 00.1</span>
        </div>
      </div>
    </section>

    <nav class="home-controls" aria-label="主要模式">
      <button class="mode-button" id="home-dice" type="button" data-index="01">
        <span class="mode-title">骰子</span>
        <span class="mode-subtitle">DICE POOL / MULTI-DIE MODE</span>
      </button>
      <button class="mode-button" id="home-choice" type="button" data-index="02">
        <span class="mode-title">選擇</span>
        <span class="mode-subtitle">CHOICE / DECISION ENGINE</span>
      </button>
    </nav>

    <p class="home-status">PHYSICAL DICE｜DECISION ENGINE｜AUDIO READY</p>
    <div class="footer-code" aria-hidden="true">
      <span>NO SERVER / SESSION ONLY</span>
      <span>STANDBY</span>
    </div>
  `;

  container.querySelector('#home-dice').addEventListener('click', onDice);
  container.querySelector('#home-choice').addEventListener('click', onChoice);
}
