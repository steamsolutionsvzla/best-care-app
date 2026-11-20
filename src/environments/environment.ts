// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // Bigback (API REST v2 + FHIR) - Best Care
  // TODO: si el equipo backend habilita un ambiente de staging/QA,
  // apuntar aquí a esa URL en lugar de producción.
  apiUrl: 'https://bigback.bestclinic.io/api/v2',
  fhirUrl: 'https://bigback.bestclinic.io/fhir',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
