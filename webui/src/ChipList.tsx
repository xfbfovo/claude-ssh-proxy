import { Tooltip } from "./Tooltip";

// ChipList 展示一组标签(比如"这台服务器关联的客户端密钥"或者反过来"这把密钥能登录的服务器")。
// 数量少的时候直接平铺;超过 max 个之后收起成 "+N",鼠标移上去显示剩下的完整列表,
// 避免多对多关系数量一多就换行、把表格撑得又高又乱。
export function ChipList({
  items,
  max = 3,
  emptyText,
}: {
  items: string[];
  max?: number;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <span className="text-slate-400">{emptyText}</span>;
  }

  const shown = items.slice(0, max);
  const rest = items.slice(max);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((item) => (
        <span key={item} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs whitespace-nowrap dark:bg-slate-800">
          {item}
        </span>
      ))}
      {rest.length > 0 && (
        <Tooltip text={rest.join(", ")}>
          <span className="cursor-help rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            +{rest.length}
          </span>
        </Tooltip>
      )}
    </div>
  );
}
