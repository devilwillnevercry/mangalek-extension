// Harbor manga source plugin: Mangalik / مانجا ليك (mangalik.net)
// Madara WordPress theme. Built on the pattern of a working Madara plugin.
// Selectors are Madara defaults and are NOT yet verified on the live site.
// NOTE: if mangalik.net uses a JavaScript bot check, no plugin can pass it.

const BASE = "https://mangalik.net";
// Items per listing page. If browsing skips or repeats items, change this.
const PAGE_SIZE = 21;

// Browser-like headers so the site sees a normal visitor.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.8,en;q=0.6",
  "Referer": BASE + "/",
};

async function getDoc(path) {
  let res;
  try {
    res = await harbor.http(BASE + path, { responseType: "text", headers: HEADERS });
  } catch (e) {
    // Some builds reject custom headers: retry plain.
    res = await harbor.http(BASE + path, { responseType: "text" });
  }
  if (!res.ok) throw new Error("http " + res.status + " for " + path);
  return harbor.parseHtml(res.body);
}

// POST helper. Different harbor.http builds accept different option shapes,
// so try each until one returns a body.
async function postDoc(path, body) {
  const url = BASE + path;
  const shapes = [
    {
      method: "POST",
      body: body,
      responseType: "text",
      headers: Object.assign({}, HEADERS, {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": BASE,
      }),
    },
    { method: "POST", body: body, responseType: "text" },
    { method: "POST", data: body, responseType: "text" },
    { method: "post", body: body, responseType: "text" },
  ];
  let lastErr;
  for (const opts of shapes) {
    try {
      const res = await harbor.http(url, opts);
      if (res && res.ok && res.body) return harbor.parseHtml(res.body);
      lastErr = new Error("http " + (res && res.status) + " for " + path);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("POST failed for " + path);
}

function abs(url) {
  if (!url) return undefined;
  url = url.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return BASE + url;
  return BASE + "/" + url;
}

// ".../manga/gunman/" -> "gunman"
function seriesIdFromHref(href) {
  const m = (href || "").match(/\/manga\/([^/?#]+)/);
  return m ? m[1] : null;
}

// ".../manga/gunman/52/" -> "gunman/52"
function chapterIdFromHref(href) {
  const m = (href || "").match(/\/manga\/([^/?#]+\/[^/?#]+)/);
  return m ? m[1] : null;
}

function coverFrom(img) {
  if (!img) return undefined;
  return abs(
    img.attr("data-src") || img.attr("data-lazy-src") || img.attr("data-cfsrc") || img.attr("src")
  );
}

// Cards can have an external team-badge link before the manga link,
// so only accept anchors whose href contains /manga/.
function cardToSummary(el) {
  const a =
    el.querySelector('.post-title a[href*="/manga/"]') ||
    el.querySelector('a[href*="/manga/"]');
  if (!a) return null;
  const id = seriesIdFromHref(a.attr("href"));
  if (!id) return null;
  return {
    id,
    title: (a.text() || a.attr("title") || "").trim() || id,
    cover: coverFrom(el.querySelector(".item-thumb img") || el.querySelector("img")),
  };
}

const plugin = {
  id: "mangalik",
  name: "Mangalik",
  version: "1.0.2",

  async popular(offset, tagId) {
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    let path;
    if (tagId) {
      path = "/manga-genre/" + tagId + (page > 1 ? "/page/" + page + "/" : "/");
    } else {
      path =
        (page > 1 ? "/manga/page/" + page + "/" : "/manga/") + "?m_orderby=latest";
    }
    const doc = await getDoc(path);
    return doc.querySelectorAll(".page-item-detail").map(cardToSummary).filter(Boolean);
  },

  async search(query, offset, tagId) {
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    const path =
      (page > 1 ? "/page/" + page + "/" : "/") +
      "?s=" +
      encodeURIComponent(query) +
      "&post_type=wp-manga";
    const doc = await getDoc(path);
    return doc
      .querySelectorAll(".c-tabs-item__content")
      .map((el) => {
        const a =
          el.querySelector('.post-title a[href*="/manga/"]') ||
          el.querySelector('.tab-thumb a[href*="/manga/"]') ||
          el.querySelector('a[href*="/manga/"]');
        if (!a) return null;
        const id = seriesIdFromHref(a.attr("href"));
        if (!id) return null;
        return {
          id,
          title: (a.text() || a.attr("title") || "").trim() || id,
          cover: coverFrom(el.querySelector("img")),
        };
      })
      .filter(Boolean);
  },

  async detail(id) {
    const doc = await getDoc("/manga/" + id + "/");

    let title = id;
    const h1 = doc.querySelector(".post-title h1");
    if (h1) {
      const badge = h1.querySelector("span");
      if (badge) badge.remove?.();
      title = (h1.text() || "").replace(/\s*\b(HOT|NEW|END)\b\s*$/i, "").trim() || id;
    }

    const row = (labels) => {
      let out;
      doc.querySelectorAll(".post-content_item").forEach((r) => {
        if (out) return;
        const h = r.querySelector(".summary-heading");
        const c = r.querySelector(".summary-content");
        if (!h || !c) return;
        const head = (h.text() || "").toLowerCase();
        if (labels.some((l) => head.includes(l))) out = c.text()?.trim();
      });
      return out;
    };

    const desc =
      doc.querySelector(".description-summary .summary__content")?.text() ||
      doc.querySelector(".summary__content")?.text() ||
      doc.querySelector(".manga-excerpt")?.text();

    return {
      id,
      title,
      altTitle: row(["alternative", "اسماء", "أسماء", "اسم"]),
      cover: coverFrom(doc.querySelector(".summary_image img")),
      description: desc?.trim(),
      status: row(["status", "الحالة"]),
      author: row(["author", "الكاتب", "المؤلف"]),
    };
  },

  async chapters(id) {
    const parseChapters = (doc) =>
      doc
        .querySelectorAll("li.wp-manga-chapter")
        .map((li) => {
          const a = li.querySelector("a");
          if (!a) return null;
          const chapId = chapterIdFromHref(a.attr("href"));
          if (!chapId) return null;
          const raw = (a.text() || "").trim();
          const numMatch = raw.match(/(\d+(?:\.\d+)?)/);
          const absDate = li.querySelector(".chapter-release-date a");
          const rel = li.querySelector(".chapter-release-date");
          const date = absDate?.attr("title")?.trim() || rel?.text()?.trim() || undefined;
          return {
            id: chapId,
            chapter: numMatch ? numMatch[1] : raw,
            title: raw,
            volume: null,
            pages: 0,
            language: "ar",
            publishAt: date,
          };
        })
        .filter(Boolean);

    // 1) Modern Madara: POST to the series ajax sub-path.
    try {
      const doc = await postDoc("/manga/" + id + "/ajax/chapters/", "");
      const ch = parseChapters(doc);
      if (ch.length) return ch;
    } catch (e) {
      /* fall through */
    }

    // 2) Older Madara: admin-ajax with the numeric post id from the page.
    try {
      const page = await getDoc("/manga/" + id + "/");
      const dataId =
        page.querySelector(".rating-post-id")?.attr("value") ||
        page.querySelector("#manga-chapters-holder")?.attr("data-id") ||
        page.querySelector("input.rating-post-id")?.attr("value");
      if (dataId) {
        const body = "action=manga_get_chapters&manga=" + encodeURIComponent(dataId);
        const doc = await postDoc("/wp-admin/admin-ajax.php", body);
        const ch = parseChapters(doc);
        if (ch.length) return ch;
      }
    } catch (e) {
      /* fall through */
    }

    // 3) Chapters already inline in the page.
    const doc = await getDoc("/manga/" + id + "/");
    return parseChapters(doc);
  },

  // chapterId is "slug/number".
  async pageUrls(chapterId) {
    const grab = (doc) => {
      let imgs = doc.querySelectorAll(".reading-content img");
      if (!imgs.length) imgs = doc.querySelectorAll(".page-break img");
      return imgs
        .map((img) =>
          abs(img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src"))
        )
        .filter(Boolean);
    };
    let urls = grab(await getDoc("/manga/" + chapterId + "/"));
    if (!urls.length) urls = grab(await getDoc("/manga/" + chapterId + "/?style=list"));
    return urls;
  },

  async tags() {
    try {
      const doc = await getDoc("/?s=&post_type=wp-manga");
      const seen = {};
      doc.querySelectorAll('a[href*="manga-genre"]').forEach((a) => {
        const href = a.attr("href") || "";
        const slug = href.split("/manga-genre/")[1]?.replace(/\/.*$/, "");
        const name = (a.text() || "").trim();
        if (slug && name && !/%/.test(slug) && !seen[slug]) seen[slug] = name;
      });
      return Object.keys(seen).map((slug) => ({ id: slug, name: seen[slug], group: "التصنيف" }));
    } catch (e) {
      return [];
    }
  },
};

return plugin;
