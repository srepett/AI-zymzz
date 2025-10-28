
import React, { useState } from 'react';
import ChatBot from './components/ChatBot';
import ImageTools from './components/ImageTools';
import VideoTools from './components/VideoTools';
import AudioTools from './components/AudioTools';
import GroundedSearch from './components/GroundedSearch';
import ComplexTaskSolver from './components/ComplexTaskSolver';
import { Icon } from './components/Icon';
import Tooltip from './components/Tooltip';
import type { Feature } from './types';

const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<Feature>('chat');

  const features: { id: Feature; label: string; icon: React.ReactNode; tip: string; }[] = [
    { id: 'chat', label: 'Chat', icon: <Icon name="chat" />, tip: 'Engage in a conversation with Gemini.' },
    { id: 'image', label: 'Image', icon: <Icon name="image" />, tip: 'Generate, edit, and analyze images.' },
    { id: 'video', label: 'Video', icon: <Icon name="video" />, tip: 'Create and analyze video content.' },
    { id: 'audio', label: 'Audio', icon: <Icon name="audio" />, tip: 'Have live conversations or generate speech.' },
    { id: 'search', label: 'Search', icon: <Icon name="search" />, tip: 'Get answers grounded in Google Search and Maps.' },
    { id: 'tasks', label: 'Tasks', icon: <Icon name="tasks" />, tip: 'Solve complex problems with advanced reasoning.' },
  ];

  const renderFeature = () => {
    switch (activeFeature) {
      case 'chat':
        return <ChatBot />;
      case 'image':
        return <ImageTools />;
      case 'video':
        return <VideoTools />;
      case 'audio':
        return <AudioTools />;
      case 'search':
        return <GroundedSearch />;
      case 'tasks':
        return <ComplexTaskSolver />;
      default:
        return <ChatBot />;
    }
  };

  return (
    <div className="min-h-screen bg-gemini-dark font-sans flex flex-col">
      <header className="bg-gemini-light-dark/50 backdrop-blur-sm shadow-lg shadow-gemini-cyan/10 p-4 border-b-2 border-gemini-cyan">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gemini-cyan tracking-wider">
            Gemini AI Multi-Tool
          </h1>
        </div>
      </header>

      <div className="w-full bg-gemini-light-dark/30">
        <nav className="container mx-auto flex items-center justify-center p-2 space-x-2 md:space-x-4 overflow-x-auto">
          {features.map((feature) => (
            <Tooltip key={feature.id} tip={feature.tip}>
              <button
                onClick={() => setActiveFeature(feature.id)}
                className={`group flex items-center space-x-2 px-3 py-3 rounded-md text-sm md:text-base font-medium transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gemini-dark focus:ring-gemini-cyan ${
                  activeFeature === feature.id
                    ? 'bg-gemini-cyan text-gemini-dark shadow-md shadow-gemini-cyan/30'
                    : 'text-gray-300 hover:bg-gemini-light-dark hover:text-white'
                }`}
              >
                {React.cloneElement(feature.icon as React.ReactElement, { className: "w-5 h-5 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:-rotate-3" })}
                <span>{feature.label}</span>
              </button>
            </Tooltip>
          ))}
        </nav>
      </div>

      <main className="flex-grow container mx-auto p-4 md:p-6">
        {renderFeature()}
      </main>

      <footer className="bg-gemini-light-dark/50 p-4 text-center text-gray-400 text-sm border-t border-gemini-light-dark">
        Copyright Zymzz
      </footer>
    </div>
  );
};

export default App;
