/**
 * 广告过滤配置
 * 可根据需要自定义广告检测规则
 */

export interface AdFilterConfig {
  enabled: boolean;
  strictMode: boolean;
  customPatterns: CustomPattern[];
  skipPreRoll: boolean;
  skipMidRoll: boolean;
  skipPostRoll: boolean;
  maxAdDuration: number; // 最大广告时长（秒）
  minContentDuration: number; // 最小内容时长（秒）
}

export interface CustomPattern {
  name: string;
  enabled: boolean;
  urlPatterns: string[];
  titlePatterns: string[];
  durationRange?: {
    min: number;
    max: number;
  };
  priority: number; // 优先级，数字越大优先级越高
  matchType?: 'contains' | 'regex'; // 新增：匹配类型，默认为 'contains'
}

// 默认广告过滤配置
export const DEFAULT_AD_CONFIG: AdFilterConfig = {
  enabled: true,
  strictMode: false, // 严格模式下只使用特定源规则，减少误过滤
  customPatterns: [
    {
      name: 'Pre-roll Ads',
      enabled: true,
      urlPatterns: ['pre-roll', 'preroll', 'intro-ad', 'opening-ad', 'prelude'],
      titlePatterns: ['广告', '预告', '推广', '赞助', '宣传片'],
      durationRange: { min: 5, max: 120 },
      priority: 10,
      matchType: 'contains'
    },
    {
      name: 'Mid-roll Ads',
      enabled: true,
      urlPatterns: ['mid-roll', 'midroll', 'break', 'intermission'],
      titlePatterns: ['插播', '中断', '休息', '暂停'],
      durationRange: { min: 3, max: 30 },
      priority: 8,
      matchType: 'contains'
    },
    {
      name: 'Sponsor Content',
      enabled: true,
      urlPatterns: ['sponsor', 'sponsored', 'promotion', 'promo'],
      titlePatterns: ['赞助', '推广', '合作', '品牌'],
      durationRange: { min: 3, max: 60 },
      priority: 7,
      matchType: 'contains'
    },
    {
      name: 'Generic Ads',
      enabled: true,
      urlPatterns: ['adserver', 'adservice', 'doubleclick', 'googlesyndication', 'admanager', 'vast', 'vpaid'],
      titlePatterns: ['广告', '营销', '商业', '推广'],
      durationRange: { min: 5, max: 300 },
      priority: 5,
      matchType: 'contains'
    }
  ],
  skipPreRoll: true,
  skipMidRoll: true,
  skipPostRoll: true,
  maxAdDuration: 300, // 5分钟
  minContentDuration: 60 // 1分钟
};

// 获取用户自定义配置（可从 localStorage 或配置文件读取）
export function getUserAdConfig(): AdFilterConfig {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('ad-filter-config');
      if (saved) {
        return { ...DEFAULT_AD_CONFIG, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('读取广告过滤配置失败:', error);
    }
  }
  return DEFAULT_AD_CONFIG;
}

// 保存用户自定义配置
export function saveUserAdConfig(config: Partial<AdFilterConfig>) {
  if (typeof window !== 'undefined') {
    try {
      const currentConfig = getUserAdConfig();
      const newConfig = { ...currentConfig, ...config };
      localStorage.setItem('ad-filter-config', JSON.stringify(newConfig));
      return true;
    } catch (error) {
      console.warn('保存广告过滤配置失败:', error);
      return false;
    }
  }
  return false;
}

// 重置为默认配置
export function resetAdConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ad-filter-config');
  }
  return DEFAULT_AD_CONFIG;
}
