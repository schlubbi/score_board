package api

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/schlubbi/score_board/internal/model"
	"github.com/schlubbi/score_board/internal/power"
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
		r.Get("/overall", h.handleOverall)
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

func (h *Handler) handleOverall(w http.ResponseWriter, r *http.Request) {
	repo := h.svc.Repository()
	teams := repo.AllTeams()
	overallMetrics := power.ComputeMetrics(teams)

	// Build group metrics per group for reference.
	groupSnapshots := repo.Snapshots()
	groupMetricMap := make(map[string]map[string]model.MetricSet)
	for _, snap := range groupSnapshots {
		metrics := power.ComputeMetrics(snap.Teams)
		groupMetricMap[snap.Config.ID] = metrics
	}

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

func (h *Handler) handleRefresh(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Refresh(r.Context()); err != nil {
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
