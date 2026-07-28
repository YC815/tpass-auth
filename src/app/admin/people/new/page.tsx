import { NewSubjectForm } from "./NewSubjectForm";

export default function NewPersonPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">新增人員</h1>
        <p className="mt-1 font-medium text-muted-foreground">
          輸入 email 建立人員，之後即可對各服務調整角色與管制。
        </p>
      </div>
      <NewSubjectForm />
    </div>
  );
}
