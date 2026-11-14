const fileInput = document.querySelector("#source-file");
const dropZone = document.querySelector("#drop-zone");
const controls = document.querySelector("#controls");
const result = document.querySelector("#result");
const errorMessage = document.querySelector("#error-message");
const targetFormatSelect = document.querySelector("#target-format");
const formatHint = document.querySelector("#format-hint");
const qualityField = document.querySelector("#quality-field");
const qualityInput = document.querySelector("#quality");
const qualityValue = document.querySelector("#quality-value");
const qualityHint = document.querySelector("#quality-hint");
const bgField = document.querySelector("#bg-field");
const bgColorInput = document.querySelector("#bg-color");
const csvDelimiterField = document.querySelector("#csv-delimiter-field");
const csvDelimiterSelect = document.querySelector("#csv-delimiter");
const convertButton = document.querySelector("#convert-button");

const imageResultGrid = document.querySelector("#image-result-grid");
const fileSummaryCard = document.querySelector("#file-summary-card");
const textPreviewBox = document.querySelector("#text-preview-box");

let selectedFile = null;
let selectedKind = null; // "image" | "text"
let sourceExt = "";
let sourceText = "";
let sourceUrl = null;
let outputUrl = null;
let imageDimensions = { width: 0, height: 0 };

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
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  sourceUrl = null;
  outputUrl = null;
}

const IMAGE_TARGETS = [
  { value: "image/webp", label: "WebP (.webp)", ext: "webp", hint: "Ótimo equilíbrio entre tamanho e qualidade." },
  { value: "image/png", label: "PNG (.png)", ext: "png", hint: "Sem perda de qualidade e preserva transparência." },
  { value: "image/jpeg", label: "JPEG (.jpg)", ext: "jpg", hint: "Compatível com qualquer dispositivo (sem transparência)." },
  { value: "image/x-icon", label: "ICO (.ico) — Favicon", ext: "ico", hint: "Gera um ícone quadrado até 256 × 256 px." },
  { value: "application/pdf", label: "PDF (.pdf)", ext: "pdf", hint: "Documento PDF com a imagem ajustada à página." },
];

const TEXT_TARGETS = {
  json: [
    { value: "csv", label: "CSV (.csv)", ext: "csv", hint: "Planilha compatível com Excel e Google Sheets." },
    { value: "html", label: "Tabela HTML (.html)", ext: "html", hint: "Página HTML limpa com tabela formatada." },
    { value: "txt", label: "Texto (.txt)", ext: "txt", hint: "Representação legível em texto puro." },
  ],
  csv: [
    { value: "json", label: "JSON (.json)", ext: "json", hint: "Lista de objetos estruturados a partir das colunas." },
    { value: "html", label: "Tabela HTML (.html)", ext: "html", hint: "Página HTML limpa com tabela formatada." },
    { value: "txt", label: "Texto (.txt)", ext: "txt", hint: "Colunas alinhadas em texto puro." },
  ],
  md: [
    { value: "html", label: "HTML (.html)", ext: "html", hint: "Página HTML5 completa com estilos básicos." },
    { value: "txt", label: "Texto (.txt)", ext: "txt", hint: "Remove marcações Markdown mantendo o texto." },
    { value: "pdf", label: "PDF (.pdf)", ext: "pdf", hint: "Documento PDF gerado localmente." },
  ],
  html: [
    { value: "md", label: "Markdown (.md)", ext: "md", hint: "Converte títulos, listas, links e negrito." },
    { value: "txt", label: "Texto (.txt)", ext: "txt", hint: "Extrai somente o conteúdo textual visível." },
    { value: "pdf", label: "PDF (.pdf)", ext: "pdf", hint: "Documento PDF com o conteúdo em texto." },
  ],
  txt: [
    { value: "pdf", label: "PDF (.pdf)", ext: "pdf", hint: "Documento PDF formatado com quebra automática de linhas." },
    { value: "html", label: "HTML (.html)", ext: "html", hint: "Página HTML5 pronta para abrir no navegador." },
    { value: "md", label: "Markdown (.md)", ext: "md", hint: "Arquivo Markdown pronto para edição." },
    { value: "json", label: "JSON (.json)", ext: "json", hint: "Exporta as linhas e o texto em JSON estruturado." },
  ],
};

