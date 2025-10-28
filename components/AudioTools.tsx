
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, createPcmBlob } from '../utils/media';
import type { AudioTool } from '../types';
import { Icon } from './Icon';
import Tooltip from './Tooltip';

const AudioTools: React.FC = () => {
    const [activeTool, setActiveTool] = useState<AudioTool>('live');
    
    const tools: { id: AudioTool; label: string; tip: string }[] = [
        { id: 'live', label: 'Live Conversation', tip: 'Talk with Gemini in real-time.' },
        { id: 'tts', label: 'Text-to-Speech', tip: 'Convert text into spoken audio.' },
    ];

    const renderTool = () => {
        switch(activeTool) {
            case 'live': return <LiveAgent />;
            case 'tts': return <TextToSpeech />;
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


const LiveAgent: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('Idle');
    const [transcripts, setTranscripts] = useState<{speaker: 'user' | 'model', text: string}[]>([]);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    
    const nextStartTimeRef = useRef(0);
    const playingSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    const stopRecording = useCallback(() => {
        setIsRecording(false);
        setStatus('Stopping...');

        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (inputAudioContextRef.current) {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }

        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        
        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        
        playingSourcesRef.current.forEach(source => source.stop());
        playingSourcesRef.current.clear();
        nextStartTimeRef.current = 0;

        setStatus('Idle');
    }, []);


    const startRecording = async () => {
        if (isRecording) return;

        setIsRecording(true);
        setStatus('Initializing...');
        setTranscripts([]);
        currentInputTranscription.current = '';
        currentOutputTranscription.current = '';

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const outputNode = outputAudioContextRef.current.createGain();
            outputNode.connect(outputAudioContextRef.current.destination);

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
                },
                callbacks: {
                    onopen: async () => {
                        setStatus('Connected, listening...');
                        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        
                        const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createPcmBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        source.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                        } else if (message.serverContent?.inputTranscription) {
                            currentInputTranscription.current += message.serverContent.inputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const userText = currentInputTranscription.current.trim();
                            const modelText = currentOutputTranscription.current.trim();
                            if(userText) setTranscripts(prev => [...prev, { speaker: 'user', text: userText }]);
                            if(modelText) setTranscripts(prev => [...prev, { speaker: 'model', text: modelText }]);
                            currentInputTranscription.current = '';
                            currentOutputTranscription.current = '';
                        }
                        
                        // Fix: Added handling for interruption messages from the server to stop audio playback.
                        const interrupted = message.serverContent?.interrupted;
                        if (interrupted) {
                          for (const source of playingSourcesRef.current.values()) {
                            source.stop();
                            playingSourcesRef.current.delete(source);
                          }
                          nextStartTimeRef.current = 0;
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const audioCtx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
                            const source = audioCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            source.addEventListener('ended', () => { playingSourcesRef.current.delete(source); });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            playingSourcesRef.current.add(source);
                        }
                    },
                    onclose: () => { if(isRecording) stopRecording(); setStatus('Connection closed'); },
                    onerror: (e) => { console.error(e); setStatus('Error'); if(isRecording) stopRecording(); }
                }
            });
        } catch (error) {
            console.error("Error starting live session:", error);
            setStatus('Error');
            stopRecording();
        }
    };
    
    useEffect(() => {
        return () => {
           if(isRecording) stopRecording();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="bg-gemini-light-dark p-4 rounded-lg border border-gemini-cyan/20 space-y-4">
            <div className="flex items-center justify-between">
                <p>Status: <span className="font-bold text-gemini-cyan">{status}</span></p>
                <Tooltip tip={isRecording ? 'Stop the live conversation' : 'Start the live conversation'}>
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`px-4 py-2 rounded-md font-bold text-gemini-dark flex items-center space-x-2 ${isRecording ? 'bg-red-500' : 'bg-gemini-cyan'}`}
                    >
                       {isRecording ? <><Icon name="stop" /><span>Stop</span></> : <><Icon name="mic" /><span>Start</span></>}
                    </button>
                </Tooltip>
            </div>
            <div className="h-64 overflow-y-auto bg-slate-800 p-2 rounded-md space-y-2">
                {transcripts.map((t, i) => (
                    <div key={i} className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md px-3 py-1 rounded-lg ${t.speaker === 'user' ? 'bg-gemini-cyan text-gemini-dark' : 'bg-slate-600 text-white'}`}>
                            {t.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const TextToSpeech: React.FC = () => {
    const [text, setText] = useState('');
    const [voice, setVoice] = useState('Kore');
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState('');

    const audioContextRef = useRef<AudioContext | null>(null);

    const generateAndPlay = async () => {
        if (!text.trim() || isPlaying) return;
        setIsPlaying(true);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                    },
                },
            });

            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const audioCtx = audioContextRef.current;

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                source.onended = () => setIsPlaying(false);
                source.start();
            } else {
                throw new Error("No audio data received from API.");
            }
        } catch (err) {
            console.error(err);
            setError('Failed to generate audio. Please try again.');
            setIsPlaying(false);
        }
    };
    
    return (
        <div className="bg-gemini-light-dark p-4 rounded-lg border border-gemini-cyan/20 space-y-4">
            <Tooltip tip="Enter the text you want to convert to speech." className="w-full">
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Say cheerfully: Have a wonderful day!" className="w-full p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white min-h-[120px]"/>
            </Tooltip>
            <div className="flex items-center space-x-4">
                <Tooltip tip="Choose a voice for the generated audio.">
                    <select value={voice} onChange={(e) => setVoice(e.target.value)} className="p-2 rounded-md bg-slate-800 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gemini-cyan text-white">
                        <option value="Kore">Kore</option>
                        <option value="Puck">Puck</option>
                        <option value="Charon">Charon</option>
                        <option value="Fenrir">Fenrir</option>
                        <option value="Zephyr">Zephyr</option>
                    </select>
                </Tooltip>
                <Tooltip tip="Generate and play the audio." className="flex-1">
                    <button onClick={generateAndPlay} disabled={isPlaying || !text.trim()} className="w-full flex-1 p-2 rounded-md bg-gemini-cyan text-gemini-dark disabled:bg-gray-500 transition-colors font-bold flex items-center justify-center space-x-2">
                        {isPlaying ? <><Icon name="stop" /><span>Playing...</span></> : <><Icon name="play"/><span>Play</span></>}
                    </button>
                </Tooltip>
            </div>
            {error && <p className="text-red-400">{error}</p>}
        </div>
    );
};

export default AudioTools;