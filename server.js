const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// Cargar variables de entorno si existe .env
try { require('dotenv').config(); } catch {}

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'cambialo-por-un-valor-seguro';

const DATA_DIR = path.join(__dirname, 'data');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const RSVPS_FILE = path.join(DATA_DIR, 'rsvps.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Gate admin.html BEFORE static
app.get('/admin.html', (req, res, next) => {
	if (!isAdmin(req)) {
		return res.redirect('/login.html');
	}
	return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

// ===== Utils de validación de config =====
function isSafeHex(s) {
	return typeof s === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s);
}
function isSafeCssSize(s) {
	return typeof s === 'string' && /^(\d+(\.\d+)?(px|em|rem|vh|vw|%)|auto|cover|contain)$/i.test(s);
}
function isSafeRepeat(s) {
	return typeof s === 'string' && /^(no-repeat|repeat|repeat-x|repeat-y)$/i.test(s);
}
function isSafePosition(s) {
	return typeof s === 'string' && /^([a-z]+\s?[a-z]*|\d+%(\s\d+%)?)$/i.test(s);
}
function isSafeImagePath(p) {
	return typeof p === 'string' && (p === '' || p.startsWith('/background-effect/')) && !p.includes('..');
}
function clamp01(n) {
	const v = Number(n);
	if (!Number.isFinite(v)) return 0;
	return Math.max(0, Math.min(1, v));
}
function parseCookies(req) {
	const header = req.headers?.cookie || '';
	const out = {};
	header.split(';').forEach((p) => {
		const i = p.indexOf('=');
		if (i > -1) {
			const k = p.slice(0, i).trim();
			const v = decodeURIComponent(p.slice(i + 1).trim());
			out[k] = v;
		}
	});
	return out;
}
function adminToken(secret) {
	return crypto.createHash('sha256').update(`admin:${secret}`).digest('hex');
}
function isAdmin(req) {
	// 1) Token por cookie
	const cookies = parseCookies(req);
	if (cookies.admin_token && cookies.admin_token === adminToken(ADMIN_KEY)) return true;
	// 2) Compatibilidad: ?key=
	const key = String(req.query?.key || '');
	if (key && key === ADMIN_KEY) return true;
	return false;
}
function setAdminCookie(res) {
	const token = adminToken(ADMIN_KEY);
	const isProd = process.env.NODE_ENV === 'production';
	res.setHeader('Set-Cookie', `admin_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12};${isProd ? ' Secure;' : ''}`);
}
function clearAdminCookie(res) {
	res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
}

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
		const maxGuestsFromInvitees = Array.isArray(guest.invitees) && guest.invitees.length > 0 ? guest.invitees.length : undefined;
		return res.json({
			code: guest.code,
			displayName: guest.displayName,
			invitees: Array.isArray(guest.invitees) ? guest.invitees : undefined,
			table: guest.table ?? undefined,
			maxGuests: Number.isFinite(guest.maxGuests)
				? guest.maxGuests
				: (maxGuestsFromInvitees ?? 2)
		});
	} catch (err) {
		return res.status(500).json({ error: 'Error leyendo invitados' });
	}
});

