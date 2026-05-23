import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import "./App.css";

type Article = {
  id: string;
  source: "marca" | "as" | "ser" | "managing";
  sourceName: string;
  title: string;
  url: string;
  publishedAt?: string;
};

type ArticleContent = {
  title?: string;
  description?: string;
  content?: string;
};

type Translation = {
  text: string;
  detected_source_language: string;
};

const sourceLabels = { all: "All", marca: "Marca", as: "AS", ser: "SER", managing: "Managing Madrid" } as const;
type Filter = keyof typeof sourceLabels;
const telegramUrl = (import.meta.env.VITE_TELEGRAM_URL || import.meta.env.VITE_TELEGRAM_GROUP_URL) as string | undefined;
const PAGE_SIZE = 12;

function formatDate(value?: string) {
  if (!value) return "Latest";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Latest";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Batch translate texts via /api/translate */
async function translateTexts(texts: string[]): Promise<Record<string, Translation>> {
  const nonEmpty = texts.filter((t) => t.trim());
  if (nonEmpty.length === 0) return {};
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: nonEmpty, targetLang: "EN" }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Translation failed");
  const out: Record<string, Translation> = {};
  data.translations.forEach((t: Translation, i: number) => {
    out[nonEmpty[i]] = t;
  });
  return out;
}

/** Circular CSS spinner */
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 8)) }}
      aria-hidden="true"
    />
  );
}

