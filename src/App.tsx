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

const sourceLabels = { all: 'All', marca: 'Marca', as: 'AS', ser: 'SER' } as const;
type Filter = keyof typeof sourceLabels;

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

  useEffect(() => {
    // The initial fetch intentionally syncs React state with the API response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          {filtered.map((article) => (
            <a className="card" href={article.url} target="_blank" rel="noreferrer" key={article.id}>
              <span>{article.sourceName}</span>
              <h2>{article.title}</h2>
              <time>{formatDate(article.publishedAt)}</time>
            </a>
          ))}
          {!loading && filtered.length === 0 && <p className="empty">No articles found for this filter.</p>}
        </div>
      </section>
    </main>
  );
}

export default App;
