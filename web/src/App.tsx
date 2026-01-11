import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? '/api' : '/data');
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

type EloEntry = {
  team: TeamStats;
  elo: number;
  games: number;
};

type EloResponse = {
  updatedAt: string;
  teams: EloEntry[];
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

type View = 'overview' | 'groups' | 'compare' | 'recommendations' | 'indoor';

type Translation = {
  eyebrow: string;
  headline: string;
  lede: string;
  groupHeadline: string;
  groupLede: string;
  compareHeadline: string;
  compareLede: string;
  compareTitle: string;
  compareUpdated: string;
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
    compare: string;
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
  algorithms: {
    title: string;
    overall: string[];
    compare: string[];
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
    compareHeadline: 'Compare ranking approaches',
    compareLede: 'Side-by-side comparison of the current normalized power score and an Elo rating computed from match results.',
    compareTitle: 'Overall comparison',
    compareUpdated: 'Updated',
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
      compare: 'Compare',
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
    algorithms: {
      title: 'Algorithm',
      overall: [
        'PowerScore is based on three per-match metrics: offense (goals for / games), defense (1 - goals against / games), dominance ((goals for - goals against) / games).',
        'Each metric is normalized to 0..1 across all teams (overall), then combined: 0.4 * offense + 0.3 * defense + 0.3 * dominance.',
        'Sorting: PowerScore desc, then goal difference, points, goals for.',
      ],
      compare: [
        'Elo starts every team at 1500 and updates after each played match using expected result (rating diff) and actual result (win=1, draw=0.5, loss=0).',
        'We use K=20 and a small goal-difference multiplier (capped) so bigger wins move ratings slightly more.',
        'Teams with 0 Elo games (or “zg.”) are marked inactive and listed at the bottom.',
      ],
    },
  },
  de: {
    eyebrow: 'Score Board MVP',
    headline: 'Power-Ranking über alle Kasseler E-Jugend-Gruppen',
    lede: 'Scraped die fussball.de-Tabellen, normalisiert Offense/Defense/Dominanz je Gruppe und vergleicht alle Teams.',
    groupHeadline: 'Gruppentabelle & Spielhistorie',
    groupLede: 'Wähle eine Gruppe und klicke ein Team an, um die Spiele zu sehen.',
    compareHeadline: 'Ranking-Ansätze vergleichen',
    compareLede: 'Vergleich des aktuellen normalisierten Power-Scores mit einem Elo-Rating, berechnet aus den Spielergebnissen.',
    compareTitle: 'Gesamtvergleich',
    compareUpdated: 'Stand',
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
      compare: 'Vergleich',
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
    algorithms: {
      title: 'Algorithmus',
      overall: [
        'Der PowerScore basiert auf drei Kennzahlen pro Spiel: Offense (Tore / Spiele), Defense (1 - Gegentore / Spiele), Dominanz ((Tore - Gegentore) / Spiele).',
        'Jede Kennzahl wird über alle Teams auf 0..1 normalisiert und dann kombiniert: 0,4 * Offense + 0,3 * Defense + 0,3 * Dominanz.',
        'Sortierung: PowerScore absteigend, dann Tordifferenz, Punkte, erzielte Tore.',
      ],
      compare: [
        'Elo startet jedes Team bei 1500 und wird nach jedem gespielten Spiel aktualisiert (Erwartungswert aus Rating-Differenz; Ergebnis: Sieg=1, Remis=0,5, Niederlage=0).',
        'Wir verwenden K=20 und einen kleinen Tordifferenz-Faktor (gedeckelt), damit klare Siege das Rating etwas stärker bewegen.',
        'Teams ohne Elo-Spiele (oder „zg.“) werden als inaktiv markiert und am Ende gelistet.',
      ],
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

type SortDir = 'asc' | 'desc';
type SortState<K extends string> = {
  key: K;
  dir: SortDir;
};

type SortableValue = string | number | null | undefined;

const toggleSort = <K extends string>(current: SortState<K> | null, key: K): SortState<K> => {
  if (!current || current.key !== key) {
    return { key, dir: 'desc' };
  }
  return { key, dir: current.dir === 'desc' ? 'asc' : 'desc' };
};

const compareValues = (a: SortableValue, b: SortableValue, dir: SortDir) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const mul = dir === 'asc' ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') {
    return mul * (a - b);
  }
  return mul * String(a).localeCompare(String(b));
};

type GroupSortKey =
  | 'default'
  | 'rank'
  | 'team'
  | 'games'
  | 'ratio'
  | 'points'
  | 'offense'
  | 'defense'
  | 'dominance'
  | 'powerGroup'
  | 'powerOverall';

type MatchSortKey = 'default' | 'opponent' | 'result' | 'status';
type OverallSortKey =
  | 'default'
  | 'team'
  | 'group'
  | 'games'
  | 'ratio'
  | 'points'
  | 'power'
  | 'offense'
  | 'defense'
  | 'dominance';

type CompareSortKey = 'default' | 'team' | 'group' | 'elo' | 'games' | 'power' | 'delta';

function App() {
  const [locale, setLocale] = useState<Locale>(() => detectInitialLocale());
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [overall, setOverall] = useState<OverallResponse | null>(null);
  const [indoorOverall, setIndoorOverall] = useState<OverallResponse | null>(null);
  const [eloOverall, setEloOverall] = useState<EloResponse | null>(null);
  const [recommendation, setRecommendation] = useState<SimpleRecommendation | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamPower | null>(null);
  const [teamMatches, setTeamMatches] = useState<TeamMatch[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [loadingOverall, setLoadingOverall] = useState(false);
  const [loadingIndoorOverall, setLoadingIndoorOverall] = useState(false);
  const [loadingEloOverall, setLoadingEloOverall] = useState(false);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [loadingTeamMatches, setLoadingTeamMatches] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('groups');

  const [groupSort, setGroupSort] = useState<SortState<GroupSortKey> | null>(null);
  const [matchSort, setMatchSort] = useState<SortState<MatchSortKey> | null>(null);
  const [overallSort, setOverallSort] = useState<SortState<OverallSortKey> | null>(null);
  const [indoorSort, setIndoorSort] = useState<SortState<OverallSortKey> | null>(null);
  const [compareSort, setCompareSort] = useState<SortState<CompareSortKey> | null>(null);

  const t = translations[locale];
  const headline =
    view === 'compare'
      ? t.compareHeadline
      : view === 'indoor'
        ? t.indoorHeadline
        : view === 'groups'
          ? t.groupHeadline
          : t.headline;
  const lede =
    view === 'compare'
      ? t.compareLede
      : view === 'indoor'
        ? t.indoorLede
        : view === 'groups'
          ? t.groupLede
          : t.lede;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const data = await fetchJSON<{ groups: GroupSummary[] }>(
          `${API_BASE}${API_BASE === '/data' ? '/groups.json' : '/groups'}`
        );
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
        const data = await fetchJSON<GroupDetail>(
          `${API_BASE}${
            API_BASE === '/data' ? `/group_${selectedGroupId}.json` : `/groups/${selectedGroupId}`
          }`
        );
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
        const data = await fetchJSON<OverallResponse>(`${API_BASE}${API_BASE === '/data' ? '/overall.json' : '/overall'}`);
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
        const data = await fetchJSON<OverallResponse>(
          `${API_BASE}${API_BASE === '/data' ? '/indoor_overall.json' : '/indoor/overall'}`
        );
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
    const loadEloOverall = async () => {
      setLoadingEloOverall(true);
      try {
        const data = await fetchJSON<EloResponse>(
          `${API_BASE}${API_BASE === '/data' ? '/overall_elo.json' : '/overall/elo'}`
        );
        setEloOverall(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingEloOverall(false);
      }
    };
    loadEloOverall();
  }, []);

  useEffect(() => {
    const loadRecommendations = async () => {
      setLoadingRecommendation(true);
      try {
        const data = await fetchJSON<SimpleRecommendation>(
          `${API_BASE}${API_BASE === '/data' ? '/recommendations_simple.json' : '/recommendations/simple'}`
        );
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
          `${API_BASE}${
            API_BASE === '/data'
              ? `/matches_${selectedGroupId}_${selectedTeam.team.teamId}.json`
              : `/groups/${selectedGroupId}/teams/${selectedTeam.team.teamId}/matches`
          }`
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

  const sortableHeader = <K extends string>(
    label: string,
    key: K,
    sort: SortState<K> | null,
    setSort: (next: SortState<K>) => void
  ) => {
    const active = sort?.key === key;
    const suffix = active ? (sort?.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return (
      <th
        className="sortable"
        role="button"
        tabIndex={0}
        onClick={() => setSort(toggleSort(sort, key))}
        onKeyDown={(evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            setSort(toggleSort(sort, key));
          }
        }}
      >
        {label}
        {suffix}
      </th>
    );
  };

  const handleRefresh = async () => {
    if (!API_BASE.startsWith('/api')) {
      return;
    }

    setRefreshing(true);
    try {
      await fetchJSON(`${API_BASE}/refresh`, { method: 'POST' });
      const [groupsData, overallData, groupData] = await Promise.all([
        fetchJSON<{ groups: GroupSummary[] }>(`${API_BASE}${API_BASE === '/data' ? '/groups.json' : '/groups'}`),
        fetchJSON<OverallResponse>(`${API_BASE}${API_BASE === '/data' ? '/overall.json' : '/overall'}`),
        selectedGroupId
          ? fetchJSON<GroupDetail>(
              `${API_BASE}${
                API_BASE === '/data' ? `/group_${selectedGroupId}.json` : `/groups/${selectedGroupId}`
              }`
            )
          : Promise.resolve(groupDetail),
      ]);
      setGroups(groupsData.groups);
      setOverall(overallData);
      if (groupData) {
        setGroupDetail(groupData);
      }
      fetchJSON<OverallResponse>(
        `${API_BASE}${API_BASE === '/data' ? '/indoor_overall.json' : '/indoor/overall'}`
      )
        .then(setIndoorOverall)
        .catch(() => undefined);
      fetchJSON<EloResponse>(`${API_BASE}${API_BASE === '/data' ? '/overall_elo.json' : '/overall/elo'}`)
        .then(setEloOverall)
        .catch(() => undefined);
      fetchJSON<SimpleRecommendation>(
        `${API_BASE}${API_BASE === '/data' ? '/recommendations_simple.json' : '/recommendations/simple'}`
      ).then(setRecommendation);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const groupTeamsSorted = useMemo(() => {
    if (!groupDetail) return [];
    const base = groupDetail.teams;
    if (!groupSort) return base;

    const indexByID = new Map(base.map((entry, idx) => [entry.team.teamId, idx]));

    const getValue = (entry: TeamPower): Record<GroupSortKey, SortableValue> => ({
      default: indexByID.get(entry.team.teamId) ?? 0,
      rank: entry.team.rank,
      team: entry.team.teamName,
      games: entry.team.games,
      ratio: entry.team.goalsFor - entry.team.goalsAgainst,
      points: entry.team.points,
      offense: entry.groupMetrics.offense,
      defense: entry.groupMetrics.defense,
      dominance: entry.groupMetrics.dominance,
      powerGroup: entry.groupMetrics.powerScore,
      powerOverall: entry.overallMetrics.powerScore,
    });

    return [...base].sort((a, b) => {
      const va = getValue(a)[groupSort.key];
      const vb = getValue(b)[groupSort.key];
      return compareValues(va, vb, groupSort.dir);
    });
  }, [groupDetail, groupSort]);

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
              {sortableHeader(columns.rank, 'rank', groupSort, setGroupSort)}
              {sortableHeader(columns.team, 'team', groupSort, setGroupSort)}
              {sortableHeader(columns.games, 'games', groupSort, setGroupSort)}
              {sortableHeader(columns.ratio, 'ratio', groupSort, setGroupSort)}
              {sortableHeader(columns.points, 'points', groupSort, setGroupSort)}
              {sortableHeader(columns.offense, 'offense', groupSort, setGroupSort)}
              {sortableHeader(columns.defense, 'defense', groupSort, setGroupSort)}
              {sortableHeader(columns.dominance, 'dominance', groupSort, setGroupSort)}
              {sortableHeader(columns.powerGroup, 'powerGroup', groupSort, setGroupSort)}
              {sortableHeader(columns.powerOverall, 'powerOverall', groupSort, setGroupSort)}
            </tr>
          </thead>
          <tbody>
            {groupTeamsSorted.map((entry) => (
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

  const matchesSorted = useMemo(() => {
    if (!selectedTeam) return teamMatches;
    const base = teamMatches;
    if (!matchSort) return base;

    const indexByID = new Map(base.map((m, idx) => [m.id, idx]));

    const getOpponent = (match: TeamMatch) =>
      match.homeTeamId === selectedTeam.team.teamId ? match.awayTeam : match.homeTeam;

    const getResultValue = (match: TeamMatch) => {
      if (match.status !== 'played') return null;
      const isHome = match.homeTeamId === selectedTeam.team.teamId;
      const diff = match.homeScore - match.awayScore;
      return isHome ? diff : -diff;
    };

    const getValue = (match: TeamMatch): Record<MatchSortKey, SortableValue> => ({
      default: indexByID.get(match.id) ?? 0,
      opponent: getOpponent(match),
      result: getResultValue(match),
      status: match.status,
    });

    return [...base].sort((a, b) => {
      const va = getValue(a)[matchSort.key];
      const vb = getValue(b)[matchSort.key];
      return compareValues(va, vb, matchSort.dir);
    });
  }, [teamMatches, matchSort, selectedTeam]);

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
              {sortableHeader(t.matches.opponent, 'opponent', matchSort, setMatchSort)}
              {sortableHeader(t.matches.result, 'result', matchSort, setMatchSort)}
              {sortableHeader(t.matches.status, 'status', matchSort, setMatchSort)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {matchesSorted.map((match) => {
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

  const overallTeamsSorted = useMemo(() => {
    if (!overall) return [];
    const base = overall.teams;
    if (!overallSort) return base;

    const indexByID = new Map(base.map((entry, idx) => [entry.team.teamId, idx]));

    const getValue = (entry: TeamPower): Record<OverallSortKey, SortableValue> => ({
      default: indexByID.get(entry.team.teamId) ?? 0,
      team: entry.team.teamName,
      group: entry.team.groupName,
      games: entry.team.games,
      ratio: entry.team.goalsFor - entry.team.goalsAgainst,
      points: entry.team.points,
      power: entry.overallMetrics.powerScore,
      offense: entry.overallMetrics.offense,
      defense: entry.overallMetrics.defense,
      dominance: entry.overallMetrics.dominance,
    });

    return [...base].sort((a, b) => {
      const va = getValue(a)[overallSort.key];
      const vb = getValue(b)[overallSort.key];
      return compareValues(va, vb, overallSort.dir);
    });
  }, [overall, overallSort]);

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
              {sortableHeader(columns.position, 'default', overallSort, setOverallSort)}
              {sortableHeader(columns.team, 'team', overallSort, setOverallSort)}
              {sortableHeader(columns.group, 'group', overallSort, setOverallSort)}
              {sortableHeader(columns.games, 'games', overallSort, setOverallSort)}
              {sortableHeader(columns.ratio, 'ratio', overallSort, setOverallSort)}
              {sortableHeader(columns.points, 'points', overallSort, setOverallSort)}
              {sortableHeader(columns.power, 'power', overallSort, setOverallSort)}
              {sortableHeader(columns.offense, 'offense', overallSort, setOverallSort)}
              {sortableHeader(columns.defense, 'defense', overallSort, setOverallSort)}
              {sortableHeader(columns.dominance, 'dominance', overallSort, setOverallSort)}
            </tr>
          </thead>
          <tbody>
            {overallTeamsSorted.map((entry, index) => (
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

  const indoorTeamsSorted = useMemo(() => {
    if (!indoorOverall) return [];
    const base = indoorOverall.teams;
    if (!indoorSort) return base;

    const indexByID = new Map(base.map((entry, idx) => [entry.team.teamId, idx]));

    const getValue = (entry: TeamPower): Record<OverallSortKey, SortableValue> => ({
      default: indexByID.get(entry.team.teamId) ?? 0,
      team: entry.team.teamName,
      group: entry.team.groupName,
      games: entry.team.games,
      ratio: entry.team.goalsFor - entry.team.goalsAgainst,
      points: entry.team.points,
      power: entry.overallMetrics.powerScore,
      offense: entry.overallMetrics.offense,
      defense: entry.overallMetrics.defense,
      dominance: entry.overallMetrics.dominance,
    });

    return [...base].sort((a, b) => {
      const va = getValue(a)[indoorSort.key];
      const vb = getValue(b)[indoorSort.key];
      return compareValues(va, vb, indoorSort.dir);
    });
  }, [indoorOverall, indoorSort]);

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
              {sortableHeader(columns.position, 'default', indoorSort, setIndoorSort)}
              {sortableHeader(columns.team, 'team', indoorSort, setIndoorSort)}
              {sortableHeader(columns.group, 'group', indoorSort, setIndoorSort)}
              {sortableHeader(columns.games, 'games', indoorSort, setIndoorSort)}
              {sortableHeader(columns.ratio, 'ratio', indoorSort, setIndoorSort)}
              {sortableHeader(columns.points, 'points', indoorSort, setIndoorSort)}
              {sortableHeader(columns.power, 'power', indoorSort, setIndoorSort)}
              {sortableHeader(columns.offense, 'offense', indoorSort, setIndoorSort)}
              {sortableHeader(columns.defense, 'defense', indoorSort, setIndoorSort)}
              {sortableHeader(columns.dominance, 'dominance', indoorSort, setIndoorSort)}
            </tr>
          </thead>
          <tbody>
            {indoorTeamsSorted.map((entry, index) => (
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

  const compareRowsSorted = useMemo(() => {
    if (!eloOverall || !overall) return [];

    const powerRank = new Map<string, number>();
    overall.teams.forEach((entry, idx) => powerRank.set(entry.team.teamId, idx + 1));

    const powerScoreById = new Map<string, number>();
    overall.teams.forEach((entry) => powerScoreById.set(entry.team.teamId, entry.overallMetrics.powerScore));

    const inactivePrefix = 'zg.';
    const isInactive = (entry: EloEntry) => entry.games === 0 || entry.team.teamName.toLowerCase().startsWith(inactivePrefix);

    const defaultOrder = [...eloOverall.teams].sort((a, b) => {
      const aInactive = isInactive(a);
      const bInactive = isInactive(b);
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      if (a.elo !== b.elo) return b.elo - a.elo;
      return a.team.teamName.localeCompare(b.team.teamName);
    });

    const eloRank = new Map<string, number>();
    defaultOrder.forEach((entry, idx) => eloRank.set(entry.team.teamId, idx + 1));

    if (!compareSort) {
      return defaultOrder.map((entry) => ({
        entry,
        inactive: isInactive(entry),
        power: powerScoreById.get(entry.team.teamId) ?? 0,
        delta: (powerRank.get(entry.team.teamId) ?? 0) - (eloRank.get(entry.team.teamId) ?? 0),
      }));
    }

    const getValue = (wrapped: { entry: EloEntry; inactive: boolean; power: number; delta: number }): Record<CompareSortKey, SortableValue> => ({
      default: eloRank.get(wrapped.entry.team.teamId) ?? 0,
      team: wrapped.entry.team.teamName,
      group: wrapped.entry.team.groupName,
      elo: wrapped.entry.elo,
      games: wrapped.entry.games,
      power: wrapped.power,
      delta: wrapped.delta,
    });

    const wrapped = defaultOrder.map((entry) => ({
      entry,
      inactive: isInactive(entry),
      power: powerScoreById.get(entry.team.teamId) ?? 0,
      delta: (powerRank.get(entry.team.teamId) ?? 0) - (eloRank.get(entry.team.teamId) ?? 0),
    }));

    return [...wrapped].sort((a, b) => {
      if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
      const va = getValue(a)[compareSort.key];
      const vb = getValue(b)[compareSort.key];
      return compareValues(va, vb, compareSort.dir);
    });
  }, [eloOverall, overall, compareSort]);

  const renderCompareTable = () => {
    if (loadingEloOverall || !eloOverall) {
      return <p className="status">{t.states.loadingOverall}</p>;
    }
    if (!overall) {
      return <p className="status">{t.states.loadingOverall}</p>;
    }

    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {sortableHeader('#', 'default', compareSort, setCompareSort)}
              {sortableHeader(t.overallTableColumns.team, 'team', compareSort, setCompareSort)}
              {sortableHeader(t.overallTableColumns.group, 'group', compareSort, setCompareSort)}
              {sortableHeader('Elo', 'elo', compareSort, setCompareSort)}
              {sortableHeader(t.overallTableColumns.games, 'games', compareSort, setCompareSort)}
              {sortableHeader(t.overallTableColumns.power, 'power', compareSort, setCompareSort)}
              {sortableHeader('Δ Rank', 'delta', compareSort, setCompareSort)}
            </tr>
          </thead>
          <tbody>
            {compareRowsSorted.map((row, idx) => (
              <tr key={row.entry.team.teamId}>
                <td>{idx + 1}</td>
                <td className="team-name">
                  {row.entry.team.teamName}
                  {row.inactive ? ' (inactive)' : ''}
                </td>
                <td>{row.entry.team.groupName}</td>
                <td>{formatNumber(row.entry.elo, 1)}</td>
                <td>{row.entry.games}</td>
                <td>{formatNumber(row.power)}</td>
                <td>{row.delta > 0 ? `+${row.delta}` : `${row.delta}`}</td>
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
          <li className={view === 'compare' ? 'active' : ''}>
            <button onClick={() => setView('compare')}>{t.nav.compare}</button>
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
          {API_BASE.startsWith('/api') && (
            <button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? t.refreshing : t.refresh}
            </button>
          )}
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
        {view === 'compare' && eloOverall && (
          <span className="muted">
            {t.compareUpdated}: {formatDate(eloOverall.updatedAt, dateLocales[locale])}
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
        <>
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

          <section>
            <div className="section-header">
              <h2>{t.algorithms.title}</h2>
            </div>
            <ul>
              {t.algorithms.overall.map((line) => (
                <li key={line} className="muted">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {view === 'compare' && (
        <>
          <section>
            <div className="section-header">
              <h2>{t.compareTitle}</h2>
              {eloOverall && (
                <span className="muted">
                  {t.compareUpdated}: {formatDate(eloOverall.updatedAt, dateLocales[locale])}
                </span>
              )}
            </div>
            {renderCompareTable()}
          </section>

          <section>
            <div className="section-header">
              <h2>{t.algorithms.title}</h2>
            </div>
            <ul>
              {t.algorithms.compare.map((line) => (
                <li key={line} className="muted">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </>
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
