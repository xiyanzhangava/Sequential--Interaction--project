/* Mystery Room: one room, one fixed sequence.

   Sequence: envelope  ->  mirror  ->  door (keypad)  ->  done
   Each step stays unavailable until the previous one has been completed.

   The interaction code below is ported from the three studies (see the ZIPs in the repo root):
     - Reveal the Clue         -> ENVELOPE section
     - Reveal the Mirror Clue  -> MIRROR section
     - Unlock the Door         -> KEYPAD + DOOR section
   Gestures, timings, feedback and state transitions are kept as they were in the studies.
*/
(function () {
  'use strict';

  /* ======================================================================
     CONFIG: the two code halves. PLACEHOLDERS: replace with your own digits.
     The password is the paper's two digits followed by the mirror's two digits.
     ====================================================================== */
  var CONFIG = {
    PAPER_DIGITS: '47',   // shown on the paper from the envelope   (PLACEHOLDER)
    MIRROR_DIGITS: '36'   // revealed on the mirror                 (PLACEHOLDER)
  };
  var SECRET = CONFIG.PAPER_DIGITS + CONFIG.MIRROR_DIGITS;
  var LEN = 4;            // the keypad display has four slots

  var NS = 'http://www.w3.org/2000/svg';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var $ = function (id) { return document.getElementById(id); };
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function mk(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  var statusEl = $('status');
  function say(t) { statusEl.textContent = t; }

  /* ======================================================================
     PROGRESS / GATING: the only place that decides what is available
     ====================================================================== */
  var STEPS = ['envelope', 'mirror', 'door', 'done'];
  var step = 'envelope';
  var pips = document.querySelectorAll('#progress li');
  var objMirror = $('obj-mirror');
  var objKeypad = $('obj-keypad');

  function setStep(next) {
    step = next;
    var idx = STEPS.indexOf(next);
    for (var i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('done', i < idx);
      pips[i].classList.toggle('current', i === idx);
    }
    objMirror.classList.toggle('locked', next === 'envelope');           // no idle cue until it can be used
    objKeypad.classList.toggle('locked', next === 'envelope' || next === 'mirror');
  }

  /* ======================================================================
     THE PAPER: one SVG group. It is only ever moved (never cloned or recreated).
     pose = centre point in room units, scale, rotation.
     ====================================================================== */
  var paperG = $('paper');
  var paperWrap = $('paper-wrap');
  var paperTop = $('paper-top');
  var paperHint = $('paper-hint');
  var backdrop = $('backdrop');

  // Envelope placement in the room (under the desk). The envelope art keeps its original coordinates.
  var EX = 240, EY = 529.5, ES = 0.3;
  var ENV_T = 'translate(' + EX + ' ' + EY + ') scale(' + ES + ')';
  $('env-back').setAttribute('transform', ENV_T);
  $('env-front').setAttribute('transform', ENV_T);
  $('paper-clip').setAttribute('transform', ENV_T);

  var PAPER_IN_ENVELOPE = { cx: EX + ES * 200, cy: EY + ES * 235, s: ES, rot: 0 };
  var PAPER_ON_DESK = { cx: 300, cy: 424, s: 0.3, rot: -4 };
  var PAPER_CLOSE_UP = { cx: 550, cy: 340, s: 1.9, rot: 0 };

  var pose = PAPER_IN_ENVELOPE;
  var paperRaf = 0;
  var paperState = 'hidden';            // hidden | rising | viewing | desk

  function setPaper(p) {
    pose = p;
    paperG.setAttribute('transform',
      'translate(' + p.cx.toFixed(2) + ' ' + p.cy.toFixed(2) + ') rotate(' + p.rot.toFixed(2) + ') scale(' + p.s.toFixed(3) + ') translate(-200 -235)');
  }
  function flyTo(to, ms, done) {
    cancelAnimationFrame(paperRaf);
    var from = pose;
    if (reduce || ms <= 0) { setPaper(to); if (done) done(); return; }
    var t0 = performance.now();
    function frame(now) {
      var p = clamp((now - t0) / ms, 0, 1);
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      setPaper({
        cx: from.cx + (to.cx - from.cx) * e,
        cy: from.cy + (to.cy - from.cy) * e,
        s: from.s + (to.s - from.s) * e,
        rot: from.rot + (to.rot - from.rot) * e
      });
      if (p < 1) paperRaf = requestAnimationFrame(frame);
      else if (done) done();
    }
    paperRaf = requestAnimationFrame(frame);
  }
  function syncPaperAccess() {
    var usable = paperState === 'viewing' || paperState === 'desk';
    paperG.classList.toggle('interactive', usable);
    paperG.style.pointerEvents = usable ? 'auto' : 'none';
    if (usable) {
      paperG.setAttribute('role', 'button');
      paperG.setAttribute('tabindex', '0');
      paperG.setAttribute('aria-label', paperState === 'viewing' ? 'Paper. Put it back on the desk' : 'Paper on the desk. View it');
    } else {
      paperG.removeAttribute('role');
      paperG.removeAttribute('tabindex');
      paperG.removeAttribute('aria-label');
    }
  }
  function viewPaper() {
    paperState = 'viewing';
    backdrop.classList.add('on');
    paperHint.classList.add('on');
    syncPaperAccess();
    flyTo(PAPER_CLOSE_UP, 550);
  }
  function putPaperDown() {
    paperState = 'desk';
    backdrop.classList.remove('on');
    paperHint.classList.remove('on');
    syncPaperAccess();
    flyTo(PAPER_ON_DESK, 550);
  }
  function togglePaper() {
    if (paperState === 'viewing') putPaperDown();
    else if (paperState === 'desk') viewPaper();
  }
  paperG.addEventListener('click', togglePaper);
  paperG.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePaper(); }
  });
  // "Click anywhere" really means anywhere on the page (including outside the room's edges), except the paper itself.
  document.addEventListener('click', function (e) {
    if (paperState === 'viewing' && !paperG.contains(e.target)) putPaperDown();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && paperState === 'viewing') putPaperDown();
  });

  $('paper-digits').textContent = CONFIG.PAPER_DIGITS;
  $('mirror-digits').textContent = CONFIG.MIRROR_DIGITS;
  setPaper(PAPER_IN_ENVELOPE);

  /* ======================================================================
     ENVELOPE (from "Reveal the Clue")
     ====================================================================== */
  var envBtn = $('envelope');
  var flapClosed = $('flap-closed');
  var flapOpen = $('flap-open');
  var paperInner = $('paper-inner');
  var fuzzBlur = $('fuzz-blur');
  var bars = [$('paper-bar-1'), $('paper-bar-2'), $('paper-digits')];

  // Timeline (ms), two steps in order: 1) the flap opens, 2) then the paper slides up.
  var FLAP_MS = 500;
  var CARD_DELAY = 540;
  var CARD_MS = 900;
  var TOTAL = CARD_DELAY + CARD_MS;
  var FLAP_EDGE = 140, FLAP_H = 110;
  var LIFT = 182;           // how far the paper rises, in envelope units
  var MAX_BLUR = 2.2;
  var PRESS_MIN_MS = 160;
  var speed = reduce ? 4 : 1;

  var envState = 'closed';  // closed | opening | open
  var envRaf = 0, envStart = null, pressedAt = 0, releaseTimer = 0;

  function easeIn(x) { return x * x; }
  function easeOut(x) { return 1 - (1 - x) * (1 - x); }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function setEnvState(next) { envState = next; envBtn.setAttribute('data-state', next); }

  // Draw one frame for time t (ms since the tap).
  function drawEnvelope(t) {
    var ft = clamp(t / FLAP_MS, 0, 1);
    var f1 = 0, f2 = 0;
    if (ft < 0.5) { f1 = easeIn(ft * 2); }
    else { f1 = 1; f2 = easeOut((ft - 0.5) * 2); }

    // flap turns edge-on, then swings open behind the paper
    var closedApex = FLAP_EDGE + FLAP_H * (1 - f1);
    flapClosed.setAttribute('points', '60,140 340,140 200,' + closedApex.toFixed(2));
    flapClosed.setAttribute('visibility', f1 >= 1 ? 'hidden' : 'visible');
    var openApex = FLAP_EDGE - FLAP_H * f2;
    flapOpen.setAttribute('points', '60,140 340,140 200,' + openApex.toFixed(2));
    flapOpen.setAttribute('visibility', f2 <= 0 ? 'hidden' : 'visible');

    // the paper slides up, sharpening as it emerges (not drawn at all until it starts to move)
    var p = easeOutCubic(clamp((t - CARD_DELAY) / CARD_MS, 0, 1));
    setPaper({ cx: EX + ES * 200, cy: EY + ES * (235 - LIFT * p), s: ES, rot: 0 });
    paperG.setAttribute('visibility', p > 0 ? 'visible' : 'hidden');

    var blur = MAX_BLUR * (1 - clamp(p / 0.85, 0, 1));
    if (p > 0 && blur > 0.05) {
      fuzzBlur.setAttribute('stdDeviation', blur.toFixed(2));
      paperInner.setAttribute('filter', 'url(#fuzz)');
    } else {
      paperInner.removeAttribute('filter');
    }
    var barOpacity = clamp((p - 0.45) / 0.45, 0, 1).toFixed(2);
    for (var i = 0; i < bars.length; i++) bars[i].setAttribute('opacity', barOpacity);
  }

  function envelopeTick(now) {
    if (envStart === null) envStart = now;
    var t = (now - envStart) * speed;
    if (t >= TOTAL) {
      drawEnvelope(TOTAL);
      setEnvState('open');
      // the paper is out: lift it above the envelope layers, unlock the mirror, and show the paper up close
      paperWrap.removeAttribute('clip-path');
      paperTop.insertBefore(paperG, paperHint);
      setStep('mirror');
      say('Envelope opened. There is a paper with two digits.');
      viewPaper();
      return;
    }
    drawEnvelope(t);
    envRaf = requestAnimationFrame(envelopeTick);
  }

  function revealEnvelope() {
    if (step !== 'envelope' || envState !== 'closed') return;
    setEnvState('opening');
    paperState = 'rising';
    syncPaperAccess();
    envBtn.setAttribute('aria-disabled', 'true');
    envBtn.setAttribute('tabindex', '-1');
    envStart = null;
    envRaf = requestAnimationFrame(envelopeTick);
  }

  // On contact: darken at once, and hold the darker state for a moment even on a quick tap.
  function envPress() {
    if (step !== 'envelope' || envState !== 'closed') return;
    clearTimeout(releaseTimer);
    pressedAt = performance.now();
    envBtn.classList.add('pressed');
  }
  function envRelease() {
    clearTimeout(releaseTimer);
    var wait = Math.max(0, PRESS_MIN_MS - (performance.now() - pressedAt));
    releaseTimer = setTimeout(function () { envBtn.classList.remove('pressed'); }, wait);
  }
  envBtn.addEventListener('pointerdown', envPress);
  envBtn.addEventListener('pointerup', envRelease);
  envBtn.addEventListener('pointercancel', envRelease);
  envBtn.addEventListener('pointerleave', envRelease);
  envBtn.addEventListener('click', revealEnvelope);
  envBtn.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); envPress(); }
  });
  envBtn.addEventListener('keyup', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); envRelease(); revealEnvelope(); }
  });

  function resetEnvelope() {
    cancelAnimationFrame(envRaf);
    cancelAnimationFrame(paperRaf);
    clearTimeout(releaseTimer);
    envBtn.classList.remove('pressed');
    setEnvState('closed');
    envBtn.setAttribute('aria-disabled', 'false');
    envBtn.setAttribute('tabindex', '0');
    // put the same paper back inside the envelope
    paperWrap.setAttribute('clip-path', 'url(#paper-clip)');
    paperWrap.appendChild(paperG);
    paperState = 'hidden';
    backdrop.classList.remove('on');
    paperHint.classList.remove('on');
    syncPaperAccess();
    drawEnvelope(0);
  }

  /* ======================================================================
     MIRROR (from "Reveal the Mirror Clue")
     ====================================================================== */
  var mirror = $('mirror');
  var wipePath = $('wipe-path');

  // Mirror surface geometry (mirror units) and brush
  var CX = 200, CY = 250, RX = 100, RY = 170;
  var BRUSH_R = 26;               // wipe radius (matches stroke-width 52 on the mask path)
  var DRAG_THRESHOLD_PX = 6;      // movement needed before a press counts as a drag
  var MIN_STEP = 1.5;             // ignore pointer moves shorter than this (mirror units)
  var DONE_AT = 0.85;             // share of the surface that must be wiped to finish

  // Coverage grid over the surface's bounding box
  var CELL = 8;
  var GX0 = CX - RX, GY0 = CY - RY;
  var COLS = Math.ceil((2 * RX) / CELL), ROWS = Math.ceil((2 * RY) / CELL);
  var cells, total, covered;

  var d = '';                     // accumulated mask path
  var drag = null;                // active pointer session
  var mirrorDone = false;
  var pressTimer = 0;

  function insideGlass(x, y) {
    var nx = (x - CX) / RX, ny = (y - CY) / RY;
    return nx * nx + ny * ny <= 1;
  }
  function resetCoverage() {
    cells = new Uint8Array(COLS * ROWS);
    total = 0; covered = 0;
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var x = GX0 + (i + 0.5) * CELL, y = GY0 + (j + 0.5) * CELL;
        if (insideGlass(x, y)) { total++; } else { cells[j * COLS + i] = 2; } // 2 = outside the glass
      }
    }
  }
  // Convert a pointer event to mirror coordinates (handles the room's scaling and the mirror's placement)
  function toMirror(e) {
    var m = objMirror.getScreenCTM();
    if (!m) return null;
    var p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  function distToSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function markCoverage(a, b) {
    var r = BRUSH_R * 0.92;       // count slightly less than what is drawn
    var i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - r - GX0) / CELL));
    var i1 = Math.min(COLS - 1, Math.floor((Math.max(a.x, b.x) + r - GX0) / CELL));
    var j0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - r - GY0) / CELL));
    var j1 = Math.min(ROWS - 1, Math.floor((Math.max(a.y, b.y) + r - GY0) / CELL));
    for (var j = j0; j <= j1; j++) {
      for (var i = i0; i <= i1; i++) {
        var k = j * COLS + i;
        if (cells[k] !== 0) continue;
        var x = GX0 + (i + 0.5) * CELL, y = GY0 + (j + 0.5) * CELL;
        if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= r) { cells[k] = 1; covered++; }
      }
    }
  }
  // The clue is "revealed" once the area its digits occupy is wiped clear. People stop wiping as soon as
  // the number is readable, long before 85% of the whole glass is clean, so the keypad must not wait for that.
  var mirrorDigits = $('mirror-digits');
  var DIGITS_BASELINE = 288, DIGITS_CAP_H = 40, DIGITS_REVEALED_AT = 0.75;   // 75% of the digits' area clear = readable
  function digitsRevealed() {
    var bb;
    try { bb = mirrorDigits.getBBox(); } catch (err) { return false; }
    if (!bb || !bb.width) return false;
    var x0 = bb.x, x1 = bb.x + bb.width, y0 = DIGITS_BASELINE - DIGITS_CAP_H, y1 = DIGITS_BASELINE;
    var n = 0, hit = 0;
    for (var j = 0; j < ROWS; j++) {
      var cy = GY0 + (j + 0.5) * CELL;
      if (cy < y0 || cy > y1) continue;               // only cells whose centre lies on the digits
      for (var i = 0; i < COLS; i++) {
        var cx = GX0 + (i + 0.5) * CELL;
        if (cx < x0 || cx > x1) continue;
        var k = j * COLS + i;
        if (cells[k] === 2) continue;                 // outside the glass
        n++;
        if (cells[k] === 1) hit++;
      }
    }
    return n > 0 && hit / n >= DIGITS_REVEALED_AT;
  }
  function unlockKeypad() {
    if (step !== 'mirror') return;
    setStep('door');                // both clues are now visible: the keypad becomes available
    say('Mirror digits revealed. The keypad is ready.');
  }

  function mirrorPress() {
    clearTimeout(pressTimer);
    mirror.classList.add('pressed');
    pressTimer = setTimeout(function () { mirror.classList.remove('pressed'); }, 160);
  }
  // Add one wiped segment from drag.last to pt, only while the pointer is over the glass
  function wipeTo(pt) {
    if (!insideGlass(pt.x, pt.y)) { drag.last = null; drag.open = false; return; }
    if (!drag.last) { drag.last = pt; drag.open = false; return; }
    if (Math.hypot(pt.x - drag.last.x, pt.y - drag.last.y) < MIN_STEP) return;
    if (!drag.open) { d += 'M' + drag.last.x.toFixed(1) + ' ' + drag.last.y.toFixed(1); drag.open = true; }
    d += 'L' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1);
    wipePath.setAttribute('d', d);
    markCoverage(drag.last, pt);
    drag.last = pt;
    objMirror.classList.add('touched');
    if (total && covered / total >= DONE_AT) finishMirror();       // original study: fog fades at 85%
    else if (step === 'mirror' && digitsRevealed()) unlockKeypad();  // keypad does not wait for the fog to fade
  }
  function finishMirror() {
    mirrorDone = true;
    endDrag();
    mirror.classList.add('done');
    mirror.setAttribute('aria-label', 'Mirror, two digits revealed: ' + CONFIG.MIRROR_DIGITS);
    if (step === 'mirror') {
      setStep('door');
      say('Mirror cleared. Two digits are visible.');
    }
  }
  function endDrag() {
    if (drag) { try { mirror.releasePointerCapture(drag.id); } catch (err) {} }
    drag = null;
    mirror.classList.remove('dragging');
  }

  mirror.addEventListener('pointerdown', function (e) {
    // wiping stays possible after the keypad unlocks, until the fog has fully faded
    if ((step !== 'mirror' && step !== 'door') || mirrorDone || drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;   // left button only
    e.preventDefault();
    var pt = toMirror(e);
    if (!pt) return;
    try { mirror.setPointerCapture(e.pointerId); } catch (err) {}
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, start: pt, active: false, last: null, open: false };
    mirror.classList.add('dragging');
    mirrorPress();   // brief shade change on contact; nothing is revealed yet
  });
  mirror.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { endDrag(); return; }  // button no longer held
    // A press only becomes a drag after real movement, so a click or tap reveals nothing
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
      if (insideGlass(drag.start.x, drag.start.y)) drag.last = drag.start;
    }
    // Use every sample the browser batched for this frame so fast swipes stay continuous
    var evts = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (!evts || !evts.length) evts = [e];
    for (var i = 0; i < evts.length && drag && !mirrorDone; i++) {
      var pt = toMirror(evts[i]);
      if (pt) wipeTo(pt);
    }
  });
  function onMirrorEnd(e) { if (drag && e.pointerId === drag.id) endDrag(); }
  mirror.addEventListener('pointerup', onMirrorEnd);
  mirror.addEventListener('pointercancel', onMirrorEnd);
  mirror.addEventListener('lostpointercapture', onMirrorEnd);

  function resetMirror() {
    endDrag();
    clearTimeout(pressTimer);
    mirrorDone = false;
    d = '';
    wipePath.setAttribute('d', '');
    resetCoverage();
    mirror.classList.remove('done', 'pressed', 'dragging');
    objMirror.classList.remove('touched');
    mirror.setAttribute('aria-label', 'Mirror');
  }
  resetCoverage();

  /* ======================================================================
     KEYPAD + DOOR (from "Unlock the Door")
     ====================================================================== */
  var kp = $('keypad'), screen = $('screen'), okIcon = $('icon-ok'), errIcon = $('icon-err');
  var shackle = $('shackle'), lockBody = $('lockbody'), leaf = $('leaf'), lever = $('lever');

  /* display slots: dash when empty, dot when filled */
  var dashes = [], dots = [];
  var slots = $('slots');
  for (var si = 0; si < LEN; si++) {
    dashes.push(mk('rect', { 'class': 'dash', x: 550 + 22 * si, y: 184, width: 14, height: 4 }, slots));
    dots.push(mk('circle', { 'class': 'dot', cx: 557 + 22 * si, cy: 186, r: 7 }, slots));
  }

  /* keys */
  var GLYPH = {
    '1': 'M554 246 V266 M548 252 L554 246',
    '2': 'M598 248 H614 V256 H598 V264 H614',
    '3': 'M654 248 H670 V264 H654 M654 256 H670',
    '4': 'M544 304 V312 H562 M556 304 V322',
    '5': 'M614 306 H598 V314 H614 V322 H598',
    '6': 'M670 306 H654 V322 H670 V314 H654',
    '7': 'M544 362 H562 V380',
    '8': 'M598 362 H614 V380 H598 Z M598 371 H614',
    '9': 'M670 380 V362 H654 V371 H670',
    '0': 'M598 420 H614 V438 H598 Z'
  };
  var LAYOUT = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', '']];
  var XS = [530, 586, 642], YS = [232, 290, 348, 406];
  var keysG = $('keys'), keyEls = {};
  LAYOUT.forEach(function (row, r) {
    row.forEach(function (digit, c) {
      var x = XS[c], y = YS[r];
      var g = mk('g', { 'class': 'key' + (digit ? '' : ' blank'), role: 'button', tabindex: 0, 'aria-label': digit || 'blank key' }, keysG);
      if (digit) g.setAttribute('data-k', digit);
      mk('rect', { x: x, y: y + 3, width: 48, height: 48, rx: 6, fill: '#595959', stroke: '#000000', 'stroke-width': 4 }, g);
      var cap = mk('g', { 'class': 'cap' }, g);
      mk('rect', { 'class': 'face', x: x, y: y, width: 48, height: 48, rx: 6, stroke: '#000000', 'stroke-width': 4 }, cap);
      if (digit) mk('path', { d: GLYPH[digit], stroke: '#000000', 'stroke-width': 4, 'stroke-linecap': 'square', 'stroke-linejoin': 'miter', fill: 'none' }, cap);
      if (digit) keyEls[digit] = g;
    });
  });

  /* sound: short, low thuds */
  var ac;
  function thunk(f, dur, gain) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      var o = ac.createOscillator(), a = ac.createGain(), t = ac.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f * 0.55), t + dur);
      a.gain.setValueAtTime(gain, t);
      a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(a); a.connect(ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  /* state */
  var code = '', kpState = 'ready', timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function render() {
    for (var i = 0; i < LEN; i++) {
      var filled = i < code.length;
      dots[i].classList.toggle('on', filled);
      dashes[i].classList.toggle('hide', filled);
      dashes[i].classList.toggle('next', kpState === 'ready' && i === code.length);
    }
  }
  function hideSlots() {
    for (var i = 0; i < LEN; i++) {
      dots[i].classList.remove('on');
      dashes[i].classList.add('hide');
      dashes[i].classList.remove('next');
    }
  }
  function clearDisplay() {
    code = '';
    screen.classList.remove('ok');
    okIcon.classList.remove('show');
    errIcon.classList.remove('show');
    render();
  }

  /* door pose tweens */
  var doorPose = { leaf: 1, handle: 0 }, doorRaf = {};
  function setLeaf(s) { leaf.setAttribute('transform', 'translate(84 0) scale(' + s + ' 1) translate(-84 0)'); }
  function setHandle(a) { lever.setAttribute('transform', 'rotate(' + a + ' 362 334)'); }
  function tween(key, to, ms, apply) {
    cancelAnimationFrame(doorRaf[key]);
    var from = doorPose[key];
    if (reduce || ms <= 0 || from === to) { doorPose[key] = to; apply(to); return; }
    var t0 = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - t0) / ms);
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      doorPose[key] = from + (to - from) * e;
      apply(doorPose[key]);
      if (p < 1) doorRaf[key] = requestAnimationFrame(frame);
    }
    doorRaf[key] = requestAnimationFrame(frame);
  }
  function lockOpen(open) {
    shackle.setAttribute('d', open ? 'M672 182 V175 A6 6 0 0 1 684 175 V179' : 'M672 182 V177 A6 6 0 0 1 684 177 V182');
    lockBody.setAttribute('fill', open ? '#8C8C8C' : '#000000');
  }

  function input(digit) {
    if (kpState !== 'ready') return;
    code += digit;
    render();
    if (code.length === LEN) {
      kpState = 'checking';
      render();
      later(function () { (code === SECRET ? success : fail)(); }, 420);
    }
  }
  function fail() {
    kpState = 'error';
    hideSlots();
    errIcon.classList.remove('show');
    void errIcon.getBoundingClientRect();
    errIcon.classList.add('show');
    say('Code incorrect');
    if (!reduce) { kp.classList.remove('shake'); void kp.getBoundingClientRect(); kp.classList.add('shake'); }
    thunk(95, 0.2, 0.18);
    later(function () { thunk(70, 0.2, 0.14); }, 140);
    later(function () {
      if (kpState !== 'error') return;
      clearDisplay();
      kpState = 'ready';
      render();
      say('');
    }, 1400);
  }
  function success() {
    kpState = 'unlocked';
    hideSlots();
    screen.classList.add('ok');
    okIcon.classList.add('show');
    say('Code correct. Door unlocked.');
    thunk(130, 0.14, 0.16);
    later(function () { lockOpen(true); thunk(160, 0.08, 0.14); }, 450);
    later(function () { tween('handle', -24, 450, setHandle); thunk(90, 0.25, 0.16); }, 900);
    later(function () { tween('leaf', 0.4, 1200, setLeaf); thunk(48, 0.9, 0.2); }, 1400);
    later(function () { setStep('done'); say('The door is open.'); }, 1400 + 1200);
  }
  function resetDoor() {
    clearTimers();
    kp.classList.remove('shake');
    kpState = 'ready';
    clearDisplay();
    lockOpen(false);
    tween('handle', 0, 350, setHandle);
    tween('leaf', 1, 600, setLeaf);
  }

  // The keypad answers only while the door step is active (after the mirror is cleared).
  function keypadAvailable() { return step === 'door' && paperState !== 'viewing'; }
  function pressKey(el) {
    if (!keypadAvailable()) return;
    el.classList.add('down');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('down'); }, 170);
    thunk(150, 0.09, 0.14);
    var digit = el.getAttribute('data-k');
    if (digit) input(digit);
  }
  var lastKeyPointer = -1000;
  keysG.addEventListener('pointerdown', function (e) {
    var el = e.target.closest ? e.target.closest('.key') : null;
    if (!el) return;
    e.preventDefault();
    lastKeyPointer = performance.now();
    pressKey(el);
  });
  // Fallback for activation without a pointerdown (assistive tech, synthetic clicks, browsers that
  // skip pointer events). Ignored when the pointerdown already handled the same tap.
  keysG.addEventListener('click', function (e) {
    if (performance.now() - lastKeyPointer < 700) return;
    var el = e.target.closest ? e.target.closest('.key') : null;
    if (el) pressKey(el);
  });
  keysG.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('key')) {
      e.preventDefault();
      if (!e.repeat) pressKey(e.target);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key) && keyEls[e.key]) pressKey(keyEls[e.key]);
  });
  kp.addEventListener('animationend', function (e) {
    if (e.target === kp) kp.classList.remove('shake');
  });

  /* ======================================================================
     RESET: back to the starting state (envelope hidden, paper inside it,
     mirror fogged, door locked)
     ====================================================================== */
  function resetAll() {
    resetEnvelope();
    resetMirror();
    resetDoor();
    setStep('envelope');
    say('Reset. Back to the start.');
  }
  $('reset').addEventListener('click', resetAll);

  /* initial frame */
  drawEnvelope(0);
  setLockedInitial();
  function setLockedInitial() {
    setStep('envelope');
    setPaper(PAPER_IN_ENVELOPE);
    syncPaperAccess();
    lockOpen(false);
    setLeaf(1); setHandle(0);
    render();
  }
})();
