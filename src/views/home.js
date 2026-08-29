const rows = {
  a: ['D4', 'D6', 'D8', 'D10', 'D20', 'D100', 'D3'],
  b: ['D20', 'D8', 'D3', 'D100', 'D4', 'D6', 'D10'],
  c: ['D10', 'D4', 'D100', 'D6', 'D8', 'D20', 'D3'],
  d: ['D6', 'D20', 'D4', 'D10', 'D3', 'D100', 'D8'],
  e: ['D100', 'D3', 'D8', 'D6', 'D20', 'D10', 'D4'],
};

function dieSprite(label, index = 0) {
  const type = label.toLowerCase();
  return `
    <span class="die-chip die-${type}" aria-hidden="true">
      <span class="die-preview-slot" data-die-preview="${type}" data-preview-variant="${index % 3}"></span>
    </span>
  `;
}

function dieChips(items) {
  const oneRow = items.map((label, index) => dieSprite(label, index)).join('');
  return `<div class="marquee-row">${oneRow}</div><div class="marquee-row" aria-hidden="true">${oneRow}</div>`;
}

function marqueeRow(items, classes = '') {
  return `<div class="marquee ${classes}"><div class="marquee-track">${dieChips(items)}</div></div>`;
}

export function renderHome(container, { onDice, onChoice }) {
  container.innerHTML = `
    <section class="home-scene">
      <div class="top-code" aria-hidden="true">
        <span>DECISION AUXILIARY DEVICE</span>
        <span>SYS:01</span>
      </div>

      <div class="home-marquee-strip" aria-label="骰子類型頂端跑馬燈">
        ${marqueeRow(rows.b, 'top-strip-row')}
      </div>

      <div class="home-marquee-field home-marquee-field-back" aria-label="骰子類型背景跑馬燈">
        ${marqueeRow(rows.a, 'back-row back-row-a')}
        ${marqueeRow(rows.d, 'reverse back-row back-row-b')}
        ${marqueeRow(rows.e, 'back-row back-row-c')}
      </div>

      <div class="home-marquee-field home-marquee-field-front" aria-label="骰子類型主跑馬燈">
        ${marqueeRow(rows.c, 'front-row front-row-a')}
        ${marqueeRow(rows.a, 'reverse front-row front-row-b')}
      </div>

      <section class="hero home-hero" aria-labelledby="main-title">
        <div class="logo-wrap home-logo-wrap">
          <p class="logo-kicker">DICE / CHOICE ASSIST SYSTEM</p>
          <h1 id="main-title" class="logo home-logo">
            <span class="title-line title-line-a">擲骰與</span>
            <span class="title-line title-line-b">選擇障礙</span>
            <span class="title-line title-line-c">輔助裝置</span>
          </h1>
          <div class="serial" aria-hidden="true">
            <span>TYPE: D.C.A.D.</span>
            <span>VER 00.1</span>
          </div>
        </div>
      </section>

      <nav class="home-controls home-mode-controls" aria-label="主要模式">
        <button class="mode-button" id="home-dice" type="button">
          <span class="mode-title">骰子</span>
        </button>
        <button class="mode-button" id="home-choice" type="button">
          <span class="mode-title">選擇</span>
        </button>
      </nav>
    </section>
  `;

  container.querySelector('#home-dice').addEventListener('click', onDice);
  container.querySelector('#home-choice').addEventListener('click', onChoice);

  const scene = container.querySelector('.home-scene');
  void import('../render/dice-preview.js')
    .then(({ hydrateDicePreviews }) => hydrateDicePreviews(scene))
    .catch(() => {});
}
