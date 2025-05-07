require('dotenv').config();
const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

const NUM_MESAS = 20;
const HORAS_DISPONIBLES = [
  '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00'
];

let reservas = {};
const filePath = './reservas.json';

function guardarReservas() {
  fs.writeFileSync(filePath, JSON.stringify(reservas, null, 2));
}

function cargarReservas() {
  if (fs.existsSync(filePath)) {
    reservas = JSON.parse(fs.readFileSync(filePath));
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

cargarReservas();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const mensaje = req.body.Body.toLowerCase();
  const from = req.body.From;

  if (mensaje.includes("reservar")) {
    res.send({
      body: "¿Para qué día quieres la reserva? (formato: YYYY-MM-DD)"
    });
  } else if (/\d{4}-\d{2}-\d{2}/.test(mensaje)) {
    res.send({
      body: `¿A qué hora? (Disponibles: ${HORAS_DISPONIBLES.join(', ')})`
    });
  } else if (HORAS_DISPONIBLES.includes(mensaje)) {
    const today = new Date().toISOString().split('T')[0];
    const hora = mensaje;
    if (mesasDisponibles(today, hora) > 0) {
      const mesa = reservarMesa(today, hora);
      res.send({
        body: `✅ Tu reserva está confirmada a las ${hora} en la mesa ${mesa}.`
      });
    } else {
      const sugerencia = sugerirOtraHora(today);
      if (sugerencia) {
        res.send({
          body: `Lo siento, esa hora está llena. ¿Qué te parece a las ${sugerencia}?`
        });
      } else {
        res.send({ body: "No hay disponibilidad hoy. Intenta otro día." });
      }
    }
  } else {
    res.send({ body: "Hola 👋 ¿Quieres reservar? Escribe 'reservar' para comenzar." });
  }
});

app.listen(PORT, () => console.log(`Bot activo en http://localhost:${PORT}`));