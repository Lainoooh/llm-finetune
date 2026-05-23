export function LossChart({ series = [] }) {
  const width = 760;
  const height = 250;
  const pad = 30;
  const points = series.length ? series : [{ step: 0, values: {} }];
  const maxStep = Math.max(...points.map((item) => item.step || 0), 1);
  const values = points.flatMap((item) => Object.values(item.values || {})).filter((v) => typeof v === "number");
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;
  const spread = Math.max(maxValue - minValue, 0.1);
  const names = Array.from(new Set(points.flatMap((item) => Object.keys(item.values || {}))));
  const palette = ["#0f172a", "#6366f1", "#10b981", "#f59e0b", "#ef4444"];
  const x = (step) => pad + ((step || 0) / maxStep) * (width - pad * 2);
  const y = (value) => height - pad - ((value - minValue) / spread) * (height - pad * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 300, background: "#f8fafc", borderRadius: 8 }}>
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#cbd5e1" />
      {names.length === 0 ? (
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#64748b" fontSize="14">
          暂无 Loss 数据
        </text>
      ) : null}
      {names.map((name, index) => {
        const line = points
          .filter((item) => typeof item.values?.[name] === "number")
          .map((item) => `${x(item.step)},${y(item.values[name])}`)
          .join(" ");
        return <polyline key={name} points={line} fill="none" stroke={palette[index % palette.length]} strokeWidth="3" />;
      })}
      {names.slice(0, 5).map((name, index) => (
        <g key={name} transform={`translate(${pad + index * 135}, ${height - 8})`}>
          <rect width="10" height="10" fill={palette[index % palette.length]} rx="2" />
          <text x="16" y="10" fontSize="11" fill="#475569">
            {name}
          </text>
        </g>
      ))}
    </svg>
  );
}
