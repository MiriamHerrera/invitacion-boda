(() => {
	function getKey() {
		return localStorage.getItem('ADMIN_KEY') || '';
	}
	const els = {
		tabGuests: document.getElementById('tabGuests'),
		tabRsvp: document.getElementById('tabRsvp'),
		tabDesign: document.getElementById('tabDesign'),
		secGuests: document.getElementById('secGuests'),
		secRsvp: document.getElementById('secRsvp'),
		secDesign: document.getElementById('secDesign'),
		form: document.getElementById('guestForm'),
		code: document.getElementById('gCode'),
		name: document.getElementById('gName'),
		max: document.getElementById('gMax'),
		table: document.getElementById('gTable'),
		invitees: document.getElementById('gInvitees'),
		list: document.getElementById('guestsList'),
		msg: document.getElementById('guestMsg'),
		err: document.getElementById('guestErr')
	};
	function showTab(which) {
		if (!els.tabGuests || !els.secGuests) return;
		const tabs = [
			{ btn: els.tabRsvp, sec: els.secRsvp, key: 'rsvp' },
			{ btn: els.tabDesign, sec: els.secDesign, key: 'design' },
			{ btn: els.tabGuests, sec: els.secGuests, key: 'guests' }
		];
		tabs.forEach(t => {
			if (!t.btn || !t.sec) return;
			const active = t.key === which;
			t.sec.classList.toggle('active', active);
			t.btn.classList.toggle('secondary', !active);
		});
	}
	els.tabGuests && els.tabGuests.addEventListener('click', () => showTab('guests'));

	function setMsg(ok, text) {
		if (!els.msg || !els.err) return;
		els.msg.hidden = !ok;
		els.err.hidden = ok;
		(ok ? els.msg : els.err).textContent = text || '';
	}
	function renderGuests(items, rsvpByCode) {
		if (!els.list) return;
		if (!Array.isArray(items) || items.length === 0) {
			els.list.textContent = 'No hay invitados todavía.';
			return;
		}
		const rows = items.slice().sort((a,b) => String(a.displayName||'').localeCompare(String(b.displayName||''))).map(g => {
			const invitees = Array.isArray(g.invitees) ? g.invitees.join(', ') : '';
			const table = g.table !== undefined ? ` · Mesa ${g.table}` : '';
			const rsvp = rsvpByCode && rsvpByCode[g.code?.toLowerCase()];
			let status = '—';
			if (rsvp) {
				if ((rsvp.status||'').toLowerCase() === 'yes') status = `Sí ${rsvp.attendees}`;
				else if ((rsvp.status||'').toLowerCase() === 'no') status = 'No';
				else status = 'Tal vez';
			}
			return `<tr>
				<td><strong>${(g.displayName||'')}</strong></td>
				<td class="small muted">${(g.code||'')}</td>
				<td>${g.maxGuests}</td>
				<td>${g.table !== undefined ? g.table : '—'}</td>
				<td>${status}</td>
				<td>${invitees || '—'}</td>
			</tr>`;
		}).join('');
		els.list.innerHTML = `<table class="table">
			<thead><tr>
				<th>Invitado</th>
				<th>Código</th>
				<th>Máx</th>
				<th>Mesa</th>
				<th>Confirmados</th>
				<th>Dirigida a</th>
			</tr></thead>
			<tbody>${rows}</tbody>
		</table>`;
	}
	async function loadGuests() {
		try {
			const [resGuests, resRsvps] = await Promise.all([
				fetch('/api/admin/guests'),
				fetch('/api/admin/rsvps')
			]);
			const guestsData = await resGuests.json().catch(() => ({}));
			const rsvpsData = await resRsvps.json().catch(() => ({}));
			if (!resGuests.ok) throw new Error(guestsData.error || 'No se pudo cargar la lista');
			if (!resRsvps.ok) throw new Error(rsvpsData.error || 'No se pudo cargar RSVPs');
			const map = {};
			(Array.isArray(rsvpsData.rsvps) ? rsvpsData.rsvps : []).forEach(r => {
				const code = String(r.code || '').toLowerCase();
				if (code) map[code] = { attendees: Number(r.attendees) || 0, status: r.status || (Number(r.attendees)>0 ? 'yes' : 'no') };
			});
			renderGuests(guestsData.guests || [], map);
		} catch (e) {
			if (els.list) els.list.textContent = e.message;
		}
	}
	async function saveGuest(e) {
		e.preventDefault();
		setMsg(false, '');
		const payload = {
			code: els.code?.value || '',
			displayName: els.name?.value || '',
			maxGuests: Number(els.max?.value || 0),
			invitees: (els.invitees?.value || '').trim(),
			table: (els.table?.value || '').trim()
		};
		try {
			const res = await fetch('/api/admin/guests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
			setMsg(true, 'Invitado guardado');
			loadGuests();
		} catch (e) {
			setMsg(false, e.message);
		}
	}

	function init() {
		els.form && els.form.addEventListener('submit', saveGuest);
		loadGuests();
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();


