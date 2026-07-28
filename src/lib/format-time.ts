// 顯示時間的唯一入口（後台與 /denied 共用）。
//
// 為什麼需要這支：稽核頁、服務頁、/denied 都是 server component，直接呼叫 toLocaleString()
// 用的是**主機**時區，不是使用者的。主機若不在 Asia/Taipei（VPS 預設常是 UTC），
// 顯示的時間就跟事情真正發生的時間對不上——那是資料正確性問題，不只是排版問題。
//
// 為什麼用 formatToParts 手工拼、不用 toLocaleString 的預設輸出：
// locale 的分隔符與補零習慣（en-CA / zh-Hant-TW）在不同 Node/ICU 版本下會飄，
// 稽核紀錄與解封時間是拿來對帳的東西，格式不能隨執行環境變。
//
// 時區寫死不走 env：這是台灣的學校，使用者全在同一個時區。為它發明一顆環境變數
// 只會多一個上線時會忘記設的東西。
const TIME_ZONE = "Asia/Taipei";

function taipeiParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12:false 在部分 ICU 下午夜會給 "24"，校正回 "00"。
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { year: get("year"), month: get("month"), day: get("day"), hour, minute: get("minute") };
}

export function formatDateTime(d: Date): string {
  const p = taipeiParts(d.getTime());
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// Unix 秒版本：JWT 的 exp / PermissionEntry.until 都是秒，不必在呼叫端到處 *1000。
export function formatDateTimeFromUnix(seconds: number): string {
  return formatDateTime(new Date(seconds * 1000));
}

// 只要時:分（「最晚 HH:MM 失效」這種同日內的提示）。
export function formatTimeFromUnix(seconds: number): string {
  const p = taipeiParts(seconds * 1000);
  return `${p.hour}:${p.minute}`;
}
