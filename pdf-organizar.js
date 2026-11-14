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

function isPdfFile(file) {
  return Boolean(file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")));
}

function formatPdfLoadError(error) {
  const msg = String(error?.message || error || "");
  if (error?.name === "PasswordException" || /encrypted|password/i.test(msg)) {
    return "Este PDF está protegido por senha. Remova a senha antes de processar.";
  }
  return "Não foi possível ler este PDF. Verifique se o arquivo está válido e sem corrupção.";
}

function parseSplitRangeGroups(rawInput, totalPages) {
  const tokens = String(rawInput || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!tokens.length) {
    throw new Error("Informe pelo menos um intervalo (ex.: 1-3, 4-6).");
  }
  return tokens.map((token) => {
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < 1 || start > totalPages || end > totalPages || start > end) {
        throw new Error(`Intervalo "${token}" inválido para um PDF de ${totalPages} páginas.`);
      }
      const pages = [];
      for (let p = start; p <= end; p += 1) pages.push(p - 1);
      return { label: `p${start}-${end}`, indices: pages };
    }
    if (/^\d+$/.test(token)) {
      const p = Number(token);
      if (p < 1 || p > totalPages) {
        throw new Error(`Página ${p} não existe neste PDF (${totalPages} páginas).`);
      }
      return { label: `p${p}`, indices: [p - 1] };
    }
    throw new Error(`Trecho "${token}" inválido. Use números ou intervalos como 1-3, 5.`);
  });
}

function setupDropZone(zone, onFiles) {
  ["dragenter", "dragover"].forEach((ev) => {
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("dragover"); });
  });
  ["dragleave", "drop"].forEach((ev) => {
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("dragover"); });
  });
  zone.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
  });
}

const modeButtons = [...document.querySelectorAll(".mode-switch button")];
const mergeSection = document.querySelector("#merge-section");
const splitSection = document.querySelector("#split-section");
const organizeSection = document.querySelector("#organize-section");

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
    mergeSection.hidden = mode !== "merge";
    splitSection.hidden = mode !== "split";
    organizeSection.hidden = mode !== "organize";
  });
});

// ========================
// MODO 1: UNIR PDFs
// ========================
const mergeDropZone = document.querySelector("#merge-drop-zone");
const mergeInput = document.querySelector("#merge-input");
const mergeAddInput = document.querySelector("#merge-add-input");
const mergeControls = document.querySelector("#merge-controls");
const mergeSummaryLabel = document.querySelector("#merge-summary-label");
const mergeQueueEl = document.querySelector("#merge-queue");
const mergeOutputName = document.querySelector("#merge-output-name");
const mergeButton = document.querySelector("#merge-button");
const mergeError = document.querySelector("#merge-error");
const mergeResult = document.querySelector("#merge-result");
const mergeResultBadge = document.querySelector("#merge-result-badge");
const mergeResultName = document.querySelector("#merge-result-name");
const mergeResultMeta = document.querySelector("#merge-result-meta");
const downloadMergedPdf = document.querySelector("#download-merged-pdf");

let mergeItems = [];
let mergedUrl = null;

function clearMergedUrl() {
  if (mergedUrl) {
    URL.revokeObjectURL(mergedUrl);
    mergedUrl = null;
  }
}

async function addMergeFiles(fileList) {
  mergeError.hidden = true;
  const pdfFiles = [...(fileList || [])].filter(isPdfFile);
  if (!pdfFiles.length) {
    mergeError.textContent = "Selecione apenas arquivos PDF válidos.";
    mergeError.hidden = false;
    return;
  }

  for (const file of pdfFiles) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFLib.PDFDocument.load(bytes);
      mergeItems.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        file,
        bytes,
        pageCount: doc.getPageCount(),
      });
    } catch (error) {
      mergeError.textContent = `${file.name}: ${formatPdfLoadError(error)}`;
      mergeError.hidden = false;
    }
  }

  mergeInput.value = "";
  mergeAddInput.value = "";
  mergeResult.hidden = true;
  renderMergeQueue();
}

