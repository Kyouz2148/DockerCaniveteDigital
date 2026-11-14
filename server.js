const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { Pool } = require("pg");
const sharp = require("sharp");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";
const MAX_IMAGE_BYTES = 500 * 1024;
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
const MIN_TTL_SECONDS = 60;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const ALLOWED_SHARP_FORMATS = new Set(["jpeg", "png", "webp", "tiff", "gif", "heif"]);
const PRIVATE_FILES = new Set([
  "README.md",
  "server.js",
  "package.json",
  "package-lock.json",
  "discloud.config",
  ".discloudignore",
  ".gitignore",
  ".env",
]);

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const requestedDriver = String(process.env.DB_DRIVER || "").trim().toLowerCase();
const SQLITE_PATH = path.resolve(ROOT, process.env.SQLITE_PATH || path.join(".data", "canivete.db"));
const usePostgres = requestedDriver === "postgres"
  ? Boolean(process.env.DATABASE_URL)
  : requestedDriver !== "sqlite" && Boolean(process.env.DATABASE_URL);
const useSqlite = requestedDriver === "sqlite" || !usePostgres;

function createPool() {
  if (!usePostgres) return null;
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return null;
  let connectionString = rawUrl;
  let useSsl = false;
  try {
    const parsed = new URL(rawUrl);
    const sslParam = parsed.searchParams.get("ssl") || parsed.searchParams.get("sslmode");
    useSsl = Boolean(sslParam && sslParam !== "false" && sslParam !== "disable");
    parsed.searchParams.delete("ssl");
    parsed.searchParams.delete("sslmode");
    connectionString = parsed.toString();
  } catch {
    useSsl = /ssl=true|sslmode=require|sslmode=verify/i.test(rawUrl);
  }
  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 5,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
  });
}

const pool = createPool();
let sqliteDb = null;
let schemaReadyPromise = null;

