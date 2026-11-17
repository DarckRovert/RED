# 🏪 Manual Táctico del Comerciante Soberano: Cobros y Pagos Off-Grid con RED

> **Guía operativa para bodegas, farmacias, ferias campesinas, brigadistas y negocios locales que desean aceptar pagos digitales sin depender de internet, bancos ni terminales POS tradicionales.**

---

## 💡 1. ¿Por qué Aceptar Vales RED en tu Negocio?

En cualquier momento, un corte de fibra óptica, un temporal severo, un apagón eléctrico prolongado o una falla en las redes celulares puede inutilizar los sistemas tradicionales de cobro:
- Los cajeros automáticos se apagan.
- Las aplicaciones bancarias (Yape, Plin, transferencias, apps móviles) quedan inaccesibles.
- Los datáfonos de tarjetas de crédito/débito no tienen señal satelital o celular.

En esas circunstancias, los clientes no tienen efectivo y los negocios quedan paralizados. **RED te permite seguir vendiendo y cobrando con tu teléfono móvil en Modo Avión**, mediante códigos QR cifrados que funcionan de dispositivo a dispositivo con tecnología criptográfica de grado militar.

---

## ⚖️ 2. ¿Cómo se Fijan los Precios? (Paridad y Referencia)

Los Créditos y Vales de RED no están sujetos a la especulación de las bolsas de criptomonedas. En el motor económico de la plataforma, el sistema establece una paridad referencial clara y estable:

### Paridad Oficial Preestablecida:
- **1 Crédito RED = S/. 1.00 PEN (Un Sol Peruano)**
- **1 Crédito RED ≈ \$0.27 USD (Dólares Americanos)**

### Ejemplo de Fijación de Precios:
Si en tu tienda vendes un producto a:
- Un kilo de arroz = S/. 4.50 PEN $\rightarrow$ Cobras **4.5 Créditos RED**.
- Una botella de agua = S/. 2.50 PEN $\rightarrow$ Cobras **2.5 Créditos RED**.
- Una recarga de batería solar = S/. 3.00 PEN $\rightarrow$ Cobras **3.0 Créditos RED**.

### Anclaje a Materias Primas de Supervivencia (Modo Black Sky):
Si el dinero fiduciario colapsa por una emergencia extrema, el motor bio-neuromórfico de RED te permite tasar tus productos directamente contra bienes físicos universales:
- 1 Litro de Agua Potable ≈ 3.0 Créditos RED
- 1 Ración de Comida (2000 kcal) ≈ 10.0 Créditos RED
- 50 Wh de Carga de Batería ≈ 2.0 Créditos RED

---

## 📱 3. Cómo Cobrar a un Cliente en 3 Pasos (Sin Internet)

El proceso de cobro se realiza en segundos entre dos teléfonos, incluso si ambos están completamente desconectados de internet y sin tarjeta SIM.

```
+-------------------+           +-------------------+
|  TELÉFONO CLIENTE |           |  TELÉFONO NEGOCIO |
|  (Billetera RED)  |           |     (Punto POS)   |
|                   |           |                   |
| 1. Genera Vale QR |  Escaneo  | 2. Escanea el QR  |
|    Nominativo con | --------> |    con la cámara  |
|    Monto Exacto   |  Cámara   |    del negocio    |
|                   |           |                   |
|                   |  Sonido   | 3. Verificación   |
|                   | <-------- |    Automática     |
|                   |  Piezo    |    Firma Ed25519  |
+-------------------+           +-------------------+
```

### Paso 1: Indicar el Monto al Cliente
1. Dile al cliente el total de su compra (ej. "Son 15 créditos").
2. El cliente abre su aplicación RED, entra en la pestaña **Billetera / Vales P2P** y presiona **"Emitir Vale QR"**.
3. El cliente escribe el monto `15.00` y pulsa generar. La pantalla de su teléfono mostrará un código QR de alta densidad con el formato:
   `VOUCHER:1:voucher_1731...:15.00:...`

