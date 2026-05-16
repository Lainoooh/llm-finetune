import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, AlertCircle, Sparkles, X } from 'lucide-react';
import * as api from '../../services/api.js';

export default function ModelConfigPage() {
  const [parentModels, setParentModels] = useState([]);
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingParentId, setEditingParentId] = useState(null);
  const [isUnifiedMode, setIsUnifiedMode] = useState(true);
  const [concurrency, setConcurrency] = useState(1);
  const [unifiedConfig, setUnifiedConfig] = useState({
    model_name: '', endpoint_url: '',
    prompts: {
      risk_judgment: '', risk_signal: '', inquiry_logic: '', inquiry_item: '', common: '',
    },
  });
  const [separateConfigs, setSeparateConfigs] = useState([
    { purpose: 'risk_judgment', label: '指标风险判断逻辑模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
    { purpose: 'risk_signal', label: '指标风险信号触发模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
    { purpose: 'inquiry_logic', label: '问询逻辑模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
    { purpose: 'inquiry_item', label: '问询事项生成模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
    { purpose: 'common', label: '通用模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
  ]);
  const [deleteConfirmModel, setDeleteConfirmModel] = useState(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    loadParentModels();
  }, []);

  useEffect(() => {
    if (showModelForm) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [showModelForm]);

  async function loadParentModels() {
    try {
      const parents = await api.listParentModels();
      setParentModels(parents);
    } catch (e) {
      console.error('Load parent models error:', e);
    }
  }

  async function loadChildren(parentId) {
    try {
      return await api.getModelChildren(parentId);
    } catch (e) {
      console.error('Load children error:', e);
      return [];
    }
  }

  function handleNewModel() {
    setEditingParentId(null);
    setDisplayName('');
    setIsUnifiedMode(true);
    setConcurrency(1);
    setUnifiedConfig({
      model_name: '', endpoint_url: '',
      prompts: { risk_judgment: '', risk_signal: '', inquiry_logic: '', inquiry_item: '', common: '' },
    });
    setSeparateConfigs([
      { purpose: 'risk_judgment', label: '指标风险判断逻辑模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
      { purpose: 'risk_signal', label: '指标风险信号触发模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
      { purpose: 'inquiry_logic', label: '问询逻辑模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
      { purpose: 'inquiry_item', label: '问询事项生成模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
      { purpose: 'common', label: '通用模型', model_name: '', endpoint_url: '', prompt: '', concurrency: 1 },
    ]);
    setShowModelForm(true);
  }

  async function handleEditModel(parent) {
    setEditingParentId(parent.id);
    setDisplayName(parent.display_name || parent.model_name);
    setConcurrency(parent.concurrency || 1);

    const children = await loadChildren(parent.id);
    const unified = parent.child_name_count <= 1;
    setIsUnifiedMode(unified);

    if (unified) {
      const firstChild = children[0];
      setUnifiedConfig({
        model_name: parent.model_name || firstChild?.model_name || '',
        endpoint_url: firstChild?.endpoint_url || '',
        prompts: {
          risk_judgment: children.find(c => c.purpose === 'risk_judgment')?.config?.prompt || children.find(c => c.purpose === 'risk_judgment')?.prompt || '',
          risk_signal: children.find(c => c.purpose === 'risk_signal')?.config?.prompt || children.find(c => c.purpose === 'risk_signal')?.prompt || '',
          inquiry_logic: children.find(c => c.purpose === 'inquiry_logic')?.config?.prompt || children.find(c => c.purpose === 'inquiry_logic')?.prompt || '',
          inquiry_item: children.find(c => c.purpose === 'inquiry_item')?.config?.prompt || children.find(c => c.purpose === 'inquiry_item')?.prompt || '',
          common: children.find(c => c.purpose === 'common')?.config?.prompt || children.find(c => c.purpose === 'common')?.prompt || '',
        },
      });
    } else {
      const purposeOrder = ['risk_judgment', 'risk_signal', 'inquiry_logic', 'inquiry_item', 'common'];
      const purposeLabels = {
        risk_judgment: '指标风险判断逻辑模型',
        risk_signal: '指标风险信号触发模型',
        inquiry_logic: '问询逻辑模型',
        inquiry_item: '问询事项生成模型',
        common: '通用模型',
      };
      setSeparateConfigs(purposeOrder.map(purpose => {
        const child = children.find(c => c.purpose === purpose);
        return {
          purpose,
          label: purposeLabels[purpose],
          model_name: child?.model_name || '',
          endpoint_url: child?.endpoint_url || '',
          prompt: child?.config?.prompt || child?.prompt || '',
          concurrency: child?.concurrency || 1,
        };
      }));
    }

    setShowModelForm(true);
  }

  async function handleSaveModel() {
    if (!displayName.trim()) {
      alert('请输入主模型名称');
      return;
    }
    try {
      let payload;
      if (isUnifiedMode) {
        const purposes = ['risk_judgment', 'risk_signal', 'inquiry_logic', 'inquiry_item', 'common'];
        const purposeLabels = {
          risk_judgment: '指标风险判断逻辑模型',
          risk_signal: '指标风险信号触发模型',
          inquiry_logic: '问询逻辑模型',
          inquiry_item: '问询事项生成模型',
          common: '通用模型',
        };
        payload = {
          parent_id: editingParentId,
          display_name: displayName,
          is_unified: true,
          concurrency,
          unified_config: {
            model_name: unifiedConfig.model_name,
            endpoint_url: unifiedConfig.endpoint_url,
            prompts: unifiedConfig.prompts,
          },
          separate_configs: purposes.map(purpose => ({
            purpose,
            label: purposeLabels[purpose],
            model_name: unifiedConfig.model_name,
            endpoint_url: unifiedConfig.endpoint_url,
            prompt: unifiedConfig.prompts[purpose] || '',
          })),
        };
      } else {
        payload = {
          parent_id: editingParentId,
          display_name: displayName,
          is_unified: false,
          concurrency,
          separate_configs: separateConfigs,
        };
      }
      await api.batchSaveModels(payload);
      setShowModelForm(false);
      await loadParentModels();
    } catch (e) {
      alert('保存失败：' + e.message);
    }
  }

  async function handleDeleteParent(parentId) {
    try {
      await api.deleteModel(parentId);
      setDeleteConfirmModel(null);
      await loadParentModels();
    } catch (e) {
      alert('删除失败：' + e.message);
    }
  }

  function updateSeparateConfig(index, field, value) {
    setSeparateConfigs(prev => {
      const newConfigs = [...prev];
      newConfigs[index] = { ...newConfigs[index], [field]: value };
      return newConfigs;
    });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-[#F8F9FA] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">模型配置</h2>
            <p className="text-sm text-gray-500 mt-1">管理主模型及其子模型配置</p>
          </div>
          <button onClick={handleNewModel} className="px-4 py-2 bg-[#004EA2] hover:bg-[#003875] text-white rounded-xl font-bold text-sm shadow-md shadow-[#004EA2]/10 transition-all flex items-center gap-2">
            <Plus size={16} /> 新增主模型
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">展示名称</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">模式</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parentModels.map(parent => {
                const isUnified = parent.child_name_count <= 1;
                return (
                  <tr key={parent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-800">{parent.display_name || parent.model_name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">ID: {parent.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${isUnified ? 'bg-blue-50 text-[#004EA2]' : 'bg-purple-50 text-purple-600'}`}>
                        {isUnified ? '统一模式' : '独立模式'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${parent.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {parent.is_active ? '已启用' : '已禁用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEditModel(parent)} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-gray-400 hover:text-[#004EA2]" title="编辑">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirmModel(parent)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500" title="删除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {parentModels.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">暂无主模型配置，请点击"新增主模型"添加</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Form Modal */}
      {showModelForm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto ring-1 ring-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">{editingParentId ? '编辑主模型' : '新增主模型'}</h2>
              <button onClick={() => setShowModelForm(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">展示名称</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" placeholder="例如：生产环境模型A" />
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">模型模式</label>
                <div className="flex gap-3">
                  <button onClick={() => setIsUnifiedMode(true)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${isUnifiedMode ? 'bg-[#004EA2] text-white border-[#004EA2]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#004EA2]'}`}>统一模式</button>
                  <button onClick={() => setIsUnifiedMode(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${!isUnifiedMode ? 'bg-[#004EA2] text-white border-[#004EA2]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#004EA2]'}`}>独立模式</button>
                </div>
                <p className="text-xs text-gray-500 mt-2">{isUnifiedMode ? '所有用途共享模型名称和API Endpoint，各自配置Prompt' : '每个用途独立配置模型名称、API Endpoint和Prompt'}</p>
              </div>
              {isUnifiedMode && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  并发数 (Concurrency)
                  <span className="text-xs text-gray-400 ml-2">统一模式下所有子模型共享此值</span>
                </label>
                <input type="number" min={1} max={50} value={concurrency} onChange={e => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-xl text-sm" />
                <p className="text-xs text-gray-400 mt-1">控制该模型的最大并行请求数，默认为 1</p>
              </div>
              )}
              {isUnifiedMode ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">模型名称</label>
                      <input type="text" value={unifiedConfig.model_name} onChange={e => setUnifiedConfig(p => ({ ...p, model_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm" placeholder="例如：qwen-plus" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">API Endpoint URL</label>
                      <input type="text" value={unifiedConfig.endpoint_url} onChange={e => setUnifiedConfig(p => ({ ...p, endpoint_url: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono" placeholder="https://..." />
                    </div>
                  </div>
                  {[
                    { key: 'risk_judgment', label: '指标风险判断逻辑模型' },
                    { key: 'risk_signal', label: '指标风险信号触发模型' },
                    { key: 'inquiry_logic', label: '问询逻辑模型' },
                    { key: 'inquiry_item', label: '问询事项生成模型' },
                    { key: 'common', label: '通用模型' },
                  ].map(item => (
                    <div key={item.key} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Sparkles size={14} className="text-[#004EA2]" />{item.label}
                      </h4>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Prompt (Instruction)</label>
                      <textarea
                        value={unifiedConfig.prompts[item.key] || ''}
                        onChange={e => setUnifiedConfig(p => ({ ...p, prompts: { ...p.prompts, [item.key]: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-y"
                        rows={4}
                        placeholder="请输入该用途的模型指令..."
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {separateConfigs.map((cfg, idx) => (
                    <div key={cfg.purpose} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Sparkles size={14} className="text-[#004EA2]" />{cfg.label}
                      </h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">模型名称</label>
                            <input type="text" value={cfg.model_name} onChange={e => updateSeparateConfig(idx, 'model_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="例如：qwen-plus" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">API Endpoint URL</label>
                            <input type="text" value={cfg.endpoint_url} onChange={e => updateSeparateConfig(idx, 'endpoint_url', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" placeholder="https://..." />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">并发数</label>
                            <input type="number" min={1} max={50} value={cfg.concurrency || 1} onChange={e => updateSeparateConfig(idx, 'concurrency', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Prompt (Instruction)</label>
                          <textarea
                            value={cfg.prompt || ''}
                            onChange={e => updateSeparateConfig(idx, 'prompt', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-y"
                            rows={4}
                            placeholder="请输入该用途的模型指令..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModelForm(false)} className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">取消</button>
              <button onClick={handleSaveModel} className="px-6 py-2 bg-[#004EA2] hover:bg-[#003875] text-white rounded-xl text-sm font-bold">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Model Delete Confirm Modal */}
      {deleteConfirmModel && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md ring-1 ring-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500"><AlertCircle size={20} /></div>
              <h3 className="text-lg font-bold text-gray-800">确认删除</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">确定要删除「{deleteConfirmModel.display_name || deleteConfirmModel.model_name}」及其所有子模型吗？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmModel(null)} className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">取消</button>
              <button onClick={() => { handleDeleteParent(deleteConfirmModel.id); }} className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold">删除</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
