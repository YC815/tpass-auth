// HTTPS 自訂伺服器：next start 無原生 HTTPS，跨子網域階段需要真憑證。
// 用官方 custom-server API（next 程式化）包一層 node:https，端到端 TLS。
// 此檔不經 Next 編譯，語法須與當前 Node 相容。
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import pkg from "@next/env";
import next from "next";

const { loadEnvConfig } = pkg;

// server.mjs 不是 Next 路由，process.env 不會自動載入 .env.local；明確載入。
loadEnvConfig(process.cwd());

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || "auth.lvh.me";

const httpsOptions = {
  key: readFileSync(process.env.TLS_KEY_FILE || "./auth.t-pass.test+1-key.pem"),
  cert: readFileSync(process.env.TLS_CERT_FILE || "./auth.t-pass.test+1.pem"),
};

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();
createServer(httpsOptions, (req, res) => handle(req, res)).listen(port, () => {
  console.log(`> auth ready on https://${hostname}:${port}`);
});
