(function runAttractorStudio() {
  "use strict";

  if (!window.Attractors) {
    throw new Error("The attractor models failed to load.");
  }

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const TAU = Math.PI * 2;
  const PREVIEW_SAMPLE_LIMIT = 96000;
  const INTERACTIVE_SAMPLE_LIMIT = 32000;
  const Attractors = window.Attractors;

  const palettes = Object.freeze({
    aurora: Object.freeze({
      background: "#070912",
      background2: "#142034",
      stops: Object.freeze(["#4357ff", "#00d8c0", "#f4e58b", "#ff6d55"]),
      blend: "screen",
    }),
    dusk: Object.freeze({
      background: "#0d0b12",
      background2: "#241d29",
      stops: Object.freeze(["#656485", "#807b94", "#aaa0a4", "#bd8d83"]),
      blend: "screen",
    }),
    ember: Object.freeze({
      background: "#0b0908",
      background2: "#2b1710",
      stops: Object.freeze(["#6b65ff", "#d33d63", "#ff7b32", "#ffd38d"]),
      blend: "screen",
    }),
    ivory: Object.freeze({
      background: "#ece7da",
      background2: "#fffdf7",
      stops: Object.freeze(["#14223f", "#214cc8", "#4576e8", "#e35e42"]),
      blend: "multiply",
    }),
    cyanotype: Object.freeze({
      background: "#061c36",
      background2: "#0e4770",
      stops: Object.freeze(["#4bbbd1", "#89dce6", "#d5f7ef", "#fff4c7"]),
      blend: "screen",
    }),
    mono: Object.freeze({
      background: "#ebe9e2",
      background2: "#fbfaf5",
      stops: Object.freeze(["#161816", "#32342f", "#5f625a", "#111310"]),
      blend: "multiply",
    }),
  });

  const backgrounds = Object.freeze({
    midnight: Object.freeze({ outer: "#050812", inner: "#1b2941", light: false }),
    obsidian: Object.freeze({ outer: "#050506", inner: "#222327", light: false }),
    plum: Object.freeze({ outer: "#0b0710", inner: "#2b1a30", light: false }),
    forest: Object.freeze({ outer: "#06100c", inner: "#1b3025", light: false }),
    charcoal: Object.freeze({ outer: "#100a07", inner: "#36231a", light: false }),
    "warm-paper": Object.freeze({ outer: "#e6dfd2", inner: "#fffaf0", light: true }),
    "cool-paper": Object.freeze({ outer: "#dfe6e8", inner: "#fbfcfc", light: true }),
  });

  const cameraPresets = Object.freeze({
    hero: Object.freeze({ yaw: -0.66, pitch: 0.48, roll: -0.12, zoom: 1 }),
    cyclic: Object.freeze({ yaw: -Math.PI / 4, pitch: Math.asin(1 / Math.sqrt(3)), roll: 0, zoom: 1.03 }),
    axial: Object.freeze({ yaw: 0, pitch: 0, roll: -Math.PI / 12, zoom: 0.94 }),
  });

  const elements = {
    systemInput: $("#systemInput"),
    systemDescription: $("#systemDescription"),
    systemEquations: $("#systemEquations"),
    systemSource: $("#systemSource"),
    parameterControls: $("#parameterControls"),
    parameterInputs: new Map(),
    backgroundInput: $("#backgroundInput"),
    burnInInput: $("#burnInInput"),
    canvas: $("#trajectoryCanvas"),
    canvasFrame: $("#canvasFrame"),
    detailInput: $("#detailInput"),
    dimensionOutput: $("#dimensionOutput"),
    exportButtons: [$("#exportPngButton"), $("#exportPngPanelButton"), $("#exportSvgButton")],
    exportPngButton: $("#exportPngButton"),
    exportPngPanelButton: $("#exportPngPanelButton"),
    exportSvgButton: $("#exportSvgButton"),
    footerState: $("#footerState"),
    glowInput: $("#glowInput"),
    glowOutput: $("#glowOutput"),
    gradientInput: $("#gradientInput"),
    gradientStrengthInput: $("#gradientStrengthInput"),
    gradientStrengthOutput: $("#gradientStrengthOutput"),
    initialInputs: [$("#initialX"), $("#initialY"), $("#initialZ")],
    newOrbitButton: $("#newOrbitButton"),
    paletteInput: $("#paletteInput"),
    perspectiveInput: $("#perspectiveInput"),
    perspectiveOutput: $("#perspectiveOutput"),
    renderMeta: $("#renderMeta"),
    renderProgress: $("#renderProgress"),
    resetCameraButton: $("#resetCameraButton"),
    resolutionInput: $("#resolutionInput"),
    stageMark: $(".stage-mark span"),
    statusMessage: $("#statusMessage"),
    stepInput: $("#stepInput"),
    strokeInput: $("#strokeInput"),
    strokeOutput: $("#strokeOutput"),
    traceButton: $("#traceButton"),
    traceButtonLabel: $("#traceButtonLabel"),
    zoomInput: $("#zoomInput"),
    zoomOutput: $("#zoomOutput"),
  };

  const state = {
    aspect: "16:9",
    camera: { ...cameraPresets.hero, perspective: 0.18 },
    selectedSystem: 'halvorsen',
    model: Attractors.defaults(),
    style: {
      background: "matched",
      glow: 0.42,
      gradient: "halo",
      gradientStrength: 0.78,
      palette: "aurora",
      stroke: 0.95,
    },
    trajectory: null,
    playing: false,
    reveal: 1,
    seed: 173,
    generation: 0,
    drawRequest: 0,
    reintegrateTimer: 0,
    animationRequest: 0,
    wheelTimer: 0,
    interacting: false,
    pending: false,
    exporting: false,
    modelValid: false,
  };

  function parseHex(hex) {
    const value = hex.replace("#", "");
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ];
  }

  function mixColor(from, to, amount) {
    const a = parseHex(from);
    const b = parseHex(to);
    const rgb = a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  function samplePalette(stops, amount) {
    const scaled = clamp(amount, 0, 1) * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(scaled));
    return mixColor(stops[index], stops[index + 1], scaled - index);
  }

  function resolveBackground(palette, width, height) {
    const preset = backgrounds[state.style.background];
    const base = preset ?? {
      outer: palette.background,
      inner: palette.background2,
      light: palette.blend === "multiply",
    };
    const rawStrength = Number(state.style.gradientStrength);
    const strength = Number.isFinite(rawStrength) ? clamp(rawStrength, 0, 1) : 0.78;
    const requestedShape = state.style.gradient;
    const shape = ["halo", "corner", "diagonal", "horizon", "solid"].includes(requestedShape)
      ? requestedShape
      : "halo";
    const inner = mixColor(base.outer, base.inner, strength);
    let geometry;

    if (shape === "solid" || strength === 0) {
      geometry = { type: "solid" };
    } else if (shape === "corner") {
      geometry = {
        type: "radial",
        fx: width * 0.24,
        fy: height * 0.22,
        cx: width * 0.24,
        cy: height * 0.22,
        radius: Math.max(width, height) * 0.92,
        stops: [
          [0, inner],
          [1, base.outer],
        ],
      };
    } else if (shape === "diagonal") {
      geometry = {
        type: "linear",
        x1: 0,
        y1: 0,
        x2: width,
        y2: height,
        stops: [
          [0, base.outer],
          [1, inner],
        ],
      };
    } else if (shape === "horizon") {
      geometry = {
        type: "linear",
        x1: 0,
        y1: 0,
        x2: 0,
        y2: height,
        stops: [
          [0, base.outer],
          [0.56, inner],
          [1, base.outer],
        ],
      };
    } else {
      geometry = {
        type: "radial",
        fx: width * 0.47,
        fy: height * 0.43,
        cx: width * 0.5,
        cy: height * 0.5,
        radius: Math.max(width, height) * 0.72,
        stops: [
          [0, inner],
          [1, base.outer],
        ],
      };
    }

    return {
      outer: base.outer,
      inner,
      light: base.light,
      shape,
      strength,
      blend: base.light ? "multiply" : palette.blend,
      glowGain: base.light ? 0.72 : 1,
      geometry,
    };
  }

  function getOutputDimensions() {
    const width = Number(elements.resolutionInput.value);
    const height = state.aspect === "16:9" ? Math.round((width * 9) / 16) : Math.round((width * 2) / 3);
    return { width, height };
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function setStatus(message, error = false) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.dataset.error = error ? "true" : "false";
  }

  function setBusy(busy, message = "Integrating the system…") {
    state.pending = busy;
    updateControlAvailability();
    if (busy) setStatus(message);
  }

  function updateControlAvailability() {
    $$('input, select, button').forEach((control) => { control.disabled = state.exporting; });
    elements.renderProgress.hidden = !state.pending && !state.exporting;
    elements.canvasFrame.setAttribute('aria-busy', String(state.pending || state.exporting));
    const unavailable = state.pending || state.exporting || !state.modelValid || !state.trajectory;
    elements.exportButtons.forEach((button) => { button.disabled = unavailable; });
    elements.traceButton.disabled = unavailable;
  }

  function setExportBusy(busy, label = "Rendering PNG…") {
    state.exporting = busy;
    updateControlAvailability();
    elements.exportPngButton.textContent = busy ? label : "Export PNG";
  }

  function readModelControls() {
    if (elements.initialInputs.some((input) => input.value.trim() === '')) {
      throw new TypeError("Enter a number for each initial coordinate.");
    }
    const initial = elements.initialInputs.map((input) => Number(input.value));
    if (initial.some((value) => !Number.isFinite(value))) {
      throw new TypeError("Initial x, y, and z must all be finite numbers.");
    }
    if (['halvorsen', 'thomas'].includes(state.selectedSystem) && Math.max(...initial) - Math.min(...initial) < 1e-10) {
      throw new RangeError("Choose an asymmetric initial state so the orbit can enter the attractor.");
    }

    const dt = Number(elements.stepInput.value);
    const burnTime = Number(elements.burnInInput.value);

    return {
      system: state.selectedSystem,
      parameters: Object.fromEntries([...elements.parameterInputs].map(([key, control]) => [key, Number(control.input.value)])),
      burnIn: Math.ceil(burnTime / dt),
      dt,
      initial,
      steps: Number(elements.detailInput.value),
    };
  }

  function updateLabels() {
    const dimensions = getOutputDimensions();
    for (const { input, output } of elements.parameterInputs.values()) {
      output.value = Number(input.value).toLocaleString('en-US', { maximumFractionDigits: 6 });
      output.textContent = output.value;
    }
    elements.strokeOutput.value = `${state.style.stroke.toFixed(2)} px`;
    elements.strokeOutput.textContent = elements.strokeOutput.value;
    elements.glowOutput.value = `${Math.round(state.style.glow * 100)}%`;
    elements.glowOutput.textContent = elements.glowOutput.value;
    elements.gradientStrengthOutput.value = `${Math.round(state.style.gradientStrength * 100)}%`;
    elements.gradientStrengthOutput.textContent = elements.gradientStrengthOutput.value;
    elements.zoomOutput.value = `${Math.round(state.camera.zoom * 100)}%`;
    elements.zoomOutput.textContent = elements.zoomOutput.value;
    elements.perspectiveOutput.value = `${Math.round(state.camera.perspective * 100)}%`;
    elements.perspectiveOutput.textContent = elements.perspectiveOutput.value;
    elements.dimensionOutput.value = `${dimensions.width} × ${dimensions.height}`;
    elements.dimensionOutput.textContent = elements.dimensionOutput.value;
    const displayedSystem = Attractors.getSystem(state.model.system);
    elements.stageMark.textContent = displayedSystem.name;
    elements.footerState.textContent = `x₀ ${state.model.initial[0].toFixed(2)} · y₀ ${state.model.initial[1].toFixed(2)} · z₀ ${state.model.initial[2].toFixed(2)}`;
    elements.canvas.setAttribute(
      "aria-label",
      `Three-dimensional ${displayedSystem.name} trajectory, rendered from ${formatCount(state.model.steps)} samples. Drag to rotate the view.`,
    );
  }

  function configureSystem(id) {
    const system = Attractors.getSystem(id);
    state.selectedSystem = id;
    elements.systemInput.value = id;
    elements.parameterControls.replaceChildren();
    elements.parameterInputs.clear();
    for (const spec of system.parameters) {
      const label = document.createElement('label');
      label.className = 'range-field';
      const caption = document.createElement('span');
      const name = document.createElement('span');
      name.textContent = spec.label;
      const output = document.createElement('output');
      const input = document.createElement('input');
      input.type = 'range';
      input.id = `parameter-${spec.key}`;
      input.min = String(spec.min);
      input.max = String(spec.max);
      // Preserve exact preset values such as beta = 8/3; a coarse step would
      // cause the browser to round them before the first integration.
      input.step = 'any';
      input.value = String(spec.value);
      label.htmlFor = input.id;
      output.setAttribute('for', input.id);
      caption.append(name, output);
      label.append(caption, input);
      elements.parameterControls.append(label);
      elements.parameterInputs.set(spec.key, { input, output });
      input.addEventListener('input', () => { updateLabels(); scheduleReintegration(); });
    }
    elements.stepInput.replaceChildren(...system.timeSteps.map(value => {
      const option = document.createElement('option');
      option.value = String(value); option.textContent = String(value); return option;
    }));
    elements.stepInput.value = String(system.dt);
    elements.burnInInput.value = String(system.burnTime);
    elements.detailInput.value = '128000';
    elements.initialInputs.forEach((input, index) => { input.value = String(system.initial[index]); });
    elements.systemDescription.textContent = system.description;
    elements.systemEquations.replaceChildren(...system.equations.map(equation => {
      const line = document.createElement('p'); line.textContent = equation; return line;
    }));
    elements.systemSource.href = system.source;
    elements.systemSource.textContent = system.sourceLabel;
    Object.assign(state.camera, system.camera, { perspective: 0.18 });
    elements.zoomInput.value = String(state.camera.zoom);
    elements.perspectiveInput.value = String(state.camera.perspective);
    markCameraPreset('hero');
    updateLabels();
  }

  function projectTrajectory(trajectory, width, height, count, options = {}) {
    // Fit the complete orbit, even while Trace reveals only its first portion.
    // Otherwise every frame would move and rescale already-visible points.
    const sourceCount = trajectory.config.steps;
    const visibleCount = clamp(Math.floor(count), 2, sourceCount);
    const sampleCount = Math.min(sourceCount, options.maxPoints ?? sourceCount);
    const bucketCount = options.bucketCount ?? 40;
    const rotated = new Float32Array(sampleCount * 3);
    const projected = new Float32Array(sampleCount * 3);
    const center = trajectory.center;
    const cy = Math.cos(state.camera.yaw);
    const sy = Math.sin(state.camera.yaw);
    const cp = Math.cos(state.camera.pitch);
    const sp = Math.sin(state.camera.pitch);
    const cr = Math.cos(state.camera.roll);
    const sr = Math.sin(state.camera.roll);
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let index = 0; index < sampleCount; index += 1) {
      const offset = index * 3;
      const sourceIndex = Math.min(
        sourceCount - 1,
        Math.round((index * (sourceCount - 1)) / Math.max(1, sampleCount - 1)),
      );
      const sourceOffset = sourceIndex * 3;
      const x = trajectory.points[sourceOffset] - center[0];
      const y = trajectory.points[sourceOffset + 1] - center[1];
      const z = trajectory.points[sourceOffset + 2] - center[2];
      const yawX = cy * x + sy * z;
      const yawZ = -sy * x + cy * z;
      const pitchY = cp * y - sp * yawZ;
      const pitchZ = sp * y + cp * yawZ;
      rotated[offset] = cr * yawX - sr * pitchY;
      rotated[offset + 1] = sr * yawX + cr * pitchY;
      rotated[offset + 2] = pitchZ;
      minZ = Math.min(minZ, pitchZ);
      maxZ = Math.max(maxZ, pitchZ);
    }

    const zSpan = Math.max(maxZ - minZ, Number.EPSILON);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let index = 0; index < sampleCount; index += 1) {
      const offset = index * 3;
      const depth = (rotated[offset + 2] - minZ) / zSpan;
      const perspective = 1 / (1 - state.camera.perspective * (depth * 2 - 1));
      const x = rotated[offset] * perspective;
      const y = rotated[offset + 1] * perspective;
      projected[offset] = x;
      projected[offset + 1] = y;
      projected[offset + 2] = depth;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const spanX = Math.max(maxX - minX, Number.EPSILON);
    const spanY = Math.max(maxY - minY, Number.EPSILON);
    const safeWidth = width * 0.86;
    const safeHeight = height * 0.84;
    const scale = Math.min(safeWidth / spanX, safeHeight / spanY) * state.camera.zoom;
    const midpointX = (minX + maxX) * 0.5;
    const midpointY = (minY + maxY) * 0.5;

    for (let index = 0; index < sampleCount; index += 1) {
      const offset = index * 3;
      projected[offset] = width * 0.5 + (projected[offset] - midpointX) * scale;
      projected[offset + 1] = height * 0.5 - (projected[offset + 1] - midpointY) * scale;
    }

    const bins = new Uint8Array(Math.max(0, sampleCount - 1));
    for (let index = 1; index < sampleCount; index += 1) {
      const offset = index * 3;
      const previousOffset = offset - 3;
      const averageDepth = (projected[offset + 2] + projected[previousOffset + 2]) * 0.5;
      bins[index - 1] = Math.min(bucketCount - 1, Math.floor(averageDepth * bucketCount));
    }

    const revealedSamples = Math.max(2, Math.floor((visibleCount - 1) * (sampleCount - 1) / (sourceCount - 1)) + 1);
    return {
      bucketCount,
      bins: bins.subarray(0, revealedSamples - 1),
      points: projected.subarray(0, revealedSamples * 3),
      sampleCount: revealedSamples,
      sourceCount,
    };
  }

  function buildCanvasPaths(projection) {
    const paths = Array.from({ length: projection.bucketCount }, () => new Path2D());
    let previousBin = -1;

    for (let index = 1; index < projection.sampleCount; index += 1) {
      const offset = index * 3;
      const previousOffset = offset - 3;
      const bin = projection.bins[index - 1];
      const path = paths[bin];
      if (bin !== previousBin) {
        path.moveTo(projection.points[previousOffset], projection.points[previousOffset + 1]);
      }
      path.lineTo(projection.points[offset], projection.points[offset + 1]);
      previousBin = bin;
    }

    return paths;
  }

  function paintBackground(context, width, height, background) {
    context.save();
    context.fillStyle = background.outer;
    context.fillRect(0, 0, width, height);

    if (background.geometry.type === "solid") {
      context.restore();
      return;
    }

    let gradient;
    if (background.geometry.type === "radial") {
      gradient = context.createRadialGradient(
        background.geometry.fx,
        background.geometry.fy,
        0,
        background.geometry.cx,
        background.geometry.cy,
        background.geometry.radius,
      );
    } else {
      gradient = context.createLinearGradient(
        background.geometry.x1,
        background.geometry.y1,
        background.geometry.x2,
        background.geometry.y2,
      );
    }

    background.geometry.stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  function strokeDepthPaths(context, paths, palette, width, alphaScale) {
    for (let bin = 0; bin < paths.length; bin += 1) {
      const depth = (bin + 0.5) / paths.length;
      context.strokeStyle = samplePalette(palette.stops, depth);
      context.globalAlpha = alphaScale * (0.38 + depth * 0.62);
      context.lineWidth = width * (0.72 + depth * 0.38);
      context.stroke(paths[bin]);
    }
  }

  function renderCanvas(canvas, trajectory, options = {}) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("A 2D canvas context is unavailable.");

    const width = canvas.width;
    const height = canvas.height;
    const reveal = options.reveal ?? 1;
    const count = Math.max(2, Math.floor(trajectory.config.steps * reveal));
    const bucketCount = options.exporting ? 56 : options.interactive ? 24 : 40;
    const projection = projectTrajectory(trajectory, width, height, count, {
      bucketCount,
      maxPoints: options.exporting
        ? count
        : options.interactive
          ? INTERACTIVE_SAMPLE_LIMIT
          : PREVIEW_SAMPLE_LIMIT,
    });
    const paths = buildCanvasPaths(projection);
    const palette = palettes[state.style.palette];
    const background = resolveBackground(palette, width, height);
    const baseWidth = state.style.stroke * (height / 1080);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    paintBackground(context, width, height, background);
    context.lineCap = "round";
    context.lineJoin = "round";

    if (state.style.glow > 0) {
      context.save();
      context.globalCompositeOperation = background.blend;
      if (!options.interactive) {
        strokeDepthPaths(
          context,
          paths,
          palette,
          baseWidth * (4.2 + state.style.glow * 3.2),
          0.055 * state.style.glow * background.glowGain,
        );
      }
      strokeDepthPaths(
        context,
        paths,
        palette,
        baseWidth * (2 + state.style.glow),
        0.11 * state.style.glow * background.glowGain,
      );
      context.restore();
    }

    context.save();
    context.globalCompositeOperation = "source-over";
    strokeDepthPaths(context, paths, palette, baseWidth, 0.82);
    context.restore();

    if (reveal < 0.999) {
      const last = (projection.sampleCount - 1) * 3;
      const depth = projection.points[last + 2];
      context.save();
      context.fillStyle = samplePalette(palette.stops, depth);
      context.globalCompositeOperation = background.blend;
      context.globalAlpha = background.glowGain;
      context.beginPath();
      context.arc(projection.points[last], projection.points[last + 1], baseWidth * 3.2, 0, TAU);
      context.fill();
      context.restore();
    }
  }

  function scheduleDraw() {
    if (state.drawRequest) return;
    state.drawRequest = requestAnimationFrame(() => {
      state.drawRequest = 0;
      drawPreview();
    });
  }

  function resizePreview() {
    const rect = elements.canvasFrame.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (elements.canvas.width !== width || elements.canvas.height !== height) {
      elements.canvas.width = width;
      elements.canvas.height = height;
      scheduleDraw();
    }
  }

  function drawPreview() {
    if (!state.trajectory || elements.canvas.width < 2 || elements.canvas.height < 2) return;
    try {
      renderCanvas(elements.canvas, state.trajectory, {
        interactive: state.interacting || state.playing,
        reveal: state.reveal,
      });
    } catch (error) {
      setStatus(error.message || "The preview could not be rendered.", true);
    }
  }

  function updateModelMetadata() {
    if (!state.trajectory) return;
    const span = state.trajectory.max.map((value, axis) => value - state.trajectory.min[axis]);
    const previewNote =
      state.model.steps > PREVIEW_SAMPLE_LIMIT ? ` · ${formatCount(PREVIEW_SAMPLE_LIMIT)} preview` : "";
    elements.renderMeta.textContent = `${formatCount(state.model.steps)} samples${previewNote} · t ${(
      state.model.steps * state.model.dt
    ).toFixed(0)} · RK4`;
    setStatus(`Trajectory ready · extent ${span.map((value) => value.toFixed(1)).join(" × ")} model units`);
    updateLabels();
  }

  async function recomputeTrajectory() {
    const generation = ++state.generation;
    state.modelValid = false;
    setBusy(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      const model = readModelControls();
      const trajectory = Attractors.integrate(model);
      if (generation !== state.generation) return;
      state.model = model;
      state.trajectory = trajectory;
      state.modelValid = true;
      state.reveal = 1;
      stopTrace();
      updateModelMetadata();
      scheduleDraw();
    } catch (error) {
      if (generation === state.generation) {
        const retained = state.trajectory ? ` Showing the last valid ${Attractors.getSystem(state.model.system).name} trajectory. Change the settings or reset the system to export.` : ' Change the settings or reset the system to try again.';
        setStatus((error.message || "The trajectory could not be integrated.") + retained, true);
      }
    } finally {
      if (generation === state.generation) setBusy(false);
    }
  }

  function scheduleReintegration(delay = 130) {
    window.clearTimeout(state.reintegrateTimer);
    stopTrace();
    state.modelValid = false;
    setBusy(true);
    state.reintegrateTimer = window.setTimeout(recomputeTrajectory, delay);
  }

  function markCameraPreset(activeName = "") {
    $$('[data-camera]').forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.camera === activeName ? "true" : "false");
    });
  }

  function applyCameraPreset(name) {
    if (state.exporting) return;
    const preset = name === 'hero' ? Attractors.getSystem(state.selectedSystem).camera : cameraPresets[name];
    if (!preset) return;
    Object.assign(state.camera, preset);
    elements.zoomInput.value = String(state.camera.zoom);
    updateLabels();
    markCameraPreset(name);
    scheduleDraw();
  }

  function stopTrace() {
    state.playing = false;
    cancelAnimationFrame(state.animationRequest);
    state.animationRequest = 0;
    elements.traceButton.setAttribute("aria-pressed", "false");
    elements.traceButtonLabel.textContent = "Trace";
    if (state.trajectory) scheduleDraw();
  }

  function startTrace() {
    if (!state.trajectory || !state.modelValid || state.pending || state.exporting) return;
    if (state.playing) {
      stopTrace();
      return;
    }

    state.playing = true;
    if (state.reveal >= 0.999) state.reveal = 0.008;
    elements.traceButton.setAttribute("aria-pressed", "true");
    elements.traceButtonLabel.textContent = "Pause";
    let previousTime = performance.now();

    const advance = (time) => {
      if (!state.playing) return;
      const elapsed = Math.min(50, time - previousTime);
      previousTime = time;
      state.reveal = Math.min(1, state.reveal + elapsed / 11000);
      drawPreview();
      if (state.reveal >= 1) {
        stopTrace();
        setStatus("Trace complete · full trajectory restored");
      } else {
        state.animationRequest = requestAnimationFrame(advance);
      }
    };

    state.animationRequest = requestAnimationFrame(advance);
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function exportFilename(extension, dimensions) {
    const parameters = Object.entries(state.model.parameters).map(([key, value]) => `${key}${Number(value.toFixed(6))}`.replaceAll('.', '-')).join('-');
    const ratio = state.aspect.replace(":", "x");
    return `${state.model.system}-${parameters}-${ratio}-${dimensions.width}x${dimensions.height}.${extension}`;
  }

  async function exportPng() {
    if (!state.trajectory || !state.modelValid || state.pending || state.exporting) return;
    const dimensions = getOutputDimensions();
    const filename = exportFilename("png", dimensions);
    stopTrace();
    setExportBusy(true);
    setStatus(`Rendering ${dimensions.width} × ${dimensions.height} PNG…`);
    await new Promise((resolve) => window.setTimeout(resolve, 30));

    const exportCanvas = document.createElement("canvas");
    try {
      exportCanvas.width = dimensions.width;
      exportCanvas.height = dimensions.height;
      renderCanvas(exportCanvas, state.trajectory, { exporting: true, reveal: 1 });
      const blob = await new Promise((resolve, reject) => {
        exportCanvas.toBlob((value) => {
          if (value) resolve(value);
          else reject(new Error("The browser could not encode the PNG."));
        }, "image/png");
      });
      downloadBlob(blob, filename);
      setStatus(`PNG ready · ${dimensions.width} × ${dimensions.height}`);
    } catch (error) {
      setStatus(`${error.message || "PNG export failed"} Try a smaller output size.`, true);
    } finally {
      exportCanvas.width = 1;
      exportCanvas.height = 1;
      setExportBusy(false);
    }
  }

  function escapeXml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function buildSvgPathData(projection) {
    const commands = Array.from({ length: projection.bucketCount }, () => []);
    const lastBinSeen = new Uint8Array(projection.bucketCount);

    for (let index = 1; index < projection.sampleCount; index += 1) {
      const offset = index * 3;
      const previousOffset = offset - 3;
      const bin = projection.bins[index - 1];
      const bucket = commands[bin];
      const previousBin = index > 1 ? projection.bins[index - 2] : -1;
      if (previousBin !== bin || !lastBinSeen[bin]) {
        bucket.push(
          `M${projection.points[previousOffset].toFixed(1)} ${projection.points[previousOffset + 1].toFixed(1)}`,
        );
      }
      bucket.push(`L${projection.points[offset].toFixed(1)} ${projection.points[offset + 1].toFixed(1)}`);
      lastBinSeen[bin] = 1;
    }

    return commands.map((bucket) => bucket.join(""));
  }

  function serializeSvgBackground(background) {
    if (background.geometry.type === "solid") {
      return { definition: "", fill: background.outer };
    }

    const stops = background.geometry.stops
      .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
      .join("");
    const definition =
      background.geometry.type === "radial"
        ? `<radialGradient id="bg" gradientUnits="userSpaceOnUse" color-interpolation="sRGB" fx="${background.geometry.fx.toFixed(2)}" fy="${background.geometry.fy.toFixed(2)}" cx="${background.geometry.cx.toFixed(2)}" cy="${background.geometry.cy.toFixed(2)}" r="${background.geometry.radius.toFixed(2)}">${stops}</radialGradient>`
        : `<linearGradient id="bg" gradientUnits="userSpaceOnUse" color-interpolation="sRGB" x1="${background.geometry.x1.toFixed(2)}" y1="${background.geometry.y1.toFixed(2)}" x2="${background.geometry.x2.toFixed(2)}" y2="${background.geometry.y2.toFixed(2)}">${stops}</linearGradient>`;

    return { definition, fill: "url(#bg)" };
  }

  function serializeSvg(trajectory, dimensions) {
    const bucketCount = 44;
    const projection = projectTrajectory(trajectory, dimensions.width, dimensions.height, trajectory.config.steps, {
      bucketCount,
    });
    const pathData = buildSvgPathData(projection);
    const palette = palettes[state.style.palette];
    const background = resolveBackground(palette, dimensions.width, dimensions.height);
    const svgBackground = serializeSvgBackground(background);
    const baseWidth = state.style.stroke * (dimensions.height / 1080);
    const metadata = escapeXml(
      JSON.stringify({
        system: Attractors.getSystem(trajectory.config.system).name,
        equations: Attractors.getSystem(trajectory.config.system).equations,
        model: trajectory.config,
        camera: state.camera,
        style: state.style,
        aspect: state.aspect,
      }),
    );

    const definitions = pathData
      .map((path, index) => `<path id="depth-${index}" d="${path}"/>`)
      .join("");

    const uses = (widthMultiplier, alphaMultiplier) =>
      pathData
        .map((_, index) => {
          const depth = (index + 0.5) / bucketCount;
          const color = samplePalette(palette.stops, depth);
          const opacity = alphaMultiplier * (0.38 + depth * 0.62);
          return `<use href="#depth-${index}" stroke="${color}" stroke-width="${(
            baseWidth *
            widthMultiplier *
            (0.72 + depth * 0.38)
          ).toFixed(3)}" opacity="${opacity.toFixed(4)}"/>`;
        })
        .join("");

    const glowLayers =
      state.style.glow > 0
        ? `<g style="mix-blend-mode:${background.blend}">${uses(
            4.2 + state.style.glow * 3.2,
            0.055 * state.style.glow * background.glowGain,
          )}${uses(2 + state.style.glow, 0.11 * state.style.glow * background.glowGain)}</g>`
        : "";

    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}" role="img" aria-labelledby="title desc">`,
      `<title id="title">${escapeXml(Attractors.getSystem(trajectory.config.system).name)} trajectory</title>`,
      `<desc id="desc">Numerically integrated trajectory. System, parameters, initial state, camera and styling are recorded in the metadata.</desc>`,
      `<metadata>${metadata}</metadata>`,
      `<defs>${svgBackground.definition}<clipPath id="artboard"><rect width="${dimensions.width}" height="${dimensions.height}"/></clipPath>${definitions}</defs>`,
      `<rect width="${dimensions.width}" height="${dimensions.height}" fill="${svgBackground.fill}"/>`,
      `<g clip-path="url(#artboard)" fill="none" stroke-linecap="round" stroke-linejoin="round">${glowLayers}<g>${uses(1, 0.82)}</g></g>`,
      `</svg>`,
    ].join("");
  }

  async function exportSvg() {
    if (!state.trajectory || !state.modelValid || state.pending || state.exporting) return;
    const dimensions = getOutputDimensions();
    const filename = exportFilename("svg", dimensions);
    stopTrace();
    setExportBusy(true, "Rendering…");
    setStatus(`Rendering ${dimensions.width} × ${dimensions.height} SVG…`);
    await new Promise((resolve) => window.setTimeout(resolve, 30));

    try {
      const svg = serializeSvg(state.trajectory, dimensions);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      downloadBlob(blob, filename);
      setStatus(`SVG ready · ${(blob.size / 1048576).toFixed(1)} MB`);
    } catch (error) {
      setStatus(error.message || "SVG export failed.", true);
    } finally {
      setExportBusy(false);
    }
  }

  function bindControls() {
    elements.systemInput.addEventListener('change', () => {
      configureSystem(elements.systemInput.value);
      scheduleReintegration(0);
    });

    $("#resetSystemButton").addEventListener("click", () => {
      configureSystem(state.selectedSystem);
      scheduleReintegration(0);
    });

    [elements.detailInput, elements.stepInput, elements.burnInInput].forEach((input) => {
      input.addEventListener("change", () => scheduleReintegration(0));
    });

    elements.initialInputs.forEach((input) => {
      input.addEventListener("change", () => scheduleReintegration(0));
    });

    elements.paletteInput.addEventListener("change", () => {
      state.style.palette = elements.paletteInput.value;
      scheduleDraw();
    });

    elements.backgroundInput.addEventListener("change", () => {
      state.style.background = elements.backgroundInput.value;
      scheduleDraw();
    });

    elements.gradientInput.addEventListener("change", () => {
      state.style.gradient = elements.gradientInput.value;
      scheduleDraw();
    });

    elements.gradientStrengthInput.addEventListener("input", () => {
      state.style.gradientStrength = Number(elements.gradientStrengthInput.value);
      updateLabels();
      scheduleDraw();
    });

    elements.strokeInput.addEventListener("input", () => {
      state.style.stroke = Number(elements.strokeInput.value);
      updateLabels();
      scheduleDraw();
    });

    elements.glowInput.addEventListener("input", () => {
      state.style.glow = Number(elements.glowInput.value);
      updateLabels();
      scheduleDraw();
    });

    elements.zoomInput.addEventListener("input", () => {
      state.camera.zoom = Number(elements.zoomInput.value);
      markCameraPreset();
      updateLabels();
      scheduleDraw();
    });

    elements.perspectiveInput.addEventListener("input", () => {
      state.camera.perspective = Number(elements.perspectiveInput.value);
      markCameraPreset();
      updateLabels();
      scheduleDraw();
    });

    $$('input[name="aspect"]').forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        state.aspect = input.value;
        elements.canvasFrame.dataset.aspect = state.aspect;
        updateLabels();
        requestAnimationFrame(resizePreview);
      });
    });

    elements.resolutionInput.addEventListener("change", updateLabels);
    elements.resetCameraButton.addEventListener("click", () => applyCameraPreset("hero"));
    $$('[data-camera]').forEach((button) => {
      button.addEventListener("click", () => applyCameraPreset(button.dataset.camera));
    });

    elements.newOrbitButton.addEventListener("click", () => {
      state.seed += 1;
      const initial = Attractors.seededInitial(state.seed, state.selectedSystem);
      elements.initialInputs.forEach((input, index) => {
        input.value = String(initial[index]);
      });
      scheduleReintegration(0);
    });

    elements.traceButton.addEventListener("click", startTrace);
    elements.exportPngButton.addEventListener("click", exportPng);
    elements.exportPngPanelButton.addEventListener("click", exportPng);
    elements.exportSvgButton.addEventListener("click", exportSvg);
  }

  function bindCamera() {
    let drag = null;

    elements.canvas.addEventListener("pointerdown", (event) => {
      if (state.exporting || drag) return;
      elements.canvas.setPointerCapture(event.pointerId);
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        yaw: state.camera.yaw,
        pitch: state.camera.pitch,
        roll: state.camera.roll,
        rolling: event.shiftKey || event.button === 2,
      };
      state.interacting = true;
      markCameraPreset();
    });

    elements.canvas.addEventListener("pointermove", (event) => {
      if (state.exporting) return;
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (drag.rolling) {
        state.camera.roll = drag.roll + dx * 0.006;
      } else {
        state.camera.yaw = drag.yaw + dx * 0.006;
        state.camera.pitch = clamp(drag.pitch + dy * 0.006, -Math.PI * 0.49, Math.PI * 0.49);
      }
      scheduleDraw();
    });

    const endDrag = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      state.interacting = false;
      if (elements.canvas.hasPointerCapture(event.pointerId)) elements.canvas.releasePointerCapture(event.pointerId);
      scheduleDraw();
    };

    elements.canvas.addEventListener("pointerup", endDrag);
    elements.canvas.addEventListener("pointercancel", endDrag);
    elements.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    elements.canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        if (state.exporting) return;
        state.interacting = true;
        window.clearTimeout(state.wheelTimer);
        state.camera.zoom = clamp(state.camera.zoom * Math.exp(-event.deltaY * 0.001), 0.65, 1.5);
        elements.zoomInput.value = String(state.camera.zoom);
        markCameraPreset();
        updateLabels();
        scheduleDraw();
        state.wheelTimer = window.setTimeout(() => {
          state.interacting = false;
          scheduleDraw();
        }, 140);
      },
      { passive: false },
    );

    elements.canvas.addEventListener("dblclick", () => applyCameraPreset("hero"));
    elements.canvas.addEventListener("keydown", (event) => {
      if (state.exporting) return;
      let handled = true;
      switch (event.key) {
        case "ArrowLeft":
          state.camera.yaw -= 0.06;
          break;
        case "ArrowRight":
          state.camera.yaw += 0.06;
          break;
        case "ArrowUp":
          state.camera.pitch = clamp(state.camera.pitch - 0.06, -Math.PI * 0.49, Math.PI * 0.49);
          break;
        case "ArrowDown":
          state.camera.pitch = clamp(state.camera.pitch + 0.06, -Math.PI * 0.49, Math.PI * 0.49);
          break;
        case "+":
        case "=":
          state.camera.zoom = clamp(state.camera.zoom * 1.05, 0.65, 1.5);
          break;
        case "-":
        case "_":
          state.camera.zoom = clamp(state.camera.zoom / 1.05, 0.65, 1.5);
          break;
        case "r":
        case "R":
          applyCameraPreset("hero");
          return;
        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
        elements.zoomInput.value = String(state.camera.zoom);
        markCameraPreset();
        updateLabels();
        scheduleDraw();
      }
    });
  }

  function initialise() {
    elements.systemInput.replaceChildren(...Object.values(Attractors.systems).map(system => {
      const option = document.createElement('option'); option.value = system.id; option.textContent = system.name; return option;
    }));
    configureSystem('halvorsen');
    bindControls();
    bindCamera();
    elements.canvasFrame.dataset.aspect = state.aspect;
    updateLabels();

    const resizeObserver = new ResizeObserver(resizePreview);
    resizeObserver.observe(elements.canvasFrame);
    window.addEventListener("resize", resizePreview, { passive: true });
    resizePreview();
    recomputeTrajectory();
  }

  initialise();
})();
