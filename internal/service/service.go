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

	repo       *repository.Repository
	groups     []model.GroupConfig
	configByID map[string]model.GroupConfig

	indoorRepo            *repository.Repository
	indoorTournamentStaffel string
}

// New creates a Service instance.
func New(scraper *scraper.Scraper, repo *repository.Repository, groups []model.GroupConfig, indoorRepo *repository.Repository, indoorTournamentStaffel string) *Service {
	cfgByID := make(map[string]model.GroupConfig, len(groups))
	for _, cfg := range groups {
		cfgByID[cfg.ID] = cfg
	}
	return &Service{
		scraper:                scraper,
		repo:                   repo,
		groups:                 groups,
		configByID:             cfgByID,
		indoorRepo:             indoorRepo,
		indoorTournamentStaffel: indoorTournamentStaffel,
	}
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

// RefreshIndoor discovers all tournament groups behind the expandable headers and scrapes them.
func (s *Service) RefreshIndoor(ctx context.Context) error {
	if s.indoorRepo == nil || s.indoorTournamentStaffel == "" {
		return nil
	}

	cfgs, err := s.scraper.DiscoverTournamentGroups(ctx, s.indoorTournamentStaffel)
	if err != nil {
		return err
	}

	snapshots := make([]model.GroupSnapshot, 0, len(cfgs))
	for _, cfg := range cfgs {
		snap, err := s.scraper.FetchGroup(ctx, cfg)
		if err != nil {
			return fmt.Errorf("fetch indoor %s: %w", cfg.ID, err)
		}
		snapshots = append(snapshots, snap)
	}

	s.indoorRepo.Replace(snapshots)
	return nil
}

// RefreshGroup refreshes a single group and updates the repository.
func (s *Service) RefreshGroup(ctx context.Context, groupID string) (model.GroupSnapshot, error) {
	cfg, ok := s.configByID[groupID]
	if !ok {
		return model.GroupSnapshot{}, fmt.Errorf("unknown group %s", groupID)
	}

	snap, err := s.scraper.FetchGroup(ctx, cfg)
	if err != nil {
		return model.GroupSnapshot{}, err
	}

	s.repo.Upsert(snap)
	return snap, nil
}

// Repository exposes the underlying league repository.
func (s *Service) Repository() *repository.Repository {
	return s.repo
}

// IndoorRepository exposes the indoor tournament repository.
func (s *Service) IndoorRepository() *repository.Repository {
	return s.indoorRepo
}

// Groups returns the configured league groups.
func (s *Service) Groups() []model.GroupConfig {
	return s.groups
}
