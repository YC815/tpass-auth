// 服務註冊表讀取器。真相住在並排的 tpass-registry repo（public）的 services.json——
// 登記一個新服務 = 對那個 repo 開一個 PR，auth 這邊不必改程式碼、也不必改 env。
//
// 為什麼是讀檔而不是查 DB：服務清單是「部署時就決定好」的靜態事實，且它是**發證白名單**——
// 放進 DB 等於讓一個 SQL UPDATE 就能讓 auth 對新 audience 發證，沒有 diff、沒有 review。
import "server-only";
import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export interface RegistryService {
  id: string;
  name: string;
  dir: string;
  subdomain: string;
  port: number;
  enabled: boolean;
  deployed: boolean;
}

export interface Registry {
  issuer: string;
  domains: { dev: string; prod: string };
  services: RegistryService[];
}

// 佈局：~/tpass/{tpass-registry,tpass-auth,…}，本機與主機同構，所以上一層一定找得到。
// TPASS_REGISTRY_PATH 是逃生門（CI、非標準 checkout）。
// 這裡與下面的 readFileSync 都要 turbopackIgnore：路徑不是靜態的，少標任何一處，
// Turbopack 的檔案追蹤就會把整個專案當成需要打包的資產，build 時噴
// 「the whole project was traced unintentionally」警告。
function locate(): string {
  const override = process.env.TPASS_REGISTRY_PATH;
  if (override) return isAbsolute(override) ? override : resolve(/* turbopackIgnore: true */ process.cwd(), override);
  return join(/* turbopackIgnore: true */ process.cwd(), "..", "tpass-registry", "services.json");
}

function load(): Registry {
  const file = locate();
  try {
    return JSON.parse(readFileSync(/* turbopackIgnore: true */ file, "utf8")) as Registry;
  } catch (e) {
    throw new Error(
      `[lib/registry] 讀不到服務註冊表：${file}\n` +
        `  註冊表是並排的 public repo，在 tpass-auth 的上一層 clone 一次：\n` +
        `    git clone https://github.com/tschoolsu/tpass-registry.git\n` +
        `  或用 TPASS_REGISTRY_PATH 指到 services.json 的實際位置。\n` +
        `  原始錯誤：${(e as Error).message}`,
    );
  }
}

export const registry = load();

// 可以申請 per-service token 的消費端 id。
// 排除 issuer：auth 是發證端，不對自己發 per-service token（見 authorize route）。
// 排除停用服務：封存的服務不該還能換到票。
export const consumerServiceIds: string[] = registry.services
  .filter((s) => s.enabled && s.id !== registry.issuer)
  .map((s) => s.id);
