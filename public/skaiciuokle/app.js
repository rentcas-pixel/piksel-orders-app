const rawScreens = [
  ["Panorama", "Vilnius", "Statinis", "Narbuto g.", 107],
  ["Laisvės kelias", "Vilnius", "Statinis", "Konstitucijos pr.", 107],
  ["Narbuto žiedas", "Vilnius", "Statinis", "Narbuto g.", 105],
  ["Justiniškės", "Vilnius", "Video", "Laisvės pr.", 126],
  ["Kareivių", "Vilnius", "Statinis", "Kareivių ir Verkių g.", 103],
  ["Compensa", "Vilnius", "Video", "Ozo ir Kernavės g.", 102],
  ["Mada", "Vilnius", "Video", "Laisvės pr.", 126],
  ["Senukai", "Vilnius", "Video", "Ukmergės g. 248", 130],
  ["Nordika", "Vilnius", "Video", "Vikingų g. 2", 59],
  ["Kalvarijų", "Vilnius", "Video", "Kalvarijų g. 206", 85],
  ["Ukmergės", "Vilnius", "Statinis", "Ukmergės ir Perkūnkiemio g.", 122],
  ["Spaudos rūmai", "Vilnius", "Statinis", "Pilaitės pr. ir Spaudos g.", 121],
  ["Outlet", "Vilnius", "Video", "Pilaitės pr. ir V. Pociūno g.", 117],
  ["Pašilaičiai", "Vilnius", "Statinis", "Ukmergės ir Perkūnkiemio g.", 116],
  ["Pilaitė", "Vilnius", "Statinis", "Pilaitės pr. ir Spaudos g.", 121],
  ["Ozas", "Vilnius", "Statinis", "Ozo ir Kalvarijų g.", 112],
  ["Konstitucijos", "Vilnius", "Viadukas", "Geležinio Vilko g.", 145],
  ["Narbuto", "Vilnius", "Viadukas", "Geležinio Vilko g.", 143],
  ["Pedagoginis", "Vilnius", "Viadukas", "Geležinio Vilko g.", 140],
  ["Lazdynai", "Vilnius", "Viadukas", "Oslo g.", 138],
  ["Jasinskio", "Vilnius", "Viadukas", "Geležinio Vilko g.", 142],
  ["Geležinio Vilko", "Vilnius", "Viadukas", "Geležinio Vilko g.", 147],
  ["Šeškinės", "Vilnius", "Viadukas", "Ukmergės g.", 136],
  ["Ateities", "Vilnius", "Viadukas", "Ateities g.", 133],
  ["Akropolis △", "Vilnius", "Statinis", "Ozo ir Gelvonų g.", 171],
  ["Urmas", "Kaunas", "Video", "Pramonės ir Taikos pr.", 112],
  ["Taikos pr.", "Kaunas", "Video", "Pramonės ir Taikos pr.", 108],
  ["Pramonės", "Kaunas", "Video", "Pramonės pr.", 102],
  ["Centras", "Kaunas", "Video", "Veiverių ir Minkovskių g.", 118],
  ["Girstučio", "Kaunas", "Video", "Kovo 11-osios g.", 91],
  ["Molas", "Kaunas", "Video", "Kovo 11-osios g.", 93],
  ["Akropolis", "Kaunas", "Video", "Karaliaus Mindaugo pr.", 154],
  ["Vytauto pr.", "Kaunas", "Video", "Vytauto pr. 66", 87],
  ["Mega", "Kaunas", "Video", "Kuršių ir Jotvingių g.", 148],
  ["Į Senamiestį", "Kaunas", "Video", "Raudondvario pl.", 89],
  ["Iš Senamiesčio", "Kaunas", "Video", "Raudondvario pl.", 92],
  ["Žemaičių plentas", "Kaunas", "Video", "Žemaičių pl. 62", 84],
  ["Šilainiai", "Kaunas", "Video", "Žemaičių pl. 62", 86],
  ["Varnių", "Kaunas", "Video", "Varnių g. 51", 82],
  ["Baltijos", "Klaipėda", "Video", "Baltijos ir Minijos g.", 99],
  ["Centras", "Klaipėda", "Video", "Naujojo Sodo ir H. Manto g.", 108],
  ["Šilutės", "Klaipėda", "Video", "Statybininkų ir Šilutės g.", 88],
  ["Dubijos", "Šiauliai", "Video", "Dubijos ir Žemaitės g.", 77],
  ["Rūta", "Šiauliai", "Video", "Tilžės ir Vytauto g.", 74],
  ["Ryo", "Panevėžys", "Video", "Klaipėdos ir Vakarinės g.", 81],
  ["Klaipėdos", "Panevėžys", "Video", "Klaipėdos ir Vakarinės g.", 79],
  ["Vilniaus", "Panevėžys", "Video", "Vilniaus g. 7", 72],
  ["Centras", "Panevėžys", "Video", "J. Basanavičiaus g.", 78],
  ["Maxima", "Panevėžys", "Video", "Klaipėdos g. 67", 76],
  ["Mažeikiai", "Regionai", "Video", "Naftininkų g. 15", 64],
  ["Alytus", "Regionai", "Video", "Kalniškės g.", 67],
  ["Marijampolė", "Regionai", "Video", "Gedimino ir V. Kudirkos g.", 69],
  ["Utena", "Regionai", "Video", "J. Basanavičiaus g.", 62],
  ["Jonava", "Regionai", "Video", "Vasario 16-osios g. 1", 61],
  ["Tauragė", "Regionai", "Video", "Dariaus ir Girėno g. 38A", 63],
  ["Joniškis", "Regionai", "Video", "Livonijos ir Statybininkų g.", 58],
];

const catalogScreens = Array.isArray(window.PIKSEL_SCREEN_CATALOG?.screens)
  ? window.PIKSEL_SCREEN_CATALOG.screens
  : [];

function normalizeScreenName(value) {
  return String(value || "").trim().toLocaleLowerCase("lt-LT");
}

const catalogScreensByName = new Map();
catalogScreens.forEach((screen) => {
  const key = normalizeScreenName(screen.name);
  const matches = catalogScreensByName.get(key) || [];
  matches.push(screen);
  catalogScreensByName.set(key, matches);
});

function findCatalogScreen(name, city) {
  const aliases = {
    "taikos pr.": "taikos",
    "šilainiai": "šilainių",
    "mažeikiai": "žemaitijos",
  };
  const normalizedName = aliases[normalizeScreenName(name)] || normalizeScreenName(name);
  const candidates = catalogScreensByName.get(normalizedName) || [];
  if (candidates.length === 1) return candidates[0];
  const normalizedCity = normalizeScreenName(city);
  return candidates.find((screen) => normalizeScreenName(screen.city) === normalizedCity) || null;
}

function isViaductScreen(type, catalog) {
  return Boolean(catalog?.viaduct || type === "Viadukas");
}

const screens = rawScreens.map(([name, city, type, address, fallbackOts], index) => {
  const catalog = findCatalogScreen(name, city);
  const viaduct = isViaductScreen(type, catalog);
  return {
    id: index + 1,
    catalogId: catalog?.id || "",
    name,
    city,
    type: viaduct ? "Viadukas" : type,
    address,
    owner: catalog?.owner || "",
    dimensions: catalog?.dimensions || "—",
    resolution: String(catalog?.resolution || "1152 x 576").replace("3.040", "3040"),
    catalogType: catalog?.type || type,
    viaduct,
    otsCoefficient: Number(catalog?.ots ?? fallbackOts),
    priceByAvgViewsPerDay: catalog?.price_by_avg_views_per_day || {},
    link: catalog?.link || "",
    image: catalog?.image || catalog?.photo || "",
    lat: catalog?.lat ?? catalog?.latitude ?? null,
    lng: catalog?.lng ?? catalog?.longitude ?? null,
    selected: false,
    /** Optional override — jei nėra, naudojamas kampanijos Laikotarpis */
    customFrom: "",
    customTo: "",
  };
});

async function hydrateScreensFromSupabase() {
  if (!window.PikselSupabase?.configured) return false;

  try {
    const remoteScreens = await window.PikselSupabase.screens.list();
    if (!Array.isArray(remoteScreens) || !remoteScreens.length) return false;

    const remoteById = new Map(remoteScreens.map((screen) => [String(screen.id), screen]));
    let updatedCount = 0;

    screens.forEach((screen) => {
      const remote = remoteById.get(String(screen.catalogId));
      if (!remote) return;

      screen.owner = remote.owner || "";
      screen.dimensions = remote.dimensions || "—";
      screen.resolution = String(remote.resolution || "1152 x 576").replace("3.040", "3040");
      screen.catalogType = remote.screen_type || screen.type;
      if (remote.viaduct != null) screen.viaduct = Boolean(remote.viaduct);
      if (screen.viaduct) screen.type = "Viadukas";
      screen.otsCoefficient = Number(remote.ots || 0);
      screen.priceByAvgViewsPerDay = remote.price_by_avg_views_per_day || {};
      if (remote.link) screen.link = remote.link;
      if (remote.image || remote.photo || remote.image_url) {
        screen.image = remote.image || remote.photo || remote.image_url;
      }
      if (remote.lat != null || remote.latitude != null) {
        screen.lat = Number(remote.lat ?? remote.latitude);
      }
      if (remote.lng != null || remote.longitude != null) {
        screen.lng = Number(remote.lng ?? remote.longitude);
      }
      if (remote.address) screen.address = remote.address;
      updatedCount += 1;
    });

    if (updatedCount) {
      document.documentElement.dataset.screenCatalogSource = "supabase";
      renderCityFilters();
      renderScreens();
      return true;
    }
  } catch (error) {
    console.warn("Nepavyko atnaujinti ekranų katalogo iš Supabase; naudojama vietinė kopija.", error);
  }

  return false;
}

async function hydrateScreensFromPikselSite() {
  try {
    const response = await fetch("/api/piksel-screens");
    if (!response.ok) return false;
    const remoteScreens = await response.json();
    if (!Array.isArray(remoteScreens) || !remoteScreens.length) return false;

    const bySlug = new Map();
    const byNameCity = new Map();
    remoteScreens.forEach((item) => {
      if (item?.slug) bySlug.set(String(item.slug).toLowerCase(), item);
      const key = `${normalizeScreenName(item?.name || "")}|${normalizeScreenName(item?.city || "")}`;
      byNameCity.set(key, item);
    });

    let updatedCount = 0;
    screens.forEach((screen) => {
      const slug = screenSlugFromLink(screen.link);
      const remote =
        (slug && bySlug.get(slug)) ||
        byNameCity.get(`${normalizeScreenName(screen.name)}|${normalizeScreenName(screen.city)}`);
      if (!remote) return;

      if (remote.image) {
        // Prefer local catalog photos; only fill if missing.
        if (!screen.image) screen.image = absolutePikselAssetUrl(remote.image);
      }
      if (remote.latitude != null) screen.lat = Number(remote.latitude);
      if (remote.longitude != null) screen.lng = Number(remote.longitude);
      if (remote.address) screen.address = remote.address;
      if (remote.dimensions) screen.dimensions = String(remote.dimensions).replace(/\s*[×x]\s*/gi, "x").replace(/\s*m$/i, "").trim();
      if (remote.resolution) screen.resolution = String(remote.resolution).replace(/\s*[×x]\s*/gi, " x ");
      if (remote.orientation) {
        screen.orientationLabel = formatScreenOrientation(remote.orientation);
      }
      if (remote.slug && !screen.link) {
        screen.link = `https://www.piksel.lt/ekranai/${remote.slug}`;
      }
      updatedCount += 1;
    });

    if (updatedCount) {
      document.documentElement.dataset.screenMediaSource = "piksel-site";
      return true;
    }
  } catch (error) {
    console.warn("Nepavyko užkrauti ekranų nuotraukų/žemėlapio iš piksel.lt.", error);
  }
  return false;
}

function screenSlugFromLink(link) {
  if (!link) return "";
  try {
    const path = new URL(link, "https://www.piksel.lt").pathname;
    const match = path.match(/\/ekranai\/([^/]+)\/?$/i);
    return match ? decodeURIComponent(match[1]).toLowerCase() : "";
  } catch {
    return "";
  }
}

function absolutePikselAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `https://www.piksel.lt${path.startsWith("/") ? path : `/${path}`}`;
}

function formatScreenOrientation(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "horizontal" || raw === "horizontalus") return "Horizontalus";
  if (raw === "vertical" || raw === "vertikalus") return "Vertikalus";
  if (raw === "viaduct" || raw === "viadukas") return "Viadukas";
  return String(value);
}

function getScreenDetailType(screen) {
  if (screen.orientationLabel) return screen.orientationLabel;
  if (screen.catalogType && /horizontal|vertikal|viaduk/i.test(screen.catalogType)) {
    return formatScreenOrientation(screen.catalogType) || screen.catalogType;
  }
  if (screen.viaduct) return "Viadukas";
  return screen.catalogType || screen.type || "—";
}

function buildScreenMapEmbedUrl(screen) {
  if (Number.isFinite(screen.lat) && Number.isFinite(screen.lng)) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(`${screen.lat},${screen.lng}`)}&z=16&output=embed`;
  }
  const query = [screen.address, screen.city, "Lietuva"].filter(Boolean).join(", ");
  if (!query) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
}

function formatScreenMeasure(value) {
  const text = String(value || "").trim();
  if (!text || text === "—") return "—";
  return text
    .replace(/\s*[x×]\s*/gi, " × ")
    .replace(/\s*m$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function openScreenDetailModal(screenId) {
  const screen = screens.find((item) => item.id === Number(screenId));
  const modal = $("#screenDetailModal");
  if (!screen || !modal) return;

  $("#screenDetailTitle").textContent = screen.name;

  const image = $("#screenDetailImage");
  const empty = $("#screenDetailPhotoEmpty");
  if (screen.image) {
    image.hidden = false;
    image.onload = () => {
      empty.hidden = true;
    };
    image.onerror = () => {
      image.hidden = true;
      empty.hidden = false;
    };
    image.src = screen.image;
    image.alt = `${screen.name} ekranas`;
    empty.hidden = true;
  } else {
    image.hidden = true;
    image.removeAttribute("src");
    image.alt = "";
    empty.hidden = false;
  }

  const map = $("#screenDetailMap");
  const mapUrl = buildScreenMapEmbedUrl(screen);
  if (mapUrl) {
    map.src = mapUrl;
    map.hidden = false;
  } else {
    map.removeAttribute("src");
    map.hidden = true;
  }

  $("#screenDetailType").textContent = getScreenDetailType(screen);
  $("#screenDetailResolution").textContent = formatScreenMeasure(screen.resolution);
  $("#screenDetailDimensions").textContent = formatScreenMeasure(screen.dimensions);

  const more = $("#screenDetailMore");
  if (screen.link) {
    more.href = screen.link;
    more.setAttribute("aria-disabled", "false");
  } else {
    more.href = "#";
    more.setAttribute("aria-disabled", "true");
  }

  modal.hidden = false;
}

function closeScreenDetailModal() {
  const modal = $("#screenDetailModal");
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  const map = $("#screenDetailMap");
  if (map) map.removeAttribute("src");
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest("[data-open-screen], .screen-detail-card, #screenDetailModal")) {
    active.blur();
  }
}

const dayLabels = ["P", "A", "T", "K", "P", "Š", "S"];
const hours = Array.from({ length: 17 }, (_, index) => index + 6);
const emptyGrid = () => Array.from({ length: 7 }, () => Array(17).fill(false));
const fullGrid = () => Array.from({ length: 7 }, () => Array(17).fill(true));
const state = {
  mode: "screens", // screens | viaducts
  city: "Visi",
  search: "",
  preset: "medi",
  mediPhase: 0, // 0 = P 6→S 22-23, 1 = P 7→S 21-22
  minPhase: 0, // 0 = bazinis Min, 1 = perskirstytas (kitos valandos)
  viaductFrequency: 1, // 1 | 2 | 4 minutes
  grid: emptyGrid(),
  screenGrid: null,
  screenPreset: "medi",
  viaductGrid: null,
  /** Skirtingi laikotarpiai ekranams — rodo kalendoriaus ikonas */
  perScreenDatesMode: false,
  /**
   * Kampanijos bangos (split) — Hub billingPeriods formatas { id, from, to }.
   * Tuščia = ištisinis envelope (dateFrom–dateTo).
   */
  billingPeriods: [],
};
const publicCampaignState = {
  active: false,
  token: "",
  orderId: "",
  locked: false,
  mock: false,
  campaign: null,
  lockCheckTimer: null,
};
const internalPlanEditState = {
  orderId: null,
};
const liveOrderState = {
  id: "",
};

async function playCampaignRequest(path, options = {}) {
  const res = await fetch(path, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

function getLiveOrderIdFromUrl() {
  try {
    return new URLSearchParams(location.search).get("liveOrderId") || "";
  } catch {
    return "";
  }
}

function currentShareOrderId() {
  if (publicCampaignState.active && publicCampaignState.orderId) return publicCampaignState.orderId;
  const live = liveOrderState.id || getLiveOrderIdFromUrl();
  if (live) return live;
  const test = getTestOrderIdFromUrl();
  if (test) return test.startsWith("test-") ? test : `test-${test}`;
  if (testOrderDraft.id) return `test-${testOrderDraft.id}`;
  return "";
}

function getPublicGoBaseUrl() {
  const fromConfig = window.PIKSEL_GO_CONFIG?.baseUrl;
  if (fromConfig) return String(fromConfig).replace(/\/$/, "");
  return "https://go.piksel.lt";
}

function isPlayShareHost() {
  const host = String(location.hostname || "").toLowerCase();
  return host === "play.piksel.lt" || host === "localhost" || host === "127.0.0.1";
}

function publicShareOrigin() {
  if (location.protocol === "file:") return "";
  if (isPlayShareHost()) return location.origin.replace(/\/$/, "");
  return getPublicGoBaseUrl();
}

function getPublicCampaignTokenFromLocation() {
  const queryToken = new URLSearchParams(location.search).get("campaign");
  if (queryToken) return queryToken;

  const campaignMatch = location.pathname.match(/\/campaign\/([^/]+)\/?$/);
  if (campaignMatch) return decodeURIComponent(campaignMatch[1]);

  // play/go/{token} (middleware rewrite į skaičiuoklę)
  const bareMatch = location.pathname.match(/^\/([a-zA-Z0-9_-]{8,64})\/?$/);
  if (bareMatch) {
    const reserved = new Set([
      "api", "login", "piksel", "test-orders", "test-pocketbase", "skaiciuokle", "agency",
      "campaign", "calculator", "devices", "media", "monitoring", "favicon.ico",
    ]);
    if (!reserved.has(bareMatch[1].toLowerCase())) return decodeURIComponent(bareMatch[1]);
  }
  return "";
}

function buildPublicCampaignUrl(token) {
  if (!token) return "";
  if (location.protocol === "file:") {
    return `${location.href.split(/[?#]/)[0]}?campaign=${encodeURIComponent(token)}#calculator`;
  }
  return `${publicShareOrigin()}/${encodeURIComponent(token)}`;
}

/** Local mock store for go.piksel.lt/{token} until real deploy. */
const GO_MOCK_STORE_KEY = "pikselGoCampaignMocks";

function generateGoMockToken() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(15);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function readGoMockStore() {
  try {
    return JSON.parse(localStorage.getItem(GO_MOCK_STORE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeGoMockStore(store) {
  localStorage.setItem(GO_MOCK_STORE_KEY, JSON.stringify(store));
}

function saveGoMockCampaign(token, payload) {
  if (!token) return;
  const store = readGoMockStore();
  store[token] = { ...payload, updatedAt: Date.now() };
  writeGoMockStore(store);
}

function loadGoMockCampaign(token) {
  if (!token) return null;
  return readGoMockStore()[token] || null;
}

function buildGoMockPayloadFromPlan(plan, meta = {}) {
  const selected = plan.screens.filter((screen) => screen.active);
  const orderNo = String(meta.orderNo || plan.campaignNo || Date.now()).replace(/^[A-Z]-/, "");
  const viaduct = Boolean(plan.viaduct);
  return {
    campaign: {
      name: meta.client || plan.client || "Mock kampanija",
      client_name: meta.client || plan.client || "Mock kampanija",
      agency_name: meta.agency || plan.agency || "—",
      order_no: orderNo,
      date_from: plan.from,
      date_to: plan.to,
      billingPeriods: (state.billingPeriods || []).map((period) => ({ ...period })),
      clip_duration_seconds: plan.clipDuration,
      intensity: plan.intensity,
      grid: plan.grid,
      volume_discount: plan.volumeDiscount * 100,
      period_discount: plan.periodDiscount * 100,
      final_price: plan.total,
      status: meta.status || "awaiting_approval",
      locked_for_client: false,
      viaduct,
      mode: viaduct ? "viaducts" : "screens",
      viaduct_frequency: viaduct ? (Number(plan.viaductFrequency) || 1) : 1,
    },
    screens: selected.map((screen) => ({
      screen_id: screen.catalogId || String(screen.id || ""),
      from: screen.from,
      to: screen.to,
      name: screen.name,
      city: screen.city,
      impressions: screen.impressions,
      ots_total: screen.ots,
      clip_price: screen.clipPrice,
      cpt: screen.cpt,
      gross_price: screen.gross,
      discount: screen.screenDiscount * 100,
      net_price: screen.net,
      calculation_snapshot: {
        name: screen.name,
        city: screen.city,
        dimensions: screen.dimensions,
        resolution: screen.resolution,
        type: screen.type,
      },
    })),
  };
}

function attachGoMockLink(order, plan) {
  const modeKey = plan.viaduct ? "viaducts" : "screens";
  const existingForMode = getGoMockTokenForMode(modeKey);
  const token = (order.publicToken && loadGoMockCampaign(order.publicToken))
    ? order.publicToken
    : (existingForMode && loadGoMockCampaign(existingForMode))
      ? existingForMode
      : generateGoMockToken();
  const payload = buildGoMockPayloadFromPlan(plan, {
    client: order.client,
    agency: order.agency,
    orderNo: order.id,
    status: order.status === "Patvirtinta" ? "approved" : "awaiting_approval",
  });
  saveGoMockCampaign(token, payload);
  order.publicToken = token;
  order.publicUrl = buildPublicCampaignUrl(token);
  order.goMock = true;
  order.viaduct = Boolean(plan.viaduct);
  setGoMockTokenForMode(modeKey, token);
  setGoShareLinkField(order.publicUrl);
  return token;
}

function localPreviewUrlForToken(token) {
  if (!token) return "";
  if (isPlayShareHost()) return buildPublicCampaignUrl(token);
  return `${location.origin}/skaiciuokle/index.html?campaign=${encodeURIComponent(token)}`;
}

const calculatorGoMockState = {
  tokens: { screens: "", viaducts: "" },
  url: "",
};

function goMockModeKey(mode = state.mode) {
  return mode === "viaducts" ? "viaducts" : "screens";
}

function getGoMockTokenForMode(mode = state.mode) {
  return calculatorGoMockState.tokens[goMockModeKey(mode)] || "";
}

function setGoMockTokenForMode(mode, token) {
  calculatorGoMockState.tokens[goMockModeKey(mode)] = token || "";
}

function clearGoMockTokens() {
  calculatorGoMockState.tokens.screens = "";
  calculatorGoMockState.tokens.viaducts = "";
  calculatorGoMockState.url = "";
}

function syncGoShareLinkForCurrentMode({ flash = false } = {}) {
  const token = getGoMockTokenForMode();
  setGoShareLinkField(token ? buildPublicCampaignUrl(token) : "", { flash });
}

function shareTokenFromOrder(order) {
  return String(order?.details?.publicToken || order?.publicToken || getGoMockTokenForMode() || "").trim();
}

function showShareLinkForOrder(order) {
  const token = shareTokenFromOrder(order);
  if (!token) {
    syncGoShareLinkVisibility({ hide: isClientShareView() });
    return "";
  }
  setGoMockTokenForMode(goMockModeKey(), token);
  if (!publicCampaignState.token) publicCampaignState.token = token;
  if (!publicCampaignState.orderId && order?.id) publicCampaignState.orderId = String(order.id);
  setGoShareLinkField(buildPublicCampaignUrl(token));
  syncGoShareLinkVisibility({ hide: isClientShareView() });
  return token;
}

function ensureShareLinkForCurrentPlan() {
  if (isClientShareView()) return "";
  let token = getGoMockTokenForMode() || publicCampaignState.token || "";
  if (!token) token = generateGoMockToken();
  setGoMockTokenForMode(goMockModeKey(), token);
  publicCampaignState.token = token;
  if (!publicCampaignState.orderId) {
    const orderId = currentShareOrderId();
    if (orderId) publicCampaignState.orderId = orderId;
  }
  persistShareTokenOnCurrentOrder(token);
  setGoShareLinkField(buildPublicCampaignUrl(token));
  syncGoShareLinkVisibility({ hide: false });
  return token;
}

function persistShareTokenOnCurrentOrder(token) {
  const orderId = currentShareOrderId();
  if (!token || !orderId || !String(orderId).startsWith("test-")) return;
  const orders = readHubTestOrders();
  const index = orders.findIndex((item) => item.id === orderId);
  if (index < 0) return;
  const previous = orders[index];
  if (previous.publicToken === token && previous.details?.publicToken === token) return;
  orders[index] = {
    ...previous,
    publicToken: token,
    details: { ...previous.details, publicToken: token },
  };
  writeHubTestOrders(orders);
}

function campaignIsViaduct(campaign) {
  if (!campaign) return false;
  if (campaign.viaduct === true || campaign.mode === "viaducts") return true;
  return /^Kas\s+[124]\s+minut/i.test(String(campaign.intensity || ""));
}

function orderSnapshotIsViaduct(order) {
  if (!order) return false;
  const plan = order.details?.plan || {};
  if (
    campaignIsViaduct({
      viaduct: order.viaduct === true || plan.viaduct === true,
      mode: plan.viaduct ? "viaducts" : plan.mode,
      intensity: plan.intensity || order.intensity,
    })
  ) {
    return true;
  }
  const rows = Array.isArray(plan.screenRows) ? plan.screenRows : [];
  if (
    rows.length > 0 &&
    rows.every((row) => /viaduk/i.test(String(row?.type || "")))
  ) {
    return true;
  }
  return false;
}

function parseViaductFrequencyFromCampaign(campaign) {
  const fromField = Number(campaign?.viaduct_frequency);
  if ([1, 2, 4].includes(fromField)) return fromField;
  const match = String(campaign?.intensity || "").match(/Kas\s+([124])\s+minut/i);
  if (match) return Number(match[1]);
  return 1;
}

function currentShareUrl() {
  const typed = String($("#goShareLinkInput")?.value || calculatorGoMockState.url || "").trim();
  if (typed) return typed;
  const token = getGoMockTokenForMode() || publicCampaignState.token;
  return token ? buildPublicCampaignUrl(token) : "";
}

async function copyTextNow(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const input = $("#goShareLinkInput");
    if (!input) return false;
    const previous = input.value;
    input.value = value;
    input.focus();
    input.select();
    const ok = document.execCommand("copy");
    if (previous !== value) input.value = previous;
    return ok;
  }
}

function setGoShareLinkField(url = "", { flash = false } = {}) {
  const input = $("#goShareLinkInput");
  const button = $("#goShareLinkCopy");
  if (!input) return;
  calculatorGoMockState.url = url || "";
  input.value = url || "";
  if (button && flash) {
    button.classList.add("is-copied");
    window.setTimeout(() => button.classList.remove("is-copied"), 1200);
  }
}

function syncGoShareLinkVisibility({ hide = false } = {}) {
  const wrap = $("#goShareLink");
  if (!wrap) return;
  wrap.hidden = hide;
}

function applyPublicCampaignPayload(token, campaign, screenRows) {
  publicCampaignState.token = token;
  const viaduct = campaignIsViaduct(campaign);

  if (viaduct) {
    state.mode = "viaducts";
    state.viaductFrequency = parseViaductFrequencyFromCampaign(campaign);
    state.viaductGrid = normalizePublicGrid(campaign.grid);
    state.grid = cloneGrid(state.viaductGrid);
    setGoMockTokenForMode("viaducts", token);
  } else {
    state.mode = "screens";
    state.screenGrid = normalizePublicGrid(campaign.grid);
    state.grid = cloneGrid(state.screenGrid);
    state.preset = presetFromIntensity(campaign.intensity);
    setGoMockTokenForMode("screens", token);
  }

  const selectedIds = new Set();
  const selectedNames = new Set();
  (screenRows || []).forEach((row) => {
    const snapshot = row?.calculation_snapshot || {};
    const id = String(row?.screen_id || row?.catalogId || "").trim();
    const name = String(snapshot.name || row?.name || "").trim().toLocaleLowerCase("lt-LT");
    const city = String(snapshot.city || row?.city || "").trim().toLocaleLowerCase("lt-LT");
    if (id) selectedIds.add(id);
    if (name) selectedNames.add(city ? `${name}|${city}` : name);
  });
  const hasIncomingScreens = selectedIds.size > 0 || selectedNames.size > 0;
  if (hasIncomingScreens) {
    screens.forEach((screen) => {
      const name = String(screen.name || "").trim().toLocaleLowerCase("lt-LT");
      const city = String(screen.city || "").trim().toLocaleLowerCase("lt-LT");
      const selected =
        selectedIds.has(String(screen.catalogId || "")) ||
        selectedIds.has(String(screen.id || "")) ||
        selectedNames.has(`${name}|${city}`) ||
        selectedNames.has(name);
      if (viaduct) {
        screen.selected = screen.viaduct ? selected : false;
      } else {
        screen.selected = screen.viaduct ? false : selected;
      }
    });
  }
  if (viaduct && !selectedIds.size && !selectedNames.size) ensureAllViaductsSelected();

  $("#dateFrom").value = campaign.date_from;
  $("#dateTo").value = campaign.date_to;
  state.billingPeriods = Array.isArray(campaign.billingPeriods) ? campaign.billingPeriods : [];
  applyScreenCustomPeriodsFromPlan({ screenRows: (screenRows || []).map((row) => ({ ...row, catalogId: row.screen_id || row.catalogId })) });
  $("#clipDuration").value = String(Number(campaign.clip_duration_seconds) || 10);
  syncClipDurationSelect();
  setPublicCampaignMode(campaign);
  syncCalculatorModeUI();
  syncGoShareLinkForCurrentMode();
  renderCityFilters();
  renderGrid();
  renderScreens();
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === state.preset);
  });
  showView("calculator");
}

async function createGoMockFromCalculator({ openPreview = false, copy = true } = {}) {
  const plan = buildExcelPlan();
  const selected = plan.screens.filter((screen) => screen.active);
  if (!selected.length) {
    const readyUrl = currentShareUrl() || (ensureShareLinkForCurrentPlan() && currentShareUrl());
    if (copy && readyUrl) {
      const copied = await copyTextNow(readyUrl);
      setGoShareLinkField(readyUrl, { flash: copied });
      if (copied) showToast("Plano nuoroda nukopijuota");
    } else if (copy) {
      showToast(isViaductMode() ? "Pasirinkite bent vieną viaduką" : "Pasirinkite bent vieną ekraną");
    }
    return null;
  }

  const modeKey = goMockModeKey();
  let token = getGoMockTokenForMode(modeKey) || publicCampaignState.token || generateGoMockToken();
  const existing = loadGoMockCampaign(token);
  const payload = buildGoMockPayloadFromPlan(plan, {
    client: testOrderDraft.active ? testOrderDraft.client : plan.client,
    agency: testOrderDraft.active ? testOrderDraft.agency : plan.agency,
    orderNo: existing?.campaign?.order_no || plan.campaignNo || `M${Date.now().toString().slice(-6)}`,
  });
  saveGoMockCampaign(token, payload);
  setGoMockTokenForMode(modeKey, token);
  persistShareTokenOnCurrentOrder(token);

  const goUrl = buildPublicCampaignUrl(token);
  setGoShareLinkField(goUrl, { flash: copy });
  if (copy) {
    const copied = await copyTextNow(goUrl);
    if (copied) {
      showToast(isViaductMode() ? "Viadukų plano nuoroda nukopijuota" : "Ekranų plano nuoroda nukopijuota");
    }
  }

  const orderId = currentShareOrderId() || `share-${token}`;
  try {
    const saved = await playCampaignRequest("/api/play-campaigns", {
      method: "POST",
      body: JSON.stringify({
        token,
        orderId,
        campaign: payload.campaign,
        screens: payload.screens,
        status: payload.campaign?.status || "awaiting_approval",
      }),
    });
    if (saved?.token) {
      token = saved.token;
      setGoMockTokenForMode(modeKey, token);
      saveGoMockCampaign(token, payload);
      persistShareTokenOnCurrentOrder(token);
      publicCampaignState.token = token;
      publicCampaignState.orderId = saved.orderId || orderId;
      setGoShareLinkField(buildPublicCampaignUrl(token));
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Nepavyko įrašyti nuorodos");
    return { token, goUrl, mode: modeKey };
  }
  if (openPreview) window.open(localPreviewUrlForToken(token), "_blank", "noopener");
  return { token, goUrl: buildPublicCampaignUrl(token), mode: modeKey };
}
const ordersFilterState = {
  status: "Visi",
  month: "Visi",
  year: "2026",
};
let lastChangedScreenId = null;

const formatNumber = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 0 });
const formatMoney = new Intl.NumberFormat("lt-LT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const $ = (selector) => document.querySelector(selector);

function loadScriptOnce(src) {
  const existing = document.querySelector(`script[data-lazy-src="${src}"]`);
  if (existing) {
    return existing.dataset.loaded === "1"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error(src)), { once: true });
        });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.dataset.lazySrc = src;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error(`Nepavyko įkelti ${src}`));
    document.head.appendChild(script);
  });
}

