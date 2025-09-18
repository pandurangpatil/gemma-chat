import { useQuery } from '@tanstack/react-query';
import { getVersion } from '../lib/api';

export function VersionInfo() {
  const { data: backendVersionData } = useQuery({
    queryKey: ['version'],
    queryFn: getVersion,
  });

  const frontendVersion = import.meta.env.VITE_APP_VERSION || '0.0.0-dev';

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
      <p>Frontend Version: {frontendVersion}</p>
      <p>Backend Version: {backendVersionData?.version || 'Loading...'}</p>
    </div>
  );
}
