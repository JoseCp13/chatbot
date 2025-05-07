require('dotenv').config();
const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

const NUM_MESAS = 20;
let HORAS_DISPONIBLES = [
  '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00'
];

// Número de WhatsApp del administrador
const ADMIN_NUMBER = process.env.ADMIN_NUMBER || '';

let reservas = {};
let conversaciones = {};
const filePath = './reservas.json';
const horariosPath = './horarios.json';

function guardarReservas() {
  fs.writeFileSync(filePath, JSON.stringify(reservas, null, 2));
}

function cargarReservas() {
  if (fs.existsSync(filePath)) {
    reservas = JSON.parse(fs.readFileSync(filePath));
  }
}

function guardarHorarios() {
  fs.writeFileSync(horariosPath, JSON.stringify(HORAS_DISPONIBLES, null, 2));
}

function cargarHorarios() {
  if (fs.existsSync(horariosPath)) {
    HORAS_DISPONIBLES = JSON.parse(fs.readFileSync(horariosPath));
  }
}

function mesasDisponibles(fecha, hora) {
  if (!reservas[fecha]) reservas[fecha] = {};
  if (!reservas[fecha][hora]) reservas[fecha][hora] = [];
  return NUM_MESAS - reservas[fecha][hora].length;
}

function reservarMesa(fecha, hora) {
  if (!reservas[fecha][hora]) reservas[fecha][hora] = [];
  const mesasOcupadas = reservas[fecha][hora];
  for (let i = 1; i <= NUM_MESAS; i++) {
    if (!mesasOcupadas.includes(i)) {
      mesasOcupadas.push(i);
      guardarReservas();
      return i;
    }
  }
  return null;
}

function sugerirOtraHora(fecha) {
  for (const hora of HORAS_DISPONIBLES) {
    if (mesasDisponibles(fecha, hora) > 0) return hora;
  }
  return null;
}

function crearRespuestaTwilio(mensaje, from) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: from,
    type: "text",
    text: { body: mensaje }
  };
}

// Funciones de administración
function esAdmin(numero) {
  return numero === ADMIN_NUMBER;
}

function verReservas(fecha) {
  if (!reservas[fecha]) return "No hay reservas para esa fecha.";
  
  let mensaje = `📅 Reservas para ${fecha}:\n\n`;
  for (const hora of HORAS_DISPONIBLES) {
    const mesasOcupadas = reservas[fecha][hora] || [];
    mensaje += `${hora}: ${mesasOcupadas.length} mesas ocupadas (${mesasOcupadas.join(', ')})\n`;
  }
  return mensaje;
}

function verReservasSemana(fechaInicio) {
  let mensaje = `📅 Reservas de la semana (${fechaInicio}):\n\n`;
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + i);
    const fechaStr = fecha.toISOString().split('T')[0];
    mensaje += `\n${fechaStr}:\n`;
    for (const hora of HORAS_DISPONIBLES) {
      const mesasOcupadas = reservas[fechaStr]?.[hora] || [];
      mensaje += `${hora}: ${mesasOcupadas.length} mesas ocupadas (${mesasOcupadas.join(', ')})\n`;
    }
  }
  return mensaje;
}

function verMesasDisponibles(fecha, hora) {
  if (!reservas[fecha] || !reservas[fecha][hora]) {
    return `Todas las mesas (${NUM_MESAS}) están disponibles para ${fecha} a las ${hora}.`;
  }
  
  const mesasOcupadas = reservas[fecha][hora];
  const mesasDisponibles = [];
  for (let i = 1; i <= NUM_MESAS; i++) {
    if (!mesasOcupadas.includes(i)) {
      mesasDisponibles.push(i);
    }
  }
  
  return `Mesas disponibles para ${fecha} a las ${hora}:\n${mesasDisponibles.join(', ')}\nTotal: ${mesasDisponibles.length} mesas`;
}

function cancelarReservasDia(fecha) {
  if (!reservas[fecha]) return "No hay reservas para cancelar en esa fecha.";
  
  delete reservas[fecha];
  guardarReservas();
  return `✅ Todas las reservas para ${fecha} han sido canceladas.`;
}

function agregarHorario(hora) {
  if (HORAS_DISPONIBLES.includes(hora)) {
    return "Este horario ya existe.";
  }
  
  HORAS_DISPONIBLES.push(hora);
  HORAS_DISPONIBLES.sort();
  guardarHorarios();
  return `✅ Horario ${hora} agregado correctamente.`;
}

function eliminarHorario(hora) {
  const index = HORAS_DISPONIBLES.indexOf(hora);
  if (index === -1) {
    return "Este horario no existe.";
  }
  
  // Verificar si hay reservas en este horario
  for (const fecha in reservas) {
    if (reservas[fecha][hora] && reservas[fecha][hora].length > 0) {
      return `⚠️ No se puede eliminar el horario ${hora} porque hay reservas activas.`;
    }
  }
  
  HORAS_DISPONIBLES.splice(index, 1);
  guardarHorarios();
  return `✅ Horario ${hora} eliminado correctamente.`;
}

