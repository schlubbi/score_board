package power

import (
	"math"

	"github.com/schlubbi/score_board/internal/model"
)

// ComputeMetrics returns power metrics normalized within the provided slice.
func ComputeMetrics(teams []model.TeamStats) map[string]model.MetricSet {
	metrics := make(map[string]model.MetricSet, len(teams))
	if len(teams) == 0 {
		return metrics
	}

	offenses := make([]float64, len(teams))
	defenses := make([]float64, len(teams))
	dominances := make([]float64, len(teams))
	valid := make([]bool, len(teams))

	for i, team := range teams {
		if team.Games <= 0 {
			valid[i] = false
			continue
		}
		valid[i] = true
		offense, defense, dominance := calculateRaw(team)
		offenses[i] = offense
		defenses[i] = defense
		dominances[i] = dominance
	}

	offenseNorm := normalize(offenses, valid)
	defenseNorm := normalize(defenses, valid)
	dominanceNorm := normalize(dominances, valid)

	for i, team := range teams {
		score := 0.0
		if valid[i] {
			score = 0.4*offenseNorm[i] + 0.4*defenseNorm[i] + 0.2*dominanceNorm[i]
		}
		metrics[team.TeamID] = model.MetricSet{
			Offense:   offenses[i],
			Defense:   defenses[i],
			Dominance: dominances[i],
			Normalized: model.NormalizedSet{
				Offense:   offenseNorm[i],
				Defense:   defenseNorm[i],
				Dominance: dominanceNorm[i],
			},
			PowerScore: score,
		}
	}

	return metrics
}

func calculateRaw(team model.TeamStats) (offense, defense, dominance float64) {
	if team.Games == 0 {
		return 0, 0, 0
	}

	games := float64(team.Games)
	offense = float64(team.GoalsFor) / games
	defense = 1 - (float64(team.GoalsAgainst) / games)
	dominance = float64(team.GoalsFor-team.GoalsAgainst) / games
	return offense, defense, dominance
}

func normalize(values []float64, valid []bool) []float64 {
	normalized := make([]float64, len(values))
	if len(values) == 0 {
		return normalized
	}

	minVal := math.Inf(1)
	maxVal := math.Inf(-1)
	hasValid := false
	for i, v := range values {
		if !valid[i] {
			continue
		}
		hasValid = true
		if v < minVal {
			minVal = v
		}
		if v > maxVal {
			maxVal = v
		}
	}

	if !hasValid {
		return normalized
	}

	rangeVal := maxVal - minVal
	if rangeVal == 0 {
		for i := range normalized {
			if valid[i] {
				normalized[i] = 0.5
			}
		}
		return normalized
	}

	for i, v := range values {
		if !valid[i] {
			normalized[i] = 0
			continue
		}
		normalized[i] = (v - minVal) / rangeVal
	}
	return normalized
}
