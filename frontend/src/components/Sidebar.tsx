import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getThreads, createThread, clearAllThreads, updateThread } from '../lib/api';
import { PlusSquare, Search, Trash2, Edit3, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Custom hook for debouncing
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function Sidebar() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const { data: threads, isLoading, isError } = useQuery({
    queryKey: ['threads', debouncedSearchTerm],
    queryFn: () => getThreads(debouncedSearchTerm),
  });

  const createThreadMutation = useMutation({
    mutationFn: createThread,
    onSuccess: (newThread) => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      navigate(`/threads/${newThread.id}`);
    },
    onError: (error) => {
      console.error("Failed to create thread:", error);
    }
  });

  const clearAllThreadsMutation = useMutation({
    mutationFn: clearAllThreads,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      setShowClearAllDialog(false);
      navigate('/');
    },
    onError: (error) => {
      console.error("Failed to clear all threads:", error);
    }
  });

  const updateThreadMutation = useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) => 
      updateThread(threadId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      setEditingThreadId(null);
      setEditingTitle('');
    },
    onError: (error) => {
      console.error("Failed to update thread:", error);
    }
  });

  const handleNewThread = () => {
    createThreadMutation.mutate();
  };

  const handleClearAll = () => {
    clearAllThreadsMutation.mutate();
  };

  const startEditing = (threadId: string, currentTitle: string) => {
    setEditingThreadId(threadId);
    setEditingTitle(currentTitle);
  };

  const cancelEditing = () => {
    setEditingThreadId(null);
    setEditingTitle('');
  };

  const saveTitle = () => {
    if (editingThreadId && editingTitle.trim()) {
      updateThreadMutation.mutate({ 
        threadId: editingThreadId, 
        title: editingTitle.trim() 
      });
    }
  };

  return (
    <aside className="w-80 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Chats</h1>
          <button
            onClick={handleNewThread}
            disabled={createThreadMutation.isPending}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="New Thread"
          >
            <PlusSquare className="h-6 w-6" />
          </button>
        </div>
        <button
          onClick={() => setShowClearAllDialog(true)}
          disabled={clearAllThreadsMutation.isPending || !threads?.length}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-md transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Clear All History
        </button>
      </div>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search threads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="p-4">Loading threads...</p>}
        {isError && <p className="p-4 text-red-500">Failed to load threads.</p>}
        <nav>
          <ul>
            {threads?.map((thread) => (
              <li key={thread.id} className="group relative">
                <div className="flex items-center border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Link
                    to={`/threads/${thread.id}`}
                    className="flex-1 p-4 block"
                    aria-current={location.pathname.includes(thread.id) ? 'page' : undefined}
                  >
                    {editingThreadId === thread.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveTitle();
                            } else if (e.key === 'Escape') {
                              cancelEditing();
                            }
                          }}
                          className="flex-1 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={saveTitle}
                          disabled={updateThreadMutation.isPending}
                          className="p-1 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-1 text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-semibold truncate">{thread.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {`Updated ${formatDistanceToNow(new Date(thread.updated_at))} ago`}
                        </p>
                      </div>
                    )}
                  </Link>
                  {editingThreadId !== thread.id && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        startEditing(thread.id, thread.title);
                      }}
                      className="p-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-700 transition-opacity"
                      aria-label="Edit thread name"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      
      {/* Clear All Confirmation Dialog */}
      {showClearAllDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">Clear All History</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete all threads? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearAllDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearAllThreadsMutation.isPending}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-md"
              >
                {clearAllThreadsMutation.isPending ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
