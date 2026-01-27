import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import { getToken } from '../utils/auth'

export default function Checkout(){
  const [sp] = useSearchParams()
  const planId = sp.get('planId')
  const [plan, setPlan] = useState(null)
  const [tx, setTx] = useState(null)
  const [proof, setProof] = useState(null)
  const [info, setInfo] = useState({ account:'', name:'' })
  const isLogged = !!getToken()

  useEffect(()=>{
    api.get('/plans').then(r=>{
      const p = r.data.find(x=>x.id===planId)
      setPlan(p||null)
    })
  },[planId])

  const createTx = async ()=>{
    const r = await api.post('/checkout/create', { planId })
    setTx(r.data.tx)
    setInfo(r.data.bca)
  }

  const uploadProof = async ()=>{
    const fd = new FormData()
    fd.append('proof', proof)
    await api.post('/checkout/upload/'+tx.id, fd, { headers: {'Content-Type':'multipart/form-data'} })
    alert('Bukti transfer terkirim. Admin akan verifikasi.')
  }

  if(!plan) return <div className="max-w-3xl mx-auto px-4 py-12">Paket tidak ditemukan.</div>
  if(!isLogged) return <div className="max-w-3xl mx-auto px-4 py-12">Harap login terlebih dahulu.</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold mb-4">Checkout — {plan.name}</h2>
      {!tx ? (
        <div className="space-y-4">
          <div>Total bayar: <b>Rp {plan.price.toLocaleString('id-ID')}</b></div>
          <button onClick={createTx} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Buat Transaksi</button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-white rounded-lg shadow">
            <div className="font-semibold">Transfer ke Rekening BCA</div>
            <div>No. Rek: <b>{info.account}</b></div>
            <div>a/n: <b>{info.name}</b></div>
            <div>Jumlah: <b>Rp {tx.amount.toLocaleString('id-ID')}</b></div>
            <div className="text-sm text-gray-500 mt-1">Sertakan berita: myTradeX {tx.id}</div>
          </div>

          <div className="p-4 bg-white rounded-lg shadow">
            <div className="font-semibold mb-2">Upload Bukti Transfer</div>
            <input type="file" accept="image/*" onChange={e=>setProof(e.target.files[0])} />
            <button onClick={uploadProof} disabled={!proof} className="ml-2 bg-green-600 text-white px-3 py-2 rounded disabled:opacity-50">Kirim Bukti</button>
          </div>
        </div>
      )}
    </div>
  )
}
