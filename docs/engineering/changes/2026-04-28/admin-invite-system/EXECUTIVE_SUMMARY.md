# Executive Summary: Admin Invite System
Date: 2026-04-28
Audience: Product owner, clinical advisor

## What was delivered

Previously, any member who knew the URL `/admin` could access the admin dashboard — there was no restriction beyond being logged in. This change closes that gap. The admin area is now only accessible to accounts that have been explicitly granted admin status. The two existing team accounts have been granted this access automatically.

In addition, a new admin management page has been added at `/admin/admins`. From here, any admin can invite a new person by entering their email address. If they already have an account, they receive access immediately and get an email notification. If they do not have an account yet, they receive an invitation email and will automatically become an admin when they sign up. Admins can also remove admin access from anyone on the same page.

Finally, the main navigation bar now shows an "Admin" link only to users who have admin access. Regular members do not see it.

## What phase this advances

This completes the admin access control work in **Phase 1 — Foundation**. The admin CRM is now properly secured and self-managing.

## What comes next

The admin CRM currently shows real data from the database, but the agent configuration pages (`/admin/agents`) allow editing agent settings — those edits should be audited (who changed what and when). Recommend adding a simple audit log in Phase 2 when agents become active in production.

The next major roadmap step is **Phase 2 — Intelligence**: completing the risk engine, supplement protocol generator, and branded PDF report. No decisions are required from the product owner before that work begins.

## Risks or open items

- **Invite email delivery:** The invite email is sent via Supabase's built-in invite system. If the email lands in spam, the invited person will not know they were invited. Recommend checking the Supabase email log if an invitee reports not receiving anything.
- **Admin email is stored temporarily:** The invited person's email is stored in a database table until they accept the invite. This is safe and access-controlled, but worth noting as a minor privacy consideration that will be addressed when broader data-at-rest encryption (Vault) is implemented.