// POST /api/rsvp
// body: { code, attendees, message, contact, status }
app.post('/api/rsvp', async (req, res) => {
	const { code, attendees, message, contact, status } = req.body || {};
	const normalizedCode = String(code || '').trim().toLowerCase();
	const attendeesNum = Number(attendees);
	const statusVal = String(status || '').toLowerCase();
	const finalStatus = ['yes','no','maybe'].includes(statusVal) ? statusVal : (attendeesNum > 0 ? 'yes' : 'no');

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
			attendees: finalStatus === 'yes' ? attendeesNum : 0,
			status: finalStatus,
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

// ====== EVENTS ======
// Public: GET /api/event?id=slug
app.get('/api/event', async (req, res) => {
	try {
		const events = await readJson(EVENTS_FILE).catch(() => []);
		let ev = null;
		const id = String(req.query.id || '').trim().toLowerCase();
		// Seguridad: si no es admin, validar que el invitado tenga acceso a ese evento
		if (!isAdmin(req)) {
			const code = String(req.query.code || '').trim().toLowerCase();
			if (!code) return res.status(403).json({ error: 'Código requerido' });
			const guests = await readJson(GUESTS_FILE).catch(() => []);
			const g = (guests || []).find(x => String(x.code || '').toLowerCase() === code);
			if (!g) return res.status(404).json({ error: 'Invitado no encontrado' });
			const allowedId = String(g.eventId || 'default').toLowerCase();
			const targetId = id || allowedId;
			ev = (events || []).find(e => String(e.id).toLowerCase() === targetId) || null;
		} else {
			if (id) ev = (events || []).find(e => String(e.id).toLowerCase() === id) || null;
			if (!ev && Array.isArray(events) && events.length) ev = events[0];
		}
		if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
		return res.json(ev);
	} catch (err) {
		return res.status(500).json({ error: 'Error leyendo eventos' });
	}
});
// Admin: listar
app.get('/api/admin/events', async (req, res) => {
	if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
	try {
		const events = await readJson(EVENTS_FILE).catch(() => []);
		return res.json({ count: (events||[]).length, events: events || [] });
	} catch {
		return res.status(500).json({ error: 'Error leyendo eventos' });
	}
});
// Admin: crear/actualizar
// body: { id, title, description, datetimeISO, venue, address, lat, lng, cover }
app.post('/api/admin/events', async (req, res) => {
	if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
	const b = req.body || {};
	const id = String(b.id || '').trim();
	if (!id) return res.status(400).json({ error: 'Falta id' });
	const ev = {
		id,
		title: String(b.title || '').trim(),
		description: String(b.description || '').trim(),
		datetimeISO: String(b.datetimeISO || '').trim(),
		venue: String(b.venue || '').trim(),
		address: String(b.address || '').trim(),
		lat: b.lat === '' || b.lat === undefined ? undefined : Number(b.lat),
		lng: b.lng === '' || b.lng === undefined ? undefined : Number(b.lng),
		cover: String(b.cover || '').trim()
	};
	try {
		const events = await readJson(EVENTS_FILE).catch(() => []);
		const idx = (events || []).findIndex(e => String(e.id).toLowerCase() === id.toLowerCase());
		if (idx >= 0) events[idx] = { ...events[idx], ...ev };
		else events.push(ev);
		await writeJson(EVENTS_FILE, events);
		return res.json({ ok: true, event: ev });
	} catch {
		return res.status(500).json({ error: 'No se pudo guardar el evento' });
	}
});
// Admin: eliminar
app.delete('/api/admin/events/:id', async (req, res) => {
	if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
	const id = String(req.params.id || '').trim().toLowerCase();
	try {
		let events = await readJson(EVENTS_FILE).catch(() => []);
		const before = events.length;
		events = events.filter(e => String(e.id).toLowerCase() !== id);
		await writeJson(EVENTS_FILE, events);
		return res.json({ ok: true, removed: before - events.length });
	} catch {
		return res.status(500).json({ error: 'No se pudo eliminar el evento' });
	}
});

// ====== AUTH ADMIN ======
// POST /api/auth/login { password }
app.post('/api/auth/login', (req, res) => {
	const pwd = String((req.body && req.body.password) || '');
	if (!pwd) return res.status(400).json({ error: 'Falta contraseña' });
	if (pwd !== ADMIN_KEY) return res.status(401).json({ error: 'Credenciales inválidas' });
	setAdminCookie(res);
	return res.json({ ok: true });
});
// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
	clearAdminCookie(res);
	return res.json({ ok: true });
});

// GET /api/admin/rsvps?key=...
app.get('/api/admin/rsvps', async (req, res) => {
	if (!isAdmin(req)) {
		return res.status(401).json({ error: 'No autorizado' });
	}
	try {
		const rsvps = await readJson(RSVPS_FILE);
		return res.json({ count: rsvps.length, rsvps });
	} catch (err) {
		return res.status(500).json({ error: 'Error leyendo RSVPs' });
	}
});

