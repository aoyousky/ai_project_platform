/* 遨游苍穹 · 首页 / 工作台原型交互 */
(() => {
  const state = {
    option: "a",
    page: "home",
    theme: "dark",
    crole: "admin",
  };

  const PAGE_TITLES = {
    "a-home": "运营驾驶舱",
    "a-workbench": "工作台",
    "b-home": "协同工作台",
    "b-workbench": "工作台",
    "c-home": "系统门户",
    "c-workbench": "我的工作台",
  };

  function syncViews() {
    document.querySelectorAll(".view").forEach((view) => {
      view.hidden = !(
        view.dataset.option === state.option &&
        view.dataset.page === state.page
      );
    });
    document.querySelectorAll("#option-switch button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.option === state.option);
    });
    document.querySelectorAll("#page-switch button, .tab").forEach((btn) => {
      const page = btn.dataset.page || btn.dataset.tabPage;
      btn.classList.toggle("active", page === state.page);
    });
    document.querySelectorAll(".nav-item[data-nav]").forEach((item) => {
      item.classList.toggle("active", item.dataset.nav === state.page);
    });
    const key = `${state.option}-${state.page}`;
    const title = PAGE_TITLES[key] || "";
    const breadcrumb = document.getElementById("breadcrumb-title");
    if (breadcrumb) breadcrumb.textContent = title;
  }

  function setOption(option) {
    state.option = option;
    document.body.dataset.option = option;
    syncViews();
  }

  function setPage(page) {
    state.page = page;
    document.body.dataset.page = page;
    syncViews();
  }

  function setTheme(theme) {
    state.theme = theme;
    document.body.dataset.theme = theme;
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const label = btn.querySelector("span");
    const use = btn.querySelector("use");
    if (label) label.textContent = theme === "dark" ? "切换浅色" : "切换深色";
    if (use) use.setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
  }

  function setRole(role) {
    state.crole = role;
    document.body.dataset.crole = role;
    document.querySelectorAll("#c-role-switch button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.crole === role);
    });
  }

  function bindControls() {
    document.querySelectorAll("#option-switch button").forEach((btn) => {
      btn.addEventListener("click", () => setOption(btn.dataset.option));
    });
    document.querySelectorAll("#page-switch button, .tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = btn.dataset.page || btn.dataset.tabPage;
        if (page) setPage(page);
      });
    });
    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", () =>
        setTheme(state.theme === "dark" ? "light" : "dark"),
      );
    }
    document.querySelectorAll("#c-role-switch button").forEach((btn) => {
      btn.addEventListener("click", () => setRole(btn.dataset.crole));
    });
    document.querySelectorAll(".nav-item[data-nav]").forEach((item) => {
      item.addEventListener("click", () => setPage(item.dataset.nav));
    });
    const editBtn = document.getElementById("edit-layout");
    const grid = document.getElementById("c-workbench");
    if (editBtn && grid) {
      editBtn.addEventListener("click", () => {
        const editing = grid.classList.toggle("editing");
        const label = editBtn.querySelector("span");
        if (label) label.textContent = editing ? "完成" : "编辑布局";
      });
    }
  }

  function renderLoginChart() {
    const container = document.getElementById("login-chart");
    if (!container) return;

    const data = [
      { d: "11-01", v: 142 },
      { d: "11-02", v: 168 },
      { d: "11-03", v: 153 },
      { d: "11-04", v: 201 },
      { d: "11-05", v: 187 },
      { d: "11-06", v: 226 },
      { d: "11-07", v: 213 },
    ];
    const W = 760;
    const H = 240;
    const pad = { l: 44, r: 26, t: 18, b: 38 };
    const maxY = 240;
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    const step = plotW / (data.length - 1);
    const x = (i) => pad.l + step * i;
    const y = (v) => pad.t + (1 - v / maxY) * plotH;

    const points = data.map((d, i) => ({ x: x(i), y: y(d.v), ...d }));
    const area = [
      `M${pad.l},${H - pad.b}`,
      ...points.map((p) => `L${p.x},${p.y}`),
      `L${x(data.length - 1)},${H - pad.b}`,
      "Z",
    ].join(" ");
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const ticks = [0, 60, 120, 180, 240];

    const svg = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="近 7 日登录趋势">
        ${ticks
          .map(
            (v) =>
              `<line x1="${pad.l}" y1="${y(v)}" x2="${W - pad.r}" y2="${y(v)}" style="stroke:var(--chart-grid);stroke-width:1"/>` +
              `<text x="${pad.l - 10}" y="${y(v) + 4}" text-anchor="end" font-size="11" style="fill:var(--chart-axis);font-variant-numeric:tabular-nums">${v}</text>`,
          )
          .join("")}
        <path d="${area}" style="fill:var(--series-1);opacity:.1"/>
        <path d="${line}" style="fill:none;stroke:var(--series-1);stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>
        ${points
          .map(
            (p) =>
              `<circle cx="${p.x}" cy="${p.y}" r="4" style="fill:var(--series-1);stroke:var(--surface);stroke-width:2"/>`,
          )
          .join("")}
        <text x="${points.at(-1).x - 10}" y="${points.at(-1).y - 12}" text-anchor="end" font-size="12" font-weight="600" style="fill:var(--text-1)">213</text>
        ${data
          .map(
            (d, i) =>
              `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" style="fill:var(--chart-axis)">${d.d}</text>`,
          )
          .join("")}
        <line id="login-cross" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}" style="stroke:var(--chart-axis);opacity:0"/>
        ${data
          .map(
            (_, i) =>
              `<rect class="hit" data-i="${i}" x="${x(i) - step / 2}" y="${pad.t}" width="${step}" height="${plotH}" fill="rgba(0,0,0,0)" pointer-events="all"/>`,
          )
          .join("")}
      </svg>
      <div class="chart-tooltip" id="login-tip">
        <div class="chart-tooltip-label"></div>
        <div class="chart-tooltip-value"></div>
      </div>
    `;

    container.innerHTML = svg;
    const tip = container.querySelector("#login-tip");
    const cross = container.querySelector("#login-cross");

    const showTip = (index) => {
      const p = points[index];
      if (!p || !tip) return;
      const label = tip.querySelector(".chart-tooltip-label");
      const value = tip.querySelector(".chart-tooltip-value");
      if (label) label.textContent = p.d;
      if (value) value.innerHTML = `${p.v}<span>次</span>`;
      tip.style.left = `${(p.x / W) * 100}%`;
      tip.style.top = `${(p.y / H) * 100}%`;
      tip.classList.add("show");
      if (cross) {
        cross.setAttribute("x1", String(p.x));
        cross.setAttribute("x2", String(p.x));
        cross.style.opacity = "1";
      }
    };

    const hideTip = () => {
      tip?.classList.remove("show");
      if (cross) cross.style.opacity = "0";
    };

    container.querySelectorAll(".hit").forEach((hit) => {
      hit.addEventListener("mouseenter", () => showTip(Number(hit.dataset.i)));
    });
    container.addEventListener("mouseleave", hideTip);
  }

  bindControls();
  setTheme(state.theme);
  setRole(state.crole);
  renderLoginChart();
  syncViews();
})();