function getSqliteDb() {
  if (!useSqlite) return null;
  if (!sqliteDb) {
    fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
    sqliteDb = new DatabaseSync(SQLITE_PATH);
    sqliteDb.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS hosted_images (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'image/webp',
        data BLOB NOT NULL,
        original_bytes INTEGER NOT NULL,
        stored_bytes INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        delete_token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_hosted_images_expires_at ON hosted_images (expires_at);
      CREATE TABLE IF NOT EXISTS short_links (
        code TEXT PRIMARY KEY,
        target_url TEXT NOT NULL,
        clicks INTEGER NOT NULL DEFAULT 0,
        delete_token TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }
  return sqliteDb;
}

async function ensureSchema() {
  if (useSqlite) {
    getSqliteDb();
    return;
  }
  if (!pool) throw new Error("DATABASE_URL não configurada.");
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hosted_images (
          id TEXT PRIMARY KEY,
          original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL DEFAULT 'image/webp',
          data BYTEA NOT NULL,
          original_bytes INTEGER NOT NULL,
          stored_bytes INTEGER NOT NULL,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          delete_token TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_hosted_images_expires_at ON hosted_images (expires_at);`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS short_links (
          code TEXT PRIMARY KEY,
          target_url TEXT NOT NULL,
          clicks INTEGER NOT NULL DEFAULT 0,
          delete_token TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}

async function cleanupExpiredImages() {
  if (useSqlite) {
    try {
      const db = getSqliteDb();
      db.prepare("DELETE FROM hosted_images WHERE expires_at <= ?").run(Date.now());
    } catch (error) {
      console.error("Erro na limpeza do SQLite:", error.message);
    }
    return;
  }
  if (!pool) return;
  try {
    await ensureSchema();
    await pool.query("DELETE FROM hosted_images WHERE expires_at <= NOW()");
  } catch {
    // Database may be temporarily unreachable (e.g. sandboxed preview without egress to port 5432).
  }
}

if (useSqlite || pool) {
  cleanupExpiredImages();
  const cleanupTimer = setInterval(cleanupExpiredImages, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

function sendError(response, statusCode, message) {
  const body = `${message}\n`;
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function readRawBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      request.resume();
      reject(error);
    };
    const contentLength = Number(request.headers["content-length"] || 0);
    if (contentLength > maxBytes) {
      fail(Object.assign(new Error("A imagem excede o limite máximo de 500 KB."), { statusCode: 413 }));
      return;
    }
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        fail(Object.assign(new Error("A imagem excede o limite máximo de 500 KB."), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    request.on("error", (err) => fail(err));
  });
}

async function handleImageUpload(request, response) {
  if (!useSqlite && !pool) {
    sendJson(response, 503, { error: "Banco de dados não configurado." });
    return;
  }

  let body;
  try {
    body = await readRawBody(request, MAX_IMAGE_BYTES);
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message || "Falha ao ler arquivo enviado." });
    return;
  }

  if (!body.length) {
    sendJson(response, 400, { error: "Nenhum arquivo de imagem foi enviado." });
    return;
  }

  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (contentType && !contentType.startsWith("image/") && contentType !== "application/octet-stream") {
    sendJson(response, 400, { error: "Apenas arquivos de imagem são permitidos." });
    return;
  }

  const requestedTtl = Number(request.headers["x-ttl-seconds"] || MAX_TTL_SECONDS);
  if (!Number.isFinite(requestedTtl) || requestedTtl < MIN_TTL_SECONDS || requestedTtl > MAX_TTL_SECONDS) {
    sendJson(response, 400, { error: "O tempo de hospedagem deve ser entre 1 minuto e no máximo 7 dias." });
    return;
  }
  const ttlSeconds = Math.round(requestedTtl);

  let rawOriginalBytes = Number(request.headers["x-original-bytes"] || body.length);
  if (!Number.isFinite(rawOriginalBytes) || rawOriginalBytes <= 0) rawOriginalBytes = body.length;
  if (rawOriginalBytes > MAX_IMAGE_BYTES) {
    sendJson(response, 413, { error: "A imagem original excede o limite máximo de 500 KB." });
    return;
  }

  let metadata;
  try {
    metadata = await sharp(body, { animated: true, limitInputPixels: 25_000_000 }).metadata();
  } catch {
    sendJson(response, 400, { error: "Arquivo inválido. Envie apenas uma imagem real (JPG, PNG, WebP, GIF, AVIF ou BMP)." });
    return;
  }

  if (!metadata?.format || !ALLOWED_SHARP_FORMATS.has(metadata.format) || !metadata.width || !metadata.height) {
    sendJson(response, 400, { error: "Formato não permitido. Envie apenas arquivos de imagem." });
    return;
  }

  let optimizedBuffer;
  let outInfo;
  try {
    const isAnimated = Boolean(metadata.pages && metadata.pages > 1);
    const pipeline = sharp(body, { animated: isAnimated, limitInputPixels: 25_000_000 });
    if (!isAnimated) pipeline.rotate();
    const { data, info } = await pipeline
      .webp({ quality: 68, alphaQuality: 75, effort: 6, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });

    optimizedBuffer = data;
    outInfo = info;

    if (optimizedBuffer.length > MAX_IMAGE_BYTES) {
      const retry = await sharp(body, { animated: isAnimated, limitInputPixels: 25_000_000 })
        .webp({ quality: 45, alphaQuality: 60, effort: 6, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      optimizedBuffer = retry.data;
      outInfo = retry.info;
    }

    if (optimizedBuffer.length > MAX_IMAGE_BYTES) {
      sendJson(response, 413, { error: "Não foi possível otimizar a imagem para menos de 500 KB." });
      return;
    }
  } catch {
    sendJson(response, 400, { error: "Não foi possível processar e converter esta imagem." });
    return;
  }

  const rawName = decodeURIComponent(String(request.headers["x-file-name"] || "imagem")).slice(0, 120);
  const safeName = rawName.replace(/[^\w.\- ()]/g, "_") || "imagem";
  const id = crypto.randomBytes(6).toString("base64url");
  const deleteToken = crypto.randomBytes(12).toString("base64url");
  const outWidth = outInfo.width || metadata.width;
  const outHeight = outInfo.height || metadata.height;

  try {
    await ensureSchema();
    if (useSqlite) {
      const db = getSqliteDb();
      const nowMs = Date.now();
      const createdAt = new Date(nowMs).toISOString();
      const expiresAtMs = nowMs + ttlSeconds * 1000;
      db.prepare("DELETE FROM hosted_images WHERE expires_at <= ?").run(nowMs);
      db.prepare(
        `INSERT INTO hosted_images (id, original_name, mime_type, data, original_bytes, stored_bytes, width, height, delete_token, created_at, expires_at)
         VALUES (?, ?, 'image/webp', ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        safeName,
        optimizedBuffer,
        Math.round(rawOriginalBytes),
        optimizedBuffer.length,
        outWidth,
        outHeight,
        deleteToken,
        createdAt,
        expiresAtMs,
      );
      sendJson(response, 201, {
        id,
        url: `/i/${id}`,
        mimeType: "image/webp",
        originalBytes: Math.round(rawOriginalBytes),
        storedBytes: optimizedBuffer.length,
        width: outWidth,
        height: outHeight,
        createdAt,
        expiresAt: new Date(expiresAtMs).toISOString(),
        deleteToken,
        storage: "sqlite",
      });
      return;
    }

    await pool.query("DELETE FROM hosted_images WHERE expires_at <= NOW()");
    const insertResult = await pool.query(
      `INSERT INTO hosted_images (id, original_name, mime_type, data, original_bytes, stored_bytes, width, height, delete_token, expires_at)
       VALUES ($1, $2, 'image/webp', $3, $4, $5, $6, $7, $8, NOW() + ($9 * INTERVAL '1 second'))
       RETURNING id, original_bytes, stored_bytes, width, height, created_at, expires_at`,
      [
        id,
        safeName,
        optimizedBuffer,
        Math.round(rawOriginalBytes),
        optimizedBuffer.length,
        outWidth,
        outHeight,
        deleteToken,
        ttlSeconds,
      ],
    );
    const row = insertResult.rows[0];
    sendJson(response, 201, {
      id: row.id,
      url: `/i/${row.id}`,
      mimeType: "image/webp",
      originalBytes: row.original_bytes,
      storedBytes: row.stored_bytes,
      width: row.width,
      height: row.height,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      deleteToken,
      storage: "postgres",
    });
  } catch (error) {
    console.error("Erro ao salvar imagem no banco de dados:", error.message);
    sendJson(response, 503, { error: "Não foi possível salvar a imagem no banco de dados." });
  }
}

async function handleServeHostedImage(request, response, id) {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) {
    sendError(response, 404, "Imagem não encontrada");
    return;
  }
  if (!useSqlite && !pool) {
    sendError(response, 503, "Banco de dados indisponível");
    return;
  }
  try {
    await ensureSchema();
    let row;
    if (useSqlite) {
      const db = getSqliteDb();
      row = db.prepare("SELECT mime_type, data, stored_bytes, expires_at FROM hosted_images WHERE id = ?").get(id);
      if (!row) {
        sendError(response, 404, "Imagem não encontrada ou expirada");
        return;
      }
      if (Number(row.expires_at) <= Date.now()) {
        db.prepare("DELETE FROM hosted_images WHERE id = ?").run(id);
        sendError(response, 404, "Imagem expirada e removida");
        return;
      }
      row.data = Buffer.from(row.data);
    } else {
      const result = await pool.query(
        `SELECT mime_type, data, stored_bytes, expires_at FROM hosted_images WHERE id = $1`,
        [id],
      );
      if (!result.rows.length) {
        sendError(response, 404, "Imagem não encontrada ou expirada");
        return;
      }
      row = result.rows[0];
      if (new Date(row.expires_at) <= new Date()) {
        await pool.query("DELETE FROM hosted_images WHERE id = $1", [id]);
        sendError(response, 404, "Imagem expirada e removida");
        return;
      }
    }

    response.writeHead(200, {
      "Content-Type": row.mime_type || "image/webp",
      "Content-Length": row.data.length,
      "Cache-Control": "public, max-age=300",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(row.data);
  } catch (error) {
    console.error("Erro ao buscar imagem no banco de dados:", error.message);
    sendError(response, 503, "Não foi possível acessar o banco de dados");
  }
}

async function handleDeleteHostedImage(request, response, id) {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) {
    sendJson(response, 404, { error: "Imagem não encontrada." });
    return;
  }
  if (!useSqlite && !pool) {
    sendJson(response, 503, { error: "Banco de dados indisponível." });
    return;
  }
  const token = String(request.headers["x-delete-token"] || "");
  if (!token) {
    sendJson(response, 403, { error: "Token de exclusão ausente." });
    return;
  }
  try {
    await ensureSchema();
    if (useSqlite) {
      const db = getSqliteDb();
      const info = db.prepare("DELETE FROM hosted_images WHERE id = ? AND delete_token = ?").run(id, token);
      if (!info.changes) {
        sendJson(response, 404, { error: "Imagem não encontrada ou token inválido." });
        return;
      }
      sendJson(response, 200, { deleted: true, id });
      return;
    }

    const result = await pool.query(
      "DELETE FROM hosted_images WHERE id = $1 AND delete_token = $2 RETURNING id",
      [id, token],
    );
    if (!result.rowCount) {
      sendJson(response, 404, { error: "Imagem não encontrada ou token inválido." });
      return;
    }
    sendJson(response, 200, { deleted: true, id });
  } catch (error) {
    console.error("Erro ao excluir imagem no banco de dados:", error.message);
    sendJson(response, 503, { error: "Não foi possível excluir a imagem no banco de dados." });
  }
}

const LOCAL_LINKS_FILE = path.join(ROOT, ".data", "short-links.json");
function readLocalLinks() {
  try {
    if (!fs.existsSync(LOCAL_LINKS_FILE)) return {};
    return JSON.parse(fs.readFileSync(LOCAL_LINKS_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}
function writeLocalLinks(data) {
  fs.mkdirSync(path.dirname(LOCAL_LINKS_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_LINKS_FILE, JSON.stringify(data, null, 2));
}

async function createShortLinkRecord(code, targetUrl, deleteToken) {
  if (useSqlite) {
    const db = getSqliteDb();
    const createdAt = new Date().toISOString();
    try {
      db.prepare("INSERT INTO short_links (code, target_url, clicks, delete_token, created_at) VALUES (?, ?, 0, ?, ?)").run(
        code,
        targetUrl,
        deleteToken,
        createdAt,
      );
      return { code, target_url: targetUrl, clicks: 0, created_at: createdAt, storage: "sqlite" };
    } catch (error) {
      if (/UNIQUE constraint failed/i.test(error.message)) {
        throw Object.assign(new Error("Este apelido já está em uso."), { statusCode: 409 });
      }
      throw error;
    }
  }

  if (pool) {
    try {
      await ensureSchema();
      const res = await pool.query(
        `INSERT INTO short_links (code, target_url, delete_token)
         VALUES ($1, $2, $3)
         RETURNING code, target_url, clicks, created_at`,
        [code, targetUrl, deleteToken],
      );
      return { ...res.rows[0], storage: "postgres" };
    } catch (error) {
      if (error.code === "23505") throw Object.assign(new Error("Este apelido já está em uso."), { statusCode: 409 });
    }
  }
  const links = readLocalLinks();
  if (Object.hasOwn(links, code)) {
    throw Object.assign(new Error("Este apelido já está em uso."), { statusCode: 409 });
  }
  const entry = { code, target_url: targetUrl, clicks: 0, delete_token: deleteToken, created_at: new Date().toISOString() };
  links[code] = entry;
  writeLocalLinks(links);
  return { ...entry, storage: "local" };
}

async function resolveShortLinkRecord(code, incrementClicks = false) {
  if (useSqlite) {
    const db = getSqliteDb();
    if (incrementClicks) {
      return db
        .prepare("UPDATE short_links SET clicks = clicks + 1 WHERE code = ? RETURNING code, target_url, clicks, created_at")
        .get(code) || null;
    }
    return db.prepare("SELECT code, target_url, clicks, created_at FROM short_links WHERE code = ?").get(code) || null;
  }

  if (pool) {
    try {
      await ensureSchema();
      const sql = incrementClicks
        ? "UPDATE short_links SET clicks = clicks + 1 WHERE code = $1 RETURNING code, target_url, clicks, created_at"
        : "SELECT code, target_url, clicks, created_at FROM short_links WHERE code = $1";
      const res = await pool.query(sql, [code]);
      if (res.rows.length) return res.rows[0];
    } catch {
      // Fallback to local store when database is unreachable in sandboxed preview.
    }
  }
  const links = readLocalLinks();
  const entry = Object.hasOwn(links, code) ? links[code] : null;
  if (!entry) return null;
  if (incrementClicks) {
    entry.clicks = (entry.clicks || 0) + 1;
    writeLocalLinks(links);
  }
  return entry;
}

async function deleteShortLinkRecord(code, token) {
  if (useSqlite) {
    const db = getSqliteDb();
    const info = db.prepare("DELETE FROM short_links WHERE code = ? AND delete_token = ?").run(code, token);
    return info.changes > 0;
  }

  if (pool) {
    try {
      await ensureSchema();
      const res = await pool.query("DELETE FROM short_links WHERE code = $1 AND delete_token = $2 RETURNING code", [code, token]);
      if (res.rowCount) return true;
    } catch {
      // Fallback to local store when database is unreachable.
    }
  }
  const links = readLocalLinks();
  if (!Object.hasOwn(links, code) || links[code].delete_token !== token) return false;
  delete links[code];
  writeLocalLinks(links);
  return true;
}

async function shortenViaExternalProvider(targetUrl, customCode) {
  if (customCode && !/^[A-Za-z0-9_]{5,30}$/.test(customCode)) {
    throw Object.assign(
      new Error("No modo ultra curto, o apelido deve ter de 5 a 30 caracteres (apenas letras, números ou _)."),
      { statusCode: 400 },
    );
  }

  const tryIsGdFormat = async (domain) => {
    const endpoint = new URL(`https://${domain}/create.php`);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("url", targetUrl);
    if (customCode) endpoint.searchParams.set("shorturl", customCode);

    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.shorturl) {
      return { shortUrl: data.shorturl, provider: domain };
    }
    if (data?.errorcode === 2) {
      throw Object.assign(
        new Error("Este apelido já está em uso ou não é permitido. Escolha outro."),
        { statusCode: 409 },
      );
    }
    if (data?.errorcode === 1) {
      throw Object.assign(
        new Error("Não foi possível encurtar este endereço externamente (verifique se é uma URL pública válida)."),
        { statusCode: 400 },
      );
    }
    throw new Error(data?.errormessage || `Falha em ${domain}`);
  };

  try {
    return await tryIsGdFormat("is.gd");
  } catch (error) {
    if (error.statusCode) throw error;
  }

  try {
    return await tryIsGdFormat("v.gd");
  } catch (error) {
    if (error.statusCode) throw error;
  }

  if (!customCode) {
    const tinyEndpoint = new URL("https://tinyurl.com/api-create.php");
    tinyEndpoint.searchParams.set("url", targetUrl);
    const res = await fetch(tinyEndpoint, { signal: AbortSignal.timeout(8000) });
    const text = (await res.text()).trim();
    if (res.ok && /^https?:\/\/tinyurl\.com\/[A-Za-z0-9]+$/i.test(text)) {
      return { shortUrl: text, provider: "tinyurl.com" };
    }
  }

  throw Object.assign(
    new Error("Não foi possível encurtar o link no serviço externo agora. Tente novamente ou use o modo 'Neste site'."),
    { statusCode: 502 },
  );
}

async function handleCreateShortLink(request, response) {
  let body;
  try {
    body = await readRawBody(request, 8192);
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message || "Requisição inválida." });
    return;
  }
  let payload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    sendJson(response, 400, { error: "Envie um JSON válido." });
    return;
  }

  let rawUrl = String(payload?.url || "").trim();
  if (!rawUrl) {
    sendJson(response, 400, { error: "Informe o link que deseja encurtar." });
    return;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
    rawUrl = `https://${rawUrl}`;
  }
  if (rawUrl.length > 2048) {
    sendJson(response, 400, { error: "O link é longo demais (máximo 2048 caracteres)." });
    return;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    sendJson(response, 400, { error: "Informe uma URL válida (ex.: https://exemplo.com)." });
    return;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    sendJson(response, 400, { error: "Apenas links http:// ou https:// são permitidos." });
    return;
  }

  const mode = payload?.mode === "local" ? "local" : "short";
  const customCode = String(payload?.customCode || "").trim();
  const normalizedUrl = parsedUrl.toString();

  if (mode === "short") {
    try {
      const shortened = await shortenViaExternalProvider(normalizedUrl, customCode);
      const code = shortened.shortUrl.split("/").pop() || "";
      sendJson(response, 201, {
        mode: "short",
        provider: shortened.provider,
        code: `${shortened.provider}:${code}`,
        shortUrl: shortened.shortUrl,
        targetUrl: normalizedUrl,
        originalLength: normalizedUrl.length,
        shortLength: shortened.shortUrl.length,
        savedChars: normalizedUrl.length - shortened.shortUrl.length,
        createdAt: new Date().toISOString(),
      });
      return;
    } catch (error) {
      sendJson(response, error.statusCode || 502, { error: error.message || "Não foi possível encurtar este link." });
      return;
    }
  }

  if (customCode && !/^[A-Za-z0-9_-]{3,32}$/.test(customCode)) {
    sendJson(response, 400, { error: "O apelido personalizado deve ter de 3 a 32 caracteres (letras, números, - ou _)." });
    return;
  }

  const deleteToken = crypto.randomBytes(12).toString("base64url");
  for (let attempt = 0; attempt < (customCode ? 1 : 5); attempt += 1) {
    const code = customCode || crypto.randomBytes(4).toString("base64url").slice(0, 6);
    try {
      const created = await createShortLinkRecord(code, normalizedUrl, deleteToken);
      sendJson(response, 201, {
        mode: "local",
        code: created.code,
        shortPath: `/s/${created.code}`,
        targetUrl: created.target_url,
        clicks: created.clicks,
        createdAt: created.created_at,
        deleteToken,
        storage: created.storage,
      });
      return;
    } catch (error) {
      if (error.statusCode === 409 && !customCode) continue;
      sendJson(response, error.statusCode || 500, { error: error.message || "Não foi possível encurtar este link." });
      return;
    }
  }
  sendJson(response, 500, { error: "Não foi possível gerar um código único. Tente novamente." });
}

async function handleGetShortLinkMeta(request, response, code) {
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) {
    sendJson(response, 404, { error: "Link encurtado não encontrado." });
    return;
  }
  const entry = await resolveShortLinkRecord(code, false);
  if (!entry) {
    sendJson(response, 404, { error: "Link encurtado não encontrado." });
    return;
  }
  sendJson(response, 200, {
    code: entry.code,
    shortPath: `/s/${entry.code}`,
    targetUrl: entry.target_url,
    clicks: entry.clicks || 0,
    createdAt: entry.created_at,
  });
}

