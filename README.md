# VPMS Executive Dashboards

**Status:** Executive dashboard template — property of Vidmar AI (VAI).

VPMS (Vidmar Performance Management System) is an executive performance-management
dashboard template — a reusable Balanced Scorecard BI product, built around a configurable
set of KPIs. This repository is self-contained: clone it, install, and it runs — no other
repository or service is needed.

## The nine dashboards

**1. Executive overview** — the headline view. Overall KPI score, the revenue trend (ZMW),
the four perspective scores with their weights, how many points each adds to the overall score, open projects and actions, and the items
that currently need management attention.

**2. Balanced scorecard** — the GM weighted scorecard. Overall score gauge, each perspective's
score, weight and contribution, points available vs earned, and every KPI with its weight, share
of the overall score, and status.

**3. Department scorecards** — the nine departments ranked, a department × perspective heat
map, and a detail view per department with a monthly trend and its KPI table. Filter by year to
date or quarter. **This page shows demo data** (see *Data sources* below).

**4. Strategy map** — the strategic plan by perspective: objectives, measures, the five-year
target path, and initiatives.

**5. Operations** — product received vs distributed (m³) by quarter, total received and
distributed, headcount, preventive maintenance, and purchasing budget, with a quarterly
volume detail table.

**6. Financial** — annual revenue to date, monthly revenue trend, quarterly revenue actual vs
target, target achievement, and financial KPI performance by quarter. Only quarters with
approved figures are shown.

**7. KPI register** — a colour-coded heatmap of every KPI across the four Balanced Scorecard
perspectives: Financial, Customer, Internal Process, and Learning & Growth.

**8. Projects & actions** — the project delivery register and action queue, with projects
broken down by lifecycle status, priority, and category.

**9. Support** — IT help desk performance: total tickets, SLA compliance, average resolution
time, tickets by priority, category, and department, and the ticket volume trend.
**This dashboard currently shows test data** (see *Data sources* below).

Users with the Admin role also see an **Administration** page (user, role, KPI data,
integration, and audit management). It currently documents the planned architecture only —
none of those functions are live yet.

The Executive, Financial, and Support dashboards have a timeframe selector (last quarter,
current quarter, or a custom month range), and the choice carries across the app. A floating
**Notes Assistant** is available on every page for taking notes while reviewing the
dashboards.

## Interface

- Executive overview leads with the overall score in its status colour (green / amber / red per the PMS rules), with revenue actual and target beside it.
- Calmer card surfaces, larger perspective scores, a clear active-page marker in the sidebar and a visible focus ring on form fields.
- The reporting period reads "Start – End Year" (for example Jul – Sep 2026).

## Requirements

- **Node.js 20.19 or newer** (or 22.12+) and npm — required by Vite 7.
- Nothing else: there is no database, backend, or environment file to set up.

## Running it locally

```bash
git clone <this repository URL> VPMS_ExecutiveDashboards
cd VPMS_ExecutiveDashboards
npm install
npm run dev
```

Then open http://localhost:4300 and sign in with one of the accounts below.

Other commands:

```bash
npm test           # run the unit tests (Node's built-in test runner)
npm run lint       # check the code with ESLint
npm run build      # production build, written to dist/
npm run preview    # serve the production build on port 4300
```

The dev and preview servers listen on all network interfaces (`0.0.0.0`), so other machines
on the same network can reach them at `http://<your-machine-ip>:4300`.

## Login accounts

Sign-in is handled entirely in the browser against the built-in demo accounts below. The
login screen does not list them, so share them with testers directly. Sign in with the
**username** (an email address also works).

**Default password for every seeded account: `ChangeMe123!`** — everyone should change it after
first login (or an Admin can reset it under Administration → Users).

### The 5 roles

Every person has exactly one role, and the role decides what they see and can do.

| Role      | Who this is         | Username | Can view                                   | Can enter data?          | Can administer?                         |
|-----------|---------------------|----------|----------------------------------------------|--------------------------|-----------------------------------------|
| Admin     | ICT / system owner  | `admin`  | Everything                                 | No (not their job)       | Yes — departments, KPIs, users          |
| GM        | General Manager     | `gm`     | Executive Dashboard + every department     | No                       | No (can load a new scorecard)           |
| Board     | Board of Directors  | `board`  | Executive Dashboard + every department (read-only) | No               | No                                      |
| Dept Head | Head of a department| see below| Their own department only                 | Yes, for their department| No                                      |
| Staff     | Department team member | see below | Their own department only              | Yes, for their department| No                                      |

