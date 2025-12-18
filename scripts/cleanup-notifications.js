/**
 * 清理浏览器 localStorage 中的旧通知数据
 * 
 * 使用方法：
 * 1. 在浏览器控制台中运行此脚本
 * 2. 或者将此脚本添加到页面中执行
 * 
 * 此脚本会清理：
 * - 旧的全局通知键 (pm_notifications)
 * - 所有用户特定的通知键 (pm_notifications_*)
 * - 匿名通知键 (pm_notifications_anonymous)
 */

(function cleanupOldNotifications() {
  if (typeof window === 'undefined' || !window.localStorage) {
    console.log('❌ 此脚本只能在浏览器环境中运行');
    return;
  }

  let cleanedCount = 0;
  const keysToRemove = [];

  // 收集所有需要清理的键
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key === 'pm_notifications' ||
      key.startsWith('pm_notifications_')
    )) {
      keysToRemove.push(key);
    }
  }

  // 清理所有找到的键
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
      cleanedCount++;
      console.log(`✅ 已清理: ${key}`);
    } catch (e) {
      console.error(`❌ 清理失败: ${key}`, e);
    }
  });

  console.log(`\n🎉 清理完成！共清理 ${cleanedCount} 个通知数据键`);
  console.log('💡 提示：刷新页面后，通知系统将使用新的基于用户ID的隔离机制');
})();
