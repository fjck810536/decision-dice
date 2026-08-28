import './app.js';

const params = new URLSearchParams(location.search);
const mode = ['r1', 'r2', 'r3'].includes(params.get('mode')) ? params.get('mode') : 'r1';
document.body.classList.add(`probe-${mode}`);

const labels = {
  r1: 'R1 / TEXT ONLY — 字與 Logo 低解析化',
  r2: 'R2 / VISUAL FIELD — HOME 主視覺低解析重取樣',
  r3: 'R3 / FULL PAGE — 整頁低解析重取樣',
};

const switcher = document.createElement('nav');
switcher.className = 'probe-switcher';
switcher.dataset.html2canvasIgnore = 'true';
switcher.setAttribute('aria-label', 'Render probe mode');
switcher.innerHTML = ['r1', 'r2', 'r3'].map((id) => {
  const current = id === mode ? ' aria-current="page"' : '';
  return `<a href="?mode=${id}"${current}>${id.toUpperCase()}</a>`;
}).join('');
document.body.appendChild(switcher);

const caption = document.createElement('div');
caption.className = 'probe-caption';
caption.dataset.html2canvasIgnore = 'true';
caption.textContent = labels[mode];
document.body.appendChild(caption);

if (mode !== 'r1') {
  const overlay = document.createElement('canvas');
  overlay.className = 'probe-raster-canvas';
  overlay.dataset.html2canvasIgnore = 'true';
  document.body.appendChild(overlay);

  let busy = false;
  let stopped = false;
  const targetFps = mode === 'r2' ? 5 : 4;
  const captureScale = mode === 'r2' ? 0.42 : 0.29;
  const interval = Math.round(1000 / targetFps);

  async function capture() {
    if (busy || stopped || typeof window.html2canvas !== 'function') return;
    busy = true;

    try {
      const target = mode === 'r2'
        ? document.querySelector('.home-p2-scene')
        : document.body;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const shot = await window.html2canvas(target, {
        backgroundColor: '#080907',
        scale: captureScale,
        logging: false,
        useCORS: true,
        allowTaint: false,
        width: mode === 'r3' ? window.innerWidth : rect.width,
        height: mode === 'r3' ? window.innerHeight : rect.height,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        ignoreElements: (el) => el?.dataset?.html2canvasIgnore === 'true',
      });

      overlay.width = shot.width;
      overlay.height = shot.height;
      const ctx = overlay.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.drawImage(shot, 0, 0);

      if (mode === 'r2') {
        overlay.style.left = `${Math.max(0, rect.left)}px`;
        overlay.style.top = `${Math.max(0, rect.top)}px`;
        overlay.style.width = `${Math.min(window.innerWidth, rect.width)}px`;
        overlay.style.height = `${Math.min(window.innerHeight, rect.height)}px`;
      } else {
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100svh';
      }
    } catch (error) {
      caption.textContent = `${labels[mode]} / capture unavailable`;
      console.warn('HOME render probe capture failed', error);
      stopped = true;
    } finally {
      busy = false;
    }
  }

  const start = () => {
    capture();
    const timer = setInterval(capture, interval);
    addEventListener('pagehide', () => clearInterval(timer), { once: true });
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(start));
  } else {
    requestAnimationFrame(start);
  }
}
