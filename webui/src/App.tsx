import { useEffect, useState } from "react";
import { api } from "./api";
import { Login } from "./Login";
import { RoutesPage } from "./RoutesPage";
import { SettingsPage } from "./SettingsPage";
import { AuditPage } from "./AuditPage";

type Tab = "routes" | "settings" | "audit";

function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("routes");

  useEffect(() => {
    api
      .me()
      .then((r) => setUsername(r.username))
      .catch(() => setUsername(null))
      .finally(() => setChecked(true));
  }, []);

  async function logout() {
    await api.logout();
    setUsername(null);
  }

  if (!checked) return null;

  if (!username) {
    return <Login onLoggedIn={setUsername} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">ssh-proxy 管理后台</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>{username}</span>
            <button onClick={logout} className="text-indigo-600 hover:underline dark:text-indigo-400">
              退出登录
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-6">
          {(
            [
              ["routes", "服务器路由"],
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
        {tab === "settings" && <SettingsPage />}
        {tab === "audit" && <AuditPage />}
      </main>
    </div>
  );
}

export default App;
