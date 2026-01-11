package scraper

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/schlubbi/score_board/internal/model"
	"github.com/schlubbi/score_board/internal/obfuscation"
)

// tableURLTemplate targets the season table (no specific matchday) to capture full stats.
const (
	tableURLTemplate      = "https://www.fussball.de/ajax.table/-/staffel/%s"
	crossTableURLTemplate = "https://www.fussball.de/ajax.table.cross/-/staffel/%s"
)

var (
	teamIDRegex  = regexp.MustCompile(`team-id/([A-Z0-9]+)/?`)
	matchIDRegex = regexp.MustCompile(`/spiel/([A-Z0-9]+)/?`)
)

// Scraper downloads and parses table data for a group.
type Scraper struct {
	client  *http.Client
	decoder *obfuscation.Decoder
}

// New creates a scraper. If client is nil, a default client is used.
func New(client *http.Client) *Scraper {
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	return &Scraper{
		client:  client,
		decoder: obfuscation.New(client),
	}
}

// FetchGroup loads the standings table for the provided config.
func (s *Scraper) FetchGroup(ctx context.Context, cfg model.GroupConfig) (model.GroupSnapshot, error) {
	tableDoc, err := s.fetchDocument(ctx, fmt.Sprintf(tableURLTemplate, cfg.StaffelID))
	if err != nil {
		return model.GroupSnapshot{}, err
	}

	teams := make([]model.TeamStats, 0)
	tableDoc.Find("table.table tbody tr").Each(func(_ int, sel *goquery.Selection) {
		team, ok := extractTeam(sel, cfg)
		if ok {
			teams = append(teams, team)
		}
	})

	crossDoc, err := s.fetchDocument(ctx, fmt.Sprintf(crossTableURLTemplate, cfg.StaffelID))
	if err != nil {
		return model.GroupSnapshot{}, err
	}
	matches := s.parseCrossTableMatches(crossDoc, cfg)

	teams = model.ApplyMatchAggregates(teams, matches)

	snap := model.GroupSnapshot{
		Config: model.GroupConfig{
			ID:        cfg.ID,
			Name:      cfg.Name,
			StaffelID: cfg.StaffelID,
		},
		Teams:     teams,
		Matches:   matches,
		ScrapedAt: time.Now().UTC(),
	}
	return snap, nil
}

func extractTeam(sel *goquery.Selection, cfg model.GroupConfig) (model.TeamStats, bool) {
	cols := sel.Find("td")
	if cols.Length() < 10 {
		return model.TeamStats{}, false
	}

	rankText := strings.TrimSpace(cols.Eq(1).Text())
	rank := parseInt(strings.TrimSuffix(rankText, "."))

	clubCell := cols.Eq(2)
	logoURL, _ := clubCell.Find(".club-logo img").Attr("src")
	logoURL = strings.TrimSpace(logoURL)
	if strings.HasPrefix(logoURL, "//") {
		logoURL = "https:" + logoURL
	}

	name := strings.TrimSpace(clubCell.Find(".club-name").Text())
	if name == "" {
		return model.TeamStats{}, false
	}

	href, _ := clubCell.Find("a").Attr("href")
	teamID := parseTeamID(href)

	games := parseInt(cols.Eq(3).Text())
	wins := parseInt(cols.Eq(4).Text())
	draws := parseInt(cols.Eq(5).Text())
	losses := parseInt(cols.Eq(6).Text())
	goalsFor, goalsAgainst := parseGoals(cols.Eq(7).Text())
	goalDiff := parseInt(cols.Eq(8).Text())
	points := parseInt(cols.Eq(9).Text())

	return model.TeamStats{
		GroupID:      cfg.ID,
		GroupName:    cfg.Name,
		StaffelID:    cfg.StaffelID,
		TeamID:       teamID,
		TeamName:     name,
		LogoURL:      logoURL,
		Rank:         rank,
		Games:        games,
		Wins:         wins,
		Draws:        draws,
		Losses:       losses,
		GoalsFor:     goalsFor,
		GoalsAgainst: goalsAgainst,
		GoalDiff:     goalDiff,
		Points:       points,
		ScrapedAt:    time.Now().UTC(),
	}, true
}

func parseTeamID(href string) string {
	matches := teamIDRegex.FindStringSubmatch(href)
	if len(matches) == 2 {
		return matches[1]
	}
	return href
}

