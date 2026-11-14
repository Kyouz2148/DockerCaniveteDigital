const fileInput = document.querySelector("#image-file");
const dropZone = document.querySelector("#drop-zone");
const controls = document.querySelector("#controls");
const result = document.querySelector("#result");
const errorMessage = document.querySelector("#error-message");
const widthInput = document.querySelector("#target-width");
const heightInput = document.querySelector("#target-height");
const lockRatioInput = document.querySelector("#lock-ratio");
const lockRatioWrap = document.querySelector("#lock-ratio-wrap");
const widthField = document.querySelector("#width-field");
const heightField = document.querySelector("#height-field");
const percentControl = document.querySelector("#percent-control");
const pixelPresetsWrap = document.querySelector("#pixel-presets-wrap");
const scalePercentInput = document.querySelector("#scale-percent");
const percentValue = document.querySelector("#percent-value");
const dimensionReadout = document.querySelector("#dimension-readout");
const outputFormatSelect = document.querySelector("#output-format");
const qualityInput = document.querySelector("#quality");
const qualityValue = document.querySelector("#quality-value");
const qualityHint = document.querySelector("#quality-hint");
const resizeButton = document.querySelector("#resize-button");

let selectedFile = null;
let originalUrl = null;
let resizedUrl = null;
let naturalWidth = 0;
let naturalHeight = 0;
let currentMode = "pixels";

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

function clearUrls() {
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  if (resizedUrl) URL.revokeObjectURL(resizedUrl);
  originalUrl = null;
  resizedUrl = null;
}

function getResolvedMime() {
  if (outputFormatSelect.value !== "auto") return outputFormatSelect.value;
  if (!selectedFile) return "image/png";
  if (selectedFile.type === "image/jpeg" || selectedFile.type === "image/webp" || selectedFile.type === "image/png") {
    return selectedFile.type;
  }
  return "image/png";
}

function updateQualityState() {
  const mime = getResolvedMime();
  const lossless = mime === "image/png";
  qualityInput.disabled = lossless;
  qualityHint.textContent = lossless
    ? "PNG é exportado sem perda; a qualidade não se aplica."
    : "Qualidade menor gera arquivos mais leves.";
}

function getTargetDimensions() {
  if (currentMode === "percent") {
    const scale = Number(scalePercentInput.value) / 100;
    return {
      width: Math.max(1, Math.round(naturalWidth * scale)),
      height: Math.max(1, Math.round(naturalHeight * scale)),
    };
  }
  return {
    width: Math.max(1, Math.round(Number(widthInput.value) || 0)),
    height: Math.max(1, Math.round(Number(heightInput.value) || 0)),
  };
}

function updateReadout() {
  if (!naturalWidth || !naturalHeight) return;
  const { width, height } = getTargetDimensions();
  dimensionReadout.textContent = `Saída: ${width} × ${height} px`;
  document.querySelectorAll("#pixel-presets button").forEach((button) => {
    button.classList.toggle("active", currentMode === "pixels" && Number(button.dataset.width) === Number(widthInput.value));
  });
  document.querySelectorAll("#percent-control .target-presets button").forEach((button) => {
    button.classList.toggle("active", currentMode === "percent" && Number(button.dataset.percent) === Number(scalePercentInput.value));
  });
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-switch button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  const isPixels = mode === "pixels";
  widthField.hidden = !isPixels;
  heightField.hidden = !isPixels;
  pixelPresetsWrap.hidden = !isPixels;
  lockRatioWrap.hidden = !isPixels;
  percentControl.hidden = isPixels;
  updateReadout();
}

async function chooseFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    errorMessage.textContent = "Selecione um arquivo de imagem válido.";
    errorMessage.hidden = false;
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
    naturalWidth = img.naturalWidth || 1;
    naturalHeight = img.naturalHeight || 1;
    widthInput.value = String(naturalWidth);
    heightInput.value = String(naturalHeight);
    scalePercentInput.value = "100";
    percentValue.textContent = "100%";
    document.querySelector("#file-name").textContent = file.name;
    document.querySelector("#original-meta").textContent = `${naturalWidth} × ${naturalHeight} px · ${formatSize(file.size)}`;
    updateQualityState();
    updateReadout();
    errorMessage.hidden = true;
    dropZone.hidden = true;
    result.hidden = true;
    controls.hidden = false;
    animateFrom(controls.querySelector(".selected-file"));
    animateFrom(controls.querySelector(".settings-grid"), { to: { delay: 0.06 } });
    animateFrom(resizeButton, { to: { delay: 0.12 } });
  } catch {
    URL.revokeObjectURL(nextUrl);
    errorMessage.textContent = "Não foi possível ler as dimensões dessa imagem.";
    errorMessage.hidden = false;
  }
}

function reset() {
  clearUrls();
  selectedFile = null;
  naturalWidth = 0;
  naturalHeight = 0;
  fileInput.value = "";
  controls.hidden = true;
  result.hidden = true;
  dropZone.hidden = false;
  errorMessage.hidden = true;
  animateFrom(dropZone, { from: { scale: 0.97 } });
}

