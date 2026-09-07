import { writeFile, mkdir } from "node:fs/promises";
import { CARS, CONFIG } from "../src/config.js";
import { TrackSampler } from "../src/track/TrackSampler.js";
import { RaceManager } from "../src/race/RaceManager.js";
import { strategicInput } from "../src/race/AIDriver.js";
const track = new TrackSampler(),
  rows = [];
for (const car of CARS) {
  const row = { car: car.id };
  for (const mode of ["none", "boost", "both", "strategy"]) {
    const race = new RaceManager(track, car);
    while (!race.finished && race.time < 150)
      race.update(
        CONFIG.step,
        mode === "strategy"
          ? strategicInput(race.player, track, race.cars)
          : { steer: 0, boost: mode !== "none", stabilize: mode === "both" },
      );
    row[mode] = {
      seconds: race.player.finishTime,
      overheats: race.player.overheatCount,
      position: race.ranking().indexOf(race.player) + 1,
    };
  }
  rows.push(row);
}
await mkdir("docs/evidence", { recursive: true });
await writeFile(
  "docs/evidence/balance-report.json",
  JSON.stringify(
    { trackLength: track.length, step: CONFIG.step, rows },
    null,
    2,
  ) + "\n",
);
console.table(
  rows.map((row) => ({
    car: row.car,
    idle: row.none.seconds.toFixed(2),
    boost: row.boost.seconds.toFixed(2),
    both: row.both.seconds.toFixed(2),
    strategy: row.strategy.seconds.toFixed(2),
  })),
);
