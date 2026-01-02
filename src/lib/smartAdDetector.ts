/**
 * 智能广告检测器
 * 专门针对视频内容中嵌入的几秒到十几秒广告片段
 */

export interface FragmentInfo {
  url: string;
  duration?: number;
  title?: string;
  index?: number;
  startTime?: number;
  endTime?: number;
}

export interface DetectionResult {
  isAd: boolean;
  confidence: number; // 0-1 置信度
  reason: string;
  adType?: 'short' | 'mid-roll' | 'embedded' | 'unknown';
}

/**
 * 智能广告检测器类
 */
export class SmartAdDetector {
  private adHistory: Map<string, boolean> = new Map();
  private contentPatternCache: Map<string, boolean> = new Map();

  /**
   * 检测片段是否为广告
   */
  detectAd(fragment: FragmentInfo): DetectionResult {
    const { url, duration, title, index } = fragment;

    // 1. 快速缓存检查
    const cacheKey = `${url}_${duration}`;
    if (this.adHistory.has(cacheKey)) {
      const isAd = this.adHistory.get(cacheKey)!;
      return {
        isAd,
        confidence: 0.9,
        reason: '缓存命中',
        adType: 'unknown'
      };
    }

    // 2. 基于时长的初步判断
    if (!duration) {
      return {
        isAd: false,
        confidence: 0.1,
        reason: '缺少时长信息'
      };
    }

    let result = this.analyzeByDuration(duration);
    
    // 3. URL 模式分析
    const urlAnalysis = this.analyzeByUrl(url);
    result.confidence = Math.max(result.confidence, urlAnalysis.confidence);
    if (urlAnalysis.isAd) {
      result = { ...urlAnalysis, ...result };
    }

    // 4. 标题分析
    if (title) {
      const titleAnalysis = this.analyzeByTitle(title);
      result.confidence = Math.max(result.confidence, titleAnalysis.confidence);
      if (titleAnalysis.isAd) {
        result = { ...titleAnalysis, ...result };
      }
    }

    // 5. 序列模式分析（基于片段索引）
    if (index !== undefined) {
      const sequenceAnalysis = this.analyzeBySequence(index, duration);
      result.confidence = Math.max(result.confidence, sequenceAnalysis.confidence);
      if (sequenceAnalysis.isAd) {
        result = { ...sequenceAnalysis, ...result };
      }
    }

    // 6. 缓存结果
    this.adHistory.set(cacheKey, result.isAd);

    return result;
  }

  /**
   * 基于时长分析
   */
  private analyzeByDuration(duration: number): DetectionResult {
    // 极短片段 (1-3秒) - 极低置信度，很可能是片头/片尾或转场
    if (duration >= 1 && duration <= 3) {
      return {
        isAd: false, // 默认不认为是广告
        confidence: 0.1,
        reason: `极短片段 (${duration}s)`,
        adType: 'short'
      };
    }

    // 短片段 (4-10秒) - 可能是广告，但置信度不高
    if (duration >= 4 && duration <= 10) {
      return {
        isAd: true,
        confidence: 0.4, // 进一步降低置信度
        reason: `短片段 (${duration}s)`,
        adType: 'short'
      };
    }

    // 中等片段 (11-30秒) - 广告可能性较高
    if (duration >= 11 && duration <= 30) {
      return {
        isAd: true,
        confidence: 0.6, // 提高此范围的置信度
        reason: `中等片段 (${duration}s)`,
        adType: 'mid-roll'
      };
    }

    // 较长片段 (31-60秒) - 可能是广告，但需更多证据
    if (duration >= 31 && duration <= 60) {
      return {
        isAd: true,
        confidence: 0.4, // 适中置信度
        reason: `较长片段 (${duration}s)`,
        adType: 'mid-roll'
      };
    }

    // 正常内容片段 (通常 > 60秒) - 极高置信度非广告
    if (duration > 60) {
      return {
        isAd: false,
        confidence: 0.95, // 进一步提高非广告内容的置信度
        reason: `正常内容片段 (${duration}s)`
      };
    }
    
    return {
      isAd: false,
      confidence: 0.2, // 默认较低置信度
      reason: `时长模糊 (${duration}s)`
    };
  }

