// Publications: expandable summaries/BibTeX, copy-to-clipboard, and (on /publications/) filtering.
(function () {
  // Toggles (summary / bibtex)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-toggle]');
    if (b) {
      var el = document.getElementById(b.getAttribute('data-toggle'));
      if (!el) return;
      var open = el.hidden;
      el.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
      return;
    }
    var c = e.target.closest('[data-copy]');
    if (c) {
      var box = document.getElementById(c.getAttribute('data-copy'));
      var text = box ? box.querySelector('code').textContent : '';
      var done = function () { c.textContent = 'copied'; setTimeout(function () { c.textContent = 'copy'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { selectText(box); });
      } else { selectText(box); }
    }
  });
  function selectText(box) {
    var r = document.createRange(); r.selectNodeContents(box.querySelector('code'));
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  // Filtering — only on the publications page
  var list = document.getElementById('pub-list');
  if (!list) return;
  var items = Array.prototype.slice.call(list.querySelectorAll('.pub'));
  var q = document.getElementById('q');
  var count = document.getElementById('count');
  var empty = document.getElementById('empty');
  var firstBtn = document.getElementById('first-only');
  var viewBtn = document.getElementById('view-toggle');
  var state = { type: 'all', topic: 'all', first: false, q: '' };

  items.forEach(function (it) { it._text = it.textContent.toLowerCase().replace(/\s+/g, ' ').replace(/ö/g, 'o'); });

  function matches(it, s) {
    if (s.type !== 'all' && it.dataset.type !== s.type) return false;
    if (s.topic !== 'all' && (' ' + it.dataset.topics + ' ').indexOf(' ' + s.topic + ' ') < 0) return false;
    if (s.first && it.dataset.first !== '1') return false;
    if (s.q) {
      var words = s.q.toLowerCase().replace(/ö/g, 'o').split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) if (it._text.indexOf(words[i]) < 0) return false;
    }
    return true;
  }
  var sep = document.createElement('div');
  sep.className = 'pub-sep'; sep.setAttribute('aria-hidden', 'true'); sep.textContent = 'other publications';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function isDefault(s) { return s.type === 'all' && s.topic === 'all' && !s.first && !s.q; }
  function apply() {
    // FLIP: remember positions, reorder (matches first, others dimmed below), then animate into place
    var before = new Map();
    items.forEach(function (it) { before.set(it, it.getBoundingClientRect().top); });
    var sepTop = sep.isConnected ? sep.getBoundingClientRect().top : null;
    var on = [], off = [];
    items.forEach(function (it) { (matches(it, state) ? on : off).push(it); });
    var filtering = !isDefault(state);
    on.forEach(function (it) { it.classList.remove('dim'); it.removeAttribute('aria-hidden'); list.appendChild(it); });
    if (filtering && off.length) list.appendChild(sep); else if (sep.isConnected) sep.remove();
    off.forEach(function (it) { it.classList.add('dim'); list.appendChild(it); });
    if (!reduceMotion) {
      items.forEach(function (it) {
        var dy = before.get(it) - it.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) return;
        it.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' });
      });
      if (sep.isConnected && sepTop === null) sep.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    }
    var n = on.length;
    count.textContent = filtering ? n + ' of ' + items.length + ' match' + (n !== items.length ? ' · others dimmed below' : '') : items.length + ' publications';
    empty.hidden = n !== 0;
    // live counts on chips, given the other active filters
    document.querySelectorAll('.chip[data-filter]').forEach(function (ch) {
      var f = ch.dataset.filter, v = ch.dataset.value, s = Object.assign({}, state); s[f] = v;
      var k = items.filter(function (it) { return matches(it, s); }).length;
      var span = ch.querySelector('.n'); if (!span) { span = document.createElement('span'); span.className = 'n'; ch.appendChild(span); }
      span.textContent = k;
      ch.disabled = k === 0 && ch.getAttribute('aria-pressed') !== 'true';
    });
    var h = state.topic !== 'all' ? '#topic-' + state.topic : (state.type !== 'all' ? '#type-' + state.type : '');
    var filterHash = /^#(topic|type)-/.test(location.hash);
    if (h !== location.hash && (h || filterHash)) history.replaceState(null, '', h || location.pathname);
  }
  function press(filter, value) {
    state[filter] = value;
    document.querySelectorAll('.chip[data-filter="' + filter + '"]').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.value === value));
    });
  }
  document.querySelectorAll('.chip[data-filter]').forEach(function (ch) {
    ch.addEventListener('click', function () { press(ch.dataset.filter, ch.dataset.value); apply(); });
  });
  firstBtn.addEventListener('click', function () {
    state.first = !state.first; firstBtn.setAttribute('aria-pressed', String(state.first)); apply();
  });
  viewBtn.addEventListener('click', function () {
    var on = viewBtn.getAttribute('aria-pressed') !== 'true';
    viewBtn.setAttribute('aria-pressed', String(on));
    list.classList.toggle('compact', on); list.classList.toggle('timeline', !on);
    try { localStorage.setItem('pubView', on ? 'compact' : 'timeline'); } catch (e) {}
  });
  var timer;
  q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = q.value.trim(); apply(); }, 80); });
  document.getElementById('reset').addEventListener('click', function () {
    press('type', 'all'); press('topic', 'all'); state.first = false; firstBtn.setAttribute('aria-pressed', 'false');
    q.value = ''; state.q = ''; apply();
  });

  function fromHash() {
    var m = /^#(topic|type)-([a-z]+)$/.exec(location.hash);
    if (m && document.querySelector('.chip[data-filter="' + m[1] + '"][data-value="' + m[2] + '"]')) press(m[1], m[2]);
    else if (location.hash && document.getElementById(location.hash.slice(1))) { /* deep link to a paper */ }
  }
  try { if (localStorage.getItem('pubView') === 'compact') viewBtn.click(); } catch (e) {}
  fromHash(); apply();
  window.addEventListener('hashchange', function () { fromHash(); apply(); });
})();
