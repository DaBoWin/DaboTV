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
    // 超短片段 (3-8秒) - 很可能是广告
    if (duration >= 3 && duration <= 8) {
      return {
        isAd: true,
        confidence: 0.7,
        reason: `超短片段 (${duration}s)`,
        adType: 'short'
      };
    }

    // 短片段 (9-20秒) - 可能是广告
    if (duration >= 9 && duration <= 20) {
      return {
        isAd: true,
        confidence: 0.5,
        reason: `短片段 (${duration}s)`,
        adType: 'short'
      };
    }

    // 中等片段 (21-45秒) - 可能是插播广告
    if (duration >= 21 && duration <= 45) {
      return {
        isAd: true,
        confidence: 0.4,
        reason: `中等片段 (${duration}s)`,
        adType: 'mid-roll'
      };
    }

    // 正常内容片段 (通常 > 60秒)
    if (duration > 60) {
      return {
        isAd: false,
        confidence: 0.8,
        reason: `正常内容片段 (${duration}s)`
      };
    }

    return {
      isAd: false,
      confidence: 0.2,
      reason: `时长模糊 (${duration}s)`
    };
  }

  /**
   * 基于URL分析
   */
  private analyzeByUrl(url: string): DetectionResult {
    const lowerUrl = url.toLowerCase();
    
    // 广告关键词检测
    const adKeywords = [
      'ad', 'ads', 'advertisement', 'commercial', 'promo', 'promotion',
      'sponsor', 'sponsored', 'brand', 'marketing', 'advert', 'pub',
      'publicity', 'endorsement', 'placement', 'product'
    ];

    const foundKeywords = adKeywords.filter(keyword => lowerUrl.includes(keyword));
    
    if (foundKeywords.length > 0) {
      return {
        isAd: true,
        confidence: Math.min(0.8, 0.3 + foundKeywords.length * 0.2),
        reason: `URL包含广告关键词: ${foundKeywords.join(', ')}`,
        adType: 'unknown'
      };
    }

    // 特殊模式检测
    const adPatterns = [
      /\/ads?\//i,
      /\/commercial\//i,
      /\/promo\//i,
      /\/sponsor\//i,
      /_ad_/i,
      /-ad-/i,
      /\.ad\./i
    ];

    for (const pattern of adPatterns) {
      if (pattern.test(url)) {
        return {
          isAd: true,
          confidence: 0.7,
          reason: `URL匹配广告模式: ${pattern.source}`,
          adType: 'unknown'
        };
      }
    }

    return {
      isAd: false,
      confidence: 0.1,
      reason: 'URL无明显广告特征'
    };
  }

  /**
   * 基于标题分析
   */
  private analyzeByTitle(title: string): DetectionResult {
    const lowerTitle = title.toLowerCase();
    
    // 中文广告关键词
    const chineseAdKeywords = [
      '广告', '推广', '赞助', '赞助商', '品牌', '营销', '商业',
      '宣传片', '预告', '插播', '弹窗', '横幅', '浮动', '嵌入'
    ];

    // 英文广告关键词
    const englishAdKeywords = [
      'advertisement', 'ad', 'commercial', 'promo', 'promotion',
      'sponsor', 'sponsored', 'brand', 'marketing', 'commercial',
      'trailer', 'preview', 'popup', 'banner', 'overlay', 'embed'
    ];

    const allKeywords = [...chineseAdKeywords, ...englishAdKeywords];
    const foundKeywords = allKeywords.filter(keyword => lowerTitle.includes(keyword));

    if (foundKeywords.length > 0) {
      return {
        isAd: true,
        confidence: Math.min(0.9, 0.4 + foundKeywords.length * 0.2),
        reason: `标题包含广告关键词: ${foundKeywords.join(', ')}`,
        adType: 'unknown'
      };
    }

    return {
      isAd: false,
      confidence: 0.1,
      reason: '标题无明显广告特征'
    };
  }

  /**
   * 基于序列模式分析
   */
  private analyzeBySequence(index: number, duration: number): DetectionResult {
    // 检查是否为开头的几个短片段
    if (index < 3 && duration <= 15) {
      return {
        isAd: true,
        confidence: 0.6,
        reason: `开头短片段 (索引: ${index}, 时长: ${duration}s)`,
        adType: 'short'
      };
    }

    // 检查是否有规律的短片段模式
    if (duration <= 20) {
      // 这里可以添加更复杂的序列分析逻辑
      // 例如：检查是否每隔N个片段就有一个短片段
      return {
        isAd: true,
        confidence: 0.3,
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
