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

- Connected the app to Supabase authentication and database records.
- Added owner and employee roles with two initial pilot seats for each role.
- Added sign-in, sign-out, forgot-password, and new-password screens.
- Corrected password-recovery redirects and browser recovery-session handling.
- Added safeguards against indefinite authentication loading on mobile devices.
- Added account activation and deactivation controls for employees.
- Added English and Spanish employee registration flows.

### Owner work management

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
- Added owner acceptance notifications and an email outbox workflow.
- Added atomic job claiming to prevent two employees from accepting the same job.
- Added row-level security for owner and employee access.
- Added authenticated database grants required by Supabase PostgREST.
- Added a safe migration for the original `admin` and `cleaner` profile roles.
- Added an owner-only database policy for deleting work blocks.

### Development and mobile preview

- Added local preview mode with sample jobs and employees.
- Added LAN/mobile preview support for devices on the same Wi-Fi network.
- Added four-account pilot bootstrap tooling and setup documentation.
