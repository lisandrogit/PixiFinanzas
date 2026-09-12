# Contexto

Se debe documentar la especificación funcional completa de una aplicación llamada \*\*PixiFinanzas\*\*, orientada a la gestión personal de finanzas, compuesta por dos módulos principales: \*\*Gastos\*\* (completamente especificado) e \*\*Inversiones\*\* (pendiente, a desarrollar en una fase futura). La app incluye además un esquema de autenticación, usuarios, roles y permisos.

Las imágenes de Logo\_App (logo de la aplicación) y Logo\_Home (imagen de portada del home) estan anexas.

## Identidad del primer usuario a configurar

- Persona: Lisandro Giancarelli, DNI 36444773

- Usuario: lgiancare / Clave: Li$aClo91

- Rol: Rolemaster (acceso completo)

## Modelo de datos referenciado

Tablas y vistas mencionadas en la especificación: GASTOS\_TARJETA, GASTOS\_TRANSFERENCIA, VISTA\_GASTOS\_TARJETA, VISTA\_GASTOS\_TRANSFERENCIA, CAT\_CATEGORIA, CAT\_TARJETA, CAT\_CUENTA, CAT\_TIPO\_GASTO, CAT\_CANAL, CAT\_MES, CAT\_COTIZACION\_DOLAR (también referida como CAT\_COTIZACION\_USD), CAT\_INGRESOS.

Columnas clave recurrentes: IMPORTE, IMPORTE\_USD, MES\_ABONO, TIPO\_GASTO, CATEGORIA.

## 1. Estructura general de navegación

- Menú lateral izquierdo con las secciones del módulo Gastos, en el orden más prudente para la experiencia de usuario.

- Sección "Home - Indicadores" como pantalla por default al ingresar.

## 2. Sección 1: Home - Indicadores

- \*\*Encabezado\*\*: saludo dinámico según franja horaria (Buenos días / Buenas tardes / Buenas noches + nombre del usuario) y fecha del día en formato DD/MM/AAAA.

- \*\*Próximos vencimientos\*\*: resumen de importes de gastos por tarjeta y por transferencia para los próximos 3 períodos (período actual + 1, +2, +3). Para gastos tarjeta, desglosar el importe total por cada tarjeta y por período, expresado en ARS.

- \*\*Salud financiera (velocímetro de gasto)\*\*: gráfico tipo tacómetro que compara el promedio de gastos de los últimos 3 períodos cerrados contra el promedio de los próximos 3 períodos. Escala de 5 secciones: sección central amarilla (sin variación), 2 tonos de verde (tendencia a disminuir) y 2 tonos de rojo (tendencia a incrementar). Debe ubicarse a la derecha del bloque "Próximos vencimientos", en la misma línea visual.

- \*\*Exportación de resumen\*\*: botón para exportar en formato .xlsx los gastos del período seleccionado, incluyendo todos los atributos del modelo de datos según el canal elegido. Filtros: período (selección única, con texto predictivo) y canal (choice box). Exportación siempre en ARS.

- \*\*Resumen de gastos por canal\*\*: gráfico de líneas combinado con el total en ARS por mes (gastos tarjeta + gastos transferencia), mostrando los últimos 9 meses cerrados. Fuente: sumatoria de la columna IMPORTE agrupada por MES\_ABONO en VISTA\_GASTOS\_TARJETA y VISTA\_GASTOS\_TRANSFERENCIA.

- \*\*Resumen de gastos por tipo\*\*: gráfico de barras combinado, ubicado junto al anterior, comparando gastos fijos vs. variables (columna TIPO\_GASTO) por mes, últimos 9 meses. Sumatoria de IMPORTE (ARS) e IMPORTE\_USD (USD) agrupada por MES\_ABONO.

- \*\*Filtros comunes a ambos gráficos\*\*: selector de moneda (ARS o USD, selección única) y selector de categorías de gasto a incluir (todas habilitadas por default).

## 3. Sección 2: Costos Fijos y Variables

- \*\*Detalle de costos fijos\*\*: gráfico de línea con la evolución de costos fijos de los últimos 9 meses cerrados, en ARS. Fuente: TIPO\_GASTO en VISTA\_GASTOS\_TARJETA y VISTA\_GASTOS\_TRANSFERENCIA, sumatoria de IMPORTE (ARS) e IMPORTE\_USD (USD) por MES\_ABONO.

