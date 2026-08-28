const rowA = ['D3', 'D4', 'D6', 'D8', 'D10', 'D20', 'D100'];
const rowB = ['D100', 'D20', 'D10', 'D8', 'D6', 'D4', 'D3'];

function dieChips(items) {
  const oneRow = items.map((label) => {
    const face = label === 'D100' ? '00' : label.replace('D', '');
    return `<span class="die-chip"><b class="die-shape">${face}</b><span class="die-label">${label}</span></span>`;
  }).join('');
  return `<div class="marquee-row">${oneRow}</div><div class="marquee-row" aria-hidden="true">${oneRow}</div>`;
}

export function renderHome(container, { onDice, onChoice }) {
  container.innerHTML = `
    <div class="home-chassis">
      <header class="home-sysbar" aria-hidden="true">
        <span>DECISION AUXILIARY DEVICE</span>
        <span>SYS.01 / READY</span>
      </header>

      <section class="home-title-deck" aria-labelledby="main-title">
        <div class="title-register" aria-hidden="true">
          <span>TYPE</span>
          <strong>DCAD</strong>
          <span>00.1</span>
        </div>

        <div class="home-title-copy">
          <p class="logo-kicker">DICE / CHOICE ASSIST SYSTEM</p>
          <h1 id="main-title" class="logo home-logo">
            <span class="title-line line-a">擲骰與</span>
            <span class="title-line line-b">選擇障礙</span>
            <span class="title-line line-c">輔助裝置</span>
          </h1>
          <div class="title-telemetry" aria-hidden="true">
            <span>RNG: LOCAL</span>
            <span>PHYS: ACTIVE</span>
            <span>SESSION: VOLATILE</span>
          </div>
        </div>

        <div class="title-reticle" aria-hidden="true">
          <i></i><i></i><i></i><i></i>
          <b>01</b>
        </div>
      </section>

      <section class="home-data-bus" aria-label="支援骰子類型">
        <div class="bus-label" aria-hidden="true"><span>SUPPORTED POLYHEDRA</span><span>BUS-A</span></div>
        <div class="marquee"><div class="marquee-track">${dieChips(rowA)}</div></div>
        <div class="marquee reverse"><div class="marquee-track">${dieChips(rowB)}</div></div>
      </section>

      <nav class="home-mode-console" aria-label="主要模式">
        <button class="mode-port mode-port-dice" id="home-dice" type="button" data-index="01">
          <span class="port-code"><b>01</b><small>DICE PROCESS</small></span>
          <span class="mode-title">骰子</span>
          <span class="mode-subtitle">BUILD A POOL / THROW PHYSICAL DICE</span>
          <span class="port-enter">ENTER <b>▶</b></span>
        </button>

        <button class="mode-port mode-port-choice" id="home-choice" type="button" data-index="02">
          <span class="port-code"><b>02</b><small>CHOICE PROCESS</small></span>
          <span class="mode-title">選擇</span>
          <span class="mode-subtitle">INPUT OPTIONS / LET THE DEVICE DECIDE</span>
          <span class="port-enter">ENTER <b>▶</b></span>
        </button>
      </nav>

      <section class="home-readout" aria-hidden="true">
        <div><span>DEVICE</span><strong>STANDBY</strong></div>
        <div><span>PHYSICAL DICE</span><strong>READY</strong></div>
        <div><span>DECISION ENGINE</span><strong>READY</strong></div>
      </section>

      <footer class="home-footer" aria-hidden="true">
        <span>NO SERVER / SESSION ONLY</span>
        <span>PRESS A PROCESS TO BEGIN</span>
      </footer>
    </div>
  `;

  container.querySelector('#home-dice').addEventListener('click', onDice);
  container.querySelector('#home-choice').addEventListener('click', onChoice);
}
