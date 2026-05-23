import { Stat } from "../components/Stat";
import { Card } from "../components/Card";
import { SectionTitle } from "../components/SectionTitle";
import { Button } from "../components/Button";
import { LossChart } from "../components/LossChart";

export function Dashboard({ summary, lossSeries, setPage, S }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
        <Stat title="远程服务器" value={summary.serversTotal} desc={`在线 ${summary.serversOnline} / 离线 ${summary.serversOffline}`} S={S} />
        <Stat title="任务总数" value={summary.tasksTotal} desc="微调目标任务" S={S} />
        <Stat title="训练中" value={summary.runningSubtasks} desc={`子任务总数 ${summary.subtasksTotal}`} S={S} />
        <Stat title="失败任务" value={summary.failedSubtasks} desc="待人工处理" S={S} />
      </div>
      <Card style={{ marginTop: 20 }} S={S}>
        <SectionTitle title="训练 Loss 趋势" actions={<Button secondary onClick={() => setPage("compare")} S={S}>查看对比</Button>} S={S} />
        <LossChart series={lossSeries} />
      </Card>
    </>
  );
}
