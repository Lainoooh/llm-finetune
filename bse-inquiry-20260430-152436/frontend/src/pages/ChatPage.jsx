import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare, Plus, Upload, Send, CheckCircle2, Circle, Loader2, X, ChevronRight,
  AlertCircle, FileText, FileCheck, Check, ScrollText, Lightbulb, ChevronDown, Cpu, Sparkles,
  TerminalSquare, Edit, Trash2, Search, Clock, XCircle, PauseCircle, Square
} from 'lucide-react';
import * as api from '../../services/api.js';

const WORKFLOW_STEPS = [
  { index: 0, title: '年报上传', type: 'auto' },
  { index: 1, title: '指标提取', type: 'auto' },
  { index: 2, title: 'RDU风险信号分析', type: 'auto' },
  { index: 3, title: 'RDU风险信号触发判断', type: 'manual_risk' },
  { index: 4, title: '问询事项生成', type: 'auto' },
  { index: 5, title: '问询事项确认', type: 'manual_item' },
  { index: 6, title: '起草正式问询函', type: 'auto' },
];

function formatDuration(ms) {
  if (ms < 0 || !isFinite(ms)) return '';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

export default function ChatPage({
  messages, setMessages, input, setInput,
  tasks, setTasks, activeTaskId, setActiveTaskId,
  conversationId, setConversationId, conversations, setConversations,
  parentModels, selectedModelId, setSelectedModelId,
  startPolling, pollTimers,
  currentUser,
}) {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: null, taskId: null });
  const userClosedModalRef = useRef(false);
  const [logModalConfig, setLogModalConfig] = useState({ isOpen: false, title: '', content: '' });
  const [indicatorModalConfig, setIndicatorModalConfig] = useState({ isOpen: false, data: null, taskId: null, logs: null, activeTab: 'indicators' });
  const [indicatorSearch, setIndicatorSearch] = useState('');
  const [modalSearch, setModalSearch] = useState('');
  const [selectedSignalId, setSelectedSignalId] = useState(null);
  const [modalSignals, setModalSignals] = useState([]);
  const [editedItems, setEditedItems] = useState({});
  const [deleteConfirmConvId, setDeleteConfirmConvId] = useState(null);
  const deleteButtonRefs = useRef({});
  const messagesEndRef = useRef(null);
  const prevMessageCount = useRef(0);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null); // { temp_file_id, file_name, file_size } from server
  const [uploadProgress, setUploadProgress] = useState(null); // null=idle, 0-99=uploading, 100=done
  const [tickNow, setTickNow] = useState(Date.now());

  // Live timer: tick every second when any step is running
  const activeTask = activeTaskId ? tasks[activeTaskId] : null;
  const hasRunningStep = useMemo(() => {
    const steps = activeTask?.workflowSteps;
    return steps?.some(s => s.status === 'running') || false;
  }, [activeTask?.workflowSteps]);

  // 当前是否有任务正在跑（不依赖右侧面板是否打开）
  // 只要 tasks 集合里任意任务处于 running/pending 或有 running 步骤，就认为有任务在跑
  // 用于切换发送按钮 ↔ 中断按钮
  const runningTaskIds = useMemo(() => {
    const ids = [];
    Object.values(tasks || {}).forEach(t => {
      if (!t) return;
      const stepRunning = (t.workflowSteps || []).some(s => s.status === 'running');
      if (stepRunning || t.status === 'running' || t.status === 'pending') {
        ids.push(t.id);
      }
    });
    return ids;
  }, [tasks]);
  const isTaskRunning = runningTaskIds.length > 0;

  useEffect(() => {
    if (!hasRunningStep) return;
    const iv = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [hasRunningStep]);

  // 会话切换时重置 ChatPage 内部的局部状态
  useEffect(() => {
    setUploadedFileInfo(null);
    setUploadProgress(null);
    setIsUploading(false);
    setModalConfig({ isOpen: false, type: null, taskId: null });
    setIsModelDropdownOpen(false);
  }, [conversationId]);

  useEffect(() => {
    if (messages.length !== prevMessageCount.current) {
      prevMessageCount.current = messages.length;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-fetch workflow steps when viewing a task that doesn't have them loaded yet.
  // This ensures durations display correctly after page refresh, conversation switch,
  // or when viewing completed tasks (which are not polled).
  useEffect(() => {
    if (!activeTaskId) return;
    const task = tasks[activeTaskId];
    if (!task || task.status === 'pending' || task.workflowSteps) return;

    let cancelled = false;
    api.getWorkflowStatus(activeTaskId)
      .then(workflow => {
        if (!cancelled) {
          setTasks(prev => ({
            ...prev,
            [activeTaskId]: {
              ...prev[activeTaskId],
              workflowSteps: workflow.steps,
              current_step: workflow.current_step,
            }
          }));
        }
      })
      .catch(err => {
        if (!cancelled) console.error('Fetch workflow steps error:', err);
      });

    return () => { cancelled = true; };
  }, [activeTaskId]);

  async function switchConversation(convId) {
    if (convId === conversationId) return;
    setConversationId(convId);
    setActiveTaskId(null);
    setTasks({});
    userClosedModalRef.current = false;
    setMessages([{ id: 'm0', role: 'assistant', content: '您好，我是北交所年报智能审查大模型。请在下方输入框输入类似"审查海希通讯2024年报"的指令来开始审查。' }]);

    try {
      const conv = conversations.find(c => c.id === convId);
      if (conv) {
        const taskList = await api.listTasks(convId);
        const taskMap = {};
        for (const t of taskList) {
          taskMap[t.id] = { ...t, riskSignals: [], step: t.current_step || 0 };
        }
        setTasks(taskMap);
        const msgs = await api.listMessages(convId);
        if (msgs && msgs.length > 0) {
          const formatted = msgs.map(m => ({
            id: m.id, role: m.role, content: m.content,
            type: m.message_type, taskId: m.task_id,
            metadata: m.metadata,
          }));
          setMessages(formatted);
        }
        for (const t of taskList) {
          if (t.status === 'running' || t.status === 'paused') {
            startPolling(t.id);
          }
        }
      }
    } catch (e) {
      console.error('Switch conversation error:', e);
    }
  }

  async function deleteConversationItem(convId) {
    try {
      await api.deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      setDeleteConfirmConvId(null);
      if (conversationId === convId) {
        const remaining = conversations.filter(c => c.id !== convId);
        if (remaining.length > 0) {
          switchConversation(remaining[0].id);
        } else {
          setConversationId(null);
          setTasks({});
          setMessages([{ id: 'm0', role: 'assistant', content: '您好，我是北交所年报智能审查大模型。请在下方输入框输入类似"审查海希通讯2024年报"的指令来开始审查。' }]);
        }
      }
    } catch (e) {
      console.error('Delete error:', e);
      alert('删除失败：' + e.message);
    }
  }

  /**
   * 尝试将用户输入解析为指标 JSON。
   * 期望格式: { company_name, report_year, metrics: [{name, key, val}, ...] }
   * 返回解析后的对象，或 null（不是有效的指标 JSON）。
   */
  function tryParseMetricsJson(text) {
    try {
      const obj = JSON.parse(text);
      if (
        obj &&
        typeof obj === 'object' &&
        typeof obj.company_name === 'string' &&
        (typeof obj.report_year === 'number' || typeof obj.report_year === 'string') &&
        Array.isArray(obj.metrics) &&
        obj.metrics.length > 0
      ) {
        return obj;
      }
    } catch (_) {
      // 非 JSON，忽略
    }
    return null;
  }

  async function handleSend() {
    if (!input.trim()) return;

    const userInput = input.trim();
    setInput('');

    // 判断是否是审查指令
    const isReviewCommand = userInput.includes('审查') || userInput.includes('审核') || userInput.includes('年报') || userInput.includes('半年报');

    // === 分支1：JSON 指标数据 ===
    const metricsObj = tryParseMetricsJson(userInput);
    if (metricsObj) {
      const companyName = metricsObj.company_name;
      const reportYear = parseInt(metricsObj.report_year) || (new Date().getFullYear() - 1);
      const metricsList = metricsObj.metrics;

      try {
        let convId = conversationId;
        if (!convId) {
          const conv = await api.createConversation(`${companyName} ${reportYear}年报审查`);
          convId = conv.id;
          setConversationId(convId);
          setConversations(prev => [conv, ...prev]);
        }

        const displayText = `[JSON指标输入] ${companyName} ${reportYear}年报 (${metricsList.length}项指标)`;
        const userMsg = await api.sendMessage(convId, { role: 'user', content: displayText, type: 'text' });
        setMessages(prev => [...prev, { id: userMsg.id, role: 'user', content: displayText }]);

        const taskResp = await api.createTask(convId, {
          company_name: companyName,
          report_year: reportYear,
          model_id: selectedModelId,
          metrics_json: metricsList,
        });
        const taskId = taskResp.id;

        setTasks(prev => ({
          ...prev,
          [taskId]: { id: taskId, company_name: companyName, report_year: reportYear, status: 'pending', step: 0, riskSignals: [] },
        }));

        await api.startWorkflow(taskId);

        const workflowMsg = await api.sendMessage(convId, { role: 'assistant', content: '', type: 'workflow', task_id: taskId });
        setMessages(prev => [...prev, { id: workflowMsg.id, role: 'assistant', type: 'workflow', taskId }]);
        setActiveTaskId(taskId);
        startPolling(taskId);
      } catch (e) {
        setMessages(prev => [...prev, { id: `msg-err-${Date.now()}`, role: 'assistant', content: `**任务创建失败**：${e.message}` }]);
      }
      return;
    }

    // === 分支2：审查指令 + 已上传文件ID → 乐观更新：立即显示卡片，后台异步执行 ===
    if (isReviewCommand && uploadedFileInfo) {
      const fileInfo = uploadedFileInfo;
      setUploadedFileInfo(null);
      setUploadProgress(null);

      // 从文件名解析公司名和年份
      const nameWithoutExt = fileInfo.file_name.replace(/\.pdf$/i, '');
      const yearMatch = nameWithoutExt.match(/(\d{4})/);
      const reportYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear() - 1;
      const companyName = nameWithoutExt
        .replace(/\d{4}/g, '')
        .replace(/[年半年度报告\-_\s]+/g, '')
        .trim() || '目标公司';

      const fileMeta = { file_name: fileInfo.file_name };
      const tempUserMsgId = `tmp-user-${Date.now()}`;
      const tempWorkflowMsgId = `tmp-wf-${Date.now()}`;

      // ① 立即插入用户消息 + workflow-pending 占位卡片
      setMessages(prev => [
        ...prev,
        { id: tempUserMsgId, role: 'user', content: userInput, metadata: fileMeta },
        { id: tempWorkflowMsgId, role: 'assistant', type: 'workflow-pending', companyName },
      ]);

      // ② 后台异步执行 API 链
      (async () => {
        try {
          let convId = conversationId;
          if (!convId) {
            const conv = await api.createConversation(`${companyName} ${reportYear}年报审查`);
            convId = conv.id;
            setConversationId(convId);
            setConversations(prev => [conv, ...prev]);
          }

          const userMsg = await api.sendMessage(convId, { role: 'user', content: userInput, type: 'text', metadata: fileMeta });
          // 替换临时用户消息ID为真实ID
          setMessages(prev => prev.map(m => m.id === tempUserMsgId ? { ...m, id: userMsg.id } : m));

          const taskResp = await api.createTask(convId, { company_name: companyName, report_year: reportYear, model_id: selectedModelId });
          const taskId = taskResp.id;

          setTasks(prev => ({
            ...prev,
            [taskId]: { id: taskId, company_name: companyName, report_year: reportYear, status: 'pending', step: 0, riskSignals: [] },
          }));

          await api.linkTempFile(taskId, fileInfo.temp_file_id, fileInfo.file_name);
          await api.startWorkflow(taskId);

          const workflowMsg = await api.sendMessage(convId, { role: 'assistant', content: '', type: 'workflow', task_id: taskId });
          // 替换 workflow-pending 占位为真实 workflow 卡片
          setMessages(prev => prev.map(m => m.id === tempWorkflowMsgId ? { id: workflowMsg.id, role: 'assistant', type: 'workflow', taskId } : m));
          setActiveTaskId(taskId);
          startPolling(taskId);
        } catch (e) {
          // 失败时替换占位卡片为错误消息
          setMessages(prev => prev.map(m => m.id === tempWorkflowMsgId ? { id: `msg-err-${Date.now()}`, role: 'assistant', content: `**任务创建失败**：${e.message}` } : m));
        }
      })();
      return;
    }

    // === 分支3：审查指令但没有上传文件 → 提示用户 ===
    if (isReviewCommand && !uploadedFileInfo) {
      let convId = conversationId;
      if (convId) {
        const userMsg = await api.sendMessage(convId, { role: 'user', content: userInput, type: 'text' });
        setMessages(prev => [...prev, { id: userMsg.id, role: 'user', content: userInput }]);
        const hint = '请先通过左下角附件按钮上传年报 PDF 文件，上传完成后再发送审查指令。';
        const assistantMsg = await api.sendMessage(convId, { role: 'assistant', content: hint, type: 'text' });
        setMessages(prev => [...prev, { id: assistantMsg.id, role: 'assistant', content: hint }]);
      } else {
        setMessages(prev => [...prev, { id: `msg-u-${Date.now()}`, role: 'user', content: userInput }]);
        setMessages(prev => [...prev, { id: `msg-a-${Date.now()}`, role: 'assistant', content: '请先通过左下角附件按钮上传年报 PDF 文件，上传完成后再发送审查指令。' }]);
      }
      return;
    }

    // === 分支4：普通消息 ===
    const convId = conversationId;
    if (convId) {
      const userMsg = await api.sendMessage(convId, { role: 'user', content: userInput, type: 'text' });
      setMessages(prev => [...prev, { id: userMsg.id, role: 'user', content: userInput }]);
      const assistantMsg = await api.sendMessage(convId, { role: 'assistant', content: '收到您的消息。请上传年报 PDF 并发送审查指令（例如"审查海希通讯2024年报"）来启动智能审查。', type: 'text' });
      setMessages(prev => [...prev, { id: assistantMsg.id, role: 'assistant', content: '收到您的消息。请上传年报 PDF 并发送审查指令（例如"审查海希通讯2024年报"）来启动智能审查。' }]);
    } else {
      setMessages(prev => [...prev, { id: `msg-a-${Date.now()}`, role: 'assistant', content: '收到您的消息。请上传年报 PDF 并发送审查指令（例如"审查海希通讯2024年报"）来启动智能审查。' }]);
    }
  }

  // 中断当前正在运行的任务
  // 优先中断 activeTaskId；若没设，则中断所有 running/pending 的任务
  async function handleStop() {
    const targets = activeTaskId && runningTaskIds.includes(activeTaskId)
      ? [activeTaskId]
      : runningTaskIds.slice();
    if (targets.length === 0) return;

    const errors = [];
    for (const taskId of targets) {
      try {
        await api.cancelWorkflow(taskId);
        // 立即停止该任务的轮询
        if (pollTimers?.current && pollTimers.current[taskId]) {
          clearTimeout(pollTimers.current[taskId]);
          delete pollTimers.current[taskId];
        }
        // 本地立刻把状态置为 failed，避免按钮闪烁
        setTasks(prev => {
          const t = prev[taskId];
          if (!t) return prev;
          const updatedSteps = (t.workflowSteps || []).map(s =>
            s.status === 'running'
              ? { ...s, status: 'failed', error_message: '任务已被用户中断' }
              : s
          );
          return { ...prev, [taskId]: { ...t, status: 'failed', workflowSteps: updatedSteps } };
        });
      } catch (e) {
        errors.push(`${taskId.slice(0, 8)}: ${e.message}`);
      }
    }
    if (errors.length > 0) {
      alert('部分任务中断失败：\n' + errors.join('\n'));
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('请上传 PDF 格式的年报文件');
      return;
    }

    // Immediately upload to server
    setIsUploading(true);
    setUploadProgress(0);

    api.uploadTemp(file, (progress) => {
      setUploadProgress(progress);
    }).then((info) => {
      // info = { temp_file_id, file_name, file_path, file_size }
      setUploadedFileInfo(info);
      setUploadProgress(100);
      setIsUploading(false);
    }).catch((err) => {
      alert('文件上传失败：' + err.message);
      setUploadedFileInfo(null);
      setUploadProgress(null);
      setIsUploading(false);
    });
  }

  async function handleConfirmAction() {
    const { type, taskId } = modalConfig;
    const task = tasks[taskId];
    if (!task) return;

    const signals = modalSignals;
    const confirmedIds = signals.filter(s => s.is_triggered).map(s => s.id);

    // Collect edited inquiry items for Step 5
    let modifiedData = undefined;
    if (type === 'item') {
      const inquiryItems = {};
      Object.entries(editedItems).forEach(([id, text]) => {
        const orig = signals.find(s => s.id === id);
        if (orig && text !== (orig.inquiry_item || '')) {
          inquiryItems[id] = text;
        }
      });
      if (Object.keys(inquiryItems).length > 0) {
        modifiedData = { inquiry_items: inquiryItems };
      }
    }

    try {
      await api.batchUpdateSignals(taskId, { triggered_ids: confirmedIds });
      await api.resumeWorkflow(taskId, { step_index: task.current_step, decision: 'confirm', confirmed_ids: confirmedIds, modified_data: modifiedData });

      const updatedTask = await api.getTask(taskId);
      setTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], ...updatedTask, step: updatedTask.current_step } }));

      if (type === 'item') {
        const stepData = await api.getStepData(taskId, 5);
        if (stepData.signals) {
          setTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], riskSignals: stepData.signals } }));
        }
      }

      setEditedItems({});
      setModalConfig({ isOpen: false, type: null, taskId: null });
      userClosedModalRef.current = false;
      startPolling(taskId);
    } catch (e) {
      alert('确认失败：' + e.message);
    }
  }

  async function handleToggleRiskStatus(signalId) {
    const signal = modalSignals.find(s => s.id === signalId);
    if (!signal) return;
    const newTriggered = !signal.is_triggered;
    try {
      await api.updateSignal(modalConfig.taskId, signalId, { is_triggered: newTriggered });
      setModalSignals(prev => prev.map(s => s.id === signalId ? { ...s, is_triggered: newTriggered } : s));
    } catch (e) {
      alert('更新失败：' + e.message);
    }
  }

  async function handleOpenConfirmPanel(type, taskId) {
    try {
      const stepIndex = type === 'risk' ? 3 : 5;
      const stepData = await api.getStepData(taskId, stepIndex);
      const signals = stepData.signals || [];
      const parsedSignals = signals.map(s => {
        let indicators = s.indicators;
        if (typeof indicators === 'string' && indicators) {
          try { indicators = JSON.parse(indicators); } catch (_) { /* keep as string */ }
        }
        return { ...s, indicators: indicators || [] };
      });
      setModalSignals(parsedSignals);
      setEditedItems({});
      const firstTriggered = parsedSignals.find(s => s.is_triggered);
      setSelectedSignalId(firstTriggered?.id || parsedSignals[0]?.id || null);
      userClosedModalRef.current = false;
      setModalConfig({ isOpen: true, type, taskId });
    } catch (e) {
      alert('获取数据失败：' + e.message);
    }
  }

  function handleViewHistory(stepType, stepData, stepIndex, taskId) {
    if (stepType === 'manual_risk' || stepType === 'manual_item') {
      handleOpenConfirmPanel(stepType.replace('manual_', ''), taskId);
    } else if (stepIndex === 1) {
      api.getTaskIndicators(taskId).then(data => {
        setIndicatorModalConfig({ isOpen: true, data, taskId, logs: stepData.logs || '暂无日志', activeTab: 'indicators' });
        setIndicatorSearch('');
      }).catch(e => alert('获取指标数据失败：' + e.message));
    } else {
      setLogModalConfig({ isOpen: true, title: stepData.step_name, content: stepData.logs || '暂无日志' });
    }
  }

  const workflowSteps = activeTask?.workflowSteps || WORKFLOW_STEPS.map(s => ({
    step_index: s.index, step_name: s.title, step_type: s.type,
    status: activeTask ? (activeTask.step > s.index || activeTask.status === 'completed') ? 'completed' : activeTask.step === s.index ? 'running' : 'pending' : 'pending',
    logs: null,
  }));

  const selectedModelName = parentModels.find(m => m.id === selectedModelId)?.display_name || '未选择模型';
  const hasUserConversation = messages.length > 1;
  const isNewSessionDisabled = !hasUserConversation;

  return (
    <div className="flex-1 flex flex-col md:flex-row relative bg-[#F8F9FA] z-20">
      {/* Left Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="h-14 bg-white/80 backdrop-blur-md flex items-center px-6 z-30 justify-between border-b border-gray-200 sticky top-0 shadow-sm">
          <div className="relative">
            <button onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-800 font-bold text-[16px] group">
              {selectedModelName}
              <ChevronDown size={16} className={`text-gray-400 group-hover:text-gray-600 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isModelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsModelDropdownOpen(false)}></div>
                <div className="absolute top-full left-2 mt-2 w-[240px] bg-white border border-gray-200 rounded-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.15)] py-2 z-50 overflow-hidden">
                  <div className="px-5 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">推理大模型选型</div>
                  {parentModels.map(model => (
                    <button key={model.id} onClick={() => { setSelectedModelId(model.id); setIsModelDropdownOpen(false); }}
                      className="w-full text-left px-5 py-2.5 hover:bg-gray-50 flex items-center justify-between transition-colors cursor-pointer group/item">
                      <span className={`text-[13px] ${selectedModelId === model.id ? 'font-bold text-[#004EA2]' : 'font-medium text-gray-600 group-hover/item:text-gray-900'}`}>
                        {model.display_name || model.model_name}
                      </span>
                      {selectedModelId === model.id && <Check size={16} className="text-[#004EA2]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#F8F9FA] pb-40">
          {messages.map((msg) => {
            if (msg.type === 'workflow-pending') {
              return (
                <div key={msg.id} className="flex justify-start max-w-4xl mx-auto w-full">
                  <div className="flex gap-4 max-w-[85%] flex-row group">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 bg-white border border-gray-200 shadow-sm overflow-hidden"><img src="/pic/icon_logo.png" alt="logo" className="w-6 h-6 object-contain" /></div>
                    <div className="relative p-0 rounded-[18px] shadow-sm ring-1 ring-gray-200/60 bg-white">
                      <div className="py-3.5 px-5 rounded-[18px] text-[14px] bg-white flex items-center gap-4 border-l-4 border-l-[#004EA2]">
                        <Loader2 size={20} className="animate-spin text-[#004EA2]" />
                        <div className="flex flex-col">
                          <span className="font-bold tracking-wide text-gray-900">
                            {msg.companyName ? `正在对 ${msg.companyName} 执行「年报上传」...` : '审查模型思考中...'}
                          </span>
                          <span className="text-[11px] text-gray-400 mt-0.5">审查模型思考中...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            if (msg.type === 'workflow') {
              const task = tasks[msg.taskId];
              if (!task) return null;
              const isCompleted = task.status === 'completed';
              const isFailed = task.status === 'failed';
              const isInterrupted = task.status === 'interrupted';
              const isPaused = task.status === 'paused';
              const pausedStepDef = isPaused ? WORKFLOW_STEPS.find(s => s.index === task.current_step) : null;
              const isPausedManual = pausedStepDef && (pausedStepDef.type === 'manual_risk' || pausedStepDef.type === 'manual_item');
              const runningStepDef = (!isCompleted && !isFailed && !isInterrupted && !isPaused) ? WORKFLOW_STEPS.find(s => s.index === task.current_step) : null;
              return (
                <div key={msg.id} className="flex justify-start max-w-4xl mx-auto w-full">
                  <div className="flex gap-4 max-w-[85%] flex-row group">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 bg-white border border-gray-200 shadow-sm overflow-hidden"><img src="/pic/icon_logo.png" alt="logo" className="w-6 h-6 object-contain" /></div>
                    <div className="relative p-0 rounded-[18px] shadow-sm hover:shadow-md transition-all cursor-pointer ring-1 ring-gray-200/60 bg-white">
                      <div onClick={() => {
                        setActiveTaskId(msg.taskId);
                        if (isPausedManual) {
                          handleOpenConfirmPanel(pausedStepDef.type.replace('manual_', ''), msg.taskId);
                        }
                      }}
                        className={`py-3.5 px-5 rounded-[18px] text-[14px] bg-white flex items-center gap-4 transition-all h-full ${isFailed || isInterrupted ? 'border-l-4 border-l-red-500' : isPaused ? 'border-l-4 border-l-orange-500' : isCompleted ? 'border-l-4 border-l-[#004EA2]' : 'border-l-4 border-l-[#004EA2]'}`}>
                        {isFailed || isInterrupted ? <XCircle size={20} className="text-red-500" /> : isPaused ? <PauseCircle size={20} className="text-orange-500" /> : isCompleted ? <CheckCircle2 size={20} className="text-[#004EA2]" /> : <Loader2 size={20} className="animate-spin text-[#004EA2]" />}
                        <div className="flex flex-col">
                          <span className={`font-bold tracking-wide ${isFailed || isInterrupted ? 'text-red-700' : isPaused ? 'text-orange-700' : 'text-gray-900'}`}>
                            {isFailed
                              ? `${task.company_name} 审查任务执行失败`
                              : isInterrupted
                                ? `${task.company_name} 审查任务被中断（服务重启）`
                                : isPaused
                                  ? `${task.company_name}「${pausedStepDef?.title || '审查流程'}」等待专家确认`
                                  : isCompleted
                                    ? '年报审查深度分析已完成'
                                    : `正在对 ${task.company_name} 执行「${runningStepDef?.title || '深度分析'}」...`}
                          </span>
                          {isFailed && <span className="text-[11px] text-red-400 mt-0.5">点击查看失败详情</span>}
                          {isInterrupted && <span className="text-[11px] text-red-400 mt-0.5">服务重启导致任务中断，请重新发起</span>}
                          {isPaused && <span className="text-[11px] text-orange-400 mt-0.5">点击打开核查面板进行确认</span>}
                          {!isCompleted && !isFailed && !isInterrupted && !isPaused && <span className="text-[11px] text-gray-500 mt-0.5 font-mono">步骤 {(task.current_step ?? 0) + 1}/{WORKFLOW_STEPS.length}</span>}
                        </div>
                        <div className="ml-5 flex items-center text-[11px] text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg font-medium group-hover:bg-gray-100 border border-gray-100 transition-colors">查看思考过程 <ChevronRight size={14} /></div>
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
                    {msg.role === 'user' ? (currentUser?.display_name || currentUser?.username || 'U')[0].toUpperCase() : <img src="/pic/icon_logo.png" alt="logo" className="w-6 h-6 object-contain" />}
                  </div>
                  <div className={`py-4 px-6 rounded-[22px] text-[14.5px] leading-relaxed break-words shadow-sm ${msg.role === 'user' ? 'bg-white border border-gray-100 text-gray-800 rounded-tr-sm ring-1 ring-gray-900/5' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm ring-1 ring-gray-900/5'}`}>
                    {msg.role === 'user' && msg.metadata?.file_name && (
                      <div className="flex items-center gap-2.5 mb-2.5 pb-2.5 border-b border-gray-300/30">
                        <div className="w-9 h-9 rounded-lg bg-gray-200/50 flex items-center justify-center shrink-0">
                          <FileText size={18} className="text-gray-500" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[12.5px] font-medium truncate">{msg.metadata.file_name}</span>
                          <span className="text-[10px] opacity-60">PDF</span>
                        </div>
                      </div>
                    )}
                    <div className="prose max-w-none prose-p:leading-loose text-[14.5px]" dangerouslySetInnerHTML={{ __html: (msg.content || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                  </div>
                </div>
              </div>
            );
          })}
          {/* Streaming text bubble for Step 6 inquiry letter generation */}
          {(() => {
            if (!activeTaskId) return null;
            const t = tasks[activeTaskId];
            const step6 = t?.workflowSteps?.find(s => s.step_index === 6 && s.status === 'running' && s.streaming_text);
            const streamingText = step6?.streaming_text || null;
            if (!streamingText) return null;
            return (
              <div className="flex justify-start max-w-4xl mx-auto w-full">
                <div className="flex gap-4 max-w-[90%] flex-row">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden border border-gray-100 bg-white">
                    <img src="/pic/icon_logo.png" alt="logo" className="w-6 h-6 object-contain" />
                  </div>
                  <div className="py-4 px-6 rounded-[22px] text-[14.5px] leading-relaxed break-words shadow-sm bg-white border border-gray-100 text-gray-800 rounded-tl-sm ring-1 ring-gray-900/5">
                    <div className="flex items-center gap-2 text-[12px] text-[#004EA2] font-bold mb-3">
                      <Loader2 size={14} className="animate-spin" />
                      智能审查模型正在生成问询函...
                    </div>
                    <div className="prose max-w-none prose-p:leading-loose text-[14.5px]" dangerouslySetInnerHTML={{ __html: (streamingText || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                  </div>
                </div>
              </div>
            );
          })()}
          <div ref={messagesEndRef} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA]/95 to-transparent pt-10">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-white rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-200 focus-within:border-gray-300 focus-within:shadow-[0_2px_16px_rgba(0,0,0,0.12)] transition-all">
              {(isUploading || uploadedFileInfo) && (
                <div className="mx-3 mt-3 flex items-center gap-3 bg-[#F7F7F8] px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-700 border border-gray-200">
                  <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                    {/* Circular progress overlay on icon */}
                    <svg className="absolute inset-0 w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="17" fill="none" stroke="#E5E7EB" strokeWidth="2.5" />
                      {isUploading && uploadProgress !== null && (
                        <circle cx="20" cy="20" r="17" fill="none" stroke="#004EA2" strokeWidth="2.5"
                          strokeDasharray={`${(uploadProgress / 95) * 106.8} 106.8`}
                          strokeLinecap="round" className="transition-all duration-300" />
                      )}
                      {!isUploading && uploadedFileInfo && (
                        <circle cx="20" cy="20" r="17" fill="none" stroke="#004EA2" strokeWidth="2.5"
                          strokeDasharray="106.8 106.8" />
                      )}
                    </svg>
                    <FileText size={18} className={!isUploading && uploadedFileInfo ? 'text-gray-600' : 'text-gray-400'} />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate text-[13px] font-medium text-gray-800">{uploadedFileInfo?.file_name || '上传中...'}</span>
                    <span className="text-[11px] text-gray-400">{isUploading ? `PDF · 上传中 ${uploadProgress || 0}%` : 'PDF · 就绪'}</span>
                  </div>
                  <button onClick={() => { setUploadedFileInfo(null); setUploadProgress(null); setIsUploading(false); }} className="p-1 hover:bg-gray-200 rounded-lg transition-colors shrink-0"><X size={14} className="text-gray-400" /></button>
                </div>
              )}
              <div className="flex items-end gap-1 p-3">
                <input type="file" accept="application/pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || uploadedFileInfo}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100 disabled:opacity-50 shrink-0 mb-0.5"
                >
                  {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} strokeWidth={2} />}
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={uploadedFileInfo ? '请输入审查指令（例如：请审查该年报）...' : '输入审查指令或上传年报文档...'}
                  className="flex-1 max-h-36 min-h-[44px] resize-none bg-transparent border-none focus:ring-0 focus:outline-none py-2.5 px-1 text-[14px] text-gray-800 placeholder-gray-400" rows={1}
                />
                {isTaskRunning ? (
                  <button onClick={handleStop} title="中断当前任务"
                    className="p-2.5 rounded-xl transition-all flex items-center justify-center bg-gray-900 text-white hover:bg-gray-700 shrink-0 mb-0.5">
                    <Square size={14} strokeWidth={2.5} fill="currentColor" />
                  </button>
                ) : (
                  <button onClick={handleSend} disabled={!input.trim()}
                    className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 mb-0.5 ${input.trim() ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                    <Send size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Workflow Panel */}
      {activeTaskId && activeTask && (
        <div className="w-[380px] bg-white flex flex-col shadow-[-8px_0_30px_rgba(0,0,0,0.06)] z-30 animate-in slide-in-from-right duration-300 border-l border-gray-200">
          <div className="h-14 border-b border-gray-100 flex items-center justify-between px-5 bg-white z-10">
            <h3 className="font-bold text-[15px] text-gray-800 flex items-center gap-2.5">
              <Sparkles size={16} className="text-[#004EA2]" /> 思考过程
            </h3>
            <button onClick={() => setActiveTaskId(null)} className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
          </div>
          <div className="bg-[#F8F9FA] py-2.5 px-5 text-[11px] font-bold text-gray-500 border-b border-gray-100 flex items-center justify-between uppercase tracking-wider">
            <span className="truncate text-[#004EA2]">问询公司: {activeTask.company_name}</span>
            {(() => {
              const steps = activeTask?.workflowSteps;
              if (!steps || steps.length === 0) return null;
              const firstStart = steps.find(s => s.started_at)?.started_at;
              if (!firstStart) return null;
              const startMs = new Date(firstStart).getTime();
              const lastCompleted = [...steps].reverse().find(s => s.completed_at)?.completed_at;
              const isAllDone = activeTask.status === 'completed';
              const isTaskFailed = activeTask.status === 'failed';
              const isTaskPaused = activeTask.status === 'paused';
              const endMs = (isAllDone || isTaskFailed) && lastCompleted ? new Date(lastCompleted).getTime() : tickNow;
              const totalLabel = formatDuration(endMs - startMs);
              return (
                <span className={`inline-flex items-center gap-1 font-mono text-[11px] normal-case ${isTaskFailed ? 'text-red-600' : isTaskPaused ? 'text-orange-600' : isAllDone ? 'text-[#004EA2]' : 'text-[#004EA2]'}`}>
                  <Clock size={11} />
                  总耗时 {totalLabel}
                </span>
              );
            })()}
          </div>
          <div className="bg-gray-50 py-1.5 px-5 text-[10px] text-gray-500 border-b border-gray-200 flex items-center gap-1">
            <span className="font-semibold">Task ID:</span>
            <span className="font-mono truncate">{activeTaskId}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            <div className="space-y-3.5 relative before:absolute before:inset-0 before:ml-[9px] before:-translate-x-px before:h-full before:w-[2px] before:bg-gray-100">
              {workflowSteps.map((stepData, index) => {
                const isCompleted = stepData.status === 'completed';
                const isFailed = stepData.status === 'failed';
                const isStepInterrupted = stepData.status === 'interrupted';
                const isCurrent = stepData.status === 'running' || (activeTask.status === 'paused' && activeTask.current_step === index);
                const isWaitNode = stepData.step_type === 'manual_risk' || stepData.step_type === 'manual_item';
                const needsAction = isWaitNode && activeTask.status === 'paused' && activeTask.current_step === index;
                // When needsAction, the step is logically "waiting" even if DB says completed
                const showAsCompleted = isCompleted && !needsAction;

                // Duration calculation
                let durationLabel = null;
                if (stepData.started_at) {
                  const startMs = new Date(stepData.started_at).getTime();
                  if ((isCompleted || isFailed) && stepData.completed_at) {
                    const endMs = new Date(stepData.completed_at).getTime();
                    durationLabel = formatDuration(endMs - startMs);
                  } else if (isCurrent) {
                    durationLabel = formatDuration(tickNow - startMs);
                  }
                }

                return (
                  <div key={index} className="relative flex items-start group">
                    <div className={`absolute left-0 w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10 bg-white border-[2.5px] transition-all ${needsAction ? 'border-orange-500 text-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.3)]' : isFailed || isStepInterrupted ? 'border-red-500 text-red-500' : showAsCompleted ? 'border-[#004EA2] text-[#004EA2]' : isCurrent ? 'border-[#004EA2] shadow-[0_0_12px_rgba(0,78,162,0.3)]' : 'border-gray-200'}`}>
                      {needsAction ? <PauseCircle size={10} strokeWidth={3} /> : isFailed || isStepInterrupted ? <X size={10} strokeWidth={4} /> : showAsCompleted ? <Check size={10} strokeWidth={4} /> : <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-[#004EA2] animate-pulse' : 'bg-transparent'}`} />}
                    </div>
                    <div className="ml-8 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`text-[14px] font-bold ${needsAction ? 'text-orange-600' : isFailed || isStepInterrupted ? 'text-red-600' : isCurrent ? 'text-[#004EA2]' : showAsCompleted ? 'text-gray-900' : 'text-gray-400'}`}>{stepData.step_name}</div>
                        {durationLabel && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-mono shrink-0 px-2 py-0.5 rounded-md ${needsAction ? 'text-orange-600 bg-orange-50 border border-orange-200' : isFailed || isStepInterrupted ? 'text-red-600 bg-red-50 border border-red-200' : isCurrent ? 'text-[#004EA2] bg-[#F0F7FF] border border-[#CCE4FF]' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}>
                            <Clock size={10} />
                            {durationLabel}
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5">
                        {(isFailed || isStepInterrupted) && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-xl shadow-sm">
                            <p className="text-[12px] text-red-700 font-bold flex items-center gap-1.5 mb-1"><XCircle size={14} /> {isStepInterrupted ? '任务被中断' : '步骤执行失败'}</p>
                            <p className="text-[11.5px] text-red-600/80 leading-relaxed font-mono break-all">{stepData.error_message || (isStepInterrupted ? '服务重启，任务被中断' : '未知错误')}</p>
                          </div>
                        )}
                        {isCurrent && stepData.step_type === 'auto' && (
                          stepData.progress ? (
                            <div className="p-3 bg-[#F0F7FF] border border-[#CCE4FF] rounded-xl shadow-sm space-y-1.5">
                              {(stepData.progress_phases || [stepData.progress]).map((ph, pi, arr) => (
                                <div key={pi} className="flex items-center justify-between text-[12px]">
                                  <span className="flex items-center gap-1.5 text-[#004EA2] font-bold">
                                    {pi === arr.length - 1 && ph.completed < ph.total ? <Lightbulb size={12} className="animate-pulse" /> : <Check size={12} />}
                                    阶段 {ph.phase}/{arr.length}: {ph.phase_name}
                                  </span>
                                  <span className="text-[11px] font-mono bg-[#004EA2]/10 text-[#004EA2] px-1.5 py-0.5 rounded">{ph.completed}/{ph.total}</span>
                                </div>
                              ))}
                              {(() => {
                                const phases = stepData.progress_phases || [stepData.progress];
                                const last = phases[phases.length - 1];
                                return last && last.completed < last.total ? (
                                  <div className="w-full h-[6px] bg-[#CCE4FF] rounded-full overflow-hidden mt-1">
                                    <div className="h-full bg-[#004EA2] rounded-full transition-all duration-500" style={{ width: `${last.total > 0 ? (last.completed / last.total) * 100 : 0}%` }} />
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-[11.5px] font-bold border border-gray-200 shadow-sm"><Lightbulb size={12} className="animate-pulse" /> 智能审查模型正在思考...</div>
                          )
                        )}
                        {needsAction && (
                          <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl shadow-sm">
                            <p className="text-[12px] text-orange-700 mb-2.5 font-bold flex items-center gap-1.5"><AlertCircle size={14} /> 流程暂停：需专家授权</p>
                            <button onClick={() => handleOpenConfirmPanel(stepData.step_type.replace('manual_', ''), activeTaskId)} className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-bold rounded-lg transition-all shadow-sm">唤起核查面板</button>
                          </div>
                        )}
                        {showAsCompleted && (stepData.progress || stepData.progress_phases) && (
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm mb-2 space-y-1">
                            {(stepData.progress_phases || [stepData.progress]).map((ph, pi, arr) => (
                              <div key={pi} className="flex items-center justify-between text-[12px]">
                                <span className="flex items-center gap-1.5 text-gray-700 font-bold">
                                  <Check size={12} />
                                  阶段 {ph.phase}/{arr.length}: {ph.phase_name}
                                </span>
                                <span className="text-[11px] font-mono bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{ph.completed}/{ph.total}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {showAsCompleted && (
                          isWaitNode ? (
                            <div onClick={() => handleViewHistory(stepData.step_type, stepData, index, activeTaskId)}
                              className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm cursor-pointer hover:border-[#CCE4FF] hover:shadow-md transition-all group">
                              <p className="text-[12px] text-gray-700 font-medium leading-relaxed">{
                                index === 3
                                  ? `专家核查授权通过${stepData.output_summary?.signal_count != null ? `，共触发 ${stepData.output_summary.signal_count} 个风险信号` : ''}`
                                  : `专家核查授权通过${stepData.output_summary?.item_count != null ? `，确认 ${stepData.output_summary.item_count} 个问询事项` : ''}`
                              }</p>
                              <div className="mt-2 flex items-center gap-1 text-[11.5px] text-[#004EA2] font-bold group-hover:underline">
                                查看审查记录 <ChevronRight size={13} />
                              </div>
                            </div>
                          ) : (
                            <div onClick={() => handleViewHistory(stepData.step_type, stepData, index, activeTaskId)}
                              className="flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm cursor-pointer hover:border-[#CCE4FF] hover:shadow-md transition-all group">
                              <span className="text-[12px] text-gray-700 font-medium">{
                                index === 1 && stepData.output_summary?.indicator_count != null
                                  ? `已提取 ${stepData.output_summary.indicator_count} 个指标`
                                  : '执行完成'
                              }</span>
                              {(stepData.logs || index === 1) && (
                                <span className="flex items-center gap-0.5 text-[11.5px] text-[#004EA2] font-bold shrink-0 group-hover:underline">
                                  {index === 1 ? '查看详情' : '查看日志'} <ChevronRight size={13} />
                                </span>
                              )}
                            </div>
                          )
                        )}
                        {showAsCompleted && stepData.logs && index !== 1 && (
                          <div className="mt-2 p-2.5 bg-[#F4F6F8] rounded-xl text-[11px] text-gray-600 font-mono leading-relaxed shadow-inner overflow-x-auto border border-gray-200">
                            {stepData.logs.split('\n').map((line, i) => (<div key={i} className="whitespace-nowrap">{line}</div>))}
                          </div>
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

      {/* Data Confirm Modal */}
      {modalConfig.isOpen && (() => {
        const { type, taskId } = modalConfig;
        const task = tasks[taskId];
        const isEditable = task && task.status === 'paused' && (
          (type === 'risk' && task.current_step === 3) || (type === 'item' && task.current_step === 5)
        );
        const displaySignals = modalSignals;
        const filteredData = displaySignals.filter(item => {
          const nameMatch = (item.name || '').includes(modalSearch);
          const indStr = Array.isArray(item.indicators)
            ? item.indicators.map(ind => `${ind.indicator_name || ''} ${ind.value || ''}`).join(' ')
            : String(item.indicators || '');
          return nameMatch || indStr.includes(modalSearch);
        });
        const triggeredList = filteredData.filter(i => i.is_triggered);
        const untriggeredList = filteredData.filter(i => !i.is_triggered);
        const selectedItem = modalSignals.find(i => i.id === selectedSignalId) || modalSignals[0];

        return (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] w-[90vw] max-w-6xl h-[85vh] flex flex-col overflow-hidden ring-1 ring-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-[#004EA2]"><Sparkles size={18} /></div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 tracking-wide">{type === 'risk' ? 'RDU 风险信号核验' : 'RDU问询事项核验'}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{type === 'risk' ? '请核实 AI 引擎提取的关键信息，支持人工阻断或修正触发状态' : '请核实已触发风险信号对应的问询事项内容'}</p>
                  </div>
                </div>
                <button onClick={() => { userClosedModalRef.current = true; setModalConfig({ isOpen: false, type: null, taskId: null }); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 flex overflow-hidden">
                <div className="w-[320px] border-r border-gray-100 flex flex-col bg-[#F9FAFB]">
                  <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
                      <input type="text" placeholder="搜索风险特征..." value={modalSearch} onChange={(e) => setModalSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004EA2]/20 focus:border-[#004EA2] transition-all shadow-sm" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <>
                    <div className="mb-5">
                      <h3 className="px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">已触发风险 ({triggeredList.length})</h3>
                      {triggeredList.map(item => (
                        <button key={item.id} onClick={() => setSelectedSignalId(item.id)}
                          className={`w-full text-left px-3 py-3 rounded-xl mb-1.5 transition-all flex items-center gap-2.5 border ${selectedSignalId === item.id ? 'bg-white border-[#004EA2]/30 shadow-[0_4px_12px_rgba(0,78,162,0.06)] ring-1 ring-[#004EA2]/10' : 'border-transparent hover:bg-white hover:border-gray-200'}`}>
                          <AlertCircle size={16} className="text-[#D2232A] shrink-0" />
                          <div className="truncate text-[13px] font-semibold text-gray-800 flex-1">{item.name}</div>
                          {item.similarity_score != null && (
                            <div className="shrink-0 w-[34px] h-[34px] rounded-full border-[2px] flex flex-col items-center justify-center"
                              style={{ borderColor: item.similarity_score > 90 ? '#DC2626' : item.similarity_score > 70 ? '#F59E0B' : '#6B7280', color: item.similarity_score > 90 ? '#DC2626' : item.similarity_score > 70 ? '#F59E0B' : '#6B7280' }}>
                              <span className="text-[7px] font-black leading-none">{item.similarity_score.toFixed(1)}%</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <div>
                      <h3 className="px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">未触发风险 ({untriggeredList.length})</h3>
                      {untriggeredList.map(item => (
                        <button key={item.id} onClick={() => setSelectedSignalId(item.id)}
                          className={`w-full text-left px-3 py-3 rounded-xl mb-1.5 transition-all flex items-center gap-2.5 border ${selectedSignalId === item.id ? 'bg-white border-gray-300 shadow-sm' : 'border-transparent hover:bg-white hover:border-gray-200 opacity-70 hover:opacity-100'}`}>
                          <Circle size={16} className="text-gray-300 shrink-0" />
                          <div className="truncate text-[13px] font-medium text-gray-600 flex-1">{item.name}</div>
                          {item.similarity_score != null && (
                            <div className="shrink-0 w-[34px] h-[34px] rounded-full border-[2px] flex flex-col items-center justify-center"
                              style={{ borderColor: item.similarity_score > 90 ? '#DC2626' : item.similarity_score > 70 ? '#F59E0B' : '#6B7280', color: item.similarity_score > 90 ? '#DC2626' : item.similarity_score > 70 ? '#F59E0B' : '#6B7280' }}>
                              <span className="text-[7px] font-black leading-none">{item.similarity_score.toFixed(1)}%</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    </>
                  </div>
                </div>
                <div className="flex-1 p-6 overflow-y-auto bg-white">
                  {selectedItem ? (
                    <div className="max-w-4xl mx-auto">
                      <div className="flex justify-between items-start mb-5">
                        <div className="flex items-baseline gap-2.5 flex-wrap">
                          <h3 className="text-xl font-bold text-gray-900 tracking-wide">{selectedItem.name}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${selectedItem.is_triggered ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                              {selectedItem.is_triggered ? '已触发' : '未触发'}
                            </span>
                        </div>
                        <div className="shrink-0">
                          {isEditable && (selectedItem.is_triggered ? (
                            <button onClick={() => handleToggleRiskStatus(selectedItem.id)} className="px-4 py-1.5 rounded-lg font-bold transition-all border text-[13px] bg-white text-gray-500 border-gray-300 hover:bg-gray-50 flex items-center gap-1.5">
                              <XCircle size={14} /> 取消触发此风险
                            </button>
                          ) : (
                            <button onClick={() => handleToggleRiskStatus(selectedItem.id)} className="px-4 py-1.5 rounded-lg font-bold transition-all border text-[13px] bg-[#FFF0F0] text-[#D2232A] border-[#FBCFE8] hover:bg-[#FFE4E6] shadow-sm flex items-center gap-1.5">
                              <AlertCircle size={14} /> 强制触发此风险
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <section>
                          <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2"><FileText size={14} /> 异常财报指标</h4>
                          <div className="bg-[#F8F9FA] p-3.5 rounded-xl text-[13px] text-gray-700 leading-relaxed border border-gray-200">
                            {Array.isArray(selectedItem.indicators) ? selectedItem.indicators.map(ind => `${ind.indicator_name || ind.indicator_code}: ${ind.value}`).join(', ') : selectedItem.indicators}
                          </div>
                        </section>
                        <section>
                          <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2"><Cpu size={14} /> 指标风险判断逻辑</h4>
                          <div className="relative bg-[#F0F7FF] p-3.5 rounded-xl text-[13px] text-gray-800 leading-relaxed border border-[#CCE4FF] shadow-sm border-l-4 border-l-[#004EA2]">{selectedItem.logic || '暂无'}</div>
                        </section>
                        <section>
                          <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2"><Sparkles size={14} /> LLM 输出风险信号</h4>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-[#FFF0F0] p-3.5 rounded-xl text-[13px] text-gray-800 leading-relaxed border border-red-200 shadow-sm border-l-4 border-l-red-500">
                              {selectedItem.risk || '暂无'}
                            </div>
                            {selectedItem.similarity_score != null && (
                              <div className="shrink-0 w-[56px] h-[56px] rounded-full border-[2.5px] flex flex-col items-center justify-center"
                                style={{
                                  borderColor: selectedItem.similarity_score > 90 ? '#DC2626' : selectedItem.similarity_score > 70 ? '#F59E0B' : '#6B7280',
                                  color: selectedItem.similarity_score > 90 ? '#DC2626' : selectedItem.similarity_score > 70 ? '#F59E0B' : '#6B7280',
                                }}>
                                <span className="text-[12px] font-black leading-none">{selectedItem.similarity_score.toFixed(1)}%</span>
                                <span className="text-[8px] font-bold mt-0.5 opacity-70">触发概率</span>
                              </div>
                            )}
                          </div>
                        </section>
                        {type === 'item' && (
                          <div className="pt-3 border-t border-gray-100 mt-2 space-y-4">
                            <section>
                              <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2"><ChevronRight size={14} /> 问询逻辑</h4>
                              <div className="relative bg-[#F0F7FF] p-3.5 rounded-xl text-[13px] text-gray-800 leading-relaxed border border-[#CCE4FF] shadow-sm border-l-4 border-l-[#004EA2]">{selectedItem.inquiry_logic || selectedItem.inquiryLogic || '暂无'}</div>
                            </section>
                            <section>
                              <h4 className="text-[12px] font-bold text-[#004EA2] uppercase tracking-wider flex items-center gap-2 mb-2"><FileCheck size={14} /> 问询事项 {isEditable && <span className="text-[10px] text-gray-400 font-normal normal-case">(可直接编辑修改)</span>}</h4>
                              {isEditable ? (
                                <textarea
                                  value={editedItems[selectedItem.id] ?? (selectedItem.inquiry_item || selectedItem.inquiryItem || '')}
                                  onChange={e => setEditedItems(prev => ({ ...prev, [selectedItem.id]: e.target.value }))}
                                  className="w-full bg-white p-4 rounded-xl text-[14px] font-medium text-gray-900 leading-relaxed border border-gray-200 shadow-[0_4px_20px_rgb(0,0,0,0.04)] min-h-[120px] resize-y focus:ring-2 focus:ring-[#004EA2]/20 focus:border-[#004EA2] focus:outline-none transition-all"
                                />
                              ) : (
                                <div className="bg-white p-4 rounded-xl text-[14px] font-medium text-gray-900 leading-relaxed border border-gray-200 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">{selectedItem.inquiry_item || selectedItem.inquiryItem || '暂无'}</div>
                              )}
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
              {isEditable ? (
              <div className="px-6 py-4 border-t border-gray-100 bg-[#F9FAFB] flex justify-between items-center">
                <span className="text-sm text-gray-500 font-medium">
                  {type === 'item' ? (
                    <>确认 <strong className="text-[#004EA2] text-lg px-1">{modalSignals.filter(d => d.is_triggered).length}</strong> 项问询事项进入正式问询函{Object.keys(editedItems).length > 0 && <span className="ml-2 text-orange-500">（已修改 {Object.keys(editedItems).length} 项）</span>}</>
                  ) : (
                    <>当前共确认 <strong className="text-[#004EA2] text-lg px-1">{modalSignals.filter(d => d.is_triggered).length}</strong> 项核心风险点进入下游流程</>
                  )}
                </span>
                <button onClick={handleConfirmAction} className="px-6 py-2.5 bg-[#004EA2] hover:bg-[#003875] text-white rounded-xl text-[13px] font-bold shadow-lg shadow-[#004EA2]/20 transition-all flex items-center gap-2">
                  授权执行下一步 <ChevronRight size={16} />
                </button>
              </div>
              ) : (
              <div className="px-6 py-3 border-t border-gray-100 bg-[#F9FAFB] text-center">
                <span className="text-sm text-gray-400">查看模式 - 该步骤已完成</span>
              </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Log Detail Modal */}
      {logModalConfig.isOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-2xl ring-1 ring-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#F9FAFB] rounded-t-2xl">
              <h2 className="text-[15px] font-bold text-gray-800 flex items-center gap-2 tracking-wide"><TerminalSquare size={18} className="text-[#004EA2]" /> {logModalConfig.title} / 执行日志</h2>
              <button onClick={() => setLogModalConfig({ isOpen: false, title: '', content: '' })} className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500"><X size={18} /></button>
            </div>
            <div className="p-6 bg-white rounded-b-2xl">
              <pre
                className="whitespace-pre-wrap font-mono text-[13px] text-gray-700 leading-relaxed bg-[#F4F6F8] p-4 rounded-xl border border-gray-200"
                style={{ maxHeight: '70vh', overflowY: 'auto', overflowX: 'auto' }}
              >{logModalConfig.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Indicator Data Modal */}
      {indicatorModalConfig.isOpen && (() => {
        const allData = indicatorModalConfig.data || [];
        const filtered = indicatorSearch
          ? allData.filter(item =>
              (item.indicator_name || '').includes(indicatorSearch) ||
              (item.indicator_code || '').includes(indicatorSearch) ||
              (item.value || '').includes(indicatorSearch) ||
              (item.category || '').includes(indicatorSearch)
            )
          : allData;
        return (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-4xl h-[80vh] flex flex-col overflow-hidden ring-1 ring-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#F9FAFB]">
                <div className="flex items-center gap-3">
                  <h2 className="text-[15px] font-bold text-gray-800 flex items-center gap-2 tracking-wide">
                    <FileText size={18} className="text-[#004EA2]" /> 指标提取详情
                  </h2>
                </div>
                <button onClick={() => setIndicatorModalConfig({ isOpen: false, data: null, taskId: null, logs: null, activeTab: 'indicators' })} className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500"><X size={18} /></button>
              </div>
              <div className="px-6 py-2.5 border-b border-gray-100 flex gap-2 bg-white">
                <button onClick={() => setIndicatorModalConfig(prev => ({ ...prev, activeTab: 'indicators' }))}
                  className={`px-3.5 py-1.5 rounded-lg text-[13px] font-bold transition-colors ${indicatorModalConfig.activeTab === 'indicators' ? 'bg-[#004EA2] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  指标数据 <span className="ml-1 text-[11px] opacity-80">{allData.length}</span>
                </button>
                <button onClick={() => setIndicatorModalConfig(prev => ({ ...prev, activeTab: 'logs' }))}
                  className={`px-3.5 py-1.5 rounded-lg text-[13px] font-bold transition-colors ${indicatorModalConfig.activeTab === 'logs' ? 'bg-[#004EA2] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  执行日志
                </button>
              </div>
              {indicatorModalConfig.activeTab === 'indicators' ? (
                <>
                  <div className="px-6 py-3 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
                      <input type="text" placeholder="搜索指标名称、代码..." value={indicatorSearch} onChange={(e) => setIndicatorSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004EA2]/20 focus:border-[#004EA2] transition-all shadow-sm" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F9FAFB] sticky top-0">
                        <tr className="border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">指标名称</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">指标代码</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">指标值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((item, i) => (
                          <tr key={item.id || i} className="border-b border-gray-100 hover:bg-[#F0F7FF]/50 transition-colors">
                            <td className="px-4 py-2.5 text-[13px] text-gray-800 font-medium">{item.indicator_name || '-'}</td>
                            <td className="px-4 py-2.5 text-[12px] text-gray-500 font-mono">{item.indicator_code || '-'}</td>
                            <td className="px-4 py-2.5 text-[13px] text-gray-800 font-mono">{item.value || '-'}</td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">无匹配数据</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-auto p-6">
                  <pre className="whitespace-pre-wrap font-mono text-[13px] text-gray-700 leading-relaxed bg-[#F4F6F8] p-4 rounded-xl border border-gray-200"
                    style={{ maxHeight: '100%', overflowY: 'auto' }}>
                    {indicatorModalConfig.logs}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
