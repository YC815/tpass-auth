"use client";
// 通用二次確認彈窗，用原生 <dialog>（showModal/close）——不裝額外套件。
// ban 這種高風險操作用它擋一次，比 window.confirm() 更能把 reason 摘要秀出來。
import { useEffect, useRef } from "react";
import { Button } from "./primitives";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "確認",
  cancelLabel = "取消",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Esc 鍵觸發的原生 cancel 事件：擋掉預設關閉行為，改走同一個 onCancel。
        e.preventDefault();
        onCancel();
      }}
      onClose={onCancel}
      className="m-auto rounded-2xl border-2 border-foreground bg-card p-0 shadow-[6px_6px_0_0_var(--color-foreground)]"
    >
      <div className="w-[min(90vw,26rem)] p-6">
        <h2 className="font-extrabold text-lg text-foreground">{title}</h2>
        <div className="mt-2 text-sm font-medium text-muted-foreground">{message}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="default" size="sm" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "處理中…" : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
