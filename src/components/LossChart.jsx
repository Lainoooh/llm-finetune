import { lossData } from "../data/mockData";

export function LossChart() {
  const width = 760;
  const height = 250;
  const pad = 30;
  const x = (step) => pad + (step / 600) * (width - pad * 2);
  const y = (v) => height - pad - ((v - 0.7) / (2.5 - 0.7)) * (height - pad * 2);
  const pts = (k) => lossData.map((d) => `${x(d.step)},${y(d[k])}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 300, background: "#f8fafc", borderRadius: 16 }}>
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#cbd5e1" />
      <polyline points={pts("a")} fill="none" stroke="#0f172a" strokeWidth="3" />
      <polyline points={pts("b")} fill="none" stroke="#6366f1" strokeWidth="3" />
      <polyline points={pts("c")} fill="none" stroke="#10b981" strokeWidth="3" />
    </svg>
  );
}