function renderMergeQueue() {
  if (!mergeItems.length) {
    mergeControls.hidden = true;
    mergeDropZone.hidden = false;
    return;
  }
  mergeDropZone.hidden = true;
  mergeControls.hidden = false;

  const totalPages = mergeItems.reduce((sum, item) => sum + item.pageCount, 0);
  mergeSummaryLabel.textContent = `${mergeItems.length} ${mergeItems.length === 1 ? "PDF na fila" : "PDFs na fila"} • ${totalPages} ${totalPages === 1 ? "página" : "páginas"} no total`;

  mergeQueueEl.innerHTML = "";
  mergeItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "queue-item";

    const badge = document.createElement("span");
    badge.className = "queue-badge";
    badge.textContent = `${index + 1}`;

    const info = document.createElement("div");
    info.className = "queue-info";
    const title = document.createElement("strong");
    title.textContent = item.file.name;
    const meta = document.createElement("span");
    meta.textContent = `${item.pageCount} ${item.pageCount === 1 ? "página" : "páginas"} • ${formatSize(item.file.size)}`;
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
      [mergeItems[index - 1], mergeItems[index]] = [mergeItems[index], mergeItems[index - 1]];
      renderMergeQueue();
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "icon-chip";
    downBtn.textContent = "↓";
    downBtn.title = "Mover para baixo";
    downBtn.disabled = index === mergeItems.length - 1;
    downBtn.addEventListener("click", () => {
      [mergeItems[index + 1], mergeItems[index]] = [mergeItems[index], mergeItems[index + 1]];
      renderMergeQueue();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-chip is-danger";
    delBtn.textContent = "×";
    delBtn.title = "Remover";
    delBtn.addEventListener("click", () => {
      mergeItems.splice(index, 1);
      renderMergeQueue();
    });

    actions.append(upBtn, downBtn, delBtn);
    row.append(badge, info, actions);
    mergeQueueEl.appendChild(row);
  });
}

function resetMerge() {
  mergeItems = [];
  clearMergedUrl();
  mergeInput.value = "";
  mergeAddInput.value = "";
  mergeError.hidden = true;
  mergeResult.hidden = true;
  renderMergeQueue();
}

mergeInput.addEventListener("change", () => addMergeFiles(mergeInput.files));
mergeAddInput.addEventListener("change", () => addMergeFiles(mergeAddInput.files));
setupDropZone(mergeDropZone, addMergeFiles);
document.querySelector("#clear-merge").addEventListener("click", resetMerge);
document.querySelector("#reset-merge").addEventListener("click", resetMerge);

mergeButton.addEventListener("click", async () => {
  mergeError.hidden = true;
  if (mergeItems.length < 2) {
    mergeError.textContent = "Adicione pelo menos 2 arquivos PDF para unir.";
    mergeError.hidden = false;
    return;
  }

  clearMergedUrl();
  mergeButton.disabled = true;
  mergeButton.textContent = "Unindo documentos…";

  try {
    const mergedDoc = await PDFLib.PDFDocument.create();
    for (let i = 0; i < mergeItems.length; i += 1) {
      mergeButton.textContent = `Unindo arquivo ${i + 1} de ${mergeItems.length}…`;
      const srcDoc = await PDFLib.PDFDocument.load(mergeItems[i].bytes);
      const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }

    const bytes = await mergedDoc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    mergedUrl = URL.createObjectURL(blob);

    let fileName = (mergeOutputName.value || "documentos-unidos.pdf").trim();
    if (!fileName.toLowerCase().endsWith(".pdf")) fileName += ".pdf";

    downloadMergedPdf.href = mergedUrl;
    downloadMergedPdf.download = fileName;
    mergeResultName.textContent = fileName;
    mergeResultMeta.textContent = `${mergedDoc.getPageCount()} páginas combinadas • ${formatSize(blob.size)}`;
    mergeResultBadge.textContent = formatSize(blob.size);
    mergeResult.hidden = false;
  } catch (error) {
    mergeError.textContent = formatPdfLoadError(error);
    mergeError.hidden = false;
  } finally {
    mergeButton.disabled = false;
    mergeButton.innerHTML = 'Unir PDFs <span>→</span>';
  }
});