let excelLibsPromise = null;
function ensureExcelLibs() {
  if (excelLibsPromise) return excelLibsPromise;
  excelLibsPromise = (async () => {
    if (!window.XLSX) await loadScriptOnce("/skaiciuokle/assets/xlsx.bundle.js");
    if (!window.JSZip) await loadScriptOnce("/skaiciuokle/assets/jszip.min.js");
    if (!window.PikselExcel) await loadScriptOnce("/skaiciuokle/excel-export.js?v=20260921-xls");
  })();
  return excelLibsPromise;
}

/** Hub test orderiai (localStorage) — niekada PocketBase. */
const HUB_TEST_ORDERS_KEY = "pikselHubTestOrders";

function getTestOrderIdFromUrl() {
  try {
    return new URLSearchParams(location.search).get("testOrderId") || "";
  } catch {
    return "";
  }
}

/** Atidaryta iš Hub order modal (Planas → naujas langas). */
function isOpenedFromHub() {
  try {
    return new URLSearchParams(location.search).get("from") === "hub";
  } catch {
    return false;
  }
}

function isStaffPlanView() {
  if (internalPlanEditState.orderId) return true;
  if (liveOrderState.id || getLiveOrderIdFromUrl()) return true;
  if (testOrderDraft.active || getTestOrderIdFromUrl()) return true;
  return isOpenedFromHub();
}

function isClientShareView() {
  return Boolean(getPublicCampaignTokenFromLocation()) && !isStaffPlanView();
}

function applyHeadingActionsChrome() {
  const client = isClientShareView();
  document.body.classList.toggle("client-share-view", client);
  const exportBtn = $("#exportButton");
  if (exportBtn) exportBtn.hidden = false;
  if (!client) return;
  if ($("#resetButton")) $("#resetButton").hidden = true;
  if ($("#createOrderButton")) $("#createOrderButton").hidden = true;
  syncGoShareLinkVisibility({ hide: true });
}

function showHubCloseFallback() {
  let prompt = $("#hubCloseFallback");
  if (!prompt) {
    prompt = document.createElement("div");
    prompt.id = "hubCloseFallback";
    prompt.className = "hub-close-fallback";
    prompt.setAttribute("role", "status");
    prompt.innerHTML = `
      <span>Planas išsaugotas. Galite uždaryti šį langą.</span>
      <button type="button" class="button primary" id="hubCloseFallbackBtn">Uždaryti</button>
    `;
    document.body.appendChild(prompt);
    prompt.querySelector("#hubCloseFallbackBtn")?.addEventListener("click", () => {
      window.close();
    });
  }
  prompt.hidden = false;
}

/** Po Hub plano save: toast → bandyti uždaryti tab'ą; jei nepavyksta — mygtukas. */
function finishHubOpenedSave() {
  showToast("Išsaugota");
  window.close();
  window.setTimeout(() => {
    showHubCloseFallback();
  }, 250);
}

function isEmbedPreview() {
  try {
    return new URLSearchParams(location.search).get("embed") === "1";
  } catch {
    return false;
  }
}

function applyScreenCustomPeriodsFromPlan(plan) {
  const rows = Array.isArray(plan?.screenRows) ? plan.screenRows : [];
  clearAllScreenCustomDates();
  let hasCustom = false;
  rows.forEach((row) => {
    const from = String(row?.from || "").trim();
    const to = String(row?.to || "").trim();
    if (!from || !to) return;
    const catalogId = String(row?.catalogId || "").trim();
    const name = String(row?.name || "").trim();
    const screen = screens.find(
      (item) =>
        (catalogId && String(item.catalogId) === catalogId) ||
        (name && item.name === name)
    );
    if (!screen) return;
    const campaignFrom = String($("#dateFrom")?.value || "").trim();
    const campaignTo = String($("#dateTo")?.value || "").trim();
    if (
      (!campaignFrom || from !== campaignFrom) ||
      (!campaignTo || to !== campaignTo)
    ) {
      screen.customFrom = from;
      screen.customTo = to;
      hasCustom = true;
    }
  });
  state.perScreenDatesMode = hasCustom;
}

function applyOrderSnapshotToCalculator(order) {
  if (!order) return;
  const plan = order.details?.plan || {};
  updateTopbarMeta(
    order.client || "X",
    order.agency || "—",
    order.invoice_id || (order.id ? `U-${String(order.id).replace(/^test-/, "")}` : "U—")
  );

  const isViaduct = orderSnapshotIsViaduct(order);
  const restoredFrequency = parseViaductFrequencyFromCampaign({
    viaduct_frequency: order.viaduct_frequency ?? plan.viaductFrequency,
    intensity: plan.intensity || order.intensity,
  });

  // Set mode before grid/screens so UI + pricing use the right calculator.
  state.mode = isViaduct ? "viaducts" : "screens";
  state.viaductFrequency = isViaduct ? restoredFrequency : 1;

  const clipDuration = plan.clip_duration ?? order.clip_duration ?? 10;
  $("#clipDuration").value = String(clipDuration);
  if (typeof syncClipDurationSelect === "function") syncClipDurationSelect();
  if (order.from) $("#dateFrom").value = order.from;
  if (order.to) $("#dateTo").value = order.to;

  if (Array.isArray(plan.grid) && plan.grid.length === 7) {
    state.grid = plan.grid.map((day) => Array.from({ length: 17 }, (_, i) => Boolean(day?.[i])));
    if (isViaduct) {
      state.viaductGrid = cloneGrid(state.grid);
      state.preset = "custom";
    } else {
      state.screenGrid = cloneGrid(state.grid);
      const intensity = plan.intensity || order.intensity;
      state.preset = intensity ? presetFromIntensity(intensity) : "custom";
      state.screenPreset = state.preset;
      document.querySelectorAll("[data-preset]").forEach((button) => {
        button.classList.toggle("active", button.dataset.preset === state.preset);
      });
    }
  } else if (!isViaduct && (plan.intensity || order.intensity)) {
    state.preset = presetFromIntensity(plan.intensity || order.intensity);
    if (state.preset !== "custom") applyPreset(state.preset);
  } else if (isViaduct) {
    state.viaductGrid = fullGrid();
    state.grid = cloneGrid(state.viaductGrid);
  }

  const screenIds = Array.isArray(order.screens) ? order.screens.map(String) : [];
  const planNames = [
    ...(Array.isArray(plan.screenNames) ? plan.screenNames : []),
    ...((Array.isArray(plan.screenRows) ? plan.screenRows : []).map((row) => row.name)),
  ]
    .map((name) => String(name || "").trim())
    .filter(Boolean);
  const planCatalogIds = (Array.isArray(plan.screenRows) ? plan.screenRows : [])
    .map((row) => String(row.catalogId || "").trim())
    .filter(Boolean);
  if (screenIds.length || planNames.length || planCatalogIds.length) {
    const ids = new Set([...screenIds, ...planCatalogIds]);
    const names = new Set(planNames);
    screens.forEach((screen) => {
      screen.selected =
        ids.has(String(screen.catalogId)) ||
        ids.has(String(screen.id)) ||
        ids.has(String(screen.name)) ||
        names.has(screen.name);
    });
  } else if (isViaduct) {
    ensureAllViaductsSelected();
  } else {
    screens.forEach((screen) => {
      screen.selected = false;
    });
  }

  applyScreenCustomPeriodsFromPlan(plan);
  setBillingPeriodsFromOrder(order);

  state.city = "Visi";
  state.search = "";
  if ($("#searchInput")) $("#searchInput").value = "";
  syncCalculatorModeUI();
  showShareLinkForOrder(order);
  renderCityFilters();
  renderGrid();
  renderScreens();
  showView("calculator");
}

function enterEmbedPreviewMode() {
  document.body.classList.add("embed-preview");
  $("#calculatorView")?.classList.add("public-readonly");
  publicCampaignState.locked = true;
  const notice = $("#publicCampaignNotice");
  if (notice) notice.hidden = true;
  ["#resetButton", "#exportButton", "#createOrderButton"].forEach((selector) => {
    const button = $(selector);
    if (button) button.hidden = true;
  });
  const selectAll = $("#selectAllButton");
  if (selectAll) selectAll.disabled = true;
  if (typeof setClipDurationDisabled === "function") setClipDurationDisabled(true);
  if ($("#dateFrom")) $("#dateFrom").disabled = true;
  if ($("#dateTo")) $("#dateTo").disabled = true;
  if ($("#searchInput")) $("#searchInput").disabled = true;
  document.querySelectorAll(".date-picker-trigger, #presetButtons button, .city-filters button").forEach((element) => {
    element.disabled = true;
  });
  const wavesOpen = $("#campaignWavesOpen");
  if (wavesOpen) wavesOpen.disabled = true;
  const perScreenToggle = $("#perScreenDatesToggle");
  if (perScreenToggle) perScreenToggle.disabled = true;
  document.querySelectorAll("[data-view-target]").forEach((element) => {
    element.hidden = true;
  });

  if (!window.__pikselEmbedPlanListener) {
    window.__pikselEmbedPlanListener = true;
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin) return;
      if (!event.data || event.data.type !== "piksel-embed-plan") return;
      if (event.data.order) applyOrderSnapshotToCalculator(event.data.order);
      enterEmbedPreviewMode();
    });
  }
}

function readHubTestOrders() {
  try {
    const raw = JSON.parse(localStorage.getItem(HUB_TEST_ORDERS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function findHubTestOrder(hubTestId) {
  const raw = String(hubTestId || "").trim();
  if (!raw) return null;
  const withTest = raw.startsWith("test-") ? raw : `test-${raw}`;
  const withoutTest = raw.replace(/^test-/, "");
  return (
    readHubTestOrders().find((item) => {
      const id = String(item.id);
      const invoice = String(item.invoice_id || "");
      return (
        id === raw ||
        id === withTest ||
        id === withoutTest ||
        invoice === raw ||
        invoice === withoutTest
      );
    }) || null
  );
}

function writeHubTestOrders(orders) {
  localStorage.setItem(HUB_TEST_ORDERS_KEY, JSON.stringify(orders));
}

function notifyHubTestOrdersChanged(orderId) {
  try {
    const channel = new BroadcastChannel("piksel-test-orders");
    channel.postMessage({ type: "updated", id: String(orderId || "") });
    channel.close();
  } catch {
    /* ignore */
  }
}

function hubPlanText(value) {
  return String(value ?? "").trim();
}

function hubPlanLower(value) {
  return hubPlanText(value).toLocaleLowerCase("lt-LT");
}

function hubPlanSortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function hubPlanIntensity(order) {
  return hubPlanLower(order.intensity || order.details?.plan?.intensity);
}

function hubPlanScreenIds(order) {
  const direct = (order.screens || []).map((id) => hubPlanText(id)).filter(Boolean);
  if (direct.length) return hubPlanSortedUnique(direct);
  const rows = order.details?.plan?.screenRows || [];
  return hubPlanSortedUnique(rows.map((row) => hubPlanText(row.catalogId)));
}

function hubPlanScreenNames(order) {
  const rows = order.details?.plan?.screenRows || [];
  const fromRows = rows.map((row) => hubPlanLower(row.name)).filter(Boolean);
  if (fromRows.length) return hubPlanSortedUnique(fromRows);
  return hubPlanSortedUnique((order.details?.plan?.screenNames || []).map((name) => hubPlanLower(name)));
}

function hubPlanRowStamp(order) {
  const rows = order.details?.plan?.screenRows || [];
  const from = hubPlanText(order.from);
  const to = hubPlanText(order.to);
  return rows
    .map((row) => {
      const name = hubPlanLower(row.name);
      if (!name) return "";
      return [name, hubPlanText(row.from) || from, hubPlanText(row.to) || to].join("|");
    })
    .filter(Boolean)
    .sort()
    .join(";");
}

function hubBroadcastPlanFieldsDiffer(before, after) {
  const beforeFrom = hubPlanText(before.from);
  const afterFrom = hubPlanText(after.from);
  const beforeTo = hubPlanText(before.to);
  const afterTo = hubPlanText(after.to);
  const dates =
    Boolean(beforeFrom && afterFrom && beforeFrom !== afterFrom) ||
    Boolean(beforeTo && afterTo && beforeTo !== afterTo);
  const beforeRows = hubPlanRowStamp(before);
  const afterRows = hubPlanRowStamp(after);
  const rowDates = Boolean(beforeRows && afterRows && beforeRows !== afterRows);
  const beforeIds = hubPlanScreenIds(before);
  const afterIds = hubPlanScreenIds(after);
  const beforeNames = hubPlanScreenNames(before);
  const afterNames = hubPlanScreenNames(after);
  let screens = false;
  if (beforeNames.length && afterNames.length) {
    screens = beforeNames.join(";") !== afterNames.join(";");
  } else if (beforeIds.length && afterIds.length) {
    screens = beforeIds.join(";") !== afterIds.join(";");
  } else if (
    (beforeIds.length > 0 || beforeNames.length > 0) !==
    (afterIds.length > 0 || afterNames.length > 0)
  ) {
    screens = true;
  }
  const beforeIntensity = hubPlanIntensity(before);
  const afterIntensity = hubPlanIntensity(after);
  const intensity =
    Boolean(beforeIntensity && afterIntensity) && beforeIntensity !== afterIntensity;
  return dates || rowDates || screens || intensity;
}

function hubPlanChangedAt(existing, plan, nowIso) {
  const existingDetails = existing.details && typeof existing.details === "object" ? existing.details : {};
  const kept = hubPlanText(existingDetails.planChangedAt);
  if (!existing.id) return kept;
  const screens = (plan.screens || []).filter((screen) => screen.active);
  const next = {
    id: existing.id,
    from: plan.from,
    to: plan.to,
    intensity: plan.intensity || existing.intensity || "",
    screens: screens.map((screen) => screen.catalogId || screen.id).filter(Boolean),
    details: {
      plan: {
        intensity: plan.intensity,
        screenNames: screens.map((screen) => screen.name),
        screenRows: screens.map((screen) => ({
          name: screen.name,
          catalogId: screen.catalogId || "",
          from: screen.from || undefined,
          to: screen.to || undefined,
        })),
      },
    },
  };
  if (!hubBroadcastPlanFieldsDiffer(existing, next)) return kept;
  return hubPlanText(nowIso) || new Date().toISOString();
}

function upsertHubTestOrderFromPlan(plan, meta) {
  const id = String(meta.id || `test-${Date.now()}`);
  const orderId = id.startsWith("test-") ? id : `test-${id}`;
  const screens = (plan.screens || []).filter((s) => s.active);
  const screenIds = screens.map((s) => s.catalogId || s.id).filter(Boolean);
  const screenPrices = {};
  for (const s of screens) {
    const sid = s.catalogId || s.id;
    if (sid && typeof s.clipPrice === "number") screenPrices[sid] = s.clipPrice;
  }
  const total = Number(plan.total) || 0;
  const clipDuration = Number(plan.clipDuration) || 10;
  const viaductFrequency = Number(plan.viaductFrequency) || 1;
  const existing = readHubTestOrders().find((item) => String(item.id) === String(orderId)) || {};
  const existingDetails = existing.details && typeof existing.details === "object" ? existing.details : {};
  const planChangedAt = hubPlanChangedAt(existing, plan);
  const order = {
    ...existing,
    id: orderId,
    client: existing.client || meta.client || plan.client || "Test",
    agency: existing.agency || meta.agency || plan.agency || "—",
    invoice_id: existing.invoice_id || orderId.replace(/^test-/, ""),
    approved: Boolean(existing.approved),
    viaduct: Boolean(plan.viaduct),
    from: plan.from,
    to: plan.to,
    media_received: Boolean(existing.media_received),
    invoice_issued: Boolean(existing.invoice_issued),
    invoice_sent: Boolean(existing.invoice_sent),
    final_price: total,
    updated: new Date().toISOString(),
    intensity: plan.intensity || existing.intensity || "Medi",
    screens: screenIds,
    billingPeriods: (state.billingPeriods || []).map((period) => ({
      id: period.id,
      active_from: period.from,
      active_to: period.to,
    })),
    grid: plan.grid,
    clip_duration: clipDuration,
    viaduct_frequency: viaductFrequency,
    on_sale_screens: existing.on_sale_screens || [],
    on_sale_discount: existing.on_sale_discount || 0,
    hidden_screens: existing.hidden_screens || [],
    details: {
      ...existingDetails,
      ...(planChangedAt ? { planChangedAt } : {}),
      isTest: true,
      discount: typeof existingDetails.discount === "number" ? existingDetails.discount : 80,
      total,
      finalPrice: total,
      amountDiscount: Math.round((plan.volumeDiscount || 0) * 100),
      periodDiscount: Math.round((plan.periodDiscount || 0) * 100),
      screenPrices,
      plan: {
        grid: plan.grid,
        clip_duration: clipDuration,
        intensity: plan.intensity,
        viewsPerHour: plan.viewsPerHour,
        viaduct: Boolean(plan.viaduct),
        viaductFrequency,
        days: plan.days,
        screenNames: screens.map((s) => s.name),
        screenRows: screens.map((s) => ({
          name: s.name,
          city: s.city,
          owner: s.owner || "",
          type: s.type || "",
          resolution: s.resolution || "",
          catalogId: s.catalogId || "",
          impressions: s.impressions,
          ots: s.ots,
          clipPrice: s.clipPrice,
          cpt: s.cpt,
          gross: s.gross,
          screenDiscount: s.screenDiscount,
          net: s.net,
          from: s.from || undefined,
          to: s.to || undefined,
          days: typeof s.days === "number" ? s.days : undefined,
        })),
        volumeDiscount: plan.volumeDiscount,
        periodDiscount: plan.periodDiscount,
        total: plan.total,
      },
    },
  };
  const others = readHubTestOrders().filter((item) => String(item.id) !== String(orderId));
  writeHubTestOrders([order, ...others]);
  notifyHubTestOrdersChanged(orderId);
  return order;
}

let hubPlanSyncTimer = 0;
let lastHubPlanFingerprint = "";

function hubPlanFingerprint(plan) {
  const activeIds = (plan.screens || [])
    .filter((screen) => screen.active)
    .map((screen) => String(screen.catalogId || screen.id || screen.name || ""))
    .sort();
  return JSON.stringify({
    from: plan.from,
    to: plan.to,
    total: plan.total,
    intensity: plan.intensity,
    clipDuration: plan.clipDuration,
    viaduct: plan.viaduct,
    viaductFrequency: plan.viaductFrequency,
    screens: activeIds,
    grid: plan.grid,
  });
}

function scheduleHubOpenedPlanSync() {
  if (!testOrderDraft.active || publicCampaignState.locked) return;
  const hubId = getTestOrderIdFromUrl() || (testOrderDraft.id ? `test-${testOrderDraft.id}` : "");
  if (!hubId) return;
  window.clearTimeout(hubPlanSyncTimer);
  hubPlanSyncTimer = window.setTimeout(() => {
    try {
      const plan = buildExcelPlan();
      const fingerprint = hubPlanFingerprint(plan);
      if (fingerprint === lastHubPlanFingerprint) return;
      lastHubPlanFingerprint = fingerprint;
      upsertHubTestOrderFromPlan(plan, {
        id: hubId,
        client: testOrderDraft.client,
        agency: testOrderDraft.agency,
      });
    } catch {
      /* planas dar nepilnas */
    }
  }, 200);
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoDateTyping(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

let rangeCalendarMonth = null;
let rangeSelectingEnd = false;

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return localDateString(date) === value ? date : null;
}

function calendarMonthLabel(date) {
  return new Intl.DateTimeFormat("lt-LT", { month: "short", year: "numeric" }).format(date).replace(/^./, (letter) => letter.toUpperCase());
}

function calendarMonthHtml(monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const leadingDays = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - leadingDays);
  const from = $("#dateFrom").value;
  const to = $("#dateTo").value;
  const today = localDateString(new Date());
  const weekdays = ["P", "A", "T", "K", "P", "Š", "S"].map((day) => `<span>${day}</span>`).join("");
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const iso = localDateString(date);
    const classes = ["range-day"];
    if (date.getMonth() !== monthStart.getMonth()) classes.push("outside");
    if (iso > from && iso < to) classes.push("in-range");
    if (iso === from) classes.push("range-start");
    if (iso === to) classes.push("range-end");
    if (iso === today) classes.push("today");
    return `<button class="${classes.join(" ")}" type="button" data-range-date="${iso}" aria-label="${iso}"><span>${date.getDate()}</span></button>`;
  }).join("");
  return `<div class="range-month"><div class="range-weekdays">${weekdays}</div><div class="range-days">${days}</div></div>`;
}

function renderRangeCalendar() {
  const calendar = $("#rangeCalendar");
  if (!rangeCalendarMonth) {
    const selected = parseIsoDate($("#dateFrom").value) || new Date();
    rangeCalendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  }
  const nextMonth = new Date(rangeCalendarMonth.getFullYear(), rangeCalendarMonth.getMonth() + 1, 1);
  calendar.innerHTML = `
    <div class="range-calendar-toolbar">
      <button class="range-nav" type="button" data-range-nav="prev" aria-label="Ankstesni mėnesiai">‹</button>
      <div><strong>${calendarMonthLabel(rangeCalendarMonth)}</strong><strong>${calendarMonthLabel(nextMonth)}</strong></div>
      <button class="range-nav" type="button" data-range-nav="next" aria-label="Kiti mėnesiai">›</button>
    </div>
    <div class="range-months">${calendarMonthHtml(rangeCalendarMonth)}${calendarMonthHtml(nextMonth)}</div>`;
}

function openRangeCalendar() {
  rangeSelectingEnd = false;
  const selected = parseIsoDate($("#dateFrom").value) || new Date();
  rangeCalendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  renderRangeCalendar();
  $("#rangeCalendar").hidden = false;
}

function closeRangeCalendar() {
  $("#rangeCalendar").hidden = true;
}

function setDefaultDates() {
  const from = new Date();
  from.setDate(from.getDate() + 1);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  $("#dateFrom").value = localDateString(from);
  $("#dateTo").value = localDateString(to);
}

function isViaductMode() {
  return state.mode === "viaducts";
}

function cloneGrid(grid) {
  return (grid || emptyGrid()).map((day) => [...day]);
}

function getViewsPerHour() {
  if (isViaductMode()) return 60 / Math.max(1, Number(state.viaductFrequency) || 1);
  return 30;
}

function getClipDurationSeconds() {
  if (isViaductMode()) return 10;
  return Number($("#clipDuration")?.value) || 10;
}

function modeScreens() {
  return screens.filter((screen) => (isViaductMode() ? screen.viaduct : !screen.viaduct));
}

function selectedModeScreens() {
  return modeScreens().filter((screen) => screen.selected);
}

/** Standartinė ekrano nuolaida vs pilno miesto paketo nuolaida */
const STANDARD_SCREEN_DISCOUNT = 0.8;
const PACKAGE_SCREEN_DISCOUNT = 0.86;
const PACKAGE_CITIES = ["Vilnius", "Kaunas"];
const PACKAGE_UPSELL_MIN_SCREENS = {
  Vilnius: 8,
  Kaunas: 7,
};

/** Vilniaus Akropolis △ — atskiras ekranas, ne miesto paketo dalis. */
function isExcludedFromCityPackage(screen) {
  if (screen.city !== "Vilnius") return false;
  return /akropolis/i.test(String(screen.name || ""));
}

function packageScreensForCity(city) {
  return modeScreens().filter(
    (screen) => screen.city === city && !isExcludedFromCityPackage(screen)
  );
}

function isCityPackageComplete(city) {
  const packageScreens = packageScreensForCity(city);
  return (
    packageScreens.length > 0 &&
    packageScreens.every((screen) => screen.selected)
  );
}

/** Paketo nuolaida tik kai plane yra VISI to miesto paketo ekranai (dabartiniame režime). */
function getScreenDiscountRate(screen, completeCities) {
  if (!PACKAGE_CITIES.includes(screen.city)) return STANDARD_SCREEN_DISCOUNT;
  if (isExcludedFromCityPackage(screen)) return STANDARD_SCREEN_DISCOUNT;
  const complete = completeCities
    ? completeCities.has(screen.city)
    : isCityPackageComplete(screen.city);
  return complete ? PACKAGE_SCREEN_DISCOUNT : STANDARD_SCREEN_DISCOUNT;
}

function currentCompleteCities() {
  return new Set(PACKAGE_CITIES.filter((city) => isCityPackageComplete(city)));
}

function applyCityPackage(city) {
  if (publicCampaignState.locked) return;
  const packageScreens = packageScreensForCity(city);
  if (!packageScreens.length) return;
  const allOn = packageScreens.every((screen) => screen.selected);
  packageScreens.forEach((screen) => {
    screen.selected = !allOn;
  });
  renderPackageFilters();
  renderScreens();
}

function completeCityPackage(city) {
  if (publicCampaignState.locked) return;
  const packageScreens = packageScreensForCity(city);
  if (!packageScreens.length) return;
  packageScreens.forEach((screen) => {
    screen.selected = true;
  });
  renderPackageFilters();
  renderScreens();
}

function packageCityTitle(city) {
  return city === "Kaunas" ? "Visas Kaunas" : "Visas Vilnius";
}

function packageCityApplyLabel(city) {
  return city === "Kaunas" ? "Pridėti Kauną" : "Pridėti Vilnių";
}

function packageBarSubtitle(offer) {
  const pct = offer.cheaperPct;
  if (pct > 0) return `${pct}&nbsp;% mažesnė vidutinė ekrano kaina`;
  if (pct < 0) return `${Math.abs(pct)}&nbsp;% didesnė vidutinė ekrano kaina`;
  return "Ta pati vidutinė ekrano kaina";
}

function formatExtraCostLine(amount) {
  const rounded = Math.round(amount * 100) / 100;
  if (rounded > 0) return `už +${formatMoney.format(rounded)}`;
  if (rounded < 0) return `sutaupytumėte ${formatMoney.format(Math.abs(rounded))}`;
  return "už 0 €";
}

function renderPackageSide(offer) {
  const isKaunas = offer.city === "Kaunas";
  return `
    <div class="package-side ${isKaunas ? "package-kaunas" : "package-vilnius"}">
      <div class="city-icon">${isKaunas ? "🏢" : "🏙️"}</div>
      <div class="package-copy">
        <div class="package-title${isKaunas ? " green-text" : ""}">${packageCityTitle(offer.city)}</div>
        <div class="package-subtitle">${packageBarSubtitle(offer)}</div>
      </div>
      <div class="package-price">
        <strong>${formatMoney.format(offer.withAvg)}</strong>
        <span>vietoje <s>${formatMoney.format(offer.withoutAvg)}</s></span>
      </div>
      <div class="package-extra">
        <strong>+${formatScreenCount(offer.extraScreens)}</strong>
        <span>${formatExtraCostLine(offer.extraCost)}</span>
        <span class="ots${isKaunas ? " green-text" : ""}">↑ +${formatNumber.format(offer.extraOts)} OTS</span>
      </div>
      <button type="button" class="package-btn ${isKaunas ? "green" : "blue"}" data-complete-package="${offer.city}">
        ${packageCityApplyLabel(offer.city)}
      </button>
    </div>`;
}

function renderPackageStrip(offers) {
  return offers.map((offer) => `<div class="package-bar">${renderPackageSide(offer)}</div>`).join("");
}

function screensNetSum(screenList, completeCities) {
  return screenList.reduce(
    (sum, screen) => sum + (calculateScreen(screen, getStatsForScreen(screen), completeCities)?.net || 0),
    0
  );
}

function averageScreenFinalPrice(screenList, discounts, completeCities) {
  if (!screenList.length) return 0;
  const rowTotal = screensNetSum(screenList, completeCities);
  const final = rowTotal * (1 - (discounts?.volume || 0) - (discounts?.period || 0));
  return final / screenList.length;
}

function renderPackageFilters() {
  const host = $("#packageFilters");
  if (!host) return;
  if (isViaductMode()) {
    host.innerHTML = "";
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const pct = Math.round(PACKAGE_SCREEN_DISCOUNT * 100);
  host.innerHTML = PACKAGE_CITIES.map((city) => {
    const count = packageScreensForCity(city).length;
    if (!count) return "";
    const active = isCityPackageComplete(city);
    const label = packageCityTitle(city);
    return `<button type="button" class="package-btn${active ? " active" : ""}" data-package-city="${city}" ${
      publicCampaignState.locked ? "disabled" : ""
    }><span class="package-btn-label">${label}</span><span class="package-btn-badge">${pct}%</span></button>`;
  }).join("");
}

function ensureAllViaductsSelected() {
  screens.forEach((screen) => {
    if (screen.viaduct) screen.selected = true;
  });
}

function resetScreenSelectionDefaults() {
  screens.forEach((screen) => {
    screen.selected = false;
  });
}

function syncCalculatorModeUI() {
  const viaduct = isViaductMode();
  const publicLockedMode = publicCampaignState.active;
  const tabs = document.querySelector(".screen-mode-tabs");
  if (tabs) tabs.hidden = publicLockedMode;
  let modeLabel = $("#publicModeLabel");
  if (publicLockedMode) {
    if (!modeLabel) {
      modeLabel = document.createElement("div");
      modeLabel.id = "publicModeLabel";
      modeLabel.className = "public-mode-label";
      tabs?.parentElement?.insertBefore(modeLabel, tabs);
    }
    modeLabel.hidden = false;
    modeLabel.textContent = viaduct ? "Viadukai" : "Ekranai";
  } else if (modeLabel) {
    modeLabel.hidden = true;
  }

  document.querySelectorAll("[data-calc-mode]").forEach((button) => {
    const active = button.dataset.calcMode === state.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.disabled = false;
    button.removeAttribute("aria-disabled");
  });

  const clipField = $("#clipDurationField");
  if (clipField) clipField.hidden = viaduct;
  const screenPresets = $("#screenPresetField");
  if (screenPresets) screenPresets.hidden = viaduct;
  const viaductField = $("#viaductIntensityField");
  if (viaductField) viaductField.hidden = !viaduct;

  const frequencySelect = $("#viaductFrequency");
  if (frequencySelect) {
    frequencySelect.value = String(Number(state.viaductFrequency) || 1);
    if (typeof syncViaductFrequencySelect === "function") syncViaductFrequencySelect();
  }

  if (viaduct) {
    $("#clipDuration").value = "10";
    if (typeof syncClipDurationSelect === "function") syncClipDurationSelect();
  }

  document.body.classList.toggle("viaduct-mode", viaduct);
  document.body.classList.toggle("screens-mode", !viaduct);
  $("#calculatorView")?.classList.toggle("public-mode-viaducts", publicLockedMode && viaduct);
  $("#calculatorView")?.classList.toggle("public-mode-screens", publicLockedMode && !viaduct);
}

function setCalculatorMode(mode) {
  if (mode !== "screens" && mode !== "viaducts") return;
  if (publicCampaignState.active) return;
  if (state.mode === mode) return;

  if (state.mode === "screens") {
    state.screenGrid = cloneGrid(state.grid);
    state.screenPreset = state.preset;
  } else {
    state.viaductGrid = cloneGrid(state.grid);
  }

  state.mode = mode;
  if (mode === "screens") {
    state.grid = cloneGrid(state.screenGrid || emptyGrid());
    state.preset = state.screenPreset || "medi";
    if (!state.screenGrid) applyPreset(state.preset);
  } else {
    state.grid = cloneGrid(state.viaductGrid || fullGrid());
    state.city = "Visi";
    state.search = "";
    if ($("#searchInput")) $("#searchInput").value = "";
    ensureAllViaductsSelected();
  }

  syncCalculatorModeUI();
  syncGoShareLinkForCurrentMode();
  renderCityFilters();
  renderGrid();
  renderScreens();
}

function setViaductFrequency(frequency) {
  const next = Number(frequency);
  if (![1, 2, 4].includes(next)) return;
  state.viaductFrequency = next;
  const select = $("#viaductFrequency");
  if (select) select.value = String(next);
  if (typeof syncViaductFrequencySelect === "function") syncViaductFrequencySelect();
  renderGrid();
  renderScreens();
}

function applyPreset(preset, { phase } = {}) {
  if (publicCampaignState.locked) return;
  if (isViaductMode()) return;
  const minGrid = [
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  ];
  state.preset = preset;
  if (preset === "medi") {
    if (phase === 0 || phase === 1) state.mediPhase = phase;
  } else if (preset === "min") {
    if (phase === 0 || phase === 1) state.minPhase = phase;
  }
  const mediPhase = Number(state.mediPhase) === 1 ? 1 : 0;
  const minPhase = Number(state.minPhase) === 1 ? 1 : 0;
  state.grid = Array.from({ length: 7 }, (_, day) =>
    hours.map((hour, hourIndex) => {
      if (preset === "max") return true;
      // phase 0: P 6-7 … S 22-23; phase 1: P 7-8 … S 21-22
      if (preset === "medi") return (day + hourIndex + mediPhase) % 2 === 0;
      if (preset === "min") {
        // phase 1: pastumiam raštą per 1 val. — užpildo kitas valandas
        const idx = minPhase === 1 ? (hourIndex + 1) % 17 : hourIndex;
        return minGrid[day][idx] === 1;
      }
      return day < 5 && ((hour >= 7 && hour < 9) || (hour >= 16 && hour < 19));
    }),
  );
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === preset);
    if (button.dataset.preset === "medi") {
      button.title = mediPhase === 1
        ? "Medi · fazė 2 (P 7 → S 21–22). Dvigubas paspaudimas — kita fazė"
        : "Medi · fazė 1 (P 6 → S 22–23). Dvigubas paspaudimas — kita fazė";
      button.dataset.intensityPhase = String(mediPhase);
    }
    if (button.dataset.preset === "min") {
      button.title = minPhase === 1
        ? "Min · fazė 2 (perskirstytos valandos). Dvigubas paspaudimas — kita fazė"
        : "Min · fazė 1 (bazinis). Dvigubas paspaudimas — kita fazė";
      button.dataset.intensityPhase = String(minPhase);
    }
  });
  renderGrid();
  renderScreens();
}

