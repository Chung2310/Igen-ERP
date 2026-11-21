import { useEffect, useRef } from 'react';
import { useToast } from '../../components/ui/ToastProvider';
import { api } from '../../services/api';
import { getSession, saveSession } from '../../services/session';
import { errorMessage, type User } from '../../types';

export default function AccountPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const toast = useToast();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== 'gym:profile-updated') return;
      const details: { fullName?: string; avatarUrl?: string } = {};
      if (typeof event.data.fullName === 'string') details.fullName = event.data.fullName;
      if (typeof event.data.avatarUrl === 'string') details.avatarUrl = event.data.avatarUrl;
      if (Object.keys(details).length === 0) return;
      void api.patch<User>('/api/auth/me', details).then(({ data }) => {
        const session = getSession();
        if (session) saveSession({ token: session.token, user: { ...session.user, ...data } });
        window.dispatchEvent(new CustomEvent<User>('3s:user-profile-updated', { detail: data }));
      }).catch((error) => toast.error(`ERP đã lưu hồ sơ nhưng Gym chưa đồng bộ được: ${errorMessage(error)}`));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [toast]);

  return <iframe
    ref={frame}
    title="Hồ sơ cá nhân"
    src="/cai-dat?sub=ho-so&embed=gym"
    className="block h-[calc(100dvh-7rem)] min-h-[38rem] w-full border-0 bg-surface-container-lowest"
  />;
}
