import { el } from '../utils/dom.js';

export function Spinner({ size = 24, label = 'Loading...' } = {}) {
	const node = el('div', { class: 'spinner', role: 'status', 'aria-live': 'polite', 'aria-label': label });
	node.style.setProperty('--spinner-size', `${size}px`);
	return node;
}
