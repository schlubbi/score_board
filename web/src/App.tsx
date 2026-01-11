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

type TeamMatch = {
  id: string;
  homeTeamId: string;
  homeTeam: string;
  awayTeamId: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  note?: string;
  url: string;
};

type MatchStatus = 'played' | 'not_played';
type RecommendationGroup = {
  index: number;
  teams: TeamPower[];
};

type SimpleRecommendation = {
  generatedAt: string;
  totalTeams: number;
  groupCount: number;
  groups: RecommendationGroup[];
};

type View = 'overview' | 'groups' | 'recommendations' | 'indoor';

type Translation = {
  eyebrow: string;
  headline: string;
  lede: string;
  groupHeadline: string;
  groupLede: string;
  indoorHeadline: string;
  indoorLede: string;
  indoorTitle: string;
  indoorUpdated: string;
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
    loadingRecommendations: string;
    loadingMatches: string;
  };
  languageLabel: string;
  nav: {
    overview: string;
    groups: string;
    indoor: string;
    recommendations: string;
  };
  matches: {
    title: string;
    placeholder: string;
    empty: string;
    opponent: string;
    result: string;
    status: string;
    view: string;
    homeLabel: string;
    awayLabel: string;
  };
  recommendations: {
    title: string;
    subtitle: string;
    generated: string;
    groupLabel: (index: number) => string;
  };
};

