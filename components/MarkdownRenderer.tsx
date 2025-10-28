import React, { useState } from 'react';
import { Icon } from './Icon';

interface MarkdownRendererProps {
  content: string;
}

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy code: ', err);
        });
    };

    return (
        <div className="relative group bg-slate-900 my-2 rounded-md">
             <button
                onClick={handleCopy}
                disabled={isCopied}
                className={`absolute top-2 right-2 px-2 py-1 rounded-md text-white text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center space-x-1 ${
                    isCopied
                        ? 'bg-green-600'
                        : 'bg-slate-700 hover:bg-slate-600'
                }`}
                aria-label="Copy code"
            >
                {isCopied ? (
                    <>
                        <Icon name="check" className="w-3 h-3" />
                        <span>Copied!</span>
                    </>
                ) : (
                    <span>Copy</span>
                )}
            </button>
            <pre className="px-4 pb-4 pt-8 overflow-x-auto text-sm text-white">
                <code>{code}</code>
            </pre>
        </div>
    );
};

// Fix: Changed JSX.Element to React.ReactElement to resolve a potential "Cannot find namespace 'JSX'" error.
const renderInline = (text: string): (string | React.ReactElement)[] => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-slate-900 px-1 py-0.5 rounded-md text-sm text-gemini-cyan">{part.slice(1, -1)}</code>;
        }
        return part;
    });
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    const blocks = content.split(/(```[\s\S]*?```)/g);

    return (
        <>
            {blocks.map((block, index) => {
                if (block.startsWith('```') && block.endsWith('```')) {
                    const code = block.slice(3, -3).trim();
                    return <CodeBlock key={index} code={code} />;
                }

                const subBlocks = block.split(/\n\n+/g);

                return subBlocks.map((subBlock, subIndex) => {
                    if (!subBlock.trim()) return null;

                    const lines = subBlock.trim().split('\n');
                    const isList = lines.length > 0 && lines.every(line => /^\s*[-*]\s/.test(line.trim()));

                    if (isList) {
                        return (
                            <ul key={`${index}-${subIndex}`} className="list-disc list-inside space-y-1 my-2">
                                {lines.map((item, i) => (
                                    <li key={i}>{renderInline(item.replace(/^\s*[-*]\s+/, ''))}</li>
                                ))}
                            </ul>
                        );
                    }

                    return (
                        <p key={`${index}-${subIndex}`} className="my-1">
                            {renderInline(subBlock)}
                        </p>
                    );
                });
            })}
        </>
    );
};

export default MarkdownRenderer;