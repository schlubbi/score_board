package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/schlubbi/score_board/internal/groups"
	"github.com/schlubbi/score_board/internal/model"
	"github.com/schlubbi/score_board/internal/scraper"
)

func main() {
	teamQuery := flag.String("team", "", "team name (fuzzy match)")
	groupArg := flag.String("group", "", "group id or number (e.g., 2 or group2)")
	showMatches := flag.Bool("show-matches", true, "print individual matches")
	debug := flag.Bool("debug", false, "print every scraped match for the group")
	timeout := flag.Duration("timeout", 20*time.Second, "scrape timeout")
	flag.Parse()

	if strings.TrimSpace(*teamQuery) == "" {
		log.Fatal("please provide --team")
	}

	cfgs := groups.KasselEJugend()
	cfg, err := resolveGroupConfig(cfgs, *groupArg)
	if err != nil {
		log.Fatalf("resolve group: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	s := scraper.New(nil)
	snap, err := s.FetchGroup(ctx, model.GroupConfig{
		ID:        cfg.ID,
		Name:      cfg.Name,
		StaffelID: cfg.StaffelID,
	})
	if err != nil {
		log.Fatalf("scrape group %s failed: %v", cfg.ID, err)
	}

	team := findTeam(snap.Teams, *teamQuery)
	if team == nil {
		log.Fatalf("no team matched %q in %s", *teamQuery, cfg.Name)
	}

	printTeamSummary(*team, snap.Config.Name)

	if *debug {
		printGroupMatches(snap.Matches)
	}

	if *showMatches {
		fmt.Printf("Total matches scraped for group: %d\n", len(snap.Matches))
		matches := filterMatches(snap.Matches, team.TeamID)
		fmt.Printf("Matches found for %s: %d\n", team.TeamName, len(matches))
		printMatches(matches, team.TeamName)
	}
}

func resolveGroupConfig(cfgs []groups.Config, arg string) (groups.Config, error) {
	if strings.TrimSpace(arg) == "" {
		return cfgs[0], nil
	}

	arg = strings.ToLower(strings.TrimSpace(arg))
	if strings.HasPrefix(arg, "group") {
		arg = strings.TrimPrefix(arg, "group")
	}

	for _, cfg := range cfgs {
		id := strings.TrimPrefix(strings.ToLower(cfg.ID), "group")
		if id == arg {
			return cfg, nil
		}
		if strings.ToLower(cfg.ID) == strings.TrimSpace(strings.ToLower(arg)) {
			return cfg, nil
		}
		if strings.Contains(strings.ToLower(cfg.Name), arg) {
			return cfg, nil
		}
	}
	return groups.Config{}, fmt.Errorf("unknown group %q", arg)
}

func findTeam(teams []model.TeamStats, query string) *model.TeamStats {
	lq := strings.ToLower(strings.TrimSpace(query))
	var partial *model.TeamStats
	for i := range teams {
		name := strings.ToLower(strings.TrimSpace(teams[i].TeamName))
		if name == lq {
			return &teams[i]
		}
		if strings.Contains(name, lq) && partial == nil {
			partial = &teams[i]
		}
	}
	return partial
}

func printTeamSummary(team model.TeamStats, groupName string) {
	fmt.Printf("Team: %s (Group: %s)\n", team.TeamName, groupName)
	fmt.Printf("Games: %d  W:%d  D:%d  L:%d  GF:%d  GA:%d  GD:%d  Pts:%d\n",
		team.Games, team.Wins, team.Draws, team.Losses, team.GoalsFor, team.GoalsAgainst, team.GoalDiff, team.Points)
}

func filterMatches(matches []model.MatchResult, teamID string) []model.MatchResult {
	result := make([]model.MatchResult, 0)
	for _, match := range matches {
		if match.HomeTeamID == teamID || match.AwayTeamID == teamID {
			result = append(result, match)
		}
	}
	return result
}

func printMatches(matches []model.MatchResult, teamName string) {
	if len(matches) == 0 {
		fmt.Println("No matches found.")
		return
	}
	fmt.Printf("\nMatches for %s:\n", teamName)
	for _, m := range matches {
		fmt.Println(formatMatch(m))
	}
}

func printGroupMatches(matches []model.MatchResult) {
	fmt.Println("\nAll scraped matches:")
	for _, m := range matches {
		fmt.Printf("%s vs %s :: IDs (%s vs %s)\n", m.HomeTeam, m.AwayTeam, m.HomeTeamID, m.AwayTeamID)
	}
	fmt.Println()
}

func formatMatch(m model.MatchResult) string {
	if m.Status != model.MatchStatusPlayed {
		return fmt.Sprintf("%s vs %s :: %s (%s)", m.HomeTeam, m.AwayTeam, m.Status, m.Note)
	}
	return fmt.Sprintf("%s %d:%d %s  [%s]", m.HomeTeam, m.HomeScore, m.AwayScore, m.AwayTeam, m.URL)
}