async function handleDeleteShortLink(request, response, code) {
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) {
    sendJson(response, 404, { error: "Link não encontrado." });
    return;
  }
  const token = String(request.headers["x-delete-token"] || "");
  if (!token) {
    sendJson(response, 403, { error: "Token de exclusão ausente." });
    return;
  }
  const ok = await deleteShortLinkRecord(code, token);
  if (!ok) {
    sendJson(response, 404, { error: "Link não encontrado ou token inválido." });
    return;
  }
  sendJson(response, 200, { deleted: true, code });
}

async function handleRedirectShortLink(request, response, code) {
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) {
    sendError(response, 404, "Link encurtado não encontrado");
    return;
  }
  const entry = await resolveShortLinkRecord(code, request.method === "GET");
  if (!entry) {
    sendError(response, 404, "Link encurtado não encontrado");
    return;
  }
  response.writeHead(302, {
    Location: entry.target_url,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end();
}

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    sendError(response, 400, "Endereço inválido");
    return;
  }

  if (pathname === "/api/images") {
    if (request.method === "POST") {
      handleImageUpload(request, response);
      return;
    }
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Método não permitido." });
    return;
  }

  if (pathname.startsWith("/api/images/")) {
    const id = pathname.slice("/api/images/".length);
    if (request.method === "DELETE") {
      handleDeleteHostedImage(request, response, id);
      return;
    }
    response.setHeader("Allow", "DELETE");
    sendJson(response, 405, { error: "Método não permitido." });
    return;
  }

  if (pathname === "/api/links") {
    if (request.method === "POST") {
      handleCreateShortLink(request, response);
      return;
    }
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Método não permitido." });
    return;
  }

  if (pathname.startsWith("/api/links/")) {
    const code = pathname.slice("/api/links/".length);
    if (request.method === "GET") {
      handleGetShortLinkMeta(request, response, code);
      return;
    }
    if (request.method === "DELETE") {
      handleDeleteShortLink(request, response, code);
      return;
    }
    response.setHeader("Allow", "GET, DELETE");
    sendJson(response, 405, { error: "Método não permitido." });
    return;
  }

  if (pathname.startsWith("/s/")) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      sendError(response, 405, "Método não permitido");
      return;
    }
    const code = pathname.slice("/s/".length);
    handleRedirectShortLink(request, response, code);
    return;
  }

  if (pathname.startsWith("/i/")) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      sendError(response, 405, "Método não permitido");
      return;
    }
    const id = pathname.slice("/i/".length);
    handleServeHostedImage(request, response, id);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendError(response, 405, "Método não permitido");
    return;
  }

  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    sendError(response, 403, "Acesso negado");
    return;
  }
  const relativePath = path.relative(ROOT, filePath);
  if (PRIVATE_FILES.has(relativePath) || relativePath.split(path.sep).some((part) => part.startsWith("."))) {
    sendError(response, 404, "Arquivo não encontrado");
    return;
  }

  fs.stat(filePath, (statError, initialStats) => {
    if (statError) {
      sendError(response, 404, "Arquivo não encontrado");
      return;
    }

    const resolvedFile = initialStats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    fs.stat(resolvedFile, (fileError, stats) => {
      if (fileError || !stats.isFile()) {
        sendError(response, 404, "Arquivo não encontrado");
        return;
      }

      const headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": resolvedFile === path.join(ROOT, "index.html") ? "no-cache" : "public, max-age=3600",
        "Content-Type": MIME_TYPES[path.extname(resolvedFile).toLowerCase()] || "application/octet-stream",
        "Last-Modified": stats.mtime.toUTCString(),
        "X-Content-Type-Options": "nosniff",
      };

      let start = 0;
      let end = stats.size - 1;
      let statusCode = 200;
      const rangeHeader = request.headers.range;
      if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
        if (!match || (!match[1] && !match[2])) {
          response.setHeader("Content-Range", `bytes */${stats.size}`);
          sendError(response, 416, "Intervalo de bytes inválido");
          return;
        }

        if (!match[1]) {
          const suffixLength = Number(match[2]);
          start = Math.max(stats.size - suffixLength, 0);
        } else {
          start = Number(match[1]);
          if (match[2]) end = Number(match[2]);
        }
        end = Math.min(end, stats.size - 1);
        if (start > end || start >= stats.size) {
          response.setHeader("Content-Range", `bytes */${stats.size}`);
          sendError(response, 416, "Intervalo de bytes fora do arquivo");
          return;
        }
        statusCode = 206;
        headers["Content-Range"] = `bytes ${start}-${end}/${stats.size}`;
      }

      headers["Content-Length"] = end - start + 1;
      response.writeHead(statusCode, headers);
      if (request.method === "HEAD") {
        response.end();
        return;
      }

      const stream = fs.createReadStream(resolvedFile, { start, end });
      stream.on("error", () => {
        if (!response.headersSent) sendError(response, 500, "Não foi possível ler o arquivo");
        else response.destroy();
      });
      stream.pipe(response);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Canivete Digital disponível em http://${HOST}:${PORT}`);
});
