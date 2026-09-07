import test from "node:test";
import assert from "node:assert/strict";
import { Storage } from "../src/core/Storage.js";
import { MusicManager, hasAudioOutput } from "../src/audio/MusicManager.js";

test("legacy audio preferences gain a separate music level without losing mute or zero volume", () => {
  const legacy = new Storage({ getItem: () => JSON.stringify({ volume: 0, muted: true }) });
  assert.equal(legacy.data.muted, true);
  assert.equal(legacy.data.volume, 0);
  assert.equal(legacy.data.musicVolume, 0.28);
  assert.equal(hasAudioOutput(legacy.data), false);
  legacy.data.muted = false;
  assert.equal(hasAudioOutput(legacy.data), true, "music can play while effects volume is zero");
  const saved = new Storage({ getItem: () => JSON.stringify({ musicVolume: 0, musicMuted: true }) });
  assert.equal(saved.data.musicVolume, 0);
  assert.equal(saved.data.musicMuted, true);
});

test("music follows race lifecycle and gates previews during focus loss", () => {
  const music = new MusicManager({ muted: false, musicMuted: false, musicVolume: 0.28 });
  for (const scene of ["garage", "results"]) {
    music.setScene(scene);
    assert.equal(music.trackId, "garage");
    assert.equal(music.wantsMusic(), true);
  }
  for (const scene of ["countdown", "racing", "replay"]) {
    music.setScene(scene);
    assert.equal(music.trackId, "race");
    assert.equal(music.wantsMusic(), true);
  }
  music.setScene("paused");
  assert.equal(music.wantsMusic(), false);
  music.setPreview(true);
  assert.equal(music.wantsMusic(), true);
  music.setHidden(true);
  assert.equal(music.wantsMusic(), false);
  music.setHidden(false);
  music.setScene("garage");
  assert.equal(music.preview, false);
  music.settings.muted = true;
  assert.equal(music.wantsMusic(), false);
});

test("unmuting during an aborted media load restarts playback after the pending request settles", async (t) => {
  const music = new MusicManager({ muted: false, musicMuted: false, musicVolume: 0.28 });
  let rejectFirst, plays = 0;
  const media = {
    paused: true,
    play() {
      plays++;
      if (plays === 1) return new Promise((_, reject) => { rejectFirst = reject; });
      this.paused = false;
      return Promise.resolve();
    },
    pause() { this.paused = true; },
  };
  const gain = () => ({ gain: { setTargetAtTime() {} } });
  const entry = { id: "garage", media, gain: gain(), pending: null, failed: false };
  music.context = { state: "running", currentTime: 0 };
  music.output = gain();
  music.scene = "garage";
  music.entries.set("garage", entry);
  t.after(() => clearTimeout(entry.pauseTimer));
  music.sync();
  music.settings.musicMuted = true;
  music.sync();
  await new Promise((resolve) => setTimeout(resolve, 200));
  music.settings.musicMuted = false;
  music.sync();
  assert.equal(plays, 1, "do not start duplicate requests while the old one is pending");
  rejectFirst(Object.assign(new Error("play interrupted"), { name: "AbortError" }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(plays, 2);
  assert.equal(media.paused, false);
});