- \*\*Participación de Costos Fijos sobre ingresos\*\*: gráfico de líneas o barras (junto al anterior) mostrando, para los últimos 12 meses cerrados, el porcentaje que representan los costos fijos (TIPO\_GASTO = "COSTO FIJO", columna IMPORTE) sobre el total de ingresos (tabla CAT\_INGRESOS, columna MES\_ABONO) de cada período.

- \*\*Detalle de costos variables\*\*: gráfico de línea combinado por categoría de gasto variable (columna CATEGORIA), últimos 9 meses cerrados, mostrando únicamente las 5 categorías con mayor participación. Filtro de moneda (ARS/USD) que actualiza el gráfico dinámicamente.

## 4. Sección 3: Consultas y actualizaciones retroactivas

- \*\*Consultas generales\*\*: pantalla de búsqueda de gastos existentes con los siguientes filtros (todos con desplegables seleccionables):

- Período de consulta: fecha desde y fecha hasta (obligatorios), filtrando por MES\_ABONO.

- Canal de gasto: tarjeta, transferencia o ambos.

- Tipo de gasto: fijo, variable o ambos.

- Categoría: selección de 1 o varias categorías.

- Resultado: debe incluir todos los atributos disponibles en las vistas. Debe permitir exportar el resultado en .xlsx.

- \*\*Actualizaciones retroactivas\*\*: a partir del resultado de una consulta, permitir editar 1 o n registros mediante la importación de un archivo Excel con la estructura requerida.

- El archivo importado reemplaza los datos del modelo actual para las claves (keys) especificadas.

- Debe ejecutarse un control de validación de formato y de existencia de atributos en las tablas maestras antes de impactar en base de datos.

- Si se detecta al menos un error, el proceso no debe permitir el impacto en base de datos, y debe mostrarse un pop-up con el detalle de los errores encontrados.

- Debe existir un historial de actualizaciones masivas con: fecha, usuario, motivo de edición, cantidad de registros procesados, y estado (error / exitoso).

## 5. Sección 4: Configuraciones

- Acceso mediante ícono de engranaje ubicado a la derecha del botón "ACTUALIZAR", que lleva a una pantalla de administración de tablas maestras.

- Permitir seleccionar el maestro a gestionar y, según la selección, mostrar sus atributos con posibilidad de alta, baja o edición de registros.

- Maestros de datos a administrar: CAT\_CATEGORIA, CAT\_TARJETA, CAT\_CUENTA, CAT\_TIPO\_GASTO, CAT\_CANAL, CAT\_MES, CAT\_COTIZACION\_DOLAR, CAT\_INGRESOS.

## 6. Sección 5: Alta de gastos

- Pantalla de alta de gastos diarios, diseñada para ser la interfaz de mayor uso del sistema: debe priorizarse la simplicidad y rapidez de carga.

- Botón flotante en el footer para agregar un nuevo gasto.

- El formulario y el mecanismo de carga dependen del tipo de gasto seleccionado (fijo o variable), impactando en GASTOS\_TARJETA o GASTOS\_TRANSFERENCIA según corresponda, y reflejándose luego en sus respectivas vistas.

### 6.1. Gasto variable

- Mecanismo de carga: manual, gasto por gasto.

- El formulario debe solicitar todos los atributos necesarios para completar GASTOS\_TARJETA o GASTOS\_TRANSFERENCIA según corresponda.

- Al usuario se le debe mostrar siempre la descripción de cada atributo; en el modelo de datos se debe guardar el ID correspondiente (no la descripción).

- ID\_GASTO: autogenerado según numeración de base de datos.

- FECHA\_CARGA: autocompletado con la fecha del día de carga, en el formato requerido.

- IMPORTE: siempre solicitado en ARS.

- Cotización de dólar: siempre solicitada al usuario, para luego calcular IMPORTE\_USD y registrarla en CAT\_COTIZACION\_USD.

- \*\*Caso especial gasto con tarjeta\*\*: permitir indicar cantidad de cuotas, importe de cada cuota, y período de inicio de la primera cuota. En el modelo de datos, replicar los registros necesarios (uno por cuota) con sus importes y períodos correspondientes.

