export function qs(selector, root = document) {
	return root.querySelector(selector);
}

export function qsa(selector, root = document) {
	return Array.from(root.querySelectorAll(selector));
}

export function el(tag, props = {}, ...children) {
	const node = document.createElement(tag);
	Object.entries(props || {}).forEach(([key, value]) => {
		if (key === 'class' || key === 'className') node.className = value;
		else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
		else if (key === 'dataset' && value && typeof value === 'object') Object.assign(node.dataset, value);
		else if (value !== undefined && value !== null) node.setAttribute(key, value);
	});
	children.flat().forEach(child => {
		if (child == null) return;
		if (typeof child === 'string') node.appendChild(document.createTextNode(child));
		else node.appendChild(child);
	});
	return node;
}

export function clear(node) {
	while (node.firstChild) node.removeChild(node.firstChild);
	return node;
}
