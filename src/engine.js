(function () {
'use strict';

/* ═══ 环境检测：第三方 App 内嵌 WebView 会拦截自定义 scheme ═══ */
const UA = navigator.userAgent || '';
const IN_APP_WEBVIEW = /micromessenger|xhs|xhsdiscover|discover\/|tiktok|aweme|weibo|qq\/|qqbrowser|alipayclient|dingtalk|lark|feishu|ucbrowser|baiduboxapp|toutiao|newsarticle/i.test(UA);
const IS_MOBILE = /iPhone|iPad|Android|Mobile/i.test(UA);
const IS_IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ═══ WGS84 → GCJ-02（浏览器定位结果转高德坐标系用）═══ */
function tLat(x, y) {
  let r = -100 + 2 * x + 3 * y + .2 * y * y + .1 * x * y + .2 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return r;
}
function tLng(x, y) {
  let r = 300 + x + 2 * y + .1 * x * x + .1 * x * y + .1 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return r;
}
const GCJ_A = 6378245.0, GCJ_EE = 0.00669342162296594323;
function wgs2gcj(lng, lat) {
  let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35);
  const rad = lat / 180 * Math.PI;
  const magic = 1 - GCJ_EE * Math.sin(rad) ** 2, sq = Math.sqrt(magic);
  dLat = dLat * 180 / ((GCJ_A * (1 - GCJ_EE)) / (magic * sq) * Math.PI);
  dLng = dLng * 180 / (GCJ_A / sq * Math.cos(rad) * Math.PI);
  return [lng + dLng, lat + dLat];
}

/* ═══ 类型表 ═══ */
const TYPES = {
  food: { emoji: '🍜', color: '#ff3b30', badge: '餐', cls: 'food', label: '吃 · 餐厅' },
  spot: { emoji: '📍', color: '#007aff', badge: '逛', cls: 'spot', label: '逛 · 景点' },
  stay: { emoji: '🏡', color: '#af52de', badge: '住', cls: 'stay', label: '住 · 酒店' },
  hub:  { emoji: '🅿️', color: '#34c759', badge: '行', cls: 'hub',  label: '行 · 换乘' }
};

/* ═══ 全局地点注册表 ═══ */
const REG = [];
AREAS.forEach(a => a.places.forEach(p => { p._id = REG.length; p._area = a; REG.push(p); }));

/* ═══ 地图初始化（高德瓦片，GCJ-02）═══ */
const map = L.map('map', {
  center: [30.6020, 119.8820], zoom: 12,
  zoomControl: false, attributionControl: true,
  minZoom: 10, maxZoom: 18
});
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
  subdomains: '1234', maxZoom: 18, attribution: '© 高德地图'
}).addTo(map);

/* ── 定位按钮（结果转 GCJ-02 后落图）── */
const LocateControl = L.Control.extend({
  options: { position: 'bottomright' },
  onAdd() {
    const btn = L.DomUtil.create('button', 'locate-btn');
    btn.innerHTML = '📍';
    btn.title = '我的位置';
    L.DomEvent.disableClickPropagation(btn);
    btn.addEventListener('click', () => {
      btn.classList.add('active');
      map.locate({ setView: true, maxZoom: 15 });
    });
    return btn;
  }
});
new LocateControl().addTo(map);
let locMarker, locCircle;
map.on('locationfound', e => {
  const [lng, lat] = wgs2gcj(e.latlng.lng, e.latlng.lat);
  const pos = L.latLng(lat, lng), r = e.accuracy / 2;
  if (locMarker) { locMarker.setLatLng(pos); locCircle.setLatLng(pos).setRadius(r); }
  else {
    locMarker = L.marker(pos, {
      icon: L.divIcon({
        className: '', iconSize: [14, 14], iconAnchor: [7, 7],
        html: '<div style="position:relative;width:14px;height:14px;border-radius:50%;background:#007aff;border:2.5px solid #fff;box-shadow:0 0 6px rgba(0,122,255,.55)"></div><div class="loc-pulse" style="position:absolute;top:0;left:0"></div>'
      }), zIndexOffset: 2000
    }).addTo(map);
    locCircle = L.circle(pos, { radius: r, color: '#007aff', fillColor: '#007aff', fillOpacity: .08, weight: 1 }).addTo(map);
  }
});
map.on('locationerror', () => {});

