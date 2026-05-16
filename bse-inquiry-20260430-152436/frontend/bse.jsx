import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Plus, Search, FileText, Upload, Send,
  CheckCircle2, Circle, Loader2, X, ChevronRight, AlertCircle, FileCheck,
  Check, ScrollText, Lightbulb, ChevronDown, Cpu, Sparkles, TerminalSquare
} from 'lucide-react';

// --- 模拟初始数据 ---
const mockRiskSignals = [
  {
    id: 'R001',
    name: '营收激增与毛利率显著下滑',
    indicators: '营业收入: 5.12亿元 (同比+118.48%); 毛利率: 31.58% (同比-17.57个百分点)',
    logic: '收入大幅增长的同时毛利空间大幅收窄，这一矛盾凸显出成本控制或定价策略的潜在问题。净利润增速远低于营收增幅，暗示盈利质量面临压力。',
    risk: '可能存在为了冲规模而牺牲利润的情况，或者新增业务成本极高，引发监管对经营可持续性的关注。',
    inquiryLogic: '需重点核查新增储能业务的具体毛利率构成、成本结转情况及与同行业可比公司的差异。',
    inquiryItem: '请你公司结合储能业务的具体开展情况、定价模式、成本构成等，说明在收入翻倍的情况下，毛利率大幅下滑的具体原因及合理性，是否存在进一步下滑风险。',
    isTriggered: true
  },
  {
    id: 'R002',
    name: '扣非后净利润微降',
    indicators: '归属净利润: 5053万元 (+9.5%); 扣非净利润: 4216万元 (-0.18%)',
    logic: '在营收翻倍的情况下，扣非净利润反而微降，说明主营业务的实际盈利能力并未随规模同步增长。',
    risk: '非经常性损益对净利润贡献较大，主业盈利能力存疑。',
    inquiryLogic: '核查非经常性损益的具体明细，评估其可持续性。',
    inquiryItem: '请列示报告期内非经常性损益的具体明细及金额，并说明主营业务增收不增利的原因。',
    isTriggered: true
  },
  {
    id: 'R003',
    name: '存货周转率异常变动',
    indicators: '存货余额大幅增加; 存货周转天数由45天增至80天',
    logic: '存货积压可能导致跌价准备计提不足，虚增利润。',
    risk: '存在存货跌价风险，可能影响未来期利润。',
    inquiryLogic: '核实存货构成、库龄及期后销售情况。',
    inquiryItem: '请说明存货余额大幅增加的原因，结合在手订单说明是否存在滞销风险，存货跌价准备计提是否充分。',
    isTriggered: false
  },
  {
    id: 'R004',
    name: '大额关联交易激增',
    indicators: '关联销售金额占比超过30%，同比增加150%',
    logic: '过高的关联交易可能存在利益输送或粉饰业绩的嫌疑。',
    risk: '独立性受损，业绩真实性存疑。',
    inquiryLogic: '比对关联交易与非关联交易的毛利率，核查交易必要性。',
    inquiryItem: '请说明本期关联交易大幅增加的背景及必要性，关联销售的定价依据及公允性，是否存在通过关联交易输送利益的情形。',
    isTriggered: true
  }
];

