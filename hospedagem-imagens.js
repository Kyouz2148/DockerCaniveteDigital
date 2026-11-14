const MAX_IMAGE_BYTES = 500 * 1024;
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
]);

const fileInput = document.querySelector("#image-file");
const dropZone = document.querySelector("#drop-zone");
const controls = document.querySelector("#controls");
const result = document.querySelector("#result");
const errorMessage = document.querySelector("#error-message");
const dropError = document.querySelector("#drop-error");
const ttlSelect = document.querySelector("#ttl-select");
const uploadButton = document.querySelector("#upload-button");
const hostedUrlInput = document.querySelector("#hosted-url");
const copyLinkButton = document.querySelector("#copy-link");
const deleteNowButton = document.querySelector("#delete-now");
const resultStatus = document.querySelector("#result-status");

let selectedFile = null;
let originalUrl = null;
let lastHostedInfo = null;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animateFrom(element, vars = {}) {
  if (!element || !window.gsap || reduceMotion) return;
  gsap.fromTo(element, { y: 12, opacity: 0, ...vars.from }, {
    y: 0,
    opacity: 1,
    duration: 0.45,
    ease: "power2.out",
    clearProps: "opacity,transform",
    ...vars.to,
  });
}

if (window.gsap && !reduceMotion) {
  gsap.from(".compressor-page > .back-link, .compressor-page > .eyebrow, .compressor-page > h1, .compressor-page > .page-intro", {
    y: 14, opacity: 0, duration: 0.55, stagger: 0.07, ease: "power2.out",
  });
  gsap.from(".compressor-panel", { y: 20, opacity: 0, duration: 0.6, stagger: 0.12, delay: 0.25, ease: "power2.out", clearProps: "opacity,transform" });
  gsap.from(".drop-zone", { scale: 0.96, opacity: 0, duration: 0.55, delay: 0.42, ease: "back.out(1.4)", clearProps: "opacity,transform" });
  gsap.from(".footer-inner > *", { y: 12, opacity: 0, duration: 0.45, stagger: 0.08, delay: 0.45, ease: "power2.out", clearProps: "opacity,transform" });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showDropError(message) {
  dropError.textContent = message;
  dropError.hidden = false;
  animateFrom(dropError, { from: { x: -6 }, to: { duration: 0.3 } });
}

function clearUrls() {
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  originalUrl = null;
}

async function chooseFile(file) {
  if (!file) return;
  dropError.hidden = true;
  errorMessage.hidden = true;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    showDropError("Envie apenas arquivos de imagem válidos (JPG, PNG, WebP, GIF, AVIF ou BMP).");
    fileInput.value = "";
    return;
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    showDropError(`Esta imagem tem ${formatSize(file.size)}. O tamanho máximo permitido é 500 KB.`);
    fileInput.value = "";
    return;
  }

  const nextUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = nextUrl;
    await img.decode();
    clearUrls();
    selectedFile = file;
    originalUrl = nextUrl;
    document.querySelector("#file-name").textContent = file.name;
    document.querySelector("#original-meta").textContent = `${img.naturalWidth} × ${img.naturalHeight} px · ${formatSize(file.size)}`;
    dropZone.hidden = true;
    result.hidden = true;
    controls.hidden = false;
    animateFrom(controls.querySelector(".selected-file"));
    animateFrom(controls.querySelector(".settings-grid"), { to: { delay: 0.06 } });
    animateFrom(uploadButton, { to: { delay: 0.12 } });
  } catch {
    URL.revokeObjectURL(nextUrl);
    showDropError("Não foi possível ler este arquivo como uma imagem válida.");
    fileInput.value = "";
  }
}

function reset() {
  clearUrls();
  selectedFile = null;
  lastHostedInfo = null;
  fileInput.value = "";
  controls.hidden = true;
  result.hidden = true;
  dropZone.hidden = false;
  dropError.hidden = true;
  errorMessage.hidden = true;
  resultStatus.hidden = true;
  animateFrom(dropZone, { from: { scale: 0.97 } });
}

async function prepareCompactUploadBlob(file) {
  if (file.type === "image/gif") {
    return file;
  }
  const imgUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imgUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 1;
    canvas.height = image.naturalHeight || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const webpBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.72));
    if (webpBlob && webpBlob.type === "image/webp" && webpBlob.size < file.size && webpBlob.size <= MAX_IMAGE_BYTES) {
      return webpBlob;
    }
    return file;
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

fileInput.addEventListener("change", () => chooseFile(fileInput.files[0]));
document.querySelector("#remove-file").addEventListener("click", reset);
document.querySelector("#start-over").addEventListener("click", reset);
dropZone.addEventListener("dragover", (event) => { event.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
  chooseFile(event.dataTransfer.files[0]);
});

uploadButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  const ttlSeconds = Math.min(MAX_TTL_SECONDS, Math.max(60, Number(ttlSelect.value) || MAX_TTL_SECONDS));
  errorMessage.hidden = true;
  uploadButton.disabled = true;
  uploadButton.innerHTML = "Otimizando e hospedando…";

  try {
    const payloadBlob = await prepareCompactUploadBlob(selectedFile);
    if (payloadBlob.size > MAX_IMAGE_BYTES) {
      throw new Error("A imagem excede o limite máximo de 500 KB.");
    }

    const response = await fetch("/api/images", {
      method: "POST",
      headers: {
        "Content-Type": payloadBlob.type || selectedFile.type,
        "X-File-Name": encodeURIComponent(selectedFile.name),
        "X-TTL-Seconds": String(ttlSeconds),
        "X-Original-Bytes": String(selectedFile.size),
      },
      body: payloadBlob,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Não foi possível hospedar a imagem.");
    }

    lastHostedInfo = data;
    const absoluteUrl = `${window.location.origin}${data.url}`;
    const savings = Math.max(0, Math.round((1 - data.storedBytes / data.originalBytes) * 100));
    const expiresFormatted = new Date(data.expiresAt).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

    document.querySelector("#original-preview").src = originalUrl;
    document.querySelector("#hosted-preview").src = data.url;
    document.querySelector("#original-caption").textContent = formatSize(data.originalBytes);
    document.querySelector("#hosted-caption").textContent = formatSize(data.storedBytes);
    document.querySelector("#saved-badge").textContent = data.storedBytes < data.originalBytes ? `-${savings}% no banco` : "Otimizada (WebP)";
    document.querySelector("#result-note").textContent = `Salva como WebP (${data.width} × ${data.height} px) ocupando ${formatSize(data.storedBytes)}. Será excluída automaticamente em ${expiresFormatted}.`;
    hostedUrlInput.value = absoluteUrl;
    document.querySelector("#open-link").href = data.url;
    deleteNowButton.hidden = !data.deleteToken;
    resultStatus.hidden = true;

    controls.hidden = true;
    result.hidden = false;
    animateFrom(result.querySelector(".result-heading"));
    animateFrom(result.querySelector(".preview-grid"), { to: { delay: 0.08 } });
    animateFrom(result.querySelector(".share-link-box"), { to: { delay: 0.14 } });
  } catch (error) {
    errorMessage.textContent = error.message || "Falha ao hospedar a imagem.";
    errorMessage.hidden = false;
    animateFrom(errorMessage, { from: { x: -6 }, to: { duration: 0.3 } });
  } finally {
    uploadButton.disabled = false;
    uploadButton.innerHTML = 'Hospedar imagem <span>→</span>';
  }
});

copyLinkButton.addEventListener("click", async () => {
  if (!hostedUrlInput.value) return;
  try {
    await navigator.clipboard.writeText(hostedUrlInput.value);
    copyLinkButton.textContent = "Copiado!";
    setTimeout(() => { copyLinkButton.textContent = "Copiar link"; }, 1800);
  } catch {
    hostedUrlInput.select();
  }
});

deleteNowButton.addEventListener("click", async () => {
  if (!lastHostedInfo?.id || !lastHostedInfo?.deleteToken) return;
  deleteNowButton.disabled = true;
  try {
    const response = await fetch(`/api/images/${encodeURIComponent(lastHostedInfo.id)}`, {
      method: "DELETE",
      headers: { "X-Delete-Token": lastHostedInfo.deleteToken },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível excluir a imagem.");
    resultStatus.textContent = "Imagem excluída permanentemente do banco de dados.";
    resultStatus.hidden = false;
    deleteNowButton.hidden = true;
    hostedUrlInput.value = "";
  } catch (error) {
    resultStatus.textContent = error.message;
    resultStatus.hidden = false;
  } finally {
    deleteNowButton.disabled = false;
  }
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
    content: `<article><h3>Qual o tamanho máximo?</h3><p>São aceitas apenas imagens de até 500 KB, convertidas para WebP compacto antes de serem salvas.</p></article><article><h3>Por quanto tempo a imagem fica disponível?</h3><p>Você pode escolher de 1 hora até no máximo 7 dias. Depois disso, ela é removida automaticamente do banco de dados.</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p>As imagens enviadas ficam armazenadas temporariamente em formato WebP otimizado apenas pelo prazo escolhido (no máximo 7 dias) e são excluídas automaticamente ao expirar.</p><p>A preferência do tema fica salva apenas neste navegador.</p>`,
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
