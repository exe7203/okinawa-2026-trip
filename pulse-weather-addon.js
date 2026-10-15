/* OKINAWA 2026 — 氣象、海況與颱風資訊擴充（保留日期選擇與 Windy） */
(() => {
  "use strict";

  const TRIP_DATES = [
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
    "2026-10-26",
    "2026-10-27",
  ];

  const NAHA = { lat: 26.2124, lon: 127.6809 };
  const OFFSHORE = { lat: 26.23, lon: 127.57 };
  const UPDATE_MS = 30 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 12000;
  const JMA_BASE = "https://www.jma.go.jp/bosai/typhoon/data";

  const card = document.querySelector(".pulse-weather-module");
  const original = card?.querySelector('[data-pulse="weather-body"]');
  if (!card || !original || card.querySelector(".pulse-weather-addon")) return;

  const label = card.querySelector(".pulse-module-title");
  if (label) label.textContent = "沖繩氣象資訊";

  const subtitle = card.querySelector(".pulse-weather-sub");
  if (subtitle) {
    subtitle.textContent = "10/23–10/27 · 那霸陸地與西側外海預報";
  }

  const root = document.createElement("section");
  root.className = "pulse-weather-addon";
  root.setAttribute("aria-label", "海象資訊及日本氣象廳資料");
  root.innerHTML = `
    <p class="pwa-range-note">點選上方某一天，即可查看該日海況與風速。</p>
    <div class="pwa-fallback" hidden aria-label="選擇行程日期"></div>
    <div class="pwa-topline">
      <strong class="pwa-title">SEA &amp; WIND · 海況與風速</strong>
      <small class="pwa-meta" data-pwa="date">10/23 · 日本時間</small>
    </div>
    <div class="pwa-grid">
      <div class="pwa-metric">
        <span class="pwa-label">最大陣風</span>
        <strong class="pwa-value" data-pwa="gust">--<small>km/h</small></strong>
      </div>
      <div class="pwa-metric">
        <span class="pwa-label">附近外海最大浪高</span>
        <strong class="pwa-value" data-pwa="wave">--<small>m</small></strong>
      </div>
      <div class="pwa-metric">
        <span class="pwa-label">最大浪週期</span>
        <strong class="pwa-value" data-pwa="period">--<small>秒</small></strong>
      </div>
    </div>
    <div class="pwa-typhoon" data-pwa="typhoon" hidden></div>
    <details class="pwa-details">
      <summary>更多海象與颱風資料</summary>
      <div class="pwa-extra">
        <div class="pwa-extra-grid">
          <div class="pwa-extra-line"><span>陸地最大風速</span><b data-pwa="wind">--</b></div>
          <div class="pwa-extra-line"><span>陸地主要風向</span><b data-pwa="winddir">--</b></div>
          <div class="pwa-extra-line"><span>外海主要浪向</span><b data-pwa="wavedir">--</b></div>
          <div class="pwa-extra-line"><span>海面溫度（日均估計）</span><b data-pwa="sst">--</b></div>
          <div class="pwa-extra-line"><span>預計累積降水量</span><b data-pwa="rain">--</b></div>
          <div class="pwa-extra-line"><span>陸地最高／最低溫</span><b data-pwa="temp">--</b></div>
        </div>
        <p class="pwa-jma-status" data-pwa="jma">日本氣象廳資料讀取中…</p>
        <nav class="pwa-linkrow">
          <a href="https://www.jma.go.jp/bosai/map.html#contents=typhoon" target="_blank" rel="noopener noreferrer">JMA 颱風路徑 ↗</a>
          <a href="https://www.jma.go.jp/bosai/map.html#contents=warning" target="_blank" rel="noopener noreferrer">JMA 警報・注意報 ↗</a>
          <a href="https://www.data.jma.go.jp/okinawa/home/link/joho_link.html" target="_blank" rel="noopener noreferrer">沖繩海象・潮汐 ↗</a>
        </nav>
      </div>
    </details>
    <p class="pwa-foot" data-pwa="source">來源：Open-Meteo 氣象／海洋模式預報、JMA 官方颱風資訊。海況為鄰近外海模式格點，非港口實測。</p>
  `;

  original.insertAdjacentElement("afterend", root);

  const $ = (key) => root.querySelector(`[data-pwa="${key}"]`);

  const isoJP = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const hmJP = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const nowJP = () => isoJP.format(new Date());

  const safeNum = (n) => {
    if (n === null || n === undefined || n === "" || !Number.isFinite(Number(n))) return null;
    return Number(n);
  };

  const fmt = (n, digit = 0) => {
    const x = safeNum(n);
    return x === null ? "--" : x.toFixed(digit);
  };

  const get = (daily, field, date) => {
    const i = daily?.time?.indexOf(date) ?? -1;
    return i < 0 ? null : (daily?.[field]?.[i] ?? null);
  };

  const dir = (n) => {
    const x = safeNum(n);
    if (x === null) return "--";
    const dirs = ["北", "東北", "東", "東南", "南", "西南", "西", "西北"];
    const index = Math.round((((x % 360) + 360) % 360) / 45) % 8;
    return dirs[index] + "（" + Math.round(x) + "°）";
  };

  const put = (key, txt) => {
    const node = $(key);
    if (node) node.textContent = txt;
  };

  const putVal = (key, n, unit, digits) => {
    const node = $(key);
    if (!node) return;
    const small = document.createElement("small");
    small.textContent = unit;
    node.replaceChildren(document.createTextNode(fmt(n, digits)), small);
  };

  function request(url) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { signal: ctrl.signal, cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw Error("HTTP " + res.status);
        return res.json();
      })
      .finally(() => clearTimeout(id));
  }

  const makeURL = (base, params) => base + "?" + new URLSearchParams(params).toString();

  const weatherURL = makeURL("https://api.open-meteo.com/v1/forecast", {
    latitude: String(NAHA.lat),
    longitude: String(NAHA.lon),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "wind_direction_10m_dominant",
    ].join(","),
    timezone: "Asia/Tokyo",
    wind_speed_unit: "kmh",
    forecast_days: "16",
  });

  const marineURL = makeURL("https://marine-api.open-meteo.com/v1/marine", {
    latitude: String(OFFSHORE.lat),
    longitude: String(OFFSHORE.lon),
    daily: ["wave_height_max", "wave_period_max", "wave_direction_dominant"].join(","),
    hourly: "sea_surface_temperature",
    timezone: "Asia/Tokyo",
    cell_selection: "sea",
    forecast_days: "16",
  });

  let selected = TRIP_DATES.includes(nowJP()) ? nowJP() : TRIP_DATES[0];
  let air = null;
  let ocean = null;
  let airErr = "";
  let oceanErr = "";

  function dailySeaTemp(date) {
    const hours = ocean?.hourly;
    if (!Array.isArray(hours?.time) || !Array.isArray(hours?.sea_surface_temperature)) return null;
    const vals = hours.time.flatMap((time, i) =>
      time.slice(0, 10) === date && safeNum(hours.sea_surface_temperature[i]) !== null
        ? [Number(hours.sea_surface_temperature[i])]
        : [],
    );
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  function render() {
    const hasRange = !!original.querySelector(".pulse-weather-range");
    root.classList.toggle("is-five-day", hasRange);

    const note = root.querySelector(".pwa-range-note");
    if (note) {
      note.textContent = hasRange
        ? "五日總覽中；切回「當日」後可看該日海況與風速。"
        : "點選上方某一天，即可查看該日海況與風速。";
    }

    if (hasRange) return;

    const dateLabel = selected.slice(5).replace("-", "/");
    put("date", dateLabel + " · 日本時間");

    putVal("gust", get(air?.daily, "wind_gusts_10m_max", selected), "km/h", 0);
    putVal("wave", get(ocean?.daily, "wave_height_max", selected), "m", 1);
    putVal("period", get(ocean?.daily, "wave_period_max", selected), "秒", 1);

    const weatherAvailable = air?.daily?.time?.includes(selected);
    const marineAvailable = ocean?.daily?.time?.includes(selected);

    put(
      "wind",
      fmt(get(air?.daily, "wind_speed_10m_max", selected)) + (weatherAvailable ? " km/h" : ""),
    );
    put("winddir", dir(get(air?.daily, "wind_direction_10m_dominant", selected)));
    put("wavedir", dir(get(ocean?.daily, "wave_direction_dominant", selected)));

    const seaTemp = dailySeaTemp(selected);
    put("sst", fmt(seaTemp, 1) + (seaTemp !== null ? " °C" : ""));
    put(
      "rain",
      fmt(get(air?.daily, "precipitation_sum", selected), 1) + (weatherAvailable ? " mm" : ""),
    );

    const hi = get(air?.daily, "temperature_2m_max", selected);
    const lo = get(air?.daily, "temperature_2m_min", selected);
    put(
      "temp",
      hi === null && lo === null ? "--" : fmt(hi, 0) + " / " + fmt(lo, 0) + " °C",
    );

    let dataNote = "";
    if (airErr || oceanErr) {
      dataNote = "部分資料無法讀取；";
    } else if (!weatherAvailable && !marineAvailable) {
      dataNote = selected < nowJP() ? "日期已過，預報不再提供；" : "尚未進入預報範圍；";
    } else if (!weatherAvailable || !marineAvailable) {
      dataNote = "部分欄位尚無資料；";
    }

    put(
      "source",
      dataNote +
        "來源：Open-Meteo 模式預報（陸地那霸／那霸西側外海）、JMA 官方資訊。海況非實測值，不適合航行決策。",
    );

    const fallback = root.querySelector(".pwa-fallback");
    const hasOriginalDates = !!original.querySelector("[data-pulse-day]");
    fallback.hidden = hasOriginalDates;

    if (!hasOriginalDates) {
      fallback.replaceChildren(
        ...TRIP_DATES.map((date) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = date.slice(5).replace("-", "/");
          b.setAttribute("aria-pressed", String(date === selected));
          b.addEventListener("click", () => {
            selected = date;
            render();
          });
          return b;
        }),
      );
    }
  }

  function syncFromOriginal() {
    const active =
      original.querySelector(".pulse-day-pills [data-pulse-day].is-active") ||
      original.querySelector(".pulse-weather-range [data-pulse-day].is-active");
    const fromUI = active?.getAttribute("data-pulse-day");
    if (TRIP_DATES.includes(fromUI)) selected = fromUI;
    render();
  }

  const observer = new MutationObserver(() => syncFromOriginal());
  observer.observe(original, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "aria-selected"],
  });

  syncFromOriginal();

  async function updateWeather() {
    const [w, m] = await Promise.allSettled([request(weatherURL), request(marineURL)]);
    if (w.status === "fulfilled") {
      air = w.value;
      airErr = "";
    } else {
      air = null;
      airErr = "氣象 API 連線失敗";
    }
    if (m.status === "fulfilled") {
      ocean = m.value;
      oceanErr = "";
    } else {
      ocean = null;
      oceanErr = "海洋 API 連線失敗";
    }
    render();
  }

  function distanceKm(aLat, aLon, bLat, bLon) {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const v =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(v)));
  }

  const valText = (v) => (typeof v === "string" ? v : String(v ?? ""));

  function renderStorms(storms) {
    const wrap = $("typhoon");
    wrap.replaceChildren();

    if (!storms.length) {
      wrap.hidden = true;
      put(
        "jma",
        "JMA 目前沒有發布中的熱帶氣旋資料（查詢：" +
          hmJP.format(new Date()) +
          "，不等於未來不會生成）。",
      );
      return;
    }

    put(
      "jma",
      "日本氣象廳：目前有 " +
        storms.length +
        " 組發布中的氣旋資訊；以下為中心位置至那霸的直線距離，不代表暴風圈大小。",
    );

    wrap.hidden = false;
    const header = document.createElement("strong");
    header.textContent = "JMA · 颱風／熱帶氣旋動態";
    wrap.append(header);

    for (const storm of storms) {
      const line = document.createElement("span");
      const near = Number.isFinite(storm.distance)
        ? `距那霸約 ${Math.round(storm.distance)} km`
        : "位置未提供";
      const pressure =
        storm.pressure !== null ? ` · 中心 ${fmt(storm.pressure)} hPa` : "";
      const movement = storm.course ? ` · 移動 ${storm.course}` : "";
      const asof = storm.asof ? ` · ${storm.asof}` : "";
      line.textContent = `${storm.name}｜${near}` + pressure + movement + asof;
      wrap.append(line);
    }
  }

  async function updateTyphoon() {
    try {
      const targets = await request(`${JMA_BASE}/targetTc.json`);
      if (!Array.isArray(targets)) throw Error("JMA changed the data schema");

      const results = await Promise.allSettled(
        targets.slice(0, 8).map(async (tc) => {
          const code = String(tc?.tropicalCyclone || "");
          if (!/^[A-Za-z0-9_-]{1,30}$/.test(code)) return null;

          const spec = await request(`${JMA_BASE}/${code}/specifications.json`);
          if (!Array.isArray(spec)) return null;

          const title = spec.find((p) => p?.part === "title") || {};
          const analysis =
            spec.find((p) => p?.part?.jp === "実況" || p?.part?.en === "Analysis") ||
            spec.find((p) => p?.advancedHours === 0);

          const xy = analysis?.position?.deg;
          const lat = safeNum(xy?.[0]);
          const lon = safeNum(xy?.[1]);
          const number = valText(tc.typhoonNumber || title.typhoonNumber);
          const engName = valText(title?.name?.en || tc?.name?.en || "").trim();
          const numString =
            number.length > 2 ? `第${Number(number.slice(-2))}號` : "熱帶低壓";

          return {
            name: engName ? `${numString} ${engName}` : numString,
            distance:
              lat !== null && lon !== null
                ? distanceKm(lat, lon, NAHA.lat, NAHA.lon)
                : null,
            pressure: safeNum(analysis?.pressure),
            course: valText(analysis?.course),
            asof: analysis?.validtime?.JST
              ? hmJP.format(new Date(analysis.validtime.JST)) + " JST"
              : "",
          };
        }),
      );

      const storms = results
        .filter((x) => x.status === "fulfilled" && x.value)
        .map((x) => x.value)
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

      if (targets.length && !storms.length) throw Error("No detailed cyclone response");
      renderStorms(storms);
    } catch {
      $("typhoon").hidden = true;
      put(
        "jma",
        "JMA 即時 JSON 無法從此網站讀取，颱風狀態未確認；請使用下方官方連結。",
      );
    }
  }

  updateWeather();
  updateTyphoon();
  setInterval(() => {
    updateWeather();
    updateTyphoon();
  }, UPDATE_MS);
})();
