/*
 * main.js - theme toggle, mobile menu, hero screen showcase and slide deck
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

  /* ---- recorded logs: replay a terminal line by line --------------------
     Each line carries its replay time (data-t, seconds). With JavaScript off,
     or when the visitor prefers reduced motion, the whole log is simply shown. */
  var Replay = function (body) {
    var lines = $$('.ln', body);
    var timers = [];
    var again = null;
    var self = {};

    var mark = function (last) {
      lines.forEach(function (l) { l.classList.remove('cursor'); });
      if (last) { last.classList.add('cursor'); }
    };
    var clear = function () {
      timers.forEach(clearTimeout);
      timers = [];
      if (again) { clearTimeout(again); again = null; }
    };
    self.showAll = function () {
      clear();
      lines.forEach(function (l) { l.classList.remove('is-hidden'); });
      mark(null);
      body.scrollTop = body.scrollHeight;
    };
    self.stop = function () { self.showAll(); };
    self.play = function (loop) {
      clear();
      if (reduce) { self.showAll(); return; }
      lines.forEach(function (l) { l.classList.add('is-hidden'); });
      mark(null);
      body.scrollTop = 0;
      var end = 0;
      lines.forEach(function (line) {
        var at = (parseFloat(line.dataset.t) || 0) * 1000;
        end = Math.max(end, at);
        timers.push(setTimeout(function () {
          line.classList.remove('is-hidden');
          mark(line);
          body.scrollTop = body.scrollHeight;
        }, at));
      });
      if (loop) { again = setTimeout(function () { self.play(true); }, end + 5000); }
    };
    return self;
  };

  /* the terminals on the slides play while their slide is on screen */
  $$('.term[data-replay] .term-body').forEach(function (body) {
    var replay = Replay(body);
    if (reduce || !('IntersectionObserver' in window)) { replay.showAll(); return; }
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { replay.play(true); } else { replay.stop(); }
    }, { threshold: 0.5 }).observe(body);
  });

  /* ---- hero showcase: pick a capture and put it on the stage ---------- */
  var reel = $('.reel');
  var stageImg = $('#shot-img');
  if (reel && stageImg) {
    var tabs = $$('[role="tab"]', reel);
    var panel = $('#shot-panel');
    var frame = $('#shot-frame');
    var shotTitle = $('#shot-title');
    var shotTag = $('#shot-tag');
    var shotCaption = $('#shot-caption');
    var showcase = $('.showcase') || reel;
    var hero = $('.hero');
    var host = panel || frame;

    var current = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];

    /* the stage content for one capture, swapped in one go */
    var shotTerm = $('#shot-term');
    var stageReplay = null;
    var applyStage = function (tab) {
      var slideLog = tab.dataset.term ? $('#' + tab.dataset.term + ' .term-body code') : null;
      var showLog = !!(slideLog && shotTerm);
      if (showLog) {
        /* a recorded log: the lines come from the slide that holds the same log */
        shotTerm.querySelector('code').innerHTML = slideLog.innerHTML;
        shotTerm.setAttribute('aria-label', tab.dataset.alt || 'Debug log recorded from the board');
        stageReplay = Replay(shotTerm);
      } else {
        if (stageReplay) { stageReplay.stop(); stageReplay = null; }
        stageImg.src = tab.dataset.src;
        stageImg.alt = tab.dataset.alt || '';
      }
      stageImg.hidden = showLog;
      if (shotTerm) { shotTerm.hidden = !showLog; }
      shotTitle.textContent = tab.dataset.title || '';
      var tagText = tab.dataset.tag || '';
      shotTag.textContent = tagText;
      shotTag.hidden = !tagText;
      shotCaption.textContent = tab.dataset.caption || '';
      var term = tab.dataset.kind === 'term';
      frame.classList.toggle('term', term);
      frame.classList.toggle('win', !term);
      if (stageReplay) { stageReplay.play(false); }
    };

    /* swap with a transition: the old capture slides out, the new one sweeps
       in under a band of light (motion.css). The last choice always wins, and
       visitors who prefer reduced motion get the plain swap. */
    var swapToken = 0;
    var swapStage = function (tab) {
      if (!root.classList.contains('motion') || !host) { applyStage(tab); return; }
      var token = ++swapToken;
      host.classList.remove('is-in');
      host.classList.add('is-out');
      setTimeout(function () {
        if (token !== swapToken) { return; }
        applyStage(tab);
        var show = function () {
          if (token !== swapToken) { return; }
          host.classList.remove('is-out');
          host.classList.add('is-in');
        };
        if (stageImg.decode) { stageImg.decode().then(show, show); } else { show(); }
      }, 230);
    };

    var select = function (tab, focus) {
      current = tab;
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      swapStage(tab);
      if (panel) { panel.setAttribute('aria-labelledby', tab.id); }
      if (focus) { tab.focus(); }
    };

    /* auto-rotate: every capture gets five seconds on the stage, shown as a
       bar filling along the selected thumbnail. It pauses (bar frozen, time
       kept) while the pointer is over the showcase or a key has focus there,
       while the tab is hidden or the hero is off screen, and it stays off for
       visitors who prefer reduced motion. Choosing a capture restarts it. */
    var AUTO_MS = 5000;
    var timer = null;
    var started = 0;
    var remaining = AUTO_MS;
    var tickA = false;
    var hovering = false;
    var focusing = false;
    var onScreen = true;

    var paused = function () { return hovering || focusing || !onScreen || document.hidden; };
    var pause = function () {
      if (timer) {
        remaining = Math.max(0, remaining - (Date.now() - started));
        clearTimeout(timer);
        timer = null;
      }
      showcase.classList.add('is-paused');
    };
    var run = function () {
      if (reduce) { return; }
      if (paused()) { pause(); return; }
      showcase.classList.remove('is-paused');
      var nextTab = tabs[(tabs.indexOf(current) + 1) % tabs.length];
      if (nextTab.dataset.src) { new Image().src = nextTab.dataset.src; } /* ready before the swap */
      started = Date.now();
      timer = setTimeout(function () {
        timer = null;
        /* a rotation is not announced to screen readers; a choice is */
        if (panel) { panel.setAttribute('aria-live', 'off'); }
        select(nextTab, false);
        fresh();
      }, remaining);
    };
    /* five new seconds; flipping between two identical keyframes restarts the bar */
    var fresh = function () {
      if (timer) { clearTimeout(timer); timer = null; }
      remaining = AUTO_MS;
      tickA = !tickA;
      showcase.classList.toggle('tick-a', tickA);
      showcase.classList.toggle('tick-b', !tickA);
      run();
    };
    var update = function () {
      if (reduce) { return; }
      if (paused()) { pause(); } else if (!timer) { run(); }
    };
    var choose = function (tab, focus) {
      if (panel) { panel.setAttribute('aria-live', 'polite'); }
      select(tab, focus);
      fresh();
    };

    showcase.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse') { hovering = true; update(); }
    });
    showcase.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') { hovering = false; update(); }
    });
    showcase.addEventListener('focusin', function (e) {
      /* only keyboard focus pauses; a mouse click leaves focus on the button */
      focusing = !!(e.target.matches && e.target.matches(':focus-visible'));
      update();
    });
    showcase.addEventListener('focusout', function () { focusing = false; update(); });
    document.addEventListener('visibilitychange', update);
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        update();
      }, { threshold: 0.25 }).observe(hero);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { choose(tab, false); });
    });
    reel.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) { return; }
      var next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { next = (i + 1) % tabs.length; }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { next = (i - 1 + tabs.length) % tabs.length; }
      else if (e.key === 'Home') { next = 0; }
      else if (e.key === 'End') { next = tabs.length - 1; }
      if (next < 0) { return; }
      e.preventDefault();
      choose(tabs[next], true);
    });

    fresh();
  }

  /* ---- captures: click a screen to max it out to near full size ------ */
  var captures = $$('.media-col > .win, .media-col > .term');
  if (captures.length) {
    var maxout = document.createElement('div');
    maxout.className = 'maxout';
    maxout.hidden = true;
    maxout.innerHTML =
      '<div class="maxout-scrim" aria-hidden="true"></div>' +
      '<figure class="maxout-stage" role="dialog" aria-modal="true" aria-label="Screen capture, full size"></figure>' +
      '<button class="maxout-close" type="button">Close \u2715</button>';
    var stage = $('.maxout-stage', maxout);
    var closeBtn = $('.maxout-close', maxout);
    var opener = null;
    document.body.appendChild(maxout);

    var captionOf = function (cap) {
      var fig = cap.parentNode ? $('.fig-cap', cap.parentNode) : null;
      return fig ? fig.textContent.trim() : '';
    };

    var closeMax = function () {
      if (maxout.hidden) { return; }
      maxout.hidden = true;
      document.body.classList.remove('is-maxed');
      stage.replaceChildren();
      if (opener) { opener.focus({ preventScroll: true }); }
    };

    var openMax = function (cap) {
      var clone = cap.cloneNode(true);
      clone.removeAttribute('role');
      clone.removeAttribute('tabindex');
      clone.removeAttribute('aria-label');
      clone.removeAttribute('aria-haspopup');
      clone.removeAttribute('id');
      $$('[id]', clone).forEach(function (el) { el.removeAttribute('id'); });
      // a replayed terminal opens with its whole log, whatever the replay has reached
      $$('.ln', clone).forEach(function (l) { l.classList.remove('is-hidden', 'cursor'); });
      // a capture that was still lazy on the page must paint in the maxed view
      $$('img', clone).forEach(function (img) {
        img.loading = 'eager';
        img.decoding = 'sync';
      });
      stage.replaceChildren(clone);
      var caption = captionOf(cap);
      if (caption) {
        var capEl = document.createElement('figcaption');
        capEl.className = 'maxout-cap mono';
        capEl.textContent = caption;
        stage.appendChild(capEl);
      }
      opener = cap;
      maxout.hidden = false;
      document.body.classList.add('is-maxed');
      closeBtn.focus({ preventScroll: true });
    };

    captures.forEach(function (cap) {
      var label = captionOf(cap) || 'the screen capture';
      cap.setAttribute('role', 'button');
      cap.setAttribute('tabindex', '0');
      cap.setAttribute('aria-haspopup', 'dialog');
      cap.setAttribute('aria-label', 'Max out ' + label);
      cap.addEventListener('click', function () { openMax(cap); });
      cap.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          openMax(cap);
        }
      });
    });

    $('.maxout-scrim', maxout).addEventListener('click', closeMax);
    closeBtn.addEventListener('click', closeMax);
    document.addEventListener('keydown', function (e) {
      if (maxout.hidden) { return; }
      if (e.key === 'Escape') { closeMax(); }
      // only the close button is focusable inside the maxed view
      else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
    });
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
