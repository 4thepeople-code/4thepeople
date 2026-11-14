const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const app = express();

const { errorHandler } = require('./middleware/errorHandler');
const { responseFormatter } = require('./middleware/responseFormatter');
const { resolveCollege } = require('./middleware/resolveCollege');
const { corsOptionsDelegate, validateOriginOrReferer } = require('./middleware/originValidation');
const { validateProxySharedSecret } = require('./middleware/proxySecurity');
const { startEventStatusJob } = require('./services/eventStatusJob');

if (process.env.NODE_ENV !== 'test') {
  startEventStatusJob();
}

// Routers
const authRouter = require('./routes/authRoutes');
const adminRouter = require('./routes/adminRoutes');
const mediaRouter = require('./routes/mediaRoutes');
const inviteRouter = require('./routes/inviteRoutes');
const clubRouter = require('./routes/clubRoutes');
const managerRouter = require('./routes/managerRoutes');
const registrationRouter = require('./routes/registrationRoutes');
const { certificateRouter, managerCertificateRouter } = require('./routes/certificateRoutes');
const publicRouter = require('./routes/publicRoutes');
const platformAuthRouter = require('./platform/platformAuthRoutes');
const platformAdminManagementRouter = require('./platform/platformAdminManagementRoutes');
const platformCollegeManagementRouter = require('./platform/platformCollegeManagementRoutes');

const trustProxySetting = process.env.TRUST_PROXY_HOPS !== undefined
  ? (/^\d+$/.test(process.env.TRUST_PROXY_HOPS)
      ? parseInt(process.env.TRUST_PROXY_HOPS, 10)
      : process.env.TRUST_PROXY_HOPS === 'true'
        ? true
        : process.env.TRUST_PROXY_HOPS === 'false'
          ? false
          : process.env.TRUST_PROXY_HOPS)
  : 1;
app.set('trust proxy', trustProxySetting);

// Shared Proxy Secret Guard (enforce trusted reverse proxy boundary)
app.use(validateProxySharedSecret);

// Standard Express Middlewares
app.use(cookieParser());
app.use(express.json());
app.use(responseFormatter);

// CORS Policy with strict exact-origin allowlist
app.use(cors(corsOptionsDelegate));

// Dynamic Multi-tenant Subdomain Resolution Middleware
app.use(resolveCollege);

// Origin / Referer Validation for State-Changing Requests (CSRF & Subdomain Isolation)
app.use(validateOriginOrReferer);

// Health check routes (exempt from proxy shared secret check)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Staging debug endpoint for reverse proxy header inspection (behind shared secret check)
app.get('/__debug/headers', (req, res, next) => {
  if (process.env.DEBUG_HEADERS !== 'true') {
    return next(); // Fall through to 404 handler when not enabled
  }

  const forwardedHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.startsWith('x-forwarded-')) {
      forwardedHeaders[key] = value;
    }
  }

  res.status(200).json({
    success: true,
    ip: req.ip,
    hostname: req.hostname,
    protocol: req.protocol,
    forwardedHeaders,
    hasSharedSecret: Boolean(req.headers['x-proxy-shared-secret']),
  });
});

// Base route
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Club Event Manager API is running...' });
});

// Platform Super-Administration Routes (/api/platform/auth/*, /api/platform/admins/*, /api/platform/colleges/*)
app.use('/api/platform/auth', platformAuthRouter);
app.use('/api/platform/admins', platformAdminManagementRouter);
app.use('/api/platform', platformCollegeManagementRouter);

// College Tenant API Routes
app.use('/auth', authRouter);
app.use('/api/auth', authRouter);

app.use('/admin', mediaRouter);
app.use('/api/admin', mediaRouter);
app.use('/admin', adminRouter);
app.use('/api/admin', adminRouter);

app.use('/invite', inviteRouter);
app.use('/api/invite', inviteRouter);

app.use('/club', clubRouter);
app.use('/api/club', clubRouter);

app.use('/manager', managerCertificateRouter);
app.use('/api/manager', managerCertificateRouter);
app.use('/manager', managerRouter);
app.use('/api/manager', managerRouter);

app.use('/events', registrationRouter);
app.use('/api/events', registrationRouter);

app.use('/certificates', certificateRouter);
app.use('/api/certificates', certificateRouter);

// Public club browsing routes: GET /clubs and GET /clubs/:clubId
app.use('/', publicRouter);

// 404 Handler for unhandled endpoints
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Route not found', errors: {} });
});

// Central Error Handling Middleware (MUST be registered after all routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server Running at http://localhost:${PORT}`);
  });
}

module.exports = app;
