/**
 * The one place the build name lives.
 *
 * Used by every on-screen build marker AND by playtest telemetry, so the
 * dashboard always files sessions under the build that was actually played.
 * (P2.1 through P6.5 all reported "P2.1" because the telemetry label was a
 * separate hard-coded string nobody updated.)
 *
 * Change this one line for each release. api/telemetry.js accepts any name
 * that matches /^P\d[\w.-]*$/.
 */
export const BUILD_ID = 'P7.0';
