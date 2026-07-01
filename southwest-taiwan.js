const WEATHER_TARGETS = [
  { name: '台北', lat: 25.033, lon: 121.5654 },
  { name: '高雄', lat: 22.6273, lon: 120.3014 },
  { name: '那覇', lat: 26.2124, lon: 127.6792 },
];

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

function fetchWithTimeout(url, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

async function fetchWeather() {
  const weatherItems = await Promise.all(WEATHER_TARGETS.map(async (target) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&current_weather=true&hourly=relativehumidity_2m,precipitation&timezone=Asia%2FTaipei`;
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) throw new Error('weather fetch failed');
      const data = await res.json();
      const current = data.current_weather || {};
      const hourly = data.hourly || {};
      const currentIndex = hourly.time?.indexOf(current.time ?? '') ?? -1;
      const humidity = currentIndex >= 0 ? hourly.relativehumidity_2m?.[currentIndex] : null;
      const precip = currentIndex >= 0 ? hourly.precipitation?.[currentIndex] : null;
      return {
        name: target.name,
        temp: Number(current.temperature ?? 0).toFixed(1),
        humidity: humidity != null ? Number(humidity).toFixed(0) : '--',
        wind: Number(current.windspeed ?? 0).toFixed(0),
        precip: precip != null ? Number(precip).toFixed(1) : '--',
      };
    } catch (error) {
      console.warn('Weather fetch failed:', error);
      return {
        name: target.name,
        temp: '--',
        humidity: '--',
        wind: '--',
        precip: '--',
      };
    }
  }));
  renderWeather(weatherItems);
}

async function fetchQuakes() {
  try {
    const res = await fetchWithTimeout('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', 8000);
    if (!res.ok) throw new Error('quake fetch failed');
    const data = await res.json();
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
  } catch (error) {
    console.warn('Quake fetch failed:', error);
    renderQuakes([]);
  }
}


function updateLastUpdated() {
  const wrap = document.getElementById('updateInfo');
  if (!wrap) return;
  wrap.innerHTML = `<div class="weather-sub">最終更新: ${new Date().toLocaleString('ja-JP')}</div>`;
}

async function refreshLiveData() {
  setStatus('ライブ観測データを更新中...', 'info');
  await Promise.allSettled([fetchWeather(), fetchQuakes()]);
  updateLastUpdated();
  setStatus('ライブ観測を更新済み', 'ok');
}

async function initSpecialPage() {
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
