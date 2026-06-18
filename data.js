/* ============================================================
   APEX WATCH — Static curated intelligence data
   Sources: Public reports, academic research, news archives
   ============================================================ */

const TIMELINE_EVENTS = [
  { date: '2020-03', text: 'ビリオネア\nバンカー注文\n+300%急増', level: 'red' },
  { date: '2021-06', text: 'ジェフ・ベゾス\nNZ永住権\n取得報道', level: 'orange' },
  { date: '2021-09', text: 'Vivos社\n地下都市\n完成 (SD)', level: 'orange' },
  { date: '2022-01', text: '富裕層\nプライベートジェット\n注文2年待ち', level: 'yellow' },
  { date: '2022-04', text: 'メタ\nザッカーバーグ\nハワイ要塞建設', level: 'orange' },
  { date: '2022-08', text: 'Starlink\n衛星3000機\n突破', level: 'yellow' },
  { date: '2023-01', text: 'Altos Labs\n老化研究\n$3B調達', level: 'orange' },
  { date: '2023-06', text: 'UAE黄金ビザ\n前年比127%\n申請増', level: 'orange' },
  { date: '2023-11', text: 'xPoint社\n個人用核\nシェルター完売', level: 'red' },
  { date: '2024-02', text: 'NZ土地法改正\n富裕層向け\n特別条項', level: 'orange' },
  { date: '2024-06', text: 'プライベートジェット\n運航記録\n史上最高', level: 'yellow' },
  { date: '2024-09', text: 'AIバイオ企業\n30億ドル\n資金流入', level: 'orange' },
  { date: '2025-01', text: '民間警備市場\n$376B達成\n過去最高', level: 'orange' },
  { date: '2025-03', text: 'Starlink\n7000衛星\n到達', level: 'yellow' },
  { date: '2025-06', text: '防弾車\n待機リスト\n2年以上', level: 'red' },
  { date: '2026-06', text: '⚠ 現在地\nAPEX指数\n計算中...', level: 'red' },
];

const NEWS_ITEMS = [
  {
    tag: '資産逃避', tagClass: 'red',
    title: 'ビリオネアのビットコイン保有が過去最高水準に — 「法定通貨離れ」加速',
    meta: 'Bloomberg Intelligence 2026年Q1レポート',
  },
  {
    tag: '居住権', tagClass: 'orange',
    title: 'ニュージーランドへの富裕層移住申請が過去5年で最多を記録、バンカー付き農場人気',
    meta: 'NZ Immigration Service 2026-03',
  },
  {
    tag: '医療・延命', tagClass: '',
    title: 'シリコンバレー長寿研究に年間$4.2Bが流入 — 「死の解決」が投資テーマに',
    meta: 'Nature Aging, Pitchbook Data 2025',
  },
  {
    tag: '通信', tagClass: '',
    title: 'SpaceX Starlinkが7,000衛星を突破 — 政府インフラ依存なし通信網が完成段階',
    meta: 'SpaceX公式発表 2025-03',
  },
  {
    tag: '移動手段', tagClass: 'orange',
    title: 'メルセデスAMG G-wagen装甲仕様の待機リストが24ヶ月超 — 富裕層の需要急増',
    meta: 'AutoBild Security Special 2026-01',
  },
  {
    tag: '警備', tagClass: 'red',
    title: '世界の民間軍事企業(PMC)雇用が+145% — エリート層の個人警備・軍隊化が加速',
    meta: 'Jane\'s Defence, SIPRI 2025年報告',
  },
  {
    tag: '資産逃避', tagClass: '',
    title: '金価格が$3,500/oz突破 — 中央銀行と資産家層が同時大量購入',
    meta: 'World Gold Council Q1 2026',
  },
  {
    tag: '居住権', tagClass: 'orange',
    title: 'UAE黄金ビザ取得者の実態調査 — 上位富裕層の76%がセカンドパスポートを所持',
    meta: 'Henley & Partners Global Report 2026',
  },
];

const TICKER_ITEMS = [
  { text: '⚠ BTC: $108,000超 — 機関投資家とHNWIが現金から暗号資産へ資金移動', cls: 'alert' },
  { text: '◈ Alcor冷凍保存: 新規契約が前年比+34% — 富裕層の「死の保険」需要増', cls: 'warn' },
  { text: '◈ ニュージーランド・クライストチャーチ近郊でバンカー付き農場が過去最高値で売却', cls: 'warn' },
  { text: '▲ プライベートジェット燃料消費量2025年: 史上最高記録 — 移動パターン変化', cls: 'warn' },
  { text: '⊛ Starlink衛星端末: 個人契約数が1,000万件突破、政府監視外通信が一般化', cls: 'info' },
  { text: '◈ Vivos xPoint (SD) 全575区画が完売 — 次のプロジェクト予約開始', cls: 'alert' },
  { text: '▲ スイス、シンガポール、カイマン諸島への資金移動が過去最大水準', cls: 'warn' },
  { text: '✚ Altos Labs: $3B資金で老化細胞リセット実験 — 2030年代臨床試験予定', cls: 'info' },
  { text: '⚠ 民間警備市場2025年: $376B — 10年前比+280%、過去最高', cls: 'alert' },
  { text: '◈ G20富裕層税率協議: 年間$1T超の資金が対象国外へ移動中と試算', cls: 'warn' },
];
