import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = '/api';
const LOCALE_STORAGE_KEY = 'score-board-locale';
const LOCALES = ['en', 'de'] as const;
type Locale = (typeof LOCALES)[number];
const localeNames: Record<Locale, string> = { en: 'English', de: 'Deutsch' };
const dateLocales: Record<Locale, string> = { en: 'en-US', de: 'de-DE' };

type GroupSummary = {
  id: string;
  name: string;
  staffelId: string;
  lastUpdated: string;
  teamCount: number;
};

type NormalizedSet = {
  offense: number;
  defense: number;
  dominance: number;
};

type MetricSet = {
  offense: number;
  defense: number;
  dominance: number;
  normalized: NormalizedSet;
  powerScore: number;
};

type TeamStats = {
  groupId: string;
  groupName: string;
  teamId: string;
  teamName: string;
  rank: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

type TeamPower = {
  team: TeamStats;
  groupMetrics: MetricSet;
  overallMetrics: MetricSet;
};

type GroupDetail = {
  group: GroupSummary;
  teams: TeamPower[];
};

type OverallResponse = {
  updatedAt: string;
  teams: TeamPower[];
};

type Translation = {
  eyebrow: string;
  headline: string;
  lede: string;
  refresh: string;
  refreshing: string;
  lastUpdated: string;
  groupTableTitle: string;
  showGroup: string;
  teamsLabel: string;
  groupTableColumns: {
    rank: string;
    team: string;
    games: string;
    ratio: string;
    points: string;
    offense: string;
    defense: string;
    dominance: string;
    powerGroup: string;
    powerOverall: string;
  };
  overallTitle: string;
  overallUpdated: string;
  overallTableColumns: {
    position: string;
    team: string;
    group: string;
    games: string;
    ratio: string;
    points: string;
    power: string;
    offense: string;
    defense: string;
    dominance: string;
  };
  states: {
    loadingGroup: string;
    noGroup: string;
    loadingOverall: string;
  };
  languageLabel: string;
};

const translations: Record<Locale, Translation> = {
  en: {
    eyebrow: 'Score Board MVP',
    headline: 'Power ranking across Kassel E-Jugend groups',
    lede:
      'Scrapes fussball.de standings, normalizes offense/defense/dominance per group, and compares every team across all groups.',
    refresh: 'Refresh scores',
    refreshing: 'Refreshing…',
    lastUpdated: 'Last updated',
    groupTableTitle: 'Group table',
    showGroup: 'Show group',
    teamsLabel: 'Teams',
    groupTableColumns: {
      rank: 'Rank',
      team: 'Team',
      games: 'Games',
      ratio: 'GF:GA',
      points: 'Points',
      offense: 'Off (grp)',
      defense: 'Def (grp)',
      dominance: 'Dom (grp)',
      powerGroup: 'Power (grp)',
      powerOverall: 'Power (overall)',
    },
    overallTitle: 'Overall ranking',
    overallUpdated: 'Updated',
    overallTableColumns: {
      position: '#',
      team: 'Team',
      group: 'Group',
      games: 'Games',
      ratio: 'GF:GA',
      points: 'Points',
      power: 'Power',
      offense: 'Off',
      defense: 'Def',
      dominance: 'Dom',
    },
    states: {
      loadingGroup: 'Loading group data…',
      noGroup: 'Select a group to view scores.',
      loadingOverall: 'Loading overall rankings…',
    },
    languageLabel: 'Language',
  },
  de: {
    eyebrow: 'Score Board MVP',
    headline: 'Power-Ranking über alle Kasseler E-Jugend-Gruppen',
    lede: 'Scraped die fussball.de-Tabellen, normalisiert Offense/Defense/Dominanz je Gruppe und vergleicht alle Teams.',
    refresh: 'Ergebnisse aktualisieren',
    refreshing: 'Aktualisiere…',
    lastUpdated: 'Zuletzt aktualisiert',
    groupTableTitle: 'Gruppentabelle',
    showGroup: 'Gruppe anzeigen',
    teamsLabel: 'Teams',
    groupTableColumns: {
      rank: 'Platz',
      team: 'Team',
      games: 'Spiele',
      ratio: 'Tore',
      points: 'Punkte',
      offense: 'Off (Grp)',
      defense: 'Def (Grp)',
      dominance: 'Dom (Grp)',
      powerGroup: 'Power (Grp)',
      powerOverall: 'Power (gesamt)',
    },
    overallTitle: 'Gesamtranking',
    overallUpdated: 'Stand',
    overallTableColumns: {
      position: '#',
      team: 'Team',
      group: 'Gruppe',
      games: 'Spiele',
      ratio: 'Tore',
      points: 'Punkte',
      power: 'Power',
      offense: 'Off',
      defense: 'Def',
      dominance: 'Dom',
    },
    states: {
      loadingGroup: 'Lade Gruppendaten…',
      noGroup: 'Wähle eine Gruppe, um Ergebnisse zu sehen.',
      loadingOverall: 'Lade Gesamtranking…',
    },
    languageLabel: 'Sprache',
  },
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || res.statusText);
  }
  return res.json();
}

const formatNumber = (value: number, digits = 3) => value.toFixed(digits);

const formatDate = (value?: string, locale: string = 'en-US') => {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString(locale);
};

const detectInitialLocale = (): Locale => {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'de' || stored === 'en') {
      return stored;
    }
    const nav = window.navigator.language.toLowerCase();
    if (nav.startsWith('de')) {
      return 'de';
    }
  }
  return 'en';
};

