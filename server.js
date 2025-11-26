const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'cambialo-por-un-valor-seguro';

const DATA_DIR = path.join(__dirname, 'data');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const RSVPS_FILE = path.join(DATA_DIR, 'rsvps.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function readJson(filePath) {
	return new Promise((resolve, reject) => {
		fs.readFile(filePath, 'utf8', (err, data) => {
			if (err) return reject(err);
			try {
				const parsed = data.trim() ? JSON.parse(data) : (Array.isArray(data) ? [] : {});
				resolve(parsed);
			} catch (parseErr) {
				reject(parseErr);
			}
		});
	});
}

function writeJson(filePath, value) {
	return new Promise((resolve, reject) => {
		const tmpPath = `${filePath}.tmp`;
		const json = JSON.stringify(value, null, 2);
		fs.writeFile(tmpPath, json, 'utf8', (writeErr) => {
			if (writeErr) return reject(writeErr);
			fs.rename(tmpPath, filePath, (renameErr) => {
				if (renameErr) return reject(renameErr);
				resolve();
			});
		});
	});
}

// GET /api/guest?code=XXXX
app.get('/api/guest', async (req, res) => {
	const code = String(req.query.code || '').trim().toLowerCase();
	if (!code) {
		return res.status(400).json({ error: 'Falta el parámetro code' });
	}
	try {
		const guests = await readJson(GUESTS_FILE);
		const guest = guests.find((g) => String(g.code).toLowerCase() === code);
		if (!guest) {
			return res.status(404).json({ error: 'Invitado no encontrado' });
		}
		return res.json({
			code: guest.code,
			displayName: guest.displayName,
			maxGuests: Number.isFinite(guest.maxGuests) ? guest.maxGuests : 2
		});
	} catch (err) {
		return res.status(500).json({ error: 'Error leyendo invitados' });
	}
});

// POST /api/rsvp
// body: { code, attendees, message, contact }
app.post('/api/rsvp', async (req, res) => {
	const { code, attendees, message, contact } = req.body || {};
	const normalizedCode = String(code || '').trim().toLowerCase();
	const attendeesNum = Number(attendees);

	if (!normalizedCode) {
		return res.status(400).json({ error: 'Falta el código de invitación' });
	}
	if (!Number.isFinite(attendeesNum) || attendeesNum < 0 || attendeesNum > 12) {
		return res.status(400).json({ error: 'Número de asistentes inválido' });
	}

	try {
		const guests = await readJson(GUESTS_FILE);
		const rsvps = await readJson(RSVPS_FILE);
		const guest = guests.find((g) => String(g.code).toLowerCase() === normalizedCode);
		if (!guest) {
			return res.status(404).json({ error: 'Código inválido' });
		}
		const maxAllowed = Number.isFinite(guest.maxGuests) ? guest.maxGuests : 2;
		if (attendeesNum > maxAllowed) {
			return res.status(400).json({ error: `Máximo permitido: ${maxAllowed}` });
		}
		const nowIso = new Date().toISOString();
		const existingIndex = rsvps.findIndex((r) => String(r.code).toLowerCase() === normalizedCode);
		const newRecord = {
			code: guest.code,
			displayName: guest.displayName,
			attendees: attendeesNum,
			message: String(message || '').slice(0, 1000),
			contact: String(contact || '').slice(0, 200),
			updatedAt: nowIso
		};
		if (existingIndex >= 0) {
			rsvps[existingIndex] = { ...rsvps[existingIndex], ...newRecord };
		} else {
			rsvps.push({ ...newRecord, createdAt: nowIso });
		}
		await writeJson(RSVPS_FILE, rsvps);
		return res.json({ ok: true });
	} catch (err) {
		return res.status(500).json({ error: 'No se pudo guardar la confirmación' });
	}
});

// GET /api/admin/rsvps?key=...
app.get('/api/admin/rsvps', async (req, res) => {
	const key = String(req.query.key || '');
	if (!key || key !== ADMIN_KEY) {
		return res.status(401).json({ error: 'No autorizado' });
	}
	try {
		const rsvps = await readJson(RSVPS_FILE);
		return res.json({ count: rsvps.length, rsvps });
	} catch (err) {
		return res.status(500).json({ error: 'Error leyendo RSVPs' });
	}
});

// Fallback: serve index.html for unknown routes (SPA-like)
app.get('*', (req, res, next) => {
	if (req.path.startsWith('/api/')) return next();
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ensure data files exist
function ensureDataFiles() {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
	if (!fs.existsSync(GUESTS_FILE)) {
		fs.writeFileSync(GUESTS_FILE, JSON.stringify([], null, 2));
	}
	if (!fs.existsSync(RSVPS_FILE)) {
		fs.writeFileSync(RSVPS_FILE, JSON.stringify([], null, 2));
	}
}

ensureDataFiles();

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Servidor iniciado en http://localhost:${PORT}`);
});


