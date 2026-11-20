(() => {
  "use strict";

  const CONFIG = {
    githubUser: "Take-7",
    repo: "Take-7.github.io",
    tvTag: "tv-latest",
    tmdbKey: "",
    instagramUrl: "https://www.instagram.com/annyx.mp3",
    youtubeUrl: "https://youtube.com/@annyx.mp4"
  };

  const CACHE_KEY = "t7_catalog_v2";
  const $ = (id) => document.getElementById(id);

  let toastTimer = 0;
  function showToast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function setupGuard() {
    const shield = $("guardShield");
    const lock = (on) => {
      if (shield) shield.classList.toggle("active", on);
    };

    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("dragstart", (e) => e.preventDefault());
    document.addEventListener("selectstart", (e) => e.preventDefault());

    document.addEventListener("keydown", (e) => {
      const k = (e.key || "").toUpperCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (
        k === "F12" ||
        (ctrl && e.shiftKey && (k === "I" || k === "J" || k === "C" || k === "K")) ||
        (ctrl && (k === "U" || k === "S"))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);

    const checkViewport = () => {
      const dw = window.outerWidth - window.innerWidth;
      const dh = window.outerHeight - window.innerHeight;
      const open = (dw > 170 || dh > 170) && window.innerWidth > 480;
      lock(open);
    };

    window.addEventListener("resize", checkViewport);
    setInterval(checkViewport, 1200);
  }

  function setupNavigation() {
    const topbar = $("topbar");
    const burger = $("burgerBtn");
    const drawer = $("drawer");
    const veil = $("drawerVeil");
    const closeBtn = $("drawerClose");
    const isHome = document.body.dataset.page === "home";
    const links = Array.from(document.querySelectorAll("[data-sec]"));
    const sections = ["inicio", "download"].map((id) => $(id)).filter(Boolean);

    const setMenu = (open) => {
      if (!burger || !drawer || !veil) return;
      burger.classList.toggle("open", open);
      drawer.classList.toggle("open", open);
      veil.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      drawer.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
    };

    if (burger) burger.addEventListener("click", () => setMenu(!drawer.classList.contains("open")));
    if (closeBtn) closeBtn.addEventListener("click", () => setMenu(false));
    if (veil) veil.addEventListener("click", () => setMenu(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setMenu(false);
    });

    if (window.location.hash) {
      const targetId = window.location.hash.replace(/^#/, "");
      try {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch {}
      if (isHome && targetId) {
        const el = $(targetId);
        if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 60);
      }
    }

    if (isHome) {
      let pending = "";
      try {
        pending = sessionStorage.getItem("t7_go") || "";
        if (pending) sessionStorage.removeItem("t7_go");
      } catch {}
      if (pending) {
        const el = $(pending);
        if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 80);
      }
    }

    document.querySelectorAll("[data-go]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        setMenu(false);
        const target = $(el.dataset.go);
        if (target) {
          if (el.dataset.go === "inicio") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            target.scrollIntoView({ behavior: "smooth" });
          }
        }
      });
    });

    document.querySelectorAll("[data-jump]").forEach((el) => {
      el.addEventListener("click", () => {
        try {
          sessionStorage.setItem("t7_go", el.dataset.jump);
        } catch {}
      });
    });

    links.forEach((a) => {
      a.addEventListener("click", () => setMenu(false));
    });

    if (isHome && topbar) {
      const onScroll = () => {
        topbar.classList.toggle("scrolled", window.scrollY > 24);
        const y = window.scrollY + 180;
        let active = "inicio";
        sections.forEach((sec) => {
          if (sec.offsetTop <= y) active = sec.id;
        });
        links.forEach((el) => {
          el.classList.toggle("active", el.dataset.sec === active);
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "";
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1).replace(".", ",")} MB` : `${Math.round(bytes / 1024)} KB`;
  }

  function cleanVersion(release, assetName) {
    const fromAsset = (assetName || "").match(/(\d+(?:\.\d+)+)/);
    if (fromAsset) return fromAsset[1];
    const fromName = (release?.name || "").match(/(\d+(?:\.\d+)+)/);
    if (fromName) return fromName[1];
    const tag = (release?.tag_name || "").trim();
    if (tag && !/^tv-latest$/i.test(tag)) return tag.replace(/^v/i, "");
    return "";
  }

  function pickApk(assets, tvOnly) {
    const apks = (Array.isArray(assets) ? assets : [])
      .filter((a) => typeof a?.name === "string" && a.name.toLowerCase().endsWith(".apk"))
      .sort((a, b) => Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0));
    if (tvOnly) {
      return apks.find((a) => /tv/i.test(a.name)) || apks[0] || null;
    }
    return apks.find((a) => !/tv/i.test(a.name)) || apks[0] || null;
  }

  function parseRelease(data, tvOnly, fallbackPage) {
    const picked = pickApk(data?.assets, tvOnly);
    return {
      apk: picked ? picked.browser_download_url : "",
      version: cleanVersion(data, picked?.name),
      size: picked ? picked.size : 0,
      page: data?.html_url || fallbackPage
    };
  }

  async function fetchGithubJson(path) {
    const api = `https://api.github.com/repos/${CONFIG.githubUser}/${CONFIG.repo}${path}`;
    const res = await fetch(api, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function fetchMobileRelease() {
    const fallbackPage = `https://github.com/${CONFIG.githubUser}/${CONFIG.repo}/releases/latest`;
    try {
      const latest = await fetchGithubJson("/releases/latest");
      if (latest) {
        const parsed = parseRelease(latest, false, fallbackPage);
        if (parsed.apk) return parsed;
      }
      const list = await fetchGithubJson("/releases?per_page=10");
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item.draft || item.prerelease || item.tag_name === CONFIG.tvTag) continue;
          const parsed = parseRelease(item, false, fallbackPage);
          if (parsed.apk) return parsed;
        }
      }
      return { apk: "", version: "", size: 0, page: fallbackPage };
    } catch {
      return { apk: "", version: "", size: 0, page: fallbackPage };
    }
  }

  async function fetchTvRelease() {
    const fallbackPage = `https://github.com/${CONFIG.githubUser}/${CONFIG.repo}/releases/tag/${CONFIG.tvTag}`;
    try {
      const tagged = await fetchGithubJson(`/releases/tags/${encodeURIComponent(CONFIG.tvTag)}`);
      if (tagged) {
        const parsed = parseRelease(tagged, true, fallbackPage);
        if (parsed.apk) return parsed;
      }
      const list = await fetchGithubJson("/releases?per_page=10");
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item.draft) continue;
          const assets = Array.isArray(item.assets) ? item.assets : [];
          const hasTv = item.tag_name === CONFIG.tvTag || assets.some((a) => typeof a?.name === "string" && /tv/i.test(a.name) && a.name.toLowerCase().endsWith(".apk"));
          if (!hasTv) continue;
          const parsed = parseRelease(item, true, fallbackPage);
          if (parsed.apk) return parsed;
        }
      }
      return { apk: "", version: "", size: 0, page: fallbackPage };
    } catch {
      return { apk: "", version: "", size: 0, page: fallbackPage };
    }
  }

  function triggerDownload(url) {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    a.setAttribute("download", "");
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function runDownloadAnimation(opts) {
    const { btn, wrap, label, pct, fill, defaultText, onDone } = opts;
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const span = btn.querySelector("span");
    if (span) span.textContent = "Preparando...";
    wrap.classList.add("active");
    wrap.setAttribute("aria-hidden", "false");
    fill.style.width = "0%";
    pct.textContent = "0%";
    label.textContent = "Conectando ao servidor...";

    const steps = [
      { t: 140, p: 24, msg: "Verificando arquivo..." },
      { t: 420, p: 58, msg: "Preparando pacote..." },
      { t: 740, p: 86, msg: "Quase pronto..." },
      { t: 1020, p: 100, msg: "Download iniciado" }
    ];

    steps.forEach((s) => {
      setTimeout(() => {
        fill.style.width = `${s.p}%`;
        pct.textContent = `${s.p}%`;
        label.textContent = s.msg;
        if (s.p === 100) {
          if (span) span.textContent = "Download iniciado";
          onDone();
        }
      }, s.t);
    });

    setTimeout(() => {
      btn.disabled = false;
      if (span) span.textContent = defaultText;
      wrap.classList.remove("active");
      wrap.setAttribute("aria-hidden", "true");
      setTimeout(() => {
        fill.style.width = "0%";
        pct.textContent = "0%";
      }, 280);
    }, 3200);
  }

  async function setupDownloads() {
    const btnMobile = $("btnDownloadMobile");
    const btnTv = $("btnDownloadTv");
    if (!btnMobile || !btnTv) return;

    const cardTv = $("cardTv");
    const mobileBadge = $("mobileVersionBadge");
    const mobileMeta = $("mobileMeta");
    const tvBadge = $("tvVersionBadge");
    const tvMeta = $("tvMeta");

    const [mobile, tv] = await Promise.all([fetchMobileRelease(), fetchTvRelease()]);
    const mobileFallback = `https://github.com/${CONFIG.githubUser}/${CONFIG.repo}/releases/latest`;

    if (mobile.version) {
      mobileBadge.textContent = `v${mobile.version}`;
      const sz = formatBytes(mobile.size);
      mobileMeta.textContent = sz ? `Android 7.0+ · ${sz}` : "Android 7.0 ou superior";
    } else {
      mobileMeta.textContent = "Android 7.0 ou superior";
    }

    btnMobile.addEventListener("click", () => {
      runDownloadAnimation({
        btn: btnMobile,
        wrap: $("mobileProgress"),
        label: $("mobileProgressLabel"),
        pct: $("mobileProgressPct"),
        fill: $("mobileProgressFill"),
        defaultText: "Baixar para Celular",
        onDone: () => {
          if (mobile.apk) {
            triggerDownload(mobile.apk);
          } else {
            window.open(mobile.page || mobileFallback, "_blank", "noopener,noreferrer");
          }
        }
      });
    });

    if (tv.apk) {
      if (cardTv) cardTv.classList.add("dl-featured");
      tvBadge.textContent = tv.version ? `v${tv.version}` : "Android TV / TV Box";
      tvBadge.className = "badge-gold";
      btnTv.className = "btn-gold btn-full";
      const sz = formatBytes(tv.size);
      tvMeta.textContent = sz ? `Android TV e TV Box · ${sz}` : "Android TV e TV Box";
    } else {
      tvBadge.textContent = "Em breve";
      tvBadge.className = "badge-dim";
      tvMeta.textContent = "Android TV e TV Box · Em preparação";
    }

    btnTv.addEventListener("click", () => {
      if (!tv.apk) {
        showToast("A versão para Android TV / TV Box chega em breve");
        return;
      }
      runDownloadAnimation({
        btn: btnTv,
        wrap: $("tvProgress"),
        label: $("tvProgressLabel"),
        pct: $("tvProgressPct"),
        fill: $("tvProgressFill"),
        defaultText: "Baixar para Android TV / TV Box",
        onDone: () => triggerDownload(tv.apk)
      });
    });
  }

  function setupSocial() {
    const openOrSoon = (url, soonMsg) => {
      if (url && /^https?:\/\//i.test(url)) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        showToast(soonMsg);
      }
    };
    document.querySelectorAll("[data-social='instagram']").forEach((el) => {
      el.addEventListener("click", () => openOrSoon(CONFIG.instagramUrl, "O Instagram chega em breve"));
    });
    document.querySelectorAll("[data-social='youtube']").forEach((el) => {
      el.addEventListener("click", () => openOrSoon(CONFIG.youtubeUrl, "O canal chega em breve"));
    });
  }

  function renderRailSkeleton() {
    const rail = $("posterRail");
    if (!rail || rail.children.length > 0) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 10; i++) {
      const card = document.createElement("div");
      card.className = "rail-card";
      const thumb = document.createElement("div");
      thumb.className = "rail-thumb";
      const name = document.createElement("div");
      name.className = "rail-skel-name";
      card.appendChild(thumb);
      card.appendChild(name);
      frag.appendChild(card);
    }
    rail.appendChild(frag);
  }

  function renderPosterWall(items) {
    const wall = $("posterWall");
    if (!wall) return;
    wall.innerHTML = "";
    const cols = window.innerWidth < 760 ? 5 : 10;
    const perCol = 5;
    const durations = [52, 64, 56, 68, 58, 66, 54, 70, 60, 62];
    const frag = document.createDocumentFragment();

    for (let c = 0; c < cols; c++) {
      const col = document.createElement("div");
      col.className = `wall-col ${c % 2 === 0 ? "up" : "down"}`;
      col.style.setProperty("--dur", `${durations[c % durations.length]}s`);

      const cards = [];
      for (let k = 0; k < perCol; k++) {
        const idx = (c * perCol + k) % Math.max(items.length, 1);
        const item = items[idx];
        cards.push(item ? item.img : "");
      }

      [...cards, ...cards].forEach((src, pos) => {
        const box = document.createElement("div");
        box.className = "wall-card";
        if (src) {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "";
          img.loading = pos < perCol ? "eager" : "lazy";
          img.decoding = "async";
          img.referrerPolicy = "no-referrer";
          const done = () => {
            img.classList.add("ready");
            box.classList.add("loaded");
          };
          img.addEventListener("load", done, { once: true });
          if (img.complete && img.naturalWidth > 0) done();
          box.appendChild(img);
        }
        col.appendChild(box);
      });

      frag.appendChild(col);
    }
    wall.appendChild(frag);
  }

  function renderPosterRail(items) {
    const rail = $("posterRail");
    if (!rail || items.length === 0) return;
    rail.innerHTML = "";
    const frag = document.createDocumentFragment();

    items.slice(0, 14).forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "rail-card";

      const thumb = document.createElement("div");
      thumb.className = "rail-thumb";

      const img = document.createElement("img");
      img.src = item.img;
      img.alt = item.title;
      img.loading = idx < 8 ? "eager" : "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      const done = () => {
        img.classList.add("ready");
        thumb.classList.add("loaded");
      };
      img.addEventListener("load", done, { once: true });
      if (img.complete && img.naturalWidth > 0) done();

      const chip = document.createElement("span");
      chip.className = "rail-chip";
      chip.textContent = item.kind;

      thumb.appendChild(img);
      thumb.appendChild(chip);

      const name = document.createElement("span");
      name.className = "rail-name";
      name.textContent = item.title;

      card.appendChild(thumb);
      card.appendChild(name);
      frag.appendChild(card);
    });

    rail.appendChild(frag);
  }

  function readCachedCatalog() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length >= 8 ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeCachedCatalog(items) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(items));
    } catch {}
  }

  async function fetchTmdbItems() {
    if (!CONFIG.tmdbKey) return [];
    try {
      const url = `https://api.themoviedb.org/3/trending/all/week?api_key=${encodeURIComponent(CONFIG.tmdbKey)}&language=pt-BR`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.results || [])
        .filter((x) => x.poster_path)
        .slice(0, 24)
        .map((x) => ({
          title: x.title || x.name || "",
          kind: x.media_type === "tv" ? "Série" : "Filme",
          img: `https://image.tmdb.org/t/p/w342${x.poster_path}`
        }));
    } catch {
      return [];
    }
  }

  function fetchShows() {
    return fetch("https://api.tvmaze.com/shows?page=0")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) =>
        Array.isArray(list)
          ? list
              .filter((s) => s && s.image && s.image.medium && (s.rating?.average || 0) >= 8.0)
              .sort((a, b) => (b.weight || 0) - (a.weight || 0))
              .slice(0, 16)
              .map((s) => ({
                title: s.name || "",
                kind: "Série",
                img: s.image.medium.replace(/^http:/, "https:")
              }))
          : []
      )
      .catch(() => []);
  }

  function fetchMovies() {
    return fetch("https://itunes.apple.com/search?term=batman+avengers+interstellar+dune&media=movie&entity=movie&limit=18&country=br")
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data) =>
        Array.isArray(data?.results)
          ? data.results
              .filter((m) => m && m.artworkUrl100)
              .slice(0, 14)
              .map((m) => ({
                title: m.trackName || "",
                kind: "Filme",
                img: m.artworkUrl100.replace(/100x100bb/g, "300x450bb").replace(/^http:/, "https:")
              }))
          : []
      )
      .catch(() => []);
  }

  function interleave(a, b) {
    const out = [];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max && out.length < 28; i++) {
      if (i < a.length) out.push(a[i]);
      if (i < b.length && out.length < 28) out.push(b[i]);
    }
    return out;
  }

  async function setupCatalog() {
    if (!$("posterWall")) return;

    const cached = readCachedCatalog();
    if (cached) {
      renderPosterWall(cached);
      renderPosterRail(cached);
      return;
    }

    renderPosterWall([]);
    renderRailSkeleton();

    const tmdb = await fetchTmdbItems();
    if (tmdb.length >= 8) {
      writeCachedCatalog(tmdb);
      renderPosterWall(tmdb);
      renderPosterRail(tmdb);
      return;
    }

    let renderedFirst = false;
    let shows = [];
    let movies = [];

    const showsPromise = fetchShows().then((res) => {
      shows = res;
      if (!renderedFirst && shows.length >= 6) {
        renderedFirst = true;
        renderPosterWall(shows);
        renderPosterRail(shows);
      }
    });

    const moviesPromise = fetchMovies().then((res) => {
      movies = res;
      if (!renderedFirst && movies.length >= 6) {
        renderedFirst = true;
        renderPosterWall(movies);
        renderPosterRail(movies);
      }
    });

    await Promise.allSettled([showsPromise, moviesPromise]);
    const combined = interleave(movies, shows);
    if (combined.length > 0) {
      writeCachedCatalog(combined);
      renderPosterWall(combined);
      renderPosterRail(combined);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupGuard();
    setupNavigation();
    setupSocial();
    setupDownloads();
    setupCatalog();
  });
})();
