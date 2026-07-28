// 批次授權的貼上區解析。純函式無 IO——這裡的規則要好測、好講給部員聽。
//
// 分隔符一次吃掉換行 / 逗號 / 分號 / 空白：試算表拖一欄貼過來是換行或 TAB、
// AI 整理出來常是逗號串一行、手打的人會用空白。全部收斂成同一條規則，
// 使用者不必知道「這個框要什麼格式」——貼上去就對了。

// 夠用就好：擋掉明顯打錯的字串，不追求完整 RFC 5322。
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// 一次能處理的上限。沒有這道閘，貼一萬行就是一萬筆 Grant upsert + 一萬筆稽核，
// 交易會拖垮連線池——寧可要人分兩次貼。
export const MAX_EMAILS = 200;

export interface ParsedEmails {
  valid: string[]; // 小寫、去重、保留首次出現順序
  invalid: string[]; // 原樣保留，讓使用者認得出自己打錯的是哪一個
}

export function parseEmailList(raw: string): ParsedEmails {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of raw.split(/[\s,;]+/)) {
    if (!token) continue; // 頭尾分隔符會切出空字串
    const email = normalizeEmail(token);
    if (!isValidEmail(email)) {
      invalid.push(token);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }

  return { valid, invalid };
}
