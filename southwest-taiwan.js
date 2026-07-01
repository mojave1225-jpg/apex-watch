const WEATHER_TARGETS = [
  { name: '台北', lat: 25.033, lon: 121.5654 },
  { name: '高雄', lat: 22.6273, lon: 120.3014 },
  { name: '那覇', lat: 26.2124, lon: 127.6792 },
];

const MAP_POINTS = [
  { name: 'Taiwan Strait Core', lat: 24.0, lon: 120.8, color: '#ff8f7f' },
  { name: 'Nansei Islands', lat: 26.5, lon: 127.8, color: '#6bf7c3' },
  { name: 'East China Sea Watch', lat: 28.8, lon: 124.5, color: '#6bf7c3' },
  { name: 'Pacific Support Route', lat: 24.8, lon: 135.0, color: '#6bf7c3' },
];

let globalMapInstance;
let latestWeather = [];
let latestQuakes = [];

const LEAFLET_CSS_CDNS = [
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
];

const LEAFLET_JS_CDNS = [
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

const TILE_PROVIDERS = [
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
];

function injectStylesheet(url) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.crossOrigin = '';
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Stylesheet load failed: ${url}`));
    document.head.appendChild(link);
  });
}

function injectScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.crossOrigin = '';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load failed: ${url}`));
    document.head.appendChild(script);
  });
}

async function ensureLeafletLoaded() {
  if (typeof window.L !== 'undefined') return true;

  for (const cssUrl of LEAFLET_CSS_CDNS) {
    try {
      await injectStylesheet(cssUrl);
      break;
    } catch (error) {
      console.warn(error.message);
    }
  }

  for (const jsUrl of LEAFLET_JS_CDNS) {
    try {
      await injectScript(jsUrl);
      if (typeof window.L !== 'undefined') return true;
    } catch (error) {
      console.warn(error.message);
    }
  }

  return typeof window.L !== 'undefined';
}

function addBestTileLayer(map) {
  let layer;
  for (const provider of TILE_PROVIDERS) {
    try {
      layer = L.tileLayer(provider.url, provider.options).addTo(map);
      return layer;
    } catch (error) {
      console.warn(`Tile provider setup failed: ${provider.url}`, error);
    }
  }
  return null;
}

function updateClock() {
  const now = new Date().toLocaleString('ja-JP');
  const el = document.getElementById('updateInfo');
  if (el) el.textContent = now;
}

function setStatus(text, tone = 'info') {
  const el = document.getElementById('liveStatus');
  if (!el) return;
  el.textContent = text;
  const tones = {
    ok: '#7fffb2',
    warn: '#ffb020',
    info: '#5cc6ff',
  };
  el.style.color = tones[tone] || tones.info;
}

function deriveRegionalMetrics() {
  const quakeCount = latestQuakes.length;
  const avgWind = latestWeather.length
    ? latestWeather.reduce((sum, item) => sum + Number(item.wind || 0), 0) / latestWeather.length
    : 0;

  const adiz = Math.max(18, 18 + (quakeCount * 3) + Math.round(avgWind * 0.25));
  const midline = Math.max(6, Math.round(adiz * 0.28));
  const ships = Math.max(4, 4 + Math.round(quakeCount * 0.6));
  const score = Math.max(35, Math.min(88, Math.round((adiz * 0.35) + (midline * 1.1) + (ships * 2.3))));

  return {
    adiz,
    midline,
    ships,
    score,
  };
}

function renderRegionalMetrics() {
  const metrics = deriveRegionalMetrics();

  const tensionScore = document.getElementById('tensionScore');
  if (tensionScore) tensionScore.textContent = String(metrics.score);

  const tensionFill = document.getElementById('tensionBarFill');
  if (tensionFill) tensionFill.style.width = `${metrics.score}%`;

  const metricMidline = document.getElementById('metric-midline');
  if (metricMidline) metricMidline.textContent = `${metrics.midline} 回`;

  const metricAdiz = document.getElementById('metric-adiz');
  if (metricAdiz) metricAdiz.textContent = `${metrics.adiz} 機`;

  const metricShips = document.getElementById('metric-ships');
  if (metricShips) metricShips.textContent = `${metrics.ships} 隻`;
}

