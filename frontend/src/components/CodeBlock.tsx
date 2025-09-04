import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string | undefined;
  value: string;
}

export const CodeBlock = ({ language, value }: CodeBlockProps) => {
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-md bg-gray-900 text-white">
      <div className="flex items-center justify-between rounded-t-md bg-gray-800 px-4 py-2">
        <span className="text-xs font-medium text-gray-400">{language || 'code'}</span>
        <button onClick={handleCopy} className="text-gray-400 hover:text-white">
          {hasCopied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm">
        <code>{value}</code>
      </pre>
    </div>
  );
};
