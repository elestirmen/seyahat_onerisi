export function debounce(fn, wait = 250, { leading = false, trailing = true } = {}) {
	let timeout = null;
	let lastArgs = null;
	let invoked = false;
	return function debounced(...args) {
		lastArgs = args;
		if (!timeout && leading && !invoked) {
			invoked = true;
			fn.apply(this, lastArgs);
		}
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			if (trailing && lastArgs) fn.apply(this, lastArgs);
			lastArgs = null;
			invoked = false;
			timeout = null;
		}, wait);
	};
}
