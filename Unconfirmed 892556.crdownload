// Harbor manga source plugin for mangalik.net (WordPress + Madara theme).
// UNTESTED against the live site: selectors are Madara defaults.

const BASE = "https://mangalik.net";
// Items per listing page. If browsing skips or repeats items, change this to
// the real number of cards the site shows per page.
const PAGE_SIZE = 20;

async function getDoc(path) {
  const res = await harbor.http(BASE + path, { responseType: "text" });
  if (!res.ok) throw new Error("http " + res.status + " for " + path);
  return harbor.parseHtml(res.body);
}

function abs(url) {
  if (!url) return undefined;
  url = url.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return BASE + url;
  return BASE + "/" + url;
}

function imgUrl(img) {
  if (!img) return undefined;
  return abs(
    img.attr("data-src") || img.attr("data-lazy-src") || img.attr("data-cfsrc") || img.attr("src")
  );
}

// "https://mangalik.net/manga/gunman/" -> "gunman"
function slugFromHref(href) {
  const m = (href || "").match(/\/manga\/([^/?#]+)/);
  return m ? m[1] : "";
}

function cardToSummary(el) {
  const link = el.querySelector(".post-title a") || el.querySelector("h3 a") || el.querySelector("a");
  if (!link) return null;
  const id = slugFromHref(link.attr("href"));
  if (!id) return null;
  return {
    id,
    title: (link.text() || link.attr("title") || "").trim(),
    cover: imgUrl(el.querySelector("img")),
  };
}

const CARD_SELECTOR = ".page-item-detail, .c-tabs-item__content";

// Finds a "Status", "Author" ... row in Madara's info block by its heading text.
function field(doc, labels) {
  for (const item of doc.querySelectorAll(".post-content_item")) {
    const head = (item.querySelector(".summary-heading")?.text() || "").toLowerCase();
    if (labels.some((l) => head.includes(l))) {
      return item.querySelector(".summary-content")?.text()?.trim();
    }
  }
  return undefined;
}

function chapterFromAnchor(a) {
  const href = a.attr("href") || "";
  const path = href.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+|\/+$/g, "");
  if (!path) return null;
  const last = path.split("/").pop();
  const label = (a.text() || "").trim();
  const num = (label.match(/(\d+(?:\.\d+)?)/) || [])[1] || last;
  return {
    id: path, // e.g. "manga/gunman/52"
    chapter: num,
    title: label,
    volume: null,
    pages: 0,
    language: "ar",
  };
}

const plugin = {
  id: "mangalik",
  name: "Mangalik",

  async popular(offset, tagId) {
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    const path = tagId
      ? "/manga-genre/" + encodeURIComponent(tagId) + "/page/" + page + "/?m_orderby=views"
      : "/manga/page/" + page + "/?m_orderby=views";
    const doc = await getDoc(path);
    return doc.querySelectorAll(CARD_SELECTOR).map(cardToSummary).filter(Boolean);
  },

  async search(query, offset, tagId) {
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    const genre = tagId ? "&genre%5B%5D=" + encodeURIComponent(tagId) : "";
    const doc = await getDoc(
      "/page/" + page + "/?s=" + encodeURIComponent(query) + "&post_type=wp-manga" + genre
    );
    return doc.querySelectorAll(CARD_SELECTOR).map(cardToSummary).filter(Boolean);
  },

  async detail(id) {
    const doc = await getDoc("/manga/" + id + "/");
    const titleEl = doc.querySelector(".post-title h1") || doc.querySelector("h1");
    if (!titleEl) return null;
    // Madara puts badges like HOT / NEW inside the h1.
    const title = titleEl.text().replace(/\s*\b(HOT|NEW|END)\b\s*$/i, "").trim();
    return {
      id,
      title: title || id,
      altTitle: field(doc, ["alternative", "other name", "أسماء", "اسم"]),
      cover: imgUrl(doc.querySelector(".summary_image img")),
      description: (
        doc.querySelector(".summary__content") ||
        doc.querySelector(".description-summary") ||
        doc.querySelector(".manga-excerpt")
      )?.text()?.trim(),
      status: field(doc, ["status", "الحالة"]),
      author: field(doc, ["author", "المؤلف", "الكاتب"]),
      lastChapter: doc.querySelector("li.wp-manga-chapter a")?.text()?.trim(),
    };
  },

  async chapters(id) {
    let doc = await getDoc("/manga/" + id + "/");
    let anchors = doc.querySelectorAll("li.wp-manga-chapter > a");

    // Many Madara sites load the list over AJAX. Fall back to that endpoint.
    if (!anchors.length) {
      const res = await harbor.http(BASE + "/manga/" + id + "/ajax/chapters/", {
        method: "POST",
        responseType: "text",
      });
      if (res.ok) {
        doc = harbor.parseHtml(res.body);
        anchors = doc.querySelectorAll("li.wp-manga-chapter > a");
      }
    }

    return anchors.map(chapterFromAnchor).filter(Boolean);
  },

  async pageUrls(chapterId) {
    // style=list makes Madara render every page image in one go.
    const doc = await getDoc("/" + chapterId + "/?style=list");
    let imgs = doc.querySelectorAll(".reading-content img");
    if (!imgs.length) imgs = doc.querySelectorAll(".page-break img");
    return imgs.map(imgUrl).filter(Boolean);
  },

  // Optional genre filter (Madara: /manga-genre/<slug>/). Safe to fail.
  async tags() {
    try {
      const doc = await getDoc("/?s=&post_type=wp-manga");
      const out = [];
      for (const el of doc.querySelectorAll(".genres_wrap input[name='genre[]']")) {
        const slug = el.attr("value");
        const label = el.parent?.()?.text?.()?.trim();
        if (slug) out.push({ id: slug, name: label || slug, group: "Genre" });
      }
      return out;
    } catch (e) {
      return [];
    }
  },
};
