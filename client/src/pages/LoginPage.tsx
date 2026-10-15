import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, GanttChartSquare, KeyRound, Mail } from 'lucide-react';
import { loginSchema } from '@gantt/shared';
import { AuthLayout } from '../components/layout/AuthLayout.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Field.js';
import { InlineAlert } from '../components/ui/Feedback.js';
import { useAuth } from '../hooks/useAuth.js';

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.email, values.password);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? '/projects';
      navigate(redirectTo, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Email atau password salah.');
    }
  });

  return (
    <AuthLayout
      title="Masuk ke GanttKu"
      subtitle="Kelola jadwal, dependensi, tim, dan jalur kritis proyek Anda."
      footer={
        <p className="text-sm text-ink-2">
          Belum punya akun?{' '}
          <Link to="/register" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Daftar sekarang
          </Link>
        </p>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        {error ? <InlineAlert tone="danger" title={error} /> : null}

        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="demo@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Minimal 8 karakter"
          error={errors.password?.message}
          {...register('password')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          icon={<ArrowRight className="h-4 w-4" aria-hidden />}
          className="mt-1"
        >
          Masuk
        </Button>

        <div className="rounded-md border border-line bg-surface-2/60 px-4 py-3 text-xs text-ink-2">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <KeyRound className="h-3.5 w-3.5" aria-hidden /> Akun demo
          </p>
          <p className="mt-1">
            Email <span className="font-mono text-ink">demo@example.com</span> · password{' '}
            <span className="font-mono text-ink">Demo12345</span>. Tersedia setelah menjalankan{' '}
            <span className="font-mono">npm run db:seed</span>.
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const schema = z
    .object({
      name: z.string().trim().min(1, { message: 'Nama wajib diisi' }).max(120),
      email: z.string().trim().toLowerCase().email({ message: 'Format email tidak valid' }),
      password: z.string().min(8, { message: 'Password minimal 8 karakter' }),
      confirmPassword: z.string(),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: 'Konfirmasi password tidak sama',
      path: ['confirmPassword'],
    });

  type RegisterFormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await registerUser(values.name, values.email, values.password);
      navigate('/projects', { replace: true });
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Pendaftaran gagal.');
    }
  });

  return (
    <AuthLayout
      title="Buat akun baru"
      subtitle="Data proyek Anda tersimpan di database dan hanya dapat diakses oleh akun Anda."
      footer={
        <p className="text-sm text-ink-2">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Masuk di sini
          </Link>
        </p>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        {error ? <InlineAlert tone="danger" title={error} /> : null}

        <Input
          label="Nama lengkap"
          required
          autoComplete="name"
          placeholder="Contoh: Andi Pratama"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="nama@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          hint="Minimal 8 karakter"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Ulangi password"
          type="password"
          required
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          icon={<ArrowRight className="h-4 w-4" aria-hidden />}
          className="mt-1"
        >
          Daftar
        </Button>

        <p className="flex items-center gap-1.5 text-xs text-ink-3">
          <Mail className="h-3.5 w-3.5" aria-hidden />
          Email dipakai untuk masuk. Password disimpan sebagai hash, bukan teks biasa.
        </p>
      </form>
    </AuthLayout>
  );
}

export function LoginBrandMark(): JSX.Element {
  return <GanttChartSquare className="h-6 w-6" aria-hidden />;
}
