"use client";
// 儲存成功後顯示「此變更最晚於 HH:MM 對現有登入生效」——因為權限改變不即時撤銷既有
// per-service token（契約 v2 是無狀態本地驗章），生效延遲上限＝該服務 token 的 TTL。
// effectiveAtSeconds 是 Unix 秒（now + ttlSeconds），由呼叫端在存檔成功當下算好傳入。
export function EffectiveAtNotice({ effectiveAtSeconds }: { effectiveAtSeconds: number }) {
  const label = new Date(effectiveAtSeconds * 1000).toLocaleTimeString("zh-Hant-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <p className="rounded-md border-2 border-foreground bg-tone-green-bg px-3 py-1.5 font-mono text-xs font-bold text-tone-green-text">
      已儲存。此變更最晚於 {label} 對現有登入生效。
    </p>
  );
}
