const tools = [
  { title: "Compressor de imagens", description: "Imagens menores, qualidade preservada.", icon: "◉", category: "imagem", label: "Imagem", href: "/compressor.html" },
  { title: "Conversor de arquivos", description: "Troque formatos de imagens e documentos.", icon: "⇄", category: "imagem", label: "Imagem", href: "/conversor.html" },
  { title: "Redimensionar imagem", description: "Ajuste o tamanho em pixels ou porcentagem.", icon: '<svg class="resize-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M3.5 3.5l6 6M16 21h5v-5m-.5 4.5-6-6" /></svg>', category: "imagem", label: "Imagem", href: "/redimensionar.html" },
  { title: "PDF para imagem", description: "Transforme páginas em JPG ou PNG e vice-versa.", icon: "▤", category: "pdf", label: "PDF", href: "/pdf-imagem.html" },
  { title: "Unir e dividir PDF", description: "Organize páginas e junte documentos.", icon: "▧", category: "pdf", label: "PDF", href: "/pdf-organizar.html" },
  { title: "Hospedagem de imagens", description: "Compartilhe uma imagem por um link direto.", icon: "↥", category: "util", label: "Utilidades", href: "/hospedagem-imagens.html" },
  { title: "Gerador de QR Code", description: "QR Codes para links, Wi-Fi e textos.", icon: "▦", category: "util", label: "Utilidades", href: "/qr-code.html" },
  { title: "Encurtador de links", description: "Links curtos, limpos e fáceis de compartilhar.", icon: "⌁", category: "util", label: "Utilidades", href: "/encurtador.html" },
  { title: "Sorteador", description: "Escolha nomes ou números de forma aleatória.", icon: "🎲", category: "util", label: "Utilidades", href: "/sorteador.html" },
];

const grid = document.querySelector("#tool-grid");
const themeToggle = document.querySelector(".theme-toggle");
function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle?.setAttribute("aria-pressed", String(isDark));
  themeToggle?.setAttribute("aria-label", isDark ? "Ativar tema claro" : "Ativar tema escuro");
  try { localStorage.setItem("canivete-theme", isDark ? "dark" : "light"); } catch {}
}
applyTheme(document.documentElement.dataset.theme || "light");
themeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.fromTo(themeToggle, { rotation: -12, scale: 0.92 }, {
      rotation: 0,
      scale: 1,
      duration: 0.55,
      ease: "back.out(1.8)",
      clearProps: "rotation,scale",
    });
  }
});

function renderTools(filter = "all") {
  const visible = filter === "all" ? tools : tools.filter((tool) => tool.category === filter);
  grid.innerHTML = visible.map((tool) => `
    <a class="tool-card" data-category="${tool.category}" href="${tool.href || '#'}" ${tool.href ? '' : 'aria-label="' + tool.title + ' — em breve"'}>
      <div class="tool-top"><span class="tool-icon" aria-hidden="true">${tool.icon}</span><svg class="tool-arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M7 6h7v7" /></svg></div>
      <h3>${tool.title}</h3><p>${tool.description}</p>
    </a>`).join("");
}
renderTools();