document.querySelectorAll(".mode-switch button").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

widthInput.addEventListener("input", () => {
  const val = Number(widthInput.value);
  if (lockRatioInput.checked && naturalWidth && val > 0) {
    heightInput.value = String(Math.max(1, Math.round((val * naturalHeight) / naturalWidth)));
  }
  updateReadout();
});

heightInput.addEventListener("input", () => {
  const val = Number(heightInput.value);
  if (lockRatioInput.checked && naturalHeight && val > 0) {
    widthInput.value = String(Math.max(1, Math.round((val * naturalWidth) / naturalHeight)));
  }
  updateReadout();
});

lockRatioInput.addEventListener("change", () => {
  const val = Number(widthInput.value);
  if (lockRatioInput.checked && naturalWidth && val > 0) {
    heightInput.value = String(Math.max(1, Math.round((val * naturalHeight) / naturalWidth)));
  }
  updateReadout();
});

document.querySelectorAll("#pixel-presets button").forEach((button) => {
  button.addEventListener("click", () => {
    const w = Number(button.dataset.width);
    widthInput.value = String(w);
    if (lockRatioInput.checked && naturalWidth) {
      heightInput.value = String(Math.max(1, Math.round((w * naturalHeight) / naturalWidth)));
    }
    updateReadout();
  });
});

scalePercentInput.addEventListener("input", () => {
  percentValue.textContent = `${scalePercentInput.value}%`;
  updateReadout();
});

document.querySelectorAll("#percent-control .target-presets button").forEach((button) => {
  button.addEventListener("click", () => {
    scalePercentInput.value = button.dataset.percent;
    percentValue.textContent = `${button.dataset.percent}%`;
    updateReadout();
  });
});

outputFormatSelect.addEventListener("change", updateQualityState);
qualityInput.addEventListener("input", () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

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

resizeButton.addEventListener("click", async () => {
  if (!selectedFile || !originalUrl) return;
  const { width, height } = getTargetDimensions();
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 10000 || height > 10000) {
    errorMessage.textContent = "Informe dimensões válidas entre 1 e 10000 pixels.";
    errorMessage.hidden = false;
    return;
  }
  errorMessage.hidden = true;
  resizeButton.disabled = true;
  resizeButton.innerHTML = "Redimensionando…";
  try {
    const image = new Image();
    image.src = originalUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");

    const mime = getResolvedMime();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (mime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    } else {
      context.clearRect(0, 0, width, height);
    }
    context.drawImage(image, 0, 0, width, height);

    const quality = Number(qualityInput.value) / 100;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) throw new Error("Não foi possível gerar a imagem redimensionada.");

    if (resizedUrl) URL.revokeObjectURL(resizedUrl);
    resizedUrl = URL.createObjectURL(blob);

    const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const baseName = selectedFile.name.replace(/\.[^.]+$/, "") || "imagem";

    document.querySelector("#original-preview").src = originalUrl;
    document.querySelector("#resized-preview").src = resizedUrl;
    document.querySelector("#original-caption").textContent = `${naturalWidth}×${naturalHeight} · ${formatSize(selectedFile.size)}`;
    document.querySelector("#resized-caption").textContent = `${width}×${height} · ${formatSize(blob.size)}`;
    document.querySelector("#result-badge").textContent = `${width} × ${height} px`;
    document.querySelector("#result-note").textContent = `Redimensionada de ${naturalWidth} × ${naturalHeight} px para ${width} × ${height} px (${extension.toUpperCase()}).`;

    const download = document.querySelector("#download-link");
    download.href = resizedUrl;
    download.download = `${baseName}-${width}x${height}.${extension}`;

    controls.hidden = true;
    result.hidden = false;
    animateFrom(result.querySelector(".result-heading"));
    animateFrom(result.querySelector(".preview-grid"), { to: { delay: 0.08 } });
    animateFrom(result.querySelector(".result-actions"), { from: { scale: 0.96 }, to: { delay: 0.15, duration: 0.4 } });
  } catch (error) {
    errorMessage.textContent = error.message || "Não foi possível redimensionar esta imagem.";
    errorMessage.hidden = false;
    animateFrom(errorMessage, { from: { x: -6 }, to: { duration: 0.3 } });
  } finally {
    resizeButton.disabled = false;
    resizeButton.innerHTML = 'Redimensionar imagem <span>→</span>';
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
    content: `<article><h3>O que acontece com minhas imagens?</h3><p>O redimensionamento acontece localmente neste navegador. Nenhum arquivo é enviado para servidores externos.</p></article><article><h3>Qual modo devo escolher?</h3><p>Use pixels para medidas exatas (como 1080 px) ou porcentagem para reduzir proporcionalmente (como 50%).</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p>O redimensionador processa suas imagens localmente neste navegador. Os arquivos não são enviados para o Canivete.</p><p>A preferência do tema fica salva apenas neste navegador, usando o armazenamento local do site.</p><p>Fontes e animações são carregadas de serviços externos. O botão de apoio abre o Asaas; nenhum pagamento acontece dentro desta página.</p>`,
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
