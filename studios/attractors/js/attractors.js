(function attachAttractors(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Attractors = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAttractors() {
  'use strict';
  const parameter = (key, label, value, min, max, step = 0.01) => Object.freeze({ key, label, value, min, max, step });
  const definitions = [
    {
      id: 'halvorsen', name: 'Halvorsen', mark: 'H',
      description: 'A flow with three lobes and cyclic symmetry.',
      source: 'https://sprott.physics.wisc.edu/chaos/symmetry.htm', sourceLabel: 'Sprott: A Symmetric Chaotic Flow',
      parameters: [parameter('a', 'a', 1.3, 1.1, 1.7)],
      equations: ['ẋ = −ax − 4y − 4z − y²', 'ẏ = −ay − 4z − 4x − z²', 'ż = −az − 4x − 4y − x²'],
      initial: [-6.4, 0, 0], dt: 0.0025, timeSteps: [0.005, 0.0025, 0.00125], burnTime: 50,
      camera: { yaw: -0.66, pitch: 0.48, roll: -0.12, zoom: 1 },
      derivative: ([x,y,z], {a}) => [-a*x-4*y-4*z-y*y, -a*y-4*z-4*x-z*z, -a*z-4*x-4*y-x*x],
    },
    {
      id: 'lorenz', name: 'Lorenz', mark: 'L',
      description: 'A trajectory that moves between two lobes.',
      source: 'https://www.d.umn.edu/~mhampton/DynSys/ChaoticFlows/', sourceLabel: 'Hampton: Chaotic Flows',
      parameters: [parameter('sigma','σ',10,1,30,0.1), parameter('rho','ρ',28,1,60,0.1), parameter('beta','β',8/3,0.1,6,0.001)],
      equations: ['ẋ = σ(y − x)', 'ẏ = x(ρ − z) − y', 'ż = xy − βz'],
      initial: [0,1,0], dt: 0.005, timeSteps: [0.01,0.005,0.0025], burnTime: 25,
      camera: { yaw: 0.15, pitch: -1.3, roll: 0, zoom: 1 },
      derivative: ([x,y,z], {sigma,rho,beta}) => [sigma*(y-x), x*(rho-z)-y, x*y-beta*z],
    },
    {
      id: 'rossler', name: 'Rössler', mark: 'R',
      description: 'A spiral that rises and folds back on itself.',
      source: 'https://www.d.umn.edu/~mhampton/DynSys/ChaoticFlows/', sourceLabel: 'Hampton: Chaotic Flows',
      parameters: [parameter('a','a',0.2,0.05,0.4,0.005), parameter('b','b',0.2,0.05,0.4,0.005), parameter('c','c',5.7,2,12,0.05)],
      equations: ['ẋ = −y − z', 'ẏ = x + ay', 'ż = b + z(x − c)'],
      initial: [1,0,0], dt: 0.01, timeSteps: [0.02,0.01,0.005], burnTime: 100,
      camera: { yaw: -0.2, pitch: -0.65, roll: 0, zoom: 1 },
      derivative: ([x,y,z], {a,b,c}) => [-y-z, x+a*y, b+z*(x-c)],
    },
    {
      id: 'thomas', name: 'Thomas', mark: 'T',
      description: 'A cyclically symmetric system with sine terms.',
      source: 'https://sprott.physics.wisc.edu/pubs/paper302.pdf', sourceLabel: 'Sprott & Chlouverakis: Labyrinth Chaos',
      parameters: [parameter('b','b · dissipation',0.208186,0.05,0.4,0.000001)],
      equations: ['ẋ = sin(y) − bx', 'ẏ = sin(z) − by', 'ż = sin(x) − bz'],
      initial: [0.1,0,0], dt: 0.02, timeSteps: [0.02,0.01,0.005], burnTime: 100,
      camera: { yaw: -0.7, pitch: 0.5, roll: 0, zoom: 1 },
      derivative: ([x,y,z], {b}) => [Math.sin(y)-b*x, Math.sin(z)-b*y, Math.sin(x)-b*z],
    },
    {
      id: 'langford', name: 'Langford (Aizawa)', mark: 'La',
      description: 'A flow around a rounded shell. Often called “Aizawa”; this system is attributed to Langford.',
      source: 'https://doi.org/10.1016/j.cnsns.2020.105226', sourceLabel: 'Fleurantin & Mireles James: Resonant tori and chaos',
      parameters: [parameter('a','a',0.95,0.5,1.2), parameter('b','b',0.7,0.3,1), parameter('c','c',0.6,0.1,1), parameter('d','d',3.5,1,6,0.05), parameter('e','e',0.25,0.05,0.5), parameter('f','f',0.1,0,0.3)],
      equations: ['ẋ = (z − b)x − dy', 'ẏ = dx + (z − b)y', 'ż = c + az − z³/3 − (x² + y²)(1 + ez) + fzx³'],
      initial: [0.1,0,0], dt: 0.005, timeSteps: [0.01,0.005,0.0025], burnTime: 50,
      camera: { yaw: -0.3, pitch: -1.2, roll: 0, zoom: 1 },
      derivative: ([x,y,z], {a,b,c,d,e,f}) => [(z-b)*x-d*y, d*x+(z-b)*y, c+a*z-z*z*z/3-(x*x+y*y)*(1+e*z)+f*z*x*x*x],
    },
  ];
  const systems = Object.freeze(Object.fromEntries(definitions.map(definition => [definition.id, Object.freeze({
    ...definition, parameters: Object.freeze(definition.parameters), equations: Object.freeze(definition.equations),
    initial: Object.freeze(definition.initial), timeSteps: Object.freeze(definition.timeSteps), camera: Object.freeze(definition.camera),
  })])));

  function getSystem(id = 'halvorsen') {
    if (!Object.hasOwn(systems,id)) throw new RangeError('Choose a supported attractor.');
    return systems[id];
  }
  function defaults(id = 'halvorsen') {
    const system = getSystem(id);
    return { system: id, parameters: Object.fromEntries(system.parameters.map(p => [p.key,p.value])),
      dt: system.dt, steps: 128000, burnIn: Math.ceil(system.burnTime/system.dt), initial: [...system.initial], escapeLimit: 100000 };
  }
  function validateConfig(config = {}) {
    const system = getSystem(config.system ?? 'halvorsen'), base = defaults(system.id);
    const parameters = { ...base.parameters, ...config.parameters };
    for (const key of Object.keys(parameters)) {
      const spec = system.parameters.find(p => p.key === key);
      if (!spec) throw new RangeError(`Unknown ${system.name} parameter: ${key}.`);
      parameters[key] = Number(parameters[key]);
      if (!Number.isFinite(parameters[key]) || parameters[key] < spec.min || parameters[key] > spec.max) throw new RangeError(`${spec.label} must be between ${spec.min} and ${spec.max}.`);
    }
    const dt = Number(config.dt ?? base.dt), steps = Number(config.steps ?? base.steps), burnIn = Number(config.burnIn ?? base.burnIn);
    const initial = Array.from(config.initial ?? base.initial, Number), escapeLimit = Number(config.escapeLimit ?? base.escapeLimit);
    if (!Number.isFinite(dt) || dt <= 0 || dt > system.timeSteps[0]) throw new RangeError(`The time step must be positive and no larger than ${system.timeSteps[0]} for ${system.name}.`);
    if (!Number.isInteger(steps) || steps < 2 || steps > 500000) throw new RangeError('The number of samples must be between 2 and 500,000.');
    if (!Number.isInteger(burnIn) || burnIn < 0 || burnIn > 250000) throw new RangeError('Burn-in must be between 0 and 250,000 steps.');
    if (initial.length !== 3 || initial.some(v => !Number.isFinite(v))) throw new TypeError('The initial state must contain three finite numbers.');
    if (!Number.isFinite(escapeLimit) || escapeLimit <= 0) throw new RangeError('The escape limit must be a positive finite number.');
    return { system: system.id, parameters, dt, steps, burnIn, initial, escapeLimit };
  }
  function derivative(state, system = 'halvorsen', parameters = defaults(system).parameters) { return getSystem(system).derivative(state,parameters); }
  function stepWith(field, state, dt, p) {
    const k1 = field(state,p);
    const k2 = field(state.map((v,i) => v + dt*k1[i]/2),p);
    const k3 = field(state.map((v,i) => v + dt*k2[i]/2),p);
    const k4 = field(state.map((v,i) => v + dt*k3[i]),p);
    return state.map((v,i) => v + dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
  }
  function rk4Step(state, dt = 0.0025, system = 'halvorsen', p = defaults(system).parameters) { return stepWith(getSystem(system).derivative,state,dt,p); }
  function integrate(config = {}) {
    const options = validateConfig(config), field = getSystem(options.system).derivative;
    const points = new Float32Array(options.steps*3);
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity], sum = [0,0,0];
    let state = [...options.initial];
    for (let step = 0; step < options.burnIn+options.steps; step++) {
      state = stepWith(field,state,options.dt,options.parameters);
      const norm = Math.hypot(...state);
      if (!Number.isFinite(norm) || norm > options.escapeLimit) throw new RangeError('The trajectory escaped the numerical bounds. Try a smaller time step or reset the system.');
      if (step < options.burnIn) continue;
      const offset = (step-options.burnIn)*3;
      for (let axis = 0; axis < 3; axis++) {
        points[offset+axis] = state[axis]; min[axis] = Math.min(min[axis],state[axis]);
        max[axis] = Math.max(max[axis],state[axis]); sum[axis] += state[axis];
      }
    }
    const center = sum.map(v => v/options.steps);
    let radius = 0, pathLength = 0;
    for (let i = 0; i < options.steps; i++) {
      const offset = i*3;
      radius = Math.max(radius,Math.hypot(points[offset]-center[0],points[offset+1]-center[1],points[offset+2]-center[2]));
      if (i) pathLength += Math.hypot(points[offset]-points[offset-3],points[offset+1]-points[offset-2],points[offset+2]-points[offset-1]);
    }
    if (radius < 1e-7 || pathLength < 1e-7) throw new RangeError('This trajectory settles to a fixed point. Change the initial state or reset the system.');
    return Object.freeze({ points, min: Object.freeze(min), max: Object.freeze(max), center: Object.freeze(center), radius, pathLength,
      finalState: Object.freeze([...state]), config: Object.freeze({ ...options, parameters: Object.freeze(options.parameters), initial: Object.freeze(options.initial) }) });
  }
  function seededInitial(seed, system = 'halvorsen') {
    let value = Math.trunc(Number(seed)) || 1;
    const next = () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0)/4294967296; };
    return getSystem(system).initial.map(v => Number((v+(next()-0.5)*0.08).toFixed(6)));
  }
  return Object.freeze({ systems, getSystem, defaults, derivative, rk4Step, validateConfig, integrate, seededInitial });
});
