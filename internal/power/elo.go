package power

import (
	"math"

	"github.com/schlubbi/score_board/internal/model"
)

type EloResult struct {
	Rating float64
	Games  int
}

// ComputeElo computes a simple Elo rating for each team based on played matches.
// Note: without inter-group matches, Elo cannot fully calibrate group strength,
// but it is still useful to compare methods side-by-side.
func ComputeElo(matches []model.MatchResult, initialRating, kFactor float64) map[string]EloResult {
	ratings := make(map[string]EloResult)

	get := func(teamID string) EloResult {
		if r, ok := ratings[teamID]; ok {
			return r
		}
		return EloResult{Rating: initialRating}
	}

	for _, m := range matches {
		if !m.Played() {
			continue
		}
		if m.HomeTeamID == "" || m.AwayTeamID == "" {
			continue
		}

		ra := get(m.HomeTeamID)
		rb := get(m.AwayTeamID)

		expectedA := 1.0 / (1.0 + math.Pow(10, (rb.Rating-ra.Rating)/400.0))
		actualA := 0.5
		goalDiff := m.HomeScore - m.AwayScore
		switch {
		case goalDiff > 0:
			actualA = 1
		case goalDiff < 0:
			actualA = 0
		}

		mult := 1.0
		if actualA != 0.5 {
			d := math.Abs(float64(goalDiff))
			if d > 1 {
				mult = 1 + 0.5*(d-1)
				if mult > 3 {
					mult = 3
				}
			}
		}

		delta := kFactor * mult * (actualA - expectedA)
		ra.Rating += delta
		rb.Rating -= delta
		ra.Games++
		rb.Games++

		ratings[m.HomeTeamID] = ra
		ratings[m.AwayTeamID] = rb
	}

	return ratings
}
