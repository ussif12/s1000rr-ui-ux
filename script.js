/* ============================================================
   BMW S 1000 RR — TELEMETRY EXPERIENCE
   Motion / interaction engine
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ============================================================
     1. PRELOADER
     ============================================================ */
  const preloader = $("#preloader");
  const preNum = $("#preNum");
  const preBar = $("#preBar");
  document.body.style.overflow = "hidden";

  let preProgress = 0;
  const preInterval = setInterval(() => {
    preProgress = Math.min(100, preProgress + Math.random() * 14 + 4);
    preNum.textContent = String(Math.floor(preProgress)).padStart(3, "0");
    preBar.style.transform = `scaleX(${preProgress / 100})`;
    if (preProgress >= 100) {
      clearInterval(preInterval);
      setTimeout(() => {
        preloader.classList.add("done");
        document.body.style.overflow = "";
        $("#hud").classList.add("show");
        setTimeout(() => preloader.remove(), 1100);
      }, 320);
    }
  }, 70);

  /* ============================================================
     2. CUSTOM CURSOR
     ============================================================ */
  const cursor = $("#cursor");
  const cursorLabel = $("#cursorLabel");
  let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
  }, { passive: true });

  $$("a, button, .g-item, .spec-card").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      cursor.classList.add("hot");
      cursorLabel.textContent = el.dataset.cursor || "VIEW";
    });
    el.addEventListener("mouseleave", () => {
      cursor.classList.remove("hot");
      cursorLabel.textContent = "RPM";
    });
  });

  /* ============================================================
     3. NAV / PROGRESS / HUD STATE
     ============================================================ */
  const nav = $("#nav");
  const progressBar = $("#progress i");
  const hud = $("#hud");
  const gFill = $("#gFill");
  const hudValue = $("#hudValue");
  const hudGear = $("#hudGear");

  const CIRC = 289;
  let scrollY = window.scrollY;
  let lastY = scrollY;
  let velocity = 0;
  let rpm = 0;          // 0..14
  let rpmBoost = 0;     // engine rev boost

  function updateChrome() {
    scrollY = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    nav.classList.toggle("scrolled", scrollY > 60);
    progressBar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;

    const dy = Math.abs(scrollY - lastY);
    velocity = lerp(velocity, dy, 0.3);
    lastY = scrollY;
  }
  window.addEventListener("scroll", updateChrome, { passive: true });
  updateChrome();

  /* ============================================================
     4. SPEED LINES CANVAS
     ============================================================ */
  const speedCanvas = $("#speedCanvas");
  const ctx = speedCanvas.getContext("2d");
  let lines = [];
  function resizeCanvas() {
    speedCanvas.width = innerWidth;
    speedCanvas.height = innerHeight;
    lines = Array.from({ length: 70 }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      len: 40 + Math.random() * 220,
      s: 4 + Math.random() * 12,
      a: 0.05 + Math.random() * 0.25,
    }));
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  /* ============================================================
     5. HERO PARALLAX
     ============================================================ */
  const heroMedia = $("#heroMedia");
  const hero = $("#hero");

  /* ============================================================
     6. STICKY SCENE — THE MACHINE
     ============================================================ */
  const machineScene = $("#machine");
  const machineImg = $("#machineImg");
  const slides = $$(".slide");
  const railFill = $("#railFill");
  const railDots = $$(".rail-dot");
  const machineStep = $("#machineStep");
  const counted = new Set();

  function animateCount(el) {
    if (counted.has(el)) return;
    counted.add(el);
    const target = +el.dataset.count;
    const dur = 1100;
    const start = performance.now();
    (function tick(now) {
      const p = clamp((now - start) / dur, 0, 1);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(e * target).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  /* ============================================================
     7. GALLERY — SCROLL-DRIVEN HORIZONTAL
     ============================================================ */
  const galleryScene = $("#gallery");
  const galleryTrack = $("#galleryTrack");
  const galleryProgress = $("#galleryProgress");

  /* ============================================================
     8. REVEALS + SPEC BARS
     ============================================================ */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      $$("[data-count]", e.target).forEach(animateCount);
      revealObserver.unobserve(e.target);
    });
  }, { threshold: 0.25 });
  $$(".reveal").forEach((el) => revealObserver.observe(el));

  /* ============================================================
     9. ENGINE — Web Audio synthesis
     ============================================================ */
  let audio = null, engineOn = false, soundOn = false;

  function buildEngine() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ac = new AC();

    const master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 3;
    filter.connect(master);

    const oscs = [];
    [1, 2, 3, 4, 6].forEach((mult, i) => {
      const osc = ac.createOscillator();
      osc.type = i < 2 ? "sawtooth" : "square";
      osc.frequency.value = 42 * mult;
      const g = ac.createGain();
      g.gain.value = 0.3 / (i + 1);
      osc.connect(g).connect(filter);
      osc.start();
      oscs.push({ osc, mult });
    });

    // intake / exhaust texture
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const nf = ac.createBiquadFilter();
    nf.type = "bandpass"; nf.frequency.value = 1100; nf.Q.value = 0.7;
    const ng = ac.createGain(); ng.gain.value = 0.05;
    noise.connect(nf).connect(ng).connect(filter);
    noise.start();

    const analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    master.connect(analyser);

    audio = { ac, master, filter, oscs, ng, analyser };
    return true;
  }

  function setEngineRPM(value) {
    if (!audio) return;
    const t = audio.ac.currentTime;
    const base = 38 + value * 1.9;
    audio.oscs.forEach(({ osc, mult }) => {
      osc.frequency.setTargetAtTime(base * mult, t, 0.04);
    });
    audio.filter.frequency.setTargetAtTime(420 + value * 95, t, 0.05);
    audio.ng.gain.setTargetAtTime(0.03 + value * 0.006, t, 0.05);
  }

  function engineStart() {
    if (!audio && !buildEngine()) return;
    if (audio.ac.state === "suspended") audio.ac.resume();
    soundOn = true;
    updateSoundBtn();
    engineOn = true;
    const t = audio.ac.currentTime;
    audio.master.gain.cancelScheduledValues(t);
    audio.master.gain.setValueAtTime(audio.master.gain.value, t);
    audio.master.gain.linearRampToValueAtTime(0.16, t + 0.12);
    // startup rev then settle
    setEngineRPM(13);
    setTimeout(() => setEngineRPM(3.2), 420);
    setTimeout(() => setEngineRPM(2.4), 950);
  }

  function engineStop() {
    if (!audio) return;
    engineOn = false;
    const t = audio.ac.currentTime;
    audio.master.gain.cancelScheduledValues(t);
    audio.master.gain.setValueAtTime(audio.master.gain.value, t);
    audio.master.gain.linearRampToValueAtTime(0, t + 0.35);
  }

  function toggleSound() {
    if (!engineOn) { engineStart(); return; }
    soundOn = !soundOn;
    const t = audio.ac.currentTime;
    audio.master.gain.cancelScheduledValues(t);
    audio.master.gain.setValueAtTime(audio.master.gain.value, t);
    audio.master.gain.linearRampToValueAtTime(soundOn ? 0.16 : 0, t + 0.15);
    updateSoundBtn();
  }

  const soundBtn = $("#soundBtn");
  const soundTxt = $("#soundTxt");
  function updateSoundBtn() {
    soundBtn.classList.toggle("on", soundOn);
    soundBtn.setAttribute("aria-pressed", String(soundOn));
    soundTxt.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
  }

  const igniteBtn = $("#igniteBtn");
  const igniteTxt = $("#igniteTxt");
  const igniteStatus = $("#igniteStatus");
  const igniteLed = $("#igniteLed");
  const igniteWrap = $(".ignite-status");

  function ignite() {
    if (!engineOn) {
      engineStart();
      igniteBtn.classList.add("rev");
      igniteTxt.innerHTML = "ENGINE<br>ON";
      igniteStatus.textContent = "STATUS: ENGINE RUNNING";
      igniteWrap.classList.add("live");
      rpmBoost = 9;
      setTimeout(() => (rpmBoost = 0), 1600);
    } else {
      engineStop();
      igniteBtn.classList.remove("rev");
      igniteTxt.innerHTML = "START<br>ENGINE";
      igniteStatus.textContent = "STATUS: STANDBY";
      igniteWrap.classList.remove("live");
      rpmBoost = 0;
    }
  }
  igniteBtn.addEventListener("click", ignite);
  $("#heroIgnite").addEventListener("click", () => {
    ignite();
    $("#ignition").scrollIntoView({ behavior: "smooth" });
  });
  $("#navIgnite").addEventListener("click", ignite);
  soundBtn.addEventListener("click", toggleSound);

  /* ============================================================
     10. MOBILE MENU
     ============================================================ */
  const burger = $("#burger");
  const navLinks = $("#navLinks");
  burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
  });
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  }));

  /* ============================================================
     10b. AUDIO SPECTRUM + HERO SPEED
     ============================================================ */
  const spectrum = $("#spectrum");
  const sctx = spectrum.getContext("2d");
  const heroSpeed = $("#heroSpeed");
  let freqData = null;

  function resizeCanvases() {
    [spectrum, $("#rideCanvas")].forEach((c) => {
      c.width = c.clientWidth || innerWidth;
      c.height = c.clientHeight || innerHeight;
    });
  }
  resizeCanvases();
  window.addEventListener("resize", resizeCanvases);

  function drawSpectrum(now) {
    const w = spectrum.width, h = spectrum.height;
    sctx.clearRect(0, 0, w, h);
    const bars = 48;
    const bw = w / bars;
    let data = null;
    if (audio && audio.analyser) {
      if (!freqData) freqData = new Uint8Array(audio.analyser.frequencyBinCount);
      audio.analyser.getByteFrequencyData(freqData);
      data = freqData;
    }
    for (let i = 0; i < bars; i++) {
      let v;
      if (data) v = data[Math.floor(i / bars * data.length * 0.7)] / 255;
      else v = 0.12 + Math.abs(Math.sin(i * 0.28 + now * 0.003)) * 0.18;
      const bh = Math.max(2, v * h * 0.95);
      sctx.fillStyle = v > 0.72 ? "#ff462e" : "#ccff33";
      sctx.globalAlpha = 0.35 + v * 0.65;
      sctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
    }
    sctx.globalAlpha = 1;
  }

  /* ============================================================
     10c. RIDE MODE — cinematic simulation
     ============================================================ */
  const ride = $("#ride");
  const rideSpeedEl = $("#rideSpeed");
  const rideGearEl = $("#rideGear");
  const rideRpmFill = $("#rideRpmFill");
  const rideRpmNum = $("#rideRpmNum");
  const rideTimer = $("#rideTimer");
  const rideEvents = $("#rideEvents");
  const rideCanvas = $("#rideCanvas");
  const rctx = rideCanvas.getContext("2d");
  const rideLines = $(".ride-lines");
  const rideCenter = $(".ride-center");
  let riding = false, rideStart = 0, particles = [];

  function fireEvent(text) {
    if (!riding) return;
    const el = document.createElement("div");
    el.className = "ride-event";
    el.dir = "ltr";
    el.textContent = text;
    rideEvents.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  function openRide() {
    if (riding) return;
    riding = true;
    ride.classList.add("active");
    ride.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    rideStart = performance.now();
    rideEvents.innerHTML = "";
    rideLines.classList.remove("paused");
    rideCenter.classList.remove("paused");
    particles = Array.from({ length: 90 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 20 + Math.random() * 220,
      s: 0.3 + Math.random() * 1.2,
    }));
    if (!engineOn) engineStart();
    else {
      soundOn = true; updateSoundBtn();
      audio.master.gain.setTargetAtTime(0.18, audio.ac.currentTime, 0.05);
    }
    rpmBoost = 12;
    setTimeout(() => (rpmBoost = 0), 1300);
    fireEvent("LAUNCH");
    setTimeout(() => fireEvent("0—100 · 3.0s"), 1900);
    setTimeout(() => fireEvent("REDLINE"), 3900);
    setTimeout(() => fireEvent("300 KM/H"), 5500);
  }

  function closeRide() {
    if (!riding) return;
    riding = false;
    ride.classList.remove("active");
    ride.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    rideLines.classList.add("paused");
    rideCenter.classList.add("paused");
    rctx.clearRect(0, 0, rideCanvas.width, rideCanvas.height);
    rpmBoost = 0;
    if (engineOn && soundOn) setEngineRPM(2.4);
  }

  $("#rideTrigger").addEventListener("click", openRide);
  $("#navRide").addEventListener("click", openRide);
  $("#rideExit").addEventListener("click", closeRide);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeRide(); });
  rideLines.classList.add("paused");
  rideCenter.classList.add("paused");

  /* ============================================================
     11. MAIN RAF LOOP — drives everything
     ============================================================ */
  function frame(now) {
    // --- cursor easing
    cx = lerp(cx, mx, 0.16);
    cy = lerp(cy, my, 0.16);
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;

    // --- rpm from scroll velocity + engine boost
    const targetRPM = clamp(velocity * 0.16 + rpmBoost, 0, 14);
    rpm = lerp(rpm, targetRPM, 0.09);
    velocity *= 0.92;

    const gear = rpm < 1.4 ? "N" : rpm < 3.5 ? "1" : rpm < 5.5 ? "2" : rpm < 7.5 ? "3" : rpm < 9.5 ? "4" : rpm < 11.5 ? "5" : "6";
    hudValue.textContent = rpm.toFixed(1);
    hudGear.textContent = gear;
    gFill.style.strokeDashoffset = String(CIRC - (rpm / 14) * CIRC);
    cursorLabel.style.opacity = String(0.4 + (rpm / 14) * 0.6);

    // --- hero live speed readout
    heroSpeed.textContent = String(Math.round(rpm * 21)).padStart(3, "0") + " KM/H";

    // --- speed lines
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const intensity = 0.25 + (rpm / 14) * 0.9;
    ctx.lineWidth = 1;
    lines.forEach((l) => {
      l.x += l.s * intensity;
      if (l.x > innerWidth + l.len) {
        l.x = -l.len - Math.random() * 300;
        l.y = Math.random() * innerHeight;
      }
      ctx.beginPath();
      ctx.strokeStyle = `rgba(204,255,51,${l.a * intensity})`;
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.len, l.y - l.len * 0.12);
      ctx.stroke();
    });

    // --- hero parallax
    if (scrollY < innerHeight * 1.3) {
      heroMedia.style.transform = `translate3d(0, ${scrollY * 0.24}px, 0) scale(1.06)`;
    }

    // --- machine sticky scene
    const mTop = machineScene.offsetTop;
    const mRange = machineScene.offsetHeight - innerHeight;
    const mp = clamp((scrollY - mTop) / mRange, 0, 1);
    if (mp > -0.1 && mp < 1.1) {
      machineImg.style.transform = `scale(${1 + mp * 0.18}) translate3d(0, ${mp * -55}px, 0)`;
      railFill.style.transform = `scaleX(${mp})`;
      const step = clamp(Math.floor(mp * 3), 0, 2);
      slides.forEach((s, i) => s.classList.toggle("is-active", i === step));
      railDots.forEach((d, i) => d.classList.toggle("active", i <= step));
      machineStep.textContent = `0${step + 1} / 03`;
      const activeStat = slides[step].querySelector("[data-count]");
      if (activeStat) animateCount(activeStat);
    }

    // --- gallery horizontal
    const gTop = galleryScene.offsetTop;
    const gRange = galleryScene.offsetHeight - innerHeight;
    const gp = clamp((scrollY - gTop) / gRange, 0, 1);
    if (gp > -0.1 && gp < 1.1) {
      const dist = Math.max(0, galleryTrack.scrollWidth - innerWidth);
      galleryTrack.style.transform = `translate3d(${gp * dist}px, 0, 0)`;
      galleryProgress.style.transform = `scaleX(${gp})`;
    }

    // --- audio spectrum (near ignition, or during ride)
    const ignRect = $("#ignition").getBoundingClientRect();
    if (riding || (ignRect.top < innerHeight + 200 && ignRect.bottom > -200)) drawSpectrum(now);

    // --- RIDE MODE simulation
    if (riding) {
      const t = (now - rideStart) / 1000;
      const prog = clamp(t / 6.5, 0, 1);
      const speed = Math.round(300 * (1 - Math.pow(1 - prog, 3)));
      rideSpeedEl.textContent = String(speed).padStart(3, "0");
      rideTimer.textContent = t.toFixed(2).padStart(5, "0");

      const rr = clamp(2 + (speed / 300) * 11.5 + Math.sin(t * 17) * 0.45, 0, 14);
      rideRpmFill.style.transform = `scaleX(${rr / 14})`;
      rideRpmNum.textContent = rr.toFixed(1);
      rideGearEl.textContent =
        speed < 40 ? "1" : speed < 85 ? "2" : speed < 130 ? "3" :
        speed < 180 ? "4" : speed < 240 ? "5" : "6";

      rideLines.style.animationDuration = `${Math.max(0.07, 0.5 - speed / 780)}s`;
      rideCenter.style.animationDuration = `${Math.max(0.05, 0.32 - speed / 1200)}s`;
      if (engineOn && soundOn) setEngineRPM(rr);

      // radial speed particles
      const w = rideCanvas.width, h = rideCanvas.height;
      rctx.clearRect(0, 0, w, h);
      const cxp = w / 2, cyp = h * 0.42;
      particles.forEach((p) => {
        p.r += p.s * (2 + speed / 32);
        if (p.r > Math.max(w, h)) { p.r = 10 + Math.random() * 60; p.a = Math.random() * Math.PI * 2; }
        const x = cxp + Math.cos(p.a) * p.r * 2.1;
        const y = cyp + Math.sin(p.a) * p.r * 1.1;
        rctx.beginPath();
        rctx.moveTo(x, y);
        rctx.lineTo(x + Math.cos(p.a) * (14 + speed / 9), y + Math.sin(p.a) * (8 + speed / 16));
        rctx.strokeStyle = `rgba(204,255,51,${0.08 + (speed / 300) * 0.4})`;
        rctx.lineWidth = 1;
        rctx.stroke();
      });
    }

    // --- engine sound follows rpm (outside ride)
    if (!riding && engineOn && soundOn) setEngineRPM(clamp(rpm, 1.5, 14));

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ============================================================
     12. SMOOTH ANCHORS
     ============================================================ */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    });
  });
})();
