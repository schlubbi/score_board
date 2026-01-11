package service

import (
	"context"
	"fmt"

	"github.com/schlubbi/score_board/internal/model"
	"github.com/schlubbi/score_board/internal/repository"
	"github.com/schlubbi/score_board/internal/scraper"
)

// Service orchestrates scraping and repository updates.
type Service struct {
	scraper *scraper.Scraper
	repo    *repository.Repository
	groups  []model.GroupConfig
}

// New creates a Service instance.
func New(scraper *scraper.Scraper, repo *repository.Repository, groups []model.GroupConfig) *Service {
	return &Service{scraper: scraper, repo: repo, groups: groups}
}

// Refresh scrapes every configured group and updates the repository.
func (s *Service) Refresh(ctx context.Context) error {
	snapshots := make([]model.GroupSnapshot, 0, len(s.groups))
	for _, cfg := range s.groups {
		snap, err := s.scraper.FetchGroup(ctx, cfg)
		if err != nil {
			return fmt.Errorf("fetch %s: %w", cfg.ID, err)
		}
		snapshots = append(snapshots, snap)
	}

	s.repo.Replace(snapshots)
	return nil
}

// Repository exposes the underlying repository.
func (s *Service) Repository() *repository.Repository {
	return s.repo
}

// Groups returns the configured groups.
func (s *Service) Groups() []model.GroupConfig {
	return s.groups
}
