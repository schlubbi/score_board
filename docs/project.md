# Score Board

## Desription

Score board is a web application that allows the user to explore the youth soccer results for the E-Jugend in Kassel,
Germany. This youth plays the "1. Kreisklasse" championship where teams compete in 8 different groups. The last season
has past and score board shows analytical data for that very time frame. The app is using the power ranking algorithm
described below to rank teams against each other.

## Power Ranking Algorithm

The algorithm evaluates each team using three performance dimensions:

* Offensive strength
* Defensive strength
* Dominance per match

Then it normalizes these values and combines them into a single Power Score.

### 1️⃣ Required Input Data (per team)

You need:

* Games played
* Goals scored
* Goals conceded
* Points

From this, compute:

* Goals per game
* Conceded goals per game
* Goal difference per game

### 2️⃣ Core Metrics

**Offense Score**
```
offense = goals_scored / games
```

**Defense Score**
```
defense = 1 - (goals_conceded / games)
```

This ensures that fewer conceded goals → higher score.

**Dominance Score**
```
dominance = (goals_scored - goals_conceded) / games
```

### 3️⃣ Normalization (0–1 scale)

To combine metrics fairly, normalize each metric:

```
norm(x) = (x - min(x)) / (max(x) - min(x))
```

Apply this to:

* Offense Score
* Defense Score
* Dominance Score

### 4️⃣ Final Power Score

Weighted combination:

```
power_score =
    0.4 * offense_norm +
    0.3 * defense_norm +
    0.3 * dominance_norm
```
You can adjust weights depending on how important offense vs. defense should be.

### 5️⃣ Sorting Logic

Sort teams by:

* Power Score (descending)
* Goal difference
* Points
* Goals scored

This produces a ranking that reflects true performance, not just points.

## Data Sources

The data collection must occur through https://fussball.de as the data isn't otherwise accessible. The page must be
scraped to collect the data for the 8 different groups. This can be written as a one off solution for now, but likely
will need to advance into a full scraping solution later on.

We're going to use the crossing table that displays all games of the season visually to keep the scraping to the least
necessary.

The table is in german so interpreting the results needs to account for that. "Nichtantritt" refers to teams that didn't
play the season and resigned instead.

The table might be accessible only through Javascript and page interaction. The link element has this property:

```
data-tracking-pagename-long="wettbewerb_kreuztabelle"
```

When scraping the page look out for better ways to grab the data.

Here are the links for the respective groups:

* Group 1: https://www.fussball.de/spieltag/ejkk-kassel-gr-1-kreis-kassel-e-junioren-1kreisklasse-e-junioren-saison2526-hessen/-/spieltag/1/staffel/02TMJADUIC000007VS5489BUVSSD35NB-G#!/
* Group 2: https://www.fussball.de/spieltagsuebersicht/ejkk-kassel-gr-2-kreis-kassel-e-junioren-1kreisklasse-e-junioren-saison2526-hessen/-/staffel/02TMJADUO0000008VS5489BUVSSD35NB-G#!/
* Group 3: https://www.fussball.de/spieltagsuebersicht/ejkk-kassel-gr-3-kreis-kassel-e-junioren-1kreisklasse-e-junioren-saison2526-hessen/-/staffel/02TMJADUSK000008VS5489BUVSSD35NB-G#!/
* Group 4: https://www.fussball.de/spieltagsuebersicht/ejkk-kassel-gr-4-kreis-kassel-e-junioren-1kreisklasse-e-junioren-saison2526-hessen/-/staffel/02TMJADV14000008VS5489BUVSSD35NB-G#!/
* Group 5: https://www.fussball.de/spieltagsuebersicht/ejkk-kassel-gr-5-kreis-kassel-e-junioren-1kreisklasse-e-junioren-saison2526-hessen/-/staffel/02TMJADV6G000005VS5489BUVSSD35NB-G#!/
* Group 6: https://www.fussball.de/spieltagsuebersicht/ejkk-kassel-gr-6-kreis-kassel-e-junioren-1kreisklasse-e-junioren-saison2526-hessen/-/staffel/02TMJADVB4000005VS5489BUVSSD35NB-G#!/
* Group 7: https://www.fussball.de/spieltagsuebersicht/ejkk-kassel-gr-7-kreis-kassel-e-junioren-1kreisklasse-e-junioren-saison2526-hessen/-/staffel/02TMJADVF4000005VS5489BUVSSD35NB-G#!/
* Group 8: https://www.fussball.de/spieltagsuebersicht/ejkk-kassel-gr-8-kreis-kassel-e-junioren-1kreisklasse-e-junioren-saison2526-hessen/-/staffel/02TT1ER3KO000004VS5489BUVVJ8R9DS-G#!/

You can use the images in docs/screenshots as a verification mechanism. These screenshots show the cross table for each
group. You can infer the name of the group from the file name.
