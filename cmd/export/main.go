package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/schlubbi/score_board/internal/groups"
	"github.com/schlubbi/score_board/internal/model"
	"github.com/schlubbi/score_board/internal/power"
	"github.com/schlubbi/score_board/internal/recommendation"
	"github.com/schlubbi/score_board/internal/repository"
	"github.com/schlubbi/score_board/internal/scraper"
	"github.com/schlubbi/score_board/internal/service"
)

func main() {
	outDir := flag.String("out", "web/public/data", "output directory")
	timeout := flag.Duration("timeout", 60*time.Second, "scrape timeout")
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	leagueConfigs := make([]model.GroupConfig, 0)
	for _, g := range groups.KasselEJugend() {
		leagueConfigs = append(leagueConfigs, model.GroupConfig{ID: g.ID, Name: g.Name, StaffelID: g.StaffelID})
	}

	leagueRepo := repository.New()
	indoorRepo := repository.New()
	svc := service.New(scraper.New(nil), leagueRepo, leagueConfigs, indoorRepo, groups.IndoorPreGamesStaffelID)

	log.Println("scraping league ...")
	if err := svc.Refresh(ctx); err != nil {
		log.Fatalf("league scrape failed: %v", err)
	}
	log.Println("scraping indoor ...")
	if err := svc.RefreshIndoor(ctx); err != nil {
		log.Printf("indoor scrape failed: %v", err)
	}

	if err := os.MkdirAll(*outDir, 0o755); err != nil {
		log.Fatalf("mkdir: %v", err)
	}

	mustWrite(filepath.Join(*outDir, "groups.json"), map[string]any{"groups": leagueRepo.Summaries()})
	mustWrite(filepath.Join(*outDir, "indoor_groups.json"), map[string]any{"groups": indoorRepo.Summaries()})

	// Per-group detail and per-team matches.
	for _, snap := range leagueRepo.Snapshots() {
		mustWrite(filepath.Join(*outDir, fmt.Sprintf("group_%s.json", snap.Config.ID)), buildGroupDetail(leagueRepo, snap))
		for _, team := range snap.Teams {
			matches := filterTeamMatches(snap.Matches, team.TeamID)
			sort.SliceStable(matches, func(i, j int) bool { return matches[i].ID < matches[j].ID })
			mustWrite(filepath.Join(*outDir, fmt.Sprintf("matches_%s_%s.json", snap.Config.ID, team.TeamID)), map[string]any{
				"group": map[string]string{"id": snap.Config.ID, "name": snap.Config.Name},
				"teamId":  team.TeamID,
				"count":   len(matches),
				"matches": matches,
			})
		}
	}

	mustWrite(filepath.Join(*outDir, "overall.json"), buildOverall(leagueRepo))
	mustWrite(filepath.Join(*outDir, "indoor_overall.json"), buildOverall(indoorRepo))
	mustWrite(filepath.Join(*outDir, "recommendations_simple.json"), buildSimpleRecommendation(leagueRepo, len(leagueConfigs)))
	mustWrite(filepath.Join(*outDir, "overall_elo.json"), buildOverallElo(leagueRepo))

	log.Printf("done. wrote static json to %s", *outDir)
}

func mustWrite(path string, payload any) {
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		log.Fatalf("marshal %s: %v", path, err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		log.Fatalf("write %s: %v", path, err)
	}
}

func buildGroupDetail(repo *repository.Repository, snap model.GroupSnapshot) map[string]any {
	teams := make([]model.TeamStats, len(snap.Teams))
	copy(teams, snap.Teams)
	sort.Slice(teams, func(i, j int) bool {
		if teams[i].Rank != teams[j].Rank {
			return teams[i].Rank < teams[j].Rank
		}
		if teams[i].GoalDiff != teams[j].GoalDiff {
			return teams[i].GoalDiff > teams[j].GoalDiff
		}
		if teams[i].Points != teams[j].Points {
			return teams[i].Points > teams[j].Points
		}
		return teams[i].GoalsFor > teams[j].GoalsFor
	})

	groupMetrics := power.ComputeMetrics(teams)
	overallMetrics := power.ComputeMetrics(repo.AllTeams())

	teamPowers := make([]model.TeamPower, 0, len(teams))
	for _, team := range teams {
		teamPowers = append(teamPowers, model.TeamPower{Team: team, GroupMetrics: groupMetrics[team.TeamID], OverallMetrics: overallMetrics[team.TeamID]})
	}

	return map[string]any{
		"group": model.GroupSummary{ID: snap.Config.ID, Name: snap.Config.Name, StaffelID: snap.Config.StaffelID, LastUpdated: snap.ScrapedAt, TeamCount: len(snap.Teams)},
		"teams": teamPowers,
	}
}