/* ═══ 高德 / 大众点评 跳转 ═══ */
function cleanName(n) {
  return (n || '')
    .replace(/[（(【][^）)】]*[）)】]/g, '')
    .replace(/[%％]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function dpKw(p) { return (p.dpKeyword || cleanName(p.name)).trim(); }
function dpWeb(p) { return 'https://www.dianping.com/search/keyword/1/0_' + encodeURIComponent(dpKw(p)); }
function dpApp(p) { return 'dianping://searchshoplist?keyword=' + encodeURIComponent(dpKw(p)); }
function amapWebUrl(p) {
  return 'https://uri.amap.com/marker?position=' + p.lng + ',' + p.lat +
    '&name=' + encodeURIComponent(p.name) + '&src=moganshan-trip&callnative=1';
}
function amapAppUrl(p) {
  const scheme = IS_IOS ? 'iosamap' : 'androidamap';
  return scheme + '://viewMap?sourceApplication=moganshan-trip&poiname=' +
    encodeURIComponent(p.name) + '&lat=' + p.lat + '&lon=' + p.lng + '&dev=0';
}

/* 手机浏览器：先拉 App，页面被切走即成功；未安装则回退网页 */
function launchOrFallback(schemeUrl, webUrl) {
  let gone = false;
  const onVis = () => { if (document.hidden) { gone = true; clearTimeout(t); } };
  document.addEventListener('visibilitychange', onVis);
  location.href = schemeUrl;
  const t = setTimeout(() => {
    document.removeEventListener('visibilitychange', onVis);
    if (!gone && !document.hidden) location.href = webUrl;
  }, 800);
}

function openAmap(id) {
  const p = REG[id]; if (!p) return;
  if (IS_MOBILE && !IN_APP_WEBVIEW) { launchOrFallback(amapAppUrl(p), amapWebUrl(p)); return; }
  const u = amapWebUrl(p);
  if (IN_APP_WEBVIEW) { location.href = u; return; }
  const w = window.open(u, '_blank');
  if (!w) location.href = u;
}
function openDp(id) {
  const p = REG[id]; if (!p) return;
  if (IS_MOBILE && !IN_APP_WEBVIEW) launchOrFallback(dpApp(p), dpWeb(p));
  else location.href = dpWeb(p);
}

/* ═══ 弹窗 ═══ */
function popupHtml(p) {
  const t = TYPES[p.type] || TYPES.spot;
  let h = '<div class="pp">' + (p.time ? '<div class="pp-when">' + p.time + '</div>' : '') + '<b>' + p.name + '</b>';
  h += ' <span class="badge ' + t.cls + '">' + t.badge + '</span>';
  if (p.desc) h += '<div class="pp-desc">' + p.desc + '</div>';
  h += '<div class="pp-links">' +
    '<button class="btn amap" onclick="openAmap(' + p._id + ')">🧭 高德</button>' +
    (p.dianping === false ? '' : '<button class="btn dp" onclick="openDp(' + p._id + ')">🍜 点评</button>') +
    '</div></div>';
  return h;
}

/* ═══ 地图视图 ═══ */
function pinIcon(color, emoji) {
  return L.divIcon({
    className: '', iconSize: [28, 28], iconAnchor: [14, 14],
    html: '<div class="pin" style="background:' + color + '">' + (emoji || '') + '</div>'
  });
}
let layerItems = [];
function clearView() {
  layerItems.forEach(l => map.removeLayer(l));
  layerItems = [];
  REG.forEach(p => { p._marker = null; });
}
function showView(view) {
  clearView();
  if (view === 'all') {
    const pts = [];
    AREAS.forEach(a => a.places.forEach(p => {
      const c = L.circleMarker([p.lat, p.lng], {
        radius: 5.5, fillColor: a.color, color: '#fff', weight: 1.5, fillOpacity: .92
      }).addTo(map).bindPopup(popupHtml(p));
      layerItems.push(c);
      pts.push([p.lat, p.lng]);
    }));
    if (pts.length) {
      map.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
      if (map.getZoom() < 12) map.setZoom(12);
    }
    return;
  }
  const a = AREAS.find(x => x.id === view);
  if (!a) return;
  const coords = [];
  a.places.forEach(p => {
    const t = TYPES[p.type] || TYPES.spot;
    const m = L.marker([p.lat, p.lng], { icon: pinIcon(a.color, t.emoji) })
      .addTo(map).bindPopup(popupHtml(p));
    p._marker = m;
    layerItems.push(m);
    coords.push([p.lat, p.lng]);
  });
  if (coords.length > 1) {
    layerItems.push(L.polyline(coords, { color: a.color, weight: 2.5, opacity: .5, dashArray: '6,6' }).addTo(map));
  }
  if (coords.length) map.fitBounds(coords, { padding: [42, 42], maxZoom: 15 });
}

/* ═══ 卡片 ═══ */
function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function card(p) {
  const t = TYPES[p.type] || TYPES.spot;
  let btns = '<button class="btn amap" onclick="event.stopPropagation();openAmap(' + p._id + ')">🧭 高德地图</button>';
  if (p.dianping !== false) {
    btns += '<button class="btn dp" onclick="event.stopPropagation();openDp(' + p._id + ')">🍜 大众点评</button>';
  }
  if (p.reserve) {
    btns += '<a class="btn rsv" href="' + p.reserve + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">📅 预约</a>';
  }
  let h = '<div class="tl-item"><div class="tl-dot" style="background:' + t.color + '"></div>';
  h += '<div class="card" role="button" tabindex="0" onclick="toggleCard(this,' + p._id + ')" onkeydown="if(event.key===\'Enter\'){toggleCard(this,' + p._id + ')}">';
  if (p.time) h += '<div class="when">' + p.time + '</div>';
  h += '<div class="name"><span class="badge ' + t.cls + '">' + t.badge + '</span>' + esc(p.name) + '</div>';
  if (p.desc) h += '<div class="desc">' + esc(p.desc) + '</div>';
  if (p.budget) h += '<span class="budget">' + esc(p.budget) + '</span>';
  if (p.detail) h += '<div class="details closed">' + esc(p.detail).replace(/\n/g, '<br>') + '</div>';
  h += '<div class="links">' + btns + '</div></div></div>';
  return h;
}
function toggleCard(el, id) {
  const d = el.querySelector('.details');
  if (d) d.classList.toggle('closed');
  const p = REG[id]; if (!p) return;
  map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: .7 });
  if (p._marker && map.hasLayer(p._marker)) {
    setTimeout(() => p._marker.openPopup(), 720);
  }
}

