export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string[]
  subject: string
  html: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL || "zeiterfassung@zeiterfassung.intern.sgs4x4.de"

  if (!apiKey) {
    console.error("[Email] RESEND_API_KEY fehlt in Umgebungsvariablen")
    throw new Error("Email-Konfiguration fehlt")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[Email] Fehler beim Senden:", error)
    throw new Error("Email konnte nicht gesendet werden")
  }

  return response.json()
}

export function generateMonthClosureEmail(
  userName: string,
  userEmail: string,
  monthName: string,
  totalHours: number,
  expectedHours: number,
  overtime: number,
  entries: Array<{
    date: string
    hours: number
    projectName?: string
    description?: string
    start_time?: string
    end_time?: string
  }>,
) {
  const overtimeColor = overtime >= 0 ? "#10b981" : "#ef4444"
  const overtimeSign = overtime > 0 ? "+" : ""

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monatsabschluss ${monthName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header mit Logo -->
          <tr>
            <td style="background-color: #2b2b2b; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #f4c744; font-size: 24px; font-weight: 600;">SGS 4X4 Zeiterfassung</h1>
            </td>
          </tr>
          
          <!-- Titel -->
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h2 style="margin: 0; color: #111827; font-size: 20px;">Monatsabschluss ${monthName}</h2>
              <p style="margin: 10px 0 0; color: #6b7280; font-size: 14px;">Mitarbeiter: ${userName} (${userEmail})</p>
            </td>
          </tr>
          
          <!-- Zusammenfassung -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; padding: 20px;">
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #6b7280; font-size: 14px;">Erfasste Stunden:</span>
                    <strong style="float: right; color: #111827; font-size: 16px;">${totalHours.toFixed(2)}h</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-top: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Soll-Stunden:</span>
                    <strong style="float: right; color: #111827; font-size: 16px;">${expectedHours}h</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-top: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Differenz:</span>
                    <strong style="float: right; color: ${overtimeColor}; font-size: 16px;">${overtimeSign}${overtime.toFixed(2)}h</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Zeiteinträge -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <h3 style="margin: 0 0 20px; color: #111827; font-size: 16px;">Zeiteinträge (${entries.length})</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                ${entries
                  .map(
                    (entry, index) => `
                  <tr style="background-color: ${index % 2 === 0 ? "#ffffff" : "#f9fafb"};">
                    <td style="padding: 15px; border-bottom: ${index === entries.length - 1 ? "none" : "1px solid #e5e7eb"};">
                      <div style="margin-bottom: 5px;">
                        <strong style="color: #111827; font-size: 14px;">${entry.date}</strong>
                        <span style="float: right; color: #f4c744; font-weight: 600;">${entry.hours.toFixed(2)}h</span>
                      </div>
                      ${entry.projectName ? `<div style="color: #6b7280; font-size: 13px; margin-bottom: 3px;">📁 ${entry.projectName}</div>` : ""}
                      ${entry.description ? `<div style="color: #6b7280; font-size: 13px; margin-bottom: 3px;">📝 ${entry.description}</div>` : ""}
                      ${entry.start_time && entry.end_time ? `<div style="color: #6b7280; font-size: 13px;">🕐 ${entry.start_time} - ${entry.end_time}</div>` : ""}
                    </td>
                  </tr>
                `,
                  )
                  .join("")}
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                Diese Email wurde automatisch vom SGS 4X4 Zeiterfassungssystem generiert.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
