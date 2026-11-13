---
title: School Bus Network Co-Design
publishDate: 2026-05-01
description: A co-design framework for bus network redesign, demonstrated through a case study of morning school bus service in Framingham, MA.
tags:
  - Network Design
  - Optimization
  - Category Theory
when: May 2026
publications:
  - temkin2025category
  - temkinCoDesignFrameworkSchool2026
  - temkin2026urban
---

Cities and school districts face persistent challenges in designing bus systems that are efficient, reliable, and equitable under limited fleet, staffing, budget, and accessibility constraints. For my SuperUROP at MIT's Laboratory for Information and Decision Systems and Bachelor's thesis, I developed a co-design framework for bus network redesign using the monotone theory of co-design from applied category theory.

The framework represents routing service, fleet capacity, drivers, monitors, fuel, maintenance, policy requirements, and algorithmic choices as interconnected components, whose relationships can be compared through Pareto-front analysis. Rather than producing a single "best" routing plan, it shows the frontier between competing objectives.

![Scatter plot of annual emissions against unassigned students. Points fall from about 1.6 million kilograms at around 500 unassigned students to about 300,000 kilograms at around 7,000, with a black stepped line along the lowest points.](../../assets/posts/school-bus-pareto.png)

_One of the thesis's Pareto fronts, comparing annual emissions and unassigned students across sampled routes and catalog configurations._

I demonstrated the framework through a case study of morning bus service in Framingham, MA. Under simplified travel-time assumptions, the routing approach serves the same 4,780 currently assigned riders with 48 buses rather than 51, and reduces estimated mean ride time from 43.08 to 30.52 minutes. The map shows the current routes, with the width of each road link varying based on how many buses travel along it.

![Map of Framingham's current school bus routes on a dark background. Wider white lines mark roads used by more buses, with schools in red.](../../assets/posts/school-bus-routes.png)

_Framingham's current morning school bus routes. Wider lines mark roads that more buses travel along, and schools are in red._

These results are planning estimates rather than deployment-ready schedules, because they rely on constant-speed travel times and incomplete student-level linkage data. The current experiments also evaluate equity primarily after routing, so embedding it directly in the optimization is a direction for future work.
