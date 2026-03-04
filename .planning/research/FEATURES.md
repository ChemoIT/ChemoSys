# Feature Research

**Domain:** Fleet management + heavy equipment (צמ"ה) system — energy infrastructure company
**Project:** ChemoSys v2.0 — shell for fleet & equipment modules (replacing 10-year-old Liberty Basic system)
**Researched:** 2026-03-04
**Confidence:** MEDIUM — based on training knowledge of Israeli fleet management systems (Shlager, Malam-Team, Track, NetFleet) + domain expertise. WebFetch/WebSearch blocked; verified against project context and sub-module list provided by Sharon.

---

## Context: What v2.0 Builds vs What It Defers

**v2.0 scope (shell only):**
- ChemoSys login page + module selector
- Fleet module home page (dashboard + 16 sub-module menu tiles)
- Equipment module home page (dashboard + placeholder tiles)
- Permission wiring for (app) route group

**Future milestones (content of sub-modules):**
All 16 fleet sub-modules + equipment sub-modules are OUT OF SCOPE for v2.0.
This research documents what those sub-modules will eventually do, so the v2.0 shell
can be designed with the right dashboard stats, the right tile labels/icons, and the
right DB module keys — without having to redesign the shell later.

---

## Feature Landscape

### Table Stakes — Fleet Module (Users Expect These Without Asking)

Features that any fleet manager at an energy infrastructure company expects as baseline.
Missing these = the system feels like a step backward from the Liberty Basic system it replaces.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Driver card (כרטיס נהג) | Every fleet system has a canonical driver record with license info, validity dates, restrictions | MEDIUM | Links to existing `employees` table. Key fields: license number, license categories (B/C/CE/D), expiry date, professional license, medical certificate expiry, restriction codes. One employee can hold multiple license categories. |
| Vehicle card (כרטיס רכב) | The central record for each vehicle — registration, type, ownership, assignment | MEDIUM | Fields: license plate, vehicle type, make/model/year, VIN, ownership (company-owned vs leased vs rented), assigned driver, assigned project, fuel type, odometer baseline. Links to `companies` table (which company owns the vehicle). |
| Mileage logging (ניהול ק"מ) | Every fleet system must track mileage — both for regulatory compliance and cost allocation | HIGH | Monthly or trip-based mileage report per vehicle. Driver submits, manager approves. Comparison: reported vs. GPS (if GPS available). Links vehicle to project for cost allocation. |
| Fuel management (דלק) | Fuel is the highest-volume recurring expense — every fleet system tracks it | HIGH | Fuel fills per vehicle: date, liters, cost, station, odometer at fill. Fuel card integration (future). Consumption rate calculation (L/100km). Alerts for abnormal consumption. |
| Toll road management (כבישי אגרה) | Israeli-specific: Kvish 6, Carmel Tunnels, Cross-Israel Highway — all require billing reconciliation | MEDIUM | Monthly billing import from Netravim/Kvish6 provider. Match charges to vehicles. Allocate to project cost centers. Flag unrecognized plates. |
| Traffic violations (דוחות תנועה/משטרה) | Company vehicles accumulate violations — someone must manage payment and liability transfer | MEDIUM | Log fine: date, vehicle, amount, violation type, driver at time, status (open/paid/transferred). Owner transfer workflow (transfer liability to driver). Deadline tracking to avoid late fees. |
| Mechanical maintenance log (ספר טיפולים מכניים) | Every vehicle needs a service history — regulatory requirement for commercial vehicles | HIGH | Service records: date, odometer, service type (periodic/repair/inspection), garage, cost, next service date. Service reminders based on date or odometer. Mandatory periodic service tracking (תקופתי). |
| Safety forms management (טפסי בטיחות) | Israeli labor law + transport regulations require regular safety inspections and declarations | HIGH | Form types: daily vehicle inspection (בדיקה יומית), pre-trip checklist, quarterly inspection. Driver completes on mobile. Manager reviews. Defect flagging. Non-completion alerts. |
| Spare parts and tires (חלקי חילוף/צמיגים) | High-value consumables that need inventory tracking and cost attribution | HIGH | Tire tracking per vehicle (4 positions + spare): brand, size, date installed, tread depth, replace-by date. Parts inventory: item, quantity, location, cost. Links to maintenance log. |
| Report generation (הפקת דוחות) | Management needs periodic summaries — monthly cost per vehicle, cost per project, driver performance | HIGH | Canned reports: monthly mileage report, fuel consumption by vehicle, maintenance costs, violations summary. Export to Excel/PDF. Date range filter. Filter by vehicle/driver/project/company. |
| Supplier invoice approval (אישורי חשבוניות ספקים) | Garage and service invoices must go through approval workflow before payment | MEDIUM | Invoice receives, linked to maintenance record, routed to approver, approved/rejected with notes, exported to accounting system. Prevents unauthorized repairs. |
| Exception tables (טבלאות חריגים) | Configurable thresholds for alerting — overspending, over-mileage, missed services | MEDIUM | Admin-configurable: max fuel fill per vehicle type, mileage variance tolerance, service overdue threshold. Drives alert system across all sub-modules. |

### Table Stakes — Module Shell (v2.0 Specific)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Module selection at login | Users have access to specific modules only — must choose which module to enter | LOW | Login page shows module buttons (fleet, equipment, HR) based on user's permissions. Grayed out = no access. Same Supabase Auth backend as admin. |
| Fleet module home dashboard | Every module home page needs at-a-glance KPIs before drilling in | LOW | Stat cards: total active vehicles, active drivers, open violations, services due this month, pending approvals, vehicles with expiring docs. |
| Equipment module home dashboard | Same pattern as fleet — placeholder for now | LOW | Stat cards TBD when equipment sub-modules are defined. For v2.0: placeholder with "בפיתוח" tiles. |
| Sub-module tile menu | 16 tiles in a grid — each links to a sub-module (even if page shows "בפיתוח" for now) | LOW | Tiles need: icon, Hebrew label, tile key (for permissions), badge for count of pending items (future). |
| Module navigation switcher | Users with multi-module access need to switch between fleet and equipment without re-logging | LOW | Top nav or sidebar element showing available modules. Click = navigate to that module's home. |
| Mobile-responsive layout | Field workers and drivers use phones — the fleet module is field-facing | MEDIUM | Cards and tiles must collapse correctly on 375px screens. Touch-friendly tap targets (min 44px). |
| Hebrew RTL throughout | Same as admin panel — company language is Hebrew | LOW | Already established pattern from v1.0. ChemoSys layout inherits same RTL + Heebo font root. |

### Differentiators — Fleet Module (Beyond Baseline)

Features that go beyond what the Liberty Basic system could do, and differentiate ChemoSys.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| EV charging tracking (טעינת רכב חשמלי) | Chemo Aharon has electric vehicles — fuel equivalent cost tracking for EVs is non-standard | HIGH | Charge events: date, vehicle, kWh, station (home/company charger/public), cost. Compare to fuel equivalent. Monthly report on EV vs ICE cost. Links to same `fuel_management` cost model. |
| Camp vehicle QR tracking (רכבי מחנה + QR) | Energy infrastructure projects use "camp vehicles" (ounited vehicles at remote project sites) — daily check-in/out via QR | HIGH | Each camp vehicle gets a QR code (printed label). Driver scans on arrival/departure via mobile camera. Log: vehicle, driver, project site, timestamp, odometer. Manager sees live inventory of which vehicles are at which site. No GPS needed. Replaces manual whiteboard at camp gate. |
| Rental car order management (הזמנת רכב שכור) | Rental car requests require approval, booking tracking, and cost recording — not handled by most basic fleet systems | MEDIUM | Request form: requester, dates, purpose, project. Approval chain. Rental confirmed: supplier, car details, cost. Return + mileage recorded. Monthly rental cost report by project. |
| License and document expiry alerts | Proactive alerting before license or registration expires — prevents regulatory violations | MEDIUM | Alert triggers: driver license expiry (30/7/1 day warning), vehicle registration (טסט) expiry, insurance expiry, professional license expiry. Alerts shown on dashboard + (future) WhatsApp/SMS. |
| Cost allocation to projects | Fleet costs attributed to specific projects — critical for project P&L and billing to clients | HIGH | Every fuel fill, maintenance event, and toll charge linked to project_id (FK to existing `projects` table). Monthly cost-per-project report. Managers see only their own projects' costs. |
| Driver performance summary | Aggregated view of driver behavior: violation count, fuel efficiency, mileage consistency | MEDIUM | Per-driver dashboard: violations (open + paid), fuel consumption vs fleet average, safety form completion rate, license validity status. Helps identify high-risk drivers. |
| Mobile-first safety form submission | Drivers complete daily vehicle check on their phone — replaces paper forms | HIGH | React form optimized for mobile. Offline support (future). Photo attachment for damage. GPS location auto-tagged. Submitted to server via Server Action. Manager sees pending reviews. |

### Differentiators — Equipment Module (Placeholder Tiles Only for v2.0)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Equipment card (כרטיס צמ"ה) | Heavy equipment (cranes, compressors, excavators) needs its own card — different fields from vehicles | HIGH | Fields: equipment type, serial/chassis number, year, owner, current project assignment, operator, working hours meter (not odometer), fuel type, crane certification expiry. |
| Working hours tracking | Heavy equipment is costed by hours, not kilometers | HIGH | Daily hours log: operator, project, hours worked, hours idle. Monthly hours-per-project report. |
| Certification tracking | Crane operators and equipment require regulatory certifications — must not expire silently | HIGH | Track: crane certification (תעודת מנוף), equipment inspection (בדיקת מכשיר), operator certification. Alerts at 30/7/1 day before expiry. |

### Anti-Features

Features that seem obvious to request but create real problems in this context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time GPS tracking (מעקב GPS) | "We want to see where our vehicles are" | Requires a GPS hardware vendor, hardware in every vehicle, monthly SIM fees, real-time websocket infrastructure — this is a separate product not a feature | Integrate with an existing GPS vendor (Pointer, Matrix, Ituran) via their API as a future phase. v2.0 has no GPS. Mileage is self-reported. |
| WhatsApp notifications from fleet events | "Alert me on WhatsApp when a service is due" | n8n + WhatsApp integration exists BUT tying fleet events to notifications is a Phase X feature. The notifications infrastructure needs to be designed separately as it touches multiple modules | Design the notification hooks in DB (notification_log table + triggers) but do not wire WhatsApp in v2.0 shell. Do it in the sub-module milestone that needs it. |
| Fuel card API integration (Sonol, Paz, Delek) | "Auto-import fuel fills from our fuel card provider" | Israeli fuel card providers (Sonol/Paz) have closed B2B APIs. Integration requires a commercial contract and a dedicated connector | Manual import via CSV/Excel export from fuel card portal. Design the import schema to match the fuel card export format. API integration = future phase. |
| Full accounting integration | "Export to Priority / SAP" | ERP integration (Priority is common in Israeli mid-market) is a dedicated project requiring ERP API keys, field mapping, and ongoing maintenance | Export to Excel in the format the accountant needs. ERP integration = future phase. |
| Predictive maintenance AI | "Tell me when the truck will break down" | Requires 2+ years of historical data, ML infrastructure, and domain expertise to tune models. Cannot be built before the maintenance log module even exists | Build the maintenance log with good structured data. AI layer can be added in 18+ months when there is enough data. |
| Driver mobile app (native iOS/Android) | "Give drivers an app" | PWA (Progressive Web App) on the mobile browser covers 95% of the use case for form submission and QR scanning. A native app doubles development cost and requires App Store approval | Responsive web + PWA manifest. Camera access via browser (works for QR scanning). Service worker for offline form drafts. |
| Document storage per vehicle (photos, PDFs) | "Attach the insurance PDF to the vehicle card" | File storage requires bucket management, access control, CDN. Supabase Storage works but adds complexity and has free-tier limits | Store document metadata (expiry dates, numbers) as structured fields. For v2.0 + immediate milestones: no file attachments. Add in a later phase when the need is validated. |

---

## Feature Dependencies

```
Fleet Module Shell (v2.0)
    └──requires──> Auth + Permission system (v1.0 ✓ already built)
                       └──requires──> modules table rows for fleet sub-modules (NEW: migration)
                       └──requires──> (app) route group + layout (NEW: v2.0)

Driver Card
    └──requires──> employees table (v1.0 ✓)
    └──requires──> vehicles table (NEW: future milestone)
    │   └── driver_id FK on vehicles
    └──enhances──> Mileage Management (who drove which vehicle)
    └──enhances──> Safety Forms (which driver submitted)
    └──enhances──> Traffic Violations (which driver was assigned at time of violation)

Vehicle Card
    └──requires──> companies table (v1.0 ✓) [ownership]
    └──requires──> projects table (v1.0 ✓) [assignment]
    └──requires──> employees table (v1.0 ✓) [assigned driver]
    └──is prerequisite for──> ALL other fleet sub-modules (every sub-module references vehicle_id)

Mileage Management
    └──requires──> Vehicle Card
    └──requires──> Driver Card
    └──requires──> projects table (v1.0 ✓) [cost allocation]

Fuel Management
    └──requires──> Vehicle Card
    └──enhances──> EV Charging Tracking (same cost model, different energy type)
    └──enhances──> Exception Tables (abnormal consumption alerts)

Toll Road Management
    └──requires──> Vehicle Card
    └──requires──> companies table (billing entity)

Traffic Violations
    └──requires──> Vehicle Card
    └──requires──> Driver Card (who was driving at time)

Mechanical Maintenance Log
    └──requires──> Vehicle Card
    └──enhances──> Spare Parts/Tires (parts consumed during service)
    └──enhances──> Supplier Invoice Approval (service invoices)

Safety Forms
    └──requires──> Vehicle Card
    └──requires──> Driver Card (who submitted)
    └──enhances──> Exception Tables (defect thresholds)

Spare Parts / Tires
    └──requires──> Vehicle Card
    └──enhances──> Mechanical Maintenance Log (parts used in service)

Exception Tables
    └──requires──> Vehicle Card (thresholds per vehicle type)
    └──enhances──> ALL sub-modules (global alert configuration)
    └──should be built early (before sub-modules) to avoid retrofitting alert logic

Camp Vehicle QR Tracking
    └──requires──> Vehicle Card
    └──requires──> projects table (v1.0 ✓) [which site]
    └──requires──> Driver Card
    └──requires──> QR code generation library (qrcode or similar)

Rental Car Orders
    └──requires──> employees table (v1.0 ✓) [requester + approver]
    └──requires──> projects table (v1.0 ✓) [cost allocation]
    └──does NOT require Vehicle Card (rental cars are not owned fleet)

Supplier Invoice Approval
    └──requires──> Mechanical Maintenance Log (link invoice to service record)
    └──requires──> employees table (v1.0 ✓) [approver]
    └──enhances──> Report Generation (approved vs pending invoice totals)

Report Generation
    └──requires──> ALL sub-modules (no data = no reports)
    └──should be built LAST in each milestone — needs data to test

Cost Allocation to Projects (cross-cutting)
    └──requires──> projects table (v1.0 ✓)
    └──enhances──> Fuel Management, Toll Roads, Maintenance Log, Mileage — all add project_id FK
```

---

## Sub-Module Keys for Permission System

The 16 fleet sub-modules need module keys registered in the `modules` table.
These keys drive the permission matrix — a user gets access level per sub-module.

| Hebrew Name | Suggested Module Key | Parent Key | Icon (Lucide) |
|-------------|---------------------|------------|---------------|
| דשבורד צי רכב | `fleet` | NULL | `Truck` |
| כרטיס נהג | `fleet.drivers` | `fleet` | `UserCheck` |
| כרטיס רכב | `fleet.vehicles` | `fleet` | `Car` |
| סל הוצאות | `fleet.expenses` | `fleet` | `Receipt` |
| ניהול ק"מ | `fleet.mileage` | `fleet` | `Gauge` |
| ניהול דלק | `fleet.fuel` | `fleet` | `Fuel` |
| כבישי אגרה | `fleet.tolls` | `fleet` | `Route` |
| דוחות תנועה/משטרה/נזקים | `fleet.violations` | `fleet` | `AlertTriangle` |
| טבלאות חריגים | `fleet.exceptions` | `fleet` | `Settings2` |
| טעינת רכב חשמלי | `fleet.ev_charging` | `fleet` | `Zap` |
| הזמנת רכב שכור | `fleet.rentals` | `fleet` | `Key` |
| טפסי בטיחות | `fleet.safety_forms` | `fleet` | `ClipboardCheck` |
| אישורי חשבוניות ספקים | `fleet.invoices` | `fleet` | `FileCheck` |
| ספר טיפולים מכניים | `fleet.maintenance` | `fleet` | `Wrench` |
| חלקי חילוף/צמיגים | `fleet.parts` | `fleet` | `Cog` |
| רכבי מחנה + QR | `fleet.camp_vehicles` | `fleet` | `QrCode` |
| הפקת דוחות | `fleet.reports` | `fleet` | `BarChart3` |
| דשבורד צמ"ה | `equipment` | NULL | `HardHat` |

Note: `fleet.expenses` (סל הוצאות) is a roll-up view of all cost sub-modules, not a separate data entry module.
It aggregates fuel + tolls + violations + maintenance + parts into one cost view per vehicle or project.

---

## Dashboard Stat Cards — Fleet Home Page (v2.0)

For the v2.0 shell, the fleet dashboard needs real stat cards.
These must be queryable from existing or easily-created tables.

**Stat cards that make sense at v2.0 shell (before sub-modules are built):**

Since the sub-module tables do not exist yet, the v2.0 dashboard uses placeholder stats
drawn from data that DOES exist (employees, projects, companies) plus hardcoded zeros
for fleet-specific stats, with a clear "data will appear here after module activation" label.

| Stat Card | What It Shows | Data Source at v2.0 |
|-----------|---------------|---------------------|
| רכבים פעילים | Count of active vehicles in fleet | Placeholder: 0 (vehicles table not built yet) |
| נהגים פעילים | Count of employees with driver license assigned | employees table — count where driver_license_number IS NOT NULL (if field added) |
| טיפולים החודש | Maintenance services due this month | Placeholder: 0 |
| דוחות פתוחים | Open traffic violations awaiting action | Placeholder: 0 |
| אישורים ממתינים | Supplier invoices pending approval | Placeholder: 0 |
| פרויקטים פעילים | Active projects from existing table | `projects` table — count WHERE status = 'active' AND deleted_at IS NULL |

**Recommendation for v2.0:** Show 6 stat cards with current counts where data exists (active projects) and zeros with "(בפיתוח)" label where sub-module data doesn't exist yet. This makes the dashboard feel real, not empty, while being honest about what's implemented.

---

## MVP Definition for ChemoSys v2.0 Shell

### Launch With (v2.0 milestone — shell only)

- [x] (app) route group with layout — module switcher sidebar, header
- [x] ChemoSys login page — email + password + module selector buttons (grayed if no permission)
- [x] Fleet module home page — dashboard with 6 stat cards + 16 sub-module tiles
- [x] Equipment module home page — dashboard + tiles (all "בפיתוח" placeholder)
- [x] Permission wiring — `requirePermission()` on every (app) route, module-level guard
- [x] New module keys in DB — fleet + equipment + all 16 sub-module keys seeded to `modules` table
- [x] Mobile-responsive tile grid — 2-col on mobile, 4-col on desktop

### Add in Subsequent Milestones (v2.x — one sub-module per milestone)

Priority order based on dependencies and business value:

1. **v2.1** — Vehicle Card + Driver Card (foundational — everything else references these)
2. **v2.2** — Exception Tables (configuration layer — needed before alert-generating modules)
3. **v2.3** — Mileage Management (highest monthly operational burden — replaces spreadsheets)
4. **v2.4** — Fuel Management (second-highest volume + most financial impact)
5. **v2.5** — Mechanical Maintenance Log + Spare Parts (regulatory compliance + cost tracking)
6. **v2.6** — Supplier Invoice Approval (closes the maintenance cost loop)
7. **v2.7** — Toll Road Management (recurring monthly billing reconciliation)
8. **v2.8** — Traffic Violations (lower frequency but high urgency when they occur)
9. **v2.9** — Safety Forms (regulatory requirement — mobile-first)
10. **v2.10** — Camp Vehicle QR Tracking (field-specific, high value for remote sites)
11. **v2.11** — Rental Car Orders (lower volume, simpler workflow)
12. **v2.12** — EV Charging Tracking (small fleet size now, growing)
13. **v2.13** — Expense Roll-up View (requires all cost modules to exist first)
14. **v2.14** — Report Generation (requires data from all sub-modules)
15. **v2.15** — Equipment Module sub-modules (TBD — characterization needed)

### Future Consideration (v3+)

- [ ] GPS integration with Pointer/Matrix/Ituran API — requires vendor contract
- [ ] WhatsApp/SMS notification wiring for document expiry alerts
- [ ] Fuel card CSV/API import (Sonol, Paz)
- [ ] Priority ERP export
- [ ] PWA manifest + offline safety form drafts
- [ ] Driver mobile app (native) — only if PWA proves insufficient

---

## Feature Prioritization Matrix (v2.0 Shell Scope Only)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| (app) route group + layout | HIGH | LOW | P1 |
| ChemoSys login + module selector | HIGH | LOW | P1 |
| Fleet home + 16 tile menu | HIGH | LOW | P1 |
| Permission wiring for (app) routes | HIGH | LOW | P1 |
| DB module keys seeded (fleet sub-modules) | HIGH | LOW | P1 |
| Equipment home + placeholder tiles | MEDIUM | LOW | P1 |
| Mobile-responsive tile grid | HIGH | LOW | P1 |
| Real dashboard stats (live counts) | MEDIUM | MEDIUM | P2 |
| Sub-module nav switcher between fleet/equipment | MEDIUM | LOW | P2 |
| "בפיתוח" placeholder pages per sub-module | LOW | LOW | P3 |

---

## Connections to Existing v1.0 Entities

Every fleet sub-module will reference entities already built in v1.0:

| Fleet Sub-Module | Depends On (v1.0 Entity) | How It Uses It |
|------------------|--------------------------|----------------|
| Driver Card | `employees` | Driver IS an employee — driver card extends employee record with license fields |
| Vehicle Card | `companies` | Which legal entity owns the vehicle (Chemo Aharon has multiple companies) |
| Vehicle Card | `projects` | Vehicle assigned to a project site |
| Mileage | `projects` | Cost allocation: which project is paying for this mileage |
| Fuel | `projects` | Cost allocation: fuel cost attributed to project |
| Toll Roads | `companies` | Billing entity for toll invoices |
| Maintenance Log | `projects` | Vehicle in service while assigned to project |
| Camp Vehicle QR | `projects` | Which project site is the camp (camp_vehicle_coordinator_id already on projects table) |
| Safety Forms | `employees` | Who is the approving safety officer |
| Invoice Approval | `employees` | Who is the approver in the workflow |
| Reports | `projects`, `companies` | Filter reports by project or company |
| Rental Orders | `employees`, `projects` | Who requested, what project code to charge |

**Key insight:** The `projects` table already has `camp_vehicle_coordinator_id` (UUID FK to employees).
This field was added in v1.0 anticipating the Camp Vehicle QR module. It is already there.

---

## Israeli Regulatory Requirements That Drive Features

The following are Israeli-specific requirements that make certain features non-negotiable (not just nice-to-have):

| Requirement | Regulatory Basis | Drives This Feature |
|-------------|-----------------|---------------------|
| Driver license validity check | Transport Authority — Teshuv | Driver card expiry tracking + alerts |
| Annual vehicle roadworthiness test (טסט) | Road Traffic Ordinance | Vehicle card with test expiry date + alerts |
| Vehicle liability insurance (ביטוח חובה) | Mandatory Motor Vehicle Insurance Law | Vehicle card insurance expiry field + alerts |
| Comprehensive insurance | Typically contractual requirement | Vehicle card insurance fields |
| Driver professional license for heavy vehicles (C/CE/D) | Transport Authority | Driver card — license categories with individual expiry per category |
| Daily vehicle inspection (בדיקה יומית) for commercial fleets | Occupational Safety and Health Authority | Safety Forms sub-module — daily checklist |
| Mileage report for tax purposes (personal use allocation) | Income Tax Ordinance — Reg. 207 | Mileage Management — personal vs business split |
| Crane operator certification | Standards Institute / Ministry of Labor | Equipment card certification tracking |

**Confidence:** MEDIUM — based on training knowledge of Israeli fleet compliance requirements. Specific regulation numbers may need verification against current Ministry of Transport circulars.

---

## Competitor Feature Analysis (Israeli Fleet Systems)

| Feature | Shlager/NetFleet (typical) | Track/Ituran Fleet (typical) | Our Approach |
|---------|---------------------------|------------------------------|--------------|
| Driver card | Standalone screen, license categories table | Linked to GPS driver ID | Extend `employees` table — driver is always an employee |
| Vehicle card | Rich with GPS data (location, speed) | GPS-primary, admin secondary | No GPS in v2. Pure admin: registration, assignment, documents |
| Mileage | GPS-auto or manual monthly form | GPS-primary | Manual monthly form → manager approval workflow |
| Fuel | Manual entry or fuel card import | Manual entry | Manual entry, with CSV import path designed from the start |
| Maintenance | Basic service log | Alerts based on odometer (GPS) | Rich log: service type, garage, cost, next service date — odometer manual |
| Safety forms | Paper or basic digital checklist | Not usually included | Mobile-first form with photo + defect flagging |
| Camp vehicle QR | Not standard | Not standard | Custom feature — unique to energy infrastructure camp model |
| EV charging | Not standard (most systems are old) | Basic if any | First-class EV tracking — separates ChemoSys from legacy systems |
| Reports | Fixed canned reports + Excel export | Dashboard + PDF | Flexible date range + multiple filters + Excel + PDF |

**Confidence:** LOW — competitor analysis based on training knowledge of Israeli fleet software market as of 2024. Market may have changed. Do not use for competitive positioning claims without verification.

---

## Sources

- Project context: `.planning/PROJECT.md` — sub-module list, project structure, existing entities
- DB schema: `supabase/migrations/00001_foundation_schema.sql` — existing tables available for FK references
- Domain knowledge: Israeli fleet management systems (training data, confidence MEDIUM)
- Israeli regulatory context: Training knowledge of Transport Authority requirements (confidence MEDIUM — verify against current circulars before implementing compliance claims)
- Competitor analysis: Training knowledge of Shlager, NetFleet, Track, Ituran (confidence LOW — market may have evolved since training cutoff)

---
*Feature research for: ChemoSys v2.0 — Fleet and Equipment Module Shell*
*Researched: 2026-03-04*
