'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { createProjectSocket } from '../lib/socket';
import { getToken } from '../lib/auth';

type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'unauthenticated';

interface TraceEvent {
  traceId: string;
}

interface ReplayEvent {
  replayId: string;
}

interface EvaluationEvent {
  evaluationId: string;
}

interface TestRunEvent {
  testRunId: string;
}

interface PresenceEvent {
  traceId: string;
  userId: string;
}

interface ProjectSocketContextValue {
  status: SocketStatus;
  error: string | null;
  viewTrace: (traceId: string) => void;
  stopViewing: (traceId: string) => void;
  isTraceViewedByOther: (traceId: string) => boolean;
}

const ProjectSocketContext = createContext<ProjectSocketContextValue | null>(null);

function invalidateTrace(queryClient: QueryClient, projectId: string, traceId: string): void {
  void queryClient.invalidateQueries({ queryKey: ['traces', projectId] });
  void queryClient.invalidateQueries({ queryKey: ['trace', traceId] });
}

export function ProjectSocketProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const viewedTraceRef = useRef<string | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const token = getToken();
    if (token === null) {
      setStatus('unauthenticated');
      return;
    }

    const socket = createProjectSocket(token, projectId);
    socketRef.current = socket;
    setStatus('connecting');
    setError(null);

    const onConnect = (): void => {
      setStatus('connected');
      if (viewedTraceRef.current !== null) {
        socket.emit('trace.viewing', { traceId: viewedTraceRef.current });
      }
    };
    const onDisconnect = (): void => {
      setStatus('disconnected');
    };
    const onError = (socketError: Error): void => {
      setStatus('error');
      setError(socketError.message);
    };
    const onTraceEvent = (event: TraceEvent): void => {
      invalidateTrace(queryClient, projectId, event.traceId);
    };
    const onReplayProgress = (event: ReplayEvent): void => {
      void queryClient.invalidateQueries({ queryKey: ['replay', event.replayId] });
      void queryClient.invalidateQueries({ queryKey: ['replay-comparison', event.replayId] });
    };
    const onReplayCompleted = (event: ReplayEvent): void => {
      onReplayProgress(event);
      void queryClient.invalidateQueries({ queryKey: ['traces', projectId] });
    };
    const onEvaluationCompleted = (event: EvaluationEvent): void => {
      void queryClient.invalidateQueries({ queryKey: ['evaluation', event.evaluationId] });
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      void queryClient.invalidateQueries({ queryKey: ['review-queue', projectId] });
    };
    const onTestRunEvent = (event: TestRunEvent): void => {
      void queryClient.invalidateQueries({ queryKey: ['test-run', event.testRunId] });
    };
    const onPresence = (event: PresenceEvent): void => {
      setViewers((current) => {
        const next = new Set(current);
        next.add(event.traceId);
        return next;
      });
    };
    const onPresenceLeft = (event: PresenceEvent): void => {
      setViewers((current) => {
        const next = new Set(current);
        next.delete(event.traceId);
        return next;
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('span.created', onTraceEvent);
    socket.on('run.status_changed', onTraceEvent);
    socket.on('replay.progress', onReplayProgress);
    socket.on('replay.completed', onReplayCompleted);
    socket.on('evaluation.completed', onEvaluationCompleted);
    socket.on('test_run.progress', onTestRunEvent);
    socket.on('test_run.completed', onTestRunEvent);
    socket.on('presence.viewing', onPresence);
    socket.on('presence.left', onPresenceLeft);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      viewedTraceRef.current = null;
      setViewers(new Set());
    };
  }, [projectId, queryClient]);

  const viewTrace = useCallback((traceId: string): void => {
    viewedTraceRef.current = traceId;
    socketRef.current?.emit(
      'trace.viewing',
      { traceId },
      (response: { hasOtherViewer?: boolean } | undefined) => {
        if (response?.hasOtherViewer === true) {
          setViewers((current) => {
            const next = new Set(current);
            next.add(traceId);
            return next;
          });
        }
      },
    );
  }, []);

  const stopViewing = useCallback((traceId: string): void => {
    socketRef.current?.emit('trace.viewing.stop', { traceId });
    if (viewedTraceRef.current === traceId) {
      viewedTraceRef.current = null;
    }
    setViewers((current) => {
      const next = new Set(current);
      next.delete(traceId);
      return next;
    });
  }, []);

  const isTraceViewedByOther = useCallback(
    (traceId: string): boolean => viewers.has(traceId),
    [viewers],
  );

  return (
    <ProjectSocketContext.Provider
      value={{ status, error, viewTrace, stopViewing, isTraceViewedByOther }}
    >
      {status === 'error' || status === 'disconnected' ? (
        <p className="socket-status-banner" role="status">
          Live updates are unavailable{error === null ? '.' : `: ${error}`}
        </p>
      ) : null}
      {children}
    </ProjectSocketContext.Provider>
  );
}

export function useProjectSocket(): ProjectSocketContextValue {
  const context = useContext(ProjectSocketContext);
  if (context === null) {
    throw new Error('useProjectSocket must be used inside ProjectSocketProvider');
  }
  return context;
}
