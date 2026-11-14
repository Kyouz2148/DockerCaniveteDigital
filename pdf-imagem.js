if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/pdf.worker.min.js";
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (window.gsap && !reduceMotion) {
  gsap.from(".compressor-page > .back-link, .compressor-page > .eyebrow, .compressor-page > h1, .compressor-page > .page-intro", {
    y: 14, opacity: 0, duration: 0.55, stagger: 0.07, ease: "power2.out",
  });
  gsap.from(".compressor-panel", { y: 20, opacity: 0, duration: 0.6, delay: 0.22, ease: "power2.out", clearProps: "opacity,transform" });
  gsap.from(".footer-inner > *", { y: 12, opacity: 0, duration: 0.45, stagger: 0.08, delay: 0.45, ease: "power2.out", clearProps: "opacity,transform" });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function parsePageRange(input, totalPages) {
  const raw = String(input || "").trim();
  if (!raw) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set();
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < 1 || start > totalPages || end > totalPages || start > end) {
        throw new Error(`Intervalo "${token}" inválido. O PDF possui ${totalPages} ${totalPages === 1 ? "página" : "páginas"}.`);
      }
      for (let p = start; p <= end; p += 1) pages.add(p);
    } else if (/^\d+$/.test(token)) {
      const p = Number(token);
      if (p < 1 || p > totalPages) {
        throw new Error(`Página ${p} não existe. O PDF possui ${totalPages} ${totalPages === 1 ? "página" : "páginas"}.`);
      }
      pages.add(p);
    } else {
      throw new Error(`Trecho "${token}" inválido. Use números ou intervalos como 1-3, 5.`);
    }
  }
  if (!pages.size) throw new Error("Nenhuma página selecionada.");
  return [...pages].sort((a, b) => a - b);
}

const modeButtons = [...document.querySelectorAll(".mode-switch button")];
const pdfToImgSection = document.querySelector("#pdf-to-img-section");
const imgToPdfSection = document.querySelector("#img-to-pdf-section");

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
    pdfToImgSection.hidden = mode !== "pdf-to-img";
    imgToPdfSection.hidden = mode !== "img-to-pdf";
  });
});

// ========================
// MODO 1: PDF -> IMAGENS
// ========================
const pdfDropZone = document.querySelector("#pdf-drop-zone");
const pdfInput = document.querySelector("#pdf-input");
const pdfControls = document.querySelector("#pdf-controls");
const pdfFileName = document.querySelector("#pdf-file-name");
const pdfFileMeta = document.querySelector("#pdf-file-meta");
const imgFormatSelect = document.querySelector("#img-format");
const pdfScaleSelect = document.querySelector("#pdf-scale");
const pdfPagesRangeInput = document.querySelector("#pdf-pages-range");
const pdfImgQualityInput = document.querySelector("#pdf-img-quality");
const pdfImgQualityValue = document.querySelector("#pdf-img-quality-value");
const renderPagesButton = document.querySelector("#render-pages-button");
const pdfError = document.querySelector("#pdf-error");
const pdfResult = document.querySelector("#pdf-result");
const pdfResultTitle = document.querySelector("#pdf-result-title");
const pdfResultBadge = document.querySelector("#pdf-result-badge");
const downloadAllZipButton = document.querySelector("#download-all-zip");
const renderedPagesGrid = document.querySelector("#rendered-pages-grid");

let activePdfDoc = null;
let activePdfFile = null;
let renderedOutputs = [];

function clearRenderedOutputs() {
  for (const item of renderedOutputs) {
    URL.revokeObjectURL(item.url);
  }
  renderedOutputs = [];
  renderedPagesGrid.innerHTML = "";
}

function updateQualityState() {
  const isPng = imgFormatSelect.value === "image/png";
  pdfImgQualityInput.disabled = isPng;
  pdfImgQualityValue.textContent = isPng ? "Sem perda" : `${pdfImgQualityInput.value}%`;
}
imgFormatSelect.addEventListener("change", updateQualityState);
pdfImgQualityInput.addEventListener("input", updateQualityState);
updateQualityState();

async function loadPdfFile(file) {
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    pdfError.textContent = "Por favor, selecione um arquivo PDF válido.";
    pdfError.hidden = false;
    return;
  }
  pdfError.hidden = true;
  clearRenderedOutputs();
  pdfResult.hidden = true;

  try {
    if (activePdfDoc) {
      await activePdfDoc.destroy();
      activePdfDoc = null;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    activePdfDoc = await loadingTask.promise;
    activePdfFile = file;
    pdfFileName.textContent = file.name;
    pdfFileMeta.textContent = `${activePdfDoc.numPages} ${activePdfDoc.numPages === 1 ? "página" : "páginas"} • ${formatSize(file.size)}`;
    pdfDropZone.hidden = true;
    pdfControls.hidden = false;
  } catch (error) {
    const isPassword = error?.name === "PasswordException" || /password/i.test(error?.message || "");
    pdfError.textContent = isPassword
      ? "Este PDF está protegido por senha. Remova a senha antes de converter."
      : "Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.";
    pdfControls.hidden = false;
    pdfError.hidden = false;
  }
}

