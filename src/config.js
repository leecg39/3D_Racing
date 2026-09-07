export const CONFIG = Object.freeze({
  step: 1 / 60,
  maxFrame: 0.1,
  laps: 3,
  checkpoints: 12,
  trackWidth: 5.6,
  laneLimit: 2.05,
  replayHz: 20,
  baseSpeed: 7.1,
  boostMultiplier: 1.7,
  stabilizeMultiplier: 0.77,
  heatRate: 34,
  coolingRate: 23,
  overheatCooling: 14,
  overheatAt: 100,
  recoverAt: 36,
  skidThreshold: 1.05,
  storageKey: "tabletop-racers-v2",
  countdown: 3,
});

export const CARS = Object.freeze([
  {
    id: "zephyr",
    name: "ZEPHYR",
    subtitle: "제퍼",
    number: "01",
    role: "BALANCED ALL-ROUNDER",
    color: "#1260e9",
    secondary: "#ffcd27",
    bodyColor: "#e8edf1",
    speed: 1,
    grip: 1,
    cooling: 1,
    stats: [78, 74, 80, 82],
    description:
      "날렵한 화이트 셸에 블루·옐로 포인트. 균형 잡힌 성능으로 모든 구간을 자신 있게.",
    shell: "wedge",
    sheet: "zephyr",
  },
  {
    id: "vortex",
    name: "VORTEX",
    subtitle: "보텍스",
    number: "02",
    role: "SPEED SPECIALIST",
    color: "#e82930",
    secondary: "#e8e9ec",
    bodyColor: "#e4e7ed",
    speed: 1.1,
    grip: 0.9,
    cooling: 1,
    stats: [92, 88, 70, 68],
    description:
      "길게 뻗은 실버 노즈와 레드 에어로 파츠. 직선의 폭발력, 코너의 정확한 타이밍.",
    shell: "long",
    sheet: "lineup",
  },
  {
    id: "bulldog",
    name: "BULLDOG",
    subtitle: "불독",
    number: "03",
    role: "TOUGH & STEADY",
    color: "#f18b25",
    secondary: "#e17d17",
    bodyColor: "#303640",
    speed: 0.95,
    grip: 1.18,
    cooling: 1.22,
    stats: [76, 70, 74, 90],
    description:
      "단단한 블랙 프레임과 오렌지 덕트. 안정적인 접지와 냉각으로 거친 노면을 돌파합니다.",
    shell: "wide",
    sheet: "bulldog",
  },
  {
    id: "nova",
    name: "NOVA",
    subtitle: "노바",
    number: "04",
    role: "AGILE TECHNICIAN",
    color: "#2253f1",
    secondary: "#c1e628",
    bodyColor: "#e5ecf5",
    speed: 1.02,
    grip: 1.22,
    cooling: 0.91,
    stats: [80, 85, 92, 66],
    description:
      "컴팩트한 블루 셸과 라임 휠. 빠른 주행선 전환과 정교한 코너 공략에 특화된 미니카.",
    shell: "compact",
    sheet: "lineup",
  },
]);

export const PARTS = [
  ["BodyShell", "차체", "공기 흐름을 다듬은 경량 플라스틱 셸"],
  ["Chassis", "샤시", "모든 부품을 연결하는 낮고 단단한 프레임"],
  ["Motor", "모터", "부스트 시 회전수가 오르는 전동 모터"],
  ["GearAssembly", "기어", "모터의 회전을 바퀴에 전달하는 기어"],
  ["Wheels", "타이어", "노면과 만나는 네 개의 고무 타이어"],
  ["Rollers", "롤러", "레일과 접촉하며 주행선을 지키는 가이드"],
  ["BatteryPack", "배터리", "차체 중심에 배치한 두 개의 전원 셀"],
  ["RearWing", "리어 윙", "차량별 주행 성향을 표현하는 후방 윙"],
];

export const CAMERA_NAMES = [
  "추격",
  "작업실 전체",
  "차량 전방",
  "롤러 근접",
  "트랙사이드",
  "자동 감독",
];
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const damp = (a, b, rate, dt) =>
  a + (b - a) * (1 - Math.exp(-rate * dt));
export const timeString = (seconds) => {
  if (!Number.isFinite(seconds)) return "—";
  const ms = Math.floor(seconds * 1000);
  return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};
