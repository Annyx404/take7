import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const API = "https://reidosembeds.lat/api/channels";

const SOURCES = [
  "https://raw.githubusercontent.com/limaalef/BrazilTVEPG/main/epg.xml",
  "https://raw.githubusercontent.com/limaalef/BrazilTVEPG/main/claro.xml",
  "https://raw.githubusercontent.com/limaalef/BrazilTVEPG/main/globo.xml",
  "https://raw.githubusercontent.com/limaalef/BrazilTVEPG/main/vivoplay.xml",
  "https://raw.githubusercontent.com/limaalef/BrazilTVEPG/main/plutotv.xml"
];

const WINDOW_HOURS = 30;
const MAX_PER_CHANNEL = 16;

const TECH = new Set(["hd", "sd", "fhd", "uhd", "4k", "uhd4k", "fullhd"]);

const NOISE = new Set([
  "tv", "canal", "channel", "brasil", "brazil", "br", "the", "de", "da", "do",
  "e", "network", "oficial", "ao", "vivo", "live"
]);

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/\+/g, " mais ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value) {
  return norm(value).split(" ").filter((w) => w && !TECH.has(w));
}

function key(value) {
  const all = words(value);
  const strong = all.filter((w) => !NOISE.has(w));
  return (strong.length ? strong : all).join("");
}

function keysOf(value) {
  const base = words(value).join("");
  const out = [key(value)];
  if (base && !out.includes(base)) out.push(base);
  return out.filter(Boolean);
}

async function grab(url) {
  const reply = await fetch(url, {
    headers: {
      "Accept": "*/*",
      "User-Agent": "take7-epg-builder"
    }
  });
  if (!reply.ok) throw new Error(url + " -> HTTP " + reply.status);
  const buffer = Buffer.from(await reply.arrayBuffer());
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) return gunzipSync(buffer).toString("utf8");
  return buffer.toString("utf8");
}

function stamp(raw) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}))?/.exec(String(raw).trim());
  if (!m) return 0;
  const [, y, mo, d, h, mi, s, off] = m;
  let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (off) {
    const sign = off[0] === "-" ? -1 : 1;
    const hours = +off.slice(1, 3);
    const mins = +off.slice(3, 5);
    ms -= sign * (hours * 60 + mins) * 60000;
  }
  return Math.floor(ms / 1000);
}

function unescapeXml(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, "&");
}

function parseXmltv(xml) {
  const names = new Map();
  const channelRe = /<channel\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/g;
  let m;
  while ((m = channelRe.exec(xml)) !== null) {
    const id = unescapeXml(m[1]);
    const labels = [];
    const nameRe = /<display-name[^>]*>([\s\S]*?)<\/display-name>/g;
    let n;
    while ((n = nameRe.exec(m[2])) !== null) labels.push(unescapeXml(n[1]).trim());
    names.set(id, labels);
  }

  const shows = new Map();
  const progRe = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
  while ((m = progRe.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const idm = /\bchannel="([^"]+)"/.exec(attrs);
    const startm = /\bstart="([^"]+)"/.exec(attrs);
    if (!idm || !startm) continue;
    const stopm = /\bstop="([^"]+)"/.exec(attrs);
    const titlem = /<title[^>]*>([\s\S]*?)<\/title>/.exec(body);
    if (!titlem) continue;
    const id = unescapeXml(idm[1]);
    const title = unescapeXml(titlem[1]).trim();
    if (!title) continue;
    const start = stamp(startm[1]);
    if (!start) continue;
    const stop = stopm ? stamp(stopm[1]) : 0;
    if (!shows.has(id)) shows.set(id, []);
    shows.get(id).push([start, stop, title]);
  }
  return { names, shows };
}

async function main() {
  const overridesPath = "scripts/channel-map.json";
  const overrides = existsSync(overridesPath)
    ? JSON.parse(readFileSync(overridesPath, "utf8"))
    : {};

  const apiReply = await fetch(API, {
    headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (Linux; Android 13)" }
  });
  if (!apiReply.ok) throw new Error("API de canais respondeu " + apiReply.status);
  const apiBody = await apiReply.json();
  const channels = (apiBody.data || apiBody.channels || []).filter((c) => c.is_active !== false);
  if (!channels.length) throw new Error("A API nao devolveu canais");

  const names = new Map();
  const shows = new Map();
  for (const url of SOURCES) {
    try {
      const xml = await grab(url);
      const parsed = parseXmltv(xml);
      for (const [id, labels] of parsed.names) {
        if (!names.has(id)) names.set(id, []);
        names.get(id).push(...labels);
      }
      for (const [id, list] of parsed.shows) {
        if (!shows.has(id)) shows.set(id, []);
        shows.get(id).push(...list);
      }
      console.log("ok   " + url.split("/").pop() + "  canais=" + parsed.names.size + " programas=" + parsed.shows.size);
    } catch (err) {
      console.log("falha " + url.split("/").pop() + "  " + err.message);
    }
  }

  const byKey = new Map();
  const index = (label, id) => {
    for (const k of keysOf(label)) {
      if (!byKey.has(k)) byKey.set(k, id);
    }
  };
  for (const [id, labels] of names) {
    for (const label of [...labels, id, id.replace(/\.[a-z]{2}$/i, "")]) index(label, id);
  }
  for (const id of shows.keys()) {
    index(id, id);
    index(id.replace(/\.[a-z]{2}$/i, ""), id);
  }

  const now = Math.floor(Date.now() / 1000);
  const limit = now + WINDOW_HOURS * 3600;
  const out = {};
  const missing = [];
  let matched = 0;

  for (const channel of channels) {
    const manual = overrides[channel.id];
    let epgId = manual && shows.has(manual) ? manual : null;
    if (!epgId) {
      outer: for (const candidate of [channel.name, channel.id]) {
        for (const k of keysOf(candidate)) {
          const found = byKey.get(k);
          if (found && shows.has(found)) {
            epgId = found;
            break outer;
          }
        }
      }
    }
    if (!epgId) {
      missing.push(channel.name);
      continue;
    }
    const list = (shows.get(epgId) || [])
      .filter((p) => (p[1] || p[0] + 1800) > now && p[0] < limit)
      .sort((a, b) => a[0] - b[0])
      .slice(0, MAX_PER_CHANNEL);
    if (!list.length) {
      missing.push(channel.name);
      continue;
    }
    out[channel.id] = list;
    matched += 1;
  }

  mkdirSync("public", { recursive: true });
  writeFileSync(
    "guide.json",
    JSON.stringify({ updated: now, channels: out })
  );

  console.log("");
  console.log("canais da API .... " + channels.length);
  console.log("com programacao .. " + matched);
  console.log("sem programacao .. " + missing.length);
  if (missing.length) {
    writeFileSync("scripts/missing.txt", missing.join("\n") + "\n");
    console.log("lista dos sem guia em scripts/missing.txt");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