/* ═══ 区域视图 ═══ */
function renderArea(a) {
  return '<div class="day-head"><h2>' + a.name + '</h2><p>' + a.intro + '</p></div>' +
    '<div class="section-head">共 ' + a.places.length + ' 站 · 顺序即当天动线</div>' +
    '<div class="timeline">' + a.places.map(card).join('') + '</div>';
}

/* ═══ 总览 ═══ */
function overview() {
  const n = REG.length, areas = AREAS.length;
  const eat = REG.filter(p => p.type === 'food').length;

  let h = '<div class="hero">' +
    '<div class="eyebrow">Moganshan · 3 Days</div>' +
    '<h1>莫干山三日 · 逛吃地图</h1>' +
    '<p class="subtitle">10 点出发、4 点返程，把三天钉在一张图上</p>' +
    '<p class="hero-meta">2026.11.14–11.16 · 上海自驾 210 km · 点卡片直达高德</p></div>';

  h += '<div class="info-grid">' +
    '<div class="info-card"><div class="label">行程地点</div><div class="value">' + n + ' 处</div></div>' +
    '<div class="info-card"><div class="label">天数</div><div class="value">' + areas + ' 天</div></div>' +
    '<div class="info-card"><div class="label">正经吃饭</div><div class="value">' + eat + ' 顿</div></div>' +
    '<div class="info-card"><div class="label">单程车程</div><div class="value">2 小时 40 分</div></div></div>';

  h += '<div class="section-head">三天速览</div><div class="area-nav">' + AREAS.map(a => {
    const eatN = a.places.filter(p => p.type === 'food').length;
    return '<div class="area-card" role="button" tabindex="0" onclick="go(\'' + a.id + '\')" onkeydown="if(event.key===\'Enter\')go(\'' + a.id + '\')">' +
      '<div class="area-dot" style="background:' + a.color + '"></div>' +
      '<div class="area-name">' + a.label + '</div>' +
      '<div class="area-meta">' + a.places.length + ' 站' + (eatN ? ' · ' + eatN + ' 顿' : '') + '</div>' +
      '<div class="area-intro">' + a.intro + '</div></div>';
  }).join('') + '</div>';

  h += '<div class="section-head">图例</div><div class="legend">' +
    Object.values(TYPES).map(t =>
      '<div class="legend-item"><div class="legend-dot" style="background:' + t.color + '"></div>' + t.label + '</div>'
    ).join('') + '</div>';

  h += '<div class="section-head">路上四件事</div>' +
    '<div class="note"><h4>景交末班是唯一的硬约束</h4>看完日落立刻去站点，末班约 17:00–17:30；错过的话山上打车又少又贵，只能请酒店协助。</div>' +
    '<div class="note"><h4>车停集散中心，别想开上山</h4>私家车不能进核心景区。停车 25 元/天封顶，景交往返 35 元 + 环线 15 元，门票 3 日有效。</div>' +
    '<div class="note"><h4>两顿饭值得提前打个电话</h4>金鱼妈妈、一凡周末位置紧，电话留位最稳；周日晚餐订 18:10，正好接上 17:20 的下山景交。</div>' +
    '<div class="note"><h4>山上比山下低 3–5℃</h4>日落约 17:00，16:30 以后山风明显。薄羽绒或冲锋衣、防滑鞋、保温杯，车里再放把伞。</div>';

  h += '<div class="section-head">关于这份地图</div>' +
    '<div class="note"><h4>坐标是高德系（GCJ-02）</h4>手机上点「高德地图」直接唤起高德 App（未安装自动回退网页版）；电脑上打开高德网页版。</div>' +
    '<div class="note"><h4>顺序就是当天动线</h4>切到 D1 / D2 / D3，地图上的虚线就是当天的先后顺序；点任意卡片，地图会飞过去。</div>';

  return h;
}

/* ═══ Tab 与导航 ═══ */
const tabsEl = document.getElementById('tabs');
const contentEl = document.getElementById('content');

const tabDefs = [{ id: 'all', label: '总览' }].concat(AREAS.map(a => ({ id: a.id, label: a.label })));
tabDefs.forEach(d => {
  const btn = document.createElement('button');
  btn.className = 'tab' + (d.id === 'all' ? ' active' : '');
  btn.dataset.view = d.id;
  btn.textContent = d.label;
  tabsEl.appendChild(btn);
});

let cur = 'all';
function go(view) {
  cur = view;
  tabsEl.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'all') contentEl.innerHTML = overview();
  else {
    const a = AREAS.find(x => x.id === view);
    contentEl.innerHTML = a ? renderArea(a) : '';
  }
  showView(view);
  window.scrollTo(0, 0);
  const tab = tabsEl.querySelector('[data-view="' + view + '"]');
  if (tab) tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}
tabsEl.addEventListener('click', e => {
  const t = e.target.closest('.tab');
  if (t) go(t.dataset.view);
});

/* ═══ 暴露给内联事件 ═══ */
window.openAmap = openAmap;
window.openDp = openDp;
window.go = go;
window.toggleCard = toggleCard;

go('all');
})();
