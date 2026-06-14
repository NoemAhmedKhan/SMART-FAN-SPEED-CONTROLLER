/* =========================================================================
   FUZZY LOGIC ENGINE
   Smart Fan Speed Controller
   -------------------------------------------------------------------------
   This module contains the complete fuzzy inference system (FIS):
     1. Membership Functions  (Triangular / Trapezoidal)
     2. Fuzzification           (Crisp Temperature -> Fuzzy Degrees)
     3. Rule Base + Inference   (Mamdani Min-Max method)
     4. Defuzzification         (Centroid / Center of Gravity)

   Everything here is plain vanilla JavaScript with zero dependencies so
   it can run by simply opening index.html in any browser.
   ========================================================================= */

const FuzzyEngine = (() => {

  /* ---------------------------------------------------------------------
     1. MEMBERSHIP FUNCTIONS
     ---------------------------------------------------------------------
     Temperature Universe of Discourse: 0°C to 50°C
     Three input sets:  COLD, MODERATE, HOT   (trapezoidal / triangular)

     Output Universe of Discourse: 0% to 100% (Fan Speed)
     Three output sets: LOW, MEDIUM, HIGH     (triangular)

     A trapezoid is defined by 4 points (a, b, c, d):
         - rises from 0 -> 1 between a and b
         - stays at 1   between b and c
         - falls from 1 -> 0 between c and d
     A triangle is the special case where b === c.
  ------------------------------------------------------------------------ */

  // Input (Temperature) membership function parameters [a, b, c, d]
  const TEMP_SETS = {
    cold:     { points: [0, 0, 10, 22],  color: '#3b82f6' }, // blue
    moderate: { points: [12, 23, 27, 38], color: '#10b981' }, // green
    hot:      { points: [28, 40, 50, 50], color: '#ef4444' }, // red
  };

  // Output (Fan Speed %) membership function parameters [a, b, c, d]
  const SPEED_SETS = {
    low:    { points: [0, 0, 20, 40],   color: '#3b82f6' },
    medium: { points: [25, 45, 55, 75], color: '#f59e0b' },
    high:   { points: [60, 80, 100, 100], color: '#ef4444' },
  };

  /**
   * Generic trapezoidal membership function.
   * Handles triangles automatically when b === c.
   * @param {number} x - crisp input value
   * @param {number[]} points - [a, b, c, d]
   * @returns {number} membership degree in range [0, 1]
   *
   * Edge case handling: when a === b (or c === d), the "ramp" segment
   * has zero width and the function should be treated as a flat plateau
   * from that point onward (e.g. Cold = [0,0,10,22] means full
   * membership = 1 starting exactly at x = 0, the left edge of the
   * universe of discourse — not zero).
   */
  function trapezoid(x, [a, b, c, d]) {
    if (x < a || x > d) return 0;
    if (x >= b && x <= c) return 1;           // flat top (covers a===b and c===d cases too)
    if (x < b) return (x - a) / (b - a);      // rising edge
    return (d - x) / (d - c);                 // falling edge
  }


  /* ---------------------------------------------------------------------
     2. FUZZIFICATION
     ---------------------------------------------------------------------
     Converts a crisp temperature value into membership degrees for
     each of the three input fuzzy sets (Cold, Moderate, Hot).
  ------------------------------------------------------------------------ */
  function fuzzifyTemperature(temp) {
    return {
      cold:     trapezoid(temp, TEMP_SETS.cold.points),
      moderate: trapezoid(temp, TEMP_SETS.moderate.points),
      hot:      trapezoid(temp, TEMP_SETS.hot.points),
    };
  }

  /* ---------------------------------------------------------------------
     3. RULE BASE + INFERENCE (Mamdani Min-Max)
     ---------------------------------------------------------------------
     Since temperature is the ONLY input, each fuzzy set maps directly
     to one rule. The "AND" / min operator is trivial here (single
     antecedent) but the structure mirrors a full multi-input system,
     so it can be extended later (e.g. add Humidity as a 2nd input).

     RULE 1: IF temperature IS Cold     THEN fan speed IS Low
     RULE 2: IF temperature IS Moderate THEN fan speed IS Medium
     RULE 3: IF temperature IS Hot      THEN fan speed IS High

     The "firing strength" of each rule = membership degree of its
     antecedent (since there's only one input, no min() needed across
     multiple antecedents, but we keep the helper for clarity/extension).
  ------------------------------------------------------------------------ */
  const RULES = [
    { id: 1, antecedent: 'cold',     consequent: 'low',    label: 'IF Temperature is COLD THEN Fan Speed is LOW' },
    { id: 2, antecedent: 'moderate', consequent: 'medium', label: 'IF Temperature is MODERATE THEN Fan Speed is MEDIUM' },
    { id: 3, antecedent: 'hot',      consequent: 'high',   label: 'IF Temperature is HOT THEN Fan Speed is HIGH' },
  ];

  function evaluateRules(memberships) {
    return RULES.map(rule => {
      const strength = memberships[rule.antecedent]; // min() of antecedents (only 1 here)
      return {
        ...rule,
        strength,
      };
    });
  }

  /* ---------------------------------------------------------------------
     4. DEFUZZIFICATION (Centroid / Center of Gravity Method)
     ---------------------------------------------------------------------
     Steps:
       a) For each rule, clip the consequent's output membership function
          at the rule's firing strength (min) -> creates a "clipped" shape.
       b) Aggregate all clipped shapes by taking the MAX (union) at every
          point across the output universe of discourse (0-100%).
       c) Compute the centroid (center of mass) of the aggregated shape:

              Centroid = Σ( x_i * μ(x_i) ) / Σ( μ(x_i) )

          evaluated via numerical integration (discrete sampling).
  ------------------------------------------------------------------------ */
  const SAMPLE_STEP = 0.5; // resolution of numerical integration (0-100%)

  function aggregateOutput(activatedRules) {
    const samples = [];
    for (let x = 0; x <= 100; x += SAMPLE_STEP) {
      let maxMu = 0;
      for (const rule of activatedRules) {
        const setPoints = SPEED_SETS[rule.consequent].points;
        const rawMu = trapezoid(x, setPoints);
        // Clip (min) the consequent MF by the rule's firing strength
        const clipped = Math.min(rawMu, rule.strength);
        // Aggregate (max / union) across rules
        if (clipped > maxMu) maxMu = clipped;
      }
      samples.push({ x, mu: maxMu });
    }
    return samples;
  }

  function defuzzifyCentroid(aggregatedSamples) {
    let numerator = 0;
    let denominator = 0;
    for (const { x, mu } of aggregatedSamples) {
      numerator += x * mu;
      denominator += mu;
    }
    if (denominator === 0) return 0; // safety fallback (no rules fired)
    return numerator / denominator;
  }

  /* ---------------------------------------------------------------------
     5. MASTER PIPELINE
     ---------------------------------------------------------------------
     Runs the full fuzzy inference process for a given temperature and
     returns every intermediate result so the UI can visualize each step.
  ------------------------------------------------------------------------ */
  function compute(temperature) {
    const temp = Math.min(50, Math.max(0, temperature)); // clamp 0-50

    // Step 1: Fuzzification
    const memberships = fuzzifyTemperature(temp);

    // Step 2: Rule Evaluation (Inference)
    const rules = evaluateRules(memberships);

    // Step 3: Aggregation
    const aggregated = aggregateOutput(rules);

    // Step 4: Defuzzification
    const fanSpeedPercent = defuzzifyCentroid(aggregated);

    // Step 5: Determine dominant linguistic output for display
    const dominantRule = rules.reduce((max, r) => (r.strength > max.strength ? r : max), rules[0]);

    return {
      temperature: temp,
      memberships,
      rules,
      aggregated,
      fanSpeedPercent,
      dominantRule,
    };
  }

  // Public API
  return {
    TEMP_SETS,
    SPEED_SETS,
    RULES,
    trapezoid,
    fuzzifyTemperature,
    evaluateRules,
    aggregateOutput,
    defuzzifyCentroid,
    compute,
  };

})();
