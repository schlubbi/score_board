package obfuscation

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"golang.org/x/image/font/sfnt"
)

const fontURLTemplate = "https://www.fussball.de/export.fontface/-/format/ttf/id/%s/type/font"

// Decoder lazily downloads fussball.de obfuscation fonts and decodes the glyphs.
type Decoder struct {
	client *http.Client

	mu     sync.Mutex
	cache  map[string]map[rune]rune
	buffer sfnt.Buffer
}

// New builds a Decoder with the provided HTTP client.
func New(client *http.Client) *Decoder {
	if client == nil {
		client = http.DefaultClient
	}
	return &Decoder{
		client: client,
		cache:  make(map[string]map[rune]rune),
	}
}

// Decode translates the provided text according to the obfuscation font referenced by id.
func (d *Decoder) Decode(id, text string) (string, error) {
	if strings.TrimSpace(text) == "" || strings.TrimSpace(id) == "" {
		return strings.TrimSpace(text), nil
	}

	mapping, err := d.mapping(id)
	if err != nil {
		return "", err
	}

	var b strings.Builder
	for _, r := range text {
		if decoded, ok := mapping[r]; ok {
			b.WriteRune(decoded)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String(), nil
}

func (d *Decoder) mapping(id string) (map[rune]rune, error) {
	d.mu.Lock()
	if mapping, ok := d.cache[id]; ok {
		d.mu.Unlock()
		return mapping, nil
	}
	d.mu.Unlock()

	url := fmt.Sprintf(fontURLTemplate, id)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch font %s: status %d", id, resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	font, err := sfnt.Parse(data)
	if err != nil {
		return nil, err
	}

	mapping := make(map[rune]rune)
	for code := rune(0xE600); code <= rune(0xF8FF); code++ {
		glyphIndex, err := font.GlyphIndex(&d.buffer, code)
		if err != nil || glyphIndex == 0 {
			continue
		}
		name, err := font.GlyphName(&d.buffer, glyphIndex)
		if err != nil {
			continue
		}
		if decoded := glyphNameToRune(name); decoded != 0 {
			mapping[code] = decoded
		}
	}

	d.mu.Lock()
	d.cache[id] = mapping
	d.mu.Unlock()

	return mapping, nil
}

func glyphNameToRune(name string) rune {
	switch strings.ToLower(name) {
	case "zero":
		return '0'
	case "one":
		return '1'
	case "two":
		return '2'
	case "three":
		return '3'
	case "four":
		return '4'
	case "five":
		return '5'
	case "six":
		return '6'
	case "seven":
		return '7'
	case "eight":
		return '8'
	case "nine":
		return '9'
	case "hyphen":
		return '-'
	default:
		return 0
	}
}
