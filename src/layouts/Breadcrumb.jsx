import React from "react";

export function Breadcrumb({ page, setPage, task }) {
  const items = [];
  if (page === "dashboard") items.push(["总览", "dashboard"]);
  if (page === "servers") items.push(["服务器", "servers"]);
  if (page === "compare") items.push(["综合对比", "compare"]);
  if (["tasks", "taskDetail", "subtask"].includes(page)) {
    items.push(["微调训练任务", "tasks"]);
    if (["taskDetail", "subtask"].includes(page)) items.push([task.name, "taskDetail"]);
    if (page === "subtask") items.push(["task_002 配置", "subtask"]);
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, fontSize: 13 }}>
      {items.map(([label, target], i) => (
        <React.Fragment key={`${target}-${i}`}>
          {i > 0 ? <span style={{ color: "#cbd5e1" }}>/</span> : null}
          <button
            onClick={() => setPage(target)}
            style={{
              border: 0,
              borderRadius: 8,
              padding: "6px 9px",
              background: i === items.length - 1 ? "#0f172a" : "#fff",
              color: i === items.length - 1 ? "#fff" : "#64748b",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
