/* =========================================================================
   CHARTS MODULE
   Smart Fan Speed Controller
   -------------------------------------------------------------------------
   Initializes and updates all Chart.js visualizations:
     1. Input Membership Function chart (Cold / Moderate / Hot)
     2. Output Membership Function chart + Aggregated region + Centroid line
     3. Speed Gauge (doughnut-based gauge)
     4. Input vs Output response curve (full sweep 0-50°C)
   ========================================================================= */

const ChartsModule = (() => {

  const palette = {
    cold:     '#3b82f6',
    moderate: '#10b981',
    hot:      '#ef4444',
    low:      '#3b82f6',
    medium:   '#f59e0b',
    high:     '#ef4444',
    grid:     '#eef2f7',
    text:     '#64748b',
    primary:  '#2563eb',
  };

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = palette.text;
  Chart.defaults.borderColor = palette.grid;

  let inputMfChart, outputMfChart, gaugeChart, responseCurveChart;

  /* ---------------------------------------------------------------------
     Helper: build a sampled dataset [{x, y}] for a trapezoid MF across
     a given universe of discourse.
  ------------------------------------------------------------------------ */
  function sampleMF(points, min, max, step) {
    const data = [];
    for (let x = min; x <= max; x += step) {
      data.push({ x, y: FuzzyEngine.trapezoid(x, points) });
    }
    return data;
  }

  /* ---------------------------------------------------------------------
     1. INPUT MEMBERSHIP FUNCTION CHART
  ------------------------------------------------------------------------ */
  function initInputMfChart() {
    const ctx = document.getElementById('inputMfChart').getContext('2d');

    const datasets = [
      {
        label: 'Cold',
        data: sampleMF(FuzzyEngine.TEMP_SETS.cold.points, 0, 50, 0.5),
        borderColor: palette.cold,
        backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: 'Moderate',
        data: sampleMF(FuzzyEngine.TEMP_SETS.moderate.points, 0, 50, 0.5),
        borderColor: palette.moderate,
        backgroundColor: 'rgba(16,185,129,0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0,
        pointRadius: 0,
      },
      {
        label: 'Hot',
        data: sampleMF(FuzzyEngine.TEMP_SETS.hot.points, 0, 50, 0.5),
        borderColor: palette.hot,
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0,
        pointRadius: 0,
      },
      {
        // Vertical marker line for the current temperature
        label: 'Current Temp',
        data: [{ x: 25, y: 0 }, { x: 25, y: 1 }],
        borderColor: '#0f172a',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
    ];

    inputMfChart = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            type: 'linear',
            min: 0, max: 50,
            title: { display: true, text: 'Temperature (°C)', font: { weight: 600, size: 11 } },
            grid: { color: palette.grid },
            ticks: { stepSize: 10 },
          },
          y: {
            min: 0, max: 1.05,
            title: { display: true, text: 'Membership Degree (μ)', font: { weight: 600, size: 11 } },
            grid: { color: palette.grid },
            ticks: { stepSize: 0.25 },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 14, boxHeight: 8, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 11, weight: 600 } },
          },
          tooltip: {
            callbacks: {
              label: (item) => `${item.dataset.label}: μ = ${item.parsed.y.toFixed(2)}`,
            },
          },
        },
      },
    });
  }

  function updateInputMfChart(temperature) {
    // Update vertical marker line position
    inputMfChart.data.datasets[3].data = [
      { x: temperature, y: 0 },
      { x: temperature, y: 1 },
    ];
    inputMfChart.update();
  }

  /* ---------------------------------------------------------------------
     2. OUTPUT MEMBERSHIP FUNCTION CHART (with aggregation + centroid)
  ------------------------------------------------------------------------ */
  function initOutputMfChart() {
    const ctx = document.getElementById('outputMfChart').getContext('2d');

    const datasets = [
      {
        label: 'Low (ref.)',
        data: sampleMF(FuzzyEngine.SPEED_SETS.low.points, 0, 100, 0.5),
        borderColor: palette.low,
        borderWidth: 1.5,
        borderDash: [3, 3],
        fill: false,
        pointRadius: 0,
        tension: 0,
      },
      {
        label: 'Medium (ref.)',
        data: sampleMF(FuzzyEngine.SPEED_SETS.medium.points, 0, 100, 0.5),
        borderColor: palette.medium,
        borderWidth: 1.5,
        borderDash: [3, 3],
        fill: false,
        pointRadius: 0,
        tension: 0,
      },
      {
        label: 'High (ref.)',
        data: sampleMF(FuzzyEngine.SPEED_SETS.high.points, 0, 100, 0.5),
        borderColor: palette.high,
        borderWidth: 1.5,
        borderDash: [3, 3],
        fill: false,
        pointRadius: 0,
        tension: 0,
      },
      {
        label: 'Aggregated Output',
        data: [],
        borderColor: palette.primary,
        backgroundColor: 'rgba(37,99,235,0.18)',
        borderWidth: 2.5,
        fill: true,
        pointRadius: 0,
        tension: 0,
        order: 0,
      },
      {
        // Vertical centroid marker
        label: 'Centroid (Crisp Output)',
        data: [],
        borderColor: '#0f172a',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
    ];

    outputMfChart = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            type: 'linear',
            min: 0, max: 100,
            title: { display: true, text: 'Fan Speed (%)', font: { weight: 600, size: 11 } },
            grid: { color: palette.grid },
            ticks: { stepSize: 20 },
          },
          y: {
            min: 0, max: 1.05,
            title: { display: true, text: 'Membership Degree (μ)', font: { weight: 600, size: 11 } },
            grid: { color: palette.grid },
            ticks: { stepSize: 0.25 },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 14, boxHeight: 8, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 11, weight: 600 } },
          },
          tooltip: {
            callbacks: {
              label: (item) => `${item.dataset.label}: μ = ${item.parsed.y.toFixed(2)}`,
            },
          },
        },
      },
    });
  }

  function updateOutputMfChart(aggregatedSamples, centroid) {
    outputMfChart.data.datasets[3].data = aggregatedSamples.map(s => ({ x: s.x, y: s.mu }));
    outputMfChart.data.datasets[4].data = [
      { x: centroid, y: 0 },
      { x: centroid, y: 1 },
    ];
    outputMfChart.update();
  }

  /* ---------------------------------------------------------------------
     3. SPEED GAUGE (doughnut-based semi-circular gauge)
  ------------------------------------------------------------------------ */
  function initGaugeChart() {
    const ctx = document.getElementById('gaugeChart').getContext('2d');

    gaugeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Low', 'Medium', 'High', 'Needle Track'],
        datasets: [
          {
            // Background colored zones
            data: [40, 30, 30],
            backgroundColor: [palette.low, palette.medium, palette.high],
            borderWidth: 0,
            circumference: 270,
            rotation: -135,
            cutout: '74%',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      },
      plugins: [{
        id: 'gaugeNeedle',
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          const value = Math.min(100, Math.max(0, chart.config._gaugeValue ?? 50));
          const cx = (chartArea.left + chartArea.right) / 2;
          const cy = (chartArea.top + chartArea.bottom) / 2;
          const radius = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top) / 2;

          /* ---------------------------------------------------------------
             Needle angle must match the doughnut's own rotation convention:
             Chart.js doughnut `rotation: -135` places the arc's start point
             135deg counter-clockwise from the top (12 o'clock), and canvas
             ctx.rotate(theta) with a vector drawn toward (0, -r) points the
             tip `theta` degrees CLOCKWISE from the top.

             So: needle angle (deg) = rotation + (value/100) * circumference
                 value=0   -> -135deg (start of blue zone, upper-left)
                 value=100 -> +135deg (end of red zone,   upper-right)
                 value=50  ->    0deg (straight up, inside medium zone)
          ------------------------------------------------------------------ */
          const ROTATION = -135;
          const CIRCUMFERENCE = 270;
          const angleDeg = ROTATION + (value / 100) * CIRCUMFERENCE;
          const angle = angleDeg * (Math.PI / 180);

          // Needle (tapered triangle). Kept short so the tip stays clear
          // of the center label text at every angle in the 270deg sweep.
          const needleLength = radius * 0.42;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(-5, 0);
          ctx.lineTo(0, -needleLength);
          ctx.lineTo(5, 0);
          ctx.closePath();
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.restore();

          // Center hub
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        },
      }],
    });
  }

  function updateGaugeChart(value) {
    gaugeChart.config._gaugeValue = value;
    gaugeChart.update();
  }

  /* ---------------------------------------------------------------------
     4. INPUT vs OUTPUT RESPONSE CURVE (full sweep)
  ------------------------------------------------------------------------ */
  function initResponseCurveChart() {
    const ctx = document.getElementById('responseCurveChart').getContext('2d');

    // Pre-compute the full response curve (0-50°C)
    const curveData = [];
    for (let t = 0; t <= 50; t += 0.5) {
      const result = FuzzyEngine.compute(t);
      curveData.push({ x: t, y: result.fanSpeedPercent });
    }

    responseCurveChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Fan Speed Response Curve',
            data: curveData,
            borderColor: palette.primary,
            backgroundColor: 'rgba(37,99,235,0.06)',
            borderWidth: 3,
            fill: true,
            pointRadius: 0,
            tension: 0.15,
            order: 1,
          },
          {
            label: 'Current Operating Point',
            data: [{ x: 25, y: 50 }],
            borderColor: '#0f172a',
            backgroundColor: '#fff',
            borderWidth: 3,
            pointRadius: 7,
            pointHoverRadius: 9,
            pointBackgroundColor: '#0f172a',
            showLine: false,
            order: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { intersect: false, mode: 'nearest' },
        scales: {
          x: {
            type: 'linear',
            min: 0, max: 50,
            title: { display: true, text: 'Room Temperature (°C)', font: { weight: 600, size: 11 } },
            grid: { color: palette.grid },
            ticks: { stepSize: 5 },
          },
          y: {
            min: 0, max: 100,
            title: { display: true, text: 'Fan Speed Output (%)', font: { weight: 600, size: 11 } },
            grid: { color: palette.grid },
            ticks: { stepSize: 20 },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 14, boxHeight: 8, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 11, weight: 600 } },
          },
          tooltip: {
            callbacks: {
              label: (item) => item.dataset.label === 'Current Operating Point'
                ? `Now: ${item.parsed.x.toFixed(1)}°C → ${item.parsed.y.toFixed(1)}%`
                : `${item.parsed.x.toFixed(1)}°C → ${item.parsed.y.toFixed(1)}%`,
            },
          },
        },
      },
    });
  }

  function updateResponseCurveChart(temperature, speed) {
    responseCurveChart.data.datasets[1].data = [{ x: temperature, y: speed }];
    responseCurveChart.update();
  }

  /* ---------------------------------------------------------------------
     PUBLIC INIT / UPDATE
  ------------------------------------------------------------------------ */
  function initAll() {
    initInputMfChart();
    initOutputMfChart();
    initGaugeChart();
    initResponseCurveChart();
  }

  function updateAll(result) {
    updateInputMfChart(result.temperature);
    updateOutputMfChart(result.aggregated, result.fanSpeedPercent);
    updateGaugeChart(result.fanSpeedPercent);
    updateResponseCurveChart(result.temperature, result.fanSpeedPercent);
  }

  return { initAll, updateAll };

})();
