package api

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/schlubbi/score_board/internal/model"
	"github.com/schlubbi/score_board/internal/power"
	"github.com/schlubbi/score_board/internal/recommendation"
	"github.com/schlubbi/score_board/internal/service"
)

// Handler wires HTTP routes to the underlying service.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes wires the handler to the provided router.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/healthz", h.handleHealth)

	r.Route("/api", func(r chi.Router) {
		r.Get("/groups", h.handleListGroups)
		r.Get("/groups/{groupID}", h.handleGroupDetail)
		r.Get("/groups/{groupID}/teams/{teamID}/matches", h.handleTeamMatches)
		r.Get("/overall", h.handleOverall)
		r.Get("/overall/elo", h.handleOverallElo)
		r.Get("/indoor/groups", h.handleIndoorGroups)
		r.Get("/indoor/overall", h.handleIndoorOverall)
		r.Get("/recommendations/simple", h.handleSimpleRecommendation)
		r.Post("/refresh", h.handleRefresh)
	})
}

func (h *Handler) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) handleListGroups(w http.ResponseWriter, r *http.Request) {
	repo := h.svc.Repository()
	writeJSON(w, http.StatusOK, map[string]any{"groups": repo.Summaries()})
}

func (h *Handler) handleGroupDetail(w http.ResponseWriter, r *http.Request) {
	groupID := normalizeGroupID(chi.URLParam(r, "groupID"))
	repo := h.svc.Repository()
	snap, ok := repo.Snapshot(groupID)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "group not found"})
		return
	}

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
		teamPowers = append(teamPowers, model.TeamPower{
			Team:           team,
			GroupMetrics:   groupMetrics[team.TeamID],
			OverallMetrics: overallMetrics[team.TeamID],
		})
	}

	resp := map[string]any{
		"group": model.GroupSummary{
			ID:          snap.Config.ID,
			Name:        snap.Config.Name,
			StaffelID:   snap.Config.StaffelID,
			LastUpdated: snap.ScrapedAt,
			TeamCount:   len(snap.Teams),
		},
		"teams": teamPowers,
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) handleTeamMatches(w http.ResponseWriter, r *http.Request) {
	groupID := normalizeGroupID(chi.URLParam(r, "groupID"))
	teamID := strings.TrimSpace(chi.URLParam(r, "teamID"))
	if teamID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "teamID required"})
		return
	}

	repo := h.svc.Repository()
	snap, ok := repo.Snapshot(groupID)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "group not found"})
		return
	}

	filtered := filterTeamMatches(snap.Matches, teamID)

	if len(filtered) == 0 {
		if refreshed, err := h.svc.RefreshGroup(r.Context(), groupID); err == nil {
			snap = refreshed
			filtered = filterTeamMatches(refreshed.Matches, teamID)
		}
	}

	sort.SliceStable(filtered, func(i, j int) bool {
		return filtered[i].ID < filtered[j].ID
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"group": map[string]string{
			"id":   snap.Config.ID,
			"name": snap.Config.Name,
		},
		"teamId":  teamID,
		"count":   len(filtered),
		"matches": filtered,
	})
}

func (h *Handler) handleOverall(w http.ResponseWriter, r *http.Request) {
	repo := h.svc.Repository()
	teams := repo.AllTeams()
	overallMetrics := power.ComputeMetrics(teams)

	// Build group metrics per group for reference.
	groupMetricMap := buildGroupMetricMap(repo.Snapshots())

	teamPowers := make([]model.TeamPower, 0, len(teams))
	for _, team := range teams {
		groupMetrics := groupMetricMap[team.GroupID][team.TeamID]
		teamPowers = append(teamPowers, model.TeamPower{
			Team:           team,
			GroupMetrics:   groupMetrics,
			OverallMetrics: overallMetrics[team.TeamID],
		})
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

	resp := map[string]any{
		"updatedAt": repo.LastUpdated(),
		"teams":     teamPowers,
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) handleOverallElo(w http.ResponseWriter, r *http.Request) {
	repo := h.svc.Repository()
	snaps := repo.Snapshots()

	allMatches := make([]model.MatchResult, 0)
	for _, snap := range snaps {
		allMatches = append(allMatches, snap.Matches...)
	}
	if len(allMatches) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "no matches available"})
		return
	}

	sort.SliceStable(allMatches, func(i, j int) bool {
		return allMatches[i].ID < allMatches[j].ID
	})

	elo := power.ComputeElo(allMatches, 1500, 20)
	teams := repo.AllTeams()

	type teamElo struct {
		Team  model.TeamStats `json:"team"`
		Elo   float64         `json:"elo"`
		Games int             `json:"games"`
	}

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

	writeJSON(w, http.StatusOK, map[string]any{
		"updatedAt": repo.LastUpdated(),
		"teams":     entries,
	})
}

func (h *Handler) handleIndoorGroups(w http.ResponseWriter, r *http.Request) {
	repo := h.svc.IndoorRepository()
	if repo == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "indoor repository not configured"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"groups": repo.Summaries()})
}

func (h *Handler) handleIndoorOverall(w http.ResponseWriter, r *http.Request) {
	repo := h.svc.IndoorRepository()
	if repo == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "indoor repository not configured"})
		return
	}
	teams := repo.AllTeams()
	if len(teams) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "no indoor teams available"})
		return
	}

	overallMetrics := power.ComputeMetrics(teams)
	groupMetricMap := buildGroupMetricMap(repo.Snapshots())

	teamPowers := make([]model.TeamPower, 0, len(teams))
	for _, team := range teams {
		groupMetrics := groupMetricMap[team.GroupID][team.TeamID]
		teamPowers = append(teamPowers, model.TeamPower{
			Team:           team,
			GroupMetrics:   groupMetrics,
			OverallMetrics: overallMetrics[team.TeamID],
		})
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

	resp := map[string]any{
		"updatedAt": repo.LastUpdated(),
		"teams":     teamPowers,
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) handleSimpleRecommendation(w http.ResponseWriter, r *http.Request) {
	repo := h.svc.Repository()
	teams := repo.AllTeams()
	if len(teams) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "no teams available"})
		return
	}

	overallMetrics := power.ComputeMetrics(teams)
	groupMetricMap := buildGroupMetricMap(repo.Snapshots())

	teamPowers := make([]model.TeamPower, 0, len(teams))
	for _, team := range teams {
		gMetrics := groupMetricMap[team.GroupID][team.TeamID]
		teamPowers = append(teamPowers, model.TeamPower{
			Team:           team,
			GroupMetrics:   gMetrics,
			OverallMetrics: overallMetrics[team.TeamID],
		})
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

	groupCount := len(h.svc.Groups())
	if groupCount == 0 {
		groupCount = 1
	}

	groups := recommendation.SimpleBalancedGroups(teamPowers, groupCount)
	resp := map[string]any{
		"generatedAt": time.Now().UTC(),
		"totalTeams":  len(teamPowers),
		"groupCount":  groupCount,
		"groups":      groups,
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) handleRefresh(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Refresh(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if err := h.svc.RefreshIndoor(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	h.handleListGroups(w, r)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
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

func normalizeGroupID(input string) string {
	input = strings.TrimSpace(strings.ToLower(input))
	if input == "" {
		return ""
	}

	if strings.HasPrefix(input, "group") {
		suffix := strings.TrimPrefix(input, "group")
		if suffix != "" && isNumeric(suffix) {
			return "group" + suffix
		}
		return input
	}

	if isNumeric(input) {
		return "group" + input
	}

	return input
}

func isNumeric(v string) bool {
	_, err := strconv.Atoi(v)
	return err == nil
}
