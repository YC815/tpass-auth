"use client";
// 建立人員：只要 email。人不必登入過——先建 Subject，登入時 sub 會回填（見 callback/google/route.ts）。
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSubjectAction } from "@/app/admin/actions";
import { Card, Input, Label, Button } from "@/components/admin/primitives";

export function NewSubjectForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSubjectAction(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/people/${encodeURIComponent(result.email ?? email)}`);
    });
  }

  return (
    <Card className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="new-subject-email">Email</Label>
          <Input
            id="new-subject-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@tschool..."
            className="mt-1"
          />
        </div>
        {error && <p className="font-mono text-xs font-bold text-destructive">{error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "建立中…" : "建立並前往編輯"}
        </Button>
      </form>
    </Card>
  );
}
