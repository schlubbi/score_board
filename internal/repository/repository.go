package repository

import (
	"sort"
	"sync"
	"time"

	"github.com/schlubbi/score_board/internal/model"
)

// Repository keeps the latest scrape snapshots in memory.
type Repository struct {
	mu     sync.RWMutex
	groups map[string]model.GroupSnapshot
}

// New creates an empty repository.
func New() *Repository {
	return &Repository{groups: make(map[string]model.GroupSnapshot)}
}

// Replace fully swaps the in-memory snapshots with the provided ones.
func (r *Repository) Replace(snaps []model.GroupSnapshot) {
	r.mu.Lock()
	defer r.mu.Unlock()

	next := make(map[string]model.GroupSnapshot, len(snaps))
	for _, snap := range snaps {
		next[snap.Config.ID] = snap
	}

	r.groups = next
}

// Summaries returns the summary list sorted by group id.
func (r *Repository) Summaries() []model.GroupSummary {
	r.mu.RLock()
	defer r.mu.RUnlock()

	summaries := make([]model.GroupSummary, 0, len(r.groups))
	for _, snap := range r.groups {
		summaries = append(summaries, model.GroupSummary{
			ID:          snap.Config.ID,
			Name:        snap.Config.Name,
			StaffelID:   snap.Config.StaffelID,
			LastUpdated: snap.ScrapedAt,
			TeamCount:   len(snap.Teams),
		})
	}

	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].ID < summaries[j].ID
	})

	return summaries
}

// Snapshot returns the snapshot for a given group if it exists.
func (r *Repository) Snapshot(groupID string) (model.GroupSnapshot, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	snap, ok := r.groups[groupID]
	return snap, ok
}

// Snapshots returns all snapshots as a slice copy.
func (r *Repository) Snapshots() []model.GroupSnapshot {
	r.mu.RLock()
	defer r.mu.RUnlock()

	snaps := make([]model.GroupSnapshot, 0, len(r.groups))
	for _, snap := range r.groups {
		snaps = append(snaps, snap)
	}
	return snaps
}

// AllTeams flattens all group snapshots into a slice of team stats.
func (r *Repository) AllTeams() []model.TeamStats {
	r.mu.RLock()
	defer r.mu.RUnlock()

	teams := make([]model.TeamStats, 0)
	for _, snap := range r.groups {
		teams = append(teams, snap.Teams...)
	}
	return teams
}

// LastUpdated returns the latest scrape timestamp.
func (r *Repository) LastUpdated() time.Time {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var latest time.Time
	for _, snap := range r.groups {
		if snap.ScrapedAt.After(latest) {
			latest = snap.ScrapedAt
		}
	}
	return latest
}
