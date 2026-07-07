import { useState } from "react";
import { api, ApiError } from "./api";

export function ForceChangePassword({ onDone }: { onDone: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 8) {
      setError("新密码至少 8 位");
      return;
    }
    setLoading(true);
    try {
      await api.changePassword("", newPassword);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "修改失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950"
      >
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">首次登录,请修改密码</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          当前账号还在使用初始密码,必须先修改密码才能继续使用管理后台。
        </p>

        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">新密码(至少 8 位)</label>
        <input
          type="password"
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoFocus
        />
        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">确认新密码</label>
        <input
          type="password"
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "提交中..." : "修改密码并继续"}
        </button>
      </form>
    </div>
  );
}
