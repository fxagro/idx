import React, { useState } from 'react';
import axios from 'axios';
import api from '../utils/api';

const AnalysisPage = () => {
  const [formData, setFormData] = useState({
    symbol: '',
    market: 'idx',
    question: ''
  });
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.symbol.trim() || !formData.question.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await api.post('/stocks/analyze', {
        symbol: formData.symbol.trim().toUpperCase(),
        market: formData.market,
        question: formData.question.trim()
      });

      setAnalysis(response.data);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(
        err.response?.data?.message ||
        'An error occurred while generating the analysis. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderAnalysisContent = (content) => {
    // Simple markdown-like rendering for the analysis content
    const lines = content.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBlockContent = '';

    lines.forEach((line, index) => {
      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={index} className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto">
              <code>{codeBlockContent}</code>
            </pre>
          );
          codeBlockContent = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        return;
      }

      // Handle headers
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-2xl font-bold text-gray-800 mb-4 mt-6">
            {line.substring(2)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-xl font-semibold text-gray-800 mb-3 mt-5">
            {line.substring(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-lg font-medium text-gray-800 mb-2 mt-4">
            {line.substring(4)}
          </h3>
        );
      }
      // Handle bold text
      else if (line.includes('**')) {
        const parts = line.split('**');
        const formatted = parts.map((part, i) => {
          if (i % 2 === 1) {
            return <strong key={i}>{part}</strong>;
          }
          return part;
        });
        elements.push(
          <p key={index} className="mb-2 text-gray-700">
            {formatted}
          </p>
        );
      }
      // Handle bullet points
      else if (line.startsWith('- ')) {
        elements.push(
          <li key={index} className="mb-1 text-gray-700">
            {line.substring(2)}
          </li>
        );
      }
      // Handle numbered lists
      else if (/^\d+\. /.test(line)) {
        elements.push(
          <li key={index} className="mb-1 text-gray-700">
            {line.replace(/^\d+\. /, '')}
          </li>
        );
      }
      // Regular paragraphs
      else if (line.trim()) {
        elements.push(
          <p key={index} className="mb-2 text-gray-700">
            {line}
          </p>
        );
      }
      // Empty lines
      else {
        elements.push(<div key={index} className="h-2" />);
      }
    });

    return elements;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          AI Stock Analysis
        </h1>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Symbol *
                </label>
                <input
                  type="text"
                  id="symbol"
                  name="symbol"
                  value={formData.symbol}
                  onChange={handleInputChange}
                  placeholder="e.g., BBCA, MSFT"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={10}
                />
              </div>

              <div>
                <label htmlFor="market" className="block text-sm font-medium text-gray-700 mb-1">
                  Market *
                </label>
                <select
                  id="market"
                  name="market"
                  value={formData.market}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="idx">Indonesia (IDX)</option>
                  <option value="us">United States (US)</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-1">
                Analysis Question *
              </label>
              <textarea
                id="question"
                name="question"
                value={formData.question}
                onChange={handleInputChange}
                placeholder="e.g., Predict tomorrow's price movement, Should I buy this stock?, What are the risks involved?"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.question.length}/500 characters
              </p>
            </div>
          </form>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Analysis Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-lg text-gray-600">Generating AI analysis...</span>
            </div>
            <p className="text-center text-gray-500 mt-4">
              This may take a few moments as we analyze technical data, fundamental metrics, and market sentiment.
            </p>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                AI Analysis Results
              </h2>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                <span>
                  <strong>Symbol:</strong> {analysis.symbol}
                </span>
                <span>
                  <strong>Market:</strong> {analysis.market.toUpperCase()}
                </span>
                <span>
                  <strong>Question:</strong> {analysis.question}
                </span>
                <span>
                  <strong>Generated:</strong> {new Date(analysis.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="prose max-w-none">
              {renderAnalysisContent(analysis.analysis)}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => window.print()}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Print Analysis
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([analysis.analysis], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `analysis_${analysis.symbol}_${new Date().toISOString().split('T')[0]}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Download as Text
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(analysis.analysis);
                  // You could add a toast notification here
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}

        {/* Usage Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">Analysis Tips</h3>
          <ul className="text-sm text-blue-700 space-y-2">
            <li>• Use specific questions like "What is the trend for the next week?" or "Should I buy at current levels?"</li>
            <li>• The analysis includes technical indicators (SMA, RSI), fundamental metrics (EPS, PER, PBV), and market sentiment</li>
            <li>• Analysis is generated using advanced AI models with fallback to multiple providers for reliability</li>
            <li>• Results are based on historical data and should not be considered as financial advice</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;