func parseMatchID(href string) string {
	if href == "" {
		return ""
	}
	if idx := strings.LastIndex(href, "/-/spiel/"); idx >= 0 {
		id := href[idx+len("/-/spiel/"):]
		id = strings.Trim(id, "/")
		return id
	}
	matches := matchIDRegex.FindStringSubmatch(href)
	if len(matches) == 2 {
		return matches[1]
	}
	return ""
}

func parseInt(val string) int {
	val = strings.TrimSpace(val)
	if val == "" {
		return 0
	}
	i, err := strconv.Atoi(val)
	if err != nil {
		return 0
	}
	return i
}

func parseGoals(val string) (int, int) {
	parts := strings.Split(val, ":")
	if len(parts) != 2 {
		return 0, 0
	}
	left := parseInt(parts[0])
	right := parseInt(parts[1])
	return left, right
}

func (s *Scraper) fetchDocument(ctx context.Context, url string) (*goquery.Document, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "score-board-mvp/0.1 (+https://github.com/schlubbi/score_board)")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}
	return doc, nil
}

func (s *Scraper) decodeScoreSpan(sel *goquery.Selection) (int, bool, error) {
	decoded, err := s.decodeObfuscated(sel)
	if err != nil {
		return 0, false, err
	}
	decoded = strings.TrimSpace(decoded)
	if decoded == "" {
		return 0, false, nil
	}
	val, err := strconv.Atoi(decoded)
	if err != nil {
		return 0, false, nil
	}
	return val, true, nil
}

func (s *Scraper) decodeObfuscated(sel *goquery.Selection) (string, error) {
	text := sel.Text()
	if text == "" {
		return "", nil
	}
	id, ok := sel.Attr("data-obfuscation")
	if !ok {
		return strings.TrimSpace(text), nil
	}
	decoded, err := s.decoder.Decode(id, text)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(decoded), nil
}

type crossTeam struct {
	ID   string
	Name string
}

func extractCrossTeams(doc *goquery.Document) []crossTeam {
	teams := make([]crossTeam, 0)
	doc.Find(".cross-table-teams-container table tbody tr").Each(func(_ int, row *goquery.Selection) {
		anchor := row.Find("a")
		if anchor.Length() == 0 {
			return
		}
		href, _ := anchor.Attr("href")
		id := parseTeamID(href)
		name := strings.TrimSpace(anchor.Find(".club-name").Text())
		if id == "" || name == "" {
			return
		}
		teams = append(teams, crossTeam{
			ID:   id,
			Name: name,
		})
	})
	return teams
}

func (s *Scraper) parseCrossTableMatches(doc *goquery.Document, cfg model.GroupConfig) []model.MatchResult {
	teams := extractCrossTeams(doc)
	if len(teams) == 0 {
		return nil
	}

	matches := make([]model.MatchResult, 0)
	seen := make(map[string]struct{})

	doc.Find("table.cross-table tbody tr").Each(func(i int, row *goquery.Selection) {
		if i >= len(teams) {
			return
		}
		homeTeam := teams[i]
		row.Find("td").Each(func(j int, cell *goquery.Selection) {
			if j >= len(teams) {
				return
			}
			awayTeam := teams[j]
			if homeTeam.ID == "" || awayTeam.ID == "" || homeTeam.ID == awayTeam.ID {
				return
			}

			link := cell.Find("a")
			if link.Length() == 0 {
				return
			}

			href, _ := link.Attr("href")
			matchID := parseMatchID(href)
			if matchID == "" {
				return
			}
			if _, ok := seen[matchID]; ok {
				return
			}
			seen[matchID] = struct{}{}

			note := strings.TrimSpace(link.Find(".info-text").Text())
			status := model.MatchStatusPlayed
			if note != "" {
				status = model.MatchStatusNotPlayed
			}

			homeScore, homeOK, _ := s.decodeScoreSpan(link.Find(".score-left"))
			awayScore, awayOK, _ := s.decodeScoreSpan(link.Find(".score-right"))
			if !homeOK || !awayOK {
				status = model.MatchStatusNotPlayed
				homeScore = 0
				awayScore = 0
			}

			matches = append(matches, model.MatchResult{
				ID:         matchID,
				GroupID:    cfg.ID,
				StaffelID:  cfg.StaffelID,
				HomeTeamID: homeTeam.ID,
				HomeTeam:   homeTeam.Name,
				AwayTeamID: awayTeam.ID,
				AwayTeam:   awayTeam.Name,
				HomeScore:  homeScore,
				AwayScore:  awayScore,
				Status:     status,
				Note:       note,
				URL:        href,
			})
		})
	})

	return matches
}

