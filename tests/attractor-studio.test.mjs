import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { publicFiles } from '../scripts/check.mjs';
import '../studios/attractors/js/attractors.js';

const Attractors = globalThis.Attractors;
const html = await readFile(new URL('../studios/attractors/index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../studios/attractors/js/app.js', import.meta.url), 'utf8');

// Exercise the actual application functions with small in-memory DOM/canvas
// doubles. These tests cover state and export orchestration, not browser pixels.
function studio() {
  const nodes = new Map();
  const timers = new Map();
  const downloads = [];
  let timerId = 0;
  let createdId = 0;
  let encode;
  let encodeStarted;
  const encoding = new Promise(resolve => { encodeStarted = resolve; });
  const defaults = {
    systemInput: 'halvorsen', detailInput: '128000', stepInput: '0.0025',
    burnInInput: '50', initialX: '-6.4', initialY: '0', initialZ: '0',
    resolutionInput: '3840', paletteInput: 'aurora', zoomInput: '1',
  };
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    if (selector.startsWith('#')) assert.ok(html.includes(`id="${selector.slice(1)}"`), `Missing HTML element: ${selector}`);
    const listeners = new Map();
    const attributes = new Map();
    const element = {
      value: defaults[selector.slice(1)] ?? '', textContent: '', dataset: {},
      disabled: false, hidden: false, width: 1000, height: 562, children: [],
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(key, value) { attributes.set(key, value); },
      getAttribute(key) { return attributes.get(key); },
      addEventListener(type, callback) { listeners.set(type, callback); },
      dispatch(type, event = {}) { listeners.get(type)?.(event); },
      getBoundingClientRect() { return { width: 1000, height: 562 }; },
      setPointerCapture() {}, hasPointerCapture() { return true; }, releasePointerCapture() {},
    };
    nodes.set(selector, element);
    return element;
  }
  const cameras = ['hero', 'cyclic', 'axial'].map(name => {
    const element = node(`camera-${name}`); element.dataset.camera = name; return element;
  });
  const aspect = ['16:9', '3:2'].map(value => {
    const element = node(`aspect-${value}`); element.value = value; return element;
  });
  const drawContext = new Proxy({}, {
    get(_target, key) {
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set() { return true; },
  });
  const document = {
    querySelector: node,
    querySelectorAll(selector) {
      if (selector === '[data-camera]') return cameras;
      if (selector === 'input[name="aspect"]') return aspect;
      return [...nodes.values()];
    },
    body: { appendChild() {} },
    createElement(tag) {
      if (tag === 'a') return { click() { downloads.push(this.download); }, remove() {} };
      if (tag !== 'canvas') return node(`created-${++createdId}`);
      return {
        width: 0, height: 0, getContext: () => drawContext,
        toBlob(callback) { encode = callback; encodeStarted(); },
      };
    },
  };
  const window = {
    Attractors,
    setTimeout(callback, delay) {
      const id = ++timerId;
      if (delay === 30) queueMicrotask(callback);
      else timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  const context = vm.createContext({
    document, window, Blob, console, performance,
    Path2D: class { moveTo() {} lineTo() {} },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    requestAnimationFrame(callback) { if (callback.length) queueMicrotask(() => callback(0)); return 1; },
    cancelAnimationFrame() {},
  });
  vm.runInContext(source.replace('  initialise();', `
    globalThis.testing = { state, elements, readModelControls, projectTrajectory,
      serializeSvg, recomputeTrajectory, scheduleReintegration, exportPng,
      updateLabels, bindControls, bindCamera, configureSystem };
  `), context);
  context.testing.configureSystem('halvorsen');
  return { ...context.testing, node, timers, downloads, encoding, finishEncoding: value => encode(value) };
}

test('studio assets are in the public build; private references and tests are not', async () => {
  const files = await publicFiles();
  assert.deepEqual(files.filter(file => file.startsWith('studios/')), [
    'studios/halvorsen/index.html', 'studios/attractors/index.html',
    'studios/attractors/styles.css', 'studios/attractors/js/attractors.js', 'studios/attractors/js/app.js',
  ]);
  assert.ok(!files.some(file => /^(tests|input|inputs)\//.test(file)));
});

test('failed and pending integrations cannot relabel or export a previous trajectory', async () => {
  const app = studio();
  await app.recomputeTrajectory();
  const original = app.state.trajectory;
  assert.equal(app.state.modelValid, true);
  app.bindControls();
  app.elements.parameterInputs.get('a').input.value = '1.1';
  app.elements.parameterInputs.get('a').input.dispatch('input');
  assert.equal(app.state.pending, true);
  assert.equal(app.state.model.parameters.a, 1.3);
  assert.ok(app.elements.exportButtons.every(button => button.disabled));
  await app.recomputeTrajectory();
  assert.equal(app.state.trajectory, original);
  assert.equal(app.state.model.parameters.a, 1.3);
  assert.equal(app.state.modelValid, false);
  assert.match(app.elements.stageMark.textContent, /Halvorsen/);
  assert.match(app.elements.statusMessage.textContent, /last valid Halvorsen trajectory/);
  assert.ok(app.elements.exportButtons.every(button => button.disabled));
  await app.exportPng();
  assert.equal(app.state.exporting, false);
  app.node('#resetSystemButton').dispatch('click');
  await app.recomputeTrajectory();
  assert.equal(app.state.modelValid, true);
  assert.ok(app.elements.exportButtons.every(button => !button.disabled));
});

test('empty initial coordinates are rejected instead of being silently treated as zero', () => {
  const app = studio();
  app.elements.initialInputs[1].value = '';
  assert.throws(() => app.readModelControls(), /each initial coordinate/);
});

test('Trace preserves the position and depth of already visible points', () => {
  const app = studio();
  const trajectory = Attractors.integrate({ steps: 64000 });
  const settings = { maxPoints: 32000 };
  const full = app.projectTrajectory(trajectory, 1000, 562, 64000, settings);
  const prefix = app.projectTrajectory(trajectory, 1000, 562, 1024, settings);
  assert.ok(prefix.sampleCount < full.sampleCount);
  assert.deepEqual(Array.from(prefix.points), Array.from(full.points.subarray(0, prefix.points.length)));
  assert.deepEqual(Array.from(prefix.bins), Array.from(full.bins.subarray(0, prefix.bins.length)));
});

test('SVG contains every sample, valid path references, and the computed model metadata', () => {
  const app = studio();
  const trajectory = Attractors.integrate({ steps: 2000 });
  const svg = app.serializeSvg(trajectory, { width: 1920, height: 1080 });
  assert.match(svg, /width="1920" height="1080"/);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  assert.equal((svg.match(/L-?\d/g) ?? []).length, 1999);
  for (const match of svg.matchAll(/href="#([^"]+)"/g)) assert.ok(svg.includes(`id="${match[1]}"`));
  const metadata = svg.match(/<metadata>(.*?)<\/metadata>/s)[1]
    .replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const parsed = JSON.parse(metadata);
  assert.equal(parsed.model.steps, 2000);
  assert.equal(parsed.model.parameters.a, trajectory.config.parameters.a);
  assert.deepEqual(parsed.model.initial, Array.from(trajectory.config.initial));
});

test('PNG export locks controls and camera, retains filename, then unlocks', async () => {
  const app = studio();
  app.state.trajectory = Attractors.integrate({ steps: 2000 });
  app.state.modelValid = true;
  app.bindCamera();
  const pending = app.exportPng();
  assert.equal(app.state.exporting, true);
  assert.equal(app.elements.parameterInputs.get('a').input.disabled, true);
  const yaw = app.state.camera.yaw;
  app.elements.canvas.dispatch('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(app.state.camera.yaw, yaw);
  await app.encoding;
  // Simulate an unrelated external mutation during the async encoding boundary.
  app.state.aspect = '3:2';
  app.finishEncoding(new Blob(['test PNG bytes'], { type: 'image/png' }));
  await pending;
  assert.deepEqual(app.downloads, ['halvorsen-a1-3-16x9-3840x2160.png']);
  assert.equal(app.state.exporting, false);
  assert.equal(app.elements.parameterInputs.get('a').input.disabled, false);
});

test('PNG encoding failure restores controls and reports a recoverable error', async () => {
  const app = studio();
  app.state.trajectory = Attractors.integrate({ steps: 2000 });
  app.state.modelValid = true;
  const pending = app.exportPng();
  await app.encoding;
  app.finishEncoding(null);
  await pending;
  assert.equal(app.state.exporting, false);
  assert.equal(app.elements.exportPngButton.disabled, false);
  assert.match(app.elements.statusMessage.textContent, /smaller output size/);
  assert.equal(app.elements.statusMessage.dataset.error, 'true');
});

test('every system configures its own parameters, equations, time step, and initial point', async () => {
  const app = studio();
  app.bindControls();
  app.state.style.palette = 'ember';
  app.state.aspect = '3:2';
  for (const system of Object.values(Attractors.systems)) {
    app.elements.systemInput.value = system.id;
    app.elements.systemInput.dispatch('change');
    assert.equal(app.state.pending, true);
    assert.deepEqual([...app.elements.parameterInputs.keys()], system.parameters.map(p => p.key));
    assert.equal(app.elements.stepInput.value, String(system.dt));
    assert.equal(app.elements.burnInInput.value, String(system.burnTime));
    assert.deepEqual(Array.from(app.elements.initialInputs, input => Number(input.value)), Array.from(system.initial));
    assert.equal(app.elements.systemEquations.children.map(p => p.textContent).join('\n'), system.equations.join('\n'));
    assert.equal(app.elements.systemSource.href, system.source);
    await app.recomputeTrajectory();
    assert.equal(app.state.modelValid, true, app.elements.statusMessage.textContent);
    assert.equal(app.state.model.system, system.id);
    assert.equal(app.state.style.palette, 'ember');
    assert.equal(app.state.aspect, '3:2');
    assert.equal(app.elements.stageMark.textContent, system.name);
    for (const spec of system.parameters) assert.equal(app.state.model.parameters[spec.key], spec.value);
  }
});

test('equal coordinates are valid for Lorenz, not rejected as a Halvorsen invariant', () => {
  const app = studio();
  app.configureSystem('lorenz');
  app.elements.initialInputs.forEach(input => { input.value = '1'; });
  assert.deepEqual(Array.from(app.readModelControls().initial), [1, 1, 1]);
  app.configureSystem('thomas');
  app.elements.initialInputs.forEach(input => { input.value = '1'; });
  assert.throws(() => app.readModelControls(), /asymmetric/);
});

test('reset restores the selected system without leaking another system parameters', async () => {
  const app = studio();
  app.bindControls();
  app.configureSystem('langford');
  app.elements.parameterInputs.get('a').input.value = '1.1';
  app.node('#resetSystemButton').dispatch('click');
  assert.equal(app.state.selectedSystem, 'langford');
  assert.equal(app.elements.parameterInputs.get('a').input.value, '0.95');
  await app.recomputeTrajectory();
  assert.equal(app.state.model.system, 'langford');
  app.configureSystem('lorenz');
  assert.deepEqual([...app.elements.parameterInputs.keys()], ['sigma', 'rho', 'beta']);
});

test('SVG exports identify the actual system and preserve exact numerical parameters', () => {
  const app = studio();
  for (const system of Object.values(Attractors.systems)) {
    const trajectory = Attractors.integrate({ system: system.id, steps: 2000 });
    const svg = app.serializeSvg(trajectory, { width: 1920, height: 1280 });
    assert.ok(svg.includes('<title id="title">' + system.name + ' trajectory</title>'));
    assert.ok(svg.includes('&quot;system&quot;:&quot;' + system.id + '&quot;'));
    assert.ok(svg.includes('&quot;parameters&quot;:'));
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  }
});
