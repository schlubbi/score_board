package groups

// Config describes a single Staffel on fussball.de that we want to scrape.
type Config struct {
	ID        string
	Name      string
	StaffelID string
}

// KasselEJugend returns the configured Kassel E-Jugend groups.
func KasselEJugend() []Config {
	return []Config{
		{ID: "group1", Name: "EJKK Kassel Gr. 1", StaffelID: "02TMJADUIC000007VS5489BUVSSD35NB-G"},
		{ID: "group2", Name: "EJKK Kassel Gr. 2", StaffelID: "02TMJADUO0000008VS5489BUVSSD35NB-G"},
		{ID: "group3", Name: "EJKK Kassel Gr. 3", StaffelID: "02TMJADUSK000008VS5489BUVSSD35NB-G"},
		{ID: "group4", Name: "EJKK Kassel Gr. 4", StaffelID: "02TMJADV14000008VS5489BUVSSD35NB-G"},
		{ID: "group5", Name: "EJKK Kassel Gr. 5", StaffelID: "02TMJADV6G000005VS5489BUVSSD35NB-G"},
		{ID: "group6", Name: "EJKK Kassel Gr. 6", StaffelID: "02TMJADVB4000005VS5489BUVSSD35NB-G"},
		{ID: "group7", Name: "EJKK Kassel Gr. 7", StaffelID: "02TMJADVF4000005VS5489BUVSSD35NB-G"},
		{ID: "group8", Name: "EJKK Kassel Gr. 8", StaffelID: "02TT1ER3KO000004VS5489BUVVJ8R9DS-G"},
	}
}

// IndoorPreGamesStaffelID points at the "Hallen-Kreisturnier" tournament overview
// that contains the pre-game groups (E - Junioren Gr. X) behind expandable headers.
const IndoorPreGamesStaffelID = "02TFRJDJVO000000VS5489BSVTA87VEB-C"
