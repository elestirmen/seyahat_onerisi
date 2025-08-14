import { el, qs, clear } from '../utils/dom.js';

export class Toast {
	constructor({ containerSelector = '#toast-root', timeout = 3000 } = {}) {
		this.container = qs(containerSelector) || this._ensureContainer();
		this.timeout = timeout;
	}

	_ensureContainer() {
		const node = el('div', { id: 'toast-root', class: 'toast-root' });
		document.body.appendChild(node);
		return node;
	}

	show(message, { type = 'info', duration = this.timeout } = {}) {
		const toast = el('div', { class: `toast toast-${type}` }, message);
		this.container.appendChild(toast);
		setTimeout(() => {
			toast.classList.add('show');
		}, 10);
		setTimeout(() => this.dismiss(toast), duration);
		return toast;
	}

	dismiss(toast) {
		if (!toast) return;
		toast.classList.remove('show');
		setTimeout(() => toast.remove(), 200);
	}
}
