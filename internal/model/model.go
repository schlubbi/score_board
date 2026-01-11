package model

import "time"

// GroupConfig describes a competition group that we can scrape.
type GroupConfig struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	StaffelID string `json:"staffelId"`
}

// GroupSnapshot stores the raw scrape result for a group.
type GroupSnapshot struct {
	Config    GroupConfig
	Teams     []TeamStats
	Matches   []MatchResult
	ScrapedAt time.Time
}

// GroupSummary is a lightweight view exposed via the API.
type GroupSummary struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	StaffelID   string    `json:"staffelId"`
	LastUpdated time.Time `json:"lastUpdated"`
	TeamCount   int       `json:"teamCount"`
}

// TeamStats captures the raw stats pulled from the fussball.de table.
type TeamStats struct {
	GroupID      string    `json:"groupId"`
	GroupName    string    `json:"groupName"`
	StaffelID    string    `json:"staffelId"`
	TeamID       string    `json:"teamId"`
	TeamName     string    `json:"teamName"`
	LogoURL      string    `json:"logoUrl,omitempty"`
	Rank         int       `json:"rank"`
	Games        int       `json:"games"`
	Wins         int       `json:"wins"`
	Draws        int       `json:"draws"`
	Losses       int       `json:"losses"`
	GoalsFor     int       `json:"goalsFor"`
	GoalsAgainst int       `json:"goalsAgainst"`
	GoalDiff     int       `json:"goalDiff"`
	Points       int       `json:"points"`
	ScrapedAt    time.Time `json:"scrapedAt"`
}

// MetricSet represents both raw and normalized values together.
type MetricSet struct {
	Offense    float64       `json:"offense"`
	Defense    float64       `json:"defense"`
	Dominance  float64       `json:"dominance"`
	Normalized NormalizedSet `json:"normalized"`
	PowerScore float64       `json:"powerScore"`
}

// NormalizedSet stores 0..1 normalized metrics.
type NormalizedSet struct {
	Offense   float64 `json:"offense"`
	Defense   float64 `json:"defense"`
	Dominance float64 `json:"dominance"`
}

// TeamPower couples a team with both group-level and overall metrics.
type TeamPower struct {
	Team           TeamStats `json:"team"`
	GroupMetrics   MetricSet `json:"groupMetrics"`
	OverallMetrics MetricSet `json:"overallMetrics"`
}
