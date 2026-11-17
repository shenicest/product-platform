import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

/**
 * 让微信的抓取端也走「阻塞渲染」。
 *
 * 默认列表（Next 16 的 `HTML_LIMITED_BOT_UA_RE`，见
 * `node_modules/next/dist/shared/lib/router/utils/html-bots.js`）覆盖了常见的
 * 抓取端，但**不含微信**。而微信生成链接卡片时用 `MicroMessenger` UA 抓页面
 * 且不执行 JS：本项目的详情页都是 `force-dynamic` + 异步 `generateMetadata`，
 * 元数据会流式追加到 `<body>`，微信读不到，卡片就退回标题/正文首图。
 *
 * 这里在默认列表后面追加微信 UA，让这些请求等元数据就绪后再返回，og/twitter
 * 标签保持在 `<head>` 里。代价是微信内置浏览器首屏少一次流式优化。
 */
const HTML_LIMITED_BOT_UA_RE =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|MicroMessenger|WeChat/i;

const nextConfig: NextConfig = {
  transpilePackages: ["@shenicest/shared"],
  htmlLimitedBots: HTML_LIMITED_BOT_UA_RE,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
