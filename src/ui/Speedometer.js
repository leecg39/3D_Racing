import { CONFIG, clamp } from "../config.js";

const maxKmh = CONFIG.maxSpeed * 10;
const point = (radius, fraction) => {
  const angle = ((135 + fraction * 270) * Math.PI) / 180;
  return [128 + radius * Math.cos(angle), 128 + radius * Math.sin(angle)];
};
const arc = (radius) => {
  const start = point(radius, 0), end = point(radius, 1);
  return `M ${start.join(" ")} A ${radius} ${radius} 0 1 1 ${end.join(" ")}`;
};

// This is a live speed scale, in the same converted km/h used by the game.
export function speedometerMarkup() {
  const ticks = Array.from({ length: 41 }, (_, i) => {
    const major = i % 5 === 0;
    const a = point(major ? 94 : 99, i / 40), b = point(104, i / 40);
    const label = point(83, i / 40);
    return `<line class="dial-tick${major ? " major" : ""}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>${major ? `<text class="dial-number" x="${label[0]}" y="${label[1]}">${Math.round((i / 40) * maxKmh)}</text>` : ""}`;
  }).join("");
  return `<div class="speedometer" id="speed-gauge" role="meter" aria-label="미니카 환산 속도" aria-valuemin="0" aria-valuemax="${maxKmh}" aria-valuenow="0" aria-valuetext="0 km/h" data-mode="ready">
    <svg class="speedometer-dial" viewBox="0 0 256 256" aria-hidden="true">
      <circle class="dial-glass" cx="128" cy="128" r="117"/>
      <circle class="dial-rim" cx="128" cy="128" r="119"/>
      <path class="dial-track" d="${arc(110)}"/>
      <path class="dial-progress" id="speed-arc" d="${arc(110)}" pathLength="100" stroke-dasharray="0 100"/>
      ${ticks}
    </svg>
    <div class="dial-drive"><span id="drive-mode">EV</span><small id="drive-label">ELECTRIC</small></div>
    <div class="dial-digital"><span id="speed">0</span><span class="dial-unit" aria-hidden="true">K<br>M<br>H</span></div>
    <div class="dial-boost" id="dial-boost">BOOST</div>
    <span class="dial-caption">MINI 4WD / SPEED</span>
  </div>`;
}

export class Speedometer {
  constructor(root) {
    this.root = root;
    this.arc = root.querySelector("#speed-arc");
    this.speed = root.querySelector("#speed");
    this.mode = root.querySelector("#drive-mode");
    this.label = root.querySelector("#drive-label");
  }
  update(player) {
    const kmh = clamp(Number.isFinite(player.speed) ? player.speed * 10 : 0, 0, maxKmh);
    const speed = Math.round(kmh);
    this.speed.textContent = speed;
    this.arc.setAttribute("stroke-dasharray", `${(kmh / maxKmh) * 100} 100`);
    this.root.setAttribute("aria-valuenow", speed);
    this.root.setAttribute("aria-valuetext", `${speed} km/h`);
    const state = player.finishTime != null ? "finished"
      : player.impactRemaining > 0 ? "impact"
      : player.overheated ? "hot"
      : player.boosting ? "boost"
      : player.stabilizing ? "grip"
      : speed > 0 ? "drive" : "ready";
    this.root.dataset.mode = state;
    this.mode.textContent = state === "boost" ? "B" : "EV";
    this.label.textContent = {
      finished: "FINISHED", impact: "IMPACT", hot: "COOLING",
      boost: "BOOST", grip: "GRIP", drive: "ELECTRIC", ready: "READY",
    }[state];
  }
}
