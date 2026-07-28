// 打錯網址時的 404。在此之前會掉到 Next 預設畫面（未套用本站字體與樣式）。
import type { Metadata } from "next";
import { ErrorPage } from "@/components/ErrorPage";

export const metadata: Metadata = { title: "找不到頁面 — T-Pass" };

export default function NotFound() {
  return (
    <ErrorPage
      code="404 NOT FOUND"
      title="找不到這個頁面"
      message="T-Pass 只負責登入與發證，你要找的東西可能在門戶大廳或某個服務裡。"
    />
  );
}
