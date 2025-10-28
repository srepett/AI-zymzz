

import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { fileToBase64 } from '../utils/media';
import type { VideoTool } from '../types';
import Tooltip from './Tooltip';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // FIX: Removed `readonly` to resolve modifier conflict error.
    aistudio?: AIStudio;
  }
}

const VideoTools: React.FC = () => {
    const [activeTool, setActiveTool] = useState<VideoTool>('generate');
    
    const tools: { id: VideoTool; label: string, tip: string }[] = [
        { id: 'generate', label: 'Generate', tip: 'Create a new video from a text prompt and optional image.' },
        { id: 'analyze', label: 'Analyze', tip: 'Get a detailed description of an uploaded video.' },
    ];

    const renderTool = () => {
        switch(activeTool) {
            case 'generate': return <VideoGenerator />;
            case 'analyze': return <VideoAnalyzer />;
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-center bg-gemini-light-dark p-1 rounded-lg border border-gemini-cyan/20">
                {tools.map(tool => (
                    <Tooltip key={tool.id} tip={tool.tip} className="w-full">
                        <button onClick={() => setActiveTool(tool.id)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${activeTool === tool.id ? 'bg-gemini-cyan text-gemini-dark' : 'text-gray-300 hover:bg-slate-700'}`}>
                            {tool.label}
                        </button>
                    </Tooltip>
                ))}
            </div>
            {renderTool()}
        </div>
    );
};

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');
    const [apiKeySelected, setApiKeySelected] = useState(false);

    const loadingMessages = [
        "Warming up the digital director's chair...",
        "Conceptualizing the visual narrative...",
        "Assembling pixels into a masterpiece...",
        "Rendering the first few frames...",
        "This might take a few minutes. Great art takes time!",
        "Applying cinematic color grading...",
        "Finalizing the special effects...",
        "Almost ready for the premiere...",
    ];

    const checkApiKey = useCallback(async () => {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
        } else {
            // Fallback for environments without the aistudio object
            setApiKeySelected(true); 
        }
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);
    
    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success after opening dialog to avoid race conditions
            setApiKeySelected(true);
        }
    };

    const generateVideo = async () => {
        if (!prompt.trim() && !image) {
            setError('Please provide a prompt or an image.');
            return;
        }
        
        setIsLoading(true);
        setError('');
        setVideoUrl(null);

        let messageIndex = 0;
        setLoadingMessage(loadingMessages[messageIndex]);
        const interval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            setLoadingMessage(loadingMessages[messageIndex]);
        }, 5000);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const payload: any = {
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: aspectRatio,
                }
            };

            if (image) {
                payload.image = {
                    imageBytes: await fileToBase64(image),
                    mimeType: image.type,
                };
            }

            let operation = await ai.models.generateVideos(payload);

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                const videoBlob = await response.blob();
                setVideoUrl(URL.createObjectURL(videoBlob));
            } else {
                throw new Error('Video generation completed but no download link was found.');
            }

        } catch (err: any) {
            console.error(err);
            let errorMessage = 'Failed to generate video. Please try again.';
            if (err.message.includes('Requested entity was not found')) {
                errorMessage = 'API Key is invalid. Please select a valid key.';
                setApiKeySelected(false);
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
            clearInterval(interval);
            setLoadingMessage('');
        }
    };

    if (!apiKeySelected) {
        return (
            <div className="bg-gemini-light-dark p-6 rounded-lg border border-gemini-cyan/20 text-center space-y-4">
                 <h2 className="text-xl font-bold text-white">API Key Required for Video Generation</h2>
                 <p>Veo video generation requires a project with billing enabled.</p>
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-gemini-cyan hover:underline">
                    Learn more about billing
                </a>
                <Tooltip tip="Select an API key with billing enabled for video generation." className="w-full">
                     <button onClick={handleSelectKey} className="w-full mt-4 p-2 rounded-md bg-gemini-cyan text-gemini-dark font-bold">
                        Select API Key
                     </button>
                </Tooltip>
            </div>
        );
    }
    
    return (
        <div className="bg-gemini-light-dark p-4 rounded-lg border border-gemini-cyan/20 space-y-4">
            <Tooltip tip="Describe the video you want to create." className="w-full">
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A neon hologram of a cat driving..." className="w-full p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white min-h-[80px]"/>
            </Tooltip>
            <Tooltip tip="Optionally provide a starting image for the video." className="w-full">
                <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gemini-cyan file:text-gemini-dark hover:file:bg-gemini-cyan/80"/>
            </Tooltip>
            <div className="flex items-center space-x-4">
                <Tooltip tip="Choose the orientation of your video.">
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')} className="p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white">
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                    </select>
                </Tooltip>
                <Tooltip tip="Generate video. This may take a few minutes." className="flex-1">
                    <button onClick={generateVideo} disabled={isLoading || (!prompt.trim() && !image)} className="w-full flex-1 p-2 rounded-md bg-gemini-cyan text-gemini-dark disabled:bg-gray-500 transition-colors font-bold">
                        {isLoading ? 'Generating...' : 'Generate Video'}
                    </button>
                </Tooltip>
            </div>
            {isLoading && <div className="text-center p-4 space-y-2"><div className="w-8 h-8 border-4 border-gemini-cyan border-t-transparent rounded-full animate-spin mx-auto"></div><p className="text-gemini-cyan">{loadingMessage}</p></div>}
            {error && <p className="text-red-400">{error}</p>}
            {videoUrl && <video src={videoUrl} controls className="rounded-lg w-full"></video>}
        </div>
    );
};

const VideoAnalyzer: React.FC = () => {
    const [video, setVideo] = useState<{file: File, url: string} | null>(null);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 20 * 1024 * 1024) { // 20MB limit for demo
                setError("File is too large. Please select a video under 20MB.");
                return;
            }
            setVideo({ file, url: URL.createObjectURL(file) });
            setAnalysis(null);
            setIsLoading(true);
            setError('');
            try {
                const base64Data = await fileToBase64(file);
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: {
                        parts: [
                            { inlineData: { data: base64Data, mimeType: file.type } },
                            { text: "Analyze this video for key information. Describe the main subject, actions, and overall theme." }
                        ]
                    },
                });
                setAnalysis(response.text);
            } catch (err) {
                console.error(err);
                setError('Failed to analyze video. This feature is experimental and may have file size/format limitations.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="bg-gemini-light-dark p-4 rounded-lg border border-gemini-cyan/20 space-y-4">
            <Tooltip tip="Select a video to analyze (