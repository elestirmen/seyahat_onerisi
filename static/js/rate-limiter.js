/**
 * Rate Limiter - API çağrılarını sınırlandırır
 * "Too many requests" hatalarını önlemek için kullanılır
 */
class RateLimiter {
    constructor() {
        this.requests = new Map(); // endpoint -> {lastCall, count, resetTime}
        this.globalLimit = 50; // Dakikada maksimum istek sayısı
        this.perEndpointLimit = 10; // Endpoint başına dakikada maksimum istek
        this.windowMs = 60000; // 1 dakika
        this.minInterval = 1000; // İstekler arası minimum süre (ms)
    }

    canMakeRequest(endpoint) {
        const now = Date.now();
        const key = endpoint || 'global';
        
        if (!this.requests.has(key)) {
            this.requests.set(key, {
                lastCall: 0,
                count: 0,
                resetTime: now + this.windowMs
            });
        }

        const requestData = this.requests.get(key);

        // Zaman penceresi sıfırlandı mı?
        if (now > requestData.resetTime) {
            requestData.count = 0;
            requestData.resetTime = now + this.windowMs;
        }

        // Minimum interval kontrolü
        if (now - requestData.lastCall < this.minInterval) {
            console.warn(`Rate limit: Çok hızlı istek (${key})`);
            return false;
        }

        // Endpoint limiti kontrolü
        if (requestData.count >= this.perEndpointLimit) {
            console.warn(`Rate limit: Endpoint limiti aşıldı (${key})`);
            return false;
        }

        // Global limit kontrolü
        const totalRequests = Array.from(this.requests.values())
            .reduce((sum, data) => sum + data.count, 0);
        
        if (totalRequests >= this.globalLimit) {
            console.warn('Rate limit: Global limit aşıldı');
            return false;
        }

        return true;
    }

    recordRequest(endpoint) {
        const now = Date.now();
        const key = endpoint || 'global';
        
        if (this.requests.has(key)) {
            const requestData = this.requests.get(key);
            requestData.lastCall = now;
            requestData.count++;
        }
    }

    getRemainingRequests(endpoint) {
        const key = endpoint || 'global';
        const requestData = this.requests.get(key);
        
        if (!requestData) return this.perEndpointLimit;
        
        const now = Date.now();
        if (now > requestData.resetTime) {
            return this.perEndpointLimit;
        }
        
        return Math.max(0, this.perEndpointLimit - requestData.count);
    }

    getResetTime(endpoint) {
        const key = endpoint || 'global';
        const requestData = this.requests.get(key);
        
        if (!requestData) return Date.now();
        
        return requestData.resetTime;
    }
}

// Global rate limiter instance
window.rateLimiter = new RateLimiter();

// Fetch wrapper with rate limiting
window.rateLimitedFetch = async function(url, options = {}) {
    const endpoint = new URL(url, window.location.origin).pathname;
    
    if (!window.rateLimiter.canMakeRequest(endpoint)) {
        const resetTime = window.rateLimiter.getResetTime(endpoint);
        const waitTime = Math.ceil((resetTime - Date.now()) / 1000);
        
        throw new Error(`Rate limit aşıldı. ${waitTime} saniye sonra tekrar deneyin.`);
    }

    window.rateLimiter.recordRequest(endpoint);
    
    try {
        const response = await fetch(url, options);
        
        // 429 Too Many Requests durumunda rate limiter'ı güncelle
        if (response.status === 429) {
            console.warn('Server 429 döndü, rate limiter sıfırlanıyor');
            window.rateLimiter.requests.clear();
        }
        
        return response;
    } catch (error) {
        console.error('Rate limited fetch error:', error);
        throw error;
    }
};

console.log('Rate limiter yüklendi - API çağrıları sınırlandırılacak');