- Nota: agregar el campo ID\_TIPO\_GASTO en la tabla GASTOS\_TARJETA (pendiente de incorporar al modelo).

### 6.2. Gasto fijo

- Mecanismo de carga: masivo, por archivo/formulario batch.

- El formulario debe precargar por default los costos fijos del último período cerrado, con su valor abonado.

- El usuario puede: editar valores existentes, agregar un nuevo gasto fijo, o eliminar uno existente, dejando el resto sin cambios si así lo desea.

- Cada gasto fijo debe indicar el canal de pago actual (editable para el nuevo período); si el canal es tarjeta, debe mostrar también la tarjeta utilizada (editable).

- El período MES\_ABONO sobre el que impactan las altas/ediciones debe estar indicado en la parte superior del formulario, con posibilidad de edición.

- Al confirmar el lote, el backend debe dar de alta todos los nuevos registros con la estructura completa de atributos para el período definido por el usuario.

### 6.3. Cotización de dólar (aplica a alta de gasto fijo y variable)

- Mostrar un banner con la cotización del dólar oficial del día, actualizable mediante un botón que consuma el siguiente servicio:

- Endpoint: `GET https://dolarapi.com/v1/dolares/oficial`

- Ejemplo de respuesta: `{ "moneda": "USD", "casa": "oficial", "nombre": "Oficial", "compra": 1480, "venta": 1530, "fechaActualizacion": "2026-09-04T18:55:00.000Z" }`

- Mostrar en pantalla el valor de "venta" y la fecha "fechaActualizacion" en formato DD/MM/AAAA.

- El valor de dólar debe ser ingresado por el usuario (no autocompletado automáticamente) y se guarda en CAT\_COTIZACION\_USD junto con la fecha de carga y el período correspondiente (calculados por backend).

- Este valor se utiliza para calcular IMPORTE\_USD en GASTOS\_TARJETA, GASTOS\_TRANSFERENCIA y sus vistas correspondientes.

## 7. Módulo Inversiones

- Documentar como módulo pendiente ("Próximamente"), sin funcionalidad definida aún.

## 8. Usuarios, roles y permisos

- \*\*Login\*\*: pantalla de acceso al sistema, solo para usuarios habilitados con usuario y clave preconfigurados. Mostrar pop-ups informativos en caso de usuario deshabilitado o credenciales incorrectas.

- \*\*Alta de usuario\*\*: flujo "Dar de alta persona → Dar de alta usuario".

- Datos persona: Nombre, Apellido, DNI.

- Datos usuario: nombre de usuario, clave, habilitado (SI/NO).

- Por default, todo usuario nuevo se crea con HABILITADO = SI.

- Si HABILITADO = NO, se bloquea el acceso al sistema aunque las credenciales sean correctas.

- \*\*Roles y permisos\*\*: se asignan por usuario. Roles disponibles:

- Rolemaster: acceso completo (lectura, escritura, delete) a toda la app.

- Consulta: acceso limitado al home y al panel de reportes.

- No se puede asignar rol/permiso a usuarios con HABILITADO = NO.

- \*\*Usuario inicial a configurar\*\*: Lisandro Giancarelli, DNI 36444773, usuario lgiancare, clave Li$aClo91, rol Rolemaster.

- \*\*Cierre de sesión\*\*: botón de logout con pop-up de confirmación.

- \*\*Timeout de sesión\*\*: cierre automático de sesión tras 1 hora de inactividad, para cualquier usuario.

## 9. Assets pendientes

- Logo\_App (logo de la aplicación) y Logo\_Home (imagen de portada del home): a integrar en una fase posterior; dejar referencias/placeholders en la documentación.

# Restricciones

- No omitir ni resumir ninguna funcionalidad descripta; mantener el nivel de detalle original.

- No inventar funcionalidades no mencionadas explícitamente en el input original.

- Usar terminología consistente con los nombres reales de tablas, vistas y columnas provistos (GASTOS\_TARJETA, VISTA\_GASTOS\_TRANSFERENCIA, MES\_ABONO, IMPORTE, IMPORTE\_USD, etc.), sin alterarlos.

- Redacción en español, clara, sin errores ortográficos ni ambigüedades.

- No definir stack tecnológico, arquitectura técnica ni estimaciones de desarrollo: el documento es puramente funcional.