async function initGlobalMap() {
  if (globalMapInstance) return;
  const mapEl = document.getElementById('globalMap');
  if (!mapEl) return;

  const leafletReady = await ensureLeafletLoaded();
  if (!leafletReady || typeof window.L === 'undefined') {
    mapEl.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#7f8fb1;font-size:12px;">地図ライブラリの読み込みに失敗しました。</div>';
    return;
  }

  const map = L.map(mapEl, {
    zoomControl: true,
    minZoom: 2,
    maxZoom: 10,
    worldCopyJump: true,
    attributionControl: true,
  }).setView([22.8, 123.5], 4);

  addBestTileLayer(map);

  L.rectangle([
    [18, 118],
    [32, 132],
  ], {
    color: '#5cc6ff',
    weight: 1.5,
    fillColor: '#5cc6ff',
    fillOpacity: 0.09,
    dashArray: '6 4',
  }).addTo(map).bindTooltip('Primary Monitoring Box', { sticky: true });

  MAP_POINTS.forEach((point) => {
    const marker = L.circleMarker([point.lat, point.lon], {
      radius: point.name.includes('Core') ? 8 : 6,
      color: point.color,
      weight: 2,
      fillColor: point.color,
      fillOpacity: 0.75,
    }).addTo(map);
    marker.bindTooltip(point.name, { direction: 'top', opacity: 0.9 });
  });

  const route = L.polyline([
    [35.7, 139.7],
    [26.2, 127.7],
    [24.0, 120.8],
    [22.6, 120.3],
  ], {
    color: '#ffd166',
    weight: 2,
    opacity: 0.85,
    dashArray: '5 7',
  }).addTo(map);
  route.bindTooltip('Nansei - Taiwan route watch');

  globalMapInstance = map;
  setTimeout(() => map.invalidateSize(), 50);
  window.addEventListener('resize', () => {
    if (globalMapInstance) {
      globalMapInstance.invalidateSize();
    }
  });
}

function renderWeather(items) {
  const wrap = document.getElementById('weatherList');
  if (!wrap) return;
  wrap.innerHTML = items.map((item) => `
    <div class="weather-item">
      <div class="weather-city">${item.name}</div>
      <div class="weather-temp">${item.temp}°C</div>
      <div class="weather-sub">風 ${item.wind} km/h · 湿度 ${item.humidity}%</div>
      <div class="weather-sub">降水 ${item.precip} mm</div>
    </div>
  `).join('');
}

function renderQuakes(items) {
  const wrap = document.getElementById('quakeList');
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = '<div class="muted">直近24時間の地震データは見つかりませんでした。</div>';
    return;
  }
  wrap.innerHTML = items.map((item) => `
    <div class="quake-item">
      <div class="quake-meta">${item.time} · M${item.mag}</div>
      <div class="quake-place">${item.place}</div>
    </div>
  `).join('');
}

function renderWeatherError(message) {
  const wrap = document.getElementById('weatherList');
  if (!wrap) return;
  wrap.innerHTML = `<div class="muted">${message}</div>`;
}

function renderQuakeError(message) {
  const wrap = document.getElementById('quakeList');
  if (!wrap) return;
  wrap.innerHTML = `<div class="muted">${message}</div>`;
}

const WEATHER_ENDPOINTS = [
  (target) => `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&current_weather=true&hourly=relativehumidity_2m,precipitation&timezone=Asia%2FTaipei&temperature_unit=celsius&windspeed_unit=kmh&precipitation_unit=mm`,
  (target) => `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&current_weather=true&hourly=relativehumidity_2m,precipitation&timezone=auto&temperature_unit=celsius&windspeed_unit=kmh&precipitation_unit=mm`,
];

const MND_PLA_LIST_PROXY = 'https://r.jina.ai/http://www.mnd.gov.tw/news/plaactlist';

