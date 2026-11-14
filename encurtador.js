const STORAGE_KEY = "canivete-short-links";

const form = document.querySelector("#shorten-form");
const targetUrlInput = document.querySelector("#target-url");
const customCodeInput = document.querySelector("#custom-code");
const shortenButton = document.querySelector("#shorten-button");
const errorMessage = document.querySelector("#error-message");
const result = document.querySelector("#result");
const shortUrlOutput = document.querySelector("#short-url-output");
const copyShortUrlButton = document.querySelector("#copy-short-url");
const openShortUrlLink = document.querySelector("#open-short-url");
const resultNote = document.querySelector("#result-note");
const resultBadge = document.querySelector("#result-badge");
const historyPanel = document.querySelector("#links-history-panel");
const linksList = document.querySelector("#links-list");
const slugPrefix = document.querySelector("#slug-prefix");
const slugHint = document.querySelector("#slug-hint");
const modeButtons = [...document.querySelectorAll(".mode-switch button")];

let currentMode = "short";

function setMode(mode) {
  currentMode = mode === "local" ? "local" : "short";
  modeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === currentMode));
  if (currentMode === "short") {
    slugPrefix.textContent = "is.gd/";
    customCodeInput.placeholder = "meu_link (ou deixe vazio para menor código)";
    slugHint.textContent = "Deixe vazio para gerar o menor link possível (ex.: is.gd/abc123). Ou use 5 a 30 letras, números ou _.";
  } else {
    slugPrefix.textContent = `${window.location.host}/s/`;
    customCodeInput.placeholder = "meu-link (ou deixe vazio para gerar)";
    slugHint.textContent = "Use de 3 a 32 caracteres: letras, números, hífen (-) ou sublinhado (_).";
  }
  errorMessage.hidden = true;
}

setMode("short");
modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (window.gsap && !reduceMotion) {
  gsap.from(".compressor-page > .back-link, .compressor-page > .eyebrow, .compressor-page > h1, .compressor-page > .page-intro", {
    y: 14, opacity: 0, duration: 0.55, stagger: 0.07, ease: "power2.out",
  });
  gsap.from(".compressor-panel", { y: 20, opacity: 0, duration: 0.6, delay: 0.22, ease: "power2.out", clearProps: "opacity,transform" });
  gsap.from(".footer-inner > *", { y: 12, opacity: 0, duration: 0.45, stagger: 0.08, delay: 0.45, ease: "power2.out", clearProps: "opacity,transform" });
}

function loadSavedLinks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLinks(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 15)));
  } catch {}
}

function getFullShortUrl(item) {
  if (item.shortUrl) return item.shortUrl;
  return `${window.location.origin}${item.shortPath}`;
}

function renderSavedLinks() {
  const items = loadSavedLinks();
  if (!items.length) {
    historyPanel.hidden = true;
    return;
  }
  historyPanel.hidden = false;
  linksList.innerHTML = "";
  for (const item of items) {
    const fullUrl = getFullShortUrl(item);
    const isExternal = Boolean(item.shortUrl);
    const row = document.createElement("div");
    row.className = "short-item";

    const main = document.createElement("div");
    main.className = "short-item-main";
    const link = document.createElement("a");
    link.href = fullUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = fullUrl;
    const dest = document.createElement("span");
    dest.textContent = item.targetUrl;
    main.append(link, dest);

    const actions = document.createElement("div");
    actions.className = "short-item-actions";

    const badge = document.createElement("span");
    badge.className = "click-badge";
    if (isExternal) {
      badge.textContent = `${fullUrl.length} chars`;
    } else {
      badge.textContent = `${item.clicks ?? 0} ${(item.clicks ?? 0) === 1 ? "clique" : "cliques"}`;
    }

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "quiet-button";
    copyBtn.textContent = "Copiar";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(fullUrl);
        copyBtn.textContent = "Copiado!";
        setTimeout(() => { copyBtn.textContent = "Copiar"; }, 1400);
      } catch {}
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "danger-quiet-button";
    delBtn.textContent = "Excluir";
    delBtn.addEventListener("click", async () => {
      delBtn.disabled = true;
      if (!isExternal && item.deleteToken) {
        try {
          await fetch(`/api/links/${encodeURIComponent(item.code)}`, {
            method: "DELETE",
            headers: { "X-Delete-Token": item.deleteToken },
          });
        } catch {}
      }
      saveLinks(loadSavedLinks().filter((entry) => entry.code !== item.code));
      renderSavedLinks();
    });

    actions.append(badge, copyBtn, delBtn);
    row.append(main, actions);
    linksList.appendChild(row);
  }
}

