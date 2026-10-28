# Popu-Club

Plataforma de cómics de Cherry Bless. React, Vite y Supabase, con versiones web/PWA, Android mediante Capacitor y Windows mediante Electron.

## Desarrollo

1. Usa Node.js 24 y ejecuta `npm ci`.
2. Copia `.env.example` a `.env` y configura la URL y la clave pública de tu proyecto Supabase. Nunca uses una clave `service_role` en el cliente.
3. Ejecuta `npm run dev`.

Los permisos efectivos se aplican en Supabase. El rol local sirve para presentar la interfaz; no concede permisos en la base de datos.

## Comprobaciones

```sh
npm test
npm run lint
npm run build
```

Las pruebas unitarias comprueban fechas locales, rangos diarios y movimientos de orden sin pérdida de elementos. El linter incluye advertencias adicionales de React; revisa su salida además del código de salida.

## Web y PWA

`npm run build` genera `dist`. `vercel.json` incluye las rutas de la SPA y las cabeceras de caché. Configura en Vercel las mismas variables públicas del archivo de ejemplo.

La sesión de Supabase es la fuente de autenticación. Sus eventos sincronizan el perfil mostrado y las rutas. Las respuestas REST autenticadas no se guardan en una caché compartida del service worker. Las actualizaciones conservan los datos de lectura y las imágenes descargadas.

Las estadísticas se calculan con vistas, likes vigentes y comentarios, con paginación y días naturales en la zona horaria del navegador. Los registros históricos de `daily_stats` se conservan. Cada visita nueva tiene un UUID para que reintentar un envío no cree duplicados.

El orden se guarda verificando los errores del servidor y bloqueando operaciones simultáneas desde el mismo panel. Ante un fallo, se intenta restaurarlo y se vuelve a consultar el servidor. Las páginas usan posiciones temporales para evitar conflictos al intercambiarlas. El proceso no cambia los permisos de la base de datos.

## Android firmado

Usa JDK 21 y el SDK Android configurado en `android/local.properties`.

```sh
npm run build
npx cap sync android
```

Prepara `android/keystore.properties` en tu equipo, usando una clave privada existente:

```properties
storeFile=nombre-de-la-clave.jks
storePassword=CONTRASENA_PRIVADA
keyAlias=ALIAS
keyPassword=CONTRASENA_PRIVADA
```

Ejecuta `android/gradlew.bat -p android assembleRelease` en Windows. No ejecutes `cap sync` al mismo tiempo que Gradle. El APK queda en `android/app/build/outputs/apk/release/`.

Las claves y credenciales se excluyen de Git y del despliegue. Guarda un respaldo privado fuera del repositorio. Una firma nueva requiere desinstalar la versión con la firma anterior y puede borrar sus descargas locales. Las actualizaciones posteriores deben reutilizar la nueva clave.

## Windows

```sh
npm run electron:build
```

Genera el instalador NSIS y la versión portátil en `electron-dist/<versión>/`. Electron conserva un origen local estable para mantener la sesión entre aperturas y permite una sola instancia. El servidor solo escucha en `127.0.0.1:18473`.