// ========================
// MODO 2: DIVIDIR PDF
// ========================
const splitDropZone = document.querySelector("#split-drop-zone");
const splitInput = document.querySelector("#split-input");
const splitControls = document.querySelector("#split-controls");
const splitFileName = document.querySelector("#split-file-name");
const splitFileMeta = document.querySelector("#split-file-meta");
const splitStrategy = document.querySelector("#split-strategy");
const splitRangesField = document.querySelector("#split-ranges-field");
const splitRangesInput = document.querySelector("#split-ranges-input");
const splitChunkField = document.querySelector("#split-chunk-field");
const splitChunkSize = document.querySelector("#split-chunk-size");
const splitButton = document.querySelector("#split-button");
const splitError = document.querySelector("#split-error");
const splitResult = document.querySelector("#split-result");
const splitResultTitle = document.querySelector("#split-result-title");
const splitResultBadge = document.querySelector("#split-result-badge");
const splitResultExt = document.querySelector("#split-result-ext");
const splitResultName = document.querySelector("#split-result-name");
const splitResultMeta = document.querySelector("#split-result-meta");
const downloadSplitOutput = document.querySelector("#download-split-output");

let splitSource = null;
let splitOutputUrl = null;

function clearSplitUrl() {
  if (splitOutputUrl) {
    URL.revokeObjectURL(splitOutputUrl);
    splitOutputUrl = null;
  }
}

splitStrategy.addEventListener("change", () => {
  splitRangesField.hidden = splitStrategy.value !== "ranges";
  splitChunkField.hidden = splitStrategy.value !== "chunk";
  splitError.hidden = true;
});

async function loadSplitPdf(fileList) {
  const file = fileList?.[0];
  if (!file) return;
  splitError.hidden = true;
  if (!isPdfFile(file)) {
    splitError.textContent = "Selecione um arquivo PDF válido.";
    splitError.hidden = false;
    return;
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFLib.PDFDocument.load(bytes);
    splitSource = { file, bytes, doc, pageCount: doc.getPageCount() };
    splitFileName.textContent = file.name;
    splitFileMeta.textContent = `${splitSource.pageCount} ${splitSource.pageCount === 1 ? "página" : "páginas"} • ${formatSize(file.size)}`;
    splitDropZone.hidden = true;
    splitControls.hidden = false;
    splitResult.hidden = true;
  } catch (error) {
    splitControls.hidden = false;
    splitError.textContent = formatPdfLoadError(error);
    splitError.hidden = false;
  }
}

function resetSplit() {
  clearSplitUrl();
  splitSource = null;
  splitInput.value = "";
  splitError.hidden = true;
  splitResult.hidden = true;
  splitControls.hidden = true;
  splitDropZone.hidden = false;
}

splitInput.addEventListener("change", () => loadSplitPdf(splitInput.files));
setupDropZone(splitDropZone, loadSplitPdf);
document.querySelector("#change-split-pdf").addEventListener("click", resetSplit);
document.querySelector("#reset-split").addEventListener("click", resetSplit);

