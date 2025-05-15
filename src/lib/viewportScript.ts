/**
 * 这个文件包含在页面加载时强制设置viewport的全局脚本
 * 不依赖于React生命周期
 */

// 避免重复执行
let isSetup = false;

export function setupGlobalViewport() {
  // 如果已经设置过，直接返回
  if (isSetup) return;
  isSetup = true;

  // 确保在客户端环境中执行
  if (typeof window === "undefined") return;

  // 立即运行一次设置
  setViewport();

  // 设置定时器定期检查viewport
  setInterval(setViewport, 1000);

  // 监听页面加载完成事件
  window.addEventListener("load", setViewport);

  // 监听历史状态变化
  window.addEventListener("popstate", setViewport);

  // 监听页面可见性变化
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      setViewport();
    }
  });

  // 保存原始的History方法
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  // 覆盖pushState方法
  window.history.pushState = function () {
    // 调用原始方法
    originalPushState.apply(this, arguments as any);
    // 路由变化后设置viewport
    setTimeout(setViewport, 10);
  };

  // 覆盖replaceState方法
  window.history.replaceState = function () {
    // 调用原始方法
    originalReplaceState.apply(this, arguments as any);
    // 路由变化后设置viewport
    setTimeout(setViewport, 10);
  };

  console.log("[viewportScript] 全局viewport管理已初始化");
}

/**
 * 设置viewport
 */
function setViewport() {
  let viewportMeta = document.querySelector(
    'meta[name="viewport"]'
  ) as HTMLMetaElement | null;

  if (!viewportMeta) {
    viewportMeta = document.createElement("meta");
    viewportMeta.name = "viewport";
    document.head.appendChild(viewportMeta);
  }

  const viewportContent =
    "width=device-width, initial-scale=0.91, maximum-scale=0.91, user-scalable=no";

  if (viewportMeta.content !== viewportContent) {
    viewportMeta.content = viewportContent;
  }
}
