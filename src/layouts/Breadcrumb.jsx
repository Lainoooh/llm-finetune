import React, { useState } from "react";

export function Breadcrumb({ page, setPage, task, S }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const items = [];
  if (page === "dashboard") items.push(["总览", "dashboard"]);
  if (page === "servers") items.push(["服务器", "servers"]);
  if (page === "compare") items.push(["综合对比", "compare"]);
  if (["tasks", "taskDetail", "subtask"].includes(page)) {
    items.push(["微调训练任务", "tasks"]);
    if (["taskDetail", "subtask"].includes(page)) items.push([task?.name || "任务详情", "taskDetail"]);
    if (page === "subtask") items.push([task?.subtaskName || "子任务配置", "subtask"]);
  }

  const isLight = S.page.background === "#F8F9FA";

  return (
    <div style={{
      padding: 0,
      marginBottom: 8,
      borderBottom: "1px solid",
      borderColor: isLight ? "#E5E7EB" : "#2a2a2a",
      paddingBottom: 8,
      display: "flex",
      gap: 4,
      alignItems: "center",
      fontSize: 13,
    }}>
      {items.map(([label, target], i) => (
        <React.Fragment key={`${target}-${i}`}>
          {i > 0 ? <span style={{ color: isLight ? "#D1D5DB" : "#6b7280", fontWeight: 300 }}>/</span> : null}
          <button
            onClick={() => setPage(target)}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
            disabled={i === items.length - 1}
            style={{
              border: 0,
              borderRadius: 4,
              padding: i === 0 ? "2px 6px 2px 0" : "2px 6px",
              background: "transparent",
              color: i === items.length - 1
                ? (isLight ? "#004EA2" : "#a78bfa")
                : (hoverIndex === i ? (isLight ? "#004EA2" : "#a78bfa") : (isLight ? "#6B7280" : "#9ca3af")),
              cursor: i === items.length - 1 ? "default" : "pointer",
              fontWeight: i === items.length - 1 ? 700 : 500,
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