// --- 带有日志信息的工作流步骤节点 ---
const workflowStepsData = [
  { id: 1, title: '年报上传和审查', type: 'auto', logs: '➤ [SYS] 成功加载年报 PDF 文件 (2.9MB)\n➤ [PARSE] 启动财务报表解析引擎...\n➤ [DATA] 提取基础数据节点 1200 项\n➤ [CHECK] 文本合规性与数据逻辑交叉校验通过。' },
  { id: 2, title: '指标提取', type: 'auto', logs: '➤ [RDU_FIN_01] 计算营业收入与毛利率变动差异... [DONE]\n➤ [RDU_FIN_05] 净利润偏离度检测... [DONE]\n➤ [SCAN] 遍历 158 项指标，提取关键风险监控指标 4 项。' },
  { id: 3, title: 'RDU风险信号触发判断', type: 'manual_risk' },
  { id: 4, title: '问询逻辑生成', type: 'auto', logs: '➤ [LLM_CALL] 准备批量调用模型进行 COT 推理...\n➤ [GEN] 结合同行业审核标准生成问询逻辑 (批次 1/1)\n➤ [FOCUS] 锁定重点关注领域：成本结转、定价公允性。\n➤ [SUCCESS] 逻辑推演完成。' },
  { id: 5, title: '问询事项生成', type: 'auto', logs: '➤ [DRAFT] 根据各项逻辑拟定问询草案...\n➤ [COMPLIANCE] 执行合规词汇校验...\n➤ [POLISH] 监管专业语料润色完毕。' },
  { id: 6, title: '问询事项确认', type: 'manual_item' },
  { id: 7, title: '起草正式问询函', type: 'auto', logs: '➤ [BUILD] 拼装问询函头部信息 (发函对象、时间等)\n➤ [MERGE] 整合已确认的 3 项问题条款\n➤ [FORMAT] 自动排版应用样式...\n➤ [DONE] 最终审查文件草稿生成完毕。' }
];

// --- 官方风格 Logo 组件 (使用真实图片) ---
const BSEImageLogo = ({ size = 24 }) => (
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Beijing_Stock_Exchange_logo.svg/512px-Beijing_Stock_Exchange_logo.svg.png"
    alt="北交所"
    style={{ width: size, height: size, objectFit: 'contain' }}
    title="在此替换为您本地的 image_e05494.png"
  />
);

