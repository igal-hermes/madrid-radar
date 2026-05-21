import { useEffect, useMemo, useState } from 'react';
import './App.css';

type Article = {
  id: string;
  source: 'marca' | 'as' | 'ser';
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

const sourceLabels = { all: 'All', marca: 'Marca', as: 'AS', ser: 'SER' } as const;
type Filter = keyof typeof sourceLabels;
const telegramGroupUrl = import.meta.env.VITE_TELEGRAM_GROUP_URL as string | undefined;

function formatDate(value?: string) {
  if (!value) return 'Latest';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Latest';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string>('');
  const [contentById, setContentById] = useState<Record<string, ArticleContent>>({});
  const [contentLoadingId, setContentLoadingId] = useState<string>('');
  const [contentErrorById, setContentErrorById] = useState<Record<string, string>>({});

  async function loadArticles() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/articles');
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Failed to load');
      setArticles(data.articles);
      setCheckedAt(data.checkedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function toggleArticle(article: Article) {
    if (expandedId === article.id) {
      setExpandedId('');
      return;
    }
    setExpandedId(article.id);
    if (contentById[article.id]) return;
    setContentLoadingId(article.id);
    setContentErrorById((current) => ({ ...current, [article.id]: '' }));
    try {
      const response = await fetch(`/api/article?url=${encodeURIComponent(article.url)}`);
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'Could not load article content');
      setContentById((current) => ({ ...current, [article.id]: data }));
    } catch (err) {
      setContentErrorById((current) => ({
        ...current,
        [article.id]: err instanceof Error ? err.message : 'Could not load article content',
      }));
    } finally {
      setContentLoadingId('');
    }
  }

  useEffect(() => {
    void loadArticles();
  }, []);

  const filtered = useMemo(() => filter === 'all' ? articles : articles.filter((a) => a.source === filter), [articles, filter]);

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
          <button onClick={() => void loadArticles()} disabled={loading}>{loading ? 'Checking…' : 'Refresh'}</button>
          <span>{checkedAt ? `Checked ${formatDate(checkedAt)}` : 'Ready'}</span>
        </div>
      </section>

      <section className="panel">
        <div className="filters">
          {(Object.keys(sourceLabels) as Filter[]).map((key) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{sourceLabels[key]}</button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="articles">
          {filtered.map((article) => {
            const isExpanded = expandedId === article.id;
            const loaded = contentById[article.id];
            return (
              <article className={`card ${isExpanded ? 'expanded' : ''}`} key={article.id}>
                <button className="card-main" onClick={() => void toggleArticle(article)} aria-expanded={isExpanded}>
                  <div className="card-topline">
                    <span>{article.sourceName}</span>
                    <span className="expand-pill" aria-hidden="true">
                      {isExpanded ? 'Hide' : 'Expand'} <span className="chevron">⌄</span>
                    </span>
                  </div>
                  <h2>{article.title}</h2>
                  <time>{formatDate(article.publishedAt)}</time>
                </button>
                {isExpanded && (
                  <div className="article-body" lang="es" translate="yes">
                    {contentLoadingId === article.id && <p>Loading article content…</p>}
                    {contentErrorById[article.id] && <p className="error compact">{contentErrorById[article.id]}</p>}
                    {loaded?.content && <p>{loaded.content}</p>}
                    {loaded && !loaded.content && <p>No extractable article text found. Open the source for the full article.</p>}
                    <a href={article.url} target="_blank" rel="noreferrer">Open original →</a>
                  </div>
                )}
              </article>
            );
          })}
          {!loading && filtered.length === 0 && <p className="empty">No articles found for this filter.</p>}
        </div>
      </section>
    </main>
  );
}

export default App;
