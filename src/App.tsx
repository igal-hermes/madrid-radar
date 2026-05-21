import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Article = {
  id: string;
  source: "marca" | "as" | "ser";
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

const sourceLabels = { all: "All", marca: "Marca", as: "AS", ser: "SER" } as const;
type Filter = keyof typeof sourceLabels;
const telegramGroupUrl = import.meta.env.VITE_TELEGRAM_GROUP_URL as string | undefined;

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

function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string>("");
  const [contentById, setContentById] = useState<Record<string, ArticleContent>>({});
  const [contentLoadingId, setContentLoadingId] = useState<string>("");
  const [contentErrorById, setContentErrorById] = useState<Record<string, string>>({});

  /* ---- translation state ---- */
  const [translate, setTranslate] = useState(false); // true = show English
  const [titleCache, setTitleCache] = useState<Record<string, Translation>>({}); // original -> {text, lang}
  const [contentCache, setContentCache] = useState<Record<string, Translation>>({}); // original -> {text, lang}
  const [translatingTitles, setTranslatingTitles] = useState(false);
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
    const toTranslate = arts.map((a) => a.title).filter((t) => t && !titleCache[t]);
    if (toTranslate.length === 0) return;
    setTranslatingTitles(true);
    try {
      const res = await translateTexts(toTranslate);
      setTitleCache((prev) => ({ ...prev, ...res }));
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : "Translation failed");
      setTranslate(false);
    } finally {
      setTranslatingTitles(false);
    }
  }

  /* translate article body when expanded */
  async function translateContent(original: string | undefined) {
    if (!original || !translate) return;
    if (contentCache[original]) return;
    setTranslationError("");
    try {
      const res = await translateTexts([original]);
      setContentCache((prev) => ({ ...prev, ...res }));
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : "Translation failed");
    }
  }

  /* fetch article content */
  async function toggleArticle(article: Article) {
    if (expandedId === article.id) {
      setExpandedId("");
      return;
    }
    setExpandedId(article.id);
    if (contentById[article.id]) {
      // content already loaded, translate if needed
      if (translate) {
        void translateContent(contentById[article.id]?.content);
      }
      return;
    }
    setContentLoadingId(article.id);
    setContentErrorById((current) => ({ ...current, [article.id]: "" }));
    try {
      const response = await fetch(`/api/article?url=${encodeURIComponent(article.url)}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Could not load article content");
      setContentById((current) => ({ ...current, [article.id]: data }));
      if (translate) void translateContent(data?.content);
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

  /* when translate toggles ON, batch-translate all visible titles */
  useEffect(() => {
    if (translate && articles.length > 0) {
      void translateAllTitles(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translate]);

  const filtered = useMemo(
    () => (filter === "all" ? articles : articles.filter((a) => a.source === filter)),
    [articles, filter]
  );

  /* re-translate when filter changes and show original articles counts */
  useEffect(() => {
    if (translate) void translateAllTitles(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">Spanish sources · Telegram alerts</div>
        <h1>Madrid Radar</h1>
        <p>Real Madrid updates from Marca, AS Diario, and Cadena SER. Built to stay quiet until something new appears.</p>
        <div className="actions">
          {telegramGroupUrl && (
            <a className="primary-link" href={telegramGroupUrl} target="_blank" rel="noreferrer">
              Join Telegram alerts
            </a>
          )}
          <button onClick={() => void loadArticles()} disabled={loading}>
            {loading ? "Checking…" : "Refresh"}
          </button>
          <button
            className={`lang-toggle ${translate ? "active" : ""}`}
            onClick={() => setTranslate((v) => !v)}
            disabled={translatingTitles}
            title={translate ? "Show original Spanish" : "Translate to English"}
          >
            {translatingTitles ? "Translating…" : translate ? "🇪🇸 Español" : "🇬🇧 English"}
          </button>
          <span>{checkedAt ? `Checked ${formatDate(checkedAt)}` : "Ready"}</span>
        </div>
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
          {filtered.map((article) => {
            const isExpanded = expandedId === article.id;
            const loaded = contentById[article.id];
            const translatedTitle = translate && titleCache[article.title];
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
                  {translatedTitle && <span className="translated-badge">Translated from Spanish</span>}
                  <time>{formatDate(article.publishedAt)}</time>
                </button>
                {isExpanded && (
                  <div className="article-body" lang="es" translate="yes">
                    {contentLoadingId === article.id && <p>Loading article content…</p>}
                    {contentErrorById[article.id] && <p className="error compact">{contentErrorById[article.id]}</p>}
                    {(() => {
                      const original = loaded?.content;
                      const translated = original && contentCache[original];
                      if (translated) {
                        return (
                          <>
                            <p>{translated.text}</p>
                            <p className="translated-badge inline">Translated from Spanish</p>
                          </>
                        );
                      }
                      if (original) return <p>{original}</p>;
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
