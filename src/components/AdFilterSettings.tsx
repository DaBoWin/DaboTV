'use client';

import { useState, useEffect } from 'react';
import { Settings, Shield, ShieldOff } from 'lucide-react';

import { 
  AdFilterConfig, 
  CustomPattern, 
  getUserAdConfig, 
  saveUserAdConfig, 
  resetAdConfig 
} from '@/lib/adConfig';
import { adFilter } from '@/lib/adFilter';

interface AdFilterSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdFilterSettings({ isOpen, onClose }: AdFilterSettingsProps) {
  const [config, setConfig] = useState<AdFilterConfig>(getUserAdConfig());
  const [stats, setStats] = useState(adFilter.getStats());

  useEffect(() => {
    setConfig(getUserAdConfig());
    setStats(adFilter.getStats());
  }, [isOpen]);

  const handleConfigChange = (updates: Partial<AdFilterConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveUserAdConfig(updates);
    adFilter.updateConfig(newConfig);
    setStats(adFilter.getStats());
  };

  const handlePatternToggle = (patternName: string, enabled: boolean) => {
    adFilter.togglePattern(patternName, enabled);
    const newConfig = adFilter.getConfig();
    setConfig(newConfig);
    saveUserAdConfig(newConfig);
    setStats(adFilter.getStats());
  };

  const handleReset = () => {
    const defaultConfig = resetAdConfig();
    setConfig(defaultConfig);
    adFilter.updateConfig(defaultConfig);
    setStats(adFilter.getStats());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 text-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* 头部 */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config.enabled ? (
                <Shield className="w-6 h-6 text-green-500" />
              ) : (
                <ShieldOff className="w-6 h-6 text-gray-500" />
              )}
              <h2 className="text-xl font-semibold">广告过滤设置</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 总开关 */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">启用广告过滤</h3>
              <p className="text-sm text-gray-400 mt-1">
                开启后将自动跳过检测到的广告片段
              </p>
            </div>
            <button
              onClick={() => handleConfigChange({ enabled: !config.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.enabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 严格模式 */}
          {config.enabled && (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">严格模式</h3>
                <p className="text-sm text-gray-400 mt-1">
                  严格模式下只使用自定义规则，可能会减少误过滤
                </p>
              </div>
              <button
                onClick={() => handleConfigChange({ strictMode: !config.strictMode })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.strictMode ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.strictMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* 统计信息 */}
          {config.enabled && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">过滤统计</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">预定义模式:</span>
                  <span className="ml-2 text-white">{stats.patterns}</span>
                </div>
                <div>
                  <span className="text-gray-400">自定义模式:</span>
                  <span className="ml-2 text-white">{stats.customPatterns}</span>
                </div>
                <div>
                  <span className="text-gray-400">已启用:</span>
                  <span className="ml-2 text-green-400">{stats.enabledPatterns}</span>
                </div>
                <div>
                  <span className="text-gray-400">模式:</span>
                  <span className="ml-2 text-white">{config.strictMode ? '严格' : '标准'}</span>
                </div>
              </div>
            </div>
          )}

          {/* 广告类型设置 */}
          {config.enabled && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">广告类型过滤</h3>
              
              <div className="space-y-3">
                {config.customPatterns.map((pattern) => (
                  <div
                    key={pattern.name}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{pattern.name}</h4>
                      <p className="text-sm text-gray-400 mt-1">
                        {pattern.urlPatterns.length > 0 && (
                          <span>URL: {pattern.urlPatterns.join(', ')} </span>
                        )}
                        {pattern.titlePatterns.length > 0 && (
                          <span>标题: {pattern.titlePatterns.join(', ')}</span>
                        )}
                        {pattern.durationRange && (
                          <span> 时长: {pattern.durationRange.min}s-{pattern.durationRange.max}s</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePatternToggle(pattern.name, !pattern.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        pattern.enabled ? 'bg-green-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          pattern.enabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              重置默认
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
