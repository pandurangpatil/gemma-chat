import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getThreads, createThread } from '../lib/api';
import { PlusSquare, Search } from 'lucide-react';
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

  const handleNewThread = () => {
    createThreadMutation.mutate();
  };

  return (
    <aside className="w-80 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
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
              <li key={thread.id}>
                <Link
                  to={`/threads/${thread.id}`}
                  className="block p-4 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-current={location.pathname.includes(thread.id) ? 'page' : undefined}
                >
                  <h3 className="font-semibold truncate">{thread.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {`Updated ${formatDistanceToNow(new Date(thread.updated_at))} ago`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
