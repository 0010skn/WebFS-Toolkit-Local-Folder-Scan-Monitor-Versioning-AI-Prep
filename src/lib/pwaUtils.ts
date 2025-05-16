// 检查是否支持Service Worker
export function isServiceWorkerSupported(): boolean {
  return "serviceWorker" in navigator;
}

// 检查是否支持安装PWA
export function isPwaInstallable(): boolean {
  // 检查是否在浏览器模式下运行
  const isBrowserMode = window.matchMedia("(display-mode: browser)").matches;

  // 判断是否支持PWA安装
  // 注意：Edge浏览器可能没有BeforeInstallPromptEvent，但仍然支持PWA安装
  // 使用更通用的方法判断安装能力
  const hasInstallCapability =
    "BeforeInstallPromptEvent" in window ||
    (navigator.userAgent.includes("Edg") &&
      "serviceWorker" in navigator &&
      "caches" in window);

  return isBrowserMode && hasInstallCapability;
}

// 注册Service Worker
export async function registerServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    console.log("当前浏览器不支持Service Worker");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("Service Worker注册成功:", registration.scope);
    return true;
  } catch (error) {
    console.error("Service Worker注册失败:", error);
    return false;
  }
}

// PWA安装事件处理
let deferredPrompt: any;

// 捕获安装提示事件
export function captureInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    // 阻止Chrome 67及更早版本自动显示安装提示
    e.preventDefault();
    // 保存事件，以便稍后触发
    deferredPrompt = e;
    console.log("捕获到安装提示事件");
  });
}

// 显示安装提示
export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    console.log("没有可用的安装提示");
    return false;
  }

  try {
    // 显示安装提示
    deferredPrompt.prompt();

    // 等待用户响应
    const choiceResult = await deferredPrompt.userChoice;

    // 重置deferredPrompt
    deferredPrompt = null;

    return choiceResult.outcome === "accepted";
  } catch (error) {
    console.error("显示安装提示时出错:", error);
    return false;
  }
}

// 检查PWA是否已安装
export function isPwaInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}
