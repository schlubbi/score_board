# Next-Season Group Recommendation Strategy

_Last updated: 2026-01-11_

## 1. Data to Capture (beyond current tables)
- **Match facts:** kickoff date/time, matchday index, stadium address, opponent links, final + halftime score, status (played, Nichtantritt, Absetzung).
- **Season snapshots (via `ajax.season.stats`):** rank, points, goal balance, five-match form streak, top-scorer names/goals, team/offical card totals at match time.
- **Trajectory data (`ajax.fevercurve`):** per-matchday placements forming a time series for volatility and slope.
- **Head-to-head history (`ajax.matches.stats` + `ajax.matches.history`):** prior scorelines, cancellations, aggregate W/D/L, lifetime goal difference.

Store every match once (keyed by match ID) and derive features: rolling goal difference, opponent strength at match time, rest days between fixtures, cancellation counts, and fever-curve volatility.

## 2. Skill & Form Modeling
1. **Bayesian Bradley–Terry/TrueSkill-lite model** using each played match (home/away, margin) to produce a posterior skill mean `μ` and uncertainty `σ` per team. Treat Nichtantritt or canceled fixtures as low-confidence observations.
2. **Trajectory score** from fever-curve slope + recent rolling goal difference to highlight rising vs plateauing teams.
3. **Reliability score** from cancellation/Nichtantritt frequency; even without referees, repeated no-shows should reduce promotion confidence.

## 3. Grouping Objective (travel/fairness removed)
- Keep eight groups with target roster sizes.
- Minimize variance of `μ` within each group while ensuring each group mean stays within a tight band (e.g., ±0.2σ of league average).
- Cap aggregate uncertainty per group (spread high-σ teams around) and ensure each group mixes at least one high-trajectory team to avoid lopsided development.
- Allow soft constraints for rivalries or club requests (pin together/apart) but otherwise let the optimizer balance pure competitiveness.

Solve with integer programming or simulated annealing over assignment matrix `x_{team,group}`; run Monte Carlo simulations sampling `μ ± σ` to produce confidence intervals for predicted goal-difference spread inside each candidate grouping.

## 4. Planner Output & UX
- Expose new API endpoints:
  - `/api/matches` (raw match facts + derived features).
  - `/api/ratings` (skill posterior, trajectory, reliability per team).
  - `/api/grouping/preview` (best assignment + alternates, each with variance, projected standings spread, trajectory mix, reliability flags).
- Frontend additions:
  - “Next Season Planner” view showing suggested groupings, sliders for weighting parity vs stability, and controls to lock teams together/apart.
  - Visualization of fever-curve paths and recent form so coordinators see why a team is flagged for promotion/relegation.
  - Sensitivity report (how often each team appears in each group across simulations) to highlight low-certainty cases.

## 5. Implementation Steps
1. Extend scraper to walk match links once per cell, call the AJAX endpoints above, and persist normalized match + snapshot records (SQLite is fine for MVP).
2. Implement the Bayesian rating service (Go or Python helper) and schedule nightly refresh after scraping.
3. Build the grouping optimizer (start with heuristic/greedy balancing, then upgrade to MILP/annealing when constraints grow).
4. Ship the planner UI and iterate with real coordinators before next season’s draft.
