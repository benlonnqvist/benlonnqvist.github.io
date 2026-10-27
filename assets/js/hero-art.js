// Hero art: the pixel brain and the network behind it drift a little away from the mouse
// when it comes near. The brain moves a bit more than the network, for a touch of depth.
(function () {
  var art = document.getElementById('hero-art');
  if (!art) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var brain = art.querySelector('.art-brain'), net = art.querySelector('.art-net');
  var RADIUS = 320, MAX_BRAIN = 14, MAX_NET = 8;
  var target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, raf = 0;

  function onMove(e) {
    var r = art.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = cx - e.clientX, dy = cy - e.clientY, d = Math.hypot(dx, dy) || 1;
    var k = Math.max(0, 1 - d / RADIUS);           // 0 when far away, 1 right on top
    k = k * k * (3 - 2 * k);                       // ease
    target.x = dx / d * k; target.y = dy / d * k;  // unit direction away from the mouse
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function onLeave() { target.x = 0; target.y = 0; if (!raf) raf = requestAnimationFrame(tick); }
  function tick() {
    cur.x += (target.x - cur.x) * 0.12; cur.y += (target.y - cur.y) * 0.12;
    brain.style.transform = 'translate(' + (cur.x * MAX_BRAIN).toFixed(2) + 'px,' + (cur.y * MAX_BRAIN).toFixed(2) + 'px)';
    net.style.transform = 'translate(' + (cur.x * MAX_NET).toFixed(2) + 'px,' + (cur.y * MAX_NET).toFixed(2) + 'px)';
    if (Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.002) raf = requestAnimationFrame(tick);
    else raf = 0;
  }
  window.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('mouseleave', onLeave);
})();
