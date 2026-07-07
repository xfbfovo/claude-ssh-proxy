import { useEffect, useState } from "react";
import { api, type MeResponse } from "./api";
import { Login } from "./Login";
import { ForceChangePassword } from "./ForceChangePassword";
import { RoutesPage } from "./RoutesPage";
import { ClientKeysPage } from "./ClientKeysPage";
import { SettingsPage } from "./SettingsPage";
import { AuditPage } from "./AuditPage";

type Tab = "routes" | "client-keys" | "settings" | "audit";

function App() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("routes");

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecked(true));
  }, []);

  async function logout() {
    await api.logout();
    setMe(null);
  }

  if (!checked) return null;

  if (!me) {
    return <Login onLoggedIn={setMe} />;
  }

  if (!me.initialized) {
    return <ForceChangePassword onDone={() => setMe({ ...me, initialized: true })} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">claude-ssh-proxy 管理后台</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>{me.username}</span>
            <button onClick={logout} className="text-indigo-600 hover:underline dark:text-indigo-400">
              退出登录
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-6">
          {(
            [
              ["routes", "服务器路由"],
              ["client-keys", "客户端密钥"],
              ["settings", "监听设置"],
              ["audit", "审计日志"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                tab === key
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {tab === "routes" && <RoutesPage />}
        {tab === "client-keys" && <ClientKeysPage />}
        {tab === "settings" && <SettingsPage />}
        {tab === "audit" && <AuditPage />}
      </main>
    </div>
  );
}

export default App;