function toggleIntensityPhase(preset) {
  if (publicCampaignState.locked || isViaductMode()) return;
  if (preset !== "medi" && preset !== "min") return;
  const key = preset === "medi" ? "mediPhase" : "minPhase";
  const next = Number(state[key]) === 1 ? 0 : 1;
  applyPreset(preset, { phase: next });
  if (preset === "medi") {
    showToast(next === 1 ? "Medi perskirstytas: P 7 → S 21–22" : "Medi bazinis: P 6 → S 22–23");
  } else {
    showToast(next === 1 ? "Min perskirstytas (kitos valandos)" : "Min bazinis");
  }
}

function renderCityFilters() {
  const pool = modeScreens();
  const cities = isViaductMode()
    ? ["Visi", "Vilnius"]
    : ["Visi", "Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Regionai"];
  $("#cityFilters").innerHTML = cities.map((city) => {
    const count = city === "Visi" ? pool.length : pool.filter((screen) => screen.city === city).length;
    return `<button class="${state.city === city ? "active" : ""}" data-city="${city}" ${publicCampaignState.locked ? "disabled" : ""}>${city} · ${count}</button>`;
  }).join("");
  renderPackageFilters();
}

function markGridCustom() {
  state.preset = "custom";
  document.querySelectorAll("[data-preset]").forEach((item) => item.classList.remove("active"));
}

function toggleDayColumn(dayIndex) {
  const allOn = hours.every((_, hourIndex) => state.grid[dayIndex][hourIndex]);
  hours.forEach((_, hourIndex) => {
    state.grid[dayIndex][hourIndex] = !allOn;
  });
}

function toggleHourRow(hourIndex) {
  const allOn = dayLabels.every((_, dayIndex) => state.grid[dayIndex][hourIndex]);
  dayLabels.forEach((_, dayIndex) => {
    state.grid[dayIndex][hourIndex] = !allOn;
  });
}

