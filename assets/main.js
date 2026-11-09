/*
 * main.js - theme toggle, mobile menu and the HWVAL Studio concept preview
 * Author: Sandesh Ghimire
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var darkMq = window.matchMedia('(prefers-color-scheme: dark)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ---- theme: follow the OS until the visitor chooses ------------------ */
  var toggle = $('.theme-toggle');
  function current() { return root.dataset.theme || (darkMq.matches ? 'dark' : 'light'); }
  if (toggle) {
    var sync = function () {
      var dark = current() === 'dark';
      var label = dark ? 'Switch to light theme' : 'Switch to dark theme';
      toggle.dataset.mode = dark ? 'dark' : 'light';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
    };
    sync();
    toggle.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
      sync();
    });
    darkMq.addEventListener('change', sync);
  }

  /* ---- mobile menu: close after choosing a link ------------------------ */
  var menu = $('.menu');
  if (menu) {
    var menuSummary = $('summary', menu);
    var syncMenu = function () {
      if (menuSummary) {
        menuSummary.setAttribute('aria-label', menu.open ? 'Close menu' : 'Open menu');
      }
    };
    menu.addEventListener('toggle', syncMenu);
    syncMenu();
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { menu.open = false; });
    });
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) { menu.open = false; }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false;
        if (menuSummary) { menuSummary.focus(); }
      }
    });
  }

  /* ---- full-height slides: snap points, dot nav and scroll spy ------ */
  var slides = $$('main > section');
  var header = $('.site-header');
  var footer = $('.site-footer');
  var active = -1;
  var ticking = false;

  function headerH() { return header ? header.offsetHeight : 64; }

  // The footer shares the last screen with the contact slide.
  function measure() {
    if (footer) { root.style.setProperty('--footer-h', footer.offsetHeight + 'px'); }
  }
  measure();
  if (footer && 'ResizeObserver' in window) {
    new ResizeObserver(measure).observe(footer);
  }

  // Only slides that fit the viewport become snap points, so tall slides
  // (small screens, zoomed text) still scroll naturally.
  function markSnap() {
    var avail = window.innerHeight - headerH();
    var allFit = true;
    slides.forEach(function (s) {
      var fits = s.getBoundingClientRect().height <= avail + 4;
      s.classList.toggle('snap', fits);
      if (!fits) { allFit = false; }
    });
    root.classList.toggle('snap-strict', allFit && !reduce);
  }

  function goTo(i, instant) {
    var s = slides[i];
    if (!s) { return; }
    var top = s.getBoundingClientRect().top + window.scrollY - headerH();
    var max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: Math.max(0, Math.min(top, max)),
      behavior: instant ? 'instant' : (reduce ? 'auto' : 'smooth')
    });
  }

  function setActive(i) {
    if (i === active) { return; }
    active = i;
    slides.forEach(function (s, k) { s.classList.toggle('in', k === i); });
    // header menu: mark the item (and its dropdown) for the current slide
    var id = slides[i] ? slides[i].id : '';
    $$('.site-nav a, .menu nav a').forEach(function (a) {
      var on = a.getAttribute('data-flash') === id;
      var dd = a.classList.contains('dd-top') && a.closest('.dd');
      if (dd) { on = !!$('.dd-menu a[data-flash="' + id + '"]', dd); }
      a.classList.toggle('is-current', on);
    });
  }

  function syncSlides() {
    ticking = false;
    var hh = headerH();
    var y = window.scrollY + hh + Math.max(40, (window.innerHeight - hh) * 0.3);
    var idx = 0;
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].getBoundingClientRect().top + window.scrollY <= y) { idx = i; }
    }
    // the footer shares the last screen, so force the last slide at the end
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      idx = slides.length - 1;
    }
    setActive(idx);
  }

  function requestSync() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(syncSlides); }
  }

  if (slides.length) {
    root.classList.add('deck');

    markSnap();
    syncSlides();

    // Product menu: slide to the topic page. A link to an element inside a
    // page (not the page itself) also marks that element.
    var flashTimer = null;
    function flash(el) {
      $$('.flash').forEach(function (x) { x.classList.remove('flash'); });
      void el.offsetWidth;
      el.classList.add('flash');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () { el.classList.remove('flash'); }, 2400);
    }

    function reveal(el, instant) {
      var section = el && el.closest('main > section');
      var i = slides.indexOf(section);
      if (i < 0) { return; }
      if (window.matchMedia('(max-width: 900px)').matches) {
        // no snapping here, so bring the target itself into view
        el.scrollIntoView({ behavior: instant ? 'instant' : (reduce ? 'auto' : 'smooth'), block: 'start' });
      } else {
        goTo(i, instant);
      }
      if (el !== section) { flash(el); }
    }

    $$('a[data-flash]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var el = document.getElementById(a.getAttribute('data-flash'));
        if (!el || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) { return; }
        e.preventDefault();
        reveal(el);
        // let the dropdown close once a sub-topic is picked
        if (a.closest('.dd-menu')) { a.blur(); }
        try { history.replaceState(null, '', '#' + el.id); } catch (err) { /* file:// */ }
      });
    });

    window.addEventListener('scroll', requestSync, { passive: true });
    window.addEventListener('resize', function () {
      measure(); markSnap(); requestSync();
    });
    window.addEventListener('load', function () {
      measure(); markSnap(); requestSync();
      // deep links like #rust-freertos arrive on the topic's page; jump with
      // 'instant' ('auto' follows the CSS smooth scrolling, which strict
      // snapping cancels at load)
      var deepLink = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      if (deepLink) { reveal(deepLink, true); syncSlides(); }
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        measure(); markSnap(); requestSync();
      });
    }
  }
})();
