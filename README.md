# Online Bank Application Form

Fill in the Nissan bank application in the browser, sign it on screen, save it to a Google Sheet, and print or save it as a PDF.

**Live page:** https://kevinsornet.github.io/Online-Bank-Application-form/

## How to use
1. Pick the dealer branch at the top of the form.
2. Fill in the fields. The preview on the right shows exactly what will print.
3. Sign in the E-signatures pads.
4. Click **Save to Sheet** to store the application in the Google Sheet. Saving again updates the same row.
5. Click **Print / Save PDF** and choose "Save as PDF" (paper size: Legal).
6. Click **Clear** before starting the next client. The next save then makes a new row.

## Connecting the Google Sheet (one time)
The sheet is **Bank Applications** in Google Drive:
https://docs.google.com/spreadsheets/d/1l38-iRBzpxufuH7n_0PZMVVlYLKATp3fWR4iXdF0P2U/edit

1. Open the sheet and go to **Extensions → Apps Script**.
2. Delete what's in `Code.gs`, paste in everything from [`apps-script/Code.gs`](apps-script/Code.gs), and click **Save**.
3. Click **Deploy → New deployment**. Pick type **Web app**, set
   - Execute as: **Me**
   - Who has access: **Anyone**
   then click **Deploy** and allow the permissions Google asks for.
4. Copy the **Web app URL** (ends in `/exec`).
5. Paste it into [`config.js`](config.js) as `sheetUrl: 'https://script.google.com/macros/s/…/exec'`, then commit and push.

If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## Where the data goes
- Each application is one row in the **Applications** tab, one column per field.
- Signatures are saved as PNG files in a Drive folder called **Bank Application Signatures**, and the sheet links to them.
- Only people you share the sheet with can read it. The web app can only add or update rows; it never sends sheet data back to the page.
- Anyone who finds the page could still send junk rows, since the web app accepts saves from anyone. Keep the page link within your team.