function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string>("");
  const [contentById, setContentById] = useState<Record<string, ArticleContent>>({});
  const [contentLoadingId, setContentLoadingId] = useState<string>("");
  const [contentErrorById, setContentErrorById] = useState<Record<string, string>>({});

  /* ---- translation state ---- */
  const [showOriginalEs, setShowOriginalEs] = useState(false); // false = English (default), true = Spanish
  const [titleCache, setTitleCache] = useState<Record<string, Translation>>({});
  const [contentCache, setContentCache] = useState<Record<string, Translation>>({});
  const [translatingTitles, setTranslatingTitles] = useState(false);
  const [translatingContentId, setTranslatingContentId] = useState<string>("");
  const [translationError, setTranslationError] = useState("");

  async function loadArticles() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/articles");
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Failed to load");
      setArticles(data.articles);
      setCheckedAt(data.checkedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  /* translate all visible titles in one batch */
  async function translateAllTitles(arts: Article[]) {
    setTranslationError("");
    const toTranslate = arts
      .filter((a) => a.source !== "managing")
      .map((a) => a.title)
      .filter((t) => t && !titleCache[t]);
    if (toTranslate.length === 0) return;
    setTranslatingTitles(true);
    try {
      const res = await translateTexts(toTranslate);
      setTitleCache((prev) => ({ ...prev, ...res }));
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setTranslatingTitles(false);
    }
  }

  /* translate article body when expanded */
  async function translateContent(original: string | undefined, shouldTranslate = true) {
    if (!original || showOriginalEs || !shouldTranslate) return;
    if (contentCache[original]) return;
    setTranslationError("");
    setTranslatingContentId(expandedId);
    try {
      const res = await translateTexts([original]);
      setContentCache((prev) => ({ ...prev, ...res }));
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setTranslatingContentId("");
    }
  }

  const translateEnabled = !showOriginalEs;

  /* fetch article content */
  async function toggleArticle(article: Article) {
    if (expandedId === article.id) {
      setExpandedId("");
      return;
    }
    setExpandedId(article.id);
    if (contentById[article.id]) {
      if (translateEnabled) void translateContent(contentById[article.id]?.content, article.source !== "managing");
      return;
    }
    setContentLoadingId(article.id);
    setContentErrorById((current) => ({ ...current, [article.id]: "" }));
    try {
      const response = await fetch(`/api/article?url=${encodeURIComponent(article.url)}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Could not load article content");
      setContentById((current) => ({ ...current, [article.id]: data }));
      if (translateEnabled) void translateContent(data?.content, article.source !== "managing");
    } catch (err) {
      setContentErrorById((current) => ({
        ...current,
        [article.id]: err instanceof Error ? err.message : "Could not load article content",
      }));
    } finally {
      setContentLoadingId("");
    }
  }

  useEffect(() => {
    void loadArticles();
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? articles : articles.filter((a) => a.source === filter)),
    [articles, filter]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(currentPage, pageCount);
  const paginatedArticles = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  useEffect(() => {
    setCurrentPage(1);
    setExpandedId("");
  }, [filter]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  /* auto-translate only the titles visible on the current page */
  useEffect(() => {
    if (paginatedArticles.length > 0 && !showOriginalEs) void translateAllTitles(paginatedArticles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedArticles, showOriginalEs]);

  /* re-translate when switching back to EN */
  useEffect(() => {
    if (!showOriginalEs && expandedId && contentById[expandedId]?.content) {
      const article = articles.find((item) => item.id === expandedId);
      void translateContent(contentById[expandedId].content, article?.source !== "managing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOriginalEs]);

  const isTranslatingContent = Boolean(translatingContentId);

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">Real Madrid news radar</div>
        <h1>Madrid Radar</h1>
        <p>Real Madrid updates from Marca, AS Diario, Cadena SER, and Managing Madrid — translated, summarized, and posted when something new breaks.</p>

        <div className="actions">
          {telegramUrl && (
            <a className="primary-link" href={telegramUrl} target="_blank" rel="noreferrer">
              Follow Telegram alerts
            </a>
          )}
          <button
            className="icon-round refresh-btn"
            onClick={() => void loadArticles()}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw size={34} strokeWidth={3} />
          </button>
          <button
            className="icon-round lang-btn"
            onClick={() => setShowOriginalEs((v) => !v)}
            disabled={translatingTitles || isTranslatingContent}
            title={showOriginalEs ? "Switch to English" : "Switch to Spanish"}
            aria-label={showOriginalEs ? "Switch to English" : "Switch to Spanish"}
          >
            {showOriginalEs ? "🇬🇧" : "🇪🇸"}
          </button>
          <span className="status-pill">{checkedAt ? `Checked ${formatDate(checkedAt)}` : "Ready"}</span>
        </div>

        {loading && <p className="loading-hint">Loading articles…</p>}
        {translationError && <p className="error compact">{translationError}</p>}
      </section>

      <section className="panel">
        <div className="filters">
          {(Object.keys(sourceLabels) as Filter[]).map((key) => (
            <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>
              {sourceLabels[key]}
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="articles">
          {paginatedArticles.map((article) => {
            const isExpanded = expandedId === article.id;
            const loaded = contentById[article.id];
            const translatedTitle = article.source !== "managing" && !showOriginalEs && titleCache[article.title];
            const contentIsTranslating = isExpanded && translatingContentId === article.id;

            return (
              <article className={`card ${isExpanded ? "expanded" : ""}`} key={article.id}>
                <button className="card-main" onClick={() => void toggleArticle(article)} aria-expanded={isExpanded}>
                  <div className="card-topline">
                    <span>{article.sourceName}</span>
                    <span className="expand-pill" aria-hidden="true">
                      {isExpanded ? "Hide" : "Expand"} <span className="chevron">⌄</span>
                    </span>
                  </div>
                  <h2>{translatedTitle ? translatedTitle.text : article.title}</h2>
                  <time>{formatDate(article.publishedAt)}</time>
                </button>
                {isExpanded && (
                  <div className="article-body" lang={article.source === "managing" ? "en" : "es"} translate={article.source === "managing" ? "no" : "yes"}>
                    {contentLoadingId === article.id && <p>Loading article content…</p>}
                    {contentErrorById[article.id] && <p className="error compact">{contentErrorById[article.id]}</p>}
                    {contentIsTranslating && (
                      <div className="translate-loading">
                        <Spinner size={16} />
                        <span>Translating…</span>
                      </div>
                    )}
                    {(() => {
                      const original = loaded?.content;
                      if (!original) return null;
                      const translated = article.source !== "managing" && !showOriginalEs && contentCache[original];
                      if (translated) return <p>{translated.text}</p>;
                      if (!contentIsTranslating) return <p>{original}</p>;
                      return null;
                    })()}
                    {loaded && !loaded.content && (
                      <p>No extractable article text found. Open the source for the full article.</p>
                    )}
                    <a href={article.url} target="_blank" rel="noreferrer">
                      Open original →
                    </a>
                  </div>
                )}
              </article>
            );
          })}
          {!loading && filtered.length === 0 && <p className="empty">No articles found for this filter.</p>}
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="pagination" aria-label="Article pagination">
            <button
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {pageCount} · {filtered.length} articles
            </span>
            <button
              onClick={() => setCurrentPage((value) => Math.min(pageCount, value + 1))}
              disabled={page === pageCount}
            >
              Next
            </button>
          </div>
        )}
      </section>

      <footer className="footer-tip">
        <a href="https://ko-fi.com/igalbo" target="_blank" rel="noreferrer">
          If this helped you feel better, you can tip me on Ko-fi ☕
        </a>
      </footer>
    </main>
  );
}

export default App;