function detectTextType(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "markdown" || ext === "md") return "md";
  if (ext === "htm" || ext === "html" || file.type === "text/html") return "html";
  if (ext === "json" || file.type === "application/json") return "json";
  if (ext === "csv" || file.type === "text/csv") return "csv";
  if (ext === "txt" || file.type === "text/plain") return "txt";
  return "";
}

function populateTargetFormats() {
  const list = selectedKind === "image" ? IMAGE_TARGETS : (TEXT_TARGETS[sourceExt] || []);
  targetFormatSelect.innerHTML = list.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");
  if (selectedKind === "image" && selectedFile?.type === "image/webp") {
    targetFormatSelect.value = "image/png";
  }
  updateOptionVisibility();
}

function updateOptionVisibility() {
  const target = targetFormatSelect.value;
  const list = selectedKind === "image" ? IMAGE_TARGETS : (TEXT_TARGETS[sourceExt] || []);
  const info = list.find((item) => item.value === target);
  formatHint.textContent = info?.hint || "";

  if (selectedKind === "image") {
    const usesQuality = target === "image/jpeg" || target === "image/webp" || target === "application/pdf";
    qualityField.hidden = false;
    qualityInput.disabled = !usesQuality;
    qualityHint.textContent = usesQuality
      ? "Qualidade menor gera arquivos mais leves."
      : "Formato sem perda; o controle de qualidade não se aplica.";
    bgField.hidden = !(target === "image/jpeg" || target === "application/pdf");
    csvDelimiterField.hidden = true;
  } else {
    qualityField.hidden = true;
    bgField.hidden = true;
    csvDelimiterField.hidden = !(sourceExt === "json" && target === "csv");
  }
}

async function chooseFile(file) {
  if (!file) return;
  errorMessage.hidden = true;
  const textType = detectTextType(file);
  const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|avif|gif|bmp|svg)$/i.test(file.name);

  if (!isImage && !textType) {
    errorMessage.textContent = "Formato não suportado. Envie uma imagem (PNG, JPG, WebP, SVG, GIF, AVIF, BMP) ou documento (TXT, MD, HTML, CSV, JSON).";
    errorMessage.hidden = false;
    return;
  }

  clearUrls();

  if (isImage) {
    const nextUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = nextUrl;
      await img.decode();
      selectedKind = "image";
      selectedFile = file;
      sourceUrl = nextUrl;
      sourceExt = (file.name.split(".").pop() || "img").toLowerCase();
      imageDimensions = { width: img.naturalWidth || 1, height: img.naturalHeight || 1 };
      document.querySelector("#file-symbol").textContent = "▧";
      document.querySelector("#file-name").textContent = file.name;
      document.querySelector("#file-meta").textContent = `Imagem · ${imageDimensions.width} × ${imageDimensions.height} px · ${formatSize(file.size)}`;
    } catch {
      URL.revokeObjectURL(nextUrl);
      errorMessage.textContent = "Não foi possível abrir esta imagem no navegador.";
      errorMessage.hidden = false;
      return;
    }
  } else {
    selectedKind = "text";
    selectedFile = file;
    sourceExt = textType;
    sourceText = await file.text();
    document.querySelector("#file-symbol").textContent = "▤";
    document.querySelector("#file-name").textContent = file.name;
    document.querySelector("#file-meta").textContent = `Documento ${sourceExt.toUpperCase()} · ${formatSize(file.size)}`;
  }

  populateTargetFormats();
  dropZone.hidden = true;
  result.hidden = true;
  controls.hidden = false;
  animateFrom(controls.querySelector(".selected-file"));
  animateFrom(controls.querySelector(".settings-grid"), { to: { delay: 0.06 } });
  animateFrom(convertButton, { to: { delay: 0.12 } });
}

function reset() {
  clearUrls();
  selectedFile = null;
  selectedKind = null;
  sourceExt = "";
  sourceText = "";
  fileInput.value = "";
  controls.hidden = true;
  result.hidden = true;
  dropZone.hidden = false;
  errorMessage.hidden = true;
  animateFrom(dropZone, { from: { scale: 0.97 } });
}

