# Domain cutover runbook: aydinmohseni.com to GitHub Pages

Moves aydinmohseni.com from the WordPress site at InMotion to this repository's GitHub Pages site without interrupting email or other services. Do the steps in order. Where a step says "record", write the result into the log at the end of this file.

What is not yet known (find out in step 1): who the registrar is, whether InMotion or the registrar runs DNS, and whether the domain carries email (MX records) or verification records (TXT) that must survive the move.

## 0. Before you start

- The preview site at `https://amohseni.github.io/<repository>/` is complete, every check passes, and Aydin has approved it.
- Every old address that matters either exists in the new site or has a redirect stub in `src/redirects/` (see `MAINTAINING.md`).
- Old uploads that are linked from elsewhere (papers, slides) are copied to `src/wp-content/uploads/` at their original paths.
- Take a full backup of the WordPress site (files and database) from InMotion's control panel and keep it outside InMotion.

## 1. Record the existing DNS records

1. Find the registrar: a WHOIS lookup on aydinmohseni.com, or InMotion's account panel. Record it.
2. Find the authoritative nameservers (`dig NS aydinmohseni.com +short`). Record them. If they are InMotion's, InMotion runs DNS today.
3. Export or copy every record in the current zone: A, AAAA, CNAME, MX, TXT (SPF, DKIM, DMARC, site verifications), SRV, CAA. If the panel offers a zone file export, save it. Also check with `dig` from outside:
   ```
   dig aydinmohseni.com A +short
   dig aydinmohseni.com AAAA +short
   dig www.aydinmohseni.com CNAME +short
   dig aydinmohseni.com MX +short
   dig aydinmohseni.com TXT +short
   dig _dmarc.aydinmohseni.com TXT +short
   ```
4. Record whether any mailbox or forwarder at @aydinmohseni.com is in use. If InMotion hosts that mail, it stops when the InMotion account is cancelled (step 9), so it needs a new home first.

## 2. Move DNS off InMotion (keep MX and TXT)

If InMotion runs DNS, move DNS to a provider that will outlive the InMotion account: Cloudflare (free plan), or the registrar's own DNS.

1. Create the zone at the new provider. Cloudflare imports existing records on setup; check the import against the list from step 1.
2. Re-create every MX and TXT record exactly. Re-create any other record that serves something besides the website.
3. Leave the website records (apex A, `www`) pointing at InMotion for now.
4. In Cloudflare, set the website records to **DNS only** (grey cloud), not proxied; GitHub Pages issues its own certificate and needs to see the real records.
5. Change the nameservers at the registrar to the new provider's. Wait until `dig NS aydinmohseni.com +short` shows the new ones from more than one network.
6. Send a test email to and from any address at the domain.

If the registrar already runs DNS, skip this step.

## 3. Verify the domain with GitHub

Verification stops anyone else from claiming the domain for their own Pages site.

1. GitHub: profile picture > **Settings > Pages > Add a domain**, enter `aydinmohseni.com`.
2. GitHub shows a TXT record (a name beginning `_github-pages-challenge-amohseni`, and a value). Add it at the DNS provider.
3. Click **Verify**. Leave the TXT record in place afterwards.

## 4. Lower the TTL, one day before the switch

Set the TTL of the apex A records and the `www` record to 300 seconds (5 minutes). Wait at least as long as the old TTL (often a day) before steps 5 and 6, so caches pick up the short TTL.

## 5. Tell the repository about the domain

GitHub asks for the custom domain to be added to the Pages site before the DNS records point at it. Do this step first, then step 6 straight after; between the two, the github.io preview forwards to aydinmohseni.com, which still shows the WordPress site.

1. If the repository variable `PATH_PREFIX` is set, delete it (or set it to `/`) under **Settings > Secrets and variables > Actions > Variables**. When it is unset, the workflow takes the prefix from GitHub Pages, which reports `/` once a custom domain is set.
2. In the repository: **Settings > Pages > Custom domain**, enter `aydinmohseni.com` and save. The DNS check fails until step 6 is done; that is expected.
3. Add the file `src/CNAME` containing one line: `aydinmohseni.com` (`eleventy.config.js` copies it to the site root). GitHub ignores this file when a site is deployed by an Actions workflow, as this one is; the Settings entry in item 2 is what takes effect. The file only records the domain in the repository.
4. Run the workflow (push to `main`, or **Actions > Build and deploy > Run workflow**) and confirm the log line "Path prefix: /". If it still shows the repository path, set the variable `PATH_PREFIX` to `/` and run the workflow again.

## 6. Point the domain at GitHub Pages

Replace the website records (and only those):

| Type | Name | Value |
|---|---|---|
| A | `@` | 185.199.108.153 |
| A | `@` | 185.199.109.153 |
| A | `@` | 185.199.110.153 |
| A | `@` | 185.199.111.153 |
| AAAA | `@` | 2606:50c0:8000::153 |
| AAAA | `@` | 2606:50c0:8001::153 |
| AAAA | `@` | 2606:50c0:8002::153 |
| AAAA | `@` | 2606:50c0:8003::153 |
| CNAME | `www` | amohseni.github.io |

Delete any other A, AAAA or ALIAS record on the apex that points at InMotion. Do not touch MX or TXT records.

## 7. Enforce HTTPS

When the DNS check passes, GitHub requests a certificate (this can take up to an hour). Then tick **Enforce HTTPS** in **Settings > Pages**. Check:

- `https://aydinmohseni.com/` loads the new site with a valid certificate;
- `http://aydinmohseni.com/` and `https://www.aydinmohseni.com/` redirect to it;
- `/cv.pdf`, `/meet/`, and each old address in `src/redirects/` land where they should;
- a few old PDF links under `/wp-content/uploads/` still work;
- `node tools/check.mjs` passes on a build with `PATH_PREFIX=/`.

## 8. Run both for two weeks

Keep the InMotion account and the WordPress site for two weeks after the switch. During that time, watch for broken links reported by readers or in search console, and fix them with redirect stubs or copied files. Once stable, raise the TTL back to 3600 seconds or more.

## 9. Transfer out and cancel

1. If InMotion is the registrar: unlock the domain, get the transfer (EPP) code, and start a transfer to the new registrar (Cloudflare Registrar, or another). Confirm the transfer email. DNS stays at the provider from step 2 throughout, so the site and mail keep working.
2. When the transfer completes, confirm the nameservers and records are unchanged.
3. Download a final backup from InMotion.
4. Cancel the InMotion hosting account.

## Log

| Date | Step | What was found or done |
|---|---|---|
| | | |
