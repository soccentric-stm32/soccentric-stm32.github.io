/*
 * motion.js - scroll reveals, counters, pointer effects
 * Author: Sandesh Ghimire
 *
 * Drives motion.css. Does nothing when the visitor prefers reduced motion:
 * the page then never gets the "motion" class and shows its final state.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMq.matches || !('IntersectionObserver' in window)) {
    root.classList.remove('motion');
    return;
  }
  root.classList.add('motion', 'motion-ready');

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- indexes that the stylesheet uses to stagger things -------------- */
  function index(selector, prop, within) {
    $$(selector, within).forEach(function (el, i) { el.style.setProperty(prop, i); });
  }
  $$('.spec-list').forEach(function (list) { index(':scope > div', '--s', list); });
  $$('.flow').forEach(function (list) { index(':scope > li', '--f', list); });
  $$('.term-body').forEach(function (body) { index('.ln', '--l', body); });
  index('.reel-item', '--r');
  index('.repo-index li', '--r');

  /* ---- hero headline: split into words that rise from a mask ----------- */
  var h1 = $('.hero h1');
  if (h1 && !h1.querySelector('.w')) {
    var text = h1.textContent.trim().replace(/\s+/g, ' ');
    h1.setAttribute('aria-label', text);
    h1.textContent = '';
    text.split(' ').forEach(function (word, i, all) {
      var outer = document.createElement('span');
      var inner = document.createElement('span');
      outer.className = 'w';
      outer.setAttribute('aria-hidden', 'true');
      inner.textContent = word;
      inner.style.setProperty('--w', i);
      outer.appendChild(inner);
      h1.appendChild(outer);
      if (i < all.length - 1) { h1.appendChild(document.createTextNode(' ')); }
    });
  }

  /* ---- count up the hero numbers, scramble the text one -------------- */
  var counted = false;
  function countUp() {
    $$('.stat-strip b').forEach(function (b, n) {
      if (!b.dataset.final) { b.dataset.final = b.textContent.trim(); }
      var final = b.dataset.final;
      var target = parseInt(final, 10);
      var start = performance.now() + 1100 + n * 120;
      var glyphs = 'ABCDEF0123456789';
      (function frame(now) {
        var t = Math.max(0, Math.min(1, (now - start) / 1100));
        var eased = 1 - Math.pow(1 - t, 3);
        if (/^\d+$/.test(final)) {
          b.textContent = String(Math.round(target * eased));
        } else {
          b.textContent = final.split('').map(function (ch, i) {
            return t > (i + 1) / (final.length + 1) ? ch : glyphs[Math.floor(Math.random() * glyphs.length)];
          }).join('');
        }
        if (t < 1) { requestAnimationFrame(frame); } else { b.textContent = final; }
      })(performance.now());
    });
  }

  /* ---- reveal each page when it comes into view, again on return ----- */
  var pages = $$('main > section');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var el = entry.target;
      var big = entry.intersectionRect.height > window.innerHeight * 0.3;
      if (entry.isIntersecting && (entry.intersectionRatio >= 0.14 || big)) {
        if (!el.classList.contains('mo-in')) {
          el.classList.add('mo-in');
          if (el.classList.contains('hero')) { countUp(); counted = true; }
        }
      } else if (!entry.isIntersecting) {
        el.classList.remove('mo-in');
      }
    });
  }, { threshold: [0, 0.14, 0.3, 0.6] });
  pages.forEach(function (p) { io.observe(p); });

  /* ---- reading progress, hero parallax, scroll hint ------------------- */
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var hint = document.createElement('div');
  hint.className = 'scroll-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = 'Scroll<svg viewBox="0 0 16 16"><path d="M3 6l5 5 5-5"/></svg>';
  document.body.appendChild(hint);
  setTimeout(function () { if (window.scrollY < 40) { hint.classList.add('show'); } }, 2600);

  var ticking = false;
  function onScroll() {
    ticking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty('--p', max > 0 ? Math.min(1, window.scrollY / max) : 0);
    root.style.setProperty('--hs', Math.min(1, window.scrollY / Math.max(1, window.innerHeight * 0.8)).toFixed(3));
    if (window.scrollY > 40) { hint.classList.remove('show'); }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---- theme change: colours glide, the icon spins -------------------- */
  var toggle = $('.theme-toggle');
  if (toggle) {
    var themeTimer = null;
    toggle.addEventListener('click', function () {
      root.classList.add('theme-anim');
      toggle.classList.remove('spin');
      void toggle.offsetWidth;
      toggle.classList.add('spin');
      clearTimeout(themeTimer);
      themeTimer = setTimeout(function () { root.classList.remove('theme-anim'); toggle.classList.remove('spin'); }, 800);
    });
  }

  if (!finePointer) { return; }

  /* ---- pointer: the hero stage tilts and catches the light ------------ */
  var stage = $('.stage');
  var frame = $('.stage-frame');
  if (stage && frame) {
    stage.addEventListener('pointermove', function (e) {
      var r = frame.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      frame.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
      frame.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
      frame.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      frame.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    });
    stage.addEventListener('pointerleave', function () {
      frame.style.setProperty('--rx', '0deg');
      frame.style.setProperty('--ry', '0deg');
    });
  }

  /* ---- pointer: a soft glow follows the cursor over the project index - */
  $$('.repo-index a').forEach(function (a) {
    a.addEventListener('pointermove', function (e) {
      var r = a.getBoundingClientRect();
      a.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      a.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---- pointer: buttons lean toward the cursor ------------------------ */
  $$('.btn, .icon-btn, .sec-repo').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.translate = (dx * 8).toFixed(1) + 'px ' + (dy * 6).toFixed(1) + 'px';
    });
    el.addEventListener('pointerleave', function () { el.style.translate = ''; });
  });
})();
