"use client";
// 批次授權表單：貼上 → 預覽 → 套用。兩段式刻意不省——一次動幾十筆權限，
// 「按下去之前先看清楚會變成什麼」比少一次點擊重要得多。
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Eye } from "lucide-react";
import {
  previewBulkGrant,
  applyBulkGrant,
  type BulkPreview,
} from "@/app/admin/actions";
import type { Role } from "@/lib/permissions/types";
import { Card, Button, Label, Textarea } from "@/components/admin/primitives";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EffectiveAtNotice } from "@/components/admin/EffectiveAtNotice";
import { ROLE_LABEL } from "@/components/admin/PermBadge";

export function BulkGrantForm({
  serviceIds,
  preselected,
  ttlSeconds,
  emailDomain,
}: {
  serviceIds: string[];
  preselected: string[];
  ttlSeconds: number;
  emailDomain: string;
}) {
  const router = useRouter();
  const [emailsRaw, setEmailsRaw] = useState("");
  const [selected, setSelected] = useState<string[]>(preselected);
  const [role, setRole] = useState<Role>("admin");
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effectiveAt, setEffectiveAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const input = { emailsRaw, serviceIds: selected, role };

  // 任何輸入變動都讓舊預覽失效——停在畫面上的過期預覽會讓人以為那就是即將套用的內容。
  function invalidate<T>(setter: (v: T) => void) {
    return (value: T) => {
      setPreview(null);
      setEffectiveAt(null);
      setError(null);
      setter(value);
    };
  }

  function toggleService(id: string) {
    invalidate<string[]>(setSelected)(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  }

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEffectiveAt(null);
    startTransition(async () => {
      const result = await previewBulkGrant(input);
      if (!result.ok) {
        setPreview(null);
        setError(result.error);
        return;
      }
      setPreview(result);
    });
  }

  function doApply() {
    setError(null);
    startTransition(async () => {
      const result = await applyBulkGrant(input);
      setConfirmOpen(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(null);
      setEmailsRaw("");
      setEffectiveAt(Math.floor(Date.now() / 1000) + ttlSeconds);
      router.refresh();
    });
  }

  function handleApply() {
    // 給管理員權限跟給版主權限風險不同——會產生 admin 的批次多擋一道。
    if (role === "admin") {
      setConfirmOpen(true);
      return;
    }
    doApply();
  }

  return (
    <>
      <Card>
        <form onSubmit={handlePreview} className="space-y-5">
          <div>
            <Label htmlFor="bulk-emails">Email 清單</Label>
            <Textarea
              id="bulk-emails"
              rows={8}
              value={emailsRaw}
              onChange={(e) => invalidate(setEmailsRaw)(e.target.value)}
              className="mt-1"
              // 佔位文字用假學號＋env 帶進來的網域：不要把真人的信箱寫進 UI，也不要寫死網域。
              placeholder={[1, 2, 3].map((n) => `1140000${n}@${emailDomain}`).join("\n")}
            />
          </div>

          <div>
            <Label>套用到服務</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {serviceIds.map((id) => {
                const on = selected.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleService(id)}
                    className={`rounded-xl border-2 border-foreground px-3 py-1.5 font-mono text-sm font-bold shadow-[2px_2px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)] ${
                      on ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
                    }`}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
            {selected.includes("auth") && (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                <strong className="font-mono">auth</strong> ＝本管理面板本身。設為
                <strong>管理員</strong>＝這批人都能進本面板改所有人的角色與管制。
              </p>
            )}
          </div>

          <div className="max-w-xs">
            <Label htmlFor="bulk-role">角色</Label>
            <RoleSelect value={role} onChange={invalidate(setRole)} className="mt-1" />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              這裡只調整角色。警告與禁止瀏覽請到個別人員頁——那需要填原因，不適合整批做。
            </p>
          </div>

          {error && <p className="font-mono text-xs font-bold text-destructive">{error}</p>}
          {effectiveAt && <EffectiveAtNotice effectiveAtSeconds={effectiveAt} />}

          <Button type="submit" variant="default" disabled={pending}>
            <Eye className="h-4 w-4" />
            {pending ? "處理中…" : "預覽變更"}
          </Button>
        </form>
      </Card>

      {preview && (
        <PreviewPanel
          preview={preview}
          role={role}
          pending={pending}
          onApply={handleApply}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`確定要把 ${preview?.changes.length ?? 0} 筆權限設為管理員嗎？`}
        message={
          <>
            管理員可以在該服務改所有人的角色與管制。若其中包含
            <strong className="font-mono"> auth</strong>，那些人還能進入本管理面板、把別人也設成管理員。
          </>
        }
        confirmLabel="確定套用"
        pending={pending}
        onConfirm={doApply}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function PreviewPanel({
  preview,
  role,
  pending,
  onApply,
}: {
  preview: BulkPreview;
  role: Role;
  pending: boolean;
  onApply: () => void;
}) {
  const { changes, unchanged, blocked, newSubjectCount } = preview;

  return (
    <Card className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-extrabold text-lg">預覽</h2>
        <Button variant="primary" onClick={onApply} disabled={pending || changes.length === 0}>
          <Users className="h-4 w-4" />
          {pending ? "套用中…" : `確定套用 ${changes.length} 筆`}
        </Button>
      </div>

      <Section
        title="將變更"
        count={changes.length}
        tone="bg-tone-green-badge text-tone-green-text"
        empty="沒有需要變更的項目。"
      >
        {changes.map((c) => (
          <Row key={`${c.email} ${c.serviceId}`} email={c.email} serviceId={c.serviceId}>
            {ROLE_LABEL[c.from]} → <strong>{ROLE_LABEL[c.to]}</strong>
          </Row>
        ))}
      </Section>

      {newSubjectCount > 0 && (
        <p className="font-mono text-xs font-bold text-muted-foreground">
          其中 {newSubjectCount} 人尚未建立，套用時會一併建立（不必先登入過）。
        </p>
      )}

      {unchanged.length > 0 && (
        <Section
          title="無變化（已經是這個角色）"
          count={unchanged.length}
          tone="bg-tone-blue-badge text-tone-blue-text"
        >
          {unchanged.map((u) => (
            <Row key={`${u.email} ${u.serviceId}`} email={u.email} serviceId={u.serviceId}>
              已是 {ROLE_LABEL[role]}
            </Row>
          ))}
        </Section>
      )}

      {blocked.length > 0 && (
        <Section
          title="擋下"
          count={blocked.length}
          tone="bg-tone-rose-badge text-tone-rose-text"
        >
          {blocked.map((b, i) => (
            <Row key={`${b.email} ${b.serviceId ?? "-"} ${i}`} email={b.email} serviceId={b.serviceId}>
              {b.reason}
            </Row>
          ))}
        </Section>
      )}
    </Card>
  );
}

function Section({
  title,
  count,
  tone,
  empty,
  children,
}: {
  title: string;
  count: number;
  tone: string;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="font-bold">{title}</h3>
        <span
          className={`inline-block rounded-md border-2 border-foreground px-2 py-0.5 font-mono text-[11px] font-bold ${tone}`}
        >
          {count}
        </span>
      </div>
      {count === 0 ? (
        empty && <p className="mt-2 font-medium text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">{children}</ul>
      )}
    </div>
  );
}

function Row({
  email,
  serviceId,
  children,
}: {
  email: string;
  serviceId: string | null;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 border-b border-foreground/10 py-1 last:border-0">
      <span className="font-mono text-xs font-bold">{email}</span>
      {serviceId && <span className="font-mono text-[10px] text-muted-foreground">{serviceId}</span>}
      <span className="text-xs font-medium text-muted-foreground">{children}</span>
    </li>
  );
}
