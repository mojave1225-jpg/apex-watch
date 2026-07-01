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

function updateClock() {
  const now = new Date();
  const utc = now.toUTCString().replace('GMT', 'UTC').split(' ').slice(4).join(' ');
  const el = document.getElementById('clock');
  if (el) el.textContent = utc;
}

function setStatus(text, tone = 'info') {
  const el = document.getElementById('liveStatus');
  if (!el) return;
  el.textContent = text;
  el.className = `status-pill status-${tone}`;
}

function initGlobalMap() {
  if (globalMapInstance) return;
  const mapEl = document.getElementById('globalMap');
  if (!mapEl || typeof window.L === 'undefined') return;

  const map = L.map(mapEl, {
    zoomControl: true,
    minZoom: 2,
    maxZoom: 9,
    worldCopyJump: true,
    attributionControl: true,
  }).setView([22, 122], 3);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(map);

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
  setTimeout(() => map.invalidateSize(), 0);
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
    renderQuakes(items);
    return true;
  } catch (error) {
    console.warn('Quake fetch failed:', error);
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
  const [weatherResult, quakeResult] = await Promise.allSettled([fetchWeather(), fetchQuakes()]);
  updateLastUpdated();

  const weatherOk = weatherResult.status === 'fulfilled' && weatherResult.value === true;
  const quakeOk = quakeResult.status === 'fulfilled' && quakeResult.value === true;

  if (weatherOk && quakeOk) {
    setStatus('ライブ観測を更新済み', 'ok');
  } else if (!weatherOk && !quakeOk) {
    setStatus('気象・地震データの取得に失敗しました', 'warn');
  } else if (!weatherOk) {
    setStatus('気象データの取得に失敗しました', 'warn');
  } else {
    setStatus('地震データの取得に失敗しました', 'warn');
  }
}

async function initSpecialPage() {
  initGlobalMap();
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