function renderGrid() {
  const locked = publicCampaignState.locked;
  const viewsPerHour = getViewsPerHour();
  const table = $("#scheduleGrid");
  table.classList.toggle("viaduct-grid", isViaductMode());
  table.innerHTML = `
    <thead><tr>
      <th>Val.</th>
      ${dayLabels.map((day, dayIndex) => `
        <th>
          <button
            type="button"
            class="axis-btn"
            data-toggle-day="${dayIndex}"
            aria-label="Perjungti ${day} dieną"
            title="Visa ${day} diena"
            ${locked ? "disabled" : ""}
          >${day}</button>
        </th>`).join("")}
    </tr></thead>
    <tbody>
      ${hours.map((hour, hourIndex) => `
        <tr>
          <td>
            <button
              type="button"
              class="axis-btn"
              data-toggle-hour="${hourIndex}"
              aria-label="Perjungti ${hour}–${hour + 1}"
              title="Visa ${hour}–${hour + 1} eilė"
              ${locked ? "disabled" : ""}
            >${hour}–${hour + 1}</button>
          </td>
          ${dayLabels.map((_, dayIndex) => {
            const active = state.grid[dayIndex][hourIndex];
            const label = active && isViaductMode() ? String(viewsPerHour) : "";
            return `<td><button
              type="button"
              class="${active ? "active" : ""}"
              data-day="${dayIndex}"
              data-hour="${hourIndex}"
              aria-label="${dayLabels[dayIndex]} ${hour}–${hour + 1}"
              ${locked ? "disabled" : ""}
            >${label}</button></td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>`;
}

function getCampaignStats() {
  return getStatsForRange($("#dateFrom")?.value, $("#dateTo")?.value);
}

function getActiveBillingPeriods() {
  return Array.isArray(state.billingPeriods) && state.billingPeriods.length
    ? state.billingPeriods
    : null;
}

function normalizeBillingPeriod(period) {
  const from = String(
    period?.from || period?.active_from || period?.start || period?.dateFrom || ""
  ).trim();
  const to = String(
    period?.to || period?.active_to || period?.end || period?.dateTo || ""
  ).trim();
  if (!from || !to) return null;
  return {
    id: String(period?.id || `wave-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    from,
    to,
  };
}

function setBillingPeriodsFromOrder(order) {
  const raw =
    order?.billingPeriods ||
    order?.billing_periods ||
    order?.activePeriods ||
    order?.details?.billingPeriods ||
    [];
  state.billingPeriods = Array.isArray(raw)
    ? raw.map(normalizeBillingPeriod).filter(Boolean)
    : [];
}

function isIsoInBillingPeriods(iso, periods) {
  if (!periods?.length) return true;
  return periods.some((period) => iso >= period.from && iso <= period.to);
}

function describeBillingGaps(envelopeFrom, envelopeTo, periods) {
  if (!periods?.length || !envelopeFrom || !envelopeTo) return null;
  const sorted = [...periods].sort((a, b) => a.from.localeCompare(b.from));
  const gaps = [];
  let cursor = envelopeFrom;
  for (const period of sorted) {
    if (period.from > cursor) {
      const gapEnd = localDateString(
        new Date(new Date(`${period.from}T12:00:00`).getTime() - 86400000)
      );
      if (gapEnd >= cursor) gaps.push({ from: cursor, to: gapEnd });
    }
    const next = localDateString(
      new Date(new Date(`${period.to}T12:00:00`).getTime() + 86400000)
    );
    if (next > cursor) cursor = next;
  }
  if (cursor <= envelopeTo) gaps.push({ from: cursor, to: envelopeTo });
  if (!gaps.length) return null;
  const gapDays = gaps.reduce((sum, gap) => sum + getStatsForRange(gap.from, gap.to, { ignoreBillingPeriods: true }).days, 0);
  return { gaps, gapDays };
}

function validateBillingPeriodsDraft(periods, envelopeFrom, envelopeTo) {
  if (!periods.length) return "Pridėkite bent vieną bangą arba išvalykite split.";
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const sorted = [...periods].sort((a, b) => a.from.localeCompare(b.from));
  for (const period of sorted) {
    if (!isoDate.test(period.from) || !isoDate.test(period.to)) {
      return "Datos formatas: yyyy-mm-dd";
    }
    if (period.from > period.to) return "„Nuo“ negali būti vėlesnė už „Iki“.";
    if (envelopeFrom && period.from < envelopeFrom) {
      return "Banga negali prasidėti anksčiau už kampanijos pradžią.";
    }
    if (envelopeTo && period.to > envelopeTo) {
      return "Banga negali baigtis vėliau už kampanijos pabaigą.";
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from <= sorted[i - 1].to) {
      return "Bangos negali persidengti.";
    }
  }
  return null;
}

/** Dienos + aktyvūs slotai konkretiam from–to (pagal state.grid). */
function getStatsForRange(fromValue, toValue, options = {}) {
  if (!fromValue || !toValue) return { days: 0, activeSlots: 0 };
  const from = new Date(`${fromValue}T12:00:00`);
  const to = new Date(`${toValue}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return { days: 0, activeSlots: 0 };
  }
  const periods = options.ignoreBillingPeriods ? null : getActiveBillingPeriods();
  let cursor = new Date(from);
  let days = 0;
  let activeSlots = 0;
  while (cursor <= to && days < 370) {
    const iso = localDateString(cursor);
    if (isIsoInBillingPeriods(iso, periods)) {
      const jsDay = cursor.getDay();
      const gridDay = jsDay === 0 ? 6 : jsDay - 1;
      activeSlots += state.grid[gridDay].filter(Boolean).length;
      days += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { days, activeSlots };
}

function getScreenDateRange(screen) {
  const campaignFrom = String($("#dateFrom")?.value || "").trim();
  const campaignTo = String($("#dateTo")?.value || "").trim();
  const from = String(screen?.customFrom || "").trim() || campaignFrom;
  const to = String(screen?.customTo || "").trim() || campaignTo;
  const isCustom = Boolean(
    String(screen?.customFrom || "").trim() || String(screen?.customTo || "").trim()
  );
  return { from, to, isCustom, campaignFrom, campaignTo };
}

function getStatsForScreen(screen) {
  const { from, to } = getScreenDateRange(screen);
  return getStatsForRange(from, to);
}

function formatScreenPeriodHint(from, to) {
  const fmt = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    return m ? `${m[2]}-${m[3]}` : String(iso || "");
  };
  if (!from && !to) return "";
  if (from && to) return `${fmt(from)}–${fmt(to)}`;
  return fmt(from || to);
}

function clearAllScreenCustomDates() {
  screens.forEach((screen) => {
    screen.customFrom = "";
    screen.customTo = "";
  });
}

function getSelectedScreensDateUnion() {
  const selected = selectedModeScreens();
  if (!selected.length) {
    return {
      from: String($("#dateFrom")?.value || "").trim(),
      to: String($("#dateTo")?.value || "").trim(),
    };
  }
  let minFrom = "";
  let maxTo = "";
  selected.forEach((screen) => {
    const { from, to } = getScreenDateRange(screen);
    if (from && (!minFrom || from < minFrom)) minFrom = from;
    if (to && (!maxTo || to > maxTo)) maxTo = to;
  });
  return {
    from: minFrom || String($("#dateFrom")?.value || "").trim(),
    to: maxTo || String($("#dateTo")?.value || "").trim(),
  };
}

function getDiscounts(selectedCount, campaignDays) {
  if (isViaductMode()) {
    let period = 0;
    if (campaignDays >= 365) period = 0.25;
    else if (campaignDays >= 28) period = 0.10;
    return { volume: 0, period };
  }
  const volume = Math.min(selectedCount, 20) / 100;
  const period = campaignDays > 0 ? Math.min(Math.floor((campaignDays - 1) / 7) + 1, 18) / 100 : 0;
  return { volume, period };
}

function formatScreenCount(count) {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return `${count} ekranų`;
  if (lastOne === 1) return `${count} ekranas`;
  if (lastOne >= 2 && lastOne <= 9) return `${count} ekranai`;
  return `${count} ekranų`;
}

const mockOrders = [
  { id: "5219", client: "Viada", agency: "X", status: "Patvirtinta", from: "2026-07-20", to: "2026-07-26", media: true, playerEnabled: true, price: 1940.77, invoice: false, sent: false, clipDuration: 10, intensity: "Medi", screens: ["Panorama", "Laisvės kelias", "Narbuto žiedas", "Justiniškės"], grid: Array.from({ length: 7 }, () => Array(17).fill(true)) },
  { id: "5218", client: "Panorama", agency: "X", status: "Patvirtinta", from: "2026-07-20", to: "2026-07-26", media: true, playerEnabled: true, price: 962.23, invoice: false, sent: false, clipDuration: 10, intensity: "Medi", screens: ["Panorama", "Laisvės kelias", "Narbuto žiedas", "Justiniškės"], grid: Array.from({ length: 7 }, () => Array(17).fill(true)) },
];

const DELETED_MOCK_ORDERS_KEY = "pikselDeletedMockOrders";

function readDeletedMockOrderIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(DELETED_MOCK_ORDERS_KEY) || "[]");
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  } catch {
    return new Set();
  }
}

function markMockOrderDeleted(orderId) {
  const ids = readDeletedMockOrderIds();
  ids.add(String(orderId));
  localStorage.setItem(DELETED_MOCK_ORDERS_KEY, JSON.stringify([...ids]));
}

let savedOrders = [];
let cleanedLegacyOrders = false;
try {
  savedOrders = JSON.parse(localStorage.getItem("pikselMockOrders") || "[]");
  if (!Array.isArray(savedOrders)) savedOrders = [];
  if (localStorage.getItem("pikselOrdersCleanTwoCampaignsV1") !== "done") {
    savedOrders = savedOrders.filter((order) => ["panorama", "viada"].includes(String(order.client).trim().toLocaleLowerCase("lt-LT")));
    localStorage.setItem("pikselMockOrders", JSON.stringify(savedOrders));
    localStorage.setItem("pikselOrdersCleanTwoCampaignsV1", "done");
    cleanedLegacyOrders = true;
  }
} catch {
  savedOrders = [];
}

let activeOrderId = null;
const playerDevices = [screens[0], screens[1], screens[2], screens[3], screens[25]].map((screen) => ({
  ...screen,
  resolution: getScreenTechnicalData(screen).resolution,
}));
const monitoringDevices = screens.slice(0, 19).map((screen) => ({
  ...screen,
  resolution: getScreenTechnicalData(screen).resolution,
}));
const monitorState = { filter: "all", selectedId: null, live: false };
const playerState = {
  deviceId: playerDevices[0].id,
  day: 0,
  hour: 6,
  playing: true,
  elapsed: 4,
  campaignIndex: 0,
  mediaIndexByOrder: {},
  playCountByMedia: (() => {
    try { return JSON.parse(localStorage.getItem("pikselPlayerPlayCounts") || "{}"); }
    catch { return {}; }
  })(),
  allocatedHours: [],
};
let detailMediaByOrder = {};
try {
  detailMediaByOrder = JSON.parse(localStorage.getItem("pikselMockMedia") || "{}");
  if (!detailMediaByOrder || Array.isArray(detailMediaByOrder)) detailMediaByOrder = {};
  if (cleanedLegacyOrders) {
    const keptIds = new Set(savedOrders.map((order) => order.id));
    detailMediaByOrder = Object.fromEntries(Object.entries(detailMediaByOrder).filter(([orderId]) => keptIds.has(orderId)));
    localStorage.setItem("pikselMockMedia", JSON.stringify(detailMediaByOrder));
  }
} catch {
  detailMediaByOrder = {};
}

// Neberodyti ištrintų seed kampanijų media
{
  const deletedIds = readDeletedMockOrderIds();
  if (deletedIds.size) {
    detailMediaByOrder = Object.fromEntries(
      Object.entries(detailMediaByOrder).filter(([orderId]) => !deletedIds.has(String(orderId))),
    );
    localStorage.setItem("pikselMockMedia", JSON.stringify(detailMediaByOrder));
  }
}

/* Pirmam paleidimui naujame kompiuteryje: du atskiri klipai grotuvo rotacijos testui. */
if (localStorage.getItem("pikselBundledPlayerDemoV1") !== "done") {
  const bundledDemoMedia = {
    "5218": [{
      id: "demo-panorama",
      name: "Piksel-karunuotas-1152x576.mp4",
      kind: "video",
      width: 1152,
      height: 576,
      duration: 10,
      size: 981121,
    }],
    "5219": [{
      id: "demo-viada",
      name: "Unideco-10-3.mp4",
      kind: "video",
      width: 1152,
      height: 576,
      duration: 10,
      size: 1140081,
    }],
  };
  Object.entries(bundledDemoMedia).forEach(([orderId, media]) => {
    if (readDeletedMockOrderIds().has(String(orderId))) return;
    if (!Array.isArray(detailMediaByOrder[orderId]) || detailMediaByOrder[orderId].length === 0) {
      detailMediaByOrder[orderId] = media;
    }
  });
  localStorage.setItem("pikselMockMedia", JSON.stringify(detailMediaByOrder));
  localStorage.setItem("pikselBundledPlayerDemoV1", "done");
}

const mediaHydrationAttempts = new Set();
const PLAYER_API_BASE = (localStorage.getItem("pikselPlayerApiBase") || "http://127.0.0.1:8787").replace(/\/$/, "");
const mediaDatabase = typeof indexedDB === "undefined" ? Promise.resolve(null) : new Promise((resolve) => {
  const request = indexedDB.open("piksel-player-media", 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files");
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

async function storeMediaBlob(key, blob) {
  const database = await mediaDatabase;
  if (!database) return;
  await new Promise((resolve) => {
    const transaction = database.transaction("files", "readwrite");
    transaction.objectStore("files").put(blob, key);
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
}

async function getMediaBlob(key) {
  const database = await mediaDatabase;
  if (!database) return null;
  return new Promise((resolve) => {
    const request = database.transaction("files", "readonly").objectStore("files").get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

async function deleteMediaBlob(key) {
  const database = await mediaDatabase;
  if (!database) return;
  const transaction = database.transaction("files", "readwrite");
  transaction.objectStore("files").delete(key);
}

function clearOrderMedia(orderId) {
  const key = String(orderId);
  const media = detailMediaByOrder[key] || [];
  media.forEach((item) => {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    void deleteMediaBlob(`${key}:${item.id}`);
  });
  delete detailMediaByOrder[key];
  const persistable = Object.fromEntries(
    Object.entries(detailMediaByOrder).map(([id, items]) => [id, items.map(({ previewUrl, ...rest }) => rest)]),
  );
  localStorage.setItem("pikselMockMedia", JSON.stringify(persistable));
}

function removeOrderEverywhere(orderId) {
  const id = String(orderId);
  markMockOrderDeleted(id);
  savedOrders = savedOrders.filter((item) => String(item.id) !== id);
  localStorage.setItem("pikselMockOrders", JSON.stringify(savedOrders));
  clearOrderMedia(id);
  if (String(activeOrderId) === id) activeOrderId = null;
  playerState.campaignIndex = 0;
  playerState.elapsed = 0;
  delete playerState.mediaIndexByOrder[id];
}

async function hydrateOrderMedia(orderId) {
  const media = detailMediaByOrder[orderId] || [];
  let changed = false;
  for (const item of media) {
    const key = `${orderId}:${item.id}`;
    if (item.previewUrl || mediaHydrationAttempts.has(key)) continue;
    mediaHydrationAttempts.add(key);
    const blob = await getMediaBlob(key);
    if (!blob) continue;
    item.previewUrl = URL.createObjectURL(blob);
    changed = true;
  }
  return changed;
}

function allOrders() {
  const savedIds = new Set(savedOrders.map((order) => String(order.id)));
  const deletedIds = readDeletedMockOrderIds();
  return [
    ...savedOrders,
    ...mockOrders.filter((order) => !savedIds.has(String(order.id)) && !deletedIds.has(String(order.id))),
  ];
}

function persistOrder(order) {
  savedOrders = [{ ...order, isTest: true }, ...savedOrders.filter((item) => item.id !== order.id)];
  localStorage.setItem("pikselMockOrders", JSON.stringify(savedOrders));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function orderIcon(type, active) {
  if (type === "invoice") {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 2.75h6l3 3v11.5h-9z"/><path d="M11.5 2.75v3h3M8 9h4M8 12h4"/>${active ? '<path d="M15.5 13.5v4M13.5 15.5h4"/>' : ""}</svg>`;
  }
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3 3.5 14 6.5-14 6.5 2-5.25L12 10 5 8.75z"/>${active ? '<path d="M7 10h5"/>' : ""}</svg>`;
}

function renderOrders() {
  const query = $("#ordersSearch").value.trim().toLocaleLowerCase("lt-LT");
  const agencyQuery = $("#ordersAgencyFilter")?.value.trim().toLocaleLowerCase("lt-LT") || "";
  const clientQuery = $("#ordersClientFilter")?.value.trim().toLocaleLowerCase("lt-LT") || "";
  const mediaFilter = $("#ordersMediaFilter")?.value || "Visi";
  const invoiceFilter = $("#ordersInvoiceFilter")?.value || "Visos";
  const orders = allOrders().filter((order) => {
    const searchable = `${order.client} ${order.agency} ${order.id}`.toLocaleLowerCase("lt-LT");
    const statusMatches = ordersFilterState.status === "Visi" || order.status === ordersFilterState.status;
    const yearMatches = ordersFilterState.year === "Visi" || String(order.from).slice(0, 4) === ordersFilterState.year || String(order.to).slice(0, 4) === ordersFilterState.year;
    const selectedMonth = ordersFilterState.month === "Visi" ? null : `${ordersFilterState.year}-${ordersFilterState.month}`;
    const monthMatches = !selectedMonth || (String(order.from).slice(0, 7) <= selectedMonth && String(order.to).slice(0, 7) >= selectedMonth);
    const mediaValue = order.media == null ? "—" : order.media ? "Taip" : "Ne";
    const mediaMatches = mediaFilter === "Visi" || mediaValue === mediaFilter;
    const invoiceMatches = invoiceFilter === "Visos" || (invoiceFilter === "Išrašyta" ? !!order.invoice : !order.invoice);
    return searchable.includes(query)
      && String(order.agency || "").toLocaleLowerCase("lt-LT").includes(agencyQuery)
      && String(order.client || "").toLocaleLowerCase("lt-LT").includes(clientQuery)
      && statusMatches && yearMatches && monthMatches && mediaMatches && invoiceMatches;
  });
  $("#ordersCount").textContent = `${orders.length} ${orders.length === 1 ? "užsakymas" : "užsakymų"}`;
  $("#ordersEmpty").hidden = orders.length > 0;
  $("#ordersTableBody").innerHTML = orders.map((order) => `
    <tr data-order-id="${order.id}">
      <td><div class="order-client"><span class="order-client-name">${order.client}</span>${order.special ? '<span class="spec-badge">SPEC</span>' : ""}</div></td>
      <td>${order.agency}</td>
      <td>${String(order.id).replace("-b", "")}</td>
      <td><span class="status-badge ${order.status === "Patvirtinta" ? "approved" : "pending"}">${order.status}</span></td>
      <td>${order.from}</td>
      <td>${order.to}</td>
      <td>${order.media == null ? '<span class="order-muted">—</span>' : `<span class="media-badge ${order.media ? "yes" : "no"}">${order.media ? "Taip" : "Ne"}</span>`}</td>
      <td class="order-price">${formatMoney.format(order.price)}</td>
      <td><button class="order-action" data-order-action="invoice" title="Sąskaita">${orderIcon("invoice", order.invoice)}</button></td>
      <td><button class="order-action" data-order-action="send" title="Išsiųsti">${orderIcon("send", order.sent)}</button></td>
    </tr>`).join("");
}

function showView(view) {
  const orders = view === "orders";
  const campaign = view === "campaign";
  const player = view === "player";
  const monitoring = view === "monitoring";
  const calculator = !orders && !campaign && !player && !monitoring;
  $("#calculatorView").hidden = orders || campaign || player || monitoring;
  $("#calculatorFooter").hidden = isEmbedPreview() || orders || campaign || player || monitoring;
  $("#ordersView").hidden = !orders;
  $("#campaignView").hidden = !campaign;
  $("#playerView").hidden = !player;
  $("#monitoringView").hidden = !monitoring;
  document.body.classList.toggle("orders-mode", orders);
  document.body.classList.toggle("campaign-mode", campaign);
  document.body.classList.toggle("player-mode", player);
  document.body.classList.toggle("monitoring-mode", monitoring);
  document.body.classList.toggle("calculator-mode", calculator);
  if (!calculator) document.body.classList.remove("has-package-upsell");
  document.querySelectorAll("[data-view-target]").forEach((button) => button.classList.toggle("active", button.dataset.viewTarget === view || (campaign && button.dataset.viewTarget === "orders")));
  if (orders) renderOrders();
  if (player) renderPlayer();
  if (monitoring) renderMonitoring();
  const targetLocation = publicCampaignState.active && calculator
    ? location.href
    : monitoring ? "#monitoring" : player ? "#player" : campaign ? `#order-${activeOrderId}` : orders ? "#orders" : "#calculator";
  if (String(targetLocation).startsWith("#")) {
    const url = new URL(location.href);
    url.hash = targetLocation;
    history.replaceState(null, "", url);
  } else {
    history.replaceState(null, "", targetLocation);
  }
}

function orderScreens(order) {
  if (Array.isArray(order.screenIds) && order.screenIds.length) {
    return order.screenIds.map((id) => {
      const screen = screens.find((item) => String(item.id) === String(id));
      if (!screen) return null;
      const technical = getScreenTechnicalData(screen);
      return { ...screen, resolution: technical.resolution };
    }).filter(Boolean);
  }
  const names = order.screens?.length ? order.screens : ["Panorama", "Laisvės kelias", "Narbuto žiedas", "Justiniškės"];
  const usedOccurrences = new Map();
  return names.map((name) => {
    const candidates = screens.filter((item) => item.name === name);
    const occurrence = usedOccurrences.get(name) || 0;
    usedOccurrences.set(name, occurrence + 1);
    const screen = candidates[occurrence] || candidates[0] || { name, city: "Vilnius", type: "Video", address: "Piksel ekranas" };
    const technical = getScreenTechnicalData(screen);
    return { ...screen, resolution: technical.resolution };
  });
}

function getOrderCampaignStats(order) {
  const grid = Array.isArray(order.grid) && order.grid.length === 7
    ? order.grid.map((day) => Array.from({ length: 17 }, (_, index) => Boolean(day?.[index])))
    : Array.from({ length: 7 }, () => Array(17).fill(true));
  const from = new Date(`${order.from}T12:00:00`);
  const to = new Date(`${order.to}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return { grid, days: 0, activeSlots: 0, weeklySlots: grid.flat().filter(Boolean).length };
  }

  let days = 0;
  let activeSlots = 0;
  const cursor = new Date(from);
  while (cursor <= to && days < 370) {
    const jsDay = cursor.getDay();
    const gridDay = jsDay === 0 ? 6 : jsDay - 1;
    activeSlots += grid[gridDay].filter(Boolean).length;
    days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return { grid, days, activeSlots, weeklySlots: grid.flat().filter(Boolean).length };
}

function parseCampaignDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function campaignDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function orderActivePeriods(order) {
  const customPeriods = order.billingPeriods || order.billing_periods || order.activePeriods || order.active_periods;
  if (!Array.isArray(customPeriods) || !customPeriods.length) return [{ from: order.from, to: order.to }];
  return customPeriods.map((period) => ({
    from: period.from || period.start || period.dateFrom || period.date_from,
    to: period.to || period.end || period.dateTo || period.date_to,
  })).filter((period) => period.from && period.to);
}

function getMonthlyDistribution(order) {
  const finalPrice = Math.max(0, Number(order.price) || 0);
  const campaignFrom = parseCampaignDate(order.from);
  const campaignTo = parseCampaignDate(order.to);
  if (!campaignFrom || !campaignTo || campaignTo < campaignFrom) return [];

  const fullBilling = [order.billingMode, order.billing_mode, order.invoiceMode, order.invoice_mode].some((mode) => String(mode || "").toLowerCase() === "full");
  if (fullBilling) return [{ key: "full", days: Math.round((campaignTo - campaignFrom) / 86400000) + 1, amount: Math.round(finalPrice * 100) / 100 }];

  const activeDates = new Map();
  orderActivePeriods(order).forEach((period) => {
    let from = parseCampaignDate(period.from);
    let to = parseCampaignDate(period.to);
    if (!from || !to || to < from) return;
    if (from < campaignFrom) from = new Date(campaignFrom);
    if (to > campaignTo) to = new Date(campaignTo);
    const cursor = new Date(from);
    while (cursor <= to && activeDates.size < 4000) {
      activeDates.set(campaignDateKey(cursor), new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const totalDays = activeDates.size;
  if (!totalDays) return [];
  const months = new Map();
  activeDates.forEach((date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, (months.get(key) || 0) + 1);
  });

  return Array.from(months, ([key, days]) => ({
    key,
    days,
    amount: Math.round((days / totalDays) * finalPrice * 100) / 100,
  })).sort((a, b) => a.key.localeCompare(b.key));
}

function formatDistributionMonth(key) {
  if (key === "full") return "Visa kampanija";
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1, 12);
  const label = new Intl.DateTimeFormat("lt-LT", { month: "long" }).format(date);
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${year}`;
}

function formatDayCount(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 19 ? "dienų" : last === 1 ? "diena" : last >= 2 && last <= 9 ? "dienos" : "dienų";
  return `${count} ${word}`;
}

function formatMonthCount(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 19 ? "mėnesių" : last === 1 ? "mėnuo" : last >= 2 && last <= 9 ? "mėnesiai" : "mėnesių";
  return `${count} ${word}`;
}

function calculateOrderPlanScreen(order, screen, stats) {
  const duration = Number(order.clipDuration) || 10;
  const viewsPerHour = Number(order.viewsPerHour) || 30;
  const impressions = stats.activeSlots * viewsPerHour;
  const ots = Math.round(impressions * (Number(screen.otsCoefficient) || 0));
  const gross = (Number(screen.pricePerHour) || 0) * stats.activeSlots * (duration / 10);
  const net = gross * 0.2;
  return {
    impressions,
    ots,
    gross,
    net,
    clipPrice: impressions ? net / impressions : 0,
    cpt: ots ? (net / ots) * 1000 : 0,
  };
}

function renderOrderPlan(order) {
  const selectedScreens = orderScreens(order);
  const stats = getOrderCampaignStats(order);
  const discounts = getDiscounts(selectedScreens.length, stats.days);

  $("#orderPlanScreenCount").textContent = formatScreenCount(selectedScreens.length);
  $("#orderPlanMode").textContent = order.intensity || "Individualus";
  $("#orderPlanActiveCount").textContent = `${stats.weeklySlots} aktyvių`;
  $("#orderPlanDays").textContent = stats.days;
  $("#orderPlanVolume").textContent = `${Math.round(discounts.volume * 100)}%`;
  $("#orderPlanPeriod").textContent = `${Math.round(discounts.period * 100)}%`;
  $("#orderPlanTotal").textContent = formatMoney.format(Number(order.price) || 0);

  $("#orderPlanTableBody").innerHTML = selectedScreens.map((screen) => {
    const calc = calculateOrderPlanScreen(order, screen, stats);
    return `<tr>
      <td><div class="order-plan-screen"><strong>${escapeHtml(screen.name)}</strong><small>${escapeHtml(screen.city)} · ${escapeHtml(screen.address || screen.type)}</small><span>${screenTypeIcon(screen.type)}${escapeHtml(screen.type)}</span></div></td>
      <td>${formatNumber.format(calc.impressions)}</td>
      <td>${formatNumber.format(calc.ots)}</td>
      <td>${calc.clipPrice.toFixed(3)}</td>
      <td>${calc.cpt.toFixed(2)}</td>
      <td>${formatMoney.format(calc.gross)}</td>
      <td>80%</td>
      <td>${formatMoney.format(calc.net)}</td>
    </tr>`;
  }).join("");

  $("#orderPlanGrid").innerHTML = `
    <thead><tr><th>Val.</th>${dayLabels.map((day) => `<th>${day}</th>`).join("")}</tr></thead>
    <tbody>${hours.map((hour, hourIndex) => `<tr>
      <th>${hour}–${hour + 1}</th>
      ${dayLabels.map((_, dayIndex) => `<td>${stats.grid[dayIndex][hourIndex] ? '<span class="order-plan-grid-check">✓</span>' : ""}</td>`).join("")}
    </tr>`).join("")}</tbody>`;
}

function activeOrder() {
  return allOrders().find((order) => order.id === activeOrderId);
}

function orderWeekCount(order) {
  const from = new Date(`${order.from}T12:00:00`);
  const to = new Date(`${order.to}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  return Math.max(1, Math.ceil(((to - from) / 86400000 + 1) / 7));
}

function isoWeekNumber(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return `W${Math.ceil((((target - yearStart) / 86400000) + 1) / 7)}`;
}

function setQuickHeaderStatus(selector, active, activeLabel, inactiveLabel) {
  const button = $(selector);
  button.classList.toggle("active", Boolean(active));
  button.title = active ? activeLabel : inactiveLabel;
}

function getOrderExportPartners(order) {
  const counts = new Map();
  orderScreens(order).forEach((screen) => {
    const owner = String(screen.owner || screen.catalogType || "Piksel").trim() || "Piksel";
    counts.set(owner, (counts.get(owner) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "lt"));
}

function filterExcelPlanByPartner(plan, partnerName) {
  if (!partnerName) return plan;
  const filtered = plan.screens.map((screen) => {
    const owner = screen.owner || screens.find((item) => item.name === screen.name)?.owner || "";
    const match = owner === partnerName
      || (partnerName === "Viadukai" && screen.type === "Viadukas")
      || (partnerName === "Piksel" && (!owner || owner === "Piksel"));
    if (!match || !screen.active) {
      return { ...screen, active: false, impressions: 0, ots: 0, clipPrice: 0, cpt: 0, gross: 0, net: 0 };
    }
    return screen;
  });
  const active = filtered.filter((screen) => screen.active);
  const rowTotal = active.reduce((sum, screen) => sum + (screen.net || 0), 0);
  const total = rowTotal * (1 - (plan.volumeDiscount || 0) - (plan.periodDiscount || 0));
  return { ...plan, screens: filtered, total: Math.round(total * 100) / 100 };
}

function renderQuickOrderModal(order) {
  const selectedScreens = orderScreens(order);
  $("#orderQuickTitle").textContent = order.client;
  $("#orderQuickAgency").textContent = order.agency || "—";
  $("#orderQuickNumber").textContent = String(order.id).replace("-b", "").replace(/^U-/, "");
  $("#orderQuickClientInput").value = order.client;
  $("#orderQuickStatusSelect").value = order.status === "Patvirtinta" ? "Patvirtinta" : "Nepatvirtinta";
  $("#orderQuickFromInput").value = order.from;
  $("#orderQuickToInput").value = order.to;
  $("#orderQuickWeeks").textContent = `${isoWeekNumber(order.from)} → ${isoWeekNumber(order.to)}`;
  $("#orderQuickPrice").textContent = formatMoney.format(Number(order.price) || 0);

  const months = getMonthlyDistribution(order);
  $("#orderQuickMonthDistribution").innerHTML = months.length
    ? months.map((row) => `<div>${escapeHtml(formatDistributionMonth(row.key))} (${row.days} d.) → ${formatMoney.format(row.amount)}</div>`).join("")
    : "<div>—</div>";

  $("#orderQuickComment").value = order.comment || "";
  $("#orderQuickReminderDate").value = order.reminder?.date || "";
  $("#orderQuickReminderText").value = order.reminder?.text || "";
  $("#orderQuickAttachmentText").textContent = order.attachmentName || "Nutempk failą arba Cmd+V į komentarų lauką";
  setQuickHeaderStatus("#orderQuickMediaToggle", order.media === true, "Media gauta", "Media negauta");
  setQuickHeaderStatus("#orderQuickInvoiceToggle", order.invoice === true, "Sąskaita išrašyta", "Sąskaita neišrašyta");
  setQuickHeaderStatus("#orderQuickSentToggle", order.sent === true, "Sąskaita išsiųsta", "Sąskaita neišsiųsta");

  const partners = getOrderExportPartners(order);
  $("#orderQuickExportHint").textContent = partners.length
    ? `${selectedScreens.length} ekr. · ${partners.length} partnerių`
    : "Šiame užsakyme nėra ekranų";
  $("#orderQuickPartnerExports").innerHTML = partners.map((partner) => `
    <button type="button" class="export-chip partner" data-quick-partner="${escapeHtml(partner.name)}" title="${escapeHtml(partner.name)} Excel">
      <span class="export-dot"></span>${escapeHtml(partner.name)} <small>${partner.count}</small>
    </button>`).join("");
}

function openQuickOrderModal(orderId) {
  const order = allOrders().find((item) => String(item.id) === String(orderId));
  if (!order) return showToast("Orderis nerastas");
  activeOrderId = order.id;
  renderQuickOrderModal(order);
  $("#orderQuickModal").hidden = false;
}

function closeQuickOrderModal() {
  $("#orderQuickModal").hidden = true;
}

function buildExcelPlanForOrder(order) {
  const stats = getOrderCampaignStats(order);
  const orderScreenList = orderScreens(order);
  const activeNames = new Set(orderScreenList.map((screen) => screen.name));
  const discounts = getDiscounts(activeNames.size, stats.days);
  const exportedScreens = screens.map((screen) => {
    const calc = calculateOrderPlanScreen(order, screen, stats);
    const technical = getScreenTechnicalData(screen);
    const active = activeNames.has(screen.name);
    return {
      active,
      id: screen.id,
      catalogId: screen.catalogId,
      city: screen.city,
      name: screen.name,
      owner: screen.owner || "",
      type: technical.exportType,
      dimensions: technical.dimensions,
      resolution: technical.resolution,
      link: screen.link || "",
      viaduct: Boolean(screen.viaduct),
      otsCoefficient: screen.otsCoefficient,
      priceByAvgViewsPerDay: screen.priceByAvgViewsPerDay || {},
      impressions: active ? calc.impressions : 0,
      ots: active ? calc.ots : 0,
      clipPrice: active ? calc.clipPrice : 0,
      cpt: active ? calc.cpt : 0,
      gross: active ? calc.gross : 0,
      screenDiscount: active ? 0.8 : 0,
      net: active ? calc.net : 0,
    };
  });
  const rowTotal = exportedScreens.reduce((sum, screen) => sum + (screen.active ? screen.net : 0), 0);
  return {
    client: order.client,
    agency: order.agency || "—",
    campaignNo: `U-${String(order.id).replace("-b", "")}`,
    from: order.from,
    to: order.to,
    days: stats.days,
    intensity: order.intensity || "Individualus",
    clipDuration: Number(order.clipDuration) || 10,
    viewsPerHour: Number(order.viewsPerHour) || 30,
    grid: stats.grid.map((day) => [...day]),
    screens: exportedScreens,
    volumeDiscount: discounts.volume,
    periodDiscount: discounts.period,
    finalPrice: rowTotal,
    total: Number(order.price) || rowTotal * (1 - discounts.volume - discounts.period),
    viaduct: false,
  };
}

function detailMedia() {
  return detailMediaByOrder[activeOrderId] || [];
}

function playerMediaForOrder(orderId) {
  return detailMediaByOrder[orderId] || [];
}

function playerMediaKey(order, media) {
  return `${order?.id || "none"}:${media?.id || media?.name || "campaign"}`;
}

function campaignPlayCount(order) {
  const media = playerMediaForOrder(order.id);
  if (!media.length) return playerState.playCountByMedia[playerMediaKey(order, null)] || 0;
  return media.reduce((sum, item) => sum + (playerState.playCountByMedia[playerMediaKey(order, item)] || 0), 0);
}

function formatPlayCount(count) {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return `${count} kartų`;
  if (lastOne === 1) return `${count} kartą`;
  if (lastOne >= 2 && lastOne <= 9) return `${count} kartus`;
  return `${count} kartų`;
}

function bundledMediaUrl(name) {
  const bundled = new Set([
    "Piksel-karunuotas-1152x576.mp4",
    "Unideco-10-3.mp4",
    "Lankava-Alytus-akcija.mp4",
  ]);
  return bundled.has(name) ? `/skaiciuokle/assets/uploads/${encodeURIComponent(name)}` : "";
}

function saveDetailMedia(items) {
  detailMediaByOrder[activeOrderId] = items;
  const persistable = Object.fromEntries(Object.entries(detailMediaByOrder).map(([orderId, media]) => [orderId, media.map(({ previewUrl, ...item }) => item)]));
  localStorage.setItem("pikselMockMedia", JSON.stringify(persistable));
}

function normalizeResolution(value) {
  return String(value || "").replace(/\s+/g, "").replace("×", "x").toLowerCase();
}

function mediaResolution(item) {
  return item?.width && item?.height ? `${item.width} × ${item.height}` : "Neatpažinta";
}

function getMediaResolutionCheck(order) {
  const grouped = new Map();
  orderScreens(order).forEach((screen) => {
    const resolution = screen.resolution || getScreenTechnicalData(screen).resolution;
    const key = normalizeResolution(resolution);
    if (!grouped.has(key)) grouped.set(key, { key, resolution: resolution.replace(/x/g, "×"), screens: [] });
    grouped.get(key).screens.push(screen.name);
  });
  const media = playerMediaForOrder(order.id);
  const uploadedKeys = new Set(media.map((item) => normalizeResolution(mediaResolution(item))));
  const requirements = [...grouped.values()].map((item) => ({ ...item, matched: uploadedKeys.has(item.key) }));
  const requirementKeys = new Set(requirements.map((item) => item.key));
  const uploaded = media.map((item) => {
    const key = normalizeResolution(mediaResolution(item));
    const requirement = requirements.find((entry) => entry.key === key);
    return { ...item, resolutionLabel: mediaResolution(item), matchesPlan: requirementKeys.has(key), screens: requirement?.screens || [] };
  });
  return { requirements, uploaded, missing: requirements.filter((item) => !item.matched), ready: requirements.length > 0 && requirements.every((item) => item.matched) };
}

function mediaCheckCopyText(order, onlyMissing = false) {
  const check = getMediaResolutionCheck(order);
  const rows = onlyMissing ? check.missing : check.requirements;
  const title = onlyMissing ? "Trūksta klipų:" : "Reikalingi klipai:";
  return `${title}\n${rows.map((item) => `${item.resolution} — ${item.screens.join(", ")} — ${item.matched ? "Yra" : "Trūksta"}`).join("\n")}`;
}

async function copyMediaCheckText(onlyMissing = false) {
  const order = activeOrder();
  if (!order) return;
  const text = mediaCheckCopyText(order, onlyMissing);
  try {
    await navigator.clipboard.writeText(text);
    showToast("Media patikros sąrašas nukopijuotas");
  } catch {
    showToast("Nepavyko nukopijuoti sąrašo");
  }
}

function renderMediaCheckModal() {
  const order = activeOrder();
  if (!order) return;
  const check = getMediaResolutionCheck(order);
  $("#mediaRequirementsBody").innerHTML = check.requirements.map((item) => `<div class="media-requirement-row ${item.matched ? "matched" : "missing"}"><strong>${escapeHtml(item.resolution)}</strong><span>${item.screens.map(escapeHtml).join(", ")}</span><em>${item.matched ? "Yra" : "Trūksta"}</em></div>`).join("");
  $("#uploadedCheckCount").textContent = `(${check.uploaded.length})`;
  $("#uploadedCheckList").innerHTML = check.uploaded.length ? check.uploaded.map((item) => `<div class="uploaded-check-row ${item.matchesPlan ? "matched" : "extra"}"><div><strong>${escapeHtml(item.name)}</strong><small>${item.matchesPlan ? `Atitinka: ${item.screens.map(escapeHtml).join(", ")}` : "Neatitinka šio orderio ekranų rezoliucijų"}</small></div><span>${escapeHtml(item.resolutionLabel)}</span></div>`).join("") : '<p class="media-check-empty">Failų dar neįkelta.</p>';
  $("#missingMediaPanel").classList.toggle("complete", check.ready);
  $("#missingMediaPanel").querySelector(".media-check-section-title strong").textContent = check.ready ? "✓ Visi reikalingi klipai yra" : "⚠ Trūksta klipų";
  $("#missingMediaList").innerHTML = check.missing.length ? check.missing.map((item) => `<div><strong>${escapeHtml(item.resolution)}</strong><span>${item.screens.map(escapeHtml).join(", ")}</span></div>`).join("") : '<div class="media-complete-message">Galima publikuoti kampaniją į ekranus.</div>';
}

function openMediaCheckModal() {
  if (!activeOrder()) return;
  renderMediaCheckModal();
  $("#mediaCheckModal").hidden = false;
}

function closeMediaCheckModal() {
  $("#mediaCheckModal").hidden = true;
}

function campaignWorkflow(order, mediaReady) {
  const today = localDateString(new Date());
  const approved = order.status === "Patvirtinta";
  const published = approved && order.media === true && order.playerEnabled === true;
  const timing = published ? (today < order.from ? "scheduled" : today > order.to ? "completed" : "active") : "pending";
  const state = !approved
    ? "Laukia patvirtinimo"
    : !mediaReady
      ? "Laukia klipų"
      : !published
        ? "Paruošta publikavimui"
        : timing === "scheduled"
          ? "Suplanuota"
          : timing === "completed"
            ? "Baigta"
            : "Transliuojama";
  const primaryAction = !approved
    ? "approve"
    : !mediaReady
      ? "media"
      : !published
        ? "publish"
        : timing === "completed"
          ? "report"
          : timing === "active"
            ? "monitor"
            : "sync";
  const primaryLabel = {
    approve: "Patvirtinti planą →",
    media: "Įkelti klipus →",
    publish: "Publikuoti į ekranus →",
    sync: "Sinchronizuoti grotuvus",
    monitor: "Stebėti transliaciją →",
    report: "Atsisiųsti ataskaitą",
  }[primaryAction];
  return { approved, published, mediaReady, timing, state, primaryAction, primaryLabel };
}

function renderCampaignWorkflow(order, mediaReady) {
  const workflow = campaignWorkflow(order, mediaReady);
  const steps = {
    plan: { className: "done", status: "Paruoštas" },
    approval: { className: workflow.approved ? "done" : "active", status: workflow.approved ? "Patvirtinta" : "Laukia" },
    media: { className: workflow.mediaReady ? "done" : workflow.approved ? "active" : "", status: workflow.mediaReady ? "Paruošti" : workflow.approved ? "Reikia įkelti" : "Laukia" },
    broadcast: { className: workflow.published && workflow.timing === "completed" ? "done" : workflow.mediaReady ? "active" : "", status: workflow.published ? workflow.state : workflow.mediaReady ? "Galima publikuoti" : "Laukia" },
  };
  Object.entries(steps).forEach(([key, value]) => {
    const element = document.querySelector(`[data-workflow-step="${key}"]`);
    element.className = `workflow-step ${value.className}`.trim();
    element.querySelector("[data-workflow-status]").textContent = value.status;
  });
  $("#campaignWorkflowState").textContent = workflow.state;
  $("#campaignState").textContent = workflow.state;
  $("#campaignState").className = `campaign-state ${workflow.published ? workflow.timing === "completed" ? "completed" : "published" : workflow.mediaReady || workflow.approved ? "active" : ""}`.trim();
  $("#campaignPublishButton").textContent = workflow.primaryLabel;
  $("#campaignPublishButton").dataset.workflowAction = workflow.primaryAction;
  $("#campaignPublishButton").disabled = workflow.primaryAction === "publish" && !order.enabledScreens.length;
  return workflow;
}

let activeCampaignTab = "info";
let publishingOrderId = null;

function setCampaignTab(tabName) {
  activeCampaignTab = tabName;
  document.querySelectorAll("[data-campaign-tab]").forEach((button) => button.classList.toggle("active", button.dataset.campaignTab === tabName));
  document.querySelectorAll("[data-campaign-panel]").forEach((panel) => {
    const active = panel.dataset.campaignPanel === tabName;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function renderCampaignTabs(order, selectedScreens, resolutionCheck, workflow) {
  const readyCount = resolutionCheck.requirements.length - resolutionCheck.missing.length;
  const clipProgress = $("#campaignClipProgress");
  clipProgress.textContent = resolutionCheck.ready ? String(resolutionCheck.requirements.length) : `${readyCount} iš ${resolutionCheck.requirements.length}`;
  clipProgress.className = resolutionCheck.ready ? "complete" : "incomplete";
  const publishTabState = $("#campaignPublishTabState");
  publishTabState.textContent = workflow.published ? "Publikuota" : resolutionCheck.ready ? "Paruošta" : "Laukia";
  publishTabState.className = workflow.published || resolutionCheck.ready ? "complete" : "";

  $("#campaignInfoName").value = order.client || "";
  $("#campaignInfoStatus").value = order.status === "Patvirtinta" ? "Patvirtinta" : "Nepatvirtinta";
  $("#campaignInfoFrom").value = order.from || "";
  $("#campaignInfoTo").value = order.to || "";
  $("#campaignInfoWeeks").textContent = `${isoWeekNumber(order.from)} → ${isoWeekNumber(order.to)}`;
  $("#campaignInfoComment").value = order.comment || "";
  $("#campaignInfoReminderDate").value = order.reminder?.date || "";
  $("#campaignInfoReminderText").value = order.reminder?.text || "";
  $("#campaignInfoStatusBadge").textContent = order.status === "Patvirtinta" ? "Patvirtinta" : "Nepatvirtinta";
  $("#campaignInfoStatusBadge").className = `campaign-state ${order.status === "Patvirtinta" ? "published" : "active"}`;
  const publicUrl = order.publicToken
    ? buildPublicCampaignUrl(order.publicToken)
    : (order.publicUrl || "");
  const previewUrl = order.publicToken ? localPreviewUrlForToken(order.publicToken) : "";
  $("#campaignPublicLink").value = publicUrl || "Šiam ankstesniam orderiui nuoroda nesukurta";
  $("#campaignPublicLinkHint").textContent = order.status === "Patvirtinta"
    ? "Kampanija patvirtinta — klientui planas rodomas tik peržiūrai."
    : isPlayShareHost()
      ? "Ši nuoroda atidaro planą čia, play’e. Kopijuoti ir Atidaryti naudoja tą patį adresą."
      : "Klientas gali peržiūrėti ir koreguoti planą iki patvirtinimo.";
  $("#campaignPublicLinkCopy").disabled = !publicUrl;
  $("#campaignPublicLinkOpen").disabled = !publicUrl;
  $("#campaignPublicLinkCopy").dataset.publicUrl = publicUrl;
  $("#campaignPublicLinkOpen").dataset.publicUrl = publicUrl;
  $("#campaignPublicLinkOpen").dataset.previewUrl = previewUrl;
  $("#campaignPublicLinkOpen").dataset.goMock = order.goMock ? "1" : "";
  const stats = getOrderCampaignStats(order);
  const monthlyDistribution = getMonthlyDistribution(order);
  const distributionDays = monthlyDistribution.reduce((total, item) => total + item.days, 0);
  $("#campaignAmountPeriod").textContent = monthlyDistribution[0]?.key === "full"
    ? `Visa kampanija · ${formatDayCount(distributionDays)}`
    : `${formatMonthCount(monthlyDistribution.length)} · ${formatDayCount(distributionDays)}`;
  $("#campaignAmountDistribution").innerHTML = monthlyDistribution.length
    ? monthlyDistribution.map((item) => `<div class="campaign-amount-row"><span>${escapeHtml(formatDistributionMonth(item.key))} <small>(${item.days} d.)</small></span><strong>${formatMoney.format(item.amount)}</strong></div>`).join("")
    : '<div class="campaign-amount-empty">Nepavyko apskaičiuoti paskirstymo.</div>';

  $("#campaignResolutionOverview").innerHTML = resolutionCheck.requirements.map((item) => `<div class="resolution-row ${item.matched ? "ready" : "missing"}"><strong>${item.matched ? "✓" : "!"} ${escapeHtml(item.resolution)}</strong><small>${escapeHtml(item.screens.join(", "))}</small></div>`).join("");
  const missingCard = $("#campaignMissingClipsCard");
  missingCard.classList.toggle("complete", resolutionCheck.ready);
  missingCard.querySelector("h2").textContent = resolutionCheck.ready ? "✓ Visi klipai paruošti" : "⚠ Trūksta klipų";
  $("#campaignMissingClipsCount").textContent = resolutionCheck.ready ? `${resolutionCheck.requirements.length} iš ${resolutionCheck.requirements.length}` : `${readyCount} iš ${resolutionCheck.requirements.length} paruošta`;
  $("#campaignMissingClipsList").innerHTML = resolutionCheck.missing.length
    ? resolutionCheck.missing.map((item) => `<div class="missing-clip-row"><strong>${escapeHtml(item.resolution)}</strong><small>${escapeHtml(item.screens.join(", "))}</small></div>`).join("")
    : '<div class="resolution-row ready"><strong>Galima publikuoti</strong><small>Visos plano rezoliucijos paruoštos.</small></div>';

  const isSending = publishingOrderId === order.id;
  const publishedCount = workflow.published ? order.enabledScreens.length : 0;
  $("#publishScreens").innerHTML = selectedScreens.filter((screen) => order.enabledScreens.includes(screen.name)).map((screen) => `<div class="publish-screen-row"><div><strong>${escapeHtml(screen.name)}</strong><small>${escapeHtml(screen.city)} · ${escapeHtml(screen.resolution)}</small></div><span class="publish-device-state ${workflow.published ? "received" : ""}">${isSending ? "Siunčiama…" : workflow.published ? "Gauta ✓" : "Laukia"}</span></div>`).join("");
  $("#publishReceiptCount").textContent = `${isSending ? 0 : publishedCount} iš ${order.enabledScreens.length} gavo`;
  $("#publishProgress").max = Math.max(1, order.enabledScreens.length);
  $("#publishProgress").value = isSending ? 0 : publishedCount;
  $("#publishStatusTitle").textContent = isSending ? "Publikuojama…" : workflow.published ? "Sėkmingai publikuota" : resolutionCheck.ready ? "Paruošta publikuoti" : "Dar neparuošta";
  $("#publishStatusText").textContent = isSending ? "Kampanija ir klipai siunčiami grotuvams." : workflow.published ? `${publishedCount} iš ${order.enabledScreens.length} grotuvų patvirtino gavimą.` : resolutionCheck.ready ? "Visi reikalingi klipai ir ekranai paruošti." : "Pirmiausia įkelkite trūkstamas rezoliucijas.";
  $("#publishStatusBadge").textContent = isSending ? "Siunčiama" : workflow.published ? "Publikuota" : resolutionCheck.ready ? "Paruošta" : "Laukia";
  $("#publishStatusBadge").className = `campaign-state ${workflow.published ? "published" : "active"}`;
  $("#campaignPublishBox").className = `campaign-publish-box ${isSending ? "publishing" : workflow.published ? "published" : ""}`;
  $("#campaignPublishIcon").textContent = isSending ? "…" : workflow.published ? "✓" : "↑";
  $("#publishTimestamp").textContent = workflow.published && order.publishedAt ? `Publikuota ${new Date(order.publishedAt).toLocaleString("lt-LT")}` : "Publikavus čia matysite, kurie grotuvai priėmė kampaniją.";
}

async function saveCampaignInfo() {
  const order = activeOrder();
  if (!order) return;

  const nextStatus = $("#campaignInfoStatus").value;
  if (order.databaseId && !order.managementToken) {
    throw new Error("Šiam orderiui trūksta vidinio valdymo rakto. Sukurkite naują testinį orderį.");
  }

  if (order.managementToken) {
    await window.PikselSupabase.campaigns.setApproval(
      order.managementToken,
      nextStatus === "Patvirtinta"
    );
  }

  order.client = $("#campaignInfoName").value.trim() || order.client;
  order.status = nextStatus;
  order.from = $("#campaignInfoFrom").value || order.from;
  order.to = $("#campaignInfoTo").value || order.to;
  order.comment = $("#campaignInfoComment").value.trim();
  order.reminder = { date: $("#campaignInfoReminderDate").value, text: $("#campaignInfoReminderText").value.trim() };
  persistOrder(order);
  renderOrderDetail();
}

function renderOrderDetail() {
  const order = activeOrder();
  if (!order) return showView("orders");
  const selectedScreens = orderScreens(order);
  if (!Array.isArray(order.enabledScreens)) order.enabledScreens = selectedScreens.map((screen) => screen.name);
  const media = detailMedia();
  const resolutionCheck = getMediaResolutionCheck(order);
  const orderNumber = `U-${String(order.id).replace("-b", "")}`;
  const agencyOrClient = order.agency && order.agency !== "—" ? order.agency : order.client;

  $("#campaignTitle").textContent = `${order.client} · ${orderNumber}`;
  $("#campaignSubtitle").className = "campaign-hero-meta";
  $("#campaignSubtitle").innerHTML = `<strong>${escapeHtml(order.agency || "—")}</strong><i>•</i><strong>${formatMoney.format(order.price)}</strong>`;
  $("#campaignInfoHeading").textContent = order.client;
  $("#campaignInfoSubtitle").textContent = `${agencyOrClient || "—"} · ${orderNumber}`;
  $("#detailOrderNo").textContent = orderNumber;
  $("#detailPeriod").textContent = `${order.from} – ${order.to}`;
  $("#detailIntensity").textContent = order.intensity || "Medi";
  $("#detailDuration").textContent = `${order.clipDuration || 10} s`;
  $("#detailScreenCount").textContent = formatScreenCount(selectedScreens.length);
  $("#detailScreenTotal").textContent = formatScreenCount(selectedScreens.length);
  $("#readinessScreens").textContent = `${formatScreenCount(order.enabledScreens.length)} paruošta`;
  $("#scheduleFrom").textContent = order.from;
  $("#scheduleTo").textContent = order.to;
  $("#scheduleMode").textContent = order.intensity || "Medi";

  $("#detailScreens").innerHTML = selectedScreens.map((screen) => {
    const enabled = order.enabledScreens.includes(screen.name);
    return `<label class="detail-screen-row">
      <span class="detail-screen-main">
        <input type="checkbox" data-detail-screen="${escapeHtml(screen.name)}" ${enabled ? "checked" : ""} />
        <span class="detail-screen-copy"><strong>${escapeHtml(screen.name)}</strong><small>${escapeHtml(screen.city)} · ${escapeHtml(screen.type)}</small></span>
      </span>
      <span class="detail-screen-resolution">${escapeHtml(screen.resolution)}</span>
      <span class="assigned-badge">${enabled ? "Priskirta" : "Išjungta"}</span>
    </label>`;
  }).join("");

  $("#mediaList").innerHTML = media.map((item) => {
    const dimensions = item.width && item.height ? `${item.width} × ${item.height}` : "Raiška bus patikrinta";
    const mediaUrl = item.previewUrl || bundledMediaUrl(item.name);
    const preview = mediaUrl ? (item.kind === "video" ? `<video src="${mediaUrl}" muted preload="metadata"></video>` : `<img src="${mediaUrl}" alt="" />`) : (item.kind === "video" ? "▶" : "▧");
    const checkedItem = resolutionCheck.uploaded.find((entry) => entry.id === item.id);
    return `<div class="media-item ${checkedItem?.matchesPlan ? "resolution-match" : "resolution-mismatch"}" data-media-id="${item.id}">
      <div class="media-preview">${preview}</div>
      <div class="media-copy"><strong>${escapeHtml(item.name)}</strong><small>${dimensions} · ${(item.size / 1024 / 1024).toFixed(1)} MB · <span class="${checkedItem?.matchesPlan ? "media-valid" : "media-warning"}">${checkedItem?.matchesPlan ? "Rezoliucija tinka" : "Rezoliucija netinka planui"}</span></small><small>${checkedItem?.matchesPlan ? `Tinka: ${checkedItem.screens.map(escapeHtml).join(", ")}` : "Nepriskirta nė vienai orderio rezoliucijai"}</small></div>
      <button class="media-remove" data-remove-media="${item.id}" type="button" aria-label="Pašalinti klipą">×</button>
    </div>`;
  }).join("");

  const hasMedia = media.length > 0;
  const mediaReady = resolutionCheck.ready;
  const workflow = renderCampaignWorkflow(order, mediaReady);
  renderCampaignTabs(order, selectedScreens, resolutionCheck, workflow);
  $("#mediaCheckSummary").className = `media-check-summary ${mediaReady ? "complete" : "incomplete"}`;
  $("#mediaCheckSummary").innerHTML = mediaReady
    ? `<div><strong>✓ Visos rezoliucijos paruoštos</strong><span>${resolutionCheck.requirements.length} iš ${resolutionCheck.requirements.length}</span></div><button type="button" data-open-media-check>Peržiūrėti</button>`
    : `<div><strong>Trūksta ${resolutionCheck.missing.length} ${resolutionCheck.missing.length === 1 ? "rezoliucijos" : "rezoliucijų"}</strong><span>${resolutionCheck.missing.map((item) => item.resolution).join(", ") || "Įkelkite klipus"}</span></div><button type="button" data-open-media-check>Patikrinti</button>`;
  $("#readinessMediaRow").classList.toggle("done", mediaReady);
  $("#readinessMediaRow").querySelector(":scope > span").textContent = mediaReady ? "✓" : "4";
  const readyResolutionText = resolutionCheck.requirements.length === 1
    ? "1 rezoliucija paruošta"
    : `${resolutionCheck.requirements.length} rezoliucijos paruoštos`;
  $("#readinessMedia").textContent = mediaReady ? readyResolutionText : hasMedia ? `Trūksta ${resolutionCheck.missing.length} rezoliucijų` : "Dar neįkelta";
  $("#publishWideButton").disabled = publishingOrderId === order.id || !mediaReady || !order.enabledScreens.length;
  $("#publishWideButton").textContent = publishingOrderId === order.id ? "Publikuojama…" : workflow.published ? "Atnaujinti grotuvuose" : "Publikuoti į ekranus →";

  document.querySelector(".topbar-meta span:nth-child(1) strong").textContent = order.client;
  document.querySelector(".topbar-meta span:nth-child(3) strong").textContent = order.agency;
  document.querySelector(".topbar-meta span:nth-child(5) strong").textContent = `U-${String(order.id).replace("-b", "")}`;
  renderOrderPlan(order);
  if (!$("#mediaCheckModal").hidden) renderMediaCheckModal();
  hydrateOrderMedia(order.id).then((changed) => {
    if (changed && activeOrderId === order.id && !$("#campaignView").hidden) renderOrderDetail();
  });
}

function openOrderDetail(orderId) {
  activeOrderId = orderId;
  setCampaignTab("info");
  renderOrderDetail();
  showView("campaign");
}

function inspectMediaFile(file) {
  return new Promise((resolve) => {
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const previewUrl = URL.createObjectURL(file);
    const element = document.createElement(kind === "video" ? "video" : "img");
    const finish = () => resolve({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      kind,
      size: file.size,
      width: kind === "video" ? element.videoWidth : element.naturalWidth,
      height: kind === "video" ? element.videoHeight : element.naturalHeight,
      duration: kind === "video" ? Math.round(element.duration || 0) : 0,
      valid: file.size <= 500 * 1024 * 1024,
      previewUrl,
    });
    element.addEventListener(kind === "video" ? "loadedmetadata" : "load", finish, { once: true });
    element.addEventListener("error", finish, { once: true });
    element.src = previewUrl;
  });
}

async function addMediaFiles(files) {
  const accepted = [...files].filter((file) => file.type.startsWith("video/") || file.type.startsWith("image/"));
  if (!accepted.length) return showToast("Pasirinkite vaizdo įrašą arba paveikslėlį");
  const inspected = await Promise.all(accepted.map(inspectMediaFile));
  await Promise.all(inspected.map((item, index) => storeMediaBlob(`${activeOrderId}:${item.id}`, accepted[index])));
  const replacedNames = new Set(inspected.map((item) => item.name));
  saveDetailMedia([...detailMedia().filter((item) => !replacedNames.has(item.name)), ...inspected]);
  renderOrderDetail();
  openMediaCheckModal();
  showToast(`${accepted.length} ${accepted.length === 1 ? "failas įkeltas" : "failai įkelti"}`);
}

async function uploadMediaToPlayerApi(orderId, item) {
  let blob = await getMediaBlob(`${orderId}:${item.id}`);
  if (!blob) {
    const bundledUrl = bundledMediaUrl(item.name);
    if (bundledUrl) {
      const response = await fetch(bundledUrl);
      if (response.ok) blob = await response.blob();
    }
  }
  if (!blob) throw new Error(`Nerastas klipo failas: ${item.name}`);
  const mediaId = `${orderId}-${item.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const response = await fetch(`${PLAYER_API_BASE}/api/admin/media/${encodeURIComponent(mediaId)}`, {
    method: "PUT",
    headers: { "content-type": blob.type || "application/octet-stream", "x-file-name": encodeURIComponent(item.name) },
    body: blob,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Nepavyko įkelti ${item.name}`);
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    width: item.width,
    height: item.height,
    duration: item.duration,
    path: result.path,
  };
}

async function sendOrderToPlayerApi(order) {
  const orderMedia = detailMediaByOrder[order.id] || [];
  if (!orderMedia.length) throw new Error(`Orderis U-${order.id} neturi klipų`);
  const media = await Promise.all(orderMedia.map((item) => uploadMediaToPlayerApi(order.id, item)));
  const response = await fetch(`${PLAYER_API_BASE}/api/admin/campaigns/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: order.id,
      client: order.client,
      from: order.from,
      to: order.to,
      grid: order.grid,
      clipDuration: order.clipDuration,
      screens: order.enabledScreens?.length ? order.enabledScreens : order.screens,
      media,
      viaduct: Boolean(order.viaduct),
      viaductFrequency: Boolean(order.viaduct)
        ? (Number(order.viaductFrequency || order.viaduct_frequency) || 1)
        : 1,
      mode: order.viaduct ? "viaducts" : "screens",
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Serveris nepriėmė kampanijos");
  return result;
}

async function syncExistingPublishedOrders() {
  const published = allOrders().filter((order) =>
    order.status === "Patvirtinta"
    && order.media === true
    && order.playerEnabled === true
    && (detailMediaByOrder[order.id] || []).length
  );
  for (const order of published) {
    try {
      await sendOrderToPlayerApi(order);
    } catch (error) {
      console.warn(`Nepavyko sinchronizuoti U-${order.id}`, error);
    }
  }
}

async function publishActiveOrder() {
  const order = activeOrder();
  if (!order || !detailMedia().length) return showToast("Pirmiausia pridėkite bent vieną klipą");
  const resolutionCheck = getMediaResolutionCheck(order);
  if (!resolutionCheck.ready) {
    openMediaCheckModal();
    return showToast(`Trūksta ${resolutionCheck.missing.length} reikalingų rezoliucijų`);
  }
  if (!order.enabledScreens?.length) return showToast("Pasirinkite bent vieną ekraną");
  publishingOrderId = order.id;
  setCampaignTab("publish");
  renderOrderDetail();
  showToast("Kampanija siunčiama grotuvams…");
  try {
    await sendOrderToPlayerApi(order);
  } catch (error) {
    publishingOrderId = null;
    renderOrderDetail();
    showToast(`Nepavyko publikuoti: ${error instanceof Error ? error.message : "nėra ryšio su serveriu"}`);
    return;
  }
  order.status = "Patvirtinta";
  order.media = true;
  order.playerEnabled = true;
  order.publishedAt = new Date().toISOString();
  publishingOrderId = null;
  persistOrder(order);
  renderOrderDetail();
  showToast("Kampanija publikuota į ekranus");
}

async function handleCampaignPrimaryAction() {
  const order = activeOrder();
  if (!order) return;
  const workflow = campaignWorkflow(order, getMediaResolutionCheck(order).ready);
  if (workflow.primaryAction === "approve") {
    order.status = "Patvirtinta";
    persistOrder(order);
    renderOrderDetail();
    return showToast("Planas patvirtintas — dabar įkelkite klipus");
  }
  if (workflow.primaryAction === "media") {
    $("#mediaFileInput").click();
    return;
  }
  if (workflow.primaryAction === "publish" || workflow.primaryAction === "sync") {
    await publishActiveOrder();
    return;
  }
  if (workflow.primaryAction === "monitor") {
    showView("monitoring");
    return;
  }
  showToast("Kampanijos ataskaita bus formuojama po transliacijos");
}

function playerCampaigns() {
  const device = playerDevices.find((item) => item.id === playerState.deviceId);
  return playerTestCampaigns().filter((order) => {
    const assigned = !order.screens?.length || order.screens.includes(device.name);
    const scheduled = !order.grid?.length || Boolean(order.grid[playerState.day]?.[playerState.hour - 6]);
    return assigned && scheduled;
  });
}

function playerTestCampaigns() {
  return allOrders().filter((order) => {
    const client = String(order.client).trim().toLocaleLowerCase("lt-LT");
    const enabledForTest = order.playerEnabled === true || client === "panorama" || client === "viada";
    const hasClips = playerMediaForOrder(order.id).length > 0;
    return enabledForTest && order.status === "Patvirtinta" && order.media === true && hasClips;
  });
}

function hourlyOccupancy() {
  const device = playerDevices.find((item) => item.id === playerState.deviceId);
  return hours.map((hour, hourIndex) => {
    const campaigns = playerTestCampaigns().filter((order) => {
      const assigned = !order.screens?.length || order.screens.includes(device.name);
      const scheduled = !order.grid?.length || Boolean(order.grid[playerState.day]?.[hourIndex]);
      return assigned && scheduled;
    });
    const bookedSeconds = campaigns.reduce((sum, order) => sum + (order.viewsPerHour || 30) * (order.clipDuration || 10), 0);
    return {
      hour,
      campaigns: campaigns.length,
      bookedSeconds,
      value: Math.min(100, (bookedSeconds / 3600) * 100),
    };
  });
}

function renderPlayerClock() {
  const clock = $("#playerClock");
  if (clock) clock.textContent = new Intl.DateTimeFormat("lt-LT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
}

function renderOccupancy() {
  const occupancy = hourlyOccupancy();
  $("#occupancyHours").innerHTML = occupancy.map((slot, index) => {
    const value = slot.value;
    const level = value >= 75 ? "high" : value >= 50 ? "medium" : "low";
    const selected = playerState.allocatedHours.includes(index);
    return `<div class="occupancy-hour ${level} ${selected ? "selected" : ""}" title="${slot.campaigns} kampanijos · ${slot.bookedSeconds} s užsakyta">
      <div class="occupancy-bar" style="height:${Math.max(8, value * .55)}px"></div>
      <strong>${slot.hour}</strong><small>${Math.round(value)}%</small>
    </div>`;
  }).join("");
  if (playerState.allocatedHours.length) {
    const labels = playerState.allocatedHours.map((index) => `${6 + index}:00–${7 + index}:00`).join(", ");
    $("#allocationResult").textContent = `Papildomas klipas paskirstytas į laisviausias valandas: ${labels}.`;
    $("#allocationResult").classList.add("success");
  } else {
    $("#allocationResult").textContent = "Sistema parinks valandas, kuriose yra mažiausias užimtumas.";
    $("#allocationResult").classList.remove("success");
  }
}

function renderPlayer() {
  const device = playerDevices.find((item) => item.id === playerState.deviceId) || playerDevices[0];
  const campaigns = playerCampaigns();
  if (campaigns.length && playerState.campaignIndex >= campaigns.length) playerState.campaignIndex = 0;
  const current = campaigns.length ? campaigns[playerState.campaignIndex] : null;
  const currentMediaItems = current ? playerMediaForOrder(current.id) : [];
  const currentMediaIndex = current ? (playerState.mediaIndexByOrder[current.id] || 0) : 0;
  const currentMedia = currentMediaItems.length ? currentMediaItems[currentMediaIndex % currentMediaItems.length] : null;
  const currentMediaUrl = currentMedia?.previewUrl || bundledMediaUrl(currentMedia?.name);
  $("#playerDaySelect").value = String(playerState.day);
  $("#playerHourSelect").innerHTML = hours.map((hour) => `<option value="${hour}" ${hour === playerState.hour ? "selected" : ""}>${hour}:00–${hour + 1}:00</option>`).join("");
  $("#playerDeviceSelect").innerHTML = playerDevices.map((item) => `<option value="${item.id}" ${item.id === device.id ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.city)}</option>`).join("");
  $("#playerScreenName").textContent = `${device.name} · ${device.city}`;
  $("#playerResolution").textContent = device.resolution;
  $("#playerCampaignCount").textContent = `${campaigns.length} ${campaigns.length === 1 ? "kampanija" : "kampanijos"} šiame ekrane`;
  $("#playerCampaignCounter").textContent = campaigns.length ? `${playerState.campaignIndex + 1} / ${campaigns.length} kampanijų` : "0 kampanijų";
  $("#playerPlayCount").textContent = `Parodyta ${formatPlayCount(current ? (playerState.playCountByMedia[playerMediaKey(current, currentMedia)] || 0) : 0)}`;
  $("#stageCampaignName").textContent = current?.client || "Laukiama kampanijos";
  $("#stageCampaignMeta").textContent = current ? `${currentMedia?.name || "Klipas"} · ${dayLabels[playerState.day]}, ${playerState.hour}:00` : `${dayLabels[playerState.day]}, ${playerState.hour}:00 · suplanuotų kampanijų nėra`;
  const canPreviewMedia = Boolean(currentMediaUrl);
  $("#playerStage").classList.toggle("has-media", canPreviewMedia);
  $("#playerStageMedia").classList.toggle("active", canPreviewMedia);
  $("#playerStageMedia").innerHTML = canPreviewMedia
    ? currentMedia.kind === "video"
      ? `<video src="${currentMediaUrl}" ${playerState.playing ? "autoplay" : ""} muted playsinline></video>`
      : `<img src="${currentMediaUrl}" alt="${escapeHtml(currentMedia.name)}" />`
    : "";
  $("#playerDuration").textContent = `00:${String(currentMedia?.duration || current?.clipDuration || 10).padStart(2, "0")}`;
  $("#playerCampaignList").innerHTML = campaigns.length ? campaigns.map((order, index) => `<div class="player-campaign-item">
    <span class="campaign-color"></span>
    <div class="player-campaign-copy"><strong>${escapeHtml(order.client)}</strong><small>U-${String(order.id).replace("-b", "")} · ${order.from}–${order.to} · parodyta ${formatPlayCount(campaignPlayCount(order))}</small></div>
    ${index === playerState.campaignIndex ? '<span class="playing-badge">RODOMA</span>' : '<span class="order-muted">Eilėje</span>'}
  </div>`).join("") : '<div class="player-campaign-empty">Šiam ekranui dar nėra publikuotų kampanijų.</div>';
  $("#playerPlayButton").textContent = playerState.playing ? "Ⅱ" : "▶";
  $("#stageProgress").style.width = `${Math.min(100, (playerState.elapsed / (currentMedia?.duration || current?.clipDuration || 10)) * 100)}%`;
  $("#playerElapsed").textContent = `00:${String(playerState.elapsed).padStart(2, "0")}`;
  renderOccupancy();
  renderPlayerClock();
  if (current) hydrateOrderMedia(current.id).then((changed) => {
    if (changed && !$("#playerView").hidden) renderPlayer();
  });
}

function monitorDeviceStatus(screen) {
  if (screen.id === 18) return { key: "offline", label: "Atsijungęs", signal: "Prieš 18 min." };
  if (screen.id === 7) return { key: "warning", label: "Reikia dėmesio", signal: "Prieš 2 min." };
  return { key: "online", label: "Veikia", signal: `Prieš ${(screen.id % 9) + 2} s` };
}

function monitorCampaignForScreen(screen) {
  const now = new Date();
  const jsDay = now.getDay();
  const day = jsDay === 0 ? 6 : jsDay - 1;
  const hourIndex = Math.max(0, Math.min(16, now.getHours() - 6));
  const assigned = playerTestCampaigns().filter((order) => {
    const enabledScreens = order.enabledScreens?.length ? order.enabledScreens : order.screens;
    return !enabledScreens?.length || enabledScreens.includes(screen.name);
  });
  return assigned.find((order) => !order.grid?.length || order.grid[day]?.[hourIndex]) || assigned[0] || null;
}

function monitorMediaForCampaign(order) {
  if (!order) return null;
  return playerMediaForOrder(order.id)[0] || null;
}

function monitorPreviewMarkup(screen, order, media, large = false) {
  const mediaUrl = media?.previewUrl || bundledMediaUrl(media?.name);
  if (mediaUrl && media?.kind === "video") return `<video src="${mediaUrl}" autoplay muted loop playsinline preload="metadata"></video>`;
  if (mediaUrl) return `<img src="${mediaUrl}" alt="${escapeHtml(media.name)}" />`;
  return `<div class="monitor-placeholder ${large ? "large" : ""}"><span>PIKSEL</span><strong>${escapeHtml(order?.client || "Piksel savireklama")}</strong><small>${escapeHtml(screen.name)} · ${escapeHtml(screen.city)}</small></div>`;
}

function renderMonitoring() {
  const statuses = monitoringDevices.map((screen) => monitorDeviceStatus(screen));
  const online = statuses.filter((status) => status.key === "online").length;
  const warning = statuses.filter((status) => status.key === "warning").length;
  const offline = statuses.filter((status) => status.key === "offline").length;
  $("#monitorAllCount").textContent = monitoringDevices.length;
  $("#monitorOnlineCount").textContent = online;
  $("#monitorWarningCount").textContent = warning;
  $("#monitorOfflineCount").textContent = offline;
  $("#monitorUpdatedAt").textContent = new Intl.DateTimeFormat("lt-LT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());

  document.querySelectorAll("[data-monitor-filter]").forEach((button) => button.classList.toggle("active", button.dataset.monitorFilter === monitorState.filter));
  const visibleDevices = monitoringDevices.filter((screen) => monitorState.filter === "all" || monitorDeviceStatus(screen).key === monitorState.filter);
  $("#monitorGrid").innerHTML = visibleDevices.map((screen) => {
    const status = monitorDeviceStatus(screen);
    const order = monitorCampaignForScreen(screen);
    const media = monitorMediaForCampaign(order);
    return `<button class="monitor-card ${status.key}" data-monitor-id="${screen.id}" type="button">
      <div class="monitor-preview">${monitorPreviewMarkup(screen, order, media)}<span class="monitor-live-label">LIVE</span><span class="monitor-resolution">${escapeHtml(screen.resolution)}</span></div>
      <div class="monitor-card-body">
        <div class="monitor-card-title"><div><strong>${escapeHtml(screen.name)}</strong><small>${escapeHtml(screen.city)} · ${escapeHtml(screen.address)}</small></div><span class="monitor-status ${status.key}">● ${status.label}</span></div>
        <div class="monitor-now"><span>Dabar rodoma</span><strong>${escapeHtml(order?.client || "Piksel savireklama")}</strong></div>
        <div class="monitor-card-footer"><span>${escapeHtml(media?.name || "Numatytasis turinys")}</span><span>${status.signal}</span></div>
      </div>
    </button>`;
  }).join("");

  const hydrateIds = [...new Set(visibleDevices.map((screen) => monitorCampaignForScreen(screen)?.id).filter(Boolean))];
  Promise.all(hydrateIds.map((id) => hydrateOrderMedia(id))).then((changes) => {
    if (changes.some(Boolean) && !$("#monitoringView").hidden) renderMonitoring();
  });
}

function openMonitorDetail(screenId) {
  const screen = monitoringDevices.find((item) => item.id === Number(screenId));
  if (!screen) return;
  const status = monitorDeviceStatus(screen);
  const order = monitorCampaignForScreen(screen);
  const media = monitorMediaForCampaign(order);
  monitorState.selectedId = screen.id;
  monitorState.live = false;
  $("#monitorModalTitle").textContent = `${screen.name} · ${screen.city}`;
  $("#monitorModalAddress").textContent = `${screen.address} · ${screen.resolution}`;
  $("#monitorModalStatus").className = `monitor-status ${status.key}`;
  $("#monitorModalStatus").textContent = `● ${status.label}`;
  $("#monitorModalStage").innerHTML = monitorPreviewMarkup(screen, order, media, true);
  $("#monitorModalCampaign").textContent = order?.client || "Piksel savireklama";
  $("#monitorModalClip").textContent = media?.name || "Numatytasis turinys";
  $("#monitorModalSignal").textContent = status.signal;
  $("#monitorModalPlayer").textContent = status.key === "offline" ? "Ryšio nėra" : status.key === "warning" ? "Veikia su perspėjimu" : "Veikia normaliai";
  $("#monitorLiveButton").textContent = "Žiūrėti gyvai";
  $("#monitorModal").hidden = false;
}

function closeMonitorDetail() {
  $("#monitorModal").hidden = true;
  monitorState.live = false;
}

function allocateLowestOccupancy() {
  if (!$("#autoFillToggle").checked) return showToast("Įjunkite laisvų vietų užpildymą");
  playerState.allocatedHours = hourlyOccupancy()
    .map((slot, index) => ({ value: slot.value, index }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 4)
    .map((item) => item.index)
    .sort((a, b) => a - b);
  renderOccupancy();
  showToast("Klipas paskirstytas į 4 laisviausias valandas");
}

function nextCampaignNumber() {
  const savedNumbers = savedOrders.map((order) => Number(String(order.id).replace(/\D/g, ""))).filter(Number.isFinite);
  return Math.max(1990, ...savedNumbers) + 1;
}

/** Test orderių kelias: nerašome į Supabase / live PB — tik localStorage. */
const TEST_ORDERS_LOCAL_ONLY = true;

const testOrderDraft = {
  active: false,
  client: "",
  agency: "",
  id: "",
};

/** 'start' = iš test orderių → skaičiuoklė; 'finish' = iš skaičiuoklės be draft */
let createModalMode = "start";

function updateTopbarMeta(client, agency, campaignNo) {
  const strongs = document.querySelectorAll(".topbar-meta strong");
  if (strongs[0]) strongs[0].textContent = client || "X";
  if (strongs[1]) strongs[1].textContent = agency || "X";
  if (strongs[2]) strongs[2].textContent = campaignNo || "U-—";
}

function resetCalculatorForNewTestOrder() {
  internalPlanEditState.orderId = null;
  publicCampaignState.active = false;
  publicCampaignState.campaign = null;
  publicCampaignState.locked = false;
  publicCampaignState.mock = false;
  publicCampaignState.token = "";
  clearGoMockTokens();
  setGoShareLinkField("");
  syncGoShareLinkVisibility({ hide: false });
  syncCalculatorModeUI();
  const notice = $("#publicCampaignNotice");
  if (notice) notice.hidden = true;
  const copyBtn = $("#copyCampaignButton");
  if (copyBtn) copyBtn.hidden = true;
  $("#calculatorView")?.classList.remove("public-readonly");
  $("#calculatorView")?.classList.remove("public-mode-viaducts", "public-mode-screens");
  $("#resetButton").hidden = true;
  $("#createOrderButton").hidden = false;
  resetScreenSelectionDefaults();
  $("#searchInput").value = "";
  $("#clipDuration").value = "10";
  if (typeof syncClipDurationSelect === "function") syncClipDurationSelect();
  setDefaultDates();
  renderCityFilters();
  state.mediPhase = 0;
  state.minPhase = 0;
  applyPreset("medi");
  renderScreens();
}

const CREATE_ORDER_BUTTON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function setCreateOrderButtonLabel() {
  const button = $("#createOrderButton");
  if (!button) return;
  const label = internalPlanEditState.orderId || publicCampaignState.active
    ? "Išsaugoti"
    : "Išsaugoti";
  button.innerHTML = CREATE_ORDER_BUTTON_ICON;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.classList.toggle("is-busy", false);
}

function setCreateOrderButtonBusy(busy) {
  const button = $("#createOrderButton");
  if (!button) return;
  button.disabled = Boolean(busy);
  button.classList.toggle("is-busy", Boolean(busy));
  button.innerHTML = CREATE_ORDER_BUTTON_ICON;
  if (busy) {
    button.title = "Saugoma…";
    button.setAttribute("aria-label", "Saugoma…");
  } else {
    setCreateOrderButtonLabel();
  }
}

const CANONICAL_AGENCY_OPTIONS = [
  "Arena Media",
  "BPN",
  "Carat",
  "DDB",
  "Dentsu",
  "Havas Media",
  "MBD",
  "McCann",
  "Media House",
  "Mediacom",
  "Mindshare",
  "OMD",
  "OMG",
  "Open",
  "Publicis Groupe",
];

function getSelectedBuyerKind() {
  return $("#buyerKindClient")?.checked ? "client" : "agency";
}

function syncBuyerKindFields(preferredAgency = "") {
  const kind = getSelectedBuyerKind();
  const select = $("#newCampaignAgencySelect");
  const input = $("#newCampaignAgency");
  const label = $("#newCampaignAgencyLabel");
  if (!select || !input || !label) return;

  if (select.options.length <= 1) {
    for (const name of CANONICAL_AGENCY_OPTIONS) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }
  }

  if (kind === "agency") {
    label.textContent = "Agentūra";
    select.hidden = false;
    input.hidden = true;
    select.value = CANONICAL_AGENCY_OPTIONS.includes(preferredAgency) ? preferredAgency : "";
    input.value = select.value;
  } else {
    label.textContent = "Klientas";
    select.hidden = true;
    input.hidden = false;
    input.placeholder = "Pvz. RIMI";
    input.value = preferredAgency && !CANONICAL_AGENCY_OPTIONS.includes(preferredAgency)
      ? preferredAgency
      : "";
    select.value = "";
  }
}

function readCampaignBuyerValue() {
  return getSelectedBuyerKind() === "agency"
    ? ($("#newCampaignAgencySelect")?.value || "").trim()
    : ($("#newCampaignAgency")?.value || "").trim();
}

function openCreateCampaignModal(mode = "start") {
  createModalMode = mode;
  const number = nextCampaignNumber();
  const existingAgency = testOrderDraft.active ? testOrderDraft.agency : "";
  $("#newCampaignClient").value = testOrderDraft.active ? testOrderDraft.client : "";
  $("#newCampaignNumber").value = `U-${number}`;
  const isKnownAgency = CANONICAL_AGENCY_OPTIONS.includes(existingAgency);
  $("#buyerKindAgency").checked = !existingAgency || isKnownAgency;
  $("#buyerKindClient").checked = Boolean(existingAgency) && !isKnownAgency;
  syncBuyerKindFields(existingAgency);
  $("#createCampaignTitle").textContent = mode === "start" ? "Naujas test orderis" : "Išsaugoti test orderį";
  const subtitle = $("#createCampaignModal .campaign-modal-header p");
  if (subtitle) {
    subtitle.textContent = mode === "start"
      ? "Įrašykite pavadinimą, pasirinkite agentūrą arba klientą, tada tęskite į skaičiuoklę."
      : "Patvirtinkite pavadinimą — planas bus įrašytas į test orderius.";
  }
  $("#confirmCampaignCreate").textContent = mode === "start" ? "Išsaugoti ir tęsti" : "Išsaugoti į test orderius";
  $("#createCampaignModal").hidden = false;
  window.setTimeout(() => $("#newCampaignClient").focus(), 0);
}

function closeCreateCampaignModal() {
  $("#createCampaignModal").hidden = true;
}

function beginTestOrderDraft({ client, agency, id }) {
  testOrderDraft.active = true;
  testOrderDraft.client = client;
  testOrderDraft.agency = agency;
  testOrderDraft.id = String(id).replace(/^[A-Z]-/, "");
  updateTopbarMeta(client, agency, `U-${testOrderDraft.id}`);
  resetCalculatorForNewTestOrder();
  ensureShareLinkForCurrentPlan();
  setCreateOrderButtonLabel();
  showView("calculator");
  applyHeadingActionsChrome();
}

/** Hub Planas → atidaro esamą test orderį be reset į Ekranai tabą. */
async function resumeHubTestOrder(order) {
  if (!order) return;
  testOrderDraft.active = true;
  testOrderDraft.client = order.client || "Test";
  testOrderDraft.agency = order.agency || "—";
  testOrderDraft.id = String(order.invoice_id || order.id || "")
    .replace(/^[A-Z]-/, "")
    .replace(/^T-/, "");
  applyOrderSnapshotToCalculator(order);
  if (!showShareLinkForOrder(order)) ensureShareLinkForCurrentPlan();
  showView("calculator");
  $("#resetButton").hidden = true;
  $("#createOrderButton").hidden = false;
  setCreateOrderButtonLabel();
  applyHeadingActionsChrome();
}

async function saveCurrentOrder(details = {}) {
  const plan = buildExcelPlan();
  const order = {
    id: String(details.id || plan.campaignNo).replace(/^[A-Z]-/, ""),
    client: details.client || plan.client,
    agency: details.agency || plan.agency,
    status: "Nepatvirtinta",
    from: plan.from,
    to: plan.to,
    media: null,
    price: plan.total,
    invoice: false,
    sent: false,
    special: false,
    isTest: true,
    clipDuration: plan.clipDuration,
    intensity: plan.intensity,
    grid: plan.grid,
    viewsPerHour: plan.viewsPerHour,
    screens: plan.screens.filter((screen) => screen.active).map((screen) => screen.name),
    screenIds: plan.screens.filter((screen) => screen.active).map((screen) => screen.id),
  };

  if (!TEST_ORDERS_LOCAL_ONLY && window.PikselSupabase?.configured) {
    const selectedScreens = plan.screens.filter((screen) => screen.active);
    const created = await window.PikselSupabase.campaigns.create({
      name: order.client,
      client_name: order.client,
      agency_name: order.agency,
      date_from: order.from,
      date_to: order.to,
      clip_duration_seconds: order.clipDuration,
      intensity: order.intensity,
      grid: order.grid,
      volume_discount: plan.volumeDiscount * 100,
      period_discount: plan.periodDiscount * 100,
      final_price: order.price,
    }, selectedScreens.map((screen) => ({
      screen_id: screen.catalogId,
      impressions: screen.impressions,
      ots_total: screen.ots,
      clip_price: screen.clipPrice,
      cpt: screen.cpt,
      gross_price: screen.gross,
      discount: screen.screenDiscount * 100,
      net_price: screen.net,
      calculation_snapshot: {
        name: screen.name,
        city: screen.city,
        dimensions: screen.dimensions,
        resolution: screen.resolution,
      },
    })));

    order.id = String(created.order_no);
    order.databaseId = created.id;
    order.publicToken = created.public_token;
    order.managementToken = created.management_token;
    order.publicUrl = buildPublicCampaignUrl(created.public_token);
  } else {
    // Mock: tas pats /{token} kelias, preview per dabartinį hostą (play / localhost)
    attachGoMockLink(order, plan);
  }

  persistOrder(order);
  return order;
}

function publicCampaignIsLocked(campaign) {
  if (campaign?.locked_for_client === true || campaign?.locked === true) return true;
  const status = String(campaign?.status || "");
  return status === "approved" || status === "Patvirtinta";
}

function campaignFromPublicRecord(record, campaign) {
  return {
    ...(campaign || record?.campaign || {}),
    locked_for_client: Boolean(record?.locked),
    locked: Boolean(record?.locked),
    status: record?.status || (record?.locked ? "approved" : "awaiting_approval"),
  };
}

function closeClipDurationSelect({ focus = false } = {}) {
  const control = $("#clipDurationControl");
  const trigger = $("#clipDurationTrigger");
  const menu = $("#clipDurationMenu");
  if (!control || !trigger || !menu) return;
  control.classList.remove("open");
  trigger.setAttribute("aria-expanded", "false");
  menu.hidden = true;
  if (focus) trigger.focus();
}

function syncClipDurationSelect() {
  const select = $("#clipDuration");
  const trigger = $("#clipDurationTrigger");
  const label = $("#clipDurationLabel");
  const menu = $("#clipDurationMenu");
  if (!select || !trigger || !label || !menu) return;

  label.textContent = select.selectedOptions[0]?.textContent || `${select.value} sekundžių`;
  trigger.disabled = select.disabled;
  trigger.setAttribute("aria-disabled", String(select.disabled));
  menu.querySelectorAll("[data-duration-value]").forEach((option) => {
    const selected = option.dataset.durationValue === select.value;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
  });
  if (select.disabled) closeClipDurationSelect();
}

function setClipDurationDisabled(disabled) {
  $("#clipDuration").disabled = disabled;
  syncClipDurationSelect();
}

function initializeClipDurationSelect() {
  const control = $("#clipDurationControl");
  const select = $("#clipDuration");
  const trigger = $("#clipDurationTrigger");
  const menu = $("#clipDurationMenu");
  if (!control || !select || !trigger || !menu) return;

  trigger.addEventListener("click", () => {
    if (select.disabled) return;
    const opening = menu.hidden;
    if (!opening) return closeClipDurationSelect();
    control.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    menu.querySelector(".selected")?.focus();
  });

  menu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-duration-value]");
    if (!option || select.disabled) return;
    select.value = option.dataset.durationValue;
    syncClipDurationSelect();
    closeClipDurationSelect({ focus: true });
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  menu.addEventListener("keydown", (event) => {
    const options = [...menu.querySelectorAll("[data-duration-value]")];
    const currentIndex = options.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeClipDurationSelect({ focus: true });
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      options[(currentIndex + direction + options.length) % options.length]?.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!control.contains(event.target)) closeClipDurationSelect();
  });
  syncClipDurationSelect();
}

function closeViaductFrequencySelect({ focus = false } = {}) {
  const control = $("#viaductFrequencyControl");
  const trigger = $("#viaductFrequencyTrigger");
  const menu = $("#viaductFrequencyMenu");
  if (!control || !trigger || !menu) return;
  control.classList.remove("open");
  trigger.setAttribute("aria-expanded", "false");
  menu.hidden = true;
  if (focus) trigger.focus();
}

function syncViaductFrequencySelect() {
  const select = $("#viaductFrequency");
  const trigger = $("#viaductFrequencyTrigger");
  const label = $("#viaductFrequencyLabel");
  const menu = $("#viaductFrequencyMenu");
  if (!select || !trigger || !label || !menu) return;

  const value = String(Number(state.viaductFrequency) || select.value || 1);
  if (select.value !== value) select.value = value;
  label.textContent = select.selectedOptions[0]?.textContent || `Kas ${value} ${value === "1" ? "minutę" : "minutes"}`;
  trigger.disabled = select.disabled;
  trigger.setAttribute("aria-disabled", String(select.disabled));
  menu.querySelectorAll("[data-viaduct-frequency-value]").forEach((option) => {
    const selected = option.dataset.viaductFrequencyValue === select.value;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
  });
  if (select.disabled) closeViaductFrequencySelect();
}

function setViaductFrequencyDisabled(disabled) {
  const select = $("#viaductFrequency");
  if (select) select.disabled = disabled;
  syncViaductFrequencySelect();
}

function initializeViaductFrequencySelect() {
  const control = $("#viaductFrequencyControl");
  const select = $("#viaductFrequency");
  const trigger = $("#viaductFrequencyTrigger");
  const menu = $("#viaductFrequencyMenu");
  if (!control || !select || !trigger || !menu) return;

  trigger.addEventListener("click", () => {
    if (select.disabled || publicCampaignState.locked) return;
    const opening = menu.hidden;
    if (!opening) return closeViaductFrequencySelect();
    control.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    menu.querySelector(".selected")?.focus();
  });

  menu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-viaduct-frequency-value]");
    if (!option || select.disabled || publicCampaignState.locked) return;
    setViaductFrequency(option.dataset.viaductFrequencyValue);
    closeViaductFrequencySelect({ focus: true });
  });

  menu.addEventListener("keydown", (event) => {
    const options = [...menu.querySelectorAll("[data-viaduct-frequency-value]")];
    const currentIndex = options.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeViaductFrequencySelect({ focus: true });
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      options[(currentIndex + direction + options.length) % options.length]?.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!control.contains(event.target)) closeViaductFrequencySelect();
  });
  syncViaductFrequencySelect();
}

function setPublicCampaignMode(campaign) {
  publicCampaignState.active = true;
  publicCampaignState.campaign = campaign;
  publicCampaignState.locked = isClientShareView() ? publicCampaignIsLocked(campaign) : false;

  const locked = publicCampaignState.locked;
  const notice = $("#publicCampaignNotice");
  if (notice) {
    const showNotice = locked && isClientShareView();
    notice.hidden = !showNotice;
    notice.classList.toggle("locked", locked);
    const title = $("#publicCampaignNoticeTitle");
    const text = $("#publicCampaignNoticeText");
    if (title) title.textContent = "Patvirtinta";
    notice.title = "Planas patvirtintas. Redagavimas užrakintas.";
    notice.setAttribute("aria-label", "Planas patvirtintas. Redagavimas užrakintas.");
    if (text) {
      text.hidden = true;
      text.textContent = "";
    }
  }
  const copyBtn = $("#copyCampaignButton");
  if (copyBtn) copyBtn.hidden = true;
  const status = $("#publicCampaignStatus");
  if (status) status.hidden = true;
  $("#calculatorView").classList.toggle("public-readonly", locked);

  applyHeadingActionsChrome();
  const exportBtn = $("#exportButton");
  if (exportBtn) {
    exportBtn.hidden = false;
    exportBtn.disabled = false;
  }
  if (!isClientShareView()) {
    $("#resetButton").hidden = true;
    $("#createOrderButton").hidden = false;
    setCreateOrderButtonLabel();
    syncGoShareLinkVisibility({ hide: false });
  }
  const selectAllLocked = $("#selectAllButton");
  if (selectAllLocked) selectAllLocked.disabled = locked;
  setClipDurationDisabled(locked);
  setViaductFrequencyDisabled(locked);
  $("#dateFrom").disabled = locked;
  $("#dateTo").disabled = locked;
  if ($("#searchInput")) $("#searchInput").disabled = locked;
  const wavesOpen = $("#campaignWavesOpen");
  if (wavesOpen) wavesOpen.disabled = locked;
  const perScreenToggle = $("#perScreenDatesToggle");
  if (perScreenToggle) perScreenToggle.disabled = locked;
  document.querySelectorAll(".date-picker-trigger, #presetButtons button, .city-filters button").forEach((element) => {
    element.disabled = locked;
  });
  document.querySelectorAll("[data-view-target]").forEach((element) => {
    element.hidden = element.dataset.viewTarget !== "calculator";
  });

  document.querySelector(".topbar-meta span:nth-child(1) strong").textContent = campaign.client_name || campaign.name;
  document.querySelector(".topbar-meta span:nth-child(3) strong").textContent = campaign.agency_name || "—";
  document.querySelector(".topbar-meta span:nth-child(5) strong").textContent = `U-${campaign.order_no}`;
}

function normalizePublicGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 7) return Array.from({ length: 7 }, () => Array(17).fill(false));
  return grid.map((day) => Array.from({ length: 17 }, (_, index) => Boolean(Array.isArray(day) ? day[index] : false)));
}

function presetFromIntensity(intensity) {
  return ({ Max: "max", Medi: "medi", Min: "min", Pikas: "peak" })[intensity] || "custom";
}

function setInternalPlanEditMode(order) {
  internalPlanEditState.orderId = order.id;
  const notice = $("#publicCampaignNotice");
  if (notice) notice.hidden = true;
  $("#calculatorView").classList.remove("public-readonly");

  $("#resetButton").hidden = false;
  $("#resetButton").textContent = "← Grįžti į orderį";
  $("#createOrderButton").hidden = false;
  setCreateOrderButtonLabel();
  syncGoShareLinkVisibility({ hide: false });
  applyHeadingActionsChrome();
  const selectAllEdit = $("#selectAllButton");
  if (selectAllEdit) selectAllEdit.disabled = false;
  setClipDurationDisabled(false);
  setViaductFrequencyDisabled(false);
  $("#dateFrom").disabled = false;
  $("#dateTo").disabled = false;
  document.querySelectorAll(".date-picker-trigger, #presetButtons button").forEach((element) => {
    element.disabled = false;
  });
}

function exitInternalPlanEditMode() {
  internalPlanEditState.orderId = null;
  $("#publicCampaignNotice").hidden = true;
  $("#calculatorView").classList.remove("public-readonly");
  $("#resetButton").hidden = true;
  $("#createOrderButton").hidden = false;
  syncGoShareLinkVisibility({ hide: false });
  setCreateOrderButtonLabel();
}

function editActiveOrderPlan() {
  const order = activeOrder();
  if (!order) return;

  const selectedIds = new Set(orderScreens(order).map((screen) => String(screen.id)));
  screens.forEach((screen) => {
    screen.selected = selectedIds.has(String(screen.id));
  });
  state.city = "Visi";
  state.search = "";
  state.grid = getOrderCampaignStats(order).grid;
  state.preset = presetFromIntensity(order.intensity);
  $("#searchInput").value = "";
  $("#clipDuration").value = String(Number(order.clipDuration) || 10);
  syncClipDurationSelect();
  $("#dateFrom").value = order.from;
  $("#dateTo").value = order.to;
  applyScreenCustomPeriodsFromPlan(order.details?.plan || {});

  setInternalPlanEditMode(order);
  renderCityFilters();
  renderGrid();
  renderScreens();
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === state.preset);
  });
  showView("calculator");
}

function campaignScreenPayload(selectedScreens) {
  return selectedScreens.map((screen) => ({
    screen_id: screen.catalogId,
    impressions: screen.impressions,
    ots_total: screen.ots,
    clip_price: screen.clipPrice,
    cpt: screen.cpt,
    gross_price: screen.gross,
    discount: screen.screenDiscount * 100,
    net_price: screen.net,
    calculation_snapshot: {
      name: screen.name,
      city: screen.city,
      dimensions: screen.dimensions,
      resolution: screen.resolution,
    },
  }));
}

async function saveInternalPlanChanges() {
  const order = allOrders().find((item) => String(item.id) === String(internalPlanEditState.orderId));
  if (!order) return showToast("Orderis nerastas");

  const plan = buildExcelPlan();
  const selectedScreens = plan.screens.filter((screen) => screen.active);
  if (!selectedScreens.length) return showToast("Pasirinkite bent vieną ekraną");

  setCreateOrderButtonBusy(true);
  try {
    if (window.PikselSupabase?.configured && order.managementToken) {
      await window.PikselSupabase.campaigns.updateManaged(order.managementToken, {
        date_from: plan.from,
        date_to: plan.to,
        clip_duration_seconds: plan.clipDuration,
        intensity: plan.intensity,
        grid: plan.grid,
        volume_discount: plan.volumeDiscount * 100,
        period_discount: plan.periodDiscount * 100,
        final_price: plan.total,
      }, campaignScreenPayload(selectedScreens));
    }

    order.from = plan.from;
    order.to = plan.to;
    order.clipDuration = plan.clipDuration;
    order.intensity = plan.intensity;
    order.grid = plan.grid;
    order.viewsPerHour = plan.viewsPerHour;
    order.price = plan.total;
    order.screens = selectedScreens.map((screen) => screen.name);
    order.screenIds = selectedScreens.map((screen) => screen.id);
    order.enabledScreens = selectedScreens.map((screen) => screen.name);
    if (order.goMock || order.publicToken || TEST_ORDERS_LOCAL_ONLY) {
      attachGoMockLink(order, plan);
    }
    persistOrder(order);

    const orderId = order.id;
    exitInternalPlanEditMode();
    activeOrderId = orderId;
    renderOrderDetail();
    showView("campaign");
    showToast(order.goMock ? "Orderio planas atnaujintas (go mock)" : "Orderio planas atnaujintas");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Nepavyko atnaujinti orderio plano");
  } finally {
    setCreateOrderButtonBusy(false);
  }
}

function syncSharedTestOrder(record) {
  if (!String(record.orderId || "").startsWith("test-") || !record.orderPatch) return;
  const orders = readHubTestOrders();
  const index = orders.findIndex((order) => order.id === record.orderId);
  if (index < 0) return;
  const previous = orders[index];
  const patch = record.orderPatch;
  orders[index] = { ...previous, ...patch, details: {
    ...previous.details, ...patch.details,
    plan: { ...previous.details?.plan, ...patch.details?.plan },
  }};
  writeHubTestOrders(orders);
  notifyHubTestOrdersChanged(record.orderId);
}

function activateSharedPlan(record) {
  publicCampaignState.mock = false;
  publicCampaignState.orderId = record.orderId;
  if (!isStaffPlanView()) {
    const url = new URL(location.href);
    url.searchParams.delete("liveOrderId");
    url.searchParams.delete("testOrderId");
    url.searchParams.set("campaign", record.token);
    history.replaceState(null, "", url);
    testOrderDraft.active = false;
  }
  const incomingScreens = Array.isArray(record.screens) ? record.screens : [];
  const keepLocalStaffPlan = isStaffPlanView() && screens.some((screen) => screen.selected);
  if (keepLocalStaffPlan) {
    publicCampaignState.token = record.token;
    publicCampaignState.campaign = record.campaign || publicCampaignState.campaign;
    publicCampaignState.orderId = record.orderId || publicCampaignState.orderId;
    setGoMockTokenForMode(goMockModeKey(), record.token);
    void createGoMockFromCalculator({ openPreview: false, copy: false });
  } else {
    applyPublicCampaignPayload(record.token, campaignFromPublicRecord(record), incomingScreens);
  }
  setGoShareLinkField(buildPublicCampaignUrl(record.token));
  if (incomingScreens.length) syncSharedTestOrder(record);
  initializePublicAutosave();
  startPublicCampaignLockCheck();
  applyHeadingActionsChrome();
  if (isClientShareView() && findHubTestOrder(publicCampaignState.orderId)?.approved) {
    applyClientPlanLock(true);
  }
}

async function loadPublicCampaignFromUrl(forcedToken = "") {
  const token = String(forcedToken || getPublicCampaignTokenFromLocation() || "").trim();
  if (!token) return false;

  try {
    const record = await playCampaignRequest(`/api/play-campaigns/${encodeURIComponent(token)}`);
    if (record?.campaign) {
      const incoming = Array.isArray(record.screens) ? record.screens : [];
      if (!incoming.length) {
        const mock = loadGoMockCampaign(token);
        if (mock?.screens?.length) {
          publicCampaignState.mock = false;
          publicCampaignState.orderId = record.orderId;
          applyPublicCampaignPayload(token, campaignFromPublicRecord(record, mock.campaign || record.campaign), mock.screens);
          initializePublicAutosave();
          startPublicCampaignLockCheck();
          applyHeadingActionsChrome();
          void createGoMockFromCalculator({ openPreview: false, copy: false });
          return true;
        }
      }
      activateSharedPlan(record);
      return true;
    }
  } catch (error) {
    if (error?.status && error.status !== 404) throw error;
  }

  const mock = loadGoMockCampaign(token);
  if (mock?.campaign) {
    publicCampaignState.mock = true;
    applyPublicCampaignPayload(token, mock.campaign, mock.screens || []);
    const localOrder = readHubTestOrders().find((item) => (
      item.publicToken === token || item.details?.publicToken === token
    ));
    if (localOrder) publicCampaignState.orderId = localOrder.id;
    initializePublicAutosave();
    startPublicCampaignLockCheck();
    applyHeadingActionsChrome();
    if (localOrder?.approved) applyClientPlanLock(true);
    void createGoMockFromCalculator({ openPreview: false, copy: false });
    return true;
  }

  throw new Error("Kampanijos nuoroda negalioja");
}

async function refreshPublicCampaignLock() {
  if (!publicCampaignState.active || !publicCampaignState.token || !isClientShareView()) return;
  if (findHubTestOrder(publicCampaignState.orderId)?.approved) {
    applyClientPlanLock(true);
    return;
  }

  try {
    const payload = await playCampaignRequest(
      `/api/play-campaigns/${encodeURIComponent(publicCampaignState.token)}`
    );
    const locked = Boolean(payload?.locked) || publicCampaignIsLocked(campaignFromPublicRecord(payload));
    if (locked !== publicCampaignState.locked) {
      applyClientPlanLock(locked, payload);
      return;
    }
    if (locked || !publicSaveReady || publicSaveInFlight || publicPlanSnapshot() !== publicSavedSnapshot) return;
    const campaign = payload?.campaign;
    if (!campaign) return;
    const incoming = Array.isArray(payload.screens) ? payload.screens : [];
    if (incoming.length) {
      applyPublicCampaignPayload(payload.token, campaignFromPublicRecord(payload), incoming);
      syncSharedTestOrder(payload);
      initializePublicAutosave();
    }
  } catch (error) {
    console.warn("Nepavyko patikrinti kampanijos būsenos.", error);
  }
}

function applyClientPlanLock(locked, record) {
  if (!isClientShareView()) return;
  if (Boolean(publicCampaignState.locked) === Boolean(locked) && !record) return;
  const campaign = campaignFromPublicRecord(record || {
    locked,
    status: locked ? "approved" : "awaiting_approval",
    campaign: publicCampaignState.campaign,
  }, publicCampaignState.campaign);
  setPublicCampaignMode(campaign);
  renderCityFilters();
  renderGrid();
  renderScreens();
  setPublicCampaignMode(campaign);
  initializePublicAutosave();
}

function startPublicCampaignLockCheck() {
  if (!isClientShareView()) return;
  if (publicCampaignState.lockCheckTimer) return;
  publicCampaignState.lockCheckTimer = window.setInterval(refreshPublicCampaignLock, 2500);
  window.addEventListener("focus", refreshPublicCampaignLock);
  try {
    const lockChannel = new BroadcastChannel("piksel-public-plan-lock");
    lockChannel.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type !== "lock") return;
      const sameToken = data.token && data.token === publicCampaignState.token;
      const sameOrder = data.orderId && data.orderId === publicCampaignState.orderId;
      if (!sameToken && !sameOrder) return;
      applyClientPlanLock(Boolean(data.locked));
    });
  } catch {
    /* ignore */
  }
  try {
    const ordersChannel = new BroadcastChannel("piksel-test-orders");
    ordersChannel.addEventListener("message", () => {
      const order = findHubTestOrder(publicCampaignState.orderId);
      if (!order) return;
      applyClientPlanLock(Boolean(order.approved));
    });
  } catch {
    /* ignore */
  }
}

let publicSaveTimer = null;
let publicSaveInFlight = false;
let publicSavedSnapshot = "";
let publicSaveReady = false;

function publicPlanSnapshot() {
  const plan = buildExcelPlan();
  const source = publicCampaignState.campaign || {};
  return JSON.stringify(buildGoMockPayloadFromPlan(plan, {
    client: source.client_name || source.name,
    agency: source.agency_name,
    orderNo: source.order_no,
    status: source.status || "awaiting_approval",
  }));
}

function publicSaveStatus(text) {
  const status = $("#publicCampaignStatus");
  if (status) {
    status.setAttribute("role", "status");
    status.textContent = text;
  }
}

function initializePublicAutosave() {
  publicSavedSnapshot = publicPlanSnapshot();
  publicSaveReady = true;
  publicSaveStatus(publicCampaignState.locked ? "Patvirtinta" : "Išsaugota");
}

function schedulePublicSave() {
  if (!publicSaveReady || !publicCampaignState.active || publicCampaignState.locked) return;
  if (publicPlanSnapshot() === publicSavedSnapshot) {
    if (!publicSaveInFlight) {
      clearTimeout(publicSaveTimer);
      publicSaveStatus("Išsaugota");
    }
    return;
  }
  publicSaveStatus("Neišsaugoti pakeitimai…");
  clearTimeout(publicSaveTimer);
  publicSaveTimer = setTimeout(updatePublicCampaign, 800);
}

// Delegation also covers custom calendars and the drag-to-select time grid.
["input", "change", "click", "pointerup"].forEach((type) => {
  document.addEventListener(type, () => setTimeout(schedulePublicSave, 0));
});
window.addEventListener("beforeunload", (event) => {
  if (publicSaveReady && publicCampaignState.active &&
      (publicSaveInFlight || publicPlanSnapshot() !== publicSavedSnapshot)) {
    event.preventDefault();
    event.returnValue = "";
  }
});

async function updatePublicCampaign() {
  if (!publicSaveReady || !publicCampaignState.active || publicCampaignState.locked || publicSaveInFlight) return;
  clearTimeout(publicSaveTimer);
  const snapshot = publicPlanSnapshot();
  if (snapshot === publicSavedSnapshot) return;
  const payload = JSON.parse(snapshot);
  if (!payload.screens.length) {
    publicSaveStatus("Neišsaugota: pasirinkite bent vieną ekraną");
    return;
  }
  publicSaveInFlight = true;
  publicSaveStatus("Saugoma…");
  let succeeded = false;
  try {
    const savedRecord = await playCampaignRequest(`/api/play-campaigns/${encodeURIComponent(publicCampaignState.token)}`, {
      method: "PUT",
      body: JSON.stringify({ ...payload, status: payload.campaign.status }),
    });
    syncSharedTestOrder(savedRecord);
    publicCampaignState.campaign = payload.campaign;
    publicCampaignState.mock = false;
    publicSavedSnapshot = snapshot;
    succeeded = true;
    publicSaveStatus("Išsaugota");
  } catch (error) {
    publicSaveStatus("Nepavyko išsaugoti — spauskite Išsaugoti ir bandykite dar kartą");
    if (error?.status === 409) {
      publicCampaignState.locked = true;
      setPublicCampaignMode({ ...publicCampaignState.campaign, locked_for_client: true });
      renderGrid();
      renderScreens();
    }
    showToast(error instanceof Error ? error.message : "Nepavyko išsaugoti pakeitimų");
  } finally {
    publicSaveInFlight = false;
    // Edits made during a request are sent afterwards, never concurrently.
    if (succeeded) schedulePublicSave();
  }
}

/**
 * Agentūra kopijuoja kampaniją: tas pats planas, naujas kampanijos numeris + naujas go token.
 */
async function copyPublicCampaign() {
  let plan;
  let clientName;
  let agencyName;
  let selectedScreens;

  if (publicCampaignState.active) {
    plan = buildExcelPlan();
    selectedScreens = plan.screens.filter((screen) => screen.active);
    const source = publicCampaignState.campaign || {};
    clientName = source.client_name || source.name || plan.client || "Kampanija";
    agencyName = source.agency_name || plan.agency || "—";
  } else {
    const order = typeof activeOrder === "function" ? activeOrder() : null;
    if (!order) return showToast("Nėra aktyvios kampanijos");
    plan = buildExcelPlan();
    selectedScreens = plan.screens.filter((screen) => screen.active);
    if (!selectedScreens.length && Array.isArray(order.screens)) {
      const names = new Set(order.screens.map(String));
      selectedScreens = plan.screens.filter((screen) => names.has(screen.name) || names.has(String(screen.id)));
    }
    clientName = order.client || plan.client || "Kampanija";
    agencyName = order.agency || plan.agency || "—";
  }

  if (!selectedScreens.length) return showToast("Pasirinkite bent vieną ekraną");

  const button = $("#copyCampaignButton") || $("#campaignCopyCampaign");
  if (button) {
    button.disabled = true;
    button.textContent = "Kopijuojama…";
  }

  try {
    const useMock = publicCampaignState.mock || TEST_ORDERS_LOCAL_ONLY || !window.PikselSupabase?.configured;
    if (useMock) {
      const orderNo = `M${Date.now().toString().slice(-6)}`;
      const token = generateGoMockToken();
      const payload = buildGoMockPayloadFromPlan(plan, {
        client: clientName,
        agency: agencyName,
        orderNo,
      });
      saveGoMockCampaign(token, payload);
      setGoMockTokenForMode(plan.viaduct ? "viaducts" : "screens", token);
      const newUrl = buildPublicCampaignUrl(token);
      showToast(`Mock kopija U-${orderNo}`);
      if (publicCampaignState.active) {
        window.location.href = localPreviewUrlForToken(token);
        return;
      }
      window.open(localPreviewUrlForToken(token), "_blank", "noopener,noreferrer");
      try { await navigator.clipboard.writeText(newUrl); } catch { /* ignore */ }
      return;
    }

    const created = await window.PikselSupabase.campaigns.create({
      name: clientName,
      client_name: clientName,
      agency_name: agencyName,
      date_from: plan.from,
      date_to: plan.to,
      clip_duration_seconds: plan.clipDuration,
      intensity: plan.intensity,
      grid: plan.grid,
      volume_discount: plan.volumeDiscount * 100,
      period_discount: plan.periodDiscount * 100,
      final_price: plan.total,
    }, selectedScreens.map((screen) => ({
      screen_id: screen.catalogId,
      impressions: screen.impressions,
      ots_total: screen.ots,
      clip_price: screen.clipPrice,
      cpt: screen.cpt,
      gross_price: screen.gross,
      discount: screen.screenDiscount * 100,
      net_price: screen.net,
      calculation_snapshot: {
        name: screen.name,
        city: screen.city,
        dimensions: screen.dimensions,
        resolution: screen.resolution,
      },
    })));

    const newUrl = buildPublicCampaignUrl(created.public_token);
    showToast(`Sukurta kopija U-${created.order_no}`);
    if (publicCampaignState.active) {
      window.location.href = newUrl;
      return;
    }
    window.open(newUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Nepavyko nukopijuoti kampanijos");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Kopijuoti kampaniją";
    }
  }
}

function calculateScreen(screen, stats, completeCities) {
  if (stats.activeSlots === 0) return null;
  const duration = getClipDurationSeconds();
  const clipMultiplier = duration / 10;
  const frequency = getViewsPerHour();
  const impressions = stats.activeSlots * frequency;
  const avgViewsPerDay = stats.days ? impressions / stats.days : 0;
  const priceTiers = Object.entries(screen.priceByAvgViewsPerDay)
    .map(([threshold, price]) => ({ threshold: Number(threshold), price: Number(price) }))
    .filter((tier) => Number.isFinite(tier.threshold) && Number.isFinite(tier.price))
    .sort((a, b) => a.threshold - b.threshold);
  const applicableTier = priceTiers.filter((tier) => avgViewsPerDay >= tier.threshold).at(-1);
  const baseClipPrice = applicableTier?.price ?? priceTiers[0]?.price ?? 0;
  const ots = Math.round(impressions * screen.otsCoefficient);
  const gross = baseClipPrice * impressions * clipMultiplier;
  const screenDiscount = getScreenDiscountRate(screen, completeCities);
  const net = gross * (1 - screenDiscount);
  const clipPrice = impressions ? net / impressions : 0;
  const cpt = ots ? (net / ots) * 1000 : 0;
  return { impressions, avgViewsPerDay, baseClipPrice, ots, gross, net, clipPrice, cpt, screenDiscount };
}

function getScreenTechnicalData(screen) {
  return {
    dimensions: screen.dimensions,
    resolution: screen.resolution,
    exportType: screen.viaduct ? "Viadukas" : (screen.catalogType || screen.type),
  };
}

function buildExcelPlan() {
  const campaignStats = getCampaignStats();
  const pool = modeScreens();
  const selected = pool.filter((screen) => screen.selected);
  const discounts = getDiscounts(selected.length, campaignStats.days);
  const dateUnion = getSelectedScreensDateUnion();
  // Į Excel — tik pasirinkti ekranai (kaip Hub eksporte)
  const exportedScreens = selected.map((screen) => {
    const range = getScreenDateRange(screen);
    const stats = getStatsForScreen(screen);
    const calc = calculateScreen(screen, stats);
    const technical = getScreenTechnicalData(screen);
    return {
      active: true,
      id: screen.id,
      catalogId: screen.catalogId,
      city: screen.city,
      name: screen.name,
      type: technical.exportType,
      dimensions: technical.dimensions,
      resolution: technical.resolution,
      ots: calc?.ots || 0,
      otsCoefficient: screen.otsCoefficient,
      viaduct: Boolean(screen.viaduct),
      owner: screen.owner || "",
      link: screen.link || "",
      priceByAvgViewsPerDay: screen.priceByAvgViewsPerDay || {},
      impressions: calc?.impressions || 0,
      clipPrice: calc?.clipPrice || 0,
      cpt: calc?.cpt || 0,
      gross: calc?.gross || 0,
      screenDiscount: calc?.screenDiscount || 0,
      net: calc?.net || 0,
      from: range.from,
      to: range.to,
      days: stats.days,
      customPeriod: range.isCustom,
    };
  });
  const rowTotal = exportedScreens.reduce((sum, screen) => sum + (screen.active ? screen.net : 0), 0);
  const total = rowTotal * (1 - discounts.volume - discounts.period);
  const intensityLabels = { max: "Max", medi: "Medi", min: "Min", peak: "Pikas", custom: "Individualus" };
  const viaductIntensity = `Kas ${state.viaductFrequency} ${state.viaductFrequency === 1 ? "minutę" : "minutes"}`;
  const prefix = isViaductMode() ? "V" : "U";
  const campaignNo = testOrderDraft.active
    ? `${prefix}-${testOrderDraft.id}`
    : (document.querySelectorAll(".topbar-meta strong")[2]?.textContent || `${prefix}-1990`);
  return {
    client: testOrderDraft.active ? testOrderDraft.client : (document.querySelector(".topbar-meta strong")?.textContent || "X"),
    agency: testOrderDraft.active ? testOrderDraft.agency : (document.querySelectorAll(".topbar-meta strong")[1]?.textContent || "X"),
    campaignNo,
    from: dateUnion.from || $("#dateFrom").value,
    to: dateUnion.to || $("#dateTo").value,
    days: campaignStats.days,
    intensity: isViaductMode() ? viaductIntensity : (intensityLabels[state.preset] || "Individualus"),
    clipDuration: getClipDurationSeconds(),
    viewsPerHour: getViewsPerHour(),
    grid: state.grid.map((day) => [...day]),
    screens: exportedScreens,
    volumeDiscount: discounts.volume,
    periodDiscount: discounts.period,
    finalPrice: rowTotal,
    total,
    viaduct: isViaductMode(),
    viaductFrequency: isViaductMode() ? state.viaductFrequency : 1,
  };
}

function intersectIsoRanges(fromA, toA, fromB, toB) {
  const aFrom = String(fromA || "").trim();
  const aTo = String(toA || "").trim();
  const bFrom = String(fromB || "").trim();
  const bTo = String(toB || "").trim();
  const from = !aFrom ? bFrom : !bFrom ? aFrom : aFrom > bFrom ? aFrom : bFrom;
  const to = !aTo ? bTo : !bTo ? aTo : aTo < bTo ? aTo : bTo;
  if (!from || !to || from > to) return null;
  return { from, to };
}

/** Vienos bangos planas Excel sheet’ui (from/to = banga). */
function buildExcelPlanForWave(wave) {
  const saved = state.billingPeriods;
  state.billingPeriods = [wave];
  try {
    const plan = buildExcelPlan();
    const screens = plan.screens.map((screen) => {
      const clipped = intersectIsoRanges(screen.from, screen.to, wave.from, wave.to);
      if (!clipped) {
        return {
          ...screen,
          from: wave.from,
          to: wave.to,
          days: 0,
          impressions: 0,
          ots: 0,
          clipPrice: 0,
          cpt: 0,
          gross: 0,
          net: 0,
        };
      }
      return { ...screen, from: clipped.from, to: clipped.to };
    });
    const rowTotal = screens.reduce((sum, screen) => sum + (screen.active ? screen.net : 0), 0);
    return {
      ...plan,
      from: wave.from,
      to: wave.to,
      days: getStatsForRange(wave.from, wave.to, { ignoreBillingPeriods: true }).days,
      screens,
      finalPrice: rowTotal,
      total: rowTotal * (1 - plan.volumeDiscount - plan.periodDiscount),
    };
  } finally {
    state.billingPeriods = saved;
  }
}

/** Su bangomis: wavePlans[] (po sheet’ą); be — paprastas planas. */
function buildExcelPlanForExport() {
  const waves = getActiveBillingPeriods();
  const base = buildExcelPlan();
  if (!waves?.length) return base;
  const wavePlans = waves.map((wave) => {
    const plan = buildExcelPlanForWave(wave);
    const rowTotal = plan.screens.reduce(
      (sum, screen) => sum + (screen.active ? screen.net : 0),
      0
    );
    return {
      ...plan,
      volumeDiscount: base.volumeDiscount,
      periodDiscount: base.periodDiscount,
      finalPrice: rowTotal,
      total: rowTotal * (1 - base.volumeDiscount - base.periodDiscount),
    };
  });
  return { ...base, wavePlans };
}

function buildHubCombinedExportPayload(plan = buildExcelPlan()) {
  const activeScreens = (plan.screens || []).filter((screen) => screen.active);
  const waves = getActiveBillingPeriods();
  const envelopeFrom = waves?.length
    ? String($("#dateFrom")?.value || plan.from || "").trim() || plan.from
    : plan.from;
  const envelopeTo = waves?.length
    ? String($("#dateTo")?.value || plan.to || "").trim() || plan.to
    : plan.to;
  return {
    client: plan.client,
    agency: plan.agency,
    campaignNo: plan.campaignNo,
    from: envelopeFrom,
    to: envelopeTo,
    clipDuration: plan.clipDuration,
    grid: plan.grid,
    selectedScreenIds: activeScreens.map((screen) => String(screen.catalogId || screen.id)).filter(Boolean),
    volumeDiscount: plan.volumeDiscount,
    periodDiscount: plan.periodDiscount,
    finalPrice: plan.finalPrice,
    total: plan.total,
    viaduct: Boolean(plan.viaduct),
    viaductFrequency: Number(plan.viaductFrequency) || 1,
    discount: 80,
    waves: waves
      ? waves.map((wave) => ({ from: wave.from, to: wave.to }))
      : undefined,
    screens: (plan.screens || []).map((screen) => ({
      catalogId: screen.catalogId,
      id: screen.catalogId || screen.id,
      name: screen.name,
      city: screen.city,
      type: screen.type,
      dimensions: screen.dimensions,
      resolution: screen.resolution,
      link: screen.link,
      ots: Number(screen.otsCoefficient) || 0,
      viaduct: Boolean(screen.viaduct),
      owner: screen.owner || "",
      priceByAvgViewsPerDay: screen.priceByAvgViewsPerDay || {},
      net: Number(screen.net) || 0,
      active: Boolean(screen.active),
      from: screen.from,
      to: screen.to,
      days: screen.days,
    })),
  };
}

async function downloadHubCombinedPlanExcel(plan = buildExcelPlan()) {
  const selected = (plan.screens || []).filter((screen) => screen.active);
  if (!selected.length) throw new Error("Pasirinkite bent vieną ekraną");

  const response = await fetch("/api/export/reklamos-planas-combined", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildHubCombinedExportPayload(plan)),
  });

  if (!response.ok) {
    let message = "Nepavyko sugeneruoti bendro Excel failo";
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const headerName = response.headers.get("X-Export-Filename");
  const disposition = response.headers.get("Content-Disposition") || "";
  const matched = disposition.match(/filename="([^"]+)"/i);
  const filename = headerName || matched?.[1] || "Piksel-Bendras.xlsx";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

async function exportCombinedPlanExcel(plan = buildExcelPlan()) {
  await ensureExcelLibs();
  const payload = getActiveBillingPeriods()?.length
    ? buildExcelPlanForExport()
    : plan;
  const activeCount = (payload.screens || []).filter((screen) => screen.active).length;
  if (!activeCount) throw new Error("Pasirinkite bent vieną ekraną");
  // Viadukai — lokalus Codex generatorius (Hub dar nepalaiko)
  if (plan.viaduct && window.PikselExcel?.exportPlan) {
    if (!selectedModeScreens().length) ensureAllViaductsSelected();
    return window.PikselExcel.exportPlan(payload, { suffix: "Bendras" });
  }
  try {
    return await downloadHubCombinedPlanExcel(plan);
  } catch (error) {
    if (!window.PikselExcel?.exportPlan) throw error;
    return window.PikselExcel.exportPlan(payload, { suffix: "Bendras" });
  }
}

function visibleScreens() {
  const query = state.search.trim().toLocaleLowerCase("lt-LT");
  return modeScreens().filter((screen) => {
    const matchesCity = state.city === "Visi" || screen.city === state.city;
    const text = `${screen.name} ${screen.city} ${screen.address}`.toLocaleLowerCase("lt-LT");
    return matchesCity && (!query || text.includes(query));
  });
}

function screenTypeIcon(type) {
  if (type === "Video") {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.25 3.5 12 8l-6.75 4.5z" /></svg>`;
  }
  if (type === "Statinis") {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><circle cx="5.5" cy="6" r="1" /><path d="m4 11 2.8-2.8 1.8 1.8 1.4-1.4 2 2" /></svg>`;
  }
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="5" width="13" height="6" rx="1.5" /><path d="M4 5V3.5M12 5V3.5M5 11v1.5M11 11v1.5" /></svg>`;
}

function renderScreens() {
  const campaignStats = getCampaignStats();
  const rows = visibleScreens().map((screen) => {
    const stats = getStatsForScreen(screen);
    const calc = calculateScreen(screen, stats);
    const range = getScreenDateRange(screen);
    const periodHint = range.isCustom
      ? formatScreenPeriodHint(range.from, range.to)
      : "";
    const showScreenCalendar =
      state.perScreenDatesMode && screen.selected && !publicCampaignState.locked;
    return `
      <tr class="${screen.selected ? "selected" : ""} ${screen.id === lastChangedScreenId ? "just-changed" : ""}">
        <td>
          <div class="screen-cell">
            <label class="switch">
              <input type="checkbox" data-screen-id="${screen.id}" ${screen.selected ? "checked" : ""} ${publicCampaignState.locked ? "disabled" : ""} />
              <span></span>
            </label>
            <div class="screen-copy" data-open-screen="${screen.id}" role="button" tabindex="0" title="Ekrano informacija">
              <div class="screen-title-line">
                <strong>${screen.name}</strong>
                <button type="button" class="screen-info-btn" data-open-screen="${screen.id}" aria-label="Ekrano informacija">i</button>
                <span class="format-pill ${screen.type === "Video" ? "video" : screen.type === "Statinis" ? "static" : "viaduct"}">${screenTypeIcon(screen.type)}${screen.type}</span>
                ${
                  showScreenCalendar
                    ? `<button type="button" class="screen-period-btn${range.isCustom ? " active" : ""}" data-screen-period="${screen.id}" title="${
                        range.isCustom
                          ? `Custom laikotarpis: ${periodHint}`
                          : "Nustatyti ekrano laikotarpį"
                      }" aria-label="Ekrano laikotarpis"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5v3M15 2.5v3M3 7.5h14M4.5 4h11A1.5 1.5 0 0 1 17 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4Z"/></svg></button>`
                    : ""
                }
              </div>
              <span>${screen.city}${periodHint ? ` · <em class="screen-period-hint">${periodHint}</em>` : ""}</span>
            </div>
          </div>
        </td>
        <td class="${calc ? "" : "muted-value"}">${calc ? formatNumber.format(calc.impressions) : "—"}</td>
        <td class="${calc ? "" : "muted-value"}">${calc ? formatNumber.format(calc.ots) : "—"}</td>
        <td class="${calc ? "" : "muted-value"}">${calc ? calc.clipPrice.toFixed(3) : "—"}</td>
        <td class="${calc ? "" : "muted-value"}">${calc ? calc.cpt.toFixed(2) : "—"}</td>
        <td class="${calc ? "" : "muted-value"}">${calc ? formatMoney.format(calc.gross) : "—"}</td>
        <td class="${calc ? "" : "muted-value"}">${calc ? `${Math.round(calc.screenDiscount * 100)}%` : "—"}</td>
        <td class="${calc ? "" : "muted-value"}">${calc ? formatMoney.format(calc.net) : "—"}</td>
      </tr>`;
  }).join("");

  $("#screensTableBody").innerHTML = rows || `<tr><td colspan="8" style="text-align:center;padding:34px;color:#697386">Ekranų nerasta</td></tr>`;
  renderScreensTotals(campaignStats);
  lastChangedScreenId = null;
  renderPackageFilters();
  renderSummary(campaignStats);
  syncPerScreenDatesToggleUi();
  syncCampaignWavesUi();
  scheduleHubOpenedPlanSync();
}

function renderScreensTotals(campaignStats) {
  const foot = $("#screensTableFoot");
  if (!foot) return;

  const selected = selectedModeScreens();
  if (!selected.length) {
    foot.hidden = true;
    foot.innerHTML = "";
    return;
  }

  const calcs = selected
    .map((screen) => calculateScreen(screen, getStatsForScreen(screen)))
    .filter(Boolean);
  const n = calcs.length;
  if (!n) {
    foot.hidden = true;
    foot.innerHTML = "";
    return;
  }

  const sumImpressions = calcs.reduce((sum, item) => sum + item.impressions, 0);
  const sumOts = calcs.reduce((sum, item) => sum + item.ots, 0);
  const avgClip = calcs.reduce((sum, item) => sum + item.clipPrice, 0) / n;
  const avgCpt = calcs.reduce((sum, item) => sum + item.cpt, 0) / n;
  const sumGross = calcs.reduce((sum, item) => sum + item.gross, 0);
  const avgDiscount =
    (calcs.reduce((sum, item) => sum + item.screenDiscount, 0) / n) * 100;
  const sumNet = calcs.reduce((sum, item) => sum + item.net, 0);

  foot.hidden = false;
  foot.innerHTML = `
    <tr>
      <td><strong>Viso</strong></td>
      <td title="Suma">${formatNumber.format(sumImpressions)}</td>
      <td title="Suma">${formatNumber.format(sumOts)}</td>
      <td title="Vidurkis">${avgClip.toFixed(3)}</td>
      <td title="Vidurkis">${avgCpt.toFixed(2)}</td>
      <td title="Suma">${formatMoney.format(sumGross)}</td>
      <td title="Vidurkis">${Math.round(avgDiscount)}%</td>
      <td title="Suma">${formatMoney.format(sumNet)}</td>
    </tr>`;
}

function planNetTotal(screenList, { completeCities, days } = {}) {
  const envelopeDays = days ?? getCampaignStats().days;
  const rowTotal = screenList.reduce(
    (sum, screen) => sum + (calculateScreen(screen, getStatsForScreen(screen), completeCities)?.net || 0),
    0
  );
  const discounts = getDiscounts(screenList.length, envelopeDays);
  return {
    rowTotal,
    discounts,
    total: rowTotal * (1 - discounts.volume - discounts.period),
  };
}

function packageUpgradeOffers(envelopeDays) {
  if (isViaductMode() || publicCampaignState.locked) return [];
  if (!envelopeDays) return [];
  const selected = selectedModeScreens();
  if (!selected.length) return [];
  const current = planNetTotal(selected, { days: envelopeDays });
  return PACKAGE_CITIES.map((city) => {
    const packageScreens = packageScreensForCity(city);
    if (!packageScreens.length) return null;
    const selectedInCity = packageScreens.filter((screen) => screen.selected);
    const minSelected = PACKAGE_UPSELL_MIN_SCREENS[city] || 1;
    if (selectedInCity.length < minSelected || selectedInCity.length === packageScreens.length) return null;
    const missing = packageScreens.filter((screen) => !screen.selected);
    const completeCities = currentCompleteCities();
    completeCities.add(city);
    const upgraded = planNetTotal([...selected, ...missing], {
      completeCities,
      days: envelopeDays,
    });
    const withoutAvg = averageScreenFinalPrice(selectedInCity, current.discounts);
    const withAvg = averageScreenFinalPrice(packageScreens, upgraded.discounts, completeCities);
    if (!Number.isFinite(withoutAvg) || !Number.isFinite(withAvg)) return null;
    const extraOts = missing.reduce(
      (sum, screen) => sum + (calculateScreen(screen, getStatsForScreen(screen), completeCities)?.ots || 0),
      0
    );
    const cheaperPct = withoutAvg > 0
      ? Math.round(((withoutAvg - withAvg) / withoutAvg) * 100)
      : 0;
    return {
      city,
      withoutAvg,
      withAvg,
      cheaperPct,
      extraScreens: missing.length,
      extraCost: upgraded.total - current.total,
      extraOts,
    };
  }).filter(Boolean);
}

function renderPackageUpsell(envelopeDays) {
  const host = $("#packageUpsell");
  if (!host) return;
  const offers = packageUpgradeOffers(envelopeDays);
  if (!offers.length) {
    host.hidden = true;
    host.innerHTML = "";
    document.body.classList.remove("has-package-upsell");
    return;
  }
  host.hidden = false;
  document.body.classList.add("has-package-upsell");
  host.innerHTML = `<div class="package-upsell-inner">${renderPackageStrip(offers)}</div>`;
}

function renderSummary(campaignStats) {
  const selected = selectedModeScreens();
  const envelopeDays = campaignStats?.days ?? getCampaignStats().days;
  const priced = planNetTotal(selected, { days: envelopeDays });
  $("#footerScreens").textContent = formatScreenCount(selected.length);
  $("#volumeDiscount").textContent = `${Math.round(priced.discounts.volume * 100)}%`;
  $("#periodDiscount").textContent = `${Math.round(priced.discounts.period * 100)}%`;
  $("#grandTotal").textContent = formatMoney.format(priced.total);
  renderPackageUpsell(envelopeDays);
  const activeHours = $("#activeHoursValue");
  if (activeHours) {
    activeHours.textContent = campaignStats?.activeSlots ?? getCampaignStats().activeSlots;
  }
  const campaignDays = $("#campaignDaysValue");
  if (campaignDays) campaignDays.textContent = envelopeDays;
  const selectAllLabel = $("#selectAllButton");
  if (selectAllLabel) {
    const visible = visibleScreens();
    const allVisibleSelected =
      visible.length > 0 && visible.every((screen) => screen.selected);
    selectAllLabel.textContent = allVisibleSelected ? "Nuimti visus" : "Pasirinkti visus";
    selectAllLabel.disabled = publicCampaignState.locked || visible.length === 0;
  }
}

function syncPerScreenDatesToggleUi() {
  const toggle = $("#perScreenDatesToggle");
  if (!toggle) return;
  toggle.classList.toggle("active", state.perScreenDatesMode);
  toggle.setAttribute("aria-pressed", state.perScreenDatesMode ? "true" : "false");
}

function syncCampaignWavesUi() {
  const hint = $("#campaignWavesHint");
  const link = $("#campaignWavesOpen");
  const periods = getActiveBillingPeriods();
  const envelopeFrom = String($("#dateFrom")?.value || "").trim();
  const envelopeTo = String($("#dateTo")?.value || "").trim();
  if (link) link.classList.toggle("active", Boolean(periods?.length));
  if (!hint) return;
  if (!periods?.length) {
    hint.hidden = true;
    hint.textContent = "";
    return;
  }
  const billable = getCampaignStats();
  const envelope = getStatsForRange(envelopeFrom, envelopeTo, { ignoreBillingPeriods: true });
  const gapInfo = describeBillingGaps(envelopeFrom, envelopeTo, periods);
  const gapText = gapInfo?.gapDays
    ? ` · gap ${gapInfo.gapDays} d.`
    : "";
  hint.hidden = false;
  hint.textContent = `Split ON · ${periods.length} bangos · aktyvios ${billable.days} / ${envelope.days} d.${gapText}`;
}

const campaignWavesModalState = { draft: [] };

function createEmptyWave(from = "", to = "") {
  return {
    id: `wave-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from: String(from || "").trim(),
    to: String(to || "").trim(),
  };
}

function readCampaignWavesDraftFromDom() {
  const rows = [...document.querySelectorAll("#campaignWavesList .campaign-wave-row")];
  return rows
    .map((row) =>
      normalizeBillingPeriod({
        id: row.dataset.waveId,
        from: row.querySelector('[data-wave-field="from"]')?.value,
        to: row.querySelector('[data-wave-field="to"]')?.value,
      })
    )
    .filter(Boolean);
}

function updateCampaignWavesGapHint() {
  const hint = $("#campaignWavesGapHint");
  if (!hint) return;
  const envelopeFrom = String($("#dateFrom")?.value || "").trim();
  const envelopeTo = String($("#dateTo")?.value || "").trim();
  const draft = readCampaignWavesDraftFromDom();
  const gapInfo = describeBillingGaps(envelopeFrom, envelopeTo, draft);
  if (!gapInfo?.gaps?.length) {
    hint.hidden = true;
    hint.textContent = "";
    return;
  }
  const first = gapInfo.gaps[0];
  const extra = gapInfo.gaps.length > 1 ? ` (+${gapInfo.gaps.length - 1})` : "";
  hint.hidden = false;
  hint.textContent = `Gap: ${first.from} – ${first.to}${extra} · ${gapInfo.gapDays} d. neįskaičiuojama`;
}

function bindCampaignWaveRowControls(row) {
  row.querySelectorAll("input[data-wave-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const cursorAtEnd = event.target.selectionStart === event.target.value.length;
      event.target.value = formatIsoDateTyping(event.target.value);
      if (cursorAtEnd) {
        event.target.setSelectionRange(event.target.value.length, event.target.value.length);
      }
      const picker = row.querySelector(
        `.native-date-picker[data-date-source="${event.target.id}"]`
      );
      if (picker && /^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
        picker.value = event.target.value;
      }
      updateCampaignWavesGapHint();
    });
    input.addEventListener("click", () => openNativeDatePickerForSource(input.id));
  });
  row.querySelectorAll(".date-picker-trigger").forEach((button) => {
    button.addEventListener("click", () => openNativeDatePickerForSource(button.dataset.dateTarget));
  });
  row.querySelectorAll(".native-date-picker").forEach((picker) => {
    picker.addEventListener("change", () => {
      const source = $(`#${picker.dataset.dateSource}`);
      if (!source) return;
      source.value = picker.value;
      updateCampaignWavesGapHint();
    });
  });
  row.querySelector(".campaign-wave-remove")?.addEventListener("click", () => {
    const list = $("#campaignWavesList");
    if (!list || list.children.length <= 1) {
      showToast("Palikite bent vieną bangą arba paspauskite Išvalyti");
      return;
    }
    row.remove();
    updateCampaignWavesGapHint();
  });
}

