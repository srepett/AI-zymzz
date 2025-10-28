
import React, { useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { fileToBase64 } from '../utils/media';
import type { ImageTool } from '../types';
import { Icon } from './Icon';
import Tooltip from './Tooltip';

const ImageTools: React.FC = () => {
    const [activeTool, setActiveTool] = useState<ImageTool>('generate');
    
    const tools: { id: ImageTool; label: string, tip: string }[] = [
        { id: 'generate', label: 'Generate', tip: 'Create new images from a text prompt.' },
        { id: 'edit', label: 'Edit', tip: 'Modify an existing image with a text prompt.' },
        { id: 'analyze', label: 'Analyze', tip: 'Get a detailed description of an uploaded image.' },
    ];

    const renderTool = () => {
        switch(activeTool) {
            case 'generate': return <ImageGenerator />;
            case 'edit': return <ImageEditor />;
            case 'analyze': return <ImageAnalyzer />;
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

const ImageGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [images, setImages] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const generateImages = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError('');
        setImages([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
                },
            });
            const generatedImages = response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
            setImages(generatedImages);
        } catch (err) {
            console.error(err);
            setError('Failed to generate images. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gemini-light-dark p-4 rounded-lg border border-gemini-cyan/20 space-y-4">
            <Tooltip tip="Describe the image you want to create." className="w-full">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A robot holding a red skateboard..."
                    className="w-full p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white min-h-[80px]"
                />
            </Tooltip>
            <div className="flex items-center space-x-4">
                <Tooltip tip="Choose the dimensions of your generated image.">
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white">
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3</option>
                        <option value="3:4">3:4</option>
                    </select>
                </Tooltip>
                <Tooltip tip="Generate image based on your prompt." className="flex-1">
                    <button onClick={generateImages} disabled={isLoading || !prompt.trim()} className="w-full flex-1 p-2 rounded-md bg-gemini-cyan text-gemini-dark disabled:bg-gray-500 transition-colors font-bold">
                        {isLoading ? 'Generating...' : 'Generate Image'}
                    </button>
                </Tooltip>
            </div>
             {isLoading && <div className="text-center p-4"><div className="w-8 h-8 border-4 border-gemini-cyan border-t-transparent rounded-full animate-spin mx-auto"></div></div>}
            {error && <p className="text-red-400">{error}</p>}
            <div className="grid grid-cols-1 gap-4">
                {images.map((src, i) => <img key={i} src={src} alt={`Generated image ${i + 1}`} className="rounded-lg w-full" />)}
            </div>
        </div>
    );
};

const ImageEditor: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [originalImage, setOriginalImage] = useState<{file: File, url: string} | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(file) {
            setOriginalImage({file, url: URL.createObjectURL(file)});
            setEditedImage(null);
        }
    };
    
    const editImage = async () => {
        if (!prompt.trim() || !originalImage) return;
        setIsLoading(true);
        setError('');
        setEditedImage(null);
        try {
            const base64Data = await fileToBase64(originalImage.file);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType: originalImage.file.type } },
                        { text: prompt },
                    ],
                },
                config: { responseModalities: [Modality.IMAGE] },
            });
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    setEditedImage(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                    break;
                }
            }
        } catch (err) {
            console.error(err);
            setError('Failed to edit image. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gemini-light-dark p-4 rounded-lg border border-gemini-cyan/20 space-y-4">
            <Tooltip tip="Select an image to edit." className="w-full">
                <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gemini-cyan file:text-gemini-dark hover:file:bg-gemini-cyan/80"/>
            </Tooltip>
            {originalImage && (
                 <div className="space-y-4">
                    <Tooltip tip="Describe the edits you want to make." className="w-full">
                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Add a retro filter..." className="w-full p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white min-h-[80px]"/>
                    </Tooltip>
                    <Tooltip tip="Apply edits to your image." className="w-full">
                        <button onClick={editImage} disabled={isLoading || !prompt.trim()} className="w-full p-2 rounded-md bg-gemini-cyan text-gemini-dark disabled:bg-gray-500 transition-colors font-bold">
                             {isLoading ? 'Editing...' : 'Edit Image'}
                        </button>
                    </Tooltip>
                 </div>
            )}
             {isLoading && <div className="text-center p-4"><div className="w-8 h-8 border-4 border-gemini-cyan border-t-transparent rounded-full animate-spin mx-auto"></div></div>}
            {error && <p className="text-red-400">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {originalImage && <div><h3 className="font-bold mb-2 text-center">Original</h3><img src={originalImage.url} alt="Original" className="rounded-lg w-full"/></div>}
                {editedImage && <div><h3 className="font-bold mb-2 text-center">Edited</h3><img src={editedImage} alt="Edited" className="rounded-lg w-full"/></div>}
            </div>
        </div>
    );
};


const ImageAnalyzer: React.FC = () => {
    const [image, setImage] = useState<{file: File, url: string} | null>(null);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(file) {
            setImage({file, url: URL.createObjectURL(file)});
            setAnalysis(null);
            setIsLoading(true);
            setError('');
            try {
                const base64Data = await fileToBase64(file);
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [{ inlineData: { data: base64Data, mimeType: file.type }}, {text: "Describe this image in detail."}] },
                });
                setAnalysis(response.text);
            } catch (err) {
                console.error(err);
                setError('Failed to analyze image. Please try again.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="bg-gemini-light-dark p-4 rounded-lg border border-gemini-cyan/20 space-y-4">
            <Tooltip tip="Select an image to analyze." className="w-full">
                <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gemini-cyan file:text-gemini-dark hover:file:bg-gemini-cyan/80"/>
            </Tooltip>
             {isLoading && <div className="text-center p-4"><div className="w-8 h-8 border-4 border-gemini-cyan border-t-transparent rounded-full animate-spin mx-auto"></div></div>}
            {error && <p className="text-red-400">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {image && <div><img src={image.url} alt="To be analyzed" className="rounded-lg w-full"/></div>}
                {analysis && <div className="bg-slate-800 p-4 rounded-lg"><p className="whitespace-pre-wrap">{analysis}</p></div>}
            </div>
        </div>
    );
};

export default ImageTools;
