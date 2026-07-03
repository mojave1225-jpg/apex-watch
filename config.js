/* ============================================================
   APEX WATCH — サイト共通設定
   ============================================================ */

/* 自前CORSプロキシ(Cloudflare Worker)のベースURL。
   Workerデプロイ後に発行されるURLを設定する。
   例: 'https://apex-proxy.<アカウント名>.workers.dev/?url='
   空文字のままなら従来の公開プロキシ(allorigins等)を使用。 */
const APEX_PROXY_BASE = 'https://apex-proxy.mojave1225.workers.dev/?url=';

/* 上流URLを自前プロキシURLに変換(未設定ならnull) */
function apexProxyUrl(url) {
  return APEX_PROXY_BASE ? APEX_PROXY_BASE + encodeURIComponent(url) : null;
}
