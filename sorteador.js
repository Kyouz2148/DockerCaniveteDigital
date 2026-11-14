const numMinInput = document.querySelector("#num-min");
const numMaxInput = document.querySelector("#num-max");
const namesInput = document.querySelector("#names-input");
const namesCount = document.querySelector("#names-count");
const drawQtyInput = document.querySelector("#draw-qty");
const noRepeatInput = document.querySelector("#no-repeat");
const removeDrawnInput = document.querySelector("#remove-drawn");
const drawButton = document.querySelector("#draw-button");
const drawAgainButton = document.querySelector("#draw-again");
const copyResultButton = document.querySelector("#copy-result");
const errorMessage = document.querySelector("#error-message");
const result = document.querySelector("#result");
const resultsGrid = document.querySelector("#draw-results-grid");
const historyPanel = document.querySelector("#history-panel");
const historyList = document.querySelector("#history-list");
const celebrationOverlay = document.querySelector("#celebration-overlay");
const celebrationConfetti = document.querySelector("#celebration-confetti");
const celebrationCard = document.querySelector("#celebration-card");
const celebrationClose = document.querySelector("#celebration-close");
const celebrationBadge = document.querySelector("#celebration-badge");
const celebrationTitle = document.querySelector("#celebration-title");
const celebrationValues = document.querySelector("#celebration-values");
const celebrationAgain = document.querySelector("#celebration-again");
const celebrationCopy = document.querySelector("#celebration-copy");

let currentMode = "numbers";
let lastDrawn = [];
const history = [];
let confettiFrameId = 0;
let lastFocusedBeforeCelebration = null;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (window.gsap && !reduceMotion) {
  gsap.from(".compressor-page > .back-link, .compressor-page > .eyebrow, .compressor-page > h1, .compressor-page > .page-intro", {
    y: 14, opacity: 0, duration: 0.55, stagger: 0.07, ease: "power2.out",
  });
  gsap.from(".compressor-panel", { y: 20, opacity: 0, duration: 0.6, delay: 0.22, ease: "power2.out", clearProps: "opacity,transform" });
  gsap.from(".footer-inner > *", { y: 12, opacity: 0, duration: 0.45, stagger: 0.08, delay: 0.45, ease: "power2.out", clearProps: "opacity,transform" });
}

function randomInt(min, max) {
  const range = max - min + 1;
  const maxUnbiased = Math.floor(0x100000000 / range) * range;
  const buf = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= maxUnbiased);
  return min + (value % range);
}

function parseItems() {
  return namesInput.value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function updateNamesCount() {
  const items = parseItems();
  namesCount.textContent = `${items.length} ${items.length === 1 ? "item na lista" : "itens na lista"}`;
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-switch button").forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
  const isNumbers = mode === "numbers";
  document.querySelector("#num-min-field").hidden = !isNumbers;
  document.querySelector("#num-max-field").hidden = !isNumbers;
  document.querySelector("#num-presets-wrap").hidden = !isNumbers;
  document.querySelector("#names-field").hidden = isNumbers;
  document.querySelector("#remove-drawn-wrap").hidden = isNumbers;
  errorMessage.hidden = true;
}

document.querySelectorAll(".mode-switch button").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelectorAll("#num-presets-wrap button").forEach((button) => {
  button.addEventListener("click", () => {
    numMinInput.value = button.dataset.min;
    numMaxInput.value = button.dataset.max;
    drawQtyInput.value = button.dataset.qty;
    document.querySelectorAll("#num-presets-wrap button").forEach((btn) => btn.classList.toggle("active", btn === button));
  });
});

document.querySelector("#fill-sample").addEventListener("click", () => {
  namesInput.value = "Ana\nBruno\nCarla\nDiego\nElena\nFelipe\nGabriela\nHenrique";
  updateNamesCount();
});

namesInput.addEventListener("input", updateNamesCount);

function renderHistory() {
  if (!history.length) {
    historyPanel.hidden = true;
    return;
  }
  historyPanel.hidden = false;
  historyList.innerHTML = history.map((entry) => `
    <div class="history-item">
      <strong>${entry.label}: ${entry.values.map((v) => String(v).replace(/</g, "&lt;")).join(", ")}</strong>
      <span>${entry.time}</span>
    </div>
  `).join("");
}

function stopConfetti() {
  if (confettiFrameId) {
    cancelAnimationFrame(confettiFrameId);
    confettiFrameId = 0;
  }
  if (!celebrationConfetti) return;
  const ctx = celebrationConfetti.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, celebrationConfetti.width, celebrationConfetti.height);
  }
}

