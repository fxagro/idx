import React, { useState } from 'react';
import { CheckCircle, Clipboard } from 'lucide-react';

export default function AffiliateLink({ referralLink, onGenerateLink }) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      await onGenerateLink();
    } catch (error) {
      console.error('Failed to generate link:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!referralLink) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Your Referral Link
        </h3>
        <p className="text-gray-600 mb-4">
          Generate your unique referral link to start earning commissions.
        </p>
        <button
          onClick={handleGenerateLink}
          disabled={isGenerating}
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : 'Generate Referral Link'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Your Referral Link
      </h3>

      <div className="flex items-center space-x-2 mb-4">
        <input
          type="text"
          value={referralLink}
          readOnly
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
        />
        <button
          onClick={handleCopyLink}
          className="flex items-center space-x-1 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          {copied ? (
            <>
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Copied!</span>
            </>
          ) : (
            <>
              <Clipboard className="h-4 w-4" />
              <span className="text-sm">Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="text-sm text-gray-600">
        <p className="mb-2">
          Share this link with others to earn commissions when they sign up!
        </p>
        <p className="text-xs text-gray-500">
          Commission rates: Level 1 - 40%, Level 2 - 20%
        </p>
      </div>

      <button
        onClick={handleGenerateLink}
        disabled={isGenerating}
        className="mt-4 w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isGenerating ? 'Generating...' : 'Generate New Link'}
      </button>
    </div>
  );
}