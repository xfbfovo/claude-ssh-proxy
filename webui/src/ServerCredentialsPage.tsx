import { useEffect, useState } from "react";
import { api, ApiError, type ServerCredential } from "./api";
import { ChipList } from "./ChipList";

const emptyCredential: Omit<ServerCredential, "id" | "route_users"> = {
  label: "",
  auth_type: "password",
  auth_password: "",
  auth_private_key: "",
  auth_private_key_passphrase: "",
};

export function ServerCredentialsPage() {
  const [creds, setCreds] = useState<ServerCredential[]>([]);
  const [editing, setEditing] = useState<(Omit<ServerCredential, "id" | "route_users"> & { id?: number }) | null>(
    null
  );
  const [error, setError] = useState("");

  async function load() {
    setCreds((await api.listServerCredentials()) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditing({ ...emptyCredential });
    setError("");
  }

  function startEdit(c: ServerCredential) {
    setEditing({ ...c, auth_password: "", auth_private_key: "", auth_private_key_passphrase: "" });
    setError("");
  }

  async function save() {
    if (!editing) return;
    setError("");
    try {
      if (editing.id != null) {
        await api.updateServerCredential(editing.id, editing);
      } else {
        await api.createServerCredential(editing);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败");
    }
  }

  async function remove(id: number, label: string) {
    if (!confirm(`确定删除服务器凭据 "${label}" 吗?`)) return;
    try {
      await api.deleteServerCredential(id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "删除失败");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">服务器凭据</h2>
        <button
          onClick={startCreate}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + 添加服务器凭据
        </button>
      </div>

      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        多台服务器用同一套密码/私钥登录时,把它存成一份共享凭据,在"服务器"页面编辑某台服务器时选用它就行——改一处,所有用它的服务器都跟着生效。正在被服务器使用的凭据不能删除。
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">名称</th>
              <th className="px-4 py-2">认证方式</th>
              <th className="px-4 py-2">被哪些服务器使用</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {creds.map((c) => (
              <tr key={c.id} className="text-slate-800 dark:text-slate-200">
                <td className="px-4 py-2">{c.label}</td>
                <td className="px-4 py-2">{c.auth_type === "password" ? "密码" : "私钥"}</td>
                <td className="px-4 py-2">
                  <ChipList items={c.route_users} emptyText="暂无服务器使用" />
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => startEdit(c)} className="mr-3 text-indigo-600 hover:underline dark:text-indigo-400">
                    编辑
                  </button>
                  <button onClick={() => remove(c.id, c.label)} className="text-red-600 hover:underline dark:text-red-400">
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {creds.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  还没有添加任何服务器凭据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-950">
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editing.id != null ? `编辑 ${editing.label}` : "添加服务器凭据"}
            </h3>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                名称(比如"生产环境统一密码")
              </label>
              <input
                className="input"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">认证方式</label>
              <select
                className="input"
                value={editing.auth_type}
                onChange={(e) => setEditing({ ...editing, auth_type: e.target.value as "password" | "private_key" })}
              >
                <option value="password">密码</option>
                <option value="private_key">私钥</option>
              </select>
            </div>

            {editing.auth_type === "password" ? (
              <div className="mb-3">
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">密码(留空则不修改)</label>
                <input
                  type="password"
                  className="input"
                  value={editing.auth_password}
                  onChange={(e) => setEditing({ ...editing, auth_password: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    私钥内容(PEM,留空则不修改)
                  </label>
                  <textarea
                    className="input h-24 font-mono"
                    value={editing.auth_private_key}
                    onChange={(e) => setEditing({ ...editing, auth_private_key: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">私钥密码(如果有)</label>
                  <input
                    type="password"
                    className="input"
                    value={editing.auth_private_key_passphrase}
                    onChange={(e) => setEditing({ ...editing, auth_private_key_passphrase: e.target.value })}
                  />
                </div>
              </>
            )}

            {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:text-slate-200"
              >
                取消
              </button>
              <button
                onClick={save}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
