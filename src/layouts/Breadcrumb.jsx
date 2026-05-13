import React, { useState } from "react";

export function Breadcrumb({ page, setPage, task, S }) {
  const [hoverIndex, setHoverIndex] = useState(null);

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
    <div style={{
      background: S.page.background === "#0a0a0a" ? "#1a1a1a" : "#f8fafc",
      padding: "12px 20px",
      marginBottom: 20,
      borderRadius: 12,
      display: "flex",
      gap: 8,
      alignItems: "center",
      fontSize: 13,
    }}>
      {items.map(([label, target], i) => (
        <React.Fragment key={`${target}-${i}`}>
          {i > 0 ? <span style={{ color: S.page.background === "#0a0a0a" ? "#6b7280" : "#cbd5e1" }}>/</span> : null}
          <button
            onClick={() => setPage(target)}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
            disabled={i === items.length - 1}
            style={{
              border: 0,
              borderRadius: 6,
              padding: "4px 8px",
              background: hoverIndex === i && i !== items.length - 1 ? (S.page.background === "#0a0a0a" ? "#2d2d2d" : "#e2e8f0") : "transparent",
              color: i === items.length - 1 ? S.page.color : (S.page.background === "#0a0a0a" ? "#9ca3af" : "#64748b"),
              cursor: i === items.length - 1 ? "default" : "pointer",
              fontWeight: i === items.length - 1 ? 600 : 400,
              transition: "all 0.15s ease",
            }}
          >
            {label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
