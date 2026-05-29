/**
 * Ambient declarations for CSS / CSS-module imports used by the web target.
 * Metro/NativeWind handle these at bundle time; this just keeps `tsc` happy.
 */
declare module '*.css';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
