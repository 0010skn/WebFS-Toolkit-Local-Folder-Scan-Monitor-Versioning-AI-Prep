"use client";

import { useViewport } from "@/lib/useViewport";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * ViewportManager组件
 * 一个强化版的无UI组件，负责在客户端设置viewport，并监听路由变化
 */
export default function ViewportManager() {
  // 调用viewport设置hook
  useViewport();

  // 获取当前路径，用于监测路由变化
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 当路由改变时，重新设置viewport
  useEffect(() => {
    console.log(`路由变化: ${pathname}`);

    // 确保viewport meta存在并正确设置
    const resetViewport = () => {
      let viewportMeta = document.querySelector(
        'meta[name="viewport"]'
      ) as HTMLMetaElement | null;

      if (!viewportMeta) {
        viewportMeta = document.createElement("meta");
        viewportMeta.name = "viewport";
        document.head.appendChild(viewportMeta);
      }

      viewportMeta.content =
        "width=device-width, initial-scale=0.91, maximum-scale=0.91, user-scalable=no";
      console.log("路由切换后重设viewport");
    };

    // 立即设置一次
    resetViewport();

    // 设置短暂延迟后再设置一次，确保在DOM更新后仍然有效
    const timeoutId = setTimeout(resetViewport, 100);

    return () => clearTimeout(timeoutId);
  }, [pathname, searchParams]);

  // 这个组件不渲染任何UI
  return null;
}
