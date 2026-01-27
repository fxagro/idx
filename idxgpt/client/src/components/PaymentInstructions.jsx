import React, { useState } from 'react';
import api from '../utils/api';

export default function PaymentInstructions({ planId, userId, onPaymentUploaded }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');

  const bankDetails = {
    bank: 'BCA',
    accountNumber: '1392969564',
    accountName: 'Agus Rochman'
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setUploadError('');
    setUploadSuccess('');

    if (!file) {
      setSelectedFile(null);
      setFilePreview('');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Hanya file JPG, PNG, atau PDF yang diperbolehkan');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal 5MB');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setUploadError('Pilih file bukti transfer terlebih dahulu');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('buktiTransfer', selectedFile);
      formData.append('planId', planId);
      formData.append('notes', notes);

      const response = await api.post('/payments/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadSuccess('Bukti transfer berhasil diupload! Menunggu verifikasi admin.');
      setSelectedFile(null);
      setFilePreview('');
      setNotes('');

      // Clear file input
      e.target.reset();

      // Notify parent component
      if (onPaymentUploaded) {
        onPaymentUploaded();
      }

    } catch (error) {
      setUploadError(error.response?.data?.error || 'Gagal upload bukti transfer');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
      <h3 className="text-xl font-semibold mb-4 text-blue-800">💳 Instruksi Pembayaran</h3>

      {/* Bank Details */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="font-semibold mb-3 text-gray-800">Transfer ke rekening berikut:</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Bank:</span>
            <span className="font-medium text-gray-800">{bankDetails.bank}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">No. Rekening:</span>
            <span className="font-medium text-gray-800 font-mono">{bankDetails.accountNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Atas Nama:</span>
            <span className="font-medium text-gray-800">{bankDetails.accountName}</span>
          </div>
        </div>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Bukti Transfer *
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleFileSelect}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isUploading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: JPG, PNG, PDF | Maksimal: 5MB
          </p>
        </div>

        {/* File Preview */}
        {filePreview && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
            <div className="border rounded-lg p-2 bg-gray-50">
              <img
                src={filePreview}
                alt="Preview"
                className="max-w-full h-32 object-contain mx-auto"
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Catatan (Opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tambahkan catatan jika diperlukan..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            disabled={isUploading}
          />
        </div>

        {/* Error Message */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
            {uploadError}
          </div>
        )}

        {/* Success Message */}
        {uploadSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">
            {uploadSuccess}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedFile || isUploading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition ${
            !selectedFile || isUploading
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isUploading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Mengupload...
            </div>
          ) : (
            'Upload Bukti Transfer'
          )}
        </button>
      </form>

      {/* Additional Info */}
      <div className="mt-4 text-xs text-gray-500">
        <p>* Setelah upload, bukti transfer akan diverifikasi admin dalam 1-24 jam.</p>
        <p>* Pastikan bukti transfer jelas dan nominal sesuai dengan paket yang dipilih.</p>
      </div>
    </div>
  );
}