// Keep the page fully usable if the animation CDN is unavailable.
const motionOff = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (window.gsap && window.ScrollToPlugin) {
  gsap.registerPlugin(ScrollToPlugin);
}
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    event.preventDefault();
    if (link.closest(".desktop-nav") && window.gsap && !motionOff) {
      gsap.fromTo(link, { y: 0 }, {
        y: -7,
        duration: 0.14,
        repeat: 1,
        yoyo: true,
        ease: "power1.out",
        clearProps: "transform",
      });
    }
    if (window.location.hash !== hash) history.pushState(null, "", hash);
    if (window.gsap && window.ScrollToPlugin && !motionOff) {
      gsap.killTweensOf(window);
      gsap.to(window, {
        duration: 1.05,
        scrollTo: { y: target, offsetY: 12, autoKill: true },
        ease: "power2.inOut",
      });
    } else {
      target.scrollIntoView({ behavior: motionOff ? "auto" : "smooth", block: "start" });
    }
  });
});
const footer = document.querySelector(".footer");
const popover = document.querySelector("#footer-popover");
const popoverTitle = document.querySelector("#footer-popover-title");
const popoverContent = document.querySelector("#footer-popover-content");
const popupTriggers = [...document.querySelectorAll(".footer-popup-trigger")];
const popupCopy = {
  faq: {
    title: "Perguntas frequentes",
    content: `<article><h3>Todas as ferramentas já estão funcionando?</h3><p>Sim. Todas as 9 ferramentas do catálogo estão ativas: Compressor, Conversor e Redimensionador de imagens, PDF para imagem, Unir e dividir PDF, Hospedagem de imagens, Gerador de QR Code, Encurtador de links e Sorteador.</p></article>
      <article><h3>Meus arquivos são enviados para algum servidor?</h3><p>Na maioria das ferramentas (imagens, PDFs, QR Code e Sorteador), tudo é processado localmente no seu navegador. Apenas a <strong>Hospedagem de imagens</strong> (até 500 KB, expiração máxima de 7 dias) e o <strong>Encurtador de links</strong> utilizam armazenamento/rede.</p></article>
      <article><h3>Posso hospedar o Canivete no meu computador?</h3><p>Sim. Temos um <a href="https://github.com/Kyouz2148/dockercanivetedigital" target="_blank" rel="noreferrer">repositório dedicado para Docker</a> com <code>Dockerfile</code> e <code>docker-compose.yml</code> e banco <strong>SQLite</strong> integrado (sem precisar configurar PostgreSQL), além de suporte opcional a <code>DATABASE_URL</code> com PostgreSQL.</p></article>
      <article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou enviar melhorias pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p><strong>Processamento local:</strong> Compressor, Conversor, Redimensionador, PDF para imagem, Unir e dividir PDF, Gerador de QR Code e Sorteador processam seus arquivos e dados direto no navegador, sem envio para servidores.</p>
      <p><strong>Hospedagem de imagens:</strong> ao enviar uma imagem (máx. 500 KB), ela é convertida para WebP compacto e armazenada no banco de dados configurado (PostgreSQL ou SQLite no Docker/local) somente pelo prazo escolhido — no máximo 7 dias — sendo removida automaticamente após expirar.</p>
      <p><strong>Encurtador de links:</strong> no modo ultra curto, o endereço informado é encaminhado ao provedor público (<code>is.gd</code>, com fallback para <code>v.gd</code> e <code>tinyurl.com</code>); no modo local (<code>/s/...</code>), salvamos apenas a URL de destino e o total de cliques, sem rastrear visitantes. O histórico exibido fica salvo apenas no seu navegador.</p>
      <p><strong>Preferências e recursos externos:</strong> o tema claro/escuro é salvo localmente via <code>localStorage</code>. Fontes (Google Fonts) e animações (GSAP / dotLottie) são carregadas de CDNs; o botão de apoio abre o Asaas em outra aba.</p>`,
  },
};
let activePopupTrigger = null;

function positionPopover(trigger) {
  if (!footer || !popover || !trigger) return;
  const footerRect = footer.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  const popupWidth = popover.offsetWidth;
  const left = Math.max(16, Math.min(
    triggerRect.left + triggerRect.width / 2 - footerRect.left - popupWidth / 2,
    footerRect.width - popupWidth - 16,
  ));
  popover.style.left = `${left}px`;
  popover.style.bottom = `${footerRect.bottom - triggerRect.top + 10}px`;
}

function closePopover(restoreFocus = true) {
  if (!popover || popover.hidden) return;
  const triggerToRestore = activePopupTrigger;
  const finishClose = () => {
    popover.hidden = true;
    popover.setAttribute("aria-hidden", "true");
    popover.style.removeProperty("transform");
    popupTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    activePopupTrigger = null;
    if (restoreFocus) triggerToRestore?.focus({ preventScroll: true });
  };
  if (window.gsap && !motionOff) {
    gsap.killTweensOf(popover);
    gsap.to(popover, { y: 28, scaleY: 0.03, opacity: 0, duration: 0.3, transformOrigin: "bottom center", ease: "power2.in", onComplete: finishClose });
  } else finishClose();
}

popupTriggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    if (activePopupTrigger === trigger && !popover.hidden) {
      closePopover();
      return;
    }
    const copy = popupCopy[trigger.dataset.popup];
    if (!copy || !popover) return;
    activePopupTrigger = trigger;
    popupTriggers.forEach((button) => button.setAttribute("aria-expanded", String(button === trigger)));
    popoverTitle.textContent = copy.title;
    popoverContent.innerHTML = copy.content;
    popover.hidden = false;
    popover.setAttribute("aria-hidden", "false");
    positionPopover(trigger);
    if (window.gsap && !motionOff) {
      gsap.killTweensOf(popover);
      gsap.fromTo(popover, { y: 18, scaleY: 0.06, opacity: 0, transformOrigin: "bottom center" }, {
        y: 0,
        scaleY: 1,
        opacity: 1,
        duration: 0.38,
        ease: "back.out(1.4)",
        clearProps: "transform",
      });
    }
    popover.querySelector(".popover-close")?.focus({ preventScroll: true });
  });
});
popover?.querySelector(".popover-close")?.addEventListener("click", () => closePopover());
document.addEventListener("pointerdown", (event) => {
  if (!popover?.hidden && !popover.contains(event.target) && !event.target.closest(".footer-popup-trigger")) closePopover(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && popover && !popover.hidden) closePopover();
});
window.addEventListener("resize", () => {
  if (!popover?.hidden && activePopupTrigger) positionPopover(activePopupTrigger);
});

const suggestionDialog = document.querySelector("#suggestion-dialog");
const suggestionTrigger = document.querySelector(".suggestion-trigger");
const suggestionClose = suggestionDialog?.querySelector(".suggestion-close");
const suggestionModal = suggestionDialog?.querySelector(".suggestion-modal");
function animateSuggestionClose() {
  if (!suggestionDialog?.open) return;
  if (!window.gsap || motionOff || !suggestionModal || !suggestionTrigger) {
    suggestionDialog.close();
    return;
  }
  const modalRect = suggestionModal.getBoundingClientRect();
  const triggerRect = suggestionTrigger.getBoundingClientRect();
  const x = triggerRect.left + triggerRect.width / 2 - (modalRect.left + modalRect.width / 2);
  const y = triggerRect.top + triggerRect.height / 2 - (modalRect.top + modalRect.height / 2);
  gsap.killTweensOf(suggestionModal);
  gsap.to(suggestionModal, {
    x, y, scale: 0.08, opacity: 0, duration: 0.42, ease: "power2.in",
    onComplete: () => {
      suggestionModal.style.transform = "";
      suggestionModal.style.opacity = "";
      suggestionDialog.close();
    },
  });
}
suggestionTrigger?.addEventListener("click", () => {
  if (!suggestionDialog || suggestionDialog.open) return;
  suggestionDialog.showModal();
  if (window.gsap && !motionOff) {
    const modalRect = suggestionModal.getBoundingClientRect();
    const triggerRect = suggestionTrigger.getBoundingClientRect();
    const x = triggerRect.left + triggerRect.width / 2 - (modalRect.left + modalRect.width / 2);
    const y = triggerRect.top + triggerRect.height / 2 - (modalRect.top + modalRect.height / 2);
    gsap.fromTo(suggestionModal,
      { x, y, scale: 0.08, opacity: 0 },
      { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.45)", clearProps: "transform,opacity" });
  }
  suggestionClose?.focus({ preventScroll: true });
});
suggestionClose?.addEventListener("click", animateSuggestionClose);
suggestionDialog?.addEventListener("click", (event) => {
  if (event.target === suggestionDialog) animateSuggestionClose();
});
suggestionDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  animateSuggestionClose();
});
suggestionDialog?.addEventListener("close", () => suggestionTrigger?.focus({ preventScroll: true }));