  /**
   * 基于URL分析
   */
  private analyzeByUrl(url: string): DetectionResult {
    const lowerUrl = url.toLowerCase();
    
    // 广告关键词检测 - 增加权重，减少通用词
    const highConfidenceAdKeywords = [
      'adserver', 'adservice', 'doubleclick', 'googlesyndication', 'admanager',
      'vast', 'vpaid', 'preroll', 'postroll', 'midroll', 'commercials', 'adtag'
    ];
    const mediumConfidenceAdKeywords = [
      'ad', 'ads', 'advertisement', 'promo', 'promotion', 'sponsor', 'sponsored', 'brand_ad'
    ];

    let confidence = 0.1;
    let isAd = false;
    let reason = 'URL无明显广告特征';

    for (const keyword of highConfidenceAdKeywords) {
      if (lowerUrl.includes(keyword)) {
        isAd = true;
        confidence = Math.max(confidence, 0.9); // 提高高置信度关键词的权重
        reason = `URL包含高置信度广告关键词: ${keyword}`;
        break;
      }
    }

    if (!isAd) {
      for (const keyword of mediumConfidenceAdKeywords) {
        if (lowerUrl.includes(keyword)) {
          isAd = true;
          confidence = Math.max(confidence, 0.4); // 降低中置信度关键词的初始权重
          reason = `URL包含中置信度广告关键词: ${keyword}`;
        }
      }
      if (isAd) { // 如果有中置信度关键词，根据数量调整信心
        const foundCount = mediumConfidenceAdKeywords.filter(keyword => lowerUrl.includes(keyword)).length;
        confidence = Math.min(0.6, 0.3 + foundCount * 0.1); // 调整中置信度上限
      }
    }

    // 特殊模式检测 - 保持高置信度
    const adPatterns = [
      /\/ads?\//i,
      /\/commercial\//i,
      /\/promo\//i,
      /\/sponsor\//i,
      /_ad_/i,
      /-ad-/i,
      /\.ad\./i,
      /ad_slot/i,
      /ad_unit/i
    ];

    for (const pattern of adPatterns) {
      if (pattern.test(url)) {
        isAd = true;
        confidence = Math.max(confidence, 0.75); // 略微提高模式检测置信度
        reason = `URL匹配广告模式: ${pattern.source}`;
        break;
      }
    }

    return { isAd, confidence, reason, adType: 'unknown' };
  }

  /**
   * 基于标题分析
   */
  private analyzeByTitle(title: string): DetectionResult {
    const lowerTitle = title.toLowerCase();
    
    // 广告关键词 - 区分置信度
    const highConfidenceAdKeywords = [
      '广告', '推广', '赞助', '商业广告', '宣传片', 'ad', 'commercial', 'sponsored', '广告时间'
    ];
    const mediumConfidenceAdKeywords = [
      '预告', '插播', '弹窗', '横幅', '浮动', '嵌入', 'promo', 'trailer', 'preview', '品牌合作'
    ];

    let confidence = 0.1;
    let isAd = false;
    let reason = '标题无明显广告特征';

    for (const keyword of highConfidenceAdKeywords) {
      if (lowerTitle.includes(keyword)) {
        isAd = true;
        confidence = Math.max(confidence, 0.85); // 提高高置信度关键词的权重
        reason = `标题包含高置信度广告关键词: ${keyword}`;
        break;
      }
    }

    if (!isAd) {
      for (const keyword of mediumConfidenceAdKeywords) {
        if (lowerTitle.includes(keyword)) {
          isAd = true;
          confidence = Math.max(confidence, 0.45); // 降低中置信度关键词的初始权重
          reason = `标题包含中置信度广告关键词: ${keyword}`;
        }
      }
      if (isAd) {
        const foundCount = mediumConfidenceAdKeywords.filter(keyword => lowerTitle.includes(keyword)).length;
        confidence = Math.min(0.65, 0.35 + foundCount * 0.1); // 调整中置信度上限
      }
    }

    return { isAd, confidence, reason, adType: 'unknown' };
  }

  /**
   * 基于序列模式分析
   */
  private analyzeBySequence(index: number, duration: number): DetectionResult {
    // 检查是否为开头的几个短片段，进一步降低置信度，避免误判片头
    if (index < 2 && duration <= 8) { // 缩短时长范围
      return {
        isAd: false, // 默认不认为是广告
        confidence: 0.2, // 进一步降低置信度
        reason: `开头短片段 (索引: ${index}, 时长: ${duration}s)`,
        adType: 'short'
      };
    }

    // 检查是否有规律的短片段模式 - 仅作为辅助判断，不单独作为高置信度依据
    if (duration <= 12) { // 缩短时长范围
      return {
        isAd: false, // 默认不认为是广告，除非其他因素确认
        confidence: 0.1, // 进一步降低置信度
        reason: `序列中的短片段 (索引: ${index}, 时长: ${duration}s)`,
        adType: 'unknown'
      };
    }

    return {
      isAd: false,
      confidence: 0.1,
      reason: '序列模式不明显'
    };
  }

  /**
   * 批量检测片段
   */
  detectBatch(fragments: FragmentInfo[]): DetectionResult[] {
    return fragments.map(fragment => this.detectAd(fragment));
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.adHistory.clear();
    this.contentPatternCache.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    cacheSize: number;
    totalDetections: number;
    adDetections: number;
  } {
    const totalDetections = this.adHistory.size;
    const adDetections = Array.from(this.adHistory.values()).filter(isAd => isAd).length;

    return {
      cacheSize: this.adHistory.size,
      totalDetections,
      adDetections
    };
  }
}

// 导出单例实例
export const smartAdDetector = new SmartAdDetector();
