(() => {
  const DEPARTURE = new Date("2026-10-23T00:00:00+08:00");
  const TRIP_END = new Date("2026-10-27T23:59:59+08:00");
  const TRIP_DATES = ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"];
  const NEWS_FALLBACK = [
    { title: "NHK NEWS WEB（沖縄）", link: "https://www3.nhk.or.jp/lnews/okinawa/", source: "NHK" },
    { title: "琉球新報デジタル", link: "https://ryukyushimpo.jp/", source: "琉球新報" },
    { title: "沖縄タイムス＋プラス", link: "https://www.okinawatimes.co.jp/", source: "沖縄タイムス" },
  ];
  const WMO = {
    0: "晴朗", 1: "大致晴朗", 2: "多雲", 3: "陰天", 45: "霧", 48: "霧凇",
    51: "毛毛雨", 53: "毛毛雨", 55: "毛毛雨", 61: "小雨", 63: "中雨", 65: "大雨",
    71: "小雪", 73: "中雪", 75: "大雪", 80: "陣雨", 81: "陣雨", 82: "強陣雨",
    95: "雷雨", 96: "雷雨夾雹", 99: "雷雨夾雹",
  };

  const el = (name) => document.querySelector('[data-pulse="' + name + '"]');
  const setText = (name, value) => {
    const node = el(name);
    if (node) node.textContent = value;
  };
  const siteBase = () =>
    location.pathname.includes("/okinawa-2026-trip") ? "/okinawa-2026-trip" : "";

  const formatDigital = (date, timeZone) =>
    new Intl.DateTimeFormat("zh-TW", {
      timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(date);

  const formatClockDate = (date, timeZone) =>
    new Intl.DateTimeFormat("zh-TW", {
      timeZone, month: "numeric", day: "numeric", weekday: "short",
    }).format(date);

  const getClockParts = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
    }).formatToParts(date);
    const read = (type) => Number((parts.find((part) => part.type === type) || {}).value || 0);
    return { hour: read("hour"), minute: read("minute"), second: read("second") };
  };

  const countdownLabel = (now) => {
    const start = DEPARTURE.getTime();
    const end = TRIP_END.getTime();
    const t = now.getTime();
    if (t >= start && t <= end) {
      const dayIndex = Math.floor((t - start) / 86400000) + 1;
      return { number: String(Math.min(dayIndex, 5)), unit: "DAY", headline: "行程中", detail: "10.23–10.27 · 那霸時區" };
    }
    if (t > end) return { number: "—", unit: "DONE", headline: "旅程已結束", detail: "下次見" };
    const days = Math.ceil((start - t) / 86400000);
    if (days <= 0) return { number: "0", unit: "DAY", headline: "出發日", detail: "今天起飛" };
    return { number: String(days), unit: "DAYS", headline: "出發倒數", detail: "目標 10.23 清晨" };
  };

  const rotateHand = (root, selector, deg) => {
    const hand = root && root.querySelector(selector);
    if (hand) hand.setAttribute("transform", "rotate(" + deg + " 60 60)");
  };

  const tickClocks = (now) => {
    document.querySelectorAll("[data-pulse-clock]").forEach((root) => {
      const zone = root.getAttribute("data-pulse-clock");
      const { hour, minute, second } = getClockParts(now, zone);
      rotateHand(root, ".pulse-analog-hour", ((hour % 12) + minute / 60) * 30);
      rotateHand(root, ".pulse-analog-minute", minute * 6 + second * 0.1);
      rotateHand(root, ".pulse-analog-second", second * 6);
    });
  };

  const tick = () => {
    const now = new Date();
    const count = countdownLabel(now);
    setText("countdown-number", count.number);
    setText("countdown-unit", count.unit);
    setText("countdown-headline", count.headline);
    setText("countdown-detail", count.detail);
    setText("clock-taipei", formatDigital(now, "Asia/Taipei"));
    setText("clock-taipei-date", formatClockDate(now, "Asia/Taipei"));
    setText("clock-tokyo", formatDigital(now, "Asia/Tokyo"));
    setText("clock-tokyo-date", formatClockDate(now, "Asia/Tokyo") + " · 日本快 1 小時");
    tickClocks(now);
  };

  tick();
  setInterval(tick, 1000);

  const weatherBody = el("weather-body");
  const fxBody = el("fx-body");
  const newsBody = el("news-body");
  const newsMode = el("news-mode");

  let weatherDays = [];
  let weatherView = "focus";
  let selectedDate = TRIP_DATES[0];

  const setWeatherToggleActive = () => {
    document.querySelectorAll("[data-pulse-weather-view]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-pulse-weather-view") === weatherView);
    });
  };

  const renderWeather = () => {
    if (!weatherBody || !weatherDays.length) return;
    const focus = weatherDays.find((day) => day.date === selectedDate) || weatherDays[0];
    selectedDate = focus.date;
    setWeatherToggleActive();

    if (weatherView === "range") {
      weatherBody.innerHTML =
        '<div class="pulse-weather-range" data-pulse-weather-mode="range">' +
        weatherDays
          .map((day) => {
            const active = day.date === selectedDate ? ' class="is-active"' : "";
            return (
              "<button type=\"button\" data-pulse-day=\"" + day.date + "\"" + active + ">" +
              "<small>D" + day.dayNum + " · " + day.label + "</small>" +
              "<strong>" + day.summary + "</strong>" +
              "<span>" + day.low + "° / " + day.high + "°</span>" +
              "<em>降雨 " + day.rain + "%</em>" +
              "</button>"
            );
          })
          .join("") +
        "</div>";
      weatherBody.querySelectorAll("[data-pulse-day]").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedDate = btn.getAttribute("data-pulse-day");
          weatherView = "focus";
          renderWeather();
        });
      });
      return;
    }

    weatherBody.innerHTML =
      '<div class="pulse-weather-focus" data-pulse-weather-mode="focus">' +
      '<div class="pulse-weather-focus-main">' +
      "<small>DAY " + focus.dayNum + " · " + focus.label + " " + focus.weekday + "</small>" +
      '<strong class="pulse-metric">' + focus.summary + "</strong>" +
      '<div class="pulse-weather-stats">' +
      "<span><b>" + focus.low + "°</b><em>低</em></span>" +
      "<span><b>" + focus.high + "°</b><em>高</em></span>" +
      "<span><b>" + focus.rain + "%</b><em>降雨</em></span>" +
      "</div></div>" +
      '<div class="pulse-day-pills" role="tablist" aria-label="選擇行程日">' +
      weatherDays
        .map((day) => {
          const active = day.date === focus.date ? ' class="is-active"' : "";
          return (
            "<button type=\"button\" role=\"tab\" data-pulse-day=\"" + day.date + "\"" + active +
            " aria-selected=\"" + (day.date === focus.date ? "true" : "false") + "\">" +
            "<b>" + day.label + "</b><span>" + day.weekday + "</span></button>"
          );
        })
        .join("") +
      "</div></div>";

    weatherBody.querySelectorAll("[data-pulse-day]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedDate = btn.getAttribute("data-pulse-day");
        renderWeather();
      });
    });
  };

  document.querySelectorAll("[data-pulse-weather-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      weatherView = btn.getAttribute("data-pulse-weather-view") || "focus";
      renderWeather();
    });
  });

  if (weatherBody) {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=26.2124&longitude=127.6809" +
        "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&timezone=Asia%2FTokyo&start_date=2026-10-23&end_date=2026-10-27",
    )
      .then((res) => {
        if (!res.ok) throw new Error("weather");
        return res.json();
      })
      .then((data) => {
        const dates = (data.daily && data.daily.time) || [];
        weatherDays = dates.map((date, index) => {
          const code = Number(data.daily.weathercode[index] || 0);
          const dt = new Date(date + "T12:00:00+09:00");
          return {
            date,
            label: new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric" }).format(dt),
            weekday: new Intl.DateTimeFormat("zh-TW", { weekday: "short" }).format(dt),
            dayNum: index + 1,
            summary: WMO[code] || "多雲",
            high: Math.round(Number(data.daily.temperature_2m_max[index])),
            low: Math.round(Number(data.daily.temperature_2m_min[index])),
            rain: Math.round(Number(data.daily.precipitation_probability_max[index] || 0)),
          };
        });
        if (!weatherDays.length) throw new Error("weather-empty");
        const todayKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());
        if (TRIP_DATES.includes(todayKey)) selectedDate = todayKey;
        renderWeather();
      })
      .catch(() => {
        weatherBody.innerHTML = '<p class="pulse-muted">暫時讀不到，稍後再試。</p>';
      });
  }

  const renderFx = (twdPerJpy) => {
    if (!fxBody) return;
    let amount = "10000";
    let fromCurrency = "JPY";

    const paint = () => {
      const numeric = Number(String(amount).replace(/,/g, ""));
      const ok = Number.isFinite(numeric);
      const value =
        fromCurrency === "JPY"
          ? ok ? numeric * twdPerJpy : null
          : ok ? numeric / twdPerJpy : null;
      const unit = fromCurrency === "JPY" ? "TWD" : "JPY";
      const rateLine =
        fromCurrency === "JPY"
          ? "100 円 ≈ " + (twdPerJpy * 100).toFixed(1) + " TWD"
          : "1 TWD ≈ " + (1 / twdPerJpy).toFixed(2) + " 円";
      const chips = fromCurrency === "JPY" ? ["1000", "5000", "10000", "30000"] : ["500", "1000", "3000", "5000"];

      fxBody.innerHTML =
        '<div class="pulse-fx-box">' +
        '<div class="pulse-fx-toggle" role="group" aria-label="換算方向">' +
        '<button type="button" data-fx-dir="JPY"' + (fromCurrency === "JPY" ? ' class="is-active"' : "") + ">円 → 台幣</button>" +
        '<button type="button" data-fx-dir="TWD"' + (fromCurrency === "TWD" ? ' class="is-active"' : "") + ">台幣 → 円</button>" +
        "</div>" +
        '<label class="pulse-fx-input"><span>' + (fromCurrency === "JPY" ? "日圓金額" : "台幣金額") + "</span>" +
        '<input inputmode="decimal" value="' + amount + '" aria-label="換算金額" /></label>' +
        '<div class="pulse-fx-chips">' +
        chips.map((chip) => '<button type="button" data-fx-chip="' + chip + '">' + chip + "</button>").join("") +
        "</div>" +
        '<div class="pulse-fx-result"><span>約等於</span><strong>' +
        (value == null
          ? "—"
          : value.toLocaleString("zh-TW", { maximumFractionDigits: 1 }) + " " + unit) +
        "</strong></div>" +
        '<small class="pulse-note">' + rateLine + " · 參考匯率，非銀行牌價</small>" +
        "</div>";

      const input = fxBody.querySelector("input");
      if (input) {
        input.addEventListener("input", () => {
          amount = input.value.replace(/[^\d.]/g, "");
          paint();
          const next = fxBody.querySelector("input");
          if (next) {
            next.focus();
            next.selectionStart = next.selectionEnd = next.value.length;
          }
        });
      }
      fxBody.querySelectorAll("[data-fx-dir]").forEach((btn) => {
        btn.addEventListener("click", () => {
          fromCurrency = btn.getAttribute("data-fx-dir");
          paint();
        });
      });
      fxBody.querySelectorAll("[data-fx-chip]").forEach((btn) => {
        btn.addEventListener("click", () => {
          amount = btn.getAttribute("data-fx-chip");
          paint();
        });
      });
    };

    paint();
  };

  if (fxBody) {
    fetch("https://open.er-api.com/v6/latest/JPY")
      .then((res) => {
        if (!res.ok) throw new Error("fx");
        return res.json();
      })
      .then((data) => {
        const twd = Number(data.rates && data.rates.TWD);
        if (!Number.isFinite(twd) || twd <= 0) throw new Error("fx-rate");
        renderFx(twd);
      })
      .catch(() => {
        fxBody.innerHTML = '<p class="pulse-muted">暫時讀不到，稍後再試。</p>';
      });
  }

  const scoreNewsItem = (item) => {
    let score = 0;
    if (/沖縄|那覇|沖縄県|沖繩/.test(item.title)) score += 5;
    if (item.source && /琉球|沖縄タイムス|NHK|ヤフー|Yahoo|共同|毎日|朝日|読売/.test(item.source)) score += 3;
    if (/prtimes|PR TIMES/i.test(item.link) || /prtimes/i.test(item.source || "")) score -= 4;
    if (/ローソン|スシロー|スイーツ|カップアイス/.test(item.title)) score -= 3;
    return score;
  };

  const pickNews = (items, limit) => {
    const seen = new Set();
    return items
      .slice()
      .sort((a, b) => scoreNewsItem(b) - scoreNewsItem(a))
      .filter((item) => {
        const key = item.title.slice(0, 24);
        if (seen.has(key)) return false;
        seen.add(key);
        return scoreNewsItem(item) >= 0 || items.length < 3;
      })
      .slice(0, limit || 4);
  };

  const renderNews = (items, mode) => {
    if (!newsBody) return;
    if (newsMode) {
      newsMode.textContent = mode === "live" ? "即時" : mode === "cached" ? "快取" : "來源";
    }
    newsBody.innerHTML =
      "<ul>" +
      items
        .map((item) => {
          const source = item.source ? "<small>" + item.source + "</small>" : "";
          return (
            "<li><a href=\"" +
            item.link +
            "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
            source +
            "<span>" +
            item.title +
            "</span></a></li>"
          );
        })
        .join("") +
      "</ul>";
  };

  const loadLiveNews = () =>
    fetch("https://freenewsapi.ai/v1/search?q=%E6%B2%96%E7%B8%84&lang=ja&sort=date&size=24")
      .then((res) => {
        if (!res.ok) throw new Error("live");
        return res.json();
      })
      .then((data) => {
        const items = pickNews(
          (data.results || [])
            .map((item) => ({
              title: String(item.title || "").trim(),
              link: String(item.url || "").trim(),
              source: String(item.sitename || item.host || "").trim() || undefined,
            }))
            .filter((item) => item.title && item.link),
          4,
        );
        if (!items.length) throw new Error("live-empty");
        return items;
      });

  const loadCachedNews = () =>
    fetch(siteBase() + "/pulse-news.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("cached");
        return res.json();
      })
      .then((data) => {
        const items = (data.items || []).filter((item) => item.title && item.link).slice(0, 4);
        if (!items.length) throw new Error("cached-empty");
        return items;
      });

  if (newsBody) {
    loadLiveNews()
      .then((items) => renderNews(items, "live"))
      .catch(() =>
        loadCachedNews()
          .then((items) => renderNews(items, "cached"))
          .catch(() => renderNews(NEWS_FALLBACK, "fallback")),
      );
  }
})();
