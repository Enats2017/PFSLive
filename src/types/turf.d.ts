/**
 * Types for `@turf/turf`.
 *
 * Why this exists: @turf/turf 6.x ships an "exports" map with no "types"
 * condition, so moduleResolution 'bundler' resolves the import to
 * dist/es/index.js and finds no adjacent .d.ts — the module comes through as
 * implicit `any` and fails under `strict`. Its root index.d.ts is not a usable
 * substitute either: it is stale and omits the @turf/helpers re-exports, so
 * pointing tsconfig `paths` at it turns one error into eight.
 *
 * The sub-packages DO ship correct types, so this re-exports them under the
 * barrel name. Runtime is untouched — this is types only, and @turf/turf
 * re-exports these exact functions.
 *
 * Only the members src/utils/geoUtils.ts actually uses are declared. Adding a
 * new turf call will error here rather than silently degrading to `any`; add it
 * to this list. The real fix is upgrading @turf/turf to a version whose exports
 * map carries a "types" condition, which is a dependency change, not a typing one.
 */
declare module '@turf/turf' {
  export { point, lineString } from '@turf/helpers';
  export { default as distance } from '@turf/distance';
  export { default as bearing } from '@turf/bearing';
  export { default as nearestPointOnLine } from '@turf/nearest-point-on-line';
}
