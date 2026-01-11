package scraper

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
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
	matchURLTemplate      = "https://www.fussball.de/spiel/-/-/spiel/%s"
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
	matchIDs := collectMatchIDs(crossDoc)
	matches, err := s.fetchMatches(ctx, cfg, matchIDs)
	if err != nil {
		return model.GroupSnapshot{}, err
	}

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

func collectMatchIDs(doc *goquery.Document) []string {
	seen := make(map[string]struct{})
	doc.Find("a[href*=\"/spiel/\"]").Each(func(_ int, sel *goquery.Selection) {
		href, ok := sel.Attr("href")
		if !ok {
			return
		}
		id := parseMatchID(href)
		if id == "" {
			return
		}
		seen[id] = struct{}{}
	})
	ids := make([]string, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	return ids
}

func (s *Scraper) fetchMatches(ctx context.Context, cfg model.GroupConfig, ids []string) ([]model.MatchResult, error) {
	results := make([]model.MatchResult, 0, len(ids))
	seen := make(map[string]struct{})
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}

		match, err := s.fetchMatch(ctx, cfg, id)
		if err != nil {
			return nil, err
		}
		results = append(results, match)
	}
	return results, nil
}

func (s *Scraper) fetchMatch(ctx context.Context, cfg model.GroupConfig, id string) (model.MatchResult, error) {
	url := fmt.Sprintf(matchURLTemplate, id)
	doc, err := s.fetchDocument(ctx, url)
	if err != nil {
		return model.MatchResult{}, err
	}

	homeLink := doc.Find(".match-stage .team-home .team-name a")
	awayLink := doc.Find(".match-stage .team-away .team-name a")
	homeName := strings.TrimSpace(homeLink.Text())
	awayName := strings.TrimSpace(awayLink.Text())
	homeTeamID := parseTeamID(getAttr(homeLink, "href"))
	awayTeamID := parseTeamID(getAttr(awayLink, "href"))

	resultSel := doc.Find(".match-stage .result .end-result")
	var (
		homeGoals int
		awayGoals int
		status    = model.MatchStatusPlayed
		note      string
	)

	if info := resultSel.Find(".info-text"); info.Length() > 0 {
		status = model.MatchStatusNotPlayed
		note = strings.TrimSpace(info.Text())
	} else {
		leftScore, leftOK, err := s.decodeScoreSpan(resultSel.Find(".score-left"))
		if err != nil {
			return model.MatchResult{}, err
		}
		rightScore, rightOK, err := s.decodeScoreSpan(resultSel.Find(".score-right"))
		if err != nil {
			return model.MatchResult{}, err
		}
		if !leftOK || !rightOK {
			status = model.MatchStatusNotPlayed
			note = "not available"
		} else {
			homeGoals = leftScore
			awayGoals = rightScore
		}
	}

	return model.MatchResult{
		ID:         id,
		GroupID:    cfg.ID,
		StaffelID:  cfg.StaffelID,
		HomeTeamID: homeTeamID,
		HomeTeam:   homeName,
		AwayTeamID: awayTeamID,
		AwayTeam:   awayName,
		HomeScore:  homeGoals,
		AwayScore:  awayGoals,
		Status:     status,
		Note:       note,
		URL:        url,
	}, nil
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

func getAttr(sel *goquery.Selection, attr string) string {
	v, _ := sel.Attr(attr)
	return v
}