if (window.gsap && !motionOff) {
  const heroArt = document.querySelector(".hero-art");
  if (heroArt && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    heroArt.addEventListener("pointerenter", () => {
      gsap.killTweensOf(heroArt);
      heroArt.style.zIndex = "20";
      gsap.to(heroArt, { scale: 1.24, duration: 0.5, ease: "power3.out", transformOrigin: "center center" });
    });
    heroArt.addEventListener("pointerleave", () => {
      gsap.killTweensOf(heroArt);
      gsap.to(heroArt, {
        scale: 1,
        duration: 0.55,
        ease: "power2.inOut",
        onComplete: () => { heroArt.style.zIndex = ""; },
      });
    });
  }

  document.querySelectorAll(".primary-button, .github-link, .filter, .text-link, .donate-link, .theme-toggle, .footer-popup-trigger, .popover-close, .suggestion-trigger, .suggestion-close, .suggestion-email").forEach((button) => {
    button.addEventListener("pointerenter", () => {
      gsap.to(button, { y: -2, scale: 1.035, duration: 0.22, ease: "power2.out" });
    });
    button.addEventListener("pointerleave", () => {
      gsap.to(button, { y: 0, scale: 1, duration: 0.32, ease: "back.out(2)" });
    });
    button.addEventListener("pointerdown", () => {
      gsap.to(button, { scale: 0.96, duration: 0.1, ease: "power1.out" });
    });
    button.addEventListener("pointerup", () => {
      gsap.to(button, { scale: 1.035, duration: 0.2, ease: "back.out(2)" });
    });
  });
}

let toolCardAnimations = [];
function clearToolCardAnimations() {
  toolCardAnimations.forEach(({ tween, trigger }) => {
    trigger?.kill();
    tween?.kill();
  });
  toolCardAnimations = [];
}

function getRandomCardOrigin(index, total) {
  const maxX = Math.min(260, Math.max(110, window.innerWidth * 0.28));
  const maxY = 170;
  const baseAngle = ((index + Math.random()) / Math.max(total, 1)) * Math.PI * 2 + Math.random() * Math.PI;
  const distanceFactor = 0.65 + Math.random() * 0.55;
  return {
    x: Math.round(Math.cos(baseAngle) * maxX * distanceFactor),
    y: Math.round(Math.sin(baseAngle) * maxY * distanceFactor),
    rotation: Math.round((Math.random() - 0.5) * 20),
    scale: Number((0.76 + Math.random() * 0.14).toFixed(2)),
    opacity: 0,
  };
}

function revealToolOptionsOnScroll(immediate = false) {
  clearToolCardAnimations();
  if (!window.gsap || motionOff) return;
  const cards = gsap.utils.toArray("#tool-grid .tool-card");
  if (!cards.length) return;

  if (immediate || !window.ScrollTrigger) {
    cards.forEach((card, index) => {
      const origin = getRandomCardOrigin(index, cards.length);
      card.classList.add("is-scroll-animating");
      const tween = gsap.fromTo(card, origin, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        duration: 0.6,
        delay: Math.random() * 0.22,
        ease: "power3.out",
        clearProps: "transform,opacity",
        onComplete: () => card.classList.remove("is-scroll-animating"),
      });
      toolCardAnimations.push({ tween });
    });
    return;
  }

  cards.forEach((card, index) => {
    const origin = getRandomCardOrigin(index, cards.length);
    const startPct = Math.round(92 + Math.random() * 7);
    const endPct = Math.round(64 + Math.random() * 10);
    card.classList.add("is-scroll-animating");
    const tween = gsap.fromTo(card, origin, {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      opacity: 1,
      ease: "power2.out",
      scrollTrigger: {
        trigger: grid,
        start: () => `top+=${card.offsetTop} ${startPct}%`,
        end: () => `top+=${card.offsetTop} ${endPct}%`,
        scrub: 0.65,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (self.progress >= 0.999) {
            card.classList.remove("is-scroll-animating");
            card.style.removeProperty("transform");
          } else {
            card.classList.add("is-scroll-animating");
          }
        },
      },
    });
    toolCardAnimations.push({ tween, trigger: tween.scrollTrigger });
  });
  ScrollTrigger.refresh();
}