export default function BSEAuditAgent() {
  // --- 核心状态 ---
  const [messages, setMessages] = useState([
    { id: 'm0', role: 'assistant', content: '您好，我是北交所年报智能审查大模型。请上传需要审查的年度报告或输入相关指令（例如：“审查海希通讯2024年报”）。' }
  ]);
  const [input, setInput] = useState('');

  const [workflows, setWorkflows] = useState({});
  const [activePanelWfId, setActivePanelWfId] = useState(null);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: null, wfId: null });
  const [logModalConfig, setLogModalConfig] = useState({ isOpen: false, title: '', content: '' });
  const [modalSearch, setModalSearch] = useState('');
  const [selectedSignalId, setSelectedSignalId] = useState(null);

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Qwen3-32B');
  const models = ['Qwen3-32B', 'Qwen-Max', 'DeepSeek-R1'];

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- 模拟工作流引擎 ---
  useEffect(() => {
    const runningWfs = Object.entries(workflows).filter(([_, wf]) => wf.status === 'running');
    if (runningWfs.length === 0) return;

    const timer = setTimeout(() => {
      setWorkflows(prev => {
        const nextState = { ...prev };
        let newlyCompletedId = null;
        let completedWfData = null;

        runningWfs.forEach(([wfId, wf]) => {
          if (wf.step < workflowStepsData.length) {
            const currentStepData = workflowStepsData[wf.step];
            // 遇到阻断节点停止自动推进
            if (currentStepData.type === 'manual_risk' && !wf.riskConfirmed) return;
            if (currentStepData.type === 'manual_item' && !wf.itemConfirmed) return;
            nextState[wfId] = { ...wf, step: wf.step + 1 };
          } else {
            nextState[wfId] = { ...wf, status: 'completed' };
            newlyCompletedId = wfId;
            completedWfData = nextState[wfId];
          }
        });

        if (newlyCompletedId) {
          setTimeout(() => {
             appendDraftLetter(completedWfData.targetName, completedWfData.riskData);
          }, 500);
        }

        return nextState;
      });
    }, 2800);

    return () => clearTimeout(timer);
  }, [workflows]);

  // --- 自动弹窗监听逻辑 ---
  useEffect(() => {
    if (!activePanelWfId) return;
    const wf = workflows[activePanelWfId];
    if (!wf || wf.status !== 'running') return;

    // 当到达第3步且未确认，并且当前没打开弹窗时，延迟自动弹窗
    if (wf.step === 2 && !wf.riskConfirmed && !modalConfig.isOpen) {
       const timer = setTimeout(() => handleOpenConfirmPanel('risk', activePanelWfId), 600);
       return () => clearTimeout(timer);
    }
    // 当到达第6步且未确认，并且当前没打开弹窗时，延迟自动弹窗
    if (wf.step === 5 && !wf.itemConfirmed && !modalConfig.isOpen) {
       const timer = setTimeout(() => handleOpenConfirmPanel('item', activePanelWfId), 600);
       return () => clearTimeout(timer);
    }
  }, [workflows, activePanelWfId, modalConfig.isOpen]);


  const appendDraftLetter = (targetName, riskData) => {
    const triggered = riskData.filter(d => d.isTriggered);
    const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    let content = `### 📄 《关于对${targetName}的年报问询函》\n*(自动生成草案)*\n\n---\n\n`;
    content += `**${targetName} 董事会：**\n\n`;
    content += `我部在对你公司2024年年度报告审查中，关注到以下情况：\n\n`;

    triggered.forEach((item, index) => {
      content += `**${index + 1}、关于${item.name}**\n`;
      content += `${item.inquiryItem}\n\n`;
    });

    content += `请你公司就上述问题做出书面说明，并于5个工作日内将有关说明材料报送我部。\n\n`;
    content += `<div align="right">**北京证券交易所**<br/>**${dateStr}**</div>\n`;
    content += `\n---\n*💡 注：此为AI辅助生成的问询草案，请结合业务实际情况进一步修改确认。*`;

    setMessages(prev => [...prev, { id: `msg-draft-${Date.now()}`, role: 'assistant', content }]);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const newMsg = { id: `msg-u-${Date.now()}`, role: 'user', content: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');

    if (input.includes('审查') || input.includes('年报') || input.includes('半年报')) {
      const isJinbo = input.includes('锦波');
      const targetName = isJinbo ? '山西锦波生物医药股份有限公司' : '上海海希工业通讯股份有限公司';
      const wfId = `wf-${Date.now()}`;

      setWorkflows(prev => ({
        ...prev,
        [wfId]: {
          id: wfId,
          step: 0,
          status: 'running',
          targetName,
          riskData: JSON.parse(JSON.stringify(mockRiskSignals)),
          riskConfirmed: false,
          itemConfirmed: false
        }
      }));

      setTimeout(() => {
        setMessages(prev => [...prev, { id: `msg-w-${Date.now()}`, role: 'assistant', type: 'workflow', wfId }]);
        setActivePanelWfId(wfId);
      }, 600);
    } else {
      setTimeout(() => {
        setMessages(prev => [...prev, { id: `msg-a-${Date.now()}`, role: 'assistant', content: '收到您的指令。您可以随时发送类似“请审查海希通讯2024年报”的指令来唤醒智能审查核心。' }]);
      }, 500);
    }
  };

  const handleOpenConfirmPanel = (type, wfId) => {
    const wf = workflows[wfId];
    if (wf) {
      setSelectedSignalId(wf.riskData[0]?.id);
      setModalSearch('');
      setModalConfig({ isOpen: true, type, wfId });
    }
  };

  const handleToggleRiskStatus = (riskId) => {
    const { wfId } = modalConfig;
    setWorkflows(prev => {
      const wf = prev[wfId];
      const newData = wf.riskData.map(item => item.id === riskId ? { ...item, isTriggered: !item.isTriggered } : item);
      return { ...prev, [wfId]: { ...wf, riskData: newData } };
    });
  };

  const handleConfirmAction = () => {
    const { type, wfId } = modalConfig;
    setWorkflows(prev => {
      const wf = prev[wfId];
      if (type === 'risk') return { ...prev, [wfId]: { ...wf, riskConfirmed: true, step: 3 } };
      if (type === 'item') return { ...prev, [wfId]: { ...wf, itemConfirmed: true, step: 6 } };
      return prev;
    });
    setModalConfig({ isOpen: false, type: null, wfId: null });
  };

  const handleViewHistory = (stepType, logData, stepIndex, wfId) => {
    if (stepType === 'manual_risk') {
      handleOpenConfirmPanel('risk', wfId);
    } else if (stepType === 'manual_item') {
      handleOpenConfirmPanel('item', wfId);
    } else {
      setLogModalConfig({ isOpen: true, title: logData.title, content: logData.logs });
    }
  };

  // --- 弹窗组件 ---
  const DataConfirmModal = () => {
    const { isOpen, type, wfId } = modalConfig;
    if (!isOpen || !wfId) return null;

    const wf = workflows[wfId];
    const isHistoryMode = (type === 'risk' && wf.step > 2) || (type === 'item' && wf.step > 5);

    const filteredData = wf.riskData.filter(item => item.name.includes(modalSearch) || item.indicators.includes(modalSearch));
    const triggeredList = filteredData.filter(i => i.isTriggered);
    const untriggeredList = filteredData.filter(i => !i.isTriggered);
    const selectedItem = wf.riskData.find(i => i.id === selectedSignalId) || wf.riskData[0];

    return (
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-white rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] w-[90vw] max-w-6xl h-[85vh] flex flex-col overflow-hidden ring-1 ring-gray-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-[#004EA2]">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 tracking-wide">
                  {type === 'risk' ? '智能体 RDU 风险信号核验' : '大模型问询事项最终确认'} {isHistoryMode && <span className="text-gray-500 font-normal text-sm ml-2 px-2 py-0.5 bg-gray-100 rounded-md">只读快照</span>}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isHistoryMode ? '查看当时大模型推演的各项风险信号及逻辑锚点' : '请核实 AI 引擎提取的关键信息，支持人工阻断或修正触发状态'}
                </p>
              </div>
            </div>
            <button onClick={() => setModalConfig({isOpen: false, type: null, wfId: null})} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* 左侧列表 */}
            <div className="w-[320px] border-r border-gray-100 flex flex-col bg-[#F9FAFB]">
              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
                  <input
                    type="text" placeholder="搜索风险特征..." value={modalSearch} onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004EA2]/20 focus:border-[#004EA2] transition-all shadow-sm"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="mb-5">
                  <h3 className="px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">触发预警 ({triggeredList.length})</h3>
                  {triggeredList.map(item => (
                    <button
                      key={item.id} onClick={() => setSelectedSignalId(item.id)}
                      className={`w-full text-left px-3 py-3 rounded-xl mb-1.5 transition-all flex items-start gap-2.5 border ${selectedSignalId === item.id ? 'bg-white border-[#004EA2]/30 shadow-[0_4px_12px_rgba(0,78,162,0.06)] ring-1 ring-[#004EA2]/10' : 'border-transparent hover:bg-white hover:border-gray-200'}`}
                    >
                      <AlertCircle size={16} className="text-[#D2232A] mt-0.5 shrink-0" />
                      <div className="truncate text-[13px] font-semibold text-gray-800">{item.name}</div>
                    </button>
                  ))}
                </div>
                <div>
                  <h3 className="px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">安全水位 ({untriggeredList.length})</h3>
                  {untriggeredList.map(item => (
                    <button
                      key={item.id} onClick={() => setSelectedSignalId(item.id)}
                      className={`w-full text-left px-3 py-3 rounded-xl mb-1.5 transition-all flex items-start gap-2.5 border ${selectedSignalId === item.id ? 'bg-white border-gray-300 shadow-sm' : 'border-transparent hover:bg-white hover:border-gray-200 opacity-70 hover:opacity-100'}`}
                    >
                      <Circle size={16} className="text-gray-300 mt-0.5 shrink-0" />
                      <div className="truncate text-[13px] font-medium text-gray-600">{item.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 右侧详情 (更紧凑布局) */}
            <div className="flex-1 p-6 overflow-y-auto bg-white">
              {selectedItem ? (
                <div className="max-w-4xl mx-auto">
                  <div className="flex justify-between items-start mb-5">
                    <h3 className="text-xl font-bold text-gray-900 tracking-wide pr-4">{selectedItem.name}</h3>
                    {/* 操作区提至顶部 */}
                    <div className="flex items-center gap-3 shrink-0">
                      {!isHistoryMode && (
                        <button onClick={() => handleToggleRiskStatus(selectedItem.id)} className={`px-4 py-1.5 rounded-lg font-bold transition-all border text-[13px] ${selectedItem.isTriggered ? 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' : 'bg-[#FFF0F0] text-[#D2232A] border-[#FBCFE8] hover:bg-[#FFE4E6] shadow-sm'}`}>
                          {selectedItem.isTriggered ? '取消触发此风险' : '强制标记为风险'}
                        </button>
                      )}
                      <span className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold border flex items-center gap-1.5 shadow-sm ${selectedItem.isTriggered ? 'bg-[#FFF0F0] text-[#D2232A] border-[#FBCFE8]' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {selectedItem.isTriggered ? <><Check size={14}/>已触发风险警示</> : '未触发'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <section>
                      <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2"><FileText size={14}/> 异常财报指标</h4>
                      <div className="bg-[#F8F9FA] p-3.5 rounded-xl text-[13px] text-gray-700 font-mono leading-relaxed border border-gray-200">{selectedItem.indicators}</div>
                    </section>

                    <section>
                      <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2"><Cpu size={14}/> 指标风险判断逻辑</h4>
                      <div className="relative bg-[#F0F7FF] p-3.5 rounded-xl text-[13px] text-gray-800 leading-relaxed border border-[#CCE4FF] shadow-sm border-l-4 border-l-[#004EA2]">
                        {selectedItem.logic}
                      </div>
                    </section>

                    {type === 'item' && (
                      <div className="pt-3 border-t border-gray-100 mt-2 space-y-4">
                        <section>
                          <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2"><ChevronRight size={14}/> 问询逻辑</h4>
                          <div className="bg-gray-50 p-3.5 rounded-xl text-[13px] text-gray-700 leading-relaxed border border-gray-200">{selectedItem.inquiryLogic}</div>
                        </section>
                        <section>
                          <h4 className="text-[12px] font-bold text-[#004EA2] uppercase tracking-wider flex items-center gap-2 mb-2"><FileCheck size={14}/> 问询事项</h4>
                          <div className="bg-white p-4 rounded-xl text-[14px] font-medium text-gray-900 leading-relaxed border border-gray-200 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">{selectedItem.inquiryItem}</div>
                        </section>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">请在左侧选择一项查看详情</div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-[#F9FAFB] flex justify-between items-center">
            <span className="text-sm text-gray-500 font-medium">
              {isHistoryMode ? '查看完毕后可直接关闭' : <span>当前共确认 <strong className="text-[#004EA2] text-lg px-1">{wf.riskData.filter(d=>d.isTriggered).length}</strong> 项核心风险点进入下游流程</span>}
            </span>
            {isHistoryMode ? (
              <button onClick={() => setModalConfig({isOpen: false, type: null, wfId: null})} className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-all shadow-sm">关闭快照</button>
            ) : (
              <button onClick={handleConfirmAction} className="px-6 py-2.5 bg-[#004EA2] hover:bg-[#003875] text-white rounded-xl text-[13px] font-bold shadow-lg shadow-[#004EA2]/20 transition-all flex items-center gap-2">
                授权执行下一步 <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const LogDetailModal = () => {
    if (!logModalConfig.isOpen) return null;
    return (
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-2xl overflow-hidden ring-1 ring-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#F9FAFB]">
            <h2 className="text-[15px] font-bold text-gray-800 flex items-center gap-2 tracking-wide"><TerminalSquare size={18} className="text-[#004EA2]"/> {logModalConfig.title} / 执行日志</h2>
            <button onClick={() => setLogModalConfig({isOpen: false, title: '', content: ''})} className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500"><X size={18} /></button>
          </div>
          <div className="p-6 bg-white">
            <pre className="whitespace-pre-wrap font-mono text-[13px] text-gray-700 leading-relaxed bg-[#F4F6F8] p-4 rounded-xl border border-gray-200">{logModalConfig.content}</pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-gray-800 font-sans antialiased">
      {/* 左侧边栏 */}
      <div className="w-[260px] bg-white flex flex-col hidden md:flex z-10 border-r border-gray-200 shadow-sm">
        <div className="h-14 flex items-center gap-3 border-b border-gray-100 px-6 bg-white">
          <div className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow-sm border border-gray-100"><BSEImageLogo size={18} /></div>
          <span className="font-bold text-gray-800 text-[14px] tracking-widest">智能审查平台</span>
        </div>
        <div className="p-4 border-b border-gray-100 bg-[#F9FAFB]">
          <button className="w-full bg-[#004EA2] hover:bg-[#003875] text-white py-2.5 rounded-xl flex items-center justify-center gap-2 text-[13px] font-bold shadow-md shadow-[#004EA2]/10 transition-all border-none">
            <Plus size={16} /> 新建年报审查任务
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-white">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 mt-2 px-3">工作流记录</div>
          {Object.values(workflows).map(wf => (
            <button key={wf.id} onClick={() => setActivePanelWfId(wf.id)}
              className={`w-full text-left px-4 py-2.5 text-[13px] rounded-xl transition-all flex items-center justify-between group ${activePanelWfId === wf.id ? 'bg-[#F0F7FF] text-[#004EA2] font-semibold border border-[#CCE4FF] shadow-sm' : 'text-gray-600 hover:bg-gray-50 border border-transparent hover:text-gray-900'}`}>
              <span className="truncate pr-2">{wf.targetName}</span>
              {wf.status === 'completed' && <CheckCircle2 size={14} className="text-green-500 shrink-0 opacity-80"/>}
            </button>
          ))}
          {Object.keys(workflows).length === 0 && (
             <div className="text-[12px] text-gray-400 px-3 py-4 text-center mt-4">暂无活动会话</div>
          )}
        </div>
      </div>

      {/* 中间对话主区 */}
      <div className="flex-1 flex flex-col relative bg-[#F8F9FA] z-20">
        <div className="h-14 bg-white/80 backdrop-blur-md flex items-center px-6 z-30 justify-between border-b border-gray-200 sticky top-0 shadow-sm">
          <div className="relative">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-800 font-bold text-[16px] group"
            >
              {selectedModel}
              <ChevronDown size={16} className={`text-gray-400 group-hover:text-gray-600 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsModelDropdownOpen(false)}></div>
                <div className="absolute top-full left-2 mt-2 w-[240px] bg-white border border-gray-200 rounded-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.15)] py-2 z-50 overflow-hidden">
                  <div className="px-5 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">推理大模型选型</div>
                  {models.map(model => (
                    <button
                      key={model}
                      onClick={() => { setSelectedModel(model); setIsModelDropdownOpen(false); }}
                      className="w-full text-left px-5 py-2.5 hover:bg-gray-50 flex items-center justify-between transition-colors cursor-pointer group/item"
                    >
                      <span className={`text-[13px] ${selectedModel === model ? 'font-bold text-[#004EA2]' : 'font-medium text-gray-600 group-hover/item:text-gray-900'}`}>
                        {model}
                      </span>
                      {selectedModel === model && <Check size={16} className="text-[#004EA2]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F8F9FA] pb-40">
          {messages.map((msg) => {
            if (msg.type === 'workflow') {
              const wf = workflows[msg.wfId];
              if (!wf) return null;
              const isCompleted = wf.status === 'completed';

              return (
                <div key={msg.id} className="flex justify-start max-w-4xl mx-auto w-full">
                  <div className="flex gap-4 max-w-[85%] flex-row group">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 bg-white border border-gray-200 shadow-sm overflow-hidden"><BSEImageLogo size={20} /></div>
                    <div className="relative p-0 rounded-[18px] shadow-sm hover:shadow-md transition-all cursor-pointer ring-1 ring-gray-200/60 bg-white">
                      <div onClick={() => setActivePanelWfId(msg.wfId)}
                        className={`py-3.5 px-5 rounded-[18px] text-[14px] bg-white flex items-center gap-4 transition-all h-full ${isCompleted ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-[#004EA2]'}`}>
                        {isCompleted ? <CheckCircle2 size={20} className="text-green-500"/> : <Loader2 size={20} className="animate-spin text-[#004EA2]"/>}
                        <div className="flex flex-col">
                           <span className="font-bold tracking-wide text-gray-900">
                             {isCompleted ? '年报审查深度分析已完成' : `正在对 ${wf.targetName} 执行深度分析...`}
                           </span>
                           {!isCompleted && <span className="text-[11px] text-gray-500 mt-0.5">预计耗时 15-30 秒，请留意侧边栏状态</span>}
                        </div>
                        <div className="ml-5 flex items-center text-[11px] text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg font-medium group-hover:bg-gray-100 border border-gray-100 transition-colors">追踪控制台 <ChevronRight size={14} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} max-w-4xl mx-auto w-full`}>
                <div className={`flex gap-4 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden border border-gray-100 ${msg.role === 'user' ? 'bg-[#004EA2] text-white' : 'bg-white'}`}>
                    {msg.role === 'user' ? 'U' : <BSEImageLogo size={20} />}
                  </div>
                  <div className={`py-4 px-6 rounded-[22px] text-[14.5px] leading-relaxed break-words shadow-sm ${msg.role === 'user' ? 'bg-[#004EA2] text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm ring-1 ring-gray-900/5'}`}>
                    <div className={`prose max-w-none prose-p:leading-loose text-[14.5px] ${msg.role === 'user' ? 'text-white prose-strong:text-white' : 'prose-slate prose-strong:text-gray-900'}`} dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA] to-transparent pt-16">
          <div className="max-w-4xl mx-auto relative bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-[#004EA2]/30 focus-within:shadow-[0_8px_40px_rgba(0,78,162,0.08)] transition-all">
            <div className="flex items-end p-2.5">
              <button className="p-3 text-gray-400 hover:text-[#004EA2] transition-colors rounded-xl hover:bg-gray-50"><Upload size={20} strokeWidth={2.5}/></button>
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="发送年报文档或输入自然语言指令 (例如：请深入审查锦波生物2023年报)..."
                className="flex-1 max-h-40 min-h-[48px] resize-none bg-transparent border-none focus:ring-0 py-3.5 px-2 text-[14.5px] text-gray-800 placeholder-gray-400 font-medium" rows={1}
              />
              <button onClick={handleSend} disabled={!input.trim()} className={`p-3.5 rounded-xl ml-2 mb-0.5 transition-all flex items-center justify-center shadow-sm ${input.trim() ? 'bg-[#004EA2] text-white hover:bg-[#003875]' : 'bg-gray-100 text-gray-400'}`}><Send size={18} strokeWidth={2.5}/></button>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧边栏控制台 (更紧凑的间距) */}
      {activePanelWfId && workflows[activePanelWfId] && (
        <div className="w-[380px] bg-white flex flex-col shadow-[-8px_0_30px_rgba(0,0,0,0.06)] z-30 animate-in slide-in-from-right duration-300 border-l border-gray-200">
          <div className="h-14 border-b border-gray-100 flex items-center justify-between px-5 bg-white z-10">
            <h3 className="font-bold text-[15px] text-gray-800 flex items-center gap-2.5">
              <Sparkles size={16} className="text-[#004EA2]"/> 思考过程
            </h3>
            <button onClick={() => setActivePanelWfId(null)} className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"><X size={18}/></button>
          </div>

          <div className="bg-[#F8F9FA] py-2.5 px-5 text-[11px] font-bold text-gray-500 border-b border-gray-100 flex items-center justify-between uppercase tracking-wider">
             <span className="truncate text-[#004EA2]">问询公司: {workflows[activePanelWfId].targetName}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-white">
            <div className="space-y-5 relative before:absolute before:inset-0 before:ml-[9px] before:-translate-x-px before:h-full before:w-[2px] before:bg-gray-100">
              {workflowStepsData.map((stepData, index) => {
                const wf = workflows[activePanelWfId];
                const isCompleted = wf.step > index || wf.status === 'completed';
                const isCurrent = wf.step === index && wf.status === 'running';
                const isWaitNode = stepData.type === 'manual_risk' || stepData.type === 'manual_item';
                const needsAction = isCurrent && isWaitNode;

                return (
                  <div key={index} className="relative flex items-start group">
                    <div className={`absolute left-0 w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10 bg-white border-[2.5px] transition-all ${isCompleted ? 'border-[#004EA2] text-[#004EA2]' : isCurrent ? 'border-[#004EA2] shadow-[0_0_12px_rgba(0,78,162,0.3)]' : 'border-gray-200'}`}>
                      {isCompleted ? <Check size={10} strokeWidth={4} /> : <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-[#004EA2] animate-pulse' : 'bg-transparent'}`} />}
                    </div>
                    {/* 删除了副标题的松散展示 */}
                    <div className="ml-8 w-full">
                      <div className={`text-[14px] font-bold ${isCurrent ? 'text-[#004EA2]' : isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>{stepData.title}</div>

                      <div className="mt-2.5">
                        {isCurrent && stepData.type === 'auto' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F0F7FF] text-[#004EA2] rounded-lg text-[11.5px] font-bold border border-[#CCE4FF] shadow-sm"><Lightbulb size={12} className="animate-pulse" /> AI 模型正在思考和分析...</div>
                        )}
                        {needsAction && (
                          <div className="p-3 bg-[#FFF0F0] border border-[#FBCFE8] rounded-xl shadow-sm">
                            <p className="text-[12px] text-[#D2232A] mb-2.5 font-bold flex items-center gap-1.5"><AlertCircle size={14}/> 流程暂停：需专家授权</p>
                            <button onClick={() => handleOpenConfirmPanel(stepData.type.replace('manual_', ''), activePanelWfId)} className="w-full py-2 bg-[#D2232A] hover:bg-[#a31a20] text-white text-[12px] font-bold rounded-lg transition-all shadow-sm">唤起核查面板</button>
                          </div>
                        )}
                        {isCompleted && (
                          <>
                            {stepData.type.startsWith('manual_') ? (
                              <button onClick={() => handleViewHistory(stepData.type, stepData, index, activePanelWfId)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F8F9FA] text-gray-600 rounded-lg text-[11px] font-bold border border-gray-200 hover:bg-[#F0F7FF] hover:text-[#004EA2] hover:border-[#CCE4FF] transition-colors w-full justify-between">
                                <span className="flex items-center gap-1.5"><Check size={12} className="text-green-500" /> 专家核查授权通过</span>
                                <span>调阅快照 &gt;</span>
                              </button>
                            ) : (
                              <div className="p-2.5 bg-[#F4F6F8] rounded-xl text-[11px] text-gray-600 font-mono leading-relaxed shadow-inner overflow-x-auto border border-gray-200">
                                {stepData.logs.split('\n').map((line, i) => (
                                   <div key={i} className="whitespace-nowrap">{line}</div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <DataConfirmModal />
      <LogDetailModal />
    </div>
  );
}