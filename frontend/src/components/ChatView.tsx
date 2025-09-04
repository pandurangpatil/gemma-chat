import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { nanoid } from 'nanoid';
import { getThread, postMessage } from '../lib/api';
import { CodeBlock } from './CodeBlock';
import { Send } from 'lucide-react';

// UI-only message type to handle optimistic updates and streaming
type DisplayMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function ChatView() {
  const { threadId } = useParams<{ threadId: string }>();
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: threadData, isLoading, isError } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => getThread(threadId!),
    enabled: !!threadId,
  });

  useEffect(() => {
    if (threadData) {
      setDisplayMessages(threadData.messages.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })));
    } else {
        setDisplayMessages([]);
    }
  }, [threadData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  const messageMutation = useMutation({
    mutationFn: ({ threadId, content }: { threadId: string; content: string }) => postMessage(threadId, content),
    onSuccess: async (response) => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let streaming = true;

      while (streaming) {
        const { done, value } = await reader.read();
        if (done) {
          streaming = false;
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        setDisplayMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            lastMessage.content += chunk;
            return [...prev];
        });
      }

      // Refetch the thread to get the final, saved messages
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads'] }); // To update the "updated_at" in sidebar
    },
    onError: (error) => {
      console.error("Streaming failed:", error);
      // Handle error, maybe show a message to the user
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadId || !inputValue.trim()) return;

    const userMessage: DisplayMessage = {
      id: nanoid(),
      role: 'user',
      content: inputValue,
    };
    const assistantPlaceholder: DisplayMessage = {
        id: nanoid(),
        role: 'assistant',
        content: '',
    };

    setDisplayMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInputValue('');

    messageMutation.mutate({ threadId, content: inputValue });
  };

  if (!threadId) {
    return (
      <main className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
            <h1 className="text-2xl font-semibold">Welcome to Chat-with-Gemma</h1>
            <p>Select a chat on the left or start a new one.</p>
        </div>
      </main>
    );
  }

  if (isLoading) return <main className="flex-1 flex items-center justify-center"><p>Loading chat...</p></main>;
  if (isError) return <main className="flex-1 flex items-center justify-center text-red-500"><p>Failed to load chat.</p></main>;

  return (
    <main className="flex-1 flex flex-col bg-white dark:bg-gray-800">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          {displayMessages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl p-4 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const lang = match ? match[1] : undefined;
                            return (
                                <CodeBlock
                                    language={lang}
                                    value={String(children).replace(/\n$/, '')}
                                    {...props}
                                />
                            );
                        }
                    }}
                >
                    {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="flex items-center space-x-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded-md bg-gray-100 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
            disabled={messageMutation.isPending}
          />
          <button type="submit" className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300" disabled={messageMutation.isPending}>
            <Send />
          </button>
        </form>
      </div>
    </main>
  );
}
