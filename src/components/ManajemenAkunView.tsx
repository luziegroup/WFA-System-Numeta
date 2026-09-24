import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { User, UserRole } from '../types';
import { DEFAULT_PASSWORD } from '../lib/password';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  Briefcase,
  Phone,
  Mail,
  AtSign,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  KeyRound,
  LogIn,
  X,
  Check
} from 'lucide-react';

export const ManajemenAkunView: React.FC = () => {
  const {
    allUsers,
    currentUser,
    resetUserPassword,
    addUser,
    updateUser,
    deleteUser,
    showToast,
    wfaSettings,
    loginAsUser,
    isImpersonating
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterDivision, setFilterDivision] = useState<string>('all');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    phone: '',
    role: 'karyawan' as UserRole,
    division: 'Tech & Engineering',
    leaderId: 'usr-lead-1',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    joinDate: new Date().toISOString().split('T')[0],
    isActive: true,
  });

  const divisions = useMemo(() => Array.from(new Set(allUsers.map((u) => u.division))), [allUsers]);
  const leaders = useMemo(() => allUsers.filter((u) => u.role === 'leader'), [allUsers]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.phone && u.phone.includes(searchTerm));
      const matchesRole = filterRole === 'all' || u.role === filterRole;
      const matchesDiv = filterDivision === 'all' || u.division === filterDivision;
      return matchesSearch && matchesRole && matchesDiv;
    });
  }, [allUsers, searchTerm, filterRole, filterDivision]);

  // Metrics
  const metrics = useMemo(() => {
    const total = allUsers.length;
    const kary = allUsers.filter((u) => u.role === 'karyawan').length;
    const lead = allUsers.filter((u) => u.role === 'leader').length;
    const hrd = allUsers.filter((u) => u.role === 'hrd').length;
    return { total, kary, lead, hrd };
  }, [allUsers]);

  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      email: '',
      username: '',
      phone: '',
      role: 'karyawan',
      division: 'Tech & Engineering',
      leaderId: leaders[0]?.id || '',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      joinDate: new Date().toISOString().split('T')[0],
      isActive: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (u: User) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      username: u.username || u.email.split('@')[0] || '',
      phone: u.phone || '',
      role: u.role,
      division: u.division,
      leaderId: u.leaderId || (leaders[0]?.id || ''),
      avatar: u.avatar,
      joinDate: u.joinDate || new Date().toISOString().split('T')[0],
      isActive: u.isActive !== false,
    });
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      showToast('Nama dan Email wajib diisi!', 'warning');
      return;
    }

    const leaderObj = leaders.find((l) => l.id === formData.leaderId);

    if (editingUser) {
      updateUser(editingUser.id, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        username: formData.username.trim() || undefined,
        phone: formData.phone.trim(),
        role: formData.role,
        division: formData.division,
        leaderId: formData.role === 'karyawan' ? formData.leaderId : undefined,
        leaderName: formData.role === 'karyawan' ? leaderObj?.name : undefined,
        avatar: formData.avatar,
        joinDate: formData.joinDate,
        isActive: formData.isActive,
      });
      setEditingUser(null);
    } else {
      addUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        username: formData.username.trim() || undefined,
        phone: formData.phone.trim(),
        role: formData.role,
        division: formData.division,
        leaderId: formData.role === 'karyawan' ? formData.leaderId : undefined,
        leaderName: formData.role === 'karyawan' ? leaderObj?.name : undefined,
        avatar: formData.avatar,
        joinDate: formData.joinDate,
        isActive: formData.isActive,
      });
      setIsAddModalOpen(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    if (userToDelete.id === currentUser.id) {
      showToast('Tidak dapat menghapus akun yang sedang Anda gunakan saat ini!', 'warning');
      setUserToDelete(null);
      return;
    }
    deleteUser(userToDelete.id);
    setUserToDelete(null);
  };

  const toggleUserStatus = (u: User) => {
    const updatedStatus = u.isActive === false;
    updateUser(u.id, { isActive: updatedStatus });
    showToast(
      `Status akun ${u.name} diubah menjadi ${updatedStatus ? 'Aktif' : 'Nonaktif'}`,
      'info'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-300 text-xs font-semibold uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>Luzie Group &bull; Manajemen Data Personil &amp; Akses Sistem</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Manajemen Akun Pengguna</h1>
          <p className="text-xs text-blue-100/90 mt-1 max-w-xl">
            Kelola profil pengguna, hak akses peran (Karyawan, Leader, HRD Admin), penugasan koordinator divisi, dan status aktif akun.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition-all shadow-md shrink-0 self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Tambah Akun Baru</span>
        </button>
      </div>

      {/* Grid 4 Kartu Metrik Akun */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Total Pengguna</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.total}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Semua peran terdaftar</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Karyawan WFA</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-600 mt-2">{metrics.kary}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Staf pelaksana to-do</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Koordinator / Leader</span>
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">{metrics.lead}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Reviewer &amp; evaluator tim</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Tim HRD / Admin</span>
            <Shield className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold text-sky-600 mt-2">{metrics.hrd}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Pengelola sistem WFA</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama, email, atau telepon pengguna..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
        >
          <option value="all">Semua Peran (Role)</option>
          <option value="karyawan">Karyawan WFA</option>
          <option value="leader">Koordinator / Leader</option>
          <option value="hrd">HRD Admin</option>
        </select>

        <select
          value={filterDivision}
          onChange={(e) => setFilterDivision(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
        >
          <option value="all">Semua Divisi</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Tabel Manajemen Pengguna */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Pengguna</th>
                <th className="py-3.5 px-4">Peran (Role)</th>
                <th className="py-3.5 px-4">Divisi &amp; Koordinator</th>
                <th className="py-3.5 px-4">Kontak Telepon</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <p>Tidak ada pengguna yang sesuai dengan kriteria pencarian.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isActive = u.isActive !== false;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Avatar, Nama & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{u.email}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <AtSign className="w-3 h-3 text-slate-400" />
                              <span>{u.username || u.email.split('@')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 ${
                            u.role === 'karyawan'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : u.role === 'leader'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}
                        >
                          {u.role === 'karyawan' && <Briefcase className="w-3 h-3" />}
                          {u.role === 'leader' && <Shield className="w-3 h-3" />}
                          {u.role === 'hrd' && <Users className="w-3 h-3" />}
                          <span>{u.role === 'karyawan' ? 'Karyawan WFA' : u.role === 'leader' ? 'Koordinator' : 'HRD Admin'}</span>
                        </span>
                      </td>

                      {/* Divisi & Koordinator */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{u.division}</div>
                        {u.role === 'karyawan' && (
                          <div className="text-[11px] text-slate-400">
                            Leader: {u.leaderName || 'Ariesta Jatmiko'}
                          </div>
                        )}
                      </td>

                      {/* Telepon */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {u.phone || '0812-xxxx-xxxx'}
                      </td>

                      {/* Status Aktif */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleUserStatus(u)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-500" />
                              <span>Nonaktif</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Login sebagai ${u.name}? Anda bisa kembali ke akun Admin kapan saja lewat tombol di bagian atas.`
                                )
                              ) {
                                loginAsUser(u.id);
                              }
                            }}
                            disabled={isImpersonating}
                            title={
                              isImpersonating
                                ? 'Kembali ke akun Admin dulu sebelum login sebagai akun lain'
                                : `Login sebagai ${u.name}`
                            }
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold text-[11px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Login</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (window.confirm(`Reset password ${u.name} ke password default (${DEFAULT_PASSWORD})?`)) {
                              resetUserPassword(u.id);
                            }
                          }}
                          title="Reset password ke default"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Reset</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(u)}
                          title="Edit Akun"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {!isCurrent && (
                          <button
                            onClick={() => setUserToDelete(u)}
                            title="Hapus Akun"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TAMBAH / EDIT AKUN */}
      {(isAddModalOpen || editingUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-100 shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingUser ? 'Edit Akun Pengguna' : 'Tambah Akun Pengguna Baru'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Misal: Budi Santoso"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Alamat Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="budi@luziegroup.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Username (untuk login)</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value.replace(/\s+/g, '').toLowerCase() })
                  }
                  placeholder="budi.santoso"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Kosongkan untuk otomatis pakai bagian sebelum "@" di email sebagai username.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">No. WhatsApp / HP</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0812-3456-7890"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Peran (Role)</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="karyawan">Karyawan WFA</option>
                    <option value="leader">Koordinator / Leader</option>
                    <option value="hrd">HRD Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Divisi</label>
                  <select
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {(wfaSettings.divisiList || []).map((divisi) => (
                      <option key={divisi} value={divisi}>
                        {divisi}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.role === 'karyawan' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Koordinator Pembimbing</label>
                    <select
                      value={formData.leaderId}
                      onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {leaders.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">URL Foto Profil Avatar</label>
                <input
                  type="url"
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="user-active-toggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="user-active-toggle" className="font-semibold text-slate-700 cursor-pointer">
                  Akun status aktif (dapat login &amp; mengisi absensi)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
                >
                  {editingUser ? 'Perbarui Akun' : 'Simpan Akun Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-100 shadow-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto font-bold">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Hapus Akun Pengguna?</h4>
            <p className="text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus akun <b>{userToDelete.name}</b> ({userToDelete.email})? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
