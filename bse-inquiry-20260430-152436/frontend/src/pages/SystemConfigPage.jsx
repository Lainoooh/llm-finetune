import React, { useState } from 'react';
import { ArrowLeft, Settings, BarChart3, AlertTriangle } from 'lucide-react';
import ModelConfigPage from './ModelConfigPage.jsx';
import MetricsConfigPage from './MetricsConfigPage.jsx';
import RiskSignalsConfigPage from './RiskSignalsConfigPage.jsx';

const TABS = [
  { key: 'models', label: '模型配置', icon: Settings },
  { key: 'metrics', label: '指标集配置', icon: BarChart3 },
  { key: 'risk-signals', label: '风险信号配置', icon: AlertTriangle },
];

export default function SystemConfigPage({ onBack }) {
  const [activeTab, setActiveTab] = useState('models');

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Config Sidebar */}
      <div className="w-[200px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-14 flex items-center px-5 border-b border-gray-100">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-[#004EA2] mr-2">
            <ArrowLeft size={18} />
          </button>
          <span className="font-bold text-sm text-gray-800">系统配置</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-[#F0F7FF] text-[#004EA2] font-semibold shadow-sm border border-[#CCE4FF]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`}
              >
                <Icon size={16} className={active ? 'text-[#004EA2]' : 'text-gray-400'} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Config Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'models' && <ModelConfigPage />}
        {activeTab === 'metrics' && <MetricsConfigPage />}
        {activeTab === 'risk-signals' && <RiskSignalsConfigPage />}
      </div>
    </div>
  );
}