Admin, GM and Board land on the **Executive overview** and see every page. Dept Heads and Staff
land on **My department** and see nothing else; the other pages and other departments' data are
blocked, not just hidden. Only Admin sees the **Administration** page.

### The 9 departments

Each department has its own heat map and its own two accounts (a head and a staff account).

| Department         | Code          | Usernames                               |
|--------------------|---------------|-----------------------------------------|
| Product Monitoring | `pm`          | `pm_head` / `pm_staff`                  |
| Security           | `security`    | `security_head` / `security_staff`      |
| Safety             | `safety`      | `safety_head` / `safety_staff`          |
| Human Resource     | `hr`          | `hr_head` / `hr_staff`                  |
| Procurement        | `procurement` | `procurement_head` / `procurement_staff`|
| ICT                | `ict`         | `ict_head` / `ict_staff`                |
| Operations         | `operations`  | `operations_head` / `operations_staff`  |
| Finance            | `finance`     | `finance_head` / `finance_staff`        |
| Engineering        | `engineering` | `engineering_head` / `engineering_staff`|

Roles and permissions are defined in `src/auth/permissions.js`. The accounts themselves are in
`src/auth/demoAuth.js`.

### How scores are calculated

- Achievement % = Actual ÷ Target × 100, with each KPI capped at 150%.
- A department's overall score = the plain average of its KPIs' achievement %. Weighting is
  shown for reference only and is not applied.
- Colours: green = 100% or more, amber = 90%–99.9%, red = below 90%, grey = no data yet.

> **Before go-live:** these accounts ship inside the JavaScript bundle, so anyone who can load
> the site can read them. They are for testing and demos only. Replace them with real
> authentication before the dashboards hold sensitive data or are exposed outside your
> organization's network.

## Deploying

The build output is a static website — no server-side code runs.

1. `npm install && npm run build`
2. Serve the `dist/` folder.

Two ways to serve it:

- **Quick / internal:** run `npm run preview` on the server (port 4300). Keep it running with
  whatever process manager you use (systemd, pm2, a Windows service, etc.).
- **Web server (recommended for production):** point nginx, Apache, or IIS at `dist/`. The app
  uses client-side routing, so the server must send `index.html` for any path that isn't a
  file. For nginx:

  ```nginx
  location / {
      try_files $uri $uri/ /index.html;
  }
  ```

  Without this, refreshing a page such as `/financial` returns a 404.

To deploy an update, pull the latest code, run `npm install && npm run build` again, and
restart the preview server if you use one. A web server picks up the new `dist/` straight away.

## Data sources

Nothing is live-connected yet. Every figure is loaded from files in `src/data/`:

- `src/data/kpiData.js` — the KPI, financial, operations, and project figures, imported
  manually from the Strategic KPI workbook. To report a new period, update the values here and
  rebuild. Reporting quarters are worked out from the data itself; there is no hard-coded
  financial year.
- `src/data/scorecardData.js` — the GM weighted scorecard and strategy map, copied from the
  Strategic plan workbook, plus **demo data** for the department scorecards (fixed-seed, same on
  every load). Replace `departments` with real monthly submissions; no page changes are needed.
  Scoring lives in `src/lib/scorecard.js`, and its tests confirm the workbook's 54.1% is reproduced.
- `src/data/supportData.js` — **test data only** for the Support dashboard. It uses
  representative priority, SLA, category, and department values, but the counts are
  placeholders until a feed from a real help desk is built.

The planned Microsoft Navision integration is documented in `src/lib/navisionIntegration.js`.
It is not implemented.

KPI colour bands (red / orange / yellow / green) are set in `src/lib/kpiThresholds.js`, with
per-KPI overrides and support for "lower is better" KPIs.

## Project layout

```
src/
  pages/dashboard/   one file per dashboard (Executive, Operations, Financial,
                     KPIHeatmap, Projects, Support, Admin)
  components/        layout (sidebar, header) and shared UI pieces
  auth/              sign-in, session, and role permissions
  data/              the data files described above
  lib/               reporting periods, KPI thresholds, metrics, integration notes
public/              logo and login background images
```

## Tech

React 19, React Router 7, Vite 7, Tailwind CSS 4, Recharts, and lucide-react icons.

## Known limitations

- Demo sign-in only (see *Login accounts*).
- Data is imported manually; there is no Navision or help desk connection yet.
- The Support dashboard shows test data.
- The Notes Assistant's notes are saved in the browser for the current session only. Emailing
  them is not connected yet.
