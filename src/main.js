import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import "../styles.css";
import "../theme.css";
import { preloadAssets } from "./assets.js";
import { CARS, CONFIG, timeString } from "./config.js";
import { GameState } from "./core/GameState.js";
import { GameLoop } from "./core/GameLoop.js";
import { Storage } from "./core/Storage.js";
import { InputManager } from "./input/InputManager.js";
import { WorkshopScene } from "./world/WorkshopScene.js";
import { TrackSampler } from "./track/TrackSampler.js";
import { TrackBuilder } from "./track/TrackBuilder.js";
import { CarModel } from "./car/CarFactory.js";
import { placeCarOnTrack } from "./car/CarPlacement.js";
import { RaceManager } from "./race/RaceManager.js";
import { CameraRig } from "./camera/CameraRig.js";
import { WeatherSystem } from "./weather/WeatherSystem.js";
import { AudioManager } from "./audio/AudioManager.js";
import { hasAudioOutput, musicEnabled } from "./audio/MusicManager.js";
import { ReplayRecorder } from "./replay/ReplayRecorder.js";
import { HUD } from "./ui/HUD.js";

function showError(message) {
  const loading = document.querySelector("#loading");
  loading.hidden = false;
  loading.replaceChildren();
  const title = document.createElement("h2");
  title.textContent = "작업실을 열지 못했습니다.";
  const text = document.createElement("p");
  text.textContent = message;
  const retry = document.createElement("button");
  retry.className = "primary";
  retry.textContent = "다시 불러오기";
  retry.onclick = () => location.reload();
  loading.append(title, text, retry);
}

