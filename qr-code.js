const canvas = document.querySelector("#qr-canvas");
const qrTextInput = document.querySelector("#qr-text");
const wifiSsidInput = document.querySelector("#wifi-ssid");
const wifiPassInput = document.querySelector("#wifi-pass");
const wifiAuthSelect = document.querySelector("#wifi-auth");
const wifiHiddenInput = document.querySelector("#wifi-hidden");
const attachBox = document.querySelector("#attach-box");
const attachInput = document.querySelector("#attach-image");
const removeImageBtn = document.querySelector("#remove-image");
const attachMeta = document.querySelector("#attach-meta");
const attachThumb = document.querySelector("#attach-thumb");
const attachName = document.querySelector("#attach-name");
const placementField = document.querySelector("#image-placement-field");
const placementSelect = document.querySelector("#image-placement");
const logoSizeField = document.querySelector("#logo-size-field");
const logoSizeInput = document.querySelector("#logo-size");
const logoSizeValue = document.querySelector("#logo-size-value");
const fgColorInput = document.querySelector("#fg-color");
const bgColorInput = document.querySelector("#bg-color");
const moduleStyleSelect = document.querySelector("#module-style");
const qrSizeSelect = document.querySelector("#qr-size");
const captionInput = document.querySelector("#qr-caption");
const downloadFormatSelect = document.querySelector("#download-format");
const downloadButton = document.querySelector("#download-button");
const errorMessage = document.querySelector("#error-message");
const qrBadge = document.querySelector("#qr-badge");

let currentMode = "text";
let attachedImage = null;
let attachedImageUrl = null;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (window.gsap && !reduceMotion) {
  gsap.from(".compressor-page > .back-link, .compressor-page > .eyebrow, .compressor-page > h1, .compressor-page > .page-intro", {
    y: 14, opacity: 0, duration: 0.55, stagger: 0.07, ease: "power2.out",
  });
  gsap.from(".compressor-panel", { y: 20, opacity: 0, duration: 0.6, delay: 0.22, ease: "power2.out", clearProps: "opacity,transform" });
  gsap.from(".footer-inner > *", { y: 12, opacity: 0, duration: 0.45, stagger: 0.08, delay: 0.45, ease: "power2.out", clearProps: "opacity,transform" });
}

