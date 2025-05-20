// 检查浏览器是否支持Web Worker
export function isWebWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}

// 检查浏览器是否支持多线程扫描
export function isMultiThreadScanSupported(): boolean {
  // 检查是否支持Web Worker
  if (!isWebWorkerSupported()) {
    return false;
  }
  
  // 检查是否支持其他必要的API
  // 例如：SharedArrayBuffer、Atomics等，这些在某些浏览器中可能被禁用
  // 目前只检查基本的Web Worker支持
  return true;
}