const translations: Record<Locale, Translation> = {
  en: {
    eyebrow: 'Score Board MVP',
    headline: 'Power ranking across Kassel E-Jugend groups',
    lede:
      'Scrapes fussball.de standings, normalizes offense/defense/dominance per group, and compares every team across all groups.',
    groupHeadline: 'Group standings & match history',
    groupLede: 'Select a group to inspect the standings and click a team to view its match history.',
    indoorHeadline: 'Indoor pre-games power ranking',
    indoorLede:
      'Scrapes the Hallen-Kreisturnier pre-game groups (loaded behind expandable headers on fussball.de) and ranks all participating teams.',
    indoorTitle: 'Indoor ranking (all groups)',
    indoorUpdated: 'Updated',
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
      loadingRecommendations: 'Loading recommendations…',
      loadingMatches: 'Loading matches…',
    },
    languageLabel: 'Language',
    nav: {
      overview: 'Overall',
      groups: 'Groups',
      indoor: 'Indoor',
      recommendations: 'Recommendations',
    },
    matches: {
      title: 'Matches',
      placeholder: 'Select a team above to view its matches.',
      empty: 'No matches recorded yet.',
      opponent: 'Opponent',
      result: 'Result',
      status: 'Status',
      view: 'View match',
      homeLabel: 'Home',
      awayLabel: 'Away',
    },
    recommendations: {
      title: 'Suggested groups for next season',
      subtitle: 'Evenly distribute teams by current power ranking. First groups get any extras.',
      generated: 'Generated',
      groupLabel: (index: number) => `Group ${index}`,
    },
  },
  de: {
    eyebrow: 'Score Board MVP',
    headline: 'Power-Ranking über alle Kasseler E-Jugend-Gruppen',
    lede: 'Scraped die fussball.de-Tabellen, normalisiert Offense/Defense/Dominanz je Gruppe und vergleicht alle Teams.',
    groupHeadline: 'Gruppentabelle & Spielhistorie',
    groupLede: 'Wähle eine Gruppe und klicke ein Team an, um die Spiele zu sehen.',
    indoorHeadline: 'Indoor-Vorrunden Power-Ranking',
    indoorLede:
      'Scraped die Hallen-Kreisturnier-Vorrundengruppen (auf fussball.de hinter ausklappbaren Überschriften) und rankt alle Teams.',
    indoorTitle: 'Indoor-Ranking (alle Gruppen)',
    indoorUpdated: 'Stand',
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
      loadingRecommendations: 'Lade Empfehlungen…',
      loadingMatches: 'Lade Spiele…',
    },
    languageLabel: 'Sprache',
    nav: {
      overview: 'Gesamt',
      groups: 'Gruppen',
      indoor: 'Indoor',
      recommendations: 'Empfehlungen',
    },
    matches: {
      title: 'Spiele',
      empty: 'Noch keine Spiele erfasst.',
      placeholder: 'Wähle oben eine Mannschaft, um die Spiele zu sehen.',
      opponent: 'Gegner',
      result: 'Ergebnis',
      status: 'Status',
      view: 'Zum Spiel',
      homeLabel: 'Heim',
      awayLabel: 'Auswärts',
    },
    recommendations: {
      title: 'Gruppenvorschlag für die nächste Saison',
      subtitle: 'Teams werden nach aktuellem Power-Ranking gleichmäßig verteilt. Erste Gruppen erhalten den Überhang.',
      generated: 'Erstellt am',
      groupLabel: (index: number) => `Gruppe ${index}`,
    },
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
  const [indoorOverall, setIndoorOverall] = useState<OverallResponse | null>(null);
  const [recommendation, setRecommendation] = useState<SimpleRecommendation | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamPower | null>(null);
  const [teamMatches, setTeamMatches] = useState<TeamMatch[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [loadingOverall, setLoadingOverall] = useState(false);
  const [loadingIndoorOverall, setLoadingIndoorOverall] = useState(false);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [loadingTeamMatches, setLoadingTeamMatches] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('groups');

  const t = translations[locale];
  const headline =
    view === 'indoor' ? t.indoorHeadline : view === 'groups' ? t.groupHeadline : t.headline;
  const lede = view === 'indoor' ? t.indoorLede : view === 'groups' ? t.groupLede : t.lede;

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
    if (groupDetail && groupDetail.teams.length) {
      setSelectedTeam((current) => {
        if (current && groupDetail.teams.find((t) => t.team.teamId === current.team.teamId)) {
          return current;
        }
        return groupDetail.teams[0];
      });
    } else {
      setSelectedTeam(null);
      setTeamMatches([]);
    }
  }, [groupDetail]);

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

  useEffect(() => {
    const loadIndoorOverall = async () => {
      setLoadingIndoorOverall(true);
      try {
        const data = await fetchJSON<OverallResponse>(`${API_BASE}/indoor/overall`);
        setIndoorOverall(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingIndoorOverall(false);
      }
    };
    loadIndoorOverall();
  }, []);

  useEffect(() => {
    const loadRecommendations = async () => {
      setLoadingRecommendation(true);
      try {
        const data = await fetchJSON<SimpleRecommendation>(`${API_BASE}/recommendations/simple`);
        setRecommendation(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingRecommendation(false);
      }
    };
    loadRecommendations();
  }, []);

  useEffect(() => {
    const loadMatches = async () => {
      if (!selectedGroupId || !selectedTeam) {
        setTeamMatches([]);
        return;
      }
      setLoadingTeamMatches(true);
      try {
        const data = await fetchJSON<{ matches: TeamMatch[] }>(
          `${API_BASE}/groups/${selectedGroupId}/teams/${selectedTeam.team.teamId}/matches`
        );
        setTeamMatches(data.matches);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingTeamMatches(false);
      }
    };
    loadMatches();
  }, [selectedGroupId, selectedTeam]);

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
      fetchJSON<OverallResponse>(`${API_BASE}/indoor/overall`).then(setIndoorOverall).catch(() => undefined);
      fetchJSON<SimpleRecommendation>(`${API_BASE}/recommendations/simple`).then(setRecommendation);
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
        <table className="group-table">
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
              <tr
                key={entry.team.teamId}
                className={selectedTeam?.team.teamId === entry.team.teamId ? 'selected-row' : ''}
                onClick={() => setSelectedTeam(entry)}
              >
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

  const renderMatchesSection = () => {
    if (!selectedTeam) {
      return <p className="status">{t.matches.placeholder}</p>;
    }
    if (loadingTeamMatches) {
      return <p className="status">{t.states.loadingMatches}</p>;
    }
    if (!teamMatches.length) {
      return <p className="status">{t.matches.empty}</p>;
    }

    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.matches.opponent}</th>
              <th>{t.matches.result}</th>
              <th>{t.matches.status}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {teamMatches.map((match) => {
              const isHome = match.homeTeamId === selectedTeam.team.teamId;
              const opponent = isHome ? match.awayTeam : match.homeTeam;
              const result =
                match.status === 'played'
                  ? `${match.homeScore} : ${match.awayScore}`
                  : match.note ?? match.status;
              const statusLabel =
                match.status === 'played'
                  ? isHome
                    ? t.matches.homeLabel
                    : t.matches.awayLabel
                  : match.note ?? '—';

              return (
                <tr key={match.id}>
                  <td className="team-name">{opponent}</td>
                  <td>{result}</td>
                  <td>{statusLabel}</td>
                  <td>
                    <a href={match.url} target="_blank" rel="noreferrer">
                      {t.matches.view}
                    </a>
                  </td>
                </tr>
              );
            })}
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

  const renderIndoorOverallTable = () => {
    if (loadingIndoorOverall || !indoorOverall) {
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
            {indoorOverall.teams.map((entry, index) => (
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

  const renderRecommendation = () => {
    if (loadingRecommendation || !recommendation) {
      return <p className="status">{t.states.loadingRecommendations}</p>;
    }
    return (
      <div className="recommendations-grid">
        {recommendation.groups.map((group) => (
          <div key={group.index} className="recommendation-card">
            <div className="card-header">
              <h3>{t.recommendations.groupLabel(group.index)}</h3>
              <span>{group.teams.length} Teams</span>
            </div>
            <ol>
              {group.teams.map((entry) => (
                <li key={entry.team.teamId}>
                  <div>
                    <strong>{entry.team.teamName}</strong>
                    <span className="muted">{entry.team.groupName}</span>
                  </div>
                  <div className="muted small">
                    {t.overallTableColumns.power}: {formatNumber(entry.overallMetrics.powerScore)}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <div className="brand">
          <span className="logo-dot" />
          <span>Score Board</span>
        </div>
        <ul>
          <li className={view === 'overview' ? 'active' : ''}>
            <button onClick={() => setView('overview')}>{t.nav.overview}</button>
          </li>
          <li className={view === 'groups' ? 'active' : ''}>
            <button onClick={() => setView('groups')}>{t.nav.groups}</button>
          </li>
          <li className={view === 'indoor' ? 'active' : ''}>
            <button onClick={() => setView('indoor')}>{t.nav.indoor}</button>
          </li>
          <li className={view === 'recommendations' ? 'active' : ''}>
            <button onClick={() => setView('recommendations')}>{t.nav.recommendations}</button>
          </li>
        </ul>
        <div className="nav-actions">
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
        </div>
      </nav>

      <header className="page-header">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{headline}</h1>
          <p className="lede">{lede}</p>
        </div>
        {view === 'groups' && selectedSummary && (
          <span className="muted">
            {t.lastUpdated}: {formatDate(selectedSummary.lastUpdated, dateLocales[locale])}
          </span>
        )}
        {view === 'overview' && overall && (
          <span className="muted">
            {t.overallUpdated}: {formatDate(overall.updatedAt, dateLocales[locale])}
          </span>
        )}
        {view === 'indoor' && indoorOverall && (
          <span className="muted">
            {t.indoorUpdated}: {formatDate(indoorOverall.updatedAt, dateLocales[locale])}
          </span>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      {view === 'groups' && (
        <>
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
              <h2>
                {t.matches.title}
                {selectedTeam ? ` – ${selectedTeam.team.teamName}` : ''}
              </h2>
            </div>
            {renderMatchesSection()}
          </section>
        </>
      )}

      {view === 'overview' && (
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
      )}

      {view === 'indoor' && (
        <section>
          <div className="section-header">
            <h2>{t.indoorTitle}</h2>
            {indoorOverall && (
              <span className="muted">
                {t.indoorUpdated}: {formatDate(indoorOverall.updatedAt, dateLocales[locale])}
              </span>
            )}
          </div>
          {renderIndoorOverallTable()}
        </section>
      )}

      {view === 'recommendations' && (
        <section>
          <div className="section-header stacked">
            <div>
              <h2>{t.recommendations.title}</h2>
              <p className="muted">{t.recommendations.subtitle}</p>
            </div>
            {recommendation && (
              <span className="muted">
                {t.recommendations.generated}:{' '}
                {formatDate(recommendation.generatedAt, dateLocales[locale])}
              </span>
            )}
          </div>
          {renderRecommendation()}
        </section>
      )}
    </div>
  );
}

export default App;
