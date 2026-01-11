import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/data';
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
  staffelId?: string;
  teamId: string;
  teamName: string;
  logoUrl?: string;
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
  groupId?: string;
  staffelId?: string;
  matchDate?: string;
  matchdayTag?: string;
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

type View = 'overview' | 'groups' | 'compare' | 'teamCompare' | 'enhanced' | 'recommendations' | 'indoor';

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
  enhancedHeadline: string;
  enhancedLede: string;
  enhancedTitle: string;
  enhanced: {
    algorithmTitle: string;
    algorithmSummary: string;
    settingsTitle: string;
    gdCapLabel: string;
    gdCapDesc: string;
    decayLabel: string;
    decayDesc: string;
    sosLabel: string;
    sosHint: string;
    sosDesc: string;
    playStrengthTitle: string;
    playStrengthDesc: string;
    playStrengthStrongLabel: string;
    playStrengthWeakLabel: string;
    playStrengthHint: string;
    weightsTitle: string;
    weightOffLabel: string;
    weightDefLabel: string;
    weightDomLabel: string;
    weightsHint: string;
    weightsDesc: string;
    sosClampTitle: string;
    sosClampMinLabel: string;
    sosClampMaxLabel: string;
    sosClampDesc: string;
    columns: {
      rank: string;
      team: string;
      group: string;
      playStrength: string;
      games: string;
      powerBase: string;
      powerEnhanced: string;
      sos: string;
      offense: string;
      defense: string;
      dominance: string;
    };
  };
  teamCompareHeadline: string;
  teamCompareLede: string;
  teamCompareTitle: string;
  teamCompare: {
    myTeam: string;
    compareWith: string;
    searchTeams: string;
    selected: string;
    clear: string;
    maxNote: string;
    metricsTitle: string;
    trendTitle: string;
    trendNote: string;
    trendMetric: string;
    trendMetricOptions: {
      power: string;
      offense: string;
      defense: string;
      dominance: string;
    };
    quadrantTitle: string;
    quadrantNote: string;
  };
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
    teamCompare: string;
    enhanced: string;
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
    compareHeadline: 'Elo vs PowerRank',
    compareLede: 'Side-by-side comparison of Elo ratings and the normalized PowerRank score.',
    compareTitle: 'Elo vs PowerRank',
    compareUpdated: 'Updated',
    enhancedHeadline: 'Enhanced PowerRank',
    enhancedLede: 'Experimental variant: capped goal difference, recency weighting, and a small strength-of-schedule adjustment.',
    enhancedTitle: 'Enhanced PowerRank',
    enhanced: {
      algorithmTitle: 'Algorithm (short)',
      algorithmSummary:
        'We compute offense/defense/dominance from match data (with optional recency weighting), normalize them to 0..1, combine them via weights, then apply multipliers for schedule strength (SoS) and play strength (group prior).',
      settingsTitle: 'Settings',
      gdCapLabel: 'Goal difference cap (per match)',
      gdCapDesc: 'Limits how much a single match can influence dominance (prevents blowout inflation).',
      decayLabel: 'Recency decay (per match)',
      decayDesc: 'Down-weights older matches. 1.00 means all matches count equally; lower values emphasize recent games.',
      sosLabel: 'Strength of schedule (SoS) scaling',
      sosHint: 'Multiplier = 1 + k * (avg opponent PowerRank − 0.5).',
      sosDesc: 'Adjusts the score based on opponent strength. Use small k to keep the effect subtle.',
      playStrengthTitle: 'Play strength (group prior)',
      playStrengthDesc:
        'Heuristic adjustment based on group number: group 1 tends to be stronger (older / stronger cohort), groups 7–8 weaker. Applied as an additional multiplier.',
      playStrengthStrongLabel: 'Group 1 bonus',
      playStrengthWeakLabel: 'Groups 7–8 penalty',
      playStrengthHint: 'Multiplier = 1 + bonus (grp 1), 1.0 (grp 2–6), 1 − penalty (grp 7–8).',
      weightsTitle: 'Weights (normalized)',
      weightOffLabel: 'Offense weight',
      weightDefLabel: 'Defense weight',
      weightDomLabel: 'Dominance weight',
      weightsHint: 'Weights are normalized to sum to 1.0 for scoring.',
      weightsDesc: 'Controls the contribution of each normalized component (off/def/dom) to the base score.',
      sosClampTitle: 'SoS multiplier clamp',
      sosClampMinLabel: 'Min multiplier',
      sosClampMaxLabel: 'Max multiplier',
      sosClampDesc: 'Safety bounds so SoS cannot over-amplify or over-penalize teams.',
      columns: {
        rank: '#',
        team: 'Team',
        group: 'Group',
        playStrength: 'PlayStr',
        games: 'Games',
        powerBase: 'Power (base)',
        powerEnhanced: 'Power (enhanced)',
        sos: 'SoS',
        offense: 'Off',
        defense: 'Def',
        dominance: 'Dom',
      },
    },
    teamCompareHeadline: 'Compare',
    teamCompareLede: 'Pick your team and a set of opponents to compare key metrics side-by-side.',
    teamCompareTitle: 'Compare teams',
    teamCompare: {
      myTeam: 'My team',
      compareWith: 'Compare with',
      searchTeams: 'Search teams',
      selected: 'Selected',
      clear: 'Clear',
      maxNote: 'Tip: keep the list small (e.g. 3–6) for readability.',
      metricsTitle: 'Metrics',
      trendTitle: 'Season development',
      trendNote: 'Trend computed from cumulative match stats and normalized with the current season range.',
      trendMetric: 'Metric',
      trendMetricOptions: {
        power: 'Power',
        offense: 'Offense',
        defense: 'Defense',
        dominance: 'Dominance',
      },
      quadrantTitle: 'Quadrant map',
      quadrantNote: 'X = offense, Y = defense, color = dominance, size = power score.',
    },
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
      overview: 'PowerRank',
      groups: 'Groups',
      compare: 'Elo vs PowerRank',
      teamCompare: 'Compare',
      enhanced: 'Enhanced PowerRank',
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
        'Each metric is normalized to 0..1 across all teams (overall), then combined: 0.4 * offense + 0.4 * defense + 0.2 * dominance.',
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
    compareHeadline: 'Elo vs PowerRank',
    compareLede: 'Vergleich von Elo-Ratings mit dem normalisierten PowerRank-Score.',
    compareTitle: 'Elo vs PowerRank',
    compareUpdated: 'Stand',
    enhancedHeadline: 'Enhanced PowerRank',
    enhancedLede: 'Experimentelle Variante: gedeckelte Tordifferenz, stärkere Gewichtung der letzten Spiele und eine kleine SoS-Anpassung.',
    enhancedTitle: 'Enhanced PowerRank',
    enhanced: {
      algorithmTitle: 'Algorithmus (kurz)',
      algorithmSummary:
        'Wir berechnen Offense/Defense/Dominance aus den Spieldaten (optional mit Recency-Gewichtung), normalisieren auf 0..1, kombinieren per Gewichten und wenden anschließend Multiplikatoren für SoS (Gegnerstärke) und Spielstärke (Gruppen-Prior) an.',
      settingsTitle: 'Einstellungen',
      gdCapLabel: 'Tordifferenz-Cap (pro Spiel)',
      gdCapDesc: 'Begrenzt den Einfluss eines einzelnen Spiels auf Dominance (verhindert Blowout-Inflation).',
      decayLabel: 'Recency-Decay (pro Spiel)',
      decayDesc: 'Gewichtet ältere Spiele weniger. 1,00 bedeutet: alle Spiele zählen gleich; kleinere Werte betonen aktuelle Spiele.',
      sosLabel: 'Strength of schedule (SoS) Skalierung',
      sosHint: 'Multiplikator = 1 + k * (Ø Gegner-PowerRank − 0,5).',
      sosDesc: 'Passt den Score anhand der Gegnerstärke an. k klein halten, damit der Effekt subtil bleibt.',
      playStrengthTitle: 'Spielstärke (Gruppen-Prior)',
      playStrengthDesc:
        'Heuristische Anpassung anhand der Gruppennummer: Gruppe 1 ist meist stärker (älter / stärkerer Jahrgang), Gruppen 7–8 schwächer. Wird als zusätzlicher Multiplikator angewendet.',
      playStrengthStrongLabel: 'Bonus Gruppe 1',
      playStrengthWeakLabel: 'Malus Gruppen 7–8',
      playStrengthHint: 'Multiplikator = 1 + Bonus (Grp 1), 1,0 (Grp 2–6), 1 − Malus (Grp 7–8).',
      weightsTitle: 'Gewichte (normalisiert)',
      weightOffLabel: 'Offense-Gewicht',
      weightDefLabel: 'Defense-Gewicht',
      weightDomLabel: 'Dominance-Gewicht',
      weightsHint: 'Gewichte werden für die Berechnung auf Summe 1,0 normalisiert.',
      weightsDesc: 'Steuert den Anteil der normalisierten Komponenten (off/def/dom) am Basis-Score.',
      sosClampTitle: 'SoS-Multiplikator Begrenzung',
      sosClampMinLabel: 'Min. Multiplikator',
      sosClampMaxLabel: 'Max. Multiplikator',
      sosClampDesc: 'Sicherheitsgrenzen, damit SoS nicht zu stark verstärkt oder bestraft.',
      columns: {
        rank: '#',
        team: 'Team',
        group: 'Gruppe',
        playStrength: 'Spielstärke',
        games: 'Spiele',
        powerBase: 'Power (Basis)',
        powerEnhanced: 'Power (Enhanced)',
        sos: 'SoS',
        offense: 'Off',
        defense: 'Def',
        dominance: 'Dom',
      },
    },
    teamCompareHeadline: 'Compare',
    teamCompareLede: 'Wähle dein Team und eine Auswahl an Gegnern, um Kennzahlen nebeneinander zu vergleichen.',
    teamCompareTitle: 'Teams vergleichen',
    teamCompare: {
      myTeam: 'Mein Team',
      compareWith: 'Vergleichen mit',
      searchTeams: 'Teams suchen',
      selected: 'Ausgewählt',
      clear: 'Leeren',
      maxNote: 'Tipp: Für bessere Lesbarkeit nur wenige Teams auswählen (z.B. 3–6).',
      metricsTitle: 'Kennzahlen',
      trendTitle: 'Saisonverlauf',
      trendNote: 'Verlauf aus kumulierten Spielstatistiken, normalisiert anhand der aktuellen Saison-Spanne.',
      trendMetric: 'Wert',
      trendMetricOptions: {
        power: 'Power',
        offense: 'Offense',
        defense: 'Defense',
        dominance: 'Dominanz',
      },
      quadrantTitle: 'Quadrantenkarte',
      quadrantNote: 'X = Offense, Y = Defense, Farbe = Dominanz, Größe = Power-Score.',
    },
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
      overview: 'PowerRank',
      groups: 'Gruppen',
      compare: 'Elo vs PowerRank',
      teamCompare: 'Compare',
      enhanced: 'Enhanced PowerRank',
      indoor: 'Halle',
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
        'Jede Kennzahl wird über alle Teams auf 0..1 normalisiert und dann kombiniert: 0,4 * Offense + 0,4 * Defense + 0,2 * Dominanz.',
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

