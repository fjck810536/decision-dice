const rows = {
  a: ['D4', 'D6', 'D8', 'D10', 'D20', 'D100', 'D3'],
  b: ['D20', 'D8', 'D3', 'D100', 'D4', 'D6', 'D10'],
  c: ['D10', 'D4', 'D100', 'D6', 'D8', 'D20', 'D3'],
  d: ['D6', 'D20', 'D4', 'D10', 'D3', 'D100', 'D8'],
  e: ['D100', 'D3', 'D8', 'D6', 'D20', 'D10', 'D4'],
};

function dieSprite(label) {
  const type = label.toLowerCase();
  const face = label === 'D100' ? '00' : label.replace('D', '');
  return `
    <span class="die-chip die-${type}">
      <span class="die-sprite" aria-hidden="true"><b>${face}</b></span>
      <span class="die-label">${label}</span>
    </span>
  `;
}

function dieChips(items) {
  const oneRow = items.map(dieSprite).join('');
  return `<div class="marquee-row">${oneRow}</div><div class="marquee-row" aria-hidden="true">${oneRow}</div>`;
}

function marqueeRow(items, classes = '') {
  return `<div class="marquee ${classes}"><div class="marquee-track">${dieChips(items)}</div></div>`;
}

export function renderHome(container, { onDice, onChoice }) {
  container.innerHTML = `
    <section class="home-p2-scene">
      <div class="top-code" aria-hidden="true">
        <span>DECISION AUXILIARY DEVICE</span>
        <span>SYS:01</span>
      </div>

      <div class="home-marquee-field home-marquee-field-back" aria-label="骰子類型背景跑馬燈">
        ${marqueeRow(rows.a, 'back-row back-row-a')}
        ${marqueeRow(rows.b, 'reverse back-row back-row-b')}
        ${marqueeRow(rows.c, 'back-row back-row-c')}
        ${marqueeRow(rows.d, 'reverse back-row back-row-d')}
        ${marqueeRow(rows.e, 'back-row back-row-e')}
      </div>

      <section class="hero home-p2-hero" aria-labelledby="main-title">
        <div class="logo-wrap home-p2-logo-wrap">
          <p class="logo-kicker">DICE / CHOICE ASSIST SYSTEM</p>
          <h1 id="main-title" class="logo home-p2-logo">
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

      <div class="home-marquee-field home-marquee-field-front" aria-label="骰子類型前景跑馬燈">
        ${marqueeRow(rows.c, 'front-row front-row-a')}
        ${marqueeRow(rows.a, 'reverse front-row front-row-b')}
        ${marqueeRow(rows.d, 'front-row front-row-c')}
      </div>

      <div class="home-lower-readout" aria-hidden="true">
        <span>PHYSICAL DICE / DECISION ENGINE</span>
        <span>READY</span>
      </div>

      <nav class="home-controls home-controls-paired home-p2-controls" aria-label="主要模式">
        <button class="mode-button" id="home-dice" type="button" data-index="01">
          <span class="mode-title">骰子</span>
          <span class="mode-subtitle">DICE POOL</span>
        </button>
        <button class="mode-button" id="home-choice" type="button" data-index="02">
          <span class="mode-title">選擇</span>
          <span class="mode-subtitle">DECISION</span>
        </button>
      </nav>
    </section>
  `;

  container.querySelector('#home-dice').addEventListener('click', onDice);
  container.querySelector('#home-choice').addEventListener('click', onChoice);
}
