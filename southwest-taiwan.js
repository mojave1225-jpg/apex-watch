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

function renderSpaceWeather(data) {
  const wrap = document.getElementById('spaceWeather');
  if (!wrap) return;
  if (!data) {
    wrap.innerHTML = '<div class="muted">宇宙天気データの取得に失敗しました。次回更新まで待機します。</div>';
    return;
  }
  const summary = typeof data === 'string' ? data : JSON.stringify(data).slice(0, 220);
  wrap.innerHTML = `
    <div class="space-weather-summary">${summary}</div>
  `;
}

async function fetchWeather() {
  const weatherItems = await Promise.all(WEATHER_TARGETS.map(async (target) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&timezone=Asia%2FTaipei`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('weather fetch failed');
      const data = await res.json();
      const current = data.current || {};
      return {
        name: target.name,
        temp: Number(current.temperature_2m ?? 0).toFixed(1),
        humidity: current.relative_humidity_2m ?? 0,
        wind: Number(current.wind_speed_10m ?? 0).toFixed(0),
        precip: Number(current.precipitation ?? 0).toFixed(1),
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
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', { signal: AbortSignal.timeout(8000) });
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

async function fetchSpaceWeather() {
  try {
    const res = await fetch('https://services.swpc.noaa.gov/json/solar-geophysical-summary.json', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('space weather fetch failed');
    const data = await res.json();
    const latest = Array.isArray(data) ? data[0] : null;
    if (!latest) throw new Error('no space weather data');
    const summary = [
      `更新: ${latest.updated || latest.time || '不明'}`,
      `Kp: ${latest.kp_index ?? latest.kp ?? '不明'}`,
      `Solar Wind: ${latest.solar_wind_speed ?? latest.solar_wind ?? '不明'}`,
      `X-Ray: ${latest.xray ?? latest.x_ray ?? '不明'}`,
    ].join(' · ');
    renderSpaceWeather(summary);
  } catch (error) {
    console.warn('Space weather fetch failed:', error);
    renderSpaceWeather('宇宙天気データは一時的に取得できませんでした。');
  }
}

async function initSpecialPage() {
  updateClock();
  setInterval(updateClock, 1000);
  setStatus('データ取得中...', 'info');
  await Promise.allSettled([fetchWeather(), fetchQuakes(), fetchSpaceWeather()]);
  setStatus('ライブ観測を更新済み', 'ok');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpecialPage);
} else {
  initSpecialPage();
}
