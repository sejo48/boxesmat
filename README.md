# Boxplay TV para Smart TV

Versión web de la aplicación adjunta, adaptada para manejarla desde un sofá con mando a distancia. El modo TV se activa por defecto; `?tv=0` conserva el diseño de escritorio y los controles habituales del navegador.

## Usarla

Publica **index.html y la carpeta assets completa** en el mismo servidor HTTPS. Abre la dirección desde el navegador del televisor. No basta con copiar solo el HTML ni abrirlo como archivo local.

- Flechas: navegación espacial, desplazamiento de listas y menús.
- OK / Enter: seleccionar, activar favoritos o abrir el teclado en pantalla.
- Atrás: cancelar el teclado, cerrar ventanas, salir de pantalla completa, volver del reproductor a los detalles o regresar a Inicio. En Inicio permanece en la aplicación.
- Buscar / correo / PIN: teclado en pantalla, mayúsculas, espacio, borrar, cancelar y confirmar. El PIN permanece enmascarado y respeta la longitud máxima.
- Categorías: OK para entrar en la selección, flechas para cambiar y OK o Atrás para terminar.
- Radio: las teclas de reproducir, pausar, detener y siguiente/anterior controlan las emisoras.
- Video directo: reproducir/pausar, saltos de diez segundos cuando la fuente permite búsqueda, volumen, silencio, subtítulos incluidos en el video y pantalla completa. Las flechas izquierda/derecha también ajustan los deslizadores.

El foco luminoso permanece dentro de las ventanas y vuelve al control que las abrió. Las tarjetas y sus botones de favorito pueden seleccionarse por separado. El diseño incluye márgenes de seguridad, textos grandes y soporte de movimiento reducido.

## Plataformas

Una misma versión web contempla Android TV / Google TV, Samsung Tizen y LG webOS, incluyendo los códigos distintos de Atrás de Samsung y LG. En Tizen registra las teclas multimedia cuando la API está disponible. Android TV necesita un navegador que reciba las teclas del mando; no todos los dispositivos traen uno instalado.

Validado en Chromium con ventanas de 1920×1080 y 1280×720, con pruebas de eventos de mando. **No se ha probado en televisores físicos.** Los navegadores antiguos, codecs, CORS, DRM y restricciones del proveedor requieren comprobarse en el modelo real. Esto es una aplicación web; no incluye APK, WGT ni IPK ni publicación en tiendas.

Los enlaces de video directos y HLS usan el reproductor de la aplicación. Los videos incrustados de Google Drive, OK.ru y otros proveedores conservan sus reproductores externos: el navegador impide controlar su interior desde otra página. No se garantiza navegación ni control multimedia con mando dentro de esos reproductores; una fuente directa compatible es la opción para control completo. Los subtítulos solo se activan si la fuente incluye pistas. El volumen de la aplicación es independiente del volumen del televisor.

Se conserva la comprobación de suscripción, el vínculo de dispositivo y el PIN del archivo suministrado. Los catálogos y Firebase siguen usando sus servicios externos originales. Las pruebas no verifican pagos reales, autorización de cuentas, todos los canales ni todos los proveedores de streaming.

## Desarrollo

Node.js 20 o superior, Python 3 y Chromium instalado. En esta máquina Chromium está en `/usr/bin/chromium`.

```sh
cd /workspace/boxesmat
npm ci --cache /tmp/boxesmat-npm-cache
npm run build
npm start
```

`index.html` contiene el JSX original en el bloque `text/boxplay-source`. Después de editarlo, ejecuta `npm run build`: genera `assets/app.js` y `assets/tailwind.css`. El navegador no necesita Babel ni Tailwind en tiempo de ejecución. React, ReactDOM y HLS están guardados localmente con versiones fijas. `assets/tv.js` y `assets/tv.css` contienen la adaptación de mando y pantalla.

```sh
npm test
```

Las pruebas arrancan su propio servidor en el puerto 8123 y usan Chromium mediante Playwright. `CHROMIUM_PATH` permite indicar otra ruta. Los catálogos y Firebase se sustituyen por datos de prueba; no se realizan pagos ni escrituras externas. El video de prueba es sintético, generado con FFmpeg.

Dependencias distribuidas: React/ReactDOM 18.2.0 (MIT), Babel standalone 7.23.5 (MIT, solo compilación), HLS.js 1.5.8 (Apache-2.0). Sus avisos se conservan en los archivos de `assets/vendor`.
