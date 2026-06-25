// 產生 T-Pass 簽章用的 EdDSA (Ed25519) 金鑰對。
// 用法：node scripts/gen-keys.mjs
// 把輸出的兩行（含雙引號）貼進 .env.local。私鑰絕不進 git。
import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";

// 預設產出的 CryptoKey 不可匯出，要 export PEM 必須 extractable: true。
const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
  extractable: true,
});

const privatePem = await exportPKCS8(privateKey);
const publicPem = await exportSPKI(publicKey);

// .env（dotenv / @next/env）會在雙引號值內把 \n 還原成換行，
// 所以把 PEM 的換行轉成字面 \n，存成單行、可直接貼上。
const toEnvLine = (name, pem) =>
  `${name}="${pem.trimEnd().replace(/\n/g, "\\n")}"`;

console.log("# 貼進 .env.local：");
console.log(toEnvLine("JWT_PRIVATE_KEY", privatePem));
console.log(toEnvLine("JWT_PUBLIC_KEY", publicPem));