function App() {
  const [locale, setLocale] = useState<Locale>(() => detectInitialLocale());
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [overall, setOverall] = useState<OverallResponse | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [loadingOverall, setLoadingOverall] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = translations[locale];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const data = await fetchJSON<{ groups: GroupSummary[] }>(`${API_BASE}/groups`);
        setGroups(data.groups);
        if (data.groups.length) {
          setSelectedGroupId((current) => current || data.groups[0].id);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    };
    loadGroups();
  }, []);

  useEffect(() => {
    const loadGroupDetail = async () => {
      if (!selectedGroupId) return;
      setLoadingGroup(true);
      try {
        const data = await fetchJSON<GroupDetail>(`${API_BASE}/groups/${selectedGroupId}`);
        setGroupDetail(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingGroup(false);
      }
    };
    loadGroupDetail();
  }, [selectedGroupId]);

  useEffect(() => {
    const loadOverall = async () => {
      setLoadingOverall(true);
      try {
        const data = await fetchJSON<OverallResponse>(`${API_BASE}/overall`);
        setOverall(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingOverall(false);
      }
    };
    loadOverall();
  }, []);

  const selectedSummary = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchJSON(`${API_BASE}/refresh`, { method: 'POST' });
      const [groupsData, overallData, groupData] = await Promise.all([
        fetchJSON<{ groups: GroupSummary[] }>(`${API_BASE}/groups`),
        fetchJSON<OverallResponse>(`${API_BASE}/overall`),
        selectedGroupId ? fetchJSON<GroupDetail>(`${API_BASE}/groups/${selectedGroupId}`) : Promise.resolve(groupDetail),
      ]);
      setGroups(groupsData.groups);
      setOverall(overallData);
      if (groupData) {
        setGroupDetail(groupData);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const renderGroupTable = () => {
    if (loadingGroup) {
      return <p className="status">{t.states.loadingGroup}</p>;
    }
    if (!groupDetail) {
      return <p className="status">{t.states.noGroup}</p>;
    }

    const columns = t.groupTableColumns;

    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{columns.rank}</th>
              <th>{columns.team}</th>
              <th>{columns.games}</th>
              <th>{columns.ratio}</th>
              <th>{columns.points}</th>
              <th>{columns.offense}</th>
              <th>{columns.defense}</th>
              <th>{columns.dominance}</th>
              <th>{columns.powerGroup}</th>
              <th>{columns.powerOverall}</th>
            </tr>
          </thead>
          <tbody>
            {groupDetail.teams.map((entry) => (
              <tr key={entry.team.teamId}>
                <td>{entry.team.rank || '—'}</td>
                <td className="team-name">{entry.team.teamName}</td>
                <td>{entry.team.games}</td>
                <td>
                  {entry.team.goalsFor} : {entry.team.goalsAgainst}
                </td>
                <td>{entry.team.points}</td>
                <td>{formatNumber(entry.groupMetrics.offense)}</td>
                <td>{formatNumber(entry.groupMetrics.defense)}</td>
                <td>{formatNumber(entry.groupMetrics.dominance)}</td>
                <td>{formatNumber(entry.groupMetrics.powerScore)}</td>
                <td>{formatNumber(entry.overallMetrics.powerScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderOverallTable = () => {
    if (loadingOverall || !overall) {
      return <p className="status">{t.states.loadingOverall}</p>;
    }

    const columns = t.overallTableColumns;

    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{columns.position}</th>
              <th>{columns.team}</th>
              <th>{columns.group}</th>
              <th>{columns.games}</th>
              <th>{columns.ratio}</th>
              <th>{columns.points}</th>
              <th>{columns.power}</th>
              <th>{columns.offense}</th>
              <th>{columns.defense}</th>
              <th>{columns.dominance}</th>
            </tr>
          </thead>
          <tbody>
            {overall.teams.map((entry, index) => (
              <tr key={entry.team.teamId}>
                <td>{index + 1}</td>
                <td className="team-name">{entry.team.teamName}</td>
                <td>{entry.team.groupName}</td>
                <td>{entry.team.games}</td>
                <td>
                  {entry.team.goalsFor} : {entry.team.goalsAgainst}
                </td>
                <td>{entry.team.points}</td>
                <td>{formatNumber(entry.overallMetrics.powerScore)}</td>
                <td>{formatNumber(entry.overallMetrics.offense)}</td>
                <td>{formatNumber(entry.overallMetrics.defense)}</td>
                <td>{formatNumber(entry.overallMetrics.dominance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <header>
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.headline}</h1>
          <p className="lede">{t.lede}</p>
        </div>
        <div className="actions">
          <div className="language-picker">
            <label>
              {t.languageLabel}
              <select value={locale} onChange={(evt) => setLocale(evt.target.value as Locale)}>
                {LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {localeNames[code]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? t.refreshing : t.refresh}
          </button>
          {selectedSummary && (
            <span className="muted">
              {t.lastUpdated}: {formatDate(selectedSummary.lastUpdated, dateLocales[locale])}
            </span>
          )}
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section>
        <div className="section-header">
          <h2>{t.groupTableTitle}</h2>
          <div className="group-controls">
            <label>
              {t.showGroup}
              <select value={selectedGroupId} onChange={(evt) => setSelectedGroupId(evt.target.value)}>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedSummary && (
              <span className="muted">
                {t.teamsLabel}: {selectedSummary.teamCount}
              </span>
            )}
          </div>
        </div>
        {renderGroupTable()}
      </section>

      <section>
        <div className="section-header">
          <h2>{t.overallTitle}</h2>
          {overall && (
            <span className="muted">
              {t.overallUpdated}: {formatDate(overall.updatedAt, dateLocales[locale])}
            </span>
          )}
        </div>
        {renderOverallTable()}
      </section>
    </div>
  );
}

export default App;
