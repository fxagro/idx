import React, { useEffect, useState } from 'react'
import api from '../utils/api'

export default function Admin(){
  const [list,setList] = useState([])
  const [err,setErr] = useState('')

  const load = async ()=>{
    try{
      const r = await api.get('/admin/transactions')
      setList(r.data)
    }catch(ex){
      setErr('Butuh akun admin. Set role user=admin di server/db.json manual untuk tes.')
    }
  }

  useEffect(()=>{ load() },[])

  const confirm = async (id)=>{
    await api.post('/admin/confirm/'+id)
    await load()
    alert('Transaksi dikonfirmasi & langganan aktif.')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold mb-4">Admin — Verifikasi Pembayaran</h2>
      {err && <div className="text-red-600 text-sm mb-4">{err}</div>}
      <div className="space-y-3">
        {list.map(t=>(
          <div key={t.id} className="bg-white rounded shadow p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{t.id} — {t.plan?.name}</div>
                <div className="text-sm text-gray-600">{t.user?.email} • Rp {t.amount.toLocaleString('id-ID')} • {t.status}</div>
              </div>
              <div className="space-x-2">
                {t.proofPath && <a className="text-indigo-600 underline" href={'http://localhost:5000'+t.proofPath} target="_blank">Lihat Bukti</a>}
                {t.status!=='paid' && <button onClick={()=>confirm(t.id)} className="bg-green-600 text-white px-3 py-1 rounded">Confirm</button>}
              </div>
            </div>
          </div>
        ))}
        {list.length===0 && <div className="text-sm text-gray-500">Tidak ada transaksi.</div>}
      </div>
    </div>
  )
}
