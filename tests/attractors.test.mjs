import assert from 'node:assert/strict';
import test from 'node:test';
import '../studios/attractors/js/attractors.js';
const A = globalThis.Attractors;
const distance = (a,b) => Math.hypot(...a.map((v,i) => v-b[i]));

test('published equations evaluated at independently calculated sample points', () => {
  assert.deepEqual(A.derivative([1,2,3], 'halvorsen'), [-25.3,-27.6,-16.9]);
  assert.deepEqual(A.derivative([1,2,3], 'lorenz'), [10,23,-6]);
  assert.deepEqual(A.derivative([1,2,3], 'rossler'), [-5,1.4,-13.900000000000002]);
  assert.ok(distance(A.derivative([1,2,3], 'thomas'), [Math.sin(2)-0.208186,Math.sin(3)-0.416372,Math.sin(1)-0.624558]) < 1e-14);
  assert.ok(distance(A.derivative([1,2,3], 'langford'), [-4.7,8.1,-14]) < 1e-13);
});

for (const system of Object.values(A.systems)) {
  test(`${system.name}: finite, nontrivial presets at default and finer time steps`, () => {
    for (const dt of [system.dt, system.dt/2]) {
      const trajectory = A.integrate({ system: system.id, dt, burnIn: Math.ceil(system.burnTime/dt) });
      assert.equal(trajectory.config.steps, 128000);
      assert.ok(trajectory.points.every(Number.isFinite));
      assert.ok(trajectory.radius > 0.1 && trajectory.radius < 100);
      assert.ok(trajectory.pathLength > 10);
      for (let axis = 0; axis < 3; axis++) assert.ok(trajectory.max[axis]-trajectory.min[axis] > 0.1);
    }
  });
  test(`${system.name}: deterministic and fourth-order short-horizon convergence`, () => {
    const config = { system: system.id, steps: 2000, burnIn: 1000 };
    assert.deepEqual(A.integrate(config).points, A.integrate(config).points);
    const initial = [0.8,-0.2,0.15];
    const advance = dt => {
      let point = [...initial];
      for (let i=0; i<Math.round(0.5/dt); i++) point = A.rk4Step(point,dt,system.id);
      return point;
    };
    const reference = advance(0.000625), coarse = advance(0.02), fine = advance(0.01);
    assert.ok(distance(fine,reference) < distance(coarse,reference)/8);
    assert.deepEqual(A.seededInitial(173,system.id), A.seededInitial(173,system.id));
  });
}

test('high-density output retains all 480k samples', () => {
  const trajectory = A.integrate({ steps: 480000, dt: 0.00125, burnIn: 40000 });
  assert.equal(trajectory.points.length, 1440000);
  assert.equal(trajectory.points.byteLength, 5760000);
  assert.ok(trajectory.points.every(Number.isFinite));
});

test('validation rejects unsupported models, invalid parameters, excessive work, and escapes', () => {
  for (const system of ['unknown','toString','__proto__']) assert.throws(() => A.getSystem(system), /supported attractor/);
  assert.throws(() => A.integrate({ parameters: { sigma: 10 } }), /Unknown/);
  assert.throws(() => A.integrate({ parameters: { a: NaN } }), /must be between/);
  assert.throws(() => A.integrate({ steps: 500001 }), /samples/);
  assert.throws(() => A.integrate({ steps: 2.5 }), /samples/);
  assert.throws(() => A.integrate({ dt: 0.1 }), /time step/);
  assert.throws(() => A.integrate({ burnIn: 250001 }), /Burn-in/);
  assert.throws(() => A.integrate({ initial: [Infinity,0,0] }), /finite/);
  assert.throws(() => A.integrate({ initial: [100000,0,0] }), /escaped/);
  assert.throws(() => A.integrate({ system: 'lorenz', initial: [0,0,0] }), /fixed point/);
});

test('equilibria and cyclic symmetry remain mathematically consistent', () => {
  const a = 1.4, equilibrium = Array(3).fill(-(a+8));
  assert.ok(distance(A.derivative(equilibrium,'halvorsen',{a}),[0,0,0]) < 1e-10);
  const cycle = ([x,y,z]) => [y,z,x], point = [0.3,-0.7,1.1];
  for (const system of ['halvorsen','thomas']) assert.ok(distance(A.derivative(cycle(point),system),cycle(A.derivative(point,system))) < 1e-13);
  const {rho,beta} = A.defaults('lorenz').parameters;
  const x = Math.sqrt(beta*(rho-1));
  assert.ok(distance(A.derivative([x,x,rho-1],'lorenz'),[0,0,0]) < 1e-10);
});