function renderCampaignWavesDraft(draft) {
  const list = $("#campaignWavesList");
  if (!list) return;
  const envelopeFrom = String($("#dateFrom")?.value || "").trim();
  const envelopeTo = String($("#dateTo")?.value || "").trim();
  list.innerHTML = draft
    .map((period, index) => {
      const fromId = `campaignWaveFrom-${index}`;
      const toId = `campaignWaveTo-${index}`;
      return `<div class="campaign-wave-row" data-wave-id="${escapeHtml(period.id)}">
        <label>Nuo
          <span class="iso-date-control standalone">
            <input id="${fromId}" data-wave-field="from" type="text" inputmode="numeric" maxlength="10" placeholder="yyyy-mm-dd" autocomplete="off" value="${escapeHtml(period.from)}" />
            <button class="date-picker-trigger" type="button" data-date-target="${fromId}" aria-label="Kalendorius">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5v3M15 2.5v3M3 7.5h14M4.5 4h11A1.5 1.5 0 0 1 17 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4Z"/></svg>
            </button>
            <input class="native-date-picker" type="date" data-date-source="${fromId}" value="${escapeHtml(period.from)}" min="${escapeHtml(envelopeFrom)}" max="${escapeHtml(envelopeTo)}" tabindex="-1" aria-hidden="true" />
          </span>
        </label>
        <label>Iki
          <span class="iso-date-control standalone">
            <input id="${toId}" data-wave-field="to" type="text" inputmode="numeric" maxlength="10" placeholder="yyyy-mm-dd" autocomplete="off" value="${escapeHtml(period.to)}" />
            <button class="date-picker-trigger" type="button" data-date-target="${toId}" aria-label="Kalendorius">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5v3M15 2.5v3M3 7.5h14M4.5 4h11A1.5 1.5 0 0 1 17 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4Z"/></svg>
            </button>
            <input class="native-date-picker" type="date" data-date-source="${toId}" value="${escapeHtml(period.to)}" min="${escapeHtml(envelopeFrom)}" max="${escapeHtml(envelopeTo)}" tabindex="-1" aria-hidden="true" />
          </span>
        </label>
        <button type="button" class="campaign-wave-remove" aria-label="Šalinti bangą">×</button>
      </div>`;
    })
    .join("");
  list.querySelectorAll(".campaign-wave-row").forEach(bindCampaignWaveRowControls);
  updateCampaignWavesGapHint();
}