function fetchWithTimeout(url, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

function buildProxyUrl(url) {
  return `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;
}

function parseProxyJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('proxy response invalid');
  return JSON.parse(text.slice(start, end + 1));
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url, 20000);
  if (!response.ok) throw new Error(`fetch failed (${response.status})`);
  return await response.text();
}

function parsePlaCountsFromText(text) {
  const adizMatch = text.match(/偵獲共機\s*(\d+)\s*架次/);
  const midlineMatch = text.match(/逾越中線[^\d]*(\d+)\s*架次/);
  const shipMatch = text.match(/共艦\s*(\d+)\s*艘/);

  if (!adizMatch || !shipMatch) return null;

  return {
    adiz: Number(adizMatch[1]),
    midline: midlineMatch ? Number(midlineMatch[1]) : null,
    ships: Number(shipMatch[1]),
  };
}

function calcLevel(entry) {
  const score = (entry.adiz * 0.6) + ((entry.midline || 0) * 2.2) + (entry.ships * 1.4);
  if (score >= 45) return { key: 'high', label: '高' };
  if (score >= 24) return { key: 'mid', label: '中' };
  return { key: 'low', label: '低' };
}

function renderTaiwanDailyActivity(entries) {
  if (!entries.length) return;

  const latest = entries[0];
  const dailyAdiz = document.getElementById('daily-adiz');
  if (dailyAdiz) dailyAdiz.textContent = `${latest.adiz} 機`;

  const dailyMidline = document.getElementById('daily-midline');
  if (dailyMidline) dailyMidline.textContent = `${latest.midline ?? '--'} 機`;

  const dailyShips = document.getElementById('daily-ships');
  if (dailyShips) dailyShips.textContent = `${latest.ships} 隻`;

  const body = document.getElementById('daily-activity-body');
  if (body) {
    body.innerHTML = entries.slice(0, 5).map((entry) => {
      const level = calcLevel(entry);
      return `<tr><td>${entry.date}</td><td>${entry.adiz}</td><td>${entry.midline ?? '--'}</td><td>${entry.ships}</td><td>${entry.note}</td><td><span class="badge ${level.key}">${level.label}</span></td></tr>`;
    }).join('');
  }

  const trendWrap = document.getElementById('daily-trend-bars');
  if (trendWrap) {
    const trend = entries.slice(0, 7).reverse();
    const maxAdiz = Math.max(...trend.map((item) => item.adiz), 1);
    trendWrap.innerHTML = trend.map((item) => {
      const h = Math.max(6, Math.round((item.adiz / maxAdiz) * 70));
      const dateLabel = item.date.includes('.') ? item.date.split('.').slice(1).join('/') : item.date;
      return `
        <div class="trend-col">
          <div class="trend-val">${item.adiz}</div>
          <div class="trend-bar" style="height:${h}px"></div>
          <div class="trend-date">${dateLabel}</div>
        </div>
      `;
    }).join('');
  }

  const source = document.querySelector('#s-daily .source-note');
  if (source) {
    source.dataset.lastFetch = new Date().toLocaleString('ja-JP');
    if (!source.dataset.baseText) {
      source.dataset.baseText = source.textContent;
    }
    source.innerHTML = `${source.dataset.baseText}<br>最終取得: ${source.dataset.lastFetch}（台湾国防部 区域動態）`;
  }
}

async function fetchTaiwanModDailyActivity() {
  const listText = await fetchText(MND_PLA_LIST_PROXY);
  const linkRegex = /\[(\d{3}\.\d{2}\.\d{2})[^\]]*?\]\(https?:\/\/www\.mnd\.gov\.tw\/news\/plaact\/(\d+)\)/g;

  const found = [];
  const seen = new Set();
  let match;
  while ((match = linkRegex.exec(listText)) !== null && found.length < 7) {
    const date = match[1];
    const id = match[2];
    if (seen.has(id)) continue;
    seen.add(id);
    found.push({ date, id });
  }

  if (!found.length) throw new Error('No PLA activity entries found');

  const details = [];
  for (const entry of found) {
    try {
      const detailUrl = `https://r.jina.ai/http://www.mnd.gov.tw/news/plaact/${entry.id}`;
      const detailText = await fetchText(detailUrl);
      const counts = parsePlaCountsFromText(detailText);
      if (!counts) continue;
      details.push({
        date: entry.date,
        adiz: counts.adiz,
        midline: counts.midline,
        ships: counts.ships,
        note: '中共解放軍臺海周邊海、空域動態',
      });
    } catch (error) {
      console.warn('Failed to parse MND detail entry:', entry.id, error);
    }
  }

  if (!details.length) throw new Error('No parseable PLA daily activity detail found');
  renderTaiwanDailyActivity(details);
  return true;
}

async function fetchJsonWithFallback(url) {
  try {
    const response = await fetchWithTimeout(url, 15000);
    if (!response.ok) throw new Error(`fetch failed (${response.status})`);
    return await response.json();
  } catch (primaryError) {
    console.warn(`Direct fetch failed for ${url}:`, primaryError);
    if (url.includes('api.open-meteo.com') || url.includes('earthquake.usgs.gov')) {
      const proxyUrl = buildProxyUrl(url);
      try {
        const proxyResponse = await fetchWithTimeout(proxyUrl, 20000);
        if (!proxyResponse.ok) throw new Error(`proxy fetch failed (${proxyResponse.status})`);
        const text = await proxyResponse.text();
        return parseProxyJson(text);
      } catch (proxyError) {
        console.warn(`Proxy fetch failed for ${url}:`, proxyError);
        throw proxyError;
      }
    }
    throw primaryError;
  }
}