try {
  await preloadAssets();
  const storage = new Storage();
  if (storage.fresh && matchMedia("(prefers-reduced-motion: reduce)").matches)
    storage.data.reducedMotion = true;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.querySelector("#stage").append(renderer.domElement);
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    loop.stop();
    audio.setActive(false);
    showError(
      "3D 그래픽 연결이 끊어졌습니다. 다른 그래픽 앱을 닫고 다시 불러와 주세요.",
    );
  });
  const track = new TrackSampler(),
    workshop = new WorkshopScene(),
    trackVisual = new TrackBuilder(track);
  workshop.race.add(trackVisual.root);
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(room, 0.04);
  workshop.garage.environment = workshop.race.environment =
    environmentTarget.texture;
  workshop.garage.environmentIntensity = 0.55;
  workshop.race.environmentIntensity = 0.45;
  room.dispose();
  pmrem.dispose();
  const cameras = new CameraRig(renderer.domElement, track),
    weather = new WeatherSystem(workshop.race, trackVisual),
    audio = new AudioManager(storage.data, (status) => ui.setAudioStatus(status), (status) => ui.setMusicStatus(status));
  const garageModels = new Map(),
    raceModels = new Map();
  for (const car of CARS) {
    const model = new CarModel(car);
    model.root.scale.setScalar(1.55);
    model.root.position.y = 0.0475 + (model.tireRadius - 0.43) * 1.55;
    model.root.visible = false;
    workshop.garage.add(model.root);
    garageModels.set(car.id, model);
    const raceModel = new CarModel(car);
    raceModel.root.scale.setScalar(0.63);
    raceModel.root.visible = false;
    workshop.race.add(raceModel.root);
    raceModels.set(car.id, raceModel);
  }
  const selectionBox = new THREE.BoxHelper(undefined, "#ffaf55");
  selectionBox.material.transparent = true;
  selectionBox.material.opacity = 0.85;
  selectionBox.visible = false;
  workshop.garage.add(selectionBox);
  let selected = CARS.find((c) => c.id === storage.data.selected) ?? CARS[0];
  let race = null,
    recorder = null,
    replayTime = 0,
    replaySpeed = 1,
    replayFrame = null,
    countdown = CONFIG.countdown,
    lastCountdown = 3;
  let resumeState = "racing",
    wheelTest = false,
    uiElapsed = 0,
    garageTime = 0,
    previousFrame = null,
    resultSaved = false;
  let frames = 0,
    fpsTime = 0,
    measuredFps = 0,
    overheatWarning = false;
  const state = new GameState((value) => {
    ui.setState(value);
    input?.clear();
    loop?.reset();
    audio.setActive(["racing", "countdown", "replay"].includes(value));
    audio.music.setScene(value);
    resize();
  });
  const ui = new HUD(storage, {
    action,
    car: chooseCar,
    part: choosePart,
    settings: updateSettings,
    dialogClosed: () => audio.music.setPreview(false),
    seek: (percent) => {
      if (state.value === "replay") {
        replayTime = (recorder.duration * percent) / 100;
        cameras.initialized = false;
      }
    },
  });
  const input = new InputManager({
    active: () => ["racing", "countdown"].includes(state.value),
    onPause: togglePause,
    onCamera: changeCamera,
    onBlur: () => {
      if (["racing", "countdown", "replay"].includes(state.value)) pause();
    },
  });
  const loop = new GameLoop(update, render);
  // Browsers require a user gesture before the garage soundtrack can start.
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest('[data-action="music"], [data-action="sound"], [data-action="test-music"], [data-action="test-sound"]'))
      void requestAudio();
  }, { once: true });
  window.addEventListener("blur", () => audio.music.setHidden(true));
  window.addEventListener("focus", () => audio.music.setHidden(document.hidden));
  document.addEventListener("visibilitychange", () => audio.music.setHidden(document.hidden));

  function chooseCar(id) {
    if (!["loading", "garage"].includes(state.value)) return;
    selected = CARS.find((c) => c.id === id) ?? CARS[0];
    for (const [modelId, model] of garageModels) {
      model.assembled();
      model.root.visible = modelId === selected.id;
      model.root.rotation.y = -0.22;
    }
    selectionBox.visible = false;
    wheelTest = false;
    audio.setActive(false);
    storage.data.selected = selected.id;
    storage.save();
    ui.selectCar(selected);
    cameras.focusPart(null, false);
  }
  function choosePart(id) {
    if (state.value !== "garage") return;
    const model = garageModels.get(selected.id);
    const next = model.selectedPart === id ? null : id;
    model.selectPart(next);
    ui.setPart(next);
    selectionBox.visible = !!next;
    if (next) {
      model.exploded = true;
      ui.setExploded(true);
    }
    cameras.focusPart(next, model.exploded);
  }
  function startRace() {
    if (!["garage", "results", "paused"].includes(state.value)) return;
    ui.closeDialogs();
    audio.update({ speed: 0, boosting: false }, 1);
    input.clear();
    race = new RaceManager(track, selected);
    recorder = new ReplayRecorder();
    recorder.record(race, true);
    replayTime = 0;
    replayFrame = null;
    countdown = CONFIG.countdown;
    lastCountdown = 3;
    previousFrame = race.snapshot();
    resultSaved = false;
    overheatWarning = false;
    garageModels.get(selected.id).assembled();
    wheelTest = false;
    selectionBox.visible = false;
    for (const car of race.cars) {
      const model = raceModels.get(car.id);
      model.assembled();
      model.root.visible = true;
    }
    cameras.setMode(storage.data.reducedMotion ? 1 : 0);
    ui.setCamera(cameras.mode);
    weather.setLap(1);
    ui.lastWeather = null;
    ui.refs.countdown.querySelector("strong").textContent = "3";
    ui.refs["race-notice"].textContent = "";
    state.set("countdown");
    ui.updateRace(race);
    requestAudio({ frequency: 550 });
    if (!hasAudioOutput(storage.data))
      ui.toast("소리가 꺼져 있습니다. 상단 ‘소리 켜기’를 눌러 주세요.");
    document.activeElement?.blur();
  }
  function pause() {
    if (!["racing", "countdown", "replay"].includes(state.value)) return;
    resumeState = state.value;
    state.set("paused");
  }
  function togglePause() {
    if (document.querySelector("dialog[open]")) return;
    if (state.value === "paused") {
      state.set(resumeState);
      requestAudio();
      document.activeElement?.blur();
    } else pause();
  }
  function changeCamera(mode) {
    if (!["racing", "countdown", "replay"].includes(state.value)) return;
    cameras.setMode(typeof mode === "number" ? mode : (cameras.mode + 1) % 6);
    ui.setCamera(cameras.mode);
  }
  function action(name) {
    switch (name) {
      case "start":
      case "restart":
        startRace();
        break;
      case "pause":
      case "resume":
        togglePause();
        break;
      case "garage":
        if (state.value !== "garage" && state.value !== "loading") {
          state.set("garage");
          cameras.garage();
          chooseCar(selected.id);
        }
        break;
      case "explode": {
        const model = garageModels.get(selected.id);
        model.exploded = !model.exploded;
        ui.setExploded(model.exploded);
        cameras.focusPart(model.selectedPart, model.exploded);
        break;
      }
      case "wheel":
        wheelTest = !wheelTest;
        ui.setWheel(wheelTest);
        audio.setActive(wheelTest);
        if (wheelTest) requestAudio();
        break;
      case "camera":
        changeCamera();
        break;
      case "sound":
        storage.data.muted = hasAudioOutput(storage.data);
        if (!storage.data.muted && !hasAudioOutput(storage.data)) storage.data.volume = 0.5;
        storage.save();
        ui.syncSettings();
        audio.sync();
        if (!storage.data.muted) requestAudio({ preview: true, frequency: 740 });
        break;
      case "music":
      case "test-music": {
        const enable = name === "test-music" || !musicEnabled(storage.data) || audio.music.inspect().status === "locked";
        storage.data.musicMuted = !enable;
        if (enable) {
          storage.data.muted = false;
          if (storage.data.musicVolume === 0) storage.data.musicVolume = 0.28;
        }
        if (name === "test-music") audio.music.setPreview(true);
        storage.save();
        ui.syncSettings();
        audio.sync();
        if (enable) requestAudio();
        break;
      }
      case "test-sound":
        storage.data.muted = false;
        if (storage.data.volume === 0) storage.data.volume = 0.5;
        storage.save();
        ui.syncSettings();
        requestAudio({ preview: true, frequency: 740 });
        break;
      case "settings":
        pause();
        audio.setActive(false);
        ui.syncSettings();
        ui.openDialog("settings");
        break;
      case "records":
        ui.openDialog("records");
        break;
      case "assets":
        pause();
        ui.showAsset("lineup");
        break;
      case "track":
        pause();
        ui.showAsset("track");
        break;
      case "car-blueprint":
        ui.showAsset(selected.sheet);
        break;
      case "close-dialog":
        audio.music.setPreview(false);
        ui.closeDialogs();
        break;
      case "replay":
        if (state.value !== "results" || !recorder?.frames.length) break;
        replayTime = 0;
        replaySpeed = 1;
        ui.refs["replay-speed"].textContent = "1×";
        cameras.setMode(1);
        ui.setCamera(1);
        state.set("replay");
        requestAudio();
        break;
      case "end-replay":
        if (state.value === "replay") {
          cameras.setMode(1);
          state.set("results");
          weather.setLap(CONFIG.laps);
        }
        break;
      case "replay-speed":
        replaySpeed = replaySpeed === 0.5 ? 1 : replaySpeed === 1 ? 2 : 0.5;
        ui.refs["replay-speed"].textContent = `${replaySpeed}×`;
        break;
    }
  }
  async function requestAudio({ preview = false, frequency } = {}) {
    if (!hasAudioOutput(storage.data)) return;
    const ready = await audio.unlock();
    if (!ready) {
      ui.toast("오디오를 시작하지 못했습니다. 설정의 ‘소리 확인’을 다시 눌러 주세요.");
      return;
    }
    if (frequency) audio.beep(frequency, preview ? 0.4 : 0.12, preview);
  }
  function updateSettings(changed) {
    storage.data.quality = ui.refs["quality-setting"].value;
    storage.data.reducedMotion = ui.refs["motion-setting"].checked;
    storage.data.muted = !ui.refs["sound-setting"].checked;
    storage.data.volume = Number(ui.refs["volume-setting"].value);
    storage.data.musicMuted = !ui.refs["music-setting"].checked;
    storage.data.musicVolume = Number(ui.refs["music-volume-setting"].value);
    if (changed === "volume" && storage.data.volume > 0) storage.data.muted = false;
    if (changed === "sound" && !storage.data.muted && storage.data.volume === 0)
      storage.data.volume = 0.5;
    if (changed === "music-volume" && storage.data.musicVolume > 0) storage.data.musicMuted = false;
    if (changed === "music" && !storage.data.musicMuted && storage.data.musicVolume === 0)
      storage.data.musicVolume = 0.28;
    if (["music", "music-volume"].includes(changed) && !storage.data.musicMuted) {
      storage.data.muted = false;
      audio.music.setPreview(true);
    }
    storage.save();
    applySettings();
    ui.syncSettings();
    audio.sync();
    if (changed === "sound" || changed === "volume")
      requestAudio({ preview: true, frequency: 740 });
    if (changed === "music" || changed === "music-volume") requestAudio();
  }
  function applySettings() {
    const low = storage.data.quality === "performance";
    renderer.shadowMap.enabled = !low;
    renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
    cameras.reducedMotion = storage.data.reducedMotion;
    weather.enabled = !low;
    weather.setLap(weather.lap);
    resize();
  }
  function resize() {
    const stage = document.querySelector("#stage");
    const garage = state.value === "garage" || state.value === "loading";
    const top =
      document.querySelector(".topbar")?.getBoundingClientRect().height ?? 90;
    const bottom = garage
      ? (document.querySelector(".garage-bottom")?.getBoundingClientRect()
          .height ?? 280)
      : 0;
    const height = Math.max(220, innerHeight - top - bottom);
    stage.style.top = `${top}px`;
    stage.style.bottom = `${bottom}px`;
    renderer.setSize(innerWidth, height);
    cameras.resize(innerWidth, height);
  }
  window.addEventListener("resize", resize);
  function update(dt) {
    if (state.value === "countdown") {
      countdown -= dt;
      const count = Math.ceil(countdown);
      if (count !== lastCountdown && count > 0) {
        lastCountdown = count;
        ui.refs.countdown.querySelector("strong").textContent = count;
        audio.beep(550 + (3 - count) * 80);
      }
      if (countdown <= 0) {
        audio.beep(1100, 0.24);
        state.set("racing");
      }
    } else if (state.value === "racing") {
      previousFrame = race.snapshot();
      race.update(dt, input.read());
      if (race.player.impactCount > previousFrame.cars[0].impactCount) audio.impact();
      recorder.record(race);
      weather.setLap(race.player.lap);
      if (race.player.overheated && !overheatWarning) audio.beep(200, 0.25);
      overheatWarning = race.player.overheated;
      if (race.finished && !resultSaved) {
        resultSaved = true;
        recorder.record(race, true);
        storage.record(race);
        ui.results(race, storage);
        cameras.setMode(1);
        state.set("results");
      }
    } else if (state.value === "replay") {
      replayTime = Math.min(recorder.duration, replayTime + dt * replaySpeed);
      replayFrame = recorder.sample(replayTime);
      weather.setLap(replayFrame.cars[0].lap);
      if (replayTime >= recorder.duration) {
        cameras.setMode(1);
        state.set("results");
      }
    }
  }
  function render(dt, alpha) {
    frames++;
    fpsTime += dt;
    if (fpsTime >= 1) {
      measuredFps = Math.round(frames / fpsTime);
      frames = 0;
      fpsTime = 0;
    }
    const garage = ["loading", "garage"].includes(state.value);
    if (garage) {
      garageTime += dt;
      const model = garageModels.get(selected.id);
      model.update(dt, { wheelTest });
      if (wheelTest && !document.querySelector("dialog[open]")) {
        audio.setActive(true);
        audio.update({ speed: 3, boosting: false }, 1);
      }
      if (model.selectedPart) {
        selectionBox.setFromObject(model.parts[model.selectedPart]);
        selectionBox.visible = true;
      }
      cameras.controls.autoRotate =
        !storage.data.reducedMotion && !model.exploded;
      cameras.controls.autoRotateSpeed = 0.45;
      cameras.update(dt, null, garageTime, true);
    } else if (race) {
      const isReplay =
        state.value === "replay" ||
        (state.value === "paused" && resumeState === "replay");
      const snapshot = isReplay ? recorder.sample(replayTime) : null;
      const cars = snapshot?.cars ?? race.cars;
      const moving = ["racing", "replay"].includes(state.value);
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i],
          model = raceModels.get(car.id);
        const progress =
          !snapshot && state.value === "racing" && previousFrame
            ? previousFrame.cars[i].distance +
              (car.distance - previousFrame.cars[i].distance) * alpha
            : car.distance;
        if (car.finishTime !== null) model.root.visible = false;
        else model.root.visible = true;
        model.update(moving ? dt * (isReplay ? replaySpeed : 1) : 0, {
          speed: moving ? car.speed : 0,
          boost: moving && car.boosting,
          impact: (car.impactRemaining ?? 0) / CONFIG.impactDuration,
          impactSide: car.impactSide,
        });
        placeCarOnTrack(model, track, progress, car.lane);
      }
      if (state.value !== "paused")
        cameras.update(dt, cars[0], snapshot?.time ?? race.time);
      if (moving) {
        weather.update(snapshot?.time ?? race.time);
        audio.update(cars[0], cars[0].lap);
      }
      uiElapsed += dt;
      if (
        uiElapsed > 0.08 &&
        ["racing", "replay", "countdown"].includes(state.value)
      ) {
        uiElapsed = 0;
        ui.updateRace(race, input.read(), snapshot);
        if (snapshot) {
          ui.refs["replay-seek"].value = (replayTime / recorder.duration) * 100;
          ui.refs["replay-time"].textContent = timeString(replayTime).slice(
            0,
            5,
          );
        }
      }
    }
    renderer.render(garage ? workshop.garage : workshop.race, cameras.camera);
  }
  applySettings();
  chooseCar(selected.id);
  state.set("garage");
  document.querySelector("#loading").hidden = true;
  loop.start();
  // Read-only diagnostics in development. Tests drive the actual UI and fixed-step rules.
  if (import.meta.env.DEV) {
    Object.defineProperty(window, "__workbench", {
      value: Object.freeze({
        inspect: () => ({
          state: state.value,
          selected: selected.id,
          exploded: garageModels.get(selected.id).exploded,
          part: garageModels.get(selected.id).selectedPart,
          wheelTest,
          camera: cameras.mode,
          countdown,
          replayTime,
          replayDuration: recorder?.duration ?? 0,
          replayFrames: recorder?.frames.length ?? 0,
          race: race?.snapshot() ?? null,
          records: structuredClone(storage.data.records),
          settings: { ...storage.data, records: undefined },
          keys: [...input.keys],
          fps: measuredFps,
          render: {
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures,
          },
          audio: {
            active: audio.active,
            state: audio.context?.state ?? "locked",
            music: audio.music.inspect(),
          },
        }),
      }),
      writable: false,
    });
  }
} catch (error) {
  console.error(error);
  showError(
    "WebGL을 사용할 수 없거나 필요한 파일을 불러오지 못했습니다. 그래픽 가속이 켜진 최신 Chrome 또는 Safari에서 로컬 서버 주소로 다시 접속해 주세요.",
  );
}
