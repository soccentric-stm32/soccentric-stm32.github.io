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
    var themeLabel = $('.theme-label', toggle);
    var sync = function () {
      var dark = current() === 'dark';
      toggle.setAttribute('aria-label', dark ? 'Switch to paper theme' : 'Switch to blueprint theme');
      if (themeLabel) { themeLabel.textContent = dark ? 'Blueprint' : 'Paper'; }
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
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { menu.open = false; });
    });
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) { menu.open = false; }
    });
  }

  /* ---- HWVAL Studio concept preview ------------------------------------ */
  var app = $('#app');
  if (!app) { return; }

  var SCENE_MS = 4600;
  var scenes = ['tests', 'tests', 'fw', 'swd', 'hist'];   // operator prompt reuses the test page
  var navFor = ['tests', 'tests', 'fw', 'swd', 'hist'];
  var activity = $('#activity');
  var buttons = $$('#scenebar button');
  var timers = [];
  var cur = -1;
  var auto = !reduce;
  var autoTimer = null;
  var hovered = false;

  function later(ms, fn) { timers.push(setTimeout(fn, reduce ? 0 : ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function act(html) { activity.innerHTML = html; }
  function setStatus(cell, cls, text) { cell.className = 'st' + (cls ? ' ' + cls : ''); cell.textContent = text; }

  var testRows = $$('#ttbl tr');
  var results = [['pass', 'PASS'], ['pass', 'PASS'], ['pass', 'PASS'], ['fail', 'FAIL'], ['pass', 'PASS'], ['skip', 'SKIP']];

  function resetTests() {
    testRows.forEach(function (tr) { setStatus($('.st', tr), '', 'QUEUED'); });
    $('#tbar').style.width = '0%';
    $('#badge').textContent = '–';
    $('#scrim').classList.remove('on');
    $('#prompt').classList.remove('on');
  }

  function playTests() {
    resetTests();
    act('<b>HWVAL 0.2</b> · Running Analog 0/6');
    results.forEach(function (r, i) {
      later(250 + i * 620, function () {
        setStatus($('.st', testRows[i]), 'run', 'RUN');
        act('<b>HWVAL 0.2</b> · Running ' + testRows[i].children[1].textContent + ' · ' + i + '/6');
      });
      later(250 + i * 620 + 520, function () {
        setStatus($('.st', testRows[i]), r[0], r[1]);
        $('#tbar').style.width = Math.round(((i + 1) / 6) * 100) + '%';
        var pass = results.slice(0, i + 1).filter(function (x) { return x[0] === 'pass'; }).length;
        var fail = results.slice(0, i + 1).filter(function (x) { return x[0] === 'fail'; }).length;
        $('#badge').textContent = '✓' + pass + (fail ? ' ✗' + fail : '');
      });
    });
    later(250 + 6 * 620, function () { act('<b>HWVAL 0.2</b> · Done · 4 pass · 1 fail · 1 skip'); });
  }

  function playOperator() {
    // test page in its finished state, then the B1 prompt
    testRows.forEach(function (tr, i) {
      if (i < results.length) { setStatus($('.st', tr), results[i][0], results[i][1]); }
    });
    $('#tbar').style.width = '100%';
    $('#badge').textContent = '✓4 ✗1';
    var b = $('.st', testRows[6]);
    setStatus(b, 'run', 'RUN');
    act('<b>HWVAL 0.2</b> · BTN.001 · waiting for operator');
    var cd = $('#cd'), pbtn = $('#pbtn');
    cd.textContent = '60 s';
    pbtn.textContent = 'Waiting for B1…';
    later(350, function () { $('#scrim').classList.add('on'); $('#prompt').classList.add('on'); });
    [59, 58, 57].forEach(function (s, i) { later(900 + i * 700, function () { cd.textContent = s + ' s'; }); });
    later(3000, function () { pbtn.textContent = 'B1 pressed ✓'; act('<b>HWVAL 0.2</b> · BTN.001 · B1 detected'); });
    later(3600, function () {
      $('#scrim').classList.remove('on');
      $('#prompt').classList.remove('on');
      setStatus(b, 'pass', 'PASS');
      $('#badge').textContent = '✓5 ✗1';
    });
  }

  function playFw() {
    var steps = $$('#fwsteps span'), bar = $('#fwbar');
    var slotB = $('#slotB'), slotBn = $('#slotBn'), slotA = $('#slotA'), btn = $('#fwbtn'), txt = $('#fwtxt');
    steps.forEach(function (s) { s.className = ''; });
    bar.style.width = '0%';
    slotB.className = 'pill';
    slotB.textContent = 'EMPTY';
    slotBn.textContent = 'empty';
    slotA.className = 'pill ok';
    slotA.textContent = 'ACTIVE · CONFIRMED';
    btn.textContent = 'Upload';
    txt.textContent = 'demo-app-0.2.0.img · 412 KB · CRC32 9f3a51c2';
    act('<b>BOOT 0.1</b> · Ready · slot B inactive');
    function step(i) { steps.forEach(function (s, k) { s.className = k < i ? 'done' : (k === i ? 'cur' : ''); }); }
    step(0);
    later(200, function () {
      slotB.className = 'pill go';
      slotB.textContent = 'WRITING';
      slotBn.textContent = 'demo-app 0.2.0';
      btn.textContent = 'Uploading…';
    });
    [20, 45, 70, 100].forEach(function (w, i) {
      later(400 + i * 380, function () {
        bar.style.width = w + '%';
        act('<b>BOOT 0.1</b> · Uploading ' + Math.round(412 * w / 100) + ' / 412 KB');
      });
    });
    later(2000, function () { step(1); act('<b>BOOT 0.1</b> · Verifying CRC32'); });
    later(2500, function () { step(2); slotB.textContent = 'PENDING'; act('<b>BOOT 0.1</b> · Activate · reset'); });
    later(3000, function () { step(3); act('<b>DEMO 0.2.0</b> · Trial boot 1/3 · slot B'); slotA.className = 'pill'; slotA.textContent = 'PREVIOUS'; });
    later(3700, function () {
      step(5);
      slotB.className = 'pill ok';
      slotB.textContent = 'ACTIVE · CONFIRMED';
      btn.textContent = 'Done';
      txt.textContent = 'Update confirmed by the application · rollback not needed';
      act('<b>DEMO 0.2.0</b> · Confirmed · slot B');
    });
  }

  var LOG = [
    ['d', 'Open On-Chip Debugger 0.12.0'],
    ['', 'Info : STLINK V2J45M30 (API v2) VID:PID 0483:374B'],
    ['', 'Info : Target voltage: 3.25 V'],
    ['', 'Info : [stm32f7x.cpu] Cortex-M7 r1p0 processor detected'],
    ['', 'Info : flash size = 2048 KiB, dual bank'],
    ['w', 'Option bytes: nDBANK 0 → 1 (bench configuration)'],
    ['', '** Programming Started **'],
    ['', 'wrote 224256 bytes from build/hwval.elf in 4.1 s'],
    ['k', '** Programming Finished **'],
    ['k', '** Verified OK **'],
    ['', '** Resetting Target **'],
    ['k', 'HWLINK: role HWVAL 0.2 · UID 3F2A…C91E']
  ];
  function playSwd() {
    var log = $('#log');
    log.innerHTML = '';
    act('<b>OpenOCD</b> · Flashing HWVAL');
    LOG.forEach(function (l, i) {
      later(150 + i * 300, function () {
        var div = document.createElement('div');
        if (l[0]) { div.className = l[0]; }
        div.textContent = l[1];
        log.appendChild(div);
        if (i === LOG.length - 1) { act('<b>HWVAL 0.2</b> · Connected'); }
      });
    });
  }

  function playHist() {
    act('<b>History</b> · 5 runs · last PASS');
    var rows = $$('#htbl tr');
    rows.forEach(function (r) { r.style.opacity = reduce ? '1' : '0'; r.style.transition = 'opacity .35s'; });
    rows.forEach(function (r, i) { later(120 + i * 160, function () { r.style.opacity = '1'; }); });
  }

  var players = [playTests, playOperator, playFw, playSwd, playHist];

  function show(i) {
    clearTimers();
    cur = i;
    $$('.scene', app).forEach(function (s) { s.classList.toggle('on', s.dataset.scene === scenes[i]); });
    $$('.side a', app).forEach(function (a) { a.classList.toggle('on', a.dataset.nav === navFor[i]); });
    buttons.forEach(function (b, k) {
      b.classList.remove('on');
      if (k === i) { b.setAttribute('aria-current', 'true'); } else { b.removeAttribute('aria-current'); }
      b.classList.toggle('static', !auto);
      b.style.setProperty('--dur', SCENE_MS + 'ms');
      if (k === i) { void b.offsetWidth; b.classList.add('on'); }
    });
    players[i]();
    if (auto && !hovered) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(function () { show((cur + 1) % players.length); }, SCENE_MS);
    }
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      auto = false;                         // the visitor takes over
      clearTimeout(autoTimer);
      show(Number(b.dataset.go));
    });
  });

  // Pause while the visitor reads or points at the preview.
  var demo = $('.hero-demo');
  if (demo) {
    demo.addEventListener('mouseenter', function () {
      hovered = true;
      clearTimeout(autoTimer);
      autoTimer = null;
    });
    demo.addEventListener('mouseleave', function () {
      hovered = false;
      if (auto) { show(cur); }
    });
  }

  // Start when the preview is visible; pause while it is off-screen.
  if ('IntersectionObserver' in window && auto) {
    var started = false;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !started) { started = true; show(0); }
        else if (e.isIntersecting && auto && !autoTimer && !hovered) { show(cur); }
        else if (!e.isIntersecting && auto) { clearTimeout(autoTimer); autoTimer = null; clearTimers(); }
      });
    }, { threshold: 0.25 }).observe(app);
  } else {
    show(0);
  }
})();