function launchConfetti() {
  if (reduceMotion || !celebrationConfetti) return;
  stopConfetti();

  const ctx = celebrationConfetti.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = window.innerWidth;
  let height = window.innerHeight;
  celebrationConfetti.width = Math.round(width * dpr);
  celebrationConfetti.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ["#c8ed6d", "#ef8e60", "#308fce", "#f5c842", "#e94f70", "#7ad8b8", "#b388ff"];
  const particles = [];
  const total = 135;

  for (let i = 0; i < total; i += 1) {
    const originType = i % 3;
    let x;
    let y;
    let vx;
    let vy;
    if (originType === 0) {
      x = width * 0.14 + (Math.random() - 0.5) * 80;
      y = height * 0.62 + (Math.random() - 0.5) * 60;
      vx = 4 + Math.random() * 9;
      vy = -(10 + Math.random() * 9);
    } else if (originType === 1) {
      x = width * 0.86 + (Math.random() - 0.5) * 80;
      y = height * 0.62 + (Math.random() - 0.5) * 60;
      vx = -(4 + Math.random() * 9);
      vy = -(10 + Math.random() * 9);
    } else {
      x = width * (0.2 + Math.random() * 0.6);
      y = -20 - Math.random() * 80;
      vx = (Math.random() - 0.5) * 6;
      vy = 2 + Math.random() * 5;
    }

    particles.push({
      x,
      y,
      vx,
      vy,
      w: 7 + Math.random() * 8,
      h: 5 + Math.random() * 9,
      color: colors[i % colors.length],
      shape: i % 5 === 0 ? "circle" : "rect",
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.22,
      tilt: Math.random() * Math.PI * 2,
      tiltSpeed: 0.08 + Math.random() * 0.12,
      gravity: 0.28 + Math.random() * 0.12,
      drag: 0.985,
      alpha: 1,
    });
  }

  let lastTime = performance.now();
  const startedAt = lastTime;

  function step(now) {
    if (celebrationOverlay.hidden) {
      stopConfetti();
      return;
    }
    const dt = Math.min((now - lastTime) / 16.6667, 2.5);
    lastTime = now;

    if (window.innerWidth !== width || window.innerHeight !== height) {
      width = window.innerWidth;
      height = window.innerHeight;
      celebrationConfetti.width = Math.round(width * dpr);
      celebrationConfetti.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.clearRect(0, 0, width, height);
    const elapsed = now - startedAt;
    let alive = 0;

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.vx *= Math.pow(p.drag, dt);
      p.vy = p.vy * Math.pow(p.drag, dt) + p.gravity * dt;
      p.x += p.vx * dt + Math.sin(p.tilt) * 0.6 * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.tilt += p.tiltSpeed * dt;

      if (elapsed > 3000) {
        p.alpha = Math.max(0, p.alpha - 0.025 * dt);
      }

      if (p.y < height + 40 && p.alpha > 0.02) {
        alive += 1;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const scaleY = Math.max(0.2, Math.abs(Math.cos(p.tilt)));
          ctx.fillRect(-p.w / 2, (-p.h * scaleY) / 2, p.w, p.h * scaleY);
        }
        ctx.restore();
      }
    }

    if (alive > 0 && elapsed < 5200) {
      confettiFrameId = requestAnimationFrame(step);
    } else {
      stopConfetti();
    }
  }

  confettiFrameId = requestAnimationFrame(step);
}

