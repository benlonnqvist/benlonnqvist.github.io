// Flappy Brain, a pixel-art mini game.
// A brain with little hands will not stop flapping. Aim a TMS coil over the brain (top view)
// and click to fire: the closer the coil is to the motor strip (dashed pink line), the longer the flapping stops.
// The coil needs a second to recharge. Everything is drawn into a low-resolution buffer and
// scaled up without smoothing, so one game pixel is PX screen pixels.
(function () {
  var cv = document.getElementById('flappy');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var buf = document.createElement('canvas'), b = buf.getContext('2d');
  var brainTop = document.createElement('canvas');
  var status = document.getElementById('flappy-status');
  var PX = 4;

  var LW, LH, G = {}, P = {}, col = {}, dpr = 1;
  var state = 'ready', t = 0, last = performance.now(), raf = 0, visible = true, overAt = 0;
  var brain, obs, score, best = 0, speed, charge, calmUntil, coil = null, pulses, msg, nextType, scroll = 0;
  var TYPES = ['neuron', 'mugs', 'papers'];
  try { best = parseInt(localStorage.getItem('flappyBrainBest') || '0', 10) || 0; } catch (e) {}

  // ---------- colours (from the site's theme tokens) ----------
  function hex(c) { c = (c || '').trim(); return /^#[0-9a-f]{6}$/i.test(c) ? c : null; }
  function mix(a, c, k) {
    var A = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); }), C = [1, 3, 5].map(function (i) { return parseInt(c.substr(i, 2), 16); });
    return '#' + A.map(function (v, i) { return ('0' + Math.round(v + (C[i] - v) * k).toString(16)).slice(-2); }).join('');
  }
  function readColors() {
    var s = getComputedStyle(document.documentElement);
    col.ink = hex(s.getPropertyValue('--fg')) || '#0e1116';
    col.bg = hex(s.getPropertyValue('--panel')) || '#fafaf7';
    col.pink = hex(s.getPropertyValue('--signal')) || '#c92a62';
    col.muted = hex(s.getPropertyValue('--muted')) || '#565a62';
    col.dark = mix(col.pink, '#000000', 0.35);
    col.light = mix(col.bg, col.pink, 0.28);
    col.grey = mix(col.bg, col.ink, 0.3);
    col.faint = mix(col.bg, col.ink, 0.08);
    col.white = mix(col.bg, '#ffffff', 0.7);
    col.coffee = mix(col.bg, '#7a4b2a', 0.75);
    if (brainTop.width && P.bw) paintBrainTop();
  }

  // ---------- pixel primitives (low-res buffer coordinates) ----------
  function px(x, y, c) { b.fillStyle = c; b.fillRect(x | 0, y | 0, 1, 1); }
  function rect(x, y, w, h, c) { b.fillStyle = c; b.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
    b.fillStyle = c;
    for (var n = 0; n < 400; n++) { b.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function disc(cx, cy, r, c) { b.fillStyle = c; for (var y = -r; y <= r; y++) { var w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6)); b.fillRect((cx - w) | 0, (cy + y) | 0, 2 * w + 1, 1); } }
  function ring(cx, cy, r, c) {
    b.fillStyle = c; var x = r, y = 0, err = 1 - r;
    while (x >= y) {
      [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(function (p) { b.fillRect((cx + p[0]) | 0, (cy + p[1]) | 0, 1, 1); });
      y++; if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  }
  function sprite(rows, x, y, pal, flipY) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[flipY ? rows.length - 1 - r : r];
      for (var c = 0; c < row.length; c++) { var k = row[c]; if (k !== '.') px(x + c, y + r, pal[k]); }
    }
  }

  // 3x5 pixel font
  var FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111',
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', ' ': '000000000000000', '.': '000000000000010', ':': '000010000010000', '!': '010010010000010',
    '#': '101111101111101', '-': '000000111000000', '^': '010101000000000', '/': '001001010100100', '?': '110001010000010',
    "'": '010010000000000', '>': '100010001010100', '+': '000010111010000'
  };
  function textW(s, k) { return String(s).length * 4 * (k || 1) - (k || 1); }
  function text(s, x, y, c, k, align) {
    k = k || 1; s = String(s).toUpperCase();
    if (align === 'center') x -= textW(s, k) / 2; else if (align === 'right') x -= textW(s, k);
    x = Math.round(x);
    b.fillStyle = c;
    for (var i = 0; i < s.length; i++) {
      var g = FONT[s[i]] || FONT[' '];
      for (var j = 0; j < 15; j++) if (g[j] === '1') b.fillRect(x + i * 4 * k + (j % 3) * k, (y + Math.floor(j / 3) * k) | 0, k, k);
    }
  }

  // ---------- sprites ----------
  var BODY = [
    '......kkkkkkkk......',
    '....kkppppppppkk....',
    '..kkppdpppdppppppk..',
    '.kppdpppdppppdppppk.',
    'kppppdpppppdppppdppk',
    'kpdppppdppdppppppppk',
    'kppdpppppdpppdppdppk',
    'kpppdppdpppppppdpppk',
    '.kppppppdpppdpppppk.',
    '..kkpdppppppppdppk..',
    '....kkkkppppkkkkk...',
    '........kppk........',
    '........kppk........',
    '........kkkk........'
  ];
  var HAND = ['..kkk..', '.kwwwkk', 'kwwwwwk', 'kwwwwwk', 'kwwwwwk', '.kwwwk.', '..kkk..'];
  var MUG = ['kkkkkkkk..', 'kwwwwwwkk.', 'kwccccwk.k', 'kwwwwwwk.k', 'kwccccwkk.', 'kwwwwwwk..', '.kkkkkk...'];

  // ---------- layout ----------
  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.clientWidth, narrow = W < 640;
    PX = W < 420 ? 3 : 4;
    LW = Math.ceil(W / PX); LH = narrow ? Math.round(456 / PX) : Math.round(340 / PX);
    cv.style.height = LH * PX + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(LH * PX * dpr);
    buf.width = LW; buf.height = LH;
    if (narrow) { var gh = Math.round(LH * 0.6); G = { x: 0, y: 0, w: LW, h: gh }; P = { x: 0, y: gh, w: LW, h: LH - gh }; }
    else { var pw = Math.round(Math.min(300, W * 0.3) / PX); G = { x: 0, y: 0, w: LW - pw, h: LH }; P = { x: LW - pw, y: 0, w: pw, h: LH }; }
    var bh = Math.min(P.h - 22, (P.w - 10) * 1.2); P.bh = Math.round(bh); P.bw = Math.round(bh / 1.2);
    P.cx = Math.round(P.x + P.w / 2); P.cy = Math.round(P.y + 10 + P.bh / 2);
    P.ox = Math.round(P.cx - P.bw / 2); P.oy = Math.round(P.cy - P.bh / 2); // integer origin of the brain image
    if (!coil) coil = { x: P.cx - P.bw * 0.2, y: P.cy, show: false };
    coil.x = Math.max(P.x, Math.min(P.x + P.w - 1, coil.x)); coil.y = Math.max(P.y, Math.min(P.y + P.h - 1, coil.y));
    // pixel centres of the motor strip, exactly as painted in paintBrainTop
    P.strip = [];
    for (var yy = 0; yy < P.bh; yy++) for (var xx = 0; xx < P.bw; xx++) {
      var uu = (xx + 0.5) / P.bw - 0.5, vv = (yy + 0.5) / P.bh - 0.5;
      if (inBrain(uu, vv) && Math.abs(xx + 0.5 - P.bw / 2) >= 0.6 && Math.abs(vv - (sulcus(Math.abs(uu)) - 0.05)) < 0.6 / P.bh)
        P.strip.push([P.ox + xx + 0.5, P.oy + yy + 0.5]);
    }
    paintBrainTop();
  }

  // top-down brain, painted once into its own small canvas
  function inBrain(u, v) { // u: left(-)/right(+), v: front(-)/back(+), both in [-0.5, 0.5]
    var au = Math.abs(u); if (Math.abs(v) >= 0.49) return 0;
    var rx = 0.5 * (0.86 + 0.14 * (v + 0.5)) * Math.sqrt(Math.max(0, 1 - Math.pow(v / 0.49, 2)));
    return au <= rx ? 1 : 0;
  }
  function sulcus(au) { return -0.1 + (au / 0.46) * 0.2 + 0.03 * Math.sin(au * 18); } // central sulcus
  function paintBrainTop() {
    brainTop.width = P.bw + 2; brainTop.height = P.bh + 2;
    var tb = brainTop.getContext('2d');
    for (var y = 0; y < P.bh; y++) for (var x = 0; x < P.bw; x++) {
      var u = (x + 0.5) / P.bw - 0.5, v = (y + 0.5) / P.bh - 0.5;
      if (!inBrain(u, v)) continue;
      var edge = !inBrain(u + 1 / P.bw, v) || !inBrain(u - 1 / P.bw, v) || !inBrain(u, v + 1 / P.bh) || !inBrain(u, v - 1 / P.bh);
      var au = Math.abs(u), c = col.light, sv = sulcus(au);
      if (Math.abs(v - sv) < 0.6 / P.bh) c = col.ink;
      else if (Math.abs(v - (sv - 0.05)) < 0.6 / P.bh && (x + y) % 2 === 0) c = col.pink; // motor strip
      else if (au > 0.06 && au < 0.44 && [-0.33, -0.24, 0.2, 0.33].some(function (k) { return Math.abs(v - (k + 0.03 * Math.sin(au * 14 + k * 9))) < 0.5 / P.bh; })) c = col.grey;
      if (edge || Math.abs(x + 0.5 - P.bw / 2) < 0.6) c = col.ink;
      tb.fillStyle = c; tb.fillRect(x + 1, y + 1, 1, 1);
    }
  }

  // ---------- game state ----------
  function reset() {
    var h = G.h;
    brain = { y: h * 0.68, vy: 0, flapT: 0, arm: 0, kick: 0 };
    obs = []; score = 0; speed = Math.max(30, G.w * 0.2); charge = 1; calmUntil = 0; pulses = []; msg = null; nextType = 0;
    t = 0;
  }
  function clamp(v, a, c) { return Math.max(a, Math.min(c, v)); }

  function step(dt) {
    var h = G.h, gravity = 2.4 * h, flap = 0.64 * h, period = 0.38;
    var calm = state === 'play' && t < calmUntil;
    brain.arm += dt * (calm ? 0 : 20);
    brain.kick = Math.max(0, brain.kick - dt * 4);
    pulses.forEach(function (p) { p.age += dt; }); pulses = pulses.filter(function (p) { return p.age < 0.6; });
    if (msg) { msg.age += dt; if (msg.age > 1.6) msg = null; }
    scroll += dt * (state === 'play' ? speed : speed * 0.3);
    if (state === 'ready') { brain.y = h * 0.68 + Math.round(Math.sin(performance.now() / 260) * 2); return; }
    if (state === 'over') { brain.vy = Math.min(brain.vy + gravity * dt, 0.6 * h); brain.y = Math.min(h - 7, brain.y + brain.vy * dt); return; }
    t += dt;
    charge = Math.min(1, charge + dt / 1.0);
    if (!calm) { brain.flapT -= dt; if (brain.flapT <= 0) { brain.vy = -flap; brain.flapT = period; brain.kick = 1; } }
    brain.vy = clamp(brain.vy + gravity * dt, -0.75 * h, 0.62 * h); brain.y += brain.vy * dt;

    speed += dt * 0.6;
    var spacing = Math.max(52, G.w * 0.4), gap = h * Math.max(0.32, 0.46 - score * 0.006), ow = 12;
    if (!obs.length || obs[obs.length - 1].x < G.w - spacing) {
      var c = h * (0.28 + Math.random() * 0.44);
      obs.push({ x: G.w + ow, w: ow, top: Math.round(c - gap / 2), bot: Math.round(c + gap / 2), type: TYPES[nextType++ % TYPES.length], passed: false });
    }
    var bx = Math.round(G.w * 0.28), r = h * 0.058;
    for (var i = 0; i < obs.length; i++) {
      var o = obs[i]; o.x -= speed * dt;
      if (!o.passed && o.x + o.w < bx - r) { o.passed = true; score++; }
      if (bx + r > o.x + 1 && bx - r < o.x + o.w - 1 && (brain.y - r < o.top || brain.y + r > o.bot)) return gameOver(({ neuron: 'Bonk! Flapped into a neuron.', mugs: 'Bonk! Too much coffee.', papers: 'Bonk! Rejected by Reviewer 2.' })[o.type]);
    }
    obs = obs.filter(function (o) { return o.x + o.w > -12; });
    if (brain.y - r < 0) return gameOver('Bonk! Flapped into the ceiling.');
    if (brain.y + r > h) return gameOver('Too calm: the brain sank to the floor.');
  }
  function gameOver(why) {
    state = 'over'; overAt = performance.now();
    if (score > best) { best = score; try { localStorage.setItem('flappyBrainBest', String(best)); } catch (e) {} }
    if (status) status.textContent = why + ' Score ' + score + '. Click the brain to try again.';
  }

  // how long a pulse at (fx, fy) stops the flapping: falls off with distance (in game pixels)
  // from the coil's focal point to the nearest pixel of the drawn motor strip
  function calmFor(fx, fy) {
    var u = (fx - P.ox) / P.bw - 0.5, v = (fy - P.oy) / P.bh - 0.5, d = 1e9;
    P.strip.forEach(function (q) { d = Math.min(d, Math.hypot(fx - q[0], fy - q[1])); });
    var onBrain = !!inBrain(u, v) || (Math.abs(u) < 0.03 && Math.abs(v) < 0.45);
    return { onBrain: onBrain, dur: onBrain ? 0.1 + 0.7 * Math.exp(-Math.pow(d / 3.5, 2) / 2) : 0 };
  }

  function fire(x, y) {
    coil.x = x; coil.y = y; coil.show = true;
    if (state === 'ready') { reset(); state = 'play'; if (status) status.textContent = 'Go! Aim at the motor cortex and click to stop the flapping.'; return; }
    if (state === 'over') { if (performance.now() - overAt > 500) { reset(); state = 'play'; if (status) status.textContent = 'Go again!'; } return; }
    if (charge < 1) { msg = { text: 'charging...', age: 0 }; return; }
    var fx = Math.floor(x) + 0.5, fy = Math.floor(y) + 0.5; // centre of the coil's focal pixel
    var r = calmFor(fx, fy), dur = r.dur, onBrain = r.onBrain;
    calmUntil = t + dur; charge = 0;
    pulses.push({ x: fx, y: fy, age: 0 });
    msg = { text: !onBrain ? 'missed the head' : (dur > 0.62 ? 'hotspot! ' : dur > 0.32 ? 'close ' : 'weak ') + dur.toFixed(1) + 's calm', age: 0, good: dur > 0.62 };
  }

  // ---------- drawing ----------
  function drawObstacle(o) {
    var x = Math.round(G.x + o.x), w = o.w, pal = { k: col.ink, w: col.white, c: col.coffee, p: col.pink };
    [[G.y, G.y + o.top, true], [G.y + o.bot, G.y + G.h, false]].forEach(function (seg) {
      var y0 = seg[0], y1 = seg[1], hanging = seg[2];
      if (y1 - y0 < 1) return;
      if (o.type === 'neuron') {
        // a friendly neuron: axon trunk with dendrite twigs, smiling soma at the end
        var capY = hanging ? y1 - 5 : y0 + 5;
        rect(x + 4, y0, 4, y1 - y0, col.ink); rect(x + 5, y0, 2, y1 - y0, col.white);
        for (var yy = y0 + 3; yy < y1 - 2; yy += 6) {
          if (Math.abs(yy - capY) < 9) continue;
          line(x + 4, yy, x + 1, yy - 2, col.ink); line(x + 7, yy + 3, x + 10, yy + 1, col.ink);
        }
        disc(x + 6, capY, 5, col.ink); disc(x + 6, capY, 4, col.pink);
        px(x + 4, capY - 1, col.ink); px(x + 8, capY - 1, col.ink);
        px(x + 4, capY + 1, col.ink); px(x + 5, capY + 2, col.ink); px(x + 6, capY + 2, col.ink); px(x + 7, capY + 2, col.ink); px(x + 8, capY + 1, col.ink);
      } else if (o.type === 'mugs') {
        // a tower of coffee mugs
        b.save(); b.beginPath(); b.rect(x - 1, y0, w + 2, y1 - y0); b.clip();
        if (hanging) { for (var yy2 = y1 - 7; yy2 > y0 - 7; yy2 -= 7) sprite(MUG, x + 1, yy2, pal, true); }
        else { for (var yy3 = y0; yy3 < y1; yy3 += 7) sprite(MUG, x + 1, yy3, pal, false); }
        b.restore();
        if (!hanging) { var sw = Math.round(Math.sin(scroll * 0.2)); px(x + 4 + sw, y0 - 2, col.grey); px(x + 5 - sw, y0 - 4, col.grey); px(x + 4 + sw, y0 - 6, col.grey); }
      } else {
        // a pile of papers from Reviewer 2
        rect(x, y0, w, y1 - y0, col.ink); rect(x + 1, y0, w - 2, y1 - y0, col.white);
        for (var yy4 = y0 + 1; yy4 < y1; yy4 += 2) rect(x + 2, yy4, w - 4, 1, col.faint);
        var ly = hanging ? y1 - 9 : y0 + 2;
        rect(x + 1, ly, w - 2, 7, col.pink); text('R2', x + w / 2, ly + 1, col.white, 1, 'center');
        if (hanging) rect(x, y1 - 1, w, 1, col.ink); else rect(x, y0, w, 1, col.ink);
      }
    });
  }

  function drawBrain(x, y) {
    var calm = state === 'play' && t < calmUntil, dead = state === 'over';
    var ox = x - 10, oy = Math.round(y) - 6, pal = { k: col.ink, p: col.pink, d: col.dark, w: col.white };
    function arm(back) {
      // little arms jut out of the top of the brain and flap like wings; they droop when calmed
      var ph = brain.arm + (back ? 0.7 : 0);
      var ang = calm || dead ? Math.PI * 0.7 : Math.PI * 1.08 + Math.sin(ph) * (1.0 + brain.kick * 0.2);
      var sx = ox + (back ? 11 : 6), sy = oy + 2, L = 13;
      var hx = Math.round(sx + Math.cos(ang) * L), hy = Math.round(sy + Math.sin(ang) * L);
      var c = back ? col.grey : col.ink;
      line(sx, sy, hx, hy, c); line(sx + 1, sy, hx + 1, hy, c);
      if (back) { disc(hx, hy, 3, col.grey); } else sprite(HAND, hx - 3, hy - 3, pal);
    }
    arm(true);
    sprite(BODY, ox, oy, pal);
    var ex = ox + 14, ey = oy + 3;
    if (dead) { px(ex, ey, col.ink); px(ex + 2, ey, col.ink); px(ex + 1, ey + 1, col.ink); px(ex, ey + 2, col.ink); px(ex + 2, ey + 2, col.ink); }
    else if (calm) rect(ex, ey + 1, 3, 1, col.ink);
    else { rect(ex - 1, ey - 1, 5, 5, col.ink); rect(ex, ey, 3, 3, col.white); rect(ex + 1, ey + 1, 2, 2, col.ink); }
    if (!dead) { px(ex - 1, ey + 6, col.ink); rect(ex, ey + 7, 2, 1, col.ink); px(ex + 2, ey + 6, col.ink); } // smile
    arm(false);
    if (calm) { text('Z', ox + 21, oy - 3, col.ink); text('Z', ox + 25, oy - 8, col.grey); }
  }

  function drawGame() {
    b.save(); b.beginPath(); b.rect(G.x, G.y, G.w, G.h); b.clip();
    rect(G.x, G.y, G.w, G.h, col.bg);
    var off = Math.floor(scroll) % 8;
    for (var x = G.x - off; x < G.x + G.w; x += 8) for (var y = G.y + 3; y < G.y + G.h; y += 8) px(x, y, col.faint);
    obs.forEach(drawObstacle);
    drawBrain(Math.round(G.x + G.w * 0.28), G.y + brain.y);
    text(state === 'ready' ? 0 : score, G.x + 4, G.y + 4, col.ink, 3);
    text('best ' + best, G.x + 4, G.y + 22, col.muted);
    if (state === 'play' && t < calmUntil) {
      var len = Math.round(Math.min(24, (calmUntil - t) * 34));
      rect(G.x + 4, G.y + 30, len, 2, col.pink); text('calm', G.x + 6 + len, G.y + 29, col.ink);
    }
    if (state !== 'play') {
      var cy = Math.round(G.y + G.h / 2);
      rect(G.x, cy - 13, G.w, 26, col.bg); rect(G.x, cy - 13, G.w, 1, col.ink); rect(G.x, cy + 12, G.w, 1, col.ink);
      var big = state === 'ready' ? 'flappy brain' : 'score ' + score;
      var k = textW(big, 2) < G.w - 8 ? 2 : 1;
      text(big, G.x + G.w / 2, cy - 9, col.ink, k, 'center');
      var sub = state === 'ready' ? 'click the brain to start' : (score >= best && score > 0 ? 'new best! ' : '') + 'click to retry';
      text(sub, G.x + G.w / 2, cy + 4, col.muted, 1, 'center');
    }
    b.restore();
  }

  function drawPanel() {
    b.save(); b.beginPath(); b.rect(P.x, P.y, P.w, P.h); b.clip();
    rect(P.x, P.y, P.w, P.h, col.bg);
    if (P.y > 0) rect(P.x, P.y, P.w, 1, col.ink); else rect(P.x, 0, 1, LH, col.ink);
    text('tms', P.x + 4, P.y + 4, col.ink);
    text('front ^', P.x + P.w - 3, P.y + 4, col.muted, 1, 'right');
    b.drawImage(brainTop, P.ox - 1, P.oy - 1);
    text('motor', P.cx, Math.round(P.cy + (sulcus(0.03) - 0.05) * P.bh) - 9, col.muted, 1, 'center');
    pulses.forEach(function (p) { ring(p.x, p.y, 3 + Math.round(p.age * 26), col.pink); });
    if (coil.show || state === 'ready') {
      var cx = Math.floor(coil.x), cy = Math.floor(coil.y), on = charge >= 1;
      ring(cx - 5, cy, 4, col.ink); ring(cx + 5, cy, 4, col.ink);
      rect(cx - 1, cy + 4, 2, 7, col.ink);
      rect(cx, cy, 1, 1, on ? col.pink : col.grey); px(cx - 1, cy, col.ink); px(cx + 1, cy, col.ink); px(cx, cy - 1, col.ink); px(cx, cy + 1, col.ink);
      rect(cx - 5, cy + 12, 10, 2, col.faint); rect(cx - 5, cy + 12, Math.round(10 * charge), 2, on ? col.pink : col.grey);
    }
    if (msg) text(msg.text, P.x + P.w / 2, P.y + P.h - 8, msg.good ? col.pink : col.ink, 1, 'center');
    b.restore();
  }

  function frame() {
    drawGame(); drawPanel();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(buf, 0, 0, LW * PX, LH * PX);
  }
  function loop(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    step(dt); frame();
    if (visible) raf = requestAnimationFrame(loop);
  }

  // ---------- input ----------
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / PX, y: (e.clientY - r.top) / PX }; }
  function inPanel(p) { return p.x >= P.x && p.y >= P.y; }
  cv.addEventListener('pointermove', function (e) { var p = pos(e); if (inPanel(p)) { coil.x = p.x; coil.y = p.y; coil.show = true; } });
  cv.addEventListener('pointerdown', function (e) {
    var p = pos(e);
    if (inPanel(p)) fire(p.x, p.y);
    else if (state !== 'play') fire(coil.x, coil.y);
    else msg = { text: P.y > 0 ? 'aim below' : 'aim on the right >', age: 0 };
  });
  cv.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fire(coil.x, coil.y); return; }
    var k = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
    if (k) { e.preventDefault(); coil.x = clamp(coil.x + k[0], P.x, P.x + P.w - 1); coil.y = clamp(coil.y + k[1], P.y, P.y + P.h - 1); coil.show = true; }
  });


  readColors(); layout(); reset();
  window.addEventListener('resize', function () { layout(); frame(); });
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var v = es[0].isIntersecting;
      if (v && !visible) { visible = true; last = performance.now(); raf = requestAnimationFrame(loop); }
      else if (!v) { visible = false; cancelAnimationFrame(raf); }
    }).observe(cv);
  }
  frame();
  raf = requestAnimationFrame(loop);
})();