function liberarMesa(fecha, hora, mesa) {
  if (!reservas[fecha] || !reservas[fecha][hora]) {
    return "No hay reservas para esa fecha y hora.";
  }
  
  const index = reservas[fecha][hora].indexOf(mesa);
  if (index > -1) {
    reservas[fecha][hora].splice(index, 1);
    guardarReservas();
    return `✅ Mesa ${mesa} liberada para ${fecha} a las ${hora}.`;
  }
  return "Mesa no encontrada en esa fecha y hora.";
}

cargarReservas();
cargarHorarios();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const mensaje = req.body.Body.toLowerCase();
  const from = req.body.From;

  // Comandos de administrador
  if (esAdmin(from)) {
    if (mensaje.startsWith('ver ')) {
      const partes = mensaje.split(' ');
      if (partes[1] === 'semana') {
        const fecha = partes[2];
        res.json(crearRespuestaTwilio(verReservasSemana(fecha), from));
        return;
      } else {
        const fecha = partes[1];
        res.json(crearRespuestaTwilio(verReservas(fecha), from));
        return;
      }
    }
    
    if (mensaje.startsWith('disponibles ')) {
      const [_, fecha, hora] = mensaje.split(' ');
      res.json(crearRespuestaTwilio(verMesasDisponibles(fecha, hora), from));
      return;
    }
    
    if (mensaje.startsWith('cancelar ')) {
      const fecha = mensaje.split(' ')[1];
      res.json(crearRespuestaTwilio(cancelarReservasDia(fecha), from));
      return;
    }
    
    if (mensaje.startsWith('agregar ')) {
      const hora = mensaje.split(' ')[1];
      res.json(crearRespuestaTwilio(agregarHorario(hora), from));
      return;
    }
    
    if (mensaje.startsWith('eliminar ')) {
      const hora = mensaje.split(' ')[1];
      res.json(crearRespuestaTwilio(eliminarHorario(hora), from));
      return;
    }
    
    if (mensaje.startsWith('liberar ')) {
      const [_, fecha, hora, mesa] = mensaje.split(' ');
      res.json(crearRespuestaTwilio(liberarMesa(fecha, hora, parseInt(mesa)), from));
      return;
    }

    if (mensaje === 'ayuda') {
      const ayuda = `Comandos de administrador:
1. ver YYYY-MM-DD - Ver reservas de una fecha
2. ver semana YYYY-MM-DD - Ver reservas de la semana
3. disponibles YYYY-MM-DD HH:MM - Ver mesas disponibles
4. cancelar YYYY-MM-DD - Cancelar todas las reservas de un día
5. agregar HH:MM - Agregar nuevo horario
6. eliminar HH:MM - Eliminar horario
7. liberar YYYY-MM-DD HH:MM N - Liberar mesa N
8. ayuda - Ver esta ayuda`;
      res.json(crearRespuestaTwilio(ayuda, from));
      return;
    }
  }

  // Inicializar conversación si no existe
  if (!conversaciones[from]) {
    conversaciones[from] = {
      estado: 'inicio',
      fecha: null,
      hora: null
    };
  }

  let respuesta = '';

  switch (conversaciones[from].estado) {
    case 'inicio':
      if (mensaje.includes('reservar')) {
        conversaciones[from].estado = 'esperando_hora';
        respuesta = `Nuestros horarios disponibles son:\n${HORAS_DISPONIBLES.join('\n')}\n\n¿Qué hora prefieres?`;
      } else {
        respuesta = 'Hola 👋 ¿Quieres reservar? Escribe "reservar" para comenzar.';
      }
      break;

    case 'esperando_hora':
      if (HORAS_DISPONIBLES.includes(mensaje)) {
        conversaciones[from].hora = mensaje;
        conversaciones[from].estado = 'esperando_fecha';
        respuesta = '¿Para qué día quieres la reserva? (formato: YYYY-MM-DD)';
      } else {
        respuesta = `Por favor, elige una hora válida:\n${HORAS_DISPONIBLES.join('\n')}`;
      }
      break;

    case 'esperando_fecha':
      if (/\d{4}-\d{2}-\d{2}/.test(mensaje)) {
        const mesa = reservarMesa(mensaje, conversaciones[from].hora);
        if (mesa) {
          respuesta = `✅ Tu reserva está confirmada para el ${mensaje} a las ${conversaciones[from].hora} en la mesa ${mesa}.`;
          conversaciones[from] = { estado: 'inicio' };
        } else {
          const sugerencia = sugerirOtraHora(mensaje);
          if (sugerencia) {
            respuesta = `Lo siento, esa hora está llena. ¿Qué te parece a las ${sugerencia}?`;
            conversaciones[from].hora = sugerencia;
          } else {
            respuesta = "No hay disponibilidad para ese día. Intenta otro día.";
            conversaciones[from] = { estado: 'inicio' };
          }
        }
      } else {
        respuesta = 'Por favor, ingresa la fecha en formato YYYY-MM-DD';
      }
      break;
  }

  res.json(crearRespuestaTwilio(respuesta, from));
});

app.listen(PORT, () => console.log(`Bot activo en http://localhost:${PORT}`));