function escapeWifiValue(value) {
  return String(value).replace(/([\\;,:"])/g, "\\$1");
}

function getPayloadText() {
  if (currentMode === "wifi") {
    const ssid = wifiSsidInput.value.trim();
    if (!ssid) return "";
    const auth = wifiAuthSelect.value;
    const pass = auth === "nopass" ? "" : wifiPassInput.value;
    const hidden = wifiHiddenInput.checked ? "true" : "false";
    return `WIFI:T:${auth};S:${escapeWifiValue(ssid)};P:${escapeWifiValue(pass)};H:${hidden};;`;
  }
  return qrTextInput.value.trim();
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function isFinderModule(row, col, count) {
  const topLeft = row < 7 && col < 7;
  const topRight = row < 7 && col >= count - 7;
  const bottomLeft = row >= count - 7 && col < 7;
  return topLeft || topRight || bottomLeft;
}

function drawQrMatrix(ctx, qr, x, y, qrDrawSize, fgColor, bgColor, moduleStyle) {
  const count = qr.getModuleCount();
  const quiet = 4;
  const totalModules = count + quiet * 2;
  const cell = qrDrawSize / totalModules;

  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, qrDrawSize, qrDrawSize);

  ctx.fillStyle = fgColor;
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.isDark(row, col)) continue;
      const mx = x + (col + quiet) * cell;
      const my = y + (row + quiet) * cell;
      if (moduleStyle === "rounded" && !isFinderModule(row, col, count)) {
        drawRoundedRectPath(ctx, mx + cell * 0.06, my + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.36);
        ctx.fill();
      } else {
        ctx.fillRect(Math.floor(mx), Math.floor(my), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}

function drawContainedImage(ctx, img, x, y, boxW, boxH, radius) {
  const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const drawX = x + (boxW - drawW) / 2;
  const drawY = y + (boxH - drawH) / 2;

  ctx.save();
  drawRoundedRectPath(ctx, drawX, drawY, drawW, drawH, radius);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function renderQrCode() {
  errorMessage.hidden = true;
  const text = getPayloadText();
  const qrSize = Number(qrSizeSelect.value) || 1024;
  const fgColor = fgColorInput.value || "#202a28";
  const bgColor = bgColorInput.value || "#ffffff";
  const moduleStyle = moduleStyleSelect.value;
  const caption = captionInput.value.trim();
  const placement = attachedImage ? placementSelect.value : "none";

  if (!text) {
    const ctx = canvas.getContext("2d");
    canvas.width = 512;
    canvas.height = 512;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = fgColor;
    ctx.font = '600 20px "DM Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(currentMode === "wifi" ? "Informe o nome da rede (SSID)" : "Digite um link ou texto", 256, 256);
    qrBadge.textContent = "Aguardando texto";
    downloadButton.disabled = true;
    return;
  }

  if (typeof window.qrcode !== "function") {
    errorMessage.textContent = "A biblioteca de QR Code não carregou.";
    errorMessage.hidden = false;
    downloadButton.disabled = true;
    return;
  }

  let qr;
  try {
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
    const ecc = placement === "center" ? "H" : "M";
    qr = window.qrcode(0, ecc);
    qr.addData(text);
    qr.make();
  } catch {
    errorMessage.textContent = "O texto informado é muito longo para um QR Code.";
    errorMessage.hidden = false;
    downloadButton.disabled = true;
    return;
  }

  downloadButton.disabled = false;
  const ctx = canvas.getContext("2d");
  const outerPad = Math.round(qrSize * 0.055);
  const captionFontSize = Math.round(qrSize * 0.042);
  const captionHeight = caption ? Math.round(captionFontSize * 2.1) : 0;

  if (placement === "top") {
    const maxImgH = Math.round(qrSize * 0.42);
    const imgBoxW = qrSize;
    const gap = Math.round(qrSize * 0.04);
    const totalW = qrSize + outerPad * 2;
    const totalH = outerPad + maxImgH + gap + qrSize + captionHeight + outerPad;
    canvas.width = totalW;
    canvas.height = totalH;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, totalW, totalH);
    drawContainedImage(ctx, attachedImage, outerPad, outerPad, imgBoxW, maxImgH, Math.round(qrSize * 0.03));
    drawQrMatrix(ctx, qr, outerPad, outerPad + maxImgH + gap, qrSize, fgColor, bgColor, moduleStyle);
  } else if (placement === "side") {
    const imgBoxW = Math.round(qrSize * 0.72);
    const gap = Math.round(qrSize * 0.045);
    const totalW = outerPad + imgBoxW + gap + qrSize + outerPad;
    const totalH = outerPad + qrSize + captionHeight + outerPad;
    canvas.width = totalW;
    canvas.height = totalH;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, totalW, totalH);
    drawContainedImage(ctx, attachedImage, outerPad, outerPad, imgBoxW, qrSize, Math.round(qrSize * 0.03));
    drawQrMatrix(ctx, qr, outerPad + imgBoxW + gap, outerPad, qrSize, fgColor, bgColor, moduleStyle);
  } else {
    const totalW = qrSize;
    const totalH = qrSize + captionHeight;
    canvas.width = totalW;
    canvas.height = totalH;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, totalW, totalH);
    drawQrMatrix(ctx, qr, 0, 0, qrSize, fgColor, bgColor, moduleStyle);

    if (placement === "center") {
      const ratio = (Number(logoSizeInput.value) || 20) / 100;
      const boxSize = Math.round(qrSize * ratio);
      const pad = Math.round(boxSize * 0.14);
      const frameSize = boxSize + pad * 2;
      const fx = Math.round((qrSize - frameSize) / 2);
      const fy = Math.round((qrSize - frameSize) / 2);
      ctx.fillStyle = bgColor;
      drawRoundedRectPath(ctx, fx, fy, frameSize, frameSize, Math.round(frameSize * 0.18));
      ctx.fill();
      drawContainedImage(ctx, attachedImage, fx + pad, fy + pad, boxSize, boxSize, Math.round(boxSize * 0.14));
    }
  }

  if (caption) {
    ctx.fillStyle = fgColor;
    ctx.font = `700 ${captionFontSize}px Manrope, "DM Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(caption, canvas.width / 2, canvas.height - Math.round(captionHeight / 2) - (placement === "none" || placement === "center" ? Math.round(qrSize * 0.015) : outerPad * 0.35), canvas.width - outerPad * 2);
  }

  qrBadge.textContent = `${canvas.width} × ${canvas.height} px`;
}

function updateAttachmentControls() {
  const hasImage = Boolean(attachedImage);
  removeImageBtn.hidden = !hasImage;
  attachMeta.hidden = !hasImage;
  placementField.hidden = !hasImage;
  logoSizeField.hidden = !hasImage || placementSelect.value !== "center";
  renderQrCode();
}

function attachFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    errorMessage.textContent = "Selecione um arquivo de imagem válido para anexar.";
    errorMessage.hidden = false;
    return;
  }
  const nextUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    if (attachedImageUrl) URL.revokeObjectURL(attachedImageUrl);
    attachedImageUrl = nextUrl;
    attachedImage = img;
    attachThumb.src = nextUrl;
    attachName.textContent = `${file.name} (${img.naturalWidth} × ${img.naturalHeight} px)`;
    updateAttachmentControls();
  };
  img.onerror = () => {
    URL.revokeObjectURL(nextUrl);
    errorMessage.textContent = "Não foi possível carregar essa imagem.";
    errorMessage.hidden = false;
  };
  img.src = nextUrl;
}

document.querySelectorAll(".mode-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    document.querySelectorAll(".mode-switch button").forEach((btn) => btn.classList.toggle("active", btn === button));
    const isWifi = currentMode === "wifi";
    document.querySelector("#text-content-field").hidden = isWifi;
    document.querySelector("#wifi-ssid-field").hidden = !isWifi;
    document.querySelector("#wifi-pass-field").hidden = !isWifi;
    document.querySelector("#wifi-auth-field").hidden = !isWifi;
    document.querySelector("#wifi-hidden-field").hidden = !isWifi;
    renderQrCode();
  });
});

wifiAuthSelect.addEventListener("change", () => {
  wifiPassInput.disabled = wifiAuthSelect.value === "nopass";
  renderQrCode();
});

document.querySelectorAll(".color-presets button").forEach((button) => {
  button.addEventListener("click", () => {
    fgColorInput.value = button.dataset.fg;
    bgColorInput.value = button.dataset.bg;
    document.querySelectorAll(".color-presets button").forEach((btn) => btn.classList.toggle("active", btn === button));
    renderQrCode();
  });
});

[qrTextInput, wifiSsidInput, wifiPassInput, wifiHiddenInput, fgColorInput, bgColorInput, moduleStyleSelect, qrSizeSelect, captionInput].forEach((el) => {
  el.addEventListener("input", renderQrCode);
  el.addEventListener("change", renderQrCode);
});

placementSelect.addEventListener("change", updateAttachmentControls);
logoSizeInput.addEventListener("input", () => {
  logoSizeValue.textContent = `${logoSizeInput.value}%`;
  renderQrCode();
});

attachInput.addEventListener("change", () => attachFile(attachInput.files[0]));
removeImageBtn.addEventListener("click", () => {
  if (attachedImageUrl) URL.revokeObjectURL(attachedImageUrl);
  attachedImageUrl = null;
  attachedImage = null;
  attachInput.value = "";
  updateAttachmentControls();
});

attachBox.addEventListener("dragover", (event) => { event.preventDefault(); attachBox.classList.add("dragover"); });
attachBox.addEventListener("dragleave", () => attachBox.classList.remove("dragover"));
attachBox.addEventListener("drop", (event) => {
  event.preventDefault();
  attachBox.classList.remove("dragover");
  attachFile(event.dataTransfer.files[0]);
});

downloadButton.addEventListener("click", async () => {
  if (downloadButton.disabled) return;
  const mime = downloadFormatSelect.value;
  const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.95));
  if (!blob) {
    errorMessage.textContent = "Não foi possível gerar o arquivo para download.";
    errorMessage.hidden = false;
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `qrcode-canivete.${ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

renderQrCode();

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
    content: `<article><h3>O QR Code continua funcionando com uma imagem no centro?</h3><p>Sim. Quando você posiciona uma imagem no centro, o nível de correção de erro sobe automaticamente para 30% (nível H) para garantir a leitura.</p></article><article><h3>Posso anexar uma imagem acima ou ao lado?</h3><p>Sim! Além do modo logo central, você pode colocar a imagem acima ou ao lado do QR Code e baixar tudo em um único arquivo.</p></article><article><h3>Como posso apoiar ou contribuir?</h3><p>Você pode apoiar pelo botão do café ou acompanhar o projeto pelo <a href="https://github.com/Kyouz2148/canivetedigital" target="_blank" rel="noreferrer">GitHub</a>.</p></article>`,
  },
  privacy: {
    title: "Privacidade",
    content: `<p>Os QR Codes e imagens anexadas são processados diretamente no seu navegador. Nenhum dado ou imagem é enviado para fora.</p><p>A preferência do tema fica salva apenas neste navegador.</p>`,
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