if (window.gsap && window.ScrollTrigger && !motionOff) {
  gsap.registerPlugin(ScrollTrigger);
  revealToolOptionsOnScroll();
  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });

  document.querySelectorAll(".topbar .brand-name").forEach((word) => {
    word.innerHTML = [...word.textContent].map((letter) => `<span class="brand-letter" aria-hidden="true">${letter}</span>`).join("");
  });
  const brandLetters = gsap.utils.toArray(".topbar .brand-letter");
  if (brandLetters.length) {
    gsap.timeline({ repeat: -1, repeatDelay: 1.15, delay: 0.45 })
      .to(brandLetters, { y: -4, duration: 0.22, stagger: 0.065, ease: "sine.out" })
      .to(brandLetters, { y: 0, duration: 0.25, stagger: { each: 0.06, from: "end" }, ease: "sine.inOut" }, "<0.03");
  }

  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  intro
    .from(".topbar", { y: -18, opacity: 0, duration: 0.55 })
    .from(".hero-copy > *", { y: 22, opacity: 0, duration: 0.65, stagger: 0.1 }, "-=0.25")
    .from(".toolkit", { scale: 0.8, rotation: -5, opacity: 0, duration: 0.8 }, "-=0.55")
    .from(".art-card", { y: 18, scale: 0.75, opacity: 0, duration: 0.45, stagger: 0.1 }, "-=0.4")
    .from(".art-caption", { opacity: 0, x: 12, duration: 0.4 }, "-=0.2");

  gsap.to(".toolkit", {
    y: -8,
    duration: 2.4,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
  });
  gsap.to(".orbit-one", { rotation: 333, duration: 36, ease: "none", repeat: -1 });
  gsap.to(".orbit-two", { rotation: 396, duration: 45, ease: "none", repeat: -1 });

  gsap.from(".section-heading, .filters, .privacy-banner", {
    y: 24,
    opacity: 0,
    duration: 0.65,
    stagger: 0.12,
    ease: "power2.out",
    scrollTrigger: { trigger: ".tools-section", start: "top 78%", once: true },
  });
  gsap.from(".docker-header, .docker-pills, .docker-card, .docker-note", {
    y: 22,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: "power2.out",
    clearProps: "opacity,transform",
    scrollTrigger: { trigger: ".docker-section", start: "top 82%", once: true },
  });
  gsap.from(".about > *", {
    y: 22,
    opacity: 0,
    duration: 0.6,
    stagger: 0.12,
    ease: "power2.out",
    scrollTrigger: { trigger: ".about", start: "top 82%", once: true },
  });
  gsap.from(".about-phrase span", {
    y: 18,
    scale: 0.92,
    opacity: 0,
    duration: 0.55,
    stagger: 0.16,
    ease: "back.out(1.7)",
    delay: 0.25,
    scrollTrigger: { trigger: ".about", start: "top 82%", once: true },
  });
  gsap.from(".footer-inner > *", {
    y: 12,
    opacity: 0,
    duration: 0.5,
    stagger: 0.1,
    ease: "power2.out",
    scrollTrigger: { trigger: ".footer", start: "top 95%", once: true },
  });
}

document.querySelectorAll(".docker-copy-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget || "");
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      button.textContent = "Copiado!";
      setTimeout(() => { button.textContent = "Copiar"; }, 1600);
    } catch {}
  });
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".filter.active")?.classList.remove("active");
    button.classList.add("active");
    renderTools(button.dataset.filter);
    if (window.gsap && !motionOff) {
      revealToolOptionsOnScroll(true);
      window.ScrollTrigger?.refresh();
    }
  });
});
grid.addEventListener("click", (event) => {
  const card = event.target.closest(".tool-card");
  if (card?.getAttribute("href") === "#") event.preventDefault();
});
