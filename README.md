# Best Care

Aplicación móvil de Best Care construida con [Ionic](https://ionicframework.com/) + Angular y [Capacitor](https://capacitorjs.com/).

## Requisitos

- Node.js 20+
- npm
- Android Studio (para builds Android) / Xcode (para iOS)

## Instalación

```bash
npm install
```

> El hook `postinstall` ejecuta `scripts/patch-android-proguard.js`, que corrige
> automáticamente la compatibilidad de ProGuard en los plugins nativos de Capacitor
> con versiones recientes de AGP.

## Desarrollo

```bash
npm start        # sirve la app en http://localhost:8100
```

## Build web

```bash
npm run build    # genera la carpeta www/
```

## Sincronizar con Android/iOS

```bash
npx cap sync
npx cap open android
# o
npx cap open ios
```

## Ramas

- `main`: versión estable/producción.
- `develop`: desarrollo activo. Las ramas `feature/*` y `fix/*` salen de aquí.
