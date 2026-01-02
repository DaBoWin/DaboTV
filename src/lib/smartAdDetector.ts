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
   * 注意：单纯基于时长判断广告不可靠，需要结合其他因素
   */
  private analyzeByDuration(duration: number): DetectionResult {
    // 正常内容片段 (通常 > 60秒) - 高置信度非广告
    if (duration > 60) {
      return {
        isAd: false,
        confidence: 0.95,
        reason: `正常内容片段 (${duration}s)`
      };
    }

    // 其他时长不做判断，需要结合 URL/标题等其他因素
    return {
      isAd: false,
      confidence: 0.1,
      reason: `时长 ${duration}s，需结合其他因素判断`
    };
  }

  /**
   * 基于URL分析
   */
  private analyzeByUrl(url: string): DetectionResult {
    const lowerUrl = url.toLowerCase();
    
    // 广告关键词检测 - 极高置信度关键词
    const veryHighConfidenceAdKeywords = [
      'adserver', 'adservice', 'doubleclick', 'googlesyndication', 'admanager',
      'vast', 'vpaid', 'preroll', 'postroll', 'midroll', 'commercials', 'adtag',
      'ads.youtube.com', 'imasdk.googleapis.com' // 增加更具体的广告域名
    ];
    // 高置信度关键词
    const highConfidenceAdKeywords = [
      'ad', 'ads', 'advertisement', 'promo', 'promotion', 'sponsor', 'sponsored', 'brand_ad'
    ];

    let confidence = 0.05;
    let isAd = false;
    let reason = 'URL无明显广告特征';

    for (const keyword of veryHighConfidenceAdKeywords) {
      if (lowerUrl.includes(keyword)) {
        isAd = true;
        confidence = Math.max(confidence, 0.95); // 极高置信度
        reason = `URL包含极高置信度广告关键词: ${keyword}`;
        break;
      }
    }

    if (!isAd) {
      for (const keyword of highConfidenceAdKeywords) {
        if (lowerUrl.includes(keyword)) {
          isAd = true;
          confidence = Math.max(confidence, 0.6); // 高置信度
          reason = `URL包含高置信度广告关键词: ${keyword}`;
          // 不break，让多个高置信度关键词叠加
        }
      }
      if (isAd) { // 如果有高置信度关键词，根据数量调整信心
        const foundCount = highConfidenceAdKeywords.filter(keyword => lowerUrl.includes(keyword)).length;
        confidence = Math.min(0.8, 0.5 + foundCount * 0.1); // 调整高置信度上限
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
        confidence = Math.max(confidence, 0.7); // 略微提高模式检测置信度
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
    const veryHighConfidenceAdKeywords = [
      '广告', '推广', '赞助', '商业广告', '宣传片', 'ad', 'commercial', 'sponsored', '广告时间', '品牌合作广告'
    ];
    const highConfidenceAdKeywords = [
      '预告', '插播', '弹窗', '横幅', '浮动', '嵌入', 'promo', 'trailer', 'preview'
    ];

    let confidence = 0.05;
    let isAd = false;
    let reason = '标题无明显广告特征';

    for (const keyword of veryHighConfidenceAdKeywords) {
      if (lowerTitle.includes(keyword)) {
        isAd = true;
        confidence = Math.max(confidence, 0.9); // 极高置信度
        reason = `标题包含极高置信度广告关键词: ${keyword}`;
        break;
      }
    }

    if (!isAd) {
      for (const keyword of highConfidenceAdKeywords) {
        if (lowerTitle.includes(keyword)) {
          isAd = true;
          confidence = Math.max(confidence, 0.5); // 高置信度
          reason = `标题包含高置信度广告关键词: ${keyword}`;
        }
      }
      if (isAd) {
        const foundCount = highConfidenceAdKeywords.filter(keyword => lowerTitle.includes(keyword)).length;
        confidence = Math.min(0.7, 0.4 + foundCount * 0.1); // 调整高置信度上限
      }
    }

    return { isAd, confidence, reason, adType: 'unknown' };
  }

  /**
   * 基于序列模式分析
   */
  private analyzeBySequence(index: number, duration: number): DetectionResult {
    // 序列模式分析默认不认为是广告，仅作为辅助信息
    return {
      isAd: false,
      confidence: 0.05, // 极低置信度
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