const normalizeLogoURL = (value?: string) => {
  if (!value) return '';
  if (value.startsWith('//')) return `https:${value}`;
  return value;
};

const teamInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

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

type EnhancedSortKey =
  | 'default'
  | 'team'
  | 'group'
  | 'playStrength'
  | 'games'
  | 'powerBase'
  | 'powerEnhanced'
  | 'sos'
  | 'offense'
  | 'defense'
  | 'dominance';

const VIEW_VALUES: View[] = ['overview', 'groups', 'compare', 'teamCompare', 'enhanced', 'recommendations', 'indoor'];

const getParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key);
  return value == null || value.trim() === '' ? null : value;
};

const parseListParam = (value: string | null) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

function App() {
  const applyingURL = useRef(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);

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

  const applyURLState = () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    const nextLocale = getParam(params, 'lang');
    if (nextLocale === 'de' || nextLocale === 'en') {
      setLocale(nextLocale);
    }

    const nextView = getParam(params, 'view');
    if (nextView && (VIEW_VALUES as string[]).includes(nextView)) {
      setView(nextView as View);
    }

    const nextGroup = getParam(params, 'group');
    if (nextGroup) {
      setSelectedGroupId(nextGroup);
      setPendingGroupId(nextGroup);
    }

    const nextTeam = getParam(params, 'team');
    setPendingTeamId(nextTeam);

    const nextMyTeam = getParam(params, 'my');
    if (nextMyTeam) {
      setMyTeamId(nextMyTeam);
    }

    const nextWith = parseListParam(getParam(params, 'with'));
    if (nextWith.length) {
      setCompareTeamIds(nextWith);
    }

    const nextTrend = getParam(params, 'trend');
    if (nextTrend === 'power' || nextTrend === 'offense' || nextTrend === 'defense' || nextTrend === 'dominance') {
      setTrendMetric(nextTrend);
    }

    const nextGd = getParam(params, 'gd');
    if (nextGd) {
      const parsed = Number(nextGd);
      if (isFinite(parsed) && parsed >= 0 && parsed <= 10) {
        setEnhancedGDCap(Math.round(parsed));
      }
    }

    const nextDecay = getParam(params, 'decay');
    if (nextDecay) {
      const parsed = Number(nextDecay);
      if (isFinite(parsed) && parsed > 0.5 && parsed <= 1) {
        setEnhancedDecay(parsed);
      }
    }

    const nextSoS = getParam(params, 'sos');
    if (nextSoS) {
      const parsed = Number(nextSoS);
      if (isFinite(parsed) && parsed >= 0 && parsed <= 0.5) {
        setEnhancedSoSK(parsed);
      }
    }

    const nextWOff = getParam(params, 'wOff');
    if (nextWOff) {
      const parsed = Number(nextWOff);
      if (isFinite(parsed) && parsed >= 0 && parsed <= 1) {
        setEnhancedWeightOff(parsed);
      }
    }

    const nextWDef = getParam(params, 'wDef');
    if (nextWDef) {
      const parsed = Number(nextWDef);
      if (isFinite(parsed) && parsed >= 0 && parsed <= 1) {
        setEnhancedWeightDef(parsed);
      }
    }

    const nextWDom = getParam(params, 'wDom');
    if (nextWDom) {
      const parsed = Number(nextWDom);
      if (isFinite(parsed) && parsed >= 0 && parsed <= 1) {
        setEnhancedWeightDom(parsed);
      }
    }

    const nextPsStrong = getParam(params, 'psStrong');
    if (nextPsStrong) {
      const parsed = Number(nextPsStrong);
      if (isFinite(parsed) && parsed >= 0 && parsed <= 0.3) {
        setEnhancedPlayStrengthStrong(parsed);
      }
    }

    const nextPsWeak = getParam(params, 'psWeak');
    if (nextPsWeak) {
      const parsed = Number(nextPsWeak);
      if (isFinite(parsed) && parsed >= 0 && parsed <= 0.3) {
        setEnhancedPlayStrengthWeak(parsed);
      }
    }

    const nextSoSMin = getParam(params, 'sosMin');
    if (nextSoSMin) {
      const parsed = Number(nextSoSMin);
      if (isFinite(parsed) && parsed >= 0.25 && parsed <= 1.5) {
        setEnhancedSoSClampMin(parsed);
      }
    }

    const nextSoSMax = getParam(params, 'sosMax');
    if (nextSoSMax) {
      const parsed = Number(nextSoSMax);
      if (isFinite(parsed) && parsed >= 0.5 && parsed <= 2) {
        setEnhancedSoSClampMax(parsed);
      }
    }
  };

  const [myTeamId, setMyTeamId] = useState('');
  const [compareTeamIds, setCompareTeamIds] = useState<string[]>([]);
  const [myTeamSearch, setMyTeamSearch] = useState('');
  const [teamCompareSearch, setTeamCompareSearch] = useState('');
  const [trendMetric, setTrendMetric] = useState<'power' | 'offense' | 'defense' | 'dominance'>('power');
  const [enhancedGDCap, setEnhancedGDCap] = useState(3);
  const [enhancedDecay, setEnhancedDecay] = useState(0.93);
  const [enhancedSoSK, setEnhancedSoSK] = useState(0.25);
  const [enhancedPlayStrengthStrong, setEnhancedPlayStrengthStrong] = useState(0.05);
  const [enhancedPlayStrengthWeak, setEnhancedPlayStrengthWeak] = useState(0.05);
  const [enhancedWeightOff, setEnhancedWeightOff] = useState(0.35);
  const [enhancedWeightDef, setEnhancedWeightDef] = useState(0.25);
  const [enhancedWeightDom, setEnhancedWeightDom] = useState(0.4);
  const [enhancedSoSClampMin, setEnhancedSoSClampMin] = useState(0.75);

  const setEnhancedWeightsNormalized = (off: number, def: number, dom: number) => {
    const sum = off + def + dom;
    if (!isFinite(sum) || sum <= 0) return;
    setEnhancedWeightOff(off / sum);
    setEnhancedWeightDef(def / sum);
    setEnhancedWeightDom(dom / sum);
  };

  const handleEnhancedWeightChange = (key: 'off' | 'def' | 'dom', value: number) => {
    const next = Math.max(0, Math.min(1, value));
    const off = enhancedWeightOff;
    const def = enhancedWeightDef;
    const dom = enhancedWeightDom;

    if (key === 'off') {
      const remaining = 1 - next;
      const otherSum = def + dom;
      if (otherSum <= 0) {
        setEnhancedWeightsNormalized(next, remaining / 2, remaining / 2);
      } else {
        const scale = remaining / otherSum;
        setEnhancedWeightsNormalized(next, def * scale, dom * scale);
      }
      return;
    }

    if (key === 'def') {
      const remaining = 1 - next;
      const otherSum = off + dom;
      if (otherSum <= 0) {
        setEnhancedWeightsNormalized(remaining / 2, next, remaining / 2);
      } else {
        const scale = remaining / otherSum;
        setEnhancedWeightsNormalized(off * scale, next, dom * scale);
      }
      return;
    }

    const remaining = 1 - next;
    const otherSum = off + def;
    if (otherSum <= 0) {
      setEnhancedWeightsNormalized(remaining / 2, remaining / 2, next);
    } else {
      const scale = remaining / otherSum;
      setEnhancedWeightsNormalized(off * scale, def * scale, next);
    }
  };
  const [enhancedSoSClampMax, setEnhancedSoSClampMax] = useState(1.25);
  const [compareMatchCache, setCompareMatchCache] = useState<Record<string, TeamMatch[]>>({});
  const [loadingCompareMatches, setLoadingCompareMatches] = useState(false);

  const [groupSort, setGroupSort] = useState<SortState<GroupSortKey> | null>(null);
  const [matchSort, setMatchSort] = useState<SortState<MatchSortKey> | null>(null);
  const [overallSort, setOverallSort] = useState<SortState<OverallSortKey> | null>(null);
  const [indoorSort, setIndoorSort] = useState<SortState<OverallSortKey> | null>(null);
  const [compareSort, setCompareSort] = useState<SortState<CompareSortKey> | null>(null);
  const [enhancedSort, setEnhancedSort] = useState<SortState<EnhancedSortKey> | null>(null);
  const [loadingEnhanced, setLoadingEnhanced] = useState(false);

  const t = translations[locale];
  const headline =
    view === 'teamCompare'
      ? t.teamCompareHeadline
      : view === 'compare'
        ? t.compareHeadline
        : view === 'enhanced'
          ? t.enhancedHeadline
          : view === 'indoor'
            ? t.indoorHeadline
            : view === 'groups'
              ? t.groupHeadline
              : t.headline;
  const lede =
    view === 'teamCompare'
      ? t.teamCompareLede
      : view === 'compare'
        ? t.compareLede
        : view === 'enhanced'
          ? t.enhancedLede
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
    applyingURL.current = true;
    applyURLState();
    applyingURL.current = false;

    if (typeof window === 'undefined') return;
    const onPop = () => {
      applyingURL.current = true;
      applyURLState();
      applyingURL.current = false;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const data = await fetchJSON<{ groups: GroupSummary[] }>(
          `${API_BASE}${API_BASE === '/data' ? '/groups.json' : '/groups'}`
        );
        setGroups(data.groups);
        if (data.groups.length) {
          setSelectedGroupId((current) => {
            if (current) return current;
            if (pendingGroupId && data.groups.some((g) => g.id === pendingGroupId)) {
              return pendingGroupId;
            }
            return data.groups[0].id;
          });
        }
      } catch (err) {
        setError((err as Error).message);
      }
    };
    loadGroups();
  }, [pendingGroupId]);

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
    if (!groupDetail) return;
    if (pendingTeamId) {
      const match = groupDetail.teams.find((entry) => entry.team.teamId === pendingTeamId);
      if (match) {
        setSelectedTeam(match);
      }
      setPendingTeamId(null);
    }
  }, [groupDetail, pendingTeamId]);

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
    if (!myTeamId && overall?.teams?.length) {
      setMyTeamId(overall.teams[0].team.teamId);
    }
  }, [overall, myTeamId]);

  useEffect(() => {
    const loadCompareMatches = async () => {
      if (view !== 'teamCompare' || !overall?.teams?.length) {
        return;
      }

      const teamById = new Map(overall.teams.map((entry) => [entry.team.teamId, entry]));
      const myEntry = teamById.get(myTeamId) ?? overall.teams[0];
      const ids = [myEntry.team.teamId, ...compareTeamIds.filter((id) => id !== myEntry.team.teamId)];

      const keys = ids
        .map((id) => teamById.get(id))
        .filter((entry): entry is TeamPower => Boolean(entry))
        .map((entry) => ({
          key: `${entry.team.groupId}_${entry.team.teamId}`,
          groupId: entry.team.groupId,
          teamId: entry.team.teamId,
        }));

      const missing = keys.filter((k) => !compareMatchCache[k.key]);
      if (!missing.length) {
        return;
      }

      setLoadingCompareMatches(true);
      try {
        const results = await Promise.all(
          missing.map(async (k) => {
            const data = await fetchJSON<{ matches: TeamMatch[] }>(
              `${API_BASE}${
                API_BASE === '/data'
                  ? `/matches_${k.groupId}_${k.teamId}.json`
                  : `/groups/${k.groupId}/teams/${k.teamId}/matches`
              }`
            );
            return [k.key, data.matches] as const;
          })
        );

        setCompareMatchCache((current) => {
          const next = { ...current };
          results.forEach(([key, matches]) => {
            next[key] = matches;
          });
          return next;
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingCompareMatches(false);
      }
    };

    loadCompareMatches();
  }, [view, overall, myTeamId, compareTeamIds, compareMatchCache]);

  useEffect(() => {
    if (view !== 'enhanced' || !overall?.teams?.length) {
      return;
    }

    let cancelled = false;

    const loadEnhancedMatches = async () => {
      const keys = overall.teams.map((entry) => ({
        key: `${entry.team.groupId}_${entry.team.teamId}`,
        groupId: entry.team.groupId,
        teamId: entry.team.teamId,
      }));

      const missing = keys.filter((k) => !compareMatchCache[k.key]);
      if (!missing.length) return;

      setLoadingEnhanced(true);
      try {
        const limit = 8;
        let cursor = 0;
        const results: Array<[string, TeamMatch[]]> = [];

        const workers = Array.from({ length: Math.min(limit, missing.length) }, async () => {
          while (!cancelled) {
            const idx = cursor++;
            if (idx >= missing.length) return;
            const k = missing[idx];
            const data = await fetchJSON<{ matches: TeamMatch[] }>(
              `${API_BASE}${API_BASE === '/data' ? `/matches_${k.groupId}_${k.teamId}.json` : `/groups/${k.groupId}/teams/${k.teamId}/matches`}`
            );
            results.push([k.key, data.matches]);
          }
        });

        await Promise.all(workers);
        if (cancelled) return;

        setCompareMatchCache((current) => {
          const next = { ...current };
          results.forEach(([key, matches]) => {
            next[key] = matches;
          });
          return next;
        });
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoadingEnhanced(false);
      }
    };

    loadEnhancedMatches();
    return () => {
      cancelled = true;
    };
  }, [view, overall, compareMatchCache]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (applyingURL.current) return;

    const params = new URLSearchParams(window.location.search);
    params.set('lang', locale);
    params.set('view', view);

    params.delete('group');
    params.delete('team');
    params.delete('my');
    params.delete('with');
    params.delete('trend');
    params.delete('gd');
    params.delete('decay');
    params.delete('sos');
    params.delete('psStrong');
    params.delete('psWeak');
    params.delete('wOff');
    params.delete('wDef');
    params.delete('wDom');
    params.delete('sosMin');
    params.delete('sosMax');

    if (view === 'groups') {
      if (selectedGroupId) params.set('group', selectedGroupId);
      if (selectedTeam) params.set('team', selectedTeam.team.teamId);
    }

    if (view === 'teamCompare') {
      if (myTeamId) params.set('my', myTeamId);
      if (compareTeamIds.length) params.set('with', compareTeamIds.join(','));
      if (trendMetric) params.set('trend', trendMetric);
    }

    if (view === 'enhanced') {
      params.set('gd', String(Math.round(enhancedGDCap)));
      params.set('decay', enhancedDecay.toFixed(2));
      params.set('sos', enhancedSoSK.toFixed(2));
      params.set('psStrong', enhancedPlayStrengthStrong.toFixed(2));
      params.set('psWeak', enhancedPlayStrengthWeak.toFixed(2));
      params.set('wOff', enhancedWeightOff.toFixed(2));
      params.set('wDef', enhancedWeightDef.toFixed(2));
      params.set('wDom', enhancedWeightDom.toFixed(2));
      params.set('sosMin', enhancedSoSClampMin.toFixed(2));
      params.set('sosMax', enhancedSoSClampMax.toFixed(2));
    }

    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  }, [
    locale,
    view,
    selectedGroupId,
    selectedTeam,
    myTeamId,
    compareTeamIds,
    trendMetric,
    enhancedGDCap,
    enhancedDecay,
    enhancedSoSK,
    enhancedPlayStrengthStrong,
    enhancedPlayStrengthWeak,
    enhancedWeightOff,
    enhancedWeightDef,
    enhancedWeightDom,
    enhancedSoSClampMin,
    enhancedSoSClampMax,
  ]);

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

      // When switching groups there is a brief state where selectedGroupId updates
      // before selectedTeam updates. Avoid requesting a non-existent matches file.
      if (selectedTeam.team.groupId !== selectedGroupId) {
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

  const renderTeamCompare = () => {
    if (loadingOverall || !overall) {
      return <p className="status">{t.states.loadingOverall}</p>;
    }

    const teams = overall.teams;
    const teamById = new Map(teams.map((entry) => [entry.team.teamId, entry]));

    const myTeam = teamById.get(myTeamId) ?? teams[0];
    const selectedOthers = compareTeamIds
      .map((id) => teamById.get(id))
      .filter((v): v is TeamPower => Boolean(v))
      .filter((entry) => entry.team.teamId !== myTeam.team.teamId);

    const selected = [myTeam, ...selectedOthers];
    const MAX_COMPARE = 8;
    const tooMany = selected.length > MAX_COMPARE;

    const eloByTeamId = new Map<string, EloEntry>();
    eloOverall?.teams.forEach((e) => eloByTeamId.set(e.team.teamId, e));

    const normalizeRange = (values: number[]) => {
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (!isFinite(min) || !isFinite(max) || min === max) {
        return () => 0.5;
      }
      return (v: number) => (v - min) / (max - min);
    };

    const eloValues = selected.map((entry) => eloByTeamId.get(entry.team.teamId)?.elo ?? 1500);
    const pointsValues = selected.map((entry) => entry.team.points);
    const eloNorm = normalizeRange(eloValues);
    const pointsNorm = normalizeRange(pointsValues);

    const minOff = Math.min(...teams.map((entry) => entry.overallMetrics.offense));
    const maxOff = Math.max(...teams.map((entry) => entry.overallMetrics.offense));
    const minDef = Math.min(...teams.map((entry) => entry.overallMetrics.defense));
    const maxDef = Math.max(...teams.map((entry) => entry.overallMetrics.defense));
    const minDom = Math.min(...teams.map((entry) => entry.overallMetrics.dominance));
    const maxDom = Math.max(...teams.map((entry) => entry.overallMetrics.dominance));

    const normalize = (value: number, min: number, max: number) => {
      if (!isFinite(min) || !isFinite(max) || min === max) return 0.5;
      return Math.max(0, Math.min(1, (value - min) / (max - min)));
    };

    const seriesColors = ['#2563eb', '#0f766e', '#7c3aed', '#ea580c', '#db2777', '#16a34a', '#475569'];

    const buildTrendSeries = (teamId: string, groupId: string) => {
      const key = `${groupId}_${teamId}`;
      const matches = compareMatchCache[key] || [];
      const played = [...matches]
        .filter((m) => m.status === 'played')
        .sort((a, b) => {
          const ma = parseInt(a.matchdayTag || '0', 10);
          const mb = parseInt(b.matchdayTag || '0', 10);
          if (ma !== mb) return ma - mb;
          const da = a.matchDate || '';
          const db = b.matchDate || '';
          if (da !== db) return da.localeCompare(db);
          return a.id.localeCompare(b.id);
        });

      let games = 0;
      let gf = 0;
      let ga = 0;
      let fallbackMatchday = 0;

      const points: Array<{ x: number; y: number }> = [];
      played.forEach((m) => {
        games++;
        if (m.homeTeamId === teamId) {
          gf += m.homeScore;
          ga += m.awayScore;
        } else {
          gf += m.awayScore;
          ga += m.homeScore;
        }

        let matchday = parseInt(m.matchdayTag || '0', 10);
        if (!matchday || !isFinite(matchday)) {
          fallbackMatchday += 1;
          matchday = fallbackMatchday;
        } else {
          fallbackMatchday = matchday;
        }

        const off = gf / games;
        const def = 1 - ga / games;
        const dom = (gf - ga) / games;
        const offN = normalize(off, minOff, maxOff);
        const defN = normalize(def, minDef, maxDef);
        const domN = normalize(dom, minDom, maxDom);
        const powerScore = 0.4 * offN + 0.4 * defN + 0.2 * domN;

        const y =
          trendMetric === 'offense'
            ? offN
            : trendMetric === 'defense'
              ? defN
              : trendMetric === 'dominance'
                ? domN
                : powerScore;

        points.push({ x: matchday, y });
      });

      return points;
    };

    const renderTrendChart = () => {
      if (loadingCompareMatches) {
        return <p className="status">{t.states.loadingMatches}</p>;
      }

      const series = selected.map((entry, idx) => ({
        entry,
        color: idx === 0 ? seriesColors[0] : seriesColors[(idx - 1) % (seriesColors.length - 1) + 1],
        points: buildTrendSeries(entry.team.teamId, entry.team.groupId),
      }));

      const allX = series.flatMap((s) => s.points.map((p) => p.x));
      const minX = allX.length ? Math.min(...allX) : 0;
      const maxX = allX.length ? Math.max(...allX) : 0;

      if (maxX <= 1) {
        return <p className="muted">{t.teamCompare.trendNote}</p>;
      }

      const width = 720;
      const height = 240;
      const pad = 28;
      const innerW = width - pad * 2;
      const innerH = height - pad * 2;

      const xScale = (x: number) => pad + ((x - minX) / Math.max(1, maxX - minX)) * innerW;
      const yScale = (y: number) => pad + (1 - y) * innerH;

      const buildPath = (pts: Array<{ x: number; y: number }>) =>
        pts
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`)
          .join(' ');

      return (
        <div className="trend-wrapper">
          <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" role="img" aria-label={t.teamCompare.trendTitle}>
            <rect x="0" y="0" width={width} height={height} fill="#ffffff" rx="10" />
            <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#e2e8f0" />
            <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e2e8f0" />
            <text x={pad} y={pad - 8} fontSize="10" fill="#64748b">
              1.0
            </text>
            <text x={pad} y={height - pad + 18} fontSize="10" fill="#64748b">
              {minX}
            </text>
            <text x={width - pad} y={height - pad + 18} fontSize="10" fill="#64748b" textAnchor="end">
              {maxX}
            </text>
            <text x={width / 2} y={height - 8} fontSize="10" fill="#64748b" textAnchor="middle">
              MD
            </text>

            {(() => {
              const range = maxX - minX;
              const step = range <= 8 ? 1 : range <= 16 ? 2 : range <= 30 ? 5 : 10;
              const ticks: number[] = [];
              for (let v = Math.ceil(minX / step) * step; v <= maxX; v += step) {
                ticks.push(v);
              }
              return ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={xScale(tick)}
                    y1={height - pad}
                    x2={xScale(tick)}
                    y2={height - pad + 4}
                    stroke="#cbd5e1"
                  />
                  <text x={xScale(tick)} y={height - pad + 16} fontSize="10" fill="#64748b" textAnchor="middle">
                    {tick}
                  </text>
                </g>
              ));
            })()}

            {series.map((s) => (
              <path key={s.entry.team.teamId} d={buildPath(s.points)} fill="none" stroke={s.color} strokeWidth="2" />
            ))}
          </svg>
          <div className="trend-legend">
            {series.map((s) => {
              const logo = normalizeLogoURL(s.entry.team.logoUrl);
              return (
                <div key={s.entry.team.teamId} className="trend-legend-item">
                  <span className="legend-swatch" style={{ background: s.color }} />
                  {logo ? (
                    <img className="mini-logo" src={logo} alt={s.entry.team.teamName} />
                  ) : (
                    <span className="mini-logo fallback">{teamInitials(s.entry.team.teamName)}</span>
                  )}
                  <span>{s.entry.team.teamName}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderQuadrant = () => {
      const powMin = Math.min(...selected.map((entry) => entry.overallMetrics.powerScore));
      const powMax = Math.max(...selected.map((entry) => entry.overallMetrics.powerScore));
      const powNorm = (v: number) => normalize(v, powMin, powMax);

      return (
        <div className="quadrant-wrapper">
          <div className="muted">{t.teamCompare.quadrantNote}</div>
          <div className="quadrant">
            <div className="quadrant-axis x" />
            <div className="quadrant-axis y" />
            <div className="quadrant-label tl">{t.overallTableColumns.defense} ↑</div>
            <div className="quadrant-label br">{t.overallTableColumns.offense} →</div>
            {selected.map((entry) => {
              const x = entry.overallMetrics.normalized.offense;
              const y = entry.overallMetrics.normalized.defense;
              const dom = entry.overallMetrics.normalized.dominance;
              const color = `hsl(${Math.round(dom * 120)}, 70%, 45%)`;
              const size = 22 + powNorm(entry.overallMetrics.powerScore) * 16;
              const logo = normalizeLogoURL(entry.team.logoUrl);
              return (
                <div
                  key={entry.team.teamId}
                  className="quad-point"
                  style={{
                    left: `${Math.max(0, Math.min(1, x)) * 100}%`,
                    top: `${(1 - Math.max(0, Math.min(1, y))) * 100}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    borderColor: color,
                  }}
                  title={entry.team.teamName}
                >
                  {logo ? (
                    <img src={logo} alt={entry.team.teamName} />
                  ) : (
                    <span className="fallback">{teamInitials(entry.team.teamName)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderMetricRow = (
      label: string,
      value: number,
      normalized: number,
      digits = 3,
      extraClass = ''
    ) => (
      <div className={`metric-row ${extraClass}`.trim()}>
        <span className="metric-label">{label}</span>
        <div className="metric-bar">
          <div className="metric-fill" style={{ width: `${Math.max(0, Math.min(1, normalized)) * 100}%` }} />
        </div>
        <span className="metric-value">{formatNumber(value, digits)}</span>
      </div>
    );

    return (
      <div className="team-compare">
        <div className="team-compare-controls">
          <div className="team-compare-field">
            <span className="muted">{t.teamCompare.myTeam}</span>
            <input
              value={myTeamSearch}
              onChange={(evt) => setMyTeamSearch(evt.target.value)}
              placeholder={t.teamCompare.searchTeams}
            />
            <div className="compare-team-list">
              {teams
                .filter((entry) => {
                  const q = myTeamSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    entry.team.teamName.toLowerCase().includes(q) ||
                    entry.team.groupName.toLowerCase().includes(q)
                  );
                })
                .slice(0, 40)
                .map((entry) => {
                  const checked = myTeam.team.teamId === entry.team.teamId;
                  return (
                    <label key={entry.team.teamId} className="compare-team-item">
                      <input
                        type="radio"
                        name="my-team"
                        checked={checked}
                        onChange={() => {
                          setMyTeamId(entry.team.teamId);
                          setCompareTeamIds((current) => current.filter((id) => id !== entry.team.teamId));
                        }}
                      />
                      <span>
                        {entry.team.teamName} <span className="muted">({entry.team.groupName})</span>
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>

          <div className="team-compare-field">
            <div className="team-compare-field-header">
              <span className="muted">{t.teamCompare.compareWith}</span>
              <button
                className="link"
                type="button"
                onClick={() => {
                  setCompareTeamIds([]);
                  setTeamCompareSearch('');
                }}
              >
                {t.teamCompare.clear}
              </button>
            </div>
            <input
              value={teamCompareSearch}
              onChange={(evt) => setTeamCompareSearch(evt.target.value)}
              placeholder={t.teamCompare.searchTeams}
            />
            <div className="compare-team-list">
              {teams
                .filter((entry) => entry.team.teamId !== myTeam.team.teamId)
                .filter((entry) => {
                  const q = teamCompareSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    entry.team.teamName.toLowerCase().includes(q) ||
                    entry.team.groupName.toLowerCase().includes(q)
                  );
                })
                .slice(0, 40)
                .map((entry) => {
                  const checked = compareTeamIds.includes(entry.team.teamId);
                  return (
                    <label key={entry.team.teamId} className="compare-team-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setCompareTeamIds((current) =>
                            checked
                              ? current.filter((id) => id !== entry.team.teamId)
                              : [...current, entry.team.teamId]
                          );
                        }}
                      />
                      <span>
                        {entry.team.teamName} <span className="muted">({entry.team.groupName})</span>
                      </span>
                    </label>
                  );
                })}
            </div>
            <div className="muted team-compare-note">{t.teamCompare.maxNote}</div>
            <div className="muted team-compare-note">
              {t.teamCompare.selected}: {Math.max(0, selected.length - 1)}
            </div>
          </div>
        </div>

        {tooMany && <p className="error">Too many teams selected.</p>}

        {!tooMany && (
          <>
            <div className="section-header">
              <h3>{t.teamCompare.metricsTitle}</h3>
            </div>
            <div className="compare-card-grid">
              {selected.map((entry) => {
                const isMine = entry.team.teamId === myTeam.team.teamId;
                const elo = eloByTeamId.get(entry.team.teamId)?.elo ?? 1500;
                const eloGames = eloByTeamId.get(entry.team.teamId)?.games ?? 0;
                return (
                  <div key={entry.team.teamId} className={`compare-card ${isMine ? 'mine' : ''}`.trim()}>
                    <div className="compare-card-header">
                      <div className="compare-card-title">
                        {normalizeLogoURL(entry.team.logoUrl) ? (
                          <img
                            className="team-logo"
                            src={normalizeLogoURL(entry.team.logoUrl)}
                            alt={entry.team.teamName}
                          />
                        ) : (
                          <span className="team-logo fallback">{teamInitials(entry.team.teamName)}</span>
                        )}
                        <div>
                          <div className="team-name">{entry.team.teamName}</div>
                          <div className="muted">{entry.team.groupName}</div>
                        </div>
                      </div>
                    </div>

                    {renderMetricRow(
                      t.overallTableColumns.power,
                      entry.overallMetrics.powerScore,
                      entry.overallMetrics.powerScore
                    )}
                    {renderMetricRow(
                      t.overallTableColumns.offense,
                      entry.overallMetrics.offense,
                      entry.overallMetrics.normalized.offense
                    )}
                    {renderMetricRow(
                      t.overallTableColumns.defense,
                      entry.overallMetrics.defense,
                      entry.overallMetrics.normalized.defense
                    )}
                    {renderMetricRow(
                      t.overallTableColumns.dominance,
                      entry.overallMetrics.dominance,
                      entry.overallMetrics.normalized.dominance
                    )}
                    {renderMetricRow(
                      t.overallTableColumns.points,
                      entry.team.points,
                      pointsNorm(entry.team.points),
                      0,
                      'secondary'
                    )}
                    {renderMetricRow('Elo', elo, eloNorm(elo), 1, 'secondary')}
                    <div className="muted small">{t.overallTableColumns.games}: {entry.team.games} · Elo games: {eloGames}</div>
                  </div>
                );
              })}
            </div>

            <div className="section-header">
              <h3>{t.teamCompare.trendTitle}</h3>
              <label className="trend-metric">
                <span className="muted">{t.teamCompare.trendMetric}</span>
                <select value={trendMetric} onChange={(evt) => setTrendMetric(evt.target.value as any)}>
                  <option value="power">{t.teamCompare.trendMetricOptions.power}</option>
                  <option value="offense">{t.teamCompare.trendMetricOptions.offense}</option>
                  <option value="defense">{t.teamCompare.trendMetricOptions.defense}</option>
                  <option value="dominance">{t.teamCompare.trendMetricOptions.dominance}</option>
                </select>
              </label>
            </div>
            <p className="muted">{t.teamCompare.trendNote}</p>
            {renderTrendChart()}

            <div className="section-header">
              <h3>{t.teamCompare.quadrantTitle}</h3>
            </div>
            {renderQuadrant()}
          </>
        )}
      </div>
    );
  };

  const enhancedRowsSorted = useMemo(() => {
    if (!overall) return [];

    const teams = overall.teams;
    const basePowerById = new Map(teams.map((entry) => [entry.team.teamId, entry.overallMetrics.powerScore] as const));

    const sortedMatches = (matches: TeamMatch[]) =>
      [...matches]
        .filter((m) => m.status === 'played')
        .sort((a, b) => {
          const ma = parseInt(a.matchdayTag || '0', 10);
          const mb = parseInt(b.matchdayTag || '0', 10);
          if (ma !== mb) return ma - mb;
          const da = a.matchDate || '';
          const db = b.matchDate || '';
          if (da !== db) return da.localeCompare(db);
          return a.id.localeCompare(b.id);
        });

    const capGD = enhancedGDCap;

    const raw = teams.map((entry, idx) => {
      const key = `${entry.team.groupId}_${entry.team.teamId}`;
      const matches = sortedMatches(compareMatchCache[key] || []);
      const n = matches.length;

      if (!n) {
        return {
          entry,
          idx,
          games: 0,
          offRaw: 0,
          defRaw: 0,
          domRaw: 0,
          sosAvg: 0.5,
          sosMultiplier: 1,
        };
      }

      const per = matches.map((m) => {
        const isHome = m.homeTeamId === entry.team.teamId;
        const gf = isHome ? m.homeScore : m.awayScore;
        const ga = isHome ? m.awayScore : m.homeScore;
        const opponentId = isHome ? m.awayTeamId : m.homeTeamId;
        const gd = Math.max(-capGD, Math.min(capGD, gf - ga));
        const oppPower = basePowerById.get(opponentId);
        return { gf, ga, gd, oppPower };
      });

      const sosValues = per.map((p) => p.oppPower).filter((v): v is number => typeof v === 'number');
      const sosAvg = sosValues.length ? sosValues.reduce((a, b) => a + b, 0) / sosValues.length : 0.5;
      const sosMultiplier = Math.max(
        Math.min(enhancedSoSClampMin, enhancedSoSClampMax),
        Math.min(Math.max(enhancedSoSClampMin, enhancedSoSClampMax), 1 + enhancedSoSK * (sosAvg - 0.5))
      );

      let wSum = 0;
      let gfSum = 0;
      let gaSum = 0;
      let gdSum = 0;

      per.forEach((p, i) => {
        const gamesAgo = per.length - 1 - i;
        const w = Math.pow(enhancedDecay, gamesAgo);
        wSum += w;
        gfSum += w * p.gf;
        gaSum += w * p.ga;
        gdSum += w * p.gd;
      });

      const offRaw = wSum ? gfSum / wSum : 0;
      const gaAvg = wSum ? gaSum / wSum : 0;
      const defRaw = 1 - gaAvg;
      const domRaw = wSum ? gdSum / wSum : 0;

      return {
        entry,
        idx,
        games: n,
        offRaw,
        defRaw,
        domRaw,
        sosAvg,
        sosMultiplier,
      };
    });

    const active = raw.filter((r) => r.games > 0);
    const minOff = Math.min(...active.map((r) => r.offRaw));
    const maxOff = Math.max(...active.map((r) => r.offRaw));
    const minDef = Math.min(...active.map((r) => r.defRaw));
    const maxDef = Math.max(...active.map((r) => r.defRaw));
    const minDom = Math.min(...active.map((r) => r.domRaw));
    const maxDom = Math.max(...active.map((r) => r.domRaw));

    const normalize = (value: number, min: number, max: number) => {
      if (!isFinite(min) || !isFinite(max) || min === max) return 0.5;
      return Math.max(0, Math.min(1, (value - min) / (max - min)));
    };

    const computed = raw.map((r) => {
      const offN = r.games ? normalize(r.offRaw, minOff, maxOff) : 0.5;
      const defN = r.games ? normalize(r.defRaw, minDef, maxDef) : 0.5;
      const domN = r.games ? normalize(r.domRaw, minDom, maxDom) : 0.5;

      const wSum = enhancedWeightOff + enhancedWeightDef + enhancedWeightDom;
      const wOff = wSum > 0 ? enhancedWeightOff / wSum : 0.35;
      const wDef = wSum > 0 ? enhancedWeightDef / wSum : 0.25;
      const wDom = wSum > 0 ? enhancedWeightDom / wSum : 0.4;

      const baseEnhanced = wOff * offN + wDef * defN + wDom * domN;

      const groupNumberMatch = String(r.entry.team.groupId).match(/(\d+)/);
      const groupNumber = groupNumberMatch ? Number(groupNumberMatch[1]) : NaN;
      let playStrengthMultiplier = 1;
      if (groupNumber === 1) playStrengthMultiplier = 1 + enhancedPlayStrengthStrong;
      else if (groupNumber >= 7) playStrengthMultiplier = 1 - enhancedPlayStrengthWeak;
      playStrengthMultiplier = Math.max(0.5, Math.min(1.5, playStrengthMultiplier));

      const powerEnhanced = r.games ? baseEnhanced * r.sosMultiplier * playStrengthMultiplier : 0;

      return {
        ...r,
        offN,
        defN,
        domN,
        basePower: r.entry.overallMetrics.powerScore,
        playStrengthMultiplier,
        powerEnhanced,
      };
    });

    const defaultSorted = [...computed].sort((a, b) => {
      const aInactive = a.games === 0;
      const bInactive = b.games === 0;
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      if (a.powerEnhanced !== b.powerEnhanced) return b.powerEnhanced - a.powerEnhanced;
      if (a.basePower !== b.basePower) return b.basePower - a.basePower;
      return a.entry.team.teamName.localeCompare(b.entry.team.teamName);
    });

    const indexById = new Map(defaultSorted.map((row, i) => [row.entry.team.teamId, i] as const));

    if (!enhancedSort) return defaultSorted;

    const getValue = (row: (typeof defaultSorted)[number]): Record<EnhancedSortKey, SortableValue> => ({
      default: indexById.get(row.entry.team.teamId) ?? 0,
      team: row.entry.team.teamName,
      group: row.entry.team.groupName,
      playStrength: row.playStrengthMultiplier,
      games: row.games,
      powerBase: row.basePower,
      powerEnhanced: row.powerEnhanced,
      sos: row.sosAvg,
      offense: row.offN,
      defense: row.defN,
      dominance: row.domN,
    });

    return [...defaultSorted].sort((a, b) => {
      const aInactive = a.games === 0;
      const bInactive = b.games === 0;
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      const va = getValue(a)[enhancedSort.key];
      const vb = getValue(b)[enhancedSort.key];
      return compareValues(va, vb, enhancedSort.dir);
    });
  }, [
    overall,
    compareMatchCache,
    enhancedGDCap,
    enhancedDecay,
    enhancedSoSK,
    enhancedPlayStrengthStrong,
    enhancedPlayStrengthWeak,
    enhancedWeightOff,
    enhancedWeightDef,
    enhancedWeightDom,
    enhancedSoSClampMin,
    enhancedSoSClampMax,
    enhancedSort,
  ]);

  const renderEnhancedTable = () => {
    if (loadingOverall || !overall) {
      return <p className="status">{t.states.loadingOverall}</p>;
    }

    const cols = t.enhanced.columns;

    if (loadingEnhanced) {
      return <p className="status">{t.states.loadingMatches}</p>;
    }

    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {sortableHeader(cols.rank, 'default', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.team, 'team', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.group, 'group', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.playStrength, 'playStrength', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.games, 'games', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.powerEnhanced, 'powerEnhanced', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.powerBase, 'powerBase', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.sos, 'sos', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.offense, 'offense', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.defense, 'defense', enhancedSort, setEnhancedSort)}
              {sortableHeader(cols.dominance, 'dominance', enhancedSort, setEnhancedSort)}
            </tr>
          </thead>
          <tbody>
            {enhancedRowsSorted.map((row, idx) => (
              <tr key={row.entry.team.teamId} className={row.games === 0 ? 'inactive-row' : ''}>
                <td>{idx + 1}</td>
                <td className="team-name">{row.entry.team.teamName}</td>
                <td>{row.entry.team.groupName}</td>
                <td>{formatNumber(row.playStrengthMultiplier, 2)}</td>
                <td>{row.games}</td>
                <td>{formatNumber(row.powerEnhanced)}</td>
                <td>{formatNumber(row.basePower)}</td>
                <td>{formatNumber(row.sosAvg, 3)}</td>
                <td>{formatNumber(row.offN)}</td>
                <td>{formatNumber(row.defN)}</td>
                <td>{formatNumber(row.domN)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

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
          <li className={view === 'teamCompare' ? 'active' : ''}>
            <button onClick={() => setView('teamCompare')}>{t.nav.teamCompare}</button>
          </li>
          <li className={view === 'enhanced' ? 'active' : ''}>
            <button onClick={() => setView('enhanced')}>{t.nav.enhanced}</button>
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
          {view === 'overview' ? (
            <ul className="lede-list">
              {t.algorithms.overall.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="lede">{lede}</p>
          )}
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
        {view === 'teamCompare' && overall && (
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

      {view === 'teamCompare' && (
        <section>
          <div className="section-header">
            <h2>{t.teamCompareTitle}</h2>
            {overall && (
              <span className="muted">
                {t.overallUpdated}: {formatDate(overall.updatedAt, dateLocales[locale])}
              </span>
            )}
          </div>
          {renderTeamCompare()}
        </section>
      )}

      {view === 'enhanced' && (
        <>
          <section>
            <div className="section-header">
              <h2>{t.enhancedTitle}</h2>
              {overall && (
                <span className="muted">
                  {t.overallUpdated}: {formatDate(overall.updatedAt, dateLocales[locale])}
                </span>
              )}
            </div>

            <div className="enhanced-summary">
              <div className="enhanced-summary-title">{t.enhanced.algorithmTitle}</div>
              <div className="muted">{t.enhanced.algorithmSummary}</div>
            </div>

            <div className="enhanced-settings">
              <div className="enhanced-settings-title">{t.enhanced.settingsTitle}</div>
              <div className="enhanced-settings-grid">
                <div className="enhanced-setting">
                  <div className="muted">{t.enhanced.gdCapLabel}</div>
                  <div className="enhanced-setting-value">{enhancedGDCap}</div>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={1}
                    value={enhancedGDCap}
                    onChange={(evt) => setEnhancedGDCap(Number(evt.target.value))}
                  />
                  <div className="muted small">{t.enhanced.gdCapDesc}</div>
                </div>
                <div className="enhanced-setting">
                  <div className="muted">{t.enhanced.decayLabel}</div>
                  <div className="enhanced-setting-value">{enhancedDecay.toFixed(2)}</div>
                  <input
                    type="range"
                    min={0.85}
                    max={1}
                    step={0.01}
                    value={enhancedDecay}
                    onChange={(evt) => setEnhancedDecay(Number(evt.target.value))}
                  />
                  <div className="muted small">{t.enhanced.decayDesc}</div>
                </div>
                <div className="enhanced-setting">
                  <div className="muted">{t.enhanced.sosLabel}</div>
                  <div className="enhanced-setting-value">{enhancedSoSK.toFixed(2)}</div>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={enhancedSoSK}
                    onChange={(evt) => setEnhancedSoSK(Number(evt.target.value))}
                  />
                  <div className="muted small">{t.enhanced.sosDesc}</div>
                  <div className="muted small">{t.enhanced.sosHint}</div>
                </div>

                <div className="enhanced-setting">
                  <div className="muted">{t.enhanced.playStrengthTitle}</div>
                  <div className="muted small">{t.enhanced.playStrengthDesc}</div>
                  <div className="muted small">{t.enhanced.playStrengthHint}</div>
                  <div className="enhanced-weight">
                    <div className="muted">{t.enhanced.playStrengthStrongLabel}</div>
                    <div className="enhanced-setting-value">{enhancedPlayStrengthStrong.toFixed(2)}</div>
                    <input
                      type="range"
                      min={0}
                      max={0.3}
                      step={0.01}
                      value={enhancedPlayStrengthStrong}
                      onChange={(evt) => setEnhancedPlayStrengthStrong(Number(evt.target.value))}
                    />
                  </div>
                  <div className="enhanced-weight">
                    <div className="muted">{t.enhanced.playStrengthWeakLabel}</div>
                    <div className="enhanced-setting-value">{enhancedPlayStrengthWeak.toFixed(2)}</div>
                    <input
                      type="range"
                      min={0}
                      max={0.3}
                      step={0.01}
                      value={enhancedPlayStrengthWeak}
                      onChange={(evt) => setEnhancedPlayStrengthWeak(Number(evt.target.value))}
                    />
                  </div>
                </div>

                <div className="enhanced-setting">
                  <div className="muted">{t.enhanced.weightsTitle}</div>
                  <div className="muted small">{t.enhanced.weightsDesc}</div>
                  <div className="muted small">{t.enhanced.weightsHint}</div>
                  <div className="enhanced-weight">
                    <div className="muted">{t.enhanced.weightOffLabel}</div>
                    <div className="enhanced-setting-value">{enhancedWeightOff.toFixed(2)}</div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={enhancedWeightOff}
                      onChange={(evt) => handleEnhancedWeightChange('off', Number(evt.target.value))}
                    />
                  </div>
                  <div className="enhanced-weight">
                    <div className="muted">{t.enhanced.weightDefLabel}</div>
                    <div className="enhanced-setting-value">{enhancedWeightDef.toFixed(2)}</div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={enhancedWeightDef}
                      onChange={(evt) => handleEnhancedWeightChange('def', Number(evt.target.value))}
                    />
                  </div>
                  <div className="enhanced-weight">
                    <div className="muted">{t.enhanced.weightDomLabel}</div>
                    <div className="enhanced-setting-value">{enhancedWeightDom.toFixed(2)}</div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={enhancedWeightDom}
                      onChange={(evt) => handleEnhancedWeightChange('dom', Number(evt.target.value))}
                    />
                  </div>
                </div>

                <div className="enhanced-setting">
                  <div className="muted">{t.enhanced.sosClampTitle}</div>
                  <div className="muted small">{t.enhanced.sosClampDesc}</div>
                  <div className="enhanced-weight">
                    <div className="muted">{t.enhanced.sosClampMinLabel}</div>
                    <div className="enhanced-setting-value">{enhancedSoSClampMin.toFixed(2)}</div>
                    <input
                      type="range"
                      min={0.25}
                      max={1.25}
                      step={0.01}
                      value={enhancedSoSClampMin}
                      onChange={(evt) => setEnhancedSoSClampMin(Number(evt.target.value))}
                    />
                  </div>
                  <div className="enhanced-weight">
                    <div className="muted">{t.enhanced.sosClampMaxLabel}</div>
                    <div className="enhanced-setting-value">{enhancedSoSClampMax.toFixed(2)}</div>
                    <input
                      type="range"
                      min={0.75}
                      max={2}
                      step={0.01}
                      value={enhancedSoSClampMax}
                      onChange={(evt) => setEnhancedSoSClampMax(Number(evt.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
            {renderEnhancedTable()}
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
