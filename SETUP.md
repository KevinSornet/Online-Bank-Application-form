# Maintainer setup

Notes for whoever looks after the form. Users don't need this. Their guide is the [README](README.md).

## How it fits together
- `index.html` is the form. It's hosted with GitHub Pages from the `main` branch.
- `sheet-save.js` builds the PDF and sends each save to a Google Apps Script web app.
- `config.js` holds that web app's URL.
- `apps-script/Code.gs` is the web app. It lives in the **Bank Applications** sheet (Extensions → Apps Script). It writes the row and stores PDFs and signatures in Drive.

## Updating the Apps Script
1. In the sheet, open **Extensions → Apps Script**, paste in the new `apps-script/Code.gs`, and click **Save**.
2. Go to **Deploy → Manage deployments**, click the pencil, set **Version** to **New version**, and click **Deploy**.
   This keeps the same URL, so `config.js` doesn't change.

## Making a fresh deployment (only if the URL must change)
1. Click **Deploy → New deployment** and pick type **Web app**.
2. Set Execute as **Me** and Who has access **Anyone**, then click **Deploy**.
3. Put the new `/exec` URL into `config.js`, then commit and push.

To check a deployment, open its URL in a private window. It should show `{"ok":true,...}`, not a "You need access" page.

## Notes
- The web app accepts saves from anyone with the form link, but it never returns sheet data.
- Saves are matched to rows by **Record ID**. Clearing the form starts a new ID.
- Columns are matched by header text. Renaming a form field adds a new column on the next save.
