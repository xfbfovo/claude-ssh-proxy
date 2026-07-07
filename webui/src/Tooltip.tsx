// Tooltip 用 CSS group-hover 做的自定义提示框,鼠标移上去立刻显示,
// 不依赖浏览器原生 title 属性(原生 title 有延迟、样式简陋,容易被当成"没反应")。
export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-block">
      {children}
      <span
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 w-max max-w-xs -translate-x-1/2
          rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity
          duration-100 group-hover:opacity-100 dark:bg-slate-700"
      >
        {text}
      </span>
    </span>
  );
}
