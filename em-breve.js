const pages = {
  conversor: { title: "Conversor de arquivos", description: "Troque formatos de imagens e documentos de forma simples.", icon: "⇄", category: "IMAGENS" },
  redimensionar: { title: "Redimensionar imagem", description: "Ajuste as dimensões em pixels ou porcentagem.", icon: "⤢", category: "IMAGENS" },
  "pdf-imagem": { title: "PDF para imagem", description: "Transforme páginas de PDF em imagens e imagens em PDF.", icon: "▤", category: "PDF" },
  "pdf-organizar": { title: "Unir e dividir PDF", description: "Organize páginas, divida arquivos e una documentos PDF.", icon: "▧", category: "PDF" },
  "hospedagem-imagens": { title: "Hospedagem de imagens", description: "Compartilhe imagens com links diretos.", icon: "↥", category: "UTILIDADES" },
  "qr-code": { title: "Gerador de QR Code", description: "Crie QR Codes para links, redes Wi-Fi e textos.", icon: "▦", category: "UTILIDADES" },
  encurtador: { title: "Encurtador de links", description: "Crie links curtos, limpos e fáceis de compartilhar.", icon: "⌁", category: "UTILIDADES" },
  sorteador: { title: "Sorteador", description: "Sorteie nomes ou números de forma rápida e aleatória.", icon: "🎲", category: "UTILIDADES" },
};

const params = new URLSearchParams(window.location.search);
const page = pages[params.get("tool")] || pages.conversor;
document.title = `${page.title} | Em breve — Canivete Digital`;
document.querySelector("#tool-title").textContent = page.title;
document.querySelector("#tool-description").textContent = page.description;
document.querySelector("#tool-icon").textContent = page.icon;
document.querySelector("#tool-category").textContent = page.category;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (window.gsap && !reduceMotion) {
  gsap.from(".topbar .brand, .desktop-nav a, .header-actions > *", { y: -9, opacity: 0, duration: 0.45, stagger: 0.06, ease: "power2.out", clearProps: "opacity,transform" });
  gsap.from(".coming-art", { y: 16, scale: 0.94, opacity: 0, duration: 0.65, ease: "back.out(1.5)" });
  gsap.from(".coming-badge, .coming-card > .eyebrow, .coming-card h1, .coming-card > p, .coming-message, .coming-card .primary-button", {
    y: 14, opacity: 0, duration: 0.5, stagger: 0.07, delay: 0.12, ease: "power2.out", clearProps: "opacity,transform",
  });
  gsap.to(".coming-orbit.orbit-a", { rotation: 340, duration: 24, repeat: -1, ease: "none" });
  gsap.to(".coming-orbit.orbit-b", { rotation: -312, duration: 28, repeat: -1, ease: "none" });
  gsap.to(".coming-icon", { y: -5, duration: 1.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(".coming-card", { y: -3, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.7 });
  gsap.to(".coming-message > span", { rotation: 360, duration: 2.4, repeat: -1, ease: "none", transformOrigin: "50% 50%" });
  gsap.from(".footer-inner > *", { y: 12, opacity: 0, duration: 0.45, stagger: 0.08, delay: 0.35, ease: "power2.out", clearProps: "opacity,transform" });

  const interactive = (target) => target instanceof Element ? target.closest("a, button") : null;
  document.addEventListener("pointerover", (event) => {
    const control = interactive(event.target);
    if (!control || control.contains(event.relatedTarget)) return;
    gsap.to(control, { y: -2, scale: 1.035, duration: 0.2, ease: "power2.out", overwrite: "auto" });
  });
  document.addEventListener("pointerout", (event) => {
    const control = interactive(event.target);
    if (!control || control.contains(event.relatedTarget)) return;
    gsap.to(control, { y: 0, scale: 1, duration: 0.22, ease: "power2.out", overwrite: "auto" });
  });
  document.addEventListener("focusin", (event) => {
    const control = interactive(event.target);
    if (control) gsap.to(control, { scale: 1.025, duration: 0.2, ease: "power2.out", overwrite: "auto" });
  });
  document.addEventListener("focusout", (event) => {
    const control = interactive(event.target);
    if (control) gsap.to(control, { scale: 1, duration: 0.2, ease: "power2.out", overwrite: "auto" });
  });
  document.addEventListener("pointerdown", (event) => {
    const control = interactive(event.target);
    if (control) gsap.to(control, { scale: 0.96, duration: 0.1, ease: "power1.out", overwrite: "auto" });
  });
  document.addEventListener("pointerup", (event) => {
    const control = interactive(event.target);
    if (control) gsap.to(control, { scale: 1.025, duration: 0.28, ease: "back.out(1.7)", overwrite: "auto" });
  });
}

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
  faq: { title: "Perguntas frequentes", content: `<article><h3>Quando esta ferramenta estará disponível?</h3><p>Estamos trabalhando nela. Volte em breve para acompanhar as novidades.</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>.</p></article>` },
  privacy: { title: "Privacidade", content: `<p>Esta página apresenta informações sobre uma ferramenta que ainda está em desenvolvimento e não processa nem recebe arquivos.</p><p>A preferência do tema fica salva apenas neste navegador, usando o armazenamento local do site.</p><p>Fontes e animações são carregadas de serviços externos. O botão de apoio abre o Asaas.</p>` },
};
let activeTrigger = null;

function closePopover() {
  const finish = () => {
    popover.hidden = true;
    popover.setAttribute("aria-hidden", "true");
    popover.style.removeProperty("transform");
    popupTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    activeTrigger = null;
  };
  if (window.gsap && !reduceMotion) gsap.to(popover, { y: 14, scaleY: 0.95, opacity: 0, duration: 0.2, transformOrigin: "bottom center", ease: "power2.in", onComplete: finish });
  else finish();
}

popupTriggers.forEach((trigger) => trigger.addEventListener("click", () => {
  if (activeTrigger === trigger && !popover.hidden) return closePopover();
  const copy = popupCopy[trigger.dataset.popup];
  if (!copy) return;
  activeTrigger = trigger;
  popupTriggers.forEach((button) => button.setAttribute("aria-expanded", String(button === trigger)));
  popoverTitle.textContent = copy.title;
  popoverContent.innerHTML = copy.content;
  popover.hidden = false;
  popover.setAttribute("aria-hidden", "false");
  const footerRect = footer.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  popover.style.left = `${Math.max(16, Math.min(triggerRect.left + triggerRect.width / 2 - footerRect.left - popover.offsetWidth / 2, footerRect.width - popover.offsetWidth - 16))}px`;
  popover.style.bottom = `${footerRect.bottom - triggerRect.top + 10}px`;
  if (window.gsap && !reduceMotion) gsap.fromTo(popover, { y: 16, scaleY: 0.92, opacity: 0 }, { y: 0, scaleY: 1, opacity: 1, duration: 0.35, transformOrigin: "bottom center", ease: "back.out(1.35)" });
}));

document.querySelector(".popover-close").addEventListener("click", closePopover);
document.addEventListener("click", (event) => {
  if (!popover.hidden && !popover.contains(event.target) && !event.target.closest(".footer-popup-trigger")) closePopover();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !popover.hidden) {
    const trigger = activeTrigger;
    closePopover();
    trigger?.focus({ preventScroll: true });
  }
});
