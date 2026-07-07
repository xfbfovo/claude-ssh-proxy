import { useEffect, useState } from "react";
import { api, ApiError, type ClientKey, type RouteRecord } from "./api";

const emptyKey: Omit<ClientKey, "id"> = {
  label: "",
  public_key: "",
  route_users: [],
};

export function ClientKeysPage() {
  const [keys, setKeys] = useState<ClientKey[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [editing, setEditing] = useState<(Omit<ClientKey, "id"> & { id?: number }) | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const [k, r] = await Promise.all([api.listClientKeys(), api.listRoutes()]);
    setKeys(k ?? []);
    setRoutes(r ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditing({ ...emptyKey });
    setError("");
  }

  function startEdit(k: ClientKey) {
    setEditing({ ...k });
    setError("");
  }

  function toggleRoute(routeUser: string) {
    if (!editing) return;
    const set = new Set(editing.route_users);
    if (set.has(routeUser)) {
      set.delete(routeUser);
    } else {
      set.add(routeUser);
    }
    setEditing({ ...editing, route_users: Array.from(set) });
  }

  async function save() {
    if (!editing) return;
    setError("");
    try {
      if (editing.id != null) {
        await api.updateClientKey(editing.id, editing);
      } else {
        await api.createClientKey(editing);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败");
    }
  }

  async function remove(id: number, label: string) {
    if (!confirm(`确定删除客户端密钥 "${label}" 吗?删除后所有关联它的路由都会失去这把 key 的登录权限。`)) return;
    await api.deleteClientKey(id);
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">客户端密钥</h2>
        <button
          onClick={startCreate}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + 添加客户端密钥
        </button>
      </div>

      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        每把密钥代表一个客户端身份(比如某个 Claude Agent),可以关联多个后端服务器路由——关联了哪些,这把 key 就能登录哪些。
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">名称</th>
              <th className="px-4 py-2">公钥指纹</th>
              <th className="px-4 py-2">关联的路由别名</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {keys.map((k) => (
              <tr key={k.id} className="text-slate-800 dark:text-slate-200">
                <td className="px-4 py-2">{k.label}</td>
                <td className="max-w-xs truncate px-4 py-2 font-mono text-xs" title={k.public_key}>
                  {k.public_key}
                </td>
                <td className="px-4 py-2">
                  {k.route_users.length === 0 ? (
                    <span className="text-slate-400">未关联任何路由</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {k.route_users.map((ru) => (
                        <span key={ru} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                          {ru}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => startEdit(k)} className="mr-3 text-indigo-600 hover:underline dark:text-indigo-400">
                    编辑
                  </button>
                  <button onClick={() => remove(k.id, k.label)} className="text-red-600 hover:underline dark:text-red-400">
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  还没有添加任何客户端密钥
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
              {editing.id != null ? `编辑 ${editing.label}` : "添加客户端密钥"}
            </h3>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                名称(比如 claude-agent-1)
              </label>
              <input
                className="input"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">公钥内容</label>
              <textarea
                className="input h-20 font-mono"
                value={editing.public_key}
                onChange={(e) => setEditing({ ...editing, public_key: e.target.value })}
                placeholder="ssh-ed25519 AAAA... claude-client"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                这把 key 能登录哪些路由别名
              </label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-300 p-2 dark:border-slate-700">
                {routes.length === 0 && (
                  <p className="text-sm text-slate-400">还没有配置任何路由,先去"服务器路由"页面添加</p>
                )}
                {routes.map((r) => (
                  <label key={r.route_user} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={editing.route_users.includes(r.route_user)}
                      onChange={() => toggleRoute(r.route_user)}
                    />
                    <span className="font-mono">{r.route_user}</span>
                    <span className="text-xs text-slate-400">
                      ({r.target_host}:{r.target_port})
                    </span>
                  </label>
                ))}
              </div>
            </div>

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
