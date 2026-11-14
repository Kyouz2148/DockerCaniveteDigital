const fileInput = document.querySelector("#image-file");
const dropZone = document.querySelector("#drop-zone");
const controls = document.querySelector("#controls");
const result = document.querySelector("#result");
const quality = document.querySelector("#quality");
const format = document.querySelector("#output-format");
const compressButton = document.querySelector("#compress-button");
const errorMessage = document.querySelector("#error-message");
const maxSizeInput = document.querySelector("#max-size");
const targetSizeValue = document.querySelector("#target-size-value");
const targetSizeHint = document.querySelector("#target-size-hint");
let selectedFile = null;
let originalUrl = null;
let compressedUrl = null;
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

function updateTargetSize() {
  const percentage = Number(maxSizeInput.value);
  const targetBytes = selectedFile ? selectedFile.size * percentage / 100 : 0;
  targetSizeValue.textContent = selectedFile ? `Até ${formatSize(targetBytes)}` : `Até ${percentage}% do original`;
  targetSizeHint.textContent = selectedFile
    ? `Original: ${formatSize(selectedFile.size)}. Quanto menor o limite, maior pode ser a redução de qualidade e dimensões.`
    : "Escolha um arquivo para ver o tamanho estimado em KB ou MB.";
  document.querySelectorAll(".target-presets button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.target) === percentage);
  });
}
updateTargetSize();

function clearUrls() {
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  if (compressedUrl) URL.revokeObjectURL(compressedUrl);
  originalUrl = null;
  compressedUrl = null;
}

function chooseFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    errorMessage.textContent = "Selecione um arquivo de imagem válido.";
    errorMessage.hidden = false;
    return;
  }
  clearUrls();
  selectedFile = file;
  updateTargetSize();
  originalUrl = URL.createObjectURL(file);
  document.querySelector("#file-name").textContent = file.name;
  document.querySelector("#original-size").textContent = formatSize(file.size);
  errorMessage.hidden = true;
  dropZone.hidden = true;
  result.hidden = true;
  controls.hidden = false;
  animateFrom(controls.querySelector(".selected-file"));
  animateFrom(controls.querySelector(".settings-grid"), { to: { delay: 0.06 } });
  animateFrom(compressButton, { to: { delay: 0.12 } });
}

function reset() {
  clearUrls();
  selectedFile = null;
  updateTargetSize();
  fileInput.value = "";
  controls.hidden = true;
  result.hidden = true;
  dropZone.hidden = false;
  animateFrom(dropZone, { from: { scale: 0.97 } });
  errorMessage.hidden = true;
}

