package model

import (
	"strings"
)

// MatchStatus indicates whether a match was actually played.
type MatchStatus string

const (
	// MatchStatusPlayed means a match has a verifiable score.
	MatchStatusPlayed MatchStatus = "played"
	// MatchStatusNotPlayed covers Nichtantritt, Absetzung, etc.
	MatchStatusNotPlayed MatchStatus = "not_played"
)

// MatchResult carries the minimal data we need per match.
type MatchResult struct {
	ID          string      `json:"id"`
	GroupID     string      `json:"groupId"`
	StaffelID   string      `json:"staffelId"`
	HomeTeamID  string      `json:"homeTeamId"`
	HomeTeam    string      `json:"homeTeam"`
	AwayTeamID  string      `json:"awayTeamId"`
	AwayTeam    string      `json:"awayTeam"`
	HomeScore   int         `json:"homeScore"`
	AwayScore   int         `json:"awayScore"`
	Status      MatchStatus `json:"status"`
	Note        string      `json:"note,omitempty"`
	URL         string      `json:"url"`
	MatchDate   string      `json:"matchDate,omitempty"`
	MatchdayTag string      `json:"matchdayTag,omitempty"`
}

// Played reports whether the match has a numeric result.
func (m MatchResult) Played() bool {
	return m.Status == MatchStatusPlayed
}

type aggregatedStats struct {
	games        int
	wins         int
	draws        int
	losses       int
	goalsFor     int
	goalsAgainst int
}

// ApplyMatchAggregates clones the provided team stats and replaces
// games/goals/wdl counts with values derived from the supplied matches.
func ApplyMatchAggregates(teams []TeamStats, matches []MatchResult) []TeamStats {
	aggregates := buildAggregateMap(matches)
	updated := make([]TeamStats, len(teams))
	for i, team := range teams {
		if agg, ok := aggregates[strings.TrimSpace(team.TeamID)]; ok {
			team.Games = agg.games
			team.Wins = agg.wins
			team.Draws = agg.draws
			team.Losses = agg.losses
			team.GoalsFor = agg.goalsFor
			team.GoalsAgainst = agg.goalsAgainst
			team.GoalDiff = agg.goalsFor - agg.goalsAgainst
		}
		updated[i] = team
	}
	return updated
}

func buildAggregateMap(matches []MatchResult) map[string]aggregatedStats {
	stats := make(map[string]aggregatedStats)
	for _, match := range matches {
		if !match.Played() {
			continue
		}

		home := stats[match.HomeTeamID]
		away := stats[match.AwayTeamID]

		home.games++
		away.games++

		home.goalsFor += match.HomeScore
		home.goalsAgainst += match.AwayScore
		away.goalsFor += match.AwayScore
		away.goalsAgainst += match.HomeScore

		switch {
		case match.HomeScore > match.AwayScore:
			home.wins++
			away.losses++
		case match.HomeScore < match.AwayScore:
			home.losses++
			away.wins++
		default:
			home.draws++
			away.draws++
		}

		stats[match.HomeTeamID] = home
		stats[match.AwayTeamID] = away
	}
	return stats
}
