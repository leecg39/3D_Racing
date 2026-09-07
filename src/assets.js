import * as THREE from "three";
const base = `${import.meta.env.BASE_URL}assets/source/`;
export const ASSETS = {
  lineup: {
    url: `${base}lineup.png`,
    title: "차량 라인업",
    description: "ZEPHYR · VORTEX · BULLDOG · NOVA",
  },
  zephyr: {
    url: `${base}zephyr-parts.png`,
    title: "ZEPHYR 부품도",
    description: "화이트·블루 셸, 옐로 휠, 모듈형 샤시",
  },
  bulldog: {
    url: `${base}bulldog-parts.png`,
    title: "BULLDOG 부품도",
    description: "오렌지 덕트, 강화 프레임, 안정형 파츠",
  },
  workshop: {
    url: `${base}workshop.png`,
    title: "작업실 환경",
    description: "따뜻한 작업등과 비 내리는 창가",
  },
  track: {
    url: `${base}track-blueprint.png`,
    title: "서킷 설계도",
    description: "고가 구간 · 뱅크 코너 · 웨더 테스트",
  },
  interface: {
    url: `${base}interface.png`,
    title: "인터페이스 에셋",
    description: "차량 카드, 경주 정보, 계기판",
  },
  props: {
    url: `${base}workshop-props.png`,
    title: "작업실 소품",
    description: "공구 · 스탠드 · 선풍기 · 트랙 사인",
  },
};
export const ATLAS = {
  zephyr: { asset: "zephyr", rect: [0, 0, 640, 520] },
  bulldog: { asset: "bulldog", rect: [0, 0, 600, 470] },
  vortex: { asset: "interface", rect: [350, 474, 208, 127] },
  nova: { asset: "interface", rect: [878, 469, 230, 137] },
  lamp: { asset: "props", rect: [0, 0, 450, 418] },
  fan: { asset: "props", rect: [457, 0, 321, 398] },
  toolbox: { asset: "props", rect: [1116, 95, 321, 235] },
  books: { asset: "props", rect: [884, 330, 321, 206] },
  notebook: { asset: "props", rect: [1201, 340, 244, 200] },
  rainSign: { asset: "props", rect: [879, 653, 219, 268] },
  pitSign: { asset: "props", rect: [746, 629, 153, 246] },
  boostSign: { asset: "props", rect: [1117, 624, 312, 259] },
  cone: { asset: "props", rect: [480, 860, 113, 168] },
};
const textureCache = new Map();
export async function preloadAssets() {
  const loader = new THREE.TextureLoader();
  await Promise.all(
    Object.values(ASSETS).map(async ({ url }) => {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(url, texture);
    }),
  );
}
export function atlasTexture(name) {
  const item = ATLAS[name],
    key = item ? item.asset : name,
    url = ASSETS[key].url;
  if (!textureCache.has(url)) {
    const texture = new THREE.TextureLoader().load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, texture);
  }
  const texture = textureCache.get(url).clone();
  texture.colorSpace = THREE.SRGBColorSpace;
  if (item) {
    const [x, y, width, height] = item.rect;
    texture.repeat.set(width / 1448, height / 1086);
    texture.offset.set(x / 1448, 1 - (y + height) / 1086);
  }
  return texture;
}
export function atlasStyle(name) {
  const {
    asset,
    rect: [x, y, width, height],
  } = ATLAS[name];
  return `background-image:url('${ASSETS[asset].url}');background-size:${(1448 / width) * 100}% ${(1086 / height) * 100}%;background-position:${(x / (1448 - width)) * 100}% ${(y / (1086 - height)) * 100}%;aspect-ratio:${width}/${height}`;
}
export function addAssetSprite(parent, name, position, height, rotation = 0) {
  const rect = ATLAS[name].rect;
  const mat = new THREE.MeshBasicMaterial({
    map: atlasTexture(name),
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry((height * rect[2]) / rect[3], height),
    mat,
  );
  mesh.position.set(position[0], position[1] + height / 2, position[2]);
  mesh.rotation.y = rotation;
  parent.add(mesh);
  return mesh;
}
