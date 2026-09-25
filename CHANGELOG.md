# Changelog

All notable changes to the Steadfast & Co. Cleaning Team App are recorded here.

## Current brand colors

- Beige accent: `#D5BDAF`
- Beige hover: `#C9AD9D`
- Deep green: `#17352D`
- Cream background: `#F7F5EF`

## 2026-09-15

### Branding and appearance

- Renamed the app from Desert Home Cleaning to Steadfast & Co. Cleaning.
- Replaced the original app mark with the circular `SC` logo.
- Updated the browser title, PWA manifest, installed-app name, and Home Screen icon.
- Removed the “Private Work Board” label.
- Replaced the orange accent throughout the app with beige `#D5BDAF`.
- Added dark-green text to beige buttons for improved readability.

### Authentication and accounts

- Added an owner-only employee profile action that sends a secure, single-use password reset email through Supabase.
- Connected the app to Supabase authentication and database records.
- Added owner and employee roles with two initial pilot seats for each role.
- Replaced demo avatar initials with initials generated from the signed-in user's profile.
- Added sign-in, sign-out, forgot-password, and new-password screens.
- Corrected password-recovery redirects and browser recovery-session handling.
- Added safeguards against indefinite authentication loading on mobile devices.
- Added account activation and deactivation controls for employees.
- Added English and Spanish employee registration flows.
- Added owner-initiated employee invitations using first name, last name, and email address.
- Added pending-invitation employee records that become active after registration.
- Added employee collection of a password, phone number, home address, language, payment preference, service area, and emergency contact.
- Added a branded “Welcome to Steadfast & Co. Cleaning” invitation email template with separate iOS and Android application links.
- Granted the server-only Supabase role access to verify owners and create pending invitation profiles.
- Changed invitation authorization to verify the owner through their signed-in session and create pending profiles through an owner-only database function.
- Replaced the legacy Auth user trigger with a pending-employee-compatible profile trigger so Supabase invitations can create new users successfully.

### Owner work management

- Added an owner-only monthly work calendar beneath the Work Board and Employees tabs, with previous/next month navigation.
- Added yellow calendar entries for posted work awaiting acceptance and green entries once an employee accepts or is assigned.
- Moved the owner “Post new work” action into the tab row above the calendar.
- Positioned the Open blocks, Assigned, and Upcoming pay dashboard modules together directly above the owner calendar.
- Compacted the owner summary modules into one three-column row on mobile instead of stacking them vertically.
- Fit all seven calendar days into a single mobile-screen view without horizontal scrolling.
- Added owner job creation using cleaning-service templates.
- Added editable dates, arrival windows, departure times, pay, city, ZIP code, square footage, occupancy, addresses, access codes, checklists, and private notes.
- Added owner controls to edit and delete jobs.
- Added manual assignment of jobs to active employees.
- Added employee unassignment so work can be returned to the open board.
- Added owner dashboard totals for open jobs, assigned jobs, and upcoming pay.

### Employee experience

- Added available-work and assigned-work views.
- Added first-employee-to-accept job claiming.
- Kept street addresses, access codes, and private notes hidden until assignment.
- Added property occupancy and owner-presence details.
- Added employee directory, profile details, standing, attendance, and payment summaries.

### Notifications and backend

- Added installable PWA support and service-worker registration.
- Added web-push subscription support and new-job notification infrastructure.
- Added automatic push delivery to every subscribed active employee device when an owner posts work.
- Added owner-facing delivery counts and configuration-error feedback after a job is posted.
- Added persistent “Notifications enabled” status on subscribed employee devices.
- Added owner acceptance notifications and an email outbox workflow.
- Added atomic job claiming to prevent two employees from accepting the same job.
- Added row-level security for owner and employee access.
- Added authenticated database grants required by Supabase PostgREST.
- Added a safe migration for the original `admin` and `cleaner` profile roles.
- Added an owner-only database policy for deleting work blocks.
- Removed the duplicate production `SUPABASE_URL` requirement so Netlify does not flag the intentionally public project URL as a leaked secret.
- Updated the signed-in header to welcome the user by first name and show their first/last initials.
- Added an account menu with personal-information editing, notification enrollment, and logout.
- Added a secure self-service profile update database function for owners and employees.
- Shortened the iOS and Android Home Screen app name to `Steadfast & Co.`.
- Added a compact English/Spanish selector to sign-in and password recovery, with the device preference saved for future launches.
- Extended the saved language preference through the signed-in employee work board, job details, profile settings, onboarding, and notification controls.
- Ensured the account menu starts closed after login, opens only from the initials avatar, and closes when tapping elsewhere.
- Made sign-out return immediately to the login screen on mobile while Supabase securely clears the saved local session.
- Prevented mobile Safari from restoring a stale Supabase session immediately after logout.
- Added a compact English/Spanish selector to the signed-in header so users can change the entire app language at any time; the choice remains saved for future launches.

### Development and mobile preview

- Added local preview mode with sample jobs and employees.
- Added LAN/mobile preview support for devices on the same Wi-Fi network.
- Added mobile-safe ID generation for Safari and non-HTTPS local previews.
- Added four-account pilot bootstrap tooling and setup documentation.
