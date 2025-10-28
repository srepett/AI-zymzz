import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import type { ChatMessage } from '../types';
import { Icon } from './Icon';
import Tooltip from './Tooltip';
import MarkdownRenderer from './MarkdownRenderer';

const ReadReceipt: React.FC<{ status?: 'sent' | 'delivered' | 'read' }> = ({ status }) => {
    if (status === 'read') return <Icon name="check-double" className="w-4 h-4 text-gemini-cyan" />;
    if (status === 'delivered') return <Icon name="check" className="w-4 h-4 text-gray-400" />;
    if (status === 'sent') return <Icon name="check" className="w-4 h-4 text-gray-500" />;
    return null;
}

const ChatBot: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [history, setHistory] = useState<{ past: ChatMessage[][], present: ChatMessage[], future: ChatMessage[][] }>({
    past: [],
    present: [],
    future: [],
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = history.present;

  useEffect(() => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const newChat = ai.chats.create({
        model: 'gemini-2.5-flash',
      });
      setChat(newChat);

      const savedHistory = localStorage.getItem('gemini-chat-history');
      if (savedHistory) {
        setHistory({ past: [], present: JSON.parse(savedHistory), future: [] });
      } else {
        setHistory({ past: [], present: [{ role: 'model', parts: [{ text: 'Hello! How can I help you today?' }], timestamp: new Date().toISOString() }], future: [] });
      }

    } catch (error) {
      console.error("Error initializing Gemini:", error);
      const errorMsg = { role: 'model', parts: [{ text: 'Error: Could not initialize AI model. Please check your API key.' }], timestamp: new Date().toISOString() };
      setHistory({ past: [], present: [errorMsg], future: [] });
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Only save non-empty history with more than the initial message
    if (messages.length > 1) {
        localStorage.setItem('gemini-chat-history', JSON.stringify(messages));
    }
    scrollToBottom();
  }, [messages]);

  const setMessages = (newMessages: ChatMessage[], isStreamingUpdate = false) => {
    setHistory(current => {
        if(isStreamingUpdate) {
            return { ...current, present: newMessages };
        }
        return {
            past: [...current.past, current.present],
            present: newMessages,
            future: [],
        };
    });
  };

  const handleUndo = () => {
    if (history.past.length === 0) return;
    setHistory(current => {
        const previous = current.past[current.past.length - 1];
        const newPast = current.past.slice(0, current.past.length - 1);
        return {
            past: newPast,
            present: previous,
            future: [current.present, ...current.future]
        };
    });
  };

  const handleRedo = () => {
      if (history.future.length === 0) return;
      setHistory(current => {
          const next = current.future[0];
          const newFuture = current.future.slice(1);
          return {
              past: [...current.past, current.present],
              present: next,
              future: newFuture
          };
      });
  };

  const formatTimestamp = (isoString: string) => new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleShare = () => {
    if (messages.length === 0) return;

    const formattedConversation = messages.map(msg => {
        const timestamp = formatTimestamp(msg.timestamp);
        const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
        const text = msg.parts[0].text;
        return `[${timestamp}] ${role}: ${text}`;
    }).join('\n');

    navigator.clipboard.writeText(formattedConversation).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the entire chat history? This action cannot be undone.')) {
        const initialMessage: ChatMessage = { role: 'model', parts: [{ text: 'Hello! How can I help you today?' }], timestamp: new Date().toISOString() };
        setHistory({
            past: [],
            present: [initialMessage],
            future: [],
        });
        localStorage.removeItem('gemini-chat-history');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !chat || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', parts: [{ text: input }], timestamp: new Date().toISOString(), status: 'sent' };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chat.sendMessageStream({ message: input });

      let currentModelMessage = '';
      setMessages([...messages, userMessage, { role: 'model', parts: [{ text: '' }], timestamp: new Date().toISOString() }], true);


      for await (const chunk of result) {
        currentModelMessage += chunk.text;
        setHistory(h => {
            const newMessages = [...h.present];
            newMessages[newMessages.length - 1] = { role: 'model', parts: [{ text: currentModelMessage }], timestamp: new Date().toISOString() };
            return { ...h, present: newMessages };
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = { role: 'model', parts: [{ text: 'Sorry, I encountered an error. Please try again.' }], timestamp: new Date().toISOString() };
      setMessages([...messages, userMessage, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] max-h-[700px] bg-gemini-light-dark rounded-lg shadow-lg border border-gemini-cyan/20">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
             <div className={`max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-gemini-cyan text-gemini-dark' : 'bg-slate-700 text-white'}`}>
                {msg.role === 'model' ? <MarkdownRenderer content={msg.parts[0].text} /> : <p className="whitespace-pre-wrap">{msg.parts[0].text}</p>}
             </div>
             <div className={`text-xs text-gray-500 mt-1 px-1 flex items-center space-x-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <span>{formatTimestamp(msg.timestamp)}</span>
                {msg.role === 'user' && <ReadReceipt status={msg.status} />}
             </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1].role === 'user' && (
           <div className="flex justify-start">
             <div className="max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-lg bg-slate-700 text-white">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gemini-cyan rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gemini-cyan rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-gemini-cyan rounded-full animate-pulse delay-150"></div>
                </div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-gemini-light-dark/50 border-t border-gemini-cyan/20">
        <div className="flex items-center space-x-2">
            <Tooltip tip="Undo">
                <button onClick={handleUndo} disabled={history.past.length === 0} className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                    <Icon name="undo" />
                </button>
            </Tooltip>
            <Tooltip tip="Redo">
                <button onClick={handleRedo} disabled={history.future.length === 0} className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                    <Icon name="redo" />
                </button>
            </Tooltip>
            <Tooltip tip={isCopied ? 'Copied!' : 'Copy conversation'}>
                <button onClick={handleShare} disabled={messages.length === 0} className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                    <Icon name="share" />
                </button>
            </Tooltip>
            <Tooltip tip="Clear chat history">
                <button onClick={handleClear} disabled={messages.length <= 1} className="p-2 rounded-md bg-slate-700 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <Icon name="trash" />
                </button>
            </Tooltip>
            <Tooltip tip="Type your message here" className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              className="w-full flex-1 p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan focus:border-transparent text-white"
              disabled={isLoading}
            />
          </Tooltip>
          <Tooltip tip="Send message">
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="p-2 rounded-md bg-gemini-cyan text-gemini-dark disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="send" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;