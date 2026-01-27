import React, { useState, useEffect } from 'react'
import api from '../utils/api'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Register(){
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [phone,setPhone] = useState('')
  const [password,setPassword] = useState('')
  const [err,setErr] = useState('')
  const [planId, setPlanId] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nav = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Check if there's a planId in the URL query parameters
    const urlParams = new URLSearchParams(location.search)
    const planIdFromUrl = urlParams.get('planId')
    if (planIdFromUrl) {
      setPlanId(planIdFromUrl)
      // Store in sessionStorage as backup
      sessionStorage.setItem('selectedPlanId', planIdFromUrl)
    } else {
      // Check if there's a stored planId from sessionStorage
      const storedPlanId = sessionStorage.getItem('selectedPlanId')
      if (storedPlanId) {
        setPlanId(storedPlanId)
      }
    }
  }, [location.search])

  const submit = async (e)=>{
    e.preventDefault()
    setErr('')
    setSuccess('')
    setIsSubmitting(true)

    try{
      const r = await api.post('/auth/register',{name,email,phone,password})
      localStorage.setItem('token', r.data.token)

      setSuccess('Pendaftaran berhasil! Mengarahkan...')

      // Redirect to dashboard with planId if available after a short delay
      setTimeout(() => {
        if (planId) {
          nav(`/dashboard?planId=${planId}`)
          // Clear the stored planId after successful registration
          sessionStorage.removeItem('selectedPlanId')
        } else {
          nav('/dashboard')
        }
      }, 1500)

    }catch(ex){
      setErr(ex.response?.data?.error || 'Gagal daftar')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold mb-4" data-testid="register-title">Daftar</h2>

      {planId && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm">
            🎯 Anda memilih paket: <span className="font-semibold">{planId}</span>
          </p>
          <p className="text-blue-600 text-xs mt-1">
            Setelah daftar, Anda akan diarahkan untuk request paket ini.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 bg-white p-4 rounded-lg shadow">
        <input
          className="w-full border p-2 rounded"
          placeholder="Nama"
          value={name}
          onChange={e=>setName(e.target.value)}
          data-testid="name-input"
          required
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Email"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          data-testid="email-input"
          type="email"
          required
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="No HP"
          value={phone}
          onChange={e=>setPhone(e.target.value)}
          data-testid="phone-input"
          required
        />
        <input
          className="w-full border p-2 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e=>setPassword(e.target.value)}
          data-testid="password-input"
          required
        />
        {err && <div className="text-red-600 text-sm" data-testid="error-message">{err}</div>}
        {success && <div className="text-green-600 text-sm bg-green-50 p-2 rounded" data-testid="success-message">{success}</div>}
        <button
          className={`px-4 py-2 rounded transition ${
            isSubmitting
              ? "bg-gray-400 cursor-not-allowed text-gray-600"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          }`}
          data-testid="register-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Mendaftar..." : "Daftar"}
        </button>
      </form>
    </div>
  )
}