function showCelebration(drawn) {
  if (!celebrationOverlay) return;
  if (window.gsap) {
    gsap.killTweensOf([celebrationOverlay, celebrationCard]);
  }
  if (!lastFocusedBeforeCelebration && document.activeElement instanceof HTMLElement) {
    lastFocusedBeforeCelebration = document.activeElement;
  }

  celebrationBadge.textContent = currentMode === "numbers" ? "Número sorteado" : "Sorteio realizado";
  celebrationTitle.textContent = drawn.length === 1
    ? (currentMode === "numbers" ? "Número sorteado!" : "Resultado sorteado!")
    : `${drawn.length} resultados sorteados!`;

  celebrationValues.innerHTML = "";
  drawn.forEach((value) => {
    const pill = document.createElement("span");
    const text = String(value);
    pill.className = `celebration-pill${currentMode === "names" || text.length > 5 ? " is-text" : ""}`;
    pill.textContent = text;
    celebrationValues.appendChild(pill);
  });

  celebrationCopy.textContent = "Copiar resultado";
  celebrationOverlay.hidden = false;
  celebrationOverlay.style.removeProperty("opacity");

  if (window.gsap && !reduceMotion) {
    gsap.fromTo(celebrationOverlay, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power2.out", clearProps: "opacity" });
    gsap.fromTo(
      celebrationCard,
      { scale: 0.55, y: 26, opacity: 0 },
      { scale: 1, y: 0, opacity: 1, duration: 0.52, ease: "back.out(1.65)", clearProps: "opacity,transform" },
    );
    gsap.fromTo(
      ".celebration-pill",
      { scale: 0.4, rotation: -6, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.48, stagger: 0.05, delay: 0.1, ease: "back.out(1.9)", clearProps: "opacity,transform" },
    );
  }

  launchConfetti();
  celebrationClose?.focus({ preventScroll: true });
}

function closeCelebration() {
  if (!celebrationOverlay || celebrationOverlay.hidden) return;
  stopConfetti();
  const finish = () => {
    celebrationOverlay.hidden = true;
    celebrationOverlay.style.removeProperty("opacity");
    celebrationCard?.style.removeProperty("transform");
    celebrationCard?.style.removeProperty("opacity");
    lastFocusedBeforeCelebration?.focus({ preventScroll: true });
    lastFocusedBeforeCelebration = null;
  };
  if (window.gsap && !reduceMotion) {
    gsap.to(celebrationCard, { scale: 0.9, opacity: 0, duration: 0.18, ease: "power2.in" });
    gsap.to(celebrationOverlay, { opacity: 0, duration: 0.2, ease: "power2.in", onComplete: finish });
  } else {
    finish();
  }
}

function runDraw() {
  errorMessage.hidden = true;
  const qty = Math.round(Number(drawQtyInput.value));
  const noRepeat = noRepeatInput.checked;

  if (!Number.isFinite(qty) || qty < 1 || qty > 500) {
    errorMessage.textContent = "Informe uma quantidade entre 1 e 500.";
    errorMessage.hidden = false;
    return;
  }

  let drawn = [];
  if (currentMode === "numbers") {
    const min = Math.round(Number(numMinInput.value));
    const max = Math.round(Number(numMaxInput.value));
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      errorMessage.textContent = "O número mínimo deve ser menor ou igual ao número máximo.";
      errorMessage.hidden = false;
      return;
    }
    const available = max - min + 1;
    if (noRepeat && qty > available) {
      errorMessage.textContent = `Não é possível sortear ${qty} números sem repetir no intervalo de ${min} a ${max} (${available} disponíveis).`;
      errorMessage.hidden = false;
      return;
    }
    if (noRepeat) {
      if (available <= 5000) {
        const pool = [];
        for (let n = min; n <= max; n += 1) pool.push(n);
        for (let i = 0; i < qty; i += 1) {
          const idx = randomInt(i, pool.length - 1);
          [pool[i], pool[idx]] = [pool[idx], pool[i]];
          drawn.push(pool[i]);
        }
      } else {
        const picked = new Set();
        while (picked.size < qty) picked.add(randomInt(min, max));
        drawn = [...picked];
      }
    } else {
      for (let i = 0; i < qty; i += 1) drawn.push(randomInt(min, max));
    }
  } else {
    const items = parseItems();
    if (!items.length) {
      errorMessage.textContent = "Adicione pelo menos um nome ou item na lista.";
      errorMessage.hidden = false;
      return;
    }
    if (noRepeat && qty > items.length) {
      errorMessage.textContent = `A lista possui apenas ${items.length} ${items.length === 1 ? "item" : "itens"} para sortear sem repetição.`;
      errorMessage.hidden = false;
      return;
    }
    if (noRepeat) {
      const pool = items.map((value, idx) => ({ value, idx }));
      const pickedIndexes = new Set();
      for (let i = 0; i < qty; i += 1) {
        const j = randomInt(i, pool.length - 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
        drawn.push(pool[i].value);
        pickedIndexes.add(pool[i].idx);
      }
      if (removeDrawnInput.checked) {
        const remaining = items.filter((_, idx) => !pickedIndexes.has(idx));
        namesInput.value = remaining.join("\n");
        updateNamesCount();
      }
    } else {
      for (let i = 0; i < qty; i += 1) drawn.push(items[randomInt(0, items.length - 1)]);
    }
  }

  lastDrawn = drawn;
  resultsGrid.innerHTML = "";
  drawn.forEach((value) => {
    const pill = document.createElement("span");
    pill.className = `draw-pill${currentMode === "names" ? " is-text" : ""}`;
    pill.textContent = String(value);
    resultsGrid.appendChild(pill);
  });

  document.querySelector("#result-title").textContent = drawn.length === 1 ? "Resultado sorteado" : `${drawn.length} resultados sorteados`;
  document.querySelector("#result-badge").textContent = currentMode === "numbers" ? "Números" : "Nomes";
  result.hidden = false;

  if (window.gsap && !reduceMotion) {
    gsap.fromTo(".draw-pill", { y: 14, scale: 0.78, opacity: 0 }, {
      y: 0, scale: 1, opacity: 1, duration: 0.42, stagger: 0.055, ease: "back.out(1.6)", clearProps: "opacity,transform",
    });
  }

  history.unshift({
    label: currentMode === "numbers" ? "Números" : "Nomes",
    values: drawn,
    time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  });
  if (history.length > 12) history.pop();
  renderHistory();
  showCelebration(drawn);
}

async function copyDrawnResult(button, idleLabel) {
  if (!lastDrawn.length) return;
  try {
    await navigator.clipboard.writeText(lastDrawn.join(", "));
    button.textContent = "Copiado!";
    setTimeout(() => { button.textContent = idleLabel; }, 1600);
  } catch {}
}

drawButton.addEventListener("click", runDraw);
drawAgainButton.addEventListener("click", runDraw);
copyResultButton.addEventListener("click", () => copyDrawnResult(copyResultButton, "Copiar resultado"));
celebrationClose?.addEventListener("click", closeCelebration);
celebrationAgain?.addEventListener("click", runDraw);
celebrationCopy?.addEventListener("click", () => copyDrawnResult(celebrationCopy, "Copiar resultado"));
celebrationOverlay?.addEventListener("click", (event) => {
  if (event.target === celebrationOverlay) closeCelebration();
});
document.querySelector("#clear-history").addEventListener("click", () => {
  history.length = 0;
  renderHistory();
});

const themeToggle = document.querySelector(".theme-toggle");
function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.setAttribute("aria-label", dark ? "Ativar tema claro" : "Ativar tema escuro");
  try { localStorage.setItem("canivete-theme", dark ? "dark" : "light"); } catch {}
}
applyTheme(document.documentElement.dataset.theme || "light");
themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  if (window.gsap && !reduceMotion) gsap.fromTo(themeToggle, { rotation: -12, scale: 0.92 }, { rotation: 0, scale: 1, duration: 0.55, ease: "back.out(1.8)", clearProps: "rotation,scale" });
});

