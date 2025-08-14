export async function http(method, url, { params, headers, body, retries = 0, retryDelay = 300 } = {}) {
	let finalUrl = url;
	if (params && Object.keys(params).length) {
		const usp = new URLSearchParams(params);
		finalUrl += (url.includes('?') ? '&' : '?') + usp.toString();
	}
	const init = {
		method,
		headers: { 'Content-Type': 'application/json', ...(headers || {}) },
		body: body != null ? JSON.stringify(body) : undefined,
		credentials: 'same-origin'
	};
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const res = await fetch(finalUrl, init);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const ct = res.headers.get('content-type') || '';
			return ct.includes('application/json') ? res.json() : res.text();
		} catch (err) {
			if (attempt === retries) throw err;
			await new Promise(r => setTimeout(r, retryDelay));
		}
	}
}

export const get = (url, opts) => http('GET', url, opts);
export const post = (url, opts) => http('POST', url, opts);
export const put = (url, opts) => http('PUT', url, opts);
export const del = (url, opts) => http('DELETE', url, opts);