splitButton.addEventListener("click", async () => {
  if (!splitSource) return;
  splitError.hidden = true;
  clearSplitUrl();

  const total = splitSource.pageCount;
  const strategy = splitStrategy.value;
  let groups = [];

  try {
    if (strategy === "each") {
      groups = Array.from({ length: total }, (_, idx) => ({
        label: `pagina-${String(idx + 1).padStart(2, "0")}`,
        indices: [idx],
      }));
    } else if (strategy === "ranges") {
      groups = parseSplitRangeGroups(splitRangesInput.value, total);
    } else {
      const size = Math.round(Number(splitChunkSize.value));
      if (!Number.isFinite(size) || size < 1) {
        throw new Error("Informe um número válido de páginas por arquivo.");
      }
      for (let start = 0; start < total; start += size) {
        const end = Math.min(total, start + size);
        const indices = [];
        for (let i = start; i < end; i += 1) indices.push(i);
        groups.push({ label: `parte-p${start + 1}-${end}`, indices });
      }
    }
  } catch (err) {
    splitError.textContent = err.message;
    splitError.hidden = false;
    return;
  }

  splitButton.disabled = true;
  splitButton.textContent = "Dividindo PDF…";
  const baseName = splitSource.file.name.replace(/\.pdf$/i, "");

  try {
    const outputs = [];
    for (let i = 0; i < groups.length; i += 1) {
      splitButton.textContent = `Gerando parte ${i + 1} de ${groups.length}…`;
      const outDoc = await PDFLib.PDFDocument.create();
      const copied = await outDoc.copyPages(splitSource.doc, groups[i].indices);
      copied.forEach((p) => outDoc.addPage(p));
      const pdfBytes = await outDoc.save();
      outputs.push({
        name: `${baseName}-${groups[i].label}.pdf`,
        bytes: pdfBytes,
      });
    }

    if (outputs.length === 1) {
      const blob = new Blob([outputs[0].bytes], { type: "application/pdf" });
      splitOutputUrl = URL.createObjectURL(blob);
      downloadSplitOutput.href = splitOutputUrl;
      downloadSplitOutput.download = outputs[0].name;
      splitResultTitle.textContent = "PDF extraído";
      splitResultExt.textContent = "PDF";
      splitResultName.textContent = outputs[0].name;
      splitResultMeta.textContent = `${groups[0].indices.length} ${groups[0].indices.length === 1 ? "página" : "páginas"} • ${formatSize(blob.size)}`;
      splitResultBadge.textContent = formatSize(blob.size);
    } else {
      const zipMap = {};
      outputs.forEach((out) => {
        zipMap[out.name] = out.bytes;
      });
      const zipped = fflate.zipSync(zipMap, { level: 0 });
      const blob = new Blob([zipped], { type: "application/zip" });
      splitOutputUrl = URL.createObjectURL(blob);
      const zipName = `${baseName}-dividido.zip`;
      downloadSplitOutput.href = splitOutputUrl;
      downloadSplitOutput.download = zipName;
      splitResultTitle.textContent = `${outputs.length} arquivos gerados`;
      splitResultExt.textContent = "ZIP";
      splitResultName.textContent = zipName;
      splitResultMeta.textContent = `${outputs.length} documentos PDF dentro do pacote • ${formatSize(blob.size)}`;
      splitResultBadge.textContent = formatSize(blob.size);
    }

    splitResult.hidden = false;
  } catch (error) {
    splitError.textContent = error.message || "Falha ao dividir o PDF.";
    splitError.hidden = false;
  } finally {
    splitButton.disabled = false;
    splitButton.innerHTML = 'Dividir PDF <span>→</span>';
  }
});

// ========================
// MODO 3: ORGANIZAR PÁGINAS
// ========================
const orgDropZone = document.querySelector("#org-drop-zone");
const orgInput = document.querySelector("#org-input");
const orgControls = document.querySelector("#org-controls");
const orgFileName = document.querySelector("#org-file-name");
const orgFileMeta = document.querySelector("#org-file-meta");
const orgSelectedCount = document.querySelector("#org-selected-count");
const orgPagesGrid = document.querySelector("#org-pages-grid");
const orgSaveButton = document.querySelector("#org-save-button");
const orgError = document.querySelector("#org-error");
const orgResult = document.querySelector("#org-result");
const orgResultBadge = document.querySelector("#org-result-badge");
const orgResultName = document.querySelector("#org-result-name");
const orgResultMeta = document.querySelector("#org-result-meta");
const downloadOrgPdf = document.querySelector("#download-org-pdf");

let orgSource = null;
let orgPages = [];
let orgOutputUrl = null;

function clearOrgAssets() {
  if (orgOutputUrl) {
    URL.revokeObjectURL(orgOutputUrl);
    orgOutputUrl = null;
  }
  for (const p of orgPages) {
    if (p.thumbUrl) URL.revokeObjectURL(p.thumbUrl);
  }
  orgPages = [];
  orgPagesGrid.innerHTML = "";
}

