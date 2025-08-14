import { el, qs, clear } from '../utils/dom.js';

export class Modal {
	constructor({ id = 'app-modal' } = {}) {
		this.root = qs(`#${id}`) || this._createRoot(id);
	}

	_createRoot(id) {
		const overlay = el('div', { id, class: 'modal-overlay', role: 'dialog', 'aria-modal': 'true', hidden: 'hidden' },
			el('div', { class: 'modal-dialog' },
				el('button', { class: 'modal-close', 'aria-label': 'Close', onClick: () => this.hide() }, '×'),
				el('div', { class: 'modal-content' })
			)
		);
		document.body.appendChild(overlay);
		return overlay;
	}

	setContent(nodeOrHtml) {
		const content = qs('.modal-content', this.root);
		clear(content);
		if (typeof nodeOrHtml === 'string') content.innerHTML = nodeOrHtml;
		else content.appendChild(nodeOrHtml);
		return this;
	}

	show() {
		this.root.hidden = false;
		this.root.classList.add('show');
	}

	hide() {
		this.root.classList.remove('show');
		setTimeout(() => (this.root.hidden = true), 150);
	}
}
