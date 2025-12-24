/**
 * 全局 Dayjs 初始化
 * 
 * 在应用启动时一次性加载所有需要的 dayjs 插件
 * 确保整个应用中 dayjs 插件全局可用，避免"is not a function"错误
 */

import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isBetween from 'dayjs/plugin/isBetween';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// 🔥 全局加载所有 dayjs 插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);

// 导出配置好的 dayjs 实例
export default dayjs;