async function refreshClicks() {
  const items = loadSavedLinks();
  if (!items.some((item) => !item.shortUrl && item.shortPath)) return;
  const updated = [];
  for (const item of items) {
    if (item.shortUrl || !item.shortPath) {
      updated.push(item);
      continue;
    }
    try {
      const res = await fetch(`/api/links/${encodeURIComponent(item.code)}`);
      if (res.ok) {
        const data = await res.json();
        updated.push({ ...item, clicks: data.clicks });
      } else if (res.status !== 404) {
        updated.push(item);
      }
    } catch {
      updated.push(item);
    }
  }
  saveLinks(updated);
  renderSavedLinks();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  shortenButton.disabled = true;
  shortenButton.innerHTML = "Encurtando…";

  try {
    const response = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: targetUrlInput.value,
        customCode: customCodeInput.value,
        mode: currentMode,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Não foi possível encurtar o link.");
    }

    const fullShortUrl = data.shortUrl || `${window.location.origin}${data.shortPath}`;
    shortUrlOutput.value = fullShortUrl;
    openShortUrlLink.href = fullShortUrl;

    const origLen = data.originalLength || data.targetUrl.length;
    const shortLen = fullShortUrl.length;
    const diff = origLen - shortLen;
    if (diff > 0) {
      const pct = Math.round((diff / origLen) * 100);
      resultBadge.textContent = `${shortLen} chars (-${pct}%)`;
    } else {
      resultBadge.textContent = data.storage === "postgres" ? "Salvo no banco" : `${shortLen} chars`;
    }
    resultNote.textContent = `Original: ${origLen} caracteres → Encurtado: ${shortLen} caracteres • Destino: ${data.targetUrl}`;
    result.hidden = false;

    if (window.gsap && !reduceMotion) {
      gsap.fromTo(result, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power2.out", clearProps: "opacity,transform" });
    }

    const saved = loadSavedLinks().filter((entry) => entry.code !== data.code);
    saved.unshift(data);
    saveLinks(saved);
    renderSavedLinks();
  } catch (error) {
    errorMessage.textContent = error.message || "Falha ao criar o link encurtado.";
    errorMessage.hidden = false;
  } finally {
    shortenButton.disabled = false;
    shortenButton.innerHTML = 'Encurtar link <span>→</span>';
  }
});

copyShortUrlButton.addEventListener("click", async () => {
  if (!shortUrlOutput.value) return;
  try {
    await navigator.clipboard.writeText(shortUrlOutput.value);
    copyShortUrlButton.textContent = "Copiado!";
    setTimeout(() => { copyShortUrlButton.textContent = "Copiar link"; }, 1600);
  } catch {
    shortUrlOutput.select();
  }
});

document.querySelector("#reset-form").addEventListener("click", () => {
  targetUrlInput.value = "";
  customCodeInput.value = "";
  result.hidden = true;
  errorMessage.hidden = true;
  targetUrlInput.focus();
});

document.querySelector("#refresh-clicks").addEventListener("click", refreshClicks);

renderSavedLinks();
refreshClicks();

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
    content: `<article><h3>Como funcionam os links curtos?</h3><p>No modo <strong>Link ultra curto</strong>, geramos um endereço bem menor (como <code>is.gd/codigo</code>) que funciona em qualquer lugar. No modo <strong>Neste site</strong>, criamos um link <code>/s/codigo</code> com contador de cliques.</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p>No modo local, apenas o link encurtado e a contagem total de cliques são armazenados.</p><p>O histórico exibido abaixo fica salvo apenas no armazenamento local do seu navegador.</p>`,
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
  if (event.key === "Escape" && !popover.hidden) {
    const trigger = activePopupTrigger;
    closeFooterPopover();
    trigger?.focus({ preventScroll: true });
  }
});
