/**
 * GPU 设备编号多选按钮组件（SegmentedOptions 多选版）
 *
 * @param {string} value - 逗号分隔的已选编号，如 "0,1,2,3"
 * @param {string[]} visibleIds - 连通性检测返回的可见编号列表
 * @param {function} onChange - 回调，参数为逗号分隔字符串
 * @param {string} placeholder - 无选项时的提示文本
 * @param {object} S - 主题样式
 */
export function GpuIdSelector({ value, visibleIds, onChange, placeholder, S }) {
  const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  // 兜底：visibleIds 可能包含逗号分隔的字符串如 ["0,1,2,3"]，需展开
  const rawIds = visibleIds && visibleIds.length > 0 ? visibleIds : [];
  const flatIds = rawIds.flatMap((v) => String(v).split(",")).map((s) => s.trim()).filter(Boolean);
  const availableIds = flatIds.length > 0 ? flatIds : (selected.length > 0 ? selected : []);

  const allSelected = availableIds.length > 0 && availableIds.every((id) => selected.includes(id));

  function toggleId(id) {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onChange(next.join(","));
  }

  function toggleAll() {
    if (allSelected) {
      onChange("");
    } else {
      onChange(availableIds.join(","));
    }
  }

  if (availableIds.length === 0) {
    return (
      <div style={{
        padding: "8px 16px",
        border: `1px solid ${S.card.border.split(" ")[2]}`,
        borderRadius: 8,
        color: S.page.background === "#0a0a0a" ? "#6b7280" : "#94a3b8",
        fontSize: 14,
        textAlign: "center",
      }}>
        {placeholder || "请先完成连通性检测"}
      </div>
    );
  }

  function btnStyle(active) {
    return {
      padding: "6px 12px",
      border: active ? "1px solid #667eea" : `1px solid ${S.card.border.split(" ")[2]}`,
      borderRadius: 6,
      background: active ? (S.page.background === "#0a0a0a" ? "#667eea20" : "#667eea10") : "transparent",
      color: active ? "#667eea" : S.page.color,
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      transition: "all 0.2s",
      minWidth: 32,
      textAlign: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };
  }

  return (
    <div style={{ display: "flex", flexWrap: "nowrap", gap: 4, alignItems: "center" }}>
      <button onClick={toggleAll} style={btnStyle(allSelected)}>all</button>
      {availableIds.map((id) => (
        <button key={id} onClick={() => toggleId(id)} style={btnStyle(selected.includes(id))}>{id}</button>
      ))}
    </div>
  );
}