const footer = document.querySelector(".footer");
const popover = document.querySelector("#footer-popover");
const popoverTitle = document.querySelector("#footer-popover-title");
const popoverContent = document.querySelector("#footer-popover-content");
const popupTriggers = [...document.querySelectorAll(".footer-popup-trigger")];
const popupCopy = {
  faq: {
    title: "Perguntas frequentes",
    content: `<article><h3>O sorteio é realmente aleatório?</h3><p>Sim. Utilizamos <code>crypto.getRandomValues</code> com distribuição uniforme sem viés diretamente no seu navegador.</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p>Os nomes e números sorteados nunca saem do seu navegador.</p><p>A preferência do tema fica salva apenas neste navegador.</p>`,
  },
};
let activePopupTrigger = null;

function closeFooterPopover() {
  const finishClose = () => {
    popover.hidden = true;
    popover.setAttribute("aria-hidden", "true");
    popover.style.removeProperty("transform");
    popupTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    activePopupTrigger = null;
  };
  if (window.gsap && !reduceMotion) {
    gsap.to(popover, { y: 14, scaleY: 0.95, opacity: 0, duration: 0.2, transformOrigin: "bottom center", ease: "power2.in", onComplete: finishClose });
  } else finishClose();
}

popupTriggers.forEach((trigger) => trigger.addEventListener("click", () => {
  if (activePopupTrigger === trigger && !popover.hidden) {
    closeFooterPopover();
    return;
  }
  const copy = popupCopy[trigger.dataset.popup];
  if (!copy) return;
  activePopupTrigger = trigger;
  popupTriggers.forEach((button) => button.setAttribute("aria-expanded", String(button === trigger)));
  popoverTitle.textContent = copy.title;
  popoverContent.innerHTML = copy.content;
  popover.hidden = false;
  popover.setAttribute("aria-hidden", "false");
  const footerRect = footer.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  const popupWidth = popover.offsetWidth;
  popover.style.left = `${Math.max(16, Math.min(triggerRect.left + triggerRect.width / 2 - footerRect.left - popupWidth / 2, footerRect.width - popupWidth - 16))}px`;
  popover.style.bottom = `${footerRect.bottom - triggerRect.top + 10}px`;
  if (window.gsap && !reduceMotion) gsap.fromTo(popover, { y: 16, scaleY: 0.92, opacity: 0 }, { y: 0, scaleY: 1, opacity: 1, duration: 0.35, transformOrigin: "bottom center", ease: "back.out(1.35)" });
}));

document.querySelector(".popover-close").addEventListener("click", closeFooterPopover);
document.addEventListener("click", (event) => {
  if (!popover.hidden && !popover.contains(event.target) && !event.target.closest(".footer-popup-trigger")) closeFooterPopover();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (celebrationOverlay && !celebrationOverlay.hidden) {
    closeCelebration();
    return;
  }
  if (!popover.hidden) {
    const trigger = activePopupTrigger;
    closeFooterPopover();
    trigger?.focus({ preventScroll: true });
  }
});
