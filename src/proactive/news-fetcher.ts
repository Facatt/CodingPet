export class NewsFetcher {
  private lastFetchTime: number = 0;
  private cachedNews: string[] = [];
  private fetchIntervalMs = 30 * 60 * 1000;

  private rssSources = [
    'https://hnrss.org/frontpage?count=5',
    'https://www.infoq.cn/public/v1/article/getList',
  ];

  async fetchNews(): Promise<string[]> {
    const now = Date.now();

    if (this.cachedNews.length > 0 && now - this.lastFetchTime < this.fetchIntervalMs) {
      return this.cachedNews;
    }

    try {
      const newsItems: string[] = [];

      try {
        const hnNews = await this.fetchHackerNews();
        newsItems.push(...hnNews);
      } catch (e) {
        console.error('[CodingPet] Failed to fetch HN news:', e);
      }

      if (newsItems.length === 0) {
        newsItems.push(...this.getFallbackNews());
      }

      this.cachedNews = newsItems.slice(0, 10);
      this.lastFetchTime = now;
      return this.cachedNews;
    } catch (error) {
      console.error('[CodingPet] News fetch error:', error);
      return this.getFallbackNews();
    }
  }

  private async fetchHackerNews(): Promise<string[]> {
    const fetch = require('node-fetch');
    const response = await fetch('https://hnrss.org/frontpage?count=8', {
      timeout: 10000,
    });

    if (!response.ok) {
      throw new Error(`HN RSS fetch failed: ${response.status}`);
    }

    const xml = await response.text();
    const items: string[] = [];

    const titleRegex = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/g;
    let match;
    while ((match = titleRegex.exec(xml)) !== null) {
      items.push(match[1]);
    }

    if (items.length === 0) {
      const simpleTitleRegex = /<item>[\s\S]*?<title>(.*?)<\/title>/g;
      while ((match = simpleTitleRegex.exec(xml)) !== null) {
        items.push(match[1]);
      }
    }

    return items;
  }

  private getFallbackNews(): string[] {
    const techFacts = [
      '\u4eca\u5929\u7684\u79d1\u6280\u5708\uff1aAI\u6280\u672f\u6301\u7eed\u5feb\u901f\u53d1\u5c55\uff0c\u5404\u5927\u516c\u53f8\u7eb7\u7eb7\u63a8\u51fa\u65b0\u7684AI\u4ea7\u54c1\u548c\u670d\u52a1',
      '\u7f16\u7a0b\u8bed\u8a00\u6392\u884c\u699c\u66f4\u65b0\uff1aPython\u3001JavaScript\u3001TypeScript \u4ecd\u5360\u636e\u524d\u5217',
      '\u5f00\u6e90\u793e\u533a\u52a8\u6001\uff1a\u66f4\u591a\u4f01\u4e1a\u5f00\u59cb\u62e5\u62b1\u5f00\u6e90\uff0c\u8d21\u732e\u56de\u9988\u793e\u533a',
      '\u4e91\u8ba1\u7b97\u5e02\u573a\u6301\u7eed\u589e\u957f\uff0c\u8fb9\u7f18\u8ba1\u7b97\u6210\u4e3a\u65b0\u8d8b\u52bf',
      'Web \u6280\u672f\u4e0d\u65ad\u6f14\u8fdb\uff0cWebAssembly \u5e94\u7528\u573a\u666f\u6301\u7eed\u6269\u5927',
    ];

    const shuffled = techFacts.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }

  async getFormattedNews(): Promise<string[]> {
    const news = await this.fetchNews();
    return news.map((item, index) => `${index + 1}. ${item}`);
  }
}
