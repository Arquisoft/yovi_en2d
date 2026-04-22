const client = require("prom-client");

// collect default Node metrics
client.collectDefaultMetrics();

// ================= METRICS =================

// Counter → number of requests
const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status"]
});

// Histogram → request duration
const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 1, 2, 5] // seconds
});

// ================= MIDDLEWARE =================

const httpMetricsMiddleware = (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
        const duration = (Date.now() - start) / 1000; // convert to seconds

        const labels = {
            method: req.method,
            route: req.route?.path || req.path,
            status: res.statusCode
        };

        // increment counter
        httpRequestsTotal.inc(labels);

        // observe latency
        httpRequestDuration.observe(labels, duration);
    });

    next();
};

// ================= EXPORT =================

module.exports = {
    httpMetricsMiddleware,
    register: client.register
};