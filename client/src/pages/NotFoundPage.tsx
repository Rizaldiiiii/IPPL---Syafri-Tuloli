import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/Button.js';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Compass className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold text-ink">Halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-md text-sm text-ink-3">
        Alamat yang Anda buka tidak tersedia. Periksa kembali tautannya atau kembali ke daftar proyek.
      </p>
      <Link to="/projects" className="mt-5">
        <Button variant="primary">Kembali ke daftar proyek</Button>
      </Link>
    </div>
  );
}
