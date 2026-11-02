---
title: School bus network co-design
publishDate: 2026-05-01 00:00:00
description: A bus network redesign framework that weighs cost, coverage, and equity together, tested on a real school bus network in Framingham, MA.
tags:
  - Network Design
  - Optimization
  - Category Theory
when: May 2026
---

For my SuperUROP and bachelor's thesis at MIT's Laboratory for Information and Decision Systems, I built a general-purpose framework for redesigning bus networks. It uses monotone co-design theory and mixed-integer linear programming to optimize cost, coverage, and equity together, while respecting fleet, labor, and policy constraints.

The data pipelines combine OpenStreetMap networks, estimated travel times, origin-destination demand, and American Community Survey demographics. The result is a set of transparent Pareto frontiers that show the tradeoffs a planner is choosing between.

I applied the framework to a real school bus network in Framingham, MA, to evaluate the existing routes, generate alternative designs, and show where efficiency, coverage, and accessibility could structurally improve.

Read the thesis, [*A Co-Design Framework for School Bus Network Redesign: Applying Category Theory to Routing, Resources, and Equity*](https://dspace.mit.edu/handle/1721.1/176348), on MIT DSpace.
