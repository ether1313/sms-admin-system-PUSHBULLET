import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { renderLoginPage, renderLayout } from '../views/layout';

const router = express.Router();

// Login page
router.get('/login', (req: Request, res: Response) => {
  const error = req.query.error as string | undefined;
  const registerError = req.query.registerError as string | undefined;
  const registerSuccess = req.query.registerSuccess === 'true';
  res.send(renderLoginPage(error, registerError, registerSuccess));
});

// Login handler
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect('/auth/login?error=missing-credentials');
  }

  try {
    const prisma = req.app.locals.prisma;
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      console.log('Login failed: Admin not found for username:', username);
      return res.redirect('/auth/login?error=invalid-credentials');
    }

    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      console.log('Login failed: Invalid password for username:', username);
      return res.redirect('/auth/login?error=invalid-credentials');
    }

    // Set adminId in session
    req.session.adminId = admin.id;

    // Set signed cookie with adminId so auth works even if session store is lost (e.g. restart, multi-instance)
    const cookieOpts = {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    res.cookie('adminId', admin.id, { ...cookieOpts, signed: true });

    // Save session explicitly and wait for it to complete
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(err);
        } else {
          console.log('Login successful for username:', username, 'adminId:', admin.id, 'sessionId:', req.sessionID);
          resolve();
        }
      });
    });

    // 303 See Other: browser does GET /tasks and sends cookie (avoids POST redirect cookie issues)
    res.redirect(303, '/tasks');
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/auth/login?error=server-error');
  }
});

// Register handler
router.post('/register', async (req: Request, res: Response) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password || !confirmPassword) {
    return res.redirect('/auth/login?registerError=missing-fields');
  }

  if (password !== confirmPassword) {
    return res.redirect('/auth/login?registerError=password-mismatch');
  }

  try {
    const prisma = req.app.locals.prisma;
    
    // Check if username already exists
    const existing = await prisma.admin.findUnique({
      where: { username },
    });

    if (existing) {
      return res.redirect('/auth/login?registerError=username-exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    res.redirect('/auth/login?registerSuccess=true');
  } catch (error) {
    console.error('Registration error:', error);
    res.redirect('/auth/login?registerError=server-error');
  }
});

// Logout
router.post('/logout', requireAuth, (req: AuthRequest, res: Response) => {
  res.clearCookie('adminId', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  req.session?.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/auth/login');
  });
});

export { router as authRouter };