// ====== GUESTS ADMIN ======
// GET /api/admin/guests -> lista completa
app.get('/api/admin/guests', async (req, res) => {
	if (!isAdmin(req)) {
		return res.status(401).json({ error: 'No autorizado' });
	}
	try {
		const guests = await readJson(GUESTS_FILE);
		return res.json({ count: guests.length, guests });
	} catch (err) {
		return res.status(500).json({ error: 'Error leyendo invitados' });
	}
});
// POST /api/admin/guests -> alta/edición
// body: { code, displayName, maxGuests, invitees?, table? }
app.post('/api/admin/guests', async (req, res) => {
	if (!isAdmin(req)) {
		return res.status(401).json({ error: 'No autorizado' });
	}
	const { code, displayName, maxGuests, invitees, table, eventId } = req.body || {};
	const normalizedCode = String(code || '').trim();
	const name = String(displayName || '').trim();
	const max = Number(maxGuests);
	const tableNum = table === undefined || table === null || table === '' ? undefined : Number(table);
	const eventIdStr = (eventId === undefined || eventId === null) ? undefined : String(eventId).trim();
	let inviteesArr = undefined;
	if (invitees !== undefined && invitees !== null && String(invitees).trim() !== '') {
		if (Array.isArray(invitees)) inviteesArr = invitees.map((x) => String(x).trim()).filter(Boolean);
		else inviteesArr = String(invitees).split(',').map((s) => s.trim()).filter(Boolean);
	}
	if (!normalizedCode) return res.status(400).json({ error: 'Falta code' });
	if (!name) return res.status(400).json({ error: 'Falta displayName' });
	if (!Number.isFinite(max) || max < 1 || max > 12) return res.status(400).json({ error: 'maxGuests inválido (1..12)' });
	if (tableNum !== undefined && !Number.isFinite(tableNum)) return res.status(400).json({ error: 'table inválida' });
	try {
		const guests = await readJson(GUESTS_FILE);
		const idx = guests.findIndex((g) => String(g.code).toLowerCase() === normalizedCode.toLowerCase());
		const record = { code: normalizedCode, displayName: name, maxGuests: max };
		if (inviteesArr && inviteesArr.length) record.invitees = inviteesArr;
		if (tableNum !== undefined) record.table = tableNum;
		if (eventIdStr !== undefined && eventIdStr !== '') record.eventId = eventIdStr;
		if (idx >= 0) {
			guests[idx] = { ...guests[idx], ...record };
		} else {
			guests.push(record);
		}
		await writeJson(GUESTS_FILE, guests);
		return res.json({ ok: true, guest: record });
	} catch (err) {
		return res.status(500).json({ error: 'No se pudo guardar el invitado' });
	}
});

// GET /api/admin/summary?key=...
// Resumen con totales de asistentes confirmados
app.get('/api/admin/summary', async (req, res) => {
	if (!isAdmin(req)) {
		return res.status(401).json({ error: 'No autorizado' });
	}
	try {
		const rsvps = await readJson(RSVPS_FILE);
		const totalAttendees = rsvps.reduce((acc, r) => acc + (Number(r.attendees) || 0), 0);
		const rsvpCount = rsvps.length;
		const lastUpdated = rsvps.reduce((latest, r) => {
			const t = Date.parse(r.updatedAt || r.createdAt || 0) || 0;
			return t > latest ? t : latest;
		}, 0);
		return res.json({
			ok: true,
			rsvpCount,
			totalAttendees,
			lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null
		});
	} catch (err) {
		return res.status(500).json({ error: 'Error generando el resumen' });
	}
});

// ======= THEME/CONFIG =======
// GET /api/config
app.get('/api/config', async (req, res) => {
	try {
		const config = await readJson(CONFIG_FILE).catch(() => ({}));
		return res.json(config || {});
	} catch {
		return res.json({});
	}
});

