'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser, logout } from '@/lib/api';

export default function Topbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    setUser(getUser());
  }, [router]);

  return (
    <div className="topbar">
      <div className="container">
        <div className="brand">🌾 CreditCEP AI</div>
        <div className="nav">
          <a href="/dashboard">Tableau de bord</a>
          <a href="/simulate">Simuler</a>
          {user && (
            <span style={{ opacity: 0.85 }}>
              {user.fullName} · {user.role}
            </span>
          )}
          <button className="btn ghost" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}
