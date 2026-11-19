class ForecastChart {
  constructor(panel, formatReading) {
    this.panel = panel;
    this.formatReading = formatReading;
    this.canvas = panel.querySelector("canvas");
    this.context = this.canvas.getContext("2d");
    this.metric = panel.querySelector("select");
    this.range = panel.querySelector(".chart-hour");
    this.reading = panel.querySelector(".chart-reading");
    this.content = panel.querySelector(".chart-content");
    this.empty = panel.querySelector(".chart-empty");
    this.samples = [];
    this.series = [];
    this.index = 0;
    this.metric.addEventListener("change", () => this.refresh());
    this.range.addEventListener("input", () => this.select(this.range.valueAsNumber));
    this.canvas.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "touch") this.selectAt(event);
    });
    this.canvas.addEventListener("pointerdown", (event) => this.selectAt(event));
    new ResizeObserver(() => this.scheduleDraw()).observe(this.canvas);
    new MutationObserver(() => this.scheduleDraw()).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  setSamples(samples, period, series = []) {
    this.samples = samples;
    this.series = series;
    this.index = 0;
    this.plot = undefined;
    this.panel.querySelector(".chart-period").textContent = period;
    this.refresh();
  }

  get baseUnit() {
    const customUnit = this.metric.selectedOptions[0]?.dataset.unit;
    if (customUnit) return customUnit;
    if (this.metric.value === "temperature_2m") return "°C";
    if (this.metric.value === "wind_speed_10m") return "km/h";
    return "%";
  }

  get unit() {
    return readingUnit(this.baseUnit);
  }

  refresh() {
    this.values = this.series.length
      ? this.series.map((_, index) => this.samples.map((sample) => sample.cities[index]?.[this.metric.value]))
      : [this.samples.map((sample) => sample[this.metric.value])];
    this.values = this.values.map((values) => values.map((value) => convertReading(value, this.baseUnit)));
    const available = this.values.some((values) => values.some(Number.isFinite));
    this.empty.hidden = available;
    this.content.hidden = !available;
    if (!available) {
      this.plot = undefined;
      return;
    }
    this.range.max = this.samples.length - 1;
    this.select(this.index);
  }

  select(index) {
    if (!this.samples[index] || this.content.hidden) return;
    this.index = index;
    this.range.value = index;
    const { label } = this.samples[index];
    const metric = this.metric.selectedOptions[0].textContent;
    const unit = this.unit === "%" ? "%" : " " + this.unit;
    const values = this.series.length
      ? this.series.map((name, position) => {
        const time = this.samples[index].cities[position]?.localTime;
        return name + (time ? " às " + time : "") + ": " + this.formatReading(this.values[position][index], unit);
      }).join(" · ")
      : this.formatReading(this.values[0][index], unit);
    const reading = label + " · " + metric + ": " + values;
    this.reading.textContent = reading;
    this.range.setAttribute("aria-valuetext", reading);
    this.scheduleDraw();
  }

  selectAt(event) {
    if (!this.plot) return;
    const localX = event.clientX - this.canvas.getBoundingClientRect().left;
    const index = this.plot.x.reduce((nearest, x, i) =>
      Math.abs(x - localX) < Math.abs(this.plot.x[nearest] - localX) ? i : nearest, 0);
    if (index !== this.index) this.select(index);
  }

  scheduleDraw() {
    if (this.frame !== undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      this.draw();
    });
  }

  draw() {
    if (this.content.hidden || !this.values?.length || !this.context) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    const scale = window.devicePixelRatio || 1;
    const ctx = this.context;
    const pixelWidth = Math.round(width * scale);
    const pixelHeight = Math.round(height * scale);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    const style = getComputedStyle(this.panel);
    const accent = style.getPropertyValue("--accent").trim();
    const alternate = style.getPropertyValue("--compare-accent").trim();
    const muted = style.getPropertyValue("--muted").trim();
    const line = style.getPropertyValue("--line").trim();
    const left = 46;
    const right = width - 29;
    const top = 25;
    const bottom = height - 31;
    const numbers = this.values.flat().filter(Number.isFinite);
    const lowest = this.baseUnit === "°C" ? Math.min(...numbers) : 0;
    const highest = this.unit === "%" ? 100 : Math.max(...numbers);
    const span = Math.max(highest - lowest, 1);
    const order = 10 ** Math.floor(Math.log10(span / 4));
    const step = this.unit === "%" ? 25 : ([1, 2, 2.5, 5, 10].find((n) => n * order >= span / 4) ?? 10) * order;
    const min = Math.floor(lowest / step) * step;
    const max = Math.max(min + step, Math.ceil(highest / step) * step);
    const y = (value) => bottom - (value - min) * (bottom - top) / (max - min);
    const start = this.samples[0].timestamp;
    const duration = this.samples.at(-1).timestamp - start;
    const x = this.samples.map(({ timestamp }) =>
      duration ? left + (timestamp - start) * (right - left) / duration : (left + right) / 2);
    this.plot = { x };

    ctx.font = "12px Manrope, system-ui, sans-serif";
    ctx.fillStyle = muted;
    ctx.textAlign = "left";
    ctx.fillText(this.unit, 5, 12);
    for (let i = 0; i <= Math.round((max - min) / step); i++) {
      const value = min + i * step;
      const position = y(value);
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.moveTo(left, position);
      ctx.lineTo(right, position);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(this.formatReading(value, ""), left - 5, position + 4);
    }
    const labelCount = Math.min(x.length, Math.max(2, Math.floor((right - left) / 56) + 1));
    ctx.textAlign = "center";
    for (let i = 0; i < labelCount; i++) {
      const index = labelCount === 1 ? 0 : Math.round(i * (x.length - 1) / (labelCount - 1));
      ctx.fillText(this.samples[index].time, x[index], bottom + 21);
    }

    this.values.forEach((values, index) =>
      this.drawSeries(ctx, values, x, y, index === 0 ? accent : alternate, index));
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x[this.index], top);
    ctx.lineTo(x[this.index], bottom);
    ctx.stroke();
  }

  drawSeries(ctx, values, x, y, color, seriesIndex) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(seriesIndex > 0 ? [6, 4] : []);
    let previous = -1;
    let previousTime;
    ctx.beginPath();
    for (const [index, value] of values.entries()) {
      if (!Number.isFinite(value)) {
        if (!this.series.length || this.samples[index].cities[seriesIndex]) previous = -1;
        continue;
      }
      const time = this.series.length ? this.samples[index].cities[seriesIndex].timestamp : this.samples[index].timestamp;
      const pointY = y(value);
      if (previous < 0 || time - previousTime !== 3600) {
        ctx.moveTo(x[index], pointY);
      } else if (this.metric.value === "temperature_2m") {
        const middle = (x[previous] + x[index]) / 2;
        ctx.bezierCurveTo(middle, y(values[previous]), middle, pointY, x[index], pointY);
      } else {
        ctx.lineTo(x[index], pointY);
      }
      previous = index;
      previousTime = time;
    }
    ctx.stroke();
    for (const [index, value] of values.entries()) {
      if (!Number.isFinite(value)) continue;
      ctx.beginPath();
      ctx.arc(x[index], y(value), index === this.index ? 5 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