function openCampaignWavesModal() {
  if (publicCampaignState.locked) return;
  const modal = $("#campaignWavesModal");
  if (!modal) return;
  const envelopeFrom = String($("#dateFrom")?.value || "").trim();
  const envelopeTo = String($("#dateTo")?.value || "").trim();
  if (!envelopeFrom || !envelopeTo) {
    showToast("Pirmiausia nustatykite kampanijos laikotarpį");
    return;
  }
  const lead = $("#campaignWavesLead");
  if (lead) {
    lead.textContent = `Envelope: ${envelopeFrom} – ${envelopeTo}. Gap’ai tarp bangų neįskaičiuojami į kainą.`;
  }
  campaignWavesModalState.draft = getActiveBillingPeriods()
    ? state.billingPeriods.map((period) => ({ ...period }))
    : [createEmptyWave(envelopeFrom, envelopeTo)];
  renderCampaignWavesDraft(campaignWavesModalState.draft);
  modal.hidden = false;
}

function closeCampaignWavesModal() {
  const modal = $("#campaignWavesModal");
  if (modal) modal.hidden = true;
}

function saveCampaignWavesFromModal(clear = false) {
  if (clear) {
    state.billingPeriods = [];
    closeCampaignWavesModal();
    renderScreens();
    showToast("Kampanija vėl ištisinė (be split)");
    return;
  }
  const envelopeFrom = String($("#dateFrom")?.value || "").trim();
  const envelopeTo = String($("#dateTo")?.value || "").trim();
  const draft = readCampaignWavesDraftFromDom();
  const error = validateBillingPeriodsDraft(draft, envelopeFrom, envelopeTo);
  if (error) {
    showToast(error);
    return;
  }
  const isFullEnvelope =
    draft.length === 1 && draft[0].from === envelopeFrom && draft[0].to === envelopeTo;
  state.billingPeriods = isFullEnvelope ? [] : draft;
  closeCampaignWavesModal();
  renderScreens();
  showToast(
    state.billingPeriods.length
      ? `Išsaugota: ${state.billingPeriods.length} bangos`
      : "Naudojamas visas envelope"
  );
}

