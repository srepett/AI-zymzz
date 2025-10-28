

import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import Tooltip from './Tooltip';

const ComplexTaskSolver: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [model, setModel] = useState('gemini-2.5-flash');
    const [useThinkingMode, setUseThinkingMode] = useState(false);
    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const solveTask = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError('');
        setResult('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            const payload: any = {
                model: useThinkingMode ? 'gemini-2.5-pro' : model,
                contents: prompt,
                config: {}
            };

            if (useThinkingMode) {
                payload.config.thinkingConfig = { thinkingBudget: 32768 };
            }

            const response = await ai.models.generateContent(payload);
            setResult(response.text);

        } catch (err) {
            console.error(err);
            setError('Failed to process the task. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-gemini-light-dark p-4 rounded-lg border border-gemini-cyan/20 space-y-4">
            <Tooltip tip="Describe the complex task for the AI to solve." className="w-full">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Write Python code for a web application that visualizes real-time stock market data..."
                    className="w-full p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white min-h-[150px]"
                />
            </Tooltip>
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <label htmlFor="model-select" className="text-sm font-medium">Model:</label>
                    <Tooltip tip="Select the AI model. 'Pro' is best for complex reasoning.">
                        <select id="model-select" value={model} onChange={(e) => setModel(e.target.value)} disabled={useThinkingMode} className="p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white disabled:opacity-50">
                            <option value="gemini-2.5-flash">Flash (Fast)</option>
                            {/* Fix: Use the correct model name for Gemini Flash Lite. */}
                            <option value="gemini-flash-lite-latest">Flash-Lite (Low Latency)</option>
                            <option value="gemini-2.5-pro">Pro (Complex)</option>
                        </select>
                    </Tooltip>
                </div>
                <Tooltip tip="Allows the model more time to think for complex tasks. Forces the 'Pro' model.">
                     <div className="flex items-center space-x-2">
                        <input type="checkbox" id="thinking-mode" checked={useThinkingMode} onChange={(e) => setUseThinkingMode(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-gemini-cyan focus:ring-gemini-cyan"/>
                        <label htmlFor="thinking-mode" className="text-sm font-medium">Enable Thinking Mode (Forces Pro)</label>
                    </div>
                </Tooltip>
            </div>
            <Tooltip tip="Execute the task." className="w-full">
                <button onClick={solveTask} disabled={isLoading || !prompt.trim()} className="w-full p-2 rounded-md bg-gemini-cyan text-gemini-dark disabled:bg-gray-500 transition-colors font-bold">
                    {isLoading ? 'Processing...' : 'Solve Task'}
                </button>
            </Tooltip>
             {isLoading && <div className="text-center p-4"><div className="w-8 h-8 border-4 border-gemini-cyan border-t-transparent rounded-full animate-spin mx-auto"></div></div>}
            {error && <p className="text-red-400">{error}</p>}
            {result && (
                <div className="bg-slate-800 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap">{result}</p>
                </div>
            )}
        </div>
    );
};

export default ComplexTaskSolver;