quality.addEventListener("input", () => {
  document.querySelector("#quality-value").textContent = `${quality.value}%`;
});
maxSizeInput.addEventListener("input", updateTargetSize);
maxSizeInput.addEventListener("change", () => animateFrom(targetSizeValue, { from: { scale: 0.96 }, to: { duration: 0.28 } }));
document.querySelectorAll(".target-presets button").forEach((button) => button.addEventListener("click", () => {
  maxSizeInput.value = button.dataset.target;
  updateTargetSize();
  animateFrom(targetSizeValue, { from: { scale: 0.94 }, to: { duration: 0.3 } });
}));
format.addEventListener("change", () => {
  const lossless = format.value === "image/png";
  quality.disabled = lossless;
  document.querySelector(".quality-field small").textContent = lossless
    ? "PNG é exportado sem perda; a qualidade não se aplica."
    : "Qualidade menor costuma gerar arquivos menores.";
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

compressButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  errorMessage.hidden = true;
  compressButton.disabled = true;
  compressButton.innerHTML = "Comprimindo…";
  try {
    const image = new Image();
    image.src = originalUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    let width = image.naturalWidth;
    let height = image.naturalHeight;
    let currentQuality = Number(quality.value) / 100;
    const targetBytes = selectedFile.size * Number(maxSizeInput.value) / 100;
    if (!Number.isFinite(targetBytes) || targetBytes <= 0) throw new Error("Informe um tamanho máximo válido.");
    let blob = null;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    for (let attempt = 0; attempt < 50; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      if (format.value === "image/jpeg") {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
      } else {
        context.clearRect(0, 0, width, height);
      }
      context.drawImage(image, 0, 0, width, height);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, format.value, currentQuality));
      if (!blob) throw new Error("Este formato não é compatível com seu navegador.");
      if (blob.type !== format.value) throw new Error("Este formato não é compatível com seu navegador. Escolha WebP ou JPEG.");
      if (blob.size <= targetBytes) break;
      if (format.value !== "image/png" && currentQuality > 0.1) {
        currentQuality = Math.max(0.1, currentQuality - 0.1);
      } else if (width > 64 && height > 64) {
        width = Math.max(32, Math.round(width * 0.85));
        height = Math.max(32, Math.round(height * 0.85));
      } else break;
    }
    if (compressedUrl) URL.revokeObjectURL(compressedUrl);
    compressedUrl = URL.createObjectURL(blob);
    const extension = format.value === "image/jpeg" ? "jpg" : format.value.split("/")[1];
    const baseName = selectedFile.name.replace(/\.[^.]+$/, "") || "imagem";
    const savings = Math.max(0, Math.round((1 - blob.size / selectedFile.size) * 100));
    document.querySelector("#original-preview").src = originalUrl;
    document.querySelector("#compressed-preview").src = compressedUrl;
    document.querySelector("#original-caption").textContent = formatSize(selectedFile.size);
    document.querySelector("#compressed-caption").textContent = formatSize(blob.size);
    document.querySelector("#saved-badge").textContent = blob.size < selectedFile.size ? `-${savings}%` : "Qualidade mantida";
    document.querySelector("#result-note").textContent = blob.size <= targetBytes
      ? `Limite de ${formatSize(targetBytes)} alcançado. Dimensões finais: ${width} × ${height} px.`
      : `Não foi possível chegar a ${formatSize(targetBytes)} sem reduzir mais a imagem. Esta é a menor versão gerada: ${width} × ${height} px.`;
    const download = document.querySelector("#download-link");
    download.href = compressedUrl;
    download.download = `${baseName}-comprimida.${extension}`;
    controls.hidden = true;
    result.hidden = false;
    animateFrom(result.querySelector(".result-heading"));
    animateFrom(result.querySelector(".preview-grid"), { to: { delay: 0.08 } });
    animateFrom(result.querySelector(".download-button"), { from: { scale: 0.96 }, to: { delay: 0.15, duration: 0.4 } });
  } catch (error) {
    errorMessage.textContent = error.message || "Não foi possível comprimir esta imagem.";
    errorMessage.hidden = false;
    animateFrom(errorMessage, { from: { x: -6 }, to: { duration: 0.3 } });
  } finally {
    compressButton.disabled = false;
    compressButton.innerHTML = 'Comprimir imagem <span>→</span>';
  }
});

const archiveInput = document.querySelector("#archive-files");
const archiveControls = document.querySelector("#archive-controls");
const archiveButton = document.querySelector("#archive-button");
const archiveMessage = document.querySelector("#archive-message");
const archiveDownload = document.querySelector("#archive-download");
let archiveFiles = [];
let archiveUrl = null;

function updateArchiveFiles(files) {
  archiveFiles = [...files];
  archiveDownload.hidden = true;
  if (archiveUrl) URL.revokeObjectURL(archiveUrl);
  archiveUrl = null;
  if (!archiveFiles.length) {
    archiveControls.hidden = true;
    archiveInput.value = "";
    return;
  }
  const total = archiveFiles.reduce((sum, file) => sum + file.size, 0);
  document.querySelector("#archive-file-count").textContent = `${archiveFiles.length} ${archiveFiles.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}`;
  document.querySelector("#archive-total-size").textContent = `Tamanho total: ${formatSize(total)}`;
  archiveMessage.hidden = true;
  archiveControls.hidden = false;
  animateFrom(archiveControls.querySelector(".selected-file"));
  animateFrom(archiveControls.querySelector(".archive-settings"), { to: { delay: 0.06 } });
  animateFrom(archiveButton, { to: { delay: 0.12 } });
}