const screenPeriodModalState = { screenId: null };

function openScreenPeriodModal(screenId) {
  const screen = screens.find((item) => String(item.id) === String(screenId));
  if (!screen) return;
  const range = getScreenDateRange(screen);
  screenPeriodModalState.screenId = screen.id;
  const modal = $("#screenPeriodModal");
  if (!modal) return;
  $("#screenPeriodTitle").textContent = screen.name;
  $("#screenPeriodFrom").value = range.from || "";
  $("#screenPeriodTo").value = range.to || "";
  document.querySelectorAll(
    '.native-date-picker[data-date-source="screenPeriodFrom"], .native-date-picker[data-date-source="screenPeriodTo"]'
  ).forEach((picker) => {
    if (range.campaignFrom) picker.min = range.campaignFrom;
    else picker.removeAttribute("min");
    if (range.campaignTo) picker.max = range.campaignTo;
    else picker.removeAttribute("max");
    const source = $(`#${picker.dataset.dateSource}`);
    picker.value = source?.value || "";
  });
  modal.hidden = false;
}

function openNativeDatePickerForSource(targetId) {
  const source = $(`#${targetId}`);
  const picker = document.querySelector(`.native-date-picker[data-date-source="${targetId}"]`);
  if (!source || !picker) return;
  picker.value = source.value;
  try {
    if (typeof picker.showPicker === "function") {
      void picker.showPicker();
      return;
    }
  } catch {
    /* fall through */
  }
  picker.focus();
  picker.click();
}

function closeScreenPeriodModal() {
  screenPeriodModalState.screenId = null;
  const modal = $("#screenPeriodModal");
  if (modal) modal.hidden = true;
}

function saveScreenPeriodFromModal(clear = false) {
  const screen = screens.find(
    (item) => String(item.id) === String(screenPeriodModalState.screenId)
  );
  if (!screen) return;
  const campaignFrom = String($("#dateFrom")?.value || "").trim();
  const campaignTo = String($("#dateTo")?.value || "").trim();

  if (clear) {
    screen.customFrom = "";
    screen.customTo = "";
    closeScreenPeriodModal();
    renderScreens();
    showToast("Ekranas vėl skaičiuojamas pagal kampanijos laikotarpį");
    return;
  }

  const from = formatIsoDateTyping($("#screenPeriodFrom").value).trim();
  const to = formatIsoDateTyping($("#screenPeriodTo").value).trim();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to) {
    showToast("Nurodykite abi datas (Nuo ir Iki)");
    return;
  }
  if (!isoDate.test(from) || !isoDate.test(to)) {
    showToast("Datos formatas: yyyy-mm-dd");
    return;
  }
  if (from > to) {
    showToast("„Nuo“ data negali būti vėlesnė už „Iki“");
    return;
  }
  if (campaignFrom && from < campaignFrom) {
    showToast("Data negali būti anksčiau už kampanijos pradžią");
    return;
  }
  if (campaignTo && to > campaignTo) {
    showToast("Data negali būti vėliau už kampanijos pabaigą");
    return;
  }

  const isDefault =
    (!campaignFrom || from === campaignFrom) &&
    (!campaignTo || to === campaignTo);
  if (isDefault) {
    screen.customFrom = "";
    screen.customTo = "";
  } else {
    screen.customFrom = from;
    screen.customTo = to;
  }
  closeScreenPeriodModal();
  renderScreens();
  showToast(isDefault ? "Naudojamas kampanijos laikotarpis" : "Ekrano laikotarpis išsaugotas");
}

function shortenToastFileName(name) {
  const value = String(name || "").trim();
  if (value.length <= 28) return value;
  const dot = value.lastIndexOf(".");
  const ext = dot > 0 ? value.slice(dot) : "";
  const stem = dot > 0 ? value.slice(0, dot) : value;
  const dateTail = stem.match(/-\d{4}-\d{2}-\d{2}$/);
  const suffix = dateTail ? dateTail[0] : stem.slice(-10);
  return `${stem.slice(0, 7)}…${suffix}${ext}`;
}

