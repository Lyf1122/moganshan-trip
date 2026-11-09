// 用 Photon(OSM) 查上海地点 WGS84 坐标 → 转高德 GCJ-02
const QUERIES = [
  ['武康大楼', '武康大楼 上海'],
  ['武康路', '武康路 上海'],
  ['安福路', '安福路 上海'],
  ['张园', '张园 茂名北路 上海'],
  ['静安寺', '静安寺 南京西路 上海'],
  ['愚园路', '愚园路 上海'],
  ['南京路步行街', '南京东路 步行街 上海'],
  ['国际饭店', '国际饭店 南京西路 上海'],
  ['黄河路', '黄河路 上海'],
  ['云南南路', '云南南路 上海'],
  ['沈大成', '沈大成 南京东路 上海'],
  ['外滩', '外滩 中山东一路 上海'],
  ['外白渡桥', '外白渡桥 上海'],
  ['豫园', '豫园 上海'],
  ['绿波廊', '绿波廊 上海'],
  ['南翔馒头店', '南翔馒头店 上海'],
  ['新天地', '新天地 太仓路 上海'],
  ['田子坊', '田子坊 上海'],
  ['思南公馆', '思南公馆 上海'],
  ['进贤路', '进贤路 上海'],
  ['兰心餐厅', '兰心餐厅 上海'],
  ['老吉士酒家', '老吉士 天平路 上海'],
  ['西岸美术馆', '西岸美术馆 上海'],
  ['龙美术馆西岸馆', '龙美术馆 龙腾大道 上海'],
  ['油罐艺术中心', '油罐艺术中心 上海'],
  ['多伦路', '多伦路 上海'],
  ['1933老场坊', '1933老场坊 上海'],
  ['光明邨', '光明邨 淮海中路 上海'],
  ['%Arabica武康路店', 'Arabica 武康路 上海'],
  ['华东政法大学长宁校区', '华东政法大学 万航渡路 上海'],
];
const IN_SH = (lat, lon) => lat > 30.95 && lat < 31.55 && lon > 121.1 && lon < 121.8;

// —— GCJ-02 转换（公开算法 eviltransform）——
function tLat(x, y) {
  let r = -100 + 2*x + 3*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
  r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
  r += (20*Math.sin(y*Math.PI) + 40*Math.sin(y/3*Math.PI)) * 2/3;
  r += (160*Math.sin(y/12*Math.PI) + 320*Math.sin(y*Math.PI/30)) * 2/3;
  return r;
}
function tLng(x, y) {
  let r = 300 + x + 2*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
  r += (20*Math.sin(6*x*Math.PI) + 20*Math.sin(2*x*Math.PI)) * 2/3;
  r += (20*Math.sin(x*Math.PI) + 40*Math.sin(x/3*Math.PI)) * 2/3;
  r += (150*Math.sin(x/12*Math.PI) + 300*Math.sin(x/30*Math.PI)) * 2/3;
  return r;
}
const A = 6378245.0, EE = 0.00669342162296594323;
function wgs2gcj(lng, lat) {
  let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
  const rad = lat / 180 * Math.PI;
  let magic = 1 - EE * Math.sin(rad) ** 2;
  const sq = Math.sqrt(magic);
  dLat = (dLat * 180) / ((A * (1 - EE)) / (magic * sq) * Math.PI);
  dLng = (dLng * 180) / (A / sq * Math.cos(rad) * Math.PI);
  return [lng + dLng, lat + dLat];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const [key, q] of QUERIES) {
  try {
    const url = 'https://photon.komoot.io/api/?limit=8&lang=default&q=' + encodeURIComponent(q);
    const res = await fetch(url, { headers: { 'User-Agent': 'autoclaw-shanghai-map/1.0' } });
    if (!res.ok) { console.log(`${key}\tHTTP ${res.status}`); continue; }
    const data = await res.json();
    const feats = (data.features || []).filter(f => {
      const [lon, lat] = f.geometry.coordinates;
      return IN_SH(lat, lon);
    });
    if (!feats.length) { console.log(`${key}\tNO HIT`); continue; }
    for (const f of feats.slice(0, 3)) {
      const [lon, lat] = f.geometry.coordinates;
      const [glng, glat] = wgs2gcj(lon, lat);
      const p = f.properties;
      const label = [p.name, p.street, p.district].filter(Boolean).join('/');
      console.log(`${key}\tWGS ${lat.toFixed(6)},${lon.toFixed(6)}\tGCJ ${glat.toFixed(6)},${glng.toFixed(6)}\t${p.osm_key}/${p.osm_value}\t${label}`);
    }
  } catch (e) {
    console.log(`${key}\tERR ${e.message}`);
  }
  await sleep(600);
}