function resetPdfToImg() {
  clearRenderedOutputs();
  if (activePdfDoc) {
    activePdfDoc.destroy().catch(() => {});
    activePdfDoc = null;
  }
  activePdfFile = null;
  pdfInput.value = "";
  pdfPagesRangeInput.value = "";
  pdfError.hidden = true;
  pdfResult.hidden = true;
  pdfControls.hidden = true;
  pdfDropZone.hidden = false;
}

pdfInput.addEventListener("change", () => loadPdfFile(pdfInput.files?.[0]));
["dragenter", "dragover"].forEach((ev) => {
  pdfDropZone.addEventListener(ev, (e) => { e.preventDefault(); pdfDropZone.classList.add("dragover"); });
});
["dragleave", "drop"].forEach((ev) => {
  pdfDropZone.addEventListener(ev, (e) => { e.preventDefault(); pdfDropZone.classList.remove("dragover"); });
});
pdfDropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) loadPdfFile(file);
});
document.querySelector("#change-pdf").addEventListener("click", resetPdfToImg);
document.querySelector("#reset-pdf").addEventListener("click", resetPdfToImg);

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Falha ao gerar imagem da página."));
      else resolve(blob);
    }, mime, quality);
  });
}

renderPagesButton.addEventListener("click", async () => {
  if (!activePdfDoc || !activePdfFile) return;
  pdfError.hidden = true;
  clearRenderedOutputs();

  let targetPages;
  try {
    targetPages = parsePageRange(pdfPagesRangeInput.value, activePdfDoc.numPages);
  } catch (err) {
    pdfError.textContent = err.message;
    pdfError.hidden = false;
    return;
  }

  const mime = imgFormatSelect.value;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const scale = Number(pdfScaleSelect.value) || 2;
  const quality = Number(pdfImgQualityInput.value) / 100;
  const baseName = activePdfFile.name.replace(/\.pdf$/i, "");

  renderPagesButton.disabled = true;
  pdfResult.hidden = false;
  downloadAllZipButton.hidden = true;

  let totalBytes = 0;
  try {
    for (let idx = 0; idx < targetPages.length; idx += 1) {
      const pageNum = targetPages[idx];
      renderPagesButton.textContent = `Convertendo página ${idx + 1} de ${targetPages.length}…`;

      const page = await activePdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvasToBlob(canvas, mime, quality);
      const url = URL.createObjectURL(blob);
      const fileName = `${baseName}-pagina-${String(pageNum).padStart(2, "0")}.${ext}`;
      totalBytes += blob.size;

      const outputEntry = { pageNum, fileName, blob, url, width: canvas.width, height: canvas.height };
      renderedOutputs.push(outputEntry);

      const card = document.createElement("div");
      card.className = "pdf-page-card";

      const thumbWrap = document.createElement("div");
      thumbWrap.className = "pdf-page-thumb-wrap";
      const img = document.createElement("img");
      img.src = url;
      img.alt = `Página ${pageNum}`;
      thumbWrap.appendChild(img);

      const meta = document.createElement("div");
      meta.className = "pdf-page-meta";
      meta.innerHTML = `<strong>Pág. ${pageNum}</strong><span>${formatSize(blob.size)}</span>`;

      const dlBtn = document.createElement("a");
      dlBtn.className = "copy-button";
      dlBtn.style.textAlign = "center";
      dlBtn.href = url;
      dlBtn.download = fileName;
      dlBtn.textContent = `Baixar .${ext}`;

      card.append(thumbWrap, meta, dlBtn);
      renderedPagesGrid.appendChild(card);
      page.cleanup();
    }

    pdfResultTitle.textContent = targetPages.length === 1
      ? "1 página convertida"
      : `${targetPages.length} páginas convertidas`;
    pdfResultBadge.textContent = `${ext.toUpperCase()} • ${formatSize(totalBytes)}`;
    downloadAllZipButton.hidden = targetPages.length < 2;
  } catch (err) {
    pdfError.textContent = err.message || "Falha ao renderizar páginas do PDF.";
    pdfError.hidden = false;
  } finally {
    renderPagesButton.disabled = false;
    renderPagesButton.innerHTML = 'Converter páginas em imagem <span>→</span>';
  }
});

