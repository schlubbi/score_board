package recommendation

import (
	"strconv"
	"strings"

	"github.com/schlubbi/score_board/internal/model"
)

// Group represents a simple grouping suggestion.
type Group struct {
	Index int               `json:"index"`
	Teams []model.TeamPower `json:"teams"`
}

// SimpleBalancedGroups splits sortedTeams into numGroups buckets, distributing
// the remainder to the first buckets, and avoids placing teams from the same club
// (detected via base name) into the same bucket when possible.
func SimpleBalancedGroups(sortedTeams []model.TeamPower, numGroups int) []Group {
	if numGroups <= 0 {
		numGroups = 1
	}

	total := len(sortedTeams)
	targetSizes := make([]int, numGroups)
	base := total / numGroups
	remainder := total % numGroups
	for i := range targetSizes {
		targetSizes[i] = base
		if i < remainder {
			targetSizes[i]++
		}
	}

	groupAssignments := make([][]model.TeamPower, numGroups)
	clubSets := make([]map[string]struct{}, numGroups)
	for i := range clubSets {
		clubSets[i] = make(map[string]struct{})
	}

	assignToGroup := func(team model.TeamPower, groupIdx int) {
		groupAssignments[groupIdx] = append(groupAssignments[groupIdx], team)
		key := baseClubKey(team.Team.TeamName)
		if key != "" {
			clubSets[groupIdx][key] = struct{}{}
		}
	}

	for _, team := range sortedTeams {
		key := baseClubKey(team.Team.TeamName)
		placed := false

		for idx := range groupAssignments {
			if len(groupAssignments[idx]) >= targetSizes[idx] {
				continue
			}
			if key == "" {
				assignToGroup(team, idx)
				placed = true
				break
			}
			if _, exists := clubSets[idx][key]; !exists {
				assignToGroup(team, idx)
				placed = true
				break
			}
		}

		if !placed {
			for idx := range groupAssignments {
				if len(groupAssignments[idx]) >= targetSizes[idx] {
					continue
				}
				assignToGroup(team, idx)
				break
			}
		}
	}

	result := make([]Group, 0, numGroups)
	for i, teams := range groupAssignments {
		result = append(result, Group{
			Index: i + 1,
			Teams: teams,
		})
	}
	return result
}

func baseClubKey(name string) string {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return ""
	}
	tokens := strings.Fields(lower)
	if len(tokens) == 0 {
		return lower
	}

	roman := map[string]struct{}{
		"i":    {},
		"ii":   {},
		"iii":  {},
		"iv":   {},
		"v":    {},
		"vi":   {},
		"vii":  {},
		"viii": {},
		"ix":   {},
		"x":    {},
	}

	for len(tokens) > 1 {
		last := tokens[len(tokens)-1]
		if _, ok := roman[last]; ok {
			tokens = tokens[:len(tokens)-1]
			continue
		}
		if _, err := strconv.Atoi(last); err == nil {
			tokens = tokens[:len(tokens)-1]
			continue
		}
		break
	}

	return strings.Join(tokens, " ")
}
