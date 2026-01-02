/**
 * 广告过滤工具模块
 * 用于在 HLS 播放过程中过滤广告片段
 */

import { AdFilterConfig, CustomPattern, getUserAdConfig } from './adConfig';

// 广告片段的特征模式
export interface AdSegmentPattern {
  // 片段 URL 中包含的关键词
  urlKeywords?: string[];
  // 片段时长（通常广告片段较短）
  durationRange?: { min: number; max: number };
  // 片段标题或描述中的关键词
  titleKeywords?: string[];
}

// 预定义的广告模式
const AD_PATTERNS: AdSegmentPattern[] = [
  {
    urlKeywords: ['ad', 'advertisement', 'commercial', 'promo', 'sponsor'],
    durationRange: { min: 5, max: 60 }
  },
  {
    urlKeywords: ['pre-roll', 'preroll', 'intro-ad', 'opening-ad'],
    durationRange: { min: 10, max: 30 }
  },
  {
    titleKeywords: ['广告', '预告', '推广', '赞助'],
    durationRange: { min: 5, max: 120 }
  }
];

/**
 * 检测片段是否为广告
 */
export function isAdSegment(
  segmentUrl: string,
  duration?: number,
  title?: string,
  config?: AdFilterConfig
): boolean {
  const adConfig = config || getUserAdConfig();
  
  if (!adConfig.enabled) {
    return false;
  }

  // 检查自定义模式
  for (const pattern of adConfig.customPatterns) {
    if (!pattern.enabled) continue;
    
    let match = true;
    
    // 检查 URL 模式
    if (pattern.urlPatterns.length > 0) {
      const urlMatch = pattern.urlPatterns.some(keyword =>
        segmentUrl.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!urlMatch) match = false;
    }
    
    // 检查标题模式
    if (match && pattern.titlePatterns.length > 0 && title) {
      const titleMatch = pattern.titlePatterns.some(keyword =>
        title.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!titleMatch) match = false;
    }
    
    // 检查时长范围
    if (match && pattern.durationRange && duration) {
      const { min, max } = pattern.durationRange;
      if (duration < min || duration > max) match = false;
    }
    
    if (match) {
      console.log(`[AdFilter] 匹配到广告模式: ${pattern.name}`);
      return true;
    }
  }

  // 检查预定义模式（仅在非严格模式下）
  if (!adConfig.strictMode) {
    return AD_PATTERNS.some(pattern => {
      // 检查 URL 关键词
      if (pattern.urlKeywords) {
        const hasAdKeyword = pattern.urlKeywords.some(keyword =>
          segmentUrl.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!hasAdKeyword) return false;
      }

      // 检查时长范围
      if (pattern.durationRange && duration) {
        const { min, max } = pattern.durationRange;
        if (duration < min || duration > max) return false;
      }

      // 检查标题关键词
      if (pattern.titleKeywords && title) {
        const hasTitleKeyword = pattern.titleKeywords.some(keyword =>
          title.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!hasTitleKeyword) return false;
      }

      return true;
    });
  }

  return false;
}

/**
 * 过滤播放列表中的广告片段
 */
export function filterAdSegments(
  segments: Array<{ url: string; duration?: number; title?: string }>,
  config?: AdFilterConfig
): Array<{ url: string; duration?: number; title?: string }> {
  return segments.filter(segment => 
    !isAdSegment(segment.url, segment.duration, segment.title, config)
  );
}

/**
 * HLS.js 片段加载过滤器
 */
export function createHlsFragmentFilter(config?: AdFilterConfig) {
  return (fragments: any[]) => {
    return fragments.filter((fragment: any) => {
      const segmentUrl = fragment.url || fragment.uri;
      if (!segmentUrl) return true;

      // 检查是否为广告片段
      const isAd = isAdSegment(segmentUrl, undefined, undefined, config);
      
      if (isAd) {
        console.log(`[AdFilter] 跳过广告片段: ${segmentUrl}`);
      }

      return !isAd;
    });
  };
}

/**
 * 自定义广告检测规则
 */
export class AdFilter {
  private config: AdFilterConfig;

  constructor(config?: AdFilterConfig) {
    this.config = config || getUserAdConfig();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AdFilterConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): AdFilterConfig {
    return this.config;
  }

  /**
   * 检测是否为广告
   */
  isAd(segmentUrl: string, duration?: number, title?: string): boolean {
    return isAdSegment(segmentUrl, duration, title, this.config);
  }

  /**
   * 添加自定义模式
   */
  addCustomPattern(pattern: CustomPattern) {
    this.config.customPatterns.push(pattern);
  }

  /**
   * 移除自定义模式
   */
  removeCustomPattern(name: string) {
    this.config.customPatterns = this.config.customPatterns.filter(p => p.name !== name);
  }

  /**
   * 启用/禁用特定模式
   */
  togglePattern(name: string, enabled: boolean) {
    const pattern = this.config.customPatterns.find(p => p.name === name);
    if (pattern) {
      pattern.enabled = enabled;
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): { 
    enabled: boolean; 
    strictMode: boolean; 
    patterns: number; 
    customPatterns: number; 
    enabledPatterns: number;
  } {
    return {
      enabled: this.config.enabled,
      strictMode: this.config.strictMode,
      patterns: AD_PATTERNS.length,
      customPatterns: this.config.customPatterns.length,
      enabledPatterns: this.config.customPatterns.filter(p => p.enabled).length
    };
  }
}

// 导出全局实例
export const adFilter = new AdFilter();