function showToast(message, extra) {
  const toast = $("#toast");
  if (!toast) return;
  const options = extra && typeof extra === "object" ? extra : extra ? { detail: extra } : {};
  let title = String(message || "").trim();
  let detail = String(options.detail || "").trim();
  const fileMatch = title.match(/^(?:Paruoštas Excel(?: failas)?|ZIP paruoštas):\s*(.+)$/i);
  if (fileMatch) {
    title = /^ZIP/i.test(title) ? "ZIP paruoštas" : "Excel paruoštas";
    detail = shortenToastFileName(fileMatch[1]);
  }
  const warn =
    options.tone === "warn" ||
    /^(Nepavyko|Trūksta|Palikite|Pirmiausia|Įrašykite|Pasirinkite|Užpildykite|Nėra |Data |„Nuo“|Orderis nerastas|Kampanijos nuoroda|Nurodykite)/i.test(title);
  const titleEl = toast.querySelector(".toast-title");
  const detailEl = toast.querySelector(".toast-detail");
  if (titleEl) titleEl.textContent = title;
  if (detailEl) {
    detailEl.textContent = detail;
    detailEl.hidden = !detail;
  }
  toast.classList.toggle("is-warn", warn);
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function bindEvents() {
  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest("button");
    if (!target || target.disabled) return;
    target.classList.add("press-effect");
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.45;
    const ripple = document.createElement("span");
    ripple.className = "click-ripple";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  });
  ["#dateFrom", "#dateTo", "#orderQuickReminderDate", "#screenPeriodFrom", "#screenPeriodTo"].forEach((selector) => {
    $(selector)?.addEventListener("input", (event) => {
      const cursorAtEnd = event.target.selectionStart === event.target.value.length;
      event.target.value = formatIsoDateTyping(event.target.value);
      if (cursorAtEnd) event.target.setSelectionRange(event.target.value.length, event.target.value.length);
    });
  });
  ["#dateFrom", "#dateTo"].forEach((selector) => {
    $(selector).addEventListener("focus", openRangeCalendar);
  });
  document.querySelectorAll(".date-picker-trigger").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.dateTarget;
      if (targetId === "dateFrom" || targetId === "dateTo") {
        openRangeCalendar();
        return;
      }
      openNativeDatePickerForSource(targetId);
    });
  });
  document.querySelectorAll(".native-date-picker").forEach((picker) => {
    picker.addEventListener("change", () => {
      const source = $(`#${picker.dataset.dateSource}`);
      source.value = picker.value;
      source.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  ["#screenPeriodFrom", "#screenPeriodTo"].forEach((selector) => {
    const input = $(selector);
    if (!input) return;
    input.addEventListener("click", () => {
      openNativeDatePickerForSource(input.id);
    });
  });
  $("#rangeCalendar").addEventListener("click", (event) => {
    event.stopPropagation();
    const nav = event.target.closest("[data-range-nav]");
    if (nav) {
      rangeCalendarMonth.setMonth(rangeCalendarMonth.getMonth() + (nav.dataset.rangeNav === "next" ? 1 : -1));
      renderRangeCalendar();
      return;
    }
    const day = event.target.closest("[data-range-date]");
    if (!day) return;
    const iso = day.dataset.rangeDate;
    if (!rangeSelectingEnd) {
      $("#dateFrom").value = iso;
      $("#dateTo").value = iso;
      rangeSelectingEnd = true;
      renderRangeCalendar();
      return;
    }
    const start = $("#dateFrom").value;
    $("#dateFrom").value = iso < start ? iso : start;
    $("#dateTo").value = iso < start ? start : iso;
    $("#dateFrom").dispatchEvent(new Event("change", { bubbles: true }));
    $("#dateTo").dispatchEvent(new Event("change", { bubbles: true }));
    closeRangeCalendar();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".period-field")) closeRangeCalendar();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRangeCalendar();
  });
  document.querySelector(".topbar-nav")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view-target]");
    if (button) showView(button.dataset.viewTarget);
  });

  $(".monitor-summary").addEventListener("click", (event) => {
    const button = event.target.closest("[data-monitor-filter]");
    if (!button) return;
    monitorState.filter = button.dataset.monitorFilter;
    renderMonitoring();
  });
  $("#monitorGrid").addEventListener("click", (event) => {
    const card = event.target.closest("[data-monitor-id]");
    if (card) openMonitorDetail(card.dataset.monitorId);
  });
  $("#monitorRefreshButton").addEventListener("click", () => {
    renderMonitoring();
    showToast("Ekranų vaizdai atnaujinti");
  });
  $("#monitorModalClose").addEventListener("click", closeMonitorDetail);
  $("#monitorModalDone").addEventListener("click", closeMonitorDetail);
  $("#monitorModal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeMonitorDetail();
  });
  $("#monitorLiveButton").addEventListener("click", () => {
    monitorState.live = !monitorState.live;
    $("#monitorLiveButton").textContent = monitorState.live ? "Tiesioginis vaizdas įjungtas ✓" : "Žiūrėti gyvai";
    $("#monitorModalStage").classList.toggle("live", monitorState.live);
    showToast(monitorState.live ? "Įjungtas tiesioginis ekrano vaizdas" : "Tiesioginis vaizdas sustabdytas");
  });

  $("#orderQuickClose").addEventListener("click", closeQuickOrderModal);
  $("#orderQuickCancel").addEventListener("click", closeQuickOrderModal);
  $("#orderQuickModal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeQuickOrderModal();
  });
  $("#orderQuickManage").addEventListener("click", () => {
    closeQuickOrderModal();
    editActiveOrderPlan();
  });
  $("#orderQuickMediaCheck").addEventListener("click", openMediaCheckModal);
  [["#orderQuickMediaToggle", "media"], ["#orderQuickInvoiceToggle", "invoice"], ["#orderQuickSentToggle", "sent"]].forEach(([selector, field]) => {
    $(selector).addEventListener("click", () => {
      const order = activeOrder();
      if (!order) return;
      order[field] = !order[field];
      persistOrder(order);
      renderQuickOrderModal(order);
    });
  });
  $("#orderQuickSave").addEventListener("click", () => {
    const order = activeOrder();
    if (!order) return;
    const client = $("#orderQuickClientInput").value.trim();
    const from = $("#orderQuickFromInput").value;
    const to = $("#orderQuickToInput").value;
    if (!client || !from || !to) return showToast("Užpildykite pavadinimą ir transliacijų laikotarpį");
    order.client = client;
    order.status = $("#orderQuickStatusSelect").value;
    order.from = from;
    order.to = to;
    order.comment = $("#orderQuickComment").value.trim();
    persistOrder(order);
    renderOrders();
    closeQuickOrderModal();
    showToast("Orderio pakeitimai išsaugoti");
  });
  $("#orderQuickAttach").addEventListener("click", () => $("#orderQuickAttachmentInput").click());
  $("#orderQuickAttachmentInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const order = activeOrder();
    if (!file || !order) return;
    order.attachmentName = file.name;
    persistOrder(order);
    $("#orderQuickAttachmentText").textContent = file.name;
    event.target.value = "";
    showToast("Failas pridėtas prie orderio prototipo");
  });
  $("#orderQuickReminderAdd").addEventListener("click", () => {
    const order = activeOrder();
    const date = $("#orderQuickReminderDate").value;
    const text = $("#orderQuickReminderText").value.trim();
    if (!order || !date || !text) return showToast("Pasirinkite datą ir įrašykite priminimo žinutę");
    order.reminder = { date, text };
    persistOrder(order);
    showToast("Priminimas pridėtas");
  });
  async function exportActiveOrderExcel(partnerName = null) {
    const order = activeOrder();
    if (!order) return;
    const base = buildExcelPlanForOrder(order);
    const plan = partnerName ? filterExcelPlanByPartner(base, partnerName) : base;
    if (!plan.screens.some((screen) => screen.active)) {
      showToast("Nėra ekranų šiam eksportui");
      return;
    }
    const filename = partnerName
      ? await window.PikselExcel.exportPlan(plan, { suffix: partnerName })
      : await exportCombinedPlanExcel(plan);
    showToast(`Paruoštas Excel: ${filename}`);
  }

  $("#orderQuickPartnerExports").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-quick-partner]");
    if (!button) return;
    try {
      button.disabled = true;
      await exportActiveOrderExcel(button.dataset.quickPartner);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nepavyko eksportuoti partnerio Excel");
    } finally {
      button.disabled = false;
    }
  });
  $("#orderQuickReport").addEventListener("click", async () => {
    try {
      await exportActiveOrderExcel(null);
      showToast("Ataskaita: naudotas bendras planas");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nepavyko eksportuoti ataskaitos");
    }
  });
  $("#orderQuickZip").addEventListener("click", async () => {
    const order = activeOrder();
    if (!order) return;
    const button = $("#orderQuickZip");
    button.disabled = true;
    try {
      const base = buildExcelPlanForOrder(order);
      const partners = getOrderExportPartners(order);
      if (!partners.length) return showToast("Nėra partnerių ZIP eksportui");
      const entries = [];
      for (const partner of partners) {
        const plan = filterExcelPlanByPartner(base, partner.name);
        if (!plan.screens.some((screen) => screen.active)) continue;
        entries.push({
          plan,
          filename: window.PikselExcel.defaultPlanFilename(plan, partner.name),
        });
      }
      entries.push({
        plan: base,
        filename: window.PikselExcel.defaultPlanFilename(base, "Bendras"),
      });
      const date = new Date().toISOString().slice(0, 10);
      const zipName = `Piksel-${String(order.id).replace(/^U-/, "")}-U-${date}-Planai.zip`;
      await window.PikselExcel.exportPlansZip(entries, zipName);
      showToast(`ZIP paruoštas: ${zipName}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nepavyko paruošti ZIP");
    } finally {
      button.disabled = false;
    }
  });
  $("#orderQuickDelete").addEventListener("click", () => {
    const order = activeOrder();
    if (!order) return;
    if (!window.confirm(`Ištrinti test orderį U-${order.id}?`)) return;
    savedOrders = savedOrders.filter((item) => String(item.id) !== String(order.id));
    localStorage.setItem("pikselMockOrders", JSON.stringify(savedOrders));
    closeQuickOrderModal();
    renderOrders();
    showToast("Test orderis ištrintas");
  });
  $("#orderQuickExcel").addEventListener("click", async () => {
    try {
      await exportActiveOrderExcel(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nepavyko eksportuoti Excel failo");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!$("#screenDetailModal")?.hidden) closeScreenDetailModal();
    if (!$("#mediaCheckModal").hidden) closeMediaCheckModal();
    if (!$("#orderQuickModal").hidden) closeQuickOrderModal();
    if (!$("#monitorModal").hidden) closeMonitorDetail();
  });

  $("#playerDeviceSelect").addEventListener("change", (event) => {
    playerState.deviceId = Number(event.target.value);
    playerState.elapsed = 0;
    playerState.campaignIndex = 0;
    renderPlayer();
  });
  $("#playerDaySelect").addEventListener("change", (event) => {
    playerState.day = Number(event.target.value);
    playerState.elapsed = 0;
    playerState.campaignIndex = 0;
    renderPlayer();
  });
  $("#playerHourSelect").addEventListener("change", (event) => {
    playerState.hour = Number(event.target.value);
    playerState.elapsed = 0;
    playerState.campaignIndex = 0;
    renderPlayer();
  });
  $("#playerSyncButton").addEventListener("click", () => {
    $("#playerLastSync").textContent = "Ką tik";
    $("#playerCacheStatus").textContent = "100% paruošta";
    renderPlayer();
    showToast("Grotuvas sinchronizuotas");
  });
  $("#autoAllocateButton").addEventListener("click", allocateLowestOccupancy);
  $("#autoFillToggle").addEventListener("change", (event) => {
    if (!event.target.checked) playerState.allocatedHours = [];
    renderOccupancy();
  });
  $("#playerPlayButton").addEventListener("click", () => {
    playerState.playing = !playerState.playing;
    renderPlayer();
  });
  $("#playerFullscreenButton").addEventListener("click", () => {
    $(".player-stage-card").classList.toggle("fullscreen-sim");
  });

  $("#ordersSearch").addEventListener("input", renderOrders);

  document.querySelectorAll("[data-orders-filter]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter-value]");
      if (!button) return;
      const filterName = group.dataset.ordersFilter;
      ordersFilterState[filterName] = button.dataset.filterValue;
      group.querySelectorAll("[data-filter-value]").forEach((option) => option.classList.toggle("active", option === button));
      renderOrders();
    });
  });

  document.querySelectorAll("[data-month-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      const values = ["Visi", "06", "07", "08"];
      const currentIndex = values.indexOf(ordersFilterState.month);
      const nextIndex = Math.max(0, Math.min(values.length - 1, currentIndex + Number(button.dataset.monthShift)));
      ordersFilterState.month = values[nextIndex];
      document.querySelectorAll('[data-orders-filter="month"] [data-filter-value]').forEach((option) => option.classList.toggle("active", option.dataset.filterValue === ordersFilterState.month));
      renderOrders();
    });
  });

  $("#ordersAdditionalToggle").addEventListener("click", () => {
    const panel = $("#ordersAdvancedFilters");
    const isOpen = panel.hidden;
    panel.hidden = !isOpen;
    $("#ordersAdditionalToggle").classList.toggle("active", isOpen);
    $("#ordersAdditionalToggle").setAttribute("aria-expanded", String(isOpen));
  });

  ["#ordersAgencyFilter", "#ordersClientFilter"].forEach((selector) => $(selector).addEventListener("input", renderOrders));
  ["#ordersMediaFilter", "#ordersInvoiceFilter"].forEach((selector) => $(selector).addEventListener("change", renderOrders));
  $("#ordersCalendarButton").addEventListener("click", () => showToast("Kalendoriaus vaizdą prijungsime kitame etape"));

  $("#ordersExportButton").addEventListener("click", async () => {
    await ensureExcelLibs();
    const rows = allOrders().map((order) => [order.client, order.agency, String(order.id).replace("-b", ""), order.status, order.from, order.to, order.media == null ? "—" : order.media ? "Taip" : "Ne", order.price]);
    const sheet = window.XLSX.utils.aoa_to_sheet([["Klientas", "Agentūra", "Užsakymo Nr.", "Statusas", "Data nuo", "Data iki", "Media", "Kaina"], ...rows]);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, sheet, "Kampanijos");
    window.XLSX.writeFile(workbook, "Piksel-orderiai.xlsx");
    showToast("Orderių sąrašas eksportuotas į Excel");
  });

  $("#ordersTableBody").addEventListener("click", (event) => {
    const action = event.target.closest("[data-order-action]");
    const row = event.target.closest("[data-order-id]");
    if (!row) return;
    if (!action) return openQuickOrderModal(row.dataset.orderId);
    const order = allOrders().find((item) => String(item.id) === String(row.dataset.orderId));
    if (!order) return showToast("Orderis nerastas");
    if (!savedOrders.some((item) => String(item.id) === String(order.id))) persistOrder(order);
    if (action.dataset.orderAction === "invoice") order.invoice = !order.invoice;
    if (action.dataset.orderAction === "send") order.sent = !order.sent;
    localStorage.setItem("pikselMockOrders", JSON.stringify(savedOrders));
    renderOrders();
  });

  $("#campaignBackButton").addEventListener("click", () => showView("orders"));
  $("#campaignMediaCheckButton").addEventListener("click", openMediaCheckModal);
  $("#mediaCheckSummary").addEventListener("click", (event) => {
    if (event.target.closest("[data-open-media-check]")) openMediaCheckModal();
  });
  $("#mediaBrowseButton").addEventListener("click", () => $("#mediaFileInput").click());
  $("#mediaDropzone").addEventListener("click", () => $("#mediaFileInput").click());
  $("#mediaFileInput").addEventListener("change", async (event) => {
    await addMediaFiles(event.target.files);
    event.target.value = "";
  });
  $("#mediaDropzone").addEventListener("dragover", (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("dragging");
  });
  $("#mediaDropzone").addEventListener("dragleave", (event) => event.currentTarget.classList.remove("dragging"));
  $("#mediaDropzone").addEventListener("drop", async (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("dragging");
    await addMediaFiles(event.dataTransfer.files);
  });
  $("#mediaCheckClose").addEventListener("click", closeMediaCheckModal);
  $("#mediaCheckDone").addEventListener("click", closeMediaCheckModal);
  $("#mediaCheckModal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeMediaCheckModal();
  });
  $("#mediaCheckCopy").addEventListener("click", () => copyMediaCheckText(false));
  $("#missingMediaCopy").addEventListener("click", () => copyMediaCheckText(true));
  $("#mediaCheckDropzone").addEventListener("click", () => $("#mediaCheckFileInput").click());
  $("#mediaCheckFileInput").addEventListener("change", async (event) => {
    await addMediaFiles(event.target.files);
    event.target.value = "";
  });
  $("#mediaCheckDropzone").addEventListener("dragover", (event) => {
    event.preventDefault();
    event.currentTarget.classList.add("dragging");
  });
  $("#mediaCheckDropzone").addEventListener("dragleave", (event) => event.currentTarget.classList.remove("dragging"));
  $("#mediaCheckDropzone").addEventListener("drop", async (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove("dragging");
    await addMediaFiles(event.dataTransfer.files);
  });
  $("#mediaList").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-media]");
    if (!remove) return;
    const media = detailMedia();
    const removed = media.find((item) => item.id === remove.dataset.removeMedia);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    deleteMediaBlob(`${activeOrderId}:${remove.dataset.removeMedia}`);
    saveDetailMedia(media.filter((item) => item.id !== remove.dataset.removeMedia));
    renderOrderDetail();
  });
  $("#detailScreens").addEventListener("change", (event) => {
    const name = event.target.dataset.detailScreen;
    if (!name) return;
    const order = activeOrder();
    order.enabledScreens = event.target.checked
      ? [...new Set([...(order.enabledScreens || []), name])]
      : (order.enabledScreens || []).filter((screenName) => screenName !== name);
    persistOrder(order);
    renderOrderDetail();
  });
  $("#campaignSaveButton").addEventListener("click", async () => {
    const button = $("#campaignSaveButton");
    button.disabled = true;
    try {
      await saveCampaignInfo();
      showToast("Kampanijos pakeitimai išsaugoti");
    } catch (error) {
      renderOrderDetail();
      showToast(error instanceof Error ? error.message : "Nepavyko išsaugoti kampanijos");
    } finally {
      button.disabled = false;
    }
  });
  $("#campaignEditPlanButton").addEventListener("click", editActiveOrderPlan);
  $("#campaignPublicLinkCopy").addEventListener("click", async (event) => {
    const url = event.currentTarget.dataset.publicUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    showToast("Kliento nuoroda nukopijuota");
  });
  $("#campaignPublicLinkOpen").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const previewUrl = button.dataset.previewUrl;
    const publicUrl = button.dataset.publicUrl;
    const openUrl = button.dataset.goMock === "1" && previewUrl ? previewUrl : publicUrl;
    if (openUrl) window.open(openUrl, "_blank", "noopener");
  });
  $("#goShareLinkCopy")?.addEventListener("click", () => {
    void createGoMockFromCalculator({ openPreview: false, copy: true });
  });
  $("#goShareLinkInput")?.addEventListener("click", (event) => {
    event.currentTarget.select?.();
  });
  $("#campaignCopyCampaign")?.addEventListener("click", () => {
    void copyPublicCampaign();
  });
  $("#copyCampaignButton")?.addEventListener("click", () => {
    void copyPublicCampaign();
  });
  ["#campaignInfoFrom", "#campaignInfoTo", "#campaignInfoReminderDate"].forEach((selector) => $(selector).addEventListener("input", (event) => {
    event.target.value = formatIsoDateTyping(event.target.value);
  }));
  document.querySelectorAll("[data-campaign-tab]").forEach((button) => button.addEventListener("click", () => setCampaignTab(button.dataset.campaignTab)));
  ["#campaignExportPiksel", "#campaignExportCommon"].forEach((selector) => $(selector).addEventListener("click", async () => {
    const order = activeOrder();
    if (!order) return;
    try {
      const filename = await exportCombinedPlanExcel(buildExcelPlanForOrder(order));
      showToast(`Paruoštas Excel failas: ${filename}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nepavyko eksportuoti Excel failo");
    }
  }));
  $("#campaignPublishButton").addEventListener("click", handleCampaignPrimaryAction);
  $("#publishWideButton").addEventListener("click", publishActiveOrder);

  $("#cityFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-city]");
    if (!button) return;
    state.city = button.dataset.city;
    renderCityFilters();
    renderScreens();
  });

  $("#packageFilters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-package-city]");
    if (!button || publicCampaignState.locked) return;
    applyCityPackage(button.dataset.packageCity);
  });

  $("#packageUpsell")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-complete-package]");
    if (!button || publicCampaignState.locked) return;
    completeCityPackage(button.dataset.completePackage);
  });

  document.querySelectorAll("[data-calc-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (publicCampaignState.locked || publicCampaignState.active) return;
      setCalculatorMode(button.dataset.calcMode);
    });
  });

  $("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderScreens();
  });

  $("#screensTableBody").addEventListener("click", (event) => {
    const periodBtn = event.target.closest("[data-screen-period]");
    if (periodBtn) {
      event.preventDefault();
      event.stopPropagation();
      openScreenPeriodModal(periodBtn.dataset.screenPeriod);
      return;
    }
    const openTarget = event.target.closest("[data-open-screen]");
    if (!openTarget) return;
    if (event.target.closest("[data-screen-period]")) return;
    event.preventDefault();
    openScreenDetailModal(openTarget.dataset.openScreen);
  });
  $("#screensTableBody").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const openTarget = event.target.closest("[data-open-screen]");
    if (!openTarget || event.target.closest(".switch")) return;
    event.preventDefault();
    openScreenDetailModal(openTarget.dataset.openScreen);
  });
  $("#screenDetailClose")?.addEventListener("click", closeScreenDetailModal);
  document.addEventListener("click", (event) => {
    const modal = $("#screenDetailModal");
    if (!modal || modal.hidden) return;
    if (event.target.closest(".screen-detail-card")) return;
    if (event.target.closest("[data-open-screen]")) return;
    closeScreenDetailModal();
  });

  $("#screensTableBody").addEventListener("change", (event) => {
    if (publicCampaignState.locked) return;
    const id = Number(event.target.dataset.screenId);
    const screen = screens.find((item) => item.id === id);
    if (!screen) return;
    screen.selected = event.target.checked;
    if (!screen.selected) {
      screen.customFrom = "";
      screen.customTo = "";
    }
    const row = event.target.closest("tr");
    if (row) {
      row.classList.toggle("selected", screen.selected);
      row.classList.remove("just-changed");
      void row.offsetWidth;
      row.classList.add("just-changed");
      window.setTimeout(() => row.classList.remove("just-changed"), 400);
    }
    renderScreens();
  });

  $("#perScreenDatesToggle")?.addEventListener("click", (event) => {
    event.preventDefault();
    if (publicCampaignState.locked) return;
    state.perScreenDatesMode = !state.perScreenDatesMode;
    if (!state.perScreenDatesMode) {
      clearAllScreenCustomDates();
      showToast("Ekranų custom datos išjungtos");
    } else {
      showToast("Pasirinktiems ekranams — kalendoriaus ikona");
    }
    renderScreens();
  });

  $("#screenPeriodClose")?.addEventListener("click", closeScreenPeriodModal);
  $("#screenPeriodCancel")?.addEventListener("click", closeScreenPeriodModal);
  $("#screenPeriodClear")?.addEventListener("click", () => saveScreenPeriodFromModal(true));
  $("#screenPeriodSave")?.addEventListener("click", () => saveScreenPeriodFromModal(false));
  $("#screenPeriodModal")?.addEventListener("click", (event) => {
    if (event.target.id === "screenPeriodModal") closeScreenPeriodModal();
  });

  $("#campaignWavesOpen")?.addEventListener("click", (event) => {
    event.preventDefault();
    openCampaignWavesModal();
  });
  $("#campaignWavesClose")?.addEventListener("click", closeCampaignWavesModal);
  $("#campaignWavesCancel")?.addEventListener("click", closeCampaignWavesModal);
  $("#campaignWavesClear")?.addEventListener("click", () => saveCampaignWavesFromModal(true));
  $("#campaignWavesSave")?.addEventListener("click", () => saveCampaignWavesFromModal(false));
  $("#campaignWavesAdd")?.addEventListener("click", () => {
    const draft = readCampaignWavesDraftFromDom();
    const envelopeFrom = String($("#dateFrom")?.value || "").trim();
    const envelopeTo = String($("#dateTo")?.value || "").trim();
    draft.push(createEmptyWave(envelopeFrom, envelopeTo));
    renderCampaignWavesDraft(draft);
  });
  $("#campaignWavesModal")?.addEventListener("click", (event) => {
    if (event.target.id === "campaignWavesModal") closeCampaignWavesModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const wavesModal = $("#campaignWavesModal");
    if (wavesModal && !wavesModal.hidden) {
      closeCampaignWavesModal();
      return;
    }
    const modal = $("#screenPeriodModal");
    if (modal && !modal.hidden) closeScreenPeriodModal();
  });

  const selectAllButton = $("#selectAllButton");
  if (selectAllButton) {
    selectAllButton.addEventListener("click", () => {
      if (publicCampaignState.locked) return;
      const visible = visibleScreens();
      if (!visible.length) return;
      const allSelected = visible.every((screen) => screen.selected);
      visible.forEach((screen) => {
        screen.selected = !allSelected;
        if (!screen.selected) {
          screen.customFrom = "";
          screen.customTo = "";
        }
      });
      renderScreens();
    });
  }

  let presetClickTimer = null;
  $("#presetButtons").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset]");
    if (!button || publicCampaignState.locked) return;
    const preset = button.dataset.preset;
    if (preset === "medi" || preset === "min") {
      if (presetClickTimer) window.clearTimeout(presetClickTimer);
      presetClickTimer = window.setTimeout(() => {
        presetClickTimer = null;
        const phaseKey = preset === "medi" ? "mediPhase" : "minPhase";
        const keepPhase = state.preset === preset ? state[phaseKey] : 0;
        applyPreset(preset, { phase: keepPhase });
      }, 280);
      return;
    }
    if (presetClickTimer) {
      window.clearTimeout(presetClickTimer);
      presetClickTimer = null;
    }
    applyPreset(preset);
  });
  $("#presetButtons").addEventListener("dblclick", (event) => {
    const button = event.target.closest('[data-preset="medi"], [data-preset="min"]');
    if (!button || publicCampaignState.locked) return;
    event.preventDefault();
    if (presetClickTimer) {
      window.clearTimeout(presetClickTimer);
      presetClickTimer = null;
    }
    toggleIntensityPhase(button.dataset.preset);
  });

  $("#scheduleGrid").addEventListener("click", (event) => {
    if (publicCampaignState.locked) return;

    const dayAxis = event.target.closest("[data-toggle-day]");
    if (dayAxis) {
      toggleDayColumn(Number(dayAxis.dataset.toggleDay));
      markGridCustom();
      renderGrid();
      renderScreens();
      return;
    }

    const hourAxis = event.target.closest("[data-toggle-hour]");
    if (hourAxis) {
      toggleHourRow(Number(hourAxis.dataset.toggleHour));
      markGridCustom();
      renderGrid();
      renderScreens();
      return;
    }

    const cell = event.target.closest("button[data-day][data-hour]");
    if (!cell) return;
    const day = Number(cell.dataset.day);
    const hour = Number(cell.dataset.hour);
    state.grid[day][hour] = !state.grid[day][hour];
    markGridCustom();
    renderGrid();
    renderScreens();
  });

  ["#clipDuration", "#dateFrom", "#dateTo"].forEach((selector) => {
    $(selector).addEventListener("change", () => {
      if (publicCampaignState.locked) return;
      if ($("#dateTo").value < $("#dateFrom").value) $("#dateTo").value = $("#dateFrom").value;
      renderScreens();
    });
  });

  $("#resetButton").addEventListener("click", () => {
    if (publicCampaignState.active) return;
    if (internalPlanEditState.orderId) {
      const orderId = internalPlanEditState.orderId;
      exitInternalPlanEditMode();
      activeOrderId = orderId;
      renderOrderDetail();
      showView("campaign");
    }
  });

  $("#createOrderButton").addEventListener("click", async () => {
    if (publicCampaignState.active) return updatePublicCampaign();
    if (internalPlanEditState.orderId) return saveInternalPlanChanges();
    const selectedCount = selectedModeScreens().length;
    if (!selectedCount) return showToast("Pirmiausia pasirinkite bent vieną ekraną");

    if (testOrderDraft.active) {
      setCreateOrderButtonBusy(true);
      try {
        const plan = buildExcelPlan();
        const hubId = getTestOrderIdFromUrl() || `test-${testOrderDraft.id || Date.now()}`;
        upsertHubTestOrderFromPlan(plan, {
          id: hubId,
          client: testOrderDraft.client,
          agency: testOrderDraft.agency,
        });
        testOrderDraft.active = false;
        testOrderDraft.client = "";
        testOrderDraft.agency = "";
        testOrderDraft.id = "";
        if (isOpenedFromHub()) {
          finishHubOpenedSave();
          return;
        }
        showToast("Test orderis išsaugotas (ne live)");
        window.location.href = `/test-orders?open=${encodeURIComponent(hubId)}`;
        return;
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Nepavyko išsaugoti test orderio");
      } finally {
        setCreateOrderButtonBusy(false);
      }
      return;
    }

    openCreateCampaignModal("finish");
  });
  $("#newTestOrderButton")?.addEventListener("click", () => openCreateCampaignModal("start"));
  $("#closeCampaignModal").addEventListener("click", closeCreateCampaignModal);
  $("#cancelCampaignCreate").addEventListener("click", closeCreateCampaignModal);
  $("#createCampaignModal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeCreateCampaignModal();
  });
  $("#buyerKindAgency")?.addEventListener("change", () => syncBuyerKindFields(""));
  $("#buyerKindClient")?.addEventListener("change", () => syncBuyerKindFields(""));
  $("#newCampaignAgencySelect")?.addEventListener("change", () => {
    $("#newCampaignAgency").value = $("#newCampaignAgencySelect").value;
  });
  $("#confirmCampaignCreate").addEventListener("click", async () => {
    const client = $("#newCampaignClient").value.trim();
    const agency = readCampaignBuyerValue();
    const id = $("#newCampaignNumber").value;
    if (!client) return showToast("Įrašykite pavadinimą");
    if (!agency) {
      return showToast(getSelectedBuyerKind() === "agency" ? "Pasirinkite agentūrą" : "Įrašykite klientą");
    }

    if (createModalMode === "start") {
      closeCreateCampaignModal();
      beginTestOrderDraft({ client, agency, id });
      return;
    }

    const button = $("#confirmCampaignCreate");
    button.disabled = true;
    button.textContent = "Saugoma…";
    try {
      const plan = buildExcelPlan();
      const hubId = `test-${String(id).replace(/^[A-Z]-/, "")}`;
      upsertHubTestOrderFromPlan(plan, { id: hubId, client, agency });
      // Taip pat į lokalų skaičiuoklės sąrašą (suderinamumas)
      const order = await saveCurrentOrder({ client, agency, id });
      closeCreateCampaignModal();
      showToast(order.publicUrl
        ? `U-${order.id} · mock: ${order.publicUrl}`
        : `Test orderis U-${order.id} išsaugotas`);
      window.location.href = `/test-orders?open=${encodeURIComponent(hubId)}`;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nepavyko išsaugoti test orderio");
    } finally {
      button.disabled = false;
      button.textContent = "Išsaugoti į test orderius";
    }
  });

  $("#exportButton").addEventListener("click", async () => {
    try {
      const filename = await exportCombinedPlanExcel(buildExcelPlan());
      showToast(`Paruoštas Excel failas: ${filename}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nepavyko eksportuoti Excel failo");
    }
  });
}

window.PikselCalculator = { buildExcelPlan, buildExcelPlanForExport };

async function initializeApplication() {
  const publicTokenAtBoot = getPublicCampaignTokenFromLocation();
  const earlyTestId = getTestOrderIdFromUrl();
  const earlyTestOrder =
    !publicTokenAtBoot && !getLiveOrderIdFromUrl()
      ? findHubTestOrder(earlyTestId)
      : null;
  applyHeadingActionsChrome();
  setDefaultDates();
  if (earlyTestOrder) {
    applyOrderSnapshotToCalculator(earlyTestOrder);
  }
  initializeClipDurationSelect();
  initializeViaductFrequencySelect();
  syncCalculatorModeUI();
  renderCityFilters();
  bindEvents();
  if (earlyTestOrder) {
    if (!showShareLinkForOrder(earlyTestOrder)) ensureShareLinkForCurrentPlan();
  } else if (!publicTokenAtBoot && !getLiveOrderIdFromUrl()) {
    applyPreset("medi");
    state.viaductGrid = fullGrid();
    ensureAllViaductsSelected();
    renderScreens();
  }
  showView("calculator");

  const skipRemoteCatalog = Boolean(
    getTestOrderIdFromUrl() || getLiveOrderIdFromUrl() || isOpenedFromHub()
  );
  const refreshCatalog = skipRemoteCatalog
    ? Promise.resolve()
    : Promise.allSettled([
        hydrateScreensFromSupabase(),
        hydrateScreensFromPikselSite(),
      ]).then(() => {
        renderCityFilters();
        renderScreens();
      });

  const embed = isEmbedPreview();
  if (embed) enterEmbedPreviewMode();

  if (publicTokenAtBoot) {
    try { await loadPublicCampaignFromUrl(publicTokenAtBoot); }
    catch (error) { showToast(error.message || "Nepavyko atidaryti plano"); }
    void refreshCatalog;
    return;
  }

  const liveOrderId = getLiveOrderIdFromUrl();
  if (liveOrderId) {
    liveOrderState.id = liveOrderId;
    try {
      const data = await playCampaignRequest(`/api/play-orders/${encodeURIComponent(liveOrderId)}`);
      if (data.order) applyOrderSnapshotToCalculator(data.order);
      if (data.record?.token) {
        setGoMockTokenForMode(goMockModeKey(), data.record.token);
        setGoShareLinkField(buildPublicCampaignUrl(data.record.token));
      }
      // Opening a plan must not write back to the order.
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Nepavyko atidaryti užsakymo plano");
    }
    showView("calculator");
    void refreshCatalog;
    return;
  }

  const hubTestId = getTestOrderIdFromUrl();
  if (hubTestId) {
    const existing = findHubTestOrder(hubTestId);
    if (existing) {
      if (!embed) {
        void resumeHubTestOrder(existing);
      } else {
        applyOrderSnapshotToCalculator(existing);
        enterEmbedPreviewMode();
      }
      void refreshCatalog;
      return;
    }
    if (!embed) {
      beginTestOrderDraft({
        client: "Naujas testas",
        agency: "—",
        id: hubTestId.replace(/^test-/, ""),
      });
    }
    showView("calculator");
    if (embed) enterEmbedPreviewMode();
    void refreshCatalog;
    return;
  }

  if (embed) {
    showView("calculator");
    void refreshCatalog;
    return;
  }

  try {
    if (await loadPublicCampaignFromUrl()) {
      void refreshCatalog;
      return;
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Nepavyko atidaryti kampanijos");
    if (getPublicCampaignTokenFromLocation()) {
      showView("calculator");
      void refreshCatalog;
      return;
    }
  }

  const initialOrderMatch = location.hash.match(/^#order-(.+)$/);
  if (initialOrderMatch && allOrders().some((order) => order.id === initialOrderMatch[1])) {
    activeOrderId = initialOrderMatch[1];
    renderOrderDetail();
    showView("campaign");
  } else {
    showView("calculator");

  }
  window.setTimeout(syncExistingPublishedOrders, 600);
  void refreshCatalog;
}

initializeApplication();

window.setInterval(() => {
  renderPlayerClock();
  if ($("#playerView").hidden || !playerState.playing) return;
  const campaigns = playerCampaigns();
  if (campaigns.length && playerState.campaignIndex >= campaigns.length) playerState.campaignIndex = 0;
  const current = campaigns.length ? campaigns[playerState.campaignIndex] : null;
  const media = current ? playerMediaForOrder(current.id) : [];
  const mediaIndex = current ? (playerState.mediaIndexByOrder[current.id] || 0) : 0;
  const currentMedia = media.length ? media[mediaIndex % media.length] : null;
  const duration = currentMedia?.duration || current?.clipDuration || 10;
  playerState.elapsed += 1;
  if (playerState.elapsed >= duration) {
    playerState.elapsed = 0;
    if (current) {
      const playKey = playerMediaKey(current, currentMedia);
      playerState.playCountByMedia[playKey] = (playerState.playCountByMedia[playKey] || 0) + 1;
      localStorage.setItem("pikselPlayerPlayCounts", JSON.stringify(playerState.playCountByMedia));
    }
    if (current && media.length > 1) playerState.mediaIndexByOrder[current.id] = (mediaIndex + 1) % media.length;
    if (campaigns.length > 1) playerState.campaignIndex = (playerState.campaignIndex + 1) % campaigns.length;
    renderPlayer();
    return;
  }
  $("#playerElapsed").textContent = `00:${String(playerState.elapsed).padStart(2, "0")}`;
  $("#stageProgress").style.width = `${(playerState.elapsed / duration) * 100}%`;
}, 1000);