downloadAllZipButton.addEventListener("click", async () => {
  if (!renderedOutputs.length || !window.fflate) return;
  downloadAllZipButton.disabled = true;
  downloadAllZipButton.textContent = "Compactando .zip…";
  try {
    const entries = {};
    for (const item of renderedOutputs) {
      entries[item.fileName] = new Uint8Array(await item.blob.arrayBuffer());
    }
    const zipped = fflate.zipSync(entries, { level: 0 });
    const zipBlob = new Blob([zipped], { type: "application/zip" });
    const zipUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    const baseName = (activePdfFile?.name || "paginas").replace(/\.pdf$/i, "");
    link.href = zipUrl;
    link.download = `${baseName}-imagens.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(zipUrl), 3000);
  } finally {
    downloadAllZipButton.disabled = false;
    downloadAllZipButton.innerHTML = 'Baixar todas (.zip) <span>↓</span>';
  }
});

// ========================
// MODO 2: IMAGENS -> PDF
// ========================
const imgsDropZone = document.querySelector("#imgs-drop-zone");
const imgsInput = document.querySelector("#imgs-input");
const imgsAddInput = document.querySelector("#imgs-add-input");
const imgsControls = document.querySelector("#imgs-controls");
const imgsCountLabel = document.querySelector("#imgs-count-label");
const imgsQueueEl = document.querySelector("#imgs-queue");
const pdfPageSizeSelect = document.querySelector("#pdf-page-size");
const pdfMarginSelect = document.querySelector("#pdf-margin");
const imgPdfQualityInput = document.querySelector("#img-pdf-quality");
const imgPdfQualityValue = document.querySelector("#img-pdf-quality-value");
const buildPdfButton = document.querySelector("#build-pdf-button");
const imgsError = document.querySelector("#imgs-error");
const imgsResult = document.querySelector("#imgs-result");
const imgsResultBadge = document.querySelector("#imgs-result-badge");
const imgsResultName = document.querySelector("#imgs-result-name");
const imgsResultMeta = document.querySelector("#imgs-result-meta");
const downloadBuiltPdf = document.querySelector("#download-built-pdf");

let imageQueue = [];
let builtPdfUrl = null;

imgPdfQualityInput.addEventListener("input", () => {
  imgPdfQualityValue.textContent = `${imgPdfQualityInput.value}%`;
});

function clearBuiltPdfUrl() {
  if (builtPdfUrl) {
    URL.revokeObjectURL(builtPdfUrl);
    builtPdfUrl = null;
  }
}

function addImageFiles(fileList) {
  imgsError.hidden = true;
  const accepted = [...(fileList || [])].filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name));
  if (!accepted.length) {
    imgsError.textContent = "Selecione apenas arquivos de imagem válidos.";
    imgsError.hidden = false;
    return;
  }
  for (const file of accepted) {
    imageQueue.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      file,
      thumbUrl: URL.createObjectURL(file),
    });
  }
  imgsDropZone.hidden = true;
  imgsControls.hidden = false;
  imgsResult.hidden = true;
  renderImageQueue();
}

function renderImageQueue() {
  if (!imageQueue.length) {
    imgsControls.hidden = true;
    imgsDropZone.hidden = false;
    return;
  }
  imgsCountLabel.textContent = `${imageQueue.length} ${imageQueue.length === 1 ? "imagem selecionada" : "imagens selecionadas"}`;
  imgsQueueEl.innerHTML = "";
  imageQueue.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "queue-item";

    const thumb = document.createElement("img");
    thumb.className = "queue-thumb";
    thumb.src = entry.thumbUrl;
    thumb.alt = entry.file.name;

    const info = document.createElement("div");
    info.className = "queue-info";
    const title = document.createElement("strong");
    title.textContent = `${index + 1}. ${entry.file.name}`;
    const meta = document.createElement("span");
    meta.textContent = formatSize(entry.file.size);
    info.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "queue-actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "icon-chip";
    upBtn.textContent = "↑";
    upBtn.title = "Mover para cima";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => {
      [imageQueue[index - 1], imageQueue[index]] = [imageQueue[index], imageQueue[index - 1]];
      renderImageQueue();
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "icon-chip";
    downBtn.textContent = "↓";
    downBtn.title = "Mover para baixo";
    downBtn.disabled = index === imageQueue.length - 1;
    downBtn.addEventListener("click", () => {
      [imageQueue[index + 1], imageQueue[index]] = [imageQueue[index], imageQueue[index + 1]];
      renderImageQueue();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-chip is-danger";
    delBtn.textContent = "×";
    delBtn.title = "Remover";
    delBtn.addEventListener("click", () => {
      URL.revokeObjectURL(entry.thumbUrl);
      imageQueue.splice(index, 1);
      renderImageQueue();
    });

    actions.append(upBtn, downBtn, delBtn);
    row.append(thumb, info, actions);
    imgsQueueEl.appendChild(row);
  });
}

function resetImagesToPdf() {
  for (const entry of imageQueue) URL.revokeObjectURL(entry.thumbUrl);
  imageQueue = [];
  clearBuiltPdfUrl();
  imgsInput.value = "";
  imgsAddInput.value = "";
  imgsError.hidden = true;
  imgsResult.hidden = true;
  renderImageQueue();
}

imgsInput.addEventListener("change", () => addImageFiles(imgsInput.files));
imgsAddInput.addEventListener("change", () => addImageFiles(imgsAddInput.files));
document.querySelector("#clear-imgs").addEventListener("click", resetImagesToPdf);
document.querySelector("#reset-imgs").addEventListener("click", resetImagesToPdf);

["dragenter", "dragover"].forEach((ev) => {
  imgsDropZone.addEventListener(ev, (e) => { e.preventDefault(); imgsDropZone.classList.add("dragover"); });
});
["dragleave", "drop"].forEach((ev) => {
  imgsDropZone.addEventListener(ev, (e) => { e.preventDefault(); imgsDropZone.classList.remove("dragover"); });
});
imgsDropZone.addEventListener("drop", (e) => addImageFiles(e.dataTransfer?.files));

function loadHtmlImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar uma das imagens."));
    img.src = url;
  });
}

async function encodeImageForPdf(entry, quality) {
  const img = await loadHtmlImage(entry.thumbUrl);
  const w = img.naturalWidth || 1200;
  const h = img.naturalHeight || 1200;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}

buildPdfButton.addEventListener("click", async () => {
  if (!imageQueue.length || !window.PDFLib) return;
  imgsError.hidden = true;
  clearBuiltPdfUrl();
  buildPdfButton.disabled = true;

  const pagePreset = pdfPageSizeSelect.value;
  const margin = Number(pdfMarginSelect.value) || 0;
  const quality = Number(imgPdfQualityInput.value) / 100;

  try {
    const pdfDoc = await PDFLib.PDFDocument.create();
    const PAGE_PRESETS = {
      "a4-portrait": [595.28, 841.89],
      "a4-landscape": [841.89, 595.28],
      letter: [612, 792],
    };

    for (let i = 0; i < imageQueue.length; i += 1) {
      buildPdfButton.textContent = `Gerando página ${i + 1} de ${imageQueue.length}…`;
      const encoded = await encodeImageForPdf(imageQueue[i], quality);
      const embedded = await pdfDoc.embedJpg(encoded.bytes);

      if (pagePreset === "fit") {
        const page = pdfDoc.addPage([encoded.width, encoded.height]);
        page.drawImage(embedded, { x: 0, y: 0, width: encoded.width, height: encoded.height });
      } else {
        const [pw, ph] = PAGE_PRESETS[pagePreset] || PAGE_PRESETS["a4-portrait"];
        const page = pdfDoc.addPage([pw, ph]);
        const maxW = Math.max(10, pw - margin * 2);
        const maxH = Math.max(10, ph - margin * 2);
        const ratio = Math.min(maxW / encoded.width, maxH / encoded.height);
        const drawW = encoded.width * ratio;
        const drawH = encoded.height * ratio;
        page.drawImage(embedded, {
          x: (pw - drawW) / 2,
          y: (ph - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    builtPdfUrl = URL.createObjectURL(pdfBlob);

    const outName = imageQueue.length === 1
      ? `${imageQueue[0].file.name.replace(/\.[^.]+$/, "")}.pdf`
      : "imagens-combinadas.pdf";
    downloadBuiltPdf.href = builtPdfUrl;
    downloadBuiltPdf.download = outName;
    imgsResultName.textContent = outName;
    imgsResultMeta.textContent = `${imageQueue.length} ${imageQueue.length === 1 ? "página" : "páginas"} • ${formatSize(pdfBlob.size)}`;
    imgsResultBadge.textContent = formatSize(pdfBlob.size);
    imgsResult.hidden = false;
  } catch (err) {
    imgsError.textContent = err.message || "Falha ao gerar o PDF.";
    imgsError.hidden = false;
  } finally {
    buildPdfButton.disabled = false;
    buildPdfButton.innerHTML = 'Gerar documento PDF <span>→</span>';
  }
});

// ========================
// TEMA E RODAPÉ
// ========================
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
    content: `<article><h3>Qual resolução devo escolher para PDF em imagem?</h3><p>A escala <strong>2x (144 DPI)</strong> oferece ótimo equilíbrio para telas e documentos. Use <strong>3x</strong> para impressões ou textos pequenos.</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p>Todo o processamento dos PDFs e imagens ocorre dentro do seu navegador usando WebAssembly/Canvas.</p><p>Nenhum documento é enviado para nossos servidores.</p>`,
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