async function fetchWeatherTarget(target) {
  for (const endpoint of WEATHER_ENDPOINTS) {
    const url = endpoint(target);
    try {
      const data = await fetchJsonWithFallback(url);
      const current = data.current_weather || {};
      const hourly = data.hourly || {};
      const currentIndex = hourly.time?.indexOf(current.time ?? '') ?? -1;
      const humidity = currentIndex >= 0 ? hourly.relativehumidity_2m?.[currentIndex] : hourly.relativehumidity_2m?.[0] ?? null;
      const precip = currentIndex >= 0 ? hourly.precipitation?.[currentIndex] : hourly.precipitation?.[0] ?? null;
      return {
        name: target.name,
        temp: Number(current.temperature ?? 0).toFixed(1),
        humidity: humidity != null ? Number(humidity).toFixed(0) : '--',
        wind: Number(current.windspeed ?? 0).toFixed(0),
        precip: precip != null ? Number(precip).toFixed(1) : '--',
      };
    } catch (error) {
      console.warn(`Weather fetch failed for ${target.name} at ${url}:`, error);
    }
  }
  throw new Error(`All weather endpoints failed for ${target.name}`);
}

async function fetchWeather() {
  const weatherItems = await Promise.all(WEATHER_TARGETS.map(async (target) => {
    try {
      return await fetchWeatherTarget(target);
    } catch (error) {
      console.warn('Weather fetch failed for target:', target.name, error);
      return {
        name: target.name,
        temp: '--',
        humidity: '--',
        wind: '--',
        precip: '--',
        error: true,
      };
    }
  }));

  const anySuccess = weatherItems.some((item) => !item.error);
  latestWeather = weatherItems.filter((item) => !item.error);
  renderWeather(weatherItems.map((item) => ({
    name: item.name,
    temp: item.temp,
    humidity: item.humidity,
    wind: item.wind,
    precip: item.precip,
  })));

  if (!anySuccess) {
    renderWeatherError('気象データの取得に失敗しました。ネットワークまたはAPIアクセスを確認してください。');
    return false;
  }

  return true;
}

async function fetchQuakes() {
  try {
    const data = await fetchJsonWithFallback('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
    const items = (data.features || [])
      .filter((feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        return lon >= 118 && lon <= 132 && lat >= 18 && lat <= 32;
      })
      .slice(0, 5)
      .map((feature) => {
        const props = feature.properties || {};
        const [lon, lat] = feature.geometry.coordinates;
        return {
          mag: Number(props.mag || 0).toFixed(1),
          place: props.place || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
          time: new Date(props.time).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        };
      });
    latestQuakes = items;
    renderQuakes(items);
    return true;
  } catch (error) {
    console.warn('Quake fetch failed:', error);
    latestQuakes = [];
    renderQuakeError('地震データの取得に失敗しました。');
    return false;
  }
}


function updateLastUpdated() {
  const wrap = document.getElementById('updateInfo');
  if (!wrap) return;
  wrap.innerHTML = `<div class="weather-sub">最終更新: ${new Date().toLocaleString('ja-JP')}</div>`;
}

async function refreshLiveData() {
  setStatus('ライブ観測データを更新中...', 'info');
  const [weatherResult, quakeResult, taiwanResult] = await Promise.allSettled([
    fetchWeather(),
    fetchQuakes(),
    fetchTaiwanModDailyActivity(),
  ]);
  updateLastUpdated();

  const weatherOk = weatherResult.status === 'fulfilled' && weatherResult.value === true;
  const quakeOk = quakeResult.status === 'fulfilled' && quakeResult.value === true;
  const taiwanOk = taiwanResult.status === 'fulfilled' && taiwanResult.value === true;

  renderRegionalMetrics();

  if (weatherOk && quakeOk && taiwanOk) {
    setStatus('ライブ観測を更新済み', 'ok');
  } else if (!weatherOk && !quakeOk && !taiwanOk) {
    setStatus('主要データの取得に失敗しました', 'warn');
  } else if (!taiwanOk) {
    setStatus('台湾国防部の日次データ取得に失敗しました', 'warn');
  } else if (!weatherOk && !quakeOk) {
    setStatus('気象・地震データの取得に失敗しました', 'warn');
  } else if (!weatherOk) {
    setStatus('気象データの取得に失敗しました', 'warn');
  } else {
    setStatus('地震データの取得に失敗しました', 'warn');
  }
}

async function initSpecialPage() {
  await initGlobalMap();
  updateClock();
  setInterval(updateClock, 1000);
  await refreshLiveData();
  setInterval(refreshLiveData, 180000); // 3分ごとに更新
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpecialPage);
} else {
  initSpecialPage();
}
