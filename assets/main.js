/*
 * main.js - theme toggle, scroll reveal, count-up and card spotlight
 * Author: Sandesh Ghimire
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- theme: follow the OS until the visitor chooses ------------------ */
  function current() {
    return root.dataset.theme || (dark.matches ? 'dark' : 'light');
  }
  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    var label = function () {
      toggle.setAttribute('aria-pressed', String(current() === 'dark'));
    };
    label();
    toggle.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
      label();
    });
    dark.addEventListener('change', label);
  }

  /* ---- count-up numbers ------------------------------------------------ */
  function countUp(el) {
    var end = Number(el.dataset.count);
    var suffix = el.dataset.suffix || '';
    if (reduce || !end) { return; }
    var t0 = null;
    var dur = 1400;
    function frame(t) {
      if (t0 === null) { t0 = t; }
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * eased) + (p === 1 ? suffix : '');
      if (p < 1) { requestAnimationFrame(frame); }
    }
    requestAnimationFrame(frame);
  }

  /* ---- reveal on scroll (also starts meters and counters) ------------- */
  var targets = document.querySelectorAll('.reveal, .srow');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) { return; }
        e.target.classList.add('in');
        e.target.querySelectorAll('[data-count]').forEach(countUp);
        if (e.target.dataset && e.target.dataset.count) { countUp(e.target); }
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add('in'); });
  }

  /* ---- spotlight that follows the cursor on cards ---------------------- */
  if (!reduce) {
    document.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (ev) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
        card.style.setProperty('--my', (ev.clientY - r.top) + 'px');
      });
    });
  }
})();
