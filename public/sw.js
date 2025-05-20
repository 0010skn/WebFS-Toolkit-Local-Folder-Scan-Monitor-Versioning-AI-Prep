// 缓存名称和版本 - 使用时间戳确保每次部署都有新的缓存名称
const CACHE_VERSION = "v3";
const TIMESTAMP = new Date().toISOString().split("T")[0];
const CACHE_NAME = `folda-scan-cache-${CACHE_VERSION}-${TIMESTAMP}`;
console.log(`[Service Worker] 缓存名称: ${CACHE_NAME}`);
// 需要缓存的资源列表
let urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  // 添加其他重要静态资源
];

// 安装Service Worker
self.addEventListener("install", (event) => {
  console.log(`[Service Worker] 安装新版本 ${CACHE_NAME}`);

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] 打开新缓存并预缓存重要资源");
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // 强制新安装的 Service Worker 立即激活，不等待旧的关闭
        console.log("[Service Worker] 跳过等待，立即激活");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[Service Worker] 缓存预加载失败:", error);
      })
  );
});

// 激活Service Worker
self.addEventListener("activate", (event) => {
  console.log(`[Service Worker] 激活新版本 ${CACHE_NAME}`);

  // 清理旧缓存
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        console.log("[Service Worker] 找到缓存:", cacheNames.join(", "));

        return Promise.all(
          cacheNames.map((cacheName) => {
            // 删除不是当前版本的所有缓存
            if (cacheName !== CACHE_NAME) {
              console.log(`[Service Worker] 删除旧缓存: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // 立即控制所有客户端
        console.log("[Service Worker] 接管所有客户端");
        return self.clients.claim();
      })
      .catch((error) => {
        console.error("[Service Worker] 清理缓存失败:", error);
      })
  );
});

// 处理资源请求
self.addEventListener("fetch", (event) => {
  // 只处理GET请求，其他请求直接通过网络
  if (event.request.method !== "GET") {
    return;
  }

  // 排除一些不应该缓存的请求
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("chrome-extension://")
  ) {
    return;
  }

  // 使用网络优先策略，但对静态资源使用缓存优先
  const isStaticAsset = urlsToCache.some(
    (staticUrl) =>
      event.request.url.endsWith(staticUrl) ||
      event.request.url.includes("/static/")
  );

  if (isStaticAsset) {
    // 缓存优先，网络回退策略 (适用于静态资源)
    event.respondWith(
      caches
        .match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // console.log(`[Service Worker] 从缓存返回: ${event.request.url}`);
            return cachedResponse;
          }

          // 缓存中没有，从网络获取
          // console.log(`[Service Worker] 从网络获取: ${event.request.url}`);
          return fetchAndCache(event.request);
        })
        .catch((error) => {
          console.error(
            `[Service Worker] 获取资源失败: ${event.request.url}`,
            error
          );
          // 可以在这里返回一个离线页面或默认资源
        })
    );
  } else {
    // 网络优先，缓存回退策略 (适用于动态内容)
    event.respondWith(
      fetchAndCache(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});

// 辅助函数：从网络获取并缓存
async function fetchAndCache(request) {
  const response = await fetch(request);

  // 检查响应是否有效且可缓存
  if (response && response.status === 200 && response.type === "basic") {
    const responseToCache = response.clone();
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, responseToCache);
    // console.log(`[Service Worker] 缓存新资源: ${request.url}`);
  }

  return response;
}
