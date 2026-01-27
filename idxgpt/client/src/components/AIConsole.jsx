import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * AI Console Component
 * Provides a chat-like interface for AI interactions
 */
const AIConsole = ({
  isOpen,
  onClose,
  prompt,
  setPrompt,
  history,
  onSendPrompt,
  isLoading,
  onCancel,
  showDebugLogs,
  setShowDebugLogs,
  onKeyDown,
  isDebugMode,
  responses
}) => {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  // Focus input when console opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard events
  useEffect(() => {
    if (isOpen && onKeyDown) {
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
  }, [isOpen, onKeyDown]);

  if (!isOpen) return null;

  /**
   * Format message content for display
   */
  const formatMessage = (content, type) => {
    if (type === 'error') {
      return <span className="text-red-400">{content}</span>;
    }
    if (type === 'prompt') {
      return <span className="text-blue-300">{content}</span>;
    }
    return <span className="text-gray-100">{content}</span>;
  };

  /**
   * Get message icon based on type
   */
  const getMessageIcon = (type) => {
    switch (type) {
      case 'prompt':
        return <span className="text-blue-400">👤</span>;
      case 'response':
        return <span className="text-green-400">🤖</span>;
      case 'error':
        return <span className="text-red-400">❌</span>;
      default:
        return <span className="text-gray-400">ℹ️</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-green-400 text-lg">🤖</span>
            <h2 className="text-white font-semibold">AI Console</h2>
            {isLoading && (
              <div className="flex items-center space-x-2 text-yellow-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Debug logs toggle */}
            {isDebugMode && (
              <button
                onClick={() => setShowDebugLogs(!showDebugLogs)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  showDebugLogs
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
                title="Toggle debug logs"
              >
                🔧 Debug
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
              title="Close console (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
          {history.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <div className="text-4xl mb-2">💬</div>
              <p>Start a conversation with the AI</p>
              <p className="text-sm mt-1">Type your message below and press Ctrl+Enter to send</p>
            </div>
          ) : (
            history.map((message, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getMessageIcon(message.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs text-gray-400 font-medium">
                      {message.type === 'prompt' ? 'You' : message.type === 'response' ? 'AI' : 'System'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    {message.requestId && (
                      <span className="text-xs text-gray-500 font-mono">
                        #{message.requestId.substring(0, 8)}
                      </span>
                    )}
                  </div>
                  <div className={`p-3 rounded-lg ${
                    message.type === 'prompt'
                      ? 'bg-blue-600 text-white'
                      : message.type === 'response'
                        ? 'bg-gray-800 text-gray-100 border border-gray-700'
                        : 'bg-red-900 text-red-100 border border-red-700'
                  }`}>
                    {message.type === 'response' ? (
                      <div
                        className="whitespace-pre-wrap break-words"
                        dangerouslySetInnerHTML={{
                          __html: formatMessage(content, message.type)
                        }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">
                        {formatMessage(message.content, message.type)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Debug logs section */}
          {showDebugLogs && isDebugMode && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-purple-400">🔧</span>
                <span className="text-purple-300 font-medium">Debug Information</span>
              </div>
              <div className="bg-gray-800 rounded p-3 text-xs font-mono text-gray-300 max-h-32 overflow-y-auto">
                <div>Mode: {isDebugMode ? 'Development' : 'Production'}</div>
                <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
                <div>Responses: {responses.length}</div>
                <div>History: {history.length}</div>
                <div>Authenticated: {navigator.cookieEnabled ? 'Yes' : 'No'}</div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-700 bg-gray-800 rounded-b-lg">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Type your message here... (Ctrl+Enter to send, Esc to close)"
                className="w-full p-3 bg-gray-700 text-white border border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                rows={3}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault();
                    if (prompt.trim() && !isLoading) {
                      onSendPrompt(prompt.trim());
                    }
                  }
                }}
              />
              {prompt.length > 0 && (
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {prompt.length} chars
                </div>
              )}
            </div>

            <div className="flex flex-col space-y-2">
              {/* Send button */}
              <button
                onClick={() => onSendPrompt(prompt.trim())}
                disabled={!prompt.trim() || isLoading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  !prompt.trim() || isLoading
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title="Send message (Ctrl+Enter)"
              >
                {isLoading ? '⏳' : '📤'}
              </button>

              {/* Cancel button */}
              {isLoading && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  title="Cancel current request"
                >
                  🛑
                </button>
              )}

              {/* Clear history button */}
              <button
                onClick={() => {
                  if (window.confirm('Clear console history?')) {
                    // This would need to be passed as a prop
                    console.log('Clear history requested');
                  }
                }}
                className="px-4 py-2 bg-gray-600 text-gray-300 rounded-lg hover:bg-gray-500 transition-colors font-medium"
                title="Clear history"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="mt-2 text-xs text-gray-400 text-center">
            💡 Tip: Use Ctrl+Enter to send, Esc to close console
          </div>
        </div>
      </div>
    </div>
  );
};

AIConsole.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  prompt: PropTypes.string.isRequired,
  setPrompt: PropTypes.func.isRequired,
  history: PropTypes.array.isRequired,
  onSendPrompt: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  showDebugLogs: PropTypes.bool.isRequired,
  setShowDebugLogs: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  isDebugMode: PropTypes.bool.isRequired,
  responses: PropTypes.array.isRequired
};

export default AIConsole;