### Paso 2: Escanear con tu Teléfono
1. En tu aplicación RED, presiona el botón **Escanear / Canjear Vale** (icono de cámara táctica).
2. Apunta la cámara de tu móvil al código QR del cliente.
3. El motor criptográfico local de tu teléfono lee la carga útil en menos de 50 milisegundos.

### Paso 3: Verificación Criptográfica y Confirmación
Tu teléfono ejecutará automáticamente tres verificaciones matemáticas locales sin tocar internet:
1. **Verificación de Firma:** Comprueba que la firma digital de curva elíptica (Ed25519) pertenezca legítimamente a la identidad del cliente.
2. **Chequeo de Nullifier (Anti-Doble Gasto):** Revisa el registro local (`red_spent_nullifiers_registry_v1`) para cerciorarse de que ese vale específico no haya sido cobrado antes en tu tienda.
3. **Acreditación Inmediata:** Tu teléfono emitirá el tono acústico táctico de éxito (`TacticalAudioEngine.playSuccess()`), mostrará en pantalla:
   > **✅ PAGO VERIFICADO: +15.00 CRÉDITOS RED**  
   > *Identificador del vale registrado en el libro mayor local.*
4. El saldo se suma de inmediato a la billetera de tu negocio.

---

## 🛡️ 4. Preguntas Frecuentes de Seguridad del Comerciante

### ¿Qué pasa si el cliente le toma una captura de pantalla al QR y se lo muestra a otro comerciante?
- Si el vale fue emitido como **Nominativo**, el QR contiene tu identificador único de comerciante (`recipientDid`). Si el cliente intenta mostrárselo a la farmacia de la esquina, el teléfono del farmacéutico lo rechazará al instante diciendo: *"Vale no destinado a este nodo"*.
- Si el vale es al portador, el primer comerciante que lo escanea consume su **Nullifier criptográfico**. En el momento en que tu teléfono o el del otro comerciante entren en contacto con la red de radio comunitaria (Bluetooth o LoRa de un repetidor solar), el vale queda bloqueado para siempre en toda la comarca.

### ¿Qué hago yo con los Créditos RED que reciba en mi negocio?
Tienes tres formas de utilizarlos:
1. **Comprar a Proveedores Locales:** Puedes transferir tus créditos a los agricultores, mayoristas o vecinos que te surten de mercadería y que también utilicen RED.
2. **Pagar Servicios de Infraestructura Comunal:** Los créditos sirven para pagar tiempo de enlace en repetidores solares, almacenamiento en buzones DTN o trueque por energía.
3. **Canjear por Efectivo:** En ferias o asambleas comunitarias donde circule efectivo, los vecinos pueden canjearte créditos por billetes físicos acordando la tasa estándar (S/. 1.00 por crédito).
4. **Trueque por Bienes:** Puedes usar el módulo `OfcBarterMarketModal` para canjear tus créditos acumulados por materias primas esenciales (agua, raciones, combustible, herramientas).

### ¿Puede un hacker o el gobierno congelar los fondos de mi negocio?
**No.** A diferencia de cuentas bancarias tradicionales o plataformas como Binance o PayPal, en RED:
- No existe un servidor central que pueda ser intervenido.
- No hay empresa intermediaria con facultades para bloquear tu cuenta.
- Tu dinero son llaves matemáticas almacenadas de forma cifrada en la memoria interna de tu dispositivo, protegidas por tu biometría o PIN.

---

## 📋 5. Lista de Chequeo Rápida para el Mostrador

Imprime o anota estos 4 puntos clave cerca de tu caja:

- [ ] **Modo Avión Activado:** Tu app RED funciona 100% sin conexión; no necesitas wifi ni datos móviles.
- [ ] **Escuchar el Tono Táctico:** No entregues la mercadería hasta escuchar el pitido piezoeléctrico de éxito y ver el mensaje verde en pantalla.
- [ ] **Verificar el Monto:** Confirma que la cifra mostrada en la notificación verde coincida con el precio de los artículos.
- [ ] **Mantener el Bluetooth Encendido:** Aunque no tengas internet, el Bluetooth permite que tu teléfono sincronice automáticamente los vales cobrados con los repetidores y nodos vecinos que pasen cerca de tu local.
