/* =========================================================================
   APP CONTROLLER
   Smart Fan Speed Controller
   -------------------------------------------------------------------------
   Responsibilities:
     - Bind UI elements (slider, presets, displays)
     - Listen for temperature changes
     - Run the Fuzzy Engine pipeline
     - Update all DOM readouts, the fan animation, rule list, and charts
   ========================================================================= */

(() => {

  /* ---------------------------------------------------------------------
     DOM REFERENCES
  ------------------------------------------------------------------------ */
  const tempSlider       = document.getElementById('tempSlider');
  const tempDisplay      = document.getElementById('tempDisplay');
  const dominantSetLabel = document.getElementById('dominantSetLabel');

  const fanBlades   = document.getElementById('fanBlades');
  const fanSpeedVal = document.getElementById('fanSpeedValue');
  const speedChip   = document.getElementById('speedChip');
  const speedChipLabel = document.getElementById('speedChipLabel');

  const muColdBar = document.getElementById('muColdBar');
  const muColdVal = document.getElementById('muColdVal');
  const muModerateBar = document.getElementById('muModerateBar');
  const muModerateVal = document.getElementById('muModerateVal');
  const muHotBar = document.getElementById('muHotBar');
  const muHotVal = document.getElementById('muHotVal');

  const statTemp = document.getElementById('statTemp');
  const statActiveSets = document.getElementById('statActiveSets');
  const statCrispOut = document.getElementById('statCrispOut');

  const gaugeValue = document.getElementById('gaugeValue');
  const ruleList = document.getElementById('ruleList');

  const presetButtons = document.querySelectorAll('.preset-btn');

  /* ---------------------------------------------------------------------
     RULE DESCRIPTIONS (for display)
     Maps each rule to a human-readable sentence with bold linguistic terms
  ------------------------------------------------------------------------ */
  const RULE_DISPLAY = {
    1: { name: 'Rule 1', html: 'IF Temperature is <b>Cold</b> THEN Fan Speed is <b>Low</b>' },
    2: { name: 'Rule 2', html: 'IF Temperature is <b>Moderate</b> THEN Fan Speed is <b>Medium</b>' },
    3: { name: 'Rule 3', html: 'IF Temperature is <b>Hot</b> THEN Fan Speed is <b>High</b>' },
  };

  /* ---------------------------------------------------------------------
     BUILD RULE LIST (static structure, dynamic values)
  ------------------------------------------------------------------------ */
  function buildRuleList() {
    ruleList.innerHTML = '';
    FuzzyEngine.RULES.forEach(rule => {
      const item = document.createElement('div');
      item.className = 'rule-item';
      item.id = `rule-${rule.id}`;
      item.innerHTML = `
        <div class="rule-item__top">
          <span class="rule-item__name">${RULE_DISPLAY[rule.id].name}</span>
          <span class="rule-item__strength" id="rule-${rule.id}-strength">0.00</span>
        </div>
        <div class="rule-item__text">${RULE_DISPLAY[rule.id].html}</div>
        <div class="rule-bar"><div class="rule-bar__fill" id="rule-${rule.id}-bar" style="width:0%"></div></div>
      `;
      ruleList.appendChild(item);
    });
  }

  /* ---------------------------------------------------------------------
     FAN ANIMATION
     Maps fan speed % (0-100) to a CSS animation duration (seconds).
     Higher speed -> shorter duration -> faster spin.
     At 0% speed, animation is removed entirely (fan stopped).
  ------------------------------------------------------------------------ */
  function updateFanAnimation(speedPercent) {
    if (speedPercent <= 0.5) {
      fanBlades.classList.remove('spin');
      fanBlades.style.animationDuration = '';
      return;
    }

    fanBlades.classList.add('spin');

    // Map speed (1-100) to duration (4s slow -> 0.25s fast)
    const minDuration = 0.25; // fastest spin
    const maxDuration = 4;    // slowest spin
    const ratio = speedPercent / 100;
    const duration = maxDuration - (ratio * (maxDuration - minDuration));
    fanBlades.style.animationDuration = `${duration.toFixed(2)}s`;
  }

  /* ---------------------------------------------------------------------
     SPEED CATEGORY (for chip + dominant label)
     Determines the dominant linguistic label based on which output
     fuzzy set the crisp value falls most strongly within, using the
     dominant rule's consequent for consistency with rule evaluation.
  ------------------------------------------------------------------------ */
  function getSpeedCategory(result) {
    const consequent = result.dominantRule.consequent; // 'low' | 'medium' | 'high'
    const labels = { low: 'Low Speed', medium: 'Medium Speed', high: 'High Speed' };
    return { key: consequent, label: labels[consequent] };
  }

  function getTempCategory(memberships) {
    const entries = Object.entries(memberships);
    const dominant = entries.reduce((max, cur) => (cur[1] > max[1] ? cur : max), entries[0]);
    const labels = { cold: 'Cold', moderate: 'Moderate', hot: 'Hot' };
    return labels[dominant[0]];
  }

  /* ---------------------------------------------------------------------
     MAIN UPDATE FUNCTION
     Runs on every slider input / preset click.
  ------------------------------------------------------------------------ */
  function update(temperature) {
    const result = FuzzyEngine.compute(temperature);
    const { memberships, rules, fanSpeedPercent } = result;

    /* ---- Hero Temperature Display ---- */
    tempDisplay.innerHTML = `${temperature.toFixed(1)}<span>°C</span>`;
    dominantSetLabel.textContent = getTempCategory(memberships);

    /* ---- Fuzzification Bars ---- */
    muColdBar.style.width = `${(memberships.cold * 100).toFixed(1)}%`;
    muColdVal.textContent = memberships.cold.toFixed(2);

    muModerateBar.style.width = `${(memberships.moderate * 100).toFixed(1)}%`;
    muModerateVal.textContent = memberships.moderate.toFixed(2);

    muHotBar.style.width = `${(memberships.hot * 100).toFixed(1)}%`;
    muHotVal.textContent = memberships.hot.toFixed(2);

    /* ---- Stat Mini Cards ---- */
    statTemp.textContent = `${temperature.toFixed(1)}°`;
    const activeSets = Object.values(memberships).filter(m => m > 0.001).length;
    statActiveSets.textContent = activeSets;
    statCrispOut.textContent = `${fanSpeedPercent.toFixed(1)}%`;

    /* ---- Rule Evaluation ---- */
    rules.forEach(rule => {
      const strengthEl = document.getElementById(`rule-${rule.id}-strength`);
      const barEl = document.getElementById(`rule-${rule.id}-bar`);
      const itemEl = document.getElementById(`rule-${rule.id}`);

      strengthEl.textContent = rule.strength.toFixed(2);
      barEl.style.width = `${(rule.strength * 100).toFixed(1)}%`;

      if (rule.strength > 0.001) {
        itemEl.classList.add('active');
      } else {
        itemEl.classList.remove('active');
      }
    });

    /* ---- Gauge + Fan Readout ---- */
    gaugeValue.textContent = fanSpeedPercent.toFixed(1);
    fanSpeedVal.innerHTML = `${fanSpeedPercent.toFixed(1)}<span>%</span>`;

    const category = getSpeedCategory(result);
    speedChip.className = `speed-chip ${category.key}`;
    speedChipLabel.textContent = category.label;

    /* ---- Fan Animation ---- */
    updateFanAnimation(fanSpeedPercent);

    /* ---- Charts ---- */
    ChartsModule.updateAll(result);
  }

  /* ---------------------------------------------------------------------
     EVENT BINDINGS
  ------------------------------------------------------------------------ */
  tempSlider.addEventListener('input', (e) => {
    const temp = parseFloat(e.target.value);
    update(temp);
  });

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const temp = parseFloat(btn.dataset.temp);
      tempSlider.value = temp;
      update(temp);
    });
  });

  /* ---------------------------------------------------------------------
     INIT
     Guarded so it only ever runs once, regardless of whether the
     DOMContentLoaded event has already fired by the time this script
     executes (scripts are loaded at the end of <body>, so readyState
     is typically 'interactive' or 'complete' already).
  ------------------------------------------------------------------------ */
  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    buildRuleList();
    ChartsModule.initAll();
    update(parseFloat(tempSlider.value));
  }

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
