
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { GroundingSource } from '../types';
import Tooltip from './Tooltip';

const GroundedSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'web' | 'maps'>('web');
    const [result, setResult] = useState('');
    const [sources, setSources] = useState<GroundingSource[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const performSearch = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setError('');
        setResult('');
        setSources([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            const payload: any = {
                model: 'gemini-2.5-flash',
                contents: query,
                config: {},
            };
            
            if (searchType === 'web') {
                payload.config.tools = [{googleSearch: {}}];
            } else {
                payload.config.tools = [{googleMaps: {}}];
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject);
                    });
                    payload.config.toolConfig = {
                        retrievalConfig: {
                            latLng: {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude
                            }
                        }
                    };
                } catch (geoError) {
                   setError('Could not get location for Maps search. Please enable location services.');
                   setIsLoading(false);
                   return;
                }
            }

            const response = await ai.models.generateContent(payload);
            setResult(response.text);
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            setSources(groundingChunks);

        } catch (err) {
            console.error(err);
            setError('Failed to perform search. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-gemini-light-dark p-4 rounded-lg border border-gemini-cyan/20 space-y-4">
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <Tooltip tip="Enter your search query." className="flex-1 w-full">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                        placeholder={searchType === 'web' ? 'Who won the last F1 race?' : 'Good Italian restaurants nearby?'}
                        className="w-full flex-1 p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white"
                    />
                </Tooltip>
                <Tooltip tip="Perform the search." className="w-full sm:w-auto">
                    <button onClick={performSearch} disabled={isLoading || !query.trim()} className="w-full sm:w-auto p-2 rounded-md bg-gemini-cyan text-gemini-dark disabled:bg-gray-500 transition-colors font-bold">
                        {isLoading ? 'Searching...' : 'Search'}
                    </button>
                </Tooltip>
            </div>
             <div className="flex justify-center bg-slate-800 p-1 rounded-lg">
                <Tooltip tip="Search for information on the web." className="w-1/2">
                    <button onClick={() => setSearchType('web')} className={`px-4 py-1 text-sm rounded-md w-full ${searchType === 'web' ? 'bg-gemini-cyan text-gemini-dark' : 'text-gray-300'}`}>Web Search</button>
                </Tooltip>
                <Tooltip tip="Search for places using Google Maps." className="w-1/2">
                    <button onClick={() => setSearchType('maps')} className={`px-4 py-1 text-sm rounded-md w-full ${searchType === 'maps' ? 'bg-gemini-cyan text-gemini-dark' : 'text-gray-300'}`}>Maps Search</button>
                </Tooltip>
             </div>
             {isLoading && <div className="text-center p-4"><div className="w-8 h-8 border-4 border-gemini-cyan border-t-transparent rounded-full animate-spin mx-auto"></div></div>}
            {error && <p className="text-red-400">{error}</p>}
            {result && (
                <div className="space-y-4">
                    <div className="bg-slate-800 p-4 rounded-lg">
                        <p className="whitespace-pre-wrap">{result}</p>
                    </div>
                    {sources.length > 0 && (
                        <div>
                            <h3 className="font-bold mb-2">Sources:</h3>
                            <ul className="list-disc list-inside space-y-1">
                                {sources.map((source, index) => (
                                    <li key={index}>
                                        <a href={source.web?.uri || source.maps?.uri} target="_blank" rel="noopener noreferrer" className="text-gemini-cyan hover:underline">
                                            {source.web?.title || source.maps?.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GroundedSearch;
