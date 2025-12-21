(() => {
	const els = {
		tab: document.getElementById('tabEvents'),
		sec: document.getElementById('secEvents'),
		tabRsvp: document.getElementById('tabRsvp'),
		secRsvp: document.getElementById('secRsvp'),
		tabDesign: document.getElementById('tabDesign'),
		secDesign: document.getElementById('secDesign'),
		tabGuests: document.getElementById('tabGuests'),
		secGuests: document.getElementById('secGuests'),
		form: document.getElementById('eventForm'),
		id: document.getElementById('evId'),
		title: document.getElementById('evTitle'),
		venue: document.getElementById('evVenue'),
		dt: document.getElementById('evDatetime'),
		address: document.getElementById('evAddress'),
		lat: document.getElementById('evLat'),
		lng: document.getElementById('evLng'),
		cover: document.getElementById('evCover'),
		msg: document.getElementById('eventMsg'),
		err: document.getElementById('eventErr'),
		list: document.getElementById('eventsList')
	};
	function showTab() {
		if (!els.tab || !els.sec) return;
		[ {btn:els.tabRsvp, sec:els.secRsvp},
		  {btn:els.tabDesign, sec:els.secDesign},
		  {btn:els.tabGuests, sec:els.secGuests},
		  {btn:els.tab, sec:els.sec} ].forEach(pair => {
			if (!pair.btn || !pair.sec) return;
			const active = pair.btn === els.tab;
			pair.sec.classList.toggle('active', active);
			pair.btn.classList.toggle('secondary', !active);
		});
	}
	els.tab && els.tab.addEventListener('click', showTab);
	function setMsg(ok, text) {
		if (!els.msg || !els.err) return;
		els.msg.hidden = !ok;
		els.err.hidden = ok;
		(ok ? els.msg : els.err).textContent = text || '';
	}
	function render(events) {
		if (!els.list) return;
		if (!Array.isArray(events) || events.length === 0) {
			els.list.textContent = 'No hay eventos.';
			return;
		}
		const rows = events.map(ev => {
			return `<tr>
				<td>${ev.id}</td>
				<td>${ev.title || '—'}</td>
				<td>${ev.venue || '—'}</td>
				<td>${ev.datetimeISO ? new Date(ev.datetimeISO).toLocaleString() : '—'}</td>
				<td>${ev.address || '—'}</td>
				<td>${(ev.lat ?? '—')}, ${(ev.lng ?? '—')}</td>
				<td><button data-id="${ev.id}" class="btn secondary ev-edit">Editar</button>
					<button data-id="${ev.id}" class="btn secondary ev-del">Eliminar</button></td>
			</tr>`;
		}).join('');
		els.list.innerHTML = `<table class="table"><thead><tr>
			<th>ID</th><th>Título</th><th>Lugar</th><th>Fecha/Hora</th><th>Dirección</th><th>Coords</th><th>Acciones</th>
		</tr></thead><tbody>${rows}</tbody></table>`;
		els.list.querySelectorAll('.ev-edit').forEach(b => b.addEventListener('click', () => fillForm(b.dataset.id)));
		els.list.querySelectorAll('.ev-del').forEach(b => b.addEventListener('click', () => removeEvent(b.dataset.id)));
	}
	async function loadEvents() {
		try {
			const res = await fetch('/api/admin/events');
			const data = await res.json().catch(()=>({}));
			if (!res.ok) throw new Error(data.error || 'No se pudo cargar eventos');
			render(data.events || []);
		} catch (e) {
			if (els.list) els.list.textContent = e.message;
		}
	}
	async function fillForm(id) {
		try {
			const res = await fetch('/api/admin/events');
			const data = await res.json().catch(()=>({}));
			const ev = (data.events||[]).find(e => String(e.id) === String(id));
			if (!ev) return;
			els.id.value = ev.id || '';
			els.title.value = ev.title || '';
			els.venue.value = ev.venue || '';
			if (ev.datetimeISO) {
				const d = new Date(ev.datetimeISO);
				const pad = n => String(n).padStart(2,'0');
				els.dt.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
			} else {
				els.dt.value = '';
			}
			els.address.value = ev.address || '';
			els.lat.value = ev.lat ?? '';
			els.lng.value = ev.lng ?? '';
			els.cover.value = ev.cover || '';
			showTab();
		} catch {}
	}
	async function removeEvent(id) {
		if (!confirm('¿Eliminar evento?')) return;
		try {
			const res = await fetch(`/api/admin/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
			const data = await res.json().catch(()=>({}));
			if (!res.ok) throw new Error(data.error || 'No se pudo eliminar');
			loadEvents();
		} catch (e) {
			setMsg(false, e.message);
		}
	}
	async function saveEvent(e) {
		e.preventDefault();
		setMsg(false,'');
		const payload = {
			id: els.id.value.trim(),
			title: els.title.value.trim(),
			venue: els.venue.value.trim(),
			datetimeISO: els.dt.value ? new Date(els.dt.value).toISOString() : '',
			address: els.address.value.trim(),
			lat: els.lat.value.trim(),
			lng: els.lng.value.trim(),
			cover: els.cover.value.trim()
		};
		try {
			const res = await fetch('/api/admin/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json().catch(()=>({}));
			if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
			setMsg(true, 'Evento guardado');
			loadEvents();
		} catch (e) {
			setMsg(false, e.message);
		}
	}
	function init() {
		els.form && els.form.addEventListener('submit', saveEvent);
		loadEvents();
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();


