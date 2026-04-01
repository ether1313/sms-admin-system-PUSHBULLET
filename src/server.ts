import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import { PrismaClient } from '@prisma/client'
import { authRouter } from './routes/auth'
import { tasksRouter } from './routes/tasks'
import { dbViewerRouter } from './routes/dbViewer'
import { executionEngine } from './services/executionEngine'

const app = express()
const prisma = new PrismaClient()

// Trust reverse proxy (Fly.io) so req.secure and cookies work over HTTPS
app.set('trust proxy', true)

// ================= Middleware =================
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser(process.env.SESSION_SECRET || 'change-me-in-production'))

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: true, // Force save session on every request to ensure persistence
    saveUninitialized: false,
    name: 'sms-admin-session',
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      domain: undefined, // Let browser set domain automatically
    },
  })
)

// Restore session.adminId from signed cookie if session lost (e.g. restart, multi-instance)
app.use(async (req, _res, next) => {
  if (req.session?.adminId && req.session?.companyId) return next()
  const adminId = req.signedCookies?.adminId
  if (typeof adminId !== 'string') return next()
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, companyId: true },
    })
    if (admin) {
      req.session.adminId = admin.id
      req.session.companyId = admin.companyId
    }
  } catch (_e) {}
  next()
})

// Static files
app.use(express.static('public'))

// ✅ Prisma 单例注入（关键）
app.locals.prisma = prisma

// ================= Routes =================
app.use('/auth', authRouter)
app.use('/tasks', tasksRouter)
app.use('/db-viewer', dbViewerRouter)

// Health check endpoint for Fly.io
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/', (req, res) => {
  if (req.session?.adminId) {
    res.redirect('/tasks')
  } else {
    res.redirect('/auth/login')
  }
})

// ================= Start =================
const PORT = process.env.PORT || 3000

// #region agent log
fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.ts:48',message:'Server starting',data:{port:PORT,nodeEnv:process.env.NODE_ENV,hasDbUrl:!!process.env.DATABASE_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`)
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.ts:52',message:'Server listening started',data:{port:PORT},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.ts:56',message:'Starting execution engine init',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // ⚠️ dev 环境可考虑关闭（下一步再处理）
    await executionEngine.initialize(prisma)
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.ts:60',message:'Execution engine initialized successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    console.log('Execution engine initialized')
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.ts:64',message:'Execution engine init failed',data:{error:error?.message,stack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('Failed to initialize execution engine:', error)
    process.exit(1)
  }
})

// ================= Graceful shutdown =================
const shutdown = async () => {
  await executionEngine.shutdown()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