func buildOverall(repo *repository.Repository) map[string]any {
	teams := repo.AllTeams()
	overallMetrics := power.ComputeMetrics(teams)
	groupMetricMap := buildGroupMetricMap(repo.Snapshots())

	teamPowers := make([]model.TeamPower, 0, len(teams))
	for _, team := range teams {
		gMetrics := groupMetricMap[team.GroupID][team.TeamID]
		teamPowers = append(teamPowers, model.TeamPower{Team: team, GroupMetrics: gMetrics, OverallMetrics: overallMetrics[team.TeamID]})
	}

	sort.Slice(teamPowers, func(i, j int) bool {
		pi := teamPowers[i].OverallMetrics.PowerScore
		pj := teamPowers[j].OverallMetrics.PowerScore
		if pi != pj {
			return pi > pj
		}
		if teamPowers[i].Team.GoalDiff != teamPowers[j].Team.GoalDiff {
			return teamPowers[i].Team.GoalDiff > teamPowers[j].Team.GoalDiff
		}
		if teamPowers[i].Team.Points != teamPowers[j].Team.Points {
			return teamPowers[i].Team.Points > teamPowers[j].Team.Points
		}
		return teamPowers[i].Team.GoalsFor > teamPowers[j].Team.GoalsFor
	})

	return map[string]any{"updatedAt": repo.LastUpdated(), "teams": teamPowers}
}

func buildSimpleRecommendation(repo *repository.Repository, groupCount int) map[string]any {
	teams := repo.AllTeams()
	if len(teams) == 0 {
		return map[string]any{"generatedAt": time.Now().UTC(), "totalTeams": 0, "groupCount": groupCount, "groups": []any{}}
	}

	overallMetrics := power.ComputeMetrics(teams)
	groupMetricMap := buildGroupMetricMap(repo.Snapshots())

	teamPowers := make([]model.TeamPower, 0, len(teams))
	for _, team := range teams {
		gMetrics := groupMetricMap[team.GroupID][team.TeamID]
		teamPowers = append(teamPowers, model.TeamPower{Team: team, GroupMetrics: gMetrics, OverallMetrics: overallMetrics[team.TeamID]})
	}

	sort.Slice(teamPowers, func(i, j int) bool {
		pi := teamPowers[i].OverallMetrics.PowerScore
		pj := teamPowers[j].OverallMetrics.PowerScore
		if pi != pj {
			return pi > pj
		}
		if teamPowers[i].Team.GoalDiff != teamPowers[j].Team.GoalDiff {
			return teamPowers[i].Team.GoalDiff > teamPowers[j].Team.GoalDiff
		}
		if teamPowers[i].Team.Points != teamPowers[j].Team.Points {
			return teamPowers[i].Team.Points > teamPowers[j].Team.Points
		}
		return teamPowers[i].Team.TeamName < teamPowers[j].Team.TeamName
	})

	if groupCount <= 0 {
		groupCount = 1
	}

	groupsOut := recommendation.SimpleBalancedGroups(teamPowers, groupCount)
	return map[string]any{"generatedAt": time.Now().UTC(), "totalTeams": len(teamPowers), "groupCount": groupCount, "groups": groupsOut}
}

func buildOverallElo(repo *repository.Repository) map[string]any {
	snaps := repo.Snapshots()
	allMatches := make([]model.MatchResult, 0)
	for _, snap := range snaps {
		allMatches = append(allMatches, snap.Matches...)
	}
	sort.SliceStable(allMatches, func(i, j int) bool { return allMatches[i].ID < allMatches[j].ID })
	elo := power.ComputeElo(allMatches, 1500, 20)

	type teamElo struct {
		Team  model.TeamStats `json:"team"`
		Elo   float64         `json:"elo"`
		Games int             `json:"games"`
	}

	teams := repo.AllTeams()
	entries := make([]teamElo, 0, len(teams))
	for _, team := range teams {
		res := elo[team.TeamID]
		if res.Rating == 0 {
			res.Rating = 1500
		}
		entries = append(entries, teamElo{Team: team, Elo: res.Rating, Games: res.Games})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Elo != entries[j].Elo {
			return entries[i].Elo > entries[j].Elo
		}
		if entries[i].Team.GoalDiff != entries[j].Team.GoalDiff {
			return entries[i].Team.GoalDiff > entries[j].Team.GoalDiff
		}
		if entries[i].Team.Points != entries[j].Team.Points {
			return entries[i].Team.Points > entries[j].Team.Points
		}
		return entries[i].Team.TeamName < entries[j].Team.TeamName
	})

	return map[string]any{"updatedAt": repo.LastUpdated(), "teams": entries}
}

func buildGroupMetricMap(snaps []model.GroupSnapshot) map[string]map[string]model.MetricSet {
	groupMetricMap := make(map[string]map[string]model.MetricSet)
	for _, snap := range snaps {
		groupMetricMap[snap.Config.ID] = power.ComputeMetrics(snap.Teams)
	}
	return groupMetricMap
}

func filterTeamMatches(matches []model.MatchResult, teamID string) []model.MatchResult {
	result := make([]model.MatchResult, 0)
	for _, match := range matches {
		if match.HomeTeamID == teamID || match.AwayTeamID == teamID {
			result = append(result, match)
		}
	}
	return result
}
