# Bot de Reservas para Restaurante (WhatsApp + Node.js)

Este es un bot básico para gestionar reservas de un restaurante vía WhatsApp usando Twilio.

## ✅ Características
- Soporta hasta 20 mesas.
- Horario de reservas de 12:00 a 22:00 (bloques de 1 hora).
- Sugerencias automáticas si no hay disponibilidad.

## 🚀 Cómo usar

### 1. Clona el repositorio o descomprime el zip
```bash
npm install
```

### 2. Configura el archivo `.env`
Agrega tus credenciales de Twilio:
```
TWILIO_ACCOUNT_SID=TU_SID
TWILIO_AUTH_TOKEN=TU_TOKEN
```

### 3. Ejecuta el bot
```bash
node index.js
```

### 4. Conecta con Twilio Sandbox
- Ve a: https://www.twilio.com/console/sms/whatsapp/sandbox
- Configura el webhook: `http://tu-servidor/webhook`
- Escribe "join [palabra]" en WhatsApp al número de sandbox

¡Listo! Ya puedes recibir y gestionar reservas automáticamente.