// POST /api/admin/config?key=...
// Body parcial: { theme: { colors: {...} }, effects: {...} }
app.post('/api/admin/config', async (req, res) => {
	if (!isAdmin(req)) {
		return res.status(401).json({ error: 'No autorizado' });
	}
	const incoming = req.body || {};
	try {
		const current = await readJson(CONFIG_FILE).catch(() => ({}));
		// Merge superficial con whitelisting
		const allowedColorKeys = ['bg','card','ink','muted','primary','primaryInk'];
		const out = { ...current };
		if (incoming.theme && typeof incoming.theme === 'object') {
			out.theme = out.theme || {};
			if (incoming.theme.colors && typeof incoming.theme.colors === 'object') {
				out.theme.colors = out.theme.colors || {};
				for (const k of allowedColorKeys) {
					if (k in incoming.theme.colors && isSafeHex(String(incoming.theme.colors[k]))) {
						out.theme.colors[k] = String(incoming.theme.colors[k]);
					}
				}
			}
			// Tipografías
			if (incoming.theme.typography && typeof incoming.theme.typography === 'object') {
				out.theme.typography = out.theme.typography || {};
				const t = incoming.theme.typography;
				if (t.fontFamilyBody) out.theme.typography.fontFamilyBody = String(t.fontFamilyBody).slice(0, 200);
				if (t.fontFamilyHeadings) out.theme.typography.fontFamilyHeadings = String(t.fontFamilyHeadings).slice(0, 200);
				if (t.baseSize && isSafeCssSize(String(t.baseSize))) out.theme.typography.baseSize = String(t.baseSize);
			}
			// Cards
			if (incoming.theme.cards && typeof incoming.theme.cards === 'object') {
				out.theme.cards = out.theme.cards || {};
				const c = incoming.theme.cards;
				if (c.background && typeof c.background === 'object') {
					out.theme.cards.background = out.theme.cards.background || {};
					const b = c.background;
					if (b.mode && ['color','image','pattern'].includes(String(b.mode))) out.theme.cards.background.mode = String(b.mode);
					if (b.color && (isSafeHex(String(b.color)) || /^rgba?\(/i.test(String(b.color)))) out.theme.cards.background.color = String(b.color);
					if (b.image && isSafeImagePath(String(b.image))) out.theme.cards.background.image = String(b.image);
					if (b.size && isSafeCssSize(String(b.size))) out.theme.cards.background.size = String(b.size);
					if (b.repeat && isSafeRepeat(String(b.repeat))) out.theme.cards.background.repeat = String(b.repeat);
					if (b.position && isSafePosition(String(b.position))) out.theme.cards.background.position = String(b.position);
				}
				if (c.shadow) out.theme.cards.shadow = String(c.shadow).slice(0, 200);
				if (c.border) out.theme.cards.border = String(c.border).slice(0, 200);
			}
		}
		if (incoming.effects && typeof incoming.effects === 'object') {
			out.effects = out.effects || {};
			const eff = incoming.effects;
			if ('defaultEffect' in eff) out.effects.defaultEffect = String(eff.defaultEffect || '');
			if ('hl' in eff) out.effects.hl = clamp01(eff.hl);
			if ('animDefault' in eff) out.effects.animDefault = String(eff.animDefault) === '0' ? 0 : 1;
			if ('cardTextureEnabled' in eff) out.effects.cardTextureEnabled = !!eff.cardTextureEnabled;
			if ('textureSize' in eff && isSafeCssSize(String(eff.textureSize))) out.effects.textureSize = String(eff.textureSize);
		}
		await writeJson(CONFIG_FILE, out);
		return res.json({ ok: true });
	} catch (err) {
		return res.status(500).json({ error: 'No se pudo guardar configuración' });
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
	if (!fs.existsSync(CONFIG_FILE)) {
		const defaults = {
			theme: {
				colors: {
					bg: '#ffffff',
					card: '#efeee9',
					ink: '#a48729',
					muted: '#6b6866',
					primary: '#a48729',
					primaryInk: '#e6c873'
				},
				typography: {
					fontFamilyBody: "Cormorant Garamond, Georgia, 'Times New Roman', serif",
					fontFamilyHeadings: "Cormorant Garamond, Georgia, 'Times New Roman', serif",
					baseSize: '17px'
				},
				cards: {
					background: {
						mode: 'color',
						color: '#a48729e0',
						image: '',
						size: 'cover',
						repeat: 'no-repeat',
						position: 'center'
					},
					shadow: '0 8px 30px rgb(162 133 9 / 22%)',
					border: '1px solid rgba(255,255,255,.10)'
				}
			},
			effects: {
				defaultEffect: 'petalos',
				hl: 1,
				animDefault: 1,
				cardTextureEnabled: true,
				textureSize: '200px'
			}
		};
		fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2));
	}
	if (!fs.existsSync(EVENTS_FILE)) {
		const evDefaults = [{
			id: 'default',
			title: 'Rubén & Miriam',
			description: 'Celebremos juntos este gran día',
			datetimeISO: '2026-03-15T20:00:00',
			venue: 'ARCANGELES EVENTOS',
			address: 'Transportes 109, S.C.O.P., 67190 Guadalupe, N.L., Mexico',
			lat: 25.6552494,
			lng: -100.2000449,
			cover: ''
		}];
		fs.writeFileSync(EVENTS_FILE, JSON.stringify(evDefaults, null, 2));
	}
}

ensureDataFiles();

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Servidor iniciado en http://localhost:${PORT}`);
});


