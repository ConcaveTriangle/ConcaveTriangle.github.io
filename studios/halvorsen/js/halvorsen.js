(function attachHalvorsen(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Halvorsen = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createHalvorsenApi() {
  "use strict";

  const DEFAULTS = Object.freeze({
    a: 1.3,
    dt: 0.0025,
    steps: 128000,
    burnIn: 20000,
    initial: Object.freeze([-6.4, 0, 0]),
    escapeLimit: 100000,
  });

  function derivative(state, a = DEFAULTS.a) {
    const x = state[0];
    const y = state[1];
    const z = state[2];

    return [
      -a * x - 4 * y - 4 * z - y * y,
      -a * y - 4 * z - 4 * x - z * z,
      -a * z - 4 * x - 4 * y - x * x,
    ];
  }

  function rk4Step(state, dt = DEFAULTS.dt, a = DEFAULTS.a) {
    const x = state[0];
    const y = state[1];
    const z = state[2];

    const k1x = -a * x - 4 * y - 4 * z - y * y;
    const k1y = -a * y - 4 * z - 4 * x - z * z;
    const k1z = -a * z - 4 * x - 4 * y - x * x;

    const x2 = x + 0.5 * dt * k1x;
    const y2 = y + 0.5 * dt * k1y;
    const z2 = z + 0.5 * dt * k1z;
    const k2x = -a * x2 - 4 * y2 - 4 * z2 - y2 * y2;
    const k2y = -a * y2 - 4 * z2 - 4 * x2 - z2 * z2;
    const k2z = -a * z2 - 4 * x2 - 4 * y2 - x2 * x2;

    const x3 = x + 0.5 * dt * k2x;
    const y3 = y + 0.5 * dt * k2y;
    const z3 = z + 0.5 * dt * k2z;
    const k3x = -a * x3 - 4 * y3 - 4 * z3 - y3 * y3;
    const k3y = -a * y3 - 4 * z3 - 4 * x3 - z3 * z3;
    const k3z = -a * z3 - 4 * x3 - 4 * y3 - x3 * x3;

    const x4 = x + dt * k3x;
    const y4 = y + dt * k3y;
    const z4 = z + dt * k3z;
    const k4x = -a * x4 - 4 * y4 - 4 * z4 - y4 * y4;
    const k4y = -a * y4 - 4 * z4 - 4 * x4 - z4 * z4;
    const k4z = -a * z4 - 4 * x4 - 4 * y4 - x4 * x4;

    const sixth = dt / 6;
    return [
      x + sixth * (k1x + 2 * k2x + 2 * k3x + k4x),
      y + sixth * (k1y + 2 * k2y + 2 * k3y + k4y),
      z + sixth * (k1z + 2 * k2z + 2 * k3z + k4z),
    ];
  }

  function validateConfig(config) {
    const a = Number(config.a ?? DEFAULTS.a);
    const dt = Number(config.dt ?? DEFAULTS.dt);
    const steps = Math.round(Number(config.steps ?? DEFAULTS.steps));
    const burnIn = Math.round(Number(config.burnIn ?? DEFAULTS.burnIn));
    const initial = Array.from(config.initial ?? DEFAULTS.initial, Number);
    const escapeLimit = Number(config.escapeLimit ?? DEFAULTS.escapeLimit);

    if (!Number.isFinite(a) || a <= 0 || a > 4) {
      throw new RangeError("The control parameter a must be finite and between 0 and 4.");
    }
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.02) {
      throw new RangeError("The time step must be finite and between 0 and 0.02.");
    }
    if (!Number.isInteger(steps) || steps < 2 || steps > 500000) {
      throw new RangeError("The number of samples must be between 2 and 500,000.");
    }
    if (!Number.isInteger(burnIn) || burnIn < 0 || burnIn > 250000) {
      throw new RangeError("Burn-in must be between 0 and 250,000 steps.");
    }
    if (initial.length !== 3 || initial.some((value) => !Number.isFinite(value))) {
      throw new TypeError("The initial state must contain three finite numbers.");
    }
    if (!Number.isFinite(escapeLimit) || escapeLimit <= 0) {
      throw new RangeError("The escape limit must be a positive finite number.");
    }

    return { a, dt, steps, burnIn, initial, escapeLimit };
  }

  function integrate(config = {}) {
    const options = validateConfig(config);
    const points = new Float32Array(options.steps * 3);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const sum = [0, 0, 0];
    let state = options.initial.slice();

    for (let step = 0; step < options.burnIn + options.steps; step += 1) {
      state = rk4Step(state, options.dt, options.a);

      const norm = Math.hypot(state[0], state[1], state[2]);
      if (!Number.isFinite(norm) || norm > options.escapeLimit) {
        throw new RangeError(
          "The trajectory escaped the numerical bounds. Try a smaller time step or another initial state.",
        );
      }

      if (step < options.burnIn) continue;

      const pointIndex = step - options.burnIn;
      const offset = pointIndex * 3;
      for (let axis = 0; axis < 3; axis += 1) {
        const value = state[axis];
        points[offset + axis] = value;
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
        sum[axis] += value;
      }
    }

    const center = sum.map((value) => value / options.steps);
    let radius = 0;
    let pathLength = 0;

    for (let index = 0; index < options.steps; index += 1) {
      const offset = index * 3;
      radius = Math.max(
        radius,
        Math.hypot(
          points[offset] - center[0],
          points[offset + 1] - center[1],
          points[offset + 2] - center[2],
        ),
      );

      if (index > 0) {
        pathLength += Math.hypot(
          points[offset] - points[offset - 3],
          points[offset + 1] - points[offset - 2],
          points[offset + 2] - points[offset - 1],
        );
      }
    }

    return Object.freeze({
      points,
      min: Object.freeze(min),
      max: Object.freeze(max),
      center: Object.freeze(center),
      radius,
      pathLength,
      finalState: Object.freeze(state.slice()),
      config: Object.freeze({ ...options, initial: Object.freeze(options.initial.slice()) }),
    });
  }

  function seededInitial(seed) {
    let value = Math.trunc(Number(seed)) || 1;
    const next = () => {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return (value >>> 0) / 4294967296;
    };

    const initial = [
      0.55 + next() * 0.9,
      -0.45 + next() * 0.9,
      -0.45 + next() * 0.9,
    ];

    return initial.map((coordinate) => Number(coordinate.toFixed(4)));
  }

  return Object.freeze({
    DEFAULTS,
    derivative,
    integrate,
    rk4Step,
    seededInitial,
    validateConfig,
  });
});
