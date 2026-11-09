# 莫干山三日 · 逛吃地图

2026 年 11 月 14–16 日，上海自驾莫干山三天两晚的行程地图：高德底图 + GCJ-02 坐标，按天组织；
手机上一键唤起高德地图，餐厅还能直接搜大众点评。

- 16 个地点，D1 庾村 / D2 山上 / D3 山北 三段动线
- 10:00 出发、16:00 返程，每天只安排一件「正事」
- 点卡片：地图飞过去 + 展开细节；点按钮：直接导航

## 改行程（不用本地环境）

1. 打开 [`src/data.js`](src/data.js) → 右上角铅笔 ✏️
2. 照现有格式改 `places`：`name` / `type` / `time` / `lat` / `lng` / `desc` / `detail` / `budget`
   - `type`：`food` 餐 · `spot` 逛 · `stay` 住 · `hub` 行（换乘/停车）
   - 同一区域内的顺序 = 地图上的虚线动线
3. Commit → GitHub Actions 自动重新构建 `index.html`，1–2 分钟后线上更新

坐标用**高德系 GCJ-02**，`lng` 在前、`lat` 在后；可以用[高德坐标拾取器](https://lbs.amap.com/tools/picker)取。

## 目录结构

| 路径 | 说明 |
|---|---|
| `src/data.js` | **数据区：加地点/改时间只动这里** |
| `src/engine.js` `src/app.css` `src/shell.html` | 引擎 / 样式 / 页面骨架 |
| `lib/` | Leaflet 1.9.4 |
| `index.html` | 构建产物，别手改 |
| `assets/` `manifest.json` | 图标与「添加到主屏幕」信息 |

## 本地构建

```bash
node src/build.mjs            # 生成 index.html
python3 -m http.server 8000   # 手机连同一 Wi-Fi 预览
```

## 部署

仓库 Settings → Pages → Source 选 *Deploy from a branch*，分支 `main`、目录 `/ (root)`。
线上地址：<https://lyf1122.github.io/moganshan-trip/>

> 底图来自高德瓦片，仅作个人行程参考；景点门票、营业时间以现场公告为准。