archiveInput.addEventListener("change", () => updateArchiveFiles(archiveInput.files));
document.querySelector("#archive-clear").addEventListener("click", () => updateArchiveFiles([]));
archiveButton.addEventListener("click", async () => {
  if (!archiveFiles.length) return;
  if (!window.fflate?.zipSync) {
    archiveMessage.textContent = "A biblioteca de ZIP não carregou. Verifique sua conexão e tente novamente.";
    archiveMessage.hidden = false;
    return;
  }
  archiveButton.disabled = true;
  archiveButton.innerHTML = "Compactando…";
  archiveMessage.hidden = true;
  try {
    const entries = Object.create(null);
    for (const file of archiveFiles) {
      let name = file.name || "arquivo";
      let duplicate = 2;
      while (Object.hasOwn(entries, name)) {
        const dot = name.lastIndexOf(".");
        name = dot > 0 ? `${name.slice(0, dot)} (${duplicate})${name.slice(dot)}` : `${name} (${duplicate})`;
        duplicate += 1;
      }
      entries[name] = new Uint8Array(await file.arrayBuffer());
    }
    const zipped = window.fflate.zipSync(entries, { level: Number(document.querySelector("#archive-level").value) });
    const blob = new Blob([zipped], { type: "application/zip" });
    archiveUrl = URL.createObjectURL(blob);
    archiveDownload.href = archiveUrl;
    archiveDownload.download = "arquivos-comprimidos.zip";
    archiveDownload.hidden = false;
    animateFrom(archiveDownload, { from: { scale: 0.96 } });
    const target = Number(document.querySelector("#archive-max-size").value) * 1024 * 1024;
    const reduction = Math.round((1 - blob.size / archiveFiles.reduce((sum, file) => sum + file.size, 0)) * 100);
    archiveMessage.textContent = blob.size <= target
      ? `ZIP pronto: ${formatSize(blob.size)} (${Math.max(0, reduction)}% menor). O limite desejado foi atendido.`
      : `ZIP pronto: ${formatSize(blob.size)}. O limite desejado de ${formatSize(target)} não foi atingido; todos os arquivos foram mantidos.`;
    archiveMessage.hidden = false;
    animateFrom(archiveMessage, { from: { y: 6 }, to: { duration: 0.3 } });
  } catch {
    archiveMessage.textContent = "Não foi possível compactar esses arquivos. Tente selecionar arquivos menores.";
    archiveMessage.hidden = false;
  } finally {
    archiveButton.disabled = false;
    archiveButton.innerHTML = 'Criar arquivo ZIP <span>→</span>';
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
    content: `<article><h3>Quais formatos posso comprimir?</h3><p>Você pode comprimir imagens (JPG, PNG, WebP, GIF, AVIF, SVG) e também arquivos ZIP ou múltiplos arquivos juntos diretamente no navegador.</p></article><article><h3>O que acontece com meus arquivos?</h3><p>O compressor processa imagens e arquivos localmente neste navegador. Nenhum arquivo é enviado para servidores externos.</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p>O compressor processa seus arquivos neste navegador. Nenhum arquivo é enviado para servidores do Canivete.</p><p>A preferência do tema fica salva apenas neste navegador, usando o armazenamento local do site.</p><p>Fontes, animações e a biblioteca usada para criar ZIP são carregadas de serviços externos. O botão de apoio abre o Asaas; nenhum pagamento acontece dentro desta página.</p>`,
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
