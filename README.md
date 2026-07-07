# APEX WATCH — 終末予兆監視システム

**World Apocalypse Early Warning System**
DEFCON・軍事活動・BizJet(富裕層脱出)・海運・NEO(地球接近天体)・宇宙天気・サイバー攻撃・GDELT世界メディア論調などを横断的に監視し、「DOOMSDAY INDEX」として統合表示するリアルタイムダッシュボードです。

🔗 https://apex-watch.jp

---

## 概要

裏付けとなる公開データソース(政府機関API・公開REST API・公開YouTubeライブ)のみを用い、独自サーバーを持たずにブラウザ側で完結する静的サイトとして構築されています。取得したデータは閲覧者のブラウザ内で処理・表示されるのみで、サイト側での保存は行いません(詳細は [privacy.html](privacy.html) 参照)。

## 監視モジュール

| モジュール | ファイル | データソース |
|---|---|---|
| DOOMSDAY INDEX(統合脅威スコア) | [app.js](app.js) | 各モジュールのスコアを重み付け合算 |
| DEFCON / FPCON パネル | [defcon.js](defcon.js) | 民間監視サイト推定値 / 在日米軍公開情報 |
| 軍事機動監視 | [military.js](military.js) | OpenSky Network REST API |
| ビジネスジェット脱出監視 | [bizjet.js](bizjet.js) | OpenSky Network REST API |
| 海運指数(BDI/FBX) | [shipping.js](shipping.js) | Yahoo Finance / Freightos |
| NEO(地球接近天体) | [neo.js](neo.js) / [neo3d.js](neo3d.js) | NASA NeoWs API + Three.js 3D可視化 |
| 地球科学・宇宙天気 | [earth.js](earth.js) | NOAA SWPC / USGS / Smithsonian GVP |
| サイバー攻撃可視化 | [cyber.js](cyber.js) | Canvas / SVG(D3投影連動) |
| GDELT世界メディア監視 | [gdelt.js](gdelt.js) | GDELT Project GEO/DOC/TimelineTone API |
| 南西諸島・台湾海峡監視 | [gdelt-region.js](gdelt-region.js) / [southwest-taiwan.js](southwest-taiwan.js) | GDELT地域限定版 + 気象データ |
| グローバル脅威マップ | [map.js](map.js) | D3.js(Natural Earth 1投影)+ world-atlas |
| ライブニュース(ABC / Al Jazeera / Sky News) | [yt.js](yt.js) | YouTube埋め込み(タブ切替) |
| 恐怖&強欲指数 | [app.js](app.js) | Alternative.me API |
| PWA / オフライン対応 | [sw.js](sw.js) / [manifest.json](manifest.json) | Service Worker |

## アーキテクチャ

- **フロントエンド**: 素の HTML / CSS / JavaScript(ビルド工程なし、フレームワーク非依存)
- **CORSプロキシ**: [cloudflare-worker/worker.js](cloudflare-worker/worker.js)(Cloudflare Workers、[wrangler.toml](wrangler.toml)でデプロイ)。GDELTやYouTube Data APIなど、ブラウザから直接叩けない/レート制限の厳しいAPIを中継し、エッジキャッシュ(GDELTは15分)も担う
- **プロキシ設定**: [config.js](config.js) の `APEX_PROXY_BASE` でWorkerのURLを指定(未設定時は公開プロキシにフォールバック)
- **ホスティング**: GitHub Pages(カスタムドメイン、[CNAME](CNAME))
- **デプロイ**: `main` ブランチへのpushで [.github/workflows/pages.yml](.github/workflows/pages.yml) が自動実行(失敗時は同一run内で最大3回リトライ)

## ローカルでの確認

ビルド不要の静的サイトのため、任意のローカルサーバーで配信するだけで動作します。

```bash
npx serve .
# もしくは
python -m http.server 8000
```

一部モジュール(YouTubeライブID解決・GDELT取得など)は自前Workerプロキシ経由の通信を行うため、`config.js` の `APEX_PROXY_BASE` が有効なWorker URLを指している必要があります。

## Cloudflare Worker のデプロイ

```bash
cd cloudflare-worker
wrangler deploy
```

## 法務文書

- [disclaimer.html](disclaimer.html) — 免責事項・改訂履歴
- [privacy.html](privacy.html) — プライバシーポリシー・データフロー・外部サービス一覧
