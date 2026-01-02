/**
 * M3U8 广告过滤模块
 * 在 M3U8 解析层面过滤广告片段，比播放时跳过更可靠
 */

import { getUserAdConfig, AdFilterConfig } from './adConfig';

export interface M3U8FilterResult {
  content: string;
  removedSegments: number;
  originalSegments: number;
}

/**
 * 从 M3U8 内容中过滤广告片段
 * @param m3u8Content 原始 M3U8 内容
 * @param source 播放源标识（用于特定源的规则）
 * @param config 广告过滤配置
 */
export function filterAdsFromM3U8(
  m3u8Content: string,
  source?: string,
  config?: AdFilterConfig
): M3U8FilterResult {
  const adConfig = config || getUserAdConfig();
  
  if (!adConfig.enabled || !m3u8Content) {
    return {
      content: m3u8Content,
      removedSegments: 0,
      originalSegments: 0
    };
  }

  const lines = m3u8Content.split('\n');
  const filteredLines: string[] = [];
  let removedSegments = 0;
  let originalSegments = 0;
  let skipNextLine = false;
  let currentExtinf: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 如果上一行被标记为需要跳过，跳过当前行（通常是 ts 片段 URL）
    if (skipNextLine) {
      skipNextLine = false;
      removedSegments++;
      console.log(`[M3U8AdFilter] 跳过广告片段: ${trimmedLine}`);
      continue;
    }

    // 1. 过滤 #EXT-X-DISCONTINUITY 标记（广告插入的典型标志）
    if (trimmedLine === '#EXT-X-DISCONTINUITY') {
      console.log('[M3U8AdFilter] 检测到 DISCONTINUITY 标记，跳过');
      continue;
    }

    // 2. 检查 EXTINF 行（包含片段时长信息）
    if (trimmedLine.startsWith('#EXTINF:')) {
      currentExtinf = trimmedLine;
      const duration = parseExtinfDuration(trimmedLine);
      
      // 检查是否匹配广告时长特征
      if (duration !== null && isAdDuration(duration, source, adConfig)) {
        skipNextLine = true;
        console.log(`[M3U8AdFilter] 检测到广告时长: ${duration}s`);
        continue;
      }
      
      filteredLines.push(line);
      originalSegments++;
      continue;
    }

    // 3. 检查 URL 行是否包含广告特征
    if (!trimmedLine.startsWith('#') && trimmedLine.length > 0) {
      if (isAdUrl(trimmedLine, adConfig)) {
        // 如果上一行是 EXTINF，也需要移除
        if (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].trim().startsWith('#EXTINF:')) {
          filteredLines.pop();
          originalSegments--;
        }
        removedSegments++;
        console.log(`[M3U8AdFilter] 跳过广告 URL: ${trimmedLine}`);
        continue;
      }
    }

    filteredLines.push(line);
  }

  return {
    content: filteredLines.join('\n'),
    removedSegments,
    originalSegments
  };
}

/**
 * 解析 EXTINF 行中的时长
 */
function parseExtinfDuration(extinfLine: string): number | null {
  // 格式: #EXTINF:5.640000, 或 #EXTINF:5.640000
  const match = extinfLine.match(/#EXTINF:([\d.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

/**
 * 检查时长是否匹配广告特征
 */
function isAdDuration(duration: number, source?: string, config?: AdFilterConfig): boolean {
  // 特定源的广告时长规则
  const sourceAdDurations: Record<string, number[]> = {
    'ruyi': [5.64, 2.96, 3.48, 4.0, 0.96, 10.0, 1.266667],
    'ffzy': [5.0, 10.0, 15.0],
    'bfzy': [5.0, 10.0, 15.0],
    // 可以添加更多源的规则
  };

  // 通用广告时长范围（通常广告片段是固定时长）
  const commonAdDurations = [
    5.0, 5.64, 10.0, 15.0, 20.0, 30.0,  // 常见广告时长
    2.96, 3.48, 4.0, 0.96, 1.266667     // 特殊广告时长
  ];

  // 检查特定源规则
  if (source && sourceAdDurations[source]) {
    const sourceDurations = sourceAdDurations[source];
    for (const adDuration of sourceDurations) {
      if (Math.abs(duration - adDuration) < 0.01) {
        return true;
      }
    }
  }

  // 严格模式下只使用特定源规则
  if (config?.strictMode) {
    return false;
  }

  // 非严格模式下检查通用规则
  for (const adDuration of commonAdDurations) {
    if (Math.abs(duration - adDuration) < 0.01) {
      return true;
    }
  }

  return false;
}

/**
 * 检查 URL 是否包含广告特征
 */
function isAdUrl(url: string, config?: AdFilterConfig): boolean {
  const lowerUrl = url.toLowerCase();
  
  // 高置信度广告 URL 关键词
  const adKeywords = [
    'adserver', 'adservice', 'doubleclick', 'googlesyndication',
    'admanager', 'vast', 'vpaid', 'preroll', 'postroll', 'midroll',
    'commercials', 'adtag', 'ads.', '/ads/', '_ad_', '-ad-',
    'advertisement', 'sponsor', 'promo'
  ];

  for (const keyword of adKeywords) {
    if (lowerUrl.includes(keyword)) {
      return true;
    }
  }

  // 检查自定义模式
  if (config?.customPatterns) {
    for (const pattern of config.customPatterns) {
      if (!pattern.enabled) continue;
      
      for (const urlPattern of pattern.urlPatterns) {
        if (pattern.matchType === 'regex') {
          try {
            const regex = new RegExp(urlPattern, 'i');
            if (regex.test(url)) return true;
          } catch (e) {
            // 忽略无效正则
          }
        } else {
          if (lowerUrl.includes(urlPattern.toLowerCase())) return true;
        }
      }
    }
  }

  return false;
}

/**
 * 添加特定源的广告时长规则
 */
export function addSourceAdDurations(source: string, durations: number[]): void {
  // 这个函数可以用于动态添加规则
  console.log(`[M3U8AdFilter] 添加源 ${source} 的广告时长规则:`, durations);
}

/**
 * M3U8 广告过滤器类（用于 HLS.js 集成）
 */
export class M3U8AdFilter {
  private config: AdFilterConfig;
  private source: string;
  private stats = {
    totalFiltered: 0,
    totalProcessed: 0
  };

  constructor(source?: string, config?: AdFilterConfig) {
    this.source = source || '';
    this.config = config || getUserAdConfig();
  }

  /**
   * 过滤 M3U8 内容
   */
  filter(m3u8Content: string): string {
    const result = filterAdsFromM3U8(m3u8Content, this.source, this.config);
    this.stats.totalFiltered += result.removedSegments;
    this.stats.totalProcessed += result.originalSegments;
    return result.content;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AdFilterConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 设置播放源
   */
  setSource(source: string) {
    this.source = source;
  }
}

// 导出默认实例
export const m3u8AdFilter = new M3U8AdFilter();
