import { CARS, PARTS, CAMERA_NAMES, CONFIG, timeString } from "../config.js";
import { ASSETS, atlasStyle } from "../assets.js";
import { Speedometer, speedometerMarkup } from "./Speedometer.js";
import "./race-hud.css";
import { MUSIC_TRACKS, hasAudioOutput, musicEnabled } from "../audio/MusicManager.js";
import "./music.css";
const icons = {
  music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  sound:
    '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 5-6 4H2v6h3l6 4zM16 9l6 6m0-6-6 6"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  expand: '<path d="m4 9 8-5 8 5-8 5zM4 13l8 5 8-5M4 17l8 5 8-5"/>',
  wheel:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5m0 6v5M4 12h5m6 0h5"/>',
  flag: '<path d="M5 21V3m0 1c4-4 9 5 14 0v10c-5 5-10-4-14 0"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  rain: '<path d="M5 15a4 4 0 1 1 1-8 6 6 0 0 1 11-1 4 4 0 1 1 2 9M8 18l-1 3m6-3-1 3m6-3-1 3"/>',
  trophy:
    '<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 1h8"/>',
};
export const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.arrow}</svg>`;
const key = (label) => `<kbd>${label}</kbd>`;
export class HUD {
  constructor(storage, handlers) {
    this.storage = storage;
    this.handlers = handlers;
    this.dialogReturnFocus = null;
    document.querySelector("#app").innerHTML = `
      <header class="topbar">
        <a class="brand" href="#" data-action="garage" aria-label="차고로 이동"><span class="brand-symbol">T<span>R</span></span><span>TABLETOP RACERS<small>SMALL CARS. BIG ADVENTURES.</small></span></a>
        <nav class="garage-nav" aria-label="주 메뉴"><span class="nav-active">차고 <i>01</i></span><button data-action="track">서킷 설계도</button><button data-action="assets">에셋 도감</button><button data-action="records">내 기록 ${icon("arrow", 14)}</button></nav>
        <div class="top-actions"><span class="local-badge"><i></i> LOCAL PLAY</span><button class="icon-button" data-action="sound" aria-label="소리 켜기" title="소리 켜기" id="sound-button">${icon("muted")}</button><button class="icon-button" data-action="settings" aria-label="설정" title="설정">${icon("settings")}</button></div>
      </header>
      <main id="garage-screen" class="screen garage-screen" hidden>
        <section class="garage-heading"><div class="eyebrow"><span class="tiny-cross">//</span> BUILD. TUNE. RACE. REPEAT.</div><h1>작은 트랙,<br>끝없는 질주<span>.</span></h1><p>작업대가 서킷이 되는 순간.<br>당신만의 머신으로 레이스를 시작하세요.</p><button class="workshop-preview" data-action="track"><span>WORKSHOP CIRCUIT</span><b>서킷 살펴보기 ${icon("arrow", 15)}</b></button></section>
        <div class="model-caption"><span class="tag">1:32</span><span>PRECISION MINI 4WD</span><span class="caption-line"></span></div>
        <aside class="spec-panel"><div class="spec-top"><span class="eyebrow">MACHINE PROFILE</span><span id="spec-number">01 / 04</span></div><h2 id="car-name">ZEPHYR</h2><div class="car-subtitle"><span id="car-role">BALANCED ALL-ROUNDER</span><span class="color-chip"></span></div><p id="car-description"></p><div id="car-stats"></div><div class="spec-foot"><span>스케일 <b>1:32</b></span><span>구동 방식 <b>4WD</b></span><span>파워 유닛 <b>ELECTRIC</b></span></div><div class="model-controls"><button data-action="explode" id="explode-button">${icon("expand", 17)} 분해도 <span>OFF</span></button><button data-action="wheel" id="wheel-button">${icon("wheel", 17)} 바퀴 테스트</button></div><div id="part-detail"><span class="detail-dot"></span><span>부품을 선택해 자세히 살펴보세요.</span></div><button class="blueprint-link" data-action="car-blueprint">원본 차량·부품 이미지 보기 ${icon("arrow", 14)}</button></aside>
        <div class="orbit-hint"><span>↔</span> 드래그하여 회전 <i>·</i> 스크롤하여 확대</div>
        <section class="garage-bottom"><div class="parts-row"><span class="eyebrow">EXPLORE PARTS</span><div id="parts-list">${PARTS.map(([id, name], i) => `<button data-part="${id}" aria-pressed="false"><small>${String(i + 1).padStart(2, "0")}</small>${name}</button>`).join("")}</div></div>
          <div class="selection-row"><div class="vehicle-selection"><div class="section-label"><span class="eyebrow">SELECT YOUR MACHINE</span><span>04 MACHINES / ONE WORKBENCH</span></div><div class="car-cards">${CARS.map((car) => `<button class="car-card" data-car="${car.id}" style="--car-color:${car.color}" aria-pressed="false"><span class="card-number">${car.number}</span><span class="asset-car" role="img" aria-label="${car.subtitle} 원본 차량 에셋" style="${atlasStyle(car.id)}"></span><span class="card-name">${car.name}<small>${car.role}</small></span><span class="card-selected">↗</span></button>`).join("")}</div></div><div class="start-panel"><div class="track-info">${icon("flag", 18)}<span>작업실 서킷 <small>AI 3대 · ${CONFIG.laps} LAPS · 완주 레이스</small></span></div><button class="primary start-button" data-action="start">레이스 시작 ${icon("arrow", 23)}</button></div></div>
          <footer class="garage-footer"><span>TINY TRACKS. HUGE THRILLS.</span><span>${key("A")}${key("D")} 주행선 ${key("SPACE")} 부스트 ${key("SHIFT")} 안정화</span><span>WORKSHOP EDITION <i>v2.0</i></span></footer>
        </section>
      </main>
      <main id="race-screen" class="screen race-screen" hidden>
        <div class="race-top"><section class="race-metrics"><div class="position-metric"><span class="eyebrow">POSITION</span><strong id="race-position">1<span>/ 4</span></strong></div><div><span class="eyebrow">LAP</span><strong id="race-lap">1 <span>/ ${CONFIG.laps}</span></strong></div><div class="time-metric"><span class="eyebrow">RACE TIME</span><strong id="race-time">00:00.000</strong><small id="best-lap">BEST LAP —</small></div></section><div class="race-options"><button data-action="camera" id="camera-button">${icon("camera", 18)} <span>추격</span> ${key("C")}</button><button class="icon-button" data-action="pause" aria-label="일시정지">${icon("pause")}</button></div></div>
        <div class="leaderboard" id="leaderboard"></div>
        <div class="weather-chip" id="weather-chip">${icon("sun", 18)}<div><b>DRY TRACK</b><span>1랩 · 건조한 노면</span></div></div>
        <div id="countdown" class="countdown" hidden><span>READY TO RACE</span><strong>3</strong><p>직선에서 부스트, 코너에서 안정화</p></div>
        <div id="race-notice" class="race-notice" role="status"></div>
        <div class="race-bottom"><div class="map-panel"><div class="eyebrow">WORKSHOP CIRCUIT <span>01</span></div><canvas id="minimap" width="240" height="142" aria-label="트랙 위 차량 위치"></canvas></div><div class="driving-help"><span>${key("A")}${key("D")} 주행선</span><span id="boost-key">${key("SPACE")} 부스트</span><span id="stabilize-key">${key("SHIFT")} 안정화</span></div><section class="telemetry" aria-label="주행 계기판">${speedometerMarkup()}<div class="telemetry-status"><span id="motor-status">MOTOR READY</span></div><div class="telemetry-meters"><div class="meter-label"><span>모터 열</span><b id="heat-text">0%</b></div><div class="meter"><span id="heat-meter"></span></div><div class="meter-label stability-label"><span>접지 안정성</span><b id="stability-text">100%</b></div><div class="meter stability"><span id="stability-meter"></span></div></div></section></div>
        <div class="replay-controls" id="replay-controls" hidden><span class="replay-label"><i></i> REPLAY</span><span id="replay-time">00:00</span><input id="replay-seek" type="range" min="0" max="100" value="0" step="0.05" aria-label="리플레이 시점"><button data-action="replay-speed" id="replay-speed">1×</button><button data-action="end-replay">결과로 돌아가기 ${icon("arrow", 15)}</button></div>
      </main>
      <section id="pause-screen" class="overlay" hidden><div class="modal pause-modal"><span class="eyebrow">TAKE A BREATHER</span><h2>잠시, 피트 스톱.</h2><p>레이스가 일시정지되었습니다.<br>준비가 되면 이어서 달려보세요.</p><button class="primary" data-action="resume">계속 달리기 ${icon("play", 18)}</button><button class="secondary" data-action="restart">처음부터 다시 경주</button><button class="text-button" data-action="garage">차고로 돌아가기</button><small>${key("ESC")} 또는 ${key("P")} 재개</small></div></section>
      <section id="results-screen" class="overlay results-overlay" hidden><div class="modal results-modal"><span class="eyebrow">THE FINISH LINE</span><div class="result-title">${icon("trophy", 38)}<h2>작은 차의 큰 완주.</h2></div><p id="result-subtitle">작업실 서킷 · ${CONFIG.laps}랩 완주</p><div class="result-summary"><div><small>최종 순위</small><strong id="result-position"></strong></div><div><small>총 주행 시간</small><strong id="result-time"></strong></div><div><small>최고 랩</small><strong id="result-lap"></strong></div></div><div class="results-table"><div class="results-table-head"><span>POSITION / MACHINE</span><span>TIME</span></div><div id="result-ranking"></div></div><div class="lap-splits" id="lap-splits"></div><p class="record-note" id="record-note">기록이 이 기기에 저장되었습니다.</p><div class="result-actions"><button class="primary" data-action="restart">다시 경주 ${icon("arrow", 19)}</button><button class="secondary" data-action="replay">${icon("play", 16)} 리플레이</button></div><button class="text-button" data-action="garage">차고로 돌아가기</button></div></section>
      <dialog id="settings-dialog" class="modal settings-modal"><button class="dialog-close icon-button" data-action="close-dialog" aria-label="설정 닫기">${icon("close")}</button><span class="eyebrow">MAKE IT YOURS</span><h2>내 작업실 설정</h2><label class="setting-row"><span>그래픽 품질<small>성능 모드는 그림자·비·해상도를 줄입니다.</small></span><select id="quality-setting"><option value="balanced">균형</option><option value="performance">성능 우선</option></select></label><label class="setting-row"><span>카메라 움직임 감소<small>추격 거리를 늘리고 차고 자동 회전을 멈춥니다.</small></span><input type="checkbox" id="motion-setting"></label><label class="setting-row"><span>효과음 사용</span><input type="checkbox" id="sound-setting"></label><label class="setting-row"><span>효과음 음량</span><input type="range" id="volume-setting" min="0" max="1" step="0.05"></label><div class="settings-help"><b>레이스 조작</b><p>${key("A")}${key("D")} 주행선 · ${key("SPACE")} 부스트<br>${key("SHIFT")} 안정화 · ${key("C")} 시점 변경<br>${key("1")} – ${key("6")} 카메라 선택 · ${key("ESC")} 일시정지</p><small>부스트 중 열이 쌓입니다. 과열되면 충분히 식을 때까지 속도가 줄어듭니다. 안정화 중에는 부스트를 사용할 수 없습니다.</small></div><button class="primary" data-action="close-dialog">설정 완료 ${icon("arrow", 18)}</button></dialog>
      <dialog id="records-dialog" class="modal records-modal"><button class="dialog-close icon-button" data-action="close-dialog" aria-label="기록 닫기">${icon("close")}</button><span class="eyebrow">PERSONAL BESTS</span><h2>이 작업실의 기록</h2><p>${CONFIG.laps}랩 완주 상위 10개입니다. 이전 랩 수의 기록은 별도로 보존됩니다.</p><div id="records-list"></div><button class="secondary" data-action="close-dialog">차고로 돌아가기</button></dialog>
      <dialog id="assets-dialog" class="modal assets-modal"><button class="dialog-close icon-button" data-action="close-dialog" aria-label="에셋 도감 닫기">${icon("close")}</button><span class="eyebrow">THE DESIGN ARCHIVE · 07 ASSETS</span><h2 id="asset-title">차량 라인업</h2><nav class="asset-tabs" aria-label="에셋 선택">${Object.entries(
        ASSETS,
      )
        .map(
          ([id, asset]) => `<button data-asset="${id}">${asset.title}</button>`,
        )
        .join(
          "",
        )}</nav><div class="asset-sheet"><img id="asset-sheet-image" alt="" src="${ASSETS.lineup.url}"></div><p id="asset-description"></p></dialog>
      <div class="orientation-hint">넓은 화면에서 더 즐겁게.<span>키보드가 있는 PC 브라우저에서 플레이해 주세요.</span></div>
      <div id="toast" role="status"></div>`;
    document.querySelector("#sound-button").insertAdjacentHTML("beforebegin", `<button class="icon-button music-toggle" id="music-button" data-action="music" aria-label="배경음 끄기" aria-pressed="true">${icon("music", 18)}<span>음악</span></button>`);
    const soundLabel = document.querySelector("#sound-setting").closest("label").querySelector("span");
    soundLabel.textContent = "전체 소리";
    document.querySelector("#volume-setting").closest("label").insertAdjacentHTML("afterend", `
      <label class="setting-row"><span>배경음 사용<small>차고의 라운지 재즈 · 레이스의 일렉트로닉</small></span><input type="checkbox" id="music-setting"></label>
      <label class="setting-row"><span>배경음 음량<small>효과음과 따로 조절됩니다.</small></span><input type="range" id="music-volume-setting" min="0" max="1" step="0.01" aria-label="배경음 음량"></label>
      <div class="music-preview-row"><button class="secondary" data-action="test-music">${icon("music", 16)} 배경음 미리 듣기</button><span id="music-status" role="status">화면을 클릭하면 음악이 시작됩니다.</span></div>
      <details class="music-credits"><summary>음원 정보 · Kevin MacLeod</summary><ul>${Object.entries(MUSIC_TRACKS).map(([scene, track]) => `<li>${scene === "garage" ? "차고·결과" : "레이스·리플레이"}: <a href="${track.source}" target="_blank" rel="noopener noreferrer">${track.title}</a></li>`).join("")}</ul><p>Music by Kevin MacLeod (incompetech.com). <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.<br>게임용 MP3 변환, 반복 재생 및 음량·페이드 적용.</p></details>`);
    this.refs = Object.fromEntries(
      [...document.querySelectorAll("[id]")].map((el) => [el.id, el]),
    );
    this.speedometer = new Speedometer(this.refs["speed-gauge"]);
    document.querySelector("#app").addEventListener("click", (event) => {
      const button = event.target.closest(
        "[data-action], [data-car], [data-part], [data-asset]",
      );
      if (!button) return;
      event.preventDefault();
      if (button.dataset.action) handlers.action(button.dataset.action);
      if (button.dataset.car) handlers.car(button.dataset.car);
      if (button.dataset.part) handlers.part(button.dataset.part);
      if (button.dataset.asset) this.showAsset(button.dataset.asset);
    });
    for (const id of ["quality", "motion", "sound", "volume", "music", "music-volume"])
      this.refs[`${id}-setting`].addEventListener("input", () =>
        handlers.settings(id),
      );
    this.refs["replay-seek"].addEventListener("input", (event) =>
      handlers.seek(Number(event.target.value)),
    );
    for (const dialog of document.querySelectorAll("dialog")) {
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        this.closeDialogs();
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          const rect = dialog.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            this.closeDialogs();
        }
      });
    }
    const soundTest = document.createElement("button");
    soundTest.className = "secondary";
    soundTest.dataset.action = "test-sound";
    soundTest.textContent = "소리 확인 · 효과음 켜기";
    const soundStatus = document.createElement("p");
    soundStatus.id = "sound-status";
    soundStatus.className = "audio-status";
    soundStatus.setAttribute("role", "status");
    this.refs["sound-status"] = soundStatus;
    this.refs["volume-setting"].closest("label").after(soundTest, soundStatus);
    this.refs["sound-button"].classList.add("sound-toggle");
    this.audioStatus = "locked";
    this.syncSettings();
  }
  setState(state) {
    document.body.dataset.state = state;
    this.refs["garage-screen"].hidden = state !== "garage";
    this.refs["race-screen"].hidden = ![
      "countdown",
      "racing",
      "paused",
      "replay",
    ].includes(state);
    this.refs["pause-screen"].hidden = state !== "paused";
    this.refs["results-screen"].hidden = state !== "results";
    this.refs["countdown"].hidden = state !== "countdown";
    this.refs["replay-controls"].hidden = state !== "replay";
    if (state === "paused")
      this.refs["pause-screen"].querySelector("button").focus();
    if (state === "results")
      this.refs["results-screen"].querySelector("button").focus();
    if (state === "garage") document.activeElement?.blur();
  }
  selectCar(car) {
    this.refs["car-name"].textContent = car.name;
    this.refs["car-role"].textContent = `${car.subtitle} · ${car.role}`;
    this.refs["car-description"].textContent = car.description;
    this.refs["spec-number"].textContent = `${car.number} / 04`;
    document.querySelector(".color-chip").style.background = car.color;
    this.refs["car-stats"].innerHTML = ["최고 속도", "가속", "핸들링", "안정성"]
      .map(
        (name, i) =>
          `<div class="stat"><div><span>${name}</span><b>${car.stats[i]}<small>/100</small></b></div><div class="stat-track"><span style="width:${car.stats[i]}%"></span></div></div>`,
      )
      .join("");
    for (const button of document.querySelectorAll("[data-car]")) {
      const selected = button.dataset.car === car.id;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected);
    }
    this.setPart(null);
    this.setExploded(false);
    this.setWheel(false);
  }
  setPart(id) {
    for (const button of document.querySelectorAll("[data-part]"))
      button.setAttribute("aria-pressed", button.dataset.part === id);
    const part = PARTS.find((p) => p[0] === id);
    this.refs["part-detail"].innerHTML =
      `<span class="detail-dot"></span><span>${part ? `<b>${part[1]}</b> · ${part[2]}` : "부품을 선택해 자세히 살펴보세요."}</span>`;
  }
  setExploded(on) {
    this.refs["explode-button"].classList.toggle("active", on);
    this.refs["explode-button"].setAttribute("aria-pressed", on);
    this.refs["explode-button"].querySelector("span").textContent = on
      ? "ON"
      : "OFF";
  }
  setWheel(on) {
    this.refs["wheel-button"].classList.toggle("active", on);
    this.refs["wheel-button"].setAttribute("aria-pressed", on);
  }
  setCamera(mode) {
    this.refs["camera-button"].querySelector("span").textContent =
      CAMERA_NAMES[mode];
  }
  updateRace(race, input = {}, replayFrame = null) {
    const player = replayFrame ? replayFrame.cars[0] : race.player;
    const ranking = replayFrame
      ? [...replayFrame.cars].sort((a, b) =>
          a.finishTime !== null && b.finishTime !== null
            ? a.finishTime - b.finishTime
            : a.finishTime !== null
              ? -1
              : b.finishTime !== null
                ? 1
                : b.distance - a.distance,
        )
      : race.ranking();
    this.refs["race-position"].innerHTML =
      `${ranking.findIndex((c) => c.id === player.id) + 1}<span>/ 4</span>`;
    this.refs["race-lap"].innerHTML = `${player.lap} <span>/ ${CONFIG.laps}</span>`;
    this.refs["race-time"].textContent = timeString(
      replayFrame ? replayFrame.time : (player.finishTime ?? race.time),
    );
    this.refs["best-lap"].textContent =
      `BEST LAP ${timeString(Math.min(...player.lapTimes))}`;
    this.speedometer.update(player);
    this.refs["heat-text"].textContent = `${Math.round(player.heat)}%`;
    this.refs["heat-meter"].style.width = `${player.heat}%`;
    this.refs["heat-meter"].classList.toggle(
      "hot",
      player.heat > 75 || player.overheated,
    );
    this.refs["stability-text"].textContent =
      `${Math.round(player.stability)}%`;
    this.refs["stability-meter"].style.width = `${player.stability}%`;
    this.refs["motor-status"].textContent =
      player.finishTime !== null
        ? "FINISHED"
        : player.impactRemaining > 0
          ? "RAIL IMPACT · 감속"
        : player.overheated
          ? "OVERHEAT · 냉각 중"
          : player.boosting
            ? "BOOST ACTIVE"
            : player.stabilizing
              ? "STABILIZING"
              : "MOTOR RUNNING";
    this.refs["motor-status"].className = player.overheated || player.impactRemaining > 0
      ? "danger"
      : player.boosting
        ? "boost"
        : "";
    this.refs["boost-key"].classList.toggle("pressed", !!input.boost);
    this.refs["stabilize-key"].classList.toggle("pressed", !!input.stabilize);
    this.refs.leaderboard.innerHTML = ranking
      .map((car, i) => {
        const spec = CARS.find((c) => c.id === car.id);
        return `<div class="leader-row ${car.id === player.id ? "you" : ""}"><span>${i + 1}</span><i style="background:${spec.color}"></i><b>${spec.name}</b><small>${car.id === player.id ? "YOU" : car.finishTime !== null ? "FIN" : "AI"}</small></div>`;
      })
      .join("");
    const lap = player.lap;
    if (lap !== this.lastWeather) {
      this.lastWeather = lap;
      this.refs["weather-chip"].innerHTML =
        `${icon(lap === 1 ? "sun" : "rain", 20)}<div><b>${["", "DRY TRACK", "WET SECTORS", "STORM LAP"][Math.min(lap, 3)]}</b><span>${["", "1랩 · 건조한 노면", "2랩 · 푸른 노면을 피하세요", `${lap}랩 · 비와 횡풍에 주의`][Math.min(lap, 3)]}</span></div>`;
    }
    const notice =
      player.finishTime !== null
        ? "완주! 다른 차량의 결승선 통과를 기다리는 중입니다."
        : player.impactRemaining > 0
          ? "레일 충돌 · 충격으로 감속! 안쪽으로 조향하세요"
        : player.overheated
          ? "모터 과열 · 부스트를 쉬고 열을 식히세요"
          : player.wet && player.stability < 65
            ? "젖은 코너 · SHIFT로 안정화하세요"
            : player.wind > 0.6
              ? "횡풍 구간 · 주행선을 유지하세요"
              : "";
    this.refs["race-notice"].textContent = notice;
    this.refs["race-notice"].classList.toggle("visible", !!notice);
    this.drawMinimap(replayFrame ? replayFrame.cars : race.cars, race.track);
  }
  drawMinimap(cars, track) {
    const ctx = this.refs.minimap.getContext("2d");
    ctx.clearRect(0, 0, 240, 142);
    const point = (distance) => {
      const p = track.sample(distance).position;
      return [123 + p.x * 3.4, 70 + p.z * 3.4];
    };
    ctx.beginPath();
    for (let i = 0; i <= 150; i++) {
      const [x, y] = point((i / 150) * track.length);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#09111bbc";
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#f0f2f3d9";
    ctx.stroke();
    for (const [i, car] of [...cars].reverse().entries()) {
      const [x, y] = point(car.distance);
      ctx.beginPath();
      ctx.arc(x, y, car.id === cars[0].id ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = CARS.find((c) => c.id === car.id).color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#fff9e8";
      ctx.stroke();
    }
    const [sx, sy] = point(0);
    ctx.fillStyle = "#3a4640";
    ctx.fillRect(sx - 1, sy + 6, 3, 6);
  }
  results(race, storage) {
    const player = race.player,
      position = race.ranking().indexOf(player) + 1;
    this.refs["result-position"].innerHTML = `${position}<small> / 4</small>`;
    this.refs["result-time"].textContent = timeString(player.finishTime);
    this.refs["result-lap"].textContent = timeString(
      Math.min(...player.lapTimes),
    );
    this.refs["result-subtitle"].textContent =
      position === 1
        ? "우승입니다! 작업대 위 가장 빠른 미니카."
        : `작업실 서킷 · ${CONFIG.laps}랩 완주. 다음에는 더 빠르게.`;
    this.refs["result-ranking"].innerHTML = race
      .ranking()
      .map(
        (car, i) =>
          `<div class="result-row ${car === player ? "you" : ""}"><span>${String(i + 1).padStart(2, "0")} <i style="background:${car.spec.color}"></i><b>${car.spec.name}</b>${car === player ? "<small>YOU</small>" : ""}</span><span>${timeString(car.finishTime)}</span></div>`,
      )
      .join("");
    this.refs["lap-splits"].innerHTML = player.lapTimes
      .map((time, i) => `<span>LAP ${i + 1}<b>${timeString(time)}</b></span>`)
      .join("");
    this.refs["record-note"].textContent = storage.available
      ? "기록이 이 브라우저에 저장되었습니다. · 내 기록에서 다시 확인하세요."
      : "브라우저 저장소를 사용할 수 없어 이번 기록은 현재 세션에만 보관됩니다.";
  }
  syncSettings() {
    const data = this.storage.data;
    this.refs["speed-gauge"].classList.toggle("reduced-motion", data.reducedMotion);
    this.refs["quality-setting"].value = data.quality;
    this.refs["motion-setting"].checked = data.reducedMotion;
    this.refs["sound-setting"].checked = !data.muted;
    this.refs["volume-setting"].value = data.volume;
    this.refs["music-setting"].checked = !data.musicMuted;
    this.refs["music-volume-setting"].value = data.musicVolume;
    const musicOn = musicEnabled(data);
    this.refs["music-button"].setAttribute("aria-pressed", String(musicOn));
    this.refs["music-button"].setAttribute("aria-label", musicOn ? "배경음 끄기" : "배경음 켜기");
    this.refs["music-button"].title = musicOn ? "배경음 끄기" : "배경음 켜기";
    const silent = !hasAudioOutput(data);
    this.refs["sound-button"].innerHTML = `${icon(silent ? "muted" : "sound")}<span>${silent ? "소리 켜기" : "소리 켜짐"}</span>`;
    this.refs["sound-button"].setAttribute(
      "aria-label",
      silent ? "소리 켜기" : "소리 끄기",
    );
    this.refs["sound-button"].title = silent ? "소리 켜기" : "소리 끄기";
    this.refs["sound-button"].setAttribute("aria-pressed", String(!silent));
    this.setAudioStatus(this.audioStatus);
  }
  setAudioStatus(status) {
    this.audioStatus = status;
    if (!this.refs["sound-status"]) return;
    const data = this.storage.data;
    this.refs["sound-status"].textContent = data.muted
      ? "음소거 상태입니다. ‘소리 확인’을 누르면 소리가 켜집니다."
      : !hasAudioOutput(data)
        ? "음량이 0입니다. 음량을 올리거나 ‘소리 확인’을 눌러 주세요."
        : ({
            locked: "경주 시작 또는 ‘소리 확인’을 누르면 오디오가 시작됩니다.",
            running: "오디오 정상 · 들리지 않으면 브라우저 탭과 기기 음량을 확인해 주세요.",
            suspended: "오디오가 일시정지됐습니다. ‘소리 확인’ 또는 경주 재개를 눌러 주세요.",
            interrupted: "다른 앱이 오디오를 사용 중입니다. 돌아온 뒤 ‘소리 확인’을 눌러 주세요.",
            closed: "오디오 연결이 종료됐습니다. ‘소리 확인’을 눌러 다시 연결하세요.",
            unsupported: "이 브라우저는 Web Audio를 지원하지 않습니다.",
            error: "오디오 연결에 실패했습니다. ‘소리 확인’으로 재시도해 주세요.",
          }[status] ?? "오디오 상태를 확인해 주세요.");
  }
  setMusicStatus(info) {
    this.musicStatus = info;
    if (!this.refs["music-status"]) return;
    const labels = {
      locked: "화면을 클릭하면 시작", loading: "음악 준비 중",
      playing: "재생 중", paused: "일시정지",
      error: "음악을 불러오지 못했습니다. 미리 듣기로 재시도해 주세요.",
    };
    this.refs["music-status"].textContent = `${info.title} · ${labels[info.status] ?? ""}`;
    this.refs["music-button"].dataset.state = info.status;
    if (info.status === "locked" && musicEnabled(this.storage.data)) {
      this.refs["music-button"].setAttribute("aria-label", "배경음 재생");
      this.refs["music-button"].title = "배경음 재생";
    }
  }
  openDialog(type) {
    this.dialogReturnFocus = document.activeElement;
    if (type === "records") {
      const records = this.storage.currentRecords();
      this.refs["records-list"].innerHTML = records.length
        ? records
            .map(
              (r, i) =>
                `<div class="record-row"><span>${String(i + 1).padStart(2, "0")}</span><b>${CARS.find((c) => c.id === r.car).name}</b><strong>${timeString(r.total)}</strong><small>${r.position}위</small></div>`,
            )
            .join("")
        : `<div class="empty-records">${icon("flag", 40)}<b>첫 번째 기록을 기다리고 있어요.</b><span>${CONFIG.laps}랩을 완주하면 여기에 기록이 남습니다.</span></div>`;
    }
    this.refs[`${type}-dialog`].showModal();
  }
  closeDialogs() {
    const dialogs = document.querySelectorAll("dialog[open]");
    for (const dialog of dialogs)
      dialog.close();
    if (dialogs.length) this.handlers.dialogClosed?.();
    this.dialogReturnFocus?.focus();
  }
  showAsset(id) {
    const asset = ASSETS[id];
    if (!asset) return;
    this.refs["asset-title"].textContent = asset.title;
    this.refs["asset-description"].textContent = asset.description;
    this.refs["asset-sheet-image"].src = asset.url;
    this.refs["asset-sheet-image"].alt = asset.title;
    for (const button of document.querySelectorAll("[data-asset]"))
      button.setAttribute("aria-pressed", button.dataset.asset === id);
    if (!this.refs["assets-dialog"].open) this.openDialog("assets");
  }
  toast(message) {
    this.refs.toast.textContent = message;
    this.refs.toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(
      () => this.refs.toast.classList.remove("show"),
      2600,
    );
  }
}