function updateOrgCount() {
  const active = orgPages.filter((p) => p.include).length;
  orgSelectedCount.textContent = `${active} de ${orgPages.length} páginas selecionadas`;
  orgSaveButton.disabled = active === 0;
}

function renderOrgGrid() {
  orgPagesGrid.innerHTML = "";
  orgPages.forEach((pageItem, index) => {
    const card = document.createElement("div");
    card.className = `pdf-page-card${pageItem.include ? "" : " is-excluded"}`;

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "pdf-page-thumb-wrap";
    const img = document.createElement("img");
    img.src = pageItem.thumbUrl;
    img.alt = `Página ${pageItem.originalNumber}`;
    if (pageItem.rotation) {
      img.style.transform = `rotate(${pageItem.rotation}deg)`;
    }
    thumbWrap.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "pdf-page-meta";
    const label = document.createElement("label");
    label.className = "pdf-page-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = pageItem.include;
    checkbox.addEventListener("change", () => {
      pageItem.include = checkbox.checked;
      card.classList.toggle("is-excluded", !pageItem.include);
      updateOrgCount();
    });
    const numText = document.createElement("span");
    numText.textContent = `Pág. ${pageItem.originalNumber}`;
    label.append(checkbox, numText);

    const rotBadge = document.createElement("span");
    rotBadge.textContent = pageItem.rotation ? `${pageItem.rotation}°` : "";
    meta.append(label, rotBadge);

    const controlsRow = document.createElement("div");
    controlsRow.className = "pdf-page-controls";

    const leftBtn = document.createElement("button");
    leftBtn.type = "button";
    leftBtn.className = "icon-chip";
    leftBtn.textContent = "←";
    leftBtn.title = "Mover para esquerda";
    leftBtn.disabled = index === 0;
    leftBtn.addEventListener("click", () => {
      [orgPages[index - 1], orgPages[index]] = [orgPages[index], orgPages[index - 1]];
      renderOrgGrid();
    });

    const rotBtn = document.createElement("button");
    rotBtn.type = "button";
    rotBtn.className = "icon-chip";
    rotBtn.textContent = "↻ 90°";
    rotBtn.title = "Girar página 90 graus";
    rotBtn.addEventListener("click", () => {
      pageItem.rotation = (pageItem.rotation + 90) % 360;
      img.style.transform = pageItem.rotation ? `rotate(${pageItem.rotation}deg)` : "";
      rotBadge.textContent = pageItem.rotation ? `${pageItem.rotation}°` : "";
    });

    const rightBtn = document.createElement("button");
    rightBtn.type = "button";
    rightBtn.className = "icon-chip";
    rightBtn.textContent = "→";
    rightBtn.title = "Mover para direita";
    rightBtn.disabled = index === orgPages.length - 1;
    rightBtn.addEventListener("click", () => {
      [orgPages[index + 1], orgPages[index]] = [orgPages[index], orgPages[index + 1]];
      renderOrgGrid();
    });

    controlsRow.append(leftBtn, rotBtn, rightBtn);
    card.append(thumbWrap, meta, controlsRow);
    orgPagesGrid.appendChild(card);
  });
  updateOrgCount();
}

async function loadOrgPdf(fileList) {
  const file = fileList?.[0];
  if (!file) return;
  orgError.hidden = true;
  if (!isPdfFile(file)) {
    orgError.textContent = "Selecione um arquivo PDF válido.";
    orgError.hidden = false;
    return;
  }

  clearOrgAssets();
  orgResult.hidden = true;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfLibDoc = await PDFLib.PDFDocument.load(bytes);
    const pdfJsDoc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;

    orgSource = { file, bytes, pdfLibDoc, pageCount: pdfLibDoc.getPageCount() };
    orgFileName.textContent = file.name;
    orgFileMeta.textContent = `${orgSource.pageCount} ${orgSource.pageCount === 1 ? "página" : "páginas"} • ${formatSize(file.size)}`;
    orgDropZone.hidden = true;
    orgControls.hidden = false;
    orgSelectedCount.textContent = "Carregando miniaturas…";

    for (let i = 1; i <= pdfJsDoc.numPages; i += 1) {
      const page = await pdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.45 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      const thumbUrl = URL.createObjectURL(blob);
      orgPages.push({
        pageIndex: i - 1,
        originalNumber: i,
        include: true,
        rotation: 0,
        thumbUrl,
      });
      page.cleanup();
    }
    await pdfJsDoc.destroy();
    renderOrgGrid();
  } catch (error) {
    orgControls.hidden = false;
    orgError.textContent = formatPdfLoadError(error);
    orgError.hidden = false;
  }
}

