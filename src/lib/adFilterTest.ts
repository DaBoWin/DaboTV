/**
 * 广告过滤功能测试
 */

import { adFilter } from './adFilter';
import { smartAdDetector } from './smartAdDetector';

// 测试用例
const testCases = [
  {
    name: '短广告片段',
    url: 'https://example.com/video/ad_segment_001.ts',
    duration: 8,
    expected: true,
    description: '8秒的短片段，URL包含ad关键词'
  },
  {
    name: '正常内容片段',
    url: 'https://example.com/video/episode_001.ts',
    duration: 1800,
    expected: false,
    description: '30分钟的正常内容片段'
  },
  {
    name: '中等长度广告',
    url: 'https://example.com/video/commercial_break.ts',
    duration: 25,
    expected: true,
    description: '25秒的商业广告片段'
  },
  {
    name: '赞助内容',
    url: 'https://example.com/video/sponsored_content.ts',
    duration: 15,
    expected: true,
    description: '15秒的赞助内容'
  },
  {
    name: '预览片段',
    url: 'https://example.com/video/preview_trailer.ts',
    duration: 45,
    expected: true,
    description: '45秒的预告片'
  },
  {
    name: '嵌入广告',
    url: 'https://example.com/video/embed_ad_001.ts',
    duration: 12,
    expected: true,
    description: '12秒的嵌入广告'
  }
];

/**
 * 运行广告过滤测试
 */
export function runAdFilterTests(): void {
  console.log('🧪 开始广告过滤功能测试...\n');
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  testCases.forEach((testCase, index) => {
    console.log(`📋 测试 ${index + 1}: ${testCase.name}`);
    console.log(`📝 描述: ${testCase.description}`);
    console.log(`🔗 URL: ${testCase.url}`);
    console.log(`⏱️ 时长: ${testCase.duration}秒`);
    
    // 使用智能检测器
    const smartResult = smartAdDetector.detectAd({
      url: testCase.url,
      duration: testCase.duration,
      index: index
    });
    
    console.log(`🤖 智能检测结果: ${smartResult.isAd ? '广告' : '非广告'} (置信度: ${smartResult.confidence})`);
    console.log(`💡 原因: ${smartResult.reason}`);
    
    // 使用广告过滤器
    const filterResult = adFilter.isAd(testCase.url, testCase.duration, undefined, index);
    
    console.log(`🔍 过滤器结果: ${filterResult ? '广告' : '非广告'}`);
    console.log(`✅ 期望结果: ${testCase.expected ? '广告' : '非广告'}`);
    
    const passed = filterResult === testCase.expected;
    console.log(`${passed ? '✅' : '❌'} 测试${passed ? '通过' : '失败'}\n`);
    
    if (passed) {
      passedTests++;
    }
  });
  
  console.log(`📊 测试结果总结:`);
  console.log(`✅ 通过: ${passedTests}/${totalTests}`);
  console.log(`❌ 失败: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);
  
  // 显示统计信息
  const filterStats = adFilter.getStats();
  const detectorStats = smartAdDetector.getStats();
  
  console.log(`📈 广告过滤器统计:`);
  console.log(`  - 启用状态: ${filterStats.enabled ? '开启' : '关闭'}`);
  console.log(`  - 严格模式: ${filterStats.strictMode ? '开启' : '关闭'}`);
  console.log(`  - 自定义模式数: ${filterStats.customPatterns}`);
  console.log(`  - 启用模式数: ${filterStats.enabledPatterns}\n`);
  
  console.log(`🤖 智能检测器统计:`);
  console.log(`  - 缓存大小: ${detectorStats.cacheSize}`);
  console.log(`  - 总检测次数: ${detectorStats.totalDetections}`);
  console.log(`  - 广告检测次数: ${detectorStats.adDetections}\n`);
}

/**
 * 测试特定URL的广告检测
 */
export function testSpecificUrl(url: string, duration?: number): void {
  console.log(`🔍 测试特定URL: ${url}`);
  console.log(`⏱️ 时长: ${duration || '未知'}秒`);
  
  const result = smartAdDetector.detectAd({
    url,
    duration,
    index: 0
  });
  
  console.log(`🤖 智能检测结果: ${result.isAd ? '广告' : '非广告'}`);
  console.log(`📊 置信度: ${result.confidence}`);
  console.log(`💡 原因: ${result.reason}`);
  console.log(`🏷️ 广告类型: ${result.adType || '未知'}\n`);
}

/**
 * 清除测试缓存
 */
export function clearTestCache(): void {
  smartAdDetector.clearCache();
  console.log(`🧹 已清除智能检测器缓存`);
}
