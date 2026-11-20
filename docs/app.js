(() => {
  "use strict";

  const CONFIG = {
    githubUser: "Annyx404",
    mobileRepo: "take7",
    tvRepo: "",
    tmdbKey: "",
    instagramUrl: "",
    youtubeUrl: ""
  };

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
    const links = Array.from(document.querySelectorAll("[data-sec]"));
    const sections = ["inicio", "download", "sobre"].map((id) => $(id)).filter(Boolean);

    const setMenu = (open) => {
      burger.classList.toggle("open", open);
      drawer.classList.toggle("open", open);
      veil.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      drawer.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
    };

    burger.addEventListener("click", () => setMenu(!drawer.classList.contains("open")));
    closeBtn.addEventListener("click", () => setMenu(false));
    veil.addEventListener("click", () => setMenu(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setMenu(false);
    });

    links.forEach((a) => {
      a.addEventListener("click", () => setMenu(false));
    });

    const onScroll = () => {
      topbar.classList.toggle("scrolled", window.scrollY > 24);
      const y = window.scrollY + 140;
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

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "";
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1).replace(".", ",")} MB` : `${Math.round(bytes / 1024)} KB`;
  }

  async function fetchRelease(repo, tvOnly) {
    const api = `https://api.github.com/repos/${CONFIG.githubUser}/${repo}/releases/latest`;
    const fallbackPage = `https://github.com/${CONFIG.githubUser}/${repo}/releases/latest`;
    try {
      const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) return { apk: "", version: "", size: 0, page: fallbackPage };
      const data = await res.json();
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const apks = assets.filter((a) => typeof a.name === "string" && a.name.toLowerCase().endsWith(".apk"));
      let picked = null;
      if (tvOnly) {
        picked = apks.find((a) => /tv/i.test(a.name)) || null;
      } else {
        picked = apks.find((a) => !/tv/i.test(a.name)) || apks[0] || null;
      }
      return {
        apk: picked ? picked.browser_download_url : "",
        version: (data.tag_name || data.name || "").replace(/^v/i, ""),
        size: picked ? picked.size : 0,
        page: data.html_url || fallbackPage
      };
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

  async function setupDownloads() {
    const btnMobile = $("btnDownloadMobile");
    const btnTv = $("btnDownloadTv");
    const mobileBadge = $("mobileVersionBadge");
    const mobileMeta = $("mobileMeta");
    const tvBadge = $("tvVersionBadge");
    const tvMeta = $("tvMeta");
    const aboutVersion = $("aboutVersion");
    const drawerVersion = $("drawerVersion");

    const mobile = await fetchRelease(CONFIG.mobileRepo, false);
    const mobileFallback = `https://github.com/${CONFIG.githubUser}/${CONFIG.mobileRepo}/releases/latest`;

    if (mobile.version) {
      mobileBadge.textContent = `v${mobile.version}`;
      aboutVersion.textContent = `versão ${mobile.version}`;
      drawerVersion.textContent = `v${mobile.version}`;
      const sz = formatBytes(mobile.size);
      mobileMeta.textContent = sz ? `APK oficial · ${sz} · GitHub Releases` : "APK oficial · GitHub Releases";
    } else {
      mobileMeta.textContent = "APK oficial · GitHub Releases";
    }

    btnMobile.addEventListener("click", () => {
      if (mobile.apk) {
        showToast("Iniciando download do Take 7 Mobile...");
        triggerDownload(mobile.apk);
      } else {
        window.open(mobile.page || mobileFallback, "_blank", "noopener,noreferrer");
      }
    });

    let tv = { apk: "", version: "", size: 0, page: "" };
    if (CONFIG.tvRepo) {
      tv = await fetchRelease(CONFIG.tvRepo, false);
    } else {
      tv = await fetchRelease(CONFIG.mobileRepo, true);
    }

    if (tv.apk) {
      if (tv.version) tvBadge.textContent = `v${tv.version}`;
      const sz = formatBytes(tv.size);
      tvMeta.textContent = sz ? `APK TV Box · ${sz} · GitHub Releases` : "APK TV Box · GitHub Releases";
    } else {
      tvBadge.textContent = "Em breve";
      tvMeta.textContent = "Versão para TV Box em preparação";
    }

    btnTv.addEventListener("click", () => {
      if (tv.apk) {
        showToast("Iniciando download do Take 7 TV...");
        triggerDownload(tv.apk);
      } else {
        showToast("A versão para TV Box chega em breve");
      }
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
    $("btnInstagram").addEventListener("click", () => openOrSoon(CONFIG.instagramUrl, "O Instagram chega em breve"));
    $("btnYoutube").addEventListener("click", () => openOrSoon(CONFIG.youtubeUrl, "O canal chega em breve"));
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

  async function fetchPublicCatalog() {
    const [showsRes, moviesRes, animeRes] = await Promise.allSettled([
      fetch("https://api.tvmaze.com/shows?page=0").then((r) => (r.ok ? r.json() : [])),
      fetch("https://itunes.apple.com/search?term=avengers+batman+dune+interstellar&media=movie&entity=movie&limit=20&country=br").then((r) => (r.ok ? r.json() : { results: [] })),
      fetch("https://api.jikan.moe/v4/top/anime?limit=12").then((r) => (r.ok ? r.json() : { data: [] }))
    ]);

    const shows = showsRes.status === "fulfilled" && Array.isArray(showsRes.value)
      ? showsRes.value
          .filter((s) => s && s.image && s.image.medium && (s.rating?.average || 0) >= 7.8)
          .sort((a, b) => (b.weight || 0) - (a.weight || 0))
          .slice(0, 14)
          .map((s) => ({
            title: s.name || "",
            kind: "Série",
            img: s.image.medium.replace(/^http:/, "https:")
          }))
      : [];

    const movies = moviesRes.status === "fulfilled" && Array.isArray(moviesRes.value?.results)
      ? moviesRes.value.results
          .filter((m) => m && m.artworkUrl100)
          .slice(0, 12)
          .map((m) => ({
            title: m.trackName || "",
            kind: "Filme",
            img: m.artworkUrl100.replace(/100x100bb/g, "400x600bb").replace(/^http:/, "https:")
          }))
      : [];

    const animes = animeRes.status === "fulfilled" && Array.isArray(animeRes.value?.data)
      ? animeRes.value.data
          .filter((a) => a && a.images?.jpg?.large_image_url)
          .slice(0, 10)
          .map((a) => ({
            title: a.title || "",
            kind: "Anime",
            img: a.images.jpg.large_image_url
          }))
      : [];

    const pools = [movies, shows, animes].filter((p) => p.length > 0);
    const mixed = [];
    let i = 0;
    while (mixed.length < 30 && pools.some((p) => i < p.length)) {
      pools.forEach((p) => {
        if (i < p.length && mixed.length < 30) mixed.push(p[i]);
      });
      i++;
    }
    return mixed;
  }

  function renderPosterWall(items) {
    const wall = $("posterWall");
    if (!wall) return;
    wall.innerHTML = "";
    const cols = window.innerWidth < 760 ? 5 : 10;
    const perCol = 6;
    const durations = [54, 66, 58, 72, 60, 68, 56, 70, 62, 64];

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

      [...cards, ...cards].forEach((src) => {
        const box = document.createElement("div");
        box.className = "wall-card";
        if (src) {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "";
          img.loading = "lazy";
          img.decoding = "async";
          img.referrerPolicy = "no-referrer";
          img.addEventListener("load", () => img.classList.add("ready"));
          box.appendChild(img);
        }
        col.appendChild(box);
      });

      wall.appendChild(col);
    }
  }

  function renderPosterRail(items) {
    const rail = $("posterRail");
    if (!rail) return;
    rail.innerHTML = "";
    const list = items.slice(0, 14);
    list.forEach((item) => {
      const card = document.createElement("div");
      card.className = "rail-card";

      const thumb = document.createElement("div");
      thumb.className = "rail-thumb";

      const img = document.createElement("img");
      img.src = item.img;
      img.alt = item.title;
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("load", () => img.classList.add("ready"));

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
      rail.appendChild(card);
    });
  }

  async function setupCatalog() {
    renderPosterWall([]);
    let items = await fetchTmdbItems();
    if (items.length < 8) {
      items = await fetchPublicCatalog();
    }
    if (items.length > 0) {
      renderPosterWall(items);
      renderPosterRail(items);
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
