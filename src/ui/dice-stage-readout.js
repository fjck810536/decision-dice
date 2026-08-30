export function installDiceStageReadout(root) {
  if (!root) return () => {};

  const relocate = () => {
    root.querySelectorAll('.roll-summary').forEach((summary) => {
      if (summary.classList.contains('dice-stage-readout')) return;

      const stage = summary.nextElementSibling?.matches?.('.dice-stage')
        ? summary.nextElementSibling
        : summary.parentElement?.querySelector?.('.dice-stage');

      if (!stage || summary.parentElement === stage) return;

      summary.classList.add('dice-stage-readout');
      stage.append(summary);
    });
  };

  const observer = new MutationObserver(relocate);
  observer.observe(root, { childList: true, subtree: true });
  relocate();

  return () => observer.disconnect();
}