targetFormatSelect.addEventListener("change", updateOptionVisibility);
qualityInput.addEventListener("input", () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});
document.querySelectorAll(".color-presets button").forEach((button) => {
  button.addEventListener("click", () => {
    bgColorInput.value = button.dataset.color;
    document.querySelectorAll(".color-presets button").forEach((btn) => btn.classList.toggle("active", btn === button));
  });
});
bgColorInput.addEventListener("input", () => {
  document.querySelectorAll(".color-presets button").forEach((btn) => btn.classList.toggle("active", btn.dataset.color.toLowerCase() === bgColorInput.value.toLowerCase()));
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

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

async function canvasToIcoBlob(sourceImage) {
  const size = Math.min(256, Math.max(sourceImage.naturalWidth || 256, sourceImage.naturalHeight || 256, 64));
  const iconSize = size >= 256 ? 256 : size >= 128 ? 128 : 64;
  const canvas = document.createElement("canvas");
  canvas.width = iconSize;
  canvas.height = iconSize;
  const ctx = canvas.getContext("2d");
  const scale = Math.min(iconSize / sourceImage.naturalWidth, iconSize / sourceImage.naturalHeight);
  const drawW = Math.round(sourceImage.naturalWidth * scale);
  const drawH = Math.round(sourceImage.naturalHeight * scale);
  ctx.clearRect(0, 0, iconSize, iconSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceImage, Math.round((iconSize - drawW) / 2), Math.round((iconSize - drawH) / 2), drawW, drawH);

  const pngBlob = await canvasToBlob(canvas, "image/png");
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
  const icoBuffer = new ArrayBuffer(22 + pngBytes.length);
  const view = new DataView(icoBuffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  view.setUint8(6, iconSize === 256 ? 0 : iconSize);
  view.setUint8(7, iconSize === 256 ? 0 : iconSize);
  view.setUint8(8, 0);
  view.setUint8(9, 0);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBytes.length, true);
  view.setUint32(18, 22, true);
  new Uint8Array(icoBuffer, 22).set(pngBytes);
  return new Blob([icoBuffer], { type: "image/x-icon" });
}

function buildPdfFromJpegPages(pages) {
  const encoder = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const offsets = [0];

  function pushText(str) {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    offset += bytes.length;
  }
  function pushBytes(bytes) {
    chunks.push(bytes);
    offset += bytes.length;
  }
  function startObj(id) {
    offsets[id] = offset;
    pushText(`${id} 0 obj\n`);
  }

  pushText("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  const pageIds = [];
  let nextId = 3;
  const pageData = pages.map((page) => {
    const pageId = nextId++;
    const imgId = nextId++;
    const contentId = nextId++;
    pageIds.push(`${pageId} 0 R`);
    return { ...page, pageId, imgId, contentId };
  });

  startObj(1);
  pushText("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  startObj(2);
  pushText(`<< /Type /Pages /Kids [${pageIds.join(" ")}] /Count ${pageIds.length} >>\nendobj\n`);

  for (const page of pageData) {
    const ptW = Number((page.ptWidth ?? Math.max(72, Math.min(1440, page.width * 0.75))).toFixed(2));
    const ptH = Number((page.ptHeight ?? ptW * (page.height / page.width)).toFixed(2));

    startObj(page.pageId);
    pushText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 ${page.imgId} 0 R >> >> /Contents ${page.contentId} 0 R >>\nendobj\n`);

    startObj(page.imgId);
    pushText(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`);
    pushBytes(page.jpegBytes);
    pushText("\nendstream\nendobj\n");

    const contentStream = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`;
    startObj(page.contentId);
    pushText(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);
  }

  const xrefStart = offset;
  const totalObjs = nextId;
  pushText(`xref\n0 ${totalObjs}\n0000000000 65535 f \n`);
  for (let i = 1; i < totalObjs; i += 1) {
    pushText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}

async function textToPdfBlob(text) {
  const pageW = 1240;
  const pageH = 1754;
  const margin = 96;
  const maxLineWidth = pageW - margin * 2;
  const lineHeight = 36;
  const maxLinesPerPage = Math.floor((pageH - margin * 2) / lineHeight);

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = '24px "DM Sans", system-ui, sans-serif';

  const wrappedLines = [];
  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!rawLine.trim()) {
      wrappedLines.push("");
      continue;
    }
    const words = rawLine.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (mctx.measureText(candidate).width <= maxLineWidth) {
        current = candidate;
      } else {
        if (current) wrappedLines.push(current);
        current = word;
      }
    }
    if (current) wrappedLines.push(current);
  }
  if (!wrappedLines.length) wrappedLines.push(" ");

  const pages = [];
  for (let start = 0; start < wrappedLines.length; start += maxLinesPerPage) {
    const slice = wrappedLines.slice(start, start + maxLinesPerPage);
    const canvas = document.createElement("canvas");
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageW, pageH);
    ctx.fillStyle = "#202a28";
    ctx.font = '24px "DM Sans", system-ui, sans-serif';
    ctx.textBaseline = "top";
    slice.forEach((line, idx) => {
      ctx.fillText(line, margin, margin + idx * lineHeight);
    });
    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.9);
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    pages.push({ width: pageW, height: pageH, ptWidth: 595.28, ptHeight: 841.89, jpegBytes });
  }
  return buildPdfFromJpegPages(pages);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtmlDocument(title, bodyHtml) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;max-width:860px;margin:40px auto;padding:0 20px;line-height:1.65;color:#202a28;background:#fff}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
    th,td{border:1px solid #d7ddd3;padding:8px 10px;text-align:left}
    th{background:#f5f6f2;font-weight:700}
    pre{background:#f5f6f2;padding:14px;border-radius:8px;overflow:auto}
    code{background:#f5f6f2;padding:2px 5px;border-radius:4px}
    blockquote{border-left:3px solid #88a94b;margin:16px 0;padding:4px 14px;color:#55605b}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = clean.split("\n")[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ";" : ",";

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    if (row.some((v) => v !== "")) rows.push(row);
  }
  return rows;
}

function escapeCsvCell(value, delimiter) {
  const str = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes('"') || str.includes(delimiter) || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function jsonToRows(parsed) {
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (!items.length) return [["valor"]];
  if (items.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    const headers = [...new Set(items.flatMap((item) => Object.keys(item)))];
    return [headers, ...items.map((item) => headers.map((h) => item[h] ?? ""))];
  }
  if (items.every((item) => Array.isArray(item))) {
    return items;
  }
  return [["valor"], ...items.map((item) => [item])];
}

function rowsToHtmlTable(rows) {
  if (!rows.length) return "<p>Sem dados.</p>";
  const [header, ...body] = rows;
  const thead = `<thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${body.map((row) => `<tr>${header.map((_, i) => `<td>${escapeHtml(row[i] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inCode = false;
  let listType = null;

  const inline = (text) => escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      closeList();
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^[-*_]{3,}$/.test(line.trim())) {
      closeList();
      out.push("<hr />");
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      closeList();
      out.push(`<blockquote><p>${inline(quote[1])}</p></blockquote>`);
      continue;
    }
    const ul = /^[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    closeList();
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  return (doc.body?.innerText || doc.body?.textContent || "").trim();
}

function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    const children = [...node.childNodes].map(walk).join("");
    if (/^h([1-6])$/.test(tag)) return `\n${"#".repeat(Number(tag[1]))} ${children.trim()}\n\n`;
    if (tag === "p") return `\n${children.trim()}\n\n`;
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n---\n\n";
    if (tag === "strong" || tag === "b") return `**${children.trim()}**`;
    if (tag === "em" || tag === "i") return `*${children.trim()}*`;
    if (tag === "code" && node.parentElement?.tagName.toLowerCase() !== "pre") return `\`${children}\``;
    if (tag === "pre") return `\n\`\`\`\n${children.trim()}\n\`\`\`\n\n`;
    if (tag === "a") return `[${children.trim()}](${node.getAttribute("href") || "#"})`;
    if (tag === "li") return `- ${children.trim()}\n`;
    if (tag === "ul" || tag === "ol") return `\n${children}\n`;
    if (tag === "blockquote") return `\n> ${children.trim()}\n\n`;
    return children;
  }
  return walk(doc.body).replace(/\n{3,}/g, "\n\n").trim();
}

async function convertTextDocument(target) {
  const baseTitle = selectedFile.name.replace(/\.[^.]+$/, "") || "documento";
  let outputText = "";
  let mime = "text/plain;charset=utf-8";

  if (sourceExt === "json") {
    const parsed = JSON.parse(sourceText);
    const rows = jsonToRows(parsed);
    if (target === "csv") {
      const delimiter = csvDelimiterSelect.value;
      outputText = rows.map((row) => row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter)).join("\n");
      mime = "text/csv;charset=utf-8";
    } else if (target === "html") {
      outputText = wrapHtmlDocument(baseTitle, `<h1>${escapeHtml(baseTitle)}</h1>${rowsToHtmlTable(rows)}`);
      mime = "text/html;charset=utf-8";
    } else {
      outputText = rows.map((row) => row.map((cell) => (typeof cell === "object" ? JSON.stringify(cell) : String(cell))).join(" | ")).join("\n");
    }
  } else if (sourceExt === "csv") {
    const rows = parseCsv(sourceText);
    if (!rows.length) throw new Error("O arquivo CSV está vazio.");
    if (target === "json") {
      const [headers, ...body] = rows;
      const objects = body.map((row) => {
        const obj = {};
        headers.forEach((h, i) => { obj[h || `coluna_${i + 1}`] = row[i] ?? ""; });
        return obj;
      });
      outputText = JSON.stringify(objects, null, 2);
      mime = "application/json;charset=utf-8";
    } else if (target === "html") {
      outputText = wrapHtmlDocument(baseTitle, `<h1>${escapeHtml(baseTitle)}</h1>${rowsToHtmlTable(rows)}`);
      mime = "text/html;charset=utf-8";
    } else {
      outputText = rows.map((row) => row.join(" | ")).join("\n");
    }
  } else if (sourceExt === "md") {
    if (target === "html") {
      outputText = wrapHtmlDocument(baseTitle, markdownToHtml(sourceText));
      mime = "text/html;charset=utf-8";
    } else if (target === "pdf") {
      const plain = htmlToPlainText(markdownToHtml(sourceText));
      const blob = await textToPdfBlob(plain || sourceText);
      return { blob, ext: "pdf", previewText: null };
    } else {
      outputText = htmlToPlainText(markdownToHtml(sourceText));
    }
  } else if (sourceExt === "html") {
    if (target === "md") {
      outputText = htmlToMarkdown(sourceText);
      mime = "text/markdown;charset=utf-8";
    } else if (target === "pdf") {
      const plain = htmlToPlainText(sourceText);
      const blob = await textToPdfBlob(plain);
      return { blob, ext: "pdf", previewText: null };
    } else {
      outputText = htmlToPlainText(sourceText);
    }
  } else if (sourceExt === "txt") {
    if (target === "pdf") {
      const blob = await textToPdfBlob(sourceText);
      return { blob, ext: "pdf", previewText: null };
    }
    if (target === "html") {
      const paragraphs = sourceText.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`).join("\n");
      outputText = wrapHtmlDocument(baseTitle, paragraphs);
      mime = "text/html;charset=utf-8";
    } else if (target === "md") {
      outputText = sourceText.replace(/\r\n/g, "\n");
      mime = "text/markdown;charset=utf-8";
    } else if (target === "json") {
      const lines = sourceText.replace(/\r\n/g, "\n").split("\n");
      outputText = JSON.stringify({ arquivo: selectedFile.name, linhas: lines }, null, 2);
      mime = "application/json;charset=utf-8";
    }
  }

  return {
    blob: new Blob([outputText], { type: mime }),
    ext: target,
    previewText: outputText,
  };
}

convertButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  errorMessage.hidden = true;
  convertButton.disabled = true;
  convertButton.innerHTML = "Convertendo…";

  try {
    const target = targetFormatSelect.value;
    const baseName = selectedFile.name.replace(/\.[^.]+$/, "") || "arquivo";

    imageResultGrid.hidden = true;
    fileSummaryCard.hidden = true;
    textPreviewBox.hidden = true;

    if (selectedKind === "image") {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();

      let blob;
      let ext;
      const quality = Number(qualityInput.value) / 100;

      if (target === "image/x-icon") {
        blob = await canvasToIcoBlob(image);
        ext = "ico";
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || 1;
        canvas.height = image.naturalHeight || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Não foi possível preparar a imagem.");

        if (target === "image/jpeg" || target === "application/pdf") {
          ctx.fillStyle = bgColorInput.value || "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        if (target === "application/pdf") {
          const jpegBlob = await canvasToBlob(canvas, "image/jpeg", quality);
          const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
          blob = buildPdfFromJpegPages([{ width: canvas.width, height: canvas.height, jpegBytes }]);
          ext = "pdf";
        } else {
          blob = await canvasToBlob(canvas, target, quality);
          if (!blob || blob.type !== target) {
            throw new Error("Seu navegador não conseguiu exportar para este formato. Tente WebP, PNG ou JPEG.");
          }
          ext = target === "image/jpeg" ? "jpg" : target.split("/")[1];
        }
      }

      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      const outputName = `${baseName}.${ext}`;

      if (ext === "pdf" || ext === "ico") {
        document.querySelector("#summary-ext").textContent = ext.toUpperCase();
        document.querySelector("#summary-filename").textContent = outputName;
        document.querySelector("#summary-details").textContent = `${image.naturalWidth} × ${image.naturalHeight} px · ${formatSize(blob.size)}`;
        fileSummaryCard.hidden = false;
      } else {
        document.querySelector("#original-preview").src = sourceUrl;
        document.querySelector("#converted-preview").src = outputUrl;
        document.querySelector("#original-caption").textContent = `${sourceExt.toUpperCase()} · ${formatSize(selectedFile.size)}`;
        document.querySelector("#converted-caption").textContent = `${ext.toUpperCase()} · ${formatSize(blob.size)}`;
        imageResultGrid.hidden = false;
      }

      document.querySelector("#result-badge").textContent = `${sourceExt.toUpperCase()} → ${ext.toUpperCase()}`;
      document.querySelector("#result-note").textContent = `Convertido de ${sourceExt.toUpperCase()} (${formatSize(selectedFile.size)}) para ${ext.toUpperCase()} (${formatSize(blob.size)}).`;
      const download = document.querySelector("#download-link");
      download.href = outputUrl;
      download.download = outputName;
    } else {
      const { blob, ext, previewText } = await convertTextDocument(target);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      const outputName = `${baseName}.${ext}`;

      if (previewText !== null) {
        const snippet = previewText.length > 6000 ? `${previewText.slice(0, 6000)}\n\n… (prévia truncada; o arquivo completo será baixado)` : previewText;
        document.querySelector("#text-preview-content").textContent = snippet;
        document.querySelector("#text-preview-meta").textContent = `${ext.toUpperCase()} · ${formatSize(blob.size)}`;
        textPreviewBox.hidden = false;
      } else {
        document.querySelector("#summary-ext").textContent = ext.toUpperCase();
        document.querySelector("#summary-filename").textContent = outputName;
        document.querySelector("#summary-details").textContent = `Gerado localmente · ${formatSize(blob.size)}`;
        fileSummaryCard.hidden = false;
      }

      document.querySelector("#result-badge").textContent = `${sourceExt.toUpperCase()} → ${ext.toUpperCase()}`;
      document.querySelector("#result-note").textContent = `Arquivo convertido de ${sourceExt.toUpperCase()} para ${ext.toUpperCase()} (${formatSize(blob.size)}).`;
      const download = document.querySelector("#download-link");
      download.href = outputUrl;
      download.download = outputName;
    }

    controls.hidden = true;
    result.hidden = false;
    animateFrom(result.querySelector(".result-heading"));
    animateFrom(imageResultGrid.hidden ? (fileSummaryCard.hidden ? textPreviewBox : fileSummaryCard) : imageResultGrid, { to: { delay: 0.08 } });
    animateFrom(result.querySelector(".result-actions"), { from: { scale: 0.96 }, to: { delay: 0.15, duration: 0.4 } });
  } catch (error) {
    errorMessage.textContent = error.message || "Não foi possível converter este arquivo.";
    errorMessage.hidden = false;
    animateFrom(errorMessage, { from: { x: -6 }, to: { duration: 0.3 } });
  } finally {
    convertButton.disabled = false;
    convertButton.innerHTML = 'Converter arquivo <span>→</span>';
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
    content: `<article><h3>Quais formatos posso converter?</h3><p>Imagens (PNG, JPG, WebP, SVG, GIF, AVIF, BMP para PNG, JPG, WebP, ICO ou PDF) e documentos/dados (JSON, CSV, Markdown, HTML e TXT).</p></article><article><h3>O que acontece com meus arquivos?</h3><p>Toda a conversão é feita localmente neste navegador. Nenhum arquivo é enviado para um servidor.</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p>O conversor processa seus arquivos localmente neste navegador. Os arquivos não são enviados para o Canivete.</p><p>A preferência do tema fica salva apenas neste navegador, usando o armazenamento local do site.</p><p>Fontes e animações são carregadas de serviços externos. O botão de apoio abre o Asaas; nenhum pagamento acontece dentro desta página.</p>`,
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