var (
	matchdayRegex   = regexp.MustCompile(`(?i)(\d+)\.\s*spieltag`)
	matchDateRegex  = regexp.MustCompile(`/spieldatum/(\d{4}-\d{2}-\d{2})/`)
)

// EnrichMatchMetadata loads the match pages and tries to extract matchday + match date.
// This is intentionally best-effort (network hiccups should not fail the overall scrape).
func (s *Scraper) EnrichMatchMetadata(ctx context.Context, matches []model.MatchResult) []model.MatchResult {
	out := make([]model.MatchResult, len(matches))
	copy(out, matches)

	for i := range out {
		m := out[i]
		if m.URL == "" {
			continue
		}
		if m.MatchDate != "" && m.MatchdayTag != "" {
			continue
		}

		url := strings.TrimSpace(m.URL)
		if strings.HasPrefix(url, "//") {
			url = "https:" + url
		}
		if strings.HasPrefix(url, "/") {
			url = "https://www.fussball.de" + url
		}

		doc, err := s.fetchDocument(ctx, url)
		if err != nil {
			continue
		}

		if m.MatchDate == "" {
			anchor := doc.Find("a[href*='/spieldatum/']").First()
			if anchor.Length() > 0 {
				href, _ := anchor.Attr("href")
				if mm := matchDateRegex.FindStringSubmatch(href); len(mm) == 2 {
					m.MatchDate = mm[1]
				}
			}
		}

		if m.MatchdayTag == "" {
			doc.Find("li.row").Each(func(_ int, row *goquery.Selection) {
				if m.MatchdayTag != "" {
					return
				}
				label := strings.TrimSpace(row.Find("span").First().Text())
				if label != "Spiel:" {
					return
				}
				value := strings.TrimSpace(row.Find("span").Eq(1).Text())
				if mm := matchdayRegex.FindStringSubmatch(value); len(mm) == 2 {
					m.MatchdayTag = mm[1]
				}
			})
		}

		out[i] = m
	}

	return out
}

const tournamentURLTemplate = "https://www.fussball.de/spieltagsuebersicht/-/staffel/%s"

var (
	tournamentStaffelRegex = regexp.MustCompile(`staffel/([A-Z0-9-]+)`) // reused for ajax links
	tournamentGroupNum     = regexp.MustCompile(`(?i)gr\.\s*(\d+)`)
)

// DiscoverTournamentGroups scrapes the tournament overview page and returns the
// embedded group staffel IDs (e.g. "E - Junioren Gr. 1"), which are otherwise only
// loaded after clicking the headers.
func (s *Scraper) DiscoverTournamentGroups(ctx context.Context, tournamentStaffelID string) ([]model.GroupConfig, error) {
	doc, err := s.fetchDocument(ctx, fmt.Sprintf(tournamentURLTemplate, tournamentStaffelID))
	if err != nil {
		return nil, err
	}

	seen := make(map[string]model.GroupConfig)
	doc.Find("a[data-ajax-resource*='ajax.fixtures.tournament']").Each(func(_ int, sel *goquery.Selection) {
		label := strings.TrimSpace(sel.Find("span").First().Text())
		if label == "" {
			return
		}
		norm := strings.ToLower(label)
		if !strings.Contains(norm, "e - junioren") && !strings.Contains(norm, "e-junioren") {
			return
		}

		resource, _ := sel.Attr("data-ajax-resource")
		if resource == "" {
			resource, _ = sel.Attr("href")
		}
		staffelID := extractStaffelID(resource)
		if staffelID == "" {
			target, _ := sel.Attr("data-ajax-target")
			staffelID = extractStaffelID(target)
		}
		if staffelID == "" {
			return
		}

		id := "indoor-" + staffelID
		if m := tournamentGroupNum.FindStringSubmatch(label); len(m) == 2 {
			id = "indoor-group" + m[1]
		}

		seen[staffelID] = model.GroupConfig{ID: id, Name: label, StaffelID: staffelID}
	})

	if len(seen) == 0 {
		return nil, fmt.Errorf("no tournament groups discovered")
	}

	cfgs := make([]model.GroupConfig, 0, len(seen))
	for _, cfg := range seen {
		cfgs = append(cfgs, cfg)
	}

	sort.Slice(cfgs, func(i, j int) bool {
		return cfgs[i].ID < cfgs[j].ID
	})

	return cfgs, nil
}

func extractStaffelID(input string) string {
	matches := tournamentStaffelRegex.FindStringSubmatch(input)
	if len(matches) == 2 {
		return matches[1]
	}
	return ""
}
