import { useEffect } from "react";

/**
 * 设置移动端viewport的自定义Hook
 * 设置缩放比例为0.91并禁用用户缩放
 */
export function useViewport() {
  useEffect(() => {
    // 使用更强的初始化策略
    const initViewport = () => {
      // 先尝试查找已存在的viewport meta
      let viewportMeta = document.querySelector(
        'meta[name="viewport"]'
      ) as HTMLMetaElement | null;

      // 如果没找到，创建一个新的
      if (!viewportMeta) {
        console.log("创建新的viewport meta标签");
        viewportMeta = document.createElement("meta");
        viewportMeta.name = "viewport";
        document.head.appendChild(viewportMeta);
      } else {
        console.log("找到已存在的viewport meta标签");
      }

      // 无论是新创建的还是已存在的，都设置content
      const viewportContent =
        "width=device-width, initial-scale=0.91, maximum-scale=0.91, user-scalable=no";

      // 只有当内容不同时才更新，避免不必要的重绘
      if (viewportMeta.content !== viewportContent) {
        viewportMeta.content = viewportContent;
        console.log("viewport已设置为:", viewportContent);
      }
    };

    // 立即执行一次
    initViewport();

    // 设置一系列定时器确保在各种时机都能正确设置viewport
    const timeoutIds = [
      setTimeout(() => initViewport(), 100), // 页面加载后立即设置
      setTimeout(() => initViewport(), 500), // 页面内容加载后设置
      setTimeout(() => initViewport(), 1000), // 确保在路由变化后设置
    ];

    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        initViewport();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 监听DOM变化，检测是否有人移除了viewport标签
    let observer: MutationObserver | null = null;
    try {
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.type === "childList" &&
            mutation.removedNodes.length > 0
          ) {
            // 检查是否有viewport meta被移除
            const viewportExists = document.querySelector(
              'meta[name="viewport"]'
            );
            if (!viewportExists) {
              console.log("检测到viewport meta被移除，重新创建");
              initViewport();
            }
          }
        }
      });

      // 监视head元素的子节点变化
      observer.observe(document.head, { childList: true });
    } catch (err) {
      console.warn("MutationObserver不可用，无法监控viewport变化:", err);
    }

    // 保存当前的pushState和replaceState函数
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    // 覆盖pushState和replaceState，以便在路由变化后重新设置viewport
    window.history.pushState = function () {
      originalPushState.apply(this, arguments as any);
      setTimeout(initViewport, 10);
    };

    window.history.replaceState = function () {
      originalReplaceState.apply(this, arguments as any);
      setTimeout(initViewport, 10);
    };

    // 监听popstate事件（浏览器的前进/后退按钮）
    const handlePopState = () => {
      setTimeout(initViewport, 10);
    };
    window.addEventListener("popstate", handlePopState);

    // 清理函数
    return () => {
      timeoutIds.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer?.disconnect();
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);
}
