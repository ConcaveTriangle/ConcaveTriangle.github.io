"use strict";

import assert from "node:assert/strict";
import "../studios/halvorsen/js/halvorsen.js";
const Halvorsen = globalThis.Halvorsen;

assert.equal(Halvorsen.DEFAULTS.steps, 128000);
assert.equal(Halvorsen.DEFAULTS.dt, 0.0025);
assert.equal(Halvorsen.DEFAULTS.burnIn * Halvorsen.DEFAULTS.dt, 50);

function nearVector(actual, expected, epsilon = 1e-11) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => {
    assert.ok(
      Math.abs(value - expected[index]) <= epsilon,
      `Expected ${value} to be within ${epsilon} of ${expected[index]}`,
    );
  });
}

function advance(initial, totalTime, dt, a = 1.4) {
  let state = initial.slice();
  const steps = Math.round(totalTime / dt);
  for (let index = 0; index < steps; index += 1) {
    state = Halvorsen.rk4Step(state, dt, a);
  }
  return state;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const parameter = 1.4;
nearVector(Halvorsen.derivative([0, 0, 0], parameter), [0, 0, 0]);

const secondEquilibrium = Array(3).fill(-(parameter + 8));
nearVector(Halvorsen.derivative(secondEquilibrium, parameter), [0, 0, 0], 1e-10);

const point = [0.3, -0.7, 1.1];
const cycle = ([x, y, z]) => [y, z, x];
nearVector(Halvorsen.derivative(cycle(point), parameter), cycle(Halvorsen.derivative(point, parameter)));

const first = Halvorsen.integrate({ a: 1.4, dt: 0.005, steps: 5000, burnIn: 1000, initial: [1, 0, 0] });
const second = Halvorsen.integrate({ a: 1.4, dt: 0.005, steps: 5000, burnIn: 1000, initial: [1, 0, 0] });
assert.deepEqual(first.points, second.points, "The same configuration must be deterministic.");
assert.ok(first.points.every(Number.isFinite), "Every stored coordinate must be finite.");
first.max.forEach((maximum, axis) => {
  assert.ok(maximum - first.min[axis] > 1, `Axis ${axis} should have non-zero extent.`);
});
assert.ok(first.radius > 1 && first.radius < 100, "The trajectory radius should be bounded and non-trivial.");

const highDensity = Halvorsen.integrate({
  a: 1.3,
  dt: 0.00125,
  steps: 480000,
  burnIn: 40000,
  initial: [-6.4, 0, 0],
});
assert.equal(highDensity.points.length, 1440000, "480k samples should store three coordinates each.");
assert.equal(highDensity.points.byteLength, 5760000, "The high-density vertex buffer size should be stable.");
assert.equal(highDensity.config.steps * highDensity.config.dt, 600, "The ultra preset should cover 600 time units.");
assert.ok(highDensity.points.every(Number.isFinite), "The high-density trajectory must remain finite.");
assert.ok(Number.isFinite(highDensity.radius) && Number.isFinite(highDensity.pathLength));

assert.throws(
  () => Halvorsen.validateConfig({ steps: 500001 }),
  /number of samples/i,
  "The sample safety ceiling should still be enforced.",
);

const initial = [0.8, -0.2, 0.15];
const reference = advance(initial, 0.5, 0.0003125, parameter);
const coarse = advance(initial, 0.5, 0.01, parameter);
const fine = advance(initial, 0.5, 0.005, parameter);
const coarseError = distance(coarse, reference);
const fineError = distance(fine, reference);
assert.ok(fineError < coarseError / 8, "Halving dt should substantially reduce short-horizon RK4 error.");

assert.throws(
  () => Halvorsen.integrate({ a: 1.4, dt: 0.1, steps: 100, initial: [1, 0, 0] }),
  /time step/i,
);

console.log(
  `Halvorsen numerical checks passed (${first.config.steps.toLocaleString()}-sample deterministic trajectory, ${highDensity.config.steps.toLocaleString()}-sample high-density trajectory, RK4 error ratio ${(coarseError / fineError).toFixed(1)}×).`,
);
