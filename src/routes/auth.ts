import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { renderLoginPage, renderLayout } from '../views/layout';
import { normalizeCompanyName, createCompanyWithAdmin } from '../utils/companyRegistration';

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
      select: { id: true, password: true, companyId: true, role: true },
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
    req.session.companyId = admin.companyId;
    req.session.role = admin.role;

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
  const { username, password, confirmPassword, companyName: rawCompanyName } = req.body;

  if (!username || !password || !confirmPassword || !rawCompanyName) {
    return res.redirect('/auth/login?registerError=missing-fields');
  }

  if (password !== confirmPassword) {
    return res.redirect('/auth/login?registerError=password-mismatch');
  }

  const companyName = normalizeCompanyName(rawCompanyName);
  if (!companyName) {
    return res.redirect('/auth/login?registerError=invalid-company-name');
  }

  try {
    const prisma = req.app.locals.prisma;

    const existingUser = await prisma.admin.findUnique({ where: { username } });
    if (existingUser) {
      return res.redirect('/auth/login?registerError=username-exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Case-insensitive lookup for existing company
    const existingCompany = await prisma.company.findFirst({
      where: { name: { equals: companyName, mode: 'insensitive' } },
      select: { id: true, admins: { select: { id: true }, take: 1 } },
    });

    if (existingCompany) {
      if (existingCompany.admins.length > 0) {
        return res.redirect('/auth/login?registerError=company-exists');
      }
      // Claim the existing company that has no admin yet
      await prisma.admin.create({
        data: { username, password: hashedPassword, companyId: existingCompany.id },
      });
    } else {
      // Brand-new company → create Company + SIM 1-10 + Admin
      await createCompanyWithAdmin(prisma, companyName, username, hashedPassword);
    }

    res.redirect('/auth/login?registerSuccess=true');
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return res.redirect('/auth/login?registerError=company-exists');
    }
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
