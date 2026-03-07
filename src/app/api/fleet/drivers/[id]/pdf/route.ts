/**
 * GET /api/fleet/drivers/[id]/pdf
 *
 * Returns a print-optimized HTML page for the driver card.
 * Opens in a new browser tab — user can Ctrl+P → Save as PDF.
 *
 * Features:
 *   - Company branding header with ChemoSystem logo
 *   - License images (front + back) embedded
 *   - Narrower A4-proportional layout, centered
 *   - Professional document styling
 *
 * Auth: verifyAppUser() — ChemoSys users only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAppUser } from '@/lib/dal'
import {
  getDriverById,
  getDriverLicense,
  getDriverDocuments,
  getDriverViolations,
} from '@/actions/fleet/drivers'

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function calcAge(dob: string | null): string {
  if (!dob) return '—'
  const d = new Date(dob), t = new Date()
  let age = t.getFullYear() - d.getFullYear()
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--
  return `${age}`
}

function calcSeniority(start: string | null): string {
  if (!start) return '—'
  const s = new Date(start), t = new Date()
  const totalMonths = (t.getFullYear() - s.getFullYear()) * 12 + (t.getMonth() - s.getMonth())
  if (totalMonths < 12) return `${totalMonths} חודשים`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y} שנים ו-${m} חודשים` : `${y} שנים`
}

const VIOLATION_LABELS: Record<string, string> = {
  traffic: 'עבירת תנועה',
  parking: 'חניה',
  accident: 'תאונה',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAppUser()
  } catch {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = await params

  const [driver, license, documents, violations] = await Promise.all([
    getDriverById(id),
    getDriverLicense(id),
    getDriverDocuments(id),
    getDriverViolations(id),
  ])

  if (!driver) return new NextResponse('Not Found', { status: 404 })

  const fullAddress = [driver.street, driver.houseNumber, driver.city].filter(Boolean).join(' ')

  const docRows = documents.map((d) => `
    <tr>
      <td>${d.documentName}</td>
      <td>${fmt(d.expiryDate)}</td>
      <td>${d.notes ?? '—'}</td>
    </tr>
  `).join('')

  const violationRows = violations.map((v) => `
    <tr>
      <td>${v.violationNumber ?? '—'}</td>
      <td>${fmt(v.violationDate)}</td>
      <td>${VIOLATION_LABELS[v.violationType ?? ''] ?? '—'}</td>
      <td>${v.vehicleNumber ?? '—'}</td>
      <td>${v.points}</td>
      <td>${v.amount ? `₪${Number(v.amount).toLocaleString()}` : '—'}</td>
      <td>${v.description ?? '—'}</td>
    </tr>
  `).join('')

  // License images section
  const licenseImagesHtml = license && (license.frontImageUrl || license.backImageUrl) ? `
  <div class="license-images">
    ${license.frontImageUrl ? `
    <div class="license-img-box">
      <img src="${license.frontImageUrl}" alt="פנים רשיון" />
      <span>פנים</span>
    </div>` : ''}
    ${license.backImageUrl ? `
    <div class="license-img-box">
      <img src="${license.backImageUrl}" alt="גב רשיון" />
      <span>גב</span>
    </div>` : ''}
  </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>כרטיס נהג — ${driver.fullName}</title>
  <style>
    @page { size: A4; margin: 18mm 22mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      color: #1a1a2e;
      direction: rtl;
      background: #f0f2f5;
    }
    .page {
      max-width: 680px;
      margin: 0 auto;
      background: #fff;
      min-height: 100vh;
    }
    @media screen {
      .page {
        margin: 20px auto;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.12);
        padding: 0;
      }
    }
    @media print {
      body { background: #fff; }
      .page { max-width: none; box-shadow: none; margin: 0; border-radius: 0; }
      .no-print { display: none !important; }
    }

    /* ── Company Branding Header ─────────────────────────────── */
    .brand-header {
      background: linear-gradient(135deg, #0f2942 0%, #1a3f6b 50%, #1e5a8a 100%);
      color: #fff;
      padding: 20px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 8px 8px 0 0;
    }
    @media print { .brand-header { border-radius: 0; } }
    .brand-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-logo {
      width: 48px;
      height: 48px;
      background: rgba(255,255,255,0.15);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .brand-logo img {
      width: 36px;
      height: 36px;
      object-fit: contain;
    }
    .brand-text h1 {
      font-size: 15pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .brand-text .brand-sub {
      font-size: 8.5pt;
      color: rgba(255,255,255,0.7);
      letter-spacing: 1px;
    }
    .brand-left {
      text-align: left;
      font-size: 8pt;
      color: rgba(255,255,255,0.65);
      line-height: 1.6;
    }
    .brand-left .doc-type {
      font-size: 9pt;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      margin-bottom: 2px;
    }

    /* ── Driver Identity Strip ───────────────────────────────── */
    .identity-strip {
      background: #f0f4ff;
      border-bottom: 2px solid #d0daf0;
      padding: 14px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .identity-name {
      font-size: 16pt;
      font-weight: 700;
      color: #0f2942;
    }
    .identity-meta {
      font-size: 9pt;
      color: #555;
      display: flex;
      gap: 16px;
    }
    .identity-meta span { white-space: nowrap; }

    /* ── Content Area ────────────────────────────────────────── */
    .content { padding: 20px 28px 16px; }

    .section { margin-bottom: 18px; page-break-inside: avoid; }
    .section-title {
      font-size: 10pt;
      font-weight: 700;
      color: #0f2942;
      background: linear-gradient(90deg, #eef2fa 0%, #f8f9fc 100%);
      border-right: 4px solid #1a3f6b;
      padding: 6px 12px;
      margin-bottom: 10px;
      border-radius: 0 4px 4px 0;
    }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 20px; }
    .row {
      display: flex;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px solid #f0f0f0;
      align-items: baseline;
    }
    .row label {
      font-size: 8.5pt;
      color: #777;
      width: 100px;
      flex-shrink: 0;
    }
    .row span { font-weight: 500; font-size: 9.5pt; }

    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 4px; }
    th {
      background: #eef2fa;
      text-align: right;
      padding: 5px 8px;
      border: 1px solid #d0d8e8;
      font-weight: 600;
      color: #0f2942;
      font-size: 8pt;
    }
    td {
      padding: 4px 8px;
      border: 1px solid #e4e8f0;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #fafbfe; }

    .cats { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .cat {
      display: inline-block;
      background: #eef2fa;
      border: 1px solid #b8c8e0;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 9pt;
      font-weight: 700;
      color: #1a3f6b;
    }

    /* ── License Images ──────────────────────────────────────── */
    .license-images {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      justify-content: center;
    }
    .license-img-box {
      text-align: center;
      flex: 0 1 240px;
    }
    .license-img-box img {
      width: 100%;
      height: 140px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #d0d8e8;
    }
    .license-img-box span {
      display: block;
      font-size: 8pt;
      color: #888;
      margin-top: 4px;
    }

    /* ── Footer ──────────────────────────────────────────────── */
    .doc-footer {
      border-top: 2px solid #eef2fa;
      padding: 10px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      color: #aaa;
    }
    .doc-footer .sys-name {
      font-weight: 600;
      color: #888;
      letter-spacing: 0.5px;
    }

    @media print {
      .doc-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #fff;
      }
    }

    .status-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 10px;
      font-size: 8.5pt;
      font-weight: 600;
    }
    .status-active { background: #e6f9f0; color: #0a7c42; }
    .status-inactive { background: #fef2f2; color: #b91c1c; }
  </style>
</head>
<body>

<!-- Print button -->
<div class="no-print" style="text-align:center; padding:16px; background:#e8edf5;">
  <button onclick="window.print()" style="padding:10px 28px; background:#1a3f6b; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:11pt; font-weight:600; letter-spacing:0.5px;">
    🖨️ הדפס / שמור כ-PDF
  </button>
</div>

<div class="page">

  <!-- Company Branding Header -->
  <div class="brand-header">
    <div class="brand-right">
      <div class="brand-logo">
        <img src="/logo-icon.png" alt="Chemo" />
      </div>
      <div class="brand-text">
        <h1>מערכת ניהול לוגיסטי</h1>
        <div class="brand-sub">CHEMO SYSTEM</div>
      </div>
    </div>
    <div class="brand-left">
      <div class="doc-type">כרטיס נהג</div>
      תאריך הפקה: ${fmt(new Date().toISOString())}<br>
      פתיחת תיק: ${fmt(driver.openedAt)}
    </div>
  </div>

  <!-- Driver Identity Strip -->
  <div class="identity-strip">
    <div class="identity-name">${driver.fullName}</div>
    <div class="identity-meta">
      <span>מ' עובד: <strong>${driver.employeeNumber}</strong></span>
      <span>${driver.companyName}</span>
      <span class="status-badge ${driver.computedStatus === 'active' ? 'status-active' : 'status-inactive'}">
        ${driver.computedStatus === 'active' ? 'פעיל' : 'לא פעיל'}
      </span>
    </div>
  </div>

  <div class="content">

    <!-- Section 1: Employee details -->
    <div class="section">
      <div class="section-title">פרטי עובד</div>
      <div class="grid">
        <div>
          <div class="row"><label>תחילת עבודה</label><span>${fmt(driver.startDate)}</span></div>
          <div class="row"><label>ותק</label><span>${calcSeniority(driver.startDate)}</span></div>
          <div class="row"><label>גיל</label><span>${calcAge(driver.dateOfBirth)}</span></div>
          <div class="row"><label>אזרחות</label><span>${driver.citizenship === 'israeli' ? 'ישראלי' : 'זר'}</span></div>
          <div class="row"><label>ת.ז. / דרכון</label><span>${driver.citizenship === 'israeli' ? (driver.idNumber ?? '—') : `דרכון: ${driver.passportNumber ?? '—'}`}</span></div>
        </div>
        <div>
          <div class="row"><label>כתובת</label><span>${fullAddress || '—'}</span></div>
          <div class="row"><label>טלפון</label><span>${driver.effectivePhone ?? '—'}</span></div>
          <div class="row"><label>נהג מחנה</label><span>${driver.isOccasionalCampDriver ? 'כן' : 'לא'}</span></div>
          <div class="row"><label>מפעיל צמ"ה</label><span>${driver.isEquipmentOperator ? 'כן' : 'לא'}</span></div>
        </div>
      </div>
      ${driver.notes ? `<div style="margin-top:8px;font-size:8.5pt;color:#555;background:#fafbfe;padding:6px 10px;border-radius:4px;border-right:3px solid #d0daf0;"><strong>הערות:</strong> ${driver.notes}</div>` : ''}
    </div>

    <!-- Section 2: License -->
    <div class="section">
      <div class="section-title">רשיון נהיגה</div>
      ${license ? `
      <div class="grid">
        <div>
          <div class="row"><label>מספר רשיון</label><span style="direction:ltr;">${license.licenseNumber ?? '—'}</span></div>
          <div class="row"><label>תוקף עד</label><span>${fmt(license.expiryDate)}</span></div>
        </div>
        <div>
          <div style="padding:4px 0;">
            <span style="font-size:8.5pt;color:#777;">סוגי רשיון:</span>
            <div class="cats">
              ${(license.licenseCategories ?? []).map((c) => {
                const year = license.categoryIssueYears?.[c]
                return `<span class="cat">${c}${year ? ` (${year})` : ''}</span>`
              }).join('')}
            </div>
          </div>
        </div>
      </div>
      ${licenseImagesHtml}` : '<p style="color:#888;font-size:9pt;padding:4px 0;">לא הוזנו פרטי רשיון</p>'}
    </div>

    <!-- Section 3: Documents -->
    <div class="section">
      <div class="section-title">מסמכים נלווים</div>
      ${documents.length > 0 ? `
      <table>
        <thead><tr><th>שם מסמך</th><th>תוקף</th><th>הערות</th></tr></thead>
        <tbody>${docRows}</tbody>
      </table>` : '<p style="color:#888;font-size:9pt;padding:4px 0;">אין מסמכים נלווים</p>'}
    </div>

    <!-- Section 4: Violations -->
    <div class="section">
      <div class="section-title">תרבות נהיגה — דוחות תעבורה</div>
      ${violations.length > 0 ? `
      <table>
        <thead><tr><th>מ' דוח</th><th>תאריך</th><th>סוג</th><th>רכב</th><th>נקודות</th><th>סכום</th><th>תיאור</th></tr></thead>
        <tbody>${violationRows}</tbody>
      </table>` : '<p style="color:#888;font-size:9pt;padding:4px 0;">אין דוחות רשומים</p>'}
    </div>

  </div>

  <!-- Footer -->
  <div class="doc-footer">
    <span>חמו אהרון בע"מ</span>
    <span class="sys-name">CHEMO SYSTEM</span>
    <span>מסמך זה הופק אוטומטית ואינו מהווה מסמך רשמי</span>
  </div>

</div>

</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