function resetOrg() {
  clearOrgAssets();
  orgSource = null;
  orgInput.value = "";
  orgError.hidden = true;
  orgResult.hidden = true;
  orgControls.hidden = true;
  orgDropZone.hidden = false;
}

orgInput.addEventListener("change", () => loadOrgPdf(orgInput.files));
setupDropZone(orgDropZone, loadOrgPdf);
document.querySelector("#change-org-pdf").addEventListener("click", resetOrg);
document.querySelector("#reset-org").addEventListener("click", resetOrg);

document.querySelector("#org-select-all").addEventListener("click", () => {
  orgPages.forEach((p) => { p.include = true; });
  renderOrgGrid();
});
document.querySelector("#org-invert").addEventListener("click", () => {
  orgPages.forEach((p) => { p.include = !p.include; });
  renderOrgGrid();
});
document.querySelector("#org-reset-order").addEventListener("click", () => {
  orgPages.sort((a, b) => a.pageIndex - b.pageIndex);
  orgPages.forEach((p) => { p.include = true; p.rotation = 0; });
  renderOrgGrid();
});

orgSaveButton.addEventListener("click", async () => {
  if (!orgSource) return;
  orgError.hidden = true;
  const chosen = orgPages.filter((p) => p.include);
  if (!chosen.length) {
    orgError.textContent = "Selecione pelo menos uma página para salvar.";
    orgError.hidden = false;
    return;
  }

  if (orgOutputUrl) {
    URL.revokeObjectURL(orgOutputUrl);
    orgOutputUrl = null;
  }

  orgSaveButton.disabled = true;
  orgSaveButton.textContent = "Gerando PDF organizado…";

  try {
    const outDoc = await PDFLib.PDFDocument.create();
    const copied = await outDoc.copyPages(orgSource.pdfLibDoc, chosen.map((p) => p.pageIndex));
    copied.forEach((page, idx) => {
      if (chosen[idx].rotation) {
        const currentAngle = page.getRotation().angle || 0;
        page.setRotation(PDFLib.degrees((currentAngle + chosen[idx].rotation) % 360));
      }
      outDoc.addPage(page);
    });

    const bytes = await outDoc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    orgOutputUrl = URL.createObjectURL(blob);

    const outName = `${orgSource.file.name.replace(/\.pdf$/i, "")}-organizado.pdf`;
    downloadOrgPdf.href = orgOutputUrl;
    downloadOrgPdf.download = outName;
    orgResultName.textContent = outName;
    orgResultMeta.textContent = `${chosen.length} ${chosen.length === 1 ? "página mantida" : "páginas mantidas"} • ${formatSize(blob.size)}`;
    orgResultBadge.textContent = formatSize(blob.size);
    orgResult.hidden = false;
  } catch (error) {
    orgError.textContent = error.message || "Falha ao salvar o PDF organizado.";
    orgError.hidden = false;
  } finally {
    orgSaveButton.disabled = false;
    orgSaveButton.innerHTML = 'Salvar PDF organizado <span>→</span>';
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
    content: `<article><h3>Meus arquivos PDF são enviados para algum servidor?</h3><p>Não. Tanto unir, dividir quanto reorganizar páginas são executados 100% localmente no seu navegador.</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p>Seus documentos PDF permanecem exclusivamente na memória do seu navegador durante o processamento.</p><p>Nenhum arquivo é armazenado ou transmitido pela rede.